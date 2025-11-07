import type { Metadata } from "next"
import Image from "next/image"
import { ArrowRight, BarChart3, CheckCircle2, Clock, PlayCircle, ShieldCheck } from "lucide-react"
import SiteFooter, { FOOTER_BUILD_ID } from "@/components/site-footer"

const PAGE_URL = "https://lazybacktest.com/usage-guide"

export const metadata: Metadata = {
  title: "LazyBacktest 使用教學｜五步驟完成台股回測",
  description:
    "一步步帶你完成 LazyBacktest 股票回測：從建立帳號、選股、設定進出場規則，到解讀績效報表與風險指標，還附上批量優化與常見操作小技巧。",
  keywords: [
    "LazyBacktest 教學",
    "股票回測教學",
    "台股回測步驟",
    "批量優化說明",
    "投資策略驗證",
  ],
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    url: PAGE_URL,
    title: "LazyBacktest 使用教學｜五步驟完成台股回測",
    description:
      "5 個步驟完成 LazyBacktest 回測，搭配圖解與小提醒，帶你從第一次操作就上手。",
    locale: "zh_TW",
    siteName: "LazyBacktest",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "LazyBacktest 使用教學",
    description: "台股回測快速上手指南，含批量優化與風險控管技巧。",
  },
  other: {
    "geo.region": "TW",
    "geo.placename": "Taipei",
    "geo.position": "25.0330;121.5654",
    ICBM: "25.0330, 121.5654",
    "lazybacktest:build": FOOTER_BUILD_ID,
  },
}

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "LazyBacktest 回測快速上手指南",
  description:
    "利用 LazyBacktest 進行台股歷史回測的完整流程，從輸入股票、設定策略到檢視績效報告。",
  totalTime: "PT15M",
  supply: [
    { "@type": "HowToSupply", name: "LazyBacktest 帳號（選填，可使用訪客模式）" },
    { "@type": "HowToSupply", name: "台股標的代號" },
  ],
  tool: [
    { "@type": "HowToTool", name: "LazyBacktest 回測介面" },
  ],
  step: [
    {
      "@type": "HowToStep",
      name: "輸入股票代號與日期",
      text: "在 LazyBacktest 首頁輸入想測試的股票，選擇回測區間與初始資金。",
    },
    {
      "@type": "HowToStep",
      name: "設定進出場條件",
      text: "選擇要使用的技術指標、買賣邏輯與風險控制方式。",
    },
    {
      "@type": "HowToStep",
      name: "檢查交易成本與資金配置",
      text: "確認手續費、滑價、持有部位上限與停損停利設定。",
    },
    {
      "@type": "HowToStep",
      name: "執行回測與檢視績效",
      text: "點擊開始回測，查看總報酬、最大回撤、勝率等關鍵指標。",
    },
    {
      "@type": "HowToStep",
      name: "使用批量優化",
      text: "若想比較多種策略，可啟用批量優化一次跑多組參數。",
    },
  ],
}

const steps = [
  {
    title: "Step 1｜輸入股票與回測區間",
    description:
      "在首頁輸入股票代號或從熱門清單選擇標的，設定回測起迄日期與初始資金，系統會自動帶出支援的資料區間。",
    icon: PlayCircle,
    tip: "若想一次測試多檔股票，可到『股票紀錄』頁面建立自選清單。",
  },
  {
    title: "Step 2｜設定策略條件",
    description:
      "從技術指標、均線、價量條件或財報指標中挑選進出場規則。你可以先套用範例策略，再逐步調整參數。",
    icon: ShieldCheck,
    tip: "針對波段策略，可搭配停損停利與持有天數限制降低回撤。",
  },
  {
    title: "Step 3｜檢查交易成本",
    description:
      "確認手續費、交易稅與滑價設定是否符合自己的券商條件，必要時調整資金配置與部位上限。",
    icon: Clock,
    tip: "懶得計算的話，可以使用預設的台股證券交易費率，已含手續費與證交稅。",
  },
  {
    title: "Step 4｜執行回測並解讀報表",
    description:
      "點擊『開始回測』後，系統會生成交易清單、績效曲線與 KPI 摘要。留意總報酬、最大回撤、勝率與夏普值。",
    icon: BarChart3,
    tip: "看到異常績效時，記得檢查是否過度最佳化或資料期間過短。",
  },
  {
    title: "Step 5｜保存與分享成果",
    description:
      "將策略儲存在『股票紀錄』或匯出報表給夥伴參考，方便下次回來快速載入。",
    icon: CheckCircle2,
    tip: "點擊『匯出報表』可下載 CSV 或 PDF，方便備份與研究。",
  },
]

const proTips = [
  {
    title: "即時檢查風險",
    description:
      "回測完成後，先看最大回撤與單筆虧損。若你的心理停損無法承受，代表策略還需調整。",
    icon: ShieldCheck,
  },
  {
    title: "善用批量優化",
    description:
      "批量優化可以一次測試多組參數組合，透過績效排序快速找到穩定表現的設定。",
    icon: Clock,
  },
  {
    title: "建立策略紀錄",
    description:
      "把跑過的結果存到『股票紀錄』，系統會幫你記錄買入價、賣出價與備註，方便之後檢討。",
    icon: ArrowRight,
  },
]

export default function UsageGuidePage() {
  return (
    <div className="bg-background text-foreground">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="absolute inset-0 opacity-30">
          <Image
            src="/clean-simple-charts-and-graphs-showing-performance.jpg"
            alt="LazyBacktest 回測畫面示意"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative z-10">
          <div className="container mx-auto px-4 py-24">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                Step-by-step Tutorial
              </p>
              <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                15 分鐘了解 LazyBacktest：從設定策略到解讀報表
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                第一次使用回測工具也不用怕！按照下列步驟操作，你就能用真實歷史資料驗證自己的投資想法，並為 Google Ads 與 SEO 合規打好基礎。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <section className="mx-auto max-w-5xl space-y-10 py-16">
          <div className="rounded-3xl border bg-card/60 p-8 shadow-sm backdrop-blur">
            <h2 className="text-2xl font-semibold text-foreground">LazyBacktest 操作流程總覽</h2>
            <p className="mt-3 text-muted-foreground">
              以下教學以台灣上市櫃股票為例，所有介面皆符合 Google Ads 內容政策，未涉及高風險保證獲利宣稱。請依照自身風險承受度進行調整。
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {steps.map(({ title, description, icon: Icon, tip }) => (
              <div key={title} className="relative overflow-hidden rounded-2xl border bg-card/80 p-6 shadow-sm transition-transform hover:-translate-y-1">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-card-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                    <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent" role="note">
                      小提醒：{tip}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="batch-optimization" className="mx-auto max-w-5xl py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-3xl font-bold text-foreground">批量優化｜一次比較上百種參數</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                批量優化功能可以讓你設定多組參數範圍，LazyBacktest 會自動排列組合並依據報酬、風險與穩定度排序。適合想快速找出最佳策略的新手，也適用於想做參數敏感度分析的進階使用者。
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>可針對均線天數、指標閾值、停損幅度等設定自訂範圍，系統會逐一測試並彙整。</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>結果頁會顯示各組策略的總報酬、最大回撤與勝率，方便快速篩選。</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>建議先以較小的參數區間測試，避免過度最佳化造成未來績效落差。</span>
                </li>
              </ul>
            </div>
            <div className="relative h-80 overflow-hidden rounded-3xl border bg-card/70 shadow-lg">
              <Image
                src="/automatic-optimization-engine-with-ai-sparkles-fin.jpg"
                alt="批量優化操作示意圖"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl py-16">
          <div className="rounded-3xl border bg-card/80 p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-foreground">回測完成後的三個檢查重點</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {proTips.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-2xl border bg-background/80 p-6 text-sm leading-relaxed text-muted-foreground">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              提醒：LazyBacktest 只提供歷史模擬結果，實際投資時仍需自行判斷與承擔風險。本教學僅供教育用途，完全符合 Google Ads 金融內容規範。
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl py-16">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 p-10 text-center">
            <h2 className="text-3xl font-bold text-foreground">準備好開始第一個回測了嗎？</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              立即前往 LazyBacktest App，親手驗證自己的策略。若在操作過程遇到任何問題，歡迎到社群討論區留言或寄信給我們。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/app/index.html"
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                立即開始回測
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/community"
                className="inline-flex items-center rounded-full border border-primary px-6 py-3 text-base font-medium text-primary transition-colors hover:bg-primary/10"
              >
                到社群討論區看看
              </a>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter tone="dark" />

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
    </div>
  )
}
