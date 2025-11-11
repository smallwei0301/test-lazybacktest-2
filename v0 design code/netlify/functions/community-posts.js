// Version: LB-COMMUNITY-20250825A
import { getStore } from '@netlify/blobs'

const STORE_NAME = 'community_posts_store_v1'
const POSTS_KEY = 'posts.json'
const VERSION = 'LB-COMMUNITY-20250825A'
const MAX_POSTS = 200

const memoryStores = new Map()

function obtainStore(name) {
  try {
    return getStore(name)
  } catch (error) {
    if (error?.name === 'MissingBlobsEnvironmentError') {
      if (!memoryStores.has(name)) {
        memoryStores.set(name, createMemoryStore())
      }
      return memoryStores.get(name)
    }
    throw error
  }
}

function createMemoryStore() {
  const map = new Map()
  return {
    async get(key, options = {}) {
      if (options?.type === 'json') {
        return map.get(key) ?? null
      }
      return map.get(key) ?? null
    },
    async setJSON(key, value) {
      map.set(key, value)
    },
  }
}

async function readPosts(store) {
  try {
    const stored = await store.get(POSTS_KEY, { type: 'json' })
    if (!stored || typeof stored !== 'object') {
      return { posts: [], updatedAt: null }
    }
    const posts = Array.isArray(stored.posts) ? stored.posts : []
    return {
      posts,
      updatedAt: stored.updatedAt ?? null,
    }
  } catch (error) {
    console.error('[CommunityPosts] 讀取資料失敗:', error)
    return { posts: [], updatedAt: null }
  }
}

async function writePosts(store, posts) {
  try {
    await store.setJSON(POSTS_KEY, { posts, updatedAt: new Date().toISOString(), version: VERSION })
  } catch (error) {
    console.error('[CommunityPosts] 儲存資料失敗:', error)
  }
}

function sanitizeText(value, { defaultValue = '' } = {}) {
  if (typeof value !== 'string') return defaultValue
  return value.trim()
}

function buildResponse({ statusCode = 200, body = {} }) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
      },
    }
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return buildResponse({ statusCode: 405, body: { status: 'error', message: 'Method Not Allowed' } })
  }

  const store = obtainStore(STORE_NAME)
  const isMemoryStore = memoryStores.get(STORE_NAME) === store

  if (event.httpMethod === 'GET') {
    const { posts, updatedAt } = await readPosts(store)
    return buildResponse({
      body: {
        status: 'ok',
        version: VERSION,
        posts,
        count: posts.length,
        updatedAt,
        store: isMemoryStore ? 'memory' : 'blob',
      },
    })
  }

  let payload
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch (error) {
    return buildResponse({ statusCode: 400, body: { status: 'error', message: 'Invalid JSON payload' } })
  }

  const author = sanitizeText(payload.author, { defaultValue: '匿名用戶' })
  const content = sanitizeText(payload.content)
  const strategyFocus = sanitizeText(payload.strategyFocus || '') || null

  if (!content || content.length < 10) {
    return buildResponse({ statusCode: 400, body: { status: 'error', message: '留言至少需要 10 個字。' } })
  }

  if (content.length > 800) {
    return buildResponse({ statusCode: 400, body: { status: 'error', message: '留言不得超過 800 字。' } })
  }

  const { posts } = await readPosts(store)
  const newPost = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `post_${Date.now()}`,
    author: author.slice(0, 40),
    content: content.slice(0, 800),
    strategyFocus: strategyFocus ? strategyFocus.slice(0, 80) : null,
    createdAt: new Date().toISOString(),
  }

  const updatedPosts = [newPost, ...posts].slice(0, MAX_POSTS)
  await writePosts(store, updatedPosts)

  return buildResponse({
    statusCode: 201,
    body: {
      status: 'ok',
      version: VERSION,
      posts: updatedPosts,
      count: updatedPosts.length,
      store: isMemoryStore ? 'memory' : 'blob',
    },
  })
}
