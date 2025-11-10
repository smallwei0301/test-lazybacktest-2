/**
 * 測試 GET 端點模塊
 * 
 * 提供一個簡單的 GET 端點，返回健康檢查狀態
 * 遵循 API 層架構規則：
 * - 只負責 HTTP 端點邏輯
 * - 返回 JSON 格式的響應
 * - 包含錯誤處理和參數驗證
 * 
 * 用途：作為健康檢查端點，驗證 API 服務的可用性
 */

/**
 * TestEndpoint 類
 * 提供健康檢查和簡單狀態查詢端點
 */
class TestEndpoint {
  /**
   * 構造函數
   * @param {Object} config - 配置對象
   * @param {string} config.version - API 版本 (默認: '1.0')
   * @param {string} config.serviceName - 服務名稱 (默認: 'LazyBacktest')
   */
  constructor(config = {}) {
    this.config = {
      version: '1.0',
      serviceName: 'LazyBacktest',
      ...config
    };
  }

  /**
   * GET 健康檢查端點
   * 
   * @returns {Object} 健康檢查響應
   * @returns {string} returns.status - 狀態 ('ok' 表示服務正常)
   * @returns {string} returns.version - API 版本
   * @returns {string} returns.serviceName - 服務名稱
   * @returns {string} returns.timestamp - ISO 8601 格式的時間戳
   * 
   * @example
   * const endpoint = new TestEndpoint();
   * const response = endpoint.getHealthStatus();
   * console.log(response);
   * // { status: 'ok', version: '1.0', serviceName: 'LazyBacktest', timestamp: '2025-10-31T...' }
   */
  getHealthStatus() {
    return {
      status: 'ok',
      version: this.config.version,
      serviceName: this.config.serviceName,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * GET 簡化版狀態端點
   * 返回最基本的狀態信息
   * 
   * @returns {Object} 簡化狀態響應
   * @returns {string} returns.status - 狀態 ('ok' 表示服務正常)
   * 
   * @example
   * const endpoint = new TestEndpoint();
   * const response = endpoint.getStatus();
   * console.log(response); // { status: 'ok' }
   */
  getStatus() {
    return {
      status: 'ok'
    };
  }

  /**
   * 驗證請求參數（如果有的話）
   * 
   * @param {Object} params - 查詢參數
   * @throws {Error} 如果參數無效，拋出錯誤
   * 
   * @example
   * endpoint.validateParams({ foo: 'bar' }); // OK
   * endpoint.validateParams(null); // 拋出錯誤
   */
  validateParams(params) {
    // 如果沒有參數，認為有效（GET 請求可以沒有參數）
    if (params === null || params === undefined) {
      return true;
    }

    // 參數必須是對象
    if (typeof params !== 'object') {
      throw new Error('Parameters must be an object or null');
    }

    return true;
  }

  /**
   * 根據查詢參數返回對應的響應
   * 
   * @param {Object} query - 查詢參數對象
   * @returns {Object} 根據參數的不同響應
   * 
   * @example
   * endpoint.handleQuery({ mode: 'simple' }); // { status: 'ok' }
   * endpoint.handleQuery({ mode: 'detailed' }); // { status: 'ok', version: '1.0', ... }
   * endpoint.handleQuery({}); // { status: 'ok' }
   */
  handleQuery(query = {}) {
    this.validateParams(query);

    // 根據 mode 參數返回不同級別的信息
    if (query.mode === 'detailed') {
      return this.getHealthStatus();
    }

    // 默認返回簡化版
    return this.getStatus();
  }

  /**
   * 模擬 HTTP GET 請求
   * 
   * @param {string} path - 請求路徑 (默認: '/health')
   * @param {Object} query - 查詢參數
   * @returns {Object} 響應對象 { status: 200, body: {...} }
   * 
   * @throws {Error} 如果路徑不支持或參數無效
   * 
   * @example
   * const response = endpoint.handleGet('/health', {});
   * // { status: 200, body: { status: 'ok' } }
   */
  handleGet(path = '/health', query = {}) {
    // 驗證路徑
    if (typeof path !== 'string' || path.trim() === '') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    // 支持的路徑
    const supportedPaths = ['/health', '/status', '/'];
    const normalizedPath = path.toLowerCase();

    if (!supportedPaths.includes(normalizedPath)) {
      return {
        status: 404,
        body: { error: 'Not Found', path: path }
      };
    }

    // 處理查詢參數
    const response = this.handleQuery(query);

    return {
      status: 200,
      body: response
    };
  }
}

// 導出模塊
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestEndpoint;
}
