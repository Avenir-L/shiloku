import { applyCors, fetchNeteaseListenStats } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });

    try {
        const stats = await fetchNeteaseListenStats();
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.status(200).json(stats);
    } catch (error) {
        return res.status(500).json({ available: false, error: '获取网易云听歌数据失败' });
    }
}
