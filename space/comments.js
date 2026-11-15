const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
export function commentSection(postId){
 const section=node('section'),heading=node('h2','评论'),list=node('div'),state=node('p'),more=node('button','加载更多评论'),form=node('form');
 section.className='space-comments';state.setAttribute('role','status');more.type='button';more.hidden=true;
 const nameLabel=node('label','昵称'),name=node('input');name.required=true;name.maxLength=32;name.autocomplete='nickname';nameLabel.append(name);
 const textLabel=node('label','评论'),text=node('textarea');text.required=true;text.maxLength=1000;text.rows=3;textLabel.append(text);
 const submit=node('button','发表评论');submit.type='submit';form.append(nameLabel,textLabel,submit);section.append(heading,list,state,more,form);
 let offset=0,busy=false,loaded=false;
 const url='/api/space?action=comments&id='+encodeURIComponent(postId);
 async function request(address,options){const res=await fetch(address,{...options,signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'评论加载失败'),{status:res.status});return data;}
 function row(item){const article=node('article'),byline=node('p'),time=node('time',new Date(item.createdAt).toLocaleString());time.dateTime=item.createdAt;byline.append(node('strong',item.name),time);article.append(byline,node('p',item.text));return article;}
 async function load(reset=false){if(busy)return;busy=true;more.disabled=true;state.textContent='正在加载评论…';try{const data=await request(url+'&offset='+(reset?0:offset));if(reset)list.replaceChildren();for(const item of data.comments)list.append(row(item));offset=data.nextOffset;more.hidden=!data.hasMore;state.textContent=list.children.length?'':'还没有评论';loaded=true;}catch(e){if(e.status===404){list.replaceChildren();form.hidden=true;more.hidden=true;}state.textContent=e.message;}finally{busy=false;more.disabled=false;}}
 more.addEventListener('click',()=>load());
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;submit.disabled=true;state.textContent='正在发送…';try{await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value,text:text.value})});text.value='';busy=false;await load(true);}catch(e){state.textContent=e.message;if(e.status===404){list.replaceChildren();form.hidden=true;more.hidden=true;}}finally{busy=false;submit.disabled=false;}});
 return {element:section,load:()=>{if(!loaded)void load(true);}};
}
