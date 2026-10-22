import { createHash } from 'node:crypto';

const localBuckets = new Map();
// Both counters are checked and incremented atomically across all instances.
const quotaScript = `
local ip = tonumber(redis.call('GET', KEYS[1]) or '0')
local total = tonumber(redis.call('GET', KEYS[2]) or '0')
if ip >= 5 or total >= 100 then return 0 end
redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 60)
redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], 172800)
return 1`;
async function allowChat(req) {
    const now = Date.now();
    const rawIp = process.env.VERCEL
        ? req.headers['x-vercel-forwarded-for']
        : req.socket?.remoteAddress;
    const ip = createHash('sha256').update(String(rawIp || 'unknown').split(',')[0].trim()).digest('hex');
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) {
        const minute = Math.floor(now / 60000);
        const day = new Date(now).toISOString().slice(0, 10);
        const response = await fetch(url.replace(/\/$/, ''), {
            method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
            body: JSON.stringify(['EVAL', quotaScript, 2, `chat:ip:${ip}:${minute}`, `chat:day:${day}`]),
            signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) throw new Error('Quota service unavailable');
        const result = await response.json();
        if (result.error || ![0,1].includes(result.result)) throw new Error('Invalid quota response');
        return result.result === 1;
    }
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('Shared quota is required');
    for (const [key, bucket] of localBuckets) if (now - bucket.start >= 60000) localBuckets.delete(key);
    const bucket = localBuckets.get(ip) || {start: now, count: 0};
    localBuckets.set(ip, bucket);
    return ++bucket.count <= 5;
}

export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    res.setHeader('Cache-Control', 'no-store');
    const allowLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const allowProd = /^https:\/\/(www\.)?shiloku\.cn$/i.test(origin);
    if (allowLocal || allowProd) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (origin && !allowLocal && !allowProd) return res.status(403).json({error: '不允许的请求来源'});
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // 1. 只允许网页发过来的 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    res.setHeader('Cache-Control', 'no-store');
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.message !== 'string' || !body.message.trim()) {
        return res.status(400).json({error: '请输入有效消息'});
    }
    if (body.message.length > 1000 || Buffer.byteLength(JSON.stringify(body)) > 8192) {
        return res.status(413).json({error: '消息过长，请控制在 1000 字以内'});
    }
    if (!process.env.DEEPSEEK_API_KEY) return res.status(503).json({error: 'AI 暂时不可用'});
    try {
        if (!await allowChat(req)) {
            res.setHeader('Retry-After', '60');
            return res.status(429).json({error: '请求次数已达限制，请稍后再试'});
        }
    } catch {
        return res.status(503).json({error: 'AI 暂时不可用，请稍后再试'});
    }
    const userMessage = body.message.trim();
    const lang = ['zh', 'en', 'ja'].includes(body.lang) ? body.lang : 'zh';

    const langHint = lang === 'en'
        ? ' Reply in English unless the visitor writes in another language.'
        : lang === 'ja'
            ? ' 访客界面为日语时，请用日语回答。'
            : ' 默认用中文回答；访客用其他语言提问时可跟随其语言。';

    // 2. 从 Vercel 读取你的 DeepSeek API Key
    const apiKey = process.env.DEEPSEEK_API_KEY; 

    try {
        // 3. 使用原生 fetch 直接调用 DeepSeek 的接口
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            signal: AbortSignal.timeout(25000),
            headers: { 
                'Content-Type': 'application/json',
                // 这里带上你的专属钥匙 
        
                'Authorization': `Bearer ${apiKey}` 
            },
            body: JSON.stringify({
                model: 'deepseek-v4-pro', // 截图指定模型
                messages: [
                    { role: 'system', content: `你现在的身份是十六夜叶月（Shiloku）的专属网页AI助理。请用高冷、简短的语气回答访客问题。${langHint}` },
                    { role: 'user', content: userMessage }
                ],
                // 完美复刻截图里的高阶思考功能参数
                thinking: { type: 'enabled' },
                reasoning_effort: 'high',
                max_tokens: 2048,
                stream: false
            })
        });

        if (!response.ok) return res.status(502).json({error: 'AI 服务暂时不可用'});
        const data = await response.json();
        
        // 4. 提取 DeepSeek 返回的正式内容
        // 注意：DeepSeek v4 Pro 开启 thinking 后，会返回思维过程和最终结果，
        // 这里我们只提取最终结果 (message.content) 给访客看。
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            res.status(200).json({ reply: reply });
        } else {
            res.status(500).json({ error: 'AI 返回的格式异常。' });
        }

    } catch (error) {
        console.error('AI request failed:', error?.name || 'Error');
        res.status(500).json({ error: '网络请求失败，请稍后再试。' });
    }
}