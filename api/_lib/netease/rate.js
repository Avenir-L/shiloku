import {createHash} from 'node:crypto';
import {redis} from '../admin/store.js';
const QUOTA=`-- music-quota
local ip=tonumber(redis.call('GET',KEYS[1]) or '0')
local global=tonumber(redis.call('GET',KEYS[2]) or '0')
local cost=tonumber(ARGV[1])
if ip+cost>120 or global+cost>1200 then return 0 end
redis.call('INCRBY',KEYS[1],cost);redis.call('EXPIRE',KEYS[1],120)
redis.call('INCRBY',KEYS[2],cost);redis.call('EXPIRE',KEYS[2],120)
return 1`;
export function createMusicLimiter({store=redis,env=process.env,now=Date.now}={}){
 return async(req,action)=>{
  if(!env.VERCEL&&env.NODE_ENV!=='production')return;
  const ip=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const digest=createHash('sha256').update(ip).digest('hex'),minute=Math.floor(now()/60000);
  const cost={playable:6,playlist:6,playlists:2,search:2,'listen-stats':2}[action]||1;
  let allowed;
  try{allowed=await store.command(['EVAL',QUOTA,2,`shiloku:music:rate:${digest}:${minute}`,`shiloku:music:global:${minute}`,cost]);}
  catch{throw Object.assign(new Error('音乐服务暂时不可用，请稍后重试'),{status:503});}
  if(allowed!==1)throw Object.assign(new Error('音乐请求过于频繁，请稍后重试'),{status:429});
 };
}
