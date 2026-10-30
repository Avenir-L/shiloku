import {randomUUID} from 'node:crypto';
import {redis,readJson} from './admin/store.js';
import {normalizeShare} from './share-links.js';
const PREFIX='shiloku:space:v1:',ALL=PREFIX+'all',PUBLIC=PREFIX+'public';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const CAS=`-- publish-space-post
local old=redis.call('GET',KEYS[1])
local rev='initial'
if old then rev=cjson.decode(old).revision end
if rev~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2])
redis.call('ZREM',KEYS[2],ARGV[3])
redis.call('ZREM',KEYS[3],ARGV[3])
local post=cjson.decode(ARGV[2])
if not post.deleted then
 redis.call('ZADD',KEYS[2],ARGV[4],ARGV[3])
 if post.status=='published' and not post.hidden then redis.call('ZADD',KEYS[3],ARGV[5],ARGV[3]) end
end
return 1`;
export function createSpace({store=redis}={}){
 const key=id=>PREFIX+'post:'+id;
 const settingsKey=PREFIX+'settings';
 const settings=async()=>await readJson(store,settingsKey)||{revision:'initial',visibleAfter:null};
 const isPublic=(post,config)=>post.status==='published'&&!post.hidden&&(!config.visibleAfter||Date.parse(post.publishedAt)>=Date.parse(config.visibleAfter));
 async function get(id){if(!validId(id))throw fail('说说不存在',404);return readJson(store,key(id));}
 async function commit(post,expected){
  const result=await store.command(['EVAL',CAS,3,key(post.id),ALL,PUBLIC,String(expected),JSON.stringify(post),post.id,Date.parse(post.updatedAt),Number(post.pinned)*1e15+Date.parse(post.publishedAt||post.updatedAt)]);
  if(!result)throw fail('这条说说已在其他页面更新，请重新载入',409);
  return post;
 }
 return {
  settings,
  async saveSettings(input){
   const date=input.visibleAfter;
   if(date!==null&&(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(date)||!Number.isFinite(Date.parse(date))))throw fail('请选择有效的可见起始时间');
   const config={revision:randomUUID(),visibleAfter:date===null?null:new Date(date).toISOString()};
   const script=`-- space-settings-cas
local old=redis.call('GET',KEYS[1])
local rev='initial'
if old then rev=cjson.decode(old).revision end
if rev~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2])
return 1`;
   if(!await store.command(['EVAL',script,1,settingsKey,String(input.revision),JSON.stringify(config)]))throw fail('可见范围已在其他页面更新，请重新载入',409);
   return config;
  },
  async visibility(id,revision,hidden){
   if(typeof hidden!=='boolean')throw fail('可见状态无效');
   const previous=await get(id);if(!previous||previous.deleted)throw fail('说说不存在',404);
   return commit({...previous,hidden,revision:randomUUID(),updatedAt:new Date().toISOString()},revision);
  },
  async list({admin=false,offset=0,limit=20}={}){
   if(!Number.isInteger(offset)||offset<0||offset>10000||!Number.isInteger(limit)||limit<1||limit>50)throw fail('分页参数无效');
   const config=admin?null:await settings();
   const ids=await store.command(['ZREVRANGE',admin?ALL:PUBLIC,offset,offset+limit]);
   const hasMore=ids.length>limit,selected=ids.slice(0,limit);
   const raw=selected.length?await store.command(['MGET',...selected.map(key)]):[];
   const posts=raw.filter(Boolean).map(value=>JSON.parse(value)).filter(post=>!post.deleted&&(admin||isPublic(post,config)));
   return {posts,hasMore,nextOffset:offset+selected.length};
  },
  async read(id,{admin=false}={}){const item=await get(id);if(!item||item.deleted||!admin&&!isPublic(item,await settings()))throw fail('说说不存在',404);return item;},
  async save(input){
   if(!validId(input.id)||typeof input.text!=='string'||input.text.length>12000||!['draft','published'].includes(input.status)||typeof input.pinned!=='boolean'||(input.hidden!==undefined&&typeof input.hidden!=='boolean')||!Array.isArray(input.images)||input.images.length>9||!Array.isArray(input.links)||input.links.length>6)throw fail('请检查说说内容，最多 9 张图片、6 个分享链接');
   if(!input.text.trim()&&!input.images.length&&!input.links.length)throw fail('请先写点内容或添加图片、链接');
   const previous=await get(input.id);
   if(previous?.deleted)throw fail('这条说说已被删除',409);
   const images=[...new Set(input.images)];
   for(const image of images){
    if(typeof image!=='string'||!/^\/api\/site-content\?image=[a-f0-9]{64}$/.test(image))throw fail('请使用上传的图片');
    const assetKey='shiloku:content-image:v1:'+image.split('=')[1];
    if(!await store.command(['GET',assetKey]))throw fail('图片已失效，请重新上传');await store.command(['PERSIST',assetKey]);
   }
   const now=new Date().toISOString();
   const post={id:input.id,revision:randomUUID(),text:input.text.trim(),images,links:input.links.map(normalizeShare),status:input.status,hidden:input.hidden??previous?.hidden??false,pinned:input.pinned,createdAt:previous?.createdAt||now,updatedAt:now,publishedAt:input.status==='published'?(previous?.status==='published'?previous.publishedAt:now):null};
   return commit(post,input.revision);
  },
  async remove(id,revision){
   const previous=await get(id);if(!previous||previous.deleted)throw fail('说说不存在',404);
   // A tombstone prevents stale editors from recreating a deleted post.
   await commit({id,revision:randomUUID(),deleted:true,updatedAt:new Date().toISOString()},revision);
   return {ok:true};
  },
 };
}
