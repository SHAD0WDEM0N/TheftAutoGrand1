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
  assert.match(script, /imageRendering:\s*\$\('display-mode'\)\.value/);
  assert.match(script, /player\.setImageRendering\(mode\)/);
  assert.match(script, /ci\.simulateKeyPress\(F11_KEY_CODE\)/);
  assert.match(script, /F11_KEY_CODE\s*=\s*300/);
  assert.match(script, /onFrameSize\(\(width, height\)/);
  assert.match(script, /player\.setFullScreen\(!isFullscreen\)/);
});

test('private game import and save paths are still available', () => {
  for (const id of ['game', 'launch', 'quick-play', 'quick-commands', 'remember', 'export', 'stop']) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(script, /savePrivateShortcut/);
  assert.match(script, /loadPrivateShortcut/);
  assert.ok(!/src=".*\.(iso|jsdos)"/.test(html));
});
