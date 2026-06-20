import { applyCors, getNeteasePlayableUrl } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: '只允许 GET / HEAD 请求' });
    }

    try {
        const id = String(req.query.id || '');
        if (!id) return res.status(400).json({ error: '缺少歌曲 id' });

        const playableUrl = await getNeteasePlayableUrl(id);
        if (!playableUrl) {
            return res.status(404).json({ error: '这首歌暂时无法播放' });
        }

        res.setHeader('Cache-Control', 'private, max-age=300');
        res.writeHead(302, { Location: playableUrl });
        res.end();
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ error: '音频代理失败' });
        }
        res.end();
    }
}
