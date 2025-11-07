// API Version: LB-FE-20250304A
import { NextResponse } from "next/server"
import { getStore } from "@netlify/blobs"

const STORE_NAME = "lazybacktest-community-posts"
const MAX_MESSAGE_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 60
const DEFAULT_AUTHOR = "匿名投資人"

async function readAllPosts() {
  const store = getStore(STORE_NAME)
  const posts: Array<{ id: string; author: string; message: string; createdAt: string }> = []
  const listResult = await store.list()

  for (const blob of listResult.blobs ?? []) {
    try {
      const item = await store.get(blob.key, { type: "json" })
      if (item && typeof item === "object" && "message" in item) {
        posts.push({
          id: blob.key,
          author: typeof item.author === "string" ? item.author : DEFAULT_AUTHOR,
          message: typeof item.message === "string" ? item.message : "",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        })
      }
    } catch (error) {
      console.warn("[CommunityPosts] Failed to load", blob.key, error)
    }
  }

  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return posts
}

export async function GET() {
  try {
    const posts = await readAllPosts()
    return NextResponse.json({ posts }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[CommunityPosts] GET failed", error)
    return NextResponse.json({ error: "無法載入留言，請稍後再試" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const rawAuthor = typeof payload.author === "string" ? payload.author.trim() : ""
    const rawMessage = typeof payload.message === "string" ? payload.message.trim() : ""

    if (!rawMessage) {
      return NextResponse.json({ error: "請輸入留言內容" }, { status: 400 })
    }

    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "留言內容超過 1000 字上限" }, { status: 400 })
    }

    if (rawAuthor.length > MAX_AUTHOR_LENGTH) {
      return NextResponse.json({ error: "暱稱最多 60 個字" }, { status: 400 })
    }

    const author = rawAuthor || DEFAULT_AUTHOR
    const createdAt = new Date().toISOString()
    const store = getStore(STORE_NAME)
    const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const record = { author, message: rawMessage, createdAt }
    await store.setJSON(id, record)

    return NextResponse.json({ post: { id, ...record } }, { status: 201 })
  } catch (error) {
    console.error("[CommunityPosts] POST failed", error)
    return NextResponse.json({ error: "留言送出失敗，請稍後再試" }, { status: 500 })
  }
}
