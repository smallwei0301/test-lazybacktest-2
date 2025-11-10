// Patch Tag: LB-DISCLAIMER-20250409A

import Link from "next/link"
import { AlertTriangle, Scale, BookOpen, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LazyBacktest 免責聲明",
  description: "明確說明 LazyBacktest 在投資建議、資料來源與使用責任上的界線。",
}

const DISCLAIMERS = [
  {
    title: "非投資建議",
    content:
      "LazyBacktest 提供的回測結果僅供教育與研究用途，不構成任何投資建議。使用者需自行判斷策略是否適合自身風險承受度。",
  },
  {
    title: "資料來源與準確性",
    content:
      "我們使用台灣證券交易所、櫃買中心及其他公開資料來源，但仍可能受到延遲、維護或第三方限制影響。若資料異常，請立即回報。",
  },
  {
    title: "使用者責任",
    content:
      "您在平台上輸入的策略、參數與操作結果均由您自行負責。若因採用任何策略造成損失，本平台恕不負擔賠償責任。",
  },
  {
    title: "服務中斷",
    content:
      "因天災、系統維護、第三方服務異常等因素造成的服務中斷，LazyBacktest 會盡力通知與復原，但無法保證持續可用。",
  },
]

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">回首頁了解更多功能</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/privacy">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                隱私政策
              </Button>
            </Link>
            <Link href="/contact">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">寄信給我</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Badge variant="outline" className="px-4 py-1 text-sm">使用責任說明</Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">使用 LazyBacktest 前請先了解以下內容</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              為保障您的權益，請詳細閱讀免責聲明並搭配隱私政策。若對內容有疑問，歡迎透過寄信給我聯繫我們。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {DISCLAIMERS.map((item) => (
              <Card key={item.title} className="border shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg text-card-foreground">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed">{item.content}</CardContent>
              </Card>
            ))}
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="space-y-2">
              <Scale className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-card-foreground">使用者須知</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>請定期檢視官方公告與社群討論，掌握資料更新與功能異動狀態。</p>
              <p>
                若您需要專業投資建議，建議諮詢合法的投信、投顧或證券專業人員，本平台不提供個別投資標的之買賣建議。
              </p>
              <p>
                了解更多平台功能與操作方式，請參考
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

          <Card className="border shadow-sm">
            <CardHeader className="space-y-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-card-foreground">政策變更</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>免責聲明若有修訂，將同步更新本頁面並標記最新日期，同時於社群與首頁公告。</p>
              <p>最新版本：2025 年 4 月 9 日。請務必定期回訪，確保您了解最新條款內容。</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="space-y-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-card-foreground">聯絡方式</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                如對免責聲明有疑問或需授權使用 LazyBacktest 內容，請透過
                {" "}
                <Link href="/contact" className="text-primary hover:underline">
                  寄信給我
                </Link>
                {" "}
                告知，我們會儘速回覆。
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
