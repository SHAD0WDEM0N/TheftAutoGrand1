/**
 * Smart HD Phase 3: dependency-free WebGL1 neighbour-aware video filter.
 * Unlike CPU Scale2x this runs the edge reconstruction in a GPU fragment
 * shader. It receives only game pixels already supplied by js-dos.
 * No GTA game assets, external shaders, or installation steps.
 */
export const MAX_GPU_PIXELS = 640 * 480;
export const GPU_FRAME_INTERVAL_MS = 33;
export function canGpuUpscale(width, height) {
  return Number.isInteger(width) && Number.isInteger(height)
    && width >= 16 && height >= 16 && width * height <= MAX_GPU_PIXELS;
}
export const GPU_VERTEX_SHADER = String.raw`
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  // js-dos input frames begin at top-left; WebGL textures begin at bottom-left.
  v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
export const GPU_FRAGMENT_SHADER = String.raw`
precision mediump float;
uniform sampler2D u_frame;
uniform vec2 u_sourceSize;
varying vec2 v_uv;
vec3 pix(vec2 cell) {
  return texture2D(u_frame, (clamp(cell, vec2(0.0), u_sourceSize-1.0) + 0.5) / u_sourceSize).rgb;
}
bool similar(vec3 a, vec3 b) {
  return distance(a, b) < 0.10;
}
void main() {
  // Four output pixels per input, with gentle diagonal reconstruction
  // at actual sprite edges. Preserve flat areas exactly.
  vec2 p = v_uv * u_sourceSize;
  vec2 cell = floor(p);
  vec2 quadrant = fract(p);
  vec3 e = pix(cell);
  vec3 n = pix(cell + vec2(0.0, -1.0));
  vec3 s = pix(cell + vec2(0.0,  1.0));
  vec3 w = pix(cell + vec2(-1.0, 0.0));
  vec3 r = pix(cell + vec2( 1.0, 0.0));
  vec3 chosen = e;
  if (!similar(n,s) && !similar(w,r)) {
    if (quadrant.x < 0.5 && quadrant.y < 0.5 && similar(w,n)) chosen = mix(e,w,0.50);
    if (quadrant.x >= 0.5 && quadrant.y < 0.5 && similar(n,r)) chosen = mix(e,r,0.50);
    if (quadrant.x < 0.5 && quadrant.y >= 0.5 && similar(w,s)) chosen = mix(e,w,0.50);
    if (quadrant.x >= 0.5 && quadrant.y >= 0.5 && similar(s,r)) chosen = mix(e,r,0.50);
  }
  gl_FragColor = vec4(chosen, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('GPU shader creation failed.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export function createSmartRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL graphics are unavailable.');
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, GPU_VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, GPU_FRAGMENT_SHADER);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'GPU program linking failed.');
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, 'a_position');
  if (location < 0) throw new Error('GPU vertex input missing.');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'u_frame'), 0);
  const dimensions = gl.getUniformLocation(program,'u_sourceSize');
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  // WebGL has no DOM dependency outside the passed-in canvas.
  return {
    render(rgb, rgba, width, height) {
      if (!canGpuUpscale(width,height)) throw new Error('Unsupported GPU source resolution.');
      const pixels = rgb || rgba;
      const format = rgb ? gl.RGB : gl.RGBA;
      const channels = rgb ? 3 : 4;
      if (!pixels || pixels.length < width*height*channels) throw new Error('Incomplete GPU input frame.');
      if (canvas.width !== width*2 || canvas.height !== height*2) {
        canvas.width = width*2; canvas.height = height*2;
      }
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.useProgram(program);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.uniform2f(dimensions,width,height);
      gl.texImage2D(gl.TEXTURE_2D,0,format,width,height,0,format,gl.UNSIGNED_BYTE,pixels);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    },
    dispose() {
      gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    }
  };
}
