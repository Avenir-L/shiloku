export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    const allowLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const allowProd = /^https:\/\/(www\.)?shiloku\.cn$/i.test(origin);
    if (allowLocal || allowProd) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // 1. 只允许网页发过来的 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 POST 请求' });
    }

    const userMessage = req.body.message;
    const nowPlaying = req.body.nowPlaying;
    const lang = req.body.lang || 'zh';

    let musicContext = '';
    if (nowPlaying && (nowPlaying.title || nowPlaying.artist)) {
        const title = nowPlaying.title || '未知';
        const artist = nowPlaying.artist || '未知';
        musicContext = `\n访客当前在音乐室收听：「${title}」— ${artist}。若问题与音乐相关，可结合这首歌作答；也可推荐风格相近的曲目。`;
    }

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
            headers: { 
                'Content-Type': 'application/json',
                // 这里带上你的专属钥匙 
        
                'Authorization': `Bearer ${apiKey}` 
            },
            body: JSON.stringify({
                model: 'deepseek-v4-pro', // 截图指定模型
                messages: [
                    { role: 'system', content: `你现在的身份是十六夜叶月（Shiloku）的专属网页AI助理。请用高冷、简短的语气回答访客问题。${langHint}${musicContext}` },
                    { role: 'user', content: userMessage }
                ],
                // 完美复刻截图里的高阶思考功能参数
                thinking: { type: 'enabled' },
                reasoning_effort: 'high',
                stream: false
            })
        });

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
        console.error(error);
        res.status(500).json({ error: '网络请求失败，请稍后再试。' });
    }
}