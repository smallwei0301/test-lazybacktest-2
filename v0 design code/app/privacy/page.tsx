// Patch Tag: LB-PRIVACY-20250409A

import Link from "next/link"
import { Shield, Lock, Database, Mail, Users, RefreshCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "LazyBacktest 隱私政策",
  description: "說明 LazyBacktest 如何收集、使用與保護使用者資料，以及使用者的權利與聯絡方式。",
}

const SECTIONS = [
  {
    icon: Lock,
    title: "我們蒐集的資料",
    items: [
      "必要的登入資訊：如使用者提供的 Email 與暱稱，用來識別與回覆訊息。",
      "回測操作紀錄：包含策略名稱、參數設定與測試時間，以便提供操作體驗與偵錯。",
      "系統日誌：使用匿名化方式紀錄操作流程，用於分析服務品質與排除異常。",
    ],
  },
  {
    icon: Database,
    title: "資料如何被使用",
    items: [
      "產生回測報告與策略建議，提供使用者完成投資分析所需資訊。",
      "優化產品功能：分析常用設定與錯誤訊息，作為開發優先順序的參考。",
      "安全性檢測：偵測異常流量與阻擋惡意攻擊，確保服務穩定。",
    ],
  },
  {
    icon: Shield,
    title: "資料保存與安全",
    items: [
      "所有資料均儲存在 Netlify 與雲端資料庫，採用存取權限控管。",
      "回測結果僅保留必要內容，定期檢視並刪除過期紀錄。",
      "未經使用者同意，不會將資料提供給第三方廣告商或合作夥伴。",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">回首頁了解最新更新</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/faq">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                常見問題
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
            <Badge variant="outline" className="px-4 py-1 text-sm">隱私與資料保護</Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">我們重視每一位使用者的資料安全</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              LazyBacktest 會依據以下原則處理您的資料。若有任何疑問，歡迎透過寄信給我頁面與我們聯繫。
            </p>
          </div>

          <section className="grid md:grid-cols-3 gap-6">
            {SECTIONS.map((section) => (
              <Card key={section.title} className="border shadow-sm">
                <CardHeader className="space-y-2">
                  <section.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg text-card-foreground">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  {section.items.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            <Card className="border shadow-sm">
              <CardHeader className="space-y-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-card-foreground">您的權利</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>您可以隨時要求查詢、下載或刪除在 LazyBacktest 上保存的個人資料與策略紀錄。</p>
                <p>
                  請寄信至
                  {" "}
                  <Link href="/contact" className="text-primary hover:underline">
                    寄信給我
                  </Link>
                  ，我們會在 14 天內回覆申請進度。
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="space-y-2">
                <RefreshCcw className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg text-card-foreground">政策更新</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>當我們更新隱私政策時，會在首頁與社群討論公告，並於頁面底部標示最後更新日期。</p>
                <p>
                  最新版本：2025 年 4 月 9 日。建議定期回訪或追蹤
                  {" "}
                  <Link href="/community" className="text-primary hover:underline">
                    社群討論
                  </Link>
                  ，掌握最新訊息。
                </p>
              </CardContent>
            </Card>
          </section>

          <Card className="border shadow-sm">
            <CardHeader className="space-y-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-card-foreground">聯絡我們</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                如果您對本政策有任何疑問，或發現資料外洩風險，請立即透過
                {" "}
                <Link href="/contact" className="text-primary hover:underline">
                  寄信給我
                </Link>
                {" "}
                通知我們，我們會優先處理。
              </p>
              <p>
                建議搭配閱讀
                {" "}
                <Link href="/disclaimer" className="text-primary hover:underline">
                  免責聲明
                </Link>
                ，了解平台服務範圍與責任歸屬。
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
