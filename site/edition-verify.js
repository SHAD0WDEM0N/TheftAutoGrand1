/**
 * Edition-specific structural preflight for private .jsdos bundles.
 * Checks ZIP index names and DOSBox startup scripts without extracting or
 * uploading the user's proprietary game contents.
 */
import { readZipIndex } from './editions.js';

const normalise = name => name.replaceAll('\\','/').replace(/^\.\/+/,'').toLowerCase();
const contains = (files, name) => files.has(name.toLowerCase());
const required = {
  london69: ['gtados/k_uk.exe', 'gtados/gta8_uk.exe', 'gtados/gta24_uk.exe', 'london.bat', 'gtados/dino.bat'],
  london61: ['gtados/k_uk.exe','gtados/k_61.exe','gtados/gta24_61.exe','gtados/gta24_uk.exe','london61.bat','gtados/dino.bat']
};
export async function verifyEditionBundle(file, edition, inspection) {
  if (!['london69','london61'].includes(edition)) throw new Error('Unknown London edition.');
  if (!file?.name?.toLowerCase().endsWith('.jsdos')) throw new Error('Choose the converted London .jsdos bundle.');
  if (typeof inspection?.config !== 'string') throw new Error('DOSBox startup configuration cannot be inspected.');
  const index = await readZipIndex(file);
  const names = new Set(index.entries.map(e => normalise(e.name)));
  const missing = required[edition].filter(name => !contains(names,name));
  if (missing.length) throw new Error('Missing '+edition+' DOS files: '+missing.join(', ')+'.');
  const expected = edition === 'london69' ? 'london.bat' : 'london61.bat';
  // The DOSBox config must execute the appropriate batch script. A package
  // with files but a GTA8.EXE startup command would launch the wrong game.
  const section = inspection.config.split(/^\[autoexec\][ \t]*$/im)[1] || '';
  const commands = section.split(/^\[[^\r\n]+\][ \t]*$/m)[0];
  const launch = commands.split(/\r?\n/).some(line =>
    !/^\s*(rem\b|::|#)/i.test(line) &&
    new RegExp('(?:^|[\\s\\\\/])(?:call\\s+)?'+expected.replace('.','\\.')+'(?:\\s|$)','i').test(line.trim())
  );
  if (!launch) throw new Error('DOSBox does not launch '+expected+'. Check the selected conversion.');
  return {
    edition,
    fileCount: index.entries.length,
    launch: expected,
    note: edition === 'london61'
      ? 'London 1961 launcher and shared London 1969 DOS executables found.'
      : 'London 1969 launcher and DOS executables found.'
  };
}
