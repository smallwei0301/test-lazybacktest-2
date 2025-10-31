/**
 * 應用程式狀態管理器
 * 
 * 統一管理應用中的所有狀態，替換分散的全域變數：
 * - cachedStockData, cachedDataStore 
 * - stockChart, backtestWorker, optimizationWorker
 * - lastFetchSettings, currentOptimizationResults, lastOverallResult
 * - sortState, loadingMascotState
 */

class AppState {
  constructor() {
    this.state = this.getInitialState();
    this.listeners = new Set();
  }

  /**
   * 獲取初始狀態結構
   * @returns {Object} 初始狀態對象
   */
  getInitialState() {
    return {
      cache: {
        stockData: null,
        dataStore: new Map() // Map<market|stockNo|priceMode, CacheEntry>
      },
      ui: {
        chart: null,
        workers: {
          backtest: null,
          optimization: null,
          workerUrl: null
        },
        loadingMascot: {
          visibility: { hidden: false },
          rotation: null,
          lastSource: null
        },
        sorting: {
          key: 'annualizedReturn',
          direction: 'desc'
        }
      },
      data: {
        lastFetchSettings: null,
        currentOptimizationResults: [],
        lastOverallResult: null
      }
    };
  }

  /**
   * 獲取當前狀態（深度複製）
   * @returns {Object} 狀態的深度複製
   */
  getState() {
    return this.deepClone(this.state);
  }

  /**
   * 深度複製對象（處理 Map 類型）
   * @param {any} obj 要複製的對象
   * @returns {any} 深度複製的結果
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Map) {
      const cloned = new Map();
      for (const [key, value] of obj) {
        cloned.set(key, this.deepClone(value));
      }
      return cloned;
    }
    
    if (obj instanceof Date) {
      return new Date(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * 觸發狀態變化監聽器
   * @param {string} path 變化的狀態路徑
   */
  notifyListeners(path) {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState, path);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }

  /**
   * 訂閱狀態變化
   * @param {Function} listener 監聽器函數 (state, path) => void
   * @returns {Function} 取消訂閱函數
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // === 緩存數據管理 ===

  /**
   * 設置緩存的股票數據
   * @param {Object|null} data 股票數據
   */
  setCachedStockData(data) {
    this.state.cache.stockData = data;
    this.notifyListeners('cache.stockData');
  }

  /**
   * 獲取緩存的股票數據
   * @returns {Object|null} 股票數據
   */
  getCachedStockData() {
    return this.state.cache.stockData;
  }

  /**
   * 清除緩存的股票數據
   */
  clearCachedStockData() {
    this.setCachedStockData(null);
  }

  /**
   * 設置數據存儲條目
   * @param {string} key 存儲鍵
   * @param {any} value 存儲值
   */
  setDataStoreEntry(key, value) {
    this.state.cache.dataStore.set(key, value);
    this.notifyListeners('cache.dataStore');
  }

  /**
   * 獲取數據存儲條目
   * @param {string} key 存儲鍵
   * @returns {any} 存儲值
   */
  getDataStoreEntry(key) {
    return this.state.cache.dataStore.get(key);
  }

  /**
   * 獲取整個數據存儲
   * @returns {Map} 數據存儲 Map
   */
  getDataStore() {
    return this.state.cache.dataStore;
  }

  /**
   * 清除數據存儲
   */
  clearDataStore() {
    this.state.cache.dataStore.clear();
    this.notifyListeners('cache.dataStore');
  }

  // === UI 狀態管理 ===

  /**
   * 設置圖表實例
   * @param {Object|null} chart 圖表實例
   */
  setChart(chart) {
    this.state.ui.chart = chart;
    this.notifyListeners('ui.chart');
  }

  /**
   * 獲取圖表實例
   * @returns {Object|null} 圖表實例
   */
  getChart() {
    return this.state.ui.chart;
  }

  /**
   * 設置回測 Worker
   * @param {Worker|null} worker Worker 實例
   */
  setBacktestWorker(worker) {
    this.state.ui.workers.backtest = worker;
    this.notifyListeners('ui.workers.backtest');
  }

  /**
   * 獲取回測 Worker
   * @returns {Worker|null} Worker 實例
   */
  getBacktestWorker() {
    return this.state.ui.workers.backtest;
  }

  /**
   * 設置優化 Worker
   * @param {Worker|null} worker Worker 實例
   */
  setOptimizationWorker(worker) {
    this.state.ui.workers.optimization = worker;
    this.notifyListeners('ui.workers.optimization');
  }

  /**
   * 獲取優化 Worker
   * @returns {Worker|null} Worker 實例
   */
  getOptimizationWorker() {
    return this.state.ui.workers.optimization;
  }

  /**
   * 設置 Worker URL
   * @param {string|null} url Worker URL
   */
  setWorkerUrl(url) {
    this.state.ui.workers.workerUrl = url;
    this.notifyListeners('ui.workers.workerUrl');
  }

  /**
   * 獲取 Worker URL
   * @returns {string|null} Worker URL
   */
  getWorkerUrl() {
    return this.state.ui.workers.workerUrl;
  }

  /**
   * 設置載入動畫可見性
   * @param {Object} visibility 可見性狀態
   */
  setLoadingMascotVisibility(visibility) {
    this.state.ui.loadingMascot.visibility = visibility;
    this.notifyListeners('ui.loadingMascot.visibility');
  }

  /**
   * 獲取載入動畫可見性
   * @returns {Object} 可見性狀態
   */
  getLoadingMascotVisibility() {
    return this.state.ui.loadingMascot.visibility;
  }

  /**
   * 設置載入動畫旋轉狀態
   * @param {Object|null} rotation 旋轉狀態
   */
  setLoadingMascotRotation(rotation) {
    this.state.ui.loadingMascot.rotation = rotation;
    this.notifyListeners('ui.loadingMascot.rotation');
  }

  /**
   * 獲取載入動畫旋轉狀態
   * @returns {Object|null} 旋轉狀態
   */
  getLoadingMascotRotation() {
    return this.state.ui.loadingMascot.rotation;
  }

  /**
   * 設置載入動畫最後來源
   * @param {string|null} source 動畫來源
   */
  setLoadingMascotLastSource(source) {
    this.state.ui.loadingMascot.lastSource = source;
    this.notifyListeners('ui.loadingMascot.lastSource');
  }

  /**
   * 獲取載入動畫最後來源
   * @returns {string|null} 動畫來源
   */
  getLoadingMascotLastSource() {
    return this.state.ui.loadingMascot.lastSource;
  }

  /**
   * 設置排序狀態
   * @param {Object} sortState 排序狀態 { key, direction }
   */
  setSortState(sortState) {
    this.state.ui.sorting = sortState;
    this.notifyListeners('ui.sorting');
  }

  /**
   * 獲取排序狀態
   * @returns {Object} 排序狀態
   */
  getSortState() {
    return this.state.ui.sorting;
  }

  // === 業務數據管理 ===

  /**
   * 設置上次抓取設定
   * @param {Object|null} settings 抓取設定
   */
  setLastFetchSettings(settings) {
    this.state.data.lastFetchSettings = settings;
    this.notifyListeners('data.lastFetchSettings');
  }

  /**
   * 獲取上次抓取設定
   * @returns {Object|null} 抓取設定
   */
  getLastFetchSettings() {
    return this.state.data.lastFetchSettings;
  }

  /**
   * 設置當前優化結果
   * @param {Array} results 優化結果陣列
   */
  setCurrentOptimizationResults(results) {
    this.state.data.currentOptimizationResults = results || [];
    this.notifyListeners('data.currentOptimizationResults');
  }

  /**
   * 獲取當前優化結果
   * @returns {Array} 優化結果陣列
   */
  getCurrentOptimizationResults() {
    return this.state.data.currentOptimizationResults;
  }

  /**
   * 添加優化結果
   * @param {Object} result 單個優化結果
   */
  addOptimizationResult(result) {
    this.state.data.currentOptimizationResults.push(result);
    this.notifyListeners('data.currentOptimizationResults');
  }

  /**
   * 清除優化結果
   */
  clearOptimizationResults() {
    this.setCurrentOptimizationResults([]);
  }

  /**
   * 設置最後整體回測結果
   * @param {Object|null} result 回測結果
   */
  setLastOverallResult(result) {
    this.state.data.lastOverallResult = result;
    this.notifyListeners('data.lastOverallResult');
  }

  /**
   * 獲取最後整體回測結果
   * @returns {Object|null} 回測結果
   */
  getLastOverallResult() {
    return this.state.data.lastOverallResult;
  }

  // === 狀態管理操作 ===

  /**
   * 重置到初始狀態
   */
  reset() {
    this.state = this.getInitialState();
    this.notifyListeners('reset');
  }

  /**
   * 序列化狀態為 JSON 字符串
   * @returns {string} JSON 字符串
   */
  serialize() {
    // 創建可序列化的狀態副本（排除 Map）
    const serializableState = this.deepClone(this.state);
    
    // 將 Map 轉換為 Object
    if (serializableState.cache.dataStore instanceof Map) {
      serializableState.cache.dataStore = Object.fromEntries(serializableState.cache.dataStore);
    }
    
    return JSON.stringify(serializableState);
  }

  /**
   * 從 JSON 字符串反序列化狀態
   * @param {string} jsonString JSON 字符串
   */
  deserialize(jsonString) {
    try {
      const parsedState = JSON.parse(jsonString);
      
      // 將 Object 轉回 Map
      if (parsedState.cache && parsedState.cache.dataStore && 
          typeof parsedState.cache.dataStore === 'object' && 
          !Array.isArray(parsedState.cache.dataStore)) {
        parsedState.cache.dataStore = new Map(Object.entries(parsedState.cache.dataStore));
      }
      
      this.state = parsedState;
      this.notifyListeners('deserialize');
    } catch (error) {
      console.error('Failed to deserialize state:', error);
      throw new Error('Invalid state JSON');
    }
  }
}

module.exports = { AppState };