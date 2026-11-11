import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canScale2x, scale2xFrame, needsEnhancedScale2x, SCALE2X_FRAME_INTERVAL_MS } from '../site/scale2x.js';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../site/style.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8');

test('2x pixel processing is limited to safe resolutions with a capped frame interval', () => {
  assert.equal(canScale2x(320, 200), true);
  assert.equal(canScale2x(400, 300), true);
  assert.equal(canScale2x(640, 480), false);
  assert.equal(canScale2x(1920, 1080), false);
  assert.equal(canScale2x(0, 200), false);
  assert.ok(SCALE2X_FRAME_INTERVAL_MS >= 40);
});

test('Scale2x preserves source colours and outputs four pixels per input pixel', () => {
  const width = 16, height = 16;
  const input = new Uint8Array(width * height * 3);
  for (let i = 0; i < input.length; i += 3) { input[i] = 190; input[i+1] = 64; input[i+2] = 17; }
  const output = scale2xFrame(input, null, width, height);
  assert.equal(output.length, width * height * 16);
  for (let i = 0; i < output.length; i += 4) {
    assert.deepEqual(Array.from(output.subarray(i, i + 4)), [190, 64, 17, 255]);
  }
});

test('Scale2x uses edge-aware neighbour selection instead of a simple pixel copy', () => {
  const w = 16, h = 16;
  const input = new Uint8Array(w * h * 4);
  for (let i = 3; i < input.length; i += 4) input[i] = 255;
  const put = (x, y, r, g, b) => {
    const i = (y * w + x) * 4;
    input.set([r,g,b,255], i);
  };
  // Center E is white, north B and west D red, east F blue and south H green.
  put(8,8,255,255,255);
  put(8,7,255,0,0);
  put(7,8,255,0,0);
  put(9,8,0,0,255);
  put(8,9,0,255,0);
  const out = scale2xFrame(null, input, w, h);
  const topLeft = ((8*2) * w*2 + 8*2) * 4;
  const topRight = topLeft+4;
  assert.deepEqual(Array.from(out.subarray(topLeft, topLeft+4)), [255,0,0,255]);
  assert.deepEqual(Array.from(out.subarray(topRight, topRight+4)), [255,255,255,255]);
});

test('invalid frames fail safely without changing source bytes', () => {
  assert.throws(() => scale2xFrame(null, null, 320, 200), /Incomplete/);
  assert.throws(() => scale2xFrame(new Uint8Array(4), null, 320, 200), /Incomplete/);
  assert.throws(() => scale2xFrame(new Uint8Array(4), null, 640, 480), /restricted/);
  const source = new Uint8Array(16 * 16 * 3).fill(21);
  const copy = source.slice();
  scale2xFrame(source, null, 16,16);
  assert.deepEqual(source,copy);
});

test('enhanced modes render from private emulator frames, not downloaded mod assets', () => {
  assert.equal(needsEnhancedScale2x('original'), false);
  assert.equal(needsEnhancedScale2x('enhanced'), true);
  assert.equal(needsEnhancedScale2x('vibrant'), true);
  assert.equal(needsEnhancedScale2x('crt'), false);
  assert.match(html, /id="graphics-startup"/);
  assert.match(html, /id="enhanced-canvas"/);
  assert.match(app, /ci\.events\(\)\.onFrame\(\(rgb, rgba\) => processEnhancedFrame\(rgb, rgba\)\)/);
  assert.match(app, /scale2xFrame\(rgb, rgba, w, h, scaleImage\.data\)/);
  assert.match(app, /canScale2x\(w, h\)/);
  assert.match(css, /#stage-frame:fullscreen #enhanced-canvas\s*\{/);
  assert.match(css, /#enhanced-canvas\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(app, /handleGraphicsChange\(\$\('graphics-startup'\)\.value\)/);
});

test('SciTech Esc button needs a user click, and detecting GTA exe does not reveal DOS', () => {
  assert.match(html, /id="skip-video-probe"/);
  assert.match(app, /\$\('skip-video-probe'\)\.addEventListener\('click'/);
  assert.match(app, /ci\.simulateKeyPress\(256\)/);
  const programCheck = app.slice(app.indexOf('function watchGtaStartup()'), app.indexOf('function loadLibrary()'));
  assert.ok(!programCheck.includes('hideBootSplash()'));
  assert.match(app, /bootGraphicFrames >= 6/);
});
