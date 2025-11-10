// netlify/functions/community-posts.js (v0.1)
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'crypto';

const STORE_NAME = 'community-posts';
const COLLECTION_KEY = 'posts';
const MAX_POSTS = 200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
    body: JSON.stringify(body),
  };
}

export default async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
    };
  }

  const store = getStore({ name: STORE_NAME });

  if (event.httpMethod === 'GET') {
    try {
      const blob = await store.get(COLLECTION_KEY, { type: 'json' });
      const posts = Array.isArray(blob?.posts) ? blob.posts : [];
      posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return jsonResponse(200, { posts });
    } catch (error) {
      console.error('Failed to load community posts', error);
      return jsonResponse(500, { error: '無法載入留言，請稍後再試。' });
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const author = typeof body.author === 'string' ? body.author.trim() : '';
      const content = typeof body.content === 'string' ? body.content.trim() : '';

      if (!author || !content) {
        return jsonResponse(400, { error: '請提供顯示名稱與留言內容。' });
      }

      if (author.length > 40 || content.length > 600) {
        return jsonResponse(400, { error: '顯示名稱或留言內容超過長度限制。' });
      }

      const now = new Date().toISOString();
      const newPost = {
        id: randomUUID(),
        author,
        content,
        createdAt: now,
      };

      const existing = await store.get(COLLECTION_KEY, { type: 'json' });
      const posts = Array.isArray(existing?.posts) ? existing.posts : [];

      posts.unshift(newPost);
      const trimmed = posts.slice(0, MAX_POSTS);

      await store.setJSON(COLLECTION_KEY, { posts: trimmed });

      return jsonResponse(201, { post: newPost });
    } catch (error) {
      console.error('Failed to save community post', error);
      return jsonResponse(500, { error: '留言送出失敗，請稍後再試。' });
    }
  }

  return jsonResponse(405, { error: 'Method Not Allowed' });
}
