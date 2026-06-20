const neteaseHeaders = {
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const PAGE_RAW_SIZE = 30;

function parseNeteaseCookie(raw) {
    const cookie = String(raw || '').trim();
    if (!cookie) return '';
    if (!cookie.startsWith('# Netscape') && !cookie.includes('\t')) return cookie;
    const parts = [];
    for (const line of cookie.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const cols = trimmed.split('\t');
        if (cols.length >= 7 && cols[5]) parts.push(`${cols[5]}=${cols[6]}`);
    }
    return parts.join('; ');
}

function getNeteaseHeaders(extra = {}) {
    const headers = { ...neteaseHeaders, ...extra };
    const cookie = parseNeteaseCookie(process.env.NETEASE_COOKIE);
    if (cookie) headers.Cookie = cookie;
    return headers;
}

const playableUrlCache = new Map();
const searchCache = new Map();
const playableUrlCacheTtl = 1000 * 60 * 30;
const searchCacheTtl = 1000 * 60 * 15;
const PLAYABLE_BATCH_SIZE = 6;
const PLAYABLE_MAX_IDS = 30;

export function applyCors(req, res) {
    const origin = req.headers.origin || '';
    const allowLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const allowProd = /^https:\/\/(www\.)?shiloku\.(cn|vercel\.app)$/i.test(origin);
    if (allowLocal || allowProd || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        if (origin) res.setHeader('Vary', 'Origin');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
}

export async function getNeteasePlayableUrl(id) {
    const cached = playableUrlCache.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const headers = getNeteaseHeaders();
    const encodedId = encodeURIComponent(id);
    const endpoints = [
        `https://music.163.com/api/song/enhance/player/url?id=${encodedId}&ids=%5B${encodedId}%5D&br=320000`,
        `https://music.163.com/api/song/enhance/player/url/v1?ids=%5B${encodedId}%5D&level=exhigh&encodeType=mp3`,
        `https://music.163.com/api/song/enhance/player/url?id=${encodedId}&ids=%5B${encodedId}%5D&br=999000`,
    ];

    let playableUrl = null;
    for (const url of endpoints) {
        const response = await fetch(url, { headers }).catch(() => null);
        if (!response?.ok) continue;
        const data = await response.json().catch(() => null);
        playableUrl = data?.data?.[0]?.url || null;
        if (playableUrl) break;
    }

    playableUrlCache.set(id, { url: playableUrl, expiresAt: Date.now() + playableUrlCacheTtl });
    return playableUrl;
}

export async function getPlayableMap(ids) {
    const limited = (ids || []).slice(0, PLAYABLE_MAX_IDS).map((id) => String(id));
    const result = {};
    for (let i = 0; i < limited.length; i += PLAYABLE_BATCH_SIZE) {
        const batch = limited.slice(i, i + PLAYABLE_BATCH_SIZE);
        await Promise.all(batch.map(async (id) => {
            result[id] = Boolean(await getNeteasePlayableUrl(id));
        }));
    }
    return result;
}

export async function filterPlayableSongs(rawSongs, resultLimit) {
    const playableSongs = [];
    const batchSize = 8;

    for (let i = 0; i < rawSongs.length && playableSongs.length < resultLimit; i += batchSize) {
        const batch = rawSongs.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (song) => ({
            song,
            playableUrl: await getNeteasePlayableUrl(String(song.id)),
        })));

        for (const result of results) {
            if (result.playableUrl) playableSongs.push(result.song);
            if (playableSongs.length >= resultLimit) break;
        }
    }

    return playableSongs;
}

function getSearchCacheKey(keywords, offset, resultLimit, fetchLimit) {
    const cookie = parseNeteaseCookie(process.env.NETEASE_COOKIE) || '';
    const cookieTag = cookie.includes('MUSIC_U=') ? 'auth' : 'anon';
    return `${cookieTag}::${keywords.toLowerCase()}::${offset}::${resultLimit}::${fetchLimit}`;
}

function mapSearchSongs(songs) {
    return (songs || []).map((song) => ({
        id: song.id,
        name: song.name,
        artist: (song.artists || []).map((artist) => artist.name).filter(Boolean).join(' / '),
        album: song.album?.name || '',
        cover: song.album?.picUrl || song.album?.blurPicUrl || '',
        duration: song.duration || 0,
        fee: song.fee,
    }));
}

async function fetchNeteaseSearchResult(keywords, offset, fetchLimit) {
    const params = new URLSearchParams({
        s: keywords,
        type: '1',
        offset: String(offset),
        total: 'true',
        limit: String(fetchLimit),
    });
    const headers = getNeteaseHeaders();

    const tryParse = async (response) => {
        if (!response?.ok) return null;
        const data = await response.json().catch(() => null);
        if (data?.code === 200 && data?.result) return data.result;
        return null;
    };

    const getResult = await tryParse(await fetch(
        `https://music.163.com/api/search/get?${params}`,
        { headers },
    ).catch(() => null));
    if (getResult?.songs?.length) return getResult;

    const postResult = await tryParse(await fetch('https://music.163.com/api/search/get/web', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    }).catch(() => null));
    if (postResult) return postResult;

    return { songs: [], songCount: 0 };
}

export async function searchNetease(keywords, resultLimit = 30, offset = 0) {
    offset = Math.max(0, Number(offset) || 0);
    const fetchLimit = PAGE_RAW_SIZE;
    const cacheKey = getSearchCacheKey(keywords, offset, resultLimit, fetchLimit);
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.payload, cached: true };
    }

    const result = await fetchNeteaseSearchResult(keywords, offset, fetchLimit);
    const songs = mapSearchSongs(result.songs);
    const total = Number(result.songCount || 0);
    const fetched = songs.length;
    const hasMore = offset + fetched < total;
    const payload = {
        songs,
        total,
        offset,
        pageSize: PAGE_RAW_SIZE,
        hasMore,
        nextOffset: hasMore ? offset + fetched : offset,
    };
    if (total > 0 || songs.length > 0) {
        searchCache.set(cacheKey, { payload, expiresAt: Date.now() + searchCacheTtl });
    }
    return payload;
}

export async function fetchNeteaseLyric(id) {
    const response = await fetch(
        `https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=-1&kv=-1&tv=-1`,
        { headers: getNeteaseHeaders() }
    );
    const data = await response.json();
    let lyric = data?.lrc?.lyric || '';
    const translatedLyric = data?.tlyric?.lyric || '';
    if (!lyric) {
        lyric = yrcTextToLrc(data?.yrc?.lyric) || yrcTextToLrc(data?.klyric?.lyric) || '';
    }
    return {
        lyric,
        translatedLyric,
        hasTranslation: Boolean(translatedLyric.trim()),
    };
}

function yrcTextToLrc(yrcText) {
    if (!yrcText) return '';
    const linesOut = [];
    const lineRe = /^\[(\d+),\d+\](.*)$/;
    const tokenRe = /\((\d+),(\d+),(\d+)\)/g;
    for (const raw of String(yrcText).split('\n')) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const match = lineRe.exec(trimmed);
        if (!match) continue;
        const startMs = Number(match[1]);
        const body = match[2];
        if (body.startsWith('{')) continue;
        const parts = [];
        let pos = 0;
        while (pos < body.length) {
            tokenRe.lastIndex = pos;
            const token = tokenRe.exec(body);
            if (!token) {
                parts.push(body.slice(pos));
                break;
            }
            pos = tokenRe.lastIndex;
            let end = pos;
            while (end < body.length && body[end] !== '(') end += 1;
            parts.push(body.slice(pos, end));
            pos = end;
        }
        const text = parts.join('').trim();
        if (!text) continue;
        const totalSec = startMs / 1000;
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec - minutes * 60;
        linesOut.push(`[${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}]${text}`);
    }
    return linesOut.join('\n');
}

export async function fetchNeteaseAccount() {
    const response = await fetch('https://music.163.com/api/nuser/account/get', {
        headers: getNeteaseHeaders(),
    });
    const data = await response.json();
    if (data?.code !== 200 || !data?.account?.id) return null;
    return data.account;
}

export async function fetchUserLevel() {
    const response = await fetch('https://music.163.com/api/user/level', {
        headers: getNeteaseHeaders(),
    });
    const data = await response.json();
    if (data?.code !== 200) return null;
    return data;
}

export async function fetchWeekPlayRecord(uid) {
    const response = await fetch(
        `https://music.163.com/api/play/record?uid=${encodeURIComponent(uid)}&type=1`,
        { headers: getNeteaseHeaders() },
    );
    const data = await response.json();
    const weekData = Array.isArray(data?.weekData) ? data.weekData : [];
    let seconds = 0;

    weekData.forEach((item) => {
        const durationMs = Number(item?.song?.dt) || 0;
        const playCount = Math.min(Number(item?.playCount) || 1, 80);
        if (durationMs > 0) seconds += Math.floor(durationMs / 1000) * playCount;
    });

    return {
        seconds,
        trackCount: weekData.length,
    };
}

export async function fetchNeteaseListenStats() {
    const cookie = parseNeteaseCookie(process.env.NETEASE_COOKIE);
    if (!cookie) {
        return { available: false, reason: 'missing_cookie' };
    }

    const account = await fetchNeteaseAccount();
    if (!account?.id) {
        return { available: false, reason: 'not_logged_in' };
    }

    const [level, week] = await Promise.all([
        fetchUserLevel(),
        fetchWeekPlayRecord(account.id),
    ]);

    return {
        available: true,
        userId: account.id,
        nickname: account.nickname || '',
        totalPlayCount: level?.data?.nowPlayCount ?? null,
        weekListenSeconds: week.seconds,
        weekTrackCount: week.trackCount,
        officialTodayAvailable: false,
        officialMonthAvailable: false,
    };
}

export async function proxyNeteaseAudio(id, reqHeaders) {
    const playableUrl = await getNeteasePlayableUrl(id);
    if (!playableUrl) return null;

    const headers = getNeteaseHeaders();
    if (reqHeaders.range) headers.Range = reqHeaders.range;

    const audioResponse = await fetch(playableUrl, { headers });
    return audioResponse;
}
