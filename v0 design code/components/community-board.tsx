'use client'
// Version: LB-COMMUNITY-20250823A
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface CommunityPost {
  id: string
  author: string
  content: string
  createdAt: string
  strategyFocus?: string | null
}

const API_ENDPOINT = "/.netlify/functions/community-posts"

export function CommunityBoard() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [author, setAuthor] = useState("")
  const [strategyFocus, setStrategyFocus] = useState("")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchPosts() {
      try {
        const response = await fetch(API_ENDPOINT, {
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) {
          throw new Error(`無法載入留言 (${response.status})`)
        }
        const payload = await response.json()
        if (Array.isArray(payload.posts)) {
          setPosts(payload.posts)
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "載入留言時發生錯誤")
        }
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
    return () => controller.abort()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const trimmedAuthor = author.trim() || "匿名用戶"
    const trimmedContent = content.trim()
    const trimmedFocus = strategyFocus.trim()

    if (trimmedContent.length < 10) {
      setError("留言至少需要 10 個字，請補充策略或問題的細節。")
      return
    }

    if (trimmedContent.length > 800) {
      setError("留言超過 800 字，請精簡內容或分段發文。")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: trimmedAuthor,
          content: trimmedContent,
          strategyFocus: trimmedFocus || null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.message || `送出留言失敗 (${response.status})`)
      }

      const payload = await response.json()
      if (Array.isArray(payload.posts)) {
        setPosts(payload.posts)
      }
      setAuthor("")
      setStrategyFocus("")
      setContent("")
      setSuccessMessage("留言已送出，稍後重新整理即可再次查看。")
    } catch (err: unknown) {
      setError((err as Error).message || "送出留言失敗，請稍後再試")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">發表留言</CardTitle>
          <p className="text-sm text-muted-foreground">
            分享您使用 LazyBacktest 的心得、策略設定或遇到的問題。避免張貼個資與具體報價，所有留言會公開顯示給所有使用者。
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="author">暱稱</Label>
              <Input
                id="author"
                placeholder="可留空，預設顯示為匿名用戶"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strategyFocus">討論焦點（選填）</Label>
              <Input
                id="strategyFocus"
                placeholder="例如：0050 定期定額、融資停損策略"
                value={strategyFocus}
                onChange={(event) => setStrategyFocus(event.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">留言內容</Label>
              <Textarea
                id="content"
                rows={6}
                placeholder="描述您測試的設定、觀察到的結果或想一起討論的問題。"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={800}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">至少 10 字，最多 800 字。</p>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {successMessage ? <p className="text-sm text-primary">{successMessage}</p> : null}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>送出後內容將公開展示，若需修改請重新留言。</span>
              <Button type="submit" disabled={submitting}>
                {submitting ? "送出中..." : "送出留言"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-2xl text-foreground">最新討論</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-border/60">公開留言</Badge>
            <Badge variant="outline" className="border-border/60">雲端儲存</Badge>
            <Badge variant="outline" className="border-border/60">更新即時</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">載入留言中...</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前還沒有留言，歡迎成為第一位分享使用心得的投資人！</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{post.author}</span>
                    <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("zh-TW")}</time>
                  </div>
                  {post.strategyFocus ? (
                    <p className="mt-2 text-xs text-primary"># {post.strategyFocus}</p>
                  ) : null}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{post.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
