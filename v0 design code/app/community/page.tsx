// Page Version: LB-FE-20250304A

import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquareShare, ShieldCheck, Cloud } from "lucide-react"
import SiteFooter from "@/components/site-footer"
import { CommunityBoard } from "@/components/community/community-board"

export const metadata: Metadata = {
  title: "社群討論｜LazyBacktest 雲端留言板",
  description: "在 LazyBacktest 社群留言板分享策略心得，所有訊息透過 Netlify 雲端儲存，所有使用者都能即時查看。",
}

const highlights = [
  {
    icon: Cloud,
    title: "雲端同步",
    description: "留言會儲存在 Netlify Blobs，所有使用者都能即時看到最新討論，不會因為換裝置而消失。",
  },
  {
    icon: MessageSquareShare,
    title: "策略分享",
    description: "分享你在回測中的發現、參數設定與績效數據，也歡迎貼上圖表或重點說明，讓其他人更快理解。",
  },
  {
    icon: ShieldCheck,
    title: "安全守則",
    description: "請避免留下個資、帳號密碼或未公開資訊。所有留言都遵守平台的隱私政策與免責聲明。",
  },
]

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            社群交流
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">分享你的策略，讓更多人一起進步</h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            這裡是 LazyBacktest 的公開留言板，留言會存放在雲端，所有人都能閱讀與回覆。建議在留言時先閱讀<Link
              href="/tutorial"
              className="mx-1 underline text-primary"
            >使用教學</Link>與<Link href="/faq" className="mx-1 underline text-primary">常見問題</Link>，確保資訊完整；若需要站方協助，請同時在<Link
              href="/contact"
              className="mx-1 underline text-primary"
            >寄信給我</Link>頁面留下聯絡方式。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-10">
        <section className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} className="h-full">
              <CardHeader>
                <item.icon className="h-8 w-8 text-primary" />
                <CardTitle className="mt-4 text-xl">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <CommunityBoard />

        <Card className="bg-muted/40 border-muted">
          <CardContent className="py-8 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              ・ 想瞭解我們如何保護資料？請詳閱<Link href="/privacy" className="mx-1 underline text-primary">隱私政策</Link>。
            </p>
            <p>
              ・ 所有投資決策請自行負責，使用本留言板即代表你同意<Link
                href="/disclaimer"
                className="mx-1 underline text-primary"
              >免責聲明</Link>中的條款。
            </p>
            <p>
              ・ 若想整理自己的投資紀錄，別忘了搭配<Link href="/stock-records" className="mx-1 underline text-primary">股票紀錄</Link>功能，方便把討論成果落地。
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter theme="light" showDonate={false} />
    </div>
  )
}
