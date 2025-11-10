// netlify/functions/community-posts.js (v0.1 - Community discussion board API)
// Patch Tag: LB-COMMUNITY-20250505A

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'community_posts_store';
const POSTS_KEY = 'posts.json';
const MAX_NAME_LENGTH = 40;
const MAX_CONTENT_LENGTH = 2000;
const ALLOWED_ORIGINS = [
    'https://lazybacktest.netlify.app',
    'https://test-lazybacktest.netlify.app',
];

const inMemoryStores = new Map();

function ensureStore(name) {
    try {
        return getStore(name);
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            if (!inMemoryStores.has(name)) {
                inMemoryStores.set(name, createMemoryStore());
            }
            return inMemoryStores.get(name);
        }
        throw error;
    }
}

function createMemoryStore() {
    const memory = new Map();
    return {
        async get(key, options = {}) {
            if (!memory.has(key)) return null;
            const value = memory.get(key);
            if (options.type === 'json') {
                try {
                    return JSON.parse(value);
                } catch (error) {
                    return null;
                }
            }
            return value;
        },
        async setJSON(key, value) {
            memory.set(key, JSON.stringify(value));
        },
    };
}

function buildCorsHeaders(origin) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,GET,POST',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    };

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Vary'] = 'Origin';
    }

    return headers;
}

function sanitizeText(input = '', maxLength) {
    const trimmed = String(input).trim();
    if (!trimmed) return '';
    return trimmed.slice(0, maxLength);
}

async function readPosts(store) {
    const existing = await store.get(POSTS_KEY, { type: 'json' });
    if (!existing || !Array.isArray(existing.items)) {
        return { items: [], lastUpdated: null };
    }
    return existing;
}

function buildResponse(statusCode, origin, payload) {
    return {
        statusCode,
        headers: buildCorsHeaders(origin),
        body: JSON.stringify(payload),
    };
}

export default async function handler(event) {
    const origin = event.headers?.origin;
    if (event.httpMethod === 'OPTIONS') {
        return buildResponse(200, origin, { ok: true });
    }

    const store = ensureStore(STORE_NAME);

    if (event.httpMethod === 'GET') {
        const data = await readPosts(store);
        return buildResponse(200, origin, {
            ok: true,
            items: data.items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
            lastUpdated: data.lastUpdated || null,
        });
    }

    if (event.httpMethod === 'POST') {
        if (!event.body) {
            return buildResponse(400, origin, { ok: false, message: '缺少資料內容' });
        }

        let payload;
        try {
            payload = JSON.parse(event.body);
        } catch (error) {
            return buildResponse(400, origin, { ok: false, message: '資料格式錯誤' });
        }

        const displayName = sanitizeText(payload.displayName, MAX_NAME_LENGTH);
        const message = sanitizeText(payload.message, MAX_CONTENT_LENGTH);

        if (!displayName) {
            return buildResponse(422, origin, { ok: false, message: '請留下暱稱，讓大家認識你。' });
        }

        if (!message) {
            return buildResponse(422, origin, { ok: false, message: '留言內容不可為空。' });
        }

        const now = Date.now();
        const newPost = {
            id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
            displayName,
            message,
            createdAt: now,
        };

        const existing = await readPosts(store);
        const updatedItems = [newPost, ...existing.items].slice(0, 200);

        await store.setJSON(POSTS_KEY, {
            items: updatedItems,
            lastUpdated: now,
        });

        return buildResponse(201, origin, {
            ok: true,
            item: newPost,
        });
    }

    return buildResponse(405, origin, { ok: false, message: 'Method Not Allowed' });
}
