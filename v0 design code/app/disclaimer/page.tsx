import type { Metadata } from "next"
import SiteFooter, { FOOTER_BUILD_ID } from "@/components/site-footer"

const PAGE_URL = "https://lazybacktest.com/disclaimer"

export const metadata: Metadata = {
  title: "LazyBacktest 免責聲明｜投資風險、資料準確度與使用限制",
  description:
    "LazyBacktest 免責聲明詳細說明：資料僅供教育用途、不保證未來獲利、使用者需自行負責投資決策，以及我們如何維護資料準確度。",
  keywords: [
    "LazyBacktest 免責聲明",
    "LazyBacktest 投資風險",
    "LazyBacktest 法律聲明",
    "LazyBacktest 教學用途",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    url: PAGE_URL,
    title: "LazyBacktest 免責聲明",
    description: "了解使用 LazyBacktest 時需要遵守的風險揭露與法律聲明。",
    locale: "zh_TW",
    siteName: "LazyBacktest",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "LazyBacktest 免責聲明",
    description: "我們提供的所有資訊僅供教育與研究用途，不構成投資建議。",
  },
  other: {
    "geo.region": "TW",
    "geo.placename": "Taipei",
    "geo.position": "25.0330;121.5654",
    ICBM: "25.0330, 121.5654",
    "lazybacktest:build": FOOTER_BUILD_ID,
  },
}

const disclaimerJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "LazyBacktest 免責聲明",
  url: PAGE_URL,
  description:
    "LazyBacktest 提供的資料僅供教育與研究用途，使用者需自行承擔投資風險。",
  inLanguage: "zh-TW",
  isPartOf: {
    "@type": "WebSite",
    name: "LazyBacktest",
    url: "https://lazybacktest.com",
  },
}

const sections = [
  {
    title: "一、教育與研究用途",
    content:
      "LazyBacktest 提供的所有回測數據、策略範例與說明內容僅供教育與研究用途，目的在於協助使用者理解歷史回測的運作方式。",
  },
  {
    title: "二、不保證未來績效",
    content:
      "回測結果僅反映過去行情，無法保證未來獲利。實際投資時可能因市場波動、交易成本或流動性等因素而產生差異。",
  },
  {
    title: "三、使用者自行負責",
    content:
      "使用者應自行評估投資決策的適當性與風險承受度。對於使用 LazyBacktest 所產生的任何損失，本服務不承擔法律或金錢責任。",
  },
  {
    title: "四、資料來源與準確度",
    content:
      "我們使用公開市場資料並定期檢查異常，但仍可能因官方修正或網路傳輸造成延遲與誤差。若發現資料問題，請立即通知我們。",
  },
  {
    title: "五、第三方連結",
    content:
      "網站可能包含第三方連結或廣告，該內容不代表 LazyBacktest 立場，請使用者自行判斷其正確性與合法性。",
  },
  {
    title: "六、政策更新",
    content:
      "本免責聲明可能依法規或服務調整而更新，請定期回來查看最新內容。重大變更將於首頁或 Email 提醒。",
  },
]

export default function DisclaimerPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="mx-auto mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Disclaimer
          </p>
          <h1 className="text-4xl font-bold text-foreground">LazyBacktest 免責聲明</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            使用 LazyBacktest 前，請先了解本服務的使用範圍與風險揭露。我們尊重每位投資人的自主判斷，也提醒您遵守當地法規與券商規定。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <article className="mx-auto max-w-4xl space-y-10 text-sm leading-relaxed text-muted-foreground">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border bg-card/70 px-6 py-6 text-left text-base text-foreground">
              <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{section.content}</p>
            </section>
          ))}

          <section className="rounded-3xl bg-primary/10 p-8 text-sm text-muted-foreground">
            <h2 className="text-xl font-semibold text-foreground">聯絡方式</h2>
            <p className="mt-2">
              若對本免責聲明有疑問，歡迎寄信至
              <a href="mailto:smallwei0301@gmail.com" className="text-primary underline-offset-2 hover:underline">
                smallwei0301@gmail.com
              </a>
              。我們會在 30 日內回覆。
            </p>
            <p className="mt-2">最後更新日期：2024 年 11 月 15 日</p>
          </section>
        </article>
      </main>

      <SiteFooter tone="light" />

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(disclaimerJsonLd) }}
      />
    </div>
  )
}
