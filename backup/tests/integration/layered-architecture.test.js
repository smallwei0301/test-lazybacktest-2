/**
 * LazyBacktest 應用程式入口點測試
 * 驗證基本的模組載入和初始化
 */

// Mock DOM environment
const mockElements = {
    result: { innerHTML: '', className: '' },
    stockNo: { value: '2330', addEventListener: jest.fn() },
    startDate: { value: '2024-01-01', addEventListener: jest.fn() },
    endDate: { value: '2024-12-31', addEventListener: jest.fn() },
    recentYears: { value: '1', addEventListener: jest.fn() },
    marketType: { value: 'TWSE', addEventListener: jest.fn() },
    stockChart: { getContext: jest.fn(() => ({ canvas: {} })) },
    'trade-results': { innerHTML: '' },
    'strategy-status': { innerHTML: '' },
    'loading-overlay': { style: { display: 'none' } },
    'progress-bar': { innerHTML: '', style: {} }
};

global.document = {
    getElementById: jest.fn((id) => mockElements[id] || null),
    addEventListener: jest.fn(),
    body: { 
        classList: { 
            contains: jest.fn(() => false), 
            add: jest.fn(), 
            remove: jest.fn() 
        } 
    },
    readyState: 'complete'
};

global.window = {
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    navigator: { userAgent: 'test' },
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
};

global.Chart = jest.fn(() => ({
    data: { datasets: [] },
    update: jest.fn(),
    destroy: jest.fn()
}));

global.fetch = jest.fn();

// 導入各個分層模組
const { AppState } = require('../../js/layers/core/app-state');
const { ProxyClient } = require('../../js/layers/api/proxy-client');
const { BacktestEngine } = require('../../js/layers/core/backtest-engine');
const { StrategyManager } = require('../../js/layers/core/strategy-manager');
const { UIController } = require('../../js/layers/ui/ui-controller');
const { Indicators } = require('../../js/layers/utils/indicators');

describe('LazyBacktest 分層架構整合測試', () => {
    let appState, proxyClient, backtestEngine, strategyManager, uiController, indicators;

    beforeEach(() => {
        // Mock fetch
        global.fetch.mockReset();
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue(JSON.stringify({
                data: [
                    { date: '2024-01-01', open: 100, high: 105, low: 98, close: 102, volume: 1000000 },
                    { date: '2024-01-02', open: 102, high: 108, low: 101, close: 106, volume: 1200000 }
                ]
            }))
        });

        // 初始化各層模組
        appState = new AppState();
        proxyClient = new ProxyClient();
        backtestEngine = new BacktestEngine();
        strategyManager = new StrategyManager();
        uiController = new UIController();
        indicators = new Indicators();
    });

    afterEach(() => {
        if (uiController) {
            uiController.destroy();
        }
        if (appState) {
            appState.clearAll();
        }
    });

    describe('模組初始化', () => {
        test('應該成功創建所有分層模組', () => {
            expect(appState).toBeInstanceOf(AppState);
            expect(proxyClient).toBeInstanceOf(ProxyClient);
            expect(backtestEngine).toBeInstanceOf(BacktestEngine);
            expect(strategyManager).toBeInstanceOf(StrategyManager);
            expect(uiController).toBeInstanceOf(UIController);
            expect(indicators).toBeInstanceOf(Indicators);
        });

        test('應該能夠初始化狀態管理器', async () => {
            await appState.initialize();
            
            expect(appState.isInitialized).toBe(true);
            expect(typeof appState.getState).toBe('function');
            expect(typeof appState.setState).toBe('function');
        });

        test('應該能夠配置各個模組', () => {
            // 配置 ProxyClient
            proxyClient.updateConfig({
                timeout: 30000,
                retryAttempts: 3
            });
            
            expect(proxyClient.config.timeout).toBe(30000);
            expect(proxyClient.config.retryAttempts).toBe(3);

            // 配置 BacktestEngine
            backtestEngine.configure({
                commission: 0.001425,
                tax: 0.003
            });
            
            expect(backtestEngine.config.commission).toBe(0.001425);
            expect(backtestEngine.config.tax).toBe(0.003);
        });
    });

    describe('模組間整合', () => {
        test('應該能夠在狀態管理器中儲存和獲取數據', async () => {
            await appState.initialize();
            
            const testData = { 
                stockNo: '2330', 
                price: 500,
                timestamp: Date.now()
            };
            
            appState.setState('stock', testData);
            const retrievedData = appState.getState('stock');
            
            expect(retrievedData).toEqual(testData);
        });

        test('應該能夠使用 ProxyClient 獲取數據並緩存', async () => {
            await appState.initialize();
            
            const params = {
                stockNo: '2330',
                market: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            };

            const data = await proxyClient.getStockData(params);
            
            expect(data).toBeDefined();
            expect(global.fetch).toHaveBeenCalled();
            
            // 將數據存入狀態管理器
            const cacheKey = `${params.market}_${params.stockNo}_${params.startDate}_${params.endDate}`;
            appState.setCache(cacheKey, data);
            
            const cachedData = appState.getCache(cacheKey);
            expect(cachedData).toEqual(data);
        });

        test('應該能夠執行策略管理流程', async () => {
            await strategyManager.initialize();
            
            // 註冊測試策略
            const testStrategy = {
                name: 'test-ma-cross',
                description: '測試移動平均交叉策略',
                parameters: {
                    shortMA: { type: 'number', default: 5, min: 1, max: 50 },
                    longMA: { type: 'number', default: 20, min: 10, max: 200 }
                },
                execute: jest.fn().mockReturnValue({
                    signals: [
                        { date: '2024-01-01', action: 'buy', price: 100 },
                        { date: '2024-01-02', action: 'sell', price: 106 }
                    ]
                })
            };
            
            await strategyManager.registerStrategy(testStrategy);
            const strategies = strategyManager.getRegisteredStrategies();
            
            expect(strategies.length).toBeGreaterThan(0);
            expect(strategies[0].name).toBe('test-ma-cross');
        });

        test('應該能夠執行完整的回測流程', async () => {
            await appState.initialize();
            await strategyManager.initialize();
            
            // 準備測試數據
            const stockData = [
                { date: '2024-01-01', open: 100, high: 105, low: 98, close: 102, volume: 1000000 },
                { date: '2024-01-02', open: 102, high: 108, low: 101, close: 106, volume: 1200000 },
                { date: '2024-01-03', open: 106, high: 110, low: 104, close: 108, volume: 900000 }
            ];

            // 註冊策略
            const strategy = {
                name: 'test-strategy',
                execute: jest.fn().mockImplementation((data, params) => {
                    return {
                        signals: [
                            { date: '2024-01-01', action: 'buy', price: 102, quantity: 1000 },
                            { date: '2024-01-03', action: 'sell', price: 108, quantity: 1000 }
                        ]
                    };
                })
            };
            
            await strategyManager.registerStrategy(strategy);
            
            // 配置回測引擎
            backtestEngine.configure({
                commission: 0.001425,
                tax: 0.003,
                slippage: 0.001,
                initialCapital: 1000000
            });

            // 執行回測
            const result = await backtestEngine.runBacktest({
                stockData,
                strategy,
                startDate: '2024-01-01',
                endDate: '2024-01-03',
                initialCapital: 1000000
            });

            expect(result).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.trades).toBeDefined();
            expect(Array.isArray(result.trades)).toBe(true);
        });

        test('應該能夠計算技術指標並整合', () => {
            const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109];
            
            // 計算移動平均線
            const sma5 = indicators.calculateSMA(prices, 5);
            expect(sma5).toBeDefined();
            expect(Array.isArray(sma5)).toBe(true);
            
            // 將結果存入狀態管理器
            appState.setState('indicators', { sma5 });
            const storedIndicators = appState.getState('indicators');
            
            expect(storedIndicators.sma5).toEqual(sma5);
        });

        test('應該能夠處理 UI 事件和狀態同步', () => {
            // 模擬 UI 參數變更
            const formData = uiController.getFormData();
            expect(formData).toHaveProperty('stockNo');
            expect(formData).toHaveProperty('startDate');
            expect(formData).toHaveProperty('endDate');
            expect(formData).toHaveProperty('marketType');

            // 驗證參數
            const validation = uiController.validateBacktestParams();
            expect(validation).toHaveProperty('isValid');
            expect(validation).toHaveProperty('errors');

            // 如果參數有效，更新狀態管理器
            if (validation.isValid) {
                appState.setState('ui', formData);
                const uiState = appState.getState('ui');
                expect(uiState).toEqual(formData);
            }
        });
    });

    describe('錯誤處理和復原力', () => {
        test('應該能夠處理 API 錯誤', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            await expect(proxyClient.getStockData({
                stockNo: '2330',
                market: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            })).rejects.toThrow();
        });

        test('應該能夠處理無效的策略', async () => {
            await strategyManager.initialize();
            
            const invalidStrategy = {
                name: 'invalid-strategy',
                // 缺少必要的 execute 方法
            };
            
            await expect(strategyManager.registerStrategy(invalidStrategy))
                .rejects.toThrow();
        });

        test('應該能夠清理資源', async () => {
            await appState.initialize();
            
            // 設置一些狀態
            appState.setState('test', { data: 'test' });
            appState.setCache('test', { data: 'cached' });
            
            // 清理
            appState.clearAll();
            
            expect(appState.getState('test')).toBeUndefined();
            expect(appState.getCache('test')).toBeUndefined();
        });
    });

    describe('效能和記憶體管理', () => {
        test('應該能夠處理大量數據', async () => {
            await appState.initialize();
            
            // 生成大量測試數據
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                date: `2024-01-${String(i + 1).padStart(2, '0')}`,
                close: 100 + Math.random() * 50,
                volume: 1000000 + Math.random() * 500000
            }));

            // 儲存到狀態管理器
            appState.setState('largeData', largeDataset);
            
            const retrievedData = appState.getState('largeData');
            expect(retrievedData).toHaveLength(1000);
            
            // 清理大數據
            appState.clearState('largeData');
            expect(appState.getState('largeData')).toBeUndefined();
        });

        test('應該能夠管理緩存過期', async () => {
            await appState.initialize();
            
            const testData = { value: 'test' };
            const expiration = Date.now() + 1000; // 1秒後過期
            
            appState.setCache('test', testData, expiration);
            
            // 立即獲取應該有效
            let cached = appState.getCache('test');
            expect(cached).toEqual(testData);
            
            // 等待過期 (在實際測試中可能需要 mock 時間)
            // 這裡我們手動清理過期緩存
            appState.clearExpiredCache();
        });
    });
});