import fs from 'fs';
import path from 'path';
import os from 'os';

const MAX_MESSAGES = 80;
const MAX_LEN = 280;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const TMP_STORE = path.join(os.tmpdir(), 'shiloku-guestbook.json');

/** @type {Map<string, number[]>} */
const rateBuckets = new Map();

function cors(req, res) {
    const origin = req.headers.origin || '';
    const allowLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
    const allowProd = /^https:\/\/(www\.)?(shiloku\.cn|shiloku\.vercel\.app)$/i.test(origin);
    if (allowLocal || allowProd || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

function readStaticStore() {
    const filePath = path.join(process.cwd(), 'guestbook.json');
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data.messages) ? data.messages : [];
    } catch {
        return [];
    }
}

function readTmpStore() {
    try {
        if (!fs.existsSync(TMP_STORE)) return [];
        const raw = fs.readFileSync(TMP_STORE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data.messages) ? data.messages : [];
    } catch {
        return [];
    }
}

function readStore() {
    const merged = [...readTmpStore()];
    const ids = new Set(merged.map((m) => m.id));
    readStaticStore().forEach((m) => {
        if (!ids.has(m.id)) merged.push(m);
    });
    merged.sort((a, b) => (b.time || 0) - (a.time || 0));
    return merged.slice(0, MAX_MESSAGES);
}

function writeStore(messages) {
    fs.writeFileSync(TMP_STORE, JSON.stringify({ messages: messages.slice(0, MAX_MESSAGES) }, null, 2), 'utf8');
}

function clientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
}

function rateLimit(ip) {
    const now = Date.now();
    const bucket = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (bucket.length >= RATE_MAX) return false;
    bucket.push(now);
    rateBuckets.set(ip, bucket);
    return true;
}

function sanitize(str, max) {
    return String(str || '').trim().slice(0, max).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

export default async function handler(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method === 'GET') {
        const messages = readStore();
        return res.status(200).json({ messages: messages.slice(0, MAX_MESSAGES) });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: '只允许 GET / POST' });
    }

    const ip = clientIp(req);
    if (!rateLimit(ip)) {
        return res.status(429).json({ error: '发送太频繁，请稍后再试' });
    }

    const name = sanitize(req.body?.name, 32) || '访客';
    const message = sanitize(req.body?.message, MAX_LEN);
    if (!message || message.length < 2) {
        return res.status(400).json({ error: '留言太短了' });
    }

    const entry = {
        id: `gb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        message,
        time: Date.now(),
    };

    try {
        const messages = readStore();
        messages.unshift(entry);
        writeStore(messages.slice(0, MAX_MESSAGES));
        return res.status(200).json({ ok: true, message: entry });
    } catch {
        return res.status(200).json({ ok: true, message: entry, localOnly: true });
    }
}
