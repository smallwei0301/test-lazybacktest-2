/**
 * 測試 API 客戶端層
 * 任務：建立統一的 API 呼叫邏輯，從 main.js 提取資料獲取相關代碼
 */

const { ProxyClient } = require('../../../js/layers/api/proxy-client.js');

// Mock fetch and AbortController for testing
global.fetch = jest.fn();
global.AbortController = jest.fn(() => ({
  signal: { aborted: false },
  abort: jest.fn(),
  cleanup: jest.fn()
}));

describe('ProxyClient API 客戶端層', () => {
  let proxyClient;

  beforeEach(() => {
    proxyClient = new ProxyClient();
    fetch.mockClear();
    
    // 預設成功回應
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [], symbol: 'TEST' })
    });
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

  describe('股票數據獲取', () => {
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
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-02'
      });

      expect(fetch).toHaveBeenCalledWith('/api/twse/?stockNo=2330&start=2023-01-01&end=2023-01-02', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.anything()
      });

      expect(result.data).toHaveLength(2);
      expect(result.symbol).toBe('2330');
      expect(result.market).toBe('TWSE');
    });

    test('應該能夠獲取 TPEX 股票數據', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 50, high: 52, low: 49, close: 51, volume: 500 }
        ],
        symbol: '6488',
        market: 'TPEX'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getStockData({
        stockNo: '6488',
        market: 'TPEX',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      });

      expect(fetch).toHaveBeenCalledWith('/api/tpex/?stockNo=6488&start=2023-01-01&end=2023-01-01', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.anything()
      });

      expect(result.symbol).toBe('6488');
      expect(result.market).toBe('TPEX');
    });

    test('應該能夠獲取美股數據', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 150, high: 155, low: 148, close: 152, volume: 2000 }
        ],
        symbol: 'AAPL',
        market: 'US'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getStockData({
        stockNo: 'AAPL',
        market: 'US',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      });

      expect(fetch).toHaveBeenCalledWith('/api/us/?stockNo=AAPL&start=2023-01-01&end=2023-01-01', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      });

      expect(result.symbol).toBe('AAPL');
      expect(result.market).toBe('US');
    });

    test('應該能夠處理指數數據', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 15000, high: 15100, low: 14950, close: 15050, volume: 0 }
        ],
        symbol: '^TWII',
        market: 'INDEX'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getStockData({
        stockNo: '^TWII',
        market: 'INDEX',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      });

      expect(fetch).toHaveBeenCalledWith('/api/index/?stockNo=%5ETWII&start=2023-01-01&end=2023-01-01', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      });

      expect(result.symbol).toBe('^TWII');
      expect(result.market).toBe('INDEX');
    });
  });

  describe('還原股價數據', () => {
    test('應該能夠獲取還原股價（Yahoo 來源）', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 100, high: 105, low: 99, close: 102, volume: 1000, adjusted: true }
        ],
        symbol: '2330',
        market: 'TWSE',
        adjusted: true
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        adjusted: true,
        forceSource: 'yahoo'
      });

      expect(fetch).toHaveBeenCalledWith('/api/twse/?stockNo=2330&start=2023-01-01&end=2023-01-01&adjusted=1&forceSource=yahoo', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      });

      expect(result.adjusted).toBe(true);
    });

    test('應該能夠獲取 Netlify 還原股價', async () => {
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
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getAdjustedPrice({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        split: false
      });

      expect(fetch).toHaveBeenCalledWith('/api/adjusted-price/?stockNo=2330&startDate=2023-01-01&endDate=2023-01-01&market=TWSE', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      });

      expect(result.data).toHaveLength(1);
      expect(result.symbol).toBe('2330');
    });

    test('應該支援股票拆分調整', async () => {
      const mockResponse = {
        data: [
          { date: '2023-01-01', open: 50, high: 52.5, low: 49.5, close: 51, volume: 2000 }
        ],
        symbol: '2330',
        adjustments: [
          { date: '2023-01-01', type: 'split', ratio: 2, applied: true }
        ]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await proxyClient.getAdjustedPrice({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        split: true
      });

      expect(fetch).toHaveBeenCalledWith('/api/adjusted-price/?stockNo=2330&startDate=2023-01-01&endDate=2023-01-01&market=TWSE&split=1', {
        headers: expect.objectContaining({
          'Accept': 'application/json'
        }),
        signal: expect.any(AbortSignal)
      });

      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].type).toBe('split');
    });
  });

  describe('錯誤處理', () => {
    test('應該處理網路錯誤', async () => {
      fetch.mockReset();
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      })).rejects.toThrow('Network error');
    });

    test('應該處理 HTTP 錯誤狀態', async () => {
      fetch.mockReset();
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
      fetch.mockReset();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'Invalid date range' }),
        text: async () => JSON.stringify({ error: 'Invalid date range' })
      });

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-02'
      })).rejects.toThrow('Invalid date range');
    });

    test('應該處理超時', async () => {
      proxyClient.updateConfig({ timeout: 100 });

      fetch.mockReset();
      fetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(proxyClient.getStockData({
        stockNo: '2330',
        market: 'TWSE',
        startDate: '2023-01-01',
        endDate: '2023-01-01'
      })).rejects.toThrow('Request timeout');
    });
  });

  describe('重試機制', () => {
    test('應該在失敗時重試', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [], symbol: '2330' }),
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

    test('應該正確處理特殊字符', () => {
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
  });
});