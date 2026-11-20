const journey = document.querySelector('#station-journey');
// Keep the original text available as one continuous sentence to screen readers.
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
let arrivalMs = 120;
for (const block of journey.querySelector('.station-about-copy').children) {
  const original = block.textContent;
  const accessibleText = document.createElement('span');
  accessibleText.className = 'station-copy-readable';
  accessibleText.textContent = original;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  const characters = segmenter
    ? Array.from(segmenter.segment(original), part => part.segment) : Array.from(original);
  for (const character of characters) {
    if (character.trim()) {
      const glyph = document.createElement('span');
      glyph.className = 'station-copy-glyph';
      glyph.style.setProperty('--arrive', arrivalMs + 'ms');
      glyph.textContent = character;
      visual.append(glyph);
      arrivalMs += 46;
    } else {
      visual.append(character);
    }
  }
  block.replaceChildren(accessibleText, visual);
  arrivalMs += 160;
}
const station = journey.querySelector('img');
const mist = journey.querySelector('#journey-cloud');
const petals = journey.querySelector('#sakura');
const vision = journey.querySelector('#journey-vision');
const cloud = new Image();
cloud.src = 'wallpaper-original/cloud10.png';
const ctx = mist.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const smooth = (a,b,x) => {
  const t = Math.min(1,Math.max(0,(x-a)/(b-a)));
  return t*t*(3-2*t);
};
let destination = 0;
let progress = 0, startTime = 0, startProgress = 0, frame = 0, petalModule, requestedPetals = false;
let pointerHeight = 0, cameraActive = false;
const wallpaper = document.querySelector('#wallpaper');
addEventListener('mousemove', event => {
  const source = wallpaper.contentWindow;
  if (Number.isFinite(source?._speedY)) pointerHeight = (event.clientY-source.windowHalfY)*source._speedY;
});
function paint(now) {
  frame = 0;
  const target = destination;
  if (target===2 && !station.src) station.src = 'assets/sakura-station/station.webp';
  const loaded = station.complete && station.naturalWidth;
  const goal = loaded ? target : Math.min(1.49,target);
  const distance = Math.max(0,now-startTime)/(reduced.matches?560:5700);
  progress = startProgress + Math.sign(goal-startProgress)*Math.min(Math.abs(goal-startProgress),distance);
  const dive = smooth(0,1,progress);
  window.cloudDive = dive;
  const p = Math.max(0,progress-1);
  const source = wallpaper.contentWindow;
  if (Number.isFinite(source?.mouseY)) {
    if (dive && !cameraActive) pointerHeight = source.mouseY;
    if (dive || cameraActive) source.mouseY = pointerHeight*(1-dive) + 72*dive;
    source.document.documentElement.style.setProperty("--cloud-finish",1-dive);
    cameraActive = dive>0;
  }
  const reveal = smooth(.46,.72,p);
  const glide = reduced.matches ? 1 : smooth(.48,1,p);
  station.style.transform = 'translateY('+((1-glide)*-4)+'%) scale('+(1.09+.07*glide)+')';
  station.style.filter = 'saturate(.82) contrast(.90) brightness(.95) blur('+((1-glide)*4)+'px)';
  station.style.opacity = reveal;
  document.documentElement.style.setProperty('--station-nav',smooth(.38,.83,p).toFixed(4));
  const amount = smooth(.01,.44,p)*(1-smooth(.52,.97,p));
  const width = innerWidth, height = innerHeight;
  if(mist.width!==Math.ceil(width*.65) || mist.height!==Math.ceil(height*.65)){
    mist.width=Math.ceil(width*.65);mist.height=Math.ceil(height*.65);
  }
  const w=mist.width,h=mist.height;
  ctx.clearRect(0,0,w,h);
  if(amount>0){
    // The opaque middle covers the set change in both scroll directions.
    const blush=smooth(.42,.82,p);
    ctx.fillStyle='rgb('+Math.round(223+15*blush)+','+Math.round(231-9*blush)+',237)';
    ctx.globalAlpha=amount;
    ctx.fillRect(0,0,w,h);
    if(cloud.complete && cloud.naturalWidth){
      ctx.globalAlpha=amount*.85;
      for(let i=0;i<8;i++){
        const size=Math.max(w*.71,h*.85)*(1+p*.65);
        const x=((i%4)*.42-.55)*w;
        const y=((i<4?1.12:1.7)-p*(reduced.matches?.25:1.8)+.13*Math.sin(i*4))*h;
        ctx.drawImage(cloud,x,y-size*.5,size,size);
      }
    }
    ctx.globalAlpha=1;
  }
  vision.style.opacity = reduced.matches ? 0 : .89*smooth(.10,.51,p)*(1-smooth(.57,.96,p));
  const show = !!reveal && !reduced.matches;
  petals.style.opacity = show ? .16*smooth(.72,.98,p) : 0;
  if (show && !requestedPetals){
    requestedPetals=true;
    import('../assets/sakura-station/petals.js').then(module=>{
      petalModule=module; schedule();
    }).catch(console.error);
  }
  petalModule?.showPetals(show);
  journey.dataset.stage = progress===0?'cruise':progress===1?'in-cloud':progress===2?'station':'travelling';
  if(goal!==progress) frame=requestAnimationFrame(paint);
}
function schedule(){
  if(!frame){frame=requestAnimationFrame(paint);}
}
function moveCamera(to) {
  if (destination === to) return;
  startTime=performance.now();
  startProgress=progress;
  destination = to;
  window.dispatchEvent(new CustomEvent('journey-destination', { detail: to }));
  schedule();
}
window.addEventListener('journey-direct-station', () => {
  ++journeyToken;
  ringBusy = false;
  ringTarget = null;
  gallery?.setActive(false);
  ringHost.style.pointerEvents = '';
  moveCamera(2);
  progress = startProgress = 2;
  if (frame) cancelAnimationFrame(frame);
  paint(performance.now());
});
window.addEventListener('journey-navigate', event => {
  const section = event.detail;
  const panel = section === 'space' || section === 'guestbook';
  const to = {home:0, album:1, about:2, music:0}[section];
  if (panel && !ringBusy && destination === progress) return;
  if (!panel && to === undefined) return;
  if (ringBusy && section !== 'music' && to === ringTarget) return;
  if (ringBusy || section === 'music' || panel) {
    ++journeyToken;
    ringBusy = false;
    ringTarget = null;
    gallery?.setActive(false);
    ringHost.style.pointerEvents = '';
    if (panel || section === 'music') {
      moveCamera(0);
      progress = startProgress = 0;
      schedule();
      return;
    }
    if (to !== 1) { moveCamera(to); return; }
  }
  goTo(to);
});
function travel(direction) {
  if (!ringBusy && progress === destination) goTo(Math.max(0, Math.min(2, destination + direction)));
}
window.addEventListener('wheel', event => {
  if (event.target.closest?.('.station-profile')) return;
  // Nested scrolling belongs to the pane, including its first and last lines.
  for (const node of event.composedPath()) {
    if (node === document.body) break;
    if (node instanceof HTMLElement && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) return;
  }
  if (event.target.closest?.('#daily-scene,#preview-settings[open],.nav-prototype-panel,.nav-prototype-links:has([aria-expanded=true])')) return;
  if (document.documentElement.classList.contains('music-room')) return;
  if (event.ctrlKey || Math.abs(event.deltaX)>Math.abs(event.deltaY) || !event.deltaY) return;
  event.preventDefault();
  travel(event.deltaY>0?1:-1);
}, {passive:false,capture:true});
let touchStart;
journey.addEventListener('touchstart', e=>{touchStart=e.touches[0].clientY;},{passive:true});
journey.addEventListener('touchend', e=>{
  const copy = e.target.closest?.(".station-about-copy");
  if (copy && copy.scrollHeight > copy.clientHeight) return;
  const distance=touchStart-e.changedTouches[0].clientY;
  if(Math.abs(distance)>30) travel(distance>0?1:-1);
},{passive:true});
journey.addEventListener('keydown', e=>{
  const copy = e.target.closest?.(".station-about-copy");
  if (copy && copy.scrollHeight > copy.clientHeight) return;
  if(['ArrowDown','End','PageDown','ArrowUp','Home','PageUp'].includes(e.key)){
    e.preventDefault(); travel(['ArrowDown','End','PageDown'].includes(e.key)?1:-1);
  }
});
station.addEventListener('load', () => {
  startTime = performance.now();
  startProgress = progress;
  schedule();
});
addEventListener('resize',schedule);
reduced.addEventListener('change',schedule);
schedule();

// Sample the same station crop and fog for MineRadio's RGB glass.
window.stationGlassFrame = context => {
  if (!progress) return;
  const w = innerWidth, h = innerHeight;
  if (+station.style.opacity && station.naturalWidth) {
    context.save();context.globalAlpha=Number(station.style.opacity);
    const rect=station.getBoundingClientRect();
    context.translate(rect.x,rect.y);context.scale(rect.width/w,rect.height/h);
    const scale = Math.max(w/station.naturalWidth,h/station.naturalHeight);
    const dw = station.naturalWidth*scale, dh = station.naturalHeight*scale;
    context.drawImage(station,(w-dw)*.65,(h-dh)*.5,dw,dh);
    context.restore();
  }
  context.drawImage(mist,0,0,w,h);
  if (+vision.style.opacity) {
    context.save();
    context.translate(w*.5,h*.51);
    context.scale(w*.71,h*.71);
    const shade=context.createRadialGradient(0,0,.05,0,0,1);
    shade.addColorStop(0,'transparent');shade.addColorStop(.66,'rgba(15,14,23,.72)');shade.addColorStop(1,'#100f17');
    context.globalAlpha=Number(vision.style.opacity);
    context.fillStyle=shade;context.fillRect(-1,-1,2,2);
    context.restore();
  }
};
const ringHost = document.createElement('section');
ringHost.className = 'cloud-ring';
ringHost.setAttribute('aria-label','云中相册');
ringHost.tabIndex = -1;
ringHost.hidden = true;
const ringClose = document.createElement('button');
ringClose.textContent = '关闭 ×';
ringClose.hidden = true;
ringHost.append(ringClose);
document.body.append(ringHost);
let ringModule, gallery, ringBusy = false, journeyToken = 0, ringTarget = null;
async function goTo(to) {
  if (ringBusy || (to === destination && (to !== 1 || !ringHost.hidden))) return;
  const entering = to === 1;
  const leaving = destination === 1 && gallery;
  if (!entering && !leaving) { moveCamera(to); return; }
  const token = ++journeyToken;
  ringTarget = to;
  ringBusy = true;
  if (entering) moveCamera(to);
  try {
    if (!ringModule) ringModule = import('./ring/bundle.js?v=album-alternate1').then(({default: Gallery}) => new Gallery(ringHost,ringClose));
    gallery = await ringModule;
    if(token !== journeyToken) return;
    if (entering) {
      await Promise.all(gallery.medias.map(media => media.imageReady));
      await new Promise(resolve => {
        function waitForScene() {
          if (token !== journeyToken || progress === 1) resolve();
          else requestAnimationFrame(waitForScene);
        }
        requestAnimationFrame(waitForScene);
      });
      if (!reduced.matches) await new Promise(resolve => setTimeout(resolve, 550));
    }
    if(token !== journeyToken) return;
    if (gallery.selected) {
      gallery.dismiss();
      await new Promise(resolve => setTimeout(resolve,700));
    }
    if(token !== journeyToken) return;
    const duration = reduced.matches ? 0 : (entering ? 6200 : 2300);
    const start = performance.now();
    gallery.arrival = entering ? 0 : 1;
    gallery.setActive(true);

    ringHost.style.pointerEvents = 'none';
    await new Promise(resolve => {
      function spin(now) {
        if(token !== journeyToken) { resolve(); return; }
        const t = duration ? Math.min(1,(now-start)/duration) : 1;
        const u = entering ? t : 1-t;
        gallery.arrival = entering ? smooth(0,1,t) : 1-(1-u)**3;

        if (t < 1) requestAnimationFrame(spin);
        else resolve();
      }
      requestAnimationFrame(spin);
    });
    if(token !== journeyToken) return;
    if (leaving) gallery.setActive(false);
    if (!reduced.matches) await new Promise(resolve => setTimeout(resolve,220));
  } catch (error) {
    console.error(error);
    ringModule = undefined;
  } finally {
    if (token === journeyToken) {
      ringHost.style.pointerEvents = '';
      if (!entering) moveCamera(to);
      ringTarget = null;
      ringBusy = false;
    }
  }
}
let ringTouch;
ringHost.addEventListener('touchstart', e => {ringTouch=e.touches[0];},{passive:true});
ringHost.addEventListener('touchend', e => {
  if (!ringTouch) return;
  const dx=e.changedTouches[0].clientX-ringTouch.clientX, dy=e.changedTouches[0].clientY-ringTouch.clientY;
  if (Math.abs(dy)>35 && Math.abs(dy)>Math.abs(dx)*1.4) travel(dy<0?1:-1);
  ringTouch=null;
},{passive:true});
