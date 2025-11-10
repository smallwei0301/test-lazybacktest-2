// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "聯絡我們｜LazyBacktest 支援窗口",
  description: "透過電子郵件回報建議或錯誤，也可先閱讀常見問題與社群討論找到即時解答。",
}

const tips = [
  {
    title: "先看使用教學",
    description: "逐步圖解所有回測功能，許多常見設定都能在 6 個步驟內找到答案。",
    href: "/guide",
  },
  {
    title: "搜尋常見問題",
    description: "遇到資料來源、匯出或 AI 預測疑問時，FAQ 能提供最快的排除流程。",
    href: "/faq",
  },
  {
    title: "加入社群討論",
    description: "在留言板分享策略心得或截圖，其他使用者也會互相交流設定技巧。",
    href: "/community",
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/contact" />
      <main>
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              Contact
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">有建議或 Bug 嗎？歡迎直接寫信</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              我們會在工作日 24 小時內回覆，若需緊急處理回測資料問題，也請附上畫面截圖方便釐清。
            </p>
          </div>
        </section>

        <section className="container mx-auto grid gap-8 px-4 py-16 md:grid-cols-[2fr_3fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">主要聯絡管道</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground">
              <div>
                <p className="text-sm uppercase tracking-wide text-primary">Email</p>
                <a href="mailto:smallwei0301@gmail.com" className="mt-2 block text-lg font-semibold text-foreground hover:text-primary">
                  smallwei0301@gmail.com
                </a>
                <p className="mt-2 text-sm leading-relaxed">
                  寫信時請簡要描述：使用情境、輸入的股票代碼、回測期間以及遇到的錯誤訊息。我們會依照優先順序排程修正。
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
                <strong className="block text-primary-foreground/80">提醒：</strong>
                若問題與功能操作相關，可先參考使用教學與 FAQ，常見的設定或權限問題大多能立即排除。
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">聯絡前可以先試試</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-1">
              {tips.map((tip) => (
                <div key={tip.title} className="rounded-lg border border-border/60 bg-muted/30 p-5">
                  <h3 className="text-lg font-semibold text-foreground">{tip.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tip.description}</p>
                  <Link href={tip.href} className="mt-4 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                    前往 {tip.title}
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-foreground">需要更完整的資訊？</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                我們準備了
                <Link href="/privacy" className="text-primary underline-offset-4 hover:underline"> 隱私政策</Link>
                與
                <Link href="/disclaimer" className="text-primary underline-offset-4 hover:underline"> 免責聲明</Link>
                ，詳細說明資料的使用方式。若要分享策略與心得，歡迎直接在
                <Link href="/community" className="text-primary underline-offset-4 hover:underline"> 社群討論</Link>
                與其他使用者交流。
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
