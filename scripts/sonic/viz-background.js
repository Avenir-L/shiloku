export const VIZ_BACKGROUND_STORAGE_KEY = 'sonic-topography-viz-background-v1';

export const VIZ_BG_MODE_FOLLOW_SONG = 'follow-song';
export const VIZ_BG_MODE_CUSTOM = 'custom';

export const defaultVizBackgroundSettings = {
  mode: VIZ_BG_MODE_FOLLOW_SONG,
  color: '#070d1a',
  color2: '#020408',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHex(value, fallback) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

export function normalizeVizBackgroundSettings(value) {
  const mode = value?.mode === VIZ_BG_MODE_CUSTOM ? VIZ_BG_MODE_CUSTOM : VIZ_BG_MODE_FOLLOW_SONG;
  return {
    mode,
    color: normalizeHex(value?.color, defaultVizBackgroundSettings.color),
    color2: normalizeHex(value?.color2, defaultVizBackgroundSettings.color2),
  };
}

export function readVizBackgroundStorage() {
  if (typeof window === 'undefined') return { ...defaultVizBackgroundSettings };
  try {
    const raw = window.localStorage.getItem(VIZ_BACKGROUND_STORAGE_KEY);
    return normalizeVizBackgroundSettings(raw ? JSON.parse(raw) : undefined);
  } catch {
    return { ...defaultVizBackgroundSettings };
  }
}

export function writeVizBackgroundStorage(settings) {
  if (typeof window === 'undefined') return normalizeVizBackgroundSettings(settings);
  const normalized = normalizeVizBackgroundSettings(settings);
  window.localStorage.setItem(VIZ_BACKGROUND_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function hexToRgb(hex) {
  const value = normalizeHex(hex, '#000000').slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const part = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function luminance(rgb) {
  return (rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722) / 255;
}

function darken(rgb, amount) {
  const t = clamp(amount, 0, 1);
  return {
    r: rgb.r * (1 - t),
    g: rgb.g * (1 - t),
    b: rgb.b * (1 - t),
  };
}

function saturate(rgb, amount) {
  const gray = (rgb.r + rgb.g + rgb.b) / 3;
  const t = clamp(amount, 0, 1.5);
  return {
    r: gray + (rgb.r - gray) * t,
    g: gray + (rgb.g - gray) * t,
    b: gray + (rgb.b - gray) * t,
  };
}

export function buildCustomPalette(settings) {
  const top = hexToRgb(settings.color);
  const bottom = hexToRgb(settings.color2);
  const deep = darken(mixRgb(top, bottom, 0.5), 0.35);
  const accent = saturate(mixRgb(top, bottom, 0.35), 1.25);
  return {
    top: rgbToHex(top.r, top.g, top.b),
    mid: rgbToHex(bottom.r, bottom.g, bottom.b),
    deep: rgbToHex(deep.r, deep.g, deep.b),
    accent: rgbToHex(accent.r, accent.g, accent.b),
    fog: rgbToHex(deep.r, deep.g, deep.b),
  };
}

export function buildPaletteFromImage(img) {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return buildCustomPalette(defaultVizBackgroundSettings);
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  let accentR = 0;
  let accentG = 0;
  let accentB = 0;
  let accentWeight = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.2) continue;
    const sample = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const lum = luminance(sample);
    const w = (1.1 - lum) * alpha;
    r += sample.r * w;
    g += sample.g * w;
    b += sample.b * w;
    weight += w;
    if (lum > 0.18 && lum < 0.82) {
      const aw = alpha * (0.35 + (1 - Math.abs(lum - 0.5) * 2));
      accentR += sample.r * aw;
      accentG += sample.g * aw;
      accentB += sample.b * aw;
      accentWeight += aw;
    }
  }

  if (!weight) return buildCustomPalette(defaultVizBackgroundSettings);

  const avg = { r: r / weight, g: g / weight, b: b / weight };
  const accentAvg = accentWeight
    ? { r: accentR / accentWeight, g: accentG / accentWeight, b: accentB / accentWeight }
    : avg;

  const top = darken(avg, 0.55);
  const mid = darken(avg, 0.72);
  const deep = darken(avg, 0.82);
  const accent = saturate(accentAvg, 1.35);

  return {
    top: rgbToHex(top.r, top.g, top.b),
    mid: rgbToHex(mid.r, mid.g, mid.b),
    deep: rgbToHex(deep.r, deep.g, deep.b),
    accent: rgbToHex(accent.r, accent.g, accent.b),
    fog: rgbToHex(deep.r, deep.g, deep.b),
  };
}

export function applyVizBackgroundPalette(musicRoom, palette) {
  if (!musicRoom || !palette) return null;
  musicRoom.style.setProperty('--viz-bg-top', palette.top);
  musicRoom.style.setProperty('--viz-bg-mid', palette.mid);
  musicRoom.style.setProperty('--viz-bg-deep', palette.deep);
  musicRoom.style.setProperty('--viz-bg-accent', palette.accent);
  musicRoom.dataset.vizBgApplied = '1';
  return palette;
}

export function applyVizBackgroundSettings(musicRoom, settings, paletteOverride = null) {
  const normalized = normalizeVizBackgroundSettings(settings);
  const palette = paletteOverride || buildCustomPalette(normalized);
  applyVizBackgroundPalette(musicRoom, palette);
  return { settings: normalized, palette };
}

export function extractPaletteFromCoverUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        resolve(buildPaletteFromImage(img));
      } catch {
        resolve(buildCustomPalette(defaultVizBackgroundSettings));
      }
    };
    img.onerror = () => resolve(buildCustomPalette(defaultVizBackgroundSettings));
    img.src = url;
  });
}
