/* Meshopt-packed Dlourine A320 V2 GLB + official Three.js r128 GLTFLoader.
 * Only centre/scale the container; no replacement geometry/materials or LOD. */
class ShilokuAirlinerModel {
 static async load(url,onProgress){
  const {MeshoptDecoder}=await import('../vendor/airliner/meshopt_decoder_reference.js');
  return new Promise((resolve,reject)=>{
   new THREE.GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url,gltf=>{
    const original=gltf.scene;original.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(original),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(!Number.isFinite(size.z)||size.z<=0){reject(new Error('客机模型包围盒无效'));return;}
    const model=new THREE.Group();model.name='A320V2-normalized-container';
    original.position.sub(center);model.add(original);model.scale.setScalar(1/size.z);
    let meshes=0,triangles=0;const geometries=new Set(),materials=new Set();
    original.traverse(object=>{if(!object.isMesh)return;meshes++;geometries.add(object.geometry);triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;for(const mat of(Array.isArray(object.material)?object.material:[object.material]))materials.add(mat);});
    resolve({model,original,metadata:{name:'Airbus A320-200 V2',author:'Dlourine',meshes,triangles,geometries:geometries.size,materials:materials.size,sourceSize:size.toArray(),sourceCenter:center.toArray(),normalizedSize:size.clone().divideScalar(size.z).toArray(),source:'https://sketchfab.com/3d-models/airbus-a320-200-v2-c078f9af15884a6b820c7e778831b110',license:'CC BY 4.0',noseAxis:'+Z',upAxis:'+Y'}});
   },onProgress,reject);
  });
 }
 static lights(scene){
  // Scene lighting only. Original PBR materials and all mesh detail remain.
  scene.add(new THREE.HemisphereLight(0xeaf5ff,0x636e84,.78));
  const sun=new THREE.DirectionalLight(0xfff4df,1.25);sun.position.set(-4,7,5);scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc2d9ee,.20);fill.position.set(5,1,-4);scene.add(fill);
 }
}

// Render just the aircraft's screen rectangle at higher sampling density.
// The mip chain averages subpixel wing edges before the normal cloud composite.
class ShilokuCruiseTrails {
 constructor(length,heading){
  this.scene=new THREE.Scene();
  this.length=length;
  this.stations=160;
  this.maxAge=28;
  this.offsets=[-.15,.15].map(side=>new THREE.Vector3(side,-.115,-.035)
    .multiplyScalar(length).applyAxisAngle(new THREE.Vector3(0,1,0),heading));
  const vertices=4*(this.stations+1),indices=[];
  this.position=new THREE.Float32BufferAttribute(new Float32Array(vertices*3),3);
  this.position.setUsage(THREE.DynamicDrawUsage);
  this.uv=new THREE.Float32BufferAttribute(new Float32Array(vertices*2),2);
  this.uv.setUsage(THREE.DynamicDrawUsage);
  for(let engine=0;engine<2;engine++)for(let i=0;i<this.stations;i++){
   const a=2*(engine*(this.stations+1)+i);
   indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',this.position);geometry.setAttribute('uv',this.uv);geometry.setIndex(indices);
  this.mesh=new THREE.Mesh(geometry,new THREE.ShaderMaterial({
   transparent:true,depthWrite:false,side:THREE.DoubleSide,
   uniforms:{elapsed:{value:0},life:{value:this.maxAge}},
   vertexShader:'varying vec2 trailUv;void main(){trailUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 trailUv;uniform float elapsed,life;void main(){
    float age=trailUv.x, release=elapsed-mix(.45,life,age);
    // Advect texture with its release point so the older plume hangs in the air.
    float lane=trailUv.y;
    float billow=.5+.5*sin(release*2.3+lane*1.8+1.4*sin(release*.83));
    float wisps=smoothstep(.06,.94,billow);
    float breakup=mix(.83+.17*wisps,.20+.80*wisps,smoothstep(.03,.48,age));
    float edge=exp(-4.*trailUv.y*trailUv.y)*(1.-smoothstep(.72,1.,abs(trailUv.y)));
    float alpha=.34*edge*smoothstep(0.,.04,age)*(1.-smoothstep(.26,1.,age))*breakup;
    gl_FragColor=vec4(.91,.95,1.,alpha);
   }`
  }));
  this.mesh.name='A320-short-contrails';this.mesh.frustumCulled=false;this.mesh.visible=false;
  this.scene.add(this.mesh);
 }
 update(flight,elapsed){
  // The jet is already cruising before it enters the viewport.
  const delay=.45,oldest=this.maxAge;
  this.mesh.visible=flight.enabled;
  this.mesh.material.uniforms.elapsed.value=elapsed;
  if(!this.mesh.visible)return;
  for(let engine=0;engine<2;engine++){
   const offset=this.offsets[engine];
   for(let i=0;i<=this.stations;i++){
    const age=delay+(oldest-delay)*i/this.stations;
    const t=(age-delay)/(this.maxAge-delay),releasedAt=elapsed-age;
    // Evaluate the exhaust position at release on the straight cruise track.
    // Each older parcel stays there, with a small settling drift as it spreads.
    const x=flight.origin.x+flight.velocity.x*releasedAt+offset.x;
    const z=flight.origin.z+flight.velocity.z*releasedAt+offset.z;
    const drift=.045*Math.sin(releasedAt*.39)+.02*Math.sin(releasedAt*.83+engine*.22);
    const y=flight.altitude+offset.y+this.length*t*(drift-.11);
    const spread=THREE.MathUtils.smoothstep(t,0,.72);
    const radius=this.length*(.015+.16*spread)*(1+.24*spread*Math.sin(releasedAt*1.87));
    const a=2*(engine*(this.stations+1)+i);
    this.position.setXYZ(a,x,y-radius,z);this.position.setXYZ(a+1,x,y+radius,z);
    this.uv.setXY(a,t,-1);this.uv.setXY(a+1,t,1);
   }
  }
  this.position.needsUpdate=true;this.uv.needsUpdate=true;
 }
}

class ShilokuAirlinerDetail {
 constructor(){
  this.camera=new THREE.PerspectiveCamera();
  this.target=new THREE.WebGLRenderTarget(512,512,{minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
  this.rect=new THREE.Vector4();
  this.point=new THREE.Vector3();
  this.bounds=new THREE.Box2();
 }
 frame(flight,camera,width,height){
  const center=flight.carrier.position,r=flight.entryRadius;
  const bounds=this.bounds.makeEmpty();
  for(const x of [-r,r])for(const y of [-r,r])for(const z of [-r,r]){
   const point=this.point.copy(center);
   point.x+=x;point.y+=y;point.z+=z;point.project(camera);
   bounds.expandByPoint(point);
  }
  const left=Math.max(0,Math.floor((1+bounds.min.x)*width/2)-2);
  const right=Math.min(width,Math.ceil((1+bounds.max.x)*width/2)+2);
  const top=Math.max(0,Math.floor((1-bounds.max.y)*height/2)-2);
  const bottom=Math.min(height,Math.ceil((1-bounds.min.y)*height/2)+2);
  if(right<=left||bottom<=top)return false;
  const side=Math.max(right-left,bottom-top);
  const resolution=Math.min(2048,Math.max(512,THREE.MathUtils.ceilPowerOfTwo(side*2)));
  this.target.setSize(resolution,resolution);
  this.camera.copy(camera,false);
  this.camera.setViewOffset(width,height,left,top,side,side);
  this.rect.set(left/width,1-(top+side)/height,side/width,side/height);
  return true;
 }
}

class ShilokuAirlinerPass {
 constructor({gap=36,maxGap=120,random=Math.random,distance=24,cloudCeiling=.5,worldLength=.697}={}){
  this.gap=gap;this.maxGap=maxGap;this.random=random;this.initialDistance=distance;this.cloudCeiling=cloudCeiling;this.worldLength=worldLength;this.enabled=true;
  this.origin=null;this.startedAt=null;this.nextAt=0;this.previousCameraZ=null;this.passes=0;this.overtakes=0;
  // A320ceo length: Airbus; cruise TAS450kt: EUROCONTROL. One shared
  // cinematic clock calibrates aircraft and the untouched wallpaper's 0.3u/s
  // camera advance. This is ~12.4x slow motion, not realtime cruise playback.
  const metresPerSceneUnit=37.57/worldLength,cruiseMetresPerSecond=450*1852/3600;
  const sceneSpeed=.3*1.15;
  this.reference={aircraftLengthMetres:37.57,cruiseTasKnots:450,cruiseTasKmh:cruiseMetresPerSecond*3.6,metresPerSceneUnit,sceneTimeScale:sceneSpeed*metresPerSceneUnit/cruiseMetresPerSecond};
  this.trimPitchDeg=.5;
  this.heading=-Math.PI/2+18*Math.PI/180;
  this.velocity=new THREE.Vector3(Math.sin(this.heading),0,Math.cos(this.heading)).multiplyScalar(sceneSpeed);
  this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xb9cddd,12,75);ShilokuAirlinerModel.lights(this.scene);
  this.trails=new ShilokuCruiseTrails(worldLength,this.heading);
  this.carrier=new THREE.Group();this.carrier.name='A320V2-flight-container';this.scene.add(this.carrier);
  this.setAttitude(0);
  this.carrier.scale.setScalar(worldLength);this.current={loaded:false,visible:false};
 }
 async load(url){
  const asset=await ShilokuAirlinerModel.load(url),box=new THREE.Box3().setFromObject(asset.model);this.carrier.add(asset.model);this.asset=asset;
  // Conservative corner bounds over the small cruise attitude envelope, so
  // neither a wingtip nor the fuselage can dip below the cloud ceiling.
  this.lowestLocalY=Infinity;
  for(const pitch of[this.trimPitchDeg-.08,this.trimPitchDeg+.08])for(const roll of[-.25,.25]){
   const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch*Math.PI/180,this.heading,roll*Math.PI/180,'YXZ'));
   for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])
    this.lowestLocalY=Math.min(this.lowestLocalY,new THREE.Vector3(x,y,z).multiplyScalar(this.worldLength).applyQuaternion(q).y);
  }
  this.lowestLocalY-=.002;
  this.entryRadius=box.getSize(new THREE.Vector3()).length()*.5*this.worldLength;
  this.altitude=this.cloudCeiling+.06-this.lowestLocalY;
  return asset.metadata;
 }
 setAttitude(elapsed){
  // Stable level cruise: fixed track/altitude, slight nose-up visual trim,
  // tiny slow corrections only. No banking turn, heave or yaw oscillation.
  const pitchDeg=this.trimPitchDeg+.08*Math.sin(elapsed*Math.PI*2/47),rollDeg=.25*Math.sin(elapsed*Math.PI*2/37);
  this.carrier.quaternion.setFromEuler(new THREE.Euler(-pitchDeg*Math.PI/180,this.heading,rollDeg*Math.PI/180,'YXZ'));
  return {pitchDeg,rollDeg};
 }
 replay(){this.origin=null;this.nextAt=0;}
 spawn(camera,width,now){
  camera.updateMatrixWorld(true);
  const clip=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
  // The right clip plane is w - x = 0. Start the complete aircraft's
  // bounding sphere outside it, even when the camera is tilted or zoomed.
  const right=new THREE.Plane().setComponents(clip[3]-clip[0],clip[7]-clip[4],clip[11]-clip[8],clip[15]-clip[12]).normalize();
  this.origin=new THREE.Vector3(camera.position.x,this.altitude,camera.position.z-this.initialDistance);
  this.origin.x+=(-(this.entryRadius??this.worldLength)-right.distanceToPoint(this.origin))/right.normal.x;
  // Viewport only sets the entrance position, never the world airspeed.
  this.startedAt=now;this.passes++;
 }
 update(camera,width,height,now=performance.now()){
  if(!this.asset)return this.current;
  const wrap=this.previousCameraZ===null?0:camera.position.z-this.previousCameraZ;
  if(this.origin&&wrap>40)this.origin.z+=wrap;
  this.previousCameraZ=camera.position.z;
  if(!this.origin&&this.enabled&&now>=this.nextAt)this.spawn(camera,width,now);
  if(!this.origin){this.carrier.visible=false;this.trails.mesh.visible=false;return this.current={loaded:true,visible:false,waiting:true,overtakes:this.overtakes};}
  const elapsed=Math.max(0,(now-this.startedAt)/1000);
  this.carrier.position.copy(this.origin).addScaledVector(this.velocity,elapsed);
  const attitude=this.setAttitude(elapsed);
  const direction=new THREE.Vector3();camera.getWorldDirection(direction);
  this.distance=this.carrier.position.clone().sub(camera.position).dot(direction);
  const screen=this.carrier.position.clone().project(camera);
  this.carrier.visible=this.enabled&&this.distance>.15&&Math.abs(screen.x)<2.5&&screen.y<2.5;
  this.trails.update(this,elapsed);
  const bottomY=this.altitude+this.lowestLocalY;
  this.current={loaded:true,visible:this.carrier.visible,worldCoordinates:true,elapsed:+elapsed.toFixed(2),xNdc:+screen.x.toFixed(4),yNdc:+screen.y.toFixed(4),distance:+this.distance.toFixed(3),worldLength:this.worldLength,altitude:+this.altitude.toFixed(3),bottomY:+bottomY.toFixed(3),cloudCeiling:+this.cloudCeiling.toFixed(3),aboveClouds:bottomY>this.cloudCeiling,worldX:+this.carrier.position.x.toFixed(3),worldZ:+this.carrier.position.z.toFixed(3),overtakes:this.overtakes,direction:'right-to-left',phase:'level-cruise',pitchDeg:+attitude.pitchDeg.toFixed(3),rollDeg:+attitude.rollDeg.toFixed(3),sceneVelocity:this.velocity.toArray(),reference:this.reference,triangles:this.asset.metadata.triangles};
  if(this.distance< -1){this.overtakes++;this.current.overtaken=true;this.current.visible=false;this.carrier.visible=false;this.origin=null;this.nextAt=now+1000*(this.gap+(this.maxGap-this.gap)*this.random());}
  return this.current;
 }
}
