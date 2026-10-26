import { t as coreT } from './i18n.js?v=20260624m';

const SETTINGS_ZH = {
  settingsTitle: '设置',
  settingsSub: '触发器、地面均衡、主题与预设',
  settingsClose: '关闭',
  settingsPresetMigration: '预设迁移',
  settingsPresetMigrationNote: '导出或导入触发器、地面均衡、自定义主题和浏览器设置。',
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
  settingsVizLoading: '可视化仍在加载…',
  settingsPresetExportNoCookie: '预设已导出。',
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
} from './sonic/preset-transfer.js?v=20261026owner1';
import {
  VIZ_BG_MODE_CUSTOM,
  VIZ_BG_MODE_FOLLOW_SONG,
} from './sonic/viz-background.js';

const TAB_IDS = ['Pulse', 'Meteor', 'GroundEq', 'Color', 'Background'];
const TAB_I18N = {
  Pulse: 'settingsTabPulse',
  Meteor: 'settingsTabMeteor',
  GroundEq: 'settingsTabGroundEq',
  Color: 'settingsTabColor',
  Background: 'settingsTabBackground',
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

export function initSonicSettingsPanel({ mount, onClosePanels }) {
  if (!mount) return;

  let activeTab = 'Pulse';
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
        <button type="button" data-export-preset>${t('settingsExportPreset')}</button>
        <button type="button" data-import-preset class="ghost">${t('settingsImportPreset')}</button>
        <input type="file" accept="application/json,.json" hidden data-import-file>
      </div>
      <div class="sonic-settings-status" data-preset-status></div>
    `;
    migrateWrap.appendChild(box);
    box.querySelector('[data-export-preset]').addEventListener('click', () => {
      try {
        const presetPackage = createPresetTransferPackage();
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
        presetStatus = t('settingsPresetExportNoCookie');
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

  function render() {
    header.querySelector('.sonic-settings-drawer-title').textContent = t('settingsTitle');
    header.querySelector('.sonic-settings-drawer-sub').textContent = t('settingsSub');
    closeBtn.textContent = t('settingsClose');
    renderMigrate();
    renderTabs();
    if (activeTab === 'GroundEq') renderGroundEqTab();
    else if (activeTab === 'Color') renderColorTab();
    else if (activeTab === 'Background') renderBackgroundTab();
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
