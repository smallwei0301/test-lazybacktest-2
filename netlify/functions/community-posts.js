// 社群討論留言處理函式 (Netlify Function)
// Patch Tag: LB-FOOTER-UX-20250221A

import { getStore } from "@netlify/blobs"

const STORE_NAME = "community-discussions"
const STORE_KEY = "posts.json"
const MAX_POSTS = 200

const inMemoryStores = new Map()

function createMemoryBlobStore() {
  const memory = new Map()
  return {
    async get(key) {
      return memory.get(key) ?? null
    },
    async setJSON(key, value) {
      memory.set(key, value)
    },
  }
}

function obtainStore(name) {
  try {
    return getStore(name)
  } catch (error) {
    if (error?.name === "MissingBlobsEnvironmentError") {
      if (!inMemoryStores.has(name)) {
        console.warn("[CommunityPosts] 未設定 Netlify Blobs，改用記憶體模擬儲存。")
        inMemoryStores.set(name, createMemoryBlobStore())
      }
      return inMemoryStores.get(name)
    }
    throw error
  }
}

async function readPosts(store) {
  const raw = await store.get(STORE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch (error) {
    console.error("[CommunityPosts] 讀取留言時解析失敗", error)
  }
  return []
}

function sanitizeText(value, { maxLength }) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  }
}

export default async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(204, { ok: true })
  }

  const store = obtainStore(STORE_NAME)

  if (event.httpMethod === "GET") {
    const posts = await readPosts(store)
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return buildResponse(200, { ok: true, posts })
  }

  if (event.httpMethod === "POST") {
    if (!event.body) {
      return buildResponse(400, { ok: false, message: "請提供留言內容" })
    }

    let payload
    try {
      payload = JSON.parse(event.body)
    } catch (error) {
      return buildResponse(400, { ok: false, message: "留言格式有誤" })
    }

    const author = sanitizeText(payload.author, { maxLength: 40 }) || "匿名投資人"
    const message = sanitizeText(payload.message, { maxLength: 600 })
    if (!message) {
      return buildResponse(422, { ok: false, message: "留言內容不可為空" })
    }

    const now = Date.now()
    const post = {
      id: `post_${now}_${Math.random().toString(36).slice(2, 8)}`,
      author,
      message,
      createdAt: now,
    }

    const posts = await readPosts(store)
    posts.push(post)
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    const trimmed = posts.slice(0, MAX_POSTS)
    await store.setJSON(STORE_KEY, trimmed)

    return buildResponse(201, { ok: true, post })
  }

  return buildResponse(405, { ok: false, message: "不支援的操作" })
}
