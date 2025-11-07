import type { Metadata } from "next"
import SiteFooter, { FOOTER_BUILD_ID } from "@/components/site-footer"

const PAGE_URL = "https://lazybacktest.com/privacy"

export const metadata: Metadata = {
  title: "LazyBacktest 隱私政策｜資料保護、Cookie、第三方服務說明",
  description:
    "LazyBacktest 重視使用者個資保護：了解我們如何處理帳號資訊、交易紀錄、Cookie、第三方服務與資料安全措施，內容完全符合台灣個資法與 Google Ads 條款。",
  keywords: [
    "LazyBacktest 隱私政策",
    "LazyBacktest 資料安全",
    "LazyBacktest Cookie",
    "LazyBacktest GDPR",
    "LazyBacktest Google Ads",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    url: PAGE_URL,
    title: "LazyBacktest 隱私政策",
    description: "瞭解 LazyBacktest 如何收集、使用與保護您的資料，並確保符合相關法規。",
    locale: "zh_TW",
    siteName: "LazyBacktest",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "LazyBacktest 隱私政策",
    description: "清楚說明資料收集、使用與保護方式。",
  },
  other: {
    "geo.region": "TW",
    "geo.placename": "Taipei",
    "geo.position": "25.0330;121.5654",
    ICBM: "25.0330, 121.5654",
    "lazybacktest:build": FOOTER_BUILD_ID,
  },
}

const privacyJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "LazyBacktest 隱私政策",
  url: PAGE_URL,
  description:
    "說明 LazyBacktest 如何收集、使用與保護使用者資料，包括 Cookie 與第三方服務的使用方式。",
  inLanguage: "zh-TW",
  isPartOf: {
    "@type": "WebSite",
    name: "LazyBacktest",
    url: "https://lazybacktest.com",
  },
}

const sections = [
  {
    title: "一、我們蒐集的資料",
    items: [
      "聯絡資訊：如您主動寄信、填寫聯絡表單，可能會蒐集姓名、Email 與問題描述。",
      "使用紀錄：為了優化功能，我們會匿名統計使用狀況，例如常用策略類型與操作流程。",
      "裝置資訊：透過 Cookie 與分析工具記錄瀏覽器版本、語系與設備類型，協助改善使用體驗。",
    ],
  },
  {
    title: "二、資料使用目的",
    items: [
      "提供與維護 LazyBacktest 回測服務，包含歷史資料、策略設定與績效檢視。",
      "寄送服務通知，例如系統更新、維護公告或資料來源異動。",
      "分析使用行為以改善介面與功能，確保符合多數使用者的操作習慣。",
    ],
  },
  {
    title: "三、Cookie 與第三方工具",
    items: [
      "Google Analytics：用於匿名分析使用者操作路徑，不會識別個人身份，可於瀏覽器停用。",
      "Google Ads：若未來投放廣告，僅會依興趣分類顯示相關內容，不會分享任何個人資料給廣告主。",
      "Netlify：網站託管平台僅記錄必要的伺服器日誌，確保網站穩定運作。",
    ],
  },
  {
    title: "四、資料安全措施",
    id: "data-security",
    items: [
      "採用 HTTPS 加密連線，確保資料傳輸安全。",
      "限制內部存取權限，僅授權負責維護系統的成員使用匿名化資料。",
      "定期備份系統設定並檢查第三方套件資安更新。",
    ],
  },
  {
    title: "五、您的權利",
    items: [
      "查詢與閱覽：您可隨時來信索取個人資料使用說明。",
      "補充或更正：若資料有誤，歡迎通知我們修正。",
      "停止蒐集、處理或利用：可於任何時間請求刪除個人資料，我們會在合理時間內完成。",
    ],
  },
  {
    title: "六、政策更新",
    items: [
      "本政策若有修改，會於頁面上標示最新更新日期並公告主要變更重點。",
      "重大變更時，將透過 Email 或網站通知。",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="mx-auto mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Privacy Policy
          </p>
          <h1 className="text-4xl font-bold text-foreground">LazyBacktest 隱私政策</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            我們承諾遵守台灣個資法、GDPR 與 Google Ads 相關規範，所有資料皆僅用於提供回測服務與改善體驗，不會未經允許販售或轉讓給第三方。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <article className="mx-auto max-w-4xl space-y-12 leading-relaxed">
          {sections.map((section) => (
            <section key={section.title} id={section.id}>
              <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item} className="rounded-2xl border bg-card/70 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-3xl bg-primary/10 p-8 text-sm text-muted-foreground">
            <h2 className="text-2xl font-semibold text-foreground">聯絡我們</h2>
            <p className="mt-3">
              若對本政策有任何疑問，請寄信至
              <a href="mailto:smallwei0301@gmail.com" className="text-primary underline-offset-2 hover:underline">
                smallwei0301@gmail.com
              </a>
              。我們將在 30 日內回覆。
            </p>
            <p className="mt-2">最後更新日期：2024 年 11 月 15 日</p>
          </section>
        </article>
      </main>

      <SiteFooter tone="light" />

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(privacyJsonLd) }}
      />
    </div>
  )
}
