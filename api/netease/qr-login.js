import { applyCors, parseNeteaseCookie, resolveNeteaseCookie, setRuntimeNeteaseCookie, validateNeteaseCookie } from './lib.js';
import { checkQrLogin, createQrLoginSession, refreshLoginCookie } from './weapi.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const action = String(req.query?.action || 'create').trim();

  try {
    if (action === 'create') {
      const session = await createQrLoginSession();
      return res.status(200).json(session);
    }

    if (action === 'check') {
      const key = String(req.query?.key || '').trim();
      if (!key) return res.status(400).json({ error: '缺少 key' });
      const result = await checkQrLogin(key);
      const cookie = parseNeteaseCookie(result.cookie);
      const payload = {
        code: result.code,
        message: result.message || '',
        hasCookie: Boolean(cookie),
      };
      if (result.code === 803) payload.expired = true;
      if (result.code === 801) payload.waiting = true;
      if (result.code === 802) payload.scanned = true;
      if (result.code === 800 && cookie) {
        payload.cookie = cookie;
        setRuntimeNeteaseCookie(cookie);
        const account = await validateNeteaseCookie(cookie);
        payload.valid = account.valid;
        payload.nickname = account.nickname;
        payload.userId = account.userId;
      }
      return res.status(200).json(payload);
    }

    return res.status(400).json({ error: '未知 action' });
  } catch (error) {
    return res.status(500).json({ error: error?.message || '扫码登录失败' });
  }
}
