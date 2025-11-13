// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "LazyBacktest 使用教學｜6 個步驟完成回測",
  description: "透過圖解學會 LazyBacktest 的所有功能：從一鍵回測、進階參數設定、風險管理到 AI 預測與紀錄比對。",
}

const steps = [
  {
    id: 1,
    title: "啟動一鍵回測，熟悉操作節奏",
    description:
      "在回測頁面頂部可以看到「一鍵回測」按鈕與可編輯的股票欄位。先讓系統替您跑一遍預設範例（台積電），確認畫面會自動切換到結果區塊。之後只要點擊股票名稱即可改成自己的目標標的。",
    image: "/guide/step-1.svg",
    tip: "如果不知道該從哪支股票開始，點選欄位旁的提示文字即可呼叫內建的台股代碼搜尋器。",
    links: [
      { href: "/backtest", label: "前往股票回測頁", emphasis: true },
      { href: "/faq", label: "查看快速入門常見問題" },
    ],
  },
  {
    id: 2,
    title: "調整基本設定：股票代號、期間與資金",
    description:
      "進入「基本設定」分頁後，依序輸入股票代碼、回測起訖日期以及初始資金。LazyBacktest 預設顯示最近三年的台股交易日，您也可以直接從下拉選單套用常用期間。",
    image: "/guide/step-2.svg",
    tip: "設定完成後按下「套用最近 N 年」能快速切換測試範圍，記得每次修改都要再次執行回測以更新結果。",
    links: [
      { href: "/faq", label: "常見日期與交易日計算方式" },
    ],
  },
  {
    id: 3,
    title: "完整設定交易成本與風險控管",
    description:
      "在基本設定卡片下方可以找到「交易成本」與「風險管理」區塊，分別對應手續費、交易稅、停損停利與最大持股金額。所有欄位都支援即時調整，數值會同步帶入後續策略計算。",
    image: "/guide/step-3.svg",
    tip: "若策略包含分批買進或資金控管，建議先在這裡設定好停損停利條件，避免回測結果與實際操作落差太大。",
    links: [
      { href: "/privacy", label: "了解我們如何保護設定資料" },
    ],
  },
  {
    id: 4,
    title: "切換到績效分析與交易明細",
    description:
      "回測完成後，使用上方的標籤切換至「績效分析」與「交易記錄」。前者會顯示年化報酬、勝率、最大回檔等指標，後者則逐筆列出買賣明細，方便輸出 CSV 或人工對帳。",
    image: "/guide/step-4.svg",
    tip: "建議先確認績效指標是否符合策略邏輯，再下載交易紀錄留存，避免只看最終報酬而忽略中間波動。",
    links: [
      { href: "/stock-records", label: "把交易結果同步到股票紀錄" },
    ],
  },
  {
    id: 5,
    title: "儲存策略組合並進行紀錄比較",
    description:
      "在右側「策略面板」可以將當前參數儲存為自訂方案，或載入過去的最佳組合。利用紀錄 A、紀錄 B 可以快速對照不同設定的績效差異，並將結果匯出供團隊討論。",
    image: "/guide/step-5.svg",
    tip: "儲存前記得為策略命名並加入備註，日後在股票紀錄頁面就能更快回顧每次調整的目的。",
    links: [
      { href: "/community", label: "把策略分享至社群討論" },
    ],
  },
  {
    id: 6,
    title: "啟用 AI 預測與批量優化功能",
    description:
      "想同時測試多組條件時，開啟「AI 預測」或「批量優化」區塊。系統會針對進出場規則、持股天數與風險參數進行自動調校，並以報酬率排序方便挑選。",
    image: "/guide/step-6.svg",
    tip: "批量優化需要較長運算時間，建議先鎖定兩到三個核心條件再啟動，並隨時留意上方進度條。",
    links: [
      { href: "/faq", label: "批量優化常見疑問" },
      { href: "/contact", label: "需要協助？寄信給我們" },
    ],
  },
]

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/guide" />
      <main>
        <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20 lg:py-28">
          <div className="absolute inset-0 opacity-10">
            <div className="mx-auto h-full max-w-6xl rounded-full bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.35),_transparent_70%)]" />
          </div>
          <div className="container relative mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              Step by Step 教學
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">6 個步驟，完整掌握 LazyBacktest</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              每張圖都標記了功能所在的位置，依照順序操作就能完成回測、儲存紀錄並啟用 AI 優化。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <Link href="/backtest" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                直接進入回測頁面
              </Link>
              <Link href="/stock-records" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                管理我的股票紀錄
              </Link>
              <Link href="/community" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                加入社群討論經驗
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid gap-8">
            {steps.map((step) => (
              <Card key={step.id} className="border-border/60 shadow-sm transition-shadow hover:shadow-lg">
                <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-6">
                  <Badge variant="outline" className="self-start border-primary/60 text-primary">
                    STEP {step.id}
                  </Badge>
                  <CardTitle className="text-2xl text-foreground">{step.title}</CardTitle>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center">
                  <div className="order-2 space-y-4 lg:order-1">
                    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                      <strong className="block text-foreground">提醒：</strong>
                      <span className="text-foreground">{step.tip}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {step.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`rounded-md border px-3 py-1.5 transition-colors ${
                            link.emphasis
                              ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                              : "border-border hover:border-primary hover:text-primary"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="order-1 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:order-2">
                    <Image
                      src={step.image}
                      alt={`${step.title} 示意圖`}
                      width={960}
                      height={540}
                      className="h-auto w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-3xl font-bold text-foreground">下一步：把策略變成可重複的流程</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                完成上述 6 個步驟後，別忘了把重要成果備份到「股票紀錄」，並在社群討論區分享心得。遇到問題時，也可以先查閱
                <Link href="/faq" className="text-primary underline-offset-4 hover:underline"> 常見問題</Link>
                ，或直接
                <Link href="/contact" className="text-primary underline-offset-4 hover:underline"> 寄信給我</Link>
                。
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
