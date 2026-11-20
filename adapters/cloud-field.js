// Install the complete cloud field before the opening releases the homepage.
window.cloudFieldReady = (async () => {
  const frame = document.getElementById('wallpaper');
  if (!frame.contentWindow.renderer) await new Promise(resolve => frame.addEventListener('load',resolve,{once:true}));
  const b = frame.contentWindow;
const cloudStyle = new URLSearchParams(location.search).get('clouds') ?? 'painted';
const painted = cloudStyle === 'painted';
const cloudFaces = painted ? [] : null;
if (painted || cloudStyle === 'banks') {
  const original = b.geometry;
  const banks = original.clone();
  const field = new THREE.ImprovedNoise();
  // Each Wallpaper quad has four vertices. Translate all four together.
  for (let i=0; i<banks.vertices.length; i+=4) {
    const v=banks.vertices[i], opposite=banks.vertices[i+2];
    const x=(v.x+opposite.x)/2, angle=v.z*(2*Math.PI/8000);
    const u=Math.cos(angle), t=Math.sin(angle);
    const ridge=field.noise(x/210+13, u*4+7, t*4+.6);
    const detail=field.noise(x/85+22,u*11+5,t*11+.3);
    let offset=112*ridge+22*detail-12;
    if (painted) {
      // A low central flight corridor, with taller, grouped cumulus on its flanks.
      const shoulder = (x-245-60*Math.sin(angle*3))/110;
      const crest = .5+.5*Math.cos(angle*4-.9);
      const tower = Math.exp(-shoulder*shoulder)*crest*crest;
      offset = -68 + 75*ridge + 30*detail + 240*tower;
      const cy=(v.y+opposite.y)/2;
      const radius=Math.hypot(v.x-x,v.y-cy);
      for(let j=0;j<4;j++) {
        const point=banks.vertices[i+j];
        cloudFaces.push(new b.THREE.Vector3((point.x-x)/radius,(point.y-cy)/radius,1));
        point.y=cy+(point.y-cy)*(1+.65*tower);
      }
    }
    for(let j=0;j<4;j++) banks.vertices[i+j].y+=offset;
  }
  if (painted) {
    // Record the cloud-top envelope in world space, then estimate how much
    // cloud lies between each vertex and the daylight source (.8,.6,.2).
    const cell=40, cols=32, rows=200;
    const tops=new Float32Array(cols*rows).fill(-260);
    const col=x=>Math.max(0,Math.min(cols-1,Math.floor(x/cell+cols/2)));
    const row=z=>((Math.floor(z/cell)%rows)+rows)%rows;
    for (let i=0;i<banks.vertices.length;i+=4) {
      const quad=banks.vertices.slice(i,i+4);
      const x=(quad[0].x+quad[2].x)/2, z=quad[0].z;
      const k=row(z)*cols+col(x);
      tops[k]=Math.max(tops[k],...quad.map(v=>v.y));
    }
    function envelope(x,z) {
      const u=x/cell+cols/2-.5,v=z/cell-.5;
      const c=Math.floor(u),r=Math.floor(v),fx=u-c,fz=v-r;
      const at=(dx,dz)=>tops[((r+dz+rows)%rows)*cols+Math.min(cols-1,Math.max(0,c+dx))];
      return (at(0,0)*(1-fx)+at(1,0)*fx)*(1-fz)+(at(0,1)*(1-fx)+at(1,1)*fx)*fz;
    }
    banks.vertices.forEach((v,i)=>{
      let thickness=0;
      for (let step=1;step<=9;step++) {
        const d=step*20;
        thickness+=Math.max(0,Math.min(1,(envelope(v.x+.8*d,v.z+.2*d)-v.y-.6*d)/38));
      }
      cloudFaces[i].z=Math.exp(-.42*thickness);
    });
  }
  banks.computeBoundingSphere();
  for (const layer of b.scene.children.filter(mesh=>mesh.geometry===original)) {
    b.scene.remove(layer);
    const replacement=new b.THREE.Mesh(banks,layer.material);
    replacement.position.copy(layer.position);
    replacement.rotation.copy(layer.rotation);
    replacement.scale.copy(layer.scale);
    b.scene.add(replacement);
    if (b.mesh===layer) b.mesh=replacement;
  }
  b.geometry=banks;
}

  if (painted) {
    b.camera.far=5400;
    b.camera.updateProjectionMatrix();
    // Populate the extra viewing range before individual puffs have visible opacity.
    b.material.fragmentShader=b.material.fragmentShader.replace('gl_FragColor.w *= pow',
      'gl_FragColor.w *= 1.0 - smoothstep(3100.0, 5350.0, depth); gl_FragColor.w *= pow');
    b.material.needsUpdate=true;
    paintDaySky(b,true);
  }
  frame.dataset.fieldReady='true';
  return {painted,cloudFaces};
})();
