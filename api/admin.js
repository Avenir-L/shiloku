import {createAuth,expectedOrigin} from './_lib/admin/auth.js';
import {createMusic} from './_lib/admin/music-account.js';
import {redis} from './_lib/admin/store.js';
import {validateNeteaseCookie} from './_lib/netease/lib.js';
import {createQrLoginSession,checkQrLogin} from './_lib/netease/weapi.js';
import {createGoogleAuth} from './_lib/admin/google.js';
import {createAnalytics} from './_lib/analytics.js';
import {createSiteContent} from './_lib/site-content.js';
import {createSpace} from './_lib/space.js';
import {resolveShare} from './_lib/share-links.js';

export function createAdminHandler({env=process.env,store=redis,auth=createAuth({store,env}),music=createMusic({store,env,provider:{validateNeteaseCookie,createQrLoginSession,checkQrLogin}}),google=createGoogleAuth({env,store,auth}),analytics=createAnalytics({store}),content=createSiteContent({store}),space=createSpace({store}),shareResolver=resolveShare}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const action=String(req.query?.action||'session');
    const origin=expectedOrigin(env);
    if(req.method!=='POST' && req.method!=='GET') return res.status(405).json({error:'不支持的请求方法'});
    if(req.method==='POST' && req.headers.origin!==origin) return res.status(403).json({error:'请求来源不受信任'});
    if(req.method==='GET' && action!=='session') return res.status(405).json({error:'此操作需要 POST'});
    if(req.method==='POST' && !String(req.headers['content-type']||'').startsWith('application/json')) return res.status(415).json({error:'需要 JSON 请求'});
    try {
      const owner=await auth.session(req);
      if(action==='session') return res.status(200).json({authenticated:Boolean(owner)&&!owner.restricted,recoveryOnly:Boolean(owner?.restricted),initialized:await auth.initialized(),passkeyAvailable:(await auth.credentials()).length>0,googleAvailable:google.available(),googleBound:await google.bound()});
      const publicActions=['login-options','login-verify','register-options','register-verify','recover','google-start'];
      if(!owner && !publicActions.includes(action)) return res.status(401).json({error:'请先使用站长通行密钥登录'});
      if(owner?.restricted && !['register-options','register-verify','logout'].includes(action)) return res.status(403).json({error:'请先登记新的通行密钥'});
      await auth.rateLimit(req);
      const body=req.body||{};
      const bodyLimit=action==='content-upload'?810000:action==='content-save'||action==='space-save'?120000:24000;
      if(JSON.stringify(body).length>bodyLimit) return res.status(413).json({error:'请求内容过大'});
      let result;
      switch(action) {
        case 'space-list': return res.status(200).json(await space.list({admin:true,offset:Number(body.offset||0)}));
        case 'space-save': return res.status(200).json(await space.save(body));
        case 'space-delete': return res.status(200).json(await space.remove(body.id,body.revision));
        case 'space-resolve': return res.status(200).json(await shareResolver(body.url));
        case 'content-get': return res.status(200).json(await content.read());
        case 'content-save': return res.status(200).json(await content.save(body));
        case 'content-upload': return res.status(200).json(await content.upload(body));
        case 'analytics': return res.status(200).json(await analytics.summary(Number(body.range||7)));
        case 'google-start': {
          const result=await google.start({token:body.token,owner});
          res.setHeader('Set-Cookie',result.cookie);
          return res.status(200).json({url:result.url});
        }
        case 'login-options': result=await auth.loginOptions(); break;
        case 'login-verify': result=await auth.loginVerify(body); break;
        case 'register-options': result=await auth.registrationOptions({...body,session:owner}); break;
        case 'register-verify': result=await auth.registrationVerify({...body,session:owner}); break;
        case 'recover': result=await auth.recover(body); break;
        case 'logout': res.setHeader('Set-Cookie',await auth.logout(owner)); return res.status(200).json({ok:true});
        case 'passkeys': return res.status(200).json({credentials:(await auth.credentials()).map(({id,label,createdAt,backedUp})=>({id,label,createdAt,backedUp}))});
        case 'passkey-remove': result=await auth.removeCredential(owner,body.id); break;
        case 'passkey-rename': result=await auth.renameCredential(owner,body.id,body.label); break;
        case 'recovery-create': result=await auth.recoveryCreate(owner); break;
        case 'music-status': result=await music.status(); break;
        case 'music-save':
        case 'music-qr-create':
        case 'music-qr-check': {
          // QR login already requires a valid owner session and phone authorization;
          // only manual credential replacement requires a recent admin verification.
          if(action==='music-save' && Date.now()-owner.createdAt>300000) return res.status(403).json({error:'请重新登录后修改音乐账号'});
          result=action==='music-save'?await music.save(body.cookie):action==='music-qr-create'?await music.createQr(owner):await music.checkQr(body.id,owner);
          break;
        }
        case 'guestbook': {
          // Read-only by construction. No guestbook mutation command exists in this router.
          const rows=await store.command(['ZREVRANGE','shiloku:guestbook:v1',0,79]);
          return res.status(200).json({messages:rows.map(row=>JSON.parse(row))});
        }
        default: return res.status(404).json({error:'未知管理操作'});
      }
      if(result?.cookie) {
        res.setHeader('Set-Cookie',result.cookie);
        return res.status(200).json({ok:true});
      }
      return res.status(200).json(result);
    } catch(error) {
      if(action.startsWith('music-') && (!error.status||error.status>=500))console.error('admin-music-upstream',{action,name:error.name,code:error.code||'UNCLASSIFIED',phase:error.phase||'admin',upstreamStatus:error.upstreamStatus,upstreamCode:error.upstreamCode});
      return res.status(error.status||503).json({error:error.status?error.message:'服务暂时不可用，请检查配置或稍后重试'});
    }
  };
}
export default createAdminHandler();
