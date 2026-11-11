import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBundleEditions, bundleWithGameMode, patchAutoexecGame, readZipIndex } from '../site/editions.js';

function makeBundle(files, config = [
  '[sdl]', 'autolock=false',
  '[autoexec]', '@echo off', 'mount c .', 'c:', 'cd GTADOS', 'GTA8.EXE', ''
].join('\n')) {
  const encoder = new TextEncoder();
  let dataSize = 0;
  const locals = [];
  const central = [];
  for (const name of [...files, '.jsdos/dosbox.conf']) {
    const content = encoder.encode(name === '.jsdos/dosbox.conf' ? config : 'game bytes');
    const filename = encoder.encode(name);
    const l = new Uint8Array(30 + filename.length + content.length);
    const lv = new DataView(l.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(18, content.length, true);
    lv.setUint32(22, content.length, true);
    lv.setUint16(26, filename.length, true);
    l.set(filename, 30);
    l.set(content, 30 + filename.length);
    locals.push(l);
    const c = new Uint8Array(46 + filename.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(20, content.length, true);
    cv.setUint32(24, content.length, true);
    cv.setUint16(28, filename.length, true);
    cv.setUint32(42, dataSize, true);
    c.set(filename, 46);
    central.push(c);
    dataSize += l.length;
  }
  const dirSize = central.reduce((total, c) => total + c.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, central.length, true);
  view.setUint16(10, central.length, true);
  view.setUint32(12, dirSize, true);
  view.setUint32(16, dataSize, true);
  return new Blob([...locals, ...central, end], { type: 'application/zip' });
}

test('detect both GTA executable variants when both are in same DOS directory', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE', 'GTADOS/GTA24.EXE']);
  const editions = await inspectBundleEditions(file);
  assert.deepEqual(editions.available, ['auto', 'gta8', 'gta24']);
  assert.deepEqual(editions.detected, ['gta8', 'gta24']);
  assert.equal(editions.boot, 'gta8');
});

test('no phantom GTA24 option for GTA8-only bundle', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE']);
  const editions = await inspectBundleEditions(file);
  assert.deepEqual(editions.available, ['auto', 'gta8']);
  assert.equal(editions.note.includes('Only the detected'), true);
});

test('no automatic switching for unknown batch-file and ISO-only startup', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE', 'GTADOS/GTA24.EXE'], '[autoexec]\nmount c .\nc:\nGTA.BAT\n');
  const editions = await inspectBundleEditions(file);
  assert.deepEqual(editions.available, ['auto']);
  assert.equal(editions.boot, 'unknown');
});

test('only same-folder variants may replace original GTA8.EXE', async () => {
  const file = makeBundle(['GTA8.EXE', 'OTHER/GTA24.EXE']);
  const editions = await inspectBundleEditions(file);
  assert.deepEqual(editions.available, ['auto', 'gta8']);
});

test('patching autoexec selects GTA24 and preserves other emulator settings', () => {
  const original = '[cpu]\ncycles=max\n[autoexec]\nmount c .\nc:\nCD GTADOS\nGTA8.EXE\n';
  const changed = patchAutoexecGame(original, 'gta24');
  assert.match(changed, /cycles=max/);
  assert.match(changed, /CD GTADOS\nGTA24.EXE/);
  assert.ok(!changed.includes('GTA8.EXE'));
  assert.throws(() => patchAutoexecGame(original, '3dfx'), /Unsupported/);
});

test('new graphics variant is a valid ZIP without rewriting original CD data', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE','GTADOS/GTA24.EXE','disc.iso']);
  const inspection = await inspectBundleEditions(file);
  const mod = await bundleWithGameMode(file, inspection, 'gta24');
  assert.equal(mod.size > file.size, true);
  const index = await readZipIndex(mod);
  assert.equal(index.entries.filter(e => e.name === '.jsdos/dosbox.conf').length, 1);
  const updated = await inspectBundleEditions(mod);
  assert.equal(updated.boot, 'gta24');
  assert.deepEqual(updated.available, ['auto', 'gta8', 'gta24']);
  const original = await inspectBundleEditions(file);
  assert.equal(original.boot, 'gta8');
  assert.equal(await bundleWithGameMode(file, inspection, 'auto'), file);
});

test('unavailable profile cannot be fabricated from a bundle', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE']);
  const info = await inspectBundleEditions(file);
  await assert.rejects(bundleWithGameMode(file, info, 'gta24'), /not available/);
});
