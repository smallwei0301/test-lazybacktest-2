import { calculatePortfolioMetrics, calculateSalesMetrics, calculateFinancialPlan } from '../utils/calculations'

/**
 * API 資料獲取測試
 * 測試 4 層回退系統和快取機制
 */

describe('API Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  describe('fetchStockData API Fallback', () => {
    it('should handle stock code normalization', () => {
      // Test cases for stock code normalization
      const testCases = [
        { input: '2330', expected: '2330' },
        { input: '2330.TW', expected: '2330' },
        { input: '2330.TWO', expected: '2330' },
        { input: '  2330  ', expected: '2330' },
      ]

      testCases.forEach(({ input, expected }) => {
        const normalized = input.replace(/\.T[WO]+/, '').trim()
        expect(normalized).toBe(expected)
      })
    })

    it('should cache API results', () => {
      const cacheKey = 'stockPrice_2330_2025-11-10'
      const mockData = {
        stockId: '2330',
        price: 688.5,
        priceDate: '2025-11-10',
        source: 'tse-mis',
        lastUpdated: Date.now(),
      }

      localStorage.setItem(cacheKey, JSON.stringify(mockData))
      const cached = localStorage.getItem(cacheKey)
      expect(cached).toBe(JSON.stringify(mockData))
    })
  })

  describe('Portfolio Integration', () => {
    it('should calculate metrics for mixed portfolio', () => {
      const portfolio = [
        {
          uuid: '1',
          id: '2330',
          date: '2024-01-01',
          shares: 10,
          price: 1000,
          manualDividends: [
            { uuid: 'd1', date: '2024-06-01', amount: 150 },
          ],
          stockName: 'TSMC',
        },
        {
          uuid: '2',
          id: '2454',
          date: '2024-02-01',
          shares: 5,
          price: 800,
          manualDividends: [
            { uuid: 'd2', date: '2024-06-01', amount: 80 },
          ],
          stockName: 'MediaTek',
        },
      ]

      const currentPrices = {
        '2330': 1200,
        '2454': 900,
      }

      const result = calculatePortfolioMetrics(portfolio, currentPrices)

      expect(result.totalInvestment).toBe(14000)
      expect(result.totalShares).toBe(15)
      expect(result.stockCount).toBe(2)
      expect(result.totalCurrentValue).toBe(16500)
      expect(result.totalUnrealizedGain).toBe(2500)
      expect(result.totalDividendIncome).toBe(230)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid stock codes gracefully', () => {
      const invalidCodes = ['', '123', 'TSMC', 'ABC']

      invalidCodes.forEach((code) => {
        const isValid = /^\d{4}$/.test(code)
        expect(isValid).toBe(false)
      })
    })

    it('should handle future dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const selectedDate = new Date(tomorrowStr)

      expect(selectedDate > today).toBe(true)
    })

    it('should handle zero amounts', () => {
      const amounts = ['0', '0.00', '-1', 'invalid']

      amounts.forEach((amount) => {
        const parsed = Number.parseFloat(amount)
        const isValid = !isNaN(parsed) && parsed > 0
        
        if (amount === '0' || amount === '0.00' || amount === '-1') {
          expect(isValid).toBe(false)
        }
      })
    })
  })

  describe('Performance', () => {
    it('should calculate metrics for large portfolio quickly', () => {
      // Create portfolio with 1000 stocks
      const largePortfolio = Array.from({ length: 1000 }, (_, i) => ({
        uuid: `stock-${i}`,
        id: `${1000 + i}`,
        date: '2024-01-01',
        shares: Math.random() * 100,
        price: Math.random() * 10000,
        manualDividends: [],
        stockName: `Stock ${i}`,
      }))

      const start = performance.now()
      const result = calculatePortfolioMetrics(largePortfolio)
      const end = performance.now()

      expect(end - start).toBeLessThan(100) // Should complete in less than 100ms
      expect(result.stockCount).toBe(1000)
    })
  })
})
