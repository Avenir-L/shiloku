import { writeStatus, getStorageMode } from '../_lib/status-store.js';

function cors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function authorize(req) {
    const secret = process.env.STATUS_SYNC_SECRET;
    if (!secret) return false;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    return token && token === secret;
}

function sanitizePayload(body) {
    if (!body || typeof body !== 'object') return null;
    const text = String(body.text || '').slice(0, 500);
    if (!text) return null;
    return {
        text,
        updatedAt: body.updatedAt || new Date().toISOString(),
        mode: body.mode || 'online',
        primary: String(body.primary || text).slice(0, 500),
        secondary: String(body.secondary || '').slice(0, 500),
        lines: Array.isArray(body.lines) ? body.lines.map((l) => String(l).slice(0, 500)).slice(0, 8) : [text],
        displayMode: body.displayMode === 'carousel' ? 'carousel' : 'merge',
        carouselSeconds: Number.isFinite(body.carouselSeconds) ? body.carouselSeconds : 8,
    };
}

export default async function handler(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: '只允许 POST' });

    if (!authorize(req)) {
        return res.status(401).json({ error: '未授权' });
    }

    const payload = sanitizePayload(req.body);
    if (!payload) {
        return res.status(400).json({ error: '状态格式无效' });
    }

    if (getStorageMode() === 'none') {
        return res.status(503).json({
            error: '服务端未配置状态存储。请在 Vercel 配置 KV 或 GitHub Gist（见文档）。',
        });
    }

    const ok = await writeStatus(payload);
    if (!ok) {
        return res.status(500).json({ error: '写入状态失败' });
    }

    return res.status(200).json({ ok: true, storage: getStorageMode() });
}
