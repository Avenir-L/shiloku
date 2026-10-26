import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptWeapi,createQrLoginImage} from '../api/_lib/netease/weapi.js';

test('NetEase encryption produces valid AES/RSA request payloads',()=>{
  const result=encryptWeapi({type:1});
  assert.match(result.params,/^[A-Za-z0-9+/]+=*$/);
  assert.equal(result.encSecKey.length,256);
});
test('NetEase QR URL is generated locally without a nonexistent upstream create endpoint',async()=>{
  assert.equal(await createQrLoginImage('key-test'),'https://music.163.com/login?codekey=key-test');
});
