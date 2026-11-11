import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const storage=readFileSync(new URL('../site/storage.js',import.meta.url),'utf8');

test('Save Manager exposes all three named backup actions and import picker',()=>{
  for (const id of ['save-manager','backup-game','save-progress','export','import-backup','backup-file','backup-status']) {
    assert.ok(html.includes('id="'+id+'"'),'missing '+id);
  }
  for (const game of ['gta','london69','london61']) assert.match(html,new RegExp('<option value="'+game+'">'));
  assert.match(html,/Save Progress/);
  assert.match(html,/Export Backup/);
  assert.match(html,/Import Backup/);
  assert.ok(!html.includes('Export save / backup'));
  assert.match(html,/not instant save states/);
});
test('saving progress uses paused DOSBox filesystem and one isolated local slot per game',()=>{
  assert.match(app,/ci\.pause\(\); suspended = true/);
  assert.match(app,/await ci\.persist\(false\)/);
  assert.match(app,/await saveGameBackup\(game, blob\)/);
  assert.match(app,/if \(suspended && shouldResume\) ci\.resume\(\)/);
  assert.match(storage,/const DB_VERSION = 2/);
  assert.match(storage,/const SAVE_STORE = 'game-backups'/);
  assert.match(storage,/if \(!db\.objectStoreNames\.contains\(SAVE_STORE\)\)/);
  assert.match(storage,/id: game, bundle: blob, savedAt: Date\.now\(\)/);
  assert.match(storage,/function checkEdition\(game\)/);
  assert.match(storage,/transaction\('readwrite', store => store\.put\(/);
});
test('export uses saved backup slot, not full emulator persist each click',()=>{
  const section=app.slice(app.indexOf("$('export').addEventListener"),app.indexOf("$('import-backup').addEventListener"));
  assert.match(section,/backupSources\[game\]/);
  assert.match(section,/link\.download = backupLabels\[game\] \+ '-backup\.jsdos'/);
  assert.ok(!section.includes('ci.persist('));
});
test('import rejects wrong edition, confirms overwrite and relaunches from validated restored filesystem',()=>{
  assert.match(app,/await inspectImportedBackup\(file, game\)/);
  assert.match(app,/await verifyEditionBundle\(file, game, inspected\)/);
  assert.match(app,/await inspectLondonGraphicsModes\(file, game, inspected\)/);
  assert.match(app,/if \(!inspected\.detected\.length\)/);
  assert.match(app,/if \(!confirm\('Import '/);
  assert.match(app,/await saveGameBackup\(game, blob\)/);
  assert.match(app,/if \(useBackupByGame\[edition\] && backupSources\[edition\]\) return backupSources\[edition\]\.source/);
  assert.match(app,/async function restoreSavedBackups\(\)/);
  assert.match(app,/void restoreSavedBackups\(\)/);
  assert.match(app,/backupSources\[game\] = \{bundle:stored\.bundle/);
});
test('save manager does not expose a fake live CPU/RAM state restoration',()=>{
  assert.match(html,/Portable DOS filesystem backups/);
  assert.ok(!html.includes('Resume exact frame'));
  assert.match(app,/not an instant gameplay snapshot/);
  assert.match(app,/!active/);
});

test('new uploads override stale backups while explicit save or import activates the backup', () => {
  assert.match(app, /useBackupByGame\.gta = false/);
  assert.match(app, /useBackupByGame\[edition\] = false/);
  assert.match(app, /useBackupByGame\[game\] = true/);
  assert.match(app, /\$\('backup-game'\)\.value = selectedGame/);
});
