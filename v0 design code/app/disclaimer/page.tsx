// Patch Tag: LB-WEB-20250210A
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteFooter } from "@/components/site-footer"

const clauses = [
  {
    title: "投資風險提醒",
    description:
      "LazyBacktest 提供的是歷史資料模擬結果，並非未來績效保證。金融市場具高度不確定性，請自行評估風險承擔能力。",
    points: [
      "回測結果僅供教育與策略研究使用，不構成投資建議。",
      "實際交易成本、滑價與市場流動性可能與回測設定不同。",
      "若您使用槓桿或衍生性商品，請另外評估額外風險。",
    ],
  },
  {
    title: "資料來源與準確性",
    description:
      "我們透過公開管道取得台股歷史資料並定期校驗，但仍可能因交易所更新或資料異常造成短暫缺漏。",
    points: [
      "一旦發現資料錯誤，我們會儘速修正並在社群討論區公告。",
      "對於資料延遲或暫停提供造成的損失，本平台概不負責。",
      "建議在重要決策前，另行查證官方公告與即時行情。",
    ],
  },
  {
    title: "使用者責任",
    description:
      "當您使用 LazyBacktest，即表示同意遵守以下規範並自行承擔使用風險。",
    points: [
      "不得將平台用於違法用途，例如操縱市場或散布不實資訊。",
      "若分享策略或回測結果，請確保不侵犯任何第三方權利。",
      "請妥善管理個人帳號與密碼，以避免未授權使用。",
    ],
  },
  {
    title: "責任限制",
    description:
      "在法律允許範圍內，LazyBacktest 對於因使用平台而產生的任何直接或間接損失不負賠償責任。",
    points: [
      "我們不保證服務不會中斷、無錯誤或完全符合您的期待。",
      "對於因第三方服務中斷（如 Netlify 或資料供應商）造成的損害概不負責。",
      "若有付費服務，請先閱讀相關條款，再決定是否購買。",
    ],
  },
  {
    title: "條款更新",
    description:
      "我們會依據產品調整與法規更新適時修訂免責聲明，並於本頁與社群討論區公告。",
    points: [
      "重大變更將透過寄信給我頁面中的聯絡信箱主動通知。",
      "若您在更新後繼續使用平台，即視為同意最新條款。",
      "建議定期查看本頁內容，確保了解最新規範。",
    ],
  },
]

export default function DisclaimerPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="bg-gradient-to-r from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl space-y-6">
            <Badge variant="secondary">免責聲明</Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              使用 LazyBacktest 前，請先了解這些責任界線
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              為了保護使用者權益與平台營運，我們整理了投資風險、資料限制與使用者責任。請詳讀以下條款後再繼續使用服務。
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 space-y-10">
        {clauses.map((clause) => (
          <Card key={clause.title} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">{clause.title}</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">{clause.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground leading-relaxed">
                {clause.points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <Card className="border border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              若您對條款內容有疑問，請透過 <Link href="/contact" className="underline underline-offset-4">寄信給我</Link>
              或在 <Link href="/community" className="underline underline-offset-4">社群討論</Link> 進一步詢問。
            </p>
            <p>
              建議搭配
              <Link href="/privacy" className="underline underline-offset-4 mx-1">隱私政策</Link>
              一起閱讀，完整了解資料處理方式與責任分工。
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  )
}
