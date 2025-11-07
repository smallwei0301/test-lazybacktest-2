import type { Metadata } from "next"
import SiteFooter, { FOOTER_BUILD_ID } from "@/components/site-footer"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const PAGE_URL = "https://lazybacktest.com/faq"

export const metadata: Metadata = {
  title: "LazyBacktest 常見問題｜台股回測、資料更新、隱私政策一次看",
  description:
    "整理 LazyBacktest 最常被問到的問題：資料來源、使用費用、如何匯出報表、資料更新頻率、隱私與安全、Google Ads 合規聲明與常見操作疑問。",
  keywords: [
    "LazyBacktest 常見問題",
    "LazyBacktest FAQ",
    "台股回測問題",
    "LazyBacktest 資料來源",
    "LazyBacktest 隱私政策",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    url: PAGE_URL,
    title: "LazyBacktest 常見問題",
    description:
      "回答使用 LazyBacktest 進行台股回測時的常見疑問，從費用、功能到資料安全一次搞懂。",
    locale: "zh_TW",
    siteName: "LazyBacktest",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "LazyBacktest 常見問題",
    description: "回測教學、資料來源與安全性一次搞懂。",
  },
  other: {
    "geo.region": "TW",
    "geo.placename": "Taipei",
    "geo.position": "25.0330;121.5654",
    ICBM: "25.0330, 121.5654",
    "lazybacktest:build": FOOTER_BUILD_ID,
  },
}

const faqSections = [
  {
    title: "入門操作",
    items: [
      {
        question: "LazyBacktest 真的完全免費嗎？",
        answer:
          "是的，LazyBacktest 所有核心功能皆為免費使用，也沒有隱藏的付費方案。若想支持開發者，可以透過 footer 的贊助連結斗內。",
      },
      {
        question: "需要會寫程式才能使用嗎？",
        answer:
          "完全不需要。所有策略設定都透過中文圖形介面完成，新手可以先套用範例策略，再依照需求調整參數。",
      },
      {
        question: "可以一次測試多檔股票嗎？",
        answer:
          "可以。到『股票紀錄』建立自選清單後，就能快速切換標的或批次執行回測。批量優化功能也支援一次測試多組參數。",
      },
    ],
  },
  {
    title: "資料與技術",
    items: [
      {
        question: "資料來源與更新頻率是什麼？",
        answer:
          "台股歷史資料來源為證交所及櫃買中心的公開資訊，每日交易日晚上會自動更新。若遇到官方延遲，我們會在 24 小時內補齊。",
      },
      {
        question: "回測支援哪些商品？",
        answer:
          "目前支援台灣上市櫃股票與 ETF，涵蓋 20 年以上的日線資料。我們正在規劃指數與美股資料，會在社群公告最新進度。",
      },
      {
        question: "批量優化會不會過度最佳化？",
        answer:
          "批量優化提供大量組合比較，請搭配樣本外測試與風險指標一同評估。建議保留至少 20% 的資料作為驗證區間，避免過度貼合歷史行情。",
      },
    ],
  },
  {
    title: "報表與匯出",
    items: [
      {
        question: "可以匯出回測結果嗎？",
        answer:
          "可以，在回測結果頁面點選『匯出報表』即可下載 CSV 或 PDF，方便與夥伴分享或自行整理。",
      },
      {
        question: "可以看到每筆交易的明細嗎？",
        answer:
          "可以。報表會列出每一筆交易的買入價、賣出價、報酬率與持有天數，還能切換簡潔模式或完整模式。",
      },
      {
        question: "如何確認績效有穩定性？",
        answer:
          "建議觀察最大回撤、年化報酬、夏普值與每年績效分佈。策略若在不同年份都能維持正報酬，就代表穩定度較高。",
      },
    ],
  },
  {
    title: "帳號與隱私",
    items: [
      {
        question: "我的策略資料會被分享出去嗎？",
        answer:
          "不會。所有策略設定與回測結果都儲存在你的瀏覽器或帳戶中，除非你主動分享，否則我們無法存取。詳情請參考《隱私政策》。",
      },
      {
        question: "LazyBacktest 是否符合 Google Ads 政策？",
        answer:
          "我們遵循 Google Ads 金融服務政策，頁面僅提供教育資訊，不保證獲利，也不販售高風險商品。",
      },
      {
        question: "遇到問題可以找誰協助？",
        answer:
          "歡迎寄信到 smallwei0301@gmail.com，或到社群討論區留言。工作日會在 1-2 個工作天內回覆。",
      },
    ],
  },
]

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqSections.flatMap((section) =>
    section.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  ),
}

export default function FaqPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="mx-auto mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            Frequently Asked Questions
          </p>
          <h1 className="text-4xl font-bold text-foreground">LazyBacktest 常見問題整理</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            收集首頁與客服最常收到的提問，並補充更多深入說明。所有回答皆以教育與資訊為主，不構成投資建議，亦符合 Google Ads 內容政策。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          {faqSections.map((section, index) => (
            <section key={section.title} className={index > 0 ? "mt-12" : undefined}>
              <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
              <Accordion type="single" collapsible className="mt-6 space-y-3">
                {section.items.map((item) => (
                  <AccordionItem
                    key={item.question}
                    value={item.question}
                    className="overflow-hidden rounded-2xl border bg-card/70 px-4"
                  >
                    <AccordionTrigger className="text-left text-base font-medium text-card-foreground">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}

          <section className="mt-16 rounded-3xl bg-primary/10 p-10 text-center">
            <h2 className="text-2xl font-semibold text-foreground">沒有找到答案嗎？</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              你可以寄信給我們，或到社群討論區發問。我們會持續更新此頁面，確保符合最新的 SEO 與使用者需求。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
              <a
                href="mailto:smallwei0301@gmail.com"
                className="rounded-full bg-primary px-5 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                寄信給 LazyBacktest
              </a>
              <a
                href="/community"
                className="rounded-full border border-primary px-5 py-2 text-primary transition-colors hover:bg-primary/10"
              >
                前往社群討論區
              </a>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter tone="dark" />

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}
