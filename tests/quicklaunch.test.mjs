import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, quickStartConfig } from '../site/core.js';

test('one-click config launches the selected command after mounting saved DOS drives', () => {
  const base = configuration(true, 'd:\\nndir');
  const updated = quickStartConfig(base, 'c:\\ncd GTA\\nGTA.BAT');
  assert.match(updated, /\[cpu\]\ncore=auto/);
  assert.ok(updated.includes('mount c .\\nc:\\nimgmount d "disc.iso" -t iso\\nc:\\ncd GTA\\nGTA.BAT'));
  assert.ok(!updated.includes('\\nd:\\nndir'));
});

test('one-click config works with saved bundles that do not need a disc', () => {
  const updated = quickStartConfig(configuration(false), 'GTA.BAT');
  assert.ok(updated.includes('mount c .\\nc:\\nGTA.BAT'));
  assert.ok(!updated.includes('imgmount d'));
});

test('one-click config rejects missing or excessive commands and bundles with no autoexec', () => {
  assert.throws(() => quickStartConfig(configuration(false), '  '), /launch command/);
  assert.throws(() => quickStartConfig(configuration(false), 'x'.repeat(2050)), /too long/);
  assert.throws(() => quickStartConfig('[cpu]\\ncycles=max', 'GTA.BAT'), /autoexec/);
});
