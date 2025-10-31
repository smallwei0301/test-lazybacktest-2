/**
 * 狀態管理器使用範例
 * 
 * 展示如何在 main.js 中整合和使用新的 AppState 狀態管理器
 * 替換原有的全域變數
 */

// 導入狀態管理器
const { AppState } = require('./layers/ui/state-manager.js');

// 創建全域狀態實例
const appState = new AppState();

// === 替換原有全域變數的對應關係 ===

// 原始的全域變數：
// let stockChart = null;
// let backtestWorker = null;
// let optimizationWorker = null;
// let workerUrl = null;
// let cachedStockData = null;
// const cachedDataStore = new Map();
// let lastFetchSettings = null;
// let currentOptimizationResults = [];
// let sortState = { key: 'annualizedReturn', direction: 'desc' };
// let lastOverallResult = null;
// const loadingMascotState = { ... };

// 新的使用方式：
// appState.setChart(chart)              // 替換 stockChart
// appState.setBacktestWorker(worker)    // 替換 backtestWorker
// appState.setOptimizationWorker(worker)// 替換 optimizationWorker
// appState.setWorkerUrl(url)            // 替換 workerUrl
// appState.setCachedStockData(data)     // 替換 cachedStockData
// appState.getDataStore()               // 替換 cachedDataStore
// appState.setLastFetchSettings(settings) // 替換 lastFetchSettings
// appState.setCurrentOptimizationResults(results) // 替換 currentOptimizationResults
// appState.setSortState(state)          // 替換 sortState
// appState.setLastOverallResult(result) // 替換 lastOverallResult
// appState.getLoadingMascotVisibility() // 替換 loadingMascotState

// === 使用範例 ===

/**
 * 初始化應用程式狀態
 */
function initializeApp() {
  // 設置狀態變化監聽器
  appState.subscribe((state, changedPath) => {
    console.log(`State changed at ${changedPath}:`, state);
    
    // 根據狀態變化更新 UI
    if (changedPath.startsWith('ui.loadingMascot')) {
      updateLoadingMascotDisplay();
    } else if (changedPath === 'data.currentOptimizationResults') {
      updateOptimizationResultsTable();
    } else if (changedPath === 'ui.sorting') {
      applySortingToTable();
    }
  });
  
  // 將狀態實例暴露到 window 物件（保持向後相容）
  window.appState = appState;
  window.cachedDataStore = appState.getDataStore(); // 向後相容
}

/**
 * 範例：處理股票數據加載
 */
async function loadStockData(symbol) {
  // 檢查緩存
  const cacheKey = `tw|${symbol}|close`;
  const cachedEntry = appState.getDataStoreEntry(cacheKey);
  
  if (cachedEntry && !isCacheExpired(cachedEntry)) {
    appState.setCachedStockData(cachedEntry.data);
    return cachedEntry.data;
  }
  
  // 顯示載入動畫
  appState.setLoadingMascotVisibility({ hidden: false });
  
  try {
    // 獲取數據（模擬 API 調用）
    const stockData = await fetchStockData(symbol);
    
    // 更新緩存和當前數據
    appState.setDataStoreEntry(cacheKey, {
      data: stockData,
      timestamp: Date.now()
    });
    appState.setCachedStockData(stockData);
    
    // 記錄獲取設定
    appState.setLastFetchSettings({
      symbol,
      market: 'tw',
      timestamp: Date.now()
    });
    
    return stockData;
  } finally {
    // 隱藏載入動畫
    appState.setLoadingMascotVisibility({ hidden: true });
  }
}

/**
 * 範例：處理回測結果
 */
function handleBacktestResult(result) {
  // 儲存整體結果
  appState.setLastOverallResult(result);
  
  // 如果是優化結果，添加到列表
  if (result.isOptimization) {
    appState.addOptimizationResult({
      params: result.parameters,
      result: result.performance
    });
  }
  
  // 更新圖表
  const chart = appState.getChart();
  if (chart) {
    chart.updateData(result.chartData);
  }
}

/**
 * 範例：排序結果
 */
function sortResults(key, direction) {
  appState.setSortState({ key, direction });
  
  const results = appState.getCurrentOptimizationResults();
  const sorted = [...results].sort((a, b) => {
    const aVal = a.result[key] || 0;
    const bVal = b.result[key] || 0;
    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });
  
  appState.setCurrentOptimizationResults(sorted);
}

/**
 * 範例：重置應用程式狀態
 */
function resetApp() {
  // 清理 Workers
  const backtestWorker = appState.getBacktestWorker();
  const optimizationWorker = appState.getOptimizationWorker();
  
  if (backtestWorker) {
    backtestWorker.terminate();
  }
  if (optimizationWorker) {
    optimizationWorker.terminate();
  }
  
  // 重置狀態
  appState.reset();
  
  // 重新初始化
  initializeApp();
}

/**
 * 範例：狀態持久化
 */
function saveAppState() {
  try {
    const serialized = appState.serialize();
    localStorage.setItem('lazybacktest-state', serialized);
    console.log('State saved successfully');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

function loadAppState() {
  try {
    const saved = localStorage.getItem('lazybacktest-state');
    if (saved) {
      appState.deserialize(saved);
      console.log('State loaded successfully');
    }
  } catch (error) {
    console.error('Failed to load state:', error);
    // 如果載入失敗，使用預設狀態
    appState.reset();
  }
}

// === 工具函數 ===

function isCacheExpired(cacheEntry, maxAge = 5 * 60 * 1000) { // 5分鐘
  return Date.now() - cacheEntry.timestamp > maxAge;
}

async function fetchStockData(symbol) {
  // 模擬 API 調用
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        symbol,
        prices: Array.from({ length: 100 }, (_, i) => 100 + Math.random() * 20),
        dates: Array.from({ length: 100 }, (_, i) => new Date(Date.now() - (99 - i) * 24 * 60 * 60 * 1000))
      });
    }, 1000);
  });
}

function updateLoadingMascotDisplay() {
  const visibility = appState.getLoadingMascotVisibility();
  const mascotEl = document.getElementById('loading-mascot');
  if (mascotEl) {
    mascotEl.style.display = visibility.hidden ? 'none' : 'block';
  }
}

function updateOptimizationResultsTable() {
  const results = appState.getCurrentOptimizationResults();
  // 更新表格 UI...
  console.log('Updating results table with', results.length, 'results');
}

function applySortingToTable() {
  const sortState = appState.getSortState();
  // 應用排序樣式...
  console.log('Applying sort:', sortState);
}

// 導出給其他模組使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    appState,
    initializeApp,
    loadStockData,
    handleBacktestResult,
    sortResults,
    resetApp,
    saveAppState,
    loadAppState
  };
}

// 如果在瀏覽器環境中，自動初始化
if (typeof window !== 'undefined') {
  // 等待 DOM 載入完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
}