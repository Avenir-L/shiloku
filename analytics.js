// Optional first-party measurements. Never block rendering or playback.
(()=>{
 if(location.pathname.startsWith('/admin')||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||navigator.webdriver)return;
 try{
  const key='shiloku-analytics-visitor-v1';let record;
  try{record=JSON.parse(localStorage.getItem(key)||'null')}catch{}
  if(!record||Date.now()-record.created>30*86400000){record={id:crypto.randomUUID(),created:Date.now()};localStorage.setItem(key,JSON.stringify(record))}
  let source='direct';
  if(document.referrer){const host=new URL(document.referrer).hostname;if(host!==location.hostname){source=/google\.|bing\.|baidu\.|duckduckgo\.|sogou\./i.test(host)?'search':/(^|\.)(bilibili\.com|t\.co|weibo\.com|qq\.com|vrchat\.com|steamcommunity\.com)$/.test(host)?'social':'other'}}
  const ua=navigator.userAgent,device=/iPad|Tablet/i.test(ua)?'tablet':/Mobi|Android|iPhone/i.test(ua)?'mobile':'desktop';
  const send=page=>{const body=JSON.stringify({page,visitor:record.id,event:crypto.randomUUID(),source,device});fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,credentials:'omit'}).catch(()=>{})};
  let music=document.body.classList.contains('music-room-open');send(music?'music':'home');
  new MutationObserver(()=>{const next=document.body.classList.contains('music-room-open');if(next&&!music)send('music');music=next}).observe(document.body,{attributes:true,attributeFilter:['class']});
 }catch{/* Statistics are optional, including when local storage is unavailable. */}
})();
