import {redis,readJson,MUSIC_KEY,AUTH_PREFIX} from './store.js';
import {seal,unseal} from './secrets.js';
import {randomBytes} from 'node:crypto';

export async function readMusicCookie({store=redis,env=process.env}={}) {
  // Existing deployments continue working until owner management is configured.
  if(!env.ADMIN_ENCRYPTION_KEY) return env.NETEASE_COOKIE || '';
  const record=await readJson(store,MUSIC_KEY);
  if(!record) return env.NETEASE_COOKIE || '';
  return unseal(record.secret,env.ADMIN_ENCRYPTION_KEY);
}

export function createMusic({store=redis,env=process.env,provider}={}) {
  async function status() {
    const record=await readJson(store,MUSIC_KEY);
    const cookie=await readMusicCookie({store,env});
    if(!cookie) return {hasCookie:false,valid:false,updatedAt:record?.updatedAt||null};
    const account=await provider.validateNeteaseCookie(cookie);
    return {hasCookie:true,valid:account.valid,nickname:account.nickname||'',updatedAt:record?.updatedAt||null,source:record?'admin':'deployment'};
  }
  async function save(cookie) {
    if(typeof cookie!=='string' || cookie.length>16000 || !cookie.trim()) throw Object.assign(new Error('请提供有效登录信息'),{status:400});
    const account=await provider.validateNeteaseCookie(cookie);
    if(!account.valid) throw Object.assign(new Error('网易云登录未通过验证，原登录信息未被覆盖'),{status:400});
    const record={secret:seal(cookie,env.ADMIN_ENCRYPTION_KEY),updatedAt:Date.now()};
    await store.command(['SET',MUSIC_KEY,JSON.stringify(record)]);
    return {valid:true,hasCookie:true,nickname:account.nickname||'',updatedAt:record.updatedAt};
  }
  return {status,save,
    async createQr(owner) {
      const session=await provider.createQrLoginSession();
      const id=randomBytes(24).toString('base64url');
      await store.command(['SET',AUTH_PREFIX+'qr:'+id,JSON.stringify({key:session.key,sessionId:owner.id}),'EX',180]);
      return {id,qrUrl:session.qrUrl};
    },
    async checkQr(id,owner) {
      if(!/^[A-Za-z0-9_-]{32}$/.test(String(id))) throw Object.assign(new Error('二维码无效'),{status:400});
      const key=AUTH_PREFIX+'qr:'+id;
      const pending=await readJson(store,key);
      if(!pending || pending.sessionId!==owner.id) throw Object.assign(new Error('二维码已过期，请重新生成'),{status:403});
      const result=await provider.checkQrLogin(pending.key);
      if(result.code===803 && result.cookie) {
        const saved=await save(result.cookie);
        await store.command(['DEL',key]);
        return {state:'success',...saved};
      }
      if(result.code===800) {await store.command(['DEL',key]);return {state:'expired'};}
      if(![801,802].includes(result.code)) throw new Error('网易云扫码状态暂时不可用');
      return {state:result.code===802?'scanned':'waiting'};
    },
  };
}
