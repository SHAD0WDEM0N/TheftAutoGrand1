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
  assert.match(html, /<details id="add-file-menu" class="add-file-menu">/);
  assert.match(html, /<summary id="add-file" class="load-button">/);
  assert.match(html, /<button type="button" data-upload-edition="gta">Add GTA Data File<\/button>/);
  assert.match(html, /<button type="button" data-upload-edition="london69">Add Mission Pack 1 Data File/);
  assert.match(html, /<button type="button" data-upload-edition="london61">Add Mission Pack 2 Data File/);
  assert.ok(!html.includes('<select id="add-file"'));
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


test('upload menu opens with a click and uses direct button events for each file picker', () => {
  assert.match(script, /button\.addEventListener\('click', \(\) => \{/);
  assert.match(script, /button\.dataset\.uploadEdition/);
  assert.match(script, /\$\('add-file-menu'\)\.open = false/);
  assert.match(script, /picker\.click\(\)/);
  assert.match(script, /picker\.value = ''/);
  assert.match(css, /\.add-file-choices\s*\{[\s\S]*?position:\s*absolute/);
});
test('upload verification reports actual filename or rejection reason instead of generic Not loaded', () => {
  for (const id of ['gta-upload-state','london69-upload-state','london61-upload-state']) assert.ok(html.includes('id="'+id+'"'));
  assert.match(script, /setUploadProgress\('gta', \{state: 'checking', message: 'Checking ' \+ file\.name/);
  assert.match(script, /setUploadProgress\('gta', \{state: 'ready', message: 'Verified ' \+ file\.name/);
  assert.match(script, /setUploadProgress\('gta', \{state: 'error', message: file\.name \+ ' — ' \+ error\.message/);
  assert.match(script, /setUploadProgress\(edition, \{state: 'ready', message: 'Verified ' \+ file\.name/);
  assert.match(script, /setUploadProgress\(edition, \{state: 'error', message: file\.name \+ ' — ' \+ error\.message/);
  assert.match(script, /node\.dataset\.state = progress\?\.state/);
  assert.ok(!script.includes("'Not loaded'"));
});
test('GTA file readiness is not blocked on loading remote emulator code', () => {
  const start = script.indexOf('async function checkAddedFile(');
  const end = script.indexOf("$('game').addEventListener('change'", start);
  const check = script.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.ok(!check.includes('await loadLibrary()'));
  assert.match(check, /await inspectGameFile\(file\)/);
  assert.match(script, /status\('Loading emulator code…', 'LOADING'\); await loadLibrary\(\)/);
});


test('saved shortcut hydration never blocks game file pickers on emulator CDN loading', () => {
  const start = script.indexOf('loadPrivateShortcut().then(async record => {');
  const end = script.indexOf("window.addEventListener('beforeunload'", start);
  assert.ok(start >= 0 && end > start, 'saved shortcut initialization missing');
  const init = script.slice(start, end);
  assert.ok(!init.includes('await loadLibrary()'), 'must not download emulator during local shortcut check');
  assert.ok(!init.includes('checkingSource = true'), 'must not disable Add game files while checking saved shortcut');
  assert.ok(!init.includes('checkingSource = false'), 'must not modify file selection state');
  assert.match(init, /await inspectJsdos\(record\.bundle\)/);
  assert.match(init, /await inspectBundleEditions\(record\.bundle\)/);
  assert.match(script, /button\.addEventListener\('click', \(\) => \{/);
  assert.match(script, /picker\.click\(\)/);
});
test('forgetting a saved shortcut does not reference an undefined error', () => {
  const start = script.indexOf("$('forget').addEventListener");
  const end = script.indexOf('loadPrivateShortcut().then',start);
  const section = script.slice(start,end);
  const tryEnd = section.indexOf('} catch (error)');
  assert.ok(tryEnd > 0);
  assert.ok(!section.slice(0,tryEnd).includes("error.message"));
});


test('all editions use 800x600 output framing without forcing unsupported DOS modes', () => {
  assert.match(css, /#stage-frame:not\(:fullscreen\)\s*\{[\s\S]*?width:\s*min\(100%,\s*800px\)/);
  assert.match(css, /aspect-ratio:\s*800\s*\/\s*600/);
  assert.match(css, /#stage-frame:fullscreen #player,[\s\S]*?aspect-ratio:\s*800\s*\/\s*600/);
  assert.match(script, /renderAspect:\s*'4\/3'/);
  assert.match(script, /backend:\s*'dosbox', backendLocked:\s*true/);
  assert.ok(!script.includes('800x600x32'), 'do not force DOS video mode unavailable in some game executables');
});
