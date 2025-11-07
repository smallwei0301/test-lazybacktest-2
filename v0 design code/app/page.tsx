"use client"

// Patch Tag: LB-WEB-20250210A

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  BarChart3,
  Zap,
  CheckCircle,
  Star,
  Users,
  ArrowRight,
  Play,
  Target,
  Sparkles,
  LineChart,
  X,
  Check,
} from "lucide-react"
import Link from "next/link"
import { SiteFooter } from "@/components/site-footer"
import { useEffect, useState, useRef } from "react"

export default function HomePage() {
  const [stats, setStats] = useState({ stat1: 0, stat2: 0, stat3: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [currentStory, setCurrentStory] = useState(0)
  const [isAutoPlay, setIsAutoPlay] = useState(true)
  const statsRef = useRef<HTMLDivElement>(null)
  // </CHANGE>

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true)

          // 動畫增加數字
          const duration = 2000 // 2秒
          const steps = 60
          const interval = duration / steps

          let currentStep = 0
          const timer = setInterval(() => {
            currentStep++
            const progress = currentStep / steps

            setStats({
              stat1: Math.floor(85 * progress),
              stat2: Math.floor(3 * progress * 10) / 10, // Keep one decimal place for hours
              stat3: Math.floor(70 * progress),
            })

            if (currentStep >= steps) {
              clearInterval(timer)
              setStats({ stat1: 85, stat2: 3, stat3: 70 })
            }
          }, interval)

          return () => clearInterval(timer)
        }
      },
      { threshold: 0.3 },
    )

    if (statsRef.current) {
      observer.observe(statsRef.current)
    }

    return () => observer.disconnect()
  }, [isVisible])

  // Carousel effect for pain points
  useEffect(() => {
    if (!isAutoPlay) return

    const timer = setInterval(() => {
      setCurrentStory((prev) => (prev + 1) % 3)
    }, 15000) // Change every 15 seconds

    return () => clearInterval(timer)
  }, [isAutoPlay])
  // </CHANGE>

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full"></div>
                <div className="flex flex-col gap-0.5">
                  <div className="w-1 h-3 bg-primary-foreground rounded-sm"></div>
                  <div className="w-1 h-2 bg-primary-foreground rounded-sm"></div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="w-1 h-4 bg-primary-foreground rounded-sm"></div>
                  <div className="w-1 h-1.5 bg-primary-foreground rounded-sm"></div>
                </div>
              </div>
            </div>
            <div>
              <span className="text-xl font-bold text-foreground">LazyBacktest</span>
              <div className="text-xs text-muted-foreground">懶人回測</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              功能特色
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              如何運作
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              用戶見證
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              常見問題
            </a>
            <Link href="/stock-records">
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                股票紀錄
              </span>
            </Link>
            <a href="/app/index.html">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">進入回測 App</Button>
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* CHANGE> 更新Hero區背景圖片，使用更專業的金融交易場景 */}
        <div className="absolute inset-0">
          <img
            src="/modern-professional-stock-trading-floor-with-multi.jpg"
            alt="Trading Background"
            className="w-full h-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/95 to-accent/20"></div>
        </div>
        {/* </CHANGE> */}
        <div className="container mx-auto px-4 relative">
          <div className="max-w-5xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-primary text-primary px-6 py-2">
              專為不會寫程式的投資人設計
            </Badge>
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
              不會寫程式，也能找出
              <br />
              <span className="text-primary">最穩定、最會賺的股票策略</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto text-pretty leading-relaxed">
              LazyBacktest 幫你自動測試上百種參數組合，用台股真實歷史資料，告訴你「這個方法到底有沒有效」。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <a href="/app/index.html">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-10 py-7 group shadow-lg"
                >
                  進入回測 App
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 py-7 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent group"
              >
                <Play className="mr-2 h-5 w-5" />
                先看看範例策略與回測報告
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground bg-card/50 backdrop-blur rounded-2xl p-6 border">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">已累積超過 2,000 位使用者採用</span>
              </div>
              <div className="h-4 w-px bg-border"></div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="font-medium">平台回測次數超過 100,000 次</span>
              </div>
              <div className="h-4 w-px bg-border"></div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-accent fill-accent" />
                <span className="font-medium">用戶平均滿意度：4.9 / 5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
              你不是不努力，只是工具一直太難
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              很多投資人一開始接觸股票策略時，心裡都會有這種想法
            </p>
          </div>

          {/* Carousel Stories */}
          <div className="max-w-4xl mx-auto">
            {/* Arrow Controls + Card Container */}
            <div className="relative flex items-center justify-between gap-4">
              {/* Previous Button - Left Side */}
              <button
                onClick={() => {
                  setCurrentStory((prev) => (prev - 1 + 3) % 3)
                  setIsAutoPlay(false)
                }}
                className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Previous story"
              >
                <ArrowRight className="h-6 w-6 rotate-180 text-muted-foreground hover:text-foreground" />
              </button>

              {/* Carousel Container */}
              <div className="overflow-hidden flex-1">
                <div
                  className="transition-opacity duration-500 ease-in-out"
                  style={{
                    opacity: 1,
                  }}
                >
                  {currentStory === 0 && (
                    <Card className="p-8 bg-card border-l-4 border-l-primary hover:shadow-xl transition-shadow animate-in fade-in duration-500">
                      <div className="flex flex-col md:flex-row items-start gap-6">
                        <div className="w-full md:w-32 h-32 md:h-auto md:self-stretch rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                          <img
                            src="/confused-investor-looking-at-complex-stock-market-.jpg"
                            alt="思考策略"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-4">
                            我只是想知道這招到底有沒有效
                          </h3>
                          <p className="text-muted-foreground leading-relaxed mb-3">
                            很多人一開始接觸股票策略時，都會這樣想：「如果 RSI 低於 30 買、超過 70 賣，是不是會賺？」但當你真的想試著驗證時，就發現——
                          </p>
                          <ul className="space-y-2 mb-4">
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">•</span>
                              <span>要去哪裡查資料？</span>
                            </li>
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">•</span>
                              <span>怎麼設定參數？</span>
                            </li>
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">•</span>
                              <span>為什麼每次調一點又要重跑？</span>
                            </li>
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">•</span>
                              <span>那些圖表、勝率數字我根本看不懂啊！</span>
                            </li>
                          </ul>
                          <p className="text-muted-foreground leading-relaxed font-medium">
                            結果，一開始的興趣，最後變成滿滿的挫折。
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {currentStory === 1 && (
                    <Card className="p-8 bg-card border-l-4 border-l-accent hover:shadow-xl transition-shadow animate-in fade-in duration-500">
                      <div className="flex flex-col md:flex-row items-start gap-6">
                        <div className="w-full md:w-32 h-32 md:h-auto md:self-stretch rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                          <img
                            src="/complex-programming-code-interface-with-technical-.jpg"
                            alt="複雜工具"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-4">
                            別人說回測很重要，但我根本不知道怎麼開始
                          </h3>
                          <p className="text-muted-foreground leading-relaxed mb-3">
                            你也許看過財經 Youtuber 說：「要有自己的策略，不要亂跟單」。但當你真的想回測，發現：
                          </p>
                          <div className="space-y-2 mb-4 bg-muted/30 p-4 rounded-lg">
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-accent font-bold">✕</span>
                              <span>「咦？TradingView 好像要寫公式？」</span>
                            </div>
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-accent font-bold">✕</span>
                              <span>「FinLab 那個 Python 太難了吧？」</span>
                            </div>
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-accent font-bold">✕</span>
                              <span>「XQ 也不知道哪裡設定…」</span>
                            </div>
                          </div>
                          <p className="text-muted-foreground leading-relaxed mb-3">
                            所以多數人最後都放棄，只能繼續「用感覺買」。而事實是，超過 8 成散戶都在用沒驗證過的策略，結果報酬不但不穩定，還容易越做越虧。
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {currentStory === 2 && (
                    <Card className="p-8 bg-card border-l-4 border-l-primary hover:shadow-xl transition-shadow animate-in fade-in duration-500">
                      <div className="flex flex-col md:flex-row items-start gap-6">
                        <div className="w-full md:w-32 h-32 md:h-auto md:self-stretch rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                          <img
                            src="/busy-professional-working-at-desk-with-clock-showi.jpg"
                            alt="時間有限"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-4">我不是不想學，只是太難了</h3>
                          <p className="text-muted-foreground leading-relaxed mb-4">
                            你也許有心想學量化、想變成更理性的投資人，但現實是 —— 工具太複雜、太難懂。每次只想測個策略，結果搞半天還不確定結果正不正確。
                          </p>
                          <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary mb-4">
                            <p className="text-foreground font-semibold mb-3">
                              LazyBacktest 誕生的目的很單純：讓這件事變簡單。
                            </p>
                            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                              一鍵輸入股票代號，我們幫你跑完所有組合，清楚告訴你：
                            </p>
                            <ul className="space-y-2">
                              <li className="flex items-center gap-2 text-foreground text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>哪組報酬最高</span>
                              </li>
                              <li className="flex items-center gap-2 text-foreground text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>哪組風險最低</span>
                              </li>
                              <li className="flex items-center gap-2 text-foreground text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>哪組策略最穩定</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </div>

              {/* Next Button - Right Side */}
              <button
                onClick={() => {
                  setCurrentStory((prev) => (prev + 1) % 3)
                  setIsAutoPlay(false)
                }}
                className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                aria-label="Next story"
              >
                <ArrowRight className="h-6 w-6 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            {/* Dots Indicator - Below Carousel */}
            <div className="flex justify-center gap-2 mt-6">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentStory(index)
                    setIsAutoPlay(false)
                  }}
                  className={`h-2 rounded-full transition-all ${
                    currentStory === index
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30 w-2 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to story ${index + 1}`}
                />
              ))}
            </div>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              故事 {currentStory + 1} / 3
            </div>
          </div>

          {/* Statistics */}
          <div className="max-w-5xl mx-auto mt-20" ref={statsRef}>
            <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-3xl p-12 shadow-xl border-2">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-foreground mb-4">您並不孤單</h3>
                <p className="text-lg text-muted-foreground">大多數散戶都遇到一樣的問題</p>
              </div>
              <div className="grid md:grid-cols-3 gap-12">
                <div className="text-center transform hover:scale-105 transition-transform">
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-6 border-4 border-primary/20 shadow-lg">
                    <img
                      src="/downward-trending-red-stock-market-chart-showing-l.jpg"
                      alt="虧損趨勢"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-5xl font-bold text-primary mb-3">{stats.stat1}%</div>
                  <p className="text-muted-foreground font-medium">散戶投資人長期報酬率跑輸大盤</p>
                </div>
                <div className="text-center transform hover:scale-105 transition-transform">
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-6 border-4 border-accent/20 shadow-lg">
                    <img
                      src="/clock-showing-time-passing-with-stock-market-scree.jpg"
                      alt="時間消耗"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-5xl font-bold text-accent mb-3">{stats.stat2} 小時</div>
                  <p className="text-muted-foreground font-medium">每日平均花在盯盤、看盤後心得與新聞的時間</p>
                </div>
                <div className="text-center transform hover:scale-105 transition-transform">
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-6 border-4 border-primary/20 shadow-lg">
                    <img
                      src="/emotional-stressed-investor-making-impulsive-tradi.jpg"
                      alt="情緒交易"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-5xl font-bold text-primary mb-3">{stats.stat3}%</div>
                  <p className="text-muted-foreground font-medium">的交易決策，受到情緒影響而在錯誤時間點進出場</p>
                </div>
              </div>
              <div className="mt-12 text-center max-w-3xl mx-auto">
                <p className="text-muted-foreground leading-relaxed">
                  這些情況往往不是因為你不夠認真，而是缺少一個簡單好用的工具，讓你可以在下單之前，就先用數據驗證自己的想法。
                </p>
                <p className="text-foreground font-semibold mt-4 text-lg">
                  LazyBacktest 希望幫你的，不是給你「明牌」，而是給你一套「自己檢驗策略」的能力。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>      {/* Solution Section - Competitor Comparison */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-primary text-primary px-6 py-2">
              競品分析
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
              為什麼選擇 LazyBacktest？
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">與市面上主流回測平台的功能對比</p>
          </div>

          <div className="max-w-6xl mx-auto">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse bg-card rounded-2xl overflow-hidden shadow-xl">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-6 text-left text-foreground font-bold text-lg border-b-2 border-border">
                      功能特色
                    </th>
                    <th className="p-6 text-center text-foreground font-bold text-lg border-b-2 border-border bg-primary/5">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                          <div className="flex items-center gap-0.5">
                            <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full"></div>
                            <div className="flex flex-col gap-0.5">
                              <div className="w-1 h-3 bg-primary-foreground rounded-sm"></div>
                              <div className="w-1 h-2 bg-primary-foreground rounded-sm"></div>
                            </div>
                          </div>
                        </div>
                        <span className="text-primary">LazyBacktest</span>
                      </div>
                    </th>
                    <th className="p-6 text-center text-muted-foreground font-semibold border-b-2 border-border">
                      TradingView
                    </th>
                    <th className="p-6 text-center text-muted-foreground font-semibold border-b-2 border-border">
                      XQ 全球贏家
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">不需要寫程式</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需要學習 Pine Script</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">△</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需要學習公式語法</p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors bg-primary/5">
                    <td className="p-6 text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span>自動參數優化</span>
                      </div>
                    </td>
                    <td className="p-6 text-center bg-primary/10">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">AI智能尋找最佳參數</p>
                      <p className="text-xs text-primary mt-1">節省 95% 測試時間</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需手動調整參數</p>
                      <p className="text-xs text-destructive mt-1">每次測試需 5-10 分鐘</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需手動逐一測試</p>
                      <p className="text-xs text-destructive mt-1">測試 100 組需 8+ 小時</p>
                    </td>
                  </tr>
                  {/* </CHANGE> */}

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors bg-accent/5">
                    <td className="p-6 text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-accent" />
                        <span>一鍵批量優化</span>
                      </div>
                    </td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">一次測試所有參數組合</p>
                      <p className="text-xs text-primary mt-1">10 分鐘完成 1000+ 組測試</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">△</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">有優化功能但操作複雜</p>
                      <p className="text-xs text-muted-foreground mt-1">需要程式知識設定</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需手動逐一測試</p>
                      <p className="text-xs text-destructive mt-1">耗時且容易出錯</p>
                    </td>
                  </tr>
                  {/* </CHANGE> */}

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">台股歷史數據</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">20年完整台股數據</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">△</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">台股數據較少</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">台股數據完整</p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">中文介面與支援</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">完整繁體中文</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">△</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">部分中文化</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">完整中文</p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">學習曲線</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <Badge className="bg-primary text-primary-foreground">極低</Badge>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">5分鐘上手</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <Badge variant="destructive">高</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需要學習程式語言</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <Badge className="bg-accent text-accent-foreground">中</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">需要學習公式</p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">價格</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2">完全免費</Badge>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <p className="text-muted-foreground">免費版功能有限</p>
                      <p className="text-sm text-muted-foreground mt-1">專業版 $14.95/月起</p>
                    </td>
                    <td className="p-6 text-center">
                      <p className="text-muted-foreground">需要付費訂閱</p>
                      <p className="text-sm text-muted-foreground mt-1">約 $50-100/月</p>
                    </td>
                  </tr>

                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">適合對象</td>
                    <td className="p-6 text-center bg-primary/5">
                      <Badge className="bg-primary text-primary-foreground">股票新手小白</Badge>
                      <p className="text-xs text-primary mt-2 font-semibold">零基礎也能用</p>
                    </td>
                    <td className="p-6 text-center">
                      <Badge variant="outline">專業交易者</Badge>
                      <p className="text-xs text-muted-foreground mt-2">需要技術背景</p>
                    </td>
                    <td className="p-6 text-center">
                      <Badge variant="outline">進階投資人</Badge>
                      <p className="text-xs text-muted-foreground mt-2">需要一定經驗</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-6">
              <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <div className="flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full"></div>
                      <div className="flex flex-col gap-0.5">
                        <div className="w-1 h-3 bg-primary-foreground rounded-sm"></div>
                        <div className="w-1 h-2 bg-primary-foreground rounded-sm"></div>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-primary">LazyBacktest</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">不需要寫程式</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">一鍵批量優化</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">20年台股數據</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">完整繁體中文</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">學習曲線</span>
                    <Badge className="bg-primary text-primary-foreground">極低</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">價格</span>
                    <Badge className="bg-primary text-primary-foreground">完全免費</Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-2">
                <h3 className="text-xl font-bold text-foreground mb-6">TradingView</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">不需要寫程式</span>
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">一鍵批量優化</span>
                    <span className="text-accent font-bold">△</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">台股數據</span>
                    <span className="text-accent font-bold">△</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">中文介面</span>
                    <span className="text-accent font-bold">△</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">學習曲線</span>
                    <Badge variant="destructive">高</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">價格</span>
                    <span className="text-sm">$14.95/月起</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-2">
                <h3 className="text-xl font-bold text-foreground mb-6">XQ 全球贏家</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">不需要寫程式</span>
                    <span className="text-accent font-bold">△</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">一鍵批量優化</span>
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">台股數據</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">中文介面</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">學習曲線</span>
                    <Badge className="bg-accent text-accent-foreground">中</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">價格</span>
                    <span className="text-sm">$50-100/月</span>
                  </div>
                </div>
              </Card>
            </div>
            {/* </CHANGE> */}

            <div className="mt-12 text-center">
              <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 rounded-2xl p-8 border-2 border-primary/20">
                <h3 className="text-2xl font-bold text-foreground mb-4">LazyBacktest 的核心優勢</h3>
                <p className="text-lg text-muted-foreground mb-8">
                  我們專注於讓「不會寫程式的投資人」也能輕鬆使用專業回測工具
                </p>
                <div className="grid md:grid-cols-3 gap-8 mb-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">極簡操作</h4>
                    <p className="text-sm text-muted-foreground">5分鐘上手，無需任何程式背景</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">智能優化</h4>
                    <p className="text-sm text-muted-foreground">自動找出最佳參數組合</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">完全免費</h4>
                    <p className="text-sm text-muted-foreground">所有功能永久免費使用</p>
                  </div>
                </div>

                <div className="bg-card rounded-xl p-6 border-2 border-primary/30">
                  <h4 className="text-xl font-bold text-foreground mb-4 flex items-center justify-center gap-2">
                    <Target className="h-6 w-6 text-primary" />
                    為什麼選擇 LazyBacktest？
                  </h4>
                  <div className="grid md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">節省 95% 測試時間</p>
                          <p className="text-sm text-muted-foreground">別人需要 8 小時手動測試，我們 10 分鐘自動完成</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">自動找出最佳參數</p>
                          <p className="text-sm text-muted-foreground">AI 智能分析，不用再一個一個手動嘗試</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">批量測試 1000+ 組合</p>
                          <p className="text-sm text-muted-foreground">一次測試所有可能性，找出真正有效的策略</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">零程式背景也能用</p>
                          <p className="text-sm text-muted-foreground">完全圖形化介面，點選即可完成專業回測</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* </CHANGE> */}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-primary text-primary px-6 py-2">
              核心功能亮點
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
              用白話告訴你，我們能做什麼
            </h2>
          </div>

          <div className="max-w-7xl mx-auto space-y-20">
            {/* Feature 1 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <img
                  src="/professional-stock-trading-platform-interface-show.jpg"
                  alt="一鍵批量回測"
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-primary/20"
                />
              </div>
              <div className="space-y-6 order-1 lg:order-2">
                <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-6 py-3">
                  <Target className="h-6 w-6 text-primary" />
                  <span className="text-foreground font-semibold">功能一</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">一鍵批量回測</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  輸入股票代號，選擇你想測的策略種類（例如 RSI、KD、均線、MACD
                  等），按下開始，系統就會自動幫你跑完所有你勾選的組合。
                </p>
                <p className="text-muted-foreground leading-relaxed">你不需要一組一組改，只要等結果整合出來。</p>
                <div className="flex flex-wrap gap-3 pt-4">
                  <Badge variant="secondary" className="px-4 py-2">
                    自動測試
                  </Badge>
                  <Badge variant="secondary" className="px-4 py-2">
                    多策略同時跑
                  </Badge>
                  <Badge variant="secondary" className="px-4 py-2">
                    結果自動整合
                  </Badge>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 bg-accent/10 rounded-full px-6 py-3">
                  <Sparkles className="h-6 w-6 text-accent" />
                  <span className="text-foreground font-semibold">功能二</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">自動找出最佳參數組合</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  LazyBacktest
                  會對每一組策略參數，計算報酬率、最大回撤、勝率等指標，並幫你排序：哪些組合賺最多、哪些較穩定、哪些風險過高。
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  你可以把它想成：幫你把「一整片迷霧」整理成一張清楚的排行榜。
                </p>
                <div className="bg-accent/5 rounded-lg p-6 border-l-4 border-accent">
                  <p className="text-foreground font-semibold mb-2">智能排序系統</p>
                  <p className="text-sm text-muted-foreground">
                    根據報酬率、風險、穩定度等多維度指標，自動為您找出最佳參數組合
                  </p>
                </div>
              </div>
              <div>
                <img
                  src="/advanced-optimization-algorithm-dashboard-showing-.jpg"
                  alt="自動找出最佳參數組合"
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-accent/20"
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <img
                  src="/beautiful-financial-charts-and-graphs-showing-stoc.jpg"
                  alt="視覺化回測報表"
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-primary/20"
                />
              </div>
              <div className="space-y-6 order-1 lg:order-2">
                <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-6 py-3">
                  <LineChart className="h-6 w-6 text-primary" />
                  <span className="text-foreground font-semibold">功能三</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">視覺化回測報表</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  系統會自動生成回測圖表，例如：策略資金曲線、對照大盤的績效、回撤曲線、年度績效統計等。
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  你不用自己畫圖，也不用把數字貼進
                  Excel。只要看圖，就能理解這個策略大概是「穩穩漲」還是「一下好一下壞」。
                </p>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-primary/5 rounded-lg p-4 border">
                    <p className="text-2xl font-bold text-primary mb-1">資金曲線</p>
                    <p className="text-xs text-muted-foreground">清楚看到策略表現</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4 border">
                    <p className="text-2xl font-bold text-primary mb-1">績效對比</p>
                    <p className="text-xs text-muted-foreground">與大盤比較</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 bg-accent/10 rounded-full px-6 py-3">
                  <Shield className="h-6 w-6 text-accent" />
                  <span className="text-foreground font-semibold">功能四</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">策略穩健性與風險提示</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  除了單純的報酬率，我們也會提供風險與穩定度提示，例如最大虧損、期間波動度，以及策略是否過度依賴少數幾段行情。
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  這可以提醒你：這個策略是「只在特定行情看起來很美」，還是「在多數行情下都還算撐得住」。
                </p>
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>最大虧損分析</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>波動度評估</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>行情依賴度檢測</span>
                  </div>
                </div>
              </div>
              <div>
                <img
                  src="/risk-management-dashboard-showing-maximum-drawdown.jpg"
                  alt="策略穩健性與風險提示"
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-accent/20"
                />
              </div>
            </div>
            {/* </CHANGE> */}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              簡單三步驟
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 text-balance">如何開始您的懶人回測</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              無需程式背景，三個步驟就能驗證您的投資策略
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              <div className="text-center group">
                <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden mx-auto mb-6 group-hover:scale-110 transition-transform border-4 border-primary/20 shadow-lg">
                  <img
                    src="/person-selecting-stocks-from-taiwan-stock-market-l.jpg"
                    alt="選擇股票"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-primary-foreground font-bold text-xl">1</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">選擇股票與時間範圍</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  從台股上市櫃股票中選擇您想要測試的標的，設定回測的起始與結束時間。
                </p>
              </div>

              <div className="text-center group">
                <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden mx-auto mb-6 group-hover:scale-110 transition-transform border-4 border-accent/20 shadow-lg">
                  <img
                    src="/intuitive-graphical-interface-showing-technical-in.jpg"
                    alt="設定條件"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-accent-foreground font-bold text-xl">2</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">設定買賣條件</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  透過直覺的圖形介面，設定您的進場與出場條件，如技術指標、價格條件等。
                </p>
              </div>

              <div className="text-center group">
                <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden mx-auto mb-6 group-hover:scale-110 transition-transform border-4 border-primary/20 shadow-lg">
                  <img
                    src="/computer-screen-showing-backtest-results-with-perf.jpg"
                    alt="開始回測"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-primary-foreground font-bold text-xl">3</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">一鍵開始回測</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  點擊開始按鈕，系統會自動計算並呈現詳細的回測結果與績效分析。
                </p>
              </div>
              {/* </CHANGE> */}
            </div>

            <div className="mt-16 text-center">
              <a href="/app/index.html">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  進入回測 App
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-foreground text-foreground px-6 py-2">
              使用者怎麼說
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">真實用戶的使用心得</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 bg-card hover:shadow-xl transition-shadow border-2">
              <CardContent className="pt-0">
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  「我完全不會寫程式，以前只會看技術線圖亂猜。用 LazyBacktest
                  之後，我第一次知道自己常用的那個策略，其實長期報酬很不穩。現在下單前，我都會先跑一次回測，心裡踏實很多。」
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold">王</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">王先生</p>
                    <p className="text-muted-foreground text-sm">上班族投資新手</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-xl transition-shadow border-2 border-primary">
              <CardContent className="pt-0">
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  「以前要花好幾個晚上慢慢調參數，還要做紀錄。現在我直接一次勾一堆參數區間給系統跑，十分鐘就有結果。省下來的時間，我拿去思考策略邏輯本身，而不是在那邊重複按回測。」
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-accent-foreground font-semibold">李</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">李小姐</p>
                    <p className="text-muted-foreground text-sm">有一年交易經驗的使用者</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-xl transition-shadow border-2">
              <CardContent className="pt-0">
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  「用了 LazyBacktest
                  才發現，我原本以為很厲害的『神奇指標組合』，其實只是少數幾段行情表現很好而已。這讓我學會用更理性的方式看待策略，而不是只看漂亮的單一績效圖。」
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold">陳</span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">陳先生</p>
                    <p className="text-muted-foreground text-sm">自學投資者</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-foreground text-foreground">
              價格方案
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 text-balance">簡單透明的定價</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              我們相信強大的工具應該讓更多人使用
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Free Plan */}
              <Card className="p-8 bg-card hover:shadow-lg transition-shadow border-2">
                <CardHeader className="text-center pb-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-card-foreground mb-2">免費版</CardTitle>
                  <div className="text-4xl font-bold text-primary mb-2">$0</div>
                  <p className="text-muted-foreground">永久免費使用</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">專業回測引擎</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">20年歷史數據</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">基本技術指標</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">績效分析報告</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">風險管理工具</span>
                    </div>
                  </div>
                  <a href="/app/index.html">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-8">
                      進入 App
                    </Button>
                  </a>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="p-8 bg-gradient-to-br from-accent/5 to-primary/5 hover:shadow-lg transition-shadow border-2 border-accent relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-accent text-accent-foreground">最受歡迎</Badge>
                </div>
                <CardHeader className="text-center pb-8">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-accent" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-card-foreground mb-2">專業版</CardTitle>
                  <div className="text-4xl font-bold text-accent mb-2">$0</div>
                  <p className="text-muted-foreground">同樣永久免費！</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">包含免費版所有功能</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">一鍵參數優化</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">批量策略組合</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">進階技術指標</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">策略分享與匯出</span>
                    </div>
                  </div>
                  <a href="/app/index.html">
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-8">
                      進入 App
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <p className="text-muted-foreground text-sm">所有功能完全免費，無隱藏費用，無使用限制</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-foreground text-foreground px-6 py-2">
              常見問題
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">您可能想知道的問題</h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">LazyBacktest 真的完全免費嗎？</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  是的，LazyBacktest
                  的所有核心功能都完全免費，包括專業回測引擎、參數優化、策略組合等。我們相信強大的投資工具應該讓更多人使用，幫助大家做出更好的投資決策。
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">我需要有程式設計背景才能使用嗎？</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  完全不需要！LazyBacktest
                  提供全中文的圖形化介面，您只需要透過點選和設定，就能組合出各種交易策略。我們的設計理念就是讓「懶人」也能輕鬆上手專業回測。
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">回測結果可以保證未來獲利嗎？</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  回測是基於歷史數據的模擬，不能保證未來獲利。但它可以幫助您客觀評估策略的潛在表現和風險，讓您做出更理性的投資決策。投資有風險，請謹慎評估。
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">支援哪些股票市場？</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  目前主要支援台灣股市的上市櫃股票，包含超過1000支個股的20年歷史數據。我們持續更新數據，確保99.9%的準確度。
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">批量優化功能是什麼？</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  批量優化功能可以讓您一次測試多種策略和參數組合，系統會自動幫每個策略找出最佳參數，並按照績效排序。這樣您就不用一個一個手動測試，可以快速找到最適合的策略。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <img
            src="/abstract-financial-technology-background-with-stoc.jpg"
            alt="Background"
            className="w-full h-full object-cover"
          />
        </div>
        {/* </CHANGE> */}
        <div className="container mx-auto px-4 text-center relative">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
              從今天開始，不再用「感覺」決定進出場
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              投資本來就有風險，但不代表只能靠運氣。你可以選擇在下單前，先用歷史資料驗證自己的想法，讓每一次進出場，都多一點根據、多一點信心。
            </p>
            <p className="text-lg text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              LazyBacktest
              想給你的，是一個新手也能用的回測工具，讓你在沒有程式背景的情況下，也能走上更理性、數據化的投資方式。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a href="/app/index.html">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xl px-12 py-8 group shadow-xl"
                >
                  進入回測 App
                  <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-6">不用註冊也可以先試跑一個範例策略</p>
          </div>
        </div>
      </section>

      <SiteFooter
        variant="dark"
        intro={
          <p>
            先恭喜您，投資賺錢！<br /> 如果這個網站幫助您投資順利<br /> 或者單純想支持一下韭菜胖叔叔<br />歡迎斗內讓我可以上車繼續更新<br /> 用奶粉發電，不再用愛發電
          </p>
        }
        donationLinks={[
          {
            label: "歐付寶",
            href: "https://payment.opay.tw/Broadcaster/Donate/C0EB7741A027F28BA11ED9BDBEAD263A",
          },
          { label: "綠界", href: "https://p.ecpay.com.tw/8AB5D6F" },
          { label: "PayPal", href: "https://www.paypal.com/ncp/payment/79RNTHL69MAPE" },
        ]}
        bottomLines={[
          <p key="contact">
            鄉民內部測試版: 建議事項與 Bug，請聯絡信箱:
            <a href="mailto:smallwei0301@gmail.com" className="underline ml-1">
              smallwei0301@gmail.com
            </a>
          </p>,
          <p key="copyright">© 2025 LazyBacktest. 僅供教育與研究用途，不構成投資建議。</p>,
        ]}
      />
    </div>
  )
}
