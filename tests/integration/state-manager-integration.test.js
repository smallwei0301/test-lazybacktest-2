/**
 * 狀態管理器集成測試
 * 
 * 測試 AppState 與其他組件的整合，特別是與技術指標計算的配合
 */

const { AppState } = require('../../js/layers/ui/state-manager.js');
const { IndicatorCalculator } = require('../../js/layers/core/indicators/index.js');

describe('AppState 集成測試', () => {
  let appState;
  let indicatorCalculator;

  beforeEach(() => {
    appState = new AppState();
    indicatorCalculator = new IndicatorCalculator();
  });

  describe('與技術指標計算的整合', () => {
    test('應該能夠快取和重用指標計算結果', () => {
      const stockData = {
        symbol: 'AAPL',
        prices: [100, 102, 101, 103, 105, 104, 106, 108, 107, 109]
      };
      
      // 設置股票數據
      appState.setCachedStockData(stockData);
      
      // 計算 SMA 並快取
      const sma5 = indicatorCalculator.calculateSMA(stockData.prices, 5);
      const cacheKey = `${stockData.symbol}|SMA|5`;
      appState.setDataStoreEntry(cacheKey, {
        indicator: 'SMA',
        period: 5,
        data: sma5,
        timestamp: Date.now()
      });
      
      // 驗證可以從快取取得
      const cached = appState.getDataStoreEntry(cacheKey);
      expect(cached.data).toEqual(sma5);
      expect(cached.indicator).toBe('SMA');
      expect(cached.period).toBe(5);
    });

    test('應該能夠批次計算和儲存多個指標', () => {
      const stockData = {
        symbol: 'TSMC',
        prices: [500, 510, 505, 515, 520, 512, 518, 525, 522, 530, 528, 535, 530, 540, 545]
      };
      
      appState.setCachedStockData(stockData);
      
      // 批次計算指標
      const indicators = {
        sma5: indicatorCalculator.calculateSMA(stockData.prices, 5),
        sma10: indicatorCalculator.calculateSMA(stockData.prices, 10),
        rsi14: indicatorCalculator.calculateRSI(stockData.prices, 14)
      };
      
      // 儲存到狀態管理器
      Object.entries(indicators).forEach(([key, data]) => {
        const [type, period] = key.match(/([a-zA-Z]+)(\d+)/).slice(1);
        appState.setDataStoreEntry(`${stockData.symbol}|${type.toUpperCase()}|${period}`, {
          indicator: type.toUpperCase(),
          period: parseInt(period),
          data,
          timestamp: Date.now()
        });
      });
      
      // 驗證所有指標都已儲存
      expect(appState.getDataStoreEntry('TSMC|SMA|5').data).toEqual(indicators.sma5);
      expect(appState.getDataStoreEntry('TSMC|SMA|10').data).toEqual(indicators.sma10);
      expect(appState.getDataStoreEntry('TSMC|RSI|14').data).toEqual(indicators.rsi14);
    });
  });

  describe('回測結果整合', () => {
    test('應該能夠儲存和管理回測結果', () => {
      const backtestResult = {
        strategy: 'MA Cross',
        parameters: { fast: 5, slow: 20 },
        performance: {
          totalReturn: 0.15,
          annualizedReturn: 0.12,
          sharpeRatio: 1.2,
          maxDrawdown: -0.08,
          winRate: 0.65
        },
        trades: [
          { date: '2023-01-15', action: 'buy', price: 100, quantity: 100 },
          { date: '2023-02-10', action: 'sell', price: 110, quantity: 100 }
        ],
        chartData: {
          prices: [100, 102, 101, 103, 105],
          signals: ['', 'buy', '', '', 'sell']
        }
      };
      
      // 儲存回測結果
      appState.setLastOverallResult(backtestResult);
      
      // 驗證結果已儲存
      const stored = appState.getLastOverallResult();
      expect(stored.performance.totalReturn).toBe(0.15);
      expect(stored.trades).toHaveLength(2);
    });

    test('應該能夠管理優化結果列表', () => {
      const optimizationResults = [
        {
          params: { fast: 5, slow: 10 },
          result: { annualizedReturn: 0.08, sharpeRatio: 0.9 }
        },
        {
          params: { fast: 5, slow: 20 },
          result: { annualizedReturn: 0.12, sharpeRatio: 1.2 }
        },
        {
          params: { fast: 10, slow: 20 },
          result: { annualizedReturn: 0.10, sharpeRatio: 1.0 }
        }
      ];
      
      // 設置優化結果
      appState.setCurrentOptimizationResults(optimizationResults);
      
      // 測試排序功能
      appState.setSortState({ key: 'annualizedReturn', direction: 'desc' });
      
      const results = appState.getCurrentOptimizationResults();
      const sortState = appState.getSortState();
      
      expect(results).toHaveLength(3);
      expect(sortState.key).toBe('annualizedReturn');
      expect(sortState.direction).toBe('desc');
      
      // 添加新結果
      appState.addOptimizationResult({
        params: { fast: 15, slow: 30 },
        result: { annualizedReturn: 0.14, sharpeRatio: 1.3 }
      });
      
      expect(appState.getCurrentOptimizationResults()).toHaveLength(4);
    });
  });

  describe('UI 狀態同步', () => {
    test('應該能夠追蹤 UI 組件狀態變化', () => {
      const stateChanges = [];
      
      // 監聽狀態變化
      appState.subscribe((state, path) => {
        stateChanges.push({ path, timestamp: Date.now() });
      });
      
      // 模擬 UI 操作
      appState.setChart({ type: 'candlestick', data: [] });
      appState.setLoadingMascotVisibility({ hidden: true });
      appState.setSortState({ key: 'sharpeRatio', direction: 'asc' });
      
      // 驗證狀態變化被記錄
      expect(stateChanges).toHaveLength(3);
      expect(stateChanges[0].path).toBe('ui.chart');
      expect(stateChanges[1].path).toBe('ui.loadingMascot.visibility');
      expect(stateChanges[2].path).toBe('ui.sorting');
    });

    test('應該能夠管理 Worker 生命週期', () => {
      const mockWorker = {
        postMessage: jest.fn(),
        terminate: jest.fn(),
        addEventListener: jest.fn()
      };
      
      // 設置 Worker
      appState.setBacktestWorker(mockWorker);
      appState.setWorkerUrl('blob:http://localhost/worker.js');
      
      expect(appState.getBacktestWorker()).toBe(mockWorker);
      expect(appState.getWorkerUrl()).toBe('blob:http://localhost/worker.js');
      
      // 清理
      const worker = appState.getBacktestWorker();
      if (worker) {
        worker.terminate();
      }
      appState.setBacktestWorker(null);
      
      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(appState.getBacktestWorker()).toBeNull();
    });
  });

  describe('狀態持久化整合', () => {
    test('應該能夠完整序列化和恢復複雜狀態', () => {
      // 設置複雜狀態
      const stockData = { symbol: 'NVDA', prices: [800, 820, 810, 830] };
      appState.setCachedStockData(stockData);
      
      appState.setDataStoreEntry('NVDA|SMA|20', {
        data: [810, 815, 820],
        timestamp: Date.now()
      });
      
      appState.setLastFetchSettings({
        symbol: 'NVDA',
        market: 'us',
        startDate: '2023-01-01'
      });
      
      appState.setCurrentOptimizationResults([
        { params: { period: 20 }, result: { return: 0.15 } }
      ]);
      
      // 序列化
      const serialized = appState.serialize();
      expect(typeof serialized).toBe('string');
      
      // 創建新實例並恢復
      const newAppState = new AppState();
      newAppState.deserialize(serialized);
      
      // 驗證狀態已正確恢復
      expect(newAppState.getCachedStockData()).toEqual(stockData);
      expect(newAppState.getLastFetchSettings().symbol).toBe('NVDA');
      expect(newAppState.getCurrentOptimizationResults()).toHaveLength(1);
      expect(newAppState.getDataStoreEntry('NVDA|SMA|20')).toBeDefined();
    });

    test('應該能夠處理序列化錯誤', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => {
        appState.deserialize(invalidJson);
      }).toThrow('Invalid state JSON');
    });
  });

  describe('記憶體管理', () => {
    test('應該能夠清理大量數據', () => {
      // 添加大量測試數據
      for (let i = 0; i < 100; i++) {
        appState.setDataStoreEntry(`stock${i}|SMA|20`, {
          data: Array.from({ length: 1000 }, () => Math.random() * 100),
          timestamp: Date.now()
        });
      }
      
      // 添加大量優化結果
      const results = Array.from({ length: 1000 }, (_, i) => ({
        params: { param: i },
        result: { return: Math.random() }
      }));
      appState.setCurrentOptimizationResults(results);
      
      // 驗證數據已添加
      expect(appState.getDataStore().size).toBe(100);
      expect(appState.getCurrentOptimizationResults()).toHaveLength(1000);
      
      // 清理
      appState.clearDataStore();
      appState.clearOptimizationResults();
      
      // 驗證清理成功
      expect(appState.getDataStore().size).toBe(0);
      expect(appState.getCurrentOptimizationResults()).toHaveLength(0);
    });
  });
});