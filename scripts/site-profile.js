let request;
export function getSiteContent(){
 if(!request)request=fetch('/api/site-content',{cache:'no-store',signal:AbortSignal.timeout(10000)})
  .then(response=>{if(!response.ok)throw Error('content');return response.json();})
  .catch(()=>null);
 return request;
}
export function applyProfile(profile){
 if(!profile)return;
 window.shilokuProfile=profile;
 const name=document.getElementById('name-text');if(name&&name.textContent!==profile.nickname)name.textContent=profile.nickname;
 const subtitle=document.querySelector('.name-box .subtitle');if(subtitle&&subtitle.textContent!==profile.subtitle)subtitle.textContent=profile.subtitle;
 document.querySelectorAll('#site-avatar,[data-site-avatar]').forEach(image=>{
  image.removeAttribute('data-shiloku-asset');image.src=profile.avatar;image.alt=profile.nickname+' 的头像';
 });
 document.querySelectorAll('[data-site-nickname]').forEach(node=>node.textContent=profile.subtitle||profile.nickname);
 const language=(document.documentElement.lang||'zh').slice(0,2);
 const pack=profile.locales[language]||profile.locales.zh;
 document.querySelectorAll('[data-i18n]').forEach(node=>{const key=node.getAttribute('data-i18n');if(Object.hasOwn(pack,key)&&node.textContent!==pack[key])node.textContent=pack[key];});
 window.dispatchEvent(new CustomEvent('shiloku:profilechange',{detail:{profile}}));
}
getSiteContent().then(data=>applyProfile(data?.profile));
window.addEventListener('shiloku:langchange',()=>{if(window.shilokuProfile)applyProfile(window.shilokuProfile);});
