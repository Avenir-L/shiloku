import { applyCors, getNeteasePlayableUrl } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });

    try {
        const id = String(req.query.id || '');
        if (!id) return res.status(400).json({ error: '缺少歌曲 id' });

        const url = await getNeteasePlayableUrl(id);
        return res.status(200).json({ url });
    } catch (error) {
        return res.status(500).json({ error: '获取播放地址失败' });
    }
}
