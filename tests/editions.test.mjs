import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { inspectBundleEditions, bundleWithGameMode, patchAutoexecGame, patchQuietBoot, readZipIndex, inspectLondonGraphicsModes, patchLondonAutoexec, patchDosPixelAspect, patchGta24NoUnivbe, patchLondon61VesaNoLfb } from '../site/editions.js';

function makeBundle(files, config = [
  '[sdl]', 'autolock=false',
  '[autoexec]', '@echo off', 'mount c .', 'c:', 'cd GTADOS', 'GTA8.EXE', ''
].join('\n'), compressedConfig = false) {
  const encoder = new TextEncoder();
  let dataSize = 0;
  const locals = [];
  const central = [];
  for (const name of [...files, '.jsdos/dosbox.conf']) {
    const content = encoder.encode(name === '.jsdos/dosbox.conf' ? config : 'game bytes');
    const filename = encoder.encode(name);
    const isDeflate = compressedConfig && name === '.jsdos/dosbox.conf';
    const stored = isDeflate ? deflateRawSync(content) : content;
    const l = new Uint8Array(30 + filename.length + stored.length);
    const lv = new DataView(l.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, isDeflate ? 8 : 0, true);
    lv.setUint32(18, stored.length, true);
    lv.setUint32(22, content.length, true);
    lv.setUint16(26, filename.length, true);
    l.set(filename, 30);
    l.set(stored, 30 + filename.length);
    locals.push(l);
    const c = new Uint8Array(46 + filename.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, isDeflate ? 8 : 0, true);
    cv.setUint32(20, stored.length, true);
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

test('compressed ZIP DOSBox config can be read and replaced without modifying original source', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE', 'GTADOS/GTA24.EXE'], undefined, true);
  const original = await inspectBundleEditions(file);
  assert.equal(original.boot, 'gta8');
  assert.deepEqual(original.available, ['auto', 'gta8', 'gta24']);
  const replacement = await bundleWithGameMode(file, original, 'gta24');
  const switched = await inspectBundleEditions(replacement);
  assert.equal(switched.boot, 'gta24');
  assert.equal((await inspectBundleEditions(file)).boot, 'gta8');
});

test('quiet startup adds DOS banner clearing without dropping game or drive commands', () => {
  const original = '[cpu]\ncycles=max\n[autoexec]\nmount c .\nc:\ncd GTA\nGTA24.EXE\n';
  const quiet = patchQuietBoot(original);
  assert.match(quiet, /\[cpu\]\ncycles=max/);
  assert.match(quiet, /\[autoexec\]\n@echo off\ncls\nmount c \.\nc:\ncd GTA\nGTA24\.EXE/);
  assert.equal(patchQuietBoot(quiet), quiet);
  assert.equal(original.includes('cls'), false);
});

test('quiet startup can retain an existing echo off and handle Windows line endings', () => {
  const input = '[cpu]\r\ncycles=max\r\n[autoexec]\r\n@echo off\r\nmount c .\r\nc:\r\nGTA8.EXE\r\n';
  const quiet = patchQuietBoot(input);
  assert.match(quiet, /cls\r\n@echo off\r\nmount c \./);
  assert.match(quiet, /GTA8\.EXE/);
});

test('quiet mode patches original GTA8 archive in memory without changing the source', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE','GTADOS/GTA24.EXE']);
  const inspection = await inspectBundleEditions(file);
  const patched = await bundleWithGameMode(file, inspection, 'auto', {quiet:true});
  assert.ok(patched.size > file.size);
  const mode = await inspectBundleEditions(patched);
  assert.equal(mode.boot, 'gta8');
  assert.match(mode.config, /\bcls\b/i);
  assert.equal((await inspectBundleEditions(file)).config, inspection.config);
  assert.equal(await bundleWithGameMode(file, inspection, 'auto', {quiet:false}), file);
});

test('quiet mode preserves GTA24 selection, including compressed configuration bundles', async () => {
  const file = makeBundle(['GTADOS/GTA8.EXE','GTADOS/GTA24.EXE'], undefined, true);
  const inspection = await inspectBundleEditions(file);
  const patched = await bundleWithGameMode(file, inspection, 'gta24', {quiet:true});
  const result = await inspectBundleEditions(patched);
  assert.equal(result.boot, 'gta24');
  assert.match(result.config, /cls/);
});


test('London 1969 exposes 8-bit and 24-bit executables independent of GTA base executables', async () => {
  const conf = '[autoexec]\n@echo off\ncls\nmount c .\nc:\ncall london.bat\n';
  const file = makeBundle(['gtados/GTA8_UK.EXE','gtados/GTA24_UK.EXE','london.bat'], conf);
  const original = await inspectBundleEditions(file);
  const london = await inspectLondonGraphicsModes(file, 'london69', original);
  assert.deepEqual(london.available, ['auto','gta8','gta24']);
  assert.match(london.note, /London 1969/);
  assert.match(patchLondonAutoexec(conf, 'london69', 'gta8'), /cd gtados\ngta8_uk\.exe\ncd \.\./);
  assert.match(patchLondonAutoexec(conf, 'london69', 'gta24'), /cd gtados\ngta24_uk\.exe -nounivbe\ncd \.\./);
  const patched = await bundleWithGameMode(file, london, 'gta24', {quiet: true, game: 'london69'});
  assert.match((await inspectBundleEditions(patched)).config, /gta24_uk\.exe -nounivbe/);
  assert.equal((await inspectBundleEditions(file)).config, conf);
  assert.match((await inspectBundleEditions(patched)).config, /@echo off/);
});

test('London 1961 exposes its 24-bit executable and rejects an invented 8-bit edition', async () => {
  const conf = '[autoexec]\r\n@echo off\r\nmount c .\r\nc:\r\ncall London61.bat\r\n';
  const file = makeBundle(['GTADOS/Gta24_61.exe','GTADOS/GTA24_UK.EXE','London61.bat'], conf);
  const london = await inspectLondonGraphicsModes(file, 'london61', await inspectBundleEditions(file));
  assert.deepEqual(london.available, ['auto','gta24','gta24_nolfb']);
  const patched = await bundleWithGameMode(file, london, 'gta24', {quiet: true, game: 'london61'});
  const updated = (await inspectBundleEditions(patched)).config;
  assert.match(updated, /cd gtados\r\ngta24_61\.exe -nounivbe\r\ncd \.\./);
  assert.doesNotMatch(updated, /call London61\.bat/);
  await assert.rejects(bundleWithGameMode(file, london, 'gta8', {game:'london61'}), /not available/);
  assert.deepEqual((await inspectLondonGraphicsModes(file, 'london61', await inspectBundleEditions(file))).available, ['auto','gta24','gta24_nolfb']);
});

test('London switching refuses unknown startup commands and preserves base GTA mode support', () => {
  assert.throws(() => patchLondonAutoexec('[autoexec]\ncall gta.bat\n', 'london69','gta24'), /Expected one london\.bat/);
  assert.throws(() => patchLondonAutoexec('[autoexec]\ncall london.bat\ncall london.bat\n', 'london69','gta8'), /Expected one london\.bat/);
  assert.throws(() => patchLondonAutoexec('[autoexec]\ncall London61.bat\n', 'london61','gta8'), /Unsupported graphics edition/);
  assert.match(patchAutoexecGame('[autoexec]\nGTA8.EXE\n','gta24'), /GTA24.EXE/);
});


test('DOSBox render aspect is enabled for native 320x200 mode, preserving startup commands', () => {
  const original = '[dosbox]\nmemsize=32\n[render]\nframeskip=0\naspect=false\n[autoexec]\ncall london.bat\n';
  const patched = patchDosPixelAspect(original);
  assert.match(patched, /\[render\]\nframeskip=0\naspect=true\n\[autoexec\]/);
  assert.match(patched, /call london\.bat/);
  assert.equal(patchDosPixelAspect(patched), patched);
  assert.equal(original.includes('aspect=true'), false);
});

test('DOSBox aspect patch inserts render section, preserves CRLF and is idempotent', () => {
  const original = '[dosbox]\r\nmemsize=32\r\n[autoexec]\r\nGTA8.EXE\r\n';
  const patched = patchDosPixelAspect(original);
  assert.match(patched, /\[autoexec\]\r\nGTA8.EXE\r\n\[render\]\r\naspect=true\r\n/);
  assert.equal(patchDosPixelAspect(patched), patched);
  const withRender = '[render]\r\nframeskip=0\r\n[autoexec]\r\nGTA8.EXE\r\n';
  const inserted = patchDosPixelAspect(withRender);
  assert.match(inserted, /\[render\]\r\naspect=true\r\nframeskip=0\r\n\[autoexec\]/);
  assert.equal(patchDosPixelAspect(inserted), inserted);
});

test('quiet boot patches DOSBox aspect in temporary GTA and London bundles without editing originals', async () => {
  const conf = '[render]\nframeskip=0\naspect=false\n[autoexec]\nmount c .\nc:\ncd GTADOS\nGTA8.EXE\n';
  const gta = makeBundle(['GTADOS/GTA8.EXE','GTADOS/GTA24.EXE'], conf);
  const gtaMeta = await inspectBundleEditions(gta);
  const patched = await bundleWithGameMode(gta, gtaMeta, 'auto', {quiet: true});
  assert.match((await inspectBundleEditions(patched)).config, /\[render\]\nframeskip=0\naspect=false/);
  assert.equal((await inspectBundleEditions(gta)).config, conf);
  const londonConf = '[render]\nframeskip=0\n[autoexec]\nmount c .\nc:\ncall london.bat\n';
  const london = makeBundle(['GTADOS/GTA8_UK.EXE','GTADOS/GTA24_UK.EXE','london.bat'], londonConf);
  const londonMeta = await inspectLondonGraphicsModes(london,'london69',await inspectBundleEditions(london));
  const londonPatched = await bundleWithGameMode(london,londonMeta,'gta24',{quiet:true,game:'london69'});
  const output = (await inspectBundleEditions(londonPatched)).config;
  assert.match(output, /\[render\]\naspect=true\nframeskip=0/);
  assert.match(output, /gta24_uk\.exe -nounivbe/);
  assert.match((await inspectBundleEditions(london)).config,/call london\.bat/);
});


test('base GTA does not receive redundant DOSBox pixel scaling on top of js-dos 4:3', async () => {
  const conf = '[render]\naspect=true\n[autoexec]\ncd GTADOS\nGTA8.EXE\n';
  const input = makeBundle(['GTADOS/GTA8.EXE','GTADOS/GTA24.EXE'], conf);
  const info = await inspectBundleEditions(input);
  const output = await bundleWithGameMode(input, info, 'auto', {quiet:true,game:'gta'});
  assert.match((await inspectBundleEditions(output)).config, /\[render\]\naspect=false/);
  assert.equal((await inspectBundleEditions(input)).config, conf);
  assert.equal(patchDosPixelAspect(conf,false), patchDosPixelAspect(patchDosPixelAspect(conf,false),false));
  assert.match(patchDosPixelAspect('[autoexec]\nGTA8.EXE\n', false), /\[render\]\naspect=false/);
});


test('base GTA24 launches with -nounivbe while GTA8 stays unchanged', async () => {
  const conf = '[autoexec]\r\nmount c .\r\nc:\r\ncd GTADOS\r\nGTA24.EXE\r\n';
  const file = makeBundle(['GTADOS/GTA24.EXE','GTADOS/GTA8.EXE'], conf);
  const info = await inspectBundleEditions(file);
  const output = await bundleWithGameMode(file, info, 'auto', {quiet:true,game:'gta'});
  const updated = (await inspectBundleEditions(output)).config;
  assert.match(updated, /GTA24\.EXE -nounivbe/);
  assert.equal((await inspectBundleEditions(file)).config, conf, 'original bundle unchanged');
  assert.match(updated, /aspect=false/);
  const gta8 = await bundleWithGameMode(file, info, 'gta8', {quiet:true,game:'gta'});
  const gta8Config = (await inspectBundleEditions(gta8)).config;
  assert.match(gta8Config, /GTA8\.EXE/);
  assert.doesNotMatch(gta8Config, /-nounivbe/);
});

test('UniVBE option patch is idempotent and preserves existing GTA24 flags', () => {
  const conf = '[autoexec]\n@echo off\nC:\\GTADOS\\GTA24.EXE -foobar\n';
  const output = patchGta24NoUnivbe(conf);
  assert.match(output, /GTA24\.EXE -foobar -nounivbe/);
  assert.equal(patchGta24NoUnivbe(output),output);
  const protectedConf = '[autoexec]\nREM GTA24.EXE\nGTA24.EXE -nounivbe\n';
  assert.equal(patchGta24NoUnivbe(protectedConf),protectedConf);
  assert.equal(patchGta24NoUnivbe('[autoexec]\ncall london.bat\n'), '[autoexec]\ncall london.bat\n');
});


test('London 1961 optional VESA no-LFB patch changes only the temporary config', async () => {
  const conf='[dosbox]\nmachine=svga_s3\nmemsize=32\n[autoexec]\nmount c .\nc:\ncall london61.bat\n';
  const game = makeBundle(['gtados/Gta24_61.exe','London61.bat'],conf);
  const info = await inspectLondonGraphicsModes(game,'london61',await inspectBundleEditions(game));
  assert.ok(info.available.includes('gta24_nolfb'));
  const testBundle = await bundleWithGameMode(game,info,'gta24_nolfb',{quiet:true,game:'london61'});
  const output = (await inspectBundleEditions(testBundle)).config;
  assert.match(output, /machine=vesa_nolfb/);
  assert.match(output, /gta24_61.exe -nounivbe/);
  assert.match(output, /aspect=true/);
  assert.equal((await inspectBundleEditions(game)).config,conf);
  const defaultBundle = await bundleWithGameMode(game,info,'auto',{quiet:true,game:'london61'});
  assert.match((await inspectBundleEditions(defaultBundle)).config, /machine=svga_s3/);
});
test('VESA no-LFB config patch preserves CRLF and unrelated settings', () => {
  const conf='[dosbox]\r\nmachine=svga_s3\r\nmemsize=32\r\n[autoexec]\r\nGTA24_61.EXE\r\n';
  const next=patchLondon61VesaNoLfb(conf);
  assert.match(next,/machine=vesa_nolfb\r\nmemsize=32/);
  assert.equal(patchLondon61VesaNoLfb(next),next);
});
