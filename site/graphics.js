/**
 * Phase 1 graphics presets.
 * All visual effects are bundled with the public website, and operate purely
 * on the already-rendered game picture. No remote mods or game assets.
 *
 * Phase 1 does NOT implement xBR, Scale2x, texture replacement, native high
 * resolution, or a new emulator renderer. Those need separate validated work.
 */
export const GRAPHICS_PRESETS = Object.freeze({
  original: { label: 'Original', description: 'Unmodified colours with sharp pixel scaling.' },
  enhanced: { label: 'Enhanced Pixels', description: 'Sharp pixels with restrained colour and contrast correction.' },
  vibrant: { label: 'Vibrant Classic', description: 'Richer colours and stronger contrast, still pixel-sharp.' },
  crt: { label: 'CRT Classic', description: 'Subtle scanlines and a classic-monitor colour treatment.' }
});

export const GRAPHICS_STORAGE_KEY = 'theft-auto-grand-graphics-phase1';

export function normalizeGraphicsPreset(value) {
  return Object.hasOwn(GRAPHICS_PRESETS, value) ? value : 'original';
}

export function applyGraphicsPreset(stage, requested) {
  const preset = normalizeGraphicsPreset(requested);
  if (!stage || !stage.dataset) throw new Error('Graphics stage is unavailable.');
  stage.dataset.graphics = preset;
  return preset;
}
