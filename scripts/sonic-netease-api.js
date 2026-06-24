import { NETEASE_COOKIE_HEADER, normalizeNeteaseCookie, readNeteaseCookieStorage, writeNeteaseCookieStorage } from './sonic/netease-cookie.js';

const AUTO_CHECK_MS = 6 * 60 * 60 * 1000;

export function neteaseCookieHeaders() {
  const cookie = readNeteaseCookieStorage();
  return cookie ? { [NETEASE_COOKIE_HEADER]: cookie } : {};
}

export async function syncNeteaseCookie(cookie, { silent = false } = {}) {
  const normalized = normalizeNeteaseCookie(cookie);
  try {
    const response = await fetch('/api/netease/cookie', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: normalized }),
    });
    const data = await response.json();
    return { valid: Boolean(data.valid), data, normalized };
  } catch (error) {
    if (!silent) console.warn('Unable to sync Netease cookie:', error);
    return { valid: false, data: null, normalized };
  }
}

export async function checkNeteaseCookie({ silent = true } = {}) {
  const cookie = readNeteaseCookieStorage();
  if (!cookie) return { valid: false, hasCookie: false };
  try {
    const response = await fetch('/api/netease/cookie', {
      headers: neteaseCookieHeaders(),
    });
    const data = await response.json();
    return { ...data, valid: Boolean(data.valid), hasCookie: Boolean(data.hasCookie) };
  } catch {
    return { valid: false, hasCookie: Boolean(cookie) };
  }
}

export async function bootstrapNeteaseCookie({ silent = true } = {}) {
  if (readNeteaseCookieStorage()) return { bootstrapped: false, valid: false };
  try {
    const response = await fetch('/api/netease/cookie-bootstrap');
    if (!response.ok) return { bootstrapped: false, valid: false };
    const data = await response.json();
    if (!data?.cookie || !data.valid) return { bootstrapped: false, valid: false };
    writeNeteaseCookieStorage(data.cookie);
    await syncNeteaseCookie(data.cookie, { silent });
    return { bootstrapped: true, valid: true, nickname: data.nickname || '' };
  } catch (error) {
    if (!silent) console.warn('Unable to bootstrap Netease cookie:', error);
    return { bootstrapped: false, valid: false };
  }
}

export async function refreshNeteaseCookie({ silent = true } = {}) {
  const cookie = readNeteaseCookieStorage();
  if (!cookie) return { valid: false, hasCookie: false };
  try {
    const response = await fetch('/api/netease/cookie-refresh', {
      method: 'POST',
      headers: neteaseCookieHeaders(),
    });
    const data = await response.json();
    if (data?.cookie) {
      writeNeteaseCookieStorage(data.cookie);
      await syncNeteaseCookie(data.cookie, { silent: true });
    }
    return { ...data, valid: Boolean(data.valid), hasCookie: Boolean(data.hasCookie ?? cookie) };
  } catch (error) {
    if (!silent) console.warn('Unable to refresh Netease cookie:', error);
    return { valid: false, hasCookie: Boolean(cookie) };
  }
}

export async function createNeteaseQrLogin() {
  const response = await fetch('/api/netease/qr-login?action=create');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '无法创建二维码');
  return data;
}

export async function checkNeteaseQrLogin(key) {
  const response = await fetch(`/api/netease/qr-login?action=check&key=${encodeURIComponent(key)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '扫码检查失败');
  return data;
}

let qrEncoderPromise = null;

async function loadQrEncoder() {
  if (!qrEncoderPromise) {
    qrEncoderPromise = import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
  }
  return qrEncoderPromise;
}

export async function renderNeteaseQrCode(imgEl, content) {
  if (!imgEl || !content) throw new Error('无法生成二维码');
  const QRCode = await loadQrEncoder();
  imgEl.alt = '网易云登录二维码';
  imgEl.src = await QRCode.toDataURL(String(content), {
    width: 180,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#101010', light: '#ffffff' },
  });
}

export function saveNeteaseCookie(cookie) {
  writeNeteaseCookieStorage(cookie);
  return syncNeteaseCookie(readNeteaseCookieStorage());
}

export function clearNeteaseCookie() {
  writeNeteaseCookieStorage('');
  return syncNeteaseCookie('');
}

export async function initNeteaseCookieAutoSync({ onStatus } = {}) {
  const notify = (status) => {
    window.__shilokuNeteaseCookieStatus = status;
    onStatus?.(status);
    window.dispatchEvent(new CustomEvent('shiloku:netease-cookie', { detail: status }));
  };

  const run = async () => {
    let status = await bootstrapNeteaseCookie({ silent: true });
    const cookie = readNeteaseCookieStorage();
    if (cookie) {
      await syncNeteaseCookie(cookie, { silent: true });
      status = await checkNeteaseCookie({ silent: true });
      if (!status.valid) {
        const refreshed = await refreshNeteaseCookie({ silent: true });
        if (refreshed.valid) status = refreshed;
      }
    }
    notify(status);
    return status;
  };

  await run();
  window.setInterval(async () => {
    const status = await run();
    if (!status.valid && status.hasCookie) {
      notify({ ...status, stale: true });
    }
  }, AUTO_CHECK_MS);
}

export async function fetchNeteaseCloud(url) {
  const response = await fetch(url, { headers: neteaseCookieHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Netease request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}
