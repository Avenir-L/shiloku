import test from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {createNeteaseHandler} from '../api/netease.js';

function response() {
 const res=new Writable({write(chunk,encoding,done){done()}});
 res.headers={};res.setHeader=(k,v)=>{res.headers[k]=v};
 res.status=code=>{res.code=code;return res};res.json=data=>{res.data=data;res.end();return res};
 return res;
}
function mockAudio(t,id,serve) {
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).startsWith('https://music.163.com/api/song/'))return {ok:true,json:async()=>({data:[{url:`https://m7.music.126.net/${id}.mp3`}]})};
  return serve(options);
 });
}
const handler=createNeteaseHandler({limit:async()=>{}});
test('audio HEAD does not download a song; successful audio stays in the private browser cache',async t=>{
 let method;
 mockAudio(t,'810001',async options=>{method=options.method;return new Response(null,{headers:{'Content-Type':'audio/mpeg','Content-Length':'8000000'}})});
 const res=response();await handler({method:'HEAD',headers:{},query:{path:'audio',id:'810001'}},res);
 assert.equal(method,'HEAD');assert.equal(res.code,200);
 assert.equal(res.headers['Cache-Control'],'private, max-age=3600');
});
test('audio byte ranges are preserved and unsuccessful upstream responses are not cached',async t=>{
 let range;
 mockAudio(t,'810002',async options=>{range=options.headers.Range;return new Response('unavailable',{status:503})});
 const res=response();await handler({method:'GET',headers:{range:'bytes=100-200'},query:{path:'audio',id:'810002'}},res);
 assert.equal(range,'bytes=100-200');assert.equal(res.code,503);
 assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('seeking streams only the requested partial content with its range headers',async t=>{
 mockAudio(t,'810004',async options=>{
  assert.equal(options.method,'GET');assert.equal(options.headers.Range,'bytes=100-102');
  return new Response(new Uint8Array([4,5,6]),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':'3','Content-Range':'bytes 100-102/8000000','Accept-Ranges':'bytes'}});
 });
 const res=response();let bytes=0;res._write=(chunk,encoding,done)=>{bytes+=chunk.length;done()};
 await handler({method:'GET',headers:{range:'bytes=100-102'},query:{path:'audio',id:'810004'}},res);
 assert.equal(res.code,206);assert.equal(bytes,3);assert.equal(res.headers['Content-Range'],'bytes 100-102/8000000');
 assert.equal(res.headers['Cache-Control'],'private, max-age=3600');
});
test('leaving or changing a song aborts upstream transfer and cancels its body',async t=>{
 let signal,cancelled=false;
 mockAudio(t,'810003',async options=>{
  signal=options.signal;
  return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]))},cancel(){cancelled=true}}));
 });
 const res=response();
 const pending=handler({method:'GET',headers:{},query:{path:'audio',id:'810003'}},res);
 await new Promise(resolve=>setImmediate(resolve));
 res.destroy();await pending;
 assert.equal(signal?.aborted,true);assert.equal(cancelled,true);
});
