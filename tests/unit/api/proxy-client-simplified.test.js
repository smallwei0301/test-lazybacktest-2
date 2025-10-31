/**
 * 測試 API 客戶端層（簡化版）
 * 任務：建立統一的 API 呼叫邏輯，從 main.js 提取資料獲取相關代碼
 */

const { ProxyClient } = require('../../../js/layers/api/proxy-client.js');

// Mock fetch for testing
global.fetch = jest.fn();

describe('ProxyClient API 客戶端層', () => {
  let proxyClient;

  beforeEach(() => {
    proxyClient = new ProxyClient();
    fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化和配置', () => {
    test('應該有預設的配置設定', () => {
      expect(proxyClient.getConfig()).toEqual({
        baseUrl: '',
        timeout: 30000,
        retryAttempts: 2,
        retryDelay: 1000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });

    test('應該可以更新配置', () => {
      const newConfig = {
        timeout: 60000,
        retryAttempts: 3,
        headers: {
          'Authorization': 'Bearer token123'
        }
      };

      proxyClient.updateConfig(newConfig);
      const config = proxyClient.getConfig();

      expect(config.timeout).toBe(60000);
      expect(config.retryAttempts).toBe(3);
      expect(config.headers.Authorization).toBe('Bearer token123');
      expect(config.headers.Accept).toBe('application/json'); // 保持預設值
    });
  });

  describe('URL 構建', () => {
    test('應該正確構建 TWSE API URL', () => {
      const url = proxyClient.buildApiUrl({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-02'
      });

      expect(url).toBe('/api/twse/?stockNo=2330&start=2023-01-01&end=2023-01-02');
    });

    test('應該正確構建 TPEX API URL', () => {
      const url = proxyClient.buildApiUrl({
        stockNo: '6488',
        market: 'TPEX',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      });

      expect(url).toBe('/api/tpex/?stockNo=6488&start=2023-01-01&end=2023-01-01');
    });

    test('應該正確構建美股 API URL', () => {
      const url = proxyClient.buildApiUrl({
        stockNo: 'AAPL',
        market: 'US',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      });

      expect(url).toBe('/api/us/?stockNo=AAPL&start=2023-01-01&end=2023-01-01');
    });

    test('應該正確處理指數 URL', () => {
      const url = proxyClient.buildApiUrl({
        stockNo: '^TWII',
        market: 'INDEX',
        startDate: '2023-01-01',
        endDate: '2023-01-02'
      });

      expect(url).toBe('/api/index/?stockNo=%5ETWII&start=2023-01-01&end=2023-01-02');
    });

    test('應該正確處理額外參數', () => {
      const url = proxyClient.buildApiUrl({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-02',
        adjusted: true,
        forceSource: 'yahoo'
      });

      expect(url).toBe('/api/twse/?stockNo=2330&start=2023-01-01&end=2023-01-02&adjusted=1&forceSource=yahoo');
    });

    test('應該正確構建還原股價 URL', () => {
      const url = proxyClient.buildAdjustedPriceUrl({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        split: true
      });

      expect(url).toBe('/api/adjusted-price/?stockNo=2330&startDate=2023-01-01&endDate=2023-01-01&market=TWSE&split=1');
    });
  });

  describe('緩存機制整合', () => {
    test('應該支援緩存鍵生成', () => {
      const cacheKey = proxyClient.buildCacheKey({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        adjusted: false,
        split: false
      });

      expect(cacheKey).toBe('TWSE|2330|RAW|NOSPLIT|2023-01-01|2023-01-01|LB-');
    });

    test('應該支援還原股價的緩存鍵', () => {
      const cacheKey = proxyClient.buildCacheKey({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        adjusted: true,
        split: true,
        lookbackDays: 30
      });

      expect(cacheKey).toBe('TWSE|2330|ADJ|SPLIT|2023-01-01|2023-01-01|LB30');
    });
  });

  describe('請求參數驗證', () => {
    test('應該驗證必要參數', async () => {
      await expect(proxyClient.getStockData({})).rejects.toThrow('Missing required parameter: stockNo');

      await expect(proxyClient.getStockData({
        stockNo: '2330'
      })).rejects.toThrow('Missing required parameter: startDate');

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        startDate: '2023-01-01'
      })).rejects.toThrow('Missing required parameter: endDate');
    });

    test('應該驗證日期格式', async () => {
      await expect(proxyClient.getStockData({
        stockNo: '2330',
        startDate: 'invalid-date',
        endDate: '2023-01-01'
      })).rejects.toThrow('Invalid date format');

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        startDate: '2023-01-01',
        endDate: 'invalid-date'
      })).rejects.toThrow('Invalid date format');
    });

    test('應該驗證日期範圍', async () => {
      await expect(proxyClient.getStockData({
        stockNo: '2330',
        startDate: '2023-12-31',
        endDate: '2023-01-01'
      })).rejects.toThrow('Start date must be before or equal to end date');
    });
  });

  describe('股票數據獲取（成功情況）', () => {
    test('應該能夠獲取 TWSE 股票數據', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 100, high: 105, low: 99, close: 102, volume: 1000 },
          { date: '2023-01-02', open: 102, high: 108, low: 101, close: 106, volume: 1200 }
        ],
        symbol: '2330',
        market: 'TWSE'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-02'
      });

      expect(result.data).toHaveLength(2);
      expect(result.symbol).toBe('2330');
      expect(result.market).toBe('TWSE');
    });

    test('應該能夠獲取還原股價數據', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 100, high: 105, low: 99, close: 102, volume: 1000 }
        ],
        symbol: '2330',
        market: 'TWSE',
        summary: {
          sources: ['TWSE', 'FinMind']
        },
        adjustments: [],
        dividendEvents: []
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getAdjustedPrice({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        split: false
      });

      expect(result.data).toHaveLength(1);
      expect(result.symbol).toBe('2330');
    });
  });

  describe('錯誤處理', () => {
    test('應該處理網路錯誤', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      })).rejects.toThrow('Network error');
    });

    test('應該處理 HTTP 錯誤狀態', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ error: 'Stock not found' })
      });

      await expect(proxyClient.getStockData({
        stockNo: 'INVALID',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      })).rejects.toThrow('Stock not found');
    });

    test('應該處理 API 回傳的錯誤', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ error: 'Invalid date range' })
      });

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-02'
      })).rejects.toThrow('Invalid date range');
    });
  });

  describe('重試機制', () => {
    test('應該在失敗時重試', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ data: [], symbol: '2330' })
        });

      const result = await proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      });

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.symbol).toBe('2330');
    });

    test('應該在達到最大重試次數後拋出錯誤', async () => {
      proxyClient.updateConfig({ retryAttempts: 1 });

      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      })).rejects.toThrow('Network error');

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('工具方法', () => {
    test('應該正確正規化市場值', () => {
      expect(proxyClient.normalizeMarket('nasdaq')).toBe('US');
      expect(proxyClient.normalizeMarket('nyse')).toBe('US');
      expect(proxyClient.normalizeMarket('tpex')).toBe('TPEX');
      expect(proxyClient.normalizeMarket('twse')).toBe('TWSE');
      expect(proxyClient.normalizeMarket()).toBe('TWSE');
    });

    test('應該正確識別指數代碼', () => {
      expect(proxyClient.isIndexSymbol('^TWII')).toBe(true);
      expect(proxyClient.isIndexSymbol('^SPX')).toBe(true);
      expect(proxyClient.isIndexSymbol('2330')).toBe(false);
      expect(proxyClient.isIndexSymbol('AAPL')).toBe(false);
      expect(proxyClient.isIndexSymbol('^')).toBe(false);
      expect(proxyClient.isIndexSymbol('')).toBe(false);
    });
  });
});