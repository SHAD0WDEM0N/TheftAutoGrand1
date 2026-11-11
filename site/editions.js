// Read the ZIP directory and the tiny DOSBox config only; do not materialise CD-sized game data.
// js-dos bundles are ZIP files. This module never uploads, writes or overwrites the source file.

const CONFIG_PATH = '.jsdos/dosbox.conf';
const DOS_EXEC = /\bGTA(?:8|24)(?:\.EXE)?\b/i;
const NAME8 = /(^|\/)GTA8\.EXE$/i;
const NAME24 = /(^|\/)GTA24\.EXE$/i;
const MODE_TARGET = { gta8: 'GTA8.EXE', gta24: 'GTA24.EXE' };
const textDecoder = new TextDecoder('utf-8');
const textEncoder = new TextEncoder();

function nameOf(name) {
  return name.replace(/\\/g, '/').replace(/^(\.\/)+/, '').toUpperCase();
}
function dosboxAutoexec(conf) {
  const match = /^\[autoexec\]\s*$/im.exec(conf);
  if (!match) return null;
  const rest = conf.slice(match.index + match[0].length);
  const section = /^\[[^\]\r\n]+\]\s*$/m.exec(rest);
  return {
    before: conf.slice(0, match.index + match[0].length),
    commands: section ? rest.slice(0, section.index) : rest,
    after: section ? rest.slice(section.index) : ''
  };
}
function selectedBootVariant(conf) {
  const autoexec = dosboxAutoexec(conf);
  if (!autoexec) return null;
  for (const line of autoexec.commands.split(/\r?\n/)) {
    if (/^\s*(?:REM\b|::|#)/i.test(line)) continue;
    const target = /\bGTA(8|24)(?:\.EXE)?\b/i.exec(line);
    if (target) return 'gta' + target[1];
  }
  return null;
}
export async function inspectBundleEditions(file) {
  const index = await readZipIndex(file);
  const configEntry = index.entries.find(e => nameOf(e.name) === CONFIG_PATH.toUpperCase());
  if (!configEntry) return { available: ['auto'], detected: [], boot: 'unknown', note: 'DOSBox configuration is missing.' };
  let config;
  try { config = await readTextEntry(file, configEntry); }
  catch (error) {
    return { available: ['auto'], detected: [], boot: 'unknown', note: 'Could not inspect startup script: ' + error.message };
  }

  const gta8 = index.entries.filter(e => NAME8.test(nameOf(e.name)));
  const gta24 = index.entries.filter(e => NAME24.test(nameOf(e.name)));
  const detected = [...(gta8.length ? ['gta8'] : []), ...(gta24.length ? ['gta24'] : [])];
  const boot = selectedBootVariant(config) || 'unknown';
  const sourceEntry = boot === 'gta8' ? gta8 : boot === 'gta24' ? gta24 : [];
  const sourcePath = sourceEntry.length === 1 ? nameOf(sourceEntry[0].name).replace(/GTA(?:8|24)\.EXE$/, '') : null;
  // Switching is safe only when the configured startup program is explicit and the alternative
  // executable lives alongside it. A GTA.BAT or disc-only image may use a different layout.
  const available = ['auto'];
  if (sourcePath !== null && gta8.some(e => nameOf(e.name) === sourcePath + 'GTA8.EXE')) available.push('gta8');
  if (sourcePath !== null && gta24.some(e => nameOf(e.name) === sourcePath + 'GTA24.EXE')) available.push('gta24');
  return {
    available, detected, boot, config,
    note: boot === 'unknown'
      ? 'Startup uses a batch file or non-standard command; automatic executable switching is unavailable.'
      : available.includes('gta24') && available.includes('gta8')
        ? 'Standard and high-colour launchers are present in the same DOS folder.'
        : 'Only the detected, safely switchable DOS executable is enabled.'
  };
}

export function patchAutoexecGame(conf, mode) {
  if (!MODE_TARGET[mode]) throw new Error('Unsupported game mode. 3dfx requires a separately tested configuration.');
  const autoexec = dosboxAutoexec(conf);
  if (!autoexec) throw new Error('No [autoexec] DOS startup commands were found.');
  const from = selectedBootVariant(conf);
  if (!from) throw new Error('Cannot safely switch a batch-file or unknown startup sequence.');
  const lines = autoexec.commands.split(/\r?\n/);
  let changes = 0;
  const updated = lines.map(line => {
    if (/^\s*(?:REM\b|::|#)/i.test(line)) return line;
    if (!DOS_EXEC.test(line)) return line;
    return line.replace(/\bGTA(?:8|24)(?:\.EXE)?\b/gi, value => {
      changes++;
      return /\.EXE$/i.test(value) ? MODE_TARGET[mode] : MODE_TARGET[mode].slice(0, -4);
    });
  });
  if (!changes) throw new Error('No direct GTA8/GTA24 executable command was found in the startup script.');
  return autoexec.before + updated.join('\n') + autoexec.after;
}

/**
 * Keep every existing mount, driver and GTA command in place; silence echoed
 * command lines and clear the initial DOS banner only. This cannot skip a
 * video-driver prompt that genuinely waits for keyboard input.
 */
export function patchQuietBoot(conf) {
  const autoexec = dosboxAutoexec(conf);
  if (!autoexec) throw new Error('No [autoexec] section found for quiet startup.');
  const newline = conf.includes('\r\n') ? '\r\n' : '\n';
  // If the file is already quiet, do not append more commands.
  const firstCommands = autoexec.commands.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const hasEcho = firstCommands.some(line => /^@?echo\s+off$/i.test(line));
  const hasCls = firstCommands.some(line => /^@?cls$/i.test(line));
  const additions = [!hasEcho ? '@echo off' : null, !hasCls ? 'cls' : null].filter(Boolean);
  if (!additions.length) return conf;
  return autoexec.before + newline + additions.join(newline) + autoexec.commands + autoexec.after;
}

// The patched archive is assembled using Blob slices: the original 750+ MB bundle
// is not loaded as one huge ArrayBuffer. The old ZIP central directory remains inert
// and a new ZIP central directory is appended after a replacement DOSBox config entry.
export async function bundleWithGameMode(file, inspection, mode, { quiet = false } = {}) {
  if (mode === 'auto' && !quiet) return file;
  if (mode !== 'auto' && !inspection?.available?.includes(mode)) throw new Error('This game mode is not available in the selected bundle.');
  if (typeof inspection?.config !== 'string') {
    if (mode === 'auto') return file; // Preserve working unknown archive layout.
    throw new Error('DOSBox startup configuration could not be inspected.');
  }
  const variantConf = mode === 'auto' ? inspection.config : patchAutoexecGame(inspection.config, mode);
  const newConf = quiet ? patchQuietBoot(variantConf) : variantConf;
  if (newConf === inspection.config) return file;
  const zip = await readZipIndex(file);
  const entry = zip.entries.find(e => nameOf(e.name) === CONFIG_PATH.toUpperCase());
  if (!entry) throw new Error('DOSBox configuration not found in the bundle.');

  const name = textEncoder.encode(entry.name);
  const bytes = textEncoder.encode(newConf);
  if (file.size + bytes.length + zip.directory.length > 0xffffffff)
    throw new Error('This bundle is too large for a standard ZIP patch.');
  const crc = crc32(bytes);
  const local = new Uint8Array(30 + name.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(8, 0, true); // store, no compression
  lv.setUint32(14, crc, true);
  lv.setUint32(18, bytes.length, true);
  lv.setUint32(22, bytes.length, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);

  const centralParts = zip.entries.filter(e => e !== entry).map(e => zip.directory.slice(e.dirStart, e.dirEnd));
  const centralNew = new Uint8Array(46 + name.length);
  const cv = new DataView(centralNew.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, bytes.length, true);
  cv.setUint32(24, bytes.length, true);
  cv.setUint16(28, name.length, true);
  cv.setUint32(42, file.size, true);
  centralNew.set(name, 46);

  const dirOffset = file.size + local.length + bytes.length;
  const dirSize = centralParts.reduce((size, piece) => size + piece.length, centralNew.length);
  const count = centralParts.length + 1;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, dirOffset, true);
  return new Blob([file, local, bytes, ...centralParts, centralNew, end], { type: 'application/zip' });
}

async function readTextEntry(file, entry) {
  if (entry.uncompressedSize > 256 * 1024 || entry.compressedSize > 256 * 1024)
    throw new Error('DOSBox config is unexpectedly large.');
  const header = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
  if (header.byteLength < 30 || header.getUint32(0, true) !== 0x04034b50)
    throw new Error('Damaged ZIP entry for DOSBox config.');
  const start = entry.localOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const packed = file.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return textDecoder.decode(await packed.arrayBuffer());
  if (entry.method !== 8) throw new Error('Unsupported ZIP compression for config.');
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress ZIP configuration entries.');
  return textDecoder.decode(await new Response(packed.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}

export async function readZipIndex(file) {
  if (file.size < 22) throw new Error('Incomplete ZIP archive.');
  const tailSize = Math.min(file.size, 65557);
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let p = tail.byteLength - 22; p >= 0; p--) {
    if (tail.getUint32(p, true) === 0x06054b50
        && p + 22 + tail.getUint16(p + 20, true) === tail.byteLength) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error('ZIP end-of-directory record not found.');
  const count = tail.getUint16(eocd + 10, true);
  const dirSize = tail.getUint32(eocd + 12, true);
  const dirOffset = tail.getUint32(eocd + 16, true);
  if (!count || count === 65535 || dirOffset === 0xffffffff || dirSize > 8 * 1024 * 1024
      || dirOffset + dirSize > file.size) throw new Error('Unsupported ZIP index.');
  const directory = new Uint8Array(await file.slice(dirOffset, dirOffset + dirSize).arrayBuffer());
  const view = new DataView(directory.buffer);
  const entries = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directory.length || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error('Damaged ZIP central directory.');
    const length = view.getUint16(cursor + 28, true);
    const extra = view.getUint16(cursor + 30, true);
    const comment = view.getUint16(cursor + 32, true);
    const end = cursor + 46 + length + extra + comment;
    if (end > directory.length) throw new Error('Truncated ZIP entry.');
    entries.push({
      name: textDecoder.decode(directory.subarray(cursor + 46, cursor + 46 + length)),
      method: view.getUint16(cursor + 10, true),
      compressedSize: view.getUint32(cursor + 20, true),
      uncompressedSize: view.getUint32(cursor + 24, true),
      localOffset: view.getUint32(cursor + 42, true),
      dirStart: cursor, dirEnd: end
    });
    cursor = end;
  }
  return { entries, directory };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
