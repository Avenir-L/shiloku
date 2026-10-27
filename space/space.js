import {getSiteContent} from '/scripts/site-profile.js?v=20261028space1';
const $=id=>document.getElementById(id),feed=$('space-feed');
let profile=null,next=0,hasMore=false,busy=false;
const id=new URLSearchParams(location.search).get('id');
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
const dateParts=iso=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(iso)).reduce((parts,x)=>(parts[x.type]=x.value,parts),{});
function author(post){
 const header=node('header','space-author'),image=node('img');image.src='/api/site-content?avatar=1';image.alt=(profile?.nickname||'Shiloku')+' 的头像';image.loading='lazy';
 image.addEventListener('error',()=>{image.src='/avatar.jpg';},{once:true});
 const byline=node('div');byline.append(node('strong','',profile?.nickname||'Shiloku'));
 const p=dateParts(post.publishedAt),time=node('time','',`${p.hour}:${p.minute}`);time.dateTime=post.publishedAt;byline.append(time);header.append(image,byline);
 if(post.pinned)header.append(node('span','space-pin','置顶'));return header;
}
function share(link){
 const anchor=node('a','space-share');anchor.href=link.url;anchor.target='_blank';anchor.rel='noopener noreferrer';
 if(link.image){const image=node('img');image.src=link.image;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove(),{once:true});anchor.append(image);}
 else anchor.append(node('span','share-icon',link.platform==='网易云音乐'?'♪':'↗'));
 const info=node('div');info.append(node('span','space-share-label',link.platform),node('strong','space-share-title',link.title));if(link.author)info.append(node('span','space-share-author',link.author));anchor.append(info);return anchor;
}
function content(post,detail=false){
 const card=node('div','space-card');card.append(author(post));
 const long=!detail&&post.text.length>600;card.append(node('p','space-text',long?post.text.slice(0,600)+'…':post.text));
 if(post.images.length){const grid=node('div','space-photo-grid'+(post.images.length===1?' single':''));
  for(const [index,url]of (detail?post.images:post.images.slice(0,3)).entries()){
   const button=node('button'),image=node('img');button.type='button';button.setAttribute('aria-label','查看配图 '+(index+1));image.src=url;image.alt='说说配图 '+(index+1);image.loading='lazy';image.decoding='async';button.append(image);
   button.addEventListener('click',()=>{$('space-large-image').src=url;$('space-lightbox').showModal();});grid.append(button);
  }card.append(grid);
 }
 for(const link of detail?post.links:post.links.slice(0,2))card.append(share(link));
 if(!detail){const expand=node('a','space-expand',post.images.length>3?'查看全部 '+post.images.length+' 张图片':'展开这条日常');expand.href='/space/?id='+encodeURIComponent(post.id);card.append(expand);}
 return card;
}
function entry(post){
 const p=dateParts(post.publishedAt),article=node('article','space-entry'),date=node('div','space-date');
 date.append(node('strong','',p.day),node('span','',p.month+'月'));article.append(date,content(post));return article;
}
async function request(url){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error||'加载失败');return data;}
async function load(reset=false){
 if(busy)return;busy=true;$('space-retry').hidden=true;$('space-more').disabled=true;
 try{
  if(!profile)profile=(await getSiteContent())?.profile||null;
  if(id){
   $('space-intro').hidden=true;const {post}=await request('/api/space?id='+encodeURIComponent(id));feed.replaceChildren();
   const section=node('article','space-detail'),back=node('a','space-detail-back','← 回到日常');back.href='/space/';const p=dateParts(post.publishedAt);
   section.append(back,node('p','space-detail-date',`${p.year} / ${p.month} / ${p.day}`),content(post,true));feed.append(section);hasMore=false;
  }else{
   const data=await request('/api/space?offset='+(reset?0:next));if(reset)feed.replaceChildren();
   for(const post of data.posts)feed.append(entry(post));next=data.nextOffset;hasMore=data.hasMore;
  }
  $('space-state').textContent=!feed.children.length?'还没有发布的日常':'';$('space-more').hidden=!hasMore;
 }catch(error){$('space-state').textContent=error.message;$('space-retry').hidden=false;}
 finally{busy=false;$('space-more').disabled=false;}
}
$('space-more').addEventListener('click',()=>load());$('space-retry').addEventListener('click',()=>load(!feed.children.length));
$('space-image-close').addEventListener('click',()=>$('space-lightbox').close());$('space-lightbox').addEventListener('click',event=>{if(event.target===$('space-lightbox'))$('space-lightbox').close();});
try{
 const theme=localStorage.getItem('shiloku-home-theme-v1');
 if(['train','sky','umbrella','horizon'].includes(theme)){
  const size=matchMedia('(max-width:768px)').matches?'mobile':'desktop';const base=theme==='horizon'?`/assets/admin-sky-${size}-20261027hq`:`/assets/theme-${theme}-${size}`;
  document.documentElement.style.setProperty('--space-scene',`image-set(url("${base}.avif") type("image/avif"),url("${base}.webp") type("image/webp"))`);
 }
}catch{ /* Theme storage is optional. */ }
load(true);
