"use client"

// Component Version: LB-FE-20250304A

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, MessageCircle } from "lucide-react"

interface CommunityPost {
  id: string
  author: string
  message: string
  createdAt: string
}

export function CommunityBoard() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [author, setAuthor] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadPosts = useCallback(
    async (showSkeleton: boolean, signal?: AbortSignal) => {
      if (showSkeleton) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const response = await fetch("/api/community-posts", { cache: "no-store", signal })
        if (!response.ok) {
          throw new Error("載入留言失敗")
        }
        const data = await response.json()
        if (Array.isArray(data.posts)) {
          setPosts(data.posts)
          setError(null)
        }
      } catch (fetchError: any) {
        if (fetchError?.name === "AbortError") {
          return
        }
        console.error(fetchError)
        setError("目前無法載入留言，請稍後重新整理。")
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    const controller = new AbortController()
    loadPosts(true, controller.signal)
    return () => controller.abort()
  }, [loadPosts])

  async function refreshPosts() {
    setError(null)
    await loadPosts(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setError("留言內容不可為空白")
      return
    }

    if (trimmedMessage.length > 1000) {
      setError("留言內容超過 1000 字，上限是 1000 字喔！")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/community-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim(), message: trimmedMessage }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "留言送出失敗" }))
        throw new Error(data.error ?? "留言送出失敗")
      }

      const data = await response.json()
      if (data.post) {
        setPosts((prev) => [data.post as CommunityPost, ...prev])
      }

      setAuthor("")
      setMessage("")
      setSuccess("成功送出！所有使用者都能在雲端看到你的分享。")
    } catch (submitError: any) {
      setError(submitError.message ?? "留言送出失敗，請稍後再試。")
    } finally {
      setIsSubmitting(false)
      setTimeout(() => {
        setSuccess(null)
      }, 4000)
    }
  }

  return (
    <div className="space-y-10">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MessageCircle className="h-6 w-6 text-primary" />
            分享你的回測心得
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            在這裡留下你的策略想法、回測心得或是使用上的問題。留言會即時儲存在 Netlify Blobs 雲端，所有使用者都能看到最新討論。
            若想得到官方回覆，別忘了也到 <a href="/contact" className="underline text-primary">寄信給我</a> 留下你的信箱。
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="author">
                暱稱（選填）
              </label>
              <Input
                id="author"
                value={author}
                maxLength={60}
                placeholder="例：波段小資族"
                onChange={(event) => setAuthor(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                提醒：留下暱稱方便大家識別；若留空則會顯示為「匿名投資人」。
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="message">
                想分享的內容
              </label>
              <Textarea
                id="message"
                value={message}
                minLength={5}
                maxLength={1000}
                rows={5}
                placeholder="分享你如何設定策略、遇到的困惑，或是想合作的想法。"
                onChange={(event) => setMessage(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                小提醒：公開留言會顯示給所有讀者，請避免填入個資或帳號密碼，若需要私下聯絡請改用寄信。
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-primary/40">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">
                送出後約需 1 秒同步到雲端。
              </span>
              <Button type="submit" disabled={isSubmitting} className="min-w-[130px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isSubmitting ? "送出中" : "送出留言"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">最新留言</h2>
          <Button variant="outline" size="sm" onClick={() => refreshPosts()} disabled={isRefreshing}>
            {isRefreshing ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                重新整理中
              </span>
            ) : (
              "重新整理"
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在同步雲端留言...
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              目前還沒有留言，搶先分享你的第一篇吧！
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{post.author}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleString("zh-TW", { hour12: false })}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{post.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default CommunityBoard
