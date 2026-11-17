import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestGuard,createSingleFlight} from '../api/_lib/request-guard.js';
const req=ip=>({headers:{},socket:{remoteAddress:ip}});
test('rejected requests need no database and buckets recover',()=>{let now=0;const guard=createRequestGuard({now:()=>now,perIp:2,total:4});assert.equal(guard(req('a')),true);assert.equal(guard(req('a')),true);assert.equal(guard(req('a')),false);assert.equal(guard(req('b')),true);now=60001;assert.equal(guard(req('a')),true)});
test('single flight coalesces concurrent reads and never retains failures',async()=>{const run=createSingleFlight();let calls=0,release;const load=()=>{calls++;return new Promise(r=>release=r)};const a=run('x',load),b=run('x',load);await Promise.resolve();assert.equal(calls,1);release(42);assert.deepEqual(await Promise.all([a,b]),[42,42]);await assert.rejects(run('bad',()=>Promise.reject(Error('offline'))));assert.equal(await run('bad',()=>7),7)});
