// Patch Tag: LB-CONTACT-20250409A

import Link from "next/link"
import { Mail, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { ContactForm } from "@/components/contact-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "聯絡 LazyBacktest 開發者",
  description: "提供聯絡表單與寄信建議，協助使用者快速與 LazyBacktest 團隊取得聯繫，回報問題或提出功能需求。",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">回首頁查看最新公告</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/faq">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                常見問題
              </Button>
            </Link>
            <Link href="/community">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">社群討論</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12 space-y-4">
            <span className="text-sm uppercase tracking-wide text-primary">聯絡我們</span>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">歡迎把問題、想法與回饋都告訴我們</h1>
            <p className="text-muted-foreground leading-relaxed">
              若遇到資料異常或想提功能點子，可以先在
              {" "}
              <Link href="/community" className="underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">
                社群討論
              </Link>
              {" "}
              搜尋是否已有解答，再透過表單寄信給我們，加速問題排查。
            </p>
          </div>

          <ContactForm />

          <div className="mt-16 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              想即時互動？加入我們的社群討論串，和其他投資人一起分享策略與心得。
            </p>
            <Link href="/community" className="inline-flex items-center gap-2 text-primary hover:underline">
              <MessageSquare className="h-4 w-4" />
              前往社群討論
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
