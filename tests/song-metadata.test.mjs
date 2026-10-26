import test from 'node:test';import assert from 'node:assert/strict';
import {mergeTrackMetadata} from '../scripts/song-metadata.js';
test('matching details complete artists while preserving local audio and lyric timing',()=>{
 const original={title:'Old',artist:'First',neteaseId:42,src:'local.mp3',lrc:'local.lrc',cover:'local.jpg'};
 const result=mergeTrackMetadata(original,{id:42,name:'Title',artists:[{name:'First'},{name:'Second'}],album:'Album',cover:'https://example.com/new.jpg',duration:123000,src:'untrusted.mp3'});
 assert.equal(result.title,'Title');assert.equal(result.artist,'First / Second');assert.equal(result.album,'Album');assert.equal(result.src,'local.mp3');assert.equal(result.lrc,'local.lrc');assert.equal(result.cover,'local.jpg');
 assert.deepEqual(mergeTrackMetadata(original,{id:99,name:'Wrong'}),original);
 assert.equal(mergeTrackMetadata(original,{id:42,name:'',artist:''}).title,'Old');
});
