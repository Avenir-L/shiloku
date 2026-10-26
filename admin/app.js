import {startRegistration,startAuthentication,browserSupportsWebAuthn} from '@simplewebauthn/browser';
import QRCode from 'qrcode';
import {chartModel} from './analytics-chart.js';
import {qrRetryDelay} from './qr-poll.js';

const $=id=>document.getElementById(id);
let currentSession=null,qrTimer=null,qrVersion=0,recoveryCodes=[];
function notify(message,error=false) {
  $('notice').textContent=message;$('notice').classList.toggle('error',error);$('notice').hidden=false;
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('notice').hidden=true,6500);
}
function stopQr() {qrVersion++;clearTimeout(qrTimer);qrTimer=null;$('qr-area').hidden=true;$('qr-image').removeAttribute('src');}
function loginScreen() {
  stopQr();$('dashboard').hidden=true;$('login').hidden=false;
  $('messages').replaceChildren();$('credentials').replaceChildren();$('manual-cookie').value='';
  $('recovery-output').textContent='';$('recovery-output').hidden=true;$('download-recovery').hidden=true;recoveryCodes=[];
}
async function api(action,body={}) {
  const response=await fetch('/api/admin?action='+encodeURIComponent(action),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  const result=await response.json();
  if(!response.ok) {if(response.status===401) loginScreen();throw Object.assign(new Error(result.error||'操作失败'),{status:response.status});}
  return result;
}
async function refreshSession() {
  const response=await fetch('/api/admin',{credentials:'same-origin',cache:'no-store'});
  const state=await response.json();
  if(!response.ok) throw new Error(state.error||'后台暂时不可用');
  currentSession=state;
  $('google-sign-in').disabled=!state.googleAvailable;
  $('google-bind').disabled=!state.googleAvailable;
  $('google-bind').textContent=state.googleBound?'使用 Google 重新验证':'绑定 Google 账号';
  $('google-account-state').textContent=state.googleBound?'已绑定站长 Google 账号。':state.googleAvailable?'首次绑定需要当前站长身份在最近 5 分钟内验证过。':'Google 登录尚未配置。';
  const passkeyAvailable=state.passkeyAvailable ?? state.initialized;
  $('sign-in').disabled=!passkeyAvailable;
  $('passkey-login-hint').textContent=passkeyAvailable?'通行密钥是可选的备用登录方式。':'尚未登记通行密钥。可以先用 Google 登录，再按需添加。';
  if(state.authenticated) {$('login').hidden=true;$('dashboard').hidden=false;await showPage(location.hash.slice(1)||'overview');}
  else {
    loginScreen();

  }
}
async function register(label,token) {
  const result=await api('register-options',{token});
  const response=await startRegistration({optionsJSON:result.options});
  await api('register-verify',{requestId:result.requestId,response,label});
  $('additional-label').value='';await refreshSession();notify('通行密钥已登记，请再添加备用设备并保存恢复码。');
}
async function musicStatus() {
  $('account-state').textContent='正在检查连接…';
  try {
    const state=await api('music-status');
    $('account-state').textContent=state.valid?(state.nickname||'网易云账号已连接'):state.hasCookie?'登录已失效':'尚未连接网易云';
    $('account-pill').textContent=state.valid?'已连接':'需要登录';
    $('account-detail').textContent=state.updatedAt?'最近更新：'+new Date(state.updatedAt).toLocaleString():state.hasCookie?'当前使用部署配置中的登录信息。':'扫码登录后自动验证并加密保存。';
  } catch(error) {$('account-state').textContent='暂时无法检查连接';$('account-pill').textContent='检查失败';throw error;}
}
async function showPage(name) {
  if(!['overview','music','space','guestbook','security'].includes(name)) name='overview';
  if(name!=='music') stopQr();
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!=='page-'+name);
  document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===name));
  history.replaceState(null,'','#'+name);
  if(name==='overview') await loadAnalytics(7);
  if(name==='music') await musicStatus();
  if(name==='guestbook') {
    const {messages}=await api('guestbook');$('messages').replaceChildren();
    if(!messages.length) {$('messages').textContent='暂无留言。';return;}
    for(const message of messages) {
      const article=document.createElement('article');article.className='message';
      const header=document.createElement('header'),strong=document.createElement('strong'),time=document.createElement('time'),p=document.createElement('p');
      strong.textContent=message.name||'访客';time.textContent=new Date(message.time).toLocaleString();p.textContent=message.message;
      header.append(strong,time);article.append(header,p);$('messages').append(article);
    }
  }
  if(name==='security') {
    const {credentials}=await api('passkeys');$('credentials').replaceChildren();
    for(const credential of credentials) {
      const row=document.createElement('div');row.className='credential';
      const title=document.createElement('div'),detail=document.createElement('small');
      title.textContent=credential.label;detail.textContent='登记于 '+new Date(credential.createdAt).toLocaleString()+(credential.backedUp?' · 已备份通行密钥':'');
      row.append(title,detail);
      const rename=document.createElement('button');rename.className='text-button';rename.textContent='重命名';
      const editor=document.createElement('form');editor.className='credential-rename';editor.hidden=true;
      const label=document.createElement('label');label.textContent='设备名称';
      const input=document.createElement('input');input.maxLength=60;input.required=true;input.autocomplete='off';label.append(input);
      const save=document.createElement('button');save.className='secondary';save.type='submit';save.textContent='保存';
      const cancel=document.createElement('button');cancel.className='text-button';cancel.type='button';cancel.textContent='取消';
      editor.append(label,save,cancel);
      rename.addEventListener('click',()=>{editor.hidden=false;input.value=credential.label;input.focus();input.select()});
      cancel.addEventListener('click',()=>{editor.hidden=true;rename.focus()});
      editor.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;cancel.disabled=true;try{await api('passkey-rename',{id:credential.id,label:input.value});await showPage('security');notify('设备名称已更新')}catch(error){notify(error.message,true)}finally{save.disabled=false;cancel.disabled=false}});
      const remove=document.createElement('button');remove.className='text-button';remove.textContent='移除设备';remove.disabled=credentials.length<=1;
      remove.addEventListener('click',async()=>{
        if(!window.confirm('移除这个设备并退出所有已登录会话？至少需要保留一个可用通行密钥。'))return;
        remove.disabled=true;
        try{await api('passkey-remove',{id:credential.id});loginScreen();notify('设备已移除，所有会话已退出。请使用保留的通行密钥登录。');}
        catch(error){notify(error.message,true);remove.disabled=false;}
      });
      row.append(rename,remove,editor);$('credentials').append(row);
    }
  }
}
function on(id,fn) {
  $(id).addEventListener('click',async()=>{
    $(id).disabled=true;
    try {await fn();} catch(error) {notify(error.name==='NotAllowedError'?'验证已取消或超时，请重试。':error.message,true);}
    finally {$(id).disabled=false;}
  });
}
let analyticsRequest=0;
async function loadAnalytics(range){
 const request=++analyticsRequest;
 $('analytics-state').textContent='正在读取统计';
 document.querySelectorAll('[data-range]').forEach(b=>{b.disabled=true;b.setAttribute('aria-pressed',String(Number(b.dataset.range)===range))});
 try{
  const data=await api('analytics',{range});if(request!==analyticsRequest)return;
  for(const field of ['pv','uv','home','music'])$('analytics-'+field).textContent=Number(data[field]).toLocaleString();
  $('analytics-state').textContent=data.demo?'本地演示数据 · 不代表真实访问量':data.pv?'已更新 · '+new Date().toLocaleTimeString():'暂未记录访问，接入后会自动累计';
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),model=chartModel(data.days);svg.setAttribute('viewBox','0 0 720 270');svg.setAttribute('role','img');svg.setAttribute('aria-label','每日浏览量折线图，横轴为北京时间日期，纵轴为浏览量 PV，详细数值见下方每日数据');
  const add=(tag,attrs,text)=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;svg.append(el);return el};
  add('text',{x:model.left,y:16,class:'chart-axis-title'},'浏览量 PV');
  for(const tick of model.yTicks){add('line',{x1:model.left,x2:model.right,y1:tick.y,y2:tick.y,class:'chart-grid'});add('text',{x:model.left-12,y:tick.y+5,'text-anchor':'end',class:'chart-tick'},tick.value.toLocaleString())}
  add('line',{x1:model.left,x2:model.right,y1:model.bottom,y2:model.bottom,class:'chart-axis'});
  add('line',{x1:model.left,x2:model.left,y1:model.top,y2:model.bottom,class:'chart-axis'});
  for(const tick of model.xTicks){add('line',{x1:tick.x,x2:tick.x,y1:model.bottom,y2:model.bottom+5,class:'chart-axis'});add('text',{x:tick.x,y:model.bottom+24,'text-anchor':'middle',class:'chart-tick'},tick.label)}
  add('text',{x:(model.left+model.right)/2,y:257,'text-anchor':'middle',class:'chart-axis-title'},`${data.days[0].date} — ${data.days.at(-1).date} · 日期 / 北京时间`);
  add('polyline',{points:model.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'currentColor','stroke-width':3});
  for(const point of model.points){const dot=add('circle',{cx:point.x,cy:point.y,r:4,fill:'currentColor'});const title=document.createElementNS(ns,'title');title.textContent=`${point.date} · 浏览量 ${point.pv} · 访客数 ${point.uv}`;dot.append(title)}
  $('analytics-chart').replaceChildren(svg);
  $('analytics-days').replaceChildren();data.days.forEach(d=>{const row=document.createElement('p');row.className='analytics-row';row.textContent=`${d.date}　浏览量 ${d.pv}　访客数 ${d.uv}`;$('analytics-days').append(row)});
  for(const [id,fields]of [['sources',[['direct','直接访问'],['search','搜索引擎'],['social','社交链接'],['other','其他来源']]],['devices',[['desktop','电脑'],['mobile','手机'],['tablet','平板']]]]){
   $('analytics-'+id).replaceChildren();for(const [field,label]of fields){const row=document.createElement('p');row.className='analytics-row';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=Number(data[field]||0).toLocaleString();row.append(a,b);$('analytics-'+id).append(row)}
  }
 }catch(error){if(request===analyticsRequest){$('analytics-state').textContent='统计暂不可用，请稍后重试';for(const f of ['pv','uv','home','music'])$('analytics-'+f).textContent='—';$('analytics-chart').replaceChildren();$('analytics-days').replaceChildren();$('analytics-sources').replaceChildren();$('analytics-devices').replaceChildren()}}
 finally{if(request===analyticsRequest)document.querySelectorAll('[data-range]').forEach(b=>b.disabled=false)}
}
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>loadAnalytics(Number(b.dataset.range))));
on('google-sign-in',async()=>{
  const {url}=await api('google-start');
  const target=new URL(url);
  if(target.origin!=='https://accounts.google.com')throw new Error('登录地址不受信任');
  location.assign(target.href);
});
on('google-bind',async()=>{
  const {url}=await api('google-start');
  if(new URL(url).origin!=='https://accounts.google.com')throw new Error('登录地址不受信任');
  location.assign(url);
});
on('sign-in',async()=>{
  const result=await api('login-options');
  const response=await startAuthentication({optionsJSON:result.options});
  await api('login-verify',{requestId:result.requestId,response});
  await refreshSession();notify('已安全登录。');
});
on('add-passkey',()=>register($('additional-label').value));
on('logout',async()=>{await api('logout');currentSession=null;loginScreen();notify('已退出登录。');});
on('refresh-status',musicStatus);
on('manual-save',async()=>{
  try {await api('music-save',{cookie:$('manual-cookie').value});await musicStatus();notify('登录信息已加密保存，后续音乐请求立即使用。');}
  finally {$('manual-cookie').value='';}
});
on('qr-stop',stopQr);
on('qr-start',async()=>{
  stopQr();const version=qrVersion;let failures=0;
  const {id,qrUrl}=await api('music-qr-create');
  if(version!==qrVersion) return;
  $('qr-image').src=await QRCode.toDataURL(qrUrl,{width:220,margin:1,errorCorrectionLevel:'M'});
  $('qr-area').hidden=false;$('qr-status').textContent='请使用网易云音乐 App 扫码';
  async function poll() {
    try {
      const result=await api('music-qr-check',{id});
      if(version!==qrVersion) return;
      failures=0;
      if(result.state==='success') {stopQr();await musicStatus();notify('网易云已连接，登录信息已加密保存。');return;}
      if(result.state==='expired') {stopQr();notify('二维码已过期，请重新生成。',true);return;}
      $('qr-status').textContent=result.state==='scanned'?'已扫描，请在手机上确认':'等待扫码…';
      qrTimer=setTimeout(poll,3000);
    } catch(error) {
      if(version!==qrVersion)return;
      if(error.status===422){$('qr-status').textContent=error.message;notify(error.message,true);return;}
      const delay=qrRetryDelay(error,++failures);
      if(delay!==null){$('qr-status').textContent=`状态检查暂时失败，二维码保留，正在重试（${failures}/3）`;qrTimer=setTimeout(poll,delay);return;}
      if([502,503,504].includes(error.status)){$('qr-status').textContent='暂时无法确认扫码结果，请重新生成二维码';notify(error.message,true);}
      else{stopQr();notify(error.message,true);}
    }
  }
  qrTimer=setTimeout(poll,3000);
});
on('create-recovery',async()=>{
  if(!window.confirm('生成新恢复码会让旧恢复码失效。是否继续？')) return;
  const {codes}=await api('recovery-create');recoveryCodes=codes;
  $('recovery-output').textContent=codes.join('\n');$('recovery-output').hidden=false;$('download-recovery').hidden=false;
  notify('请离线保存。这些恢复码仅本次显示，每个只能使用一次。');
});
on('download-recovery',()=>{
  const blob=new Blob(['Shiloku 后台一次性恢复码\n请离线妥善保存，不要分享。\n\n'+recoveryCodes.join('\n')],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shiloku-recovery-codes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.page).catch(error=>notify(error.message,true))));
const loginResult=new URLSearchParams(location.search).get('login');
if(loginResult){history.replaceState(null,'',location.pathname+location.hash);notify(loginResult==='google-denied'?'这个 Google 账号没有后台权限。':'Google 登录未完成，请重试或检查登录配置。',true);}
if(!browserSupportsWebAuthn()) {$('sign-in').disabled=true;$('passkey-login-hint').textContent='当前浏览器不支持通行密钥，可以使用 Google 账号登录。';}
refreshSession().catch(error=>notify(error.message,true));
