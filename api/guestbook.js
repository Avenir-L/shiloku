import {createHash,randomUUID} from 'node:crypto';

const STORE_KEY = 'shiloku:guestbook:v1';
// Append and rate-limit in a single transaction. Each message has its own member;
// concurrent writers cannot overwrite one another. Messages do not expire.
const APPEND_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= 5 then return 0 end
redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 120)
redis.call('ZADD', KEYS[2], ARGV[1], ARGV[2])
return 1`;

async function command(args) {
    const url=process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token=process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Storage not configured');
    const response=await fetch(url.replace(/\/$/,''), {
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify(args),signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Storage unavailable');
    const data=await response.json();
    if (data.error || !Object.hasOwn(data,'result')) throw new Error('Storage command failed');
    return data.result;
}

export default async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Vary','Origin');
    const origin=req.headers.origin || '';
    const allowed=/^https:\/\/(www\.)?shiloku\.cn$/i.test(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    if(origin && !allowed) return res.status(403).json({error:'不允许的请求来源'});
    if(allowed) res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if(req.method==='OPTIONS') return res.status(204).end();
    if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'只允许 GET / POST'});
    const body=req.body;
    if(req.method==='POST' && (!body || typeof body.message!=='string' || body.message.trim().length<2 || body.message.trim().length>280 || (body.name!==undefined && (typeof body.name!=='string' || body.name.length>32)))) {
        return res.status(400).json({error:'请填写 2–280 字留言，昵称不超过 32 字'});
    }
    try {
        if(req.method==='GET') {
            const rows=await command(['ZREVRANGE',STORE_KEY,0,79]);
            if(!Array.isArray(rows)) throw new Error('Invalid storage response');
            const messages=rows.map(row=>JSON.parse(row));
            return res.status(200).json({messages});
        }
        const ip=process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
        const hash=createHash('sha256').update(String(ip || 'unknown').split(',')[0].trim()).digest('hex');
        const entry={id:`gb-${randomUUID()}`,name:body.name?.trim() || '访客',message:body.message.trim(),time:Date.now()};
        const result=await command(['EVAL',APPEND_SCRIPT,2,`guestbook:rate:${hash}:${Math.floor(Date.now()/60000)}`,STORE_KEY,String(entry.time),JSON.stringify(entry)]);
        if(result===0){res.setHeader('Retry-After','60');return res.status(429).json({error:'发送太频繁，请稍后再试'});}
        if(result!==1) throw new Error('Write was not acknowledged');
        return res.status(200).json({ok:true,message:entry});
    } catch {
        return res.status(503).json({error:'留言服务暂时不可用，尚未发送成功，请保留内容后重试'});
    }
}
