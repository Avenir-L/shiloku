export const CUSTOM_THEME_ID = 'custom';
export const BUILT_IN_THEME_IDS = ['nocturnal', 'neon-tokyo', 'cyber-forest', 'minimal-monochrome'];
export const CUSTOM_THEME_STORAGE_KEY = 'sonic-topography-custom-themes-v2';
export const LEGACY_CUSTOM_THEME_STORAGE_KEY = 'sonic-topography-custom-theme-v1';
export const ACTIVE_CUSTOM_THEME_STORAGE_KEY = 'sonic-topography-active-custom-theme-v1';
export const ACTIVE_THEME_STORAGE_KEY = 'sonic-topography-active-theme-v1';
export const THEME_ROTATION_STORAGE_KEY = 'sonic-topography-theme-rotation-v1';

export const defaultCustomThemeSettings = {
  id: 'custom-default',
  name: 'Custom Theme 1',
  background: '#030508',
  cool: '#004dff',
  warm: '#33d1ff',
  accent: '#33d1ff',
  glowIntensity: 0.9,
  rotationSpeed: 0.5,
  showPlayerPanel: true,
};

export const defaultThemeRotationSettings = {
  enabled: false,
  intervalSeconds: 10,
  themeIds: [...BUILT_IN_THEME_IDS],
};

export const BUILT_IN_THEMES = {
  nocturnal: {
    name: 'Nocturnal',
    id: 'nocturnal',
    background: '#030508',
    coolCore: '#004dff',
    coolEdge: '#9933ff',
    warmCore: '#ff331a',
    warmEdge: '#ff9900',
    ripple: '#33e6ff',
    glowIntensity: 0.9,
    rotationSpeed: 0.5,
    showPlayerPanel: true,
  },
  'neon-tokyo': {
    name: 'Neon Tokyo',
    id: 'neon-tokyo',
    background: '#030005',
    coolCore: '#ff1a99',
    coolEdge: '#991aff',
    warmCore: '#1affcc',
    warmEdge: '#1a66ff',
    ripple: '#ffffff',
    glowIntensity: 1.5,
    rotationSpeed: 0.5,
    showPlayerPanel: true,
  },
  'cyber-forest': {
    name: 'Cyber Forest',
    id: 'cyber-forest',
    background: '#030503',
    coolCore: '#1aff80',
    coolEdge: '#0d804d',
    warmCore: '#ccff1a',
    warmEdge: '#e6801a',
    ripple: '#99ff4d',
    glowIntensity: 1.3,
    rotationSpeed: 0.5,
    showPlayerPanel: true,
  },
  'minimal-monochrome': {
    name: 'Minimal Monochrome',
    id: 'minimal-monochrome',
    background: '#050505',
    coolCore: '#e6e6e6',
    coolEdge: '#666666',
    warmCore: '#ffffff',
    warmEdge: '#b3b3b3',
    ripple: '#ffffff',
    glowIntensity: 0.8,
    rotationSpeed: 0.5,
    showPlayerPanel: true,
  },
};

function normalizeHexColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/i.test(color) ? color : fallback;
}

function clampGlowIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultCustomThemeSettings.glowIntensity;
  return Math.max(0.4, Math.min(numeric, 2.2));
}

function clampSceneRotationSpeed(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultCustomThemeSettings.rotationSpeed;
  return Math.max(0, Math.min(numeric, 2));
}

function clampRotationInterval(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultThemeRotationSettings.intervalSeconds;
  return Math.max(3, Math.min(Math.round(numeric), 300));
}

export function normalizeCustomThemeSettings(value) {
  const legacyValue = value;
  return {
    id: String(value?.id || defaultCustomThemeSettings.id),
    name: String(value?.name || defaultCustomThemeSettings.name).trim() || defaultCustomThemeSettings.name,
    background: normalizeHexColor(value?.background, defaultCustomThemeSettings.background),
    cool: normalizeHexColor(value?.cool, defaultCustomThemeSettings.cool),
    warm: normalizeHexColor(value?.warm, defaultCustomThemeSettings.warm),
    accent: normalizeHexColor(value?.accent, defaultCustomThemeSettings.accent),
    glowIntensity: clampGlowIntensity(value?.glowIntensity),
    rotationSpeed: clampSceneRotationSpeed(value?.rotationSpeed),
    showPlayerPanel: value?.showPlayerPanel === undefined
      ? (legacyValue?.showThemeButton === undefined ? defaultCustomThemeSettings.showPlayerPanel : Boolean(legacyValue.showThemeButton))
      : Boolean(value.showPlayerPanel),
  };
}

function createCustomThemeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `custom-${crypto.randomUUID()}`;
  return `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createCustomThemePreset(seed = {}) {
  return normalizeCustomThemeSettings({
    ...defaultCustomThemeSettings,
    ...seed,
    id: seed.id || createCustomThemeId(),
  });
}

export function readCustomThemeStorage() {
  if (typeof window === 'undefined') return [{ ...defaultCustomThemeSettings }];
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((preset) => normalizeCustomThemeSettings(preset));
    }
    const legacyRaw = window.localStorage.getItem(LEGACY_CUSTOM_THEME_STORAGE_KEY);
    const legacyPreset = legacyRaw ? normalizeCustomThemeSettings(JSON.parse(legacyRaw)) : defaultCustomThemeSettings;
    return [legacyPreset];
  } catch {
    return [{ ...defaultCustomThemeSettings }];
  }
}

export function writeCustomThemeStorage(settings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(settings.map((preset) => normalizeCustomThemeSettings(preset))));
}

export function readActiveCustomThemeStorage(presets) {
  if (typeof window === 'undefined') return presets[0]?.id || defaultCustomThemeSettings.id;
  const stored = window.localStorage.getItem(ACTIVE_CUSTOM_THEME_STORAGE_KEY) || '';
  return presets.some((preset) => preset.id === stored) ? stored : (presets[0]?.id || defaultCustomThemeSettings.id);
}

export function writeActiveCustomThemeStorage(presetId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_CUSTOM_THEME_STORAGE_KEY, presetId);
}

export function readActiveThemeStorage() {
  if (typeof window === 'undefined') return 'nocturnal';
  const stored = window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || '';
  return stored === CUSTOM_THEME_ID || BUILT_IN_THEME_IDS.includes(stored) ? stored : 'nocturnal';
}

export function writeActiveThemeStorage(themeId) {
  if (typeof window === 'undefined') return;
  if (themeId === CUSTOM_THEME_ID || BUILT_IN_THEME_IDS.includes(themeId)) {
    window.localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, themeId);
  }
}

export function normalizeThemeRotationSettings(value, availableThemeIds) {
  const fallbackThemeIds = availableThemeIds.length ? availableThemeIds : BUILT_IN_THEME_IDS;
  const incomingThemeIds = Array.isArray(value?.themeIds) ? value.themeIds.map(String) : fallbackThemeIds;
  const themeIds = incomingThemeIds.filter((id, index, ids) => fallbackThemeIds.includes(id) && ids.indexOf(id) === index);
  return {
    enabled: Boolean(value?.enabled),
    intervalSeconds: clampRotationInterval(value?.intervalSeconds),
    themeIds: themeIds.length ? themeIds : fallbackThemeIds,
  };
}

export function readThemeRotationStorage(availableThemeIds) {
  if (typeof window === 'undefined') return normalizeThemeRotationSettings(defaultThemeRotationSettings, availableThemeIds);
  try {
    const raw = window.localStorage.getItem(THEME_ROTATION_STORAGE_KEY);
    return normalizeThemeRotationSettings(raw ? JSON.parse(raw) : defaultThemeRotationSettings, availableThemeIds);
  } catch {
    return normalizeThemeRotationSettings(defaultThemeRotationSettings, availableThemeIds);
  }
}

export function writeThemeRotationStorage(settings, availableThemeIds) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_ROTATION_STORAGE_KEY, JSON.stringify(normalizeThemeRotationSettings(settings, availableThemeIds)));
}

export function customThemeToVisual(THREE, settings) {
  const normalized = normalizeCustomThemeSettings(settings);
  const base = new THREE.Color(normalized.background);
  const cool = new THREE.Color(normalized.cool);
  const warm = new THREE.Color(normalized.warm);
  return {
    name: normalized.name,
    id: CUSTOM_THEME_ID,
    accentHex: normalized.accent,
    uBaseColor1: base.clone(),
    uBaseColor2: base.clone().lerp(new THREE.Color(0xffffff), 0.12),
    uCoolCore: cool.clone(),
    uCoolEdge: cool.clone().lerp(base, 0.35),
    uWarmCore: warm.clone(),
    uWarmEdge: warm.clone().lerp(base, 0.35),
    uRippleColor: new THREE.Color(normalized.accent),
    uGlowIntensity: normalized.glowIntensity,
    uRotationSpeed: normalized.rotationSpeed,
    uShowPlayerPanel: normalized.showPlayerPanel,
  };
}

export function builtInThemeToVisual(THREE, themeId) {
  const t = BUILT_IN_THEMES[themeId] || BUILT_IN_THEMES.nocturnal;
  const base = new THREE.Color(t.background);
  return {
    name: t.name,
    id: t.id,
    accentHex: t.ripple,
    uBaseColor1: base.clone(),
    uBaseColor2: base.clone().lerp(new THREE.Color(0xffffff), 0.12),
    uCoolCore: new THREE.Color(t.coolCore),
    uCoolEdge: new THREE.Color(t.coolEdge),
    uWarmCore: new THREE.Color(t.warmCore),
    uWarmEdge: new THREE.Color(t.warmEdge),
    uRippleColor: new THREE.Color(t.ripple),
    uGlowIntensity: t.glowIntensity,
    uRotationSpeed: t.rotationSpeed,
    uShowPlayerPanel: t.showPlayerPanel,
  };
}

export function resolveThemeVisual(THREE, themeId, customThemes, activeCustomThemeId) {
  if (themeId === CUSTOM_THEME_ID) {
    const preset = customThemes.find((p) => p.id === activeCustomThemeId) || customThemes[0];
    return customThemeToVisual(THREE, preset);
  }
  return builtInThemeToVisual(THREE, themeId);
}

export function getAvailableThemeIds(customThemes) {
  return [...BUILT_IN_THEME_IDS, ...customThemes.map((p) => p.id)];
}

export function cycleThemeId(currentThemeId, activeCustomThemeId, customThemes) {
  const ids = getAvailableThemeIds(customThemes);
  const current = currentThemeId === CUSTOM_THEME_ID ? activeCustomThemeId : currentThemeId;
  const index = ids.indexOf(current);
  const next = index >= 0 ? ids[(index + 1) % ids.length] : ids[0];
  if (BUILT_IN_THEME_IDS.includes(next)) return { themeId: next, customId: activeCustomThemeId };
  return { themeId: CUSTOM_THEME_ID, customId: next };
}
