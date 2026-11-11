/**
 * Built-in graphics presets, Phase 1 colour effects and Phase 2 Scale2x.
 * All visual effects are bundled with the public website, and operate purely
 * on the already-rendered game picture. No remote mods or game assets.
 *
 * Phase 2 provides Scale2x for supported low-resolution frames. It does NOT
 * replace GTA game assets or raise the internal DOS video resolution.
 */
export const GRAPHICS_PRESETS = Object.freeze({
  original: { label: 'Original', description: 'Unmodified colours with sharp pixel scaling.' },
  smart: { label: 'Smart HD (GPU)', description: 'GPU-assisted edge reconstruction for low-resolution game pixels.' },
  enhanced: { label: 'Enhanced Pixels', description: 'True 2x edge-aware pixel scaling on supported low-resolution game frames.' },
  vibrant: { label: 'Vibrant Classic', description: 'Scale2x pixel enhancement with richer colours and contrast.' },
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
