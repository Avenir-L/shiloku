import { Readable } from 'node:stream';
import {
    applyCors,
    fetchNeteaseListenStats,
    fetchNeteaseLyric,
    fetchNeteaseAccountWithCookie,
    fetchPlaylistSongs,
    fetchUserPlaylists,
    getPlayableMap,
    parseNeteaseCookie,
    proxyNeteaseAudio,
    resolveNeteaseCookie,
    searchNetease,
    setRuntimeNeteaseCookie,
    validateNeteaseCookie,
} from './_lib/netease/lib.js';
import { checkQrLogin, createQrLoginSession, refreshLoginCookie } from './_lib/netease/weapi.js';

function getAction(req) {
    const raw = req.query?.path;
    if (Array.isArray(raw)) return raw.join('/');
    if (raw) return String(raw).trim();

    const url = String(req.url || '');
    const match = url.match(/\/api\/netease\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function isLocalRequest(req) {
    const host = String(req.headers?.host || '').toLowerCase();
    const origin = String(req.headers?.origin || '').toLowerCase();
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
        || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

async function handlePing(_req, res) {
    return res.status(200).json({ ok: true });
}

async function handleSearch(req, res) {
    const keywords = String(req.query.keywords || '').trim();
    const requestedLimit = Number(req.query.limit || '30');
    const resultLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 30)) : 30;
    const offset = Math.max(0, Number(req.query.offset || '0') || 0);
    if (!keywords) return res.status(400).json({ error: '请输入搜索关键词' });
    const data = await searchNetease(keywords, resultLimit, offset);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json(data);
}

async function handleLyric(req, res) {
    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ error: '缺少歌曲 id' });
    const data = await fetchNeteaseLyric(id);
    return res.status(200).json(data);
}

async function handlePlayable(req, res) {
    const ids = String(req.query.ids || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 30);
    if (!ids.length) return res.status(400).json({ error: '缺少歌曲 id' });
    const playable = await getPlayableMap(ids);
    res.setHeader('Cache-Control', 'private, max-age=600');
    return res.status(200).json({ playable });
}

async function handleListenStats(_req, res) {
    const stats = await fetchNeteaseListenStats();
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).json(stats);
}

async function handlePlaylists(req, res) {
    const cookie = resolveNeteaseCookie(req);
    const { valid, playlists } = await fetchUserPlaylists(cookie);
    if (!valid) {
        return res.status(401).json({ error: 'Netease cookie is invalid or expired', playlists: [] });
    }
    const trimmed = playlists.length > 1 ? playlists.slice(1) : [];
    return res.status(200).json({ playlists: trimmed });
}

async function handlePlaylist(req, res) {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const cookie = resolveNeteaseCookie(req);
    const account = await fetchNeteaseAccountWithCookie(cookie);
    if (!account?.valid) {
        return res.status(401).json({ error: 'Netease cookie is invalid or expired', songs: [] });
    }
    const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 80));
    const songs = await fetchPlaylistSongs(id, cookie, limit);
    return res.status(200).json({ songs });
}

async function handleCookieBootstrap(req, res) {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: '仅本地预览可用' });
    }
    const cookie = parseNeteaseCookie(process.env.NETEASE_COOKIE || '');
    if (!cookie) {
        return res.status(200).json({ hasCookie: false, valid: false, cookie: '' });
    }
    const account = await validateNeteaseCookie(cookie);
    return res.status(200).json({
        ...account,
        cookie: account.valid ? cookie : '',
    });
}

async function handleCookie(req, res) {
    if (req.method === 'GET') {
        const cookie = resolveNeteaseCookie(req);
        const result = await validateNeteaseCookie(cookie);
        return res.status(200).json(result);
    }
    if (req.method === 'PUT') {
        const cookie = parseNeteaseCookie(req.body?.cookie || '');
        setRuntimeNeteaseCookie(cookie);
        const result = await validateNeteaseCookie(cookie);
        return res.status(200).json(result);
    }
    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleCookieRefresh(req, res) {
    const cookie = resolveNeteaseCookie(req);
    if (!cookie) {
        return res.status(400).json({ hasCookie: false, valid: false, error: '没有 Cookie' });
    }
    const refreshed = await refreshLoginCookie(cookie);
    const nextCookie = parseNeteaseCookie(refreshed.cookie || cookie);
    setRuntimeNeteaseCookie(nextCookie);
    const account = await validateNeteaseCookie(nextCookie);
    return res.status(200).json({
        ...account,
        cookie: nextCookie,
        refreshCode: refreshed.code,
    });
}

async function handleQrLogin(req, res) {
    const action = String(req.query?.action || 'create').trim();
    if (action === 'create') {
        const session = await createQrLoginSession();
        return res.status(200).json(session);
    }
    if (action === 'check') {
        const key = String(req.query?.key || '').trim();
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const result = await checkQrLogin(key);
        const cookie = parseNeteaseCookie(result.cookie);
        const payload = {
            code: result.code,
            message: result.message || '',
            hasCookie: Boolean(cookie),
        };
        if (result.code === 803) payload.expired = true;
        if (result.code === 801) payload.waiting = true;
        if (result.code === 802) payload.scanned = true;
        if (result.code === 800 && cookie) {
            payload.cookie = cookie;
            setRuntimeNeteaseCookie(cookie);
            const account = await validateNeteaseCookie(cookie);
            payload.valid = account.valid;
            payload.nickname = account.nickname;
            payload.userId = account.userId;
        }
        return res.status(200).json(payload);
    }
    return res.status(400).json({ error: '未知 action' });
}

async function handleAudio(req, res) {
    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ error: '缺少歌曲 id' });

    const cookie = resolveNeteaseCookie(req);
    const audioResponse = await proxyNeteaseAudio(id, req.headers, cookie);
    if (!audioResponse) {
        return res.status(404).json({ error: '这首歌暂时无法播放' });
    }

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    for (const header of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
        const value = audioResponse.headers.get(header);
        if (value) res.setHeader(header, value);
    }
    if (!audioResponse.headers.get('Content-Type')) {
        res.setHeader('Content-Type', 'audio/mpeg');
    }

    res.status(audioResponse.status);
    if (req.method === 'HEAD') {
        return res.end();
    }

    if (!audioResponse.body) {
        const buffer = Buffer.from(await audioResponse.arrayBuffer());
        res.end(buffer);
        return;
    }

    Readable.fromWeb(audioResponse.body).pipe(res);
}

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    const action = getAction(req);

    try {
        switch (action) {
            case 'ping':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return handlePing(req, res);
            case 'search':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return handleSearch(req, res);
            case 'lyric':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return handleLyric(req, res);
            case 'playable':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return handlePlayable(req, res);
            case 'listen-stats':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return handleListenStats(req, res);
            case 'playlists':
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                return handlePlaylists(req, res);
            case 'playlist':
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                return handlePlaylist(req, res);
            case 'cookie-bootstrap':
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                return handleCookieBootstrap(req, res);
            case 'cookie-refresh':
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                return handleCookieRefresh(req, res);
            case 'qr-login':
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                return handleQrLogin(req, res);
            case 'cookie':
                if (req.method !== 'GET' && req.method !== 'PUT') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }
                return handleCookie(req, res);
            case 'audio':
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    return res.status(405).json({ error: '只允许 GET / HEAD 请求' });
                }
                return handleAudio(req, res);
            default:
                return res.status(404).json({ error: '未知接口' });
        }
    } catch (error) {
        if (res.headersSent) {
            res.end();
            return;
        }
        const message = error?.message || '请求失败';
        if (action === 'audio') {
            return res.status(500).json({ error: '音频代理失败' });
        }
        if (action === 'search') {
            return res.status(500).json({ error: '网易云搜索失败' });
        }
        if (action === 'lyric') {
            return res.status(500).json({ error: '获取歌词失败' });
        }
        if (action === 'playable') {
            return res.status(500).json({ error: '播放状态检查失败' });
        }
        if (action === 'listen-stats') {
            return res.status(500).json({ available: false, error: '获取网易云听歌数据失败' });
        }
        if (action === 'playlist' || action === 'playlists') {
            return res.status(500).json({ error: 'Failed to load playlist data' });
        }
        if (action === 'cookie-refresh' || action === 'qr-login') {
            return res.status(500).json({ error: message });
        }
        return res.status(500).json({ error: message });
    }
}
