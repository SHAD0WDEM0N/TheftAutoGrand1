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
