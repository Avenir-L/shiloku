import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptWeapi,createQrLoginImage,createQrLoginKey,createQrLoginSession,checkQrLogin} from '../api/_lib/netease/weapi.js';
import {createDecipheriv,createHash} from 'node:crypto';

test('QR uses matching client protocol and preserves its identity and upstream cookies',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const decipher=createDecipheriv('aes-128-ecb',Buffer.from('e82ckenh8dichen8'),null);
  const plain=Buffer.concat([decipher.update(Buffer.from(options.body.get('params'),'hex')),decipher.final()]).toString();
  const [path,text,digest]=plain.split('-36cd479b6b5-');
  assert.equal(digest,createHash('md5').update(`nobody${path}use${text}md5forencrypt`).digest('hex'));
  const payload=JSON.parse(text);assert.equal(payload.type,3);
  assert.ok(url.startsWith('https://interfacepc.music.163.com/eapi/login/qrcode/'));
  calls.push({payload,cookie:options.headers.Cookie});
  return {ok:true,json:async()=>calls.length===1?{code:200,unikey:'test-key'}:{code:801},headers:new Headers({'set-cookie':calls.length===1?'NMTID=server-session; Path=/':'__csrf=next; Path=/'})};
 });
 const session=await createQrLoginSession();
 assert.ok(session.cookie.includes('NMTID=server-session'));
 const result=await checkQrLogin(session.key,session.cookie);
 assert.equal(calls[0].payload.header.deviceId,calls[1].payload.header.deviceId);
 assert.ok(calls[1].cookie.includes('NMTID=server-session'));
 assert.ok(result.cookie.includes('__csrf=next'));
});

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
