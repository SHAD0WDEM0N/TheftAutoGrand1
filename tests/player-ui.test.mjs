import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../site/style.css', import.meta.url), 'utf8');

test('all directly referenced player UI elements are present', () => {
  const identifiers = [...script.matchAll(/\$\('([a-zA-Z0-9-]+)'\)/g)].map(m => m[1]);
  for (const id of new Set(identifiers)) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing HTML element for ' + id);
  }
});

test('game window precedes collapsible settings and replaces advertising layout', () => {
  assert.ok(html.indexOf('class="game-window"') < html.indexOf('id="tools-panel"'));
  assert.ok(/<details id="tools-panel"/.test(html));
  assert.ok(!/<section class="hero"/.test(html));
  assert.ok(!/class="ticker"/.test(html));
  assert.ok(/\.game-window\.is-playing \.launch-overlay\s*\{\s*display:\s*none/.test(css));
});

test('desktop display tools are wired to supported js-dos commands', () => {
  assert.match(script, /kiosk:\s*true/);
  assert.match(script, /renderAspect:\s*'4\/3'/);
  assert.match(script, /renderBackend:\s*\$\('render-backend'\)\.value/);
  assert.match(script, /imageRendering:\s*'pixelated'/);
  assert.ok(!html.includes('<option value="smooth">'));
  assert.ok(!html.includes('id="quick-play"'));
  assert.ok(!html.includes('id="launch"'));
  assert.ok(!html.includes('id="pick-file"'));
  assert.match(script, /const info = await inspectGameFile\(file\)/);
  assert.match(script, /ci\.simulateKeyPress\(F11_KEY_CODE\)/);
  assert.match(script, /F11_KEY_CODE\s*=\s*300/);
  assert.match(script, /onFrameSize\(\(width, height\)/);
  assert.match(script, /\$\('stage-frame'\)\.requestFullscreen\(\)/);
});

test('private game import and save paths are still available', () => {
  for (const id of ['game', 'add-file', 'play', 'source-info', 'source-detail', 'quick-commands', 'remember', 'export', 'stop']) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(script, /savePrivateShortcut/);
  assert.match(script, /loadPrivateShortcut/);
  assert.ok(!/src=".*\.(iso|jsdos)"/.test(html));
});

test('video diagnostics are wired to supported live and start-only js-dos operations', () => {
  for (const id of ['render-backend','screenshot']) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(script, /player\.setRenderAspect\('4\/3'\)/);
  assert.match(script, /ci\.screenshot\(\)/);
  assert.match(script, /context\.putImageData\(shot, 0, 0\)/);
  assert.match(script, /canvas\.toBlob\(/);
  assert.match(script, /'image\/png'/);
  assert.match(script, /\$\('render-backend'\)\.disabled = busy \|\| active/);
  assert.ok(!html.includes('id="aspect-mode"'));
  assert.ok(!html.includes('Raw pixels'));
  assert.match(html, /Display · 4:3 locked/);
});

test('single Play CTA is disabled until a local file has passed preflight', () => {
  assert.match(html, /<button id="play"[^>]*disabled>▶ Play GTA<\/button>/);
  assert.match(html, /<button id="add-file"[^>]*>\+ Add File<\/button>/);
  assert.match(script, /\$\('play'\)\.disabled = busy \|\| active \|\| checkingSource \|\| londonChecking \|\| !chosenGameSource\(\)/);
  assert.match(script, /const info = await inspectGameFile\(file\)/);
  assert.match(script, /await loadLibrary\(\)/);
  assert.match(script, /showFileState\('File check failed:/);
  assert.ok(!html.includes('Launch selected file'));
});

test('readability and colourful accents do not introduce advertising sections', () => {
  assert.match(css, /--accent-orange:\s*#ff924d/);
  assert.match(css, /--accent-teal:\s*#53c8be/);
  assert.match(css, /--accent-gold:\s*#efcb7d/);
  assert.ok(!html.includes('Smooth scaling'));
});

test('F11 screen-mode control reports running DOS executable rather than promising a resolution', () => {
  assert.ok(html.includes('id="inspect-program"'));
  assert.ok(html.includes('id="program-info"'));
  assert.match(script, /ci\.getRunningProgram\(\)/);
  assert.match(script, /ci\.simulateKeyPress\(F11_KEY_CODE\)/);
  assert.ok(html.includes('Screen mode (F11)'));
  assert.ok(!html.includes('GTA display menu (F11)'));
});

test('desktop and fullscreen are both locked to a centered 4:3 picture', () => {
  assert.match(css, /\.stage-frame\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(css, /#stage-frame:fullscreen\s*\{[\s\S]*?display:\s*flex/);
  assert.match(css, /#stage-frame:fullscreen #player\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(css, /#stage-frame:fullscreen\s*\{[\s\S]*?background:\s*#000/);
  assert.match(script, /document\.fullscreenElement === \$\('stage-frame'\)/);
  assert.match(script, /document\.addEventListener\('fullscreenchange'/);
  assert.match(script, /document\.exitFullscreen\(\)/);
  assert.match(script, /renderAspect:\s*'4\/3'/);
  assert.ok(!script.includes('setFullScreen('), 'Avoid the js-dos fullscreen path that may stretch to screen width');
  assert.ok(!html.includes('value="16/9"'));
  assert.ok(!html.includes('value="AsIs"'));
});
