import { validateFile, configuration } from './core.js';
const $ = (id) => document.getElementById(id);
const CDN = 'https://cdn.jsdelivr.net/npm/js-dos@8.5.3/dist/';
let player = null, ci = null, bundleUrl = null, busy = false, active = false, paused = false, timer;
let libraryPromise;
const idle = $('player').innerHTML;
function status(message, badge) { $('status').textContent = message; if (badge) $('badge').textContent = badge; }
function controls() {
  $('game').disabled = busy || active;
  $('launch').disabled = busy || active || !$('game').files.length;
  $('demo').disabled = busy || active;
  for (const id of ['pause', 'fullscreen', 'export']) $(id).disabled = busy || !ci;
  for (const button of document.querySelectorAll('[data-dos-key]')) button.disabled = busy || !ci;
  $('stop').disabled = busy || !active;
}
function loadLibrary() {
  if (window.Dos) return Promise.resolve();
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = CDN + 'js-dos.css'; document.head.insertBefore(css, document.querySelector('link[rel="stylesheet"]'));
    const script = document.createElement('script'); script.src = CDN + 'js-dos.js';
    const deadline = setTimeout(() => { script.remove(); libraryPromise = null; reject(new Error('Emulator download timed out. Check your connection and retry.')); }, 30000);
    script.onload = () => { clearTimeout(deadline); resolve(); };
    script.onerror = () => { clearTimeout(deadline); script.remove(); libraryPromise = null; reject(new Error('Could not download js-dos. Allow cdn.jsdelivr.net and try again.')); };
    document.head.append(script);
  });
  return libraryPromise;
}
async function end() {
  clearTimeout(timer);
  if (player) await player.stop();
  player = null; ci = null; active = false; paused = false;
  if (bundleUrl) URL.revokeObjectURL(bundleUrl);
  bundleUrl = null; $('pause').textContent = 'Pause'; $('player').innerHTML = idle; controls();
}
async function launch(demo = false) {
  busy = true; controls();
  try {
    const file = demo ? null : $('game').files[0];
    const kind = demo ? null : await validateFile(file);
    status('Loading emulator code…', 'LOADING'); await loadLibrary();
    const source = {};
    if (kind === 'jsdos') { bundleUrl = URL.createObjectURL(file); source.url = bundleUrl; }
    else {
      source.dosboxConf = configuration(kind === 'iso', $('commands').value);
      if (kind === 'iso') {
        status('Reading your ISO into browser memory. Large discs may take a moment…');
        source.initFs = [{ path: 'disc.iso', contents: new Uint8Array(await file.arrayBuffer()) }];
      }
    }
    $('player').replaceChildren(); active = true;
    player = window.Dos($('player'), {
      ...source, pathPrefix: CDN + 'emulators/', backend: 'dosbox', backendLocked: true,
      theme: 'dark', autoStart: true, countDownStart: 0, autoSave: false,
      fsChanges: { local: false }, renderAspect: '4/3', imageRendering: 'pixelated',
      onEvent(event, value) {
        if (event === 'ci-ready') {
          ci = value; clearTimeout(timer); controls();
          status(demo ? 'DOS smoke test running. Look for “Emulator smoke test: OK” in the terminal.' : 'DOS is running. Check the terminal for mount results, then install or launch your game.', 'DOS RUNNING');
          ci.events().onMessage((type, ...args) => {
            if (type !== 'error') return;
            const message = args.join(' ');
            if (message.includes('[LOG_MOUSE]Unhandled videomode')) {
              status('Mouse/video-mode warning. Try the arrow and Enter buttons below for the game menu. If the game is frozen, export a backup before restarting.', 'INPUT NOTICE');
            } else status('Emulator message: ' + message + '. Check the game screen before restarting.', 'CHECK TERMINAL');
          });
        }
      }
    });
    player.setNoCloud(true);
    status('Starting DOS. Use End session if the emulator reports an error.', 'BOOTING');
    timer = setTimeout(() => { if (!ci) status('Startup is taking longer than expected. Check the player for errors, or end the session and retry.', 'CHECK TERMINAL'); }, 60000);
  } catch (error) {
    try { await end(); } catch { /* Keep the original diagnostic. */ }
    status(error.message, 'IMPORT FAILED');
  } finally { busy = false; controls(); }
}
$('game').addEventListener('change', () => {
  const file = $('game').files[0];
  $('file-info').textContent = file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MiB` : 'No disc selected';
  status('File selected locally. Launch to validate and load it.', 'READY TO IMPORT'); controls();
});
$('launch').addEventListener('click', () => launch());
$('demo').addEventListener('click', () => launch(true));
$('pause').addEventListener('click', () => { paused = !paused; player.setPaused(paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; });
$('fullscreen').addEventListener('click', () => player.setFullScreen(true));
for (const button of document.querySelectorAll('[data-dos-key]')) {
  button.addEventListener('click', () => {
    if (!ci || busy) return;
    if (paused) { player.setPaused(false); paused = false; $('pause').textContent = 'Pause'; }
    ci.simulateKeyPress(Number(button.dataset.dosKey));
    status('Sent ' + button.textContent.trim() + ' to DOS. These buttons control the selected game menu item.', 'DOS RUNNING');
  });
}
$('stop').addEventListener('click', async () => {
  if (!confirm('End this session? Any changes not exported in a backup will be lost.')) return;
  busy = true; controls();
  try { await end(); status('Session ended. Import a file or try DOS again.', 'AWAITING INPUT'); }
  catch (error) { status('Could not stop cleanly: ' + error.message + '. Export if possible, then reload.'); }
  finally { busy = false; controls(); }
});
$('export').addEventListener('click', async () => {
  busy = true; controls(); status('Creating a private backup. A full disc backup can take a while…');
  try {
    ci.pause();
    const bytes = await ci.persist(false);
    if (!bytes) throw new Error('The emulator did not return a backup.');
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const link = document.createElement('a'); link.href = url; link.download = 'dos-garage-backup.jsdos'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status('Backup download requested. Confirm the file is saved before ending this session. Keep it private.');
  } catch (error) { status('Backup failed: ' + error.message + ' Keep this tab open and retry.'); }
  finally { if (!paused) ci.resume(); busy = false; controls(); }
});
window.addEventListener('beforeunload', (event) => { if (active) { event.preventDefault(); event.returnValue = ''; } });
