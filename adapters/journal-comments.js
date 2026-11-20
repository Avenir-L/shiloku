// Read-only preview adaptation of space/comments.js.
const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
export function commentSection(postId){
 const section=node('section'),list=node('div'),state=node('p'),more=node('button','加载更多评论');
 section.className='space-comments';state.setAttribute('role','status');more.type='button';more.hidden=true;
 section.append(list,state,more);
 let offset=0,busy=false,loaded=false;
 const url='/api/space?action=comments&id='+encodeURIComponent(postId);
 async function request(address,options){const res=await fetch(address,{...options,signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'评论加载失败'),{status:res.status});return data;}
 function row(item){const article=node('article'),byline=node('p'),time=node('time',new Date(item.createdAt).toLocaleString());time.dateTime=item.createdAt;byline.append(node('strong',item.name),time);article.append(byline,node('p',item.text));return article;}
 async function load(reset=false){if(busy)return;busy=true;more.disabled=true;state.textContent='正在加载评论…';try{const data=await request(url+'&offset='+(reset?0:offset));if(reset)list.replaceChildren();for(const item of data.comments)list.append(row(item));offset=data.nextOffset;more.hidden=!data.hasMore;state.textContent=list.children.length?'':'还没有评论';loaded=true;}catch(e){if(e.status===404){list.replaceChildren();more.hidden=true;}state.textContent=e.message;}finally{busy=false;more.disabled=false;}}
 more.addEventListener('click',()=>load());
 return {element:section,load:()=>{if(!loaded)void load(true);}};
}
