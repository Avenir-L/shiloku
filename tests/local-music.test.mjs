import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
test('all eight local tracks have complete metadata and packaged audio, lyrics and covers',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const block=html.match(/const LOCAL_SONGS = (\[[\s\S]*?\n\]);/)[1];const songs=runInNewContext('('+block+')');
 assert.equal(songs.length,8);
 assert.deepEqual(Array.from(songs,s=>s.title),['End of Beginning','more than words','Do You Feel It?','mede:mede','Hypnotized','夕日坂','Beautiful World','Listen']);
 for(const song of songs){assert.ok(song.title&&song.artist&&song.album);assert.ok(song.duration>0);for(const path of [song.src,song.lrc,song.cover])await access(new URL('../'+path,import.meta.url));}
 const added=songs.find(s=>s.title==='End of Beginning');assert.equal(added.artist,'Djo');assert.equal(added.album,'DECIDE');assert.equal(added.neteaseId,1966970103);
});
test('local timed lyrics render without waiting for online enrichment',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const fn=html.slice(html.indexOf('async function loadSongLyrics(song)'),html.indexOf('// 异步加载控制器'));
 const state={song:{lrc:'test.lrc',neteaseId:42},lyricLoadSeq:0,currentLyricsData:[],loadNeteaseLyrics:()=>new Promise(()=>{}),fetchAndParseLRC:async()=>[{time:1,text:'local line'}],renderLyrics(){},window:{}};
 await Promise.race([runInNewContext(fn+';loadSongLyrics(song)',state),new Promise((_,reject)=>setTimeout(()=>reject(Error('local lyrics blocked by online service')),100))]);
 assert.equal(state.currentLyricsData[0].text,'local line');
});
