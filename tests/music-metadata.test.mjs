import test from 'node:test';import assert from 'node:assert/strict';
import {fetchNeteaseLyric} from '../api/_lib/netease/lib.js';
test('lyrics include canonical song details with all artists, album and cover',async t=>{
 t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>String(url).includes('/song/detail?')?{songs:[{id:42,name:'Title',ar:[{id:1,name:'First'},{id:2,name:'Second'}],al:{id:3,name:'Album',picUrl:'https://p1.music.126.net/cover.jpg'},dt:123000}]}:{lrc:{lyric:'[00:01]line'},tlyric:{lyric:'[00:01]译文'}}}));
 const result=await fetchNeteaseLyric('42');assert.equal(result.lyric,'[00:01]line');assert.equal(result.song.artist,'First / Second');assert.equal(result.song.album,'Album');assert.equal(result.song.cover,'https://p1.music.126.net/cover.jpg');assert.equal(result.song.duration,123000);
});
test('song detail outage does not discard available lyrics',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{if(String(url).includes('/song/detail?'))throw Error('offline');return {ok:true,json:async()=>({lrc:{lyric:'[00:01]line'}})}});
 const result=await fetchNeteaseLyric('43');assert.equal(result.lyric,'[00:01]line');assert.equal(result.song,null);
});
