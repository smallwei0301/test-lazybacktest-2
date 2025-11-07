// Page Version: LB-FE-20250304A

import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lightbulb, PlayCircle, MousePointer2, BarChart3, Share2 } from "lucide-react"
import SiteFooter from "@/components/site-footer"

export const metadata: Metadata = {
  title: "使用教學｜LazyBacktest 懶人回測",
  description: "一步步教你完成首次回測，搭配介面截圖與小提醒，讓新手也能快速上手 LazyBacktest。",
}

const steps = [
  {
    title: "步驟一：從首頁進入回測 App",
    description:
      "打開 LazyBacktest 首頁後，點擊右上角或頁面中央的「進入回測 App」按鈕，就能開啟雲端回測介面。這個按鈕會把你帶到 /backtest 分頁，裡面包含所有設定工具。",
    image: "/modern-professional-stock-trading-floor-with-multi.jpg",
    alt: "LazyBacktest 首頁的進入回測 App 按鈕位置",
    tips: [
      "如果第一次來，可以先閱讀下方的常見問題，了解資料來源與費用政策。",
      "忘記怎麼回到首頁？點擊左上角的 LazyBacktest logo 或使用頁面底部的「回到首頁」連結。",
    ],
    link: { href: "/", label: "回首頁重新熟悉版面" },
    icon: PlayCircle,
  },
  {
    title: "步驟二：選擇股票與資料期間",
    description:
      "進入回測介面後，在左側的「股票與資料」區塊輸入股票代號，並選擇你想分析的起訖日期。系統會即時從雲端抓取歷史資料，免安裝任何軟體。",
    image: "/clean-simple-charts-and-graphs-showing-performance.jpg",
    alt: "回測介面中設定股票代號與區間的位置",
    tips: [
      "不確定股票代碼？點下方的「股票紀錄」功能掌握自己的持股，再複製代碼。",
      "建議至少選擇 5 年以上的資料，才能觀察多個景氣循環。",
    ],
    link: { href: "/stock-records", label: "前往股票紀錄管理庫存" },
    icon: MousePointer2,
  },
  {
    title: "步驟三：組合策略條件",
    description:
      "使用中間的策略編輯區，從下拉選單中挑選指標（例如均線、KD、成交量等），並輸入參數數值。每個策略可以新增多個條件，LazyBacktest 會自動幫你計算買進與賣出時機。",
    image: "/simple-graphical-user-interface-with-buttons-and-c.jpg",
    alt: "設定策略條件與參數的區塊",
    tips: [
      "不確定要輸入什麼參數？可以先使用右上角的「範例策略」載入模板。",
      "記得勾選下方的「風險管理」選項，設定停損停利，降低劇烈波動帶來的情緒壓力。",
    ],
    link: { href: "/faq", label: "查看策略設定常見問題" },
    icon: BarChart3,
  },
  {
    title: "步驟四：執行回測並分析報告",
    description:
      "完成設定後，按下右上角的「開始回測」按鈕。系統會在雲端計算，幾秒鐘內產出績效摘要、交易明細與績效圖表。你也可以一鍵匯出報告或分享到社群。",
    image: "/computer-screen-showing-backtest-results-with-perf.jpg",
    alt: "回測結果摘要與績效報告的呈現畫面",
    tips: [
      "想要比較不同參數？利用批量優化功能，一次測試多組條件並自動排名。",
      "看到不懂的績效指標，可先閱讀常見問題或在社群討論區詢問其他投資人。",
    ],
    link: { href: "/community", label: "到社群討論分享成果" },
    icon: Share2,
  },
]

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            新手指南
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">3 分鐘看懂 LazyBacktest 使用流程</h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            以下示範從首頁進入回測、設定條件到產生報告的完整步驟。每個步驟都附上介面截圖與貼心提醒，讓第一次使用的朋友也能快速找到按鈕位置。
            讀完後，歡迎直接開啟<Link href="/backtest" className="ml-1 underline text-primary">即時回測介面</Link>實際操作。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-12">
        {steps.map((step, index) => (
          <Card key={step.title} className="overflow-hidden">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge className="mb-2 bg-primary/10 text-primary">STEP {index + 1}</Badge>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <step.icon className="h-6 w-6 text-primary" />
                  {step.title}
                </CardTitle>
              </div>
              <Link href={step.link.href} className="text-sm text-primary underline">
                {step.link.label}
              </Link>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                <Alert className="border-primary/30 bg-primary/5">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <AlertDescription className="mt-2 space-y-2 text-sm leading-relaxed">
                    {step.tips.map((tip) => (
                      <p key={tip}>• {tip}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              </div>
              <div className="relative aspect-[16/10] overflow-hidden rounded-lg border">
                <Image src={step.image} alt={step.alt} fill className="object-cover" />
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-2xl">下一步可以做什麼？</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              ・ 還有疑問嗎？先到<Link href="/faq" className="mx-1 underline text-primary">常見問題</Link>確認是否已有解答，再到<Link
                href="/community"
                className="mx-1 underline text-primary"
              >社群討論區</Link>發問，讓其他投資人一起幫忙。
            </p>
            <p>
              ・ 想把回測結果寄給自己？直接到<Link href="/contact" className="mx-1 underline text-primary">寄信給我</Link>頁面，把需求告訴站長，我們會協助釐清需求。
            </p>
            <p>
              ・ 使用前請務必閱讀<Link href="/privacy" className="mx-1 underline text-primary">隱私政策</Link>與<Link
                href="/disclaimer"
                className="mx-1 underline text-primary"
              >免責聲明</Link>，了解資料使用與風險提示。
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter theme="light" showDonate={false} />
    </div>
  )
}
