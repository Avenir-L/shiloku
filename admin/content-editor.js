const labels={bioTitle:'简介标题',bioP1:'简介第一段',bioP2:'简介第二段',aboutTitle:'「了解更多」弹窗标题',aboutBio1:'关于我第一段',aboutBio2:'关于我详细介绍',aboutExtra:'补充介绍',aboutMore:'「了解更多」按钮文字',galleryOpen:'「查看画作」按钮文字',galleryTitle:'画作页标题'};
export function createContentEditor({api,notify}){
 const $=id=>document.getElementById(id);
 let state=null,language='zh',dirty=false,busy=false;
 const fields=new Map();
 const mark=()=>{dirty=true;$('content-state').textContent='有尚未发布的修改';};
 function setBusy(value){busy=value;$('content-save').disabled=value;$('content-reload').disabled=value;$('content-form').inert=value;}
 async function upload(file,avatar=false){
  if(!file||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||file.size>12*1024*1024)throw Error('请选择 12 MB 以内的 JPG、PNG、WebP 或 AVIF 图片');
  const bitmap=await createImageBitmap(file);
  try{
   if(bitmap.width*bitmap.height>80000000)throw Error('图片尺寸过大，请先缩小后上传');
   let side=avatar?1024:2400,blob;
   do{
    const ratio=Math.min(1,side/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.94));
    side=Math.floor(side*.8);
   }while(blob&&blob.size>600000&&side>=600);
   if(!blob||blob.size>600000)throw Error('图片压缩后仍过大，请先缩小图片');
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
   return await api('content-upload',{data,type:blob.type});
  }finally{bitmap.close();}
 }
 function showLocale(){for(const [key,input]of fields)input.value=state.profile.locales[language][key];}
 function showProfile(){
  $('content-nickname').value=state.profile.nickname;$('content-subtitle').value=state.profile.subtitle;
  $('content-avatar-preview').src=state.profile.avatar;showLocale();
 }
 function button(text,action,label=text){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;}
 function showGallery(){
  $('content-gallery').replaceChildren();
  for(const [index,item]of state.gallery.entries()){
   const row=document.createElement('article');row.className='content-art';
   const image=document.createElement('img');image.src=item.image;image.alt=item.title;image.loading='lazy';
   const info=document.createElement('div');info.className='content-art-info';
   const label=document.createElement('label');label.textContent='画作标题';const title=document.createElement('input');title.value=item.title;title.maxLength=100;title.required=true;title.addEventListener('input',()=>{item.title=title.value;image.alt=title.value;mark();});label.append(title);info.append(label);
   const controls=document.createElement('div');controls.className='content-art-actions';
   for(const [key,text]of [['wip','未完成'],['hidden','暂不展示']]){
    const label=document.createElement('label');label.className='content-check';const input=document.createElement('input');input.type='checkbox';input.checked=item[key];input.addEventListener('change',()=>{item[key]=input.checked;mark();});label.append(input,document.createTextNode(text));controls.append(label);
   }
   for(const [delta,text]of [[-1,'↑'],[1,'↓']]){const move=button(text,()=>{[state.gallery[index],state.gallery[index+delta]]=[state.gallery[index+delta],state.gallery[index]];mark();showGallery();},`${item.title}${delta<0?'上移':'下移'}`);move.disabled=index+delta<0||index+delta>=state.gallery.length;controls.append(move);}
   const replace=document.createElement('label');replace.className='content-file-button';replace.textContent='更换图片';
   const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp,image/avif';file.addEventListener('change',()=>{if(file.files.length)run(async()=>{const result=await upload(file.files[0]);item.image=result.url;mark();showGallery();});});replace.append(file);controls.append(replace);
   controls.append(button('移出展示',()=>{state.gallery.splice(index,1);mark();showGallery();}));info.append(controls);row.append(image,info);$('content-gallery').append(row);
  }
  if(!state.gallery.length)$('content-gallery').textContent='尚无画作，可在下方添加';
 }
 async function run(fn){if(busy)return;setBusy(true);try{await fn();}catch(error){notify(error.message,true);}finally{setBusy(false);}}
 for(const [key,text]of Object.entries(labels)){
  const label=document.createElement('label');label.textContent=text;const input=document.createElement(key.startsWith('bioP')||key.startsWith('aboutBio')||key==='aboutExtra'?'textarea':'input');
  input.maxLength=key.startsWith('aboutBio')?2500:1000;input.rows=key==='aboutBio2'?5:3;
  input.addEventListener('input',()=>{state.profile.locales[language][key]=input.value;mark();});label.append(input);fields.set(key,input);
  $(key.startsWith('about')?'content-about-fields':key.startsWith('gallery')?'content-gallery-fields':'content-bio-fields').append(label);
 }
 $('content-language').addEventListener('change',event=>{language=event.target.value;if(state)showLocale();});
 for(const [id,key]of [['content-nickname','nickname'],['content-subtitle','subtitle']])$(id).addEventListener('input',event=>{state.profile[key]=event.target.value;mark();});
 $('content-avatar').addEventListener('change',()=>{if($('content-avatar').files.length)run(async()=>{state.profile.avatar=(await upload($('content-avatar').files[0],true)).url;showProfile();mark();$('content-avatar').value='';});});
 $('content-avatar-reset').addEventListener('click',()=>{state.profile.avatar='/avatar.jpg';showProfile();mark();});
 $('content-art-add').addEventListener('change',()=>run(async()=>{
  if(!$('content-art-add').files.length)return;
  if(state.gallery.length>=60)throw Error('最多可展示 60 张画作');
  const file=$('content-art-add').files[0];const result=await upload(file);
  state.gallery.push({id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,100),image:result.url,wip:false,hidden:false});
  mark();showGallery();$('content-art-add').value='';
 }));
 $('content-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  state=await api('content-save',state);dirty=false;showProfile();showGallery();$('content-state').textContent='已发布 · '+new Date(state.updatedAt).toLocaleString();notify('主站内容已发布，刷新主站即可查看');
 });});
 async function load(force=false){
  if(state&&!force)return;
  if(force&&dirty&&!confirm('重新载入会放弃尚未发布的修改，继续？'))return;
  setBusy(true);$('content-state').textContent='正在读取主站内容';
  try{const next=await api('content-get');state=next;dirty=false;showProfile();showGallery();$('content-state').textContent=state.updatedAt?'上次发布 · '+new Date(state.updatedAt).toLocaleString():'当前主站内容';$('content-form').hidden=false;}
  catch(error){$('content-state').textContent='读取失败，请重试';throw error;}
  finally{setBusy(false);}
 }
 $('content-reload').addEventListener('click',()=>load(true).catch(error=>notify(error.message,true)));
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 return {load};
}
