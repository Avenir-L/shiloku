/* Port of DangoMusic LyricsModule: render index transition, startFade,
 * spawn yaw/pitch, drawFading 0.4s. Browser-only: one fading item cap,
 * injected clock/random and viewport constraint. Not a replacement renderer.
 */
class DangoLifecycle {
 constructor({spawn,retire,dispose,holdPrevious=false,now=()=>performance.now()}){Object.assign(this,{spawn,retire,dispose,holdPrevious,now});this.active=null;this.fading=null;this.index=-1;this.paused=true;}
 clear(){for(const f of [this.active,this.fading])if(f)this.dispose(f);this.active=this.fading=null;this.index=-1;}
 startFade(){if(!this.active)return;if(this.fading)this.dispose(this.fading);this.fading=this.active;this.fading.fadeStart=this.now();this.retire(this.fading);this.active=null;}
 update(index,paused){
  if(paused){this.startFade();this.index=index;this.paused=true;}
  else if(index!==this.index||this.paused){const resumed=this.paused&&index===this.index;this.paused=false;this.index=index;this.startFade();if(index>=0)this.active=this.spawn(index,resumed);}
  if(this.fading&&(!this.holdPrevious||paused)&&(this.now()-this.fading.fadeStart)>=400){this.dispose(this.fading);this.fading=null;}
 }
 fade(f){return this.holdPrevious&&!this.paused?1:f===this.fading?Math.max(0,1-(this.now()-f.fadeStart)/400):1;}
 static spawnAngles(yaw,pitch,spread,random=Math.random){return{yaw:yaw+(random()*2-1)*spread,pitch:Math.max(-60,Math.min(30,pitch-3-random()*10))};}
 // keepOnScreen's critically damped angular spring, SPRING=12, substeps 1/240.
 static spring(f,errorYaw,errorPitch,dt){
  f.vYaw=f.vYaw||0;f.vPitch=f.vPitch||0;let yaw=0,pitch=0,left=Math.min(.1,Math.max(0,dt));
  while(left>1e-6){const h=Math.min(left,1/240);left-=h;f.vYaw+=(-144*(errorYaw-yaw)-24*f.vYaw)*h;f.vPitch+=(-144*(errorPitch-pitch)-24*f.vPitch)*h;yaw+=f.vYaw*h;pitch+=f.vPitch*h;}
  return{yaw,pitch};
 }
}
