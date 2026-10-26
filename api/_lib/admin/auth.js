import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import * as webauthnLibrary from '@simplewebauthn/server';
import {redis,readJson,AUTH_PREFIX as P} from './store.js';

export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
const INITIALIZE_OWNER_SCRIPT = `
if redis.call('EXISTS',KEYS[1])==1 or redis.call('GET',KEYS[2])~=ARGV[1] then return 0 end
redis.call('HSET',KEYS[3],ARGV[2],ARGV[3]); redis.call('SET',KEYS[1],'owner'); redis.call('DEL',KEYS[2]); return 1`;
const COMMIT_LOGIN_SCRIPT = `-- commit-login
if (redis.call('GET',KEYS[2]) or 'initial')~=ARGV[1] or redis.call('HGET',KEYS[1],ARGV[2])~=ARGV[3] then return 0 end
redis.call('HSET',KEYS[1],ARGV[2],ARGV[4]); return 1`;
const COMMIT_REGISTRATION_SCRIPT = `-- commit-registration
if (redis.call('GET',KEYS[2]) or 'initial')~=ARGV[1] then return 0 end
if ARGV[4]=='recover' then redis.call('DEL',KEYS[1]); redis.call('SET',KEYS[2],ARGV[5])
elseif redis.call('HLEN',KEYS[1])>=8 then return 0 end
redis.call('HSET',KEYS[1],ARGV[2],ARGV[3]); return 1`;
const fail=message=>{throw Object.assign(new Error(message),{status:403});};
export function expectedOrigin(env=process.env) {
  return env.ADMIN_ORIGIN || 'https://www.shiloku.cn';
}
export function createAuth({store=redis,env=process.env,webauthn=webauthnLibrary}={}) {
  const origin=expectedOrigin(env), rpID=new URL(origin).hostname;
  const cookieName=origin.startsWith('https:')?'__Host-shiloku-admin':'shiloku-admin-local';
  const cookie=(value,maxAge=3600)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin.startsWith('https:')?'; Secure':''}`;
  async function credentials() {
    const rows=await store.command(['HGETALL',P+'credentials']);
    const result=[];
    for(let i=0;i<rows.length;i+=2) result.push(JSON.parse(rows[i+1]));
    return result;
  }
  async function issueSession({restricted=false,expectedVersion}={}) {
    const current=await store.command(['GET',P+'session-version']) || 'initial';
    if(expectedVersion && expectedVersion!==current) fail('身份状态已改变，请重新登录');
    const version=expectedVersion || current;
    const token=random(), session={id:hash(token),createdAt:Date.now(),restricted,version};
    await store.command(['SET',P+'session:'+session.id,JSON.stringify(session),'EX',3600]);
    return {session,cookie:cookie(token)};
  }
  async function session(req) {
    const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if(!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const value=await readJson(store,P+'session:'+hash(token));
    if(!value) return null;
    const version=await store.command(['GET',P+'session-version']) || 'initial';
    return value.version===version ? value : null;
  }
  async function challenge(kind,value) {
    const id=random();
    await store.command(['SET',P+'challenge:'+id,JSON.stringify({kind,...value}),'EX',300]);
    return id;
  }
  async function consume(id,kind) {
    if(!/^[A-Za-z0-9_-]{43}$/.test(String(id))) fail('验证请求无效');
    const raw=await store.command(['GETDEL',P+'challenge:'+id]);
    const pending=raw ? JSON.parse(raw):null;
    if(!pending || pending.kind!==kind) fail('验证已过期，请重试');
    return pending;
  }
  async function registrationOptions({token,session:owner}={}) {
    const initialized=Boolean(await store.command(['GET',P+'owner']));
    let bootstrap=null;
    if(initialized) {
      if(!owner || Date.now()-owner.createdAt>300000) fail('请重新验证身份后添加通行密钥');
    } else {
      const expected=await store.command(['GET',P+'bootstrap']);
      bootstrap=hash(token||'');
      if(!expected || !timingSafeEqual(Buffer.from(bootstrap),Buffer.from(expected))) fail('需要本机生成的一次性初始化凭证');
    }
    const existing=await credentials();
    if(existing.length>=8 && !owner?.restricted) fail('最多登记 8 个通行密钥');
    const options=await webauthn.generateRegistrationOptions({
      rpName:'Shiloku 管理后台',rpID,userName:'Shiloku',userDisplayName:'Shiloku',
      userID:new Uint8Array(Buffer.from('shiloku-owner')),
      attestationType:'none',excludeCredentials:existing.map(c=>({id:c.id,transports:c.transports})),
      supportedAlgorithmIDs:[-7,-257],
      authenticatorSelection:{residentKey:'required',userVerification:'required'},
    });
    return {options,requestId:await challenge('register',{challenge:options.challenge,bootstrap,sessionId:owner?.id,sessionVersion:owner?.version})};
  }
  async function registrationVerify({requestId,response,label,session:owner}={}) {
    const pending=await consume(requestId,'register');
    if(pending.bootstrap) {
      if(await store.command(['GET',P+'owner']) || await store.command(['GET',P+'bootstrap'])!==pending.bootstrap) fail('初始化入口已关闭');
    } else if(!owner || owner.id!==pending.sessionId || Date.now()-owner.createdAt>300000) fail('请重新验证身份');
    const result=await webauthn.verifyRegistrationResponse({response,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});
    if(!result.verified) fail('通行密钥验证失败');
    const {credential,credentialDeviceType,credentialBackedUp}=result.registrationInfo;
    const record={id:credential.id,publicKey:Buffer.from(credential.publicKey).toString('base64url'),counter:credential.counter,
      transports:response.response?.transports||[],label:String(label||'通行密钥').slice(0,60),createdAt:Date.now(),deviceType:credentialDeviceType,backedUp:credentialBackedUp};
    let nextVersion;
    if(pending.bootstrap) {
      const claimed=await store.command(['EVAL',INITIALIZE_OWNER_SCRIPT,3,P+'owner',P+'bootstrap',P+'credentials',pending.bootstrap,record.id,JSON.stringify(record)]);
      if(claimed!==1) fail('初始化入口已关闭');
    } else {
      nextVersion=owner.restricted ? random() : pending.sessionVersion;
      const committed=await store.command(['EVAL',COMMIT_REGISTRATION_SCRIPT,2,P+'credentials',P+'session-version',pending.sessionVersion,record.id,JSON.stringify(record),owner.restricted?'recover':'add',nextVersion]);
      if(committed!==1) fail('身份状态已改变或设备数量已达上限，请重新登录');
    }
    if(owner?.restricted) await store.command(['DEL',P+'session:'+owner.id]);
    return issueSession({expectedVersion:nextVersion});
  }
  async function loginOptions() {
    if(!await store.command(['GET',P+'owner'])) fail('尚未完成站长初始化');
    const options=await webauthn.generateAuthenticationOptions({rpID,userVerification:'required'});
    return {options,requestId:await challenge('login',{challenge:options.challenge})};
  }
  async function loginVerify({requestId,response}={}) {
    const pending=await consume(requestId,'login');
    const version=await store.command(['GET',P+'session-version']) || 'initial';
    const credential=(await credentials()).find(c=>c.id===response?.id);
    if(!credential) fail('这不是已登记的站长通行密钥');
    const original=JSON.stringify(credential);
    const result=await webauthn.verifyAuthenticationResponse({response,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,
      credential:{...credential,publicKey:new Uint8Array(Buffer.from(credential.publicKey,'base64url'))}});
    if(!result.verified) fail('通行密钥验证失败');
    credential.counter=result.authenticationInfo.newCounter;
    const committed=await store.command(['EVAL',COMMIT_LOGIN_SCRIPT,2,P+'credentials',P+'session-version',version,credential.id,original,JSON.stringify(credential)]);
    if(committed!==1) fail('设备或身份状态已改变，请重新登录');
    return issueSession({expectedVersion:version});
  }
  async function recoveryCreate(owner) {
    if(Date.now()-owner.createdAt>300000) fail('请重新验证身份后生成恢复码');
    const codes=Array.from({length:5},random);
    await store.command(['SET',P+'recovery',JSON.stringify(codes.map(hash))]);
    return {codes};
  }
  async function recover({code}={}) {
    const digest=hash(code||'');
    // Atomic check-and-remove prevents replay across instances.
    const result=await store.command(['EVAL',`local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local a=cjson.decode(raw); for i,v in ipairs(a) do if v==ARGV[1] then table.remove(a,i); redis.call('SET',KEYS[1],cjson.encode(a)); return 1 end end; return 0`,1,P+'recovery',digest]);
    if(result!==1) fail('恢复码无效或已使用');
    return issueSession({restricted:true});
  }
  async function removeCredential(owner,id) {
    if(Date.now()-owner.createdAt>300000) fail('请重新验证身份后移除设备');
    if(typeof id!=='string'||id.length>2048) fail('设备标识无效');
    const result=await store.command(['EVAL',`if redis.call('HLEN',KEYS[1])<=1 or redis.call('HEXISTS',KEYS[1],ARGV[1])==0 then return 0 end; redis.call('HDEL',KEYS[1],ARGV[1]); redis.call('SET',KEYS[2],ARGV[2]); return 1`,2,P+'credentials',P+'session-version',id,random()]);
    if(result!==1) fail('至少需要保留一个可用通行密钥');
    return {ok:true,sessionsRevoked:true};
  }
  return {session,credentials,registrationOptions,registrationVerify,loginOptions,loginVerify,recoveryCreate,recover,removeCredential,issueSession,
    async initialized(){return Boolean(await store.command(['GET',P+'owner']));},
    async logout(owner){if(owner) await store.command(['DEL',P+'session:'+owner.id]); return cookie('',0);},
    async rateLimit(req){
      const ip=env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
      const key=P+'rate:'+hash(ip||'unknown')+':'+Math.floor(Date.now()/60000);
      const count=await store.command(['INCR',key]);
      if(count===1) await store.command(['EXPIRE',key,120]);
      if(count>40) throw Object.assign(new Error('请求过于频繁，请稍后再试'),{status:429});
    }};
}
