/* Native Mineradio player is the owning document. Transport, progress drag,
 * volume, play order and auto-hide run unchanged from the upstream modules.
 * This file supplies local site data and the already approved cloud/lyric effects. */
(async function(){
const $=id=>document.getElementById(id),wf=$('wallpaper'),w=window;
const homeMusic=$('home-music');
let b,dango,initialized=false,previousZ=null,lastTrackTime=0,lastNativeMedia=null;
let maskRenderer,maskScene,maskCamera,maskTexture,lyricTarget,finalScene,finalCamera,finalMaterial;
const diagnostic={source:'native-mineradio-player',upstreamThree:'128',sentences:0,maskPass:false,errors:[]};
window.addEventListener('error',e=>{diagnostic.errors.push(e.message);$('status').textContent=e.message;if(e.error?.stack)console.error(e.error.stack);});
window.integrationDiagnostics=diagnostic;
function report(e){diagnostic.errors.push(e.message);$('status').textContent=e.message;}
$('fog-level').oninput=e=>$('fog').style.opacity=e.target.value;
$('tilt-x').oninput=e=>w.fx.lyricTiltX=Number(e.target.value);$('tilt-y').oninput=e=>w.fx.lyricTiltY=Number(e.target.value);
addEventListener('mousemove',e=>{if(!document.documentElement.matches('.music-view-locked,.room-cloud-flight') && b?.onDocumentMouseMove){b.onDocumentMouseMove(e);const dive=w.cloudDive||0;b.mouseY=b.mouseY*(1-dive)+72*dive;}});
b=await new Promise(resolve=>{const check=()=>{const x=wf.contentWindow;if(x?.renderer&&x?.camera)resolve(x);else setTimeout(check,100);};check();});
b.wallpaperPropertyListener.applyUserProperties({fixed:{value:false},fov:{value:17}});
const {painted,cloudFaces} = await window.cloudFieldReady;
const journeyElement=document.getElementById('station-journey');
const stationVisible=()=>journeyElement.dataset.stage==='station';
const drawWallpaper=b.renderer.render.bind(b.renderer);
b.renderer.render=function(...args){
 if(!stationVisible())return drawWallpaper(...args);
};
const cloudCeiling=b.geometry.vertices.reduce((highest,vertex)=>Math.max(highest,vertex.y),-Infinity)/100;
// Camera height and movement are entirely Wallpaper-owned. The aircraft has
// its own above-cloud altitude; the observer may still dive through the clouds.
diagnostic.cameraMotion={mode:'original-wallpaper',speedX:b._speedX,speedY:b._speedY,extraSmoothing:false,heightOffset:0};
w.dismissSplash({fastSkip:true});w.fx.lyricDisplayMode='single';w.fx.lyricTranslationMode='current';w.fx.lyricCameraLock=false;w.fx.particleLyrics=true;w.fx.lyricTiltX=Number($('tilt-x').value);w.fx.lyricTiltY=Number($('tilt-y').value);
w.createLyricsParticles();w.clearStageLyrics();
const T=w.THREE,lyricScene=new T.Scene();lyricScene.add(w.stageLyrics.group);
const airliner=new ShilokuAirlinerPass({cloudCeiling});
const skyStars=new ShilokuHighSkyStars(w.uniforms.uDotTex.value);
$('sky-stars').onchange=e=>skyStars.enabled=e.target.checked;
$('airliner-enabled').onchange=e=>{airliner.enabled=e.target.checked;if(airliner.enabled)airliner.replay();};
$('airliner-replay').onclick=()=>airliner.replay();
diagnostic.airliner={loaded:false,visible:false};
let aircraftRequested=false;
function loadAircraftAfterClouds(){
 if(aircraftRequested || !airliner.enabled || document.hidden || !diagnostic.maskPass || !b.material.uniforms.map.value.image?.naturalWidth)return;
 aircraftRequested=true;
airliner.load('assets/airliner/airbus-a320-v2-packed.glb').then(metadata=>{
 diagnostic.airlinerModel=metadata;
 $('airliner-status').textContent='A320 V2 · 云海上方，自动右→左';
 $('airliner-status').title='Dlourine · CC BY 4.0；保留完整模型，仅适配位置、朝向、比例与光照';
}).catch(e=>{$('airliner-status').textContent='客机加载失败：'+e.message;diagnostic.errors.push(e.message);console.error(e);});
}
const glyphRenderer=new DangoGlyphRenderer(w);
// Keep original sentence-internal motion. Dango controls sentence ownership
// and the 400 ms outgoing envelope, not a second custom text shader.
const originalUpdate=w.updateStageLyrics3D;
const originalRender=w.renderer.render.bind(w.renderer);
let frameCount=0,measureAt=performance.now();
function dispose(f){if(!f?.mesh)return;if(f.motion)w.gsap.killTweensOf(f.motion);if(w.stageLyrics.current===f.mesh)w.stageLyrics.current=null;w.stageLyrics.outgoing=w.stageLyrics.outgoing.filter(m=>m!==f.mesh);w.disposeLyricMesh(f.mesh);}
function spawn(index,resumed){
 const payload=w.buildStageLyricDisplayPayload(index,{lightweightTrack:true});if(!payload)return null;
 // Original showStageLine also consumes original prewarm caches and resets the
 // mesh/row state. Dango has already retired the old sentence independently.
 w.showStageLine(payload,false);const mesh=w.stageLyrics.current;if(!mesh)return null;w.stageLyrics.currentIdx=index;

 const angles=DangoLifecycle.spawnAngles(0,0,Math.min(20,b.camera.fov*b.camera.aspect*.35));
 const distance=10,yr=angles.yaw*Math.PI/180,pr=angles.pitch*Math.PI/180;
 const anchor=new T.Vector3(-Math.sin(yr)*Math.cos(pr),-Math.sin(pr),-Math.cos(yr)*Math.cos(pr)).applyQuaternion(w.camera.quaternion).multiplyScalar(distance).add(w.camera.position);
 if(resumed)mesh.userData.age=.3;
 // Optional NEW entry envelope, using upstream's bundled GSAP easing library.
 // This is not represented as an existing Mineradio lyric bounce feature.
 const motion={scale:.86,roll:(Math.random()-.5)*.12};w.gsap.to(motion,{scale:1,roll:0,duration:.95,ease:'elastic.out(1,0.55)'});
 // Dango spawn yaw/pitch projected into the browser viewport.
 const projected=anchor.clone().project(w.camera);
 const side=index%2===0?-1:1;
 const screenAnchor={
  x:side*(.28+.42*Math.min(1,Math.abs(projected.x))),
  y:side<0 ? .14+Math.random()*.24 : -.39+Math.random()*.17
 };
 const restingRoll=(Math.random()-.5)*.20;
 const sentence={mesh,index,anchor,screenAnchor,restingRoll,distance,resumed,motion,characterUnits:DangoCharacterMotion.units(w.lyricsLines[index].text)};
 glyphRenderer.attach(sentence);return sentence;
}
dango=new DangoLifecycle({spawn,dispose,holdPrevious:true,retire(f){
 if(w.stageLyrics.current===f.mesh)w.stageLyrics.current=null;
}});
function syncCamera(){
 const c=b.camera,position=new T.Vector3(c.position.x/100,c.position.y/100,c.position.z/100);
 diagnostic.cameraMotion.position={x:+c.position.x.toFixed(3),y:+c.position.y.toFixed(3),z:+c.position.z.toFixed(3)};
 if(previousZ!==null&&Math.abs(position.z-previousZ)>40){const delta=position.z-previousZ;for(const f of[dango.active,dango.fading])if(f)f.anchor.z+=delta;diagnostic.cameraWraps=(diagnostic.cameraWraps||0)+1;}
 previousZ=position.z;w.camera.position.copy(position);w.camera.quaternion.set(c.quaternion.x,c.quaternion.y,c.quaternion.z,c.quaternion.w);w.camera.fov=c.fov;w.camera.aspect=innerWidth/innerHeight;w.camera.near=.01;w.camera.far=100;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);
}
w.updateCamera=syncCamera;
w.tickLyricsParticles=function(){
 if(!w.audio){dango.update(-1,true);return;}
 if(lastNativeMedia!==w.audio){lastNativeMedia=w.audio;dango.clear();}
 const t=w.getAdjustedLyricPlaybackTime(w.stageLyricPlaybackSeconds());if(Math.abs(t-lastTrackTime)>1.5)dango.clear();lastTrackTime=t;
 const index=w.findStageLyricIndexAtTime(t);
 if(index>=0 && !dango.active && !w.audio.paused && w.lyricsLines.length>1){
   dango.update(index>0 ? index-1 : 1,false);
   if(dango.active)w.primeLyricMeshOpacity(dango.active.mesh,1);
 }
 dango.update(index,!w.stageLyricProgressPreviewActive()&&(w.audio.paused||w.audio.ended));
 if(dango.active){const i=dango.active.index,line=w.lyricsLines[i],end=w.lyricsLines[i+1]?.t||w.audio.duration||line.t+5;w.updateLyricMeshProgress(dango.active.mesh,Math.max(0,Math.min(1,(t-line.t)/Math.max(.4,end-line.t))));}
};
function constrain(f,dt){
 const mesh=f.mesh,upstreamRoll=f===dango.active?mesh.rotation.z:(f.upstreamRoll||0);f.upstreamRoll=upstreamRoll;const ndc=new T.Vector3(f.screenAnchor.x,f.screenAnchor.y,0);
 // Original glyph layout bounds; scale only to fit the viewport, with no
 // replacement font or hardcoded four-corner placement.
 const viewHeight=2*f.distance*Math.tan(w.camera.fov*Math.PI/360),viewWidth=viewHeight*w.camera.aspect;
 // Native wide-line masks can expand beyond the nominal 6.1-unit plane.
 // Fit their actual bounds, including translation, instead of assuming a
 // fixed width (which clips long lines after a new sentence or viewport swap).
 // Measure the text-bearing part of each original row. Transparent padding,
 // invisible glow planes and decorative particles must not shrink mobile text.
 const rows=(mesh.userData.lyric?.rowLayers||[]).filter(row=>row.mesh?.visible).sort((a,b)=>a.lineIndex-b.lineIndex||Number(a.isTranslation)-Number(b.isTranslation));
 const inkBounds=new T.Box3();mesh.updateWorldMatrix(true,true);
 for(const row of rows){
  if(!row.mesh||!row.lineMask)continue;const m=row.lineMask,e=m.entries?.[0]||{},width=row.lineWorldW*(m.activeTextWidth||m.textWidth)/m.width,height=row.lineWorldH*m.fontSize*(e.scale||1)/m.height*1.3;
  const y=w.lyricLineCenterWorldY(m,e,0,row.lineWorldH);
  for(const x of[-width/2,width/2])for(const yy of[y-height/2,y+height/2])inkBounds.expandByPoint(row.mesh.localToWorld(new T.Vector3(x,yy,0)));
 }
 if(inkBounds.isEmpty())inkBounds.setFromObject(mesh);
 const nativeSize=inkBounds.getSize(new T.Vector3());
 const scale=Math.min(.65,viewWidth*.82/Math.max(.001,nativeSize.x),viewHeight*.36/Math.max(.001,nativeSize.y));mesh.scale.multiplyScalar(scale);
 const size=nativeSize.multiplyScalar(scale);
 const mx=Math.min(.8,size.x/viewWidth+.06),my=Math.min(.8,size.y/viewHeight+.06);
 ndc.x=Math.max(-1+mx,Math.min(1-mx,ndc.x));ndc.y=Math.max(-1+my,Math.min(1-my,ndc.y));
 const screenRect=()=>({left:(ndc.x+1)*innerWidth/2-size.x/viewWidth*innerWidth/2,right:(ndc.x+1)*innerWidth/2+size.x/viewWidth*innerWidth/2,top:(1-ndc.y)*innerHeight/2-size.y/viewHeight*innerHeight/2,bottom:(1-ndc.y)*innerHeight/2+size.y/viewHeight*innerHeight/2});
 for(const el of document.querySelectorAll('[data-lyric-avoid]')){const r=el.getBoundingClientRect(),q=screenRect();if(r.width&&r.height&&q.right>r.left&&q.left<r.right&&q.bottom>r.top&&q.top<r.bottom){const above=1-2*(r.top-16-size.y/viewHeight*innerHeight/2)/innerHeight,below=1-2*(r.bottom+16+size.y/viewHeight*innerHeight/2)/innerHeight;const choices=[above,below].filter(v=>v>=-1+my&&v<=1-my);if(choices.length)ndc.y=choices.sort((a,b)=>Math.abs(a-ndc.y)-Math.abs(b-ndc.y))[0];}}
 // Convert the browser's usable rectangle into angular limits, then use the
 // original Dango keepOnScreen spring rather than snapping to a fixed anchor.
 // Reproject the entry anchor with the camera so forward cloud travel cannot carry text past the viewer.
 const ray=ndc.unproject(w.camera).sub(w.camera.position).normalize();
 f.anchor.copy(w.camera.position).addScaledVector(ray,f.distance);
 mesh.position.copy(f.anchor);
 // Dango facePlayer: orient each sentence toward the eye from its own
 // position. This gives each entry its own perspective, not a shared tilt.
 mesh.up.set(0,1,0).applyQuaternion(w.camera.quaternion);
 mesh.lookAt(w.camera.position);
 const bounce=Number($('bounce').value);mesh.rotateZ(f.restingRoll+upstreamRoll+(f.motion?.roll||0)*bounce);mesh.scale.multiplyScalar(1+((f.motion?.scale||1)-1)*bounce);
 // Final screen-space guard uses real raster alpha bounds and the final tilted
 // transforms. Native mask metrics alone can differ after quality promotion.
 function projectInk(){
  mesh.updateWorldMatrix(true,true);const box=new T.Box2();
  for(const row of rows){const ink=row.mesh&&glyphRenderer.inkBounds(row.mesh);if(!ink)continue;for(const x of[ink.x0,ink.x1])for(const y of[ink.y0,ink.y1]){const p=row.mesh.localToWorld(new T.Vector3(x,y,0)).project(w.camera);box.expandByPoint(new T.Vector2(p.x,p.y));}}
  return box;
 }
 // Measure the painted letters in sentence coordinates: the native context
 // row and the lead row can have different parents and padded textures.

 function inkEdges(row){
  const ink=row?.mesh&&glyphRenderer.inkBounds(row.mesh);if(!ink)return null;
  const x=(ink.x0+ink.x1)/2;
  const edge=y=>mesh.worldToLocal(row.mesh.localToWorld(new T.Vector3(x,y,0)));
  return {top:edge(ink.y1),bottom:edge(ink.y0)};
 }
 mesh.updateWorldMatrix(true,true);
 const lead=inkEdges(rows.find(row=>row.isActive));
 if(lead){
  const height=lead.top.y-lead.bottom.y;
  const projectY=p=>mesh.localToWorld(p.clone()).project(w.camera).y*innerHeight/2;
  const pixels=projectY(lead.top)-projectY(lead.bottom);
  if(height>0&&pixels>0){
   // Keep the same angular placement and depth, but bound reading size.
   const target=Math.max(22,Math.min(36,innerWidth*.039));
   const bounceScale=1+((f.motion?.scale||1)-1)*bounce;
   mesh.scale.multiplyScalar(target*bounceScale/pixels);
   mesh.updateWorldMatrix(true,true);
   let bottom=inkEdges(rows[0])?.bottom || lead.bottom;
   f.rowOffsets=[];
   for(const row of rows.slice(1)){
    const line=inkEdges(row);if(!line)continue;
    const targetTop=bottom.clone();targetTop.y-=height*(row.isTranslation ? .23 : .65);
    const offset=mesh.localToWorld(targetTop).sub(mesh.localToWorld(line.top.clone()));
    for(const part of [row.mesh,row.readability,row.glow]){
     if(!part?.parent)continue;
     const original=part.position.clone();
     part.position.copy(part.parent.worldToLocal(part.getWorldPosition(new T.Vector3()).add(offset)));
     part.updateWorldMatrix(false,false);
     f.rowOffsets.push([part,original]);
    }
    bottom=inkEdges(row).bottom;
   }
  }
 }
 let screen=projectInk();
 if(!screen.isEmpty()){
  // Browser adaptation for two continuously visible sentences. Each whole
  // bilingual group keeps its side for its lifetime, including retirement.
  
  const narrow=innerWidth<780;
  const maxWidth=narrow?1.45:.88;
  const span=screen.getSize(new T.Vector2());
  const fit=Math.min(1,maxWidth/Math.max(.001,span.x),.25/Math.max(.001,span.y));
  if(fit<1){mesh.scale.multiplyScalar(fit);screen=projectInk();}
  const center=screen.getCenter(new T.Vector2());
  const halfWidth=(screen.max.x-screen.min.x)/2;
  const targetX=Math.max(-.92+halfWidth,Math.min(.92-halfWidth,f.screenAnchor.x));
  const dx=targetX-center.x;
  const dy=f.screenAnchor.y-center.y;
  const point=mesh.position.clone().project(w.camera);point.x+=dx;point.y+=dy;
  mesh.position.copy(point.unproject(w.camera));
  screen=projectInk();
 }
 f.screenBounds=screen.clone();
 const endTime=w.lyricsLines[dango.index+1]?.t ?? w.audio?.duration;
 const remaining=endTime-w.getAdjustedLyricPlaybackTime(w.stageLyricPlaybackSeconds());
 const factor=f===dango.fading&&!dango.paused ? Math.min(1,Math.max(0,remaining/.4)) : dango.fade(f);mesh.position.y+=(1-factor)*.16;
 if(f===dango.fading)mesh.traverse(o=>{if(!o.material)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m.uniforms?.uOpacity)m.uniforms.uOpacity.value=m.uniforms.uOpacity.value*factor;else if(m.transparent)m.opacity=m.opacity*factor;}});
}
w.updateStageLyrics3D=function(dt){
 for(const f of [dango.active,dango.fading])if(f?.rowOffsets){
  for(const [part,position] of f.rowOffsets)part.position.copy(position);
  f.rowOffsets=null;
 }
 // Restore the original renderer's local transform before its next animation
 // step. Otherwise the host's viewport scale/tilt would feed back into native
 // easing on every frame and progressively shrink or rotate the sentence.
 for(const f of[dango.active,dango.fading])if(f?.nativeTransform){const n=f.nativeTransform;f.mesh.position.copy(n.position);f.mesh.quaternion.copy(n.quaternion);f.mesh.scale.copy(n.scale);}
 syncCamera();
 // MineRadio animates only stageLyrics.current. Tick each independent Dango
 // sentence through that same native path, including a held line after seeking.
 if(dango.fading){
  const active=w.stageLyrics.current;
  w.stageLyrics.current=dango.fading.mesh;
  try { originalUpdate(dt); } finally { w.stageLyrics.current=active; }
 }
 originalUpdate(dt);
 w.stageLyrics.group.position.set(0,0,0);w.stageLyrics.group.quaternion.identity();w.stageLyrics.group.scale.setScalar(1);if(w.stageLyrics.starRiver)w.stageLyrics.starRiver.visible=false;
 for(const f of[dango.active,dango.fading])if(f&&f.mesh.parent){
  f.nativeTransform={position:f.mesh.position.clone(),quaternion:f.mesh.quaternion.clone(),scale:f.mesh.scale.clone()};
  const line=w.lyricsLines[f.index],end=w.lyricsLines[f.index+1]?.t||w.audio.duration||line.t+5;
  const lyricSeconds=w.getAdjustedLyricPlaybackTime(w.stageLyricPlaybackSeconds());
  // Start the entry envelope on the first rendered frame, including after a seek.
  f.firstDrawSeconds ??= lyricSeconds;
  const elapsedMs=Math.max(0,(lyricSeconds-f.firstDrawSeconds)*1000);
  const glyphState=glyphRenderer.update(f,elapsedMs,(end-line.t)*1000,$('character-pop').checked,Number($('character-strength').value));
  if(f===dango.active)diagnostic.glyphs=glyphState;
  constrain(f,dt);
 }
 diagnostic.lyricBounds=[dango.active,dango.fading].filter(f=>f?.screenBounds).map(f=>({index:f.index,min:f.screenBounds.min.toArray(),max:f.screenBounds.max.toArray()}));
 diagnostic.sentences=Number(!!dango.active)+Number(!!dango.fading);diagnostic.maxSentences=Math.max(diagnostic.maxSentences||0,diagnostic.sentences);
 diagnostic.currentIndex=dango.index;diagnostic.paused=!w.audio||w.audio.paused;diagnostic.time=w.audio?.currentTime||0;
 $('line').textContent=dango.active?w.lyricsLines[dango.active.index]?.text||'':'';
};
// Foreground mask uses original r55 geometry, original texture and shader.
// Extra depth cutoff belongs to this NEW pass; original scene is read-only.
const B=b.THREE;maskRenderer=new B.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});maskRenderer.setClearColor(0,0);maskScene=new B.Scene();maskCamera=new B.PerspectiveCamera(17,innerWidth/innerHeight,1,3000);
const mat=b.material.clone();const cloudTexture=b.material.uniforms.map.value.clone();cloudTexture.needsUpdate=true;mat.uniforms.map.value=cloudTexture;mat.uniforms.cloudCutoff={type:'f',value:1000};
mat.vertexShader=mat.vertexShader.replace('void main()', 'varying float cloudDistance; void main()').replace('gl_Position =', 'cloudDistance=-(modelViewMatrix*vec4(position,1.0)).z; gl_Position =');
mat.fragmentShader='varying float cloudDistance; uniform float cloudCutoff;\n'+mat.fragmentShader.replace('void main() {','void main() { if(cloudDistance<=0.0 || cloudDistance>=cloudCutoff) discard;');
// r55 stores GPU buffers on Geometry/Texture themselves: make faithful CPU
// copies so the added context never reuses or overwrites original GPU state.
const cloudGeometry=b.geometry.clone();
b.scene.children.forEach(obj=>{if(obj.geometry){const copy=new B.Mesh(cloudGeometry,mat);copy.position.copy(obj.position);copy.rotation.copy(obj.rotation);copy.scale.copy(obj.scale);maskScene.add(copy);}});
maskTexture=new T.CanvasTexture(maskRenderer.domElement);maskTexture.minFilter=T.LinearFilter;maskTexture.magFilter=T.LinearFilter;maskTexture.generateMipmaps=false;
const cloudHeightSamples=b.geometry.vertices.map(vertex=>vertex.y).sort((a,b)=>a-b);
const atmosphere=new ShilokuDistantAtmosphere(maskTexture,cloudHeightSamples[Math.floor(cloudHeightSamples.length*.75)]/100);
const sunlight=atmosphere.sky.material.uniforms.sunPosition.value.clone().normalize();
const mainLight=lightCloudMaterial(b.material,sunlight,cloudFaces),sampleLight=lightCloudMaterial(mat,sunlight,cloudFaces);
const lightControl=$('cloud-light');
lightControl.oninput=()=>{mainLight.value=Number(lightControl.value);};
lightControl.oninput();
const keyLight=airliner.scene.children.find(child=>child.isDirectionalLight);
if(keyLight)keyLight.position.copy(sunlight);
if (!painted) paintDaySky(b,false);
if (painted) $('film-grade').value=.14;
const finish=createSceneFinish(b);
atmosphere.enabled=$('distant-atmosphere').checked;
$('distant-atmosphere').onchange=e=>atmosphere.enabled=e.target.checked;
lyricTarget=new T.WebGLRenderTarget(innerWidth,innerHeight,{depthBuffer:true});finalScene=new T.Scene();finalCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
finalMaterial=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{lyrics:{value:lyricTarget.texture},mask:{value:maskTexture},enabled:{value:1},cloudPower:{value:1.45}},vertexShader:'varying vec2 uvPass;void main(){uvPass=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 uvPass;uniform sampler2D lyrics,mask;uniform float enabled,cloudPower;void main(){vec4 c=texture2D(lyrics,uvPass);float cover=pow(clamp(texture2D(mask,uvPass).a,0.,1.),cloudPower);gl_FragColor=vec4(c.rgb,c.a*(1.-cover*enabled));}'});
// Readability uses upstream's existing text-shaped shadow/outline. Only this
// external cloud composite changes: partial cover softens slightly, while
// cover=1 still transmits zero, including every shadow/glow/translation layer.
const visibilityBaseline={adapt:w.fx.lyricBackgroundAdapt,backdrop:w.fx.lyricBackdropAdapt};
function applyLyricVisibility(){
 const enhanced=$('lyric-visibility').checked;
 finalMaterial.uniforms.cloudPower.value=enhanced?1.45:1;
 w.fx.lyricBackgroundAdapt=enhanced?Math.max(Number(visibilityBaseline.adapt)||0,.86):visibilityBaseline.adapt;
 w.fx.lyricBackdropAdapt=enhanced?true:visibilityBaseline.backdrop;
 diagnostic.visibility={enhanced,cloudPower:finalMaterial.uniforms.cloudPower.value,backgroundAdapt:w.fx.lyricBackgroundAdapt,opaqueCloudTransmission:0};
 $('status').dataset.lyricVisibility=JSON.stringify(diagnostic.visibility);
}
$('lyric-visibility').onchange=applyLyricVisibility;applyLyricVisibility();
finalScene.add(new T.Mesh(new T.PlaneGeometry(2,2),finalMaterial));
// The existing foreground cloud pass also masks the aircraft. Its cloud
// opacity stays physical/linear, separate from the lyric readability curve.
const airlinerComposite=finalMaterial.clone();airlinerComposite.uniforms.cloudPower.value=1;
airlinerComposite.uniforms.lyrics.value=lyricTarget.texture;airlinerComposite.uniforms.mask.value=maskTexture;
const starComposite=airlinerComposite.clone();starComposite.uniforms.lyrics.value=lyricTarget.texture;starComposite.uniforms.mask.value=maskTexture;
const aircraftDetail=new ShilokuAirlinerDetail();
airlinerComposite.uniforms.lyrics.value=aircraftDetail.target.texture;
airlinerComposite.uniforms.rect={value:aircraftDetail.rect};
airlinerComposite.vertexShader='varying vec2 vLocal,vScreen; uniform vec4 rect; void main(){vLocal=uv;vScreen=rect.xy+uv*rect.zw;gl_Position=vec4(vScreen*2.-1.,0.,1.);}';
airlinerComposite.fragmentShader='varying vec2 vLocal,vScreen; uniform sampler2D lyrics,mask; void main(){vec4 plane=texture2D(lyrics,vLocal,-0.45);float cover=texture2D(mask,vScreen).a;gl_FragColor=vec4(plane.rgb/max(plane.a,.00001),plane.a*(1.-cover));}';
// The point pass stores premultiplied RGB. Unpremultiply only this new star
// layer before the standard final blend so tiny points are not attenuated twice.
starComposite.fragmentShader='varying vec2 uvPass;uniform sampler2D lyrics,mask;void main(){vec4 c=texture2D(lyrics,uvPass);float cover=texture2D(mask,uvPass).a;gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a*(1.-cover));}';
const compositeQuad=finalScene.children[0];
// Verification recorder reuses this read-only clone pass for the complete
// cloud frame. It never replaces Wallpaper's renderer or changes its buffers.
window.previewBackgroundFrame=()=>{
 const cutoff=mat.uniforms.cloudCutoff.value;mat.uniforms.cloudCutoff.value=b.camera.far;
 sampleLight.value=mainLight.value;
 maskRenderer.render(maskScene,maskCamera);sampleLight.value=0;mat.uniforms.cloudCutoff.value=cutoff;return maskRenderer.domElement;
};
const drawGlass = createSceneGlass(b, w.renderer.domElement, window.previewBackgroundFrame,finish);
function resize(){maskRenderer.setSize(innerWidth,innerHeight);lyricTarget.setSize(w.renderer.domElement.width,w.renderer.domElement.height);}
resize();addEventListener('resize',resize);
w.renderer.render=function(scene,camera){
 if(scene!==w.scene)return originalRender(scene,camera);
 if(stationVisible()){drawGlass(performance.now());return;}
 loadAircraftAfterClouds();
 frameCount++;
 mainLight.value=Number(lightControl.value)*(1-(w.cloudDive||0));
 $('fog').style.visibility=w.cloudDive===1?'hidden':'';
 maskCamera.position.copy(b.camera.position);maskCamera.quaternion.copy(b.camera.quaternion);maskCamera.projectionMatrix.copy(b.camera.projectionMatrix);
 const old=w.renderer.getRenderTarget(),auto=w.renderer.autoClear;w.renderer.autoClear=false;w.renderer.setRenderTarget(old);w.renderer.clear();
 diagnostic.skyStars=skyStars.update(w.camera,innerWidth,innerHeight,{sunElevationDegrees:atmosphere.sunElevationDegrees()});
 const atmosphereState=atmosphere.update(b.camera,w.camera,innerHeight);diagnostic.atmosphere=atmosphereState;
 if(diagnostic.skyStars.visible||atmosphereState.visible){
  mat.uniforms.cloudCutoff.value=b.camera.far;maskRenderer.render(maskScene,maskCamera);maskTexture.needsUpdate=true;
  if(atmosphereState.visible){atmosphere.prepare(w.renderer,originalRender);originalRender(atmosphere.scene,finalCamera);}
 }
 if(diagnostic.skyStars.visible){
  w.renderer.setRenderTarget(lyricTarget);w.renderer.clear();originalRender(skyStars.scene,w.camera);w.renderer.setRenderTarget(old);
  compositeQuad.material=starComposite;originalRender(finalScene,finalCamera);compositeQuad.material=finalMaterial;
 }
 const aircraftState=airliner.update(w.camera,innerWidth,innerHeight);diagnostic.airliner=aircraftState;
 if(airliner.trails.mesh.visible){
  mat.uniforms.cloudCutoff.value=airliner.distance*100;
  maskRenderer.render(maskScene,maskCamera);maskTexture.needsUpdate=true;
  w.renderer.setRenderTarget(lyricTarget);w.renderer.clear();originalRender(airliner.trails.scene,w.camera);
  w.renderer.setRenderTarget(old);compositeQuad.material=starComposite;originalRender(finalScene,finalCamera);compositeQuad.material=finalMaterial;
 }
 if(aircraftState.visible&&aircraftDetail.frame(airliner,w.camera,w.renderer.domElement.width,w.renderer.domElement.height)){
  mat.uniforms.cloudCutoff.value=airliner.distance*100;
  maskRenderer.render(maskScene,maskCamera);maskTexture.needsUpdate=true;
  w.renderer.setRenderTarget(aircraftDetail.target);w.renderer.clear();originalRender(airliner.scene,aircraftDetail.camera);w.renderer.setRenderTarget(old);
  airlinerComposite.uniforms.enabled.value=1;compositeQuad.material=airlinerComposite;originalRender(finalScene,finalCamera);compositeQuad.material=finalMaterial;
 }
 const items=[dango.active,dango.fading].filter(f=>f&&f.mesh.parent);
 for(const f of items){
  for(const item of items)item.mesh.visible=item===f;
  const direction=new T.Vector3();w.camera.getWorldDirection(direction);
  mat.uniforms.cloudCutoff.value=Math.max(1,f.mesh.position.clone().sub(w.camera.position).dot(direction)*100);
  maskRenderer.render(maskScene,maskCamera);maskTexture.needsUpdate=true;
  w.renderer.setRenderTarget(lyricTarget);w.renderer.clear();originalRender(lyricScene,w.camera);w.renderer.setRenderTarget(old);finalMaterial.uniforms.enabled.value=$('occlusion').checked?1:0;originalRender(finalScene,finalCamera);
 }
 for(const item of items)item.mesh.visible=true;
 w.renderer.autoClear=auto;diagnostic.maskPass=true;drawGlass(performance.now());if(window.previewCaptureFrame)window.previewCaptureFrame();
};
initialized=true;

setInterval(()=>{
 for(const el of document.querySelectorAll('.volume-popover,#mini-queue-popover')){const style=getComputedStyle(el);if(style.visibility!=='hidden'&&Number(style.opacity)>.1)el.dataset.lyricAvoid='';else delete el.dataset.lyricAvoid;}
},300);
})().catch(e=>{document.getElementById('status').textContent=e.stack;console.error(e);});
