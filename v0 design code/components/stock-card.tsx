"use client"

import { useState } from "react"
import Link from "next/link"
import { TrendingUp, ChevronDown, ChevronUp, ArrowRight, BarChart2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Strategy = {
  id: string
  name: string
  type: string
  winRate: number
  roi: number
  tradeCount: number
  lastSignal: string
  lastSignalDate: string
}

type Stock = {
  symbol: string
  name: string
  strategies: Strategy[]
}

interface StockCardProps {
  stock: Stock
}

export function StockCard({ stock }: StockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Sort strategies by ROI (descending) to show best first
  const sortedStrategies = [...stock.strategies].sort((a, b) => b.roi - a.roi)
  const bestStrategy = sortedStrategies[0]

  return (
    <Card className={cn(
      "transition-all duration-300 border-2 hover:border-primary/50 overflow-hidden",
      isExpanded ? "row-span-2 shadow-xl ring-2 ring-primary/20" : "hover:shadow-lg"
    )}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start">
          <div>
            <Badge variant="outline" className="mb-2 bg-background/50 backdrop-blur-sm">
              {stock.symbol}
            </Badge>
            <CardTitle className="text-2xl">{stock.name}</CardTitle>
          </div>
          <div className={cn(
            "p-2 rounded-full transition-colors duration-300",
            isExpanded ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}>
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats (Always Visible) */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <BarChart2 className="h-4 w-4" />
            <span>包含 {stock.strategies.length} 種策略回測</span>
          </div>

          {/* Best Strategy Preview (Visible when collapsed) */}
          <div className={cn(
            "transition-all duration-300 ease-in-out",
            isExpanded ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto"
          )}>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-sm">最高報酬策略</span>
                <Badge variant="secondary" className="text-xs">ROI NO.1</Badge>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground text-sm">{bestStrategy.name}</span>
                <span className="text-lg font-bold text-green-600">+{bestStrategy.roi}%</span>
              </div>
            </div>
          </div>

          {/* All Strategies List (Visible when expanded) */}
          <div className={cn(
            "space-y-2 transition-all duration-500 ease-in-out",
            isExpanded ? "opacity-100 max-h-[500px]" : "opacity-0 max-h-0 overflow-hidden"
          )}>
            <div className="text-sm font-medium text-muted-foreground mb-2">所有策略表現：</div>
            {sortedStrategies.map((strategy) => (
              <Link 
                key={strategy.id} 
                href={`/stocks/${stock.symbol}/${strategy.id}`}
                className="block group"
              >
                <div className="flex justify-between items-center p-3 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all">
                  <div className="flex flex-col">
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {strategy.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      勝率 {strategy.winRate}% • 交易 {strategy.tradeCount} 次
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "font-bold",
                      strategy.roi > 0 ? "text-red-500" : "text-green-500"
                    )}>
                      {strategy.roi > 0 ? '+' : ''}{strategy.roi}%
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Expand/Collapse Toggle */}
          <Button 
            variant="ghost" 
            className="w-full mt-2 hover:bg-muted/50 group"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <span className="flex items-center text-muted-foreground group-hover:text-foreground">
                收合列表 <ChevronUp className="ml-2 h-4 w-4" />
              </span>
            ) : (
              <span className="flex items-center text-primary font-medium">
                查看完整報告 <ChevronDown className="ml-2 h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
