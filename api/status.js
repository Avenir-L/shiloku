import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const STATUS_URLS = [
    'https://api.github.com/repos/Avenir-L/shiloku/contents/status.json?ref=main',
    'https://cdn.jsdelivr.net/gh/Avenir-L/shiloku@main/status.json',
    'https://raw.githubusercontent.com/Avenir-L/shiloku/main/status.json',
];

async function fetchStatusFromUrl(url) {
    const headers = { Accept: 'application/json', 'User-Agent': 'shiloku-status-proxy' };
    if (url.includes('api.github.com')) {
        headers.Accept = 'application/vnd.github.raw+json';
    }
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && (data.text || data.updatedAt)) return data;
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET' });

    for (const url of STATUS_URLS) {
        try {
            const data = await fetchStatusFromUrl(url);
            if (data) return res.status(200).json(data);
        } catch {
            /* try next */
        }
    }

    try {
        const raw = await readFile(join(process.cwd(), 'status.json'), 'utf8');
        return res.status(200).json(JSON.parse(raw));
    } catch {
        return res.status(200).json({ text: '在线摸鱼中', updatedAt: null });
    }
}
