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

import { StockCard } from "@/components/stock-card"

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
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            個股策略庫
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            探索台股熱門標的的回測數據，找到最適合您的交易策略
          </p>
          
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              type="text"
              placeholder="輸入股票代號或名稱 (例如: 2330, 台積電)"
              className="pl-10 h-12 text-lg shadow-sm border-primary/20 focus-visible:ring-primary/30"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {filteredStocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
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
