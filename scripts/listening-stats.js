/** 音乐室收听时长统计（localStorage）+ 主页展示 */

const STATS_KEY = 'shiloku-listening-stats-v1';
const MIN_SECONDS = 3;
const TICK_INTERVAL_MS = 15000;

let sessionActive = false;
let lastTickAt = 0;
let tickTimer = null;
let neteaseCache = null;

function defaultStats() {
    return { total: 0, byDay: {}, byMonth: {} };
}

export function loadLocalStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (!raw) return defaultStats();
        const data = JSON.parse(raw);
        return {
            total: Number(data.total) || 0,
            byDay: data.byDay && typeof data.byDay === 'object' ? data.byDay : {},
            byMonth: data.byMonth && typeof data.byMonth === 'object' ? data.byMonth : {},
        };
    } catch {
        return defaultStats();
    }
}

function saveLocalStats(stats) {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch { /* quota */ }
}

export function getDayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function getMonthKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function pruneOldDays(stats) {
    const cutoff = Date.now() - 400 * 86400000;
    Object.keys(stats.byDay).forEach((key) => {
        const ts = Date.parse(`${key}T12:00:00`);
        if (!Number.isFinite(ts) || ts < cutoff) delete stats.byDay[key];
    });
}

function addSeconds(seconds) {
    if (seconds < MIN_SECONDS) return;
    const stats = loadLocalStats();
    const day = getDayKey();
    const month = getMonthKey();
    stats.byDay[day] = (stats.byDay[day] || 0) + seconds;
    stats.byMonth[month] = (stats.byMonth[month] || 0) + seconds;
    stats.total = (stats.total || 0) + seconds;
    pruneOldDays(stats);
    saveLocalStats(stats);
    refreshListenStatsUI();
}

function flushSession() {
    if (!sessionActive || !lastTickAt) return;
    const elapsed = Math.floor((Date.now() - lastTickAt) / 1000);
    if (elapsed >= MIN_SECONDS) addSeconds(elapsed);
    lastTickAt = Date.now();
}

export function startListeningSession() {
    sessionActive = true;
    lastTickAt = Date.now();
    if (tickTimer) return;
    tickTimer = window.setInterval(() => {
        if (!sessionActive) return;
        flushSession();
    }, TICK_INTERVAL_MS);
}

export function stopListeningSession() {
    if (!sessionActive) return;
    flushSession();
    sessionActive = false;
    if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
    }
}

export function getLocalListenSummary() {
    const stats = loadLocalStats();
    const day = getDayKey();
    const month = getMonthKey();
    return {
        todaySeconds: stats.byDay[day] || 0,
        monthSeconds: stats.byMonth[month] || 0,
        totalSeconds: stats.total || 0,
    };
}

export function formatListenDuration(totalSeconds, lang = 'zh') {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    if (seconds <= 0) {
        return lang === 'en' ? '0 min' : lang === 'ja' ? '0分' : '0 分钟';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (lang === 'en') {
        if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
        return m > 0 ? `${m} min` : `${seconds}s`;
    }
    if (lang === 'ja') {
        if (h > 0) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
        return m > 0 ? `${m}分` : `${seconds}秒`;
    }
    if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
    return m > 0 ? `${m} 分钟` : `${seconds} 秒`;
}

async function fetchNeteaseListenStats() {
    try {
        const res = await fetch('/api/netease/listen-stats');
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function refreshNeteaseListenStats(force = false) {
    if (!force && neteaseCache && neteaseCache.expiresAt > Date.now()) {
        return neteaseCache.data;
    }
    const data = await fetchNeteaseListenStats();
    neteaseCache = { data, expiresAt: Date.now() + 5 * 60 * 1000 };
    return data;
}

export function refreshListenStatsUI() {
    const wrap = document.getElementById('listen-stats-wrap');
    if (!wrap) return;

    const lang = window.shilokuI18n?.getLang?.() || 'zh';
    const t = window.shilokuI18n?.t || ((key) => key);
    const local = getLocalListenSummary();
    const netease = neteaseCache?.data;

    const todayEl = document.getElementById('listen-today');
    const monthEl = document.getElementById('listen-month');
    const extraEl = document.getElementById('listen-stats-extra');

    if (todayEl) todayEl.textContent = formatListenDuration(local.todaySeconds, lang);
    if (monthEl) monthEl.textContent = formatListenDuration(local.monthSeconds, lang);

    if (!extraEl) return;

    const parts = [];
    if (netease?.available) {
        if (netease.weekListenSeconds > 0) {
            parts.push(`${t('listenNeteaseWeek')}${formatListenDuration(netease.weekListenSeconds, lang)}`);
        }
        if (netease.totalPlayCount != null) {
            parts.push(`${t('listenNeteaseTotal')} ${netease.totalPlayCount.toLocaleString()} ${t('listenNeteaseTracks')}`);
        }
    } else if (netease && netease.available === false) {
        parts.push(t('listenNeteaseUnavailable'));
    }

    extraEl.textContent = parts.join(' · ');
    extraEl.hidden = parts.length === 0;
}

export function setupListeningStatsUI() {
    refreshListenStatsUI();
    void refreshNeteaseListenStats().then(() => refreshListenStatsUI());

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopListeningSession();
    });

    window.addEventListener('beforeunload', () => stopListeningSession());
}

export function bindListeningStatsToAudio(audioEl, getIsPlaying) {
    if (!audioEl) return;

    audioEl.addEventListener('play', () => {
        if (getIsPlaying?.()) startListeningSession();
    });

    audioEl.addEventListener('pause', () => stopListeningSession());
    audioEl.addEventListener('ended', () => stopListeningSession());
}
