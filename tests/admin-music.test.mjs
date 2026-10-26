import test from 'node:test';
import assert from 'node:assert/strict';
import {createMusic,readMusicCookie} from '../api/_lib/admin/music-account.js';
import {MUSIC_KEY} from '../api/_lib/admin/store.js';

test('QR success persists encrypted account, is session-bound and never returns cookie',async()=>{
  const values=new Map([['shiloku:guestbook:v1','existing-two-messages']]);
  const store={async command([op,key,value]){if(op==='GET')return values.get(key)||null;if(op==='SET'){values.set(key,value);return 'OK'}if(op==='DEL'){values.delete(key);return 1}throw new Error(op)}};
  const env={ADMIN_ENCRYPTION_KEY:Buffer.alloc(32,4).toString('base64'),NETEASE_COOKIE:'MUSIC_U=old'};
  let code=801;
  const provider={createQrLoginSession:async()=>({key:'upstream-key',qrUrl:'https://music.163.com/login?codekey=test'}),checkQrLogin:async()=>({code,cookie:code===803?'MUSIC_U=new-private':''}),validateNeteaseCookie:async()=>({valid:true,nickname:'Owner'})};
  const music=createMusic({store,env,provider});
  const owner={id:'owner-session'};
  const qr=await music.createQr(owner);
  await assert.rejects(()=>music.checkQr(qr.id,{id:'different-session'}));
  assert.equal((await music.checkQr(qr.id,owner)).state,'waiting');
  code=803;
  const result=await music.checkQr(qr.id,owner);
  assert.equal(result.state,'success');
  assert.equal(JSON.stringify(result).includes('MUSIC_U'),false);
  assert.equal(values.get(MUSIC_KEY).includes('new-private'),false);
  assert.equal(await readMusicCookie({store,env}),'MUSIC_U=new-private');
  await assert.rejects(()=>music.checkQr(qr.id,owner));
  assert.equal(values.get('shiloku:guestbook:v1'),'existing-two-messages');
});

test('invalid manual update preserves existing account and storage outage never falls back silently',async()=>{
  const env={ADMIN_ENCRYPTION_KEY:Buffer.alloc(32,4).toString('base64'),NETEASE_COOKIE:'old'};
  let writes=0;
  const store={async command([op]){if(op==='SET')writes++;throw new Error('unavailable')}};
  const music=createMusic({store,env,provider:{validateNeteaseCookie:async()=>({valid:false})}});
  await assert.rejects(()=>music.save('invalid'));
  assert.equal(writes,0);
  await assert.rejects(()=>readMusicCookie({store,env}));
});
test('unexpected QR provider states preserve pending session and return safe classified errors',async()=>{
 const values=new Map(),store={command:async([op,key,value])=>op==='SET'?(values.set(key,value),'OK'):values.get(key)};
 const music=createMusic({store,env:{},provider:{createQrLoginSession:async()=>({key:'private-qr-key',qrUrl:'https://music.163.com/login'}),checkQrLogin:async()=>({code:503,cookie:''})}});
 const owner={id:'owner'},qr=await music.createQr(owner);
 await assert.rejects(()=>music.checkQr(qr.id,owner),e=>e.status===502&&e.code==='NETEASE_QR_STATE'&&e.upstreamCode===503&&!e.message.includes('private-qr-key'));
 assert.equal(values.size,1);
});
test('NetEase verification challenge is terminal and never overwrites the music account',async()=>{
 const values=new Map(),store={command:async([op,key,value])=>op==='SET'?(values.set(key,value),'OK'):values.get(key)};
 const music=createMusic({store,env:{},provider:{createQrLoginSession:async()=>({key:'private-key',qrUrl:'https://music.163.com/login'}),checkQrLogin:async()=>({code:8821,cookie:'private-cookie',data:{redirectUrl:'https://untrusted.example/private'}})}});
 const owner={id:'owner'},qr=await music.createQr(owner);
 await assert.rejects(()=>music.checkQr(qr.id,owner),e=>e.status===422&&e.code==='NETEASE_VERIFICATION_REQUIRED'&&e.upstreamCode===8821&&e.message.includes('安全验证')&&!e.message.includes('private'));
 assert.equal(values.has(MUSIC_KEY),false);
});
test('QR session cookies remain encrypted and refreshed between owner-bound polls without extending expiry',async()=>{
 const values=new Map(),writes=[];
 const store={command:async args=>{const [op,key,value]=args;if(op==='SET'){writes.push(args);values.set(key,value);return 'OK'}return values.get(key)}};
 const env={ADMIN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};let polls=0;
 const music=createMusic({store,env,provider:{createQrLoginSession:async()=>({key:'key',qrUrl:'https://music.163.com/login',cookie:'NMTID=private-session'}),checkQrLogin:async(key,cookie)=>{assert.equal(cookie,polls++?'NMTID=private-next':'NMTID=private-session');return {code:801,cookie:'NMTID=private-next'}}}});
 const owner={id:'owner'},qr=await music.createQr(owner);
 assert.ok(!JSON.stringify([...values]).includes('private-session'));
 await music.checkQr(qr.id,owner);await music.checkQr(qr.id,owner);
 assert.ok(!JSON.stringify([...values]).includes('private-next'));
 assert.equal(writes[1].at(-1),'KEEPTTL');
});
