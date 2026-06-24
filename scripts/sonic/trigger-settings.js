export const TRIGGER_SETTINGS_STORAGE_KEY = 'sonic-topography-trigger-settings-v1';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function normalizeTriggerConfig(value) {
  if (!value) return {};
  return {
    ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
    ...(value.mode === 'Auto Beat' || value.mode === 'Advanced' ? { mode: value.mode } : {}),
    ...(Number.isFinite(value.freqIndex) ? { freqIndex: Number(value.freqIndex) } : {}),
    ...(Number.isFinite(value.threshold) ? { threshold: clamp(Number(value.threshold), 0, 1) } : {}),
    ...(Number.isFinite(value.sensitivity) ? { sensitivity: clamp(Number(value.sensitivity), 0, 1) } : {}),
    ...(Number.isFinite(value.cooldown) ? { cooldown: Math.max(0, Math.min(300, Math.round(Number(value.cooldown)))) } : {}),
    ...(Number.isFinite(value.bandStart) ? { bandStart: clampInt(Number(value.bandStart), 0, 250) } : {}),
    ...(Number.isFinite(value.bandEnd) ? { bandEnd: clampInt(Number(value.bandEnd), 2, 256) } : {}),
    ...(Number.isFinite(value.pulseStrength) ? { pulseStrength: clamp(Number(value.pulseStrength), 0, 5) } : {}),
  };
}

export function readTriggerSettingsStorage() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TRIGGER_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      Pulse: normalizeTriggerConfig(parsed.Pulse),
      Meteor: normalizeTriggerConfig(parsed.Meteor),
    };
  } catch {
    return {};
  }
}

export function writeTriggerSettingsStorage(settings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TRIGGER_SETTINGS_STORAGE_KEY, JSON.stringify({
    Pulse: normalizeTriggerConfig(settings.Pulse),
    Meteor: normalizeTriggerConfig(settings.Meteor),
  }));
}

export function snapshotTriggerConfig(config) {
  return {
    enabled: config.enabled,
    mode: config.mode,
    freqIndex: config.freqIndex,
    threshold: config.threshold,
    sensitivity: config.sensitivity,
    cooldown: config.cooldown,
    bandStart: config.bandStart,
    bandEnd: config.bandEnd,
    pulseStrength: config.pulseStrength,
  };
}

export function applyStoredTriggerConfig(config, stored) {
  if (!stored) return;
  if (typeof stored.enabled === 'boolean') config.enabled = stored.enabled;
  if (stored.mode === 'Auto Beat' || stored.mode === 'Advanced') config.mode = stored.mode;
  if (Number.isFinite(stored.freqIndex)) config.freqIndex = stored.freqIndex;
  if (Number.isFinite(stored.threshold)) config.threshold = stored.threshold;
  if (Number.isFinite(stored.sensitivity)) config.sensitivity = stored.sensitivity;
  if (Number.isFinite(stored.cooldown)) config.cooldown = stored.cooldown;
  if (Number.isFinite(stored.bandStart)) config.bandStart = stored.bandStart;
  if (Number.isFinite(stored.bandEnd)) config.bandEnd = stored.bandEnd;
  if (Number.isFinite(stored.pulseStrength)) config.pulseStrength = stored.pulseStrength;
}
