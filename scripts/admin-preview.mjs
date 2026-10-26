// Isolated local preview: synthetic messages/music and an in-memory auth store.
// It never reads production Redis or credentials and is not a production server.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createAdminHandler} from '../api/admin.js';
import {createMusic} from '../api/_lib/admin/music-account.js';
import {hash} from '../api/_lib/admin/auth.js';
import {AUTH_PREFIX as P} from '../api/_lib/admin/store.js';

const port=8785;
const env={ADMIN_ORIGIN:`http://localhost:${port}`,ADMIN_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
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
const handler=createAdminHandler({env,store,music:createMusic({store,env,provider})});
const root=new URL('../',import.meta.url);
await mkdir(new URL('../.scratch/admin/',import.meta.url),{recursive:true});
await writeFile(new URL('../.scratch/admin/local-preview.json',import.meta.url),JSON.stringify({origin:env.ADMIN_ORIGIN,token}),{mode:0o600});
createServer(async(req,res)=>{
  const url=new URL(req.url,env.ADMIN_ORIGIN);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Frame-Options','DENY');
  if(url.pathname==='/api/admin') {
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>24000){res.writeHead(413).end();return;}chunks.push(chunk);}
    try{req.body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{res.writeHead(400).end();return;}
    req.query=Object.fromEntries(url.searchParams);
    res.status=function(code){this.statusCode=code;return this;};
    res.json=function(data){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(data));return this;};
    await handler(req,res);return;
  }
  const path=url.pathname==='/'||url.pathname==='/admin/'||url.pathname==='/admin'?'/admin/index.html':url.pathname;
  if(!['/admin/index.html','/admin/admin.css','/admin/admin.js'].includes(path)){res.writeHead(404).end();return;}
  try{
    let data=await readFile(new URL('.'+path,root));
    if(path.endsWith('.html'))data=Buffer.from(data.toString().replace('<body>','<body><div style="padding:8px;text-align:center;background:#423850;color:#fff;font-size:12px">本地隔离预览 · 模拟音乐与留言，不连接线上数据</div>'));
    res.setHeader('Content-Type',path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':'text/javascript');res.end(data);
  }catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log(`Isolated admin preview: ${env.ADMIN_ORIGIN}/admin/ (setup stored privately in .scratch/admin/local-preview.json)`));
