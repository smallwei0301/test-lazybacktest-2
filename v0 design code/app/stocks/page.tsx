"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, TrendingUp, BarChart2, ArrowRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import seoData from "@/data/seo_mock_data.json"

export default function StockHubPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredStocks, setFilteredStocks] = useState(seoData)

  useEffect(() => {
    const results = seoData.filter(stock => 
      stock.symbol.includes(searchTerm) || 
      stock.name.includes(searchTerm)
    )
    setFilteredStocks(results)
  }, [searchTerm])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/stocks" />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">個股策略庫</h1>
          <p className="text-xl text-muted-foreground mb-8">
            探索台股熱門標的的回測數據，找到最適合您的交易策略
          </p>
          
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="輸入股票代號或名稱 (例如: 2330, 台積電)"
              className="pl-10 h-12 text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStocks.map((stock) => (
            <Card key={stock.symbol} className="hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="mb-2">{stock.symbol}</Badge>
                    <CardTitle className="text-2xl">{stock.name}</CardTitle>
                  </div>
                  <div className="bg-primary/10 p-2 rounded-full">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <BarChart2 className="h-4 w-4" />
                    <span>包含 {stock.strategies.length} 種策略回測</span>
                  </div>
                  
                  <div className="space-y-2">
                    {stock.strategies.slice(0, 3).map((strategy) => (
                      <Link 
                        key={strategy.id} 
                        href={`/stocks/${stock.symbol}/${strategy.id}`}
                        className="block"
                      >
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted transition-colors text-sm group">
                          <span className="font-medium group-hover:text-primary transition-colors">
                            {strategy.name}
                          </span>
                          <span className={`font-bold ${strategy.roi > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {strategy.roi > 0 ? '+' : ''}{strategy.roi}%
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <Button asChild className="w-full mt-4" variant="outline">
                    <Link href={`/stocks/${stock.symbol}/${stock.strategies[0].id}`}>
                      查看完整報告 <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredStocks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">找不到符合 "{searchTerm}" 的股票</p>
            <Button 
              variant="link" 
              onClick={() => setSearchTerm("")}
              className="mt-2"
            >
              清除搜尋
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
