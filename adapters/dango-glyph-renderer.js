/* GPU bridge for Dango's character rules, retaining Mineradio's original
 * text raster, row materials, progress highlight and quality texture system.
 * Each row stays one draw: subdivide its plane into glyph strips, then move
 * each strip using the original Dango timing/envelopes. No per-frame raster,
 * one-mesh-per-character, replacement font, or edits to upstream files.
 */
class DangoGlyphRenderer {
 constructor(runtime){this.w=runtime;this.T=runtime.THREE;this.patched=new WeakSet();this.inkCache=new WeakMap();this.measure=runtime.document.createElement('canvas').getContext('2d');}
 inkBounds(mesh){
  const image=mesh.material.uniforms.uMap.value.image,plane=mesh.userData.dangoPlane;if(!image||!plane)return null;
  let uv=this.inkCache.get(image);
  if(!uv){
   if(!image.getContext)return null;const pixels=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
   let x0=image.width,y0=image.height,x1=-1,y1=-1;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
   uv=x1<0?{x0:0,x1:1,y0:0,y1:1}:{x0:x0/image.width,x1:(x1+1)/image.width,y0:y0/image.height,y1:(y1+1)/image.height};this.inkCache.set(image,uv);
  }
  return{x0:(uv.x0-.5)*plane.width,x1:(uv.x1-.5)*plane.width,y0:(.5-uv.y1)*plane.height,y1:(.5-uv.y0)*plane.height};
 }
 attach(sentence){sentence.glyphMeshes=[];this.ensure(sentence);}
 ensure(sentence){
  const rows=sentence.mesh.userData.lyric?.rowLayers||[];
  for(const row of rows){
   if(!row.mesh?.visible)continue;
   for(const [part,mesh]of[['text',row.mesh],['readability',row.readability],['glow',row.glow]]){
    if(!mesh)continue;
    if(this.patched.has(mesh)){
     if(mesh.userData.dangoPlane&&!sentence.glyphMeshes.includes(mesh))sentence.glyphMeshes.push(mesh);
     continue;
    }
    const added=this.patchMesh(mesh,row,part,sentence);this.patched.add(mesh);if(added)sentence.glyphMeshes.push(mesh);
   }
  }
 }
 patchMesh(mesh,row,part,sentence){
  const w=this.w,T=this.T,mask=row.lineMask,units=DangoCharacterMotion.units(row.text||'');if(!units.length)return false;
  const old=mesh.geometry;old.computeBoundingBox();const bounds=old.boundingBox,W=bounds.max.x-bounds.min.x,H=bounds.max.y-bounds.min.y;
  const mat=mesh.material,texture=mat.uniforms.uMap.value,meta=texture.userData||{};
  const mw=part==='glow'?(meta.width||texture.image.width):mask.width;
  const mh=part==='glow'?(meta.height||texture.image.height):mask.height;
  const tw=part==='glow'?(meta.textWidth||mw):Math.max(1,mask.activeTextWidth||mask.textWidth);
  const fs=part==='glow'?(meta.fontSize||mask.fontSize):mask.fontSize;
  const baseline=part==='glow'?(meta.lineY0||mh/2+fs*.36):mask.lineY0;
  const centerY=(.5-(baseline-fs*.36)/mh)*H;
  const fontSize=mask.logicalFontSize||mask.fontSize,entry=mask.entries?.[0]||{};
  const measureSize=fontSize*(entry.scale||1),weight=w.lyricEntryWeight(entry);
  const widths=[0];let prefix='';
  for(const unit of units){prefix+=unit;widths.push(w.lyricMeasureTextAtSize(this.measure,prefix,measureSize,weight));}
  const totalWidth=Math.max(1,widths[widths.length-1]),min=.5-tw/mw/2,span=tw/mw;
  const positions=[],uvs=[],centers=[],indices=[],orders=[];
  const count=Math.max(1,units.length);
  for(let k=0;k<count;k++){
   const a=k===0?0:min+widths[k]/totalWidth*span,b=k===count-1?1:min+widths[k+1]/totalWidth*span;
   const center=(min+(widths[k]+widths[k+1])/(2*totalWidth)*span-.5)*W,offset=k*4;
   for(const [u,v]of[[a,0],[b,0],[b,1],[a,1]]){positions.push((u-.5)*W,(v-.5)*H,0);uvs.push(u,v);centers.push(center,centerY);orders.push(k);}
   indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('dangoCenter',new T.Float32BufferAttribute(centers,2));geo.setAttribute('dangoOrder',new T.Float32BufferAttribute(orders,1));geo.setIndex(indices);geo.computeBoundingSphere();mesh.geometry=geo;old.dispose();mesh.frustumCulled=false;
  Object.assign(mat.uniforms,{
   uDangoElapsed:{value:0},uDangoReveal:{value:1000},uDangoCount:{value:count},uDangoEnabled:{value:1},uDangoStrength:{value:1},uDangoTranslation:{value:row.isTranslation?1:0},uDangoLift:{value:fs/mh*H*(5/11)}
  });
  const header='attribute vec2 dangoCenter; attribute float dangoOrder; uniform float uDangoElapsed,uDangoReveal,uDangoCount,uDangoEnabled,uDangoStrength,uDangoTranslation,uDangoLift; varying float vDangoAlpha;\n';
  const animation=`
    float dangoAge=uDangoElapsed-dangoOrder/max(1.0,uDangoCount)*uDangoReveal;
    float dangoT=clamp(dangoAge/65.0,0.0,1.0);
    float dangoA=dangoT*dangoT*(3.0-2.0*dangoT);
    // Reach the crest after the glyph is visible, then settle through a small undershoot.
    float crest=smoothstep(0.0,85.0,dangoAge)*(1.0-smoothstep(85.0,225.0,dangoAge));
    float settle=smoothstep(170.0,240.0,dangoAge)*(1.0-smoothstep(240.0,340.0,dangoAge));
    float dangoPop=1.0+(0.40*crest-0.07*settle)*uDangoStrength*uDangoEnabled;
    vec3 dangoPosition=position;
    if(uDangoTranslation>0.5){
      float tr=clamp((uDangoElapsed-120.0)/260.0,0.0,1.0);
      vDangoAlpha=tr*tr*(3.0-2.0*tr)*0.85;
    }else{
      vDangoAlpha=mix(1.0,dangoA,uDangoEnabled);
      dangoPosition.xy=dangoCenter+(position.xy-dangoCenter)*dangoPop;
      dangoPosition.y+=(crest-0.15*settle)*uDangoLift*uDangoEnabled*uDangoStrength;
    }
  `;
  // Every supported material here is an original ShaderMaterial. Keep its
  // colors/glow/sweep/texture sampling intact; add only vertex motion + alpha.
  const before=mat.vertexShader;
  mat.vertexShader=header+before.replace(/void\s+main\s*\(\s*\)\s*\{/,m=>m+animation).replace(/vec4\(\s*position\s*,\s*1\.0\s*\)/g,'vec4(dangoPosition,1.0)');
  if(mat.vertexShader===header+before)throw Error('Unsupported native lyric vertex shader');
  mat.fragmentShader='varying float vDangoAlpha;\n'+mat.fragmentShader.replace(/}\s*$/,'gl_FragColor.a *= vDangoAlpha;\n}');
  mat.needsUpdate=true;mesh.userData.dangoRow=row;mesh.userData.dangoPart=part;mesh.userData.dangoPlane={width:W,height:H};return true;
 }
 update(sentence,elapsedMs,lineMs,enabled,strength){
  this.ensure(sentence);
  const count=sentence.characterUnits.length,reveal=DangoCharacterMotion.revealMs(count,lineMs);
  for(const mesh of sentence.glyphMeshes){const u=mesh.material.uniforms;u.uDangoElapsed.value=elapsedMs;u.uDangoReveal.value=reveal;u.uDangoEnabled.value=enabled?1:0;u.uDangoStrength.value=strength;}
  const units=sentence.characterUnits;
  return{characters:units.length,visible:units.filter((_,i)=>!enabled||DangoCharacterMotion.glyph(i,units.length,elapsedMs,reveal).alpha>0).length,revealMs:reveal,translationAlpha:DangoCharacterMotion.translationAlpha(elapsedMs)};
 }
}
