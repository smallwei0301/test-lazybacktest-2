// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "隱私政策｜LazyBacktest",
  description: "說明 LazyBacktest 如何處理使用者資料、社群留言與本地儲存資訊，以及使用者的權利與聯絡方式。",
}

const sections = [
  {
    title: "我們蒐集的資訊",
    items: [
      "Email：僅在您主動寄信至 smallwei0301@gmail.com 時取得，用於回覆問題。",
      "社群留言：由您在社群討論區填寫的暱稱、焦點與內文，會寫入 Netlify Blobs 並公開顯示。",
      "系統紀錄：伺服器會保留必要的錯誤日誌與匿名流量統計，用於偵錯與優化服務。",
    ],
  },
  {
    title: "我們不會蒐集的資訊",
    items: [
      "不會要求您登入或提供身分證明文件。",
      "不會讀取您在股票紀錄頁面儲存於瀏覽器 LocalStorage 的內容，該資料僅存放於您的裝置內。",
      "不會蒐集與交易帳號、券商密碼或金融憑證相關的敏感資訊。",
    ],
  },
  {
    title: "資料的使用與保存",
    items: [
      "Email 通訊僅用於回覆您的訊息，處理完成後會定期整理。",
      "社群留言存放於 Netlify Blobs，為確保討論歷史完整，不會主動刪除；若需下架可透過聯絡信箱提出。",
      "系統錯誤日誌最多保留 90 天，以便追蹤問題並保護系統安全。",
    ],
  },
  {
    title: "您的權利",
    items: [
      "可以隨時來信要求查詢、更新或刪除由我們保存的個人資料。",
      "若留言內容包含個資，可提供關鍵字與時間點，我們會協助遮蔽或移除。",
      "對於政策有任何疑問，歡迎透過聯絡信箱與我們討論。",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/privacy" />
      <main>
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              Privacy
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">隱私政策</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              LazyBacktest 尊重您的資料。以下說明哪些資訊會被保留、如何使用，以及您可以行使的權利。
            </p>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-4 py-16 md:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title} className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>
              若您不同意本政策，可停止使用本站服務；持續使用代表您同意依本政策處理資料。如需更多協助，請參考
              <Link href="/faq" className="text-primary underline-offset-4 hover:underline"> 常見問題</Link>
              或直接
              <Link href="/contact" className="text-primary underline-offset-4 hover:underline"> 寄信給我</Link>
              。
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
