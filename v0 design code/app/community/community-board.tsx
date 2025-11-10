"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, MessageSquare, Send, ThumbsUp } from "lucide-react"

const STORAGE_KEY = "lazybacktest-community-posts"
const categories = [
  { value: "all", label: "全部討論" },
  { value: "strategy", label: "策略交流" },
  { value: "bug", label: "錯誤回報" },
  { value: "request", label: "功能建議" },
  { value: "general", label: "自由聊天" },
] as const

type Category = (typeof categories)[number]["value"]

interface Post {
  id: string
  name: string
  title: string
  category: Category
  content: string
  createdAt: string
  likes: number
}

const defaultPosts: Post[] = [
  {
    id: "seed-1",
    name: "Chloe",
    title: "分享一下均線交叉的參數",
    category: "strategy",
    content:
      "我用 5 日均線與 20 日均線交叉搭配 8% 停損，回測結果滿穩定的。記得在策略紀錄補上備註，之後回來檢討會很方便。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    likes: 6,
  },
  {
    id: "seed-2",
    name: "Eason",
    title: "希望新增自訂指標",
    category: "request",
    content:
      "想請求未來可以支援把自己的函數丟進去。也許可以先支援簡單的條件式設定？",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    likes: 4,
  },
  {
    id: "seed-3",
    name: "Vicky",
    title: "登入時遇到錯誤訊息",
    category: "bug",
    content:
      "昨天晚上登入時出現 503 錯誤，今天早上就恢復了，但還是回報給開發者參考。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    likes: 2,
  },
]

const categoryStyles: Record<Category, string> = {
  all: "bg-primary/10 text-primary",
  strategy: "bg-primary/10 text-primary",
  bug: "bg-destructive/10 text-destructive",
  request: "bg-accent/10 text-accent",
  general: "bg-secondary/10 text-secondary-foreground",
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  })

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export function CommunityBoard() {
  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState<Category>("all")
  const [search, setSearch] = useState("")
  const [name, setName] = useState("")
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<Category>("strategy")
  const [content, setContent] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return

    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed: Post[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPosts(parsed)
          return
        }
      } catch (error) {
        console.warn("Failed to parse saved community posts", error)
      }
    }
    setPosts(defaultPosts)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  }, [posts])

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchCategory = filter === "all" || post.category === filter
      const keyword = search.trim().toLowerCase()
      const matchSearch =
        keyword.length === 0 ||
        post.title.toLowerCase().includes(keyword) ||
        post.content.toLowerCase().includes(keyword) ||
        post.name.toLowerCase().includes(keyword)
      return matchCategory && matchSearch
    })
  }, [posts, filter, search])

  const handleSubmit = () => {
    if (!name.trim() || !title.trim() || !content.trim()) {
      setError("請填寫暱稱、標題與內容，我們才能協助你。")
      return
    }
    const newPost: Post = {
      id: createId(),
      name: name.trim(),
      title: title.trim(),
      category,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
    }
    setPosts((prev) => [newPost, ...prev])
    setName("")
    setTitle("")
    setContent("")
    setCategory("strategy")
    setError("")
  }

  const handleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === id
          ? {
              ...post,
              likes: post.likes + 1,
            }
          : post,
      ),
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-5xl space-y-12">
        <section className="rounded-3xl border bg-card/70 p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                <MessageSquare className="h-4 w-4" />
                社群討論區
              </p>
              <h1 className="text-3xl font-bold text-foreground">歡迎分享你的回測心得與問題</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                這裡是 LazyBacktest 使用者互相幫忙的地方。分享策略、提問 bug、提出功能建議，讓整個社群一起進步。請遵守社群規範，保持友善與尊重。
              </p>
            </div>
            <div className="rounded-2xl bg-primary/5 p-4 text-xs text-muted-foreground">
              <h2 className="text-sm font-semibold text-primary">社群守則</h2>
              <ul className="mt-2 space-y-1">
                <li>• 禁止張貼未經證實的保證獲利資訊</li>
                <li>• 禁止廣告、騷擾或個資外流</li>
                <li>• 請尊重不同策略與觀點</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-card/70 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-foreground">發表新話題</h2>
          <p className="mt-2 text-sm text-muted-foreground">填寫以下表單後，我們會把你的留言顯示在社群中。內容會保存在你的瀏覽器中，下次造訪仍能看到。</p>
          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="community-name">
                暱稱
              </label>
              <Input
                id="community-name"
                placeholder="請輸入顯示名稱"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="community-title">
                標題
              </label>
              <Input
                id="community-title"
                placeholder="想討論的重點，例如：如何設定停損"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">分類</label>
              <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((item) => item.value !== "all")
                    .map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="community-content">
                內容
              </label>
              <Textarea
                id="community-content"
                placeholder="分享你的策略、遇到的問題或想法。為了社群品質，請描述完整的情境與觀察。"
                rows={6}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button onClick={handleSubmit} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90">
                <Send className="h-4 w-4" />
                發表留言
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-card/70 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold text-foreground">最新討論</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                篩選話題
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as Category)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="全部討論" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-full min-w-[200px] md:w-[220px]"
                placeholder="搜尋關鍵字"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {filteredPosts.length === 0 && (
              <Card className="border-dashed bg-background/60">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  還沒有符合條件的討論，歡迎成為第一個分享的人！
                </CardContent>
              </Card>
            )}

            {filteredPosts.map((post) => (
              <Card key={post.id} className="border bg-background/90">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">{post.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">由 {post.name} 於 {formatDate(post.createdAt)} 分享</p>
                  </div>
                  <Badge className={categoryStyles[post.category]}> {categories.find((item) => item.value === post.category)?.label}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{post.content}</p>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>此留言僅代表使用者立場，LazyBacktest 不保證內容正確性。</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="inline-flex items-center gap-2"
                    onClick={() => handleLike(post.id)}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    給個鼓勵 ({post.likes})
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default CommunityBoard
