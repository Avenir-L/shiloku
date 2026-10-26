import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminHandler } from '../api/admin.js';
import { seal, unseal } from '../api/_lib/admin/secrets.js';
import { createAuth } from '../api/_lib/admin/auth.js';
import { testPasskey } from './helpers/passkey.mjs';

class MemoryStore {
  values = new Map();
  async command([op, key, ...args]) {
    if (op === 'GET') return this.values.get(key) ?? null;
    if (op === 'GETDEL') { const value=this.values.get(key)??null; this.values.delete(key); return value; }
    if (op === 'SET') { if(args.includes('NX') && this.values.has(key)) return null; this.values.set(key,args[0]); return 'OK'; }
    if (op === 'DEL') return Number(this.values.delete(key));
    if (op === 'INCR') { const value=Number(this.values.get(key)||0)+1; this.values.set(key,value); return value; }
    if (op === 'EXPIRE') return 1;
    if (op === 'HGETALL') return Object.entries(this.values.get(key)||{}).flat();
    if (op === 'HSET') { const value=this.values.get(key)||{}; value[args[0]]=args[1]; this.values.set(key,value); return 1; }
    if (op === 'EVAL' && args[0] === 3) {
      const [,owner,bootstrap,credentials,digest,id,record]=args;
      if(this.values.has(owner)||this.values.get(bootstrap)!==digest)return 0;
      const data=this.values.get(credentials)||{};data[id]=record;this.values.set(credentials,data);this.values.set(owner,'owner');this.values.delete(bootstrap);return 1;
    }
    if(op==='EVAL' && String(key).includes('commit-login')) {const [,credentials,version,expected,id,original,updated]=args;const data=this.values.get(credentials)||{};if((this.values.get(version)||'initial')!==expected||data[id]!==original)return 0;data[id]=updated;return 1;}
    if(op==='EVAL' && String(key).includes('rename-credential')){const [,credentials,version,expected,id,label]=args;if((this.values.get(version)||'initial')!==expected)return -1;const data=this.values.get(credentials)||{};if(!data[id])return 0;const record=JSON.parse(data[id]);record.label=label;data[id]=JSON.stringify(record);return 1;}
    if(op==='EVAL' && String(key).includes('commit-registration')) {const [,credentials,version,expected,id,record,mode,next]=args;if((this.values.get(version)||'initial')!==expected)return 0;let data=this.values.get(credentials)||{};if(mode==='recover'){data={};this.values.set(version,next);}else if(Object.keys(data).length>=8)return 0;data[id]=record;this.values.set(credentials,data);return 1;}
    if(op==='EVAL' && args[0]===2){const [,credentials,version,id,next]=args;const data=this.values.get(credentials)||{};if(Object.keys(data).length<=1||!data[id])return 0;delete data[id];this.values.set(version,next);return 1;}
    throw new Error('Unexpected operation '+op);
  }
}
function response() { return {headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this},end(){return this}}; }
const env = { ADMIN_ORIGIN:'https://www.shiloku.cn', ADMIN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64') };

test('music and guestbook admin routes reject visitors before touching services', async () => {
  let calls=0;
  const handler=createAdminHandler({auth:{session:async()=>null}, music:{status:async()=>{calls++}}});
  for(const action of ['music-status','music-qr-create','music-qr-check','music-save','guestbook','passkeys','passkey-rename','recovery-create']) {
    const res=response();
    await handler({method:'POST',headers:{origin:env.ADMIN_ORIGIN,'content-type':'application/json'},query:{action},body:{}},res);
    assert.equal(res.code,401,action);
  }
  assert.equal(calls,0);
});
test('device rename changes only the label, validates names, and rejects revoked sessions',async()=>{
 const store=new MemoryStore(),auth=createAuth({env,store});
 const record={id:'key-1',label:'通行密钥',counter:42,createdAt:123,publicKey:'public-key',backedUp:true};
 store.values.set('shiloku:admin:v1:credentials',{'key-1':JSON.stringify(record)});
 const owner={id:'session',version:'initial',createdAt:Date.now()-1800000};
 await auth.renameCredential(owner,'key-1','  我的 iPhone  ');
 assert.deepEqual((await auth.credentials())[0],{...record,label:'我的 iPhone'});
 for(const label of ['', ' ', 'x'.repeat(61),'bad\nname'])await assert.rejects(()=>auth.renameCredential(owner,'key-1',label));
 await assert.rejects(()=>auth.renameCredential(owner,'missing','新名称'));
 store.values.set('shiloku:admin:v1:session-version','revoked');
 await assert.rejects(()=>auth.renameCredential(owner,'key-1','不应保存'));
 assert.equal((await auth.credentials())[0].label,'我的 iPhone');
});

test('cross origin writes fail even with an authenticated session', async () => {
  const handler=createAdminHandler({env,auth:{session:async()=>({id:'owner'})}});
  const res=response();
  await handler({method:'POST',headers:{origin:'https://evil.example'},query:{action:'music-save'},body:{}},res);
  assert.equal(res.code,403);
});
test('QR login remains available during a valid older admin session; manual credentials still require recent verification',async()=>{
 const owner={id:'owner',createdAt:Date.now()-10*60000};let created=0,checked=0,saved=0;
 const handler=createAdminHandler({env,auth:{session:async()=>owner,rateLimit:async()=>{}},music:{createQr:async()=>{created++;return {id:'qr'}},checkQr:async()=>{checked++;return {state:'waiting'}},save:async()=>{saved++;return {}}}});
 for(const action of ['music-qr-create','music-qr-check']){const out=response();await handler({method:'POST',headers:{origin:env.ADMIN_ORIGIN,'content-type':'application/json'},query:{action},body:{}},out);assert.equal(out.code,200,action)}
 const out=response();await handler({method:'POST',headers:{origin:env.ADMIN_ORIGIN,'content-type':'application/json'},query:{action:'music-save'},body:{cookie:'MUSIC_U=test'}},out);assert.equal(out.code,403);assert.equal(created,1);assert.equal(checked,1);assert.equal(saved,0);
});

test('encrypted account records hide plaintext and detect tampering', () => {
  const record=seal('MUSIC_U=private-cookie',env.ADMIN_ENCRYPTION_KEY);
  assert.equal(JSON.stringify(record).includes('private-cookie'),false);
  assert.equal(unseal(record,env.ADMIN_ENCRYPTION_KEY),'MUSIC_U=private-cookie');
  assert.throws(()=>unseal({...record,tag:Buffer.alloc(16).toString('base64url')},env.ADMIN_ENCRYPTION_KEY));
});

test('bootstrap registration requires offline token; challenge consumed once; registration closes permanently', async () => {
  const store=new MemoryStore();
  const {createHash}=await import('node:crypto');
  const token='test-only-'+ 'x'.repeat(40);
  await store.command(['SET','shiloku:admin:v1:bootstrap',createHash('sha256').update(token).digest('hex')]);
  let verifies=0;
  const webauthn={generateRegistrationOptions:async()=>({challenge:'challenge'}),verifyRegistrationResponse:async()=>{verifies++;return {verified:true,registrationInfo:{credential:{id:'device',publicKey:new Uint8Array([1,2]),counter:0},credentialDeviceType:'multiDevice',credentialBackedUp:true}}}};
  const auth=createAuth({store,env,webauthn});
  await assert.rejects(()=>auth.registrationOptions({token:'wrong'}));
  const {requestId}=await auth.registrationOptions({token});
  await auth.registrationVerify({requestId,response:{},label:'iPhone'});
  await assert.rejects(()=>auth.registrationVerify({requestId,response:{}}));
  await assert.rejects(()=>auth.registrationOptions({token}));
  assert.equal(verifies,1);
  assert.equal([...store.values.keys()].some(k=>k.includes('guestbook')),false);
});

test('real signed passkey login enforces origin, user verification and one-use challenges',async()=>{
  const store=new MemoryStore(),auth=createAuth({store,env}),device=testPasskey();
  const {hash}=await import('../api/_lib/admin/auth.js');
  const token='test-offline-bootstrap';
  await store.command(['SET','shiloku:admin:v1:bootstrap',hash(token)]);
  const registration=await auth.registrationOptions({token});
  await auth.registrationVerify({requestId:registration.requestId,response:device.registration(registration.options,env.ADMIN_ORIGIN)});
  const login=await auth.loginOptions();
  const assertion=device.authentication(login.options,env.ADMIN_ORIGIN);
  const result=await auth.loginVerify({requestId:login.requestId,response:assertion});
  assert.match(result.cookie,/HttpOnly; SameSite=Strict/);
  assert.match(result.cookie,/; Secure/);
  const req={headers:{cookie:result.cookie.split(';')[0]}};
  assert.equal((await auth.session(req)).restricted,false);
  await assert.rejects(()=>auth.loginVerify({requestId:login.requestId,response:assertion}));
  const wrongOrigin=await auth.loginOptions();
  await assert.rejects(()=>auth.loginVerify({requestId:wrongOrigin.requestId,response:device.authentication(wrongOrigin.options,'https://evil.example')}));
  const noVerification=await auth.loginOptions();
  const invalid=device.authentication(noVerification.options,env.ADMIN_ORIGIN);
  const authData=Buffer.from(invalid.response.authenticatorData,'base64url');authData[32]=1;
  invalid.response.authenticatorData=authData.toString('base64url');
  await assert.rejects(()=>auth.loginVerify({requestId:noVerification.requestId,response:invalid}));
  await auth.logout(result.session);
  assert.equal(await auth.session(req),null);
});

test('last passkey cannot be removed; removing another device revokes all existing sessions',async()=>{
  const store=new MemoryStore(),auth=createAuth({store,env}),device=testPasskey();
  const {hash}=await import('../api/_lib/admin/auth.js');
  await store.command(['SET','shiloku:admin:v1:bootstrap',hash('bootstrap')]);
  const options=await auth.registrationOptions({token:'bootstrap'});
  const registered=device.registration(options.options,env.ADMIN_ORIGIN);
  const first=await auth.registrationVerify({requestId:options.requestId,response:registered});
  await assert.rejects(()=>auth.removeCredential(first.session,registered.id));
  const backup=testPasskey(),extra=await auth.registrationOptions({session:first.session});
  await auth.registrationVerify({requestId:extra.requestId,response:backup.registration(extra.options,env.ADMIN_ORIGIN),session:first.session});
  await auth.removeCredential(first.session,registered.id);
  assert.equal(await auth.session({headers:{cookie:first.cookie.split(';')[0]}}),null);
  assert.equal((await auth.credentials()).length,1);
});

test('revocation during login verification cannot recreate removed credentials',async()=>{
  const store=new MemoryStore();
  const credential={id:'device',publicKey:'AQI',counter:0};
  await store.command(['HSET','shiloku:admin:v1:credentials','device',JSON.stringify(credential)]);
  await store.command(['SET','shiloku:admin:v1:owner','owner']);
  const webauthn={generateAuthenticationOptions:async()=>({challenge:'challenge'}),verifyAuthenticationResponse:async()=>{
    store.values.set('shiloku:admin:v1:credentials',{});
    store.values.set('shiloku:admin:v1:session-version','revoked');
    return {verified:true,authenticationInfo:{newCounter:1}};
  }};
  const auth=createAuth({store,env,webauthn}),options=await auth.loginOptions();
  await assert.rejects(()=>auth.loginVerify({requestId:options.requestId,response:{id:'device'}}));
  assert.equal((await auth.credentials()).length,0);
});

test('recovery enrollment works at the device limit and replaces lost devices',async()=>{
  const store=new MemoryStore(),auth=createAuth({store,env}),device=testPasskey();
  await store.command(['SET','shiloku:admin:v1:owner','owner']);
  for(let i=0;i<8;i++)await store.command(['HSET','shiloku:admin:v1:credentials','old-'+i,JSON.stringify({id:'old-'+i,publicKey:'AQI',counter:0})]);
  const recovery={id:'restricted-session',createdAt:Date.now(),restricted:true,version:'initial'};
  const options=await auth.registrationOptions({session:recovery});
  const result=await auth.registrationVerify({requestId:options.requestId,response:device.registration(options.options,env.ADMIN_ORIGIN),session:recovery});
  assert.equal(result.session.restricted,false);
  assert.equal((await auth.credentials()).length,1);
});
