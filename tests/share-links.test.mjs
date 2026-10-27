import test from 'node:test';import assert from 'node:assert/strict';
import {shareUrl,normalizeShare,resolveShare} from '../api/_lib/share-links.js';
test('provider URLs are exact allowlists, unsafe schemes/credentials/ports/hosts rejected',()=>{
 for(const url of ['https://www.bilibili.com/video/BVexample','https://v.douyin.com/example/','https://music.163.com/#/song?id=1'])assert.ok(shareUrl(url).platform);
 for(const url of ['http://www.bilibili.com/','https://127.0.0.1/','https://www.bilibili.com.evil.test/','https://www.bilibili.com:444/','https://user:pass@www.bilibili.com/','javascript:alert(1)'])assert.throws(()=>shareUrl(url),{status:400});
});
test('unsafe redirect destinations are never fetched; safe fallback remains shareable',async()=>{
 const calls=[];const result=await resolveShare('https://b23.tv/demo',{fetcher:async url=>{calls.push(url);return {status:302,headers:new Headers({location:'http://169.254.169.254/latest/meta-data'})};}});
 assert.equal(calls.length,1);assert.equal(result.platform,'B站');
});
test('metadata remains plain text, image hosts are restricted and provider failures fall back',async()=>{
 const result=await resolveShare('https://www.bilibili.com/video/demo',{fetcher:async()=>({ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>'<meta property="og:title" content="&lt;img onerror=alert(1)&gt;"><meta property="og:image" content="https://127.0.0.1/x">'})});
 assert.equal(result.title,'<img onerror=alert(1)>');assert.equal(result.image,'');
 const fallback=await resolveShare('https://www.douyin.com/video/1',{fetcher:async()=>{throw Error('timeout');}});assert.equal(fallback.platform,'抖音');
 assert.equal(normalizeShare({url:'https://music.163.com/',title:'test',image:'https://evil.test/track'}).image,'');
});
