import { t as coreT } from './i18n.js?v=20260624m';

const SETTINGS_ZH = {
  settingsTitle: '设置',
  settingsSub: '触发器、地面均衡、主题与预设',
  settingsClose: '关闭',
  settingsPresetMigration: '预设迁移',
  settingsPresetMigrationNote: '导出或导入触发器、地面均衡、自定义主题和浏览器设置。',
  settingsIncludeCookie: '包含 Cookie',
  settingsExportPreset: '导出预设',
  settingsImportPreset: '导入预设',
  settingsTabPulse: '脉冲',
  settingsTabMeteor: '流星',
  settingsTabGroundEq: '地面均衡',
  settingsTabColor: '自定义主题',
  settingsTabBackground: '视效背景',
  settingsBackgroundTitle: '视效背景',
  settingsBackgroundNote: '控制 3D 视效后面的渐变色。可固定，也可随当前歌曲封面变化。',
  settingsBackgroundMode: '背景模式',
  settingsBackgroundFollowSong: '跟随歌曲封面',
  settingsBackgroundCustom: '固定颜色',
  settingsBackgroundColorTop: '上方颜色',
  settingsBackgroundColorBottom: '下方颜色',
  settingsBackgroundApplied: '背景已更新。',
  settingsTabCookie: '网易 Cookie',
  settingsEnabled: '启用',
  settingsModeAutoBeat: '自动节拍',
  settingsModeAdvanced: '高级',
  settingsSensitivity: '灵敏度',
  settingsCooldown: '冷却',
  settingsStrength: '强度',
  settingsBandStart: '频段起点',
  settingsBandEnd: '频段终点',
  settingsFreqIndex: '频率索引',
  settingsThreshold: '阈值',
  settingsGroundEqTitle: '地面均衡曲线',
  settingsGroundEqNote: '仅影响视觉，不影响实际音频。向上拖增强反应，向下拖减弱。',
  settingsGroundEqReset: '恢复平直',
  settingsGroundEqHint: '左低右高，实时频谱显示在曲线后方。',
  settingsCustomThemeTitle: '自定义主题',
  settingsCustomThemeNote: '内置主题仍可用，在此保存自定义配色后随时应用。',
  settingsNewTheme: '新建主题',
  settingsThemeName: '主题名称',
  settingsBgColor: '背景',
  settingsCoolColor: '冷色',
  settingsWarmColor: '暖色',
  settingsAccentColor: '强调色',
  settingsRotationSpeed: '旋转速度',
  settingsGlowIntensity: '发光强度',
  settingsShowPlayer: '显示播放器卡片',
  settingsUseTheme: '使用此主题',
  settingsCycleTheme: '循环主题',
  settingsAutoRotation: '自动轮换主题',
  settingsEnableRotation: '启用轮换',
  settingsRotationInterval: '间隔（秒）',
  settingsCookieTitle: '网易 Cookie',
  settingsCookieNote: '推荐扫码登录；也可手动粘贴 Cookie。登录信息只保存在本机浏览器。',
  settingsCookieQrTitle: '扫码登录',
  settingsCookieQrNote: '用网易云 App 扫码，成功后会自动保存并同步。',
  settingsCookieQrStart: '开始扫码',
  settingsCookieQrCancel: '取消扫码',
  settingsCookieQrWaiting: '请用网易云 App 扫码',
  settingsCookieQrScanned: '已扫描，请在手机上点确认',
  settingsCookieQrExpired: '二维码已过期，请重新开始',
  settingsCookieQrSuccess: '登录成功',
  settingsCookieQrFail: '扫码失败，请重试',
  settingsCookieManualTitle: '手动粘贴',
  settingsCookieAutoValid: '当前 Cookie 有效',
  settingsCookieAutoInvalid: 'Cookie 已失效，请重新登录',
  settingsCookieAutoMissing: '尚未登录网易云',
  settingsCookieClear: '清除',
  settingsCookieSave: '保存 Cookie',
  settingsCookieSaving: '保存中…',
  settingsCookieSavedValid: 'Cookie 已保存并通过验证。',
  settingsCookieSavedInvalid: 'Cookie 已本地保存，但验证失败。',
  settingsCookieSavedLocal: 'Cookie 已本地保存。',
  settingsCookieCleared: 'Cookie 已清除。',
  settingsVizLoading: '可视化仍在加载…',
  settingsPresetExportWithCookie: '预设已导出（含 Cookie）。',
  settingsPresetExportNoCookie: '预设已导出（不含 Cookie）。',
  settingsPresetExportFail: '导出失败，请重试。',
  settingsPresetImporting: '正在导入预设…',
  settingsPresetImported: '预设导入成功。',
  settingsPresetImportFail: '导入失败。',
  settingsLoadFail: '设置加载失败，请按 Ctrl+F5 刷新页面。',
};

function t(key) {
  const value = window.shilokuI18n?.t?.(key) ?? coreT(key);
  if (value && value !== key) return value;
  return SETTINGS_ZH[key] ?? value;
}
import {
  GROUND_EQ_POINT_COUNT,
  defaultGroundEqCurve,
} from './sonic/ground-eq.js';
import {
  createCustomThemePreset,
  CUSTOM_THEME_ID,
  BUILT_IN_THEME_IDS,
  BUILT_IN_THEMES,
} from './sonic/themes.js';
import {
  createPresetTransferPackage,
  normalizePresetTransferPackage,
  writePresetTransferPackage,
} from './sonic/preset-transfer.js';
import { readNeteaseCookieStorage, writeNeteaseCookieStorage } from './sonic/netease-cookie.js';
import {
  VIZ_BG_MODE_CUSTOM,
  VIZ_BG_MODE_FOLLOW_SONG,
} from './sonic/viz-background.js';
import {
  checkNeteaseQrLogin,
  createNeteaseQrLogin,
  renderNeteaseQrCode,
} from './sonic-netease-api.js?v=20260624u';

const TAB_IDS = ['Pulse', 'Meteor', 'GroundEq', 'Color', 'Background', 'Cookie'];
const TAB_I18N = {
  Pulse: 'settingsTabPulse',
  Meteor: 'settingsTabMeteor',
  GroundEq: 'settingsTabGroundEq',
  Color: 'settingsTabColor',
  Background: 'settingsTabBackground',
  Cookie: 'settingsTabCookie',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function getViz() {
  return window.__shilokuViz || null;
}

function getAccent() {
  const room = document.getElementById('music-room');
  const raw = room ? getComputedStyle(room).getPropertyValue('--aether-accent').trim() : '';
  return raw || '#33d1ff';
}

export function initSonicSettingsPanel({ mount, onClosePanels, syncNeteaseCookie }) {
  if (!mount) return;

  let activeTab = 'Pulse';
  let includeCookieInExport = false;
  let presetStatus = '';

  mount.innerHTML = '';

  const header = el('div', 'sonic-settings-drawer-head');
  header.innerHTML = `
    <div>
      <div class="sonic-settings-drawer-title">${t('settingsTitle')}</div>
      <div class="sonic-settings-drawer-sub">${t('settingsSub')}</div>
    </div>
    <button type="button" class="sonic-settings-close">${t('settingsClose')}</button>
  `;

  const migrateWrap = el('div', 'sonic-settings-migrate');
  const tabsWrap = el('div', 'sonic-settings-tabs');
  const body = el('div', 'sonic-settings-body');

  mount.appendChild(header);
  mount.appendChild(migrateWrap);
  mount.appendChild(tabsWrap);
  mount.appendChild(body);

  const closeBtn = header.querySelector('.sonic-settings-close');

  function setOpen(open) {
    const show = open ?? !mount.classList.contains('show');
    mount.classList.toggle('show', show);
    if (show) {
      onClosePanels?.();
      try {
        render();
      } catch (error) {
        console.error('[sonic-settings] render failed:', error);
        if (body) {
          body.innerHTML = `<div class="sonic-settings-block-note">${t('settingsLoadFail')}</div>`;
        }
      }
    }
    window.syncSidebarNavState?.();
    window.syncMusicPanelBackdrop?.();
  }

  function renderMigrate() {
    migrateWrap.innerHTML = '';
    const box = el('div', 'sonic-settings-block');
    box.innerHTML = `
      <div class="sonic-settings-block-title">${t('settingsPresetMigration')}</div>
      <div class="sonic-settings-block-note">${t('settingsPresetMigrationNote')}</div>
      <div class="sonic-settings-actions sonic-settings-migrate-actions">
        <label class="sonic-settings-check"><input type="checkbox" data-cookie-export> ${t('settingsIncludeCookie')}</label>
        <button type="button" data-export-preset>${t('settingsExportPreset')}</button>
        <button type="button" data-import-preset class="ghost">${t('settingsImportPreset')}</button>
        <input type="file" accept="application/json,.json" hidden data-import-file>
      </div>
      <div class="sonic-settings-status" data-preset-status></div>
    `;
    migrateWrap.appendChild(box);
    const cookieBox = box.querySelector('[data-cookie-export]');
    cookieBox.checked = includeCookieInExport;
    cookieBox.addEventListener('change', () => {
      includeCookieInExport = cookieBox.checked;
    });
    box.querySelector('[data-export-preset]').addEventListener('click', () => {
      try {
        const presetPackage = createPresetTransferPackage({ includeNeteaseCookie: includeCookieInExport });
        const blob = new Blob([JSON.stringify(presetPackage, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        link.href = url;
        link.download = `sonic-topography-presets-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        presetStatus = includeCookieInExport
          ? t('settingsPresetExportWithCookie')
          : t('settingsPresetExportNoCookie');
      } catch {
        presetStatus = t('settingsPresetExportFail');
      }
      renderMigrateStatus();
    });
    const fileInput = box.querySelector('[data-import-file]');
    box.querySelector('[data-import-preset]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        presetStatus = t('settingsPresetImporting');
        renderMigrateStatus();
        const text = await file.text();
        const parsed = normalizePresetTransferPackage(JSON.parse(text));
        writePresetTransferPackage(parsed);
        getViz()?.reloadSonicSettingsFromStorage?.();
        presetStatus = t('settingsPresetImported');
        render();
      } catch (error) {
        presetStatus = error instanceof Error ? error.message : t('settingsPresetImportFail');
      }
      renderMigrateStatus();
    });
    renderMigrateStatus();
  }

  function renderMigrateStatus() {
    const statusEl = migrateWrap.querySelector('[data-preset-status]');
    if (statusEl) statusEl.textContent = presetStatus;
  }

  function renderTabs() {
    tabsWrap.innerHTML = '';
    TAB_IDS.forEach((tabId) => {
      const btn = el('button', `sonic-settings-tab${activeTab === tabId ? ' is-active' : ''}`, t(TAB_I18N[tabId]));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        activeTab = tabId;
        render();
      });
      tabsWrap.appendChild(btn);
    });
  }

  function renderTriggerTab(action) {
    const viz = getViz();
    const config = action === 'Pulse' ? viz?.analyzer?.pulseTrigger : viz?.analyzer?.meteorTrigger;
    if (!config) {
      body.innerHTML = `<div class="sonic-settings-block-note">${t('settingsVizLoading')}</div>`;
      return;
    }

    body.innerHTML = '';
    const block = el('div', 'sonic-settings-block');
    block.innerHTML = `
      <div class="sonic-settings-row">
        <label class="sonic-settings-check"><input type="checkbox" data-enabled ${config.enabled ? 'checked' : ''}> ${t('settingsEnabled')}</label>
        <select data-mode>
          <option value="Auto Beat" ${config.mode === 'Auto Beat' ? 'selected' : ''}>${t('settingsModeAutoBeat')}</option>
          <option value="Advanced" ${config.mode === 'Advanced' ? 'selected' : ''}>${t('settingsModeAdvanced')}</option>
        </select>
      </div>
      <div class="sonic-settings-grid">
        <label>${t('settingsSensitivity')} <input type="range" min="0" max="1" step="0.01" value="${config.sensitivity}" data-sensitivity></label>
        <label>${t('settingsCooldown')} <input type="range" min="0" max="300" step="1" value="${config.cooldown}" data-cooldown></label>
        <label>${t('settingsStrength')} <input type="range" min="0" max="5" step="0.01" value="${config.pulseStrength}" data-strength></label>
        <label>${t('settingsBandStart')} <input type="range" min="0" max="250" step="1" value="${config.bandStart}" data-band-start></label>
        <label>${t('settingsBandEnd')} <input type="range" min="2" max="256" step="1" value="${config.bandEnd}" data-band-end></label>
      </div>
      <div class="sonic-settings-grid advanced-only">
        <label>${t('settingsFreqIndex')} <input type="range" min="0" max="511" step="1" value="${Math.max(0, config.freqIndex)}" data-freq-index></label>
        <label>${t('settingsThreshold')} <input type="range" min="0" max="1" step="0.01" value="${config.threshold}" data-threshold></label>
      </div>
    `;
    body.appendChild(block);

    const sync = () => {
      config.enabled = block.querySelector('[data-enabled]').checked;
      config.mode = block.querySelector('[data-mode]').value;
      config.sensitivity = Number(block.querySelector('[data-sensitivity]').value);
      config.cooldown = Number(block.querySelector('[data-cooldown]').value);
      config.pulseStrength = Number(block.querySelector('[data-strength]').value);
      config.bandStart = Number(block.querySelector('[data-band-start]').value);
      config.bandEnd = Number(block.querySelector('[data-band-end]').value);
      config.freqIndex = Number(block.querySelector('[data-freq-index]').value);
      config.threshold = Number(block.querySelector('[data-threshold]').value);
      block.querySelector('.advanced-only').style.display = config.mode === 'Advanced' ? 'grid' : 'none';
      viz?.persistTriggerSettings?.();
    };

    block.querySelectorAll('input, select').forEach((input) => input.addEventListener('input', sync));
    block.querySelector('[data-mode]').addEventListener('change', sync);
    sync();
  }

  function renderGroundEqTab() {
    const viz = getViz();
    const settings = viz?.getGroundEqSettings?.() || { curve: [...defaultGroundEqCurve] };
    body.innerHTML = '';
    const block = el('div', 'sonic-settings-block');
    block.innerHTML = `
      <div class="sonic-settings-block-head">
        <div>
          <div class="sonic-settings-block-title">${t('settingsGroundEqTitle')}</div>
          <div class="sonic-settings-block-note">${t('settingsGroundEqNote')}</div>
        </div>
        <button type="button" class="sonic-settings-close ghost" data-reset-eq>${t('settingsGroundEqReset')}</button>
      </div>
      <canvas class="sonic-eq-canvas" width="760" height="220"></canvas>
      <div class="sonic-settings-block-note">${t('settingsGroundEqHint')}</div>
    `;
    body.appendChild(block);

    const canvas = block.querySelector('.sonic-eq-canvas');
    const ctx = canvas.getContext('2d');
    let draftCurve = [...settings.curve];
    let dragging = false;

    const commit = () => {
      viz?.setGroundEqSettings?.({ curve: [...draftCurve] });
    };

    const draw = () => {
      requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, width, height);

      const spectrum = viz?.getRawFrequencyData?.() || [];
      const binCount = spectrum.length || 1;
      const accent = getAccent();
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 2) {
        const unit = width <= 0 ? 0 : x / width;
        const bin = Math.min(binCount - 1, Math.floor(unit * unit * (binCount - 1)));
        const value = (spectrum[bin] || 0) / 255;
        ctx.lineTo(x, height - Math.pow(value, 0.72) * height * 0.84);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = `${accent}24`;
      ctx.fill();

      const points = draftCurve.map((value, index) => ({
        x: (index / (GROUND_EQ_POINT_COUNT - 1)) * width,
        y: height - (value / 100) * height,
      }));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      points.forEach((point) => {
        ctx.beginPath();
        ctx.fillStyle = accent;
        ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    draw();

    const updateFromEvent = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const targetIndex = Math.round(x * (GROUND_EQ_POINT_COUNT - 1));
      draftCurve = draftCurve.map((value, index) => (
        index === targetIndex ? Math.round((1 - y) * 100) : value
      ));
      commit();
    };

    canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      updateFromEvent(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      updateFromEvent(event);
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    block.querySelector('[data-reset-eq]').addEventListener('click', () => {
      draftCurve = [...defaultGroundEqCurve];
      commit();
    });
  }

  function renderColorTab() {
    const viz = getViz();
    const state = viz?.getThemeState?.();
    if (!state) {
      body.innerHTML = `<div class="sonic-settings-block-note">${t('settingsVizLoading')}</div>`;
      return;
    }

    const activePreset = state.customThemes.find((p) => p.id === state.activeCustomThemeId) || state.customThemes[0];
    body.innerHTML = '';
    const block = el('div', 'sonic-settings-block');

    const rotationItems = [
      ...BUILT_IN_THEME_IDS.map((id) => ({ id, name: BUILT_IN_THEMES[id].name })),
      ...state.customThemes.map((p) => ({ id: p.id, name: p.name })),
    ];

    block.innerHTML = `
      <div class="sonic-settings-block-head">
        <div>
          <div class="sonic-settings-block-title">${t('settingsCustomThemeTitle')}</div>
          <div class="sonic-settings-block-note">${t('settingsCustomThemeNote')}</div>
        </div>
        <button type="button" class="sonic-settings-close" data-add-theme>${t('settingsNewTheme')}</button>
      </div>
      <label>${t('settingsThemeName')} <input type="text" value="${activePreset.name}" data-theme-name></label>
      <div class="sonic-settings-grid">
        <label>${t('settingsBgColor')} <input type="color" value="${activePreset.background}" data-color="background"></label>
        <label>${t('settingsCoolColor')} <input type="color" value="${activePreset.cool}" data-color="cool"></label>
        <label>${t('settingsWarmColor')} <input type="color" value="${activePreset.warm}" data-color="warm"></label>
        <label>${t('settingsAccentColor')} <input type="color" value="${activePreset.accent}" data-color="accent"></label>
      </div>
      <label>${t('settingsRotationSpeed')} <input type="range" min="0" max="2" step="0.05" value="${activePreset.rotationSpeed}" data-rotation-speed></label>
      <label>${t('settingsGlowIntensity')} <input type="range" min="0.4" max="2.2" step="0.05" value="${activePreset.glowIntensity}" data-glow-intensity></label>
      <label class="sonic-settings-check"><input type="checkbox" data-show-player ${activePreset.showPlayerPanel ? 'checked' : ''}> ${t('settingsShowPlayer')}</label>
      <div class="sonic-settings-actions">
        <button type="button" class="ghost" data-use-theme>${t('settingsUseTheme')}</button>
        <button type="button" data-cycle-theme>${t('settingsCycleTheme')}</button>
      </div>
      <div class="sonic-settings-block-title">${t('settingsAutoRotation')}</div>
      <label class="sonic-settings-check"><input type="checkbox" data-rotation-enabled ${state.themeRotation.enabled ? 'checked' : ''}> ${t('settingsEnableRotation')}</label>
      <label>${t('settingsRotationInterval')} <input type="range" min="3" max="120" step="1" value="${state.themeRotation.intervalSeconds}" data-rotation-interval></label>
      <div class="sonic-settings-theme-list" data-rotation-list></div>
    `;
    body.appendChild(block);

    const updatePreset = (patch) => {
      const next = state.customThemes.map((preset) => (
        preset.id === activePreset.id ? { ...preset, ...patch } : preset
      ));
      viz.setCustomThemes(next, activePreset.id);
    };

    block.querySelector('[data-theme-name]').addEventListener('input', (event) => {
      updatePreset({ name: event.target.value });
    });
    block.querySelectorAll('[data-color]').forEach((input) => {
      input.addEventListener('input', () => updatePreset({ [input.dataset.color]: input.value }));
    });
    block.querySelector('[data-rotation-speed]').addEventListener('input', (event) => {
      updatePreset({ rotationSpeed: Number(event.target.value) });
    });
    block.querySelector('[data-glow-intensity]').addEventListener('input', (event) => {
      updatePreset({ glowIntensity: Number(event.target.value) });
    });
    block.querySelector('[data-show-player]').addEventListener('change', (event) => {
      updatePreset({ showPlayerPanel: event.target.checked });
    });
    block.querySelector('[data-use-theme]').addEventListener('click', () => {
      viz.applyThemeState(CUSTOM_THEME_ID, activePreset.id);
    });
    block.querySelector('[data-cycle-theme]').addEventListener('click', () => viz.cycleTheme());
    block.querySelector('[data-add-theme]').addEventListener('click', () => {
      const nextPreset = createCustomThemePreset({ name: `${t('settingsCustomThemeTitle')} ${state.customThemes.length + 1}` });
      viz.setCustomThemes([...state.customThemes, nextPreset], nextPreset.id);
      render();
    });

    const rotationList = block.querySelector('[data-rotation-list]');
    rotationItems.forEach((item) => {
      const btn = el('button', `sonic-theme-chip${state.themeRotation.themeIds.includes(item.id) ? ' is-active' : ''}`, item.name);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        const selected = state.themeRotation.themeIds.includes(item.id);
        const nextIds = selected
          ? state.themeRotation.themeIds.filter((id) => id !== item.id)
          : [...state.themeRotation.themeIds, item.id];
        viz.setThemeRotation({ ...state.themeRotation, themeIds: nextIds });
        render();
      });
      rotationList.appendChild(btn);
    });

    block.querySelector('[data-rotation-enabled]').addEventListener('change', (event) => {
      viz.setThemeRotation({ ...state.themeRotation, enabled: event.target.checked });
    });
    block.querySelector('[data-rotation-interval]').addEventListener('input', (event) => {
      viz.setThemeRotation({ ...state.themeRotation, intervalSeconds: Number(event.target.value) });
    });
  }

  function renderBackgroundTab() {
    const viz = getViz();
    const settings = viz?.getVizBackgroundSettings?.();
    if (!settings) {
      body.innerHTML = `<div class="sonic-settings-block-note">${t('settingsVizLoading')}</div>`;
      return;
    }

    body.innerHTML = '';
    const block = el('div', 'sonic-settings-block');
    block.innerHTML = `
      <div class="sonic-settings-block-title">${t('settingsBackgroundTitle')}</div>
      <div class="sonic-settings-block-note">${t('settingsBackgroundNote')}</div>
      <label>${t('settingsBackgroundMode')}
        <select data-bg-mode>
          <option value="${VIZ_BG_MODE_FOLLOW_SONG}">${t('settingsBackgroundFollowSong')}</option>
          <option value="${VIZ_BG_MODE_CUSTOM}">${t('settingsBackgroundCustom')}</option>
        </select>
      </label>
      <div class="sonic-settings-grid" data-bg-custom>
        <label>${t('settingsBackgroundColorTop')} <input type="color" data-bg-color-top></label>
        <label>${t('settingsBackgroundColorBottom')} <input type="color" data-bg-color-bottom></label>
      </div>
      <div class="sonic-settings-status" data-bg-status></div>
    `;
    body.appendChild(block);

    const modeSelect = block.querySelector('[data-bg-mode]');
    const customWrap = block.querySelector('[data-bg-custom]');
    const topInput = block.querySelector('[data-bg-color-top]');
    const bottomInput = block.querySelector('[data-bg-color-bottom]');
    const statusEl = block.querySelector('[data-bg-status]');

    modeSelect.value = settings.mode;
    topInput.value = settings.color;
    bottomInput.value = settings.color2;

    const syncCustomVisibility = () => {
      customWrap.style.display = modeSelect.value === VIZ_BG_MODE_CUSTOM ? 'grid' : 'none';
    };

    const commit = async () => {
      const next = {
        mode: modeSelect.value,
        color: topInput.value,
        color2: bottomInput.value,
      };
      viz?.setVizBackgroundSettings?.(next);
      statusEl.textContent = t('settingsBackgroundApplied');
      if (next.mode === VIZ_BG_MODE_FOLLOW_SONG) {
        const song = window.__shilokuCurrentSong?.();
        const cover = song?.cover;
        if (cover) await viz?.applyVizBackgroundFromCover?.(cover);
      }
    };

    modeSelect.addEventListener('change', () => {
      syncCustomVisibility();
      commit();
    });
    topInput.addEventListener('input', commit);
    bottomInput.addEventListener('input', commit);
    syncCustomVisibility();
  }

  function renderCookieTab() {
    const prev = body.querySelector('.sonic-settings-block');
    if (prev?.__cookieStatusCleanup) prev.__cookieStatusCleanup();
    body.innerHTML = '';
    const block = el('div', 'sonic-settings-block');
    const current = window.__shilokuNeteaseCookieStatus || {};
    const statusHint = current.valid
      ? `${t('settingsCookieAutoValid')}${current.nickname ? `（${current.nickname}）` : ''}`
      : (current.hasCookie ? t('settingsCookieAutoInvalid') : t('settingsCookieAutoMissing'));

    block.innerHTML = `
      <div class="sonic-settings-block-title">${t('settingsCookieTitle')}</div>
      <div class="sonic-settings-block-note">${t('settingsCookieNote')}</div>
      <div class="sonic-settings-status" data-cookie-auto-status>${statusHint}</div>
      <div class="sonic-settings-block-title">${t('settingsCookieQrTitle')}</div>
      <div class="sonic-settings-block-note">${t('settingsCookieQrNote')}</div>
      <div class="sonic-settings-actions">
        <button type="button" data-qr-start>${t('settingsCookieQrStart')}</button>
        <button type="button" class="ghost" data-qr-cancel hidden>${t('settingsCookieQrCancel')}</button>
      </div>
      <div class="sonic-cookie-qr-panel" data-qr-panel hidden>
        <img class="sonic-cookie-qr-img" data-qr-img alt="网易云登录二维码">
        <div class="sonic-settings-status" data-qr-status></div>
      </div>
      <div class="sonic-settings-block-title">${t('settingsCookieManualTitle')}</div>
      <textarea class="sonic-cookie-input" rows="6" spellcheck="false" placeholder="MUSIC_U=...; __csrf=...;"></textarea>
      <div class="sonic-settings-actions">
        <button type="button" class="ghost" data-clear-cookie>${t('settingsCookieClear')}</button>
        <button type="button" data-save-cookie>${t('settingsCookieSave')}</button>
      </div>
      <div class="sonic-settings-status" data-cookie-status></div>
    `;
    body.appendChild(block);

    const textarea = block.querySelector('.sonic-cookie-input');
    const autoStatusEl = block.querySelector('[data-cookie-auto-status]');
    const qrPanel = block.querySelector('[data-qr-panel]');
    const qrImg = block.querySelector('[data-qr-img]');
    const qrStatus = block.querySelector('[data-qr-status]');
    const qrStartBtn = block.querySelector('[data-qr-start]');
    const qrCancelBtn = block.querySelector('[data-qr-cancel]');
    textarea.value = readNeteaseCookieStorage();

    let qrTimer = null;
    let qrActive = false;

    const updateAutoStatus = (detail = window.__shilokuNeteaseCookieStatus || {}) => {
      autoStatusEl.textContent = detail.valid
        ? `${t('settingsCookieAutoValid')}${detail.nickname ? `（${detail.nickname}）` : ''}`
        : (detail.hasCookie ? t('settingsCookieAutoInvalid') : t('settingsCookieAutoMissing'));
    };

    const stopQr = () => {
      qrActive = false;
      if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
      }
      qrPanel.hidden = true;
      qrCancelBtn.hidden = true;
      qrStartBtn.disabled = false;
    };

    const startQr = async () => {
      stopQr();
      qrStartBtn.disabled = true;
      qrStatus.textContent = '…';
      qrPanel.hidden = false;
      qrCancelBtn.hidden = false;
      try {
        const session = await createNeteaseQrLogin();
        if (!session?.qrUrl) throw new Error(t('settingsCookieQrFail'));
        await renderNeteaseQrCode(qrImg, session.qrUrl);
        qrStatus.textContent = t('settingsCookieQrWaiting');
        qrActive = true;
        qrTimer = setInterval(async () => {
          if (!qrActive) return;
          try {
            const result = await checkNeteaseQrLogin(session.key);
            if (result.waiting) qrStatus.textContent = t('settingsCookieQrWaiting');
            if (result.scanned) qrStatus.textContent = t('settingsCookieQrScanned');
            if (result.expired) {
              qrStatus.textContent = t('settingsCookieQrExpired');
              stopQr();
              return;
            }
            if (result.code === 800 && result.cookie) {
              textarea.value = result.cookie;
              writeNeteaseCookieStorage(result.cookie);
              if (typeof syncNeteaseCookie === 'function') {
                await syncNeteaseCookie(result.cookie);
              }
              qrStatus.textContent = `${t('settingsCookieQrSuccess')}${result.nickname ? `：${result.nickname}` : ''}`;
              updateAutoStatus({ valid: true, hasCookie: true, nickname: result.nickname || '' });
              block.querySelector('[data-cookie-status]').textContent = t('settingsCookieSavedValid');
              window.refreshNeteaseCloudAvailability?.();
              stopQr();
            }
          } catch (error) {
            qrStatus.textContent = error?.message || t('settingsCookieQrFail');
            stopQr();
          }
        }, 2000);
      } catch (error) {
        qrStatus.textContent = error?.message || t('settingsCookieQrFail');
        stopQr();
      }
    };

    qrStartBtn.addEventListener('click', startQr);
    qrCancelBtn.addEventListener('click', stopQr);

    block.querySelector('[data-save-cookie]').addEventListener('click', async () => {
      writeNeteaseCookieStorage(textarea.value);
      const statusEl = block.querySelector('[data-cookie-status]');
      statusEl.textContent = t('settingsCookieSaving');
      if (typeof syncNeteaseCookie === 'function') {
        const result = await syncNeteaseCookie(textarea.value);
        statusEl.textContent = result.valid
          ? t('settingsCookieSavedValid')
          : t('settingsCookieSavedInvalid');
        updateAutoStatus({ valid: result.valid, hasCookie: Boolean(textarea.value.trim()), nickname: result.data?.nickname || '' });
      } else {
        statusEl.textContent = t('settingsCookieSavedLocal');
      }
      window.refreshNeteaseCloudAvailability?.();
    });
    block.querySelector('[data-clear-cookie]').addEventListener('click', async () => {
      textarea.value = '';
      writeNeteaseCookieStorage('');
      block.querySelector('[data-cookie-status]').textContent = t('settingsCookieCleared');
      updateAutoStatus({ valid: false, hasCookie: false });
      if (typeof syncNeteaseCookie === 'function') {
        await syncNeteaseCookie('');
      }
      window.refreshNeteaseCloudAvailability?.();
    });

    const onCookieStatus = (event) => updateAutoStatus(event.detail || {});
    window.addEventListener('shiloku:netease-cookie', onCookieStatus);
    block.__cookieStatusCleanup = () => {
      stopQr();
      window.removeEventListener('shiloku:netease-cookie', onCookieStatus);
    };
  }

  function render() {
    header.querySelector('.sonic-settings-drawer-title').textContent = t('settingsTitle');
    header.querySelector('.sonic-settings-drawer-sub').textContent = t('settingsSub');
    closeBtn.textContent = t('settingsClose');
    renderMigrate();
    renderTabs();
    if (activeTab === 'GroundEq') renderGroundEqTab();
    else if (activeTab === 'Color') renderColorTab();
    else if (activeTab === 'Background') renderBackgroundTab();
    else if (activeTab === 'Cookie') renderCookieTab();
    else renderTriggerTab(activeTab);
  }

  closeBtn.addEventListener('click', () => setOpen(false));

  window.addEventListener('shiloku:langchange', () => {
    if (mount.classList.contains('show')) render();
  });

  window.toggleSonicSettingsPanel = (open) => {
    if (open === undefined) setOpen(!mount.classList.contains('show'));
    else setOpen(open);
  };
  window.__sonicSettingsRender = render;

  return { setOpen };
}
