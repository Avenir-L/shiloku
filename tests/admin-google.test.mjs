import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleAuth} from '../api/_lib/admin/google.js';
import {hash} from '../api/_lib/admin/auth.js';
const P='shiloku:admin:v1:';
const env={ADMIN_ORIGIN:'https://www.shiloku.cn',GOOGLE_CLIENT_ID:'client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-client-secret'};
function fixture(overrides={}){
  const values=new Map([[P+'bootstrap',hash('offline-token')]]);
  const store={async command([op,key,...args]){
    if(op==='GET')return values.get(key)||null;
    if(op==='GETDEL'){const value=values.get(key)||null;values.delete(key);return value;}
    if(op==='SET'){values.set(key,args[0]);return 'OK';}
    if(op==='EVAL'){
      const [count,...rest]=args,keys=rest.slice(0,count),[sub,mode,digest,version]=rest.slice(count);
      if((values.get(keys[3])||'initial')!==version)return 0;
      const current=values.get(keys[0]);if(current)return current===sub?1:0;
      if(mode==='bootstrap'){if(values.get(keys[1])!==digest)return 0;values.delete(keys[1]);}
      else if(mode!=='configured'&&(mode!=='session'||!values.has(keys[4])))return 0;
      values.set(keys[0],sub);values.set(keys[2],'owner');return 1;
    }
    throw new Error(op);
  }};
  let claims={sub:'owner-google-sub',email_verified:true};let received;
  const google=createGoogleAuth({env:{...env,...overrides},store,auth:{issueSession:async options=>({cookie:'owner-session-cookie',session:options})},
    fetcher:async(_url,options)=>{received=options.body;return {ok:true,json:async()=>({id_token:'signed-token'})};},
    verify:async(_token,nonce)=>({...claims,nonce})});
  const finish=async start=>{
    const url=new URL(start.url);
    return google.finish({query:{state:url.searchParams.get('state'),code:'authorization-code'},headers:{cookie:start.cookie.split(';')[0]}});
  };
  return {values,google,finish,setClaims:value=>claims=value,body:()=>received};
}
test('Google binding needs offline owner proof, then only that immutable account can sign in',async()=>{
  const f=fixture();
  await assert.rejects(()=>f.google.start({}));
  const start=await f.google.start({token:'offline-token'});
  assert.equal(new URL(start.url).origin,'https://accounts.google.com');
  assert.match(start.cookie,/HttpOnly; SameSite=Lax/);
  const result=await f.finish(start);
  assert.equal(result.cookie,'owner-session-cookie');
  assert.equal(f.values.get(P+'google-sub'),'owner-google-sub');
  assert.equal(f.values.has(P+'bootstrap'),false);
  assert.equal(f.body().get('code_verifier').length,43);
  await assert.rejects(()=>f.finish(start));
  f.setClaims({sub:'another-google-sub',email_verified:true});
  const other=await f.google.start({});
  await assert.rejects(()=>f.finish(other));
  assert.equal(f.values.get(P+'google-sub'),'owner-google-sub');
});
test('configured verified owner email can bind without bootstrap; all other accounts are denied',async()=>{
  const f=fixture({ADMIN_GOOGLE_EMAIL:'520avenir@gmail.com'});
  f.setClaims({sub:'wrong-account',email:'other@gmail.com',email_verified:true});
  const denied=await f.google.start({});
  await assert.rejects(()=>f.finish(denied));
  assert.equal(f.values.has(P+'google-sub'),false);
  f.setClaims({sub:'owner-sub',email:'520avenir@gmail.com',email_verified:false});
  await assert.rejects(async()=>f.finish(await f.google.start({})));
  f.setClaims({sub:'owner-sub',email:'520avenir@gmail.com',email_verified:true});
  const result=await f.finish(await f.google.start({}));
  assert.equal(result.cookie,'owner-session-cookie');
  assert.equal(f.values.get(P+'google-sub'),'owner-sub');
  f.setClaims({sub:'changed-sub',email:'520avenir@gmail.com',email_verified:true});
  await assert.rejects(async()=>f.finish(await f.google.start({})));
});
test('Google callback rejects missing browser binding and revoked state',async()=>{
  const f=fixture(),start=await f.google.start({token:'offline-token'}),url=new URL(start.url);
  await assert.rejects(()=>f.google.finish({query:{state:url.searchParams.get('state'),code:'code'},headers:{}}));
  f.values.set(P+'session-version','revoked');
  await assert.rejects(()=>f.finish(start));
});
test('unverified identities and missing OAuth configuration fail closed',async()=>{
  const f=fixture();f.setClaims({sub:'owner',email_verified:false});
  const start=await f.google.start({token:'offline-token'});
  await assert.rejects(()=>f.finish(start));
  const google=createGoogleAuth({env:{},store:{command:()=>{throw new Error('must not use storage')}}});
  assert.equal(google.available(),false);
  await assert.rejects(()=>google.start({}));
});
