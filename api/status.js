import { readStatus } from './_lib/status-store.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: '只允许 GET' });

    const data = await readStatus({ localFallback: true });
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30');
    return res.status(200).json(data);
}
