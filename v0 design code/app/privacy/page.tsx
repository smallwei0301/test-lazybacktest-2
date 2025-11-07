// Patch Tag: LB-WEB-20250210A
import type { ReactNode } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteFooter } from "@/components/site-footer"

const sections: { title: string; description: string; items: ReactNode[] }[] = [
  {
    title: "我們蒐集哪些資料",
    description:
      "LazyBacktest 僅會蒐集提供服務所需的最小資料量。我們不會販售或出租您的個人資訊，所有資料都依照台灣個資法與 Netlify 的安全標準管理。",
    items: [
      "帳務與聯絡資訊：用於寄信給我頁面回覆問題與發佈系統通知。",
      "策略設定與回測結果：讓您可以跨裝置檢視歷史記錄並回顧分析。",
      "使用偏好與介面設定：例如顏色、語言或常用指標，方便優化操作體驗。",
    ],
  },
  {
    title: "資料如何使用",
    description:
      "所有資料皆只用於提供 LazyBacktest 相關服務或改善體驗。若未來需要額外用途，我們會先徵求您的同意。",
    items: [
      "提供回測計算與報告產出，包括參數儲存、績效排行與風險分析。",
      "通知服務更新、維護或異常狀態，例如系統升級與資料庫維護。",
      "彙整匿名統計資訊，用於改善 UI/UX 與排程更多常用策略模板。",
    ],
  },
  {
    title: "資料保存與刪除",
    description:
      "您可以隨時透過寄信給我請求匯出或刪除資料。我們會於 7 個工作天內完成處理。",
    items: [
      "回測結果與策略設定預設保存 3 年，逾期會以匿名統計方式保留關鍵指標。",
      "若您停用帳號，我們會立即移除可識別個人身分的資訊。",
      "Netlify Blobs 提供加密儲存，我們定期審視存取權限以防止未授權使用。",
    ],
  },
  {
    title: "第三方服務",
    description:
      "LazyBacktest 使用的第三方服務僅限於提供必要的運算與資料儲存。",
    items: [
      "Netlify Functions：處理回測任務與社群留言 API，遵守 Netlify 平台政策。",
      "Netlify Blobs：存放策略紀錄與社群留言，所有資料均加密並設有存取權限。",
      "分析工具：我們以匿名方式蒐集使用趨勢，用於產品優化，不含個人身份資訊。",
    ],
  },
  {
    title: "您的權利",
    description:
      "根據台灣個資法，您有權利查詢、閱覽、補充、停止蒐集與刪除個人資料。",
    items: [
      (
        <>
          透過 <Link href="/contact" className="underline underline-offset-4">寄信給我</Link> 頁面聯絡我們，即可行使相關權利。
        </>
      ),
      "若不同意我們蒐集的資料用途，可隨時提出停止使用要求。",
      "更新時會在本頁公開最新版本，並於社群討論區公告。",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl space-y-6">
            <Badge variant="secondary">隱私政策</Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              我們如何保護你的資料與策略成果
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              LazyBacktest 遵循資料最小化原則。以下說明我們蒐集哪些資料、如何使用、保存多久，以及你可以主張的權利。
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 space-y-10">
        {sections.map((section) => (
          <Card key={section.title} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">{section.title}</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground leading-relaxed">
                {section.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <Card className="border border-primary/30 bg-primary/5">
          <CardContent className="p-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              對隱私政策有疑問？歡迎透過 <Link href="/contact" className="underline underline-offset-4">寄信給我</Link>
              或在 <Link href="/community" className="underline underline-offset-4">社群討論</Link> 提出建議。
            </p>
            <p>
              使用平台前請同時閱讀
              <Link href="/disclaimer" className="underline underline-offset-4 mx-1">免責聲明</Link>
              ，了解投資風險與責任界線。
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  )
}
