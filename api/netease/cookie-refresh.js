import { applyCors, parseNeteaseCookie, resolveNeteaseCookie, setRuntimeNeteaseCookie, validateNeteaseCookie } from './lib.js';
import { refreshLoginCookie } from './weapi.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookie = resolveNeteaseCookie(req);
  if (!cookie) {
    return res.status(400).json({ hasCookie: false, valid: false, error: '没有 Cookie' });
  }

  try {
    const refreshed = await refreshLoginCookie(cookie);
    const nextCookie = parseNeteaseCookie(refreshed.cookie || cookie);
    setRuntimeNeteaseCookie(nextCookie);
    const account = await validateNeteaseCookie(nextCookie);
    return res.status(200).json({
      ...account,
      cookie: nextCookie,
      refreshCode: refreshed.code,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || '续期失败' });
  }
}
