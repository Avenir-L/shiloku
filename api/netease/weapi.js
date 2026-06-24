import crypto from 'node:crypto';

const PRESET_KEY = '0CoJMe%w^dd^';
const IV = '0102030405060708';
const PUB_KEY = '010001';
const MODULUS =
  '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function createSecretKey(size = 16) {
  let key = '';
  for (let i = 0; i < size; i += 1) {
    key += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return key;
}

function aesEncrypt(text, secretKey) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(secretKey, 'utf8'), Buffer.from(IV, 'utf8'));
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64');
}

function rsaEncrypt(text) {
  const reversed = Buffer.from(text.split('').reverse().join(''), 'utf8');
  const base = BigInt(`0x${reversed.toString('hex')}`);
  const exponent = BigInt(`0x${PUB_KEY}`);
  const modulus = BigInt(`0x${MODULUS}`);
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result.toString(16).padStart(256, '0');
}

export function encryptWeapi(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const secretKey = createSecretKey(16);
  const params = aesEncrypt(aesEncrypt(text, PRESET_KEY), secretKey);
  const encSecKey = rsaEncrypt(secretKey);
  return { params, encSecKey };
}

export function mergeCookieStrings(...cookies) {
  const map = new Map();
  for (const raw of cookies) {
    for (const part of String(raw || '').split(';')) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const name = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (name) map.set(name, value);
    }
  }
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() || [];
  const list = raw.length ? raw : [headers.get('set-cookie')].filter(Boolean);
  const pairs = [];
  for (const line of list) {
    const chunk = String(line).split(';')[0]?.trim();
    if (chunk && chunk.includes('=')) pairs.push(chunk);
  }
  return pairs.join('; ');
}

const WEAPI_HEADERS = {
  Referer: 'https://music.163.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded',
};

async function postWeapi(url, payload, cookie = '') {
  const body = new URLSearchParams(encryptWeapi(payload));
  const headers = { ...WEAPI_HEADERS };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(url, { method: 'POST', headers, body });
  const data = await response.json();
  const setCookie = parseSetCookie(response.headers);
  return { data, setCookie };
}

export async function createQrLoginKey() {
  const { data } = await postWeapi('https://music.163.com/weapi/login/qrcode/unikey', { type: 1 });
  if (data.code !== 200 || !data.unikey) {
    throw new Error(data.message || data.msg || '无法创建扫码登录');
  }
  return data.unikey;
}

export async function createQrLoginImage(key) {
  const { data } = await postWeapi(
    `https://music.163.com/weapi/login/qrcode/create?key=${encodeURIComponent(key)}`,
    { key, type: 1 },
  );
  if (data.code !== 200 || !data.qrurl) {
    throw new Error(data.message || data.msg || '无法生成二维码');
  }
  return data.qrurl;
}

export async function checkQrLogin(key) {
  const { data, setCookie } = await postWeapi(
    `https://music.163.com/weapi/login/qrcode/client/login?key=${encodeURIComponent(key)}&time=${Date.now()}`,
    { key, type: 1 },
  );
  return {
    code: data.code,
    message: data.message || data.msg || '',
    cookie: setCookie,
    data,
  };
}

export async function refreshLoginCookie(cookie) {
  const { data, setCookie } = await postWeapi('https://music.163.com/weapi/login/token/refresh', {}, cookie);
  const merged = mergeCookieStrings(cookie, setCookie);
  return {
    code: data.code,
    cookie: merged || cookie,
    data,
  };
}

export async function createQrLoginSession() {
  const key = await createQrLoginKey();
  const qrUrl = await createQrLoginImage(key);
  return { key, qrUrl };
}
