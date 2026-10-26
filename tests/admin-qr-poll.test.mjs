import test from 'node:test';import assert from 'node:assert/strict';
import {qrRetryDelay} from '../admin/qr-poll.js';
test('QR polling retries transient server failures with bounded backoff, never auth failures',()=>{
 assert.equal(qrRetryDelay({status:502},1),3000);assert.equal(qrRetryDelay({status:503},2),6000);assert.equal(qrRetryDelay({status:504},3),12000);assert.equal(qrRetryDelay({status:502},4),null);
 for(const status of [400,401,403,422,429])assert.equal(qrRetryDelay({status},1),null);
});
