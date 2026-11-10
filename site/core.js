export const MAX_BYTES = 900 * 1024 * 1024;
export function fileKind(file) {
  if (!file || file.size === 0) throw new Error('Choose a non-empty ISO or .jsdos file.');
  if (file.size > MAX_BYTES) throw new Error('This file exceeds the 900 MiB browser import limit. Use a smaller prepared .jsdos bundle.');
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['iso', 'jsdos'].includes(extension)) throw new Error('Choose a .iso or .jsdos file. BIN/CUE and ordinary ZIP imports are not supported.');
  return extension;
}
export async function validateFile(file) {
  const kind = fileKind(file);
  if (kind === 'iso') {
    const header = new Uint8Array(await file.slice(32768, 32775).arrayBuffer());
    if (header.length !== 7 || new TextDecoder().decode(header.slice(1, 6)) !== 'CD001') throw new Error('This is not a recognised ISO-9660 disc image. Check that it is a DOS ISO, not a renamed BIN or archive.');
  } else {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (header[0] !== 80 || header[1] !== 75 || header[2] !== 3 || header[3] !== 4) throw new Error('This .jsdos file is not a ZIP-based js-dos bundle.');
  }
  return kind;
}
export function configuration(iso, commands = '') {
  return `[sdl]\nautolock=false\n[dosbox]\nmemsize=64\n[cpu]\ncore=auto\ncycles=max\n[sblaster]\nsbtype=sb16\nsbbase=220\nirq=7\ndma=1\nhdma=5\n[render]\nframeskip=0\n[autoexec]\n@echo off\nmount c .\nc:\n${iso ? 'imgmount d "disc.iso" -t iso\n' + commands : 'echo THEFT AUTO GRAND - DOS GARAGE\necho.\necho Emulator smoke test: OK\necho No game files loaded.\necho Type DIR to explore the empty C drive.'}\n`;
}
