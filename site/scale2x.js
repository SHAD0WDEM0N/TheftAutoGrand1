/**
 * Pure, dependency-free Scale2x post-processing for the DOS framebuffer.
 * Designed to run on the already-supplied js-dos frame, never on game assets.
 * The source is preserved and no third-party mod downloads are required.
 *
 * The native Scale2x rule compares four neighbours and replaces each source
 * pixel with four edge-aware pixels, preserving flat colours without blur.
 */
export const MAX_SCALE2X_PIXELS = 400 * 300;
export const SCALE2X_FRAME_INTERVAL_MS = 40; // 25 FPS processing ceiling

export function canScale2x(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) &&
    width >= 16 && height >= 16 && width * height <= MAX_SCALE2X_PIXELS;
}

export function scale2xFrame(rgb, rgba, width, height, output) {
  if (!canScale2x(width, height)) throw new Error('Scale2x is restricted to supported low-resolution video modes.');
  const source = rgb ?? rgba;
  const channels = rgb ? 3 : 4;
  if (!source || source.length < width * height * channels)
    throw new Error('Incomplete game framebuffer.');
  const outWidth = width * 2, outHeight = height * 2;
  const destination = output || new Uint8ClampedArray(outWidth * outHeight * 4);
  if (destination.length !== outWidth * outHeight * 4) throw new Error('Incorrect Scale2x output dimensions.');

  const same = (a, b) => {
    const ai = a * channels, bi = b * channels;
    return source[ai] === source[bi] &&
      source[ai + 1] === source[bi + 1] &&
      source[ai + 2] === source[bi + 2];
  };
  const put = (pixel, target) => {
    const si = pixel * channels, di = target * 4;
    destination[di] = source[si];
    destination[di + 1] = source[si + 1];
    destination[di + 2] = source[si + 2];
    destination[di + 3] = 255;
  };

  for (let y = 0; y < height; y++) {
    const above = Math.max(y - 1, 0) * width;
    const row = y * width;
    const below = Math.min(y + 1, height - 1) * width;
    for (let x = 0; x < width; x++) {
      const left = Math.max(x - 1, 0), right = Math.min(x + 1, width - 1);
      const e = row + x, b = above + x, d = row + left, f = row + right, h = below + x;
      let e0 = e, e1 = e, e2 = e, e3 = e;
      if (!same(b, h) && !same(d, f)) {
        if (same(d, b)) e0 = d;
        if (same(b, f)) e1 = f;
        if (same(d, h)) e2 = d;
        if (same(h, f)) e3 = f;
      }
      const target = y * 2 * outWidth + x * 2;
      put(e0, target); put(e1, target + 1);
      put(e2, target + outWidth); put(e3, target + outWidth + 1);
    }
  }
  return destination;
}

export function needsEnhancedScale2x(preset) {
  return preset === 'enhanced' || preset === 'vibrant';
}
