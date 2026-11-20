(async()=>{
 const status=document.getElementById('model-status'),errors=[];
 addEventListener('error',e=>{errors.push(e.message);status.textContent=e.message;});
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce7ee);ShilokuAirlinerModel.lights(scene);
 const camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.01,100);camera.position.set(1.18,.62,1.5);
 const controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.20;controls.maxDistance=5;controls.target.set(0,.005,0);controls.update();
 const asset=await ShilokuAirlinerModel.load('assets/airliner/airbus-a320-v2-packed.glb',event=>{if(event.total)status.textContent='正在加载原始 GLB… '+Math.round(event.loaded/event.total*100)+'%';});scene.add(asset.model);
 status.textContent=asset.metadata.triangles.toLocaleString()+' 个三角面 · '+asset.metadata.meshes+' 个网格 · 原材质';
 status.dataset.model=JSON.stringify({...asset.metadata,errors});
 const views={'three-quarter':[1.18,.62,1.5],side:[1.85,.22,0],front:[0,.25,1.9],top:[.001,1.9,.001]};
 for(const[id,position]of Object.entries(views))document.getElementById(id).onclick=()=>{camera.position.set(...position);controls.target.set(0,0,0);controls.update();};
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
})().catch(e=>{document.getElementById('model-status').textContent=e.message;console.error(e);});
