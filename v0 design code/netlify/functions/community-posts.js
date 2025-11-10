// netlify/functions/community-posts.js
// Patch Tag: LB-COMMUNITY-20250409A

import { getStore } from '@netlify/blobs';
import { randomUUID } from 'crypto';

const STORE_NAME = 'lazybacktest-community-posts';
const BLOB_KEY = 'posts.json';
const inMemoryStores = new Map();

function createMemoryStore() {
    const memory = new Map();
    return {
        async get(key) {
            return memory.get(key) || null;
        },
        async setJSON(key, value) {
            memory.set(key, { data: value, timestamp: Date.now() });
        },
    };
}

function resolveStore() {
    try {
        return getStore(STORE_NAME);
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            if (!inMemoryStores.has(STORE_NAME)) {
                console.warn('[CommunityPosts] Netlify Blobs 未啟用，使用記憶體儲存模擬。');
                inMemoryStores.set(STORE_NAME, createMemoryStore());
            }
            return inMemoryStores.get(STORE_NAME);
        }
        throw error;
    }
}

async function readPosts(store) {
    try {
        const record = await store.get(BLOB_KEY, { type: 'json' });
        const data = record?.data?.posts ?? record?.data ?? [];
        return Array.isArray(data) ? data : [];
    } catch (error) {
        if (error?.status === 404) {
            return [];
        }
        console.warn('[CommunityPosts] 讀取留言失敗', error);
        return [];
    }
}

async function writePosts(store, posts) {
    await store.setJSON(BLOB_KEY, { posts, updatedAt: Date.now() });
}

function buildResponse(statusCode, payload) {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
    };
}

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return buildResponse(204, {});
    }

    const store = resolveStore();

    if (event.httpMethod === 'GET') {
        const posts = await readPosts(store);
        return buildResponse(200, { posts });
    }

    if (event.httpMethod === 'POST') {
        let payload;
        try {
            payload = JSON.parse(event.body || '{}');
        } catch (error) {
            return buildResponse(400, { error: '請提供正確的 JSON 格式。' });
        }

        const displayName = String(payload.displayName || '').trim();
        const message = String(payload.message || '').trim();

        if (!displayName || !message) {
            return buildResponse(400, { error: '請填寫暱稱與留言內容。' });
        }

        if (displayName.length > 50) {
            return buildResponse(400, { error: '暱稱長度請在 50 字以內。' });
        }

        if (message.length > 1000) {
            return buildResponse(400, { error: '留言內容請在 1000 字以內。' });
        }

        const posts = await readPosts(store);
        const newPost = {
            id: randomUUID(),
            displayName,
            message,
            createdAt: new Date().toISOString(),
        };

        const updatedPosts = [newPost, ...posts].slice(0, 200);
        try {
            await writePosts(store, updatedPosts);
        } catch (error) {
            console.error('[CommunityPosts] 寫入留言失敗', error);
            return buildResponse(500, { error: '留言儲存失敗，請稍後再試。' });
        }

        return buildResponse(201, { posts: updatedPosts });
    }

    return buildResponse(405, { error: 'Method Not Allowed' });
};
