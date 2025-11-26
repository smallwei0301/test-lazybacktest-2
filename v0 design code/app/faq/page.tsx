// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "LazyBacktest 常見問題｜操作、資料與支援",
  description: "整理 LazyBacktest 使用時最常被問到的 9 個問題，包含費用、資料來源、匯出方式、股票紀錄與社群留言板說明。",
}

const faqItems = [
  {
    id: "free",
    question: "LazyBacktest 真的完全免費嗎？",
    answer:
      "是的，LazyBacktest 的核心功能（回測引擎、參數優化、AI 預測、股票紀錄）目前皆為免費開放。若日後推出付費進階版，會事先公告並保留既有免費方案。",
  },
  {
    id: "coding",
    question: "需要有程式設計背景才能使用嗎？",
    answer:
      "完全不需要。所有回測設定都採用圖形化介面，輸入股票代碼、期間與交易規則即可完成。介面也提供預設範例與提示，幫助第一次接觸回測的新手快速上手。",
  },
  {
    id: "data",
    question: "資料來源與更新頻率是什麼？",
    answer:
      "台股價格來自臺灣證券交易所與上櫃中心公開資料，再由系統透過 Netlify Functions 排程擷取。一般會在交易日晚上完成更新，遇到官方延遲時也可在回測頁面手動刷新。",
  },
  {
    id: "future",
    question: "回測結果可以保證未來獲利嗎？",
    answer:
      "回測僅根據歷史數據模擬策略表現，無法保證未來獲利。建議把績效指標（年化報酬、最大回檔、勝率等）視為決策參考，並搭配風險管理與停損條件。",
  },
  {
    id: "market",
    question: "目前支援哪些市場或商品？",
    answer:
      "目前主力支援台灣上市櫃股票與 ETF，並提供 20 年以上的歷史資料。若有特別的美股或指數需求，可透過寄信功能回報，我們會依需求評估是否開放。",
  },
  {
    id: "batch",
    question: "批量優化功能可以怎麼用？",
    answer:
      "批量優化會自動跑多組參數組合，替您找出在指定期間表現較好的策略。啟動後可以隨時暫停或調整條件，建議先鎖定少量核心變數（例如進出場條件與停損），再進一步擴充。",
  },
  {
    id: "export",
    question: "回測或交易紀錄可以匯出嗎？",
    answer:
      "在回測頁面切換至「交易記錄」即可下載 CSV，方便導入 Excel 或 Google 試算表。若要整理多支股票，可先把結果匯入「股票紀錄」頁面再匯出整體報表。",
  },
  {
    id: "records",
    question: "股票紀錄資料存在哪裡？會不會消失？",
    answer:
      "股票紀錄會儲存在您瀏覽器的本地端（LocalStorage），不會上傳到雲端。建議定期匯出備份，或在不同裝置同步時使用匯入功能，避免清除瀏覽器資料時遺失。",
  },
  {
    id: "community",
    question: "社群討論留言板如何運作？",
    answer:
      "社群討論頁的貼文會寫入 Netlify Blobs 雲端儲存，所有使用者都能看到最新留言。發文前請先閱讀留言規範，並避免提供任何個資或投資建議。",
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/faq" />
      <main>
        <section className="border-b bg-gradient-to-r from-primary/10 via-background to-accent/10 py-20">
          <div className="container mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              FAQ
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">常見問題一次看懂</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              照著這份 FAQ 操作，您可以快速定位到對應的功能頁：使用教學、股票紀錄、社群討論與寄信支援都在底下有連結。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <Link href="/guide" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                我想看圖解教學
              </Link>
              <Link href="/stock-records" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                整理我的股票紀錄
              </Link>
              <Link href="/community" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                與其他使用者討論
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <Card className="mx-auto max-w-4xl border-border/60 shadow-sm">
            <CardContent className="px-4 py-6 md:px-8 md:py-10">
              <Accordion type="single" collapsible className="space-y-3">
                {faqItems.map((item) => (
                  <AccordionItem key={item.id} value={item.id} className="rounded-lg border border-border/60 px-4">
                    <AccordionTrigger className="text-left text-base font-semibold text-foreground">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-foreground">還想了解更多嗎？</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                參考完 FAQ 後，可以繼續閱讀
                <Link href="/privacy" className="text-primary underline-offset-4 hover:underline"> 隱私政策</Link>
                與
                <Link href="/disclaimer" className="text-primary underline-offset-4 hover:underline"> 免責聲明</Link>
                ，瞭解我們如何保護資料與使用範圍。如需個別協助，歡迎
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
