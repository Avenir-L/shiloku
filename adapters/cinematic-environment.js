/* High-sky points reuse Mineradio's original dot texture. Mouse movement is
 * handled by Wallpaper's own function/easing, without this layer filtering it. */
class ShilokuHighSkyStars {
 static daylightVisibility(sunElevationDegrees){
  // Artistic twilight envelope, not a limiting-magnitude calculation.
  // In a bright daytime sky, atmospheric sunlight overwhelms stellar light.
  const t=Math.max(0,Math.min(1,(-sunElevationDegrees-2)/10));
  return t*t*(3-2*t);
 }
 constructor(dotTexture){
  this.scene=new THREE.Scene();this.group=new THREE.Group();this.scene.add(this.group);this.enabled=true;this.depth=70;
  const count=40,positions=new Float32Array(count*3),colors=new Float32Array(count*3);this.samples=[];
  for(let i=0;i<count;i++){
   const random=n=>{const v=Math.sin((i+1)*127.1+n*311.7)*43758.5453;return v-Math.floor(v);};
   this.samples.push({x:random(1)*1.9-.95,y:.34+random(2)*.62});
   const intensity=.42+random(3)*.42;colors.set([intensity*.85,intensity*.93,intensity],i*3);
  }
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  this.material=new THREE.PointsMaterial({map:dotTexture,color:0xffffff,size:2.7,sizeAttenuation:false,transparent:true,opacity:.50,vertexColors:true,depthWrite:false,depthTest:false,blending:THREE.NormalBlending});
  this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;this.group.add(this.points);this.viewportKey='';
 }
 update(camera,width,height,{sunElevationDegrees=36}={}){
  const visibility=ShilokuHighSkyStars.daylightVisibility(sunElevationDegrees);
  this.material.opacity=.5*visibility;
  this.group.visible=this.enabled&&visibility>.0001;this.group.position.copy(camera.position);this.group.quaternion.copy(camera.quaternion);
  const key=width+'x'+height+':'+camera.fov;
  if(key!==this.viewportKey){
   const halfHeight=this.depth*Math.tan(camera.fov*Math.PI/360),halfWidth=halfHeight*camera.aspect,attribute=this.geometry.attributes.position;
   this.samples.forEach((p,i)=>attribute.setXYZ(i,p.x*halfWidth,p.y*halfHeight,-this.depth));attribute.needsUpdate=true;this.viewportKey=key;
  }
  return{enabled:this.enabled,visible:this.group.visible,count:this.samples.length,opacity:this.material.opacity,upperSkyOnly:true,sunElevationDegrees:+sunElevationDegrees.toFixed(3),daylightVisibility:+visibility.toFixed(4),catalogueBased:false};
 }
}
