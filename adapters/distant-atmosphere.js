/* Official THREE.Sky r128 supplies all scattering colors, unchanged.
 * This adapter places its light around a restrained spherical cloud horizon
 * and blends with the original Wallpaper alpha. No cloud/camera rewrite. */
class ShilokuDistantAtmosphere {
 static profile({nativeY,cloudY,fov,aspect,height}){
  const t=Math.max(0,Math.min(1,(nativeY-8)/32)),activation=t*t*(3-2*t);
  const tanHalf=Math.tan(fov*Math.PI/360),dipTan=Math.sqrt((6381/6379)**2-1);
  const centerUv=.5+(cloudY-nativeY/100)/30/tanHalf*.5;
  const p={activation,tanHalf,dipTan,aspect,centerUv,height};
  p.edgeDropPixels=(ShilokuDistantAtmosphere.horizonUv(p,0)-ShilokuDistantAtmosphere.horizonUv(p,1))*height;
  return p;
 }
 static horizonUv(p,ndcX){
  const rayX=ndcX*p.tanHalf*p.aspect;
  return p.centerUv-.5*p.dipTan*(Math.sqrt(1+rayX*rayX)-1)/p.tanHalf;
 }
 constructor(cloudTexture,cloudY){
  this.enabled=true;this.cloudY=cloudY;this.scene=new THREE.Scene();
  this.sky=new THREE.Sky();this.sky.scale.setScalar(450000);
  this.sky.material.uniforms.sunPosition.value.set(.8,.6,.2).multiplyScalar(450000);
  this.skyScene=new THREE.Scene();this.skyScene.add(this.sky);
  this.skyCamera=new THREE.PerspectiveCamera(32,4,.1,10000000);
  this.skyTarget=new THREE.WebGLRenderTarget(512,128,{depthBuffer:false});
  this.bakeCount=0;
  this.material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
   uniforms:{clouds:{value:cloudTexture},skyColors:{value:this.skyTarget.texture},activation:{value:0},centerUv:{value:.5},tanHalf:{value:.15},aspect:{value:1},dipTan:{value:0},height:{value:800},captureTan:{value:Math.tan(16*Math.PI/180)}},
   vertexShader:'varying vec2 uvPass;void main(){uvPass=uv;gl_Position=vec4(position.xy,0.,1.);}',
   fragmentShader:`
    varying vec2 uvPass;
    uniform sampler2D clouds,skyColors;
    uniform float activation,centerUv,tanHalf,aspect,dipTan,height,captureTan;
    void main(){
     float rayX=(uvPass.x*2.-1.)*tanHalf*aspect;
     float horizon=centerUv-.5*dipTan*(sqrt(1.+rayX*rayX)-1.)/tanHalf;
     float sigma=max(12.,height*.04);
     float d=(uvPass.y-horizon)*height/sigma;
     float band=exp(-.5*d*d);
     float cloudAlpha=clamp(texture2D(clouds,uvPass).a,0.,1.);
     // Dense nearby cloud lobes retain their source appearance. This is not
     // another cloud mask for lyrics or an opacity floor on any text layer.
     float protect=smoothstep(.62,.98,cloudAlpha);
     float horizonAlpha=activation*band*(.24+.28*cloudAlpha)*(1.-.96*protect);
     // The same native scattering color gently shapes the clear high sky.
     // Keep the established blue palette and protect dense foreground clouds.
     float clearSky=pow(1.-cloudAlpha,2.)*smoothstep(horizon-.04,horizon+.10,uvPass.y);
     float skyAlpha=activation*.12*clearSky;
     float alpha=1.-(1.-horizonAlpha)*(1.-skyAlpha);
     // Sample the actual official Sky render. Only its projection and blend
     // are adapted; Rayleigh/Mie scattering is not reimplemented here.
     vec2 skyUv=vec2(.5+rayX/(captureTan*4.)*.5,.5+(uvPass.y-horizon)*tanHalf/captureTan);
     vec3 color=texture2D(skyColors,clamp(skyUv,vec2(.001),vec2(.999))).rgb;
     gl_FragColor=vec4(color,alpha);
    }`
  });
  this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));
 }
 prepare(renderer,render){
  if(this.bakeCount)return;
  const target=renderer.getRenderTarget();
  renderer.setRenderTarget(this.skyTarget);renderer.clear();render(this.skyScene,this.skyCamera);
  renderer.setRenderTarget(target);this.bakeCount++;
 }
 sunElevationDegrees(){
  const sun=this.sky.material.uniforms.sunPosition.value;
  return Math.asin(Math.max(-1,Math.min(1,sun.y/sun.length())))*180/Math.PI;
 }
 update(nativeCamera,camera,height){
  const p=ShilokuDistantAtmosphere.profile({nativeY:nativeCamera.position.y,cloudY:this.cloudY,fov:camera.fov,aspect:camera.aspect,height});
  for(const key of['activation','centerUv','tanHalf','aspect','dipTan','height'])this.material.uniforms[key].value=p[key];
  const visible=this.enabled&&p.activation>.001&&p.centerUv>-.15&&p.centerUv<1.15;
  this.scene.visible=visible;
  return {enabled:this.enabled,visible,activation:+p.activation.toFixed(4),centerUv:+p.centerUv.toFixed(4),edgeDropPixels:+p.edgeDropPixels.toFixed(3),nativeY:+nativeCamera.position.y.toFixed(3),referenceCloudRadiusKm:6379,referenceHeightAboveCloudsKm:2,geometryWarped:false,scatteringSource:'THREE.Sky r128',skyBakeCount:this.bakeCount,skyTextureSize:[512,128]};
 }
}
