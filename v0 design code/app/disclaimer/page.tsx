// Page Version: LB-FE-20250304A

import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Scale, TrendingUp } from "lucide-react"
import SiteFooter from "@/components/site-footer"

export const metadata: Metadata = {
  title: "免責聲明｜LazyBacktest",
  description: "LazyBacktest 提供的回測結果僅供教育與研究用途，使用前請先詳閱本免責聲明。",
}

const statements = [
  {
    icon: AlertTriangle,
    title: "投資風險自負",
    points: [
      "LazyBacktest 提供的回測結果與策略建議僅供教育與研究用途，不代表任何投資建議。",
      "實際交易時仍需自行評估市場波動、流動性、交易成本等因素。",
      "使用本平台所造成的任何損失，LazyBacktest 與開發者不負任何法律責任。",
    ],
  },
  {
    icon: TrendingUp,
    title: "歷史績效不代表未來",
    points: [
      "回測結果來自歷史資料，無法完全反映未來市場狀況。",
      "部分資料可能因官方 API 延遲或資料缺漏而產生誤差，我們會儘速修正但不保證即時性。",
      "請務必搭配風險管理與資產配置，避免單一策略造成資金集中風險。",
    ],
  },
  {
    icon: Scale,
    title: "使用者責任",
    points: [
      "請確保你遵守所在地的相關法規，包含證券交易法與個資保護規定。",
      "若你分享策略或留言，請確認內容不涉及內線消息或未公開重大資訊。",
      "使用本平台即表示你同意遵守本免責聲明與隱私政策。",
    ],
  },
]

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            Disclaimer
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">LazyBacktest 免責聲明</h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            使用 LazyBacktest 前，請先閱讀以下說明。若對條款有疑問或需要協助，請<Link href="/contact" className="mx-1 underline text-primary">寄信給我</Link>或到<Link
              href="/community"
              className="mx-1 underline text-primary"
            >社群討論區</Link>了解更多背景資訊。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-10">
        {statements.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex items-center gap-3">
              <item.icon className="h-7 w-7 text-primary" />
              <CardTitle className="text-2xl">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {item.points.map((point) => (
                <p key={point}>・ {point}</p>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">提醒</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              使用本平台即表示你已閱讀並同意<Link href="/privacy" className="mx-1 underline text-primary">隱私政策</Link>與本免責聲明。
            </p>
            <p>
              若你需要專業投資建議，建議洽詢具有合法牌照的理財顧問或證券專員。
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter theme="light" showDonate={false} />
    </div>
  )
}
