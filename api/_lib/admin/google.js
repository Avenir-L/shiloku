import {randomBytes,createHash} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {redis,readJson,AUTH_PREFIX as P} from './store.js';
import {createAuth,expectedOrigin,hash} from './auth.js';

const GOOGLE_KEYS=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:10000});
const random=()=>randomBytes(32).toString('base64url');
const deny=message=>{throw Object.assign(new Error(message),{status:403});};
const CLAIM_GOOGLE = `
if (redis.call('GET',KEYS[4]) or 'initial')~=ARGV[4] then return 0 end
local current=redis.call('GET',KEYS[1]); if current then if current==ARGV[1] then return 1 else return 0 end end
if ARGV[2]=='bootstrap' then if redis.call('GET',KEYS[2])~=ARGV[3] then return 0 end; redis.call('DEL',KEYS[2])
elseif ARGV[2]=='session' then if redis.call('EXISTS',KEYS[5])==0 then return 0 end
else return 0 end
redis.call('SET',KEYS[1],ARGV[1]); redis.call('SET',KEYS[3],'owner'); return 1`;

async function verifyGoogle(idToken,nonce,clientId) {
  const {payload}=await jwtVerify(idToken,GOOGLE_KEYS,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],maxTokenAge:'10m'});
  if(payload.nonce!==nonce) deny('Google 验证已失效，请重试');
  if(payload.azp && payload.azp!==clientId) deny('Google 验证来源不匹配');
  return payload;
}
export function createGoogleAuth({env=process.env,store=redis,auth=createAuth({env,store}),fetcher=fetch,verify=verifyGoogle}={}) {
  const origin=expectedOrigin(env),redirectUri=origin+'/api/admin-google';
  const cookieName=origin.startsWith('https:')?'__Host-shiloku-google':'shiloku-google-local';
  const cookie=(value,maxAge=600)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin.startsWith('https:')?'; Secure':''}`;
  const available=()=>Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
  async function start({token,owner}={}) {
    if(!available()) throw Object.assign(new Error('Google 登录尚未配置 OAuth 客户端'),{status:503});
    const version=await store.command(['GET',P+'session-version'])||'initial';
    const bound=await store.command(['GET',P+'google-sub']);
    let mode='login',bootstrap,sessionId;
    if(!bound) {
      if(owner && !owner.restricted && owner.version===version && Date.now()-owner.createdAt<300000){mode='session';sessionId=owner.id;}
      else {
        bootstrap=hash(token||'');
        if(!token || await store.command(['GET',P+'bootstrap'])!==bootstrap) deny('首次绑定需要站长的一次性初始化入口');
        mode='bootstrap';
      }
    }
    const state=random(),browser=random(),nonce=random(),verifier=random();
    await store.command(['SET',P+'google-state:'+hash(state),JSON.stringify({browser:hash(browser),nonce,verifier,mode,bootstrap,sessionId,version}),'EX',600]);
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for(const [key,value]of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'openid email',state,nonce,prompt:'select_account',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(key,value);
    return {url:url.href,cookie:cookie(browser)};
  }
  async function finish(req) {
    if(!available()) throw new Error('Google login is not configured');
    const state=String(req.query?.state||''),code=String(req.query?.code||'');
    const browser=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!browser||!code||code.length>4096) deny('Google 登录请求无效');
    const pending=await readJson(store,P+'google-state:'+hash(state));
    if(!pending||pending.browser!==hash(browser))deny('请在发起登录的浏览器内完成验证');
    const raw=await store.command(['GETDEL',P+'google-state:'+hash(state)]);
    if(!raw)deny('登录请求已使用或已过期');
    const active=JSON.parse(raw);
    if(active.browser!==hash(browser))deny('浏览器验证不匹配');
    if(active.mode==='session') {
      const owner=await readJson(store,P+'session:'+active.sessionId);
      if(!owner||owner.restricted||Date.now()-owner.createdAt>300000||owner.version!==active.version)deny('请重新验证站长身份');
    }
    const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code',code,code_verifier:active.verifier}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Google authorization exchange failed');
    const tokens=await response.json();
    if(!tokens.id_token)deny('Google 未返回有效身份');
    const identity=await verify(tokens.id_token,active.nonce,env.GOOGLE_CLIENT_ID);
    if(typeof identity.sub!=='string'||!identity.sub||identity.sub.length>255||identity.email_verified!==true||identity.nonce!==active.nonce)deny('Google 账号未通过验证');
    const committed=await store.command(['EVAL',CLAIM_GOOGLE,5,P+'google-sub',P+'bootstrap',P+'owner',P+'session-version',P+'session:'+(active.sessionId||'none'),identity.sub,active.mode,active.bootstrap||'',active.version]);
    if(committed!==1)deny('此 Google 账号没有站长权限，或初始化入口已失效');
    const result=await auth.issueSession({expectedVersion:active.version});
    return {...result,clearCookie:cookie('',0)};
  }
  return {available,start,finish,clearCookie:()=>cookie('',0),async bound(){return Boolean(await store.command(['GET',P+'google-sub']));}};
}
