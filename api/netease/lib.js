const neteaseHeaders = {
    Referer: 'https://music.163.com/',
    'User-Agent': 'Mozilla/5.0',
};

const playableUrlCache = new Map();
const searchCache = new Map();
const playableUrlCacheTtl = 1000 * 60 * 10;
const searchCacheTtl = 1000 * 60 * 5;

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

    const url = `https://music.163.com/api/song/enhance/player/url?id=${encodeURIComponent(id)}&ids=%5B${encodeURIComponent(id)}%5D&br=320000`;
    const response = await fetch(url, { headers: neteaseHeaders });
    const data = await response.json();
    const playableUrl = data?.data?.[0]?.url || null;
    playableUrlCache.set(id, { url: playableUrl, expiresAt: Date.now() + playableUrlCacheTtl });
    return playableUrl;
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

export async function searchNetease(keywords, resultLimit = 12) {
    const cacheKey = `${keywords.toLowerCase()}::${resultLimit}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return { songs: cached.songs, cached: true };
    }

    const body = new URLSearchParams({
        s: keywords,
        type: '1',
        offset: '0',
        total: 'true',
        limit: String(Math.min(resultLimit * 3, 60)),
    });

    const response = await fetch('https://music.163.com/api/search/get/web', {
        method: 'POST',
        headers: {
            ...neteaseHeaders,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    const data = await response.json();
    const rawSongs = (data?.result?.songs || []).map((song) => ({
        id: song.id,
        name: song.name,
        artist: (song.artists || []).map((artist) => artist.name).filter(Boolean).join(' / '),
        album: song.album?.name || '',
        cover: song.album?.picUrl || song.album?.blurPicUrl || '',
        duration: song.duration || 0,
        fee: song.fee,
    }));
    const songs = await filterPlayableSongs(rawSongs, resultLimit);
    searchCache.set(cacheKey, { songs, expiresAt: Date.now() + searchCacheTtl });
    return { songs };
}

export async function fetchNeteaseLyric(id) {
    const response = await fetch(
        `https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=-1&kv=-1&tv=-1`,
        { headers: neteaseHeaders }
    );
    const data = await response.json();
    return {
        lyric: data?.lrc?.lyric || '',
        translatedLyric: data?.tlyric?.lyric || '',
    };
}

export async function proxyNeteaseAudio(id, reqHeaders) {
    const playableUrl = await getNeteasePlayableUrl(id);
    if (!playableUrl) return null;

    const headers = { ...neteaseHeaders };
    if (reqHeaders.range) headers.Range = reqHeaders.range;

    const audioResponse = await fetch(playableUrl, { headers });
    return audioResponse;
}
