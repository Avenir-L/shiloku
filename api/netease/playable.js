import { applyCors, getPlayableMap } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });

    try {
        const ids = String(req.query.ids || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .slice(0, 30);
        if (!ids.length) return res.status(400).json({ error: '缺少歌曲 id' });
        const playable = await getPlayableMap(ids);
        res.setHeader('Cache-Control', 'private, max-age=600');
        return res.status(200).json({ playable });
    } catch (error) {
        return res.status(500).json({ error: '播放状态检查失败' });
    }
}
