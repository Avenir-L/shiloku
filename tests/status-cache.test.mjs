import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import handler from '../api/status.js';

test('public presence can be cached briefly but unsupported methods cannot',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('offline')});
 for(const method of ['GET','POST']){
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}};
  await handler({method},res);
  assert.equal(res.code,method==='GET'?200:405);
  assert.equal(res.headers['Cache-Control'],method==='GET'?'public, max-age=15, s-maxage=30':'no-store');
 }
});
test('homepage polls share a pending request and reuse the cacheable URL',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const start=html.indexOf('        async function fetchRemoteStatus()');
 const end=html.indexOf('        window.setStatus',start);
 let release,calls=0,url,options;
 const context=vm.createContext({AbortSignal,STATUS_SOURCES:['/api/status'],statusRequest:null,fetch:async(u,o)=>{calls++;url=u;options=o;await new Promise(r=>release=r);return {ok:true,json:async()=>({text:'online',updatedAt:123})}},parseStatusTime:Number,applyRemoteStatus(){}});
 vm.runInContext(html.slice(start,end),context);
 const a=context.fetchRemoteStatus(),b=context.fetchRemoteStatus();
 assert.equal(calls,1);assert.equal(url,'/api/status');assert.notEqual(options?.cache,'no-store');
 release();await Promise.all([a,b]);
});
