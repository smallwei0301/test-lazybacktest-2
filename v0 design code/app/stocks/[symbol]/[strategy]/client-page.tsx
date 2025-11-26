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
