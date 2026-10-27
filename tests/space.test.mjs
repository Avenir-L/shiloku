import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpace} from '../api/_lib/space.js';
import {createSpaceHandler} from '../api/space.js';
import {createAdminHandler} from '../api/admin.js';
export class SpaceStore{
 values=new Map(); indexes=new Map();
 async command([op,key,...args]){
  if(op==='GET')return this.values.get(key)??null;
  if(op==='SET'){this.values.set(key,args[0]);return 'OK';}
  if(op==='PERSIST')return 1;
  if(op==='MGET')return [key,...args].map(k=>this.values.get(k)??null);
  if(op==='ZREVRANGE')return [...(this.indexes.get(key)||new Map())].sort((a,b)=>b[1]-a[1]).slice(Number(args[0]),Number(args[1])+1).map(x=>x[0]);
  if(op==='EVAL'){
   const [count,record,all,pub,revision,payload,id,allScore,pubScore]=args;
   const current=this.values.get(record);if((current?JSON.parse(current).revision:'initial')!==revision)return 0;
   const index=k=>{if(!this.indexes.has(k))this.indexes.set(k,new Map());return this.indexes.get(k);};
   this.values.set(record,payload);index(all).delete(id);index(pub).delete(id);
   const post=JSON.parse(payload);if(!post.deleted){index(all).set(id,Number(allScore));if(post.status==='published')index(pub).set(id,Number(pubScore));}
   return 1;
  }
  throw Error(op);
 }
}
const post=(overrides={})=>({id:'00000000-0000-4000-8000-000000000001',revision:'initial',text:'今天的日常',images:[],links:[],status:'draft',pinned:false,...overrides});
test('drafts never appear in public feeds or direct detail, published posts survive reinitialization',async()=>{
 const store=new SpaceStore(),space=createSpace({store});const draft=await space.save(post());
 assert.equal((await space.list()).posts.length,0);await assert.rejects(()=>space.read(draft.id),{status:404});
 const saved=await space.save({...draft,status:'published'});assert.equal((await createSpace({store}).list()).posts[0].id,saved.id);
});
test('edit keeps publish time; pin, unpublish and deletion update public visibility atomically',async()=>{
 const store=new SpaceStore(),space=createSpace({store});
 const a=await space.save(post({status:'published'}));
 const b=await space.save(post({id:'00000000-0000-4000-8000-000000000002',status:'published'}));
 const pinned=await space.save({...a,pinned:true,text:'修改过的日常'});assert.equal(pinned.publishedAt,a.publishedAt);assert.equal((await space.list()).posts[0].id,a.id);
 const draft=await space.save({...pinned,status:'draft'});assert.equal((await space.list()).posts.some(p=>p.id===draft.id),false);
 await space.remove(b.id,b.revision);assert.equal((await space.list()).posts.length,0);await assert.rejects(()=>space.save({...b,text:'旧页面不能复活删除的说说'}),{status:409});
});
test('stale edits fail instead of silently overwriting another save',async()=>{
 const space=createSpace({store:new SpaceStore()}),first=await space.save(post());await space.save({...first,text:'新内容'});
 await assert.rejects(()=>space.save({...first,text:'过时内容'}),{status:409});
});
test('invalid attachments and non-public URL schemes are rejected',async()=>{
 const space=createSpace({store:new SpaceStore()});
 for(const change of [{text:'',images:[],links:[]},{images:['https://evil.test/x']},{links:[{url:'javascript:alert(1)'}]},{status:'private'},{images:Array(10).fill('/avatar.jpg')}])await assert.rejects(()=>space.save(post(change)),{status:400});
});
test('all publishing operations reject visitors; public endpoint is read-only',async()=>{
 const handler=createAdminHandler({env:{ADMIN_ORIGIN:'https://www.shiloku.cn'},auth:{session:async()=>null}});
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 for(const action of ['space-list','space-save','space-delete','space-resolve']){
  const out=response();await handler({method:'POST',query:{action},headers:{origin:'https://www.shiloku.cn','content-type':'application/json'},body:{}},out);assert.equal(out.code,401);
 }
 const out=response();await createSpaceHandler({space:createSpace({store:new SpaceStore()})})({method:'POST',query:{}},out);assert.equal(out.code,405);
});
