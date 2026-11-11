/**
 * Visual-only boot masking. We do not edit the user's DOS game, remove DOSBox,
 * or pretend the game is running until the command interface reports GTA8/24.
 */
export function shouldMaskDosStartup(kind, boot, chosenEdition) {
  if (kind !== 'jsdos') return false;
  // A valid .jsdos bundle can start through GTA.BAT, another launcher, or
  // an indirect command. Always mask its initial DOS text. The user retains
  // both Show game and Show DOS escape hatches if manual input is required.
  return true;
}

export function isGtaProgram(runningProgram) {
  return typeof runningProgram === 'string'
    && /\b(?:GTA(?:8|24)|GTA_UK|GTA_61)(?:\.EXE)?\b/i.test(runningProgram);
}


/**
 * Bounded visual heuristic for distinguishing DOS text screens from colourful
 * game/title frames. This is only a fallback; some genuine title screens are
 * dark or nearly monochrome, so the user always has manual reveal controls.
 * Samples at most 432 pixels per check.
 */
export function looksLikeGameFrame(rgb, rgba, width, height) {
  const frame = rgb ?? rgba;
  const channels = rgb ? 3 : 4;
  if (!frame || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 160 || height < 100 || frame.length < width * height * channels) return false;
  const colours = new Set();
  let visible = 0;
  let chromatic = 0;
  const columns = 24, rows = 18;
  for (let y = 0; y < rows; y++) {
    const py = Math.floor((y + 0.5) * height / rows);
    for (let x = 0; x < columns; x++) {
      const px = Math.floor((x + 0.5) * width / columns);
      const pos = (py * width + px) * channels;
      const red = frame[pos], green = frame[pos + 1], blue = frame[pos + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      if (maximum > 28) visible++;
      if (maximum - minimum > 26 && maximum > 45) chromatic++;
      // Coarse colour quantization ignores small palette dithering variations.
      colours.add((red >> 5) << 6 | (green >> 5) << 3 | (blue >> 5));
    }
  }
  return visible >= 65 && chromatic >= 22 && colours.size >= 13;
}


/**
 * A cautious, one-shot startup escape for legacy DOS VGA text screens.
 * This does not OCR or identify SciTech by name: text mode alone is only a
 * proxy, so the user can disable this from the prelaunch screen.
 * Never send a key during normal 320x200 GTA graphics or in a raw ISO shell.
 */
export function shouldAutoSkipVideoProbe({ enabled, elapsedMs, width, height, textModeSamples, graphicFrames, alreadySent }) {
  if (!enabled || alreadySent || graphicFrames > 0) return false;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 6500 || elapsedMs > 17000) return false;
  if (textModeSamples < 3) return false;
  return (width === 720 && height === 400)
    || (width === 640 && (height === 400 || height === 350));
}
