export const MAX_BYTES = 900 * 1024 * 1024;
export const MOBILE_CAUTION_BYTES = 160 * 1024 * 1024;
export function mobileBundleRisk(size, isMobile) {
  return Boolean(isMobile && Number.isFinite(size) && size > MOBILE_CAUTION_BYTES);
}
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

/**
 * Build a boot script for a private full-filesystem .jsdos backup.
 * The user provides the commands that actually launched their installed DOS game.
 * Other DOSBox settings remain unchanged, and a disc is remounted only if the
 * original session had an ISO drive.
 */
export function quickStartConfig(dosboxConf, commands) {
  const lines = String(commands || '').replace(/\r\n?/g, '\n').trim();
  if (!lines) throw new Error('Enter your working DOS launch command before saving a shortcut.');
  if (lines.length > 2048) throw new Error('The launch command is too long (max 2048 characters).');
  const match = /^\[autoexec\][ \t]*\r?$/im.exec(dosboxConf);
  if (!match) throw new Error('This backup has no DOSBox autoexec section.');
  const afterSection = dosboxConf.slice(match.index + match[0].length);
  const nextSection = /^\[[^\]\r\n]+\][ \t]*\r?$/gm.exec(afterSection);
  const trailing = nextSection ? afterSection.slice(nextSection.index) : '';
  const needsDisc = /^\s*imgmount\s+d\b/im.test(afterSection.slice(0, nextSection?.index));
  const start = dosboxConf.slice(0, match.index);
  const boot = [
    '[autoexec]', '@echo off', 'mount c .', 'c:',
    ...(needsDisc ? ['imgmount d "disc.iso" -t iso'] : []),
    lines, ''
  ].join('\n');
  return start + boot + trailing;
}
