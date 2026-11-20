/* Keep the complete native RGB refraction chain. Limit its final displaced
 * pixels to the control surface; backdrop SourceAlpha can include pixels
 * outside the bar, so use its actual rounded box. Popovers are not clipped. */
function boundNativeControlGlassOutput(filterNode,surfaceNode,idPrefix){
 const filter=filterNode||document.getElementById('mineradio-control-glass-filter'),bar=surfaceNode||document.getElementById('bottom-bar');
 const prefix=idPrefix||'control-glass';
 if(!filter||!bar||filter.querySelector('#'+prefix+'-output-bounds'))return;
 // The native oversized filter region can expose displaced channel pixels
 // beyond the CSS backdrop surface during resize. Keep output in its box.
 for(const [name,value] of Object.entries({x:'0%',y:'0%',width:'100%',height:'100%'}))filter.setAttribute(name,value);
 const last=filter.lastElementChild;
 last.setAttribute('result','nativeGlassRefracted');
 const mask=document.createElementNS('http://www.w3.org/2000/svg','feImage');
 mask.id=prefix+'-output-mask';mask.setAttribute('result','controlGlassBoundsMask');
 mask.setAttribute('x','0');mask.setAttribute('y','0');mask.setAttribute('preserveAspectRatio','none');
 const clip=document.createElementNS('http://www.w3.org/2000/svg','feComposite');
 clip.id=prefix+'-output-bounds';clip.setAttribute('in','nativeGlassRefracted');
 clip.setAttribute('in2','controlGlassBoundsMask');clip.setAttribute('operator','in');
 filter.append(mask,clip);
 let key='';
 function sync(){
  const width=bar.offsetWidth,height=bar.offsetHeight,radius=parseFloat(getComputedStyle(bar).borderRadius)||0;
  const next=[width,height,radius].join(':');if(next===key||width<1||height<1)return;key=next;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><rect width="'+width+'" height="'+height+'" rx="'+radius+'" fill="white"/></svg>';
  mask.setAttribute('width',width);mask.setAttribute('height',height);mask.setAttribute('href','data:image/svg+xml,'+encodeURIComponent(svg));
 }
 sync();new ResizeObserver(sync).observe(bar);
}
boundNativeControlGlassOutput();
