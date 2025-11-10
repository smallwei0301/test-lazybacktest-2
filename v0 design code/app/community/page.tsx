"use client"

// Patch Tag: LB-COMMUNITY-20250409A

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SiteFooter } from "@/components/site-footer"
import { MessageCircle, Send, Users, Lightbulb, RefreshCcw } from "lucide-react"

interface CommunityPost {
  id: string
  displayName: string
  message: string
  createdAt: string
}

const ENDPOINT = "/.netlify/functions/community-posts"

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [formData, setFormData] = useState({ displayName: "", message: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPosts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(ENDPOINT)
      if (!response.ok) {
        throw new Error("留言板暫時無法載入，請稍後再試。")
      }
      const data = await response.json()
      setPosts(Array.isArray(data.posts) ? data.posts : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "留言板發生未知錯誤")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedName = formData.displayName.trim()
    const trimmedMessage = formData.message.trim()

    if (!trimmedName || !trimmedMessage) {
      setError("請填寫暱稱與留言內容，讓大家能認識你。")
      return
    }

    if (trimmedMessage.length > 1000) {
      setError("留言內容請控制在 1000 字以內，方便其他使用者閱讀。")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName: trimmedName, message: trimmedMessage }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "留言送出失敗，請稍後再試。")
      }

      const payload = await response.json()
      setPosts(payload.posts)
      setFormData({ displayName: "", message: "" })
      setSuccess("留言已送出！重新整理頁面或稍後回來看看其他人的回應。")
    } catch (err) {
      setError(err instanceof Error ? err.message : "留言送出失敗，請稍後再試。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">回首頁發掘更多功能</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/tutorial">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                使用教學
              </Button>
            </Link>
            <Link href="/faq">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">常見問題</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Badge variant="outline" className="px-4 py-1 text-sm">LazyBacktest 社群留言板</Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">分享你的策略、問題與投資心得</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              所有留言會儲存在 Netlify Blobs 雲端空間，只要重新整理頁面就能看到最新分享。請以理性友善的態度交流，讓社群成為彼此的後盾。
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <Link href="/contact" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                <Lightbulb className="h-4 w-4" /> 寄信給我
              </Link>
              <Link href="/privacy" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                <MessageCircle className="h-4 w-4" /> 隱私政策
              </Link>
              <Link href="/tutorial" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                <RefreshCcw className="h-4 w-4" /> 回到使用教學
              </Link>
            </div>
          </div>

          <section className="grid lg:grid-cols-3 gap-8 items-start">
            <Card className="lg:col-span-2 border shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-card-foreground">立即發佈新留言</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">暱稱</Label>
                    <Input
                      id="displayName"
                      name="displayName"
                      placeholder="讓大家知道你是誰，例如：小資交易員"
                      value={formData.displayName}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">想分享的內容</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="分享你的策略亮點、遇到的疑問，或是想討論的投資議題。"
                      className="min-h-[160px]"
                      value={formData.message}
                      onChange={handleChange}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      小提醒：請避免張貼個資或敏感交易資訊，若想私下討論可以先到寄信給我頁面聯絡開發者。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <Button type="button" variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={fetchPosts} disabled={isLoading}>
                      <RefreshCcw className="h-4 w-4 mr-2" /> 重新整理留言
                    </Button>
                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                      <Send className="h-4 w-4 mr-2" />
                      {isSubmitting ? "送出中..." : "送出留言"}
                    </Button>
                  </div>
                </form>

                {error && (
                  <Alert variant="destructive" className="mt-6">
                    <AlertTitle>提醒</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mt-6 border-primary bg-primary/5">
                    <AlertTitle>留言已送出</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border shadow-sm">
                <CardHeader className="space-y-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg text-card-foreground">互動守則</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>請保持友善與專業，避免張貼促銷、廣告或任何違法資訊。若發現不當內容，歡迎到寄信給我頁面檢舉。</p>
                  <p>留言會依照時間由新到舊排序，方便追蹤最新討論。</p>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="space-y-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg text-card-foreground">靈感小提示</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <ul className="list-disc list-inside space-y-1">
                    <li>分享你在 LazyBacktest 回測的策略邏輯或心得摘要。</li>
                    <li>提出想補強的功能，讓團隊評估優先順序。</li>
                    <li>邀請朋友一起測試策略，互相給予建議。</li>
                  </ul>
                  <p>
                    更多細節可以參考
                    {" "}
                    <Link href="/tutorial" className="text-primary hover:underline">
                      使用教學
                    </Link>
                    {" "}
                    與
                    {" "}
                    <Link href="/faq" className="text-primary hover:underline">
                      常見問題
                    </Link>
                    。
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">最新留言</h2>
            {isLoading ? (
              <p className="text-muted-foreground">留言載入中，請稍候...</p>
            ) : posts.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-10 text-center text-muted-foreground">
                  還沒有任何留言，搶先分享你的第一篇吧！
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Card key={post.id} className="border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-card-foreground">{post.displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString("zh-TW")}</p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">{post.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
