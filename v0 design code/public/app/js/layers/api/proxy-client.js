/**
 * API 代理客戶端
 * 
 * 統一 API 呼叫邏輯，從 main.js 提取資料獲取相關代碼：
 * - 股票數據獲取 (TWSE, TPEX, US, INDEX)
 * - 還原股價數據處理
 * - 錯誤處理和重試機制
 * - 請求參數驗證
 * - 緩存鍵生成
 */

class ProxyClient {
  constructor(config = {}) {
    this.config = {
      baseUrl: '',
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      ...config
    };
  }

  /**
   * 獲取當前配置
   * @returns {Object} 配置對象
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 更新配置
   * @param {Object} updates 要更新的配置
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
   * @param {Object} params 請求參數
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

    // 驗證日期格式 (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(params.startDate)) {
      throw new Error('Invalid date format: startDate must be YYYY-MM-DD');
    }

    if (!dateRegex.test(params.endDate)) {
      throw new Error('Invalid date format: endDate must be YYYY-MM-DD');
    }

    // 驗證日期範圍
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }
  }

  /**
   * 正規化市場值
   * @param {string} market 市場代碼
   * @returns {string} 正規化的市場代碼
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
   * @param {string} stockNo 股票代碼
   * @returns {boolean} 是否為指數
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
   * @param {Object} params 請求參數
   * @returns {string} API URL
   */
  buildApiUrl(params) {
    const market = this.normalizeMarket(params.market);
    const isIndex = this.isIndexSymbol(params.stockNo);

    // 決定端點
    let endpoint = '/api/twse/';
    if (isIndex || market === 'INDEX') {
      endpoint = '/api/index/';
    } else if (market === 'TPEX') {
      endpoint = '/api/tpex/';
    } else if (market === 'US') {
      endpoint = '/api/us/';
    }

    // 構建查詢參數
    const queryParams = new URLSearchParams({
      stockNo: params.stockNo,
      start: params.startDate,
      end: params.endDate
    });

    // 添加可選參數
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
   * @param {Object} params 請求參數
   * @returns {string} API URL
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
   * @param {Object} params 請求參數
   * @returns {string} 緩存鍵
   */
  buildCacheKey(params) {
    const market = this.normalizeMarket(params.market || 'TWSE');
    const stockNo = (params.stockNo || '').toString().toUpperCase();
    const priceModeKey = params.adjusted ? 'ADJ' : 'RAW';
    const splitFlag = params.split ? 'SPLIT' : 'NOSPLIT';
    const dataStart = params.dataStartDate || params.startDate || 'NA';
    const effectiveStart = params.effectiveStartDate || params.startDate || 'NA';
    const lookbackKey = Number.isFinite(params.lookbackDays)
      ? `LB${Math.round(params.lookbackDays)}`
      : 'LB-';

    return `${market}|${stockNo}|${priceModeKey}|${splitFlag}|${dataStart}|${effectiveStart}|${lookbackKey}`;
  }

  /**
   * 創建帶超時的 AbortController
   * @param {number} timeout 超時時間（毫秒）
   * @returns {AbortController} AbortController 實例
   */
  createTimeoutController(timeout) {
    // 檢查 AbortController 是否可用（Node.js 環境處理）
    if (typeof AbortController === 'undefined') {
      // 簡單的 polyfill
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

    // 清理函數
    controller.cleanup = () => clearTimeout(timeoutId);

    return controller;
  }

  /**
   * 延遲函數
   * @param {number} ms 延遲毫秒數
   * @returns {Promise} Promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 執行 HTTP 請求（帶重試）
   * @param {string} url 請求 URL
   * @param {Object} options 請求選項
   * @returns {Promise} 回應 Promise
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

        // 如果是 AbortError，轉換為超時錯誤
        if (error.name === 'AbortError') {
          lastError = new Error('Request timeout');
        }

        // 如果不是最後一次嘗試，等待後重試
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * (attempt + 1));
          continue;
        }

        break;
      }

      // 如果到這裡，說明 fetch 成功了，處理回應
      try {
        // 讀取回應內容
        const text = await response.text();
        let payload = {};

        try {
          payload = text ? JSON.parse(text) : {};
        } catch (parseError) {
          payload = {};
        }

        // 檢查 HTTP 狀態和 API 錯誤
        if (!response.ok || payload?.error) {
          const message = payload?.error || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(message);
        }

        return payload;

      } catch (error) {
        lastError = error;

        // 如果不是最後一次嘗試，等待後重試
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
   * 獲取緩存名稱
   */
  get CACHE_NAME() {
    return 'lazybacktest-data-v1';
  }

  /**
   * 獲取股票數據 (智能緩存版)
   * @param {Object} params 請求參數
   * @returns {Promise<Object>} 股票數據
   */
  async getStockData(params) {
    // 1. 嘗試使用智能緩存
    try {
      if (this.isCacheSupported() && !params.forceSource) {
        return await this.fetchStockDataWithSmartCaching(params);
      }
    } catch (error) {
      console.warn('Smart caching failed, falling back to direct fetch:', error);
    }

    // 2. 降級為直接請求
    return this.fetchStockDataDirect(params);
  }

  /**
   * 直接獲取股票數據 (無緩存邏輯)
   * @param {Object} params 請求參數
   * @returns {Promise<Object>} 股票數據
   */
  async fetchStockDataDirect(params) {
    // 驗證參數
    this.validateParams(params);

    // 構建 URL
    const { hits, misses } = await this.checkCache(params, chunks);

    // 如果全部命中，直接合併返回
    if (misses.length === 0) {
      return this.combineAllData(hits, [], params);
    }

    // 3. 合併缺口 (Smart Gap Merging)
    const fetchRanges = this.mergeGaps(misses);

    // 4. 獲取並緩存缺口數據
    const fetchedDataList = [];
    for (const range of fetchRanges) {
      const data = await this.fetchAndCache(params, range);
      fetchedDataList.push(data);
    }

    // 5. 合併所有數據 (緩存 + 新獲取) 並返回
    return this.combineAllData(hits, fetchedDataList, params);
  }

  /**
   * 計算需要的年份區塊
   */
  calculateChunks(startDate, endDate) {
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    const chunks = [];
    for (let year = startYear; year <= endYear; year++) {
      chunks.push(year);
    }
    return chunks;
  }

  /**
   * 檢查緩存狀態
   */
  async checkCache(params, chunks) {
    const hits = [];
    const misses = [];
    const cache = await caches.open(this.CACHE_NAME);
    const currentYear = new Date().getFullYear();

    for (const year of chunks) {
      // 當前年份不讀取緩存 (確保數據新鮮度)
      if (year === currentYear) {
        misses.push(year);
        continue;
      }

      const key = this.buildYearCacheKey(params, year);
      const response = await cache.match(key);
      if (response) {
        try {
          const data = await response.json();
          hits.push({ year, data });
        } catch (e) {
          misses.push(year);
        }
      } else {
        misses.push(year);
      }
    }
    return { hits, misses };
  }

  /**
   * 合併連續的缺失年份
   */
  mergeGaps(missingChunks) {
    if (missingChunks.length === 0) return [];

    // 排序
    missingChunks.sort((a, b) => a - b);

    const ranges = [];
    let startYear = missingChunks[0];
    let prevYear = missingChunks[0];

    for (let i = 1; i < missingChunks.length; i++) {
      const year = missingChunks[i];
      if (year !== prevYear + 1) {
        // 發現斷點，推入前一段
        ranges.push({ startYear, endYear: prevYear });
        startYear = year;
      }
      prevYear = year;
    }
    // 推入最後一段
    ranges.push({ startYear, endYear: prevYear });

    // 轉換為日期範圍
    return ranges.map(range => ({
      startDate: `${range.startYear}-01-01`,
      endDate: `${range.endYear}-12-31`
    }));
  }

  /**
   * 獲取數據並切分緩存
   */
  async fetchAndCache(params, range) {
    // 構建請求參數
    const fetchParams = {
      ...params,
      startDate: range.startDate,
      endDate: range.endDate
    };

    // 強制直接獲取，避免遞歸
    const result = await this.fetchStockDataDirect(fetchParams);

    if (!result || !result.data || !Array.isArray(result.data)) {
      return result || { data: [] };
    }

    // 嚴格數據切分 (Strict Data Slicing)
    const dataByYear = {};
    const currentYear = new Date().getFullYear();

    result.data.forEach(row => {
      const dateStr = row[0]; // 假設格式為 "YYYYMMDD" 或 "YYYY-MM-DD"
      let year;

      // 簡單的日期解析
      if (dateStr.includes('-')) {
        year = parseInt(dateStr.split('-')[0]);
      } else if (dateStr.includes('/')) {
        year = parseInt(dateStr.split('/')[0]);
        // 處理民國年 (假設 3 位數是民國年)
        if (year < 1911) year += 1911;
      } else if (dateStr.length === 8) {
        year = parseInt(dateStr.substring(0, 4));
      } else {
        year = new Date(dateStr).getFullYear();
      }

      if (!isNaN(year)) {
        if (!dataByYear[year]) dataByYear[year] = [];
        dataByYear[year].push(row);
      }
    });

    // 寫入緩存
    const cache = await caches.open(this.CACHE_NAME);

    for (const yearStr in dataByYear) {
      const year = parseInt(yearStr);
      const yearData = dataByYear[year];

      // 只緩存歷史年份
      if (year < currentYear) {
        const key = this.buildYearCacheKey(params, year);
        // 保持原始結構，但替換 data
        const yearResult = { ...result, data: yearData };
        await cache.put(key, new Response(JSON.stringify(yearResult)));
      }
    }

    return result;
  }

  /**
   * 合併所有數據並過濾
   */
  combineAllData(hits, fetchedDataList, params) {
    let allRows = [];

    // 加入緩存數據
    hits.forEach(hit => {
      if (hit.data && hit.data.data) {
        allRows = allRows.concat(hit.data.data);
      }
    });

    // 加入新獲取數據
    fetchedDataList.forEach(fetched => {
      if (fetched && fetched.data) {
        allRows = allRows.concat(fetched.data);
      }
    });

    // 排序
    allRows.sort((a, b) => {
      const da = a[0].replace(/[-\/]/g, '');
      const db = b[0].replace(/[-\/]/g, '');
      return da.localeCompare(db);
    });

    // 去重
    const uniqueRows = [];
    const seenDates = new Set();
    for (const row of allRows) {
      const date = row[0];
      if (!seenDates.has(date)) {
        seenDates.add(date);
        uniqueRows.push(row);
      }
    }

    // 過濾請求範圍
    const start = params.startDate.replace(/[-\/]/g, '');
    const end = params.endDate.replace(/[-\/]/g, '');

    const filteredRows = uniqueRows.filter(row => {
      const d = row[0].replace(/[-\/]/g, '');
      return d >= start && d <= end;
    });

    // 使用第一個有效結果作為模板
    const template = (hits[0] && hits[0].data) || (fetchedDataList[0]) || {};

    return {
      ...template,
      data: filteredRows,
      count: filteredRows.length
    };
  }

  /**
   * 構建年度緩存鍵
   */
  buildYearCacheKey(params, year) {
    const market = this.normalizeMarket(params.market || 'TWSE');
    const stockNo = (params.stockNo || '').toString().toUpperCase();
    const priceModeKey = params.adjusted ? 'ADJ' : 'RAW';
    const splitFlag = params.split ? 'SPLIT' : 'NOSPLIT';
    // 緩存鍵不包含 startDate/endDate，只包含年份
    return `https://lazybacktest.local/data/${market}/${stockNo}/${year}/${priceModeKey}/${splitFlag}`;
  }

  /**
   * 獲取還原股價數據
   * @param {Object} params 請求參數
   * @param {string} params.stockNo 股票代碼
   * @param {string} params.market 市場代碼
   * @param {string} params.startDate 開始日期 (YYYY-MM-DD)
   * @param {string} params.endDate 結束日期 (YYYY-MM-DD)
   * @param {boolean} [params.split] 是否包含股票拆分調整
   * @returns {Promise<Object>} 還原股價數據
   */
  async getAdjustedPrice(params) {
    // 驗證參數
    this.validateParams(params);

    // 構建 URL
    const url = this.buildAdjustedPriceUrl(params);

    // 執行請求
    const response = await this.makeRequest(url);

    return response;
  }

  /**
   * 批次獲取多支股票數據
   * @param {Array<Object>} stockList 股票列表
   * @param {Object} commonParams 共同參數
   * @returns {Promise<Array<Object>>} 批次結果
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
   * @param {Object} params 測試參數
   * @returns {Promise<Object>} 測試結果
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

// Export logic for both CommonJS and Browser/Worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProxyClient };
} else if (typeof self !== 'undefined') {
  self.ProxyClient = ProxyClient;
} else if (typeof window !== 'undefined') {
  window.ProxyClient = ProxyClient;
}