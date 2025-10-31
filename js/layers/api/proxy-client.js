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
        abort: () => {},
        cleanup: () => {}
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
   * 獲取股票數據
   * @param {Object} params 請求參數
   * @param {string} params.stockNo 股票代碼
   * @param {string} params.market 市場代碼 (TWSE, TPEX, US, INDEX)
   * @param {string} params.startDate 開始日期 (YYYY-MM-DD)
   * @param {string} params.endDate 結束日期 (YYYY-MM-DD)
   * @param {boolean} [params.adjusted] 是否為還原股價
   * @param {string} [params.forceSource] 強制使用的數據源
   * @returns {Promise<Object>} 股票數據
   */
  async getStockData(params) {
    // 驗證參數
    this.validateParams(params);

    // 構建 URL
    const url = this.buildApiUrl(params);

    // 執行請求
    const response = await this.makeRequest(url);

    return response;
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

module.exports = { ProxyClient };