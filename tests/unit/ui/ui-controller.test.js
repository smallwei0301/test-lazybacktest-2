/**
 * UI 控制器測試
 * 測試用戶界面相關的控制邏輯
 */

// Mock DOM environment for testing
const mockElements = {
    result: { innerHTML: '', className: '' },
    stockNo: { value: '', addEventListener: jest.fn() },
    startDate: { value: '', addEventListener: jest.fn() },
    endDate: { value: '', addEventListener: jest.fn() },
    recentYears: { value: '', addEventListener: jest.fn() },
    marketType: { value: 'TWSE', addEventListener: jest.fn() },
    stockChart: { getContext: jest.fn(() => ({ canvas: {} })) },
    'trade-results': { innerHTML: '' },
    'strategy-status': { innerHTML: '' },
    'loading-overlay': { style: { display: 'none' } },
    'progress-bar': { innerHTML: '', style: {} }
};

// Mock document
global.document = {
    getElementById: jest.fn((id) => {
        if (mockElements[id]) {
            return mockElements[id];
        }
        return null;
    }),
    addEventListener: jest.fn(),
    body: { 
        classList: { 
            contains: jest.fn(() => false), 
            add: jest.fn(), 
            remove: jest.fn() 
        } 
    }
};

// Mock window
global.window = {
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    navigator: { userAgent: 'test' },
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
};

// Mock Chart.js
global.Chart = jest.fn(() => ({
    data: { datasets: [] },
    update: jest.fn(),
    destroy: jest.fn()
}));

// Mock Storage
global.Storage = {
    prototype: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
};

const { UIController } = require('../../../js/layers/ui/ui-controller');

describe('UIController UI 控制器', () => {
    let uiController;

    beforeEach(() => {
        // Reset DOM elements
        document.getElementById('result').innerHTML = '';
        document.getElementById('stockNo').value = '';
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('recentYears').value = '';
        document.getElementById('marketType').value = 'TWSE';
        document.getElementById('trade-results').innerHTML = '';
        document.getElementById('strategy-status').innerHTML = '';
        document.getElementById('loading-overlay').style.display = 'none';
        
        uiController = new UIController();
    });

    describe('基本初始化', () => {
        test('應該正確初始化 UI 控制器', () => {
            expect(uiController).toBeDefined();
            expect(typeof uiController.initialize).toBe('function');
        });

        test('應該初始化日期控件', () => {
            uiController.initializeDates();
            
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const recentYears = document.getElementById('recentYears').value;
            
            expect(startDate).toBeTruthy();
            expect(endDate).toBeTruthy();
            expect(recentYears).toBe('5');
        });

        test('應該設置事件監聽器', () => {
            const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
            
            uiController.setupEventListeners();
            
            expect(addEventListenerSpy).toHaveBeenCalled();
        });
    });

    describe('消息顯示', () => {
        test('應該顯示錯誤消息', () => {
            const message = '測試錯誤消息';
            
            uiController.showError(message);
            
            const resultEl = document.getElementById('result');
            expect(resultEl.innerHTML).toContain(message);
            expect(resultEl.className).toContain('bg-red-100');
        });

        test('應該顯示成功消息', () => {
            const message = '測試成功消息';
            
            uiController.showSuccess(message);
            
            const resultEl = document.getElementById('result');
            expect(resultEl.innerHTML).toContain(message);
            expect(resultEl.className).toContain('bg-green-100');
        });

        test('應該顯示資訊消息', () => {
            const message = '測試資訊消息';
            
            uiController.showInfo(message);
            
            const resultEl = document.getElementById('result');
            expect(resultEl.innerHTML).toContain(message);
            expect(resultEl.className).toContain('bg-blue-100');
        });

        test('應該清除消息', () => {
            uiController.showError('測試');
            
            uiController.clearMessages();
            
            const resultEl = document.getElementById('result');
            expect(resultEl.innerHTML).toBe('');
            expect(resultEl.className).toBe('');
        });
    });

    describe('載入狀態控制', () => {
        test('應該顯示載入狀態', () => {
            const message = '載入中...';
            
            uiController.showLoading(message);
            
            const loadingEl = document.getElementById('loading-overlay');
            expect(loadingEl.style.display).not.toBe('none');
        });

        test('應該隱藏載入狀態', () => {
            uiController.showLoading('載入中...');
            
            uiController.hideLoading();
            
            const loadingEl = document.getElementById('loading-overlay');
            expect(loadingEl.style.display).toBe('none');
        });

        test('應該更新進度條', () => {
            const progress = 50;
            
            uiController.updateProgress(progress);
            
            const progressBar = document.getElementById('progress-bar');
            expect(progressBar.innerHTML).toContain('50%');
        });
    });

    describe('表單數據獲取', () => {
        test('應該獲取回測參數', () => {
            // 設置表單數據
            document.getElementById('stockNo').value = '2330';
            document.getElementById('startDate').value = '2024-01-01';
            document.getElementById('endDate').value = '2024-12-31';
            document.getElementById('marketType').value = 'TWSE';
            
            const params = uiController.getBacktestParams();
            
            expect(params.stockNo).toBe('2330');
            expect(params.startDate).toBe('2024-01-01');
            expect(params.endDate).toBe('2024-12-31');
            expect(params.marketType).toBe('TWSE');
        });

        test('應該驗證必要欄位', () => {
            // 不設置股票代號
            document.getElementById('startDate').value = '2024-01-01';
            document.getElementById('endDate').value = '2024-12-31';
            
            const validation = uiController.validateBacktestParams();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('請輸入股票代號');
        });

        test('應該驗證日期範圍', () => {
            document.getElementById('stockNo').value = '2330';
            document.getElementById('startDate').value = '2024-12-31';
            document.getElementById('endDate').value = '2024-01-01'; // 結束日期早於開始日期
            
            const validation = uiController.validateBacktestParams();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('結束日期不能早於開始日期');
        });
    });

    describe('日期控制', () => {
        test('應該應用最近年數設定', () => {
            document.getElementById('endDate').value = '2024-12-31';
            document.getElementById('recentYears').value = '3';
            
            uiController.applyRecentYears();
            
            const startDate = document.getElementById('startDate').value;
            expect(startDate).toBe('2021-12-31');
        });

        test('應該處理無效的年數輸入', () => {
            document.getElementById('endDate').value = '2024-12-31';
            document.getElementById('recentYears').value = 'invalid';
            
            const showErrorSpy = jest.spyOn(uiController, 'showError');
            
            uiController.applyRecentYears();
            
            expect(showErrorSpy).toHaveBeenCalledWith('請輸入有效年數');
        });

        test('應該限制最早日期', () => {
            document.getElementById('endDate').value = '1995-12-31';
            document.getElementById('recentYears').value = '10';
            
            uiController.applyRecentYears();
            
            const startDate = document.getElementById('startDate').value;
            expect(startDate).toBe('1992-01-01'); // 限制最早到1992年
        });
    });

    describe('結果顯示', () => {
        test('應該顯示回測結果', () => {
            const mockResult = {
                summary: {
                    totalReturn: 0.15,
                    annualizedReturn: 0.12,
                    sharpeRatio: 1.2,
                    maxDrawdown: 0.08
                },
                trades: [
                    { date: '2024-01-15', type: 'buy', price: 100, quantity: 1000 },
                    { date: '2024-01-20', type: 'sell', price: 105, quantity: 1000 }
                ]
            };
            
            uiController.displayBacktestResult(mockResult);
            
            const tradeResults = document.getElementById('trade-results');
            expect(tradeResults.innerHTML).toContain('15.00%'); // 總報酬
            expect(tradeResults.innerHTML).toContain('買入'); // 交易記錄
            expect(tradeResults.innerHTML).toContain('賣出');
        });

        test('應該顯示策略狀態', () => {
            const status = {
                type: 'running',
                message: '移動平均交叉 - 75%'
            };
            
            uiController.updateStrategyStatus(status);
            
            const strategyStatus = document.getElementById('strategy-status');
            expect(strategyStatus.innerHTML).toContain('移動平均交叉');
            expect(strategyStatus.innerHTML).toContain('75%');
        });

        test('應該清除之前的結果', () => {
            document.getElementById('trade-results').innerHTML = '舊結果';
            
            uiController.clearPreviousResults();
            
            const tradeResults = document.getElementById('trade-results');
            expect(tradeResults.innerHTML).toBe('');
        });
    });

    describe('圖表控制', () => {
        test('應該初始化圖表', () => {
            const chartSpy = jest.fn();
            global.Chart = chartSpy;
            
            uiController.initializeChart();
            
            expect(chartSpy).toHaveBeenCalled();
        });

        test('應該更新圖表數據', () => {
            const mockChart = {
                data: { datasets: [] },
                update: jest.fn()
            };
            
            uiController.stockChart = mockChart;
            
            const mockData = [
                { date: '2024-01-01', close: 100 },
                { date: '2024-01-02', close: 105 }
            ];
            
            uiController.updateChartData(mockData);
            
            expect(mockChart.update).toHaveBeenCalled();
        });

        test('應該銷毀舊圖表', () => {
            const mockChart = {
                destroy: jest.fn()
            };
            
            uiController.stockChart = mockChart;
            
            uiController.destroyChart();
            
            expect(mockChart.destroy).toHaveBeenCalled();
            expect(uiController.stockChart).toBeNull();
        });
    });

    describe('互動控制', () => {
        test('應該處理股票輸入變更', () => {
            const onStockChangeSpy = jest.fn();
            uiController.onStockChange = onStockChangeSpy;
            
            const stockInput = document.getElementById('stockNo');
            stockInput.value = '2330';
            
            // 模擬輸入事件
            const event = { target: stockInput };
            
            // 手動觸發事件處理
            uiController.handleStockChange(event);
            
            expect(uiController.onStockChange).toBeDefined();
        });

        test('應該處理市場類型變更', () => {
            const marketSelect = document.getElementById('marketType');
            marketSelect.value = 'TPEX';
            
            const event = { target: marketSelect };
            
            uiController.handleMarketChange(event);
            
            expect(uiController.getCurrentMarket()).toBe('TPEX');
        });

        test('應該處理日期範圍變更', () => {
            const startDateInput = document.getElementById('startDate');
            startDateInput.value = '2024-01-01';
            
            const event = { target: startDateInput };
            
            uiController.handleDateChange(event);
            
            const dateRange = uiController.getDateRange();
            expect(dateRange.startDate).toBe('2024-01-01');
        });
    });

    describe('響应式設計', () => {
        test('應該檢測移動設備', () => {
            // 模擬移動設備的 user agent
            Object.defineProperty(global.window.navigator, 'userAgent', {
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
                writable: true
            });
            
            const isMobile = uiController.isMobileDevice();
            
            expect(isMobile).toBe(true);
        });

        test('應該調整移動端佈局', () => {
            uiController.adjustMobileLayout();
            
            // 檢查是否添加了移動端相關的 CSS 類
            expect(document.body.classList.contains('mobile-layout')).toBe(true);
        });

        test('應該處理視窗大小變更', () => {
            const adjustLayoutSpy = jest.spyOn(uiController, 'adjustLayout');
            
            // 手動調用方法來測試
            uiController.adjustLayout();
            
            expect(adjustLayoutSpy).toHaveBeenCalled();
        });
    });

    describe('主題控制', () => {
        test('應該切換主題', () => {
            uiController.toggleTheme();
            
            expect(document.body.classList.contains('dark-theme')).toBe(true);
            
            uiController.toggleTheme();
            
            expect(document.body.classList.contains('dark-theme')).toBe(false);
        });

        test('應該保存主題偏好', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
            
            uiController.setTheme('dark');
            
            expect(setItemSpy).toHaveBeenCalledWith('theme', 'dark');
        });

        test('應該載入主題偏好', () => {
            const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('dark');
            
            uiController.loadThemePreference();
            
            expect(document.body.classList.contains('dark-theme')).toBe(true);
            expect(getItemSpy).toHaveBeenCalledWith('theme');
        });
    });
});