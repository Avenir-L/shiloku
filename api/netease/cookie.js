import {
    applyCors,
    parseNeteaseCookie,
    resolveNeteaseCookie,
    setRuntimeNeteaseCookie,
    validateNeteaseCookie,
} from './lib.js';

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method === 'GET') {
        const cookie = resolveNeteaseCookie(req);
        const result = await validateNeteaseCookie(cookie);
        return res.status(200).json(result);
    }

    if (req.method === 'PUT') {
        const cookie = parseNeteaseCookie(req.body?.cookie || '');
        setRuntimeNeteaseCookie(cookie);
        const result = await validateNeteaseCookie(cookie);
        return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
