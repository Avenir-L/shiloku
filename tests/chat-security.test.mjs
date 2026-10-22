import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../api/chat.js',import.meta.url),'utf8');
const handler=(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}}}
test('invalid messages never reach paid provider',async()=>{
 for(const body of [undefined,{}, {message:5},{message:' '},{message:'x'.repeat(1001)},{message:'hi',nowPlaying:{title:'x'.repeat(100000)}}]){
  const res=response();await handler({method:'POST',headers:{},body},res);assert([400,413].includes(res.code));
 }
});
test('production fails closed without shared limiter',async()=>{
 const saved={...process.env};process.env.VERCEL='1';delete process.env.KV_REST_API_URL;delete process.env.KV_REST_API_TOKEN;process.env.DEEPSEEK_API_KEY='test';
 try{const res=response();await handler({method:'POST',headers:{},body:{message:'hello'}},res);assert.equal(res.code,503)}finally{process.env=saved}
});
test('shared quota blocks paid requests and bounds accepted output',async()=>{
 const saved={...process.env},fetchOriginal=globalThis.fetch;process.env.KV_REST_API_URL='https://quota.invalid';process.env.KV_REST_API_TOKEN='test';process.env.DEEPSEEK_API_KEY='test';let denied=true,paid=0;
 globalThis.fetch=async(url,opts)=>{if(url==='https://quota.invalid')return {ok:true,json:async()=>({result:denied?0:1})};paid++;const body=JSON.parse(opts.body);assert.equal(body.max_tokens,2048);assert(opts.signal);return {ok:true,json:async()=>({choices:[{message:{content:'hello'}}]})}};
 try{let res=response();await handler({method:'POST',headers:{},body:{message:'hello'}},res);assert.equal(res.code,429);assert.equal(paid,0);denied=false;res=response();await handler({method:'POST',headers:{},body:{message:'hello'}},res);assert.equal(res.code,200);assert.equal(paid,1)}finally{globalThis.fetch=fetchOriginal;process.env=saved}
});
test('quota outages fail closed and foreign origins are rejected',async()=>{
 const saved={...process.env},original=globalThis.fetch;process.env.KV_REST_API_URL='https://quota.invalid';process.env.KV_REST_API_TOKEN='test';process.env.DEEPSEEK_API_KEY='test';let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('offline')};
 try{let res=response();await handler({method:'POST',headers:{origin:'https://untrusted.invalid'},body:{message:'hello'}},res);assert.equal(res.code,403);assert.equal(calls,0);res=response();await handler({method:'POST',headers:{},body:{message:'hello'}},res);assert.equal(res.code,503);assert.equal(calls,1)}finally{globalThis.fetch=original;process.env=saved}
});
