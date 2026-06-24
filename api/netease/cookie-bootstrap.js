import { applyCors, parseNeteaseCookie, validateNeteaseCookie } from './lib.js';

function isLocalRequest(req) {
  const host = String(req.headers?.host || '').toLowerCase();
  const origin = String(req.headers?.origin || '').toLowerCase();
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isLocalRequest(req)) {
    return res.status(403).json({ error: '仅本地预览可用' });
  }

  const cookie = parseNeteaseCookie(process.env.NETEASE_COOKIE || '');
  if (!cookie) {
    return res.status(200).json({ hasCookie: false, valid: false, cookie: '' });
  }

  const account = await validateNeteaseCookie(cookie);
  return res.status(200).json({
    ...account,
    cookie: account.valid ? cookie : '',
  });
}
