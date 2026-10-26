import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollector,createAnalytics} from '../api/_lib/analytics.js';
import {createAdminHandler} from '../api/admin.js';
const env={ADMIN_ORIGIN:'https://www.shiloku.cn',ANALYTICS_SECRET:'test-secret-only',VERCEL:'1'};
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}});
const req=(body={page:'home',visitor:'a'.repeat(32),event:'b'.repeat(32)})=>({method:'POST',headers:{origin:env.ADMIN_ORIGIN,'content-type':'application/json','user-agent':'Mozilla/5.0','x-vercel-forwarded-for':'203.0.113.7'},body});
test('collector rejects foreign origins, arbitrary dimensions and oversized identifiers without storage writes',async()=>{
 let writes=0;const handler=createCollector({env,store:{command:async()=>{writes++;return 1}}});
 for(const r of [{...req(),headers:{...req().headers,origin:'https://evil.example'}},req({page:'/admin/',visitor:'a'.repeat(32),event:'b'.repeat(32)}),req({page:'home',visitor:'x'.repeat(300),event:'b'.repeat(32)})]){const out=res();await handler(r,out);assert.ok(out.code>=400)}
 assert.equal(writes,0);
});
test('collector stores only bounded normalized dimensions and HMAC identifiers',async()=>{
 let command;const handler=createCollector({env,now:()=>Date.UTC(2026,9,26),store:{command:async c=>(command=c,1)}});
 const out=res();await handler(req({...req().body,source:'https://evil.example/private?secret=1',device:'arbitrary'}),out);
 assert.equal(out.code,204);assert.equal(command[0],'EVAL');
 const raw=JSON.stringify(command);assert.ok(!raw.includes('203.0.113.7'));assert.ok(!raw.includes('secret=1'));assert.ok(!raw.includes('a'.repeat(32)));
 assert.ok(raw.includes('shiloku:analytics:v1:'));assert.ok(!raw.includes('guestbook'));
});
test('bots are ignored and analytics reads require administrator authentication',async()=>{
 let writes=0;const handler=createCollector({env,store:{command:async()=>{writes++;return 1}}});const out=res();const bot=req();bot.headers['user-agent']='Googlebot';await handler(bot,out);assert.equal(out.code,204);assert.equal(writes,0);
 const admin=createAdminHandler({env,auth:{session:async()=>null},analytics:{summary:async()=>{throw Error('must not read')}}});const denied=res();await admin({...req(),query:{action:'analytics'}},denied);assert.equal(denied.code,401);
});
test('summary fills missing days with zero and rejects unsupported ranges',async()=>{
 const analytics=createAnalytics({now:()=>Date.UTC(2026,9,26),store:{command:async()=>[Array.from({length:7},()=>Array(11).fill(null)),0]}});
 const result=await analytics.summary(7);assert.equal(result.days.length,7);assert.equal(result.pv,0);assert.equal(result.uv,0);assert.equal(result.days.at(-1).date,'2026-10-26');
 await assert.rejects(()=>analytics.summary(900));
});
