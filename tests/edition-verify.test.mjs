import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyEditionBundle } from '../site/edition-verify.js';

function zipBundle(names) {
  const encoder = new TextEncoder();
  let offset = 0;
  const locals = [], directory = [];
  for (const name of names) {
    const bytes = encoder.encode(name);
    const local = new Uint8Array(30 + bytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);
    lv.setUint16(4,20,true);
    lv.setUint16(26,bytes.length,true);
    local.set(bytes,30);
    locals.push(local);
    const central = new Uint8Array(46+bytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0,0x02014b50,true);
    cv.setUint16(4,20,true);
    cv.setUint16(28,bytes.length,true);
    cv.setUint32(42,offset,true);
    central.set(bytes,46);
    directory.push(central);
    offset += local.length;
  }
  const size = directory.reduce((n,part)=>n+part.length,0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);
  ev.setUint16(8,names.length,true);
  ev.setUint16(10,names.length,true);
  ev.setUint32(12,size,true);
  ev.setUint32(16,offset,true);
  return new Blob([...locals,...directory,end]);
}

const london69=['.jsdos/dosbox.conf','GTADOS/K_UK.EXE','gtados/GTA8_UK.EXE','gtados/GTA24_UK.EXE','london.bat','gtados/DINO.BAT'];
const london61=[...london69,'gtados/K_61.exe','gtados/Gta24_61.exe','London61.bat'];
const conf69='[autoexec]\n@echo off\ncls\nmount c .\nc:\ncall london.bat\n';
const conf61='[autoexec]\n@echo off\ncls\nmount c .\nc:\ncall London61.bat\n';

test('London 1969 matching files and launcher are marked structurally compatible',async()=>{
  const file=zipBundle(london69);file.name='GTA-London-1969_DOS.jsdos';
  const result=await verifyEditionBundle(file,'london69',{config:conf69});
  assert.equal(result.launch,'london.bat');
  assert.equal(result.fileCount,london69.length);
});
test('London 1961 requires additional 1961 executables plus 1969 files',async()=>{
  const file=zipBundle(london61);file.name='GTA-London-1961_DOS.jsdos';
  const result=await verifyEditionBundle(file,'london61',{config:conf61});
  assert.equal(result.launch,'london61.bat');
  const missing=zipBundle(london69);missing.name='wrong.jsdos';
  await assert.rejects(verifyEditionBundle(missing,'london61',{config:conf61}),/Missing london61 DOS files/);
});
test('preflight rejects mismatched files and commands, not merely valid ZIP extensions',async()=>{
  const file=zipBundle(london69);file.name='Wrong.jsdos';
  await assert.rejects(verifyEditionBundle(file,'london69',{config:conf61}),/does not launch london.bat/);
  await assert.rejects(verifyEditionBundle(file,'london61',{config:conf69}),/Missing london61 DOS files/);
  await assert.rejects(verifyEditionBundle(file,'gta',{config:conf69}),/Unknown London edition/);
  const fake=zipBundle(london69);fake.name='fake.zip';
  await assert.rejects(verifyEditionBundle(fake,'london69',{config:conf69}),/converted London .jsdos/);
});
