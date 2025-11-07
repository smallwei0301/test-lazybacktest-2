"use client"

// Patch Tag: LB-WEB-20250210A
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { ArrowRight, HelpCircle, MessageCircle } from "lucide-react"

const faqSections = [
  {
    title: "入門與帳號",
    items: [
      {
        question: "LazyBacktest 真的完全免費嗎？",
        answer:
          "是的，所有核心功能包含策略回測、參數優化與批量測試都免費提供。若未來推出進階方案，我們會先在社群討論區徵求意見。",
      },
      {
        question: "需要註冊帳號才能使用嗎？",
        answer:
          "現在的版本不需要登入即可直接回測。若想保存自訂策略，建議先在股票紀錄頁建立分類，方便日後匯出。",
      },
      {
        question: "系統支援哪些股票市場？",
        answer:
          "目前支援台灣上市櫃股票，涵蓋超過 20 年的歷史日線資料。我們持續維護資料品質，確保缺漏率低於 0.1%。",
      },
    ],
  },
  {
    title: "操作與功能",
    items: [
      {
        question: "我需要有程式設計背景才能使用嗎？",
        answer:
          "完全不需要！整個流程都是圖形化介面。推薦先閱讀使用教學頁面，搭配截圖找位置，第一次操作也能一次上手。",
      },
      {
        question: "回測結果可以保證未來獲利嗎？",
        answer:
          "回測是根據歷史資料模擬，無法保證未來獲利，但可以幫助你了解策略的優缺點。記得搭配免責聲明了解風險。",
      },
      {
        question: "可以同時測試多檔股票嗎？",
        answer:
          "可以，在設定條件後勾選批次回測，系統會自動將條件套用到所有選擇的股票並彙整結果排行榜。",
      },
      {
        question: "要去哪裡查看我收藏的策略？",
        answer:
          "收藏或備註的策略會出現在股票紀錄頁。你可以透過搜尋與標籤快速整理，之後匯出成 Excel 與夥伴分享。",
      },
    ],
  },
  {
    title: "資料與安全",
    items: [
      {
        question: "資料多久更新一次？",
        answer:
          "台股資料在每個交易日結束後的凌晨自動更新。若遇到官方暫停提供資料，我們會在社群討論區公告。",
      },
      {
        question: "我的策略會被其他人看到嗎？",
        answer:
          "個人建立的策略與紀錄只會存放在你的帳號空間。只有當你主動分享到社群討論時，其他人才看得到。",
      },
      {
        question: "LazyBacktest 如何保護我的隱私？",
        answer:
          "我們只儲存提供服務必要的資料，例如策略設定、備註與聯絡方式。詳細說明請見隱私政策頁面。",
      },
      {
        question: "遇到異常或錯誤要如何回報？",
        answer:
          "請直接到寄信給我頁面使用信箱或表單聯絡我們，記得附上截圖與操作步驟，能讓工程師更快復現問題。",
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="bg-gradient-to-r from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">
              常見問題彙整
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              使用 LazyBacktest 遇到困惑？先從這裡找到答案
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              我們整理了新手最常問的問題，並加上延伸閱讀連結。若找不到答案，也可以到社群討論或寄信給我向工程師提問。
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            {faqSections.map((section) => (
              <Card key={section.title} className="border-border/60">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    {section.title}
                  </h2>
                  <Accordion type="multiple" className="space-y-2">
                    {section.items.map((item) => (
                      <AccordionItem key={item.question} value={item.question} className="border border-border/60 rounded-xl px-4">
                        <AccordionTrigger className="text-base font-semibold text-left">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>

          <aside className="space-y-6">
            <Card className="border border-primary/30 bg-primary/5">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-xl font-semibold">不知道怎麼開始？</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  跟著圖文教學頁，依照每個步驟對照圖片操作，就能在 10 分鐘內完成第一次回測。
                </p>
                <Button asChild>
                  <Link href="/tutorial" className="flex items-center gap-2">
                    前往使用教學
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  需要更多協助？
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  歡迎到 <Link href="/community" className="underline underline-offset-4">社群討論</Link> 分享問題，或直接
                  <Link href="/contact" className="underline underline-offset-4 ml-1">寄信給我</Link>。
                </p>
                <Button asChild variant="outline">
                  <Link href="/contact">聯絡工程師</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-6 text-sm text-muted-foreground leading-relaxed space-y-3">
                <p>
                  使用平台前請務必閱讀
                  <Link href="/privacy" className="underline underline-offset-4 mx-1">隱私政策</Link>
                  與
                  <Link href="/disclaimer" className="underline underline-offset-4 ml-1">免責聲明</Link>，了解資料使用與風險說明。
                </p>
                <p>
                  若想了解更多回測技巧，建議搭配
                  <Link href="/stock-records" className="underline underline-offset-4 mx-1">股票紀錄</Link>
                  功能管理你的自選清單。
                </p>
              </CardContent>
            </Card>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
