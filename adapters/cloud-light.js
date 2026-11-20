// Relight the original sprite using its painted relief and the cloud bank's height.
function lightCloudMaterial(material, sun, cloudFaces) {
  const strength = material.uniforms.cloudLight = {type:'f', value:0};
  material.uniforms.daylightDirection = {type:'v3', value:sun};
  material.vertexShader = 'uniform vec3 daylightDirection; varying float bankHeight; varying float sunward;\n' +
    material.vertexShader.replace('vUv = uv;', `vUv = uv;
      vec3 worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
      bankHeight = worldPoint.y;
      sunward = dot(normalize(worldPoint-cameraPosition),daylightDirection);`);
  material.fragmentShader = 'uniform float cloudLight; varying float bankHeight; varying float sunward;\n' +
    material.fragmentShader.replace('gl_FragColor.w *=', `
      float relief = smoothstep(.80,.998,dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722)));
      float heightLight = smoothstep(-115.,12.,bankHeight);
      float exposure = smoothstep(.14,.93,.54*relief+.40*heightLight+.06*sunward);
      vec3 shade = mix(vec3(.55,.66,.82),vec3(1.07,1.055,1.025),exposure);
      gl_FragColor.rgb = mix(gl_FragColor.rgb,min(vec3(1.),gl_FragColor.rgb*shade),cloudLight);
      gl_FragColor.w *=`);
  if (cloudFaces) {
    // Screen-facing puffs rotate individually. Use their actual world-space
    // corners so the lit shoulder always points toward the scene sun.
    material.attributes = material.attributes || {};
    material.attributes.cloudFace = {type:'v3',value:cloudFaces};
    material.vertexShader = 'attribute vec3 cloudFace; varying vec3 puff;\n' +
      material.vertexShader.replace('vUv = uv;', 'vUv = uv; puff = cloudFace;');
    material.fragmentShader = 'varying vec3 puff;\n' + material.fragmentShader
      .replace('gl_FragColor.w *=', `
        float distant = smoothstep(450.,1550.,depth);
        vec2 xy = puff.xy*.92;
        vec3 normal = normalize(vec3(xy,sqrt(max(.08,1.-dot(xy,xy)))));
        float facing = smoothstep(-.28,.83,dot(normal,normalize(vec3(.79,.56,.24))));
        float crown = smoothstep(8.,125.,bankHeight);
        float daylight = smoothstep(.10,.86,.56*puff.z+.26*facing+.31*crown);
        vec3 lobe = mix(vec3(.61,.72,.85),vec3(1.16,1.12,1.04),daylight);
        lobe *= .95+.05*facing;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, lobe*(.90+.10*relief), distant*cloudLight);
        gl_FragColor.w *=`)
      .replace('vec4( fogColor, gl_FragColor.w )', 'vec4(mix(fogColor,vec3(.76,.85,.93),distant*cloudLight),gl_FragColor.w)')
      .replace('fogFactor );',  `fogFactor * (1. - .55*cloudLight) );
        // Sunlight scattered by exposed crests stays visible through the far haze.
        float sunlit = smoothstep(.18,.76,daylight*.72 + facing*.20 + relief*.08);
        float farSun = smoothstep(950.,1750.,depth)*cloudLight*sunlit;
        gl_FragColor.rgb += max(vec3(1.0,.986,.96)-gl_FragColor.rgb,vec3(0.))*farSun*.78;`);
  }
  material.uniforms.fogColor.value.setHex(0x94b7d9);
  material.needsUpdate = true;
  return strength;
}

function paintDaySky(wallpaper, painted) {
  const tile = document.createElement('canvas');
  tile.width=384; tile.height=512;
  const ctx=tile.getContext('2d');
  const sky=ctx.createLinearGradient(0,0,0,512);
  const stops = painted ? [[0,'#082b66'],[.29,'#10478f'],[.52,'#2266af'],[.70,'#438ec7'],[.83,'#88b8db'],[1,'#c1d8e9']] : [[0,'#174785'],[.28,'#2869aa'],[.48,'#5195c9'],[.65,'#9ec5df'],[.79,'#d5e3ed'],[1,'#b3ccdf']];
  for(const [stop,color] of stops)
    sky.addColorStop(stop,color);
  ctx.fillStyle=sky;ctx.fillRect(0,0,384,512);
  const glow=ctx.createRadialGradient(375,265,0,375,265,340);
  glow.addColorStop(0,'rgba(252,229,193,.15)');glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow;ctx.fillRect(0,0,384,512);
  wallpaper.container.style.backgroundImage='url('+tile.toDataURL()+')';
  wallpaper.container.style.backgroundSize='100% 100%';
}
