"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, PlusCircle, ImagePlus, List, LayoutGrid, Calculator, BarChart3 } from "lucide-react"
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

const BUY_FEE_RATE = 0.001425
const DEFAULT_SELL_FEE_STOCK = 0.001425 + 0.003
const DEFAULT_SELL_FEE_ETF = 0.001425 + 0.001

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

  const [stockId, setStockId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [purchaseShares, setPurchaseShares] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [showAddDividendModal, setShowAddDividendModal] = useState(false)
  const [modalStockId, setModalStockId] = useState("")
  const [modalDividendExDate, setModalDividendExDate] = useState("")
  const [modalDividendAmount, setModalDividendAmount] = useState("")
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false)
  const [toast, setToast] = useState({ show: false, message: "", isError: false })
  const [imageUploadText, setImageUploadText] = useState("圖片輸入")
  const [imageUploadLoading, setImageUploadLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPurchaseDate(new Date().toISOString().split("T")[0])
    loadData()
  }, [])

  const showToast = (message: string, isError = false) => {
    setToast({ show: true, message, isError })
    setTimeout(() => setToast({ show: false, message: "", isError: false }), 3000)
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

    // Reset form
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

    setImageUploadText("辨識中...")
    setImageUploadLoading(true)

    try {
      // Simulate image processing
      await new Promise((resolve) => setTimeout(resolve, 2000))
      showToast("圖片辨識功能需要API金鑰設定", true)
    } catch (error) {
      showToast("圖片辨識失敗", true)
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

  const metrics = calculatePortfolioMetrics()

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/stock-records" backLink={{ href: "/backtest", label: "回到回測工具" }} />

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${
            toast.isError ? "bg-destructive" : "bg-primary"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="container mx-auto p-4 md:p-8">
        <section className="mb-12 text-center">
          <div className="max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              專業投資組合管理
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">股票收益紀錄系統</h1>
            <p className="text-lg text-muted-foreground mb-8 text-pretty leading-relaxed">
              自動追蹤您的台股投資組合表現，提供詳細的收益分析與風險評估
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
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
          <CardContent className="p-6">
            <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
              <div className="space-y-2">
                <Label htmlFor="stockId" className="text-sm font-medium text-foreground">
                  股票代碼
                </Label>
                <Input
                  id="stockId"
                  value={stockId}
                  onChange={(e) => setStockId(e.target.value)}
                  placeholder="例如: 2330"
                  className="border-muted-foreground/20 focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseDate" className="text-sm font-medium text-foreground">
                  購買日期
                </Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="border-muted-foreground/20 focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseShares" className="text-sm font-medium text-foreground">
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
                  className="border-muted-foreground/20 focus:border-primary"
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
                  className="border-muted-foreground/20 focus:border-primary"
                  required
                />
              </div>
              <Button type="submit" size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12">
                <PlusCircle className="mr-2 h-5 w-5" />
                新增紀錄
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">我的投資組合</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">即時追蹤您的投資表現</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettings((prev) => ({ ...prev, isCompactMode: !prev.isCompactMode }))}
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
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
          <CardContent className="p-6">
            {portfolio.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">尚未新增任何股票紀錄</h3>
                <p className="text-muted-foreground mb-6">開始記錄您的第一筆投資，建立專屬的投資組合</p>
                <Button
                  onClick={() => document.getElementById("stockId")?.focus()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  立即新增股票
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl border border-primary/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-muted-foreground">總投資金額</div>
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-primary mb-1">
                      ${Math.round(metrics.totalInvestment).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">包含手續費</div>
                  </div>
                  <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-6 rounded-xl border border-accent/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-muted-foreground">持有張數</div>
                      <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                        <Calculator className="h-4 w-4 text-accent" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-accent mb-1">{metrics.totalShares.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">總持股張數</div>
                  </div>
                  <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-6 rounded-xl border border-primary/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-muted-foreground">持有股票數</div>
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <List className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-foreground mb-1">{metrics.stockCount}</div>
                    <div className="text-xs text-muted-foreground">不同股票</div>
                  </div>
                </div>

                {/* Stock List */}
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

        {/* Summary Section */}
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
              <p className="text-muted-foreground text-center py-8">年度統計功能開發中...</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial Planning */}
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
            <Button className="w-full md:w-auto mb-6">
              <Calculator className="mr-2 h-5 w-5" />
              計算並同步目標
            </Button>
            <div className="overflow-x-auto">
              <p className="text-muted-foreground text-center py-4">請輸入完整的規劃參數。</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Dividend Modal */}
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

      {/* Confirm Delete Modal */}
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
      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
