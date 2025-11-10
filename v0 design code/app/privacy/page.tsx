// Page Version: LB-FE-20250304A

import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Database, UserCheck } from "lucide-react"
import SiteFooter from "@/components/site-footer"

export const metadata: Metadata = {
  title: "隱私政策｜LazyBacktest",
  description: "了解 LazyBacktest 如何收集、使用與保護您的資料，包含回測設定、留言內容與聯絡資訊。",
}

const sections = [
  {
    icon: Shield,
    title: "我們收集哪些資訊",
    points: [
      "使用回測功能時輸入的股票代號、參數設定與回測日期，僅用於生成結果與改善服務。",
      "寄信或填寫表單時提供的姓名、電子郵件、公司資訊，僅用來回覆問題，不會公開顯示。",
      "社群討論區的留言會儲存在 Netlify Blobs，用戶可以自行刪除自己的留言（請來信告知）。",
    ],
  },
  {
    icon: Database,
    title: "資料如何儲存與保護",
    points: [
      "所有資料都透過 Netlify Functions 與雲端儲存服務存放，並採用權限控管避免未授權存取。",
      "回測資料在 30 天後會進行匿名化，只留下必要的統計資訊，以改善演算法效能。",
      "我們不會與第三方交易或出租使用者資料，除非因法律要求或維護系統安全所需。",
    ],
  },
  {
    icon: UserCheck,
    title: "你的權利",
    points: [
      "可隨時透過寄信給我頁面，要求查詢、更新或刪除你的個人資訊。",
      "若你不希望資料用於改進服務，可透過信件註明，我們會在 7 個工作天內處理。",
      "未成年人請在家長同意後再使用本平台。",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            Privacy Policy
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">LazyBacktest 隱私政策</h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            我們深知投資資料的敏感性，因此採取多層防護措施保護你的資訊。以下將說明我們如何收集、使用與保管資料。如有疑慮，請立即<Link
              href="/contact"
              className="mx-1 underline text-primary"
            >寄信給我們</Link>。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-10">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="flex items-center gap-3">
              <section.icon className="h-7 w-7 text-primary" />
              <CardTitle className="text-2xl">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              {section.points.map((point) => (
                <p key={point}>・ {point}</p>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-xl">聯絡我們</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              如需查詢或刪除資料，請前往<Link href="/contact" className="mx-1 underline text-primary">寄信給我</Link>，我們會在 7 個工作天內完成。
            </p>
            <p>
              使用 LazyBacktest 代表你同意本隱私政策，若政策更新，將於網站公告並以電子郵件通知訂閱者。
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter theme="light" showDonate={false} />
    </div>
  )
}
