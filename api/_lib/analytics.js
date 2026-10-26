import {createHmac} from 'node:crypto';
import {redis} from './admin/store.js';
const P='shiloku:analytics:v1:',RETENTION=90*86400;
const FIELDS=['pv','home','music','direct','search','social','other','desktop','mobile','tablet'];
export const RECORD=`-- analytics-record
local rate=redis.call('INCR',KEYS[4]); if rate==1 then redis.call('EXPIRE',KEYS[4],120) end
if rate>120 then return -1 end
if not redis.call('SET',KEYS[3],'1','NX','EX',86400) then return 0 end
for _,field in ipairs({'pv',ARGV[2],ARGV[3],ARGV[4]}) do redis.call('HINCRBY',KEYS[1],field,1) end
redis.call('PFADD',KEYS[2],ARGV[1]);redis.call('EXPIRE',KEYS[1],ARGV[5]);redis.call('EXPIRE',KEYS[2],ARGV[5]);return 1`;
const SUMMARY=`-- analytics-summary
local rows={};local visitors={};for i=1,#KEYS,2 do
local row=redis.call('HMGET',KEYS[i],unpack(ARGV)); table.insert(row,redis.call('PFCOUNT',KEYS[i+1]));table.insert(rows,row);table.insert(visitors,KEYS[i+1]);end
return {rows,redis.call('PFCOUNT',unpack(visitors))}`;
const dateAt=t=>new Date(t+8*3600000).toISOString().slice(0,10);
const error=(message,status=400)=>Object.assign(new Error(message),{status});
export function createCollector({env=process.env,store=redis,now=Date.now}={}) {
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end();
  try{
   const origin=new URL(env.ADMIN_ORIGIN||'https://www.shiloku.cn');
   const accepted=new Set([origin.origin]);if(origin.hostname.startsWith('www.'))accepted.add(origin.protocol+'//'+origin.hostname.slice(4));
   if(!accepted.has(req.headers.origin))throw error('来源不受信任',403);
   if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error('需要 JSON',415);
   if(/bot|crawler|spider|headless|preview|monitor/i.test(String(req.headers['user-agent']||'')))return res.status(204).end();
   let body=req.body;if(typeof body==='string'){if(body.length>512)throw error('内容过大',413);body=JSON.parse(body)}
   if(!body||JSON.stringify(body).length>512)throw error('内容过大',413);
   if(!['home','music'].includes(body.page)||!/^[-\w]{20,64}$/.test(body.visitor)||!/^[-\w]{20,64}$/.test(body.event))throw error('统计事件无效');
   const secret=env.ANALYTICS_SECRET||env.ADMIN_ENCRYPTION_KEY;if(!secret)throw error('统计尚未配置',503);
   const time=now(),day=dateAt(time),digest=value=>createHmac('sha256',secret).update(value).digest('hex');
   const ip=env.VERCEL?req.headers['x-vercel-forwarded-for']:req.socket?.remoteAddress;
   const source=['direct','search','social','other'].includes(body.source)?body.source:'other';
   const device=['desktop','mobile','tablet'].includes(body.device)?body.device:'desktop';
   const result=await store.command(['EVAL',RECORD,4,P+'day:'+day,P+'uv:'+day,P+'event:'+digest(body.event),P+'rate:'+digest(day+':'+(ip||'unknown'))+':'+Math.floor(time/60000),digest(body.visitor),body.page,source,device,RETENTION]);
   if(result===-1){res.setHeader('Retry-After','60');return res.status(429).end()}
   return res.status(204).end();
  }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'统计暂不可用'})}
 };
}
export function createAnalytics({store=redis,now=Date.now}={}) {
 return {async summary(range=7){
  if(![1,7,30].includes(range))throw error('不支持的统计范围');
  const dates=Array.from({length:range},(_,i)=>dateAt(now()-(range-1-i)*86400000));
  const keys=dates.flatMap(d=>[P+'day:'+d,P+'uv:'+d]);
  const [rows,uv]=await store.command(['EVAL',SUMMARY,keys.length,...keys,...FIELDS]);
  const days=dates.map((date,i)=>({date,...Object.fromEntries(FIELDS.map((f,j)=>[f,Number(rows[i]?.[j]||0)])),uv:Number(rows[i]?.[FIELDS.length]||0)}));
  const totals=Object.fromEntries(FIELDS.map(f=>[f,days.reduce((sum,d)=>sum+d[f],0)]));
  return {...totals,uv:Number(uv||0),days,range,timezone:'Asia/Shanghai',retentionDays:90,estimatedVisitors:true};
 }};
}
