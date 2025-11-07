// Patch Tag: LB-WEB-20250210A
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { Lightbulb, ArrowRight, CheckCircle } from "lucide-react"

const steps = [
  {
    title: "步驟 1：從首頁點擊立即開始",
    description:
      "在首頁找到「進入回測 App」按鈕，點擊後會開啟回測主畫面。此按鈕位於首頁英雄區域中央，非常顯眼。",
    image: "/simple-graphical-user-interface-with-buttons-and-c.jpg",
    tip: "如果還沒準備好自己的策略，也可以先從首頁的範例策略開始體驗。",
    linkLabel: "回到首頁",
    link: "/",
  },
  {
    title: "步驟 2：挑選想要回測的股票",
    description:
      "在左側的股票清單輸入股票代號或名稱，系統會自動帶出建議。選擇後加入清單，畫面右側會同步顯示目前已選的股票。",
    image: "/person-selecting-stocks-from-taiwan-stock-market-l.jpg",
    tip: "善用搜尋欄下方的「熱門族群」快速帶入最近常被討論的標的。",
    linkLabel: "先整理股票紀錄",
    link: "/stock-records",
  },
  {
    title: "步驟 3：設定策略條件與參數區間",
    description:
      "在策略設定區，每個條件都有滑桿或輸入框。LazyBacktest 會自動將您設定的上下限拆成多個組合跑完所有參數。",
    image: "/person-confused-by-many-parameter-options.jpg",
    tip: "可以先勾選系統推薦的參數範圍，再微調成自己想實驗的設定，節省大量手動調整時間。",
    linkLabel: "看看常見問題",
    link: "/faq",
  },
  {
    title: "步驟 4：按下開始回測並觀察進度",
    description:
      "按下「立刻開始回測」後，系統會平行運算所有參數組合。畫面上方會出現進度條，幫您掌握剩餘時間。",
    image: "/fast-lightning-speed-parallel-computing.jpg",
    tip: "如果需要休息，讓系統繼續跑就好，結果會自動保存，可以回來繼續分析。",
    linkLabel: "立刻前往回測頁",
    link: "/backtest",
  },
  {
    title: "步驟 5：閱讀回測報告並標記洞見",
    description:
      "完成後會產生圖表與排行榜。針對符合期待的結果，可以按「加入收藏」或備註關鍵觀察，之後在股票紀錄頁快速找回。",
    image: "/computer-screen-showing-backtest-results-with-perf.jpg",
    tip: "記得將有價值的設定分享到社群討論區，讓更多投資人一起優化策略。",
    linkLabel: "分享至社群",
    link: "/community",
  },
]

const quickTips = [
  {
    title: "善用儲存與匯出",
    content:
      "回測完成後，點擊報告右上角的儲存按鈕，可以將策略與回測結果一起記錄。之後在股票紀錄頁面即可快速匯出成 Excel。",
  },
  {
    title: "混搭多種條件",
    content:
      "系統支援同時設定基本面與技術面條件。試著混搭「月營收成長」與「均線策略」，可以更快速排除雜訊。",
  },
  {
    title: "用社群討論找靈感",
    content:
      "遇到瓶頸時，到社群討論區看看其他使用者的提問與分享，常能發現新的調參方向。",
  },
]

export default function TutorialPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl">
            <Badge className="mb-6" variant="secondary">
              懶人快速上手指南
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              5 個步驟，帶你掌握 LazyBacktest 的核心操作
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              跟著圖片一步步操作，就能在 10 分鐘內完成第一份回測報告。每個步驟都附上小提醒與延伸連結，確保你不會迷路。
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link href="/backtest" className="flex items-center gap-2">
                  立即開始回測
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/community">加入社群討論</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 space-y-16">
        <section className="space-y-10">
          {steps.map((step, index) => (
            <Card key={step.title} className="overflow-hidden border-border/60">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </span>
                  <span>一步到位的圖文教學</span>
                </div>
                <CardTitle className="text-2xl mt-4">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] items-center">
                <div className="space-y-4 text-base leading-relaxed">
                  <p className="text-muted-foreground">{step.description}</p>
                  <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-4 border border-primary/10">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary">小提醒</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.tip}</p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" className="px-0 h-auto font-semibold text-primary">
                    <Link href={step.link} className="inline-flex items-center gap-2">
                      {step.linkLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border">
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 768px) 480px, 100vw"
                    priority={index === 0}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="bg-muted/30 rounded-3xl p-8 md:p-12 border border-border/60">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">更多懶人小技巧</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {quickTips.map((tip) => (
              <div key={tip.title} className="rounded-2xl bg-background p-6 shadow-sm border border-border/40">
                <h3 className="text-lg font-semibold mb-3">{tip.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip.content}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="text-center space-y-4">
          <h2 className="text-3xl font-bold">下一步，打造屬於你的策略流程</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            走完教學後，推薦你依序完成：整理自己的 <Link href="/stock-records" className="underline underline-offset-4">股票紀錄</Link>
            、到 <Link href="/community" className="underline underline-offset-4">社群討論</Link> 蒐集靈感，再回來優化策略。
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
