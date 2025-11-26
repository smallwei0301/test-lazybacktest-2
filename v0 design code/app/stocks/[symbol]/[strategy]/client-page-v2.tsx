'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, TrendingUp, Activity, ArrowRight, Lock, Calendar, AlertCircle } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SiteHeader } from "@/components/site-header"
import { SEO_TEXT_BANK } from "@/lib/data/seo-text-bank-v3"
import { STRATEGY_WIKI } from "@/lib/data/strategy-wiki"

type Trade = {
  date: string
  type: string
  price: number
  return: number
  status: string
}

type ChampionStrategy = {
  name: string
  winRate: number
  roi: number
}

type Strategy = {
  id: string
  name: string
  type: string
  winRate: number
  roi: number
  maxDrawdown?: number
  tradeCount: number
  lastSignal: string
  lastSignalDate: string
  trades: Trade[]
  champion?: ChampionStrategy
}

type Stock = {
  symbol: string
  name: string
  buyAndHoldRoi: number
  strategies: Strategy[]
}

interface StrategyClientPageProps {
  stock: Stock
  strategy: Strategy
}

export default function StrategyClientPage({ stock, strategy }: StrategyClientPageProps) {
  console.log('StrategyClientPage rendering', { stock: stock?.symbol, strategy: strategy?.id })

  const [narrative, setNarrative] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  // 1. Identify Strategy Type
  let strategyKey = 'RSI'
  const sId = strategy.id.toUpperCase()
  const sName = strategy.name.toUpperCase()
  
  if (sId === 'MACD' || sName.includes('MACD')) strategyKey = 'MACD'
  else if (sId === 'MA' || sId === 'MA_CROSSOVER' || sName.includes('均線') || sName.includes(' MA') || sName === 'MA') strategyKey = 'MovingAverage'
  else if (sId === 'KD' || sId === 'STOCHASTIC' || sName.includes('KD')) strategyKey = 'KD'
  else if (sId === 'BOLLINGER' || sName.includes('BOLLINGER') || sName.includes('布林')) strategyKey = 'Bollinger'
  else if (sId === 'RSI' || sName.includes('RSI')) strategyKey = 'RSI'

  // 2. Determine Performance Context
  const getPerformanceContext = (s: Strategy, stock: Stock) => {
    const mdd = s.maxDrawdown || 15
    const bhRoi = stock.buyAndHoldRoi || 5
    let score = 0
    
    if (s.roi > bhRoi + 10) score += 2
    else if (s.roi > bhRoi) score += 1
    else if (s.roi < 0) score -= 2
    else score -= 1

    if (s.winRate > 60) score += 1
    else if (s.winRate < 40) score -= 1

    if (mdd < 10) score += 1
    else if (mdd > 20) score -= 1

    if (score >= 3) return 'excellent'
    if (score >= 1) return 'good'
    if (score >= -1) return 'average'
    return 'poor'
  }

  const performanceContext = getPerformanceContext(strategy, stock)
  const roiCategory = performanceContext

  // 3. Get Strategy Texts
  // @ts-ignore
  let strategyTexts = SEO_TEXT_BANK?.strategies?.[strategyKey]
  
  if (!strategyTexts) {
    console.warn(`Strategy text not found for key: ${strategyKey}, falling back to RSI`)
    // @ts-ignore
    strategyTexts = SEO_TEXT_BANK?.strategies?.['RSI']
  }

  useEffect(() => {
    if (!strategyTexts) {
      console.error(`Strategy text not found for key: ${strategyKey}`)
      return
    }

    const getRandom = (arr: string[]) => {
      if (!arr || arr.length === 0) return ""
      return arr[Math.floor(Math.random() * arr.length)]
    }
    
    const replaceVars = (text: string) => {
      if (!text) return ""
      return text
        .replace(/{name}/g, stock.name || "")
        .replace(/{symbol}/g, stock.symbol || "")
        .replace(/{strategy}/g, strategy.name || "")
        .replace(/{winRate}/g, (strategy.winRate || 0).toString())
        .replace(/{roi}/g, (strategy.roi || 0).toString())
        .replace(/{championWinRate}/g, (strategy.champion?.winRate || 75).toString())
        .replace(/{championRoi}/g, (strategy.champion?.roi || 25).toString())
        .replace(/{date}/g, new Date().toISOString().split('T')[0])
    }

    const p1 = replaceVars(getRandom(SEO_TEXT_BANK.openers || []))
    
    const getText = (layer: any) => {
      if (!layer) return ""
      const texts = layer[roiCategory] || layer['poor'] || layer['average'] || []
      return replaceVars(getRandom(texts))
    }

    const layer1 = strategyTexts ? getText(strategyTexts.layer1_theory) : ""
    const layer2 = strategyTexts ? getText(strategyTexts.layer2_adaptability) : ""
    const layer3 = strategyTexts ? getText(strategyTexts.layer3_blindspot) : ""
    const layer4 = strategyTexts ? getText(strategyTexts.layer4_data) : ""
    const layer5 = strategyTexts ? getText(strategyTexts.layer5_pain) : ""

    // 5. Twist Logic
    const bh = stock.buyAndHoldRoi || 0;
    const isHighPerformance = strategy.roi > bh;
    let twistContext = SEO_TEXT_BANK.twists.recovery;
    if (isHighPerformance) {
      twistContext = SEO_TEXT_BANK.twists.upgrade;
    }

    const p3 = replaceVars(getRandom(twistContext))
    const p4 = replaceVars(getRandom(SEO_TEXT_BANK.calls))

    setNarrative([p1, layer1, layer2, layer3, layer4, layer5, p3, p4])
    setMounted(true)
  }, [stock, strategy, strategyKey, roiCategory, strategyTexts])

  const wikiKey = strategyKey
  const wikiContent = STRATEGY_WIKI[wikiKey as keyof typeof STRATEGY_WIKI]

  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      date: date.toISOString().split('T')[0],
      value: 100 + (i * (strategy.roi / 30)) + (Math.random() * 10 - 5)
    }
  })

  const currentYear = new Date().getFullYear()
  const bhRoi = stock.buyAndHoldRoi || 5
  const isOutperforming = strategy.roi > bhRoi
  const statusQuestion = isOutperforming ? "真的準嗎" : "失效了嗎"
  const adverb = isOutperforming ? "高達" : (strategy.roi < 0 ? "僅" : "為")

  const today = new Date()
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)
  const dateRangeStr = `${oneYearAgo.toISOString().split('T')[0]} - ${today.toISOString().split('T')[0]}`
  const updateDateStr = today.toISOString().split('T')[0]

  const getQAs = () => {
    const qas = [
      {
        q: `${stock.name} 目前適合用 ${strategy.name} 操作嗎？`,
        a: `根據我們的回測數據，${strategy.name} 在 ${stock.name} 上的年化報酬率為 ${strategy.roi}%，而同期買入並持有的年化報酬率為 ${bhRoi}%。${
          strategy.roi > bhRoi 
            ? "此策略表現優於單純買入持有，顯示其能有效捕捉波段獲利並避開部分下跌風險，值得參考。" 
            : "此策略表現不如單純買入持有，建議您重新檢視參數設定，或參考我們的「冠軍策略」以獲得更佳的風險報酬比。"
        }`
      },
      {
        q: `為什麼 ${strategy.name} 的年化報酬率${strategy.roi < bhRoi ? "輸給" : "贏過"}買入持有？`,
        a: `策略的優劣取決於是否能適應當前的市場慣性。${
          strategy.roi < bhRoi 
            ? "目前的落後可能源於策略過度交易導致手續費侵蝕獲利，或是參數對於近期的盤整/趨勢反應遲鈍。" 
            : "能擊敗買入持有，通常代表策略成功避開了市場的主要修正段，並在趨勢確立時果斷進場。"
        } Lazybacktest 的核心價值就在於透過數據驗證，幫您找出真正能戰勝大盤的策略組合。`
      },
      {
        q: `此策略的最大風險（最大回撤）是多少？`,
        a: `除了年化報酬率，最大回撤 (Max Drawdown) 也是關鍵指標。雖然目前數據顯示年化報酬為 ${strategy.roi}%，但投資人仍需注意歷史最大回撤是否在可承受範圍內。冠軍策略通常會針對回撤進行優化，以提供更平滑的資金曲線。`
      }
    ]
    return qas
  }

  if (!mounted) return null

  const safeTrades = Array.isArray(strategy?.trades) ? strategy.trades : []

  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader activePath="/stocks" backLink={{ href: "/stocks", label: "返回個股列表" }} />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <nav className="flex items-center text-sm text-muted-foreground mb-8 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-primary transition-colors">首頁</Link>
          <span className="mx-2">/</span>
          <Link href="/stocks" className="hover:text-primary transition-colors">個股策略庫</Link>
          <span className="mx-2">/</span>
          <Link href={`/stocks/${stock.symbol}`} className="hover:text-primary transition-colors font-medium text-foreground">
            {stock.symbol} {stock.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-muted-foreground">{strategy.name}</span>
        </nav>

        <article className="prose prose-lg dark:prose-invert max-w-none mb-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 leading-tight">
            {stock.symbol} {stock.name}：{strategy.name} 指標{statusQuestion}？
            <span className="text-primary block mt-2">AI 實測年化報酬率{adverb} {strategy.roi}% ({currentYear} 最新數據)</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-6">測試資料日期 {dateRangeStr}</p>
          
          <div className="bg-muted/30 p-6 rounded-xl border border-border/50 shadow-sm mb-2">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-2 rounded-full mt-1 hidden md:block">
                <AlertCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-4 text-lg leading-relaxed text-muted-foreground">
                {narrative.map((paragraph, index) => (
                  <p key={index} dangerouslySetInnerHTML={{ 
                    __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>') 
                  }} />
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-right">文章更新日期：{updateDateStr}</p>
        </article>

        <section className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">策略競技場：數據會說話</h2>
            <p className="text-xl text-muted-foreground">
              當前策略 vs 冠軍策略，誰才是 {stock.name} 的獲利保證？
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-20 h-20 bg-background rounded-full border-4 border-muted shadow-2xl">
              <span className="text-3xl font-black text-muted-foreground italic">VS</span>
            </div>

            <Card className="border-2 hover:border-primary/30 transition-all duration-300 shadow-lg">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <Badge variant="secondary" className="w-fit mb-2">當前瀏覽</Badge>
                <CardTitle className="text-2xl">{strategy.name}</CardTitle>
                <CardDescription>使用我們找到的最佳參數</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-background rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">勝率</div>
                    <div className="text-3xl font-bold">{strategy.winRate}%</div>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">年化報酬率</div>
                    <div className="text-3xl font-bold text-primary">+{strategy.roi}%</div>
                  </div>
                </div>
                
                <div className="h-[150px] w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/?strategy=${strategy.id}&symbol=${stock.symbol}`}>
                    免費試用此策略 <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 to-transparent relative overflow-hidden shadow-xl shadow-yellow-500/10">
              <div className="absolute top-0 right-0 bg-yellow-500 text-white text-xs px-3 py-1 rounded-bl-lg font-bold">
                績效王
              </div>
              <CardHeader className="bg-yellow-500/10 border-b border-yellow-500/20 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🏆</span>
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none">年度冠軍</Badge>
                </div>
                <CardTitle className="text-2xl">神秘冠軍策略</CardTitle>
                <CardDescription>歷史回測表現最佳的策略組合</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-background/60 backdrop-blur-sm rounded-lg border border-yellow-500/20">
                    <div className="text-sm text-muted-foreground mb-1">勝率</div>
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      {strategy.champion?.winRate || 75}%
                    </div>
                  </div>
                  <div className="text-center p-4 bg-background/60 backdrop-blur-sm rounded-lg border border-yellow-500/20">
                    <div className="text-sm text-muted-foreground mb-1">年化報酬率</div>
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      +{strategy.champion?.roi || 45}%
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden bg-background/60 backdrop-blur-sm mb-6 relative">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left">日期</th>
                        <th className="p-3 text-left">訊號</th>
                        <th className="p-3 text-right">獲利</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeTrades.slice(0, 4).map((trade, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="p-3 font-mono text-muted-foreground">{trade.date}</td>
                          <td className="p-3">
                            <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                              {trade.type}
                            </Badge>
                          </td>
                          <td className={`p-3 text-right font-mono ${trade.return > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {trade.return > 0 ? '+' : ''}{trade.return}%
                          </td>
                        </tr>
                      ))}
                      <tr className={`relative ${strategy.lastSignal === 'BUY' ? 'bg-red-500/5' : 'bg-green-500/5'}`}>
                        <td className="p-3 font-mono filter blur-sm select-none">{strategy.lastSignalDate}</td>
                        <td className="p-3 filter blur-sm select-none">
                          <Badge>{strategy.lastSignal}</Badge>
                        </td>
                        <td className="p-3 text-right font-mono filter blur-sm select-none">????</td>
                        
                        <td className="absolute inset-0 flex items-center justify-center z-10">
                           <Button 
                            size="sm" 
                            className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg hover:scale-105 transition-transform font-bold"
                            asChild
                          >
                            <Link href="/pricing">
                              🔓 揭曉：誰是{stock.name}的冠軍策略？
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">常見問題：{stock.name} 投資指南</h2>
          <div className="space-y-4">
            {getQAs().map((qa, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">Q: {qa.q}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  A: {qa.a}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-muted/30 rounded-2xl p-8 md:p-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-primary/10 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{wikiContent?.title || `${strategy.name} 策略詳解`}</h2>
                <p className="text-muted-foreground">深入了解量化交易背後的邏輯</p>
              </div>
            </div>
            
            <div 
              className="prose prose-lg dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: wikiContent?.content || "<p>策略說明資料庫建置中...</p>" }}
            />
          </div>
        </section>

      </main>
    </div>
  )
}
