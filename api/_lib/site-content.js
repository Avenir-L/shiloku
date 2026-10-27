import {createHash,randomUUID} from 'node:crypto';
import {STRINGS} from '../../scripts/i18n.js';
import manifest from '../../gallery/manifest.json' with {type:'json'};
import {redis,readJson} from './admin/store.js';
const KEY='shiloku:content:v1';
const IMAGE='shiloku:content-image:v1:';
const fields=['bioTitle','bioP1','bioP2','aboutTitle','aboutBio1','aboutBio2','aboutExtra','aboutMore','galleryOpen','galleryTitle'];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const defaults=()=>({revision:'initial',profile:{nickname:'栀落余殁',subtitle:'Shiloku',avatar:'/avatar.jpg',locales:Object.fromEntries(['zh','en','ja'].map(lang=>[lang,Object.fromEntries(fields.map(key=>[key,STRINGS[lang][key]]))]))},gallery:manifest.items.map(item=>({id:item.id,title:item.title,image:'/gallery/'+item.file,wip:Boolean(item.wip)||/未命名|未完成/.test(item.title),hidden:false}))});
function text(value,max,required=false){
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||required&&!value.trim())throw fail('请检查文字内容或长度');
 return value.trim();
}
function mediaUrl(value,avatar=false){
 if(typeof value!=='string')throw fail('图片地址无效');
 if(avatar&&value==='/avatar.jpg')return value;
 if(/^\/api\/site-content\?image=[a-f0-9]{64}$/.test(value))return value;
 if(!avatar&&/^\/gallery\/images\/[^/\\?<>"\u0000-\u001f]+\.(jpe?g|png|webp|avif)$/i.test(value)&&!value.includes('..'))return value;
 throw fail('请使用上传的图片');
}
function validate(data){
 if(!data?.profile||!Array.isArray(data.gallery)||data.gallery.length>60)throw fail('主站内容格式无效，画作最多 60 张');
 const p=data.profile,locales={};
 for(const lang of ['zh','en','ja']){
  if(!p.locales?.[lang])throw fail('缺少语言文案');
  locales[lang]=Object.fromEntries(fields.map(key=>[key,text(p.locales[lang][key],key.startsWith('aboutBio')?2500:1000)]));
 }
 const ids=new Set();
 const gallery=data.gallery.map(item=>{
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)||ids.has(item.id))throw fail('画作标识无效或重复');ids.add(item.id);
  if(typeof item.wip!=='boolean'||typeof item.hidden!=='boolean')throw fail('画作状态无效');
  return {id:item.id,title:text(item.title,100,true),image:mediaUrl(item.image),wip:item.wip,hidden:item.hidden};
 });
 return {profile:{nickname:text(p.nickname,60,true),subtitle:text(p.subtitle,60),avatar:mediaUrl(p.avatar,true),locales},gallery};
}
const CAS=`-- publish-site-content
local old=redis.call('GET',KEYS[1])
local revision='initial'
if old then revision=cjson.decode(old).revision end
if revision~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2])
return 1`;
export function createSiteContent({store=redis}={}){
 return {
  async read(){return await readJson(store,KEY)||defaults();},
  async save(input){
   const normalized=validate(input),images=[normalized.profile.avatar,...normalized.gallery.map(item=>item.image)];
   for(const url of new Set(images))if(url.startsWith('/api/site-content?image=')){
    const key=IMAGE+url.split('=')[1];if(!await store.command(['GET',key]))throw fail('上传图片已失效，请重新上传');await store.command(['PERSIST',key]);
   }
   const next={...normalized,revision:randomUUID(),updatedAt:new Date().toISOString()};
   const saved=await store.command(['EVAL',CAS,1,KEY,String(input.revision),JSON.stringify(next)]);
   if(!saved)throw fail('内容已在其他页面更新，请重新载入后再编辑',409);
   return next;
  },
  async upload({data,type}={}){
   if(typeof data!=='string'||data.length>800000||!data.length||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw fail('图片过大或格式无效');
   const bytes=Buffer.from(data,'base64');
   const valid=type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'
    ||type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255
    ||type==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
   if(!valid||bytes.length>600000||bytes.length<24)throw fail('仅支持压缩后的 JPG、PNG、WebP 图片');
   const id=createHash('sha256').update(bytes).digest('hex');
   await store.command(['SET',IMAGE+id,JSON.stringify({type,data}),'EX',604800,'NX']);
   return {id,url:'/api/site-content?image='+id};
  },
  async image(id){
   if(!/^[a-f0-9]{64}$/.test(id))throw fail('图片不存在',404);
   const item=await readJson(store,IMAGE+id);if(!item)throw fail('图片不存在',404);
   return {bytes:Buffer.from(item.data,'base64'),type:item.type};
  },
 };
}
