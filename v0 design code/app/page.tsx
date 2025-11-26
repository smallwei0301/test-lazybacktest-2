"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import {
  Shield,
  BarChart3,
  Zap,
  CheckCircle,
  Users,
  ArrowRight,
  Play,
  Target,
  TrendingUp,
  Sparkles,
  LineChart,
  X,
  Check,
} from "lucide-react"
import Link from "next/link"
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

          // ?憓??詨?
          const duration = 2000 // 2蝘?
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
      <SiteHeader activePath="/" />

      {/* Hero Section */}
      <main>
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* CHANGE> ?湔Hero????嚗蝙?冽撠平???漱???*/}
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
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
              銝?撖怎?撘?銋?曉
              <br />
              <span className="text-primary">?蝛拙????竟?蟡函???/span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto text-pretty leading-relaxed">
              懶人回測Lazybacktest 撟思??芸?皜祈岫銝蝔桀??貊????典?∠?撖行風?脰????迄雿瘜摨?瘝???
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <a href="/app/index.html">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-10 py-7 group shadow-lg"
                >
                  ?脣?葫 App
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-8 py-7 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent group"
              >
                <Link href="/stocks">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  ?汗?蝑摨?
                </Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground bg-card/50 backdrop-blur rounded-2xl p-6 border">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">撌脩敞蝛???2,000 雿蝙?刻??/span>
              </div>
              <div className="h-4 w-px bg-border"></div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="font-medium">撟喳?葫甈⊥頞? 100,000 甈?/span>
              </div>
              <div className="h-4 w-px bg-border"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
              雿??臭??芸?嚗?臬極?瑚??游云??
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              敺???鈭箔????亥孛?∠巨蝑??敹ㄐ?賣??車?單?
            </p>
          </div>

          {/* Carousel Stories */}
          <div className="max-w-4xl mx-auto px-2 sm:px-4">
            {/* Card Container with Floating Arrows */}
            <div className="relative group">
              {/* Previous Button - Left Side (Floating) */}
              <button
                onClick={() => {
                  setCurrentStory((prev) => (prev - 1 + 3) % 3)
                  setIsAutoPlay(false)
                }}
                className="absolute z-10 flex items-center justify-center text-2xl sm:text-3xl font-bold transition-colors"
                style={{
                  left: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#0891b2',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(8, 145, 178, 0.4)',
                  cursor: 'pointer',
                }}
                aria-label="Previous story"
              >
                &lt;
              </button>

              {/* Next Button - Right Side (Floating) */}
              <button
                onClick={() => {
                  setCurrentStory((prev) => (prev + 1) % 3)
                  setIsAutoPlay(false)
                }}
                className="absolute z-10 flex items-center justify-center text-2xl sm:text-3xl font-bold transition-colors"
                style={{
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#0891b2',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(8, 145, 178, 0.4)',
                  cursor: 'pointer',
                }}
                aria-label="Next story"
              >
                &gt;
              </button>

              {/* Carousel Container */}
              <div className="overflow-hidden">
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
                            alt="????
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-4">
                            ??舀?仿????啣?????
                          </h3>
                          <p className="text-muted-foreground leading-relaxed mb-3">
                            敺?鈭箔????亥孛?∠巨蝑???賣??見?喉?????RSI 雿 30 鞎瑯???70 鞈???臭??舀?鞈綽????嗡????唾岫??霅?嚗停?潛??
                          </p>
                          <ul className="space-y-2 mb-4">
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">??/span>
                              <span>閬?芾ㄐ?亥???</span>
                            </li>
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">??/span>
                              <span>?獐閮剖??嚗?/span>
                            </li>
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">??/span>
                              <span>?箔?暻潭?甈∟矽銝暺?閬?頝?</span>
                            </li>
                            <li className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-primary font-bold">??/span>
                              <span>????”???摮??寞????嚗?/span>
                            </li>
                          </ul>
                          <p className="text-muted-foreground leading-relaxed font-medium">
                            蝯?嚗?????頞???敺??遛皛輻??急???
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
                            alt="銴?撌亙"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-4">
                            ?乩犖隤芸?皜砍???嚗???砌??仿??獐??
                          </h3>
                          <p className="text-muted-foreground leading-relaxed mb-3">
                            雿?閮梁??瓷蝬?Youtuber 隤迎????撌梁?蝑嚗?閬?頝???嗡????喳?皜穿??潛嚗?
                          </p>
                          <div className="space-y-2 mb-4 bg-muted/30 p-4 rounded-lg">
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-accent font-bold">??/span>
                              <span>?嚗radingView 憟賢?閬神?砍?嚗?/span>
                            </div>
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-accent font-bold">??/span>
                              <span>?inLab ???Python 憭芷鈭嚗?/span>
                            </div>
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <span className="text-accent font-bold">??/span>
                              <span>?Q 銋??仿??芾ㄐ閮剖??艾?/span>
                            </div>
                          </div>
                          <p className="text-muted-foreground leading-relaxed mb-3">
                            ?隞亙??訾犖?敺?暹?嚗?賜匱蝥?死鞎瑯?撖行嚗???8 ??園?函瘝?霅????伐?蝯??梢銝?銝帘摰??捆?????扼?
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
                            alt="????"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-foreground mb-4">???臭??喳飛嚗?臬云???</h3>
                          <p className="text-muted-foreground leading-relaxed mb-4">
                            雿?閮望?敹摮賊??霈??渡??抒???鈭綽?雿撖行 ??撌亙憭芾??云?????甈∪?單葫???伐?蝯???憭拚?銝Ⅱ摰??迤銝迤蝣箝?
                          </p>
                          <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary mb-4">
                            <p className="text-foreground font-semibold mb-3">
                              懶人回測Lazybacktest 隤?????桃?嚗??辣鈭?蝪∪??
                            </p>
                            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                              銝?菔撓?亥蟡其誨???鼠雿?摰?????皜??迄雿?
                            </p>
                            <ul className="space-y-2">
                              <li className="flex items-center gap-2 text-foreground text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>?芰??梢?擃?/span>
                              </li>
                              <li className="flex items-center gap-2 text-foreground text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>?芰?憸券?雿?/span>
                              </li>
                              <li className="flex items-center gap-2 text-foreground text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>?芰?蝑?蝛拙?</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
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
              ?? {currentStory + 1} / 3
            </div>
          </div>

          {/* Statistics */}
          <div className="max-w-5xl mx-auto mt-20" ref={statsRef}>
            <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-3xl p-12 shadow-xl border-2">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold text-foreground mb-4">?其蒂銝迨??/h3>
                <p className="text-lg text-muted-foreground">憭批??豢?園?銝璅????</p>
              </div>
              <div className="grid md:grid-cols-3 gap-12">
                <div className="text-center transform hover:scale-105 transition-transform">
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-6 border-4 border-primary/20 shadow-lg">
                    <img
                      src="/downward-trending-red-stock-market-chart-showing-l.jpg"
                      alt="?扳?頞典"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-5xl font-bold text-primary mb-3">{stats.stat1}%</div>
                  <p className="text-muted-foreground font-medium">????鈭粹??祉?頝撓憭抒</p>
                </div>
                <div className="text-center transform hover:scale-105 transition-transform">
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-6 border-4 border-accent/20 shadow-lg">
                    <img
                      src="/clock-showing-time-passing-with-stock-market-scree.jpg"
                      alt="??瘨?
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-5xl font-bold text-accent mb-3">{stats.stat2} 撠?</div>
                  <p className="text-muted-foreground font-medium">瘥撟喳??勗?舐???文?敹??????</p>
                </div>
                <div className="text-center transform hover:scale-105 transition-transform">
                  <div className="w-28 h-28 rounded-full overflow-hidden mx-auto mb-6 border-4 border-primary/20 shadow-lg">
                    <img
                      src="/emotional-stressed-investor-making-impulsive-tradi.jpg"
                      alt="??鈭斗?"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-5xl font-bold text-primary mb-3">{stats.stat3}%</div>
                  <p className="text-muted-foreground font-medium">?漱?捱蝑????敶梢??航炊??暺脣??/p>
                </div>
              </div>
              <div className="mt-12 text-center max-w-3xl mx-auto">
                <p className="text-muted-foreground leading-relaxed">
                  ????敺敺銝?雿?憭????蝻箏?銝?陛?桀末?函?撌亙嚗?雿隞亙銝銋?嚗停??豢?撽??芸楛?瘜?
                </p>
                <p className="text-foreground font-semibold mt-4 text-lg">
                  懶人回測Lazybacktest 撣?撟思???銝蝯虫??????蝯虫?銝憟撌望炎撽??乓??賢???
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
              ?Ｗ??寡
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
              ?箔?暻潔蝙??懶人回測Lazybacktest嚗?
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">???Ｖ?銝餅??葫撟喳???賢?瘥?/p>
          </div>

          <div className="max-w-6xl mx-auto">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse bg-card rounded-2xl overflow-hidden shadow-xl">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-6 text-left text-foreground font-bold text-lg border-b-2 border-border">
                      ??寡
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
                        <span className="text-primary">懶人回測Lazybacktest</span>
                      </div>
                    </th>
                    <th className="p-6 text-center text-muted-foreground font-semibold border-b-2 border-border">
                      TradingView
                    </th>
                    <th className="p-6 text-center text-muted-foreground font-semibold border-b-2 border-border">
                      XQ ?函?韐振
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">銝?閬神蝔?</td>
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
                      <p className="text-xs text-muted-foreground mt-2">?閬飛蝧?Pine Script</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">??/span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?閬飛蝧撘?瘜?/p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors bg-primary/5">
                    <td className="p-6 text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span>?芸???芸?</span>
                      </div>
                    </td>
                    <td className="p-6 text-center bg-primary/10">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">AI?箄撠?雿喳???/p>
                      <p className="text-xs text-primary mt-1">蝭??95% 皜祈岫??</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">???隤踵?</p>
                      <p className="text-xs text-destructive mt-1">瘥活皜祈岫? 5-10 ??</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?????皜祈岫</p>
                      <p className="text-xs text-destructive mt-1">皜祈岫 100 蝯? 8+ 撠?</p>
                    </td>
                  </tr>
                  {/* </CHANGE> */}

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors bg-accent/5">
                    <td className="p-6 text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-accent" />
                        <span>銝?菜???/span>
                      </div>
                    </td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">銝甈⊥葫閰行????貊???/p>
                      <p className="text-xs text-primary mt-1">10 ??摰? 1000+ 蝯葫閰?/p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">??/span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">????賭???銴?</p>
                      <p className="text-xs text-muted-foreground mt-1">?閬?撘霅身摰?/p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                          <X className="h-5 w-5 text-destructive" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?????皜祈岫</p>
                      <p className="text-xs text-destructive mt-1">??銝捆???/p>
                    </td>
                  </tr>
                  {/* </CHANGE> */}

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">?啗甇瑕?豢?</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">20撟游??游?⊥??/p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">??/span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?啗?豢?頛?</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?啗?豢?摰</p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">銝剜?隞???/td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">摰蝜?銝剜?</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                          <span className="text-accent font-bold">??/span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?典?銝剜???/p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">摰銝剜?</p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">摮貊??脩?</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <Badge className="bg-primary text-primary-foreground">璆萎?</Badge>
                      </div>
                      <p className="text-xs text-primary mt-2 font-semibold">5??銝?</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <Badge variant="destructive">擃?/Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?閬飛蝧?撘?閮</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex justify-center">
                        <Badge className="bg-accent text-accent-foreground">銝?/Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">?閬飛蝧撘?/p>
                    </td>
                  </tr>

                  <tr className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">?寞</td>
                    <td className="p-6 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <Badge className="bg-primary text-primary-foreground text-lg px-4 py-2">摰?祥</Badge>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <p className="text-muted-foreground">?祥???賣???/p>
                      <p className="text-sm text-muted-foreground mt-1">撠平??$14.95/?絲</p>
                    </td>
                    <td className="p-6 text-center">
                      <p className="text-muted-foreground">?閬?鞎餉???/p>
                      <p className="text-sm text-muted-foreground mt-1">蝝?$50-100/??/p>
                    </td>
                  </tr>

                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-foreground font-medium">?拙?撠情</td>
                    <td className="p-6 text-center bg-primary/5">
                      <Badge className="bg-primary text-primary-foreground">?∠巨?唳?撠</Badge>
                      <p className="text-xs text-primary mt-2 font-semibold">?嗅蝷??賜</p>
                    </td>
                    <td className="p-6 text-center">
                      <Badge variant="outline">撠平鈭斗???/Badge>
                      <p className="text-xs text-muted-foreground mt-2">?閬?銵???/p>
                    </td>
                    <td className="p-6 text-center">
                      <Badge variant="outline">?脤???鈭?/Badge>
                      <p className="text-xs text-muted-foreground mt-2">?閬?摰?撽?/p>
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
                  <h3 className="text-xl font-bold text-primary">懶人回測Lazybacktest</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝?閬神蝔?</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝?菜???/span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">20撟游?⊥??/span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">摰蝜?銝剜?</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">摮貊??脩?</span>
                    <Badge className="bg-primary text-primary-foreground">璆萎?</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">?寞</span>
                    <Badge className="bg-primary text-primary-foreground">摰?祥</Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-2">
                <h3 className="text-xl font-bold text-foreground mb-6">TradingView</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝?閬神蝔?</span>
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝?菜???/span>
                    <span className="text-accent font-bold">??/span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">?啗?豢?</span>
                    <span className="text-accent font-bold">??/span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝剜?隞</span>
                    <span className="text-accent font-bold">??/span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">摮貊??脩?</span>
                    <Badge variant="destructive">擃?/Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">?寞</span>
                    <span className="text-sm">$14.95/?絲</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-2">
                <h3 className="text-xl font-bold text-foreground mb-6">XQ ?函?韐振</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝?閬神蝔?</span>
                    <span className="text-accent font-bold">??/span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝?菜???/span>
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">?啗?豢?</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">銝剜?隞</span>
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">摮貊??脩?</span>
                    <Badge className="bg-accent text-accent-foreground">銝?/Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">?寞</span>
                    <span className="text-sm">$50-100/??/span>
                  </div>
                </div>
              </Card>
            </div>
            {/* </CHANGE> */}

            <div className="mt-12 text-center">
              <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 rounded-2xl p-8 border-2 border-primary/20">
                <h3 className="text-2xl font-bold text-foreground mb-4">懶人回測Lazybacktest ?敹??/h3>
                <p className="text-lg text-muted-foreground mb-8">
                  ??瘜冽霈??神蝔???鞈犖???質?擛蝙?典?璆剖?皜砍極??
                </p>
                <div className="grid md:grid-cols-3 gap-8 mb-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">璆萇陛??</h4>
                    <p className="text-sm text-muted-foreground">5??銝?嚗?隞颱?蝔??</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">?箄?芸?</h4>
                    <p className="text-sm text-muted-foreground">?芸??曉?雿喳??貊???/p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">摰?祥</h4>
                    <p className="text-sm text-muted-foreground">????賣偶銋?鞎颱蝙??/p>
                  </div>
                </div>

                <div className="bg-card rounded-xl p-6 border-2 border-primary/30">
                  <div className="grid md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">蝭??95% 皜祈岫??</p>
                          <p className="text-sm text-muted-foreground">?乩犖?閬?8 撠???皜祈岫嚗???10 ???芸?摰?</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">?芸??曉?雿喳???/p>
                          <p className="text-sm text-muted-foreground">AI ?箄??嚗??典?銝??????閰?/p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">?寥?皜祈岫 1000+ 蝯?</p>
                          <p className="text-sm text-muted-foreground">銝甈⊥葫閰行???賣改??曉?迤??????/p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">?嗥?撘??臭??賜</p>
                          <p className="text-sm text-muted-foreground">摰?耦???ｇ?暺?喳摰?撠平?葫</p>
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
              ?詨??鈭桅?
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
              ?函閰勗?閮港?嚗????暻?
            </h2>
          </div>

          <div className="max-w-7xl mx-auto space-y-20">
            {/* Feature 1 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <img
                  src="/professional-stock-trading-platform-interface-show.jpg"
                  alt="銝?菜??皜?
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-primary/20"
                />
              </div>
              <div className="space-y-6 order-1 lg:order-2">
                <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-6 py-3">
                  <Target className="h-6 w-6 text-primary" />
                  <span className="text-foreground font-semibold">?銝</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">銝?菜??皜?/h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  頛詨?∠巨隞??嚗???單葫???亦車憿?靘? RSI?D??蝺ACD
                  蝑?嚗?銝?憪?蝟餌絞撠望??芸?撟思?頝?????暸????
                </p>
                <p className="text-muted-foreground leading-relaxed">雿??閬?蝯?蝯嚗閬?蝯??游??箔???/p>
                <div className="flex flex-wrap gap-3 pt-4">
                  <Badge variant="secondary" className="px-4 py-2">
                    ?芸?皜祈岫
                  </Badge>
                  <Badge variant="secondary" className="px-4 py-2">
                    憭??亙???
                  </Badge>
                  <Badge variant="secondary" className="px-4 py-2">
                    蝯??芸??游?
                  </Badge>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 bg-accent/10 rounded-full px-6 py-3">
                  <Sparkles className="h-6 w-6 text-accent" />
                  <span className="text-foreground font-semibold">?鈭?/span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">?芸??曉?雿喳??貊???/h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  懶人回測Lazybacktest
                  ??瘥?蝯??亙??賂?閮??梢??憭批??扎?????嚗蒂撟思???嚗鈭??竟?憭鈭?蝛拙??鈭◢?芷?擃?
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  雿隞交?摰??撟思????渡?餈琿???銝撘菜?璆???璁?
                </p>
                <div className="bg-accent/5 rounded-lg p-6 border-l-4 border-accent">
                  <p className="text-foreground font-semibold mb-2">?箄??蝟餌絞</p>
                  <p className="text-sm text-muted-foreground">
                    ?寞??梢?◢?芥帘摰漲蝑?蝬剖漲??嚗??冽?箸?雿喳??貊???
                  </p>
                </div>
              </div>
              <div>
                <img
                  src="/advanced-optimization-algorithm-dashboard-showing-.jpg"
                  alt="?芸??曉?雿喳??貊???
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-accent/20"
                />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <img
                  src="/beautiful-financial-charts-and-graphs-showing-stoc.jpg"
                  alt="閬死??皜砍銵?
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-2xl border-2 border-primary/20"
                />
              </div>
              <div className="space-y-6 order-1 lg:order-2">
                <div className="inline-flex items-center gap-3 bg-primary/10 rounded-full px-6 py-3">
                  <LineChart className="h-6 w-6 text-primary" />
                  <span className="text-foreground font-semibold">?銝?/span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">閬死??皜砍銵?/h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  蝟餌絞?????皜砍?銵剁?靘?嚗??亥??蝺??批之?斤?蝮暹????斗蝺僑摨衣蜀?絞閮???
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  雿??刻撌梁??銋??冽??詨?鞎潮?
                  Excel?閬???撠梯?圾???亙之璁?帘蝛拇撞???胯?銝末銝銝???
                </p>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-primary/5 rounded-lg p-4 border">
                    <p className="text-2xl font-bold text-primary mb-1">鞈??脩?</p>
                    <p className="text-xs text-muted-foreground">皜??蝑銵函</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4 border">
                    <p className="text-2xl font-bold text-primary mb-1">蝮暹?撠?</p>
                    <p className="text-xs text-muted-foreground">?之?斗?頛?/p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 bg-accent/10 rounded-full px-6 py-3">
                  <Shield className="h-6 w-6 text-accent" />
                  <span className="text-foreground font-semibold">???/span>
                </div>
                <h3 className="text-3xl font-bold text-foreground">蝑蝛拙?扯?憸券?內</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  ?支??桃???祉?嚗?????靘◢?芾?蝛拙?摨行?蝷綽?靘??憭扯???郭?漲嚗誑???交?阡?摨虫?鞈游??詨嗾畾菔???
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  ?隞交???嚗??交??函摰???韏瑚?敺?????憭銵?銝????雿?
                </p>
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>?憭扯????/span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>瘜Ｗ?摨西?隡?/span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <span>銵?靘陷摨行炎皜?/span>
                  </div>
                </div>
              </div>
              <div>
                <img
                  src="/risk-management-dashboard-showing-maximum-drawdown.jpg"
                  alt="蝑蝛拙?扯?憸券?內"
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
              蝪∪銝郊撽?
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 text-balance">憒????函??嗡犖?葫</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              ?⊿?蝔??嚗??郊撽停?賡?霅??鞈???
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              <div className="text-center group">
                <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden mx-auto mb-6 group-hover:scale-110 transition-transform border-4 border-primary/20 shadow-lg">
                  <img
                    src="/person-selecting-stocks-from-taiwan-stock-market-l.jpg"
                    alt="?豢??∠巨"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-primary-foreground font-bold text-xl">1</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">?豢??∠巨??????/h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  敺?∩?撣??∠巨銝剝??唾?皜祈岫????閮剖??葫?絲憪?蝯?????
                </p>
              </div>

              <div className="text-center group">
                <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden mx-auto mb-6 group-hover:scale-110 transition-transform border-4 border-accent/20 shadow-lg">
                  <img
                    src="/intuitive-graphical-interface-showing-technical-in.jpg"
                    alt="閮剖?璇辣"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-accent-foreground font-bold text-xl">2</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">閮剖?鞎瑁都璇辣</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  ???渲死??敶Ｖ??ｇ?閮剖??函??脣??湔?隞塚?憒?銵?璅?潭?隞嗥???
                </p>
              </div>

              <div className="text-center group">
                <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden mx-auto mb-6 group-hover:scale-110 transition-transform border-4 border-primary/20 shadow-lg">
                  <img
                    src="/computer-screen-showing-backtest-results-with-perf.jpg"
                    alt="???葫"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <span className="text-primary-foreground font-bold text-xl">3</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">銝?菟?憪?皜?/h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  暺?????嚗頂蝯望??芸?閮?銝血??曇底蝝啁??葫蝯??蜀????
                </p>
              </div>
              {/* </CHANGE> */}
            </div>

            <div className="mt-16 flex flex-col sm:flex-row justify-center gap-4">
              <a href="/app/index.html">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  ?脣?葫 App
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-primary hover:bg-primary/10 border-primary"
              >
                <Link href="/guide">
                  <Play className="mr-2 h-5 w-5" />
                  雿輻?飛
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-foreground text-foreground px-6 py-2">
              雿輻?獐隤?
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">?祕?冽?蝙?典?敺?/h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 bg-card hover:shadow-xl transition-shadow border-2">
              <CardContent className="pt-0">
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  ??摰銝?撖怎?撘?隞亙??芣???銵???? 懶人回測Lazybacktest
                  銋?嚗?蝚砌?甈∠?撌勗虜?函?????伐??嗅祕?瑟??梢敺?蝛押?其??桀?嚗??賣???銝甈∪?皜穿?敹ㄐ頦祕敺???
                </p>
                <div className="flex items-center gap-3">

                  <div>
                    <p className="font-semibold text-foreground">????/p>
                    <p className="text-muted-foreground text-sm">銝??鞈??/p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-xl transition-shadow border-2 border-primary">
              <CardContent className="pt-0">
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  ?誑???勗末撟曉?銝?Ｚ矽?嚗?閬?蝝??冽??湔銝甈∪銝???詨??策蝟餌絞頝????停????銝???????餅??仿?頛舀頨恬????臬???????皜研?
                </p>
                <div className="flex items-center gap-3">

                  <div>
                    <p className="font-semibold text-foreground">??憪?/p>
                    <p className="text-muted-foreground text-sm">??撟港漱??撽?雿輻??/p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-xl transition-shadow border-2">
              <CardContent className="pt-0">
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  ?鈭?懶人回測Lazybacktest
                  ??橘????砌誑?箏??脣拿??憟?璅????嗅祕?芣撠撟暹挾銵?銵函敺末?歇???飛??渡??抒??孵???蝑嚗??臬??鈭桃??桐?蝮暹???
                </p>
                <div className="flex items-center gap-3">

                  <div>
                    <p className="font-semibold text-foreground">?喳???/p>
                    <p className="text-muted-foreground text-sm">?芸飛????/p>
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
              ?寞?寞?
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4 text-balance">蝪∪??????/h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              ?靽∪撥憭抒?撌亙?府霈憭犖雿輻
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
                  <CardTitle className="text-2xl font-bold text-card-foreground mb-2">?祥??/CardTitle>
                  <div className="text-4xl font-bold text-primary mb-2">$0</div>
                  <p className="text-muted-foreground">瘞訾??祥雿輻</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">撠平?葫撘?</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">20撟湔風?脫??/span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">?箸?銵?璅?/span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">蝮暹????勗?</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">憸券蝞∠?撌亙</span>
                    </div>
                  </div>
                  <a href="/app/index.html">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-8">
                      ?脣 App
                    </Button>
                  </a>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="p-8 bg-gradient-to-br from-accent/5 to-primary/5 hover:shadow-lg transition-shadow border-2 border-accent relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-accent text-accent-foreground">??迭餈?/Badge>
                </div>
                <CardHeader className="text-center pb-8">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-accent" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-card-foreground mb-2">撠平??/CardTitle>
                  <div className="text-4xl font-bold text-accent mb-2">$0</div>
                  <p className="text-muted-foreground">?見瘞訾??祥嚗?/p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">??祥??????/span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">銝?萄??詨??/span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">?寥?蝑蝯?</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">?脤??銵?璅?/span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                      <span className="text-sm">蝑?澈???/span>
                    </div>
                  </div>
                  <a href="/app/index.html">
                    <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground mt-8">
                      ?脣 App
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <p className="text-muted-foreground text-sm">????賢??典?鞎鳴??⊿?祥?剁??∩蝙?券???/p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 border-foreground text-foreground px-6 py-2">
              撣貉???
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">?典?賣?仿???憿?/h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">懶人回測Lazybacktest ??摰?祥??</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  ?舐?嚗azyBacktest
                  ???敹??賡摰?祥嚗??砍?璆剖?皜砍????詨???亦??????靽∪撥憭抒???撌亙?府霈憭犖雿輻嚗鼠?拙之摰嗅??箸憟賜???瘙箇???
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">??閬?蝔?閮剛???雿輻??</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  摰銝?閬?懶人回測Lazybacktest
                  ???其葉???耦???ｇ??典?閬?暺?身摰?撠梯蝯??箏?蝔桐漱???乓???閮剛??艙撠望霈鈭箝??質?擛???璆剖?皜研?
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">?葫蝯??臭誑靽??芯??脣??</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  ?葫?臬?潭風?脫??璅⊥嚗??賭?霅靘?押?摰隞亙鼠?拇摰Ｚ?閰摯蝑???刻”?曉?憸券嚗??典??箸?抒???瘙箇???鞈?憸券嚗?雓寞?閰摯??
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">?舀?芯??∠巨撣嚗?/CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  ?桀?銝餉??舀?啁?∪???撣??∠巨嚗??怨???000?臬??0撟湔風?脫????蝥?唳??蝣箔?99.9%??蝣箏漲??
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 bg-card hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-card-foreground">?寥??芸???臭?暻潘?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  ?寥??芸???臭誑霈銝甈⊥葫閰血?蝔桃??亙??蝯?嚗頂蝯望??芸?撟急????交?箸?雿喳??賂?銝行??抒蜀??摨見?典停銝銝?????葫閰佗??臭誑敹恍?唳??拙????乓?
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
              敺?憭拚?憪?銝??具?閬箝捱摰脣??
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              ???砌?撠望?憸券嚗?銝誨銵典?賡??除???臭誑?豢??其??桀?嚗??冽風?脰???霅撌梁??單?嚗?瘥?甈⊿脣?湛??賢?銝暺??銝暺縑敹?
            </p>
            <p className="text-lg text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              懶人回測Lazybacktest
              ?喟策雿?嚗銝????賜??皜砍極?瘀?霈??冽???撘??舐???銝?銋韏唬??渡??扼????鞈撘?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a href="/app/index.html">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xl px-12 py-8 group shadow-xl"
                >
                  ?脣?葫 App
                  <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <Link href="/guide" className="rounded-md border border-border px-3 py-1.5 transition-colors hover:border-primary hover:text-primary">
                ??摰雿輻?飛
              </Link>
              <Link href="/faq" className="rounded-md border border-border px-3 py-1.5 transition-colors hover:border-primary hover:text-primary">
                ?亦?撣貉????渡?
              </Link>
              <Link href="/community" className="rounded-md border border-border px-3 py-1.5 transition-colors hover:border-primary hover:text-primary">
                ?隞?嗉?隢???
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-6">銝閮餃?銋隞亙?閰西?銝??靘???/p>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />
    </div>
  )
}


