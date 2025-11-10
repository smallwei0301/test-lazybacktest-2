/**
 * 測試 API 客戶端層（核心功能）
 * 任務：建立統一的 API 呼叫邏輯，從 main.js 提取資料獲取相關代碼
 */

const { ProxyClient } = require('../../../js/layers/api/proxy-client.js');

describe('ProxyClient API 客戶端層', () => {
  let proxyClient;

  beforeEach(() => {
    proxyClient = new ProxyClient();
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

    test('應該正確創建超時控制器', () => {
      const controller = proxyClient.createTimeoutController(1000);
      expect(controller).toBeDefined();
      expect(typeof controller.signal).toBe('object');
      expect(typeof controller.abort).toBe('function');
      expect(typeof controller.cleanup).toBe('function');
    });

    test('應該正確處理延遲', async () => {
      const startTime = Date.now();
      await proxyClient.delay(100);
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // 允許一些誤差
    });
  });
});