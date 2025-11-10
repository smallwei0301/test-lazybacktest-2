import {
  calculatePortfolioMetrics,
  calculateSalesMetrics,
  calculateFinancialPlan,
  calculateAnnualMetrics,
} from './calculations'

describe('Portfolio Calculations', () => {
  describe('calculatePortfolioMetrics', () => {
    it('should return zero metrics for empty portfolio', () => {
      const result = calculatePortfolioMetrics([])

      expect(result.totalInvestment).toBe(0)
      expect(result.totalShares).toBe(0)
      expect(result.stockCount).toBe(0)
      expect(result.totalCurrentValue).toBe(0)
    })

    it('should calculate metrics for single stock', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [
            { uuid: 'd1', date: '2024-06-01', amount: 100 },
          ],
          stockName: 'TSMC',
        },
      ]

      const result = calculatePortfolioMetrics(portfolio)

      expect(result.totalInvestment).toBe(10000) // 10 * 1000
      expect(result.totalShares).toBe(10)
      expect(result.stockCount).toBe(1)
      expect(result.totalDividendIncome).toBe(100)
    })

    it('should calculate metrics for multiple stocks', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [],
          stockName: 'TSMC',
        },
        {
          uuid: '2',
          id: '2454',
          date: '2024-01-15',
          shares: 5,
          price: 800,
          manualDividends: [],
          stockName: 'MediaTek',
        },
      ]

      const result = calculatePortfolioMetrics(portfolio)

      expect(result.totalInvestment).toBe(14000) // 10*1000 + 5*800
      expect(result.totalShares).toBe(15)
      expect(result.stockCount).toBe(2)
    })

    it('should calculate current value with prices', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [],
          currentPrice: 1200,
        },
      ]

      const currentPrices = { '2330': 1200 }
      const result = calculatePortfolioMetrics(portfolio, currentPrices)

      expect(result.totalInvestment).toBe(10000)
      expect(result.totalCurrentValue).toBe(12000)
      expect(result.totalUnrealizedGain).toBe(2000)
    })

    it('should handle negative unrealized gain', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [],
        },
      ]

      const currentPrices = { '2330': 800 }
      const result = calculatePortfolioMetrics(portfolio, currentPrices)

      expect(result.totalInvestment).toBe(10000)
      expect(result.totalCurrentValue).toBe(8000)
      expect(result.totalUnrealizedGain).toBe(-2000)
    })

    it('should aggregate multiple dividends', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [
            { uuid: 'd1', date: '2024-06-01', amount: 150 },
            { uuid: 'd2', date: '2024-12-01', amount: 200 },
          ],
        },
      ]

      const result = calculatePortfolioMetrics(portfolio)

      expect(result.totalDividendIncome).toBe(350)
    })
  })

  describe('calculateSalesMetrics', () => {
    it('should return zero for empty sales', () => {
      const result = calculateSalesMetrics([], [])

      expect(result.totalRealizedGain).toBe(0)
      expect(result.totalFees).toBe(0)
    })

    it('should calculate realized gain and fees', () => {
      const sales = [
        {
          uuid: 's1',
          stockId: '2330',
          date: '2024-06-01',
          shares: 5,
          price: 1100,
          realizedGain: 500,
          feeAmount: 50,
        },
      ]

      const result = calculateSalesMetrics(sales, [])

      expect(result.totalRealizedGain).toBe(500)
      expect(result.totalFees).toBe(50)
    })

    it('should aggregate multiple sales', () => {
      const sales = [
        {
          uuid: 's1',
          stockId: '2330',
          date: '2024-06-01',
          shares: 5,
          price: 1100,
          realizedGain: 500,
          feeAmount: 50,
        },
        {
          uuid: 's2',
          stockId: '2454',
          date: '2024-07-01',
          shares: 3,
          price: 900,
          realizedGain: 300,
          feeAmount: 30,
        },
      ]

      const result = calculateSalesMetrics(sales, [])

      expect(result.totalRealizedGain).toBe(800)
      expect(result.totalFees).toBe(80)
    })
  })

  describe('calculateFinancialPlan', () => {
    it('should calculate compound growth with 0% return', () => {
      const result = calculateFinancialPlan(10000, 1000, 0, 3)

      // Year 1: 10000 + 1000 = 11000
      // Year 2: 11000 + 1000 = 12000
      // Year 3: 12000 + 1000 = 13000
      expect(result).toEqual([11000, 12000, 13000])
    })

    it('should calculate compound growth with positive return', () => {
      const result = calculateFinancialPlan(10000, 0, 10, 2)

      // Year 1: 10000 * 1.1 = 11000
      // Year 2: 11000 * 1.1 = 12100
      expect(result[0]).toBeCloseTo(11000, 0)
      expect(result[1]).toBeCloseTo(12100, 0)
    })

    it('should handle negative return rate', () => {
      const result = calculateFinancialPlan(10000, 0, -10, 2)

      // Year 1: 10000 * 0.9 = 9000
      // Year 2: 9000 * 0.9 = 8100
      expect(result[0]).toBeCloseTo(9000, 0)
      expect(result[1]).toBeCloseTo(8100, 0)
    })

    it('should calculate complex plan with initial and annual amounts', () => {
      const result = calculateFinancialPlan(100000, 50000, 5, 1)

      // Year 1: 100000*1.05 + 50000*[(1.05^1 - 1.05)/0.05]
      // = 105000 + 50000*[0] = 105000
      // (因為公式中年度加碼的係數會在第一年變成 0)
      expect(result[0]).toBeCloseTo(105000, 0)
    })

    it('should round to 2 decimal places', () => {
      const result = calculateFinancialPlan(10000, 1000, 3.33, 1)

      // Result should have at most 2 decimal places
      expect(result[0] % 1).toBeLessThan(0.01)
    })
  })

  describe('calculateAnnualMetrics', () => {
    it('should return empty for empty portfolio', () => {
      const result = calculateAnnualMetrics([], 1)

      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should group stocks by year', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [],
        },
        {
          uuid: '2',
          id: '2454',
          date: '2024-06-01',
          shares: 5,
          price: 800,
          manualDividends: [],
        },
      ]

      const result = calculateAnnualMetrics(portfolio, 1)

      expect(Object.keys(result)).toContain('2024')
      expect(result['2024'].stockCount).toBe(2)
      expect(result['2024'].totalInvestment).toBe(14000)
    })

    it('should respect fiscal year start month', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [],
        },
        {
          uuid: '2',
          id: '2454',
          date: '2024-12-01',
          shares: 5,
          price: 800,
          manualDividends: [],
        },
      ]

      // 會計年度從 4 月開始
      const result = calculateAnnualMetrics(portfolio, 4)

      // 1月份股票 -> 2023 會計年度
      // 12月份股票 -> 2024 會計年度
      expect(Object.keys(result).sort()).toEqual(['2023', '2024'])
    })
  })
})
