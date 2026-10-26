import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptWeapi,createQrLoginImage,createQrLoginKey} from '../api/_lib/netease/weapi.js';

test('NetEase encryption produces valid AES/RSA request payloads',()=>{
  const result=encryptWeapi({type:1});
  assert.match(result.params,/^[A-Za-z0-9+/]+=*$/);
  assert.equal(result.encSecKey.length,256);
});
test('QR transport errors report a safe upstream failure instead of a generic configuration error',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Object.assign(new TypeError('fetch failed'),{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}})});
 await assert.rejects(()=>createQrLoginKey(),e=>e.status===504&&e.phase==='qr-key'&&e.code==='NETEASE_TIMEOUT'&&/网易云/.test(e.message));
});
test('non-JSON upstream responses retain only safe diagnostics',async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:403,headers:new Headers(),json:async()=>{throw Error('HTML with secret=private')}}));
 await assert.rejects(()=>createQrLoginKey(),e=>e.status===502&&e.upstreamStatus===403&&!e.message.includes('private'));
});
test('NetEase QR URL is generated locally without a nonexistent upstream create endpoint',async()=>{
  assert.equal(await createQrLoginImage('key-test'),'https://music.163.com/login?codekey=key-test');
});
