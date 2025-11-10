// Page Version: LB-FE-20250304A

import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, ArrowRight } from "lucide-react"
import SiteFooter from "@/components/site-footer"
import CopyEmailButton from "@/components/contact/copy-email-button"

export const metadata: Metadata = {
  title: "寄信給我｜LazyBacktest 聯絡方式",
  description: "需要專屬協助或合作洽談？透過表單或電子郵件聯絡 LazyBacktest，2 個工作天內回覆。",
}

const CONTACT_EMAIL = "smallwei0301@gmail.com"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            聯絡我們
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">有問題嗎？直接寫信給我們</h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            不論是功能建議、合作提案，或想深入了解某個策略，歡迎透過下方方式聯絡我們。寄出後 2 個工作天內會回覆，也可先到<Link
              href="/faq"
              className="mx-1 underline text-primary"
            >常見問題</Link>與<Link href="/community" className="mx-1 underline text-primary">社群討論</Link>尋找是否已有解答。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-10">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Mail className="h-6 w-6 text-primary" />
                官方聯絡信箱
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                將需求寄到以下信箱，標題建議包含「LazyBacktest」字樣，方便我們加速分類。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="bg-primary text-primary-foreground">
                <a href={`mailto:${CONTACT_EMAIL}`}>寄信至 {CONTACT_EMAIL}</a>
              </Button>
              <CopyEmailButton email={CONTACT_EMAIL} />
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="border-primary/40 bg-white">
              <AlertDescription className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>・ 建議在信中附上：想回測的股票、時間區間、策略描述與期待的成果。</p>
                <p>
                  ・ 若是技術問題，請附上螢幕截圖或在<Link href="/tutorial" className="mx-1 underline text-primary">使用教學</Link>確認是否已涵蓋你遇到的步驟。
                </p>
                <p>
                  ・ 敏感資料（如身分證字號、密碼）請不要透過電子郵件提供，保障你的個人資訊安全。
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">聯絡前的自我檢查</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>1. 先確認常見問題是否已回覆同樣的情境。</p>
              <p>2. 嘗試重新整理頁面，或清空瀏覽器快取後再測試一次。</p>
              <p>
                3. 若需要即時交流，可先到<Link href="/community" className="mx-1 underline text-primary">社群討論區</Link>發布，通常會有熱心的用戶第一時間協助。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">合作提案與媒體採訪</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>・ 提供貴公司的基本資料、合作目標與預計時程。</p>
              <p>・ 若需要 API 或資料匯出，請先告知預計的使用量與安全控管方式。</p>
              <p>
                ・ 我們會根據<Link href="/privacy" className="mx-1 underline text-primary">隱私政策</Link>評估資料權限，確保用戶資訊受到妥善保護。
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-dashed border-primary/40">
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between py-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">想立即獲得回覆？</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                加入社群討論區，留言會儲存在雲端，所有使用者都能即時看到，也能追蹤站方後續回覆。
              </p>
            </div>
            <Button asChild className="bg-primary text-primary-foreground">
              <Link href="/community" className="flex items-center gap-2">
                前往社群討論
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <SiteFooter theme="light" showDonate={false} />
    </div>
  )
}
