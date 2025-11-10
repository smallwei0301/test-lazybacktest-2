/**
 * 投資組合計算工具函式
 * 這些函式應該被提取到 stock-records/page.tsx 中
 */

interface Dividend {
  uuid: string
  date: string
  amount: number
}

interface Stock {
  uuid: string
  id: string
  date: string
  shares: number
  price: number
  manualDividends: Dividend[]
  stockName?: string
  currentPrice?: number
  priceDate?: string
  priceStatus?: 'ok' | 'historical' | 'failed'
  image?: string
  notes?: string
}

interface Sale {
  uuid: string
  stockId: string
  date: string
  shares: number
  price: number
  realizedPL?: number
  realizedGain?: number
  feeAmount?: number
}

interface PortfolioMetrics {
  totalInvestment: number
  totalShares: number
  stockCount: number
  totalCurrentValue?: number
  totalUnrealizedGain?: number
  totalDividendIncome?: number
}

/**
 * 計算投資組合基本指標
 */
export const calculatePortfolioMetrics = (
  portfolio: Stock[],
  currentPrices?: Record<string, number>
): PortfolioMetrics => {
  if (!portfolio || portfolio.length === 0) {
    return {
      totalInvestment: 0,
      totalShares: 0,
      stockCount: 0,
      totalCurrentValue: 0,
      totalUnrealizedGain: 0,
      totalDividendIncome: 0,
    }
  }

  let totalInvestment = 0
  let totalShares = 0
  let totalCurrentValue = 0
  let totalDividendIncome = 0

  for (const stock of portfolio) {
    // 計算購買成本
    const investmentAmount = stock.shares * stock.price
    totalInvestment += investmentAmount
    totalShares += stock.shares

    // 計算股利收入
    const dividendIncome = stock.manualDividends.reduce(
      (sum, div) => sum + div.amount,
      0
    )
    totalDividendIncome += dividendIncome

    // 計算當前市值（如果提供了當前價格）
    if (currentPrices && currentPrices[stock.id]) {
      const currentValue = stock.shares * currentPrices[stock.id]
      totalCurrentValue += currentValue
    }
  }

  const totalUnrealizedGain = totalCurrentValue - totalInvestment

  return {
    totalInvestment,
    totalShares,
    stockCount: portfolio.length,
    totalCurrentValue,
    totalUnrealizedGain,
    totalDividendIncome,
  }
}

/**
 * 計算銷售紀錄的實現損益
 */
export const calculateSalesMetrics = (
  sales: Sale[],
  portfolio: Stock[]
): { totalRealizedGain: number; totalFees: number } => {
  if (!sales || sales.length === 0) {
    return { totalRealizedGain: 0, totalFees: 0 }
  }

  let totalRealizedGain = 0
  let totalFees = 0

  for (const sale of sales) {
    if (sale.realizedGain) {
      totalRealizedGain += sale.realizedGain
    }
    if (sale.feeAmount) {
      totalFees += sale.feeAmount
    }
  }

  return { totalRealizedGain, totalFees }
}

/**
 * 計算複利財務規劃
 * 公式: V(n) = B*(1+A%)^n + C*[((1+A%)^n - (1+A%))/A%]
 * B: 初始金額
 * A: 年度報酬率
 * C: 年度加碼金額
 * n: 年份
 * 
 * 邏輯：
 * - 初始金額複利增長 n 年
 * - 每年加碼在年初投入，也依報酬率複利增長
 */
export const calculateFinancialPlan = (
  initialAmount: number,
  annualIncrease: number,
  returnRate: number,
  years: number
): number[] => {
  const results: number[] = []
  const rateDecimal = returnRate / 100

  for (let n = 1; n <= years; n++) {
    let value: number

    if (Math.abs(rateDecimal) < 0.0001) {
      // 處理接近 0% 的情況
      value = initialAmount + annualIncrease * n
    } else {
      const compoundFactor = Math.pow(1 + rateDecimal, n)
      const initialGrowth = initialAmount * compoundFactor
      // 年度增額的複利計算：每年投入 C，第一年投入會複利 n-1 年，第二年 n-2 年...等
      // 等比數列求和: C*[(1+r)^n - (1+r)] / r
      const annualGrowth =
        annualIncrease *
        ((compoundFactor - (1 + rateDecimal)) / rateDecimal)

      value = initialGrowth + annualGrowth
    }

    results.push(Math.round(value * 100) / 100) // 四捨五入到小數點後 2 位
  }

  return results
}

/**
 * 按年度計算投資組合指標
 */
export const calculateAnnualMetrics = (
  portfolio: Stock[],
  fiscalYearStart: number
): Record<string, PortfolioMetrics> => {
  const metrics: Record<string, PortfolioMetrics> = {}

  // 按購買年份分組股票
  const stocksByYear: Record<string, Stock[]> = {}

  for (const stock of portfolio) {
    const purchaseDate = new Date(stock.date)
    const year = purchaseDate.getFullYear()
    const month = purchaseDate.getMonth() + 1

    // 判斷會計年份
    let fiscalYear = year
    if (month < fiscalYearStart) {
      fiscalYear--
    }

    const yearKey = `${fiscalYear}`
    if (!stocksByYear[yearKey]) {
      stocksByYear[yearKey] = []
    }
    stocksByYear[yearKey].push(stock)
  }

  // 計算每個年份的指標
  for (const [year, stocks] of Object.entries(stocksByYear)) {
    metrics[year] = calculatePortfolioMetrics(stocks)
  }

  return metrics
}
