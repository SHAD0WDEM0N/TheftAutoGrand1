import test from 'node:test';
import assert from 'node:assert/strict';
import { fileKind, validateFile, configuration, MAX_BYTES } from '../site/core.js';
test('reject unsupported, empty, and oversized files before allocating memory', () => {
  for (const file of [{name:'x.bin',size:10},{name:'x.iso',size:0},{name:'x.iso',size:MAX_BYTES+1}]) assert.throws(() => fileKind(file));
  assert.equal(fileKind({name:'DISC.ISO',size:100}), 'iso');
});
test('detect renamed non-ISO input and recognise ISO descriptor', async () => {
  await assert.rejects(validateFile(new File(['bad'], 'game.iso')), /ISO-9660/);
  const bytes = new Uint8Array(32775); bytes.set([1,67,68,48,48,49,1],32768);
  assert.equal(await validateFile(new File([bytes], 'game.iso')), 'iso');
});
test('bundle signature validation', async () => {
  await assert.rejects(validateFile(new File(['bad'], 'backup.jsdos')), /ZIP-based/);
  assert.equal(await validateFile(new File([new Uint8Array([80,75,3,4])], 'backup.jsdos')), 'jsdos');
});
test('mount before running custom commands; smoke test requires no game', () => {
  const conf = configuration(true,'d:\ndir');
  assert.ok(conf.indexOf('mount c .') < conf.indexOf('imgmount d'));
  assert.ok(conf.includes('imgmount d "disc.iso" -t iso\nd:\ndir'));
  assert.ok(!configuration(false).includes('disc.iso'));
  assert.match(configuration(false), /Emulator smoke test: OK/);
});
