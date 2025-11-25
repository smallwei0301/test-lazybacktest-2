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
  tradeCount: number
  lastSignal: string
  lastSignalDate: string
  trades: Trade[]
  champion?: ChampionStrategy
}

type Stock = {
  symbol: string
  name: string
  strategies: Strategy[]
}

interface StrategyClientPageProps {
  stock: Stock
  strategy: Strategy
}

export default function StrategyClientPage({ stock, strategy }: StrategyClientPageProps) {
  const [narrative, setNarrative] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  // 1. Identify Strategy Type (Deterministic)
  let strategyKey = 'RSI' // Default
  const sId = strategy.id.toUpperCase()
  const sName = strategy.name.toUpperCase()
  
  // Explicit checks for ID and Name - ORDER MATTERS! Check MACD before MA to avoid false match
  if (sId === 'MACD' || sName.includes('MACD')) strategyKey = 'MACD'
  else if (sId === 'MA' || sId === 'MA_CROSSOVER' || sName.includes('均線') || sName.includes(' MA') || sName === 'MA') strategyKey = 'MovingAverage'
  else if (sId === 'KD' || sId === 'STOCHASTIC' || sName.includes('KD')) strategyKey = 'KD'
  else if (sId === 'BOLLINGER' || sName.includes('BOLLINGER') || sName.includes('布林')) strategyKey = 'Bollinger'
  else if (sId === 'RSI' || sName.includes('RSI')) strategyKey = 'RSI'

  // 2. Determine ROI Category (Now in render scope)
  let roiCategory = 'poor'
  if (strategy.roi > 10) roiCategory = 'excellent'
  else if (strategy.roi >= 6) roiCategory = 'good'
  else if (strategy.roi >= 3) roiCategory = 'average'

  // 3. Get Strategy Texts (Now in render scope)
  // @ts-ignore
  let strategyTexts = SEO_TEXT_BANK.strategies[strategyKey]
  
  // Fallback to RSI if text not found to prevent blank page
  if (!strategyTexts) {
    console.warn(`Strategy text not found for key: ${strategyKey}, falling back to RSI`)
    strategyTexts = SEO_TEXT_BANK.strategies['RSI']
  }

  // Generate AI Narrative on mount to avoid hydration mismatch
  useEffect(() => {
    if (!strategyTexts) {
      console.error(`Strategy text not found for key: ${strategyKey}`)
      return
    }

    const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
    
    const replaceVars = (text: string) => {
      return text
        .replace(/{name}/g, stock.name)
        .replace(/{symbol}/g, stock.symbol)
        .replace(/{strategy}/g, strategy.name)
        .replace(/{winRate}/g, strategy.winRate.toString())
        .replace(/{roi}/g, strategy.roi.toString())
        .replace(/{championWinRate}/g, (strategy.champion?.winRate || 75).toString())
        .replace(/{championRoi}/g, (strategy.champion?.roi || 25).toString())
        .replace(/{date}/g, new Date().toISOString().split('T')[0])
    }

    const p1 = replaceVars(getRandom(SEO_TEXT_BANK.openers))
    
    // Helper to safely get text or fallback to 'poor' if specific category missing
    const getText = (layer: any) => {
      const texts = layer[roiCategory] || layer['poor'] || layer['average'] || []
      return replaceVars(getRandom(texts))
    }

    const layer1 = getText(strategyTexts.layer1_theory)
    const layer2 = getText(strategyTexts.layer2_adaptability)
    const layer3 = getText(strategyTexts.layer3_blindspot)
    const layer4 = getText(strategyTexts.layer4_data)
    const layer5 = getText(strategyTexts.layer5_pain)

    // 5. Twist Logic
    const isHighPerformance = strategy.roi >= 6
    const twistContext = isHighPerformance
      ? SEO_TEXT_BANK.twists.upgrade
      : SEO_TEXT_BANK.twists.recovery

    const p3 = replaceVars(getRandom(twistContext))
    const p4 = replaceVars(getRandom(SEO_TEXT_BANK.calls))

    // 4. Construct Deep Analysis Paragraphs
    // Flatten the array so each layer gets its own <p> tag
    setNarrative([p1, layer1, layer2, layer3, layer4, layer5, p3, p4])
    setMounted(true)
  }, [stock, strategy, strategyKey, roiCategory, strategyTexts])

  // Wiki Content
  const wikiKey = Object.keys(STRATEGY_WIKI).find(k => k.toLowerCase() === strategy.id.toLowerCase()) || "RSI"
  const wikiContent = STRATEGY_WIKI[wikiKey as keyof typeof STRATEGY_WIKI]

  // Chart Data
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      date: date.toISOString().split('T')[0],
      value: 100 + (i * (strategy.roi / 30)) + (Math.random() * 10 - 5)
    }
  })

  if (!mounted) return null // Prevent hydration mismatch

  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader activePath="/stocks" backLink={{ href: "/stocks", label: "返回個股列表" }} />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Breadcrumbs */}
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

        {/* Layer 1: AI Narrative (The Narrative) */}
        <article className="prose prose-lg dark:prose-invert max-w-none mb-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            {stock.name} ({stock.symbol}) 投資分析：
            <span className="text-primary block mt-2">{strategy.name} 真的能賺錢嗎？</span>
          </h1>
          
          <div className="bg-muted/30 p-6 rounded-xl border border-border/50 shadow-sm">
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
        </article>

        {/* Layer 2: Data PK & Hook (The Hook) */}
        <section className="mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">策略競技場：數據會說話</h2>
            <p className="text-xl text-muted-foreground">
              當前策略 vs 冠軍策略，誰才是 {stock.name} 的獲利保證？
            </p>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* VS Badge */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-20 h-20 bg-background rounded-full border-4 border-muted shadow-2xl">
              <span className="text-3xl font-black text-muted-foreground italic">VS</span>
            </div>

            {/* Left Column: Current Strategy (Free) */}
            <Card className="border-2 hover:border-primary/30 transition-all duration-300 shadow-lg">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <Badge variant="secondary" className="w-fit mb-2">當前瀏覽</Badge>
                <CardTitle className="text-2xl">{strategy.name}</CardTitle>
                <CardDescription>適合新手入門的基礎策略</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-background rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">勝率</div>
                    <div className="text-3xl font-bold">{strategy.winRate}%</div>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">總報酬</div>
                    <div className="text-3xl font-bold text-primary">+{strategy.roi}%</div>
                  </div>
                </div>
                
                {/* Mini Chart */}
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

            {/* Right Column: Champion Strategy (Locked) */}
            <Card className="border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 to-transparent relative overflow-hidden shadow-xl shadow-yellow-500/10">
              <div className="absolute top-0 right-0 bg-yellow-500 text-white text-xs px-3 py-1 rounded-bl-lg font-bold">
                勝率王
              </div>
              <CardHeader className="bg-yellow-500/10 border-b border-yellow-500/20 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🏆</span>
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-none">年度冠軍</Badge>
                </div>
                <CardTitle className="text-2xl">神秘冠軍策略</CardTitle>
                <CardDescription>歷史回測表現最佳的參數組合</CardDescription>
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
                    <div className="text-sm text-muted-foreground mb-1">總報酬</div>
                    <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      +{strategy.champion?.roi || 45}%
                    </div>
                  </div>
                </div>

                {/* Transaction Table with Blur Hook */}
                <div className="border rounded-lg overflow-hidden bg-background/60 backdrop-blur-sm mb-6 relative">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left">日期</th>
                        <th className="p-3 text-left">訊號</th>
                        <th className="p-3 text-right">價格</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strategy.trades.slice(0, 4).map((trade, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="p-3 font-mono text-muted-foreground">{trade.date}</td>
                          <td className="p-3">
                            <Badge variant={trade.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                              {trade.type}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono">{trade.price}</td>
                        </tr>
                      ))}
                      {/* Blurred Row */}
                      <tr className={`relative ${strategy.lastSignal === 'BUY' ? 'bg-red-500/5' : 'bg-green-500/5'}`}>
                        <td className="p-3 font-mono filter blur-sm select-none">{strategy.lastSignalDate}</td>
                        <td className="p-3 filter blur-sm select-none">
                          <Badge>{strategy.lastSignal}</Badge>
                        </td>
                        <td className="p-3 text-right font-mono filter blur-sm select-none">????</td>
                        
                        {/* Overlay Button */}
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

        {/* Layer 3: Dynamic FAQ */}
        <section className="mb-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">常見問題：{stock.name} 投資指南</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Q: {stock.name} 目前適合用 {strategy.name} 操作嗎？</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                A: 根據我們的回測數據，{strategy.name} 在 {stock.name} 上的勝率為 {strategy.winRate}%。
                雖然這是一個可行的策略，但數據顯示「冠軍策略」能提供更高的勝率 ({strategy.champion?.winRate}%) 與更穩定的報酬。
                建議您在下單前，先參考冠軍策略的訊號。
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Q: 為什麼 {strategy.name} 的勝率只有 {strategy.winRate}%？</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                A: 每個技術指標都有其適用的市場環境。{strategy.name} 可能在某些震盪或趨勢盤中表現不佳。
                透過 Lazybacktest 的參數優化，我們可以找到更適合 {stock.name} 股性的參數設定，這就是為什麼冠軍策略能大幅提升勝率的原因。
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Layer 4: Static Wiki */}
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
