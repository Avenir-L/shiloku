import {createHash,randomUUID} from 'node:crypto';
import {STRINGS} from '../../scripts/i18n.js';
import manifest from '../../gallery/manifest.json' with {type:'json'};
import {redis,readJson} from './admin/store.js';
const KEY='shiloku:content:v1';
const IMAGE='shiloku:content-image:v1:';
const fields=['bioTitle','bioP1','bioP2','aboutTitle','aboutBio1','aboutBio2','aboutExtra','aboutMore','galleryOpen','galleryTitle'];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const defaults=()=>({revision:'initial',profile:{nickname:'栀落余殁',subtitle:'Shiloku',avatar:'/avatar.jpg',locales:Object.fromEntries(['zh','en','ja'].map(lang=>[lang,Object.fromEntries(fields.map(key=>[key,STRINGS[lang][key]]))]))},gallery:manifest.items.map(item=>({id:item.id,title:item.title,image:'/gallery/'+item.file,wip:Boolean(item.wip)||/未命名|未完成/.test(item.title),hidden:false})).sort((a,b)=>Number(a.wip)-Number(b.wip)||a.id.localeCompare(b.id))});
const featuredPhotos = ['彩虹花园', '双人合照', '窗边'].map((title, index) => {
 const id = 'vrchat-20261123-0' + (index + 1);
 return {id,title,image:'/gallery/images/'+id+'.webp',wip:false,hidden:false};
});
const archivePhotos = ['晚霞', '金色逆光', '樱花亭', '照片与花', '雪山'].map((title, index) => {
 const id = 'vrchat-archive-0' + (index + 1);
 return {id,title,image:'/gallery/images/'+id+'.webp',wip:false,hidden:false};
});
const cloudDefaults = {
  "greetings": "你好，我是栀落余殁。\n最近在忙什么，都写在「动态」里。\n更多信息，可以看看「关于」。\n有趣的照片，收在「相册」里。\n有什么想聊的，给我留个言吧。",
  "sky": "The sky is listening",
  "aboutTitle": "关于我",
  "aboutBody": "栀落余殁（Shiloku）的个人网站 — 相册、音乐室、访客留言。\n这里是我的个人空间：相册里收录着各种各样的照片，音乐室可播放本地与在线歌单，留言板开放留言。欢迎通过底部链接或留言与我联系，感谢来访。",
  "albumMode": "samples",
  "bilibili": "https://space.bilibili.com/479198505",
  "steam": "https://steamcommunity.com/profiles/76561199236026651/",
  "github": "https://github.com/Avenir-L",
  "vrchat": "https://vrchat.com/home/user/usr_66334be0-178a-41c0-a6ad-fb0a4badd8da",
  "farewell": "祝你今天能遇到一件开心的小事。\n也祝你在意的事，都能慢慢有个好结果。"
};
function validateCloud(value = cloudDefaults) {
 if (!['samples', 'photos'].includes(value.albumMode)) throw fail("请选择相册展示方式");
 const links={};
 for (const key of ['bilibili','steam','github','vrchat']) {
  const link=text(value[key],350);
  if(link && !URL.canParse(link)) throw fail('社交链接地址无效');
  if(link && new URL(link).protocol!=='https:') throw fail('社交链接需要使用 HTTPS');
  links[key]=link;
 }
 return {...links,farewell:text(value.farewell,400),greetings:text(value.greetings,1000,true),sky:text(value.sky,120),aboutTitle:text(value.aboutTitle,80,true),aboutBody:text(value.aboutBody,2500,true),albumMode:value.albumMode};
}
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
  async read(){
   const data=await readJson(store,KEY)||defaults();
   const cloud=data.cloud??{...cloudDefaults};
   const gallery=[...data.gallery];
   if(!data.featuredPhotosInstalled){
    const existing=gallery.filter(item=>![...featuredPhotos,...archivePhotos].some(photo=>photo.id===item.id));
    return {...data,gallery:[...featuredPhotos,...archivePhotos,...existing],cloud:{...cloud,albumMode:'photos'}};
   }
   if(!data.archivePhotosInstalled){
    const missing=archivePhotos.filter(photo=>!gallery.some(item=>item.id===photo.id));
    const featuredEnd=gallery.findLastIndex(item=>featuredPhotos.some(photo=>photo.id===item.id));
    gallery.splice(featuredEnd<0?gallery.length:featuredEnd+1,0,...missing);
   }
   return {...data,gallery,cloud};
  },
  async save(input){
   const normalized=validate(input),images=[normalized.profile.avatar,...normalized.gallery.map(item=>item.image)];
   for(const url of new Set(images))if(url.startsWith('/api/site-content?image=')){
    const key=IMAGE+url.split('=')[1];if(!await store.command(['GET',key]))throw fail('上传图片已失效，请重新上传');await store.command(['PERSIST',key]);
   }
   const cloud=validateCloud(input.cloud ?? (await this.read()).cloud);
   const next={...normalized,cloud,featuredPhotosInstalled:true,archivePhotosInstalled:true,revision:randomUUID(),updatedAt:new Date().toISOString()};
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
