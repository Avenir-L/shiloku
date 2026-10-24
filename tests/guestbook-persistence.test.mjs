import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../api/guestbook.js',import.meta.url),'utf8');
const load=async id=>(await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${id}`)).default;
const response=()=>({setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}});
const request=(method,body)=>({method,body,headers:{},socket:{remoteAddress:'127.0.0.1'}});
test('unconfigured storage never reports successful delivery',async()=>{
 const old={...process.env};delete process.env.KV_REST_API_URL;delete process.env.KV_REST_API_TOKEN;delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
 try{const handler=await load('missing');for(const method of ['POST','GET']){const r=response();await handler(request(method,{message:'test message'}),r);assert.equal(r.code,503);assert.notEqual(r.body?.ok,true)}}finally{process.env=old}
});
test('fresh instances read shared messages and concurrent submissions survive',async()=>{
 const old={...process.env},original=globalThis.fetch;process.env.KV_REST_API_URL='https://store.invalid';process.env.KV_REST_API_TOKEN='test';let rows=[];
 globalThis.fetch=async(url,opts)=>{const command=JSON.parse(opts.body);if(command[0]==='EVAL'){rows.push(JSON.parse(command.at(-1)));return {ok:true,json:async()=>({result:1})}}return {ok:true,json:async()=>({result:rows.map(JSON.stringify)})}};
 try{const writer=await load('writer');await Promise.all(['first message','second message'].map(async message=>{const r=response();await writer(request('POST',{message}),r);assert.equal(r.code,200)}));const reader=await load('new-instance');const r=response();await reader(request('GET'),r);assert.equal(r.code,200);assert.equal(r.body.messages.length,2)}finally{process.env=old;globalThis.fetch=original}
});
test('storage outage returns failure, never localOnly success',async()=>{
 const old={...process.env},original=globalThis.fetch;process.env.KV_REST_API_URL='https://store.invalid';process.env.KV_REST_API_TOKEN='test';globalThis.fetch=async()=>{throw Error('offline')};
 try{const handler=await load('outage');const r=response();await handler(request('POST',{message:'test message'}),r);assert.equal(r.code,503);assert.notEqual(r.body?.ok,true)}finally{process.env=old;globalThis.fetch=original}
});
