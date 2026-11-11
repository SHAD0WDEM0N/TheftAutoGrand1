import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../site/style.css', import.meta.url), 'utf8');

test('keyboard guide is collapsed by default and directly below game controls', () => {
  assert.match(html, /<details id="keyboard-guide" class="keyboard-guide">/);
  assert.ok(html.indexOf('id="keyboard-guide"') > html.indexOf('class="player-bar"'));
  assert.ok(html.indexOf('id="keyboard-guide"') < html.indexOf('id="tools-panel"'));
  assert.ok(!/<details id="keyboard-guide"[^>]*open/.test(html));
});

test('GTA DOS default controls include walking, driving and shortcut keys', () => {
  for (const key of ['Enter', 'Ctrl', 'Space', 'Z / X', 'Tab', 'F5', 'F6', 'F7 / F10', 'F8', 'F9', 'F11', 'Esc']) {
    assert.ok(html.includes('<dt>' + key + '</dt>'), 'Missing keyboard key ' + key);
  }
  for (const section of ['On Foot', 'Driving', 'Menus &amp; Shortcuts']) {
    assert.ok(html.includes('<h2>' + section + '</h2>'), 'Missing ' + section);
  }
  assert.match(html, /Click inside the game to give it keyboard focus/);
  assert.match(html, /Keys may differ if your copy has customised controls/);
});

test('keyboard guide uses accessible native details and adapts to small screens', () => {
  assert.match(css, /\.keyboard-guide-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(max-width: 850px\)[\s\S]*?\.keyboard-guide-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(html, /<summary><span class="keyboard-guide-heading">/);
  assert.ok(!html.includes('onclick="'));
});
