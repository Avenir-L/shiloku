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
  $('google-login-hint').textContent=state.googleAvailable?'选择账号即可登录；仅已绑定的站长账号可进入。':'Google 登录尚未启用，需要完成网站的 Google 登录配置。';
  const passkeyAvailable=state.passkeyAvailable ?? state.initialized;
  $('sign-in').disabled=!passkeyAvailable;
  $('passkey-login-hint').textContent=passkeyAvailable?'通行密钥是可选的备用登录方式。':'尚未登记通行密钥。可以先用 Google 登录，再按需添加。';
  if(state.authenticated) {$('login').hidden=true;$('dashboard').hidden=false;await showPage(location.hash.slice(1)||'music');}
  else {
    loginScreen();
    if(state.recoveryOnly) $('setup').open=true;
    $('register-first').textContent=state.recoveryOnly?'登记新的通行密钥':'登记第一个通行密钥';
    $('setup-token').parentElement.hidden=state.recoveryOnly;
    if(state.recoveryOnly) notify('恢复码已验证，请登记新的通行密钥。');
    $('recovery-warning').hidden=!state.recoveryOnly;
  }
}
async function register(label,token) {
  const result=await api('register-options',{token});
  const response=await startRegistration({optionsJSON:result.options});
  await api('register-verify',{requestId:result.requestId,response,label});
  $('setup-token').value='';$('device-label').value='';await refreshSession();notify('通行密钥已登记，请再添加备用设备并保存恢复码。');
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
  if(!['music','space','guestbook','security'].includes(name)) name='music';
  if(name!=='music') stopQr();
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!=='page-'+name);
  document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===name));
  history.replaceState(null,'','#'+name);
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
on('google-sign-in',async()=>{
  const {url}=await api('google-start',{token:$('setup-token').value.trim()});
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
on('register-first',()=>register($('device-label').value,$('setup-token').value.trim()));
on('add-passkey',()=>register($('additional-label').value));
on('recover',async()=>{try{await api('recover',{code:$('recovery-code').value.trim()});await refreshSession();}finally{$('recovery-code').value='';}});
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
const setupFragment=new URLSearchParams(location.hash.slice(1));
if(setupFragment.has('setup')) {$('setup-token').value=setupFragment.get('setup');$('setup').open=true;history.replaceState(null,'',location.pathname);}
const loginResult=new URLSearchParams(location.search).get('login');
if(loginResult){history.replaceState(null,'',location.pathname+location.hash);notify(loginResult==='google-denied'?'这个 Google 账号没有后台权限，或首次绑定入口已失效。':'Google 登录未完成，请重试或检查登录配置。',true);}
if(!browserSupportsWebAuthn()) {$('sign-in').disabled=true;$('passkey-login-hint').textContent='当前浏览器不支持通行密钥，可以使用 Google 账号登录。';}
refreshSession().catch(error=>notify(error.message,true));
