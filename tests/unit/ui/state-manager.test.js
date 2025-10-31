/**
 * 測試 AppState 狀態管理器
 * 任務：建立統一的 AppState 類別替換分散的全局變數
 */

const { AppState } = require('../../../js/layers/ui/state-manager.js');

describe('AppState 狀態管理器', () => {
  let appState;

  beforeEach(() => {
    appState = new AppState();
  });

  describe('初始化狀態', () => {
    test('應該有預設的初始狀態', () => {
      expect(appState.getState()).toEqual({
        cache: {
          stockData: null,
          dataStore: new Map()
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
      });
    });

    test('應該返回深度複製的狀態對象，避免直接修改', () => {
      const state1 = appState.getState();
      const state2 = appState.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // 不同的對象引用
      expect(state1.ui).not.toBe(state2.ui); // 嵌套對象也不同引用
    });
  });

  describe('緩存數據管理', () => {
    test('設置和獲取股票數據', () => {
      const mockStockData = { symbol: 'AAPL', prices: [100, 101, 102] };
      
      appState.setCachedStockData(mockStockData);
      expect(appState.getCachedStockData()).toEqual(mockStockData);
    });

    test('清除股票數據', () => {
      const mockStockData = { symbol: 'AAPL', prices: [100, 101, 102] };
      appState.setCachedStockData(mockStockData);
      
      appState.clearCachedStockData();
      expect(appState.getCachedStockData()).toBeNull();
    });

    test('操作數據存儲 Map', () => {
      const key = 'TSMC|2330|close';
      const value = { data: [100, 101], timestamp: Date.now() };
      
      appState.setDataStoreEntry(key, value);
      expect(appState.getDataStoreEntry(key)).toEqual(value);
      
      appState.clearDataStore();
      expect(appState.getDataStoreEntry(key)).toBeUndefined();
    });

    test('獲取整個數據存儲', () => {
      const key1 = 'TSMC|2330|close';
      const key2 = 'AAPL|AAPL|close';
      const value1 = { data: [100, 101] };
      const value2 = { data: [200, 201] };
      
      appState.setDataStoreEntry(key1, value1);
      appState.setDataStoreEntry(key2, value2);
      
      const store = appState.getDataStore();
      expect(store.get(key1)).toEqual(value1);
      expect(store.get(key2)).toEqual(value2);
    });
  });

  describe('UI 狀態管理', () => {
    test('設置和獲取圖表實例', () => {
      const mockChart = { type: 'line', data: [] };
      
      appState.setChart(mockChart);
      expect(appState.getChart()).toEqual(mockChart);
    });

    test('管理 Worker 實例', () => {
      const mockBacktestWorker = { type: 'backtest' };
      const mockOptimizationWorker = { type: 'optimization' };
      const mockWorkerUrl = 'blob:http://localhost/worker.js';
      
      appState.setBacktestWorker(mockBacktestWorker);
      appState.setOptimizationWorker(mockOptimizationWorker);
      appState.setWorkerUrl(mockWorkerUrl);
      
      expect(appState.getBacktestWorker()).toEqual(mockBacktestWorker);
      expect(appState.getOptimizationWorker()).toEqual(mockOptimizationWorker);
      expect(appState.getWorkerUrl()).toEqual(mockWorkerUrl);
    });

    test('管理載入動畫狀態', () => {
      const visibility = { hidden: true };
      const rotation = { angle: 90 };
      const lastSource = 'mascot-happy.gif';
      
      appState.setLoadingMascotVisibility(visibility);
      appState.setLoadingMascotRotation(rotation);
      appState.setLoadingMascotLastSource(lastSource);
      
      expect(appState.getLoadingMascotVisibility()).toEqual(visibility);
      expect(appState.getLoadingMascotRotation()).toEqual(rotation);
      expect(appState.getLoadingMascotLastSource()).toEqual(lastSource);
    });

    test('管理排序狀態', () => {
      const sortState = { key: 'sharpeRatio', direction: 'asc' };
      
      appState.setSortState(sortState);
      expect(appState.getSortState()).toEqual(sortState);
    });
  });

  describe('業務數據管理', () => {
    test('管理上次抓取設定', () => {
      const fetchSettings = {
        market: 'tw',
        symbol: '2330',
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      };
      
      appState.setLastFetchSettings(fetchSettings);
      expect(appState.getLastFetchSettings()).toEqual(fetchSettings);
    });

    test('管理當前優化結果', () => {
      const optimizationResults = [
        { params: { ma1: 5, ma2: 10 }, result: { return: 0.15 } },
        { params: { ma1: 10, ma2: 20 }, result: { return: 0.12 } }
      ];
      
      appState.setCurrentOptimizationResults(optimizationResults);
      expect(appState.getCurrentOptimizationResults()).toEqual(optimizationResults);
      
      // 測試追加結果
      const newResult = { params: { ma1: 20, ma2: 50 }, result: { return: 0.18 } };
      appState.addOptimizationResult(newResult);
      
      const updated = appState.getCurrentOptimizationResults();
      expect(updated).toHaveLength(3);
      expect(updated[2]).toEqual(newResult);
    });

    test('管理最後整體回測結果', () => {
      const overallResult = {
        totalReturn: 0.25,
        sharpeRatio: 1.5,
        maxDrawdown: -0.08,
        dataDebug: { totalTrades: 45 }
      };
      
      appState.setLastOverallResult(overallResult);
      expect(appState.getLastOverallResult()).toEqual(overallResult);
    });
  });

  describe('狀態監聽器', () => {
    test('註冊和觸發狀態變更監聽器', () => {
      const listener = jest.fn();
      const unlisten = appState.subscribe(listener);
      
      // 修改狀態應該觸發監聽器
      const mockData = { symbol: 'TEST' };
      appState.setCachedStockData(mockData);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          cache: expect.objectContaining({
            stockData: mockData
          })
        }),
        'cache.stockData'
      );
      
      // 取消訂閱
      unlisten();
      appState.setCachedStockData({ symbol: 'TEST2' });
      expect(listener).toHaveBeenCalledTimes(1); // 不再觸發
    });

    test('多個監聽器應該都被觸發', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      appState.subscribe(listener1);
      appState.subscribe(listener2);
      
      appState.setSortState({ key: 'return', direction: 'desc' });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('狀態重置', () => {
    test('重置到初始狀態', () => {
      // 修改一些狀態
      appState.setCachedStockData({ test: 'data' });
      appState.setChart({ type: 'candlestick' });
      appState.setLastFetchSettings({ market: 'us' });
      
      // 重置
      appState.reset();
      
      // 驗證狀態已重置
      expect(appState.getCachedStockData()).toBeNull();
      expect(appState.getChart()).toBeNull();
      expect(appState.getLastFetchSettings()).toBeNull();
    });

    test('重置應該觸發監聽器', () => {
      const listener = jest.fn();
      appState.subscribe(listener);
      
      appState.reset();
      
      expect(listener).toHaveBeenCalledWith(
        expect.any(Object),
        'reset'
      );
    });
  });

  describe('狀態持久化', () => {
    test('序列化狀態為 JSON', () => {
      appState.setCachedStockData({ symbol: 'TEST' });
      appState.setSortState({ key: 'return', direction: 'asc' });
      
      const serialized = appState.serialize();
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.cache.stockData).toEqual({ symbol: 'TEST' });
      expect(parsed.ui.sorting).toEqual({ key: 'return', direction: 'asc' });
    });

    test('從 JSON 反序列化狀態', () => {
      const stateData = {
        cache: { stockData: { symbol: 'RESTORE' } },
        ui: { 
          sorting: { key: 'sharpe', direction: 'desc' },
          workers: { backtest: null, optimization: null, workerUrl: null },
          loadingMascot: { visibility: { hidden: false }, rotation: null, lastSource: null },
          chart: null
        },
        data: {
          lastFetchSettings: { market: 'tw' },
          currentOptimizationResults: [],
          lastOverallResult: null
        }
      };
      
      appState.deserialize(JSON.stringify(stateData));
      
      expect(appState.getCachedStockData()).toEqual({ symbol: 'RESTORE' });
      expect(appState.getSortState()).toEqual({ key: 'sharpe', direction: 'desc' });
      expect(appState.getLastFetchSettings()).toEqual({ market: 'tw' });
    });
  });
});