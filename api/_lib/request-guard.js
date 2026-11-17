// Best-effort per-instance shield: rejected requests never contact Redis.
// Distributed enforcement must additionally run at the hosting firewall.
export function createRequestGuard({perIp=60,total=600,windowMs=60000,maxKeys=2048,now=Date.now}={}) {
 const buckets=new Map();let epoch=-1,count=0;
 return req=>{const current=Math.floor(now()/windowMs);if(current!==epoch){epoch=current;count=0;buckets.clear()}
 const ip=String(process.env.VERCEL?req.headers?.['x-vercel-forwarded-for']||'unknown':req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const used=buckets.get(ip)||0;if(count>=total||used>=perIp||(!buckets.has(ip)&&buckets.size>=maxKeys))return false;
 buckets.set(ip,used+1);count++;return true;};
}
export function createSingleFlight(){const pending=new Map();return (key,load)=>{if(pending.has(key))return pending.get(key);if(pending.size>=256)return Promise.reject(Object.assign(Error('请求过于频繁'),{status:429}));const p=Promise.resolve().then(load).finally(()=>pending.delete(key));pending.set(key,p);return p;};}
export function shield(handler,{guard=createRequestGuard()}={}){return (req,res)=>{if(!guard(req)){res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','60');return res.status(429).json({error:'请求过于频繁，请稍后重试'})}return handler(req,res)};}
