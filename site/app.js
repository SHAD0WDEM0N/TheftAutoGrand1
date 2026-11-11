import { inspectGameFile, inspectJsdos, configuration, quickStartConfig, mobileBundleRisk } from './core.js';
import { loadPrivateShortcut, savePrivateShortcut, clearPrivateShortcut, loadGameBackup, saveGameBackup } from './storage.js';
import { inspectBundleEditions, inspectLondonGraphicsModes, bundleWithGameMode } from './editions.js';
import { isGtaProgram, shouldMaskDosStartup, looksLikeGameFrame, shouldAutoSkipVideoProbe } from './boot.js';
import { applyGraphicsPreset, GRAPHICS_STORAGE_KEY, normalizeGraphicsPreset, GRAPHICS_PRESETS } from './graphics.js';
import { canScale2x, needsEnhancedScale2x, scale2xFrame, SCALE2X_FRAME_INTERVAL_MS } from './scale2x.js';
import { createSmartRenderer, canGpuUpscale, GPU_FRAME_INTERVAL_MS } from './gpu-upscale.js';
import { verifyEditionBundle } from './edition-verify.js';
const $ = (id) => document.getElementById(id);
const CDN = 'https://cdn.jsdelivr.net/npm/js-dos@8.5.3/dist/';
let player = null, ci = null, bundleUrl = null, busy = false, active = false, paused = false, timer;
let libraryPromise, bundleToolsPromise, savedShortcut = null;
let bootSplashTimer = null, bootPollTimer = null, bootSplashActive = false, bootSplashGeneration = 0;
let bootLastFrameCheck = 0, bootGraphicFrames = 0, bootStartedAt = 0;
let bootScreenshotTimer = null, bootScreenshotMatches = 0, bootGtaDetected = false;
let bootVideoSkipTimer = null, bootTextModeSamples = 0, bootVideoSkipSent = false;
let scaleImage = null, scaleWidth = 0, scaleHeight = 0, scaleLastPaint = 0, scaleDisabled = false;
let gpuRenderer = null, gpuLastFrame = 0, gpuUnavailable = false;
const londonSources = { london69: null, london61: null };
const backupSources = {gta: null, london69: null, london61: null};
const useBackupByGame = {gta: true, london69: true, london61: true};
const backupLabels = {gta:'GTA-1997',london69:'London-1969',london61:'London-1961'};
let backupChecking = false;
function backupSlot() { return $('backup-game').value; }
function updateBackupStatus() {
  const game = backupSlot();
  const record = backupSources[game];
  $('backup-status').textContent = record
    ? 'Latest ' + backupLabels[game] + ' backup: ' + new Date(record.savedAt).toLocaleString() +
      ' (' + (record.bundle.size / 1048576).toFixed(1) + ' MiB). ' +
      (useBackupByGame[game] ? 'Next Play uses this backup.' : 'A newly uploaded game file is selected instead.')
    : 'No backup for ' + backupLabels[game] + '. Import one or save during gameplay.';
}

let londonChecking = false;
const selectedGraphicsByGame = {gta: 'auto', london69: 'auto', london61: 'auto'};
let activeGameEdition = 'gta', activeDosMode = 'auto';
const uploadProgress = { gta: null, london69: null, london61: null };
function setUploadProgress(edition, progress) {
  uploadProgress[edition] = progress;
  updateGameEditions();
}
function chosenGameSource() {
  const edition = $('game-edition').value;
  if (useBackupByGame[edition] && backupSources[edition]) return backupSources[edition].source;
  if (edition === 'gta') return playableSource();
  if (edition === 'london69' && playableSource()) return londonSources.london69;
  if (edition === 'london61' && playableSource() && londonSources.london69) return londonSources.london61;
  return null;
}
function updateGameEditions() {
  const base = !!playableSource() || !!backupSources.gta;
  const ready69 = !!londonSources.london69 || !!backupSources.london69;
  const ready61 = !!londonSources.london61 || !!backupSources.london61;
  const available69 = !!backupSources.london69 || (base && ready69);
  const available61 = !!backupSources.london61 || (available69 && ready61);
  for (const option of $('game-edition').options) {
    if (option.value === 'london69') {
      option.disabled = !available69;
      option.textContent = 'London 1969' + (available69 ? '' : ' — needs GTA + Mission Pack 1');
    }
    if (option.value === 'london61') {
      option.disabled = !available61;
      option.textContent = 'London 1961' + (available61 ? '' : ' — needs GTA + both mission packs');
    }
  }
  if ($('game-edition').selectedOptions[0]?.disabled) $('game-edition').value = 'gta';
  const labelState = (id, caption, progress, ready, selectable, missingPrereqs) => {
    const node = $(id);
    const message = progress?.message || (ready ? 'File verified' : 'No file selected');
    node.textContent = caption + ': ' + message +
      (ready && !selectable ? ' · ' + missingPrereqs : '');
    node.dataset.state = progress?.state || (ready ? 'ready' : 'empty');
  };
  labelState('gta-upload-state', 'GTA 1997', uploadProgress.gta, base, base, '');
  labelState('london69-upload-state', 'Mission Pack 1 (1969)', uploadProgress.london69,
    ready69, available69, 'add GTA data to unlock');
  labelState('london61-upload-state', 'Mission Pack 2 (1961)', uploadProgress.london61,
    ready61, available61, 'add GTA and Mission Pack 1 to unlock');
  updateEditionOptions(chosenGameSource());
}
function clearGpu() {
  $('gpu-canvas').hidden = true;
  if (gpuRenderer) gpuRenderer.dispose();
  gpuRenderer = null; gpuLastFrame = 0; gpuUnavailable = false;
}
function processGpuFrame(rgb, rgba) {
  const canvas = $('gpu-canvas');
  if (!active || !ci || $('graphics-preset').value !== 'smart' || gpuUnavailable) {
    canvas.hidden = true; return;
  }
  if (!rgb && !rgba) return;
  const width = ci.width(), height = ci.height();
  if (!canGpuUpscale(width,height)) { canvas.hidden = true; return; }
  const now = performance.now();
  if (now - gpuLastFrame < GPU_FRAME_INTERVAL_MS) return;
  gpuLastFrame = now;
  try {
    if (!gpuRenderer) gpuRenderer = createSmartRenderer(canvas);
    gpuRenderer.render(rgb,rgba,width,height);
    canvas.hidden = false;
  } catch (error) {
    gpuUnavailable = true;
    canvas.hidden = true;
    status('Smart HD GPU unavailable (' + error.message + '). Original sharp GTA picture remains available.', 'GPU FALLBACK');
  }
}
function clearScale2x() {
  scaleImage = null; scaleWidth = 0; scaleHeight = 0;
  scaleLastPaint = 0; scaleDisabled = false;
  $('enhanced-canvas').hidden = true;
  clearGpu();
}
function processEnhancedFrame(rgb, rgba) {
  const canvas = $('enhanced-canvas');
  if (!active || !ci || !needsEnhancedScale2x($('graphics-preset').value) || scaleDisabled) {
    canvas.hidden = true;
    return;
  }
  if (!rgb && !rgba) return; // js-dos may emit empty frames during mode transitions.
  const w = ci.width(), h = ci.height();
  if (!canScale2x(w, h)) {
    canvas.hidden = true;
    return; // Native F11 high-resolution modes are already pixel-sharp.
  }
  const now = performance.now();
  if (now - scaleLastPaint < SCALE2X_FRAME_INTERVAL_MS) return;
  scaleLastPaint = now;
  try {
    if (!scaleImage || w !== scaleWidth || h !== scaleHeight) {
      canvas.width = w * 2; canvas.height = h * 2;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('2D canvas is unavailable.');
      scaleWidth = w; scaleHeight = h;
      scaleImage = context.createImageData(w * 2, h * 2);
    }
    scale2xFrame(rgb, rgba, w, h, scaleImage.data);
    canvas.getContext('2d', { alpha: false }).putImageData(scaleImage, 0, 0);
    canvas.hidden = false;
  } catch (error) {
    scaleDisabled = true;
    canvas.hidden = true;
    status('Enhanced upscaling unavailable: ' + error.message + '. Original sharp rendering remains active.', 'GRAPHICS FALLBACK');
  }
}

let selectedSource = null, savedSourceReady = false, fileWasChosen = false;
let savedEditionInfo = null;
function updateEditionOptions(source) {
  const panel = $('edition-panel');
  const select = $('gta-edition');
  const note = $('edition-note');
  const game = $('game-edition').value;
  const editions = source?.editions;
  const available = editions?.available || ['auto'];
  // Rebuild the real <option> nodes for the chosen game. Keeping the old
  // GTA8/GTA24 option nodes led to stale labels on some browser sessions.
  const modes = game === 'london69'
    ? [['auto', 'Default · London 1969'],
       ['gta8', '8-bit · GTA8_UK.EXE'],
       ['gta24', '24-bit · GTA24_UK.EXE']]
    : game === 'london61'
      ? [['auto', 'Default · London 1961'],
         ['gta24', '24-bit · GTA24_61.EXE']]
      : [['auto', 'Original (bundle default)'],
         ['gta8', 'Standard · GTA8.EXE'],
         ['gta24', 'High Colour · GTA24.EXE']];
  select.replaceChildren(...modes.map(([value, label]) => {
    const option = new Option(label, value);
    option.disabled = value !== 'auto' && !available.includes(value);
    return option;
  }));
  const preferred = selectedGraphicsByGame[game] || 'auto';
  select.value = available.includes(preferred) ? preferred : 'auto';
  panel.hidden = !source || source.kind !== 'jsdos';
  note.textContent = !editions || source?.kind !== 'jsdos'
    ? 'Load a compatible .jsdos bundle to choose its DOS executable.'
    : editions.graphicsGame
      ? editions.note + ' Experimental 24-bit modes may show a black screen. Use Default to restore the working launcher.'
      : 'Detected: ' + editions.detected.map(mode => mode === 'gta8' ? 'GTA8.EXE' : 'GTA24.EXE').join(' and ') +
        '. ' + editions.note + ' 3dfx requires a tested Glide-capable backend.';
}
let checkingSource = false, checkGeneration = 0;
function playableSource() {
  if (fileWasChosen) return selectedSource;
  if (savedSourceReady && savedShortcut?.bundle) return { file: savedShortcut.bundle, kind: 'jsdos', from: 'saved', editions: savedEditionInfo };
  return null;
}
function showFileState(message, state = 'empty') {
  $('source-info').dataset.state = state;
  $('source-detail').textContent = message;
}
let isFullscreen = false;
const BACKEND_PREF_KEY = 'dos-garage-display-backend';
const F11_KEY_CODE = 300;
const idle = $('player').innerHTML;
function setGraphicsMode(value, save = true) {
  const preset = applyGraphicsPreset($('stage-frame'), value);
  $('graphics-preset').value = preset;
  $('graphics-startup').value = preset;
  $('enhanced-canvas').hidden = !needsEnhancedScale2x(preset) || !scaleImage || !active;
  $('gpu-canvas').hidden = preset !== 'smart' || !gpuRenderer || !active;
  if (save) {
    try { localStorage.setItem(GRAPHICS_STORAGE_KEY, preset); }
    catch { /* Graphics work without browser storage. */ }
  }
  return preset;
}
let preferredGraphics = 'original';
try { preferredGraphics = normalizeGraphicsPreset(localStorage.getItem(GRAPHICS_STORAGE_KEY)); }
catch { /* Private mode can block storage. */ }
setGraphicsMode(preferredGraphics, false);
try {
  const backend = localStorage.getItem(BACKEND_PREF_KEY);
  if (backend === 'webgl' || backend === 'canvas') $('render-backend').value = backend;
} catch { /* private-mode storage may be unavailable */ }
const heldKeys = new Map();
const isTouchDevice = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia('(pointer:coarse)').matches);
function tooLargeForMobile(file) { return mobileBundleRisk(file?.size || 0, isTouchDevice); }
function mobileNeedsOverride(quick = false) {
  const file = chosenGameSource()?.file || (quick ? savedShortcut?.bundle : (selectedSource?.file || $('game').files[0]));
  return tooLargeForMobile(file) && !$('override-mobile').checked;
}
function updateMobileNotice() {
  const target = chosenGameSource()?.file || $('game').files[0] || (!fileWasChosen && savedShortcut?.bundle);
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
  const uploadDisabled = busy || active || checkingSource || londonChecking;
  $('add-file-menu').classList.toggle('is-disabled', uploadDisabled);
  for (const button of document.querySelectorAll('[data-upload-edition]')) button.disabled = uploadDisabled;
  if (uploadDisabled) $('add-file-menu').open = false;
  const canInstall = !busy && !active && !checkingSource && selectedSource?.from === 'file' && selectedSource.kind === 'jsdos';
  $('install-local').hidden = !selectedSource || selectedSource.kind !== 'jsdos' || selectedSource.from !== 'file';
  $('install-local').disabled = !canInstall;
  $('native-resolution').disabled = busy || !ci || (activeGameEdition === 'london69' && (activeDosMode === 'gta8' || activeDosMode === 'auto'));
  $('native-resolution').title = activeGameEdition === 'london69' && (activeDosMode === 'gta8' || activeDosMode === 'auto')
    ? 'GTA8_UK.EXE uses 8-bit video mode; switch to London 1969 24-bit before launch to test higher resolutions.'
    : 'Request a screen mode from the current game (F11); availability depends on the executable.';
  $('inspect-program').disabled = busy || !ci;
  $('screenshot').disabled = busy || !ci;
  $('render-backend').disabled = busy || active;
  $('game').disabled = busy || active || checkingSource;
  $('gta-edition').disabled = busy || active || checkingSource;
  $('game-edition').disabled = busy || active || checkingSource || londonChecking;
  for (const id of ['london69-file', 'london61-file']) $(id).disabled = busy || active || londonChecking;
  $('backup-game').disabled = busy || backupChecking || active;
  $('save-progress').disabled = busy || backupChecking || !ci || !active;
  $('export').disabled = busy || backupChecking || !backupSources[backupSlot()];
  $('import-backup').disabled = busy || backupChecking || active;
  $('backup-file').disabled = busy || backupChecking || active;
  $('play').disabled = busy || active || checkingSource || londonChecking || !chosenGameSource()
    || mobileNeedsOverride(chosenGameSource()?.from === 'saved');
  $('demo').disabled = busy || active;
  for (const id of ['pause', 'fullscreen']) $(id).disabled = busy || !ci;
  for (const button of document.querySelectorAll('[data-dos-key],[data-hold-key]')) button.disabled = busy || !ci;
  $('stop').disabled = busy || !active;

  $('remember').disabled = busy || !ci || !$('quick-commands').value.trim();
  $('forget').disabled = busy || active || !savedShortcut;
}
function hideBootSplash() {
  ++bootSplashGeneration;
  bootGraphicFrames = 0;
  bootLastFrameCheck = 0;
  bootStartedAt = 0;
  clearTimeout(bootSplashTimer);
  clearTimeout(bootPollTimer);
  clearTimeout(bootScreenshotTimer);
  clearTimeout(bootVideoSkipTimer);
  bootTextModeSamples = 0;
  bootVideoSkipSent = false;
  bootScreenshotMatches = 0;
  bootGtaDetected = false;
  bootSplashActive = false;
  $('boot-splash').hidden = true;
  $('skip-video-probe').disabled = true;
}

function showBootSplash() {
  hideBootSplash();
  bootSplashActive = true;
  bootStartedAt = Date.now();
  $('skip-video-probe').disabled = !ci;
  $('boot-message').textContent = 'The game is loading behind the scenes. DOS startup stays hidden.';
  $('boot-splash').hidden = false;
  const generation = bootSplashGeneration;
  // Don't leave a confirmed GTA executable hidden indefinitely when a dark
  // title screen defeats colour-based frame detection. This is a delayed
  // fallback, never a claim that GTA is known to have reached its menu.
  bootSplashTimer = setTimeout(() => {
    if (!bootSplashActive || generation !== bootSplashGeneration) return;
    if (bootGtaDetected) {
      hideBootSplash();
      status('GTA executable has been running. Revealed game after startup grace period.', 'GTA VISIBLE');
    } else {
      $('boot-message').textContent = 'GTA may already be running. Choose Show game to check, or Show DOS to troubleshoot.';
      status('Startup could not be confirmed. Show game reveals the current picture.', 'CHECK GAME');
    }
  }, 18000);
}


function watchVideoSetupPrompt(commandInterface) {
  if (!bootSplashActive) return;
  const generation = bootSplashGeneration;
  // Start only after the emulator is ready; the timer is intentionally
  // conservative so it cannot interrupt the initial driver loading steps.
  const began = Date.now();
  const check = () => {
    if (!bootSplashActive || generation !== bootSplashGeneration || !ci || bootVideoSkipSent) return;
    let width = 0, height = 0;
    try {
      width = commandInterface.width();
      height = commandInterface.height();
    } catch { /* A video transition may momentarily lack dimensions. */ }
    const textMode = (width === 720 && height === 400)
      || (width === 640 && (height === 400 || height === 350));
    bootTextModeSamples = textMode ? bootTextModeSamples + 1 : 0;
    const elapsedMs = Date.now() - began;
    if (shouldAutoSkipVideoProbe({
      enabled: true,
      elapsedMs, width, height, textModeSamples: bootTextModeSamples,
      graphicFrames: bootGraphicFrames, alreadySent: bootVideoSkipSent
    })) {
      // Only a single Esc is ever sent per launch. This is not guaranteed
      // to be a SciTech screen; disable auto-skip if it misidentifies a prompt.
      bootVideoSkipSent = true;
      try {
        commandInterface.simulateKeyPress(256);
        $('boot-message').textContent = 'Skipped the DOS video setup prompt; checking for GTA…';
        status('Sent one Esc to the persistent DOS text screen. Waiting for GTA graphics.', 'VIDEO SETUP SKIPPED');
      } catch (error) {
        status('Automatic video setup skip failed: ' + error.message, 'INPUT NOTICE');
      }
      return;
    }
    if (elapsedMs < 17500) bootVideoSkipTimer = setTimeout(check, 700);
  };
  bootVideoSkipTimer = setTimeout(check, 800);
}

function watchGtaScreenshots(commandInterface) {
  if (!bootSplashActive) return;
  const generation = bootSplashGeneration;
  const check = async () => {
    if (!bootSplashActive || generation !== bootSplashGeneration) return;
    try {
      // A framebuffer screenshot can remain available even when a backend's
      // onFrame callback does not deliver pixels in the expected format.
      const shot = await commandInterface.screenshot();
      if (!bootSplashActive || generation !== bootSplashGeneration) return;
      if (shot && looksLikeGameFrame(null, shot.data, shot.width, shot.height)) {
        bootScreenshotMatches++;
        if (bootScreenshotMatches >= 2) {
          hideBootSplash();
          status('GTA graphics confirmed using emulator screenshot. Opening game.', 'GAME VISIBLE');
          return;
        }
      } else {
        bootScreenshotMatches = 0;
      }
    } catch {
      // A screenshot may not be available during DOS video-mode transitions.
      bootScreenshotMatches = 0;
    }
    if (bootSplashActive && generation === bootSplashGeneration) {
      bootScreenshotTimer = setTimeout(check, 1800);
    }
  };
  bootScreenshotTimer = setTimeout(check, 1000);
}

function watchGtaFrames(commandInterface) {
  if (!bootSplashActive) return;
  const generation = bootSplashGeneration;
  commandInterface.events().onFrame((rgb, rgba) => {
    if (!bootSplashActive || generation !== bootSplashGeneration) return;
    const now = Date.now();
    if (now - bootLastFrameCheck < 300) return;
    bootLastFrameCheck = now;
    const width = commandInterface.width();
    const height = commandInterface.height();
    if (looksLikeGameFrame(rgb, rgba, width, height)) {
      bootGraphicFrames++;
    } else {
      bootGraphicFrames = 0;
    }
    if (bootGraphicFrames >= 6 && Date.now() - bootStartedAt >= 2200) {
      hideBootSplash();
      status('Game graphics detected. DOS startup was kept hidden.', 'GAME VISIBLE');
    }
  });
}

function watchGtaStartup() {
  if (!bootSplashActive || !ci) return;
  const generation = bootSplashGeneration;
  const check = async () => {
    if (!bootSplashActive || generation !== bootSplashGeneration || !ci) return;
    try {
      const program = await ci.getRunningProgram();
      if (!bootSplashActive || generation !== bootSplashGeneration) return;
      if (isGtaProgram(program)) {
        bootGtaDetected = true;
        // The executable can run while SciTech is still displaying a DOS prompt.
        // Do not reveal DOS based on program detection: wait for graphical frames,
        // or let the user choose Show game / Show DOS.
        $('boot-message').textContent = 'GTA executable detected. Checking the game screen…';
        return;
      }
    } catch {
      // Some builds temporarily cannot answer during DOS startup; continue polling.
    }
    if (bootSplashActive && generation === bootSplashGeneration) {
      bootPollTimer = setTimeout(check, 750);
    }
  };
  void check();
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
  hideBootSplash();
  clearScale2x();
  clearTimeout(timer);
  releaseHeldKeys();
  if (document.fullscreenElement === $('stage-frame')) {
    try { await document.exitFullscreen(); } catch { /* restore normal layout even if fullscreen exit fails */ }
  }
  if (player) await player.stop();
  player = null; ci = null; active = false; paused = false;
  activeGameEdition = 'gta'; activeDosMode = 'auto';
  if (bundleUrl) URL.revokeObjectURL(bundleUrl);
  bundleUrl = null; $('pause').textContent = 'Pause'; $('player').innerHTML = idle; $('video-mode').textContent = 'Native: —'; $('program-info').textContent = 'Program: —'; isFullscreen = false; $('fullscreen').textContent = 'Fullscreen'; controls();
}
async function launch(demo = false) {
  busy = true; controls();
  try {
    const sourceInfo = demo ? null : chosenGameSource();
    if (!demo && !sourceInfo) throw new Error('Add a file and complete the check before pressing Play GTA.');
    const file = sourceInfo?.file || null;
    const kind = sourceInfo?.kind || null;
    const quick = sourceInfo?.from === 'saved';
    if (!demo && mobileNeedsOverride(quick)) {
      throw new Error('Large game bundle blocked on mobile. Use a smaller private bundle or tick Attempt anyway.');
    }
    status('Loading emulator code…', 'LOADING'); await loadLibrary();
    const source = {};
    if (kind === 'jsdos') {
      const selectedGame = $('game-edition').value;
      const chosenMode = $('gta-edition').value;
      const edition = sourceInfo.editions;
      if (chosenMode !== 'auto' && !edition?.available?.includes(chosenMode)) {
        throw new Error('This GTA graphics edition is not verified as available in the selected game bundle.');
      }
      const quiet = true; // Keep the tested working DOS boot path always enabled.
      const startBundle = await bundleWithGameMode(file, edition, chosenMode, { quiet, game: selectedGame });
      activeGameEdition = selectedGame;
      activeDosMode = chosenMode;
      $('backup-game').value = selectedGame;
      updateBackupStatus();
      bundleUrl = URL.createObjectURL(startBundle);
      source.url = bundleUrl;
      status((chosenMode === 'auto'
        ? 'Starting with the bundled DOS launch commands.'
        : 'Starting ' + (selectedGame === 'london69'
          ? (chosenMode === 'gta24' ? 'London 1969 GTA24_UK.EXE' : 'London 1969 GTA8_UK.EXE')
          : selectedGame === 'london61' ? 'London 1961 GTA24_61.EXE'
            : (chosenMode === 'gta24' ? 'GTA24.EXE' : 'GTA8.EXE')) + '.') +
        (quiet && startBundle !== file ? ' Quiet DOS startup enabled.' : ''), 'STARTING');
    }
    else {
      source.dosboxConf = configuration(kind === 'iso', $('commands').value);
      if (kind === 'iso') {
        status('Reading your ISO into browser memory. Large discs may take a moment…');
        source.initFs = [{ path: 'disc.iso', contents: new Uint8Array(await file.arrayBuffer()) }];
      }
    }
    clearScale2x();
    $('player').replaceChildren(); active = true; controls();
    if (!demo && shouldMaskDosStartup(kind, sourceInfo?.editions?.boot, $('game-edition').value === 'gta' ? $('gta-edition').value : 'auto')) {
      showBootSplash();
    } else {
      hideBootSplash(); // Installer ISOs need a visible shell for manual install commands.
    }
    player = window.Dos($('player'), {
      ...source, pathPrefix: CDN + 'emulators/', backend: 'dosbox', backendLocked: true,
      theme: 'dark', autoStart: true, countDownStart: 0, autoSave: false,
      kiosk: true,
      softFullscreen: isTouchDevice,
      fsChanges: { local: false }, renderAspect: '4/3',
      renderBackend: $('render-backend').value, imageRendering: 'pixelated',
      onEvent(event, value) {
        if (event === 'ci-ready') {
          ci = value; clearTimeout(timer); controls();
          $('skip-video-probe').disabled = !bootSplashActive;
          ci.events().onFrame((rgb, rgba) => processEnhancedFrame(rgb, rgba));
          ci.events().onFrame((rgb, rgba) => processGpuFrame(rgb, rgba));
          if (bootSplashActive) { watchGtaFrames(ci); watchGtaScreenshots(ci); watchGtaStartup(); watchVideoSetupPrompt(ci); }
          ci.events().onFrameSize((width, height) => { if (width > 0 && height > 0) $('video-mode').textContent = 'Native: ' + width + '×' + height; });
          status(bootSplashActive
            ? 'Launching GTA in the background…'
            : demo
              ? 'DOS smoke test running. Look for “Emulator smoke test: OK” in the terminal.'
              : quick
                ? 'Starting your saved GTA shortcut. Click the game picture for keyboard control.'
                : 'DOS is running. Check the terminal for mount results, then install or launch your game.',
            bootSplashActive ? 'STARTING GTA' : 'DOS RUNNING');
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
    player.setRenderAspect('4/3'); // Enforce the same classic aspect on startup and F11 mode changes.
    status('Starting DOS. Use End session if the emulator reports an error.', 'BOOTING');
    timer = setTimeout(() => { if (!ci) status('Startup is taking longer than expected. Check the player for errors, or end the session and retry.', 'CHECK TERMINAL'); }, 60000);
  } catch (error) {
    try { await end(); } catch { /* Keep the original diagnostic. */ }
    status(error.message, 'IMPORT FAILED');
  } finally { busy = false; controls(); }
}

async function checkAddedFile(file) {
  if (!file) return;
  const generation = ++checkGeneration;
  fileWasChosen = true;
  checkingSource = true;
  selectedSource = null;
  updateEditionOptions(null);
  $('override-mobile').checked = false;
  $('file-info').textContent = file.name + ' · ' + (file.size / 1048576).toFixed(1) + ' MiB';
  showFileState('Checking ' + file.name + '…', 'checking');
  setUploadProgress('gta', {state: 'checking', message: 'Checking ' + file.name + '…'});
  status('Checking game file structure locally…', 'CHECKING');
  controls();
  try {
    const info = await inspectGameFile(file);
    if (generation !== checkGeneration) return;
    showFileState('File structure valid. Verifying launch options…', 'checking');
    status('Checking DOS launch configuration locally…', 'CHECKING');
    let editions = null;
    if (info.kind === 'jsdos') {
      editions = await inspectBundleEditions(file);
      if (generation !== checkGeneration) return;
    }
    selectedSource = { file, kind: info.kind, from: 'file', editions };
    useBackupByGame.gta = false;
    setUploadProgress('gta', {state: 'ready', message: 'Verified ' + file.name + ' (ZIP/DOS structure; gameplay not tested)'});
    updateEditionOptions(selectedSource);
    updateGameEditions();
    showFileState('Ready to start: ' + file.name + ' (' + info.kind.toUpperCase() + '). Game launch not yet tested.', 'ready');
    status(info.description + ' Press Play GTA to start.', 'FILE READY');
    updateMobileNotice();
  } catch (error) {
    if (generation !== checkGeneration) return;
    setUploadProgress('gta', {state: 'error', message: file.name + ' — ' + error.message});
    showFileState('File check failed: ' + error.message, 'error');
    status('File check failed: ' + error.message, 'INVALID FILE');
  } finally {
    if (generation === checkGeneration) { checkingSource = false; controls(); }
  }
}
$('game').addEventListener('change', () => {
  const file = $('game').files[0];
  if (file) void checkAddedFile(file);
});
async function checkLondonBundle(edition, file) {
  const label = edition === 'london69' ? 'Mission Pack 1 (London 1969)' : 'Mission Pack 2 (London 1961)';
  const statusId = edition === 'london69' ? 'london69-status' : 'london61-status';
  if (!file) return;
  londonChecking = true;
  londonSources[edition] = null;
  $(statusId).textContent = 'Checking ' + file.name + ' locally…';
  setUploadProgress(edition, {state: 'checking', message: 'Checking ' + file.name + '…'});
  updateGameEditions(); controls();
  try {
    if (!file.name.toLowerCase().endsWith('.jsdos')) throw new Error('Choose the converted London .jsdos bundle.');
    const inspected = await inspectGameFile(file);
    if (inspected.kind !== 'jsdos') throw new Error('Not a valid .jsdos DOS game bundle.');
    const inspectedEditions = await inspectBundleEditions(file);
    const verification = await verifyEditionBundle(file, edition, inspectedEditions);
    const editions = await inspectLondonGraphicsModes(file, edition, inspectedEditions);
    londonSources[edition] = { file, kind: 'jsdos', from: 'london', editions, verification };
    useBackupByGame[edition] = false;
    setUploadProgress(edition, {state: 'ready', message: 'Verified ' + file.name + ' (' + verification.fileCount + ' entries; gameplay not tested)'});
    $(statusId).textContent = 'Verified ' + file.name + ' (' + verification.fileCount + ' ZIP entries). ' +
      verification.note + ' Gameplay still requires testing.';
    updateGameEditions();
    if (!$('game-edition').querySelector('[value="' + edition + '"]').disabled) {
      $('game-edition').value = edition;
    }
    updateEditionOptions(chosenGameSource());
    status(label + ' is structurally compatible. Choose Play GTA to test the game.', 'MISSION PACK READY');
  } catch (error) {
    londonSources[edition] = null;
    setUploadProgress(edition, {state: 'error', message: file.name + ' — ' + error.message});
    $(statusId).textContent = 'Not compatible with ' + label + ': ' + error.message;
    status(label + ' file check failed: ' + error.message, 'INVALID MISSION PACK');
  } finally {
    londonChecking = false;
    updateGameEditions(); updateMobileNotice(); controls();
  }
}
for (const [id, edition] of [['london69-file','london69'],['london61-file','london61']]) {
  $(id).addEventListener('change', () => { void checkLondonBundle(edition, $(id).files[0]); });
}
$('gta-edition').addEventListener('change', () => {
  selectedGraphicsByGame[$('game-edition').value] = $('gta-edition').value;
  const mode = $('gta-edition').selectedOptions[0]?.textContent || $('gta-edition').value;
  status('Selected DOS executable: ' + mode + '. This takes effect on the next launch.', 'GRAPHICS EDITION');
});
$('game-edition').addEventListener('change', () => {
  updateGameEditions();
  updateEditionOptions(chosenGameSource());
  updateMobileNotice();
  controls();
});
for (const button of document.querySelectorAll('[data-upload-edition]')) {
  button.addEventListener('click', () => {
    const target = button.dataset.uploadEdition;
    const pickerId = {gta: 'game', london69: 'london69-file', london61: 'london61-file'}[target];
    if (!pickerId || button.disabled) return;
    $('add-file-menu').open = false;
    const picker = $(pickerId);
    picker.value = ''; // Selecting the same file repeats validation.
    picker.click(); // Synchronous with button click: browser permits file dialogue.
  });
}
function handleGraphicsChange(value) {
  const mode = setGraphicsMode(value);
  status(GRAPHICS_PRESETS[mode].description + ' Original GTA assets are unchanged.', 'GRAPHICS: ' + GRAPHICS_PRESETS[mode].label.toUpperCase());
}
$('graphics-preset').addEventListener('change', () => handleGraphicsChange($('graphics-preset').value));
$('graphics-startup').addEventListener('change', () => handleGraphicsChange($('graphics-startup').value));
$('play').addEventListener('click', () => launch());
$('demo').addEventListener('click', () => launch(true));
$('show-dos').addEventListener('click', () => {
  hideBootSplash();
  status('DOS view revealed for troubleshooting. The game keeps running in the background.', 'DOS VISIBLE');
});
$('skip-video-probe').addEventListener('click', () => {
  if (!ci || !bootSplashActive) return;
  try {
    bootVideoSkipSent = true; // Prevent the automatic aid from sending a second Esc.
    clearTimeout(bootVideoSkipTimer);
    ci.simulateKeyPress(256); // Escape, only via explicit user action.
    $('boot-message').textContent = 'Esc sent. Checking whether GTA proceeds to its title screen…';
    status('Sent Esc to skip the DOS video-mode test at your request. If needed, use Show game or Show DOS.', 'VIDEO TEST SKIPPED');
  } catch (error) {
    status('Could not skip the video-mode test: ' + error.message, 'INPUT NOTICE');
  }
});
$('show-game').addEventListener('click', () => {
  hideBootSplash();
  status('Game screen revealed manually. If it is still at a DOS prompt, use the DOS startup commands to investigate.', 'GAME DISPLAY');
});
$('install-local').addEventListener('click', async () => {
  const source = selectedSource;
  if (!source || source.kind !== 'jsdos' || source.from !== 'file') return;
  if (savedShortcut && !confirm('Replace the previous browser-saved GTA copy? Export an independent backup first if it contains progress.')) return;
  busy = true; controls();
  try {
    status('Saving your .jsdos game privately in this browser. Large game files may exceed browser storage limits…', 'INSTALLING');
    await savePrivateShortcut(source.file, '');
    savedShortcut = { bundle: source.file, commands: '', savedAt: Date.now() };
    savedEditionInfo = source.editions;
    savedSourceReady = true;
    fileWasChosen = false;
    updateGameEditions();
    selectedSource = null;
    $('game').value = '';
    $('file-info').textContent = 'Game saved in this browser. Keep your original Datafile.jsdos as backup.';
    $('quick-info').textContent = 'Installed privately on this PC. Open the site and press Play GTA next time.';
    updateEditionOptions({ kind: 'jsdos', editions: savedEditionInfo });
    showFileState('GTA is ready to play from this browser. No file picker needed next visit.', 'ready');
    updateMobileNotice();
    status('Private game installation saved. Your original game file was not changed or uploaded.', 'GAME INSTALLED');
  } catch (error) {
    status('Could not save the local game: ' + error.message + '. You can still play the selected file normally.', 'STORAGE ERROR');
  } finally {
    busy = false;
    controls();
  }
});
$('quick-commands').addEventListener('input', controls);
$('override-mobile').addEventListener('change', controls);
$('pause').addEventListener('click', () => { paused = !paused; player.setPaused(paused); $('pause').textContent = paused ? 'Resume' : 'Pause'; });
// Fullscreen the 4:3 stage, never js-dos's own 16:9-sized root.
$('fullscreen').addEventListener('click', async () => {
  if (!player) return;
  try {
    if (document.fullscreenElement === $('stage-frame')) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement && $('stage-frame').requestFullscreen) {
      await $('stage-frame').requestFullscreen();
    } else {
      throw new Error('Fullscreen is unavailable while another element is fullscreen.');
    }
  } catch (error) {
    status('Could not enter fullscreen: ' + error.message, 'DISPLAY NOTICE');
  }
});
document.addEventListener('fullscreenchange', () => {
  isFullscreen = document.fullscreenElement === $('stage-frame');
  $('fullscreen').textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
  if (player) player.setRenderAspect('4/3');
});
// Only sharp pixel-art scaling is exposed: smooth interpolation blurred GTA's native sprites.
$('render-backend').addEventListener('change', () => {
  const backend = $('render-backend').value;
  if (!['webgl', 'canvas'].includes(backend)) return;
  try { localStorage.setItem(BACKEND_PREF_KEY, backend); } catch { /* optional preference */ }
  status(backend === 'canvas'
    ? 'Canvas fallback selected. It will be used on the next game launch.'
    : 'WebGL rendering selected. It will be used on the next game launch.', 'DISPLAY READY');
});
async function inspectRunningProgram() {
  if (!ci) return;
  const running = await ci.getRunningProgram();
  const program = typeof running === 'string' && running.trim() ? running.trim() : 'Unknown';
  $('program-info').textContent = 'Program: ' + program;
  return program;
}
$('inspect-program').addEventListener('click', async () => {
  if (!ci || busy) return;
  try {
    const program = await inspectRunningProgram();
    if (/\bGTA8(?:\.EXE)?\b/i.test(program)) {
      status('Running ' + program + '. The 8-bit DOS edition can have more limited video modes. For higher colour/resolution try your disc’s GTA24.EXE if available, using your existing installed files.', '8-BIT DOS');
    } else if (/\bGTA24(?:\.EXE)?\b/i.test(program)) {
      status('Running ' + program + '. Try F11 while actually driving/walking, then select the highest supported game video mode. Export a new private .jsdos backup to preserve its settings.', '24-BIT DOS');
    } else {
      status('Reported DOS program: ' + program + '. This cannot confirm which GTA edition is active. Try the game’s screen-mode key only during gameplay.', 'GAME INFO');
    }
  } catch (error) {
    status('Could not identify the running DOS program: ' + error.message, 'GAME INFO');
  }
});
$('native-resolution').addEventListener('click', async () => {
  if (!ci || busy) return;
  if (paused) { player.setPaused(false); paused = false; $('pause').textContent = 'Pause'; }
  try {
    const program = await inspectRunningProgram();
    ci.simulateKeyPress(F11_KEY_CODE);
    status('Sent documented GTA screen-mode key F11 to ' + program + '. If nothing appears, the current program or game state may not offer that menu. This control cannot force an unsupported resolution.', 'GAME DISPLAY');
  } catch (error) {
    ci.simulateKeyPress(F11_KEY_CODE);
    status('Sent F11 to the game; version detection failed (' + error.message + '). Higher native modes must be supported by this DOS executable.', 'GAME DISPLAY');
  }
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
async function inspectImportedBackup(file, game) {
  if (!file?.name?.toLowerCase().endsWith('.jsdos')) throw new Error('Select a .jsdos backup archive.');
  const info = await inspectGameFile(file);
  if (info.kind !== 'jsdos') throw new Error('This is not a js-dos filesystem backup.');
  const inspected = await inspectBundleEditions(file);
  if (typeof inspected?.config !== 'string') throw new Error('Backup does not include a readable DOSBox startup configuration.');
  if (game === 'gta') {
    if (!inspected.detected.length) throw new Error('This backup does not contain the GTA 1997 DOS executables.');
    return { file, kind: 'jsdos', from: 'backup', editions: inspected };
  }
  const verified = await verifyEditionBundle(file, game, inspected);
  const editions = await inspectLondonGraphicsModes(file, game, inspected);
  return {file, kind: 'jsdos', from: 'backup', editions, verification: verified};
}
function activateBackup(game, record) {
  backupSources[game] = record;
  useBackupByGame[game] = true;
  updateGameEditions();
  if ($('game-edition').querySelector('[value="' + game + '"]')?.disabled === false) {
    $('game-edition').value = game;
    updateEditionOptions(chosenGameSource());
  }
  updateBackupStatus();
  updateMobileNotice();
  controls();
}
$('backup-game').addEventListener('change', () => {updateBackupStatus(); controls();});
$('game-edition').addEventListener('change', () => {
  if (!active) { $('backup-game').value = $('game-edition').value; updateBackupStatus(); }
});
$('save-manager').addEventListener('toggle', () => {
  if ($('save-manager').open && active) {
    $('backup-game').value = activeGameEdition;
    updateBackupStatus();
  }
});
$('save-progress').addEventListener('click', async () => {
  if (!ci || !active || busy) return;
  const game = activeGameEdition;
  busy = true; controls();
  status('Saving ' + backupLabels[game] + ' filesystem progress locally…', 'SAVING');
  const shouldResume = !paused;
  let suspended = false;
  try {
    ci.pause(); suspended = true;
    const bytes = await ci.persist(false);
    if (!bytes || !(bytes.byteLength || bytes.size)) throw new Error('DOSBox returned no backup data.');
    const blob = new Blob([bytes], {type:'application/zip'});
    const named = new File([blob], backupLabels[game]+'.jsdos', {type:'application/zip'});
    const source = await inspectImportedBackup(named, game);
    await saveGameBackup(game, blob);
    const record = {bundle: blob, source: {...source, file: blob}, savedAt: Date.now()};
    activateBackup(game, record);
    status('Saved ' + backupLabels[game] + ' filesystem backup locally. Export it if you want a portable copy. This is not an instant gameplay snapshot.', 'BACKUP SAVED');
  } catch (error) {
    status('Save failed: ' + error.message + '. The current game has not been replaced.', 'SAVE FAILED');
  } finally {
    if (suspended && shouldResume) ci.resume();
    busy = false; controls();
  }
});
$('export').addEventListener('click', () => {
  const game = backupSlot();
  const record = backupSources[game];
  if (!record || busy) return;
  const url = URL.createObjectURL(record.bundle);
  const link = document.createElement('a');
  link.href = url; link.download = backupLabels[game] + '-backup.jsdos';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  status('Download requested for ' + backupLabels[game] + '. Keep this private; backups may contain the complete game files.', 'BACKUP EXPORTED');
});
$('import-backup').addEventListener('click', () => {
  if (busy || active || backupChecking) return;
  $('backup-file').value = '';
  $('backup-file').click();
});
$('backup-file').addEventListener('change', async () => {
  const file = $('backup-file').files[0];
  if (!file || busy || active) return;
  const game = backupSlot();
  backupChecking = true; controls();
  status('Checking imported ' + backupLabels[game] + ' backup locally…', 'IMPORTING');
  try {
    const source = await inspectImportedBackup(file, game);
    if (!confirm('Import ' + file.name + ' as the latest ' + backupLabels[game] +
      ' backup? This replaces the previous local backup for that game. It does not resume at an exact frame.')) {
      status('Backup import cancelled. Existing local backups were not changed.', 'IMPORT CANCELLED');
      return;
    }
    const blob = new Blob([file], {type:'application/zip'});
    await saveGameBackup(game, blob);
    const storedSource = {...source, file: blob};
    const record = {bundle: blob, source: storedSource, savedAt: Date.now()};
    activateBackup(game, record);
    status('Imported ' + backupLabels[game] + ' backup. Select Play to launch with the saved filesystem.', 'BACKUP IMPORTED');
  } catch (error) {
    status('Backup import rejected: ' + error.message, 'IMPORT FAILED');
  } finally {
    backupChecking = false; controls();
  }
});
async function restoreSavedBackups() {
  for (const game of ['gta','london69','london61']) {
    try {
      const stored = await loadGameBackup(game);
      if (!stored?.bundle) continue;
      const named = new File([stored.bundle], backupLabels[game]+'.jsdos', {type:'application/zip'});
      const source = await inspectImportedBackup(named,game);
      backupSources[game] = {bundle:stored.bundle, source:{...source,file:stored.bundle},savedAt:stored.savedAt};
    } catch (error) {
      status('Could not load saved '+backupLabels[game]+' backup: '+error.message,'BACKUP NOTICE');
    }
  }
  updateGameEditions(); updateBackupStatus(); controls();
}
void restoreSavedBackups();

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
    savedSourceReady = true;
    fileWasChosen = false;
    selectedSource = null;
    savedEditionInfo = await inspectBundleEditions(bundle);
    updateEditionOptions({ kind: 'jsdos', editions: savedEditionInfo });
    $('game').value = '';
    $('file-info').textContent = 'Saved private game will be used on your next launch.';
    $('quick-info').textContent = 'Saved local copy ready; your game files stay on your PC.';
    showFileState('Saved game ready. Press Play GTA next time.', 'ready');
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
    savedSourceReady = false;
    savedEditionInfo = null;
    if (!fileWasChosen) setUploadProgress('gta', {state: 'empty', message: 'No saved GTA shortcut; add a game file.'});
    updateGameEditions();
    if (!fileWasChosen) updateEditionOptions(null);
    $('quick-info').textContent = 'No saved game stored in this browser.';
    if (!fileWasChosen) showFileState('Add your own ISO or .jsdos file to begin.', 'empty');
    updateMobileNotice();
    status('Saved shortcut removed from this browser. Your exported backup files are unchanged.', 'AWAITING INPUT');
  } catch (error) {
    status('Could not remove local copy: ' + error.message, 'STORAGE ERROR');
  } finally { busy = false; controls(); }
});

loadPrivateShortcut().then(async record => {
  if (!record?.bundle || !(record.bundle instanceof Blob)) { controls(); return; }
  savedShortcut = record;
  // An existing quick-launch shortcut is optional. Never block the upload
  // controls or fetch emulator code merely to inspect its local ZIP index.
  // The emulator itself loads only when Play is pressed.
  if (!fileWasChosen) showFileState('Checking saved local GTA copy…', 'checking');
  try {
    await inspectJsdos(record.bundle);
    const editions = await inspectBundleEditions(record.bundle);
    savedEditionInfo = editions;
    savedSourceReady = true;
    $('quick-commands').value = record.commands || '';
    $('quick-info').textContent = 'Private saved game found on this browser.';
    if (!fileWasChosen) {
      setUploadProgress('gta', {state: 'ready', message: 'Verified locally saved GTA bundle'});
      updateGameEditions();
      showFileState('Saved game ready. Press Play GTA, or add a different file.', 'ready');
      status('Saved game bundle checked locally. You can still add new files.', 'FILE READY');
      updateMobileNotice();
    }
  } catch (error) {
    savedSourceReady = false;
    savedEditionInfo = null;
    $('quick-info').textContent = 'Saved game needs attention: ' + error.message;
    if (!fileWasChosen) showFileState('Saved copy could not be checked. Add a game file instead.', 'error');
  } finally {
    controls();
  }
}).catch(error => {
  $('quick-info').textContent = 'Local game storage unavailable: ' + error.message;
  controls();
});
window.addEventListener('beforeunload', (event) => { if (active) { event.preventDefault(); event.returnValue = ''; } });