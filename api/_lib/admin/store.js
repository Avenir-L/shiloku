export const AUTH_PREFIX = 'shiloku:admin:v1:';
export const MUSIC_KEY = 'shiloku:music:v1:account';

export const redis = {
  async command(args) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('管理存储尚未配置');
    const response = await fetch(url.replace(/\/$/, ''), {
      method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify(args), signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('管理存储暂时不可用');
    const data=await response.json();
    if (data.error || !Object.hasOwn(data,'result')) throw new Error('管理存储操作失败');
    return data.result;
  },
};

export async function readJson(store, key) {
  const raw=await store.command(['GET',key]);
  return raw ? JSON.parse(raw) : null;
}
