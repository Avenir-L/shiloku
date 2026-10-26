import test from 'node:test';import assert from 'node:assert/strict';
import {createMusicLimiter} from '../api/_lib/netease/rate.js';
test('music quota is shared, expires, and checks both IP and global budgets',async()=>{
 const calls=[];const store={command:async args=>{calls.push(args);return 0}};
 const limiter=createMusicLimiter({store,env:{VERCEL:'1'},now:()=>120000});
 await assert.rejects(()=>limiter({headers:{'x-vercel-forwarded-for':'192.0.2.1'}},'playable'),e=>e.status===429);
 const args=calls[0];assert.equal(args[0],'EVAL');assert.ok(args[1].includes("EXPIRE"));assert.ok(args[1].includes('global'));
 assert.equal(JSON.stringify(args).includes('192.0.2.1'),false);
});
test('production quota failures fail closed',async()=>{
 const limiter=createMusicLimiter({store:{command:async()=>{throw Error('private storage detail')}},env:{VERCEL:'1'}});
 await assert.rejects(()=>limiter({headers:{}},'audio'),e=>e.status===503&&!e.message.includes('private'));
});
