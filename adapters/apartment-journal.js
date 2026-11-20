import {commentSection} from './journal-comments.js';

const format = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
function element(tag, text, cls) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
export function mountJournal(scene, latest) {
  const pane = element('section', '', 'daily-journal');
  pane.tabIndex = 0;
  pane.setAttribute('aria-label','日常手记');
  const entries = element('div'), state = element('p'), more = element('button','更早的日常');
  state.setAttribute('role','status');
  const avatarSrc = latest.closest('#navigation-prototype').querySelector('.nav-prototype-avatar').src;
  pane.append(element('h1','日常'), entries, state, more);
  more.hidden = true;
  scene.append(pane);
  const viewer = element('dialog','','daily-viewer'), large = element('img'), close = element('button','关闭');
  viewer.setAttribute('aria-label','查看配图');
  viewer.append(large,close);
  scene.append(viewer);
  close.onclick = () => viewer.close();
  viewer.onclick = e => { if(e.target === viewer) viewer.close(); };
  const seen = new Set();
  let offset=0, done=false, busy=false, newest=null, jump=false;
  function jumpToLatest() {
    if (!jump || !newest || scene.inert) return;
    const item = document.getElementById('daily-'+newest.id);
    pane.scrollTop += item.getBoundingClientRect().top - pane.getBoundingClientRect().top - 32;
    if (newest.id === seen.values().next().value) pane.scrollTop=0;
    jump=false;
  }
  latest.addEventListener('click',()=>{jump=true;queueMicrotask(jumpToLatest);});
  function add(post) {
    if(seen.has(post.id)) return;
    seen.add(post.id);
    const date = Object.fromEntries(format.formatToParts(new Date(post.publishedAt)).map(p=>[p.type,p.value]));
    const item=element('article');
    item.id='daily-'+post.id;
    const avatar=element('img','','daily-entry-avatar');
    avatar.src=avatarSrc;
    avatar.alt='栀落余殁的头像';
    avatar.width=avatar.height=36;
    const timestamp=date.year+'年'+date.month+'月'+date.day+'日 '+date.hour+':'+date.minute;
    const time=element('time',timestamp);
    time.dateTime=post.publishedAt;
    const body=element('div','','daily-body');
    if(post.pinned) body.append(element('small','置顶'));
    if(post.text) body.append(element('p',post.text));
    const media=element('div','','daily-media');
    for(const [i,url] of post.images.entries()) {
      const image=element('img'),button=element('button');
      image.src=new URL(url, ['127.0.0.1','localhost'].includes(location.hostname)?'https://shiloku.cn':location.origin).href;
      image.alt='动态配图 '+(i+1);image.loading='lazy';image.decoding='async';
      button.append(image);button.onclick=()=>{large.src=image.src;large.alt=image.alt;viewer.showModal();};
      media.append(button);
    }
    if(media.childElementCount) body.append(media);
    for(const link of post.links) {
      const a=element('a',link.title||link.platform);a.href=link.url;a.rel='noopener noreferrer';a.target='_blank';body.append(a);
    }
    const toggle=element('button','评论'), comments=commentSection(post.id);
    comments.element.hidden=true;toggle.setAttribute('aria-expanded','false');
    toggle.onclick=()=>{comments.element.hidden=!comments.element.hidden;toggle.setAttribute('aria-expanded',String(!comments.element.hidden));if(!comments.element.hidden)comments.load();};
    const meta=element('footer','','daily-meta');
    meta.append(time,toggle);
    item.className='daily-entry';
    item.append(avatar,body,meta,comments.element);entries.append(item);
    if(!newest || post.publishedAt>newest.publishedAt) {
      newest=post;
      const text=Array.from(post.text||'查看配图');
      latest.querySelector('span').firstChild.textContent=text.slice(0,32).join('')+(text.length>32?'… ':' ');
    }
  }
  async function load() {
    if(busy || done) return;
    busy=true;more.disabled=true;state.textContent='正在读取日常…';
    try {
      const r=await fetch('/api/space?offset='+offset,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!r.ok) throw Error();
      const data=await r.json();
      for(const post of data.posts) add(post);
      offset=data.nextOffset;done=!data.hasMore;
      more.hidden=done;more.textContent='更早的日常';state.textContent=seen.size?'':'还没有发布的日常';
      jumpToLatest();
    } catch {state.textContent='日常暂时没有加载出来。';more.hidden=false;more.textContent='重新加载';}
    finally {busy=false;more.disabled=false;}
  }
  more.onclick=load;
  const preload=()=>{if(!seen.size)load();};
  if(document.readyState==='complete') setTimeout(preload,0);
  else window.addEventListener('load',preload,{once:true});
  return {open(){preload();jumpToLatest();}};
}
