// Patch Tag: LB-TUTORIAL-20250409A

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Lightbulb, Sparkles, ShieldCheck, MessageSquare } from "lucide-react"
import { SiteFooter } from "@/components/site-footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LazyBacktest 使用教學",
  description:
    "逐步圖解 LazyBacktest 操作教學，搭配貼心小提醒，幫助新手快速掌握股票回測、策略優化、社群討論與客服聯繫。",
}

const STEPS = [
  {
    title: "步驟一：選擇策略模板",
    description:
      "進入首頁後，點選上方的「立即開始回測」或「進入回測 App」，就能在策略清單中挑選想要測試的策略模板。初學者可以先從『均線黃金交叉』這類簡單策略開始。",
    tip: "如果不確定要選哪個策略，先到『常見問題』了解每個策略適合的情境，或加入『社群討論』看看其他使用者的分享。",
    image: {
      src: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80",
      alt: "選擇策略模板示意圖",
    },
  },
  {
    title: "步驟二：設定回測參數",
    description:
      "在策略設定頁面輸入欲回測的股票代號、期間、買賣條件與資金部位。每個欄位旁的說明圖示都能查看詳細解說，記得將『滑價』與『手續費』設定為符合自己券商的數值。",
    tip: "善用表單右上角的『小電燈 icon』，可以快速套用平台提供的建議參數，節省調整時間。",
    image: {
      src: "https://images.unsplash.com/photo-1520607162513-6c27b64f3161?auto=format&fit=crop&w=1200&q=80",
      alt: "設定回測參數示意圖",
    },
  },
  {
    title: "步驟三：閱讀回測報告",
    description:
      "按下『開始回測』後，等待幾秒鐘即可看到完整報告。平台會顯示報酬率、最大回檔、勝率與交易明細。點擊『績效雷達圖』可以快速比較風險與報酬的平衡度。",
    tip: "若想要留存結果，點選報告右上角的『匯出』按鈕即可下載 PDF。也別忘了到『股票紀錄』幫自己的觀察清單加上註記。",
    image: {
      src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
      alt: "閱讀回測報告示意圖",
    },
  },
  {
    title: "步驟四：分享與優化",
    description:
      "看完報告後，想繼續調整策略嗎？直接按下『複製成新策略』可以套用上一筆設定。完成後歡迎到『社群討論』發表成果，或是寄信給我們提供改版建議。",
    tip: "在社群留言時請附上截圖或關鍵數據，讓其他使用者更容易理解你的心得。",
    image: {
      src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
      alt: "分享策略成果示意圖",
    },
  },
]

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-sm font-medium">回首頁探索更多功能</span>
          </Link>
          <Link href="/backtest">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">立即進入回測頁面</Button>
          </Link>
        </div>
      </header>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <Badge variant="outline" className="px-4 py-1 text-sm">三分鐘掌握 LazyBacktest</Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">完整圖解教學，帶你一次看懂回測流程</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              我們整理了最常被詢問的操作步驟，每一步都搭配截圖與貼心提醒，確保第一次使用也能順利跑出策略結果。
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <Link href="/faq" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                <ShieldCheck className="h-4 w-4" /> 常見問題
              </Link>
              <Link href="/community" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                <MessageSquare className="h-4 w-4" /> 社群討論
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                <Lightbulb className="h-4 w-4" /> 寄信給我
              </Link>
            </div>
          </div>

          <div className="grid gap-10">
            {STEPS.map((step) => (
              <Card key={step.title} className="overflow-hidden border shadow-sm">
                <div className="grid gap-0 md:grid-cols-2">
                  <div className="p-8 space-y-6">
                    <CardHeader className="p-0">
                      <Badge className="w-fit bg-primary/10 text-primary">{step.title}</Badge>
                      <CardTitle className="text-2xl text-card-foreground leading-relaxed mt-4">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 space-y-4">
                      <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                      <Alert className="bg-primary/5 border-primary/40">
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>小提醒</AlertTitle>
                        <AlertDescription className="text-sm leading-relaxed">{step.tip}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </div>
                  <div className="relative min-h-[240px]">
                    <img src={step.image.src} alt={step.image.alt} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <section className="mt-16 grid md:grid-cols-2 gap-6">
            <Alert className="bg-muted border border-dashed">
              <Sparkles className="h-4 w-4" />
              <AlertTitle>想讓策略更進階？</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">
                試試看回測完成後，前往
                {" "}
                <Link href="/stock-records" className="underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">
                  股票紀錄
                </Link>
                {" "}
                管理自己的選股清單，或直接到
                {" "}
                <Link href="/community" className="underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">
                  社群討論
                </Link>
                {" "}
                與其他使用者互相交流靈感。
              </AlertDescription>
            </Alert>

            <Alert className="bg-muted border border-dashed">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>資料安全與隱私</AlertTitle>
              <AlertDescription className="text-sm leading-relaxed">
                我們遵循
                {" "}
                <Link href="/privacy" className="underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">
                  隱私政策
                </Link>
                ，所有回測資料都僅用於呈現報表，不會外流。若有疑問歡迎
                {" "}
                <Link href="/contact" className="underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">
                  寄信給我們
                </Link>
                。
              </AlertDescription>
            </Alert>
          </section>

          <div className="mt-20 text-center space-y-6">
            <h2 className="text-3xl font-bold text-foreground">準備好了嗎？下一步就交給你</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              依照步驟完成第一次回測後，記得回到本頁面確認自己有沒有遺漏關鍵設定，也歡迎將心得分享到社群，幫助更多投資朋友少走冤枉路。
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/backtest">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  立刻開始回測
                </Button>
              </Link>
              <Link href="/faq">
                <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  查看常見問題
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
