/**
 * API 代理客戶端
 * 
 * 統一 API 呼叫邏輯，包含：
 * - 股票數據獲取 (TWSE, TPEX, US, INDEX)
 * - 智慧空缺合併 (Smart Gap Merging) 與客戶端快取
 * - 錯誤處理和重試機制
 * - 請求參數驗證
 */

class ProxyClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: '',
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      cacheName: 'lazybacktest-stock-v1',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      ...config
    };
  }

  /**
   * 獲取當前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates) {
    this.config = {
      ...this.config,
      ...updates,
      headers: {
        ...this.config.headers,
        ...(updates.headers || {})
      }
    };
  }

  /**
   * 驗證請求參數
   */
  validateParams(params) {
    if (!params.stockNo) {
      throw new Error('Missing required parameter: stockNo');
    }

    if (!params.startDate) {
      throw new Error('Missing required parameter: startDate');
    }

    if (!params.endDate) {
      throw new Error('Missing required parameter: endDate');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.startDate)) {
      throw new Error('Invalid date format: startDate must be YYYY-MM-DD');
    }

    if (!dateRegex.test(params.endDate)) {
      throw new Error('Invalid date format: endDate must be YYYY-MM-DD');
    }

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }
  }

  /**
   * 正規化市場值
   */
  normalizeMarket(market) {
    const normalized = (market || 'TWSE').toUpperCase();
    if (normalized === 'NASDAQ' || normalized === 'NYSE') {
      return 'US';
    }
    return normalized;
  }

  /**
   * 檢查是否為指數代碼
   */
  isIndexSymbol(stockNo) {
    if (!stockNo || typeof stockNo !== 'string') {
      return false;
    }
    const trimmed = stockNo.trim();
    return trimmed.startsWith('^') && trimmed.length > 1;
  }

  /**
   * 構建 API URL
   */
  buildApiUrl(params) {
    const market = this.normalizeMarket(params.market);
    const isIndex = this.isIndexSymbol(params.stockNo);

    let endpoint = '/api/twse/';
    if (isIndex || market === 'INDEX') {
      endpoint = '/api/index/';
    } else if (market === 'TPEX') {
      endpoint = '/api/tpex/';
    } else if (market === 'US') {
      endpoint = '/api/us/';
    }

    const queryParams = new URLSearchParams({
      stockNo: params.stockNo,
      start: params.startDate,
      end: params.endDate
    });

    if (params.adjusted) {
      queryParams.set('adjusted', '1');
    }

    if (params.forceSource) {
      queryParams.set('forceSource', params.forceSource);
    }

    return `${endpoint}?${queryParams.toString()}`;
  }

  /**
   * 構建還原股價 API URL
   */
  buildAdjustedPriceUrl(params) {
    const queryParams = new URLSearchParams({
      stockNo: params.stockNo,
      startDate: params.startDate,
      endDate: params.endDate,
      market: this.normalizeMarket(params.market)
    });

    if (params.split) {
      queryParams.set('split', '1');
    }

    return `/api/adjusted-price/?${queryParams.toString()}`;
  }

  /**
   * 構建緩存鍵
   */
  getCacheKey(params, year) {
    const market = this.normalizeMarket(params.market || 'TWSE');
    const stockNo = (params.stockNo || '').toString().toUpperCase();
    const type = params.adjusted ? 'adj' : 'raw';
    // 注意：這裡的 cache key 設計為按年份儲存
    return `v1::${market}::${stockNo}::${year}::${type}`;
  }

  /**
   * 創建帶超時的 AbortController
   */
  createTimeoutController(timeout) {
    if (typeof AbortController === 'undefined') {
      return {
        signal: { aborted: false },
        abort: () => { },
        cleanup: () => { }
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    controller.cleanup = () => clearTimeout(timeoutId);

    return controller;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 執行 HTTP 請求（帶重試）
   */
  async makeRequest(url, options = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      const controller = this.createTimeoutController(this.config.timeout);
      let response;

      try {
        response = await fetch(url, {
          headers: this.config.headers,
          signal: controller.signal,
          ...options
        });

        controller.cleanup();
      } catch (error) {
        controller.cleanup();
        lastError = error;

        if (error.name === 'AbortError') {
          lastError = new Error('Request timeout');
        }

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * (attempt + 1));
          continue;
        }
        break;
      }

      try {
        const text = await response.text();
        let payload = {};

        try {
          payload = text ? JSON.parse(text) : {};
        } catch (parseError) {
          payload = {};
        }

        if (!response.ok || payload?.error) {
          const message = payload?.error || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(message);
        }

        return payload;

      } catch (error) {
        lastError = error;
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * (attempt + 1));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  /**
   * 計算需要的區塊 (Smart Gap Merging 核心)
   */
  calculateChunks(params) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const chunks = [];
    const currentYear = new Date().getFullYear();

    let year = start.getFullYear();
    const endYear = end.getFullYear();

    while (year <= endYear) {
      const isHistorical = year < currentYear;

      // 歷史年份：請求整年 (01-01 ~ 12-31) 以利快取
      // 當前年份：請求整年 (01-01 ~ 12-31)，API 會處理未來日期，確保我們拿到最新資料
      // 注意：當前年份不進行長期快取，但為了合併邏輯一致，我們還是定義為整年區塊

      chunks.push({
        year: year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        isHistorical: isHistorical,
        cached: false,
        data: null
      });
      year++;
    }
    return chunks;
  }

  /**
   * 檢查快取
   */
  async checkCache(chunks, params) {
    if (typeof caches === 'undefined') return chunks;

    try {
      const cache = await caches.open(this.config.cacheName);

      for (const chunk of chunks) {
        // 只檢查歷史年份的快取，當前年份總是重新抓取
        if (!chunk.isHistorical) continue;

        const key = this.getCacheKey(params, chunk.year);
        const response = await cache.match(key);

        if (response) {
          try {
            const json = await response.json();
            if (json && Array.isArray(json.data)) {
              chunk.cached = true;
              chunk.data = json.data;
            }
          } catch (e) {
            console.warn('[ProxyClient] Cache parse error', e);
          }
        }
      }
    } catch (e) {
      console.warn('[ProxyClient] Cache access error', e);
    }
    return chunks;
  }

  /**
   * 合併缺口
   */
  mergeGaps(chunks) {
    const requests = [];
    let currentRange = null;

    for (const chunk of chunks) {
      if (chunk.cached) {
        if (currentRange) {
          requests.push(currentRange);
          currentRange = null;
        }
        continue;
      }

      if (!currentRange) {
        currentRange = {
          startDate: chunk.startDate,
          endDate: chunk.endDate,
          years: [chunk.year]
        };
      } else {
        // 延長當前範圍
        currentRange.endDate = chunk.endDate;
        currentRange.years.push(chunk.year);
      }
    }

    if (currentRange) {
      requests.push(currentRange);
    }

    return requests;
  }

  /**
   * 執行請求並處理快取
   */
  async fetchAndProcess(requests, chunks, params) {
    const allData = [];

    // 1. 加入快取資料
    for (const chunk of chunks) {
      if (chunk.cached && chunk.data) {
        allData.push(...chunk.data);
      }
    }

    // 2. 抓取缺失範圍
    if (requests.length > 0) {
      const cache = typeof caches !== 'undefined' ? await caches.open(this.config.cacheName) : null;

      for (const req of requests) {
        const fetchParams = {
          ...params,
          startDate: req.startDate,
          endDate: req.endDate
        };

        // 使用內部方法抓取，避免遞迴
        const result = await this.getStockDataInternal(fetchParams);

        if (result && Array.isArray(result.data)) {
          allData.push(...result.data);

          // 切分並寫入快取
          if (cache) {
            for (const year of req.years) {
              const chunk = chunks.find(c => c.year === year);
              // 只快取歷史年份
              if (chunk && chunk.isHistorical) {
                const yearData = result.data.filter(d => {
                  // 假設 d.date 格式為 YYYY-MM-DD
                  return d.date && d.date.startsWith(year.toString());
                });

                if (yearData.length > 0) {
                  const key = this.getCacheKey(params, year);
                  const responseToCache = new Response(JSON.stringify({ data: yearData }), {
                    headers: { 'Content-Type': 'application/json' }
                  });
                  cache.put(key, responseToCache).catch(e => console.warn('Cache put failed', e));
                }
              }
            }
          }
        }
      }
    }

    // 3. 過濾與排序
    // 過濾出使用者請求的精確範圍
    const finalData = allData.filter(item => {
      return item.date >= params.startDate && item.date <= params.endDate;
    });

    // 排序
    finalData.sort((a, b) => a.date.localeCompare(b.date));

    // 去重 (以防萬一)
    const uniqueData = [];
    const seenDates = new Set();
    for (const item of finalData) {
      if (!seenDates.has(item.date)) {
        seenDates.add(item.date);
        uniqueData.push(item);
      }
    }

    return uniqueData;
  }

  /**
   * 內部使用的基礎抓取方法
   */
  async getStockDataInternal(params) {
    this.validateParams(params);
    const url = this.buildApiUrl(params);
    return await this.makeRequest(url);
  }

  /**
   * 獲取股票數據 (整合 Smart Gap Merging)
   */
  async getStockData(params) {
    // 如果強制指定來源或不使用快取，則直接抓取
    if (params.forceSource) {
      return this.getStockDataInternal(params);
    }

    try {
      // 1. 計算區塊
      const chunks = this.calculateChunks(params);

      // 2. 檢查快取
      const checkedChunks = await this.checkCache(chunks, params);

      // 3. 合併缺口
      const fetchRequests = this.mergeGaps(checkedChunks);

      // 4. 抓取與處理
      const data = await this.fetchAndProcess(fetchRequests, checkedChunks, params);

      return {
        stockNo: params.stockNo,
        data: data
      };
    } catch (error) {
      console.warn('[ProxyClient] Smart caching failed, falling back to direct fetch', error);
      return this.getStockDataInternal(params);
    }
  }

  /**
   * 獲取還原股價數據 (維持原樣)
   */
  async getAdjustedPrice(params) {
    this.validateParams(params);
    const url = this.buildAdjustedPriceUrl(params);
    return await this.makeRequest(url);
  }

  /**
   * 批次獲取多支股票數據
   */
  async getBatchStockData(stockList, commonParams = {}) {
    const promises = stockList.map(stockParams => {
      const fullParams = { ...commonParams, ...stockParams };
      return this.getStockData(fullParams).catch(error => ({
        error: error.message,
        stockNo: stockParams.stockNo,
        market: stockParams.market
      }));
    });

    return Promise.all(promises);
  }

  /**
   * 測試數據源可用性
   */
  async testDataSource(params) {
    const startTime = Date.now();

    try {
      const result = await this.getStockData(params);
      const endTime = Date.now();

      return {
        success: true,
        responseTime: endTime - startTime,
        dataPoints: Array.isArray(result.data) ? result.data.length : 0,
        result
      };
    } catch (error) {
      const endTime = Date.now();

      return {
        success: false,
        responseTime: endTime - startTime,
        error: error.message,
        dataPoints: 0
      };
    }
  }
}

module.exports = { ProxyClient };