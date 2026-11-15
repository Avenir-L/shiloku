import test from 'node:test';
import assert from 'node:assert/strict';
import {createComments} from '../api/_lib/space-comments.js';
import {createSpaceHandler} from '../api/space.js';
import {createAdminHandler} from '../api/admin.js';
const postId='00000000-0000-4000-8000-000000000001';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(data){this.data=data;return this}});
test('hidden, draft and cutoff posts reject comment reads and writes before storage',async()=>{
 const service=createComments({space:{read:async()=>{throw Object.assign(Error('hidden'),{status:404})}},store:{command:async()=>{throw Error('must not access comments')}}});
 await assert.rejects(()=>service.list(postId),{status:404});await assert.rejects(()=>service.add(postId,{name:'visitor',text:'hello'},'ip'),{status:404});
});
test('accepted comments preserve plain text, never accept forged identity, and enforce shared rate limits',async()=>{
 let result=1,calls=0,payload;
 const service=createComments({space:{read:async()=>({})},store:{command:async args=>{calls++;assert.equal(args[0],'EVAL');assert.ok(args[1].includes('post.hidden'));assert.ok(args[1].includes('visibleAfter'));payload=JSON.parse(args[9]);return result}}});
 const {comment}=await service.add(postId,{name:'guest',text:'<script>alert(1)</script>',owner:true,id:'forged'},'127.0.0.1');
 assert.equal(comment.text,'<script>alert(1)</script>');assert.equal(comment.owner,undefined);assert.notEqual(comment.id,'forged');assert.deepEqual(payload,comment);
 result=0;await assert.rejects(()=>service.add(postId,{name:'a',text:'b'},'ip'),{status:429});
 result=-1;await assert.rejects(()=>service.add(postId,{name:'a',text:'b'},'ip'),{status:404});
 const previous=calls;await assert.rejects(()=>service.add(postId,{name:'a',text:'x'.repeat(1001)},'ip'),{status:400});assert.equal(calls,previous);
});
test('public API accepts same-origin comments but rejects foreign origins and delete requests',async()=>{
 let writes=0;const handler=createSpaceHandler({env:{VERCEL:'1'},space:{},comments:{add:async()=>{writes++;return {comment:{text:'hello'}}}}});
 for(const [method,origin,expected]of [['POST','https://www.shiloku.cn',201],['POST','https://shiloku.vercel.app',201],['POST','https://evil.example',403],['DELETE','https://www.shiloku.cn',405]]){
  const res=response();await handler({method,headers:{origin,'content-type':'application/json'},query:{action:'comments',id:postId},body:{name:'a',text:'b'}},res);assert.equal(res.code,expected);
 }assert.equal(writes,2);
});
test('comment moderation requires owner session and trusted origin',async()=>{
 let owner=null,removed=0;
 const handler=createAdminHandler({env:{ADMIN_ORIGIN:'https://www.shiloku.cn'},auth:{session:async()=>owner,rateLimit:async()=>{}},comments:{remove:async()=>{removed++;return {ok:true}}}});
 const req={method:'POST',headers:{origin:'https://www.shiloku.cn','content-type':'application/json'},query:{action:'space-comment-delete'},body:{postId,id:postId}};
 let res=response();await handler(req,res);assert.equal(res.code,401);assert.equal(removed,0);
 owner={id:'owner'};res=response();await handler({...req,headers:{...req.headers,origin:'https://evil.example'}},res);assert.equal(res.code,403);assert.equal(removed,0);
 res=response();await handler(req,res);assert.equal(res.code,200);assert.equal(removed,1);
});
