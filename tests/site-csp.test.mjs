import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
test('built homepage authorizes only its exact inline scripts and prohibits inline event handlers',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1];assert.ok(policy);
 const scriptPolicy=policy.split(';').find(s=>s.trim().startsWith('script-src '));assert.ok(!scriptPolicy.includes('unsafe-inline'));
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)){if(match[1].trim())assert.ok(scriptPolicy.includes(createHash('sha256').update(match[1]).digest('base64')))}
 assert.ok(!/\son\w+\s*=/.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'')));assert.ok(policy.includes("script-src-attr 'none'"));
});
