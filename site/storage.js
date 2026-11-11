// Game assets remain in this browser's IndexedDB; never sent to GitHub Pages.
const DB_NAME = 'theft-auto-grand-private';
const DB_VERSION = 2;
const SAVE_STORE = 'game-backups';
const EDITIONS = ['gta', 'london69', 'london61'];
function checkEdition(game) {
  if (!EDITIONS.includes(game)) throw new Error('Unsupported game backup slot.');
}
const STORE = 'shortcuts';
const KEY = 'gta';

function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('This browser does not support local game storage.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SAVE_STORE)) db.createObjectStore(SAVE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local game storage.'));
    request.onblocked = () => reject(new Error('Local storage is in use in another tab. Close the other tab and retry.'));
  });
}

async function transaction(mode, makeRequest, storeName = STORE) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let result = null;
    let tx;
    try {
      tx = db.transaction(storeName, mode);
      const request = makeRequest(tx.objectStore(storeName));
      request.onsuccess = () => { result = request.result ?? null; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('Local storage failed.')); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Local storage was cancelled.')); };
    } catch (error) { db.close(); reject(error); }
  });
}

export function loadPrivateShortcut() {
  return transaction('readonly', store => store.get(KEY));
}

export function savePrivateShortcut(bundle, commands) {
  if (!(bundle instanceof Blob) || bundle.size === 0) throw new Error('No game backup was available to save.');
  return transaction('readwrite', store => store.put({
    id: KEY, bundle, commands, savedAt: Date.now()
  }));
}

export function clearPrivateShortcut() {
  return transaction('readwrite', store => store.delete(KEY));
}

/**
 * Only one latest complete filesystem backup per game, intentionally separate
 * from the historical GTA quick-launch shortcut. A .jsdos filesystem archive
 * is not an emulator CPU/RAM snapshot and cannot resume in the same frame.
 */
export function loadGameBackup(game) {
  checkEdition(game);
  return transaction('readonly', store => store.get(game), SAVE_STORE);
}

export function saveGameBackup(game, blob) {
  checkEdition(game);
  if (!(blob instanceof Blob) || !blob.size) throw new Error('Cannot store an empty DOS backup.');
  return transaction('readwrite', store => store.put({
    id: game, bundle: blob, savedAt: Date.now()
  }), SAVE_STORE);
}

export function removeGameBackup(game) {
  checkEdition(game);
  return transaction('readwrite', store => store.delete(game), SAVE_STORE);
}
