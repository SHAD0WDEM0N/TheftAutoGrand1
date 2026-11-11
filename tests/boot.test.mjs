import test from 'node:test';
import assert from 'node:assert/strict';
import { isGtaProgram, shouldMaskDosStartup } from '../site/boot.js';
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

test('startup splash is hidden by default, cancellable and fails open', () => {
  assert.match(html, /id="boot-splash"[^>]*hidden/);
  assert.match(html, /id="show-dos"/);
  assert.match(css, /\.boot-splash\s*\{/);
  assert.match(app, /if \(bootSplashActive\) watchGtaStartup\(\)/);
  assert.match(app, /await ci\.getRunningProgram\(\)/);
  assert.match(app, /isGtaProgram\(program\)/);
  assert.match(app, /bootSplashTimer = setTimeout\(/);
  assert.match(app, /}, 45000\)/);
  assert.match(app, /\$\('show-dos'\)\.addEventListener\('click'/);
  assert.match(app, /async function end\(\) \{\s*hideBootSplash\(\)/);
});

test('unknown DOS batches and installer ISOs do not get hidden', () => {
  assert.match(app, /shouldMaskDosStartup\(kind, sourceInfo\?\.editions\?\.boot, \$\('gta-edition'\)\.value\)/);
  assert.match(app, /Installer ISOs and unknown DOS startup scripts need a visible shell/);
});
