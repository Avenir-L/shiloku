import {
  ACTIVE_CUSTOM_THEME_STORAGE_KEY,
  ACTIVE_THEME_STORAGE_KEY,
  BUILT_IN_THEME_IDS,
  CUSTOM_THEME_ID,
  CUSTOM_THEME_STORAGE_KEY,
  THEME_ROTATION_STORAGE_KEY,
  defaultCustomThemeSettings,
  defaultThemeRotationSettings,
  normalizeCustomThemeSettings,
  normalizeThemeRotationSettings,
} from './themes.js';
import { GROUND_EQ_STORAGE_KEY, normalizeGroundEqSettings } from './ground-eq.js';
import { VIZ_BACKGROUND_STORAGE_KEY, normalizeVizBackgroundSettings } from './viz-background.js';
import { TRIGGER_SETTINGS_STORAGE_KEY, normalizeTriggerConfig } from './trigger-settings.js';
import { NETEASE_COOKIE_STORAGE_KEY, normalizeNeteaseCookie } from './netease-cookie.js';

export const PRESET_TRANSFER_VERSION = 1;
export const PLAYLIST_STORAGE_KEY = 'sonic-topography-playlists-v1';

function readJsonStorage(key) {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(key);
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function normalizeSong(value) {
  const id = Number(value?.id);
  const name = String(value?.name || '').trim();
  if (!Number.isFinite(id) || !name) return null;
  return {
    id,
    name,
    artist: String(value?.artist || ''),
    album: String(value?.album || ''),
    duration: Number.isFinite(Number(value?.duration)) ? Number(value.duration) : 0,
    fee: Number.isFinite(Number(value?.fee)) ? Number(value.fee) : 0,
  };
}

export function normalizeTransferPlaylists(value) {
  if (!Array.isArray(value)) {
    return [{ id: 'favorites', name: 'Favorites', songs: [] }];
  }
  const playlists = value.map((playlist, index) => {
    const songs = Array.isArray(playlist?.songs)
      ? playlist.songs.map(normalizeSong).filter(Boolean)
      : [];
    return {
      id: String(playlist?.id || `playlist-${Date.now()}-${index}`),
      name: String(playlist?.name || 'Playlist'),
      songs,
    };
  });
  if (!playlists.some((playlist) => playlist.id === 'favorites')) {
    playlists.unshift({ id: 'favorites', name: 'Favorites', songs: [] });
  }
  return playlists;
}

function normalizeActiveThemeId(value) {
  const themeId = String(value || '');
  return themeId === CUSTOM_THEME_ID || BUILT_IN_THEME_IDS.includes(themeId) ? themeId : 'nocturnal';
}

function normalizeActiveCustomThemeId(value, customThemes) {
  const presetId = String(value || '');
  return customThemes.some((preset) => preset.id === presetId)
    ? presetId
    : (customThemes[0]?.id || defaultCustomThemeSettings.id);
}

function normalizeTriggerSettings(value) {
  return {
    Pulse: normalizeTriggerConfig(value?.Pulse),
    Meteor: normalizeTriggerConfig(value?.Meteor),
  };
}

export function normalizePresetTransferPackage(value) {
  const input = value;
  if (!input || input.app !== 'sonic-topography' || input.version !== PRESET_TRANSFER_VERSION || !input.data) {
    throw new Error('This file is not a valid Sonic Topography preset package.');
  }

  const customThemesRaw = Array.isArray(input.data.customThemes) && input.data.customThemes.length > 0
    ? input.data.customThemes
    : [defaultCustomThemeSettings];
  const customThemes = customThemesRaw.map((preset) => normalizeCustomThemeSettings(preset));
  const activeCustomThemeId = normalizeActiveCustomThemeId(input.data.activeCustomThemeId, customThemes);
  const availableThemeIds = [...BUILT_IN_THEME_IDS, ...customThemes.map((preset) => preset.id)];

  const normalized = {
    app: 'sonic-topography',
    version: PRESET_TRANSFER_VERSION,
    exportedAt: String(input.exportedAt || new Date().toISOString()),
    data: {
      playlists: normalizeTransferPlaylists(input.data.playlists),
      triggerSettings: normalizeTriggerSettings(input.data.triggerSettings),
      groundEqSettings: normalizeGroundEqSettings(input.data.groundEqSettings),
      customThemes,
      activeCustomThemeId,
      activeThemeId: normalizeActiveThemeId(input.data.activeThemeId),
      themeRotation: normalizeThemeRotationSettings(input.data.themeRotation || defaultThemeRotationSettings, availableThemeIds),
      vizBackgroundSettings: normalizeVizBackgroundSettings(input.data.vizBackgroundSettings),
    },
  };

  const cookie = normalizeNeteaseCookie(input.data.neteaseCookie);
  if (cookie) normalized.data.neteaseCookie = cookie;
  return normalized;
}

export function createPresetTransferPackage(options = {}) {
  const customThemes = (readJsonStorage(CUSTOM_THEME_STORAGE_KEY) || []).map((preset) => normalizeCustomThemeSettings(preset))
    || [defaultCustomThemeSettings];
  const activeCustomThemeId = normalizeActiveCustomThemeId(
    typeof window === 'undefined' ? '' : window.localStorage.getItem(ACTIVE_CUSTOM_THEME_STORAGE_KEY),
    customThemes,
  );
  const availableThemeIds = [...BUILT_IN_THEME_IDS, ...customThemes.map((preset) => preset.id)];
  const activeThemeId = normalizeActiveThemeId(typeof window === 'undefined' ? '' : window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY));

  const presetPackage = {
    app: 'sonic-topography',
    version: PRESET_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      playlists: normalizeTransferPlaylists(readJsonStorage(PLAYLIST_STORAGE_KEY)),
      triggerSettings: normalizeTriggerSettings(readJsonStorage(TRIGGER_SETTINGS_STORAGE_KEY)),
      groundEqSettings: normalizeGroundEqSettings(readJsonStorage(GROUND_EQ_STORAGE_KEY)),
      customThemes,
      activeCustomThemeId,
      activeThemeId,
      themeRotation: normalizeThemeRotationSettings(readJsonStorage(THEME_ROTATION_STORAGE_KEY) || defaultThemeRotationSettings, availableThemeIds),
      vizBackgroundSettings: normalizeVizBackgroundSettings(readJsonStorage(VIZ_BACKGROUND_STORAGE_KEY)),
    },
  };

  if (options.includeNeteaseCookie && typeof window !== 'undefined') {
    const cookie = normalizeNeteaseCookie(window.localStorage.getItem(NETEASE_COOKIE_STORAGE_KEY));
    if (cookie) presetPackage.data.neteaseCookie = cookie;
  }

  return normalizePresetTransferPackage(presetPackage);
}

export function writePresetTransferPackage(presetPackage) {
  if (typeof window === 'undefined') return normalizePresetTransferPackage(presetPackage);
  const normalized = normalizePresetTransferPackage(presetPackage);
  const data = normalized.data;
  window.localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(data.playlists));
  window.localStorage.setItem(TRIGGER_SETTINGS_STORAGE_KEY, JSON.stringify(data.triggerSettings));
  window.localStorage.setItem(GROUND_EQ_STORAGE_KEY, JSON.stringify(data.groundEqSettings));
  window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(data.customThemes));
  window.localStorage.setItem(ACTIVE_CUSTOM_THEME_STORAGE_KEY, data.activeCustomThemeId);
  window.localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, data.activeThemeId);
  window.localStorage.setItem(THEME_ROTATION_STORAGE_KEY, JSON.stringify(data.themeRotation));
  if (data.vizBackgroundSettings) {
    window.localStorage.setItem(VIZ_BACKGROUND_STORAGE_KEY, JSON.stringify(normalizeVizBackgroundSettings(data.vizBackgroundSettings)));
  }
  if (data.neteaseCookie) window.localStorage.setItem(NETEASE_COOKIE_STORAGE_KEY, data.neteaseCookie);
  else window.localStorage.removeItem(NETEASE_COOKIE_STORAGE_KEY);
  return normalized;
}
