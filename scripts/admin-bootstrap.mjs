import {randomBytes} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {redis,AUTH_PREFIX as P} from '../api/_lib/admin/store.js';
import {hash,expectedOrigin} from '../api/_lib/admin/auth.js';

// Run locally with server-only environment variables. Never deploy this script as a route.
if(!process.env.ADMIN_ENCRYPTION_KEY || Buffer.from(process.env.ADMIN_ENCRYPTION_KEY,'base64').length!==32) throw new Error('先配置 32 字节 base64 ADMIN_ENCRYPTION_KEY，并离线备份。');
if(await redis.command(['GET',P+'owner'])) throw new Error('站长已登记，初始化入口已关闭。请使用已有通行密钥或恢复码。');
const token=randomBytes(32).toString('base64url');
const result=await redis.command(['SET',P+'bootstrap',hash(token),'EX',1800,'NX']);
if(!result) throw new Error('已有有效初始化凭证，请使用现有文件或等待其过期。');
await mkdir('.scratch/admin',{recursive:true});
await writeFile('.scratch/admin/owner-setup.txt',`仅限站长，30 分钟内使用。不要分享。\n${expectedOrigin()}/admin/#setup=${token}\n`,{mode:0o600});
console.log('初始化地址已写入本机 .scratch/admin/owner-setup.txt。完成登记后该凭证失效。');
