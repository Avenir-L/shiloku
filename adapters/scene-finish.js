// One cached wash and a small repeating noise tile serve the wallpaper and glass.
function createSceneFinish(wallpaper) {
  const doc=wallpaper.document, wash=doc.createElement('canvas'), grain=doc.createElement('div');
  for(const element of [wash,grain]){
    Object.assign(element.style,{position:'fixed',inset:'0',pointerEvents:'none'});
    doc.body.appendChild(element);
  }
  const tile=doc.createElement('canvas');
  tile.width=tile.height=96;
  const noise=tile.getContext('2d'), pixels=noise.createImageData(96,96);
  let seed=7265;
  for(let i=0;i<pixels.data.length;i+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=seed>>>24;
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
    pixels.data[i+3]=255;
  }
  noise.putImageData(pixels,0,0);
  grain.style.backgroundImage='url('+tile.toDataURL()+')';
  const control=id=>document.getElementById(id);
  let opacity=0,shift=0;
  function paint(){
    const width=wash.width=wallpaper.innerWidth,height=wash.height=wallpaper.innerHeight;
    if(!width||!height)return;
    const ctx=wash.getContext('2d');
    ctx.globalAlpha=Number(control('film-grade').value);
    const grade=ctx.createLinearGradient(width,0,0,height);
    grade.addColorStop(0,'rgba(253,239,210,.23)');
    grade.addColorStop(.5,'rgba(172,218,248,.21)');
    grade.addColorStop(1,'rgba(184,222,246,.22)');
    ctx.fillStyle=grade;ctx.fillRect(0,0,width,height);
    ctx.save();ctx.scale(width,height);
    const vignette=ctx.createRadialGradient(.5,.48,.27,.5,.48,.73);
    vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'rgba(13,32,59,.38)');
    ctx.globalAlpha=Number(control('film-vignette').value);
    ctx.fillStyle=vignette;ctx.fillRect(0,0,1,1);ctx.restore();
    opacity=.065*Number(control('film-grain').value);
    wash.style.opacity="var(--cloud-finish,1)";
    grain.style.opacity="calc("+opacity+" * var(--cloud-finish,1))";
  }
  for(const id of ['film-grade','film-vignette','film-grain'])control(id).addEventListener('input',paint);
  wallpaper.addEventListener('resize',paint);paint();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const timer=setInterval(()=>{
    if(!opacity||document.hidden||reduced.matches)return;
    shift=(shift+17)%96;grain.style.backgroundPosition=shift+'px '+(-shift)+'px';
  },150);
  window.addEventListener('pagehide',e=>{if(!e.persisted)clearInterval(timer);});
  const patterns=new WeakMap();
  return function draw(ctx){
    if(window.cloudDive===1)return;
    ctx.drawImage(wash,0,0);
    if(!opacity)return;
    if(!patterns.has(ctx))patterns.set(ctx,ctx.createPattern(tile,'repeat'));
    ctx.save();ctx.translate(shift,-shift);ctx.globalAlpha=opacity;
    ctx.fillStyle=patterns.get(ctx);ctx.fillRect(-shift,shift,wash.width,wash.height);ctx.restore();
  };
}
