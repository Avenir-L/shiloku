import {startRegistration,startAuthentication,browserSupportsWebAuthn} from '@simplewebauthn/browser';
import QRCode from 'qrcode';

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
  if(!response.ok) {if(response.status===401) loginScreen();throw new Error(result.error||'操作失败');}
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
      const remove=document.createElement('button');remove.className='text-button';remove.textContent='移除设备';remove.disabled=credentials.length<=1;
      remove.addEventListener('click',async()=>{
        if(!window.confirm('移除这个设备并退出所有已登录会话？至少需要保留一个可用通行密钥。'))return;
        remove.disabled=true;
        try{await api('passkey-remove',{id:credential.id});loginScreen();notify('设备已移除，所有会话已退出。请使用保留的通行密钥登录。');}
        catch(error){notify(error.message,true);remove.disabled=false;}
      });
      row.append(remove);$('credentials').append(row);
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
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 720 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','每日浏览量折线图，详细数值见下方每日数据');
  const max=Math.max(1,...data.days.map(d=>d.pv)),points=data.days.map((d,i)=>`${data.days.length===1?360:20+i*680/(data.days.length-1)},${150-d.pv/max*125}`).join(' ');
  const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points);line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','3');svg.append(line);
  data.days.forEach((d,i)=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',data.days.length===1?'360':String(20+i*680/(data.days.length-1)));dot.setAttribute('cy',String(150-d.pv/max*125));dot.setAttribute('r','3');dot.setAttribute('fill','currentColor');const title=document.createElementNS(ns,'title');title.textContent=`${d.date} · PV ${d.pv} · UV ${d.uv}`;dot.append(title);svg.append(dot)});
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
  stopQr();const version=qrVersion;
  const {id,qrUrl}=await api('music-qr-create');
  if(version!==qrVersion) return;
  $('qr-image').src=await QRCode.toDataURL(qrUrl,{width:220,margin:1,errorCorrectionLevel:'M'});
  $('qr-area').hidden=false;$('qr-status').textContent='请使用网易云音乐 App 扫码';
  async function poll() {
    try {
      const result=await api('music-qr-check',{id});
      if(version!==qrVersion) return;
      if(result.state==='success') {stopQr();await musicStatus();notify('网易云已连接，登录信息已加密保存。');return;}
      if(result.state==='expired') {stopQr();notify('二维码已过期，请重新生成。',true);return;}
      $('qr-status').textContent=result.state==='scanned'?'已扫描，请在手机上确认':'等待扫码…';
      qrTimer=setTimeout(poll,3000);
    } catch(error) {if(version===qrVersion){stopQr();notify(error.message,true);}}
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
