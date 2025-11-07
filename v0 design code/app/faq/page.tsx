// Page Version: LB-FE-20250304A

import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { HelpCircle, Mail, Users } from "lucide-react"
import SiteFooter from "@/components/site-footer"

export const metadata: Metadata = {
  title: "常見問題｜LazyBacktest 懶人回測",
  description: "整理 LazyBacktest 使用者最關心的問題，包含費用、資料來源、策略設定與帳號相關資訊。",
}

const faqGroups = [
  {
    title: "平台與費用",
    items: [
      {
        question: "LazyBacktest 真的完全免費嗎？",
        answer:
          "是的，LazyBacktest 的核心功能目前完全免費，包含雲端回測、參數優化、策略組合與回測報告匯出。若未來有付費方案，也會事先公告並提供免費方案持續使用。",
      },
      {
        question: "需要註冊帳號或綁定信用卡嗎？",
        answer:
          "目前不需要註冊帳號即可試跑範例策略，若要儲存自訂策略，可使用社群帳號登入，過程不會要求輸入信用卡或任何金流資訊。",
      },
      {
        question: "平台如何維持營運？",
        answer:
          "網站透過贊助支持、社群協作與自動化維護降低成本。若想支持開發，可以到頁面底部的 Donate 區塊贊助，或分享給更多投資朋友。",
      },
    ],
  },
  {
    title: "資料與準確度",
    items: [
      {
        question: "歷史資料來源是什麼？",
        answer:
          "台股資料主要來自公開市場 API，並透過 Netlify Functions 與快取機制每日更新。我們會針對上市櫃股票進行資料比對，確保 99% 以上的正確性。",
      },
      {
        question: "資料多久更新一次？",
        answer:
          "台股日線資料會在交易日收盤後自動更新，通常當天晚間 7 點前就能同步。若遇到官方 API 延遲，我們會在社群討論區公告最新進度。",
      },
      {
        question: "回測結果可以保證未來獲利嗎？",
        answer:
          "回測是利用歷史資料模擬策略表現，無法保證未來獲利。建議搭配風險管理、並持續關注市場變化。下單前請務必再次自行評估，詳見免責聲明。",
      },
    ],
  },
  {
    title: "操作與策略",
    items: [
      {
        question: "我需要會寫程式才能設定策略嗎？",
        answer:
          "不用！所有策略都可以透過拖拉式的圖形介面設定，從選指標、輸入參數到加上風險控管，全程不需寫一行程式。",
      },
      {
        question: "可以同時測試多種策略嗎？",
        answer:
          "可以。利用批量優化功能一次輸入多組參數，系統會在雲端排隊計算，再用績效排序告訴你哪一組勝率最高。",
      },
      {
        question: "如何快速確認策略設定是否合理？",
        answer:
          "建議先在使用教學裡照著步驟跑一次，再查看常見的績效指標。若還是不確定，可以把策略貼到社群討論區，讓其他投資人幫忙檢視。",
      },
    ],
  },
  {
    title: "帳號與支援",
    items: [
      {
        question: "遇到問題要如何聯絡你們？",
        answer:
          "可直接到寄信給我頁面，使用表單或寄信到 smallwei0301@gmail.com。我們會在 2 個工作天內回覆。",
      },
      {
        question: "可以在哪裡跟其他使用者交流？",
        answer:
          "歡迎加入社群討論區，留言會儲存在雲端，所有使用者都可以看到最新動態，也能即時分享策略心得。",
      },
      {
        question: "資料隱私如何保護？",
        answer:
          "所有回測設定皆儲存在 Netlify 的安全環境，敏感資料會採匿名方式處理。詳細作法請參考隱私政策。",
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-10">
          <Badge variant="outline" className="mb-4 border-primary text-primary">
            FAQ Q&A
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">常見問題一次看懂</h1>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            以下整理了首頁最常被詢問的問題，並補充更多使用者關心的細節。如果還是找不到答案，歡迎到<Link
              href="/community"
              className="mx-1 underline text-primary"
            >社群討論區</Link>發問，或是透過<Link href="/contact" className="mx-1 underline text-primary">寄信給我</Link>獲得一對一協助。
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-10">
        {faqGroups.map((group) => (
          <section key={group.title} className="space-y-6">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground">{group.title}</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {group.items.map((item) => (
                <Card key={item.question} className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        <Alert className="border-primary/40 bg-primary/5">
          <AlertDescription className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
            <span>
              <Mail className="mr-2 inline h-4 w-4 text-primary" />
              還有疑問？請前往<Link href="/contact" className="mx-1 underline text-primary">寄信給我</Link>，描述你的需求，我們會在 2 個工作天內回覆。
            </span>
            <span>
              <Users className="mr-2 inline h-4 w-4 text-primary" />
              想看其他投資人的實戰經驗？到<Link href="/community" className="mx-1 underline text-primary">社群討論</Link>，留言會存放在雲端，隨時可以補充或追蹤回覆。
            </span>
            <span>
              使用 LazyBacktest 表示你已同意<Link href="/privacy" className="mx-1 underline text-primary">隱私政策</Link>與<Link
                href="/disclaimer"
                className="mx-1 underline text-primary"
              >免責聲明</Link>中的說明，請務必詳讀。
            </span>
          </AlertDescription>
        </Alert>
      </main>

      <SiteFooter theme="light" showDonate={false} />
    </div>
  )
}
