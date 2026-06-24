import { applyCors, fetchDailyRecommendSongs, resolveNeteaseCookie } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const cookie = resolveNeteaseCookie(req);
        const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 80));
        const result = await fetchDailyRecommendSongs(cookie, limit);
        if (!result.valid) {
            return res.status(401).json({ error: 'Netease cookie is invalid or expired', songs: [] });
        }
        return res.status(200).json(result);
    } catch {
        return res.status(500).json({ error: 'Failed to load daily recommendations' });
    }
}
