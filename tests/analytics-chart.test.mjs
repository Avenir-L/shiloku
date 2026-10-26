import test from 'node:test';
import assert from 'node:assert/strict';
import {chartModel} from '../admin/analytics-chart.js';
test('trend axes show zero baseline, bounded readable PV ticks, and dated endpoints',()=>{
 const days=Array.from({length:30},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,pv:i*3}));
 const model=chartModel(days);
 assert.equal(model.yTicks[0].value,0);assert.ok(model.yTicks.at(-1).value>=87);
 assert.ok(model.xTicks.length<=7);assert.equal(model.xTicks[0].date,'2026-10-01');assert.equal(model.xTicks.at(-1).date,'2026-10-30');
 assert.ok(model.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y>=model.top&&p.y<=model.bottom));
});
test('single-day and all-zero series retain valid axes without decimal visit counts',()=>{
 for(const days of [[{date:'2026-10-26',pv:0}],[{date:'2026-10-25',pv:1},{date:'2026-10-26',pv:0}]]){
  const m=chartModel(days);assert.ok(m.yTicks.every(t=>Number.isInteger(t.value)));assert.ok(m.yTicks.at(-1).value>0);assert.ok(m.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
});
