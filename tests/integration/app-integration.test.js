/**
 * LazyBacktest 應用程式整合測試
 * 測試完整的分層架構整合
 */

// Mock DOM 環境
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

// Mock fetch
global.fetch = jest.fn();

const { LazyBacktestApp } = require('../../js/app');

describe('LazyBacktest 應用程式整合測試', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 設置 fetch mock 預設行為
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

        app = new LazyBacktestApp();
    });

    afterEach(async () => {
        if (app) {
            app.destroy();
        }
    });

    describe('應用程式初始化', () => {
        test('應該成功初始化所有分層模組', async () => {
            await app.initialize();
            
            expect(app.isInitialized).toBe(true);
            expect(app.appState).toBeDefined();
            expect(app.proxyClient).toBeDefined();
            expect(app.backtestEngine).toBeDefined();
            expect(app.strategyManager).toBeDefined();
            expect(app.uiController).toBeDefined();
            expect(app.indicators).toBeDefined();
        });

        test('應該正確設置模組配置', async () => {
            await app.initialize();
            
            // 檢查 ProxyClient 配置
            expect(app.proxyClient.config.timeout).toBe(30000);
            expect(app.proxyClient.config.retryAttempts).toBe(3);
            
            // 檢查 BacktestEngine 配置
            expect(app.backtestEngine.config.commission).toBe(0.001425);
            expect(app.backtestEngine.config.tax).toBe(0.003);
        });

        test('應該載入策略插件', async () => {
            // Mock 策略插件
            jest.doMock('../js/strategy-plugins/ma-cross', () => ({
                name: 'ma-cross',
                execute: jest.fn()
            }), { virtual: true });

            await app.initialize();
            
            const strategies = app.getAvailableStrategies();
            expect(strategies).toBeInstanceOf(Array);
        });
    });

    describe('數據獲取與緩存', () => {
        beforeEach(async () => {
            await app.initialize();
        });

        test('應該能夠獲取股票數據', async () => {
            const params = {
                stockNo: '2330',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            };

            const data = await app.fetchStockData(params);
            
            expect(data).toBeDefined();
            expect(Array.isArray(data.data)).toBe(true);
            expect(global.fetch).toHaveBeenCalled();
        });

        test('應該使用緩存的數據', async () => {
            const params = {
                stockNo: '2330',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            };

            // 第一次獲取
            await app.fetchStockData(params);
            const firstCallCount = global.fetch.mock.calls.length;

            // 第二次獲取應該使用緩存
            await app.fetchStockData(params);
            const secondCallCount = global.fetch.mock.calls.length;

            expect(secondCallCount).toBe(firstCallCount);
        });

        test('應該生成正確的緩存鍵', () => {
            const params = {
                stockNo: '2330',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            };

            const cacheKey = app.generateCacheKey(params);
            expect(cacheKey).toBe('TWSE_2330_2024-01-01_2024-01-02');
        });
    });

    describe('回測執行', () => {
        beforeEach(async () => {
            await app.initialize();
            
            // Mock 策略
            app.strategyManager.registerStrategy({
                name: 'test-strategy',
                execute: jest.fn().mockReturnValue({
                    signals: [
                        { date: '2024-01-01', action: 'buy', price: 100 },
                        { date: '2024-01-02', action: 'sell', price: 106 }
                    ]
                })
            });
        });

        test('應該能夠執行完整回測流程', async () => {
            const params = {
                stockNo: '2330',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02',
                strategyName: 'test-strategy',
                initialCapital: 1000000
            };

            // Mock UI 驗證通過
            jest.spyOn(app.uiController, 'validateBacktestParams').mockReturnValue({
                isValid: true,
                errors: []
            });

            const result = await app.runBacktest(params);
            
            expect(result).toBeDefined();
            expect(app.currentBacktest).toBeDefined();
            expect(app.currentBacktest.params).toEqual(params);
        });

        test('應該處理回測參數驗證失敗', async () => {
            const params = {
                stockNo: '',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            };

            // Mock UI 驗證失敗
            jest.spyOn(app.uiController, 'validateBacktestParams').mockReturnValue({
                isValid: false,
                errors: ['請輸入股票代號']
            });

            const showErrorSpy = jest.spyOn(app.uiController, 'showError');

            await app.runBacktest(params);
            
            expect(showErrorSpy).toHaveBeenCalledWith('請輸入股票代號');
        });
    });

    describe('UI 整合', () => {
        beforeEach(async () => {
            await app.initialize();
        });

        test('應該處理市場類型變更事件', () => {
            const detail = { marketType: 'TPEX' };
            
            app.handleMarketTypeChange(detail);
            
            const uiState = app.appState.getState('ui');
            expect(uiState.marketType).toBe('TPEX');
        });

        test('應該處理日期變更事件', () => {
            const detail = { 
                startDate: '2024-01-01', 
                endDate: '2024-12-31' 
            };
            
            app.handleDateChange(detail);
            
            const uiState = app.appState.getState('ui');
            expect(uiState.startDate).toBe('2024-01-01');
            expect(uiState.endDate).toBe('2024-12-31');
        });

        test('應該處理股票代號變更事件', () => {
            const detail = { stockNo: '2317' };
            
            app.handleStockChange(detail);
            
            const uiState = app.appState.getState('ui');
            expect(uiState.stockNo).toBe('2317');
        });

        test('應該更新圖表數據', () => {
            const stockData = [
                { date: '2024-01-01', close: 100 },
                { date: '2024-01-02', close: 106 }
            ];
            
            const backtestResult = {
                equity: [1000000, 1060000]
            };

            const updateChartSpy = jest.spyOn(app.uiController, 'updateChart');
            
            app.updateChart(stockData, backtestResult);
            
            expect(updateChartSpy).toHaveBeenCalledWith({
                labels: ['2024-01-01', '2024-01-02'],
                datasets: expect.arrayContaining([
                    expect.objectContaining({ label: '股價' }),
                    expect.objectContaining({ label: '持倉資產' })
                ])
            });
        });
    });

    describe('狀態管理', () => {
        beforeEach(async () => {
            await app.initialize();
        });

        test('應該獲取完整應用程式狀態', () => {
            const state = app.getAppState();
            
            expect(state).toHaveProperty('initialized');
            expect(state).toHaveProperty('currentBacktest');
            expect(state).toHaveProperty('availableStrategies');
            expect(state).toHaveProperty('cache');
            
            expect(state.initialized).toBe(true);
        });

        test('應該正確管理緩存過期', () => {
            const expiredCache = {
                data: 'test',
                expires: Date.now() - 1000
            };
            
            const validCache = {
                data: 'test',
                expires: Date.now() + 1000
            };

            expect(app.isCacheExpired(expiredCache)).toBe(true);
            expect(app.isCacheExpired(validCache)).toBe(false);
        });
    });

    describe('錯誤處理', () => {
        beforeEach(async () => {
            await app.initialize();
        });

        test('應該處理策略不存在的錯誤', async () => {
            const params = {
                stockNo: '2330',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02',
                strategyName: 'non-existent-strategy'
            };

            // Mock UI 驗證通過
            jest.spyOn(app.uiController, 'validateBacktestParams').mockReturnValue({
                isValid: true,
                errors: []
            });

            const showErrorSpy = jest.spyOn(app.uiController, 'showError');

            await expect(app.runBacktest(params)).rejects.toThrow('Strategy not found');
            expect(showErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Strategy not found'));
        });

        test('應該處理網路錯誤', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const params = {
                stockNo: '2330',
                marketType: 'TWSE',
                startDate: '2024-01-01',
                endDate: '2024-01-02'
            };

            await expect(app.fetchStockData(params)).rejects.toThrow('Network error');
        });
    });

    describe('資源清理', () => {
        test('應該正確清理所有資源', async () => {
            await app.initialize();
            
            const destroySpy = jest.spyOn(app.uiController, 'destroy');
            const clearAllSpy = jest.spyOn(app.appState, 'clearAll');
            
            app.destroy();
            
            expect(destroySpy).toHaveBeenCalled();
            expect(clearAllSpy).toHaveBeenCalled();
            expect(app.isInitialized).toBe(false);
        });
    });
});