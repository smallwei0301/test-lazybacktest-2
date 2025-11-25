"use client"

import Link from "next/link"
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Lock, 
  TrendingUp, 
  Activity, 
  BarChart2,
  Calendar,
  ArrowRight
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SiteHeader } from "@/components/site-header"

// Types
type Trade = {
  date: string
  type: string
  price: number
  return: number
  status: string
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
  // Simulate equity curve data for chart
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      date: date.toISOString().split('T')[0],
      value: 100 + (i * (strategy.roi / 30)) + (Math.random() * 10 - 5)
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/stocks" backLink={{ href: "/stocks", label: "返回個股列表" }} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="text-lg px-3 py-1">{stock.symbol}</Badge>
            <span className="text-lg text-muted-foreground">{stock.name}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {stock.name} {strategy.name} 回測報告：勝率高達 {strategy.winRate}%？
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            根據最近 {strategy.tradeCount} 次交易回測結果，此策略在 {stock.name} 上的表現分析。
            最後訊號出現於 {strategy.lastSignalDate}。
          </p>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">總報酬率 (ROI)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">+{strategy.roi}%</span>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">勝率 (Win Rate)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{strategy.winRate}%</span>
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">交易次數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{strategy.tradeCount}</span>
                <span className="text-sm text-muted-foreground">次</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>資金成長曲線模擬</CardTitle>
            <CardDescription>假設初始資金 100,000 元的資產變化趨勢</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => value.slice(5)}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#0891b2" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* The Hook: Recent Trades */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            近期交易訊號
          </h2>
          
          <div className="relative rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">日期</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">訊號</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">價格</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">損益</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.trades.slice(1).map((trade, index) => (
                    <tr key={index} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">{trade.date}</td>
                      <td className="p-4 align-middle">
                        <Badge variant={trade.type === 'BUY' ? 'default' : 'secondary'}>
                          {trade.type === 'BUY' ? '買進' : '賣出'}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle">{trade.price}</td>
                      <td className={`p-4 align-middle text-right font-bold ${trade.return > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {trade.return > 0 ? '+' : ''}{trade.return}%
                      </td>
                    </tr>
                  ))}
                  
                  {/* Blurred Row - The Hook */}
                  <tr className="relative">
                    <td colSpan={4} className="p-0">
                      <div className="relative">
                        {/* Blurred Content */}
                        <div className="filter blur-md select-none opacity-50 bg-muted/30">
                          <table className="w-full">
                            <tbody>
                              <tr>
                                <td className="p-4">{strategy.trades[0].date}</td>
                                <td className="p-4"><Badge>BUY</Badge></td>
                                <td className="p-4">1234</td>
                                <td className="p-4 text-right">+5.5%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Lock Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[1px] z-10">
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                              <Lock className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-bold text-lg mb-2">解鎖今日最新訊號</h3>
                            <Button className="shadow-lg hover:scale-105 transition-transform">
                              訂閱日報解鎖 🔒
                            </Button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Internal Linking: Related Strategies */}
        <div className="bg-muted/30 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-6">
            查看 {stock.name} ({stock.symbol}) 的其他策略表現
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {stock.strategies
              .filter(s => s.id !== strategy.id)
              .map(s => (
                <Link key={s.id} href={`/stocks/${stock.symbol}/${s.id}`}>
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">{s.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          勝率 {s.winRate}%
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        </div>
      </main>
    </div>
  )
}
