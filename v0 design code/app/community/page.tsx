// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CommunityBoard } from "@/components/community-board"

export const metadata: Metadata = {
  title: "社群討論｜分享 LazyBacktest 策略與心得",
  description: "在社群留言板交流回測設定、策略發現與最佳化技巧，所有貼文皆儲存於雲端並同步給每位使用者。",
}

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/community" />
      <main>
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              Community
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">分享你的 LazyBacktest 實戰心得</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              留言將即時同步到雲端，所有使用者都能看到。請避免張貼個資、券商帳號或帶有指名買賣的內容。
            </p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <CommunityBoard />
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto grid gap-6 px-4 md:grid-cols-3">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                <h3 className="text-lg font-semibold text-foreground">討論守則</h3>
                <p>尊重其他使用者的投資觀點，禁止人身攻擊或洗版。若分享策略，請說明使用的參數與觀察到的風險。</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                <h3 className="text-lg font-semibold text-foreground">常用資源</h3>
                <p>
                  需要重新確認功能操作？
                  <Link href="/guide" className="text-primary underline-offset-4 hover:underline"> 使用教學</Link>
                  與
                  <Link href="/faq" className="text-primary underline-offset-4 hover:underline"> FAQ</Link>
                  都能快速排除疑問。
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                <h3 className="text-lg font-semibold text-foreground">疑難排解</h3>
                <p>
                  若留言牽涉到個人資料或需要工程師協助，請改用
                  <Link href="/contact" className="text-primary underline-offset-4 hover:underline"> 寄信給我</Link>
                  ，提供詳細截圖以加速排查。
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
