/**
 * Visual-only boot masking. We do not edit the user's DOS game, remove DOSBox,
 * or pretend the game is running until the command interface reports GTA8/24.
 */
export function shouldMaskDosStartup(kind, boot, chosenEdition) {
  if (kind !== 'jsdos') return false;
  return chosenEdition === 'gta8' || chosenEdition === 'gta24'
    || boot === 'gta8' || boot === 'gta24';
}

export function isGtaProgram(runningProgram) {
  return typeof runningProgram === 'string'
    && /\bGTA(?:8|24)(?:\.EXE)?\b/i.test(runningProgram);
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
