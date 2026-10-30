import {uploadSiteImage} from './content-editor.js';
export function createSpaceEditor({api,notify}){
 const $=id=>document.getElementById(id);
 let privacy,post,dirty=false,busy=false,loaded=false,next=0,cache=new Map();
 const fresh=()=>({id:crypto.randomUUID(),revision:'initial',text:'',images:[],links:[],status:'draft',pinned:false,hidden:false});
 const mark=()=>{dirty=true;$('space-editor-state').textContent='有尚未保存的修改';};
 function setBusy(value){busy=value;$('space-form').inert=value;$('space-privacy').inert=value;$('space-posts').inert=value;$('space-new').disabled=value;$('space-more').disabled=value;}
 async function run(fn){if(busy)return;setBusy(true);try{await fn();}catch(error){notify(error.message,true);}finally{setBusy(false);}}
 function button(text,callback){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.addEventListener('click',callback);return b;}
 function showImages(){
  $('space-images').replaceChildren();
  post.images.forEach((url,index)=>{const figure=document.createElement('figure');const img=document.createElement('img');img.src=url;img.alt='说说配图 '+(index+1);figure.append(img,button('移除',()=>{post.images.splice(index,1);mark();showImages();}));$('space-images').append(figure);});
 }
 function showLinks(){
  $('space-link-preview').replaceChildren();for(const link of post.links){const p=document.createElement('p');p.textContent=link.platform+' · '+link.title;$('space-link-preview').append(p);}
 }
 function edit(item){
  post=structuredClone(item);cache=new Map(post.links.map(link=>[link.url,link]));dirty=false;
  $('space-text').value=post.text;$('space-links').value=post.links.map(link=>link.url).join('\n');$('space-pinned').checked=post.pinned;$('space-hidden').checked=!!post.hidden;
  $('space-draft').textContent=post.status==='published'?'转为草稿':'存草稿';$('space-publish').textContent=post.status==='published'?'保存并更新':'发布说说';
  $('space-editor-state').textContent=post.revision==='initial'?'写一条新的日常':post.status==='draft'?'正在编辑草稿':post.hidden?'正在编辑隐藏说说':'正在编辑已发布说说';showImages();showLinks();
 }
 function allowSwitch(){return !dirty||confirm('当前有未保存的修改，放弃这些修改？');}
 async function resolveLinks(){
  const urls=[...new Set(($('space-links').value.match(/https?:\/\/[^\s<>"，。]+/g)||[]).map(url=>url.replace(/[)）]+$/,'')))];
  if($('space-links').value.trim()&&!urls.length)throw Error('请粘贴完整的平台分享链接');if(urls.length>6)throw Error('每条说说最多 6 个分享链接');
  const links=[];for(const url of urls){if(!cache.has(url))cache.set(url,await api('space-resolve',{url}));links.push(cache.get(url));}
  post.links=links;showLinks();
 }
 function renderRows(posts,append=false){
  if(!append)$('space-posts').replaceChildren();
  for(const item of posts){
   const row=document.createElement('article');row.className='card space-post-row';
   const meta=document.createElement('p');meta.className='muted';meta.textContent=(item.pinned?'置顶 · ':'')+(item.status==='draft'?'草稿':item.hidden?'已隐藏 · 仅自己可见':'公开')+' · '+new Date(item.publishedAt||item.updatedAt).toLocaleString();
   const text=document.createElement('p');text.className='space-post-summary';text.textContent=item.text.slice(0,200)||(item.images.length?'图片日常':'分享链接');
   const controls=document.createElement('div');controls.className='space-controls';
   controls.append(button('编辑',()=>{if(allowSwitch()){edit(item);$('space-form').scrollIntoView({behavior:'smooth',block:'start'});}}));
   controls.append(button(item.pinned?'取消置顶':'置顶',()=>run(async()=>{
    if(dirty&&post.id===item.id)throw Error('请先保存当前说说再修改置顶');
    const saved=await api('space-save',{...item,pinned:!item.pinned});if(post.id===item.id)edit(saved);await loadRows();notify(saved.pinned?'已置顶':'已取消置顶');
   })));
   if(item.status==='published')controls.append(button(item.hidden?'公开':'隐藏',()=>run(async()=>{
    if(dirty&&post.id===item.id)throw Error('请先保存当前说说再修改可见状态');
    const saved=await api('space-visibility',{id:item.id,revision:item.revision,hidden:!item.hidden});
    if(post.id===item.id)edit(saved);await loadRows();notify(saved.hidden?'已隐藏，仅你可见':'已设为公开，仍受可见时间范围限制');
   })));
   controls.append(button('删除',()=>run(async()=>{
    if(!confirm('确定删除这条说说？删除后无法从编辑器恢复'))return;
    await api('space-delete',{id:item.id,revision:item.revision});if(post.id===item.id)edit(fresh());await loadRows();notify('说说已删除');
   })));
   row.append(meta,text,controls);$('space-posts').append(row);
  }
  if(!$('space-posts').children.length)$('space-posts').textContent='还没有说说，可以先写一条日常';
 }
 async function loadRows(append=false){const data=await api('space-list',{offset:append?next:0});renderRows(data.posts,append);next=data.nextOffset;$('space-more').hidden=!data.hasMore;}
 $('space-privacy').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  const value=$('space-visible-after').value;
  privacy=await api('space-settings-save',{revision:privacy.revision,visibleAfter:value?new Date(value+':00+08:00').toISOString():null});
  $('space-privacy-state').textContent=privacy.visibleAfter?'已保存，访客只能查看指定时间及之后的公开说说':'已保存，公开全部未隐藏的历史说说';notify('可见范围已更新');
 });});
 $('space-hidden').addEventListener('change',()=>{post.hidden=$('space-hidden').checked;mark();});
 $('space-new').addEventListener('click',()=>{if(allowSwitch())edit(fresh());});
 $('space-text').addEventListener('input',()=>{post.text=$('space-text').value;mark();});
 $('space-links').addEventListener('input',mark);
 $('space-pinned').addEventListener('change',()=>{post.pinned=$('space-pinned').checked;mark();});
 $('space-resolve').addEventListener('click',()=>run(async()=>{await resolveLinks();mark();notify('分享卡片已准备好');}));
 $('space-upload').addEventListener('change',()=>run(async()=>{
  const files=[...$('space-upload').files];if(files.length+post.images.length>9)throw Error('每条说说最多 9 张图片');
  try{for(const file of files){const result=await uploadSiteImage(file,{api});post.images.push(result.url);mark();showImages();}}finally{$('space-upload').value='';}
 }));
 $('space-form').addEventListener('submit',event=>{event.preventDefault();const status=event.submitter?.dataset.status||post.status;run(async()=>{
  post.text=$('space-text').value;await resolveLinks();const saved=await api('space-save',{...post,status});edit(saved);await loadRows();notify(status==='published'?(saved.hidden?'说说已保存，仅你可见':'说说已发布到日常页'):'草稿已保存，仅你可见');
 });});
 $('space-more').addEventListener('click',()=>run(()=>loadRows(true)));
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 edit(fresh());
 return {async load(){if(loaded)return;privacy=await api('space-settings');$('space-visible-after').value=privacy.visibleAfter?new Date(Date.parse(privacy.visibleAfter)+8*3600000).toISOString().slice(0,16):'';await loadRows();loaded=true;}};
}
