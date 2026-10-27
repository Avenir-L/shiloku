import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('passkey sign-in is reachable before authentication, not inside the hidden dashboard',async()=>{
 const html=await readFile(new URL('../admin/index.html',import.meta.url),'utf8');
 const split=html.indexOf('id="dashboard"'),login=html.slice(0,split),dashboard=html.slice(split);
 assert.match(login,/<button[^>]*id="sign-in"/);assert.ok(login.includes('使用通行密钥登录'));assert.ok(!dashboard.includes('id="sign-in"'));
 assert.equal((html.match(/id="sign-in"/g)||[]).length,1);
});
