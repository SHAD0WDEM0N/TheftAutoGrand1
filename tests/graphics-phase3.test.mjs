import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canGpuUpscale, GPU_FRAME_INTERVAL_MS, GPU_FRAGMENT_SHADER, GPU_VERTEX_SHADER } from '../site/gpu-upscale.js';
const html = readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const app = readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
const css = readFileSync(new URL('../site/style.css',import.meta.url),'utf8');
const gfx = readFileSync(new URL('../site/graphics.js',import.meta.url),'utf8');

test('Smart HD is a built-in GPU mode for supported source dimensions', () => {
  assert.equal(canGpuUpscale(320,200),true);
  assert.equal(canGpuUpscale(640,480),true);
  assert.equal(canGpuUpscale(1024,768),false);
  assert.equal(canGpuUpscale(0,200),false);
  assert.ok(GPU_FRAME_INTERVAL_MS>=30);
  assert.match(GPU_VERTEX_SHADER,/gl_Position/);
  assert.match(GPU_FRAGMENT_SHADER,/texture2D/);
  assert.match(GPU_FRAGMENT_SHADER,/similar\(w,n\)/);
  assert.match(gfx,/smart:\s*\{\s*label: 'Smart HD \(GPU\)'/);
});
test('Smart HD output remains 4:3 and does not steal mouse events', () => {
  assert.match(html,/id="gpu-canvas"/);
  assert.match(css,/#gpu-canvas\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(css,/#stage-frame:fullscreen #gpu-canvas\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(app,/processGpuFrame\(rgb, rgba\)/);
  assert.match(app,/gpuRenderer\.render\(rgb,rgba,width,height\)/);
  assert.match(app,/gpuUnavailable = true/);
  assert.match(html,/<option value="smart">Smart HD — GPU edges \(Phase 3\)<\/option>/);
});
test('London optional private uploads live alongside GTA but not inside game overlay', () => {
  for (const id of ['game-edition','london69-file','london61-file','london69-status','london61-status']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing ' + id);
  }
  assert.ok(html.indexOf('id="london69-file"') > html.indexOf('id="tools-panel"'));
  assert.ok(html.indexOf('id="london61-file"') > html.indexOf('id="tools-panel"'));
  assert.match(html, /London 1961 — needs GTA \+ London 1969 \+ 1961/);
  assert.match(app,/if \(edition === 'london61' && playableSource\(\) && londonSources\.london69\)/);
  assert.match(app,/const inspected = await inspectGameFile\(file\)/);
  assert.match(app,/if \(inspected\.kind !== 'jsdos'\)/);
  assert.match(app,/const sourceInfo = demo \? null : chosenGameSource\(\)/);
  assert.match(app,/const chosenMode = \$\('game-edition'\)\.value === 'gta' \? \$\('gta-edition'\)\.value : 'auto'/);
  assert.ok(!html.includes('src="london69.jsdos"'));
});
test('automatic boot preferences remain fixed and raw DOS troubleshooting stays available', () => {
  assert.ok(!html.includes('id="quiet-startup"'));
  assert.ok(!html.includes('id="auto-video-skip"'));
  assert.match(app,/const quiet = true/);
  assert.match(app,/enabled: true,/);
  assert.match(html,/id="show-dos"/);
  assert.match(html,/id="skip-video-probe"/);
});
