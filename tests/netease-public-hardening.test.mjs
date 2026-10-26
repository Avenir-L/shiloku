import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchUserPlaylists,fetchPlaylistSongs} from '../api/_lib/netease/lib.js';
import {createNeteaseHandler} from '../api/netease.js';

test('public lists omit private and unclassified playlists',async t=>{
 t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>String(url).includes('/nuser/account/')?{code:200,account:{id:1}}:{playlist:[{id:1,privacy:0},{id:2,privacy:10},{id:3}]}}));
 assert.deepEqual((await fetchUserPlaylists('MUSIC_U=test')).playlists.map(p=>p.id),[1]);
});
test('quota denial reaches visitors before contacting upstream',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('must not reach upstream')});
 const handler=createNeteaseHandler({limit:async()=>{throw Object.assign(Error('limited'),{status:429})}});
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await handler({method:'GET',headers:{},query:{path:'search',keywords:'test'}},res);
 assert.equal(res.code,429);assert.equal(res.headers['Retry-After'],'60');
});
test('private playlist detail is rejected before querying playable tracks',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return {ok:true,json:async()=>({playlist:{privacy:10,tracks:[{id:1,name:'private'}]}})}});
 await assert.rejects(()=>fetchPlaylistSongs('2','MUSIC_U=test'),e=>e.status===403);
 assert.equal(calls,1);
});
test('public endpoint preserves a lone public playlist after private playlists are filtered',async t=>{
 const old=process.env.NETEASE_COOKIE;process.env.NETEASE_COOKIE='MUSIC_U=test';
 t.after(()=>{if(old===undefined)delete process.env.NETEASE_COOKIE;else process.env.NETEASE_COOKIE=old});
 t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>String(url).includes('/nuser/account/')?{code:200,account:{id:1}}:{playlist:[{id:1,privacy:10},{id:2,privacy:0}]}}));
 const handler=createNeteaseHandler({limit:async()=>{}}),res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await handler({method:'GET',headers:{},query:{path:'playlists'}},res);assert.deepEqual(res.body.playlists.map(p=>p.id),[2]);
});
