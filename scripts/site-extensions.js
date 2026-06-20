/**
 * Shiloku 站点扩展：歌单持久化、分享链接、今日一句、留言、主题、AI 联动
 */
import {
    initI18n, setLang, getLang, t, LANGS, LANG_LABELS,
    getGreetingForHour, formatDateLine, applyI18nDom,
} from './i18n.js';
import {
    setupListeningStatsUI,
    refreshListenStatsUI,
    startListeningSession,
    stopListeningSession,
} from './listening-stats.js';
import {
    getSongKey,
    listCategories,
    getCategoryName,
    getSongCategoryId,
    setSongCategory,
    addCategory,
    renameCategory,
    deleteCategory,
    getFilterTabs,
} from './playlist-categories.js';

const PLAYLIST_KEY = 'shiloku-playlist-v1';
const THEME_KEY = 'shiloku-music-theme';
const GUESTBOOK_LOCAL_KEY = 'shiloku-guestbook-local';

export const MUSIC_THEMES = {
    auto: { labelKey: 'themeAuto', accent: null },
    rose: { labelKey: 'themeRose', accent: [251, 113, 133] },
    cyan: { labelKey: 'themeCyan', accent: [51, 209, 255] },
    violet: { labelKey: 'themeViolet', accent: [167, 139, 250] },
    amber: { labelKey: 'themeAmber', accent: [251, 191, 36] },
    emerald: { labelKey: 'themeEmerald', accent: [52, 211, 153] },
};

const DAILY_QUOTES = [
    '世界はまだ始まったばかり',
    '今日も、音楽と一緒に。',
    'Every day is a new soundtrack.',
    '在旋律里，找到属于自己的节奏。',
    '夜は静か、心は明るい。',
    'Paint the sky with your favorite colors.',
    '摸鱼也是一种艺术。',
    'Hatsune Miku!',
    '地平线の向こうへ。',
    'Cards, music, and quiet nights.',
    '偶尔停下来，听听风的声音。',
    'The best stories are still being written.',
];

/** ---------- 歌单 localStorage ---------- */
export function savePlaylistState(state) {
    try {
        localStorage.setItem(PLAYLIST_KEY, JSON.stringify(state));
    } catch { /* quota */ }
}

export function loadPlaylistState() {
    try {
        const raw = localStorage.getItem(PLAYLIST_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function serializeNeteaseSong(song) {
    return {
        title: song.title,
        artist: song.artist,
        neteaseId: song.neteaseId,
        cover: song.cover || '',
        isNeteaseOnly: true,
    };
}

/** ---------- 分享链接 ---------- */
export function buildShareUrl(song) {
    const url = new URL(location.href);
    url.search = '';
    if (song?.isNeteaseOnly && song.neteaseId) {
        url.searchParams.set('music', `netease:${song.neteaseId}`);
    } else if (song?.neteaseId && !song.isNeteaseOnly) {
        url.searchParams.set('music', `netease:${song.neteaseId}`);
    } else if (typeof song?.localIndex === 'number') {
        url.searchParams.set('music', `local:${song.localIndex}`);
    }
    url.searchParams.set('room', 'music');
    return url.toString();
}

export function parseShareParams() {
    const params = new URLSearchParams(location.search);
    const music = params.get('music') || '';
    const openRoom = params.get('room') === 'music' || Boolean(music);
    if (!music) return { openRoom: false };
    const [kind, id] = music.split(':');
    return { openRoom, kind, id: id ? Number(id) : NaN, raw: music };
}

export function updateShareUrl(song) {
    if (!song) return;
    const url = new URL(location.href);
    if (song.isNeteaseOnly && song.neteaseId) {
        url.searchParams.set('music', `netease:${song.neteaseId}`);
    } else {
        const localIdx = window.__shilokuLocalIndex?.(song);
        if (localIdx >= 0) url.searchParams.set('music', `local:${localIdx}`);
        else if (song.neteaseId) url.searchParams.set('music', `netease:${song.neteaseId}`);
    }
    url.searchParams.set('room', 'music');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export async function copyShareLink(song) {
    const link = buildShareUrl(song);
    try {
        await navigator.clipboard.writeText(link);
        showToast(t('shareCopied'));
        return true;
    } catch {
        showToast(t('shareFailed'));
        return false;
    }
}

/** ---------- 今日一句 ---------- */
function hashDate(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export function getDailyQuote(extraLines = []) {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const pool = [...DAILY_QUOTES, ...extraLines.filter(Boolean)];
    if (!pool.length) return '';
    return pool[hashDate(key) % pool.length];
}

export function refreshDailyQuote(extraLines = []) {
    const el = document.getElementById('daily-quote');
    if (!el) return;
    el.textContent = getDailyQuote(extraLines);
}

/** ---------- 音乐室主题 ---------- */
export function getSavedTheme() {
    return localStorage.getItem(THEME_KEY) || 'auto';
}

export function applyMusicTheme(themeId) {
    const theme = MUSIC_THEMES[themeId] || MUSIC_THEMES.auto;
    localStorage.setItem(THEME_KEY, themeId);
    const room = document.getElementById('music-room');
    if (room) {
        room.dataset.theme = themeId;
        if (theme.accent && typeof window.applySiteAccent === 'function') {
            window.applySiteAccent(theme.accent[0], theme.accent[1], theme.accent[2]);
        } else if (themeId === 'auto') {
            const song = window.__shilokuCurrentSong?.();
            if (song?.cover) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const c = document.createElement('canvas');
                        c.width = 8;
                        c.height = 8;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(img, 0, 0, 8, 8);
                        const d = ctx.getImageData(4, 4, 1, 1).data;
                        window.applySiteAccent?.(d[0], d[1], d[2]);
                    } catch { /* */ }
                };
                img.src = song.cover;
            }
        }
    }
    document.querySelectorAll('[data-theme-id]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.themeId === themeId);
    });
    window.__shilokuThemeAuto = themeId === 'auto';
}

/** ---------- 留言板 ---------- */
async function fetchGuestbookMessages() {
    const local = loadLocalGuestbook();
    try {
        const res = await fetch('/api/guestbook', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('api');
        const data = await res.json();
        const remote = Array.isArray(data.messages) ? data.messages : [];
        const merged = [...remote];
        const ids = new Set(remote.map((m) => m.id));
        local.forEach((m) => { if (!ids.has(m.id)) merged.push(m); });
        merged.sort((a, b) => (b.time || 0) - (a.time || 0));
        return merged.slice(0, 50);
    } catch {
        return local.sort((a, b) => (b.time || 0) - (a.time || 0));
    }
}

function loadLocalGuestbook() {
    try {
        const raw = localStorage.getItem(GUESTBOOK_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalGuestbook(messages) {
    try {
        localStorage.setItem(GUESTBOOK_LOCAL_KEY, JSON.stringify(messages.slice(0, 30)));
    } catch { /* */ }
}

async function submitGuestbook(name, message) {
    const entry = {
        id: `local-${Date.now()}`,
        name: name || '访客',
        message,
        time: Date.now(),
    };
    try {
        const res = await fetch('/api/guestbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: entry.name, message }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.message) {
            return { ok: true, entry: data.message, localOnly: Boolean(data.localOnly) };
        }
    } catch { /* fallback local */ }
    const local = loadLocalGuestbook();
    local.unshift(entry);
    saveLocalGuestbook(local);
    return { ok: true, entry, localOnly: true };
}

function renderGuestbookMessages(messages) {
    const list = document.getElementById('guestbook-messages');
    if (!list) return;
    if (!messages.length) {
        list.innerHTML = `<p class="guestbook-empty">${t('guestbookEmpty')}</p>`;
        return;
    }
    list.innerHTML = messages.map((m) => {
        const d = new Date(m.time || Date.now());
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        const safeName = escapeHtml(m.name || '访客');
        const safeMsg = escapeHtml(m.message || '');
        return `<article class="guestbook-item"><header><strong>${safeName}</strong><time>${dateStr}</time></header><p>${safeMsg}</p></article>`;
    }).join('');
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function setupGuestbook() {
    const panel = document.getElementById('guestbook-panel');
    const toggle = document.getElementById('guestbook-toggle');
    const close = document.getElementById('guestbook-close');
    const form = document.getElementById('guestbook-form');
    if (!panel || !toggle) return;

    toggle.addEventListener('click', async () => {
        panel.classList.toggle('hidden');
        panel.setAttribute('aria-hidden', panel.classList.contains('hidden') ? 'true' : 'false');
        if (!panel.classList.contains('hidden')) {
            renderGuestbookMessages(await fetchGuestbookMessages());
        }
    });
    close?.addEventListener('click', () => {
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('guestbook-name');
        const msgInput = document.getElementById('guestbook-message');
        const msg = msgInput?.value.trim();
        if (!msg) return;
        const result = await submitGuestbook(nameInput?.value.trim(), msg);
        if (result.ok) {
            showToast(result.localOnly ? t('guestbookLocalOnly') : t('guestbookThanks'));
            msgInput.value = '';
            renderGuestbookMessages(await fetchGuestbookMessages());
        }
    });
}

/** ---------- UI 小工具 ---------- */
function showToast(text, ms = 2600) {
    let toast = document.getElementById('shiloku-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'shiloku-toast';
        toast.className = 'shiloku-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove('show'), ms);
}

function setupLangSwitcher() {
    const wrap = document.getElementById('lang-switcher');
    if (!wrap) return;
    wrap.innerHTML = LANGS.map((lang) =>
        `<button type="button" class="lang-btn${lang === getLang() ? ' is-active' : ''}" data-lang="${lang}">${LANG_LABELS[lang]}</button>`,
    ).join('');
    wrap.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            setLang(btn.dataset.lang);
            wrap.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === getLang()));
            if (typeof window.__shilokuRefreshTime === 'function') window.__shilokuRefreshTime();
            refreshDailyQuote(window.__shilokuLyricPool || []);
        });
    });
}

function setupThemePicker() {
    const wrap = document.getElementById('theme-picker');
    const shell = document.getElementById('theme-picker-wrap');
    const toggle = document.getElementById('theme-picker-toggle');
    if (!wrap) return;

    wrap.innerHTML = Object.entries(MUSIC_THEMES).map(([id, theme]) =>
        `<button type="button" class="theme-swatch" data-theme-id="${id}" title="${t(theme.labelKey)}" aria-label="${t(theme.labelKey)}" style="${theme.accent ? `--swatch:${theme.accent.join(',')}` : ''}"></button>`,
    ).join('');

    const setOpen = (open) => {
        if (!shell || !toggle) return;
        shell.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    wrap.querySelectorAll('.theme-swatch').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            applyMusicTheme(btn.dataset.themeId);
            setOpen(false);
        });
    });
    applyMusicTheme(getSavedTheme());

    if (!toggle || !shell) return;

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(!shell.classList.contains('is-open'));
    });

    document.addEventListener('click', (event) => {
        if (!shell.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setOpen(false);
    });
}

function setupShareButton() {
    document.getElementById('share-song-btn')?.addEventListener('click', () => {
        const song = window.__shilokuCurrentSong?.();
        if (song) copyShareLink(song);
    });
}

const LISTENING_PREFIX = '正在听';

function parseListeningLine(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith(LISTENING_PREFIX)) return null;
    const rest = trimmed.slice(LISTENING_PREFIX.length).trim();
    if (!rest) return null;
    const dashIdx = rest.indexOf(' - ');
    if (dashIdx > 0) {
        return { title: rest.slice(0, dashIdx).trim(), artist: rest.slice(dashIdx + 3).trim() };
    }
    return { title: rest, artist: '' };
}

function extractListeningFromPresence(presence) {
    const candidates = [
        presence?.secondary,
        ...(Array.isArray(presence?.lines) ? presence.lines : []),
        presence?.primary,
        presence?.text,
    ].filter(Boolean);
    for (const line of candidates) {
        const parsed = parseListeningLine(line);
        if (parsed) return parsed;
    }
    return null;
}

function getAiNowPlaying() {
    return window.__shilokuRemoteListening || null;
}

function updateAiNowPlayingChip(song = getAiNowPlaying()) {
    const chip = document.getElementById('ai-now-playing');
    if (!chip) return;
    if (song?.title) {
        chip.hidden = false;
        chip.textContent = `${t('aiNowPlaying')}: ${song.title}${song.artist ? ` — ${song.artist}` : ''}`;
    } else {
        chip.hidden = true;
        chip.textContent = '';
    }
}

export function updateRemoteListening(presence) {
    window.__shilokuRemoteListening = extractListeningFromPresence(presence);
    updateAiNowPlayingChip();
    window.dispatchEvent(new CustomEvent('shiloku:listening', {
        detail: { song: window.__shilokuRemoteListening },
    }));
}

function setupAiMusicHooks() {
    document.getElementById('ai-ask-song-btn')?.addEventListener('click', () => {
        const song = getAiNowPlaying();
        if (!song?.title) return;
        const input = document.getElementById('chat-input');
        const q = getLang() === 'en'
            ? `Tell me about "${song.title}" by ${song.artist}`
            : getLang() === 'ja'
                ? `「${song.title}」（${song.artist}）について教えて`
                : `介绍一下《${song.title}》— ${song.artist}`;
        if (input) { input.value = q; input.focus(); }
    });
    document.getElementById('ai-recommend-btn')?.addEventListener('click', () => {
        const song = getAiNowPlaying();
        if (!song?.title) return;
        const input = document.getElementById('chat-input');
        const q = getLang() === 'en'
            ? `Recommend songs similar to "${song.title}" by ${song.artist}`
            : getLang() === 'ja'
                ? `「${song.title}」に似た曲を教えて`
                : `推荐一些和《${song.title}》风格类似的歌`;
        if (input) { input.value = q; input.focus(); }
    });

    window.addEventListener('shiloku:langchange', () => updateAiNowPlayingChip());
    updateAiNowPlayingChip();
}

/** 处理 URL 深链：打开音乐室并播放 */
export async function handleMusicDeepLink(handlers) {
    const { openRoom, kind, id } = parseShareParams();
    if (!openRoom) return false;
    handlers.openMusicRoom?.();
    if (kind === 'netease' && Number.isFinite(id)) {
        await handlers.playNeteaseById?.(id);
        return true;
    }
    if (kind === 'local' && Number.isFinite(id)) {
        await handlers.playLocalAt?.(id);
        return true;
    }
    return openRoom;
}

export function initSiteExtensions() {
    initI18n();
    setupLangSwitcher();
    setupGuestbook();
    setupThemePicker();
    setupShareButton();
    setupAiMusicHooks();
    setupListeningStatsUI();
    refreshDailyQuote();

    window.addEventListener('shiloku:langchange', () => refreshListenStatsUI());

    window.shilokuI18n = { t, getLang, setLang, getGreetingForHour, formatDateLine, applyI18nDom };
    window.shilokuSavePlaylist = savePlaylistState;
    window.shilokuLoadPlaylist = loadPlaylistState;
    window.shilokuSerializeNetease = serializeNeteaseSong;
    window.shilokuUpdateShareUrl = updateShareUrl;
    window.shilokuCopyShareLink = copyShareLink;
    window.shilokuRefreshDailyQuote = refreshDailyQuote;
    window.shilokuApplyMusicTheme = applyMusicTheme;
    window.shilokuGetSavedTheme = getSavedTheme;
    window.shilokuHandleDeepLink = handleMusicDeepLink;
    window.shilokuUpdateRemoteListening = updateRemoteListening;
    window.__shilokuAiNowPlaying = getAiNowPlaying;
    window.__shilokuRefreshTime?.();
    window.shilokuStartListen = startListeningSession;
    window.shilokuStopListen = stopListeningSession;
    window.shilokuRefreshListenStats = refreshListenStatsUI;
    window.shilokuPlaylistCategories = {
        getSongKey,
        listCategories,
        getCategoryName,
        getSongCategoryId,
        setSongCategory,
        addCategory,
        renameCategory,
        deleteCategory,
        getFilterTabs,
    };
}

initSiteExtensions();
