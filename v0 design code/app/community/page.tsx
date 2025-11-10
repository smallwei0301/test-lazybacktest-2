"use client"

// Patch Tag: LB-WEB-20250210A
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SiteFooter } from "@/components/site-footer"
import { Loader2, MessageCircle, Users, RefreshCw, Send, Clock } from "lucide-react"

const COMMUNITY_API = process.env.NEXT_PUBLIC_COMMUNITY_API ?? "/.netlify/functions/community-posts"

interface CommunityPost {
  id: string
  displayName: string
  message: string
  createdAt: number
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [displayName, setDisplayName] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState<string>("")

  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(COMMUNITY_API, { headers: { "Cache-Control": "no-store" } })
      if (!response.ok) {
        throw new Error("無法載入最新留言，請稍後再試。")
      }
      const data = await response.json()
      setPosts(Array.isArray(data.items) ? data.items : [])
      setStatus("idle")
      setStatusMessage("")
    } catch (error) {
      console.error("Failed to load posts", error)
      setStatus("error")
      setStatusMessage("讀取留言失敗，請檢查網路或稍後重試。")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  useEffect(() => {
    if (status !== "idle" && statusMessage) {
      const timer = setTimeout(() => {
        setStatus("idle")
        setStatusMessage("")
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [status, statusMessage])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!displayName.trim() || !message.trim()) {
      setStatus("error")
      setStatusMessage("請輸入暱稱與留言內容。")
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch(COMMUNITY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), message: message.trim() }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || "留言送出失敗，請稍後再試。")
      }

      const payload = await response.json()
      if (payload?.item) {
        setPosts((prev) => [payload.item as CommunityPost, ...prev])
      } else {
        fetchPosts()
      }

      setDisplayName("")
      setMessage("")
      setStatus("success")
      setStatusMessage("留言已送出！感謝分享你的觀點。")
    } catch (error) {
      console.error("Failed to submit post", error)
      setStatus("error")
      setStatusMessage(error instanceof Error ? error.message : "留言送出失敗，請稍後再試。")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formattedPosts = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    return posts.map((post) => ({
      ...post,
      createdLabel: formatter.format(new Date(post.createdAt ?? Date.now())),
    }))
  }, [posts])

  return (
    <div className="bg-background text-foreground">
      <header className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl space-y-6">
            <Badge variant="secondary" className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              社群討論區
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              分享策略靈感、提問遇到的問題，彼此一起進步
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              所有留言都會儲存在 Netlify Blobs 雲端儲存中，登入任何裝置都能看到最新討論。請秉持互相尊重的原則，共建友善社群。
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <MessageCircle className="h-6 w-6 text-primary" />
                發表新話題
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="displayName" className="text-sm font-medium text-muted-foreground">
                    暱稱
                  </label>
                  <Input
                    id="displayName"
                    placeholder="讓大家知道你是誰"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium text-muted-foreground">
                    想說的內容
                  </label>
                  <Textarea
                    id="message"
                    placeholder="分享回測心得、提問策略疑惑或提供功能建議。"
                    rows={6}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={2000}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {message.length}/2000 字
                  </div>
                </div>

                {status !== "idle" && statusMessage && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      status === "success"
                        ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {statusMessage}
                  </div>
                )}

                <div className="flex flex-wrap gap-4 items-center">
                  <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSubmitting ? "送出中..." : "送出留言"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fetchPosts}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    重新整理
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-primary/30 bg-primary/5">
            <CardContent className="p-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
              <h2 className="text-xl font-semibold text-foreground">社群守則</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>分享策略時，記得描述回測條件與時間區間，方便其他人複製測試。</li>
                <li>避免張貼個資或未經授權的付費內容，違者將被移除留言。</li>
                <li>
                  技術新手可先閱讀
                  <Link href="/tutorial" className="underline underline-offset-4 mx-1">使用教學</Link>
                  和
                  <Link href="/faq" className="underline underline-offset-4 ml-1">常見問題</Link>
                  ，問答品質會更好。
                </li>
                <li>
                  若發現 bug，除了留言外，也歡迎同步在
                  <Link href="/contact" className="underline underline-offset-4 mx-1">寄信給我</Link>
                  追蹤處理進度。
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">最新留言</h2>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {isLoading ? "讀取中..." : `共 ${posts.length} 則留言`}
            </div>
          </div>

          {isLoading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> 讀取留言中...
            </div>
          ) : posts.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="p-8 text-center text-muted-foreground">
                <p>還沒有任何留言，搶先分享你的第一個觀察吧！</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {formattedPosts.map((post) => (
                <Card key={post.id} className="border-border/60">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">{post.displayName}</span>
                      <span className="text-xs text-muted-foreground">{post.createdLabel}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line leading-relaxed text-muted-foreground">{post.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="bg-muted/30 border border-border/60 rounded-3xl p-8 space-y-4 text-center">
          <h2 className="text-2xl font-semibold">需要更多資源？</h2>
          <p className="text-muted-foreground">
            看完討論後，別忘了回到
            <Link href="/backtest" className="underline underline-offset-4 mx-1">回測頁面</Link>
            測試新點子，並將結果記錄在
            <Link href="/stock-records" className="underline underline-offset-4 mx-1">股票紀錄</Link>
            方便追蹤。
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
