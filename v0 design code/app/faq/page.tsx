// Patch Tag: LB-FAQ-20250409A

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MessageSquare, BookOpen, Mail, ShieldAlert } from "lucide-react"
import { SiteFooter } from "@/components/site-footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LazyBacktest 常見問題整理",
  description:
    "彙整 LazyBacktest 使用者最常詢問的問題，包含收費、資料來源、策略限制、回測時間與隱私安全，並提供延伸資源連結。",
}

const FAQ_ITEMS = [
  {
    question: "LazyBacktest 真的完全免費嗎？",
    answer:
      "是的！無論是單檔回測、參數優化還是策略匯出，目前都免費提供。若平台幫助您賺錢，歡迎透過頁面底部的斗內連結支持我們持續優化。",
  },
  {
    question: "需要具備程式能力才能使用嗎？",
    answer:
      "不需要。平台採用全中文的圖形化操作介面，只要按照『使用教學』中的步驟設定參數，就能在幾分鐘內完成回測。",
  },
  {
    question: "回測結果是否等於未來績效？",
    answer:
      "回測以歷史資料模擬，能幫助我們了解策略在不同市場環境下的表現，但不代表未來獲利保證。投資仍有風險，建議搭配實際停損機制與資金管理。",
  },
  {
    question: "支援哪些股票或市場？",
    answer:
      "目前專注在台灣上市櫃股票，涵蓋超過 20 年的日線與權值調整資料。我們也持續評估是否導入其他市場，最新進度會在社群討論區公告。",
  },
  {
    question: "一次可以跑幾支股票？",
    answer:
      "回測引擎一次聚焦一檔股票，讓績效報表更清楚。不過可以使用『批量優化』功能同時測試多組參數，或在『股票紀錄』整理想持續追蹤的標的。",
  },
  {
    question: "平台的資料來源和更新頻率？",
    answer:
      "我們整合證交所、櫃買中心等官方資料，並透過 Netlify Functions 自動更新，通常在交易日結束後 1-2 小時內完成同步。若遇到官方伺服器異常，會在社群即時公告。",
  },
  {
    question: "資料安全與隱私如何保障？",
    answer:
      "LazyBacktest 僅保存必要的策略設定與操作紀錄，並遵循『隱私政策』。若要刪除個人資料或有疑慮，請到『寄信給我』留下訊息，我們會儘速協助。",
  },
  {
    question: "遇到錯誤訊息該怎麼辦？",
    answer:
      "請先確認網路連線狀態與輸入的股票代碼是否正確，若仍有問題，歡迎至『社群討論』回報，或直接寄信附上錯誤截圖，我們會在 1-2 個工作天內回覆。",
  },
]

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm font-medium">回首頁瀏覽最新公告</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/tutorial">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                使用教學
              </Button>
            </Link>
            <Link href="/contact">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">寄信給我</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16 space-y-4">
            <Badge variant="outline" className="px-4 py-1 text-sm">常見問題快速導覽</Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">一次解答投資人最在意的八大問題</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              本頁面整理了首頁與社群中最常見的提問，並提供連結讓你延伸閱讀或快速取得協助。
            </p>
          </div>

          <div className="grid gap-8">
            {FAQ_ITEMS.map((item) => (
              <Card key={item.question} className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-card-foreground">{item.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <section className="mt-20 grid md:grid-cols-3 gap-6">
            <Card className="border shadow-sm">
              <CardHeader className="space-y-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-card-foreground">加入社群立即提問</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>在社群討論版可以分享策略心得、錯誤截圖與最佳化參數，其他使用者也能一起幫忙排查。</p>
                <Link href="/community" className="inline-flex items-center gap-2 text-primary hover:underline">
                  前往社群討論
                </Link>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="space-y-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-card-foreground">寫信給開發者</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>想要客製化功能或回報資料錯誤？留下需求描述，我們會在 1-2 個工作天內回信。</p>
                <Link href="/contact" className="inline-flex items-center gap-2 text-primary hover:underline">
                  寄信給我
                </Link>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="space-y-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-card-foreground">了解隱私與責任</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>使用平台前，建議先閱讀隱私政策與免責聲明，確保你了解資料使用範圍與投資風險。</p>
                <div className="flex flex-col space-y-2">
                  <Link href="/privacy" className="inline-flex items-center gap-2 text-primary hover:underline">
                    隱私政策
                  </Link>
                  <Link href="/disclaimer" className="inline-flex items-center gap-2 text-primary hover:underline">
                    免責聲明
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="mt-20 text-center space-y-6">
            <h2 className="text-3xl font-bold text-foreground">找不到答案嗎？</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              歡迎直接填寫聯絡表單或到社群討論留言，我們會蒐集大家的建議，持續更新本頁面與產品功能。
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  寫信給我們
                </Button>
              </Link>
              <Link href="/tutorial">
                <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  查看操作教學
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
