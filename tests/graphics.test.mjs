import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAPHICS_PRESETS, GRAPHICS_STORAGE_KEY, normalizeGraphicsPreset, applyGraphicsPreset } from '../site/graphics.js';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../site/style.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8');

test('Phase 1 ships all four graphics presets with a safe original default', () => {
  assert.deepEqual(Object.keys(GRAPHICS_PRESETS), ['original', 'smart', 'enhanced', 'vibrant', 'crt']);
  assert.equal(normalizeGraphicsPreset('original'), 'original');
  assert.equal(normalizeGraphicsPreset('vibrant'), 'vibrant');
  assert.equal(normalizeGraphicsPreset('invalid'), 'original');
  assert.equal(normalizeGraphicsPreset(undefined), 'original');
  assert.equal(normalizeGraphicsPreset('__proto__'), 'original');
  assert.match(GRAPHICS_STORAGE_KEY, /graphics-phase1/);
});

test('presets update only the stage graphics attribute', () => {
  const stage = { dataset: { graphics: 'original' } };
  assert.equal(applyGraphicsPreset(stage, 'enhanced'), 'enhanced');
  assert.equal(stage.dataset.graphics, 'enhanced');
  assert.equal(applyGraphicsPreset(stage, 'bogus'), 'original');
  assert.equal(stage.dataset.graphics, 'original');
  assert.throws(() => applyGraphicsPreset(null, 'crt'), /unavailable/);
});

test('graphics modes are in permanent site UI, not fetched or installed as mods', () => {
  assert.match(html, /id="graphics-preset"/);
  for (const name of Object.keys(GRAPHICS_PRESETS)) {
    assert.match(html, new RegExp('<option value="' + name + '">'));
    assert.match(css, new RegExp('data-graphics="' + name + '"'));
  }
  assert.match(app, /applyGraphicsPreset\(\$\('stage-frame'\), value\)/);
  assert.match(app, /localStorage\.setItem\(GRAPHICS_STORAGE_KEY, preset\)/);
  assert.match(app, /normalizeGraphicsPreset\(localStorage\.getItem\(GRAPHICS_STORAGE_KEY\)\)/);
  assert.match(app, /\$\('graphics-preset'\)\.addEventListener\('change'/);
  assert.ok(!app.includes('bundleWithGraphicsMod'));
});

test('all presets retain sharp scaling and 4:3 aspect correction', () => {
  assert.match(app, /renderAspect:\s*'4\/3'/);
  assert.match(app, /imageRendering:\s*'pixelated'/);
  assert.match(css, /\.stage-frame\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(css, /#stage-frame:fullscreen #player\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.ok(!html.includes('Smooth scaling'));
});

test('CRT effects do not intercept gameplay input or cover launch overlay', () => {
  assert.match(css, /#stage-frame\[data-graphics="crt"\]::after/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /z-index:\s*2/);
  assert.match(css, /\.boot-splash\s*\{[\s\S]*?z-index:\s*5/);
  assert.match(css, /repeating-linear-gradient/);
  assert.ok(!css.includes('backdrop-filter: blur('));
});
