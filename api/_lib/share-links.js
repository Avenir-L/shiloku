const platforms=[
 ['B站',['www.bilibili.com','bilibili.com','m.bilibili.com','b23.tv']],
 ['抖音',['www.douyin.com','douyin.com','v.douyin.com','www.iesdouyin.com']],
 ['网易云音乐',['music.163.com','y.music.163.com','163cn.tv']],
 ['小红书',['www.xiaohongshu.com','xiaohongshu.com','xhslink.com','www.xhslink.com']],
 ['YouTube',['www.youtube.com','youtube.com','m.youtube.com','youtu.be']],
 ['微博',['weibo.com','www.weibo.com','m.weibo.cn','weibo.cn']],
 ['知乎',['www.zhihu.com','zhuanlan.zhihu.com']],
 ['微信',['mp.weixin.qq.com']],['Spotify',['open.spotify.com']],
 ['TikTok',['www.tiktok.com','vm.tiktok.com']],['Vimeo',['vimeo.com','www.vimeo.com']],
];
const error=message=>Object.assign(new Error(message),{status:400});
export function shareUrl(value){
 let url;try{url=new URL(value);}catch{throw error('请粘贴完整的平台链接');}
 const item=platforms.find(([,hosts])=>hosts.includes(url.hostname));
 if(url.protocol!=='https:'||url.username||url.password||url.port||!item||value.length>2000)throw error('暂不支持这个链接，请使用主流平台的 HTTPS 分享链接');
 return {url:url.href,platform:item[0]};
}
export function coverUrl(value){
 if(!value)return '';
 try{
  const url=new URL(value);
  const suffixes=['hdslb.com','douyinpic.com','byteimg.com','douyinstatic.com','music.126.net','ytimg.com','scdn.co','xhscdn.com','sinaimg.cn','zhimg.com','qpic.cn','bilivideo.com'];
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&suffixes.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))&&url.href.length<=2000?url.href:'';
 }catch{return '';}
}
export function normalizeShare(item){
 const link=shareUrl(item?.url);
 const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
 return {...link,title:clean(item.title,200)||link.platform+'分享',author:clean(item.author,120),image:coverUrl(item.image)};
}
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'');
async function readHtml(response){
 if(!response.body?.getReader)return (await response.text()).slice(0,400000);
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>500000)break;chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
export async function resolveShare(value,{fetcher=fetch}={}){
 let current=shareUrl(value),fallback=normalizeShare(current);
 try{
  const signal=AbortSignal.timeout(7000);
  for(let hop=0;hop<4;hop++){
   const response=await fetcher(current.url,{redirect:'manual',signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ShilokuLinkPreview/1.0)','Accept':'text/html'}});
   if([301,302,303,307,308].includes(response.status)){
    const target=new URL(response.headers.get('location'),current.url).href;
    current=shareUrl(target);continue;
   }
   fallback=normalizeShare(current);
   if(!response.ok||!String(response.headers.get('content-type')||'').includes('text/html'))return fallback;
   const html=await readHtml(response),meta={};
   for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){
    const attrs={};for(const pair of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[pair[1].toLowerCase()]=decode(pair[2]??pair[3]);
    const key=attrs.property||attrs.name;if(key&&attrs.content)meta[key.toLowerCase()]=attrs.content;
   }
   const title=meta['og:title']||meta['twitter:title']||decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]||'');
   return normalizeShare({...current,title,author:meta.author||meta['og:site_name'],image:meta['og:image']||meta['twitter:image']});
  }
 }catch{ /* Failed metadata must not block publication of a valid share link. */ }
 return fallback;
}
