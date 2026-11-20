import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
test('all eight local tracks have complete metadata and packaged audio, lyrics and covers',async()=>{
 const songs=JSON.parse(await readFile(new URL('../music/playlist.json',import.meta.url),'utf8'));
 assert.equal(songs.length,8);
 assert.deepEqual(Array.from(songs,s=>s.title),['End of Beginning','more than words','Do You Feel It?','mede:mede','Hypnotized','夕日坂','Beautiful World','Listen']);
 for(const song of songs){assert.ok(song.title&&song.artist&&song.album);assert.ok(song.duration>0);for(const path of [song.src,song.lrc,song.cover])await access(new URL('../'+path,import.meta.url));}
 const added=songs.find(s=>s.title==='End of Beginning');assert.equal(added.artist,'Djo');assert.equal(added.album,'DECIDE');assert.equal(added.neteaseId,1966970103);
});
test('local timed lyrics render without waiting for online enrichment',async()=>{
 const source=await readFile(new URL('../adapters/navigation-prototype.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function readTrackLyrics('),source.indexOf('let roomVersion'));
 const state={fetch:async url=>{assert.equal(url,'test.lrc');return {text:async()=>'test lyric'};},parseLRCText:()=>[{time:1,text:'local line',trans:'translation'}]};
 const result=await runInNewContext(fn+";readTrackLyrics('test.lrc')",state);
 assert.match(result.lyric,/local line/);assert.match(result.tlyric,/translation/);
});
