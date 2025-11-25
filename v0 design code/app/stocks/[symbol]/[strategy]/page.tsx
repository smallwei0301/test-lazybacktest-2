import { notFound } from "next/navigation"
import seoData from "@/data/seo_mock_data.json"
import StrategyClientPage from "./client-page"

// Helper to find data
const getData = (symbol: string, strategyId: string) => {
  const stock = seoData.find(s => s.symbol === symbol)
  if (!stock) return null
  
  const strategy = stock.strategies.find(s => s.id === strategyId)
  if (!strategy) return null
  
  return { stock, strategy }
}

// Generate Metadata
export async function generateMetadata({ params }: { params: { symbol: string, strategy: string } }) {
  const data = getData(params.symbol, params.strategy)
  if (!data) return { title: 'Strategy Not Found' }
  
  const { stock, strategy } = data
  
  return {
    title: `${stock.symbol} ${stock.name} - ${strategy.name} 回測報告 | LazyBacktest`,
    description: `查看 ${stock.name} (${stock.symbol}) 的 ${strategy.name} 完整回測數據。勝率 ${strategy.winRate}%，ROI ${strategy.roi}%。立即解鎖最新交易訊號！`,
    keywords: [stock.name, stock.symbol, strategy.name, '回測', '台股', '量化交易', 'RSI', 'MACD'],
  }
}

export async function generateStaticParams() {
  return seoData.flatMap((stock) =>
    stock.strategies.map((strategy) => ({
      symbol: stock.symbol,
      strategy: strategy.id,
    }))
  )
}

export default function StrategyPage({ params }: { params: { symbol: string, strategy: string } }) {
  const data = getData(params.symbol, params.strategy)
  
  if (!data) {
    return notFound()
  }

  return <StrategyClientPage stock={data.stock} strategy={data.strategy} />
}
