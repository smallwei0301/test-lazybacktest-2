"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, PlusCircle, ImagePlus, List, LayoutGrid, Calculator, BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Eye, EyeOff, X, Pencil, Check, RotateCcw, Loader2, Plus } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

interface Stock {
  uuid: string
  id: string
  date: string
  shares: number
  price: number
  manualDividends: Dividend[]
}

interface Sale {
  uuid: string
  date: string
  shares: number
  price: number
  realizedPL?: number
}

interface Dividend {
  date: string
  dividend: number
  originalDate?: string
  isOverridden?: boolean
}

interface Settings {
  fiscalYearStart: number
  manualOverrides: Record<string, any>
  targetProfits: Record<string, number>
  isCompactMode: boolean
  isHistoryCompactMode: boolean
  financialPlan: Record<string, any>
  hideZeroGainRows: boolean
}

interface ToastNotification {
  id: string
  message: string
  type: "success" | "error" | "warning" | "info"
  duration: number
  show: boolean
}

interface StockData {
  price: number | null
  priceDate: string | null
  stockName: string | null
  priceStatus: string
  dividends: Dividend[]
  dividendStatus: string
}

interface TransactionCycle {
  stockId: string
  isHistorical: boolean
  purchases: Stock[]
  sales: Sale[]
  cycleId: string
}

const BUY_FEE_RATE = 0.001425
const DEFAULT_SELL_FEE_STOCK = 0.001425 + 0.003
const DEFAULT_SELL_FEE_ETF = 0.001425 + 0.001

function sanitizeForId(text: string) {
  if (!text) return ""
  return text.replace(/[^\w\u4e00-\u9fa5-]/g, "_")
}

async function fetchStockData(stockId: string): Promise<StockData> {
  if (stockId.includes("(需手動更正)")) {
    return {
      price: null,
      priceDate: "N/A",
      stockName: stockId.replace("(需手動更正)", ""),
      priceStatus: "failed",
      dividends: [],
      dividendStatus: "failed",
    }
  }

  let price: number | null = null
  let priceDate: string | null = null
  let stockName: string | null = null
  let priceStatus = "ok"
  let dividends: Dividend[] = []
  let dividendStatus = "ok"

  const proxyUrl = "https://corsproxy.io/?"
  let tickerSuffix = ".TW"
  if (stockId.toUpperCase().endsWith("B")) {
    tickerSuffix = ".TWO"
  } else if (stockId.length === 4 && !stockId.startsWith("00")) {
    const otcPrefixes = ["3", "4", "5", "6", "8"]
    if (otcPrefixes.includes(stockId[0])) {
      tickerSuffix = ".TWO"
    }
  }
  const yahooTicker = `${stockId}${tickerSuffix}`

  // Source 1: TWSE MIS API
  try {
    const tseUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockId}.tw`
    const otcUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${stockId}.tw`

    const parseTwseData = (data: any) => {
      if (data.msgArray && data.msgArray.length > 0) {
        const info = data.msgArray[0]
        if (info.n) {
          stockName = info.n
        }
        const rawDate = info.d
        if (rawDate && rawDate.length === 8) {
          const formattedDateStr = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`
          priceDate = new Date(formattedDateStr).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })
        } else {
          priceDate = "N/A"
        }
        const currentPrice = Number.parseFloat(info.z)
        if (!isNaN(currentPrice) && currentPrice > 0) {
          price = currentPrice
          return true
        }
      }
      return false
    }

    let response = await fetch(`${proxyUrl}${encodeURIComponent(tseUrl)}`)
    let data = await response.json()
    if (!parseTwseData(data)) {
      response = await fetch(`${proxyUrl}${encodeURIComponent(otcUrl)}`)
      data = await response.json()
      parseTwseData(data)
    }
    if (price === null) {
      priceStatus = "nodata"
    }
  } catch (e) {
    console.error(`Source 1 (MIS) failed for ${stockId}:`, e)
    priceStatus = "failed"
  }

  // Source 2: Yahoo Finance
  if (priceStatus !== "ok") {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=5d&interval=1d`
      const response = await fetch(`${proxyUrl}${encodeURIComponent(yahooUrl)}`)
      const data = await response.json()
      if (data.chart.result && data.chart.result[0]) {
        const result = data.chart.result[0]
        const closePrices = result.indicators.quote[0].close
        const timestamps = result.timestamp
        for (let i = timestamps.length - 1; i >= 0; i--) {
          if (closePrices[i] !== null && timestamps[i] !== null) {
            price = closePrices[i]
            const date = new Date(timestamps[i] * 1000)
            priceDate = date.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })
            priceStatus = "historical"
            if (!stockName) {
              stockName = result.meta.shortName || result.meta.symbol
            }
            break
          }
        }
      }
      if (price === null) {
        priceStatus = "failed"
      }
    } catch (e) {
      console.error(`Source 2 (Yahoo) failed for ${stockId}:`, e)
      priceStatus = "failed"
    }
  }

  // Source 3: TWSE Daily
  if (priceStatus === "failed" || priceStatus === "nodata") {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const y_str = yesterday.getFullYear()
      const m_str = String(yesterday.getMonth() + 1).padStart(2, "0")
      const d_str = String(yesterday.getDate()).padStart(2, "0")
      const dateStr = `${y_str}${m_str}${d_str}`
      const twseDailyUrl = `https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date=${dateStr}&type=ALLBUT0999`
      const response = await fetch(`${proxyUrl}${encodeURIComponent(twseDailyUrl)}`)
      const data = await response.json()
      if (data.stat === "OK" && data.data9) {
        const stockInfo = data.data9.find((item: any[]) => item[0].trim() === stockId)
        if (stockInfo) {
          const closePrice = Number.parseFloat(stockInfo[8].replace(/,/g, ""))
          if (!isNaN(closePrice) && closePrice > 0) {
            price = closePrice
            priceDate = `${m_str}/${d_str}`
            priceStatus = "historical"
            if (!stockName) stockName = stockInfo[1].trim()
          }
        }
      }
    } catch (e) {
      console.error(`Source 3 (TWSE Daily) failed for ${stockId}:`, e)
    }
  }

  // Source 4: FinMind API
  if (priceStatus === "failed" || priceStatus === "nodata") {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dateStr = yesterday.toISOString().split("T")[0]
      const finmindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${stockId}&start_date=${dateStr}&end_date=${dateStr}`
      const response = await fetch(finmindUrl)
      const data = await response.json()
      if (data.data && data.data.length > 0 && data.data[0].close) {
        price = data.data[0].close
        priceDate = new Date(data.data[0].date).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })
        priceStatus = "historical"
      }
    } catch (e) {
      console.error(`Source 4 (Finmind) failed for ${stockId}:`, e)
    }
  }

  // Dividends
  try {
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 5)
    const period1 = Math.floor(startDate.getTime() / 1000)
    const period2 = Math.floor(new Date().getTime() / 1000)
    const yahooDivUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?period1=${period1}&period2=${period2}&interval=1d&events=div`
    const response = await fetch(`${proxyUrl}${encodeURIComponent(yahooDivUrl)}`)
    if (response.ok) {
      const data = await response.json()
      if (
        data.chart.result &&
        data.chart.result[0] &&
        data.chart.result[0].events &&
        data.chart.result[0].events.dividends
      ) {
        const dividendEvents = data.chart.result[0].events.dividends
        dividends = Object.values(dividendEvents).map((event: any) => ({
          date: new Date(event.date * 1000).toISOString().split("T")[0],
          dividend: event.amount,
        }))
        dividendStatus = "ok"
      } else {
        dividendStatus = "nodata"
      }
    } else {
      console.warn(`Yahoo Dividend API for ${stockId} returned status: ${response.status}`)
      dividendStatus = "failed"
    }
  } catch (e) {
    console.error(`Failed to fetch dividends for ${stockId}:`, e)
    dividendStatus = "failed"
  }

  if (price === null) priceStatus = "failed"
  return { price, priceDate, stockName, priceStatus, dividends, dividendStatus }
}

function getSellFeeRate(stockId: string, feeSettings: Record<string, number>) {
  if (feeSettings[stockId]) {
    return feeSettings[stockId]
  }
  return stockId.startsWith("00") ? DEFAULT_SELL_FEE_ETF : DEFAULT_SELL_FEE_STOCK
}

function calculateStockMetrics(stock: Stock, currentPrice: number, finalDividends: Dividend[]) {
  const totalShares = stock.shares * 1000
  const totalCost = stock.price * totalShares * (1 + BUY_FEE_RATE)
  const stockDividends = finalDividends.filter((d) => new Date(d.date) >= new Date(stock.date))
  const cumulativeDividend = stockDividends.reduce((acc, curr) => acc + curr.dividend * totalShares, 0)
  const avgHoldingCost = totalShares > 0 ? (totalCost - cumulativeDividend) / totalShares : 0
  const currentValue = currentPrice * totalShares
  const returnAmount = currentValue + cumulativeDividend - totalCost
  const returnRate = totalCost > 0 ? (returnAmount / totalCost) * 100 : 0
  
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const lastYearTotalDividendPerShare = finalDividends
    .filter((d) => new Date(d.date) > oneYearAgo)
    .reduce((sum, d) => sum + d.dividend, 0)
  const projectedAnnualDividend = lastYearTotalDividendPerShare * totalShares

  return {
    ...stock,
    totalCost,
    dividends: stockDividends,
    cumulativeDividend,
    avgHoldingCost,
    currentValue,
    returnAmount,
    returnRate,
    projectedAnnualDividend,
  }
}

function calculateGroupMetrics(transactions: any[], stockId: string, manualOverrides: Record<string, any>) {
  const group = {
    id: stockId,
    totalShares: 0,
    totalCost: 0,
    cumulativeDividend: 0,
    currentValue: 0,
    projectedAnnualDividend: 0,
    returnAmount: 0,
    returnRate: 0,
    avgHoldingCost: 0,
    dividends: [] as Dividend[],
  }

  const allDividends: Dividend[] = []
  transactions.forEach((tx) => {
    group.totalShares += tx.shares
    group.totalCost += tx.totalCost
    group.cumulativeDividend += tx.cumulativeDividend
    group.currentValue += tx.currentValue
    group.projectedAnnualDividend += tx.projectedAnnualDividend
    allDividends.push(...tx.dividends)
  })

  const uniqueDividends = new Map()
  allDividends.forEach(d => {
      const key = d.originalDate || d.date
      uniqueDividends.set(key, d)
  })
  
  group.dividends = Array.from(uniqueDividends.values()).sort(
    (a: Dividend, b: Dividend) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  if (manualOverrides[stockId]?.projected !== undefined) {
    group.projectedAnnualDividend = manualOverrides[stockId].projected
  }

  const totalSharesInUnits = group.totalShares * 1000
  group.avgHoldingCost = totalSharesInUnits > 0 ? (group.totalCost - group.cumulativeDividend) / totalSharesInUnits : 0
  group.returnAmount = group.currentValue + group.cumulativeDividend - group.totalCost
  group.returnRate = group.totalCost > 0 ? (group.returnAmount / group.totalCost) * 100 : 0

  return group
}

function processTransactions(
  stockId: string,
  originalPurchases: Stock[],
  originalSales: Sale[],
  finalDividends: Dividend[],
  feeSettings: Record<string, number>
) {
  let totalRealizedPL = 0
  let totalRealizedDividends = 0
  const salesHistory: Sale[] = []
  const sellFeeRate = getSellFeeRate(stockId, feeSettings)
  
  const purchaseQueue = JSON.parse(JSON.stringify(originalPurchases)).sort(
    (a: Stock, b: Stock) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  
  const sortedSales = [...(originalSales || [])].sort(
    (a: Sale, b: Sale) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  for (const sale of sortedSales) {
    let sharesToSell = sale.shares * 1000
    const saleProceeds = sale.price * sharesToSell
    let costOfSoldShares = 0

    while (sharesToSell > 0 && purchaseQueue.length > 0) {
      const currentPurchaseLot = purchaseQueue[0]
      const sharesAvailableInLot = currentPurchaseLot.shares * 1000
      const sharesToTakeFromLot = Math.min(sharesToSell, sharesAvailableInLot)

      const purchaseDate = new Date(currentPurchaseLot.date)
      const saleDate = new Date(sale.date)

      const relevantDividends = finalDividends.filter((d) => {
        const exDivDate = new Date(d.date)
        return exDivDate >= purchaseDate && exDivDate < saleDate
      })

      totalRealizedDividends += relevantDividends.reduce((acc, curr) => acc + curr.dividend * sharesToTakeFromLot, 0)

      const costPerShareInLot = currentPurchaseLot.price * (1 + BUY_FEE_RATE)
      costOfSoldShares += sharesToTakeFromLot * costPerShareInLot

      currentPurchaseLot.shares = (sharesAvailableInLot - sharesToTakeFromLot) / 1000
      sharesToSell -= sharesToTakeFromLot

      if (currentPurchaseLot.shares <= 1e-9) {
        purchaseQueue.shift()
      }
    }

    const saleFee = saleProceeds * sellFeeRate
    const realizedPLForThisSale = saleProceeds - costOfSoldShares - saleFee
    totalRealizedPL += realizedPLForThisSale
    salesHistory.push({ ...sale, realizedPL: realizedPLForThisSale })
  }

  return {
    realizedPL: totalRealizedPL,
    realizedDividends: totalRealizedDividends,
    remainingPurchases: purchaseQueue,
    salesHistory,
  }
}

function groupTransactionsIntoCycles(allPurchases: Stock[], allSales: Record<string, Sale[]>) {
  const cycles: TransactionCycle[] = []
  const purchasesById = allPurchases.reduce((acc, p) => {
    if (!acc[p.id]) acc[p.id] = []
    acc[p.id].push(p)
    return acc
  }, {} as Record<string, Stock[]>)

  for (const stockId in purchasesById) {
    const stockPurchases = purchasesById[stockId].map((p) => ({ ...p, type: "purchase" }))
    const stockSales = (allSales[stockId] || []).map((s) => ({ ...s, type: "sale" }))
    
    const allTransactions = [...stockPurchases, ...stockSales].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    let activePurchases: Stock[] = []
    let activeSales: Sale[] = []
    let currentShares = 0

    for (const tx of allTransactions) {
      if ((tx as any).type === "purchase") {
        activePurchases.push(tx as Stock)
        currentShares += tx.shares
      } else {
        activeSales.push(tx as Sale)
        currentShares -= tx.shares

        if (currentShares < 1e-9) {
          cycles.push({
            stockId: stockId,
            isHistorical: true,
            purchases: JSON.parse(JSON.stringify(activePurchases)),
            sales: JSON.parse(JSON.stringify(activeSales)),
            cycleId: `${stockId}-${tx.date}`,
          })
          activePurchases = []
          activeSales = []
          currentShares = 0
        }
      }
    }

    if (activePurchases.length > 0) {
      cycles.push({
        stockId: stockId,
        isHistorical: false,
        purchases: activePurchases,
        sales: activeSales,
        cycleId: `${stockId}-active`,
      })
    }
  }
  return cycles
}

export default function StockRecordsPage() {
  const [portfolio, setPortfolio] = useState<Stock[]>([])
  const [sales, setSales] = useState<Record<string, Sale[]>>({})
  const [feeSettings, setFeeSettings] = useState<Record<string, number>>({})
  const [settings, setSettings] = useState<Settings>({
    fiscalYearStart: 1,
    manualOverrides: {},
    targetProfits: {},
    isCompactMode: false,
    isHistoryCompactMode: false,
    financialPlan: {},
    hideZeroGainRows: false,
  })

  const [stockPrices, setStockPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  const [stockId, setStockId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [purchaseShares, setPurchaseShares] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [showAddDividendModal, setShowAddDividendModal] = useState(false)
  const [modalStockId, setModalStockId] = useState("")
  const [modalDividendExDate, setModalDividendExDate] = useState("")
  const [modalDividendAmount, setModalDividendAmount] = useState("")
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const [imageUploadText, setImageUploadText] = useState("圖片輸入")
  const [imageUploadLoading, setImageUploadLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPurchaseDate(new Date().toISOString().split("T")[0])
    loadData()
  }, [])

  useEffect(() => {
    saveData()
  }, [portfolio, sales, feeSettings, settings])

  useEffect(() => {
    if (portfolio.length > 0) {
      fetchPrices()
    }
  }, [portfolio])

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "success",
    duration: number = 3000
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newToast: ToastNotification = {
      id,
      message,
      type,
      duration,
      show: true
    }
    setToasts((prev) => [...prev, newToast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const saveData = () => {
    localStorage.setItem("stockPortfolio", JSON.stringify(portfolio))
    localStorage.setItem("stockSales", JSON.stringify(sales))
    localStorage.setItem("stockFeeSettings", JSON.stringify(feeSettings))
    localStorage.setItem("stockSettings", JSON.stringify(settings))
  }

  const loadData = () => {
    try {
      const savedPortfolio = localStorage.getItem("stockPortfolio")
      const savedSales = localStorage.getItem("stockSales")
      const savedFeeSettings = localStorage.getItem("stockFeeSettings")
      const savedSettings = localStorage.getItem("stockSettings")

      if (savedPortfolio) setPortfolio(JSON.parse(savedPortfolio))
      if (savedSales) setSales(JSON.parse(savedSales))
      if (savedFeeSettings) setFeeSettings(JSON.parse(savedFeeSettings))
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings({
          fiscalYearStart: parsed.fiscalYearStart || 1,
          manualOverrides: parsed.manualOverrides || {},
          targetProfits: parsed.targetProfits || {},
          isCompactMode: parsed.isCompactMode || false,
          isHistoryCompactMode: parsed.isHistoryCompactMode || false,
          financialPlan: parsed.financialPlan || {},
          hideZeroGainRows: parsed.hideZeroGainRows || false,
        })
      }
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const fetchPrices = async () => {
    if (loading) return
    setLoading(true)
    const uniqueIds = Array.from(new Set(portfolio.map((s) => s.id)))
    const newPrices = { ...stockPrices }

    for (const id of uniqueIds) {
      try {
        const data = await fetchStockData(id)
        if (data && data.price !== null) {
          newPrices[id] = data.price
        }
      } catch (e) {
        console.error(`Failed to fetch price for ${id}`, e)
      }
    }
    setStockPrices(newPrices)
    setLoading(false)
  }

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockId || !purchaseDate || !purchaseShares || !purchasePrice) return

    const newStock: Stock = {
      uuid: crypto.randomUUID(),
      id: stockId.trim(),
      date: purchaseDate,
      shares: Number.parseFloat(purchaseShares),
      price: Number.parseFloat(purchasePrice),
      manualDividends: [],
    }

    const updatedPortfolio = [...portfolio, newStock]
    setPortfolio(updatedPortfolio)

    setStockId("")
    setPurchaseShares("")
    setPurchasePrice("")
    setPurchaseDate(new Date().toISOString().split("T")[0])

    showToast("股票紀錄已新增")
  }

  const deleteStock = (uuid: string) => {
    const updatedPortfolio = portfolio.filter((stock) => stock.uuid !== uuid)
    setPortfolio(updatedPortfolio)
    showToast("股票紀錄已刪除")
  }

  const deleteAllRecords = () => {
    setPortfolio([])
    setSales({})
    setFeeSettings({})
    setSettings((prev) => ({
      ...prev,
      manualOverrides: {},
      targetProfits: {},
    }))
    setShowConfirmDeleteModal(false)
    showToast("所有紀錄已刪除")
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    let apiKey = localStorage.getItem("geminiApiKey")
    if (!apiKey) {
      apiKey = prompt("請輸入 Google Gemini API Key:")
      if (!apiKey) return
      localStorage.setItem("geminiApiKey", apiKey)
    }

    setImageUploadText("辨識中...")
    setImageUploadLoading(true)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      
      const base64Data = base64.split(',')[1]
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              contents: [{
                  parts: [
                      { text: "請分析這張股票交易圖片，回傳JSON格式：[{id: '股票代號', date: 'YYYY-MM-DD', shares: 股數(number), price: 單價(number), type: 'buy'|'sell'}]。只回傳JSON，不要有其他文字。" },
                      { inline_data: { mime_type: file.type, data: base64Data } }
                  ]
              }]
          })
      })
      
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error("No response from Gemini")
      
      const jsonStr = text.replace(/```json|```/g, '').trim()
      const transactions = JSON.parse(jsonStr)
      
      const newPortfolio = [...portfolio]
      const newSales = { ...sales }
      let addedCount = 0

      for (const tx of transactions) {
          if (tx.type === 'buy') {
              newPortfolio.push({
                  uuid: crypto.randomUUID(),
                  id: tx.id,
                  date: tx.date,
                  shares: tx.shares / 1000,
                  price: tx.price,
                  manualDividends: []
              })
              addedCount++
          } else if (tx.type === 'sell') {
              if (!newSales[tx.id]) newSales[tx.id] = []
              newSales[tx.id].push({
                  uuid: crypto.randomUUID(),
                  date: tx.date,
                  shares: tx.shares / 1000,
                  price: tx.price,
                  realizedPL: 0 
              })
              addedCount++
          }
      }
      
      setPortfolio(newPortfolio)
      setSales(newSales)
      showToast(`成功辨識並新增 ${addedCount} 筆交易`)

    } catch (error) {
      console.error(error)
      showToast("圖片辨識失敗", "error")
    } finally {
      setImageUploadText("圖片輸入")
      setImageUploadLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const calculatePortfolioMetrics = () => {
    if (portfolio.length === 0) {
      return {
        totalInvestment: 0,
        totalShares: 0,
        stockCount: 0,
      }
    }

    const totalInvestment = portfolio.reduce((sum, stock) => {
      return sum + stock.price * stock.shares * 1000 * (1 + BUY_FEE_RATE)
    }, 0)

    const totalShares = portfolio.reduce((sum, stock) => sum + stock.shares, 0)

    const uniqueStocks = new Set(portfolio.map((stock) => stock.id))

    return {
      totalInvestment,
      totalShares,
      stockCount: uniqueStocks.size,
    }
  }

  const calculateYearlySummary = () => {
    if (portfolio.length === 0) {
      return []
    }

    const fiscalYearStart = settings.fiscalYearStart
    const yearlyData: Record<
      string,
      {
        year: string
        totalInvestment: number
        totalShares: number
        totalDividends: number
        realizedPL: number
        unrealizedPL: number
      }
    > = {}

    portfolio.forEach((stock) => {
      const stockDate = new Date(stock.date)
      let year = stockDate.getFullYear()
      const month = stockDate.getMonth() + 1

      if (month < fiscalYearStart) {
        year -= 1
      }

      const yearKey = `${year}-${year + 1}`

      if (!yearlyData[yearKey]) {
        yearlyData[yearKey] = {
          year: yearKey,
          totalInvestment: 0,
          totalShares: 0,
          totalDividends: 0,
          realizedPL: 0,
          unrealizedPL: 0,
        }
      }

      const cost = stock.price * stock.shares * 1000 * (1 + BUY_FEE_RATE)
      yearlyData[yearKey].totalInvestment += cost
      yearlyData[yearKey].totalShares += stock.shares

      stock.manualDividends.forEach((div) => {
        yearlyData[yearKey].totalDividends += div.dividend * stock.shares
      })

      const stockSales = sales[stock.uuid] || []
      stockSales.forEach((sale) => {
        const saleDate = new Date(sale.date)
        let saleYear = saleDate.getFullYear()
        const saleMonth = saleDate.getMonth() + 1
        if (saleMonth < fiscalYearStart) {
          saleYear -= 1
        }
        const saleYearKey = `${saleYear}-${saleYear + 1}`
        if (saleYearKey === yearKey && sale.realizedPL) {
          yearlyData[yearKey].realizedPL += sale.realizedPL
        }
      })
    })

    return Object.values(yearlyData).sort((a, b) => a.year.localeCompare(b.year))
  }

  const handleCalculateFinancialPlan = () => {
    const initialAge = document.getElementById("initialAge") as HTMLInputElement
    const initialInvestmentYear = document.getElementById("initialInvestmentYear") as HTMLInputElement
    const planningEndYear = document.getElementById("planningEndYear") as HTMLInputElement
    const initialInvestmentAmount = document.getElementById("initialInvestmentAmount") as HTMLInputElement
    const annualIncreaseAmount = document.getElementById("annualIncreaseAmount") as HTMLInputElement
    const expectedReturnRate = document.getElementById("expectedReturnRate") as HTMLInputElement

    if (
      !initialAge.value ||
      !initialInvestmentYear.value ||
      !planningEndYear.value ||
      !initialInvestmentAmount.value ||
      !annualIncreaseAmount.value ||
      !expectedReturnRate.value
    ) {
      showToast("請輸入所有規劃參數", "error")
      return
    }

    const age = Number.parseInt(initialAge.value)
    const startYear = Number.parseInt(initialInvestmentYear.value)
    const endYear = Number.parseInt(planningEndYear.value)
    const initialAmount = Number.parseFloat(initialInvestmentAmount.value)
    const annualIncrease = Number.parseFloat(annualIncreaseAmount.value)
    const returnRate = Number.parseFloat(expectedReturnRate.value) / 100

    if (startYear >= endYear || endYear - startYear > 100) {
      showToast("年份設定有誤，請檢查", "error")
      return
    }

    let currentBalance = initialAmount
    const plan: Array<{
      year: number
      age: number
      balance: number
      yearlyGain: number
    }> = []

    for (let year = startYear; year <= endYear; year++) {
      const yearlyGain = currentBalance * returnRate
      currentBalance = currentBalance + yearlyGain + annualIncrease
      plan.push({
        year,
        age: age + (year - startYear),
        balance: Math.round(currentBalance),
        yearlyGain: Math.round(yearlyGain),
      })
    }

    const newSettings = {
      ...settings,
      financialPlan: {
        initialAge: age,
        startYear,
        endYear,
        initialAmount,
        annualIncrease,
        returnRate: returnRate * 100,
        projections: plan,
      },
    }

    setSettings(newSettings)
    showToast(
      `財務規劃已完成！預計 ${endYear} 年達成 $${Math.round(currentBalance).toLocaleString()} 資產`,
      "success"
    )
  }

  const yearlySummary = calculateYearlySummary()
  const metrics = calculatePortfolioMetrics()

  // Group portfolio by ID for display
  const groupedPortfolio = useMemo(() => {
    const groups: Record<string, any> = {}
    const uniqueIds = Array.from(new Set(portfolio.map(p => p.id)))
    
    uniqueIds.forEach(id => {
        const stockTransactions = portfolio.filter(p => p.id === id)
        const stockSales = sales[id] || []
        // We need dividends here. For now, empty or manual.
        // In v0.9, dividends are fetched. We need to integrate that.
        // But for now, let's just use manual dividends attached to stock.
        const dividends: Dividend[] = [] 
        stockTransactions.forEach(s => dividends.push(...s.manualDividends))
        
        const group = calculateGroupMetrics(stockTransactions.map(s => ({
            ...s,
            totalCost: s.price * s.shares * 1000 * (1 + BUY_FEE_RATE),
            cumulativeDividend: 0, // Simplified for now
            currentValue: (stockPrices[id] || s.price) * s.shares * 1000,
            projectedAnnualDividend: 0,
            dividends: s.manualDividends
        })), id, settings.manualOverrides)
        
        groups[id] = group
    })
    return groups
  }, [portfolio, sales, stockPrices, settings.manualOverrides])

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/stock-records" backLink={{ href: "/backtest", label: "回到回測工具" }} />

      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 space-y-2 z-50 max-w-xs sm:max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3 sm:p-4 rounded-lg shadow-lg flex items-start justify-between gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 text-xs sm:text-sm ${
              toast.type === "error"
                ? "bg-destructive text-destructive-foreground"
                : toast.type === "warning"
                ? "bg-yellow-500 text-white"
                : toast.type === "info"
                ? "bg-blue-500 text-white"
                : "bg-green-500 text-white"
            }`}
          >
            <p className="font-medium flex-1">{toast.message}</p>
            {toast.duration === 0 && (
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-base sm:text-lg leading-none hover:opacity-75 transition-opacity"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="container mx-auto p-3 sm:p-4 md:p-8">
        <section className="mb-8 sm:mb-12 text-center">
          <div className="max-w-4xl mx-auto px-2 sm:px-4">
            <Badge variant="outline" className="mb-3 sm:mb-4 border-primary text-primary text-xs sm:text-sm">
              專業投資組合管理
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 text-balance">股票收益紀錄系統</h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 text-pretty leading-relaxed">
              自動追蹤您的台股投資組合表現，提供詳細的收益分析與風險評估
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>智能圖片辨識</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full"></div>
                <span>即時數據同步</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>專業績效分析</span>
              </div>
            </div>
          </div>
        </section>

        <Card className="mb-8 shadow-lg border-0 bg-gradient-to-br from-card to-card/80">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <PlusCircle className="h-6 w-6 text-primary" />
                  新增股票紀錄
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">手動輸入或使用圖片辨識功能</p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploadLoading}
                className="flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <ImagePlus className="h-5 w-5" />
                <span>{imageUploadText}</span>
                {imageUploadLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                )}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <form onSubmit={handleAddStock} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 items-end">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="stockId" className="text-xs sm:text-sm font-medium text-foreground">
                  股票代碼
                </Label>
                <Input
                  id="stockId"
                  value={stockId}
                  onChange={(e) => setStockId(e.target.value)}
                  placeholder="例如: 2330"
                  className="border-muted-foreground/20 focus:border-primary text-sm"
                  required
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="purchaseDate" className="text-xs sm:text-sm font-medium text-foreground">
                  購買日期
                </Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="border-muted-foreground/20 focus:border-primary text-sm"
                  required
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="purchaseShares" className="text-xs sm:text-sm font-medium text-foreground">
                  購買張數
                </Label>
                <Input
                  id="purchaseShares"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={purchaseShares}
                  onChange={(e) => setPurchaseShares(e.target.value)}
                  placeholder="1張 = 1000股"
                  className="border-muted-foreground/20 focus:border-primary text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchasePrice" className="text-sm font-medium text-foreground">
                  購買成本 (每股)
                </Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="例如: 688.5"
                  className="border-muted-foreground/20 focus:border-primary text-sm"
                  required
                />
              </div>
              <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 sm:h-12 text-xs sm:text-sm">
                <PlusCircle className="mr-1 sm:mr-2 h-4 sm:h-5 w-4 sm:w-5" />
                新增
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mb-6 sm:mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">我的投資組合</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">即時追蹤您的投資表現</p>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettings((prev) => ({ ...prev, isCompactMode: !prev.isCompactMode }))}
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm h-9 sm:h-10"
                >
                  {settings.isCompactMode ? <LayoutGrid className="mr-2 h-4 w-4" /> : <List className="mr-2 h-4 w-4" />}
                  {settings.isCompactMode ? "卡片模式" : "精簡模式"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDeleteModal(true)}
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  刪除全部
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {portfolio.length === 0 ? (
              <div className="text-center py-8 sm:py-12 md:py-16">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <BarChart3 className="h-8 sm:h-10 md:h-12 w-8 sm:w-10 md:w-12 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 sm:mb-2">尚未新增任何股票紀錄</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">開始記錄您的第一筆投資，建立專屬的投資組合</p>
                <Button
                  onClick={() => document.getElementById("stockId")?.focus()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm h-9 sm:h-10"
                >
                  立即新增股票
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 sm:p-6 rounded-xl border border-primary/20">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground">總投資金額</div>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">
                      ${Math.round(metrics.totalInvestment).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">包含手續費</div>
                  </div>
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 sm:p-6 rounded-xl border border-primary/20 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground">持有張數</div>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                        <Calculator className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-accent mb-1">{metrics.totalShares.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">總持股張數</div>
                  </div>
                  <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-4 sm:p-6 rounded-xl border border-primary/20 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground">持有股票數</div>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <List className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{metrics.stockCount}</div>
                    <div className="text-xs text-muted-foreground">不同股票</div>
                  </div>
                </div>

                <div
                  className={
                    settings.isCompactMode ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                  }
                >
                  {portfolio.map((stock) => (
                    <div
                      key={stock.uuid}
                      className={
                        settings.isCompactMode
                          ? "bg-card p-4 rounded-lg border hover:shadow-md transition-shadow flex items-center gap-4"
                          : "bg-card p-6 rounded-lg border hover:shadow-lg transition-all duration-300 group"
                      }
                    >
                      {settings.isCompactMode ? (
                        <>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-foreground">{stock.id}</div>
                            <div className="text-sm text-muted-foreground">{stock.date}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-foreground">{stock.shares} 張</div>
                            <div className="text-sm text-muted-foreground">@ ${stock.price}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-primary">
                              ${Math.round(stock.price * stock.shares * 1000 * (1 + BUY_FEE_RATE)).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">投資成本</div>
                          </div>
                          <Button variant="destructive" size="sm" onClick={() => deleteStock(stock.uuid)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                                {stock.id}
                              </h3>
                              <Badge variant="outline" className="mt-2 border-muted text-muted-foreground">
                                {stock.date}
                              </Badge>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteStock(stock.uuid)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                              <span className="text-sm font-medium text-muted-foreground">購買張數</span>
                              <span className="font-bold text-lg">{stock.shares.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                              <span className="text-sm font-medium text-muted-foreground">購買價格</span>
                              <span className="font-bold text-lg">${stock.price.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                              <span className="text-sm font-medium text-primary">投資成本</span>
                              <span className="font-bold text-xl text-primary">
                                ${Math.round(stock.price * stock.shares * 1000 * (1 + BUY_FEE_RATE)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
              <CardTitle className="text-2xl">年度總覽</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="fiscalYearStart" className="text-sm whitespace-nowrap">
                  統計起始月份:
                </Label>
                <Select
                  value={settings.fiscalYearStart.toString()}
                  onValueChange={(value) =>
                    setSettings((prev) => ({ ...prev, fiscalYearStart: Number.parseInt(value) }))
                  }
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1}月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {yearlySummary.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">尚無年度統計數據，請先新增股票紀錄。</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">會計年度</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">投資成本</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">持股張數</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">現金股利</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">已實現損益</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">未實現損益</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlySummary.map((year, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{year.year}</td>
                        <td className="text-right py-3 px-4">${Math.round(year.totalInvestment).toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{year.totalShares.toLocaleString()}</td>
                        <td className="text-right py-3 px-4 text-accent">${Math.round(year.totalDividends).toLocaleString()}</td>
                        <td
                          className={`text-right py-3 px-4 font-semibold ${
                            year.realizedPL >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          ${Math.round(year.realizedPL).toLocaleString()}
                        </td>
                        <td
                          className={`text-right py-3 px-4 font-semibold ${
                            year.unrealizedPL >= 0 ? "text-blue-600" : "text-orange-600"
                          }`}
                        >
                          ${Math.round(year.unrealizedPL).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">財務規劃</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end mb-6">
              <div>
                <Label htmlFor="initialAge">初始年齡</Label>
                <Input id="initialAge" type="number" placeholder="30" />
              </div>
              <div>
                <Label htmlFor="initialInvestmentYear">開始年份 (X)</Label>
                <Input id="initialInvestmentYear" type="number" placeholder="2024" />
              </div>
              <div>
                <Label htmlFor="planningEndYear">結束年份 (N)</Label>
                <Input id="planningEndYear" type="number" placeholder="2044" />
              </div>
              <div>
                <Label htmlFor="initialInvestmentAmount">初始金額 (B)</Label>
                <Input id="initialInvestmentAmount" type="number" placeholder="1000000" />
              </div>
              <div>
                <Label htmlFor="annualIncreaseAmount">每年加碼 (C)</Label>
                <Input id="annualIncreaseAmount" type="number" placeholder="120000" />
              </div>
              <div>
                <Label htmlFor="expectedReturnRate">報酬率 (A%)</Label>
                <Input id="expectedReturnRate" type="number" placeholder="8" />
              </div>
            </div>
            <Button className="w-full md:w-auto mb-6" onClick={handleCalculateFinancialPlan}>
              <Calculator className="mr-2 h-5 w-5" />
              計算並同步目標
            </Button>
            <div className="overflow-x-auto">
              {settings.financialPlan.projections ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">年份</th>
                      <th className="text-left py-2 px-4">年齡</th>
                      <th className="text-right py-2 px-4">預估資產</th>
                      <th className="text-right py-2 px-4">年度收益</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.financialPlan.projections.map((p: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{p.year}</td>
                        <td className="py-2 px-4">{p.age}</td>
                        <td className="text-right py-2 px-4">${p.balance.toLocaleString()}</td>
                        <td className="text-right py-2 px-4 text-green-600">+${p.yearlyGain.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground text-center py-4">請輸入完整的規劃參數。</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showAddDividendModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>手動新增股利</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setShowAddDividendModal(false)
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="modalDividendExDate">除息日</Label>
                  <Input
                    id="modalDividendExDate"
                    type="date"
                    value={modalDividendExDate}
                    onChange={(e) => setModalDividendExDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="modalDividendAmount">現金股利 (每股)</Label>
                  <Input
                    id="modalDividendAmount"
                    type="number"
                    step="0.0001"
                    value={modalDividendAmount}
                    onChange={(e) => setModalDividendAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <Button type="button" variant="secondary" onClick={() => setShowAddDividendModal(false)}>
                    取消
                  </Button>
                  <Button type="submit">確認新增</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showConfirmDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>確認刪除</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">您確定要刪除所有股票紀錄嗎？此操作無法復原。</p>
              <div className="flex justify-end gap-4">
                <Button variant="secondary" onClick={() => setShowConfirmDeleteModal(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={deleteAllRecords}>
                  確認刪除
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <SiteFooter />
    </div>
  )
}
