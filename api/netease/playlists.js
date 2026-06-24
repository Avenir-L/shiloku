import { applyCors, fetchUserPlaylists, resolveNeteaseCookie } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const cookie = resolveNeteaseCookie(req);
        const { valid, playlists } = await fetchUserPlaylists(cookie);
        if (!valid) {
            return res.status(401).json({ error: 'Netease cookie is invalid or expired', playlists: [] });
        }
        const trimmed = playlists.length > 1 ? playlists.slice(1) : [];
        return res.status(200).json({ playlists: trimmed });
    } catch {
        return res.status(500).json({ error: 'Failed to load playlists' });
    }
}
