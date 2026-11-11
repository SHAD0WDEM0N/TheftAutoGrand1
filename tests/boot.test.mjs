import test from 'node:test';
import assert from 'node:assert/strict';
import { isGtaProgram, shouldMaskDosStartup, looksLikeGameFrame } from '../site/boot.js';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../site/style.css', import.meta.url), 'utf8');

test('only known direct GTA8/GTA24 bundle starts get a hidden DOS boot', () => {
  assert.equal(shouldMaskDosStartup('jsdos', 'gta8', 'auto'), true);
  assert.equal(shouldMaskDosStartup('jsdos', 'gta24', 'auto'), true);
  assert.equal(shouldMaskDosStartup('jsdos', 'gta8', 'gta24'), true);
  assert.equal(shouldMaskDosStartup('jsdos', 'unknown', 'gta24'), true);
  assert.equal(shouldMaskDosStartup('jsdos', 'unknown', 'auto'), false);
  assert.equal(shouldMaskDosStartup('iso', 'gta8', 'auto'), false);
  assert.equal(shouldMaskDosStartup(null, 'gta24', 'gta24'), false);
});

test('only GTA executable names count as detected game launches', () => {
  for (const name of ['GTA8', 'GTA8.EXE', 'GTA24', 'GTADOS\\GTA24.EXE', 'C:\\GTA\\GTA8.EXE']) {
    assert.equal(isGtaProgram(name), true, name);
  }
  for (const name of ['', 'COMMAND.COM', 'GTA.BAT', 'GTA18.EXE', 'SETUP.EXE', null, {}]) {
    assert.equal(isGtaProgram(name), false, String(name));
  }
});

test('startup splash stays hidden by default and remains manually dismissible', () => {
  assert.match(html, /id="boot-splash"[^>]*hidden/);
  assert.match(html, /id="show-dos"/);
  assert.match(css, /\.boot-splash\s*\{/);
  assert.match(app, /watchGtaFrames\(ci\); watchGtaStartup\(\)/);
  assert.match(app, /await ci\.getRunningProgram\(\)/);
  assert.match(app, /isGtaProgram\(program\)/);
  assert.match(app, /bootSplashTimer = setTimeout\(/);
  assert.match(app, /}, 12000\)/);
  assert.match(app, /\$\('show-dos'\)\.addEventListener\('click'/);
  assert.match(app, /\$\('show-game'\)\.addEventListener\('click'/);
  assert.match(app, /watchGtaFrames\(ci\)/);
  assert.ok(!app.includes("hideBootSplash();\n      status('GTA startup was not detected."));
  assert.match(app, /async function end\(\) \{\s*hideBootSplash\(\)/);
});

test('unknown DOS batches and installer ISOs do not get hidden', () => {
  assert.match(app, /shouldMaskDosStartup\(kind, sourceInfo\?\.editions\?\.boot, \$\('gta-edition'\)\.value\)/);
  assert.match(app, /Installer ISOs and unknown DOS startup scripts need a visible shell/);
});


test('colorful animated game-style frames can reveal GTA even if program detection fails', () => {
  const width = 320, height = 200, data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 3;
    data[p] = (x * 19 + y * 7) % 255;
    data[p + 1] = (x * 9 + y * 29) % 255;
    data[p + 2] = (x * 31 + y * 3) % 255;
  }
  assert.equal(looksLikeGameFrame(data, null, width, height), true);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    rgba[j] = data[i]; rgba[j + 1] = data[i + 1]; rgba[j + 2] = data[i + 2];
    rgba[j + 3] = 255;
  }
  assert.equal(looksLikeGameFrame(null, rgba, width, height), true);
});

test('text prompt or blank frame is not mistaken for actual game graphics', () => {
  const width = 720, height = 400, greyText = new Uint8Array(width * height * 4);
  for (let i = 0; i < greyText.length; i += 4) {
    const value = i % 12 === 0 ? 220 : 0;
    greyText[i] = value; greyText[i + 1] = value; greyText[i + 2] = value; greyText[i + 3] = 255;
  }
  assert.equal(looksLikeGameFrame(null, greyText, width, height), false);
  assert.equal(looksLikeGameFrame(new Uint8Array(320 * 200 * 3), null, 320, 200), false);
  assert.equal(looksLikeGameFrame(null, null, 320, 200), false);
});

test('optional install retains a private local copy and never uploads files', () => {
  assert.match(html, /id="install-local"/);
  assert.match(app, /await savePrivateShortcut\(source\.file, ''\)/);
  assert.match(app, /savedSourceReady = true/);
  assert.match(app, /fileWasChosen = false/);
  assert.match(app, /savedShortcut && !confirm\(/);
});
