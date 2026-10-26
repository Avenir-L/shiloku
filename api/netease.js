import { Readable } from 'node:stream';
import {createMusicLimiter} from './_lib/netease/rate.js';
import {
    applyCors,
    fetchNeteaseListenStats,
    fetchNeteaseLyric,
    fetchNeteaseAccountWithCookie,
    fetchPlaylistSongs,
    fetchUserPlaylists,
    getPlayableMap,
    proxyNeteaseAudio,
    resolveNeteaseCookie,
    searchNetease,
} from './_lib/netease/lib.js';

function getAction(req) {
    const raw = req.query?.path;
    if (Array.isArray(raw)) return raw.join('/');
    if (raw) return String(raw).trim();

    const url = String(req.url || '');
    const match = url.match(/\/api\/netease\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : '';
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
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(data);
}

async function handleLyric(req, res) {
    const id = String(req.query.id || '');
    if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ error: '缺少歌曲 id 或格式无效' });
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
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ playable });
}

async function handleListenStats(_req, res) {
    const stats = await fetchNeteaseListenStats();
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(stats);
}

async function handlePlaylists(req, res) {
    const cookie = await resolveNeteaseCookie(req);
    const { valid, playlists } = await fetchUserPlaylists(cookie);
    if (!valid) {
        return res.status(401).json({ error: 'Netease cookie is invalid or expired', playlists: [] });
    }
    return res.status(200).json({ playlists });
}

async function handlePlaylist(req, res) {
    const id = String(req.query.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const cookie = await resolveNeteaseCookie(req);
    const account = await fetchNeteaseAccountWithCookie(cookie);
    if (!account?.valid) {
        return res.status(401).json({ error: 'Netease cookie is invalid or expired', songs: [] });
    }
    const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 80));
    const songs = await fetchPlaylistSongs(id, cookie, limit);
    return res.status(200).json({ songs });
}

async function handleAudio(req, res) {
    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ error: '缺少歌曲 id' });

    const cookie = await resolveNeteaseCookie(req);
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

export function createNeteaseHandler({limit=createMusicLimiter()}={}){return async function handler(req, res) {
    applyCors(req, res);
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const action = getAction(req);

    try {
        if(['search','lyric','playable','listen-stats','playlists','playlist','audio'].includes(action)&&['GET','HEAD'].includes(req.method))await limit(req,action);
        switch (action) {
            case 'ping':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return await handlePing(req, res);
            case 'search':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return await handleSearch(req, res);
            case 'lyric':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return await handleLyric(req, res);
            case 'playable':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return await handlePlayable(req, res);
            case 'listen-stats':
                if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });
                return await handleListenStats(req, res);
            case 'playlists':
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                return await handlePlaylists(req, res);
            case 'playlist':
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                return await handlePlaylist(req, res);
            case 'cookie-bootstrap':
            case 'cookie-refresh':
            case 'qr-login':
            case 'cookie':
                // Account maintenance is performed by the owner's local CLI, never by visitors.
                res.setHeader('Cache-Control', 'no-store');
                return res.status(403).json({ error: 'Account management is not available on the public website' });
            case 'audio':
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    return res.status(405).json({ error: '只允许 GET / HEAD 请求' });
                }
                return await handleAudio(req, res);
            default:
                return res.status(404).json({ error: '未知接口' });
        }
    } catch (error) {
        if (res.headersSent) {
            res.end();
            return;
        }
        if([403,429,503].includes(error.status)){
            if(error.status===429)res.setHeader('Retry-After','60');
            return res.status(error.status).json({error:error.message});
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
};}
export default createNeteaseHandler();
