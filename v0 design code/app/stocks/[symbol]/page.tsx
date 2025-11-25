import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, TrendingUp, Activity, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SiteHeader } from "@/components/site-header"

// Import data directly (in a real app this would be an API call or DB query)
import seoData from "../../../data/seo_mock_data.json"

type Props = {
  params: {
    symbol: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const stock = seoData.find(s => s.symbol === params.symbol)
  
  if (!stock) {
    return {
      title: "Stock Not Found",
    }
  }

  return {
    title: `${stock.name} (${stock.symbol}) 策略總覽 | LazyBacktest`,
    description: `查看 ${stock.name} (${stock.symbol}) 的所有量化交易策略回測報告，包含 RSI、MACD、布林通道等多種策略績效分析。`,
  }
}

export function generateStaticParams() {
  return seoData.map((stock) => ({
    symbol: stock.symbol,
  }))
}

export default function StockOverviewPage({ params }: Props) {
  const stock = seoData.find(s => s.symbol === params.symbol)

  if (!stock) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/stocks" backLink={{ href: "/stocks", label: "返回個股列表" }} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <div className="flex items-center text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary transition-colors">首頁</Link>
          <span className="mx-2">/</span>
          <Link href="/stocks" className="hover:text-primary transition-colors">個股策略庫</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">{stock.symbol} {stock.name}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="text-lg px-3 py-1">{stock.symbol}</Badge>
            <h1 className="text-3xl font-bold text-foreground">{stock.name} 策略總覽</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            共收錄 {stock.strategies.length} 種量化交易策略，請選擇您感興趣的策略查看完整回測報告。
          </p>
        </div>

        {/* Strategy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stock.strategies.map((strategy) => (
            <Link key={strategy.id} href={`/stocks/${stock.symbol}/${strategy.id}`}>
              <Card className="h-full hover:border-primary/50 transition-all hover:shadow-md cursor-pointer group relative overflow-hidden">
                {strategy.champion && (
                   <div className="absolute top-0 right-0 bg-yellow-500 text-white text-xs px-2 py-1 rounded-bl-lg font-bold z-10">
                     冠軍潛力
                   </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="group-hover:text-primary transition-colors">{strategy.name}</span>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </CardTitle>
                  <CardDescription>
                    {strategy.type} Strategy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">勝率</div>
                      <div className="text-2xl font-bold flex items-center gap-1">
                        {strategy.winRate}%
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">ROI</div>
                      <div className="text-2xl font-bold text-primary flex items-center gap-1">
                        +{strategy.roi}%
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-muted-foreground">
                    <span>交易次數: {strategy.tradeCount}</span>
                    <span>最新訊號: {strategy.lastSignalDate}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
