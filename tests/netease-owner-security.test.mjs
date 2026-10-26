import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/netease.js';
import { resolveNeteaseCookie } from '../api/_lib/netease/lib.js';
import { normalizePresetTransferPackage } from '../scripts/sonic/preset-transfer.js';

test('public music API rejects credential management even with spoofed localhost headers', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Credential routes must not contact upstream'); };
  try {
    for (const [path, method] of [['cookie', 'PUT'], ['cookie', 'GET'], ['cookie-bootstrap', 'GET'], ['cookie-refresh', 'POST'], ['qr-login', 'GET']]) {
      const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ method, query: { path }, headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, body: { cookie: 'MUSIC_U=visitor' } }, res);
      assert.equal(res.code, 403, `${method} ${path}`);
      assert.deepEqual(Object.keys(res.body), ['error']);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('visitor cookie headers cannot replace the server account', () => {
  const original = process.env.NETEASE_COOKIE;
  process.env.NETEASE_COOKIE = 'MUSIC_U=owner-test';
  try {
    assert.equal(resolveNeteaseCookie({ headers: { 'x-netease-cookie': 'MUSIC_U=visitor' } }), 'MUSIC_U=owner-test');
  } finally {
    if (original === undefined) delete process.env.NETEASE_COOKIE;
    else process.env.NETEASE_COOKIE = original;
  }
});

test('imported visitor presets discard account credentials', () => {
  const result = normalizePresetTransferPackage({ app: 'sonic-topography', version: 1, data: { neteaseCookie: 'MUSIC_U=secret' } });
  assert.equal('neteaseCookie' in result.data, false);
});

test('ordinary visitor music health endpoint remains available', async () => {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { path: 'ping' }, headers: {} }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true });
});
