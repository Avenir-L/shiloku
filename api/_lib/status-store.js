const KV_KEY = 'shiloku:live-status';

const LEGACY_STATUS_URLS = [
    'https://api.github.com/repos/Avenir-L/shiloku/contents/status.json?ref=main',
    'https://cdn.jsdelivr.net/gh/Avenir-L/shiloku@main/status.json',
    'https://raw.githubusercontent.com/Avenir-L/shiloku/main/status.json',
];

function hasKv() {
    return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function hasGist() {
    return Boolean(process.env.GITHUB_TOKEN && process.env.STATUS_GIST_ID);
}

async function kvCommand(command) {
    const base = process.env.KV_REST_API_URL.replace(/\/$/, '');
    const response = await fetch(base, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
    });
    if (!response.ok) return null;
    return response.json();
}

export async function readFromKv() {
    if (!hasKv()) return null;
    try {
        const data = await kvCommand(['GET', KV_KEY]);
        if (!data?.result) return null;
        const parsed = JSON.parse(data.result);
        if (parsed && (parsed.text || parsed.updatedAt)) return parsed;
    } catch { /* */ }
    return null;
}

export async function writeToKv(payload) {
    if (!hasKv()) return false;
    const data = await kvCommand(['SET', KV_KEY, JSON.stringify(payload)]);
    return data?.result === 'OK';
}

async function readFromGist() {
    if (!hasGist()) return null;
    try {
        const response = await fetch(`https://api.github.com/gists/${process.env.STATUS_GIST_ID}`, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                'User-Agent': 'shiloku-status',
            },
            cache: 'no-store',
        });
        if (!response.ok) return null;
        const gist = await response.json();
        const file = gist.files?.['status.json']?.content;
        if (!file) return null;
        const parsed = JSON.parse(file);
        if (parsed && (parsed.text || parsed.updatedAt)) return parsed;
    } catch { /* */ }
    return null;
}

export async function writeToGist(payload) {
    if (!hasGist()) return false;
    const response = await fetch(`https://api.github.com/gists/${process.env.STATUS_GIST_ID}`, {
        method: 'PATCH',
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'shiloku-status',
        },
        body: JSON.stringify({
            files: {
                'status.json': { content: JSON.stringify(payload) },
            },
        }),
    });
    return response.ok;
}

async function fetchLegacyUrl(url) {
    const headers = { Accept: 'application/json', 'User-Agent': 'shiloku-status-proxy' };
    if (url.includes('api.github.com')) {
        headers.Accept = 'application/vnd.github.raw+json';
    }
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && (data.text || data.updatedAt)) return data;
    return null;
}

export async function readFromLegacyRepo() {
    for (const url of LEGACY_STATUS_URLS) {
        try {
            const data = await fetchLegacyUrl(url);
            if (data) return data;
        } catch { /* */ }
    }
    return null;
}

export async function readStatus({ localFallback } = {}) {
    const kv = await readFromKv();
    if (kv) return kv;

    const gist = await readFromGist();
    if (gist) return gist;

    const legacy = await readFromLegacyRepo();
    if (legacy) return legacy;

    if (localFallback) {
        try {
            const { readFile } = await import('node:fs/promises');
            const { join } = await import('node:path');
            const raw = await readFile(join(process.cwd(), 'status.json'), 'utf8');
            return JSON.parse(raw);
        } catch { /* */ }
    }

    return { text: '在线摸鱼中', updatedAt: null, mode: 'online' };
}

export async function writeStatus(payload) {
    const results = [];
    if (hasKv()) results.push(await writeToKv(payload));
    if (hasGist()) results.push(await writeToGist(payload));
    return results.some(Boolean);
}

export function getStorageMode() {
    if (hasKv() && hasGist()) return 'kv+gist';
    if (hasKv()) return 'kv';
    if (hasGist()) return 'gist';
    return 'none';
}
