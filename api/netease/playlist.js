import { applyCors, fetchPlaylistSongs, fetchNeteaseAccountWithCookie, resolveNeteaseCookie } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
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
    } catch {
        return res.status(500).json({ error: 'Failed to load playlist songs' });
    }
}
