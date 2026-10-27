import test from 'node:test';
import assert from 'node:assert/strict';
import {createSiteContent} from '../api/_lib/site-content.js';
import {createAdminHandler} from '../api/admin.js';
import {createContentHandler} from '../api/site-content.js';
class Store {
 values=new Map();
 async command([op,key,...args]){
  if(op==='GET')return this.values.get(key)??null;
  if(op==='SET'){this.values.set(key,args[0]);return 'OK';}
  if(op==='PERSIST')return 1;
  if(op==='EVAL'){const raw=this.values.get(args[1]);if((raw?JSON.parse(raw).revision:'initial')!==args[2])return 0;this.values.set(args[1],args[3]);return 1;}
  throw Error(op);
 }
}
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(v){this.body=v;return this;},end(v){this.bytes=v;return this;}});
test('site content starts from current multilingual profile and complete existing gallery',async()=>{
 const content=createSiteContent({store:new Store()}),data=await content.read();
 assert.equal(data.profile.nickname,'栀落余殁');assert.equal(data.profile.avatar,'/avatar.jpg');assert.ok(data.profile.locales.en.bioP1);assert.equal(data.gallery.length,9);
});
test('profile/gallery persist across service instances; concurrent edits are rejected',async()=>{
 const store=new Store(),content=createSiteContent({store}),data=await content.read();
 const saved=await content.save({...data,profile:{...data.profile,nickname:'新的昵称'},gallery:data.gallery.slice().reverse()});
 assert.equal((await createSiteContent({store}).read()).profile.nickname,'新的昵称');assert.equal(saved.gallery[0].id,data.gallery.at(-1).id);
 await assert.rejects(()=>content.save(data),{status:409});
});
test('untrusted avatar/gallery URLs and unexpected HTML uploads are rejected',async()=>{
 const content=createSiteContent({store:new Store()}),data=await content.read();
 for(const url of ['javascript:alert(1)','https://evil.test/x','/api/admin?action=session','/gallery/../admin/admin.js'])await assert.rejects(()=>content.save({...data,profile:{...data.profile,avatar:url}}),{status:400});
 await assert.rejects(()=>content.upload({data:Buffer.from('<svg onload="alert(1)">').toString('base64'),type:'image/svg+xml'}),{status:400});
 await assert.rejects(()=>content.save({...data,gallery:[{...data.gallery[0],image:'javascript:alert(1)'}]}),{status:400});
});
test('raster uploads use immutable IDs and newly uploaded avatar can be published',async()=>{
 const content=createSiteContent({store:new Store()}),data=await content.read();
 const bytes=Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64');
 const image=await content.upload({data:bytes.toString('base64'),type:'image/webp'});
 assert.match(image.url,/^\/api\/site-content\?image=[a-f0-9]{64}$/);
 const saved=await content.save({...data,profile:{...data.profile,avatar:image.url}});
 assert.equal(saved.profile.avatar,image.url);assert.deepEqual((await content.image(image.id)).bytes,bytes);
});
test('image payload at documented size limit does not exhaust regex stack',async()=>{
 const content=createSiteContent({store:new Store()}),bytes=Buffer.alloc(600000);bytes.write('RIFF',0);bytes.write('WEBP',8);
 assert.ok((await content.upload({data:bytes.toString('base64'),type:'image/webp'})).id);
});
test('content and upload admin actions reject visitors and foreign origins before storage',async()=>{
 let calls=0;const env={ADMIN_ORIGIN:'https://www.shiloku.cn'};
 const handler=createAdminHandler({env,auth:{session:async()=>null},content:{read(){calls++;},save(){calls++;},upload(){calls++;}}});
 for(const action of ['content-get','content-save','content-upload']){
  const out=response();await handler({method:'POST',headers:{origin:env.ADMIN_ORIGIN,'content-type':'application/json'},query:{action},body:{}},out);assert.equal(out.code,401);
  const cross=response();await handler({method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},query:{action},body:{}},cross);assert.equal(cross.code,403);
 }
 assert.equal(calls,0);
});
test('large valid multilingual documents can be published through authenticated router',async()=>{
 const content=createSiteContent({store:new Store()}),data=await content.read();
 for(const locale of Object.values(data.profile.locales))for(const key of Object.keys(locale))locale[key]='字'.repeat(key.startsWith('aboutBio')?2500:1000);
 assert.ok(JSON.stringify(data).length>24000);
 const handler=createAdminHandler({env:{ADMIN_ORIGIN:'https://www.shiloku.cn'},content,auth:{session:async()=>({id:'owner'}),rateLimit:async()=>{}}});
 const out=response();await handler({method:'POST',headers:{origin:'https://www.shiloku.cn','content-type':'application/json'},query:{action:'content-save'},body:data},out);assert.equal(out.code,200);
});
test('public content excludes hidden artwork and shared avatar always redirects to current profile',async()=>{
 const content=createSiteContent({store:new Store()}),data=await content.read();data.gallery[0].hidden=true;
 await content.save(data);const handler=createContentHandler({content});
 const out=response();await handler({method:'GET',query:{}},out);assert.equal(out.body.gallery.length,8);assert.equal(out.body.gallery.some(item=>item.id===data.gallery[0].id),false);
 const avatar=response();await handler({method:'GET',query:{avatar:'1'}},avatar);assert.equal(avatar.code,302);assert.equal(avatar.headers.Location,'/avatar.jpg');assert.equal(avatar.headers['Cache-Control'],'no-store');
 const write=response();await handler({method:'POST',query:{},body:data},write);assert.equal(write.code,405);
});
