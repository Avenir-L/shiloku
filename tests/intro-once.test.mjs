import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
const script=html.match(/\(function initIntroSplash\(\) \{[\s\S]*?\}\)\(\);/)[0];
function visit(store=new Map(), blocked=false){
 const events={}, classes=new Set(['home-glass']); let removed=false,plays=0;
 const video={addEventListener:(n,f)=>events[n]=f,load(){},play(){plays++;return Promise.resolve()},pause(){},removeAttribute(){},paused:true};
 const splash={classList:{add() {},remove(){}},remove(){removed=true},addEventListener:(n,f)=>events[n]=f};
 const document={body:{classList:{contains:n=>classes.has(n),add:n=>classes.add(n),remove:n=>classes.delete(n)}},getElementById:n=>n==='intro-splash'?splash:video,dispatchEvent(){}};
 const localStorage={getItem:k=>{if(blocked)throw Error();return store.get(k)},setItem:(k,v)=>{if(blocked)throw Error();store.set(k,v)}};
 vm.runInNewContext(script,{document,localStorage,window:{matchMedia:()=>({matches:false})},setTimeout:()=>1,clearTimeout(){},Event:class{}});
 return {events,get removed(){return removed},get plays(){return plays},classes};
}
const store=new Map();const first=visit(store);assert.equal(first.plays,1,'first visit plays original video');first.events.ended();assert(first.classes.has('intro-done'));
const again=visit(store);assert.equal(again.plays,0,'return visit skips video');assert(again.removed);
const skippedStore=new Map();visit(skippedStore).events.click();assert.equal(visit(skippedStore).plays,0,'manual skip is remembered');
const privateVisit=visit(new Map(),true);assert.equal(privateVisit.plays,1);privateVisit.events.ended();assert(privateVisit.classes.has('intro-done'));
console.log('Intro first visit, repeat visit, manual skip and blocked storage passed.');
