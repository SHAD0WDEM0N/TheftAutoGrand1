import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, quickStartConfig } from '../site/core.js';

test('one-click config launches the selected command after mounting saved DOS drives', () => {
  const base = configuration(true, ['d:', 'dir'].join('\n'));
  const updated = quickStartConfig(base, ['c:', 'cd GTA', 'GTA.BAT'].join('\n'));
  assert.match(updated, /\[cpu\]\ncore=auto/);
  assert.ok(updated.includes(['mount c .', 'c:', 'imgmount d "disc.iso" -t iso', 'c:', 'cd GTA', 'GTA.BAT'].join('\n')));
  assert.ok(!updated.includes(['d:', 'dir'].join('\n')));
});

test('one-click config works with saved bundles that do not need a disc', () => {
  const updated = quickStartConfig(configuration(false), 'GTA.BAT');
  assert.ok(updated.includes(['mount c .', 'c:', 'GTA.BAT'].join('\n')));
  assert.ok(!updated.includes('imgmount d'));
});

test('one-click config rejects missing or excessive commands and bundles with no autoexec', () => {
  assert.throws(() => quickStartConfig(configuration(false), '  '), /launch command/);
  assert.throws(() => quickStartConfig(configuration(false), 'x'.repeat(2050)), /too long/);
  assert.throws(() => quickStartConfig('[cpu]\ncycles=max', 'GTA.BAT'), /autoexec/);
});
