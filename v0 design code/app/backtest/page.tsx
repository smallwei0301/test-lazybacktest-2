// Page Version: LB-FE-20250304A

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart3,
  Settings,
  Play,
  TrendingUp,
  Target,
  FileText,
  Shield,
  Zap,
  Users,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Home,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import SiteFooter from "@/components/site-footer"

export default function BacktestPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <Home className="h-5 w-5" />
              <span className="text-sm font-medium">返回首頁</span>
            </Link>
            <div className="h-6 w-px bg-border"></div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <div className="w-6 h-6 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-1 h-1 bg-primary-foreground rounded-full"></div>
                    <div className="w-1 h-1 bg-primary-foreground rounded-full"></div>
                    <div className="w-1 h-1 bg-primary-foreground rounded-full"></div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="w-1 h-2 bg-primary-foreground rounded-sm"></div>
                    <div className="w-1 h-3 bg-primary-foreground rounded-sm"></div>
                    <div className="w-1 h-1 bg-primary-foreground rounded-sm"></div>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-xl font-bold text-foreground">股票回測工具</span>
                <div className="text-xs text-muted-foreground">策略驗證平台</div>
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/stock-records">
              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
              >
                股票紀錄
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-br from-background via-primary/5 to-accent/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-4 border-primary text-foreground">
              專業回測平台
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">股票回測工具</h1>
            <p className="text-lg text-muted-foreground mb-8 text-pretty leading-relaxed">
              透過歷史數據驗證您的交易策略，做出更明智的投資決策
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>歷史數據回測</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full"></div>
                <span>策略參數優化</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>風險評估分析</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full"></div>
                <span>績效指標統計</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
        {/* Hero Section */}
        {/* <div className="bg-background border-b">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">股票回測工具</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              透過歷史數據驗證您的交易策略，做出更明智的投資決策
            </p>
          </div>
        </div> */}

        <div className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Left Panel - Settings (3/4 width) */}
            <div className="lg:col-span-3 space-y-6">
              {/* Tab Navigation */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="border-b border-border">
                    <nav className="flex space-x-8">
                      <button
                        className="py-4 px-1 border-b-2 border-primary text-primary font-medium text-sm"
                        data-tab="summary"
                      >
                        基本設定
                      </button>
                      <button
                        className="py-4 px-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground font-medium text-sm"
                        data-tab="performance"
                      >
                        績效分析
                      </button>
                      <button
                        className="py-4 px-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground font-medium text-sm"
                        data-tab="trades"
                      >
                        交易記錄
                      </button>
                      <button
                        className="py-4 px-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground font-medium text-sm"
                        data-tab="optimization"
                      >
                        參數優化
                      </button>
                      <button
                        className="py-4 px-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground font-medium text-sm"
                        data-tab="batch-optimization"
                      >
                        批量優化
                      </button>
                    </nav>
                  </div>
                </CardHeader>
              </Card>

              {/* Content Area */}
              <div className="space-y-6">
                {/* Basic Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      基本設定
                    </CardTitle>
                    <CardDescription>設定股票代碼、時間範圍和初始資金</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">股票代碼</label>
                        <input
                          type="text"
                          id="stockNo"
                          defaultValue="2330"
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="例如: 2330"
                        />
                        <div className="mt-1">
                          <label className="flex items-center text-sm text-muted-foreground">
                            <input type="checkbox" id="adjustedPriceCheckbox" disabled className="mr-2" />
                            除權息還原股價 (開發中)
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">初始資金</label>
                        <input
                          type="number"
                          id="initialCapital"
                          defaultValue={100000}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">開始日期</label>
                        <input
                          type="date"
                          id="startDate"
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">結束日期</label>
                        <input
                          type="date"
                          id="endDate"
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">或使用最近年數</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          id="recentYears"
                          defaultValue={5}
                          min={1}
                          max={20}
                          className="flex-1 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button id="applyYearsBtn" variant="outline">
                          套用
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trading Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-accent" />
                      交易設定
                    </CardTitle>
                    <CardDescription>設定交易時機和手續費</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-3">交易時機</label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            id="tradeTimingClose"
                            name="tradeTiming"
                            value="close"
                            defaultChecked
                            className="mr-2"
                          />
                          <span className="text-sm">收盤價</span>
                        </label>
                        <label className="flex items-center">
                          <input type="radio" id="tradeTimingOpen" name="tradeTiming" value="open" className="mr-2" />
                          <span className="text-sm">隔日開盤價</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">買入手續費 (%)</label>
                        <input
                          type="number"
                          id="buyFee"
                          defaultValue={0.1425}
                          step={0.01}
                          min={0}
                          max={5}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">賣出手續費 (%)</label>
                        <input
                          type="number"
                          id="sellFee"
                          defaultValue={0.4425}
                          step={0.01}
                          min={0}
                          max={5}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-destructive" />
                      風險管理
                    </CardTitle>
                    <CardDescription>設定部位大小和停損停利</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-3">部位計算基準</label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            id="positionBasisInitial"
                            name="positionBasis"
                            value="initialCapital"
                            defaultChecked
                            className="mr-2"
                          />
                          <span className="text-sm">初始本金</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            id="positionBasisTotal"
                            name="positionBasis"
                            value="totalCapital"
                            className="mr-2"
                          />
                          <span className="text-sm">總資金</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">部位大小 (%)</label>
                        <input
                          type="number"
                          id="positionSize"
                          defaultValue={100}
                          min={1}
                          max={100}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">停損 (%)</label>
                        <input
                          type="number"
                          id="stopLoss"
                          defaultValue={0}
                          min={0}
                          max={50}
                          step={0.1}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="0 = 不啟用"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">停利 (%)</label>
                        <input
                          type="number"
                          id="takeProfit"
                          defaultValue={0}
                          min={0}
                          max={100}
                          step={0.1}
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="0 = 不啟用"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strategy Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      策略設定
                    </CardTitle>
                    <CardDescription>設定進場和出場條件</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">進場策略</label>
                        <select
                          id="entryStrategy"
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="ma_cross">均線黃金交叉</option>
                          <option value="ma_above">價格突破均線</option>
                          <option value="rsi_oversold">RSI超賣</option>
                          <option value="macd_cross">MACD黃金交叉</option>
                          <option value="bollinger_breakout">布林通道突破</option>
                          <option value="k_d_cross">KD黃金交叉</option>
                          <option value="volume_spike">成交量爆增</option>
                          <option value="price_breakout">價格突破</option>
                          <option value="williams_oversold">威廉指標超賣</option>
                          <option value="turtle_breakout">海龜突破</option>
                        </select>
                        <div id="entryParams" className="mt-4 space-y-3"></div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">出場策略</label>
                        <select
                          id="exitStrategy"
                          className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="ma_cross">均線死亡交叉</option>
                          <option value="ma_below">價格跌破均線</option>
                          <option value="rsi_overbought">RSI超買</option>
                          <option value="trailing_stop">移動停損</option>
                          <option value="fixed_stop_loss">固定停損</option>
                        </select>
                        <div id="exitParams" className="mt-4 space-y-3"></div>
                      </div>
                    </div>

                    {/* Short Selling Option */}
                    <div className="border-t pt-4">
                      <label className="flex items-center mb-4">
                        <input type="checkbox" id="enableShortSelling" className="mr-2" />
                        <span className="text-sm font-medium text-foreground">啟用做空交易</span>
                      </label>

                      <div id="short-strategy-area" className="hidden space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">做空進場策略</label>
                            <select
                              id="shortEntryStrategy"
                              className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="ma_cross">均線死亡交叉</option>
                              <option value="rsi_overbought">RSI超買</option>
                              <option value="macd_cross">MACD死亡交叉</option>
                            </select>
                            <div id="shortEntryParams" className="mt-3 space-y-2"></div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">做空出場策略</label>
                            <select
                              id="shortExitStrategy"
                              className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="ma_cross">均線黃金交叉</option>
                              <option value="rsi_oversold">RSI超賣</option>
                              <option value="trailing_stop">移動停損</option>
                            </select>
                            <div id="shortExitParams" className="mt-3 space-y-2"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div id="optimization-tab" className="hidden">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-accent" />
                        參數優化
                      </CardTitle>
                      <CardDescription>自動尋找最佳參數組合</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="font-medium text-foreground mb-3">進場策略優化</h4>
                          <select
                            id="optimizeEntryParamSelect"
                            className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                          >
                            <option value="">選擇參數...</option>
                            <option value="fast">短期均線</option>
                            <option value="slow">長期均線</option>
                            <option value="period">週期</option>
                            <option value="threshold">閾值</option>
                          </select>
                          <Button id="optimizeEntryBtn" variant="outline" className="w-full bg-transparent">
                            優化進場參數
                          </Button>
                        </div>

                        <div>
                          <h4 className="font-medium text-foreground mb-3">出場策略優化</h4>
                          <select
                            id="optimizeExitParamSelect"
                            className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                          >
                            <option value="">選擇參數...</option>
                            <option value="fast">短期均線</option>
                            <option value="slow">長期均線</option>
                            <option value="percentage">百分比</option>
                          </select>
                          <Button id="optimizeExitBtn" variant="outline" className="w-full bg-transparent">
                            優化出場參數
                          </Button>
                        </div>

                        <div>
                          <h4 className="font-medium text-foreground mb-3">風險管理優化</h4>
                          <select
                            id="optimizeRiskParamSelect"
                            className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                          >
                            <option value="">選擇參數...</option>
                            <option value="stopLoss">停損</option>
                            <option value="takeProfit">停利</option>
                            <option value="positionSize">部位大小</option>
                          </select>
                          <Button id="optimizeRiskBtn" variant="outline" className="w-full bg-transparent">
                            優化風險參數
                          </Button>
                        </div>
                      </div>

                      <div id="optimization-progress-section" className="hidden">
                        <div className="bg-muted/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-medium">優化進行中...</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 mb-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: "0%" }}
                            ></div>
                          </div>
                          <p className="text-xs text-muted-foreground">正在測試參數組合...</p>
                        </div>
                      </div>

                      <div id="optimization-results" className="space-y-4">
                        <p className="text-muted-foreground text-sm">執行優化後將顯示最佳參數組合</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div id="batch-optimization-tab" className="hidden">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        批量優化
                      </CardTitle>
                      <CardDescription>同時測試多種策略組合</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-foreground mb-3">買入策略</h4>
                          <div
                            id="buy-strategies-list"
                            className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-md p-3"
                          >
                            <label className="flex items-center">
                              <input type="checkbox" value="ma_cross" className="mr-2" />
                              <span className="text-sm">均線黃金交叉</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="ma_above" className="mr-2" />
                              <span className="text-sm">價格突破均線</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="rsi_oversold" className="mr-2" />
                              <span className="text-sm">RSI超賣</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="macd_cross" className="mr-2" />
                              <span className="text-sm">MACD黃金交叉</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="bollinger_breakout" className="mr-2" />
                              <span className="text-sm">布林通道突破</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="k_d_cross" className="mr-2" />
                              <span className="text-sm">KD黃金交叉</span>
                            </label>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button id="select-all-buy" variant="outline" size="sm">
                              全選
                            </Button>
                            <Button id="clear-all" variant="outline" size="sm">
                              清除
                            </Button>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-foreground mb-3">賣出策略</h4>
                          <div
                            id="sell-strategies-list"
                            className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-md p-3"
                          >
                            <label className="flex items-center">
                              <input type="checkbox" value="ma_cross" className="mr-2" />
                              <span className="text-sm">均線死亡交叉</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="ma_below" className="mr-2" />
                              <span className="text-sm">價格跌破均線</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="rsi_overbought" className="mr-2" />
                              <span className="text-sm">RSI超買</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="trailing_stop" className="mr-2" />
                              <span className="text-sm">移動停損</span>
                            </label>
                            <label className="flex items-center">
                              <input type="checkbox" value="fixed_stop_loss" className="mr-2" />
                              <span className="text-sm">固定停損</span>
                            </label>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button id="select-all-sell" variant="outline" size="sm">
                              全選
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-foreground mb-3">優化目標</h4>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="batch-target-metric"
                              value="annualizedReturn"
                              defaultChecked
                              className="mr-2"
                            />
                            <span className="text-sm">年化報酬率</span>
                          </label>
                          <label className="flex items-center">
                            <input type="radio" name="batch-target-metric" value="sharpeRatio" className="mr-2" />
                            <span className="text-sm">夏普比率</span>
                          </label>
                          <label className="flex items-center">
                            <input type="radio" name="batch-target-metric" value="sortinoRatio" className="mr-2" />
                            <span className="text-sm">索提諾比率</span>
                          </label>
                          <label className="flex items-center">
                            <input type="radio" name="batch-target-metric" value="maxDrawdown" className="mr-2" />
                            <span className="text-sm">最大回撤</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">測試次數</label>
                          <input
                            type="number"
                            id="batch-optimize-parameter-trials"
                            defaultValue={100}
                            min={10}
                            max={1000}
                            className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">並發數</label>
                          <input
                            type="number"
                            id="batch-optimize-concurrency"
                            defaultValue={4}
                            min={1}
                            max={8}
                            className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">迭代限制</label>
                          <input
                            type="number"
                            id="batch-optimize-iteration-limit"
                            defaultValue={6}
                            min={1}
                            max={20}
                            className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <Button
                          id="start-batch-optimization"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          開始批量優化
                        </Button>
                        <Button id="stop-batch-optimization" variant="outline" className="hidden bg-transparent">
                          停止優化
                        </Button>
                      </div>

                      {/* Batch Progress Panel */}
                      <div id="batch-optimization-progress" className="hidden">
                        <Card className="bg-muted/20">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">批量優化進度</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>總體進度</span>
                                <span id="batch-progress-text">0%</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  id="batch-progress-bar"
                                  className="bg-primary h-2 rounded-full transition-all duration-300"
                                  style={{ width: "0%" }}
                                ></div>
                              </div>
                            </div>
                            <div className="text-sm space-y-1">
                              <p id="batch-progress-detail">準備中...</p>
                              <p id="batch-progress-combination" className="text-muted-foreground"></p>
                              <p id="batch-time-estimate" className="text-muted-foreground"></p>
                            </div>
                            <div
                              id="batch-long-wait-notice"
                              className="hidden bg-accent/10 border border-accent/20 rounded-lg p-3"
                            >
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-accent mt-0.5" />
                                <div className="text-sm">
                                  <p className="font-medium text-accent">長時間運算提醒</p>
                                  <p className="text-muted-foreground">
                                    批量優化可能需要較長時間，建議您先去忙其他事情。
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Worker Status Panel */}
                        <Card id="batch-worker-status-panel" className="mt-4">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Worker 狀態</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-4 text-sm mb-4">
                              <span>
                                並發數:{" "}
                                <span id="batch-current-concurrency" className="font-medium">
                                  0
                                </span>
                              </span>
                              <span>
                                進行中:{" "}
                                <span id="batch-inflight-count" className="font-medium">
                                  0
                                </span>
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table id="batch-worker-status-list" className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Worker</th>
                                    <th className="text-left py-2">狀態</th>
                                    <th className="text-left py-2">當前任務</th>
                                    <th className="text-left py-2">進度</th>
                                  </tr>
                                </thead>
                                <tbody></tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Action Buttons */}
                <Card className="shadow-lg border-2 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Play className="h-5 w-5" />
                      執行回測
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      id="backtestBtn"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6"
                      size="lg"
                    >
                      <Play className="mr-2 h-5 w-5" />
                      開始回測
                    </Button>

                    <div className="grid grid-cols-1 gap-2">
                      <Button id="resetBtn" variant="outline" size="sm">
                        重置設定
                      </Button>
                      <Button id="randomizeBtn" variant="outline" size="sm">
                        隨機參數
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Results - Enhanced */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-accent">快速結果</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      id="result"
                      className="text-sm text-muted-foreground min-h-[100px] flex items-center justify-center border-2 border-dashed border-muted rounded-lg"
                    >
                      執行回測後將顯示結果摘要
                    </div>
                  </CardContent>
                </Card>

                {/* Strategy Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-accent" />
                      策略管理
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">已儲存策略</label>
                      <select
                        id="loadStrategySelect"
                        className="w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">選擇策略...</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Button id="saveStrategyBtn" variant="outline" size="sm">
                        儲存策略
                      </Button>
                      <Button id="loadStrategyBtn" variant="outline" size="sm">
                        載入策略
                      </Button>
                      <Button id="deleteStrategyBtn" variant="outline" size="sm">
                        刪除策略
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Loading/Progress */}
                <Card id="loading" className="hidden">
                  <CardHeader>
                    <CardTitle>執行中...</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          id="progressBar"
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: "0%" }}
                        ></div>
                      </div>
                      <p id="loadingText" className="text-sm text-muted-foreground">
                        準備中...
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card id="today-suggestion-area" className="hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-accent" />
                      今日建議
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">基於您的策略，今日操作建議將在這裡顯示</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-8">
            {/* Chart Area - More prominent */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl">淨值曲線圖</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-muted/20 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
                  <canvas id="chart" className="w-full h-full"></canvas>
                  <div className="text-muted-foreground text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>執行回測後將顯示淨值曲線</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Tabs - Enhanced */}
            <div className="space-y-6">
              {/* Summary Tab */}
              <div id="summary-tab">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl">回測摘要</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      id="backtest-result"
                      className="text-muted-foreground min-h-[200px] flex items-center justify-center border-2 border-dashed border-muted rounded-lg"
                    >
                      執行回測後將顯示詳細結果
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Tab */}
              <div id="performance-tab" className="hidden">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl">績效分析</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      id="performance-table-container"
                      className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-muted rounded-lg"
                    >
                      <p className="text-muted-foreground">執行回測後將顯示績效指標</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trades Tab */}
              <div id="trades-tab" className="hidden">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl">交易記錄</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      id="trade-results"
                      className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-muted rounded-lg"
                    >
                      <p className="text-muted-foreground">執行回測後將顯示交易明細</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <SiteFooter theme="light" showDonate={false} />

      <script src="/backtest-worker.js" defer></script>
      <script src="/batch-optimization.js" defer></script>
      <script
        type="module"
        dangerouslySetInnerHTML={{
          __html: `
          import { initializeBacktestApp } from '/lib/main-logic.js';
          import { strategyConfigs } from '/lib/strategy-config.js';
          
          // 初始化回測應用
          document.addEventListener('DOMContentLoaded', () => {
            initializeBacktestApp();
          });
        `,
        }}
      />
    </div>
  )
}
