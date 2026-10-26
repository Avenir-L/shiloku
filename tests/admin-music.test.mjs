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
