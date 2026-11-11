import { validateFile, configuration, quickStartConfig, mobileBundleRisk } from './core.js';
import { loadPrivateShortcut, savePrivateShortcut, clearPrivateShortcut } from './storage.js';
const $ = (id) => document.getElementById(id);
const CDN = 'https://cdn.jsdelivr.net/npm/js-dos@8.5.3/dist/';
let player = null, ci = null, bundleUrl = null, busy = false, active = false, paused = false, timer;
let libraryPromise, bundleToolsPromise, savedShortcut = null;
let isFullscreen = false;
const RENDER_PREF_KEY = 'dos-garage-render-mode';
const ASPECT_PREF_KEY = 'dos-garage-aspect-mode';
const BACKEND_PREF_KEY = 'dos-garage-display-backend';
const F11_KEY_CODE = 300;
const idle = $('player').innerHTML;
try {
  const stored = localStorage.getItem(RENDER_PREF_KEY);
  if (stored === 'smooth' || stored === 'pixelated') $('display-mode').value = stored;
  const aspect = localStorage.getItem(ASPECT_PREF_KEY);
  if (aspect === '4/3' || aspect === 'AsIs') $('aspect-mode').value = aspect;
  const backend = localStorage.getItem(BACKEND_PREF_KEY);
  if (backend === 'webgl' || backend === 'canvas') $('render-backend').value = backend;
} catch { /* private-mode storage may be unavailable */ }
const heldKeys = new Map();
const isTouchDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia('(pointer:coarse)').matches);
function tooLargeForMobile(file) { return mobileBundleRisk(file?.size || 0, isTouchDevice); }
function mobileNeedsOverride(quick = false) {
  return tooLargeForMobile(quick ? savedShortcut?.bundle : $('game').files[0]) && !$('override-mobile').checked;
}
function updateMobileNotice() {
  const file = $('game').files[0];
  const target = file || savedShortcut?.bundle;
  const large = tooLargeForMobile(target);
  $('mobile-warning').hidden = !large;
  if (large) {
    $('mobile-warning-text').textContent = 'This game file is ' + (target.size / 1048576).toFixed(1) +
      ' MiB. Your iPhone recording shows Safari crashing at approximately 255 MiB while loading a 751.9 MiB bundle. ' +
      'For a reliable mobile attempt, make a much smaller local game bundle on your PC. You can override this warning, but Safari may crash again.';
  }
  if (!large) $('override-mobile').checked = false;
}
function releaseHeldKeys() {
  for (const { code, button } of heldKeys.values()) {
    if (ci) ci.sendKeyEvent(code, false);
    button.classList.remove('pressed');
  }
  heldKeys.clear();
}

function status(message, badge) { $('status').textContent = message; if (badge) $('badge').textContent = badge; }
function controls() {
  $('player').closest('.game-window').classList.toggle('is-playing', active);
  $('pick-file').disabled = busy || active;
  $('native-resolution').disabled = busy || !ci;
  $('screenshot').disabled = busy || !ci;
  $('render-backend').disabled = busy || active;
  $('game').disabled = busy || active;
  $('launch').disabled = busy || active || !$('game').files.length || mobileNeedsOverride();
  $('demo').disabled = busy || active;
  for (const id of ['pause', 'fullscreen', 'export']) $(id).disabled = busy || !ci;
  for (const button of document.querySelectorAll('[data-dos-key],[data-hold-key]')) button.disabled = busy || !ci;
  $('stop').disabled = busy || !active;
  $('quick-play').disabled = busy || active || !savedShortcut || mobileNeedsOverride(true);
  $('remember').disabled = busy || !ci || !$('quick-commands').value.trim();
  $('forget').disabled = busy || active || !savedShortcut;
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
function bundleTools() {
  if (window.emulators?.bundleConfig && window.emulators?.bundleUpdateConfig) return Promise.resolve(window.emulators);
  if (bundleToolsPromise) return bundleToolsPromise;
  bundleToolsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/emulators@8.5.2/dist/emulators.min.js';
    script.onload = () => {
      if (window.emulators?.bundleConfig && window.emulators?.bundleUpdateConfig) resolve(window.emulators);
      else { bundleToolsPromise = null; reject(new Error('Bundle editing tools are unavailable. Export a backup instead.')); }
    };
    script.onerror = () => { bundleToolsPromise = null; reject(new Error('Could not load bundle editing tools. Export a backup instead.')); };
    document.head.append(script);
  });
  return bundleToolsPromise;
}
async function end() {
  clearTimeout(timer);
  releaseHeldKeys();
  if (player) await player.stop();
  player = null; ci = null; active = false; paused = false;
  if (bundleUrl) URL.revokeObjectURL(bundleUrl);
  bundleUrl = null; $('pause').textContent = 'Pause'; $('player').innerHTML = idle; $('video-mode').textContent = 'Native: —'; isFullscreen = false; $('fullscreen').textContent = 'Fullscreen'; controls();
}
async function launch(demo = false, quick = false) {
  busy = true; controls();
  try {
    const file = demo || quick ? null : $('game').files[0];
    const kind = demo ? null : quick ? 'jsdos' : await validateFile(file);
    if (!demo && mobileNeedsOverride(quick)) {
      throw new Error('Large game bundle blocked to avoid another mobile Safari crash. Use a smaller private bundle or tick Attempt anyway.');
    }
    status('Loading emulator code…', 'LOADING'); await loadLibrary();
    const source = {};
    if (quick) {
      if (!savedShortcut?.bundle) throw new Error('No saved GTA shortcut found on this browser.');
      bundleUrl = URL.createObjectURL(savedShortcut.bundle);
      source.url = bundleUrl;
    } else if (kind === 'jsdos') { bundleUrl = URL.createObjectURL(file); source.url = bundleUrl; }
    else {
      source.dosboxConf = configuration(kind === 'iso', $('commands').value);
      if (kind === 'iso') {
        status('Reading your ISO into browser memory. Large discs may take a moment…');
        source.initFs = [{ path: 'disc.iso', contents: new Uint8Array(await file.arrayBuffer()) }];
      }
    }
    $('player').replaceChildren(); active = true; controls();
    player = window.Dos($('player'), {
      ...source, pathPrefix: CDN + 'emulators/', backend: 'dosbox', backendLocked: true,
      theme: 'dark', autoStart: true, countDownStart: 0, autoSave: false,
      kiosk: true,
      softFullscreen: isTouchDevice,
      fsChanges: { local: false }, renderAspect: $('aspect-mode').value, 
      renderBackend: $('render-backend').value, imageRendering: $('display-mode').value,
      onEvent(event, value) {
        if (event === 'fullscreen-change') { isFullscreen = Boolean(value); $('fullscreen').textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen'; }
        if (event === 'ci-ready') {
          ci = value; clearTimeout(timer); controls();
          ci.events().onFrameSize((width, height) => { if (width > 0 && height > 0) $('video-mode').textContent = 'Native: ' + width + '×' + height; });
          status(demo ? 'DOS smoke test running. Look for “Emulator smoke test: OK” in the terminal.' : quick ? 'Starting your saved GTA shortcut. Click the game picture for keyboard control.' : 'DOS is running. Check the terminal for mount results, then install or launch your game.', 'DOS RUNNING');
          ci.events().onMessage((type, ...args) => {
            if (type !== 'error') return;
            const message = args.join(' ');
            // DOSBox emits ordinary command parsing through the same channel.
            if (message.startsWith('[LOG_EXEC]Parsing command line:')) return;
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
  $('override-mobile').checked = false;
  updateMobileNotice();
  status('File selected locally. Launch to validate and load it.', 'READY TO IMPORT'); controls();
});
$('launch').addEventListener('click', () => launch());
$('pick-file').addEventListener('click', () => {
  $('tools-panel').open = true;
  $('game').click();
});
$('demo').addEventListener('click', () => launch(true));
$('quick-play').addEventListener('click', () => launch(false, true));
$('quick-commands').addEventListener('input', controls);
$('override-mobile').addEventListener('change', controls);
$('pause').addEventListener('click', () => { paused = !paused; player.setPaused(paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; });
$('fullscreen').addEventListener('click', () => {
  if (!player) return;
  player.setFullScreen(!isFullscreen);
});
$('display-mode').addEventListener('change', () => {
  const mode = $('display-mode').value;
  if (!['smooth', 'pixelated'].includes(mode)) return;
  try { localStorage.setItem(RENDER_PREF_KEY, mode); } catch { /* optional display preference only */ }
  if (player) player.setImageRendering(mode);
  status(mode === 'smooth' ? 'Smooth scaling enabled. This filters the picture, but does not increase GTA’s internal resolution.' : 'Crisp pixels enabled. For original GTA video modes, press Game resolution (F11).', 'DISPLAY READY');
});
$('aspect-mode').addEventListener('change', () => {
  const aspect = $('aspect-mode').value;
  if (!['4/3', 'AsIs'].includes(aspect)) return;
  try { localStorage.setItem(ASPECT_PREF_KEY, aspect); } catch { /* optional preference */ }
  if (player) player.setRenderAspect(aspect);
  status(aspect === '4/3'
    ? 'CRT 4:3 correction enabled. DOS VGA pixels can be non-square.'
    : 'Raw source-pixel aspect selected for comparison; GTA may look vertically squashed.',
    'DISPLAY READY');
});
$('render-backend').addEventListener('change', () => {
  const backend = $('render-backend').value;
  if (!['webgl', 'canvas'].includes(backend)) return;
  try { localStorage.setItem(BACKEND_PREF_KEY, backend); } catch { /* optional preference */ }
  status(backend === 'canvas'
    ? 'Canvas fallback selected. It will be used on the next game launch.'
    : 'WebGL rendering selected. It will be used on the next game launch.', 'DISPLAY READY');
});
$('native-resolution').addEventListener('click', () => {
  if (!ci || busy) return;
  if (paused) { player.setPaused(false); paused = false; $('pause').textContent = 'Pause'; }
  ci.simulateKeyPress(F11_KEY_CODE);
  status('Sent F11 to GTA. This normally opens the game’s display-mode options. Select a supported mode in the game; native dimensions update if the framebuffer changes.', 'GAME DISPLAY');
});
$('screenshot').addEventListener('click', async () => {
  if (!ci || busy) return;
  busy = true; controls();
  try {
    const shot = await ci.screenshot();
    if (!shot || shot.width <= 0 || shot.height <= 0) throw new Error('No game framebuffer was returned.');
    const canvas = document.createElement('canvas');
    canvas.width = shot.width;
    canvas.height = shot.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create an image canvas in this browser.');
    context.putImageData(shot, 0, 0);
    const png = await new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'));
    const url = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gta-1997-' + shot.width + 'x' + shot.height + '.png';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status('Native ' + shot.width + '×' + shot.height + ' screenshot requested. This is the original game output, not an artificially enhanced image.', 'SCREENSHOT READY');
  } catch (error) {
    status('Screenshot failed: ' + error.message, 'SCREENSHOT ERROR');
  } finally { busy = false; controls(); }
});
// Touch buttons hold the original DOS key down until the finger is released.
// This is essential for steering/acceleration (a simulated tap does not work).
for (const button of document.querySelectorAll('[data-hold-key]')) {
  const release = (event) => {
    const held = heldKeys.get(event.pointerId);
    if (!held) return;
    heldKeys.delete(event.pointerId);
    button.classList.remove('pressed');
    if (ci) ci.sendKeyEvent(held.code, false);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (!ci || busy || button.disabled) return;
    if (paused) { player.setPaused(false); paused = false; $('pause').textContent = 'Pause'; }
    const code = Number(button.dataset.holdKey);
    if (heldKeys.has(event.pointerId)) return;
    if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    heldKeys.set(event.pointerId, { code, button });
    button.classList.add('pressed');
    ci.sendKeyEvent(code, true);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(eventName, release);
  }
  button.addEventListener('contextmenu', (event) => event.preventDefault());
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

$('remember').addEventListener('click', async () => {
  const commands = $('quick-commands').value;
  busy = true; controls();
  status('Saving an installed copy and launch settings into this browser…', 'SAVING');
  const shouldResume = !paused;
  let suspended = false;
  try {
    if (!ci) throw new Error('Launch and install GTA before setting up a one-click shortcut.');
    const tools = await bundleTools();
    ci.pause(); suspended = true;
    const bytes = await ci.persist(false);
    if (!bytes) throw new Error('Could not capture the installed game. Export a backup first.');
    const config = await tools.bundleConfig(bytes);
    if (!config?.dosboxConf) throw new Error('The exported backup does not contain a DOSBox configuration.');
    config.dosboxConf = quickStartConfig(config.dosboxConf, commands);
    const updated = await tools.bundleUpdateConfig(bytes, config);
    if (!updated) throw new Error('Could not write launch settings into the backup.');
    const bundle = new Blob([updated], { type: 'application/zip' });
    await savePrivateShortcut(bundle, commands.trim());
    savedShortcut = { bundle, commands: commands.trim(), savedAt: Date.now() };
    $('quick-info').textContent = 'GTA is saved privately in this browser. Next visit, press Play saved GTA.';
    updateMobileNotice();
    status('One-click shortcut saved locally! Keep a separate exported backup; browser storage can be cleared.', 'SHORTCUT READY');
  } catch (error) {
    status('Could not save shortcut: ' + error.message + ' Your running game is unchanged.', 'SAVE FAILED');
  } finally {
    if (suspended && shouldResume && ci) ci.resume();
    busy = false; controls();
  }
});
$('forget').addEventListener('click', async () => {
  if (!confirm('Remove the saved GTA shortcut from this browser? Export a backup first if needed.')) return;
  busy = true; controls();
  try {
    await clearPrivateShortcut();
    savedShortcut = null;
    $('quick-info').textContent = 'No saved game on this browser yet.';
    updateMobileNotice();
    status('Saved shortcut removed from this browser. Your exported backup files are unchanged.', 'AWAITING INPUT');
  } catch (error) {
    status('Could not remove local copy: ' + error.message, 'STORAGE ERROR');
  } finally { busy = false; controls(); }
});
loadPrivateShortcut().then(record => {
  if (record?.bundle instanceof Blob) {
    savedShortcut = record;
    $('quick-commands').value = record.commands || '';
    $('quick-info').textContent = 'Saved GTA ready on this device. Press Play saved GTA to start.';
    updateMobileNotice();
  }
  controls();
}).catch(error => {
  $('quick-info').textContent = 'Local game storage unavailable: ' + error.message;
  controls();
});
window.addEventListener('beforeunload', (event) => { if (active) { event.preventDefault(); event.returnValue = ''; } });