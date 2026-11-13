import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeSiteImage} from '../admin/image-upload.js';

test('HEIF and HEIC fall back to conversion when the browser cannot decode them',async()=>{
 for(const file of [{name:'photo.heif',type:'image/heif',size:2300000},{name:'photo.HEIC',type:'',size:2300000}]){
  const bitmap={width:4032,height:3024};let calls=0;
  const actual=await decodeSiteImage(file,{nativeDecode:async()=>{throw Error('unsupported')},loadHeif:async()=>({heicTo:async options=>{calls++;assert.equal(options.blob,file);assert.equal(options.type,'bitmap');return bitmap}})});
  assert.equal(actual,bitmap);assert.equal(calls,1);
 }
});
test('native decoding avoids loading the converter for ordinary or native-supported HEIF photos',async()=>{
 for(const file of [{name:'photo.jpg',type:'image/jpeg',size:2300000},{name:'photo.heic',type:'image/heic',size:2300000}]){
  const bitmap={width:10,height:10};
  assert.equal(await decodeSiteImage(file,{nativeDecode:async()=>bitmap,loadHeif:async()=>{throw Error('must not load')}}),bitmap);
 }
});
test('size, format and damaged-image failures have distinct messages',async()=>{
 const deps={nativeDecode:async()=>{throw Error('decode failed')},loadHeif:async()=>({heicTo:async()=>{throw Error('invalid data')}})};
 await assert.rejects(()=>decodeSiteImage({name:'photo.heic',type:'image/heic',size:13*1024*1024},deps),/超过 12 MB/);
 await assert.rejects(()=>decodeSiteImage({name:'photo.gif',type:'image/gif',size:2300000},deps),/格式不支持/);
 await assert.rejects(()=>decodeSiteImage({name:'photo.heif',type:'image/heif',size:2300000},deps),/HEIF.*读取失败/);
 await assert.rejects(()=>decodeSiteImage({name:'photo.png',type:'image/png',size:2300000},deps),/图片读取失败/);
});
