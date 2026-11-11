import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGameFile, inspectJsdos } from '../site/core.js';

function dosIso() {
  const bytes = new Uint8Array(40 * 2048);
  const pvd = new DataView(bytes.buffer, 16 * 2048, 2048);
  pvd.setUint8(0, 1);
  bytes.set(new TextEncoder().encode('CD001'), 16 * 2048 + 1);
  pvd.setUint8(6, 1);
  pvd.setUint32(80, 40, true);
  pvd.setUint16(128, 2048, true);
  pvd.setUint8(156, 34);
  pvd.setUint32(158, 17, true);
  bytes.set(new TextEncoder().encode('GTA DOS TEST'), 16 * 2048 + 40);
  const root = 17 * 2048;
  bytes[root] = 34;
  bytes[root + 25] = 2;
  bytes[root + 32] = 1;
  bytes[root + 33] = 0;
  return bytes;
}

function bundle(names) {
  const enc = new TextEncoder();
  const locals = [], directory = [];
  let offset = 0;
  for (const name of names) {
    const filename = enc.encode(name);
    const contents = enc.encode(name === '.jsdos/dosbox.conf' ? '[autoexec]\nmount c .\nc:' : 'DOS DATA');
    const local = new Uint8Array(30 + filename.length + contents.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint32(18, contents.length, true);
    localView.setUint32(22, contents.length, true);
    localView.setUint16(26, filename.length, true);
    local.set(filename, 30);
    local.set(contents, 30 + filename.length);
    locals.push(local);

    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint32(20, contents.length, true);
    centralView.setUint32(24, contents.length, true);
    centralView.setUint16(28, filename.length, true);
    centralView.setUint32(42, offset, true);
    central.set(filename, 46);
    directory.push(central);
    offset += local.length;
  }
  const dirSize = directory.reduce((n, x) => n + x.length, 0);
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, names.length, true);
  v.setUint16(10, names.length, true);
  v.setUint32(12, dirSize, true);
  v.setUint32(16, offset, true);
  return new File([...locals, ...directory, end], 'my-game.jsdos', { type: 'application/zip' });
}

test('disc preflight reads valid ISO root and volume from small ranges', async () => {
  const file = new File([dosIso()], 'grand-theft-auto.iso');
  const inspected = await inspectGameFile(file);
  assert.equal(inspected.kind, 'iso');
  assert.match(inspected.label, /GTA DOS TEST/);
  assert.match(inspected.description, /gameplay are not yet verified/);
});

test('ISO needs a real root directory to become playable', async () => {
  const disc = dosIso();
  disc[17 * 2048] = 0;
  await assert.rejects(inspectGameFile(new File([disc], 'bad.iso')), /root directory/);
});

test('private js-dos bundle needs a DOSBox configuration and game data', async () => {
  const good = bundle(['.jsdos/dosbox.conf', 'GTA/GTA.BAT', 'disc.iso']);
  const inspected = await inspectGameFile(good);
  assert.equal(inspected.kind, 'jsdos');
  assert.match(inspected.description, /not yet been tested/);
  await assert.rejects(inspectJsdos(bundle(['GTA/GTA.BAT'])), /dosbox.conf/);
  await assert.rejects(inspectJsdos(bundle(['.jsdos/dosbox.conf'])), /no game or disc files/);
});

test('detect incomplete or corrupt bundle central directories', async () => {
  await assert.rejects(inspectJsdos(new Blob([new Uint8Array([80, 75, 3, 4])])), /Incomplete/);
  const broken = new Uint8Array(await bundle(['.jsdos/dosbox.conf', 'GTA/GTA.BAT']).arrayBuffer());
  broken.fill(0, broken.length - 22);
  await assert.rejects(inspectJsdos(new Blob([broken])), /directory was not found/);
});
