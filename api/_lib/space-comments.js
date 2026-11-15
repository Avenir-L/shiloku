import {randomUUID,createHash} from 'node:crypto';
import {redis} from './admin/store.js';
import {createSpace} from './space.js';
const P='shiloku:comments:v1:';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const valid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const ADD=`-- add-space-comment
local raw=redis.call('GET',KEYS[1])
if not raw then return -1 end
local post=cjson.decode(raw)
if post.deleted or post.status~='published' or post.hidden then return -1 end
local config=redis.call('GET',KEYS[2])
if config then
 local cutoff=cjson.decode(config).visibleAfter
 if cutoff and cutoff~=cjson.null and post.publishedAt<cutoff then return -1 end
end
if tonumber(redis.call('GET',KEYS[3]) or '0')>=5 or tonumber(redis.call('GET',KEYS[4]) or '0')>=100 then return 0 end
redis.call('INCR',KEYS[3]);redis.call('EXPIRE',KEYS[3],600)
redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],600)
redis.call('SET',KEYS[5],ARGV[1]);redis.call('ZADD',KEYS[6],ARGV[2],ARGV[3]);return 1`;
export function createComments({store=redis,space=createSpace({store}),now=Date.now}={}){
 const index=id=>P+'post:'+id,record=id=>P+'item:'+id;
 return {
  async list(postId,{admin=false,offset=0}={}){
   await space.read(postId,{admin});
   if(!Number.isInteger(offset)||offset<0||offset>10000)throw fail('分页参数无效');
   const ids=await store.command(['ZREVRANGE',index(postId),offset,offset+30]);
   const selected=ids.slice(0,30),raw=selected.length?await store.command(['MGET',...selected.map(record)]):[];
   if(!admin)await space.read(postId);
   return {comments:raw.filter(Boolean).map(JSON.parse),hasMore:ids.length>30,nextOffset:offset+selected.length};
  },
  async add(postId,input,ip){
   await space.read(postId);
   if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>32||typeof input.text!=='string'||!input.text.trim()||input.text.trim().length>1000)throw fail('请填写昵称（最多 32 字）和评论（最多 1000 字）');
   const time=now(),entry={id:randomUUID(),postId,name:input.name.trim(),text:input.text.trim(),createdAt:new Date(time).toISOString()};
   const hash=createHash('sha256').update(String(ip||'unknown')).digest('hex'),bucket=Math.floor(time/600000);
   const result=await store.command(['EVAL',ADD,6,'shiloku:space:v1:post:'+postId,'shiloku:space:v1:settings',P+'rate:'+hash+':'+bucket,P+'global:'+bucket,record(entry.id),index(postId),JSON.stringify(entry),time,entry.id]);
   if(result===-1)throw fail('说说不存在',404);
   if(result===0)throw fail('评论过于频繁，请稍后再试',429);
   if(result!==1)throw Error('Comment storage failed');
   return {comment:entry};
  },
  async remove(postId,id){
   if(!valid(postId)||!valid(id))throw fail('评论不存在',404);
   const result=await store.command(['EVAL',`local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; if cjson.decode(raw).postId~=ARGV[1] then return 0 end; redis.call('DEL',KEYS[1]);redis.call('ZREM',KEYS[2],ARGV[2]);return 1`,2,record(id),index(postId),postId,id]);
   if(result!==1)throw fail('评论不存在或已删除',404);return {ok:true};
  }
 };
}
