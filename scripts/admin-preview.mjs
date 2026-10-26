// Isolated local preview: synthetic messages/music and an in-memory auth store.
// It never reads production Redis or credentials and is not a production server.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createAdminHandler} from '../api/admin.js';
import {createMusic} from '../api/_lib/admin/music-account.js';
import {hash,createAuth} from '../api/_lib/admin/auth.js';
import {createGoogleAuth} from '../api/_lib/admin/google.js';
import {createGoogleCallback} from '../api/admin-google.js';
import {AUTH_PREFIX as P} from '../api/_lib/admin/store.js';
const previewAnalytics={async summary(range=7){
  if(![1,7,30].includes(range))throw Object.assign(new Error('不支持的统计范围'),{status:400});
  const days=Array.from({length:range},(_,i)=>{const pv=18+(i*13)%47;return {date:new Date(Date.now()+8*3600000-(range-1-i)*86400000).toISOString().slice(0,10),pv,uv:Math.round(pv*.65),home:pv-4,music:4}});
  return {demo:true,range,days,pv:days.reduce((n,d)=>n+d.pv,0),uv:Math.round(days.reduce((n,d)=>n+d.uv,0)*.8),home:days.reduce((n,d)=>n+d.home,0),music:range*4,direct:range*15,search:range*4,social:range*3,other:range,desktop:range*14,mobile:range*8,tablet:range};
}};

const port=8785;
const env={ADMIN_ORIGIN:`http://localhost:${port}`,ADMIN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET,ADMIN_GOOGLE_EMAIL:process.env.ADMIN_GOOGLE_EMAIL};
const values=new Map(),expires=new Map();
const store={async command([op,key,...args]){
  if(expires.get(key)<Date.now()){values.delete(key);expires.delete(key);}
  if(op==='GET')return values.get(key)??null;
  if(op==='GETDEL'){const value=values.get(key)??null;values.delete(key);return value;}
  if(op==='SET'){if(args.includes('NX')&&values.has(key))return null;values.set(key,args[0]);const i=args.indexOf('EX');if(i>=0)expires.set(key,Date.now()+Number(args[i+1])*1000);return 'OK';}
  if(op==='DEL')return Number(values.delete(key));
  if(op==='INCR'){const value=Number(values.get(key)||0)+1;values.set(key,value);return value;}
  if(op==='EXPIRE'){expires.set(key,Date.now()+Number(args[0])*1000);return 1;}
  if(op==='HGETALL')return Object.entries(values.get(key)||{}).flat();
  if(op==='HSET'){const value=values.get(key)||{};value[args[0]]=args[1];values.set(key,value);return 1;}
  if(op==='ZREVRANGE')return [JSON.stringify({id:'preview-1',name:'本地演示',message:'此处为模拟留言，不连接线上两条留言。',time:Date.now()})];
  if(op==='EVAL'){
    if(args[0]===5){const [,subject,bootstrap,owner,version,sessionId,sub,mode,digest,expected]=args;if((values.get(version)||'initial')!==expected)return 0;const current=values.get(subject);if(current)return current===sub?1:0;if(mode==='bootstrap'){if(values.get(bootstrap)!==digest)return 0;values.delete(bootstrap);}else if(mode!=='configured'&&(mode!=='session'||!values.has(sessionId)))return 0;values.set(subject,sub);values.set(owner,'owner');return 1;}
    if(String(key).includes('commit-login')){const [,credentials,version,expected,id,original,updated]=args;const data=values.get(credentials)||{};if((values.get(version)||'initial')!==expected||data[id]!==original)return 0;data[id]=updated;return 1;}
    if(String(key).includes('commit-registration')){const [,credentials,version,expected,id,record,mode,next]=args;if((values.get(version)||'initial')!==expected)return 0;let data=values.get(credentials)||{};if(mode==='recover'){data={};values.set(version,next);}else if(Object.keys(data).length>=8)return 0;data[id]=record;values.set(credentials,data);return 1;}
    if(args[0]===3){const [,owner,bootstrap,credentials,digest,id,record]=args;if(values.has(owner)||values.get(bootstrap)!==digest)return 0;const data=values.get(credentials)||{};data[id]=record;values.set(credentials,data);values.set(owner,'owner');values.delete(bootstrap);return 1;}
    if(args[0]===2){const [,credentials,version,id,next]=args;const data=values.get(credentials)||{};if(Object.keys(data).length<=1||!data[id])return 0;delete data[id];values.set(version,next);return 1;}
    const recoveryKey=args[1],digest=args[2],codes=JSON.parse(values.get(recoveryKey)||'[]');
    if(!codes.includes(digest))return 0;
    values.set(recoveryKey,JSON.stringify(codes.filter(x=>x!==digest)));return 1;
  }
  throw new Error('Unsupported preview operation');
}};
const token=randomBytes(32).toString('base64url');await store.command(['SET',P+'bootstrap',hash(token),'EX',1800]);
const provider={validateNeteaseCookie:async cookie=>({valid:cookie.startsWith('MUSIC_U='),nickname:'本地演示账号'}),
  createQrLoginSession:async()=>({key:'preview',qrUrl:'https://music.163.com/'}),checkQrLogin:async()=>({code:801,cookie:''})};
const auth=createAuth({env,store}),google=createGoogleAuth({env,store,auth});
const handler=createAdminHandler({env,store,auth,google,analytics:previewAnalytics,music:createMusic({store,env,provider})});
const googleCallback=createGoogleCallback({google});
const root=new URL('../',import.meta.url);
await mkdir(new URL('../.scratch/admin/',import.meta.url),{recursive:true});
await writeFile(new URL('../.scratch/admin/local-preview.json',import.meta.url),JSON.stringify({origin:env.ADMIN_ORIGIN,token}),{mode:0o600});
createServer(async(req,res)=>{
  const url=new URL(req.url,env.ADMIN_ORIGIN);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Frame-Options','DENY');
  // Loopback-only demo entrance; this file is never a deployed API route.
  if(url.pathname==='/admin/preview') {
    const result=await auth.issueSession();
    res.setHeader('Set-Cookie',result.cookie);
    res.writeHead(303,{Location:'/admin/#overview'}).end();return;
  }
  if(url.pathname==='/api/admin'||url.pathname==='/api/admin-google') {
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>24000){res.writeHead(413).end();return;}chunks.push(chunk);}
    try{req.body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{res.writeHead(400).end();return;}
    req.query=Object.fromEntries(url.searchParams);
    res.status=function(code){this.statusCode=code;return this;};
    res.json=function(data){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(data));return this;};
    await (url.pathname==='/api/admin-google'?googleCallback:handler)(req,res);return;
  }
  const path=url.pathname==='/'||url.pathname==='/admin/'||url.pathname==='/admin'?'/admin/index.html':url.pathname;
  if(!['/admin/index.html','/admin/admin.css','/admin/admin.js','/admin/login-background.webp','/assets/admin-sky-desktop-20261026.avif','/assets/admin-sky-desktop-20261026.webp','/assets/admin-sky-mobile-20261026.avif','/assets/admin-sky-mobile-20261026.webp'].includes(path)){res.writeHead(404).end();return;}
  try{
    let data=await readFile(new URL('.'+path,root));
    if(path.endsWith('.html'))data=Buffer.from(data.toString().replace('<body>','<body><div style="padding:8px;text-align:center;background:#423850;color:#fff;font-size:12px">本地隔离预览 · 模拟音乐与留言，不连接线上数据</div>'));
    res.setHeader('Content-Type',path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':path.endsWith('.webp')?'image/webp':path.endsWith('.avif')?'image/avif':'text/javascript');res.end(data);
  }catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log(`Isolated admin preview: ${env.ADMIN_ORIGIN}/admin/ (setup stored privately in .scratch/admin/local-preview.json)`));
