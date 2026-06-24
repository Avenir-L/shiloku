import { Readable } from 'node:stream';
import { applyCors, proxyNeteaseAudio } from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: '只允许 GET / HEAD 请求' });
    }

    try {
        const id = String(req.query.id || '');
        if (!id) return res.status(400).json({ error: '缺少歌曲 id' });

        const audioResponse = await proxyNeteaseAudio(id, req.headers);
        if (!audioResponse) {
            return res.status(404).json({ error: '这首歌暂时无法播放' });
        }

        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

        for (const header of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
            const value = audioResponse.headers.get(header);
            if (value) res.setHeader(header, value);
        }
        if (!audioResponse.headers.get('Content-Type')) {
            res.setHeader('Content-Type', 'audio/mpeg');
        }

        res.status(audioResponse.status);
        if (req.method === 'HEAD') {
            return res.end();
        }

        if (!audioResponse.body) {
            const buffer = Buffer.from(await audioResponse.arrayBuffer());
            res.end(buffer);
            return;
        }

        Readable.fromWeb(audioResponse.body).pipe(res);
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ error: '音频代理失败' });
        }
        res.end();
    }
}
