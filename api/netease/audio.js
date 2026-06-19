import { applyCors, proxyNeteaseAudio } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET 请求' });

    try {
        const id = String(req.query.id || '');
        if (!id) return res.status(400).json({ error: '缺少歌曲 id' });

        const audioResponse = await proxyNeteaseAudio(id, req.headers);
        if (!audioResponse) return res.status(404).json({ error: '这首歌暂时无法播放' });

        res.status(audioResponse.status);
        ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach((header) => {
            const value = audioResponse.headers.get(header);
            if (value) res.setHeader(header, value);
        });
        if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'audio/mpeg');

        const buffer = Buffer.from(await audioResponse.arrayBuffer());
        return res.end(buffer);
    } catch (error) {
        return res.status(500).json({ error: '音频代理失败' });
    }
}
