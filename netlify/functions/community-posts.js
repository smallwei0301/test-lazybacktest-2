// netlify/functions/community-posts.js
// Patch Tag: LB-COMMUNITY-POSTS-20250218A

import { getStore } from '@netlify/blobs';
import crypto from 'crypto';

const STORE_NAME = 'lazybacktest-community-posts';
const STORE_KEY = 'posts.json';
const MAX_POSTS = 200;
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const inMemoryStores = new Map();

function createMemoryBlobStore() {
  const memory = new Map();
  return {
    async get(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    async setJSON(key, value) {
      memory.set(key, value);
    },
  };
}

function obtainStore(name) {
  try {
    return getStore(name);
  } catch (error) {
    if (error?.name === 'MissingBlobsEnvironmentError') {
      if (!inMemoryStores.has(name)) {
        console.warn('[Community Posts] Netlify Blobs 未配置，使用記憶體暫存。');
        inMemoryStores.set(name, createMemoryBlobStore());
      }
      return inMemoryStores.get(name);
    }
    throw error;
  }
}

function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim();
}

function createId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `post-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildResponse(statusCode, payload = {}) {
  const headers = { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' };
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

async function loadPosts(store) {
  const data = await store.get(STORE_KEY, { type: 'json' });
  if (data && Array.isArray(data.posts)) {
    return data.posts;
  }
  return [];
}

async function savePosts(store, posts) {
  await store.setJSON(STORE_KEY, {
    updatedAt: new Date().toISOString(),
    posts,
  });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: HEADERS,
      body: '',
    };
  }

  const store = obtainStore(STORE_NAME);

  if (event.httpMethod === 'GET') {
    try {
      const posts = await loadPosts(store);
      posts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return buildResponse(200, { posts });
    } catch (error) {
      console.error('[Community Posts] 讀取貼文失敗', error);
      return buildResponse(500, { error: '讀取貼文失敗，請稍後再試。' });
    }
  }

  if (event.httpMethod === 'POST') {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (error) {
      return buildResponse(400, { error: '請提供正確的 JSON 格式。' });
    }

    const author = normalizeText(payload.author);
    const content = (payload.content || '').toString().replace(/\s+$/g, '').trim();

    if (!author || author.length > 20) {
      return buildResponse(400, { error: '暱稱需介於 1 至 20 個字之間。' });
    }

    if (!content || content.length > 500) {
      return buildResponse(400, { error: '內容需介於 1 至 500 個字之間。' });
    }

    try {
      const posts = await loadPosts(store);
      const newPost = {
        id: createId(),
        author,
        content,
        createdAt: new Date().toISOString(),
      };
      const nextPosts = [newPost, ...posts].slice(0, MAX_POSTS);
      await savePosts(store, nextPosts);
      return buildResponse(201, { post: newPost });
    } catch (error) {
      console.error('[Community Posts] 儲存貼文失敗', error);
      return buildResponse(500, { error: '儲存貼文失敗，請稍後再試。' });
    }
  }

  return buildResponse(405, { error: '不支援的請求方法。' });
}
