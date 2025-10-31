/**
 * LazyBacktest 完整整合測試
 * 測試現有分層架構的整合情況
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

// 導入現有的分層模組 (使用正確路徑)
const { AppState } = require('../../js/layers/ui/state-manager');
const { ProxyClient } = require('../../js/layers/api/proxy-client');
const { BacktestEngine } = require('../../js/layers/core/backtest-engine');
const { StrategyManager } = require('../../js/layers/core/strategy-manager');
const { UIController } = require('../../js/layers/ui/ui-controller');
const { Indicators } = require('../../js/layers/core/indicators');

describe('LazyBacktest 完整整合測試', () => {
    let appState, proxyClient, backtestEngine, strategyManager, uiController, indicators;

    beforeEach(async () => {
        // Mock fetch
        global.fetch.mockReset();
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            text: jest.fn().mockResolvedValue(JSON.stringify({
                data: [
                    { date: '2024-01-01', open: 100, high: 105, low: 98, close: 102, volume: 1000000 },
                    { date: '2024-01-02', open: 102, high: 108, low: 101, close: 106, volume: 1200000 },
                    { date: '2024-01-03', open: 106, high: 110, low: 104, close: 108, volume: 900000 }
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

        // 初始化狀態管理器
        // AppState 不需要 initialize 方法
        await strategyManager.initialize();
    });

    afterEach(() => {
        if (uiController) {
            uiController.destroy();
        }
        if (stateManager) {
            stateManager.clearAll();
        }
    });

    describe('分層架構驗證', () => {
        test('應該成功創建所有分層模組', () => {
            expect(stateManager).toBeInstanceOf(StateManager);
            expect(proxyClient).toBeInstanceOf(ProxyClient);
            expect(backtestEngine).toBeInstanceOf(BacktestEngine);
            expect(strategyManager).toBeInstanceOf(StrategyManager);
            expect(uiController).toBeInstanceOf(UIController);
            expect(indicators).toBeInstanceOf(Indicators);
        });

        test('應該能夠配置各層級模組', () => {
            // ProxyClient 配置
            proxyClient.updateConfig({
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000
            });
            
            expect(proxyClient.config.timeout).toBe(30000);
            expect(proxyClient.config.retryAttempts).toBe(3);

            // BacktestEngine 配置
            backtestEngine.configure({
                commission: 0.001425,
                tax: 0.003,
                slippage: 0.001
            });
            
            expect(backtestEngine.config.commission).toBe(0.001425);
            expect(backtestEngine.config.tax).toBe(0.003);
            expect(backtestEngine.config.slippage).toBe(0.001);
        });
    });

    describe('數據流整合測試', () => {
        test('API -> 狀態管理 -> UI 數據流', async () => {
            // 1. 從 API 獲取數據
            const stockData = await proxyClient.getStockData({
                stockNo: '2330',
                market: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-03'
            });

            expect(stockData).toBeDefined();
            expect(global.fetch).toHaveBeenCalled();

            // 2. 儲存到狀態管理器
            const cacheKey = 'TWSE_2330_2024-01-01_2024-01-03';
            stateManager.setCache(cacheKey, {
                data: stockData,
                timestamp: Date.now(),
                expires: Date.now() + 3600000 // 1小時
            });

            const cachedData = stateManager.getCache(cacheKey);
            expect(cachedData).toBeDefined();
            expect(cachedData.data).toEqual(stockData);

            // 3. UI 顯示結果 (模擬)
            const validation = uiController.validateBacktestParams();
            expect(validation).toHaveProperty('isValid');
            expect(validation).toHaveProperty('errors');
        });

        test('策略執行 -> 回測引擎 -> 結果顯示流程', async () => {
            // 1. 註冊測試策略
            const testStrategy = {
                name: 'integration-test-strategy',
                description: '整合測試策略',
                parameters: {
                    shortMA: { type: 'number', default: 5 },
                    longMA: { type: 'number', default: 20 }
                },
                execute: jest.fn().mockImplementation((data, params) => {
                    return {
                        signals: [
                            { date: '2024-01-01', action: 'buy', price: 102, quantity: 1000 },
                            { date: '2024-01-03', action: 'sell', price: 108, quantity: 1000 }
                        ],
                        indicators: {
                            shortMA: [null, null, null, null, 103.2],
                            longMA: [null, null, null, null, null]
                        }
                    };
                })
            };

            await strategyManager.registerStrategy(testStrategy);
            const registeredStrategy = await strategyManager.getStrategy('integration-test-strategy');
            expect(registeredStrategy).toBeDefined();

            // 2. 準備股票數據
            const stockData = [
                { date: '2024-01-01', open: 100, high: 105, low: 98, close: 102, volume: 1000000 },
                { date: '2024-01-02', open: 102, high: 108, low: 101, close: 106, volume: 1200000 },
                { date: '2024-01-03', open: 106, high: 110, low: 104, close: 108, volume: 900000 }
            ];

            // 3. 執行回測
            backtestEngine.configure({
                commission: 0.001425,
                tax: 0.003,
                initialCapital: 1000000
            });

            const backtestResult = await backtestEngine.runBacktest({
                stockData,
                strategy: registeredStrategy,
                startDate: '2024-01-01',
                endDate: '2024-01-03',
                initialCapital: 1000000
            });

            expect(backtestResult).toBeDefined();
            expect(backtestResult.summary).toBeDefined();
            expect(backtestResult.trades).toBeDefined();

            // 4. 將結果儲存到狀態管理器
            stateManager.setState('backtest', {
                result: backtestResult,
                timestamp: Date.now(),
                strategy: 'integration-test-strategy'
            });

            const storedResult = stateManager.getState('backtest');
            expect(storedResult.result).toEqual(backtestResult);

            // 5. UI 顯示結果
            uiController.displayResults(backtestResult);
            expect(mockElements['trade-results'].innerHTML).toContain('回測摘要');
        });

        test('技術指標計算 -> 策略使用 -> 回測執行整合', async () => {
            // 1. 準備價格數據
            const prices = [100, 102, 104, 103, 105, 107, 106, 108, 110, 109];
            
            // 2. 計算技術指標
            const sma5 = indicators.calculateSMA(prices, 5);
            const rsi = indicators.calculateRSI(prices, 14);
            
            expect(sma5).toBeDefined();
            expect(rsi).toBeDefined();

            // 3. 將指標結果存入狀態管理器
            stateManager.setState('indicators', {
                sma5,
                rsi,
                prices,
                timestamp: Date.now()
            });

            const storedIndicators = stateManager.getState('indicators');
            expect(storedIndicators.sma5).toEqual(sma5);
            expect(storedIndicators.rsi).toEqual(rsi);

            // 4. 創建使用指標的策略
            const indicatorStrategy = {
                name: 'indicator-based-strategy',
                execute: jest.fn().mockImplementation((data, params) => {
                    const signals = [];
                    
                    // 使用存儲的指標數據
                    const indicators = stateManager.getState('indicators');
                    if (indicators && indicators.sma5) {
                        signals.push({
                            date: '2024-01-01',
                            action: 'buy',
                            price: 100,
                            quantity: 1000,
                            reason: `SMA5: ${indicators.sma5[indicators.sma5.length - 1]}`
                        });
                    }

                    return { signals };
                })
            };

            await strategyManager.registerStrategy(indicatorStrategy);
            
            // 5. 執行策略驗證指標被正確使用
            const strategy = await strategyManager.getStrategy('indicator-based-strategy');
            const result = strategy.execute(prices, {});
            
            expect(result.signals).toBeDefined();
            expect(result.signals.length).toBeGreaterThan(0);
        });
    });

    describe('錯誤處理和恢復', () => {
        test('應該能夠處理 API 錯誤並保持系統穩定', async () => {
            // 模擬 API 錯誤
            global.fetch.mockRejectedValue(new Error('Network timeout'));

            await expect(proxyClient.getStockData({
                stockNo: '2330',
                market: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            })).rejects.toThrow('Network timeout');

            // 驗證其他模組仍然正常工作
            const formData = uiController.getFormData();
            expect(formData).toBeDefined();

            stateManager.setState('test', { status: 'ok' });
            expect(stateManager.getState('test').status).toBe('ok');
        });

        test('應該能夠處理策略執行錯誤', async () => {
            // 註冊有錯誤的策略
            const faultyStrategy = {
                name: 'faulty-strategy',
                execute: jest.fn().mockImplementation(() => {
                    throw new Error('Strategy execution failed');
                })
            };

            await strategyManager.registerStrategy(faultyStrategy);
            const strategy = await strategyManager.getStrategy('faulty-strategy');

            // 回測引擎應該能夠處理策略錯誤
            const stockData = [
                { date: '2024-01-01', close: 100 },
                { date: '2024-01-02', close: 102 }
            ];

            await expect(backtestEngine.runBacktest({
                stockData,
                strategy,
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            })).rejects.toThrow();

            // 驗證系統狀態未被破壞
            expect(strategyManager.getRegisteredStrategies().length).toBeGreaterThan(0);
        });
    });

    describe('效能和資源管理', () => {
        test('應該能夠處理大量數據並正確管理記憶體', async () => {
            // 生成大量測試數據
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
                open: 100 + Math.random() * 50,
                high: 105 + Math.random() * 50,
                low: 95 + Math.random() * 50,
                close: 100 + Math.random() * 50,
                volume: 1000000 + Math.random() * 500000
            }));

            // 儲存大量數據
            stateManager.setState('largeData', largeDataset);
            const retrievedData = stateManager.getState('largeData');
            expect(retrievedData).toHaveLength(1000);

            // 清理大數據
            stateManager.clearState('largeData');
            expect(stateManager.getState('largeData')).toBeUndefined();
        });

        test('應該能夠管理緩存生命週期', async () => {
            const testData = { value: 'cached data' };
            
            // 設置短期緩存
            stateManager.setCache('short-term', testData, Date.now() + 100);
            
            // 立即獲取應該成功
            let cached = stateManager.getCache('short-term');
            expect(cached).toEqual(testData);

            // 設置長期緩存
            stateManager.setCache('long-term', testData, Date.now() + 3600000);
            cached = stateManager.getCache('long-term');
            expect(cached).toEqual(testData);

            // 清理過期緩存
            stateManager.clearExpiredCache();
        });
    });

    describe('系統整合完整性', () => {
        test('應該能夠執行完整的回測工作流程', async () => {
            console.log('開始完整工作流程測試...');

            // 1. 配置系統
            proxyClient.updateConfig({ timeout: 30000 });
            backtestEngine.configure({
                commission: 0.001425,
                tax: 0.003,
                initialCapital: 1000000
            });

            // 2. 模擬用戶輸入
            mockElements.stockNo.value = '2330';
            mockElements.startDate.value = '2024-01-01';
            mockElements.endDate.value = '2024-01-03';
            mockElements.marketType.value = 'TWSE';

            const formData = uiController.getFormData();
            expect(formData.stockNo).toBe('2330');

            // 3. 驗證輸入
            const validation = uiController.validateBacktestParams();
            expect(validation.isValid).toBe(true);

            // 4. 獲取股票數據
            const stockData = await proxyClient.getStockData({
                stockNo: formData.stockNo,
                market: formData.marketType,
                startDate: formData.startDate,
                endDate: formData.endDate
            });

            // 5. 緩存數據
            const cacheKey = `${formData.marketType}_${formData.stockNo}_${formData.startDate}_${formData.endDate}`;
            stateManager.setCache(cacheKey, stockData);

            // 6. 註冊並執行策略
            const strategy = {
                name: 'complete-workflow-strategy',
                execute: jest.fn().mockReturnValue({
                    signals: [
                        { date: '2024-01-01', action: 'buy', price: 102 },
                        { date: '2024-01-03', action: 'sell', price: 108 }
                    ]
                })
            };

            await strategyManager.registerStrategy(strategy);

            // 7. 執行回測
            const backtestResult = await backtestEngine.runBacktest({
                stockData: stockData.data,
                strategy,
                startDate: formData.startDate,
                endDate: formData.endDate,
                initialCapital: 1000000
            });

            // 8. 保存結果
            stateManager.setState('currentBacktest', {
                params: formData,
                result: backtestResult,
                timestamp: Date.now()
            });

            // 9. 顯示結果
            uiController.displayResults(backtestResult);

            // 10. 驗證整個流程
            const savedBacktest = stateManager.getState('currentBacktest');
            expect(savedBacktest).toBeDefined();
            expect(savedBacktest.result).toEqual(backtestResult);
            expect(mockElements['trade-results'].innerHTML).toContain('回測摘要');

            console.log('完整工作流程測試完成！');
        });
    });
});