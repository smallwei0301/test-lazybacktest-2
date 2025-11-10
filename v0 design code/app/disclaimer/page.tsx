// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "免責聲明｜LazyBacktest",
  description: "說明 LazyBacktest 的使用限制、資料正確性與投資風險，提醒使用者自行承擔投資結果。",
}

const clauses = [
  {
    title: "非投資建議",
    content:
      "LazyBacktest 提供的是回測工具與學習資源，任何分析結果僅供教育與研究參考，並不構成投資建議或保證。",
  },
  {
    title: "資料正確性",
    content:
      "我們會盡力維持資料來源的正確性與即時性，但仍可能因官方公告延遲、網路中斷或第三方 API 改版而發生誤差。請使用者自行核對重要數據。",
  },
  {
    title: "使用者責任",
    content:
      "您在 LazyBacktest 上輸入的策略參數、交易成本與回測期間，都會直接影響結果。使用者應自行理解策略風險，並為所有決策負責。",
  },
  {
    title: "第三方連結",
    content:
      "網站中可能包含導向第三方網站的連結（例如贊助或資料來源）。我們無法保證第三方內容的正確性或安全性，請自行評估後再使用。",
  },
  {
    title: "服務變動",
    content:
      "LazyBacktest 得視營運狀況調整功能、演算法或服務內容，包含暫停或停止某些功能。若有重大更新，將透過網站公告或社群貼文通知。",
  },
]

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/disclaimer" />
      <main>
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              Disclaimer
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">免責聲明</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              使用 LazyBacktest 前，請先閱讀以下聲明。我們希望幫助您更理性地評估投資風險。
            </p>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-4 py-16 md:grid-cols-2">
          {clauses.map((clause) => (
            <Card key={clause.title} className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{clause.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">{clause.content}</CardContent>
            </Card>
          ))}
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>
              持續使用本服務代表您同意上述條款。如需進一步協助，請參考
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline"> 隱私政策</Link>
              與
              <Link href="/faq" className="text-primary underline-offset-4 hover:underline"> 常見問題</Link>
              ，或
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline"> 寄信給我</Link>
              取得支援。
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
