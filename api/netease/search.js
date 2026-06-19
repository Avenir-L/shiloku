import { applyCors, searchNetease } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });

    try {
        const keywords = String(req.query.keywords || '').trim();
        const requestedLimit = Number(req.query.limit || '12');
        const resultLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 20)) : 12;

        if (!keywords) return res.status(400).json({ error: '请输入搜索关键词' });

        const data = await searchNetease(keywords, resultLimit);
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: '网易云搜索失败' });
    }
}
