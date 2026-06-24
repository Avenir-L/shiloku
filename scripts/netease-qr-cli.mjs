import { checkQrLogin, createQrLoginSession, refreshLoginCookie } from '../api/_lib/netease/weapi.js';

const [, , action, ...rest] = process.argv;

async function main() {
  if (action === 'create') {
    console.log(JSON.stringify(await createQrLoginSession()));
    return;
  }
  if (action === 'check') {
    const key = rest[0] || '';
    const result = await checkQrLogin(key);
    console.log(JSON.stringify(result));
    return;
  }
  if (action === 'refresh') {
    const cookie = rest.join(' ').trim();
    const result = await refreshLoginCookie(cookie);
    console.log(JSON.stringify(result));
    return;
  }
  console.error(JSON.stringify({ error: '用法: create | check <key> | refresh <cookie>' }));
  process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error?.message || String(error) }));
  process.exit(1);
});
