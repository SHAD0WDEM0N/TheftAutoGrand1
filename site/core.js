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


/**
 * Fast structural preflight. This reads a few small slices, never a whole CD.
 * It does not execute the DOS game or prove that the game files are GTA.
 */
export async function inspectGameFile(file) {
  const kind = await validateFile(file);
  if (kind === 'iso') return { kind, ...(await inspectIso(file)) };
  return { kind, ...(await inspectJsdos(file)) };
}

async function inspectIso(file) {
  const pvd = new Uint8Array(await file.slice(32768, 32768 + 2048).arrayBuffer());
  if (pvd.length !== 2048 || pvd[0] !== 1 || pvd[6] !== 1)
    throw new Error('The ISO primary volume descriptor is incomplete or invalid.');
  const view = new DataView(pvd.buffer);
  const sectorBytes = view.getUint16(128, true);
  const sectors = view.getUint32(80, true);
  const rootLength = pvd[156];
  const rootSector = view.getUint32(158, true);
  if (sectorBytes !== 2048 || !sectors || sectors * sectorBytes > file.size + sectorBytes
      || rootLength < 34 || !rootSector || rootSector >= sectors)
    throw new Error('The ISO filesystem layout is invalid or incomplete.');
  const root = new Uint8Array(await file.slice(rootSector * sectorBytes, (rootSector + 1) * sectorBytes).arrayBuffer());
  if (root.length !== sectorBytes || root[0] < 34 || (root[25] & 2) !== 2
      || root[32] !== 1 || root[33] !== 0)
    throw new Error('The ISO root directory is missing or damaged.');
  const volume = new TextDecoder('ascii').decode(pvd.subarray(40, 72)).trim();
  return {
    label: volume || 'DOS disc',
    description: 'ISO-9660 disc layout checked. GTA installation and gameplay are not yet verified.'
  };
}

export async function inspectJsdos(file) {
  if (!file || file.size < 22) throw new Error('Incomplete .jsdos archive.');
  const tailSize = Math.min(file.size, 65557);
  const tail = new Uint8Array(await file.slice(file.size - tailSize).arrayBuffer());
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) <= tail.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('The .jsdos ZIP directory was not found.');
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const entries = view.getUint16(eocd + 10, true);
  if (view.getUint16(eocd + 8, true) !== entries || entries === 0 || entries === 65535
      || directorySize > 8 * 1024 * 1024 || directoryOffset === 0xffffffff
      || directoryOffset + directorySize > file.size)
    throw new Error('The .jsdos ZIP directory is incomplete or unsupported.');
  const bytes = new Uint8Array(await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());
  const directory = new DataView(bytes.buffer);
  let offset = 0, foundConfig = false, foundGameFiles = false;
  const decoder = new TextDecoder('utf-8');
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > bytes.length || directory.getUint32(offset, true) !== 0x02014b50)
      throw new Error('The .jsdos ZIP file index is damaged.');
    const nameLength = directory.getUint16(offset + 28, true);
    const extraLength = directory.getUint16(offset + 30, true);
    const commentLength = directory.getUint16(offset + 32, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) throw new Error('The .jsdos ZIP file index is truncated.');
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
      .replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
    if (name === '.jsdos/dosbox.conf') foundConfig = true;
    if (name && !name.endsWith('/') && !name.startsWith('.jsdos/')) foundGameFiles = true;
    offset = next;
  }
  if (!foundConfig) throw new Error('This .jsdos archive is missing .jsdos/dosbox.conf.');
  if (!foundGameFiles) throw new Error('The .jsdos bundle contains no game or disc files.');
  return {
    label: 'DOS game bundle',
    description: 'Bundle index and DOSBox configuration found. GTA gameplay has not yet been tested.'
  };
}
