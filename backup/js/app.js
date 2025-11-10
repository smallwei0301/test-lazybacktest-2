/**
 * LazyBacktest 主應用程式 - 使用分層架構
 * 整合所有分層模組，提供統一的應用程式入口點
 */

// 導入分層架構模組
const { AppState } = require('./layers/core/app-state');
const { ProxyClient } = require('./layers/api/proxy-client');
const { BacktestEngine } = require('./layers/core/backtest-engine');
const { StrategyManager } = require('./layers/core/strategy-manager');
const { UIController } = require('./layers/ui/ui-controller');
const { Indicators } = require('./layers/utils/indicators');

/**
 * LazyBacktest 主應用程式類別
 */
class LazyBacktestApp {
    constructor() {
        // 初始化分層模組
        this.appState = new AppState();
        this.proxyClient = new ProxyClient();
        this.backtestEngine = new BacktestEngine();
        this.strategyManager = new StrategyManager();
        this.uiController = new UIController();
        this.indicators = new Indicators();

        // 應用程式狀態
        this.isInitialized = false;
        this.currentBacktest = null;
        this.optimizationWorker = null;

        // 綁定事件處理器
        this.setupEventHandlers();
    }

    /**
     * 初始化應用程式
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('LazyBacktest already initialized');
            return;
        }

        try {
            console.log('Initializing LazyBacktest with layered architecture...');

            // 初始化各層級模組
            await this.initializeModules();

            // 設置模組間的整合
            this.setupModuleIntegration();

            // 載入策略插件
            await this.loadStrategies();

            // 初始化 UI
            this.setupUI();

            this.isInitialized = true;
            console.log('LazyBacktest initialized successfully');

            // 觸發初始化完成事件
            this.appState.setState('app', { 
                initialized: true, 
                timestamp: Date.now() 
            });

        } catch (error) {
            console.error('Failed to initialize LazyBacktest:', error);
            this.uiController.showError('應用程式初始化失敗: ' + error.message);
            throw error;
        }
    }

    /**
     * 初始化各層模組
     */
    async initializeModules() {
        // 設置 ProxyClient 配置
        this.proxyClient.updateConfig({
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000
        });

        // 初始化狀態管理
        await this.appState.initialize();

        // 初始化策略管理器
        await this.strategyManager.initialize();

        // 設置回測引擎配置
        this.backtestEngine.configure({
            commission: 0.001425, // 1.425‰ 手續費
            tax: 0.003,           // 0.3% 證交稅
            slippage: 0.001       // 0.1% 滑價
        });
    }

    /**
     * 設置模組間整合
     */
    setupModuleIntegration() {
        // 策略管理器與回測引擎整合
        this.strategyManager.on('strategyValidated', (strategy) => {
            console.log('Strategy validated:', strategy.name);
        });

        // 回測引擎與狀態管理整合
        this.backtestEngine.on('backtestProgress', (progress) => {
            this.appState.setState('backtest', { progress });
            this.uiController.updateProgress(progress.percentage);
        });

        this.backtestEngine.on('backtestCompleted', (result) => {
            this.appState.setState('backtest', { 
                result, 
                completedAt: Date.now() 
            });
            this.uiController.displayResults(result);
            this.uiController.hideLoading();
        });

        // API 客戶端與緩存整合
        this.proxyClient.on('dataFetched', (data) => {
            const cacheKey = this.generateCacheKey(data.params);
            this.appState.setCache(cacheKey, data.result);
        });
    }

    /**
     * 載入策略插件
     */
    async loadStrategies() {
        const strategyPlugins = [
            'ma-cross', 'bollinger', 'rsi', 'macd', 'kd', 
            'williams', 'turtle', 'atr-stop', 'volume'
        ];

        for (const pluginName of strategyPlugins) {
            try {
                const plugin = require(`./strategy-plugins/${pluginName}`);
                await this.strategyManager.registerStrategy(plugin);
                console.log(`Strategy loaded: ${pluginName}`);
            } catch (error) {
                console.warn(`Failed to load strategy ${pluginName}:`, error.message);
            }
        }
    }

    /**
     * 設置 UI 控制
     */
    setupUI() {
        // 初始化圖表
        this.uiController.initializeChart();

        // 設置日期控制
        this.uiController.initializeDates();

        // 載入主題偏好
        this.uiController.loadThemePreference();
    }

    /**
     * 設置事件處理器
     */
    setupEventHandlers() {
        // UI 事件處理
        if (typeof window !== 'undefined') {
            window.addEventListener('uiController:marketTypeChanged', (event) => {
                this.handleMarketTypeChange(event.detail);
            });

            window.addEventListener('uiController:dateChanged', (event) => {
                this.handleDateChange(event.detail);
            });

            window.addEventListener('uiController:stockChanged', (event) => {
                this.handleStockChange(event.detail);
            });
        }
    }

    /**
     * 執行回測
     */
    async runBacktest(params) {
        try {
            // 驗證參數
            const validation = this.uiController.validateBacktestParams();
            if (!validation.isValid) {
                this.uiController.showError(validation.errors.join(', '));
                return;
            }

            this.uiController.showLoading('正在獲取股票數據...');

            // 獲取股票數據
            const stockData = await this.fetchStockData(params);
            
            // 獲取策略
            const strategy = await this.strategyManager.getStrategy(params.strategyName);
            if (!strategy) {
                throw new Error(`Strategy not found: ${params.strategyName}`);
            }

            this.uiController.updateLoadingMessage('正在執行回測...');

            // 執行回測
            const result = await this.backtestEngine.runBacktest({
                stockData,
                strategy,
                startDate: params.startDate,
                endDate: params.endDate,
                initialCapital: params.initialCapital || 1000000
            });

            // 儲存結果
            this.currentBacktest = {
                params,
                result,
                timestamp: Date.now()
            };

            // 更新圖表
            this.updateChart(stockData, result);

            return result;

        } catch (error) {
            console.error('Backtest failed:', error);
            this.uiController.showError('回測失敗: ' + error.message);
            this.uiController.hideLoading();
            throw error;
        }
    }

    /**
     * 獲取股票數據
     */
    async fetchStockData(params) {
        const cacheKey = this.generateCacheKey(params);
        
        // 檢查緩存
        const cached = this.appState.getCache(cacheKey);
        if (cached && !this.isCacheExpired(cached)) {
            console.log('Using cached stock data');
            return cached.data;
        }

        // 從 API 獲取數據
        const data = await this.proxyClient.getStockData({
            stockNo: params.stockNo,
            market: params.marketType,
            startDate: params.startDate,
            endDate: params.endDate
        });

        // 緩存數據
        this.appState.setCache(cacheKey, {
            data,
            timestamp: Date.now(),
            expires: Date.now() + (60 * 60 * 1000) // 1小時後過期
        });

        return data;
    }

    /**
     * 更新圖表
     */
    updateChart(stockData, backtestResult) {
        const chartData = {
            labels: stockData.map(d => d.date),
            datasets: [
                {
                    label: '股價',
                    data: stockData.map(d => d.close),
                    borderColor: 'blue',
                    backgroundColor: 'transparent'
                },
                {
                    label: '持倉資產',
                    data: backtestResult.equity || [],
                    borderColor: 'green',
                    backgroundColor: 'transparent'
                }
            ]
        };

        this.uiController.updateChart(chartData);
    }

    /**
     * 處理市場類型變更
     */
    handleMarketTypeChange(detail) {
        console.log('Market type changed:', detail.marketType);
        this.appState.setState('ui', { marketType: detail.marketType });
    }

    /**
     * 處理日期變更
     */
    handleDateChange(detail) {
        console.log('Date range changed:', detail);
        this.appState.setState('ui', { 
            startDate: detail.startDate, 
            endDate: detail.endDate 
        });
    }

    /**
     * 處理股票代號變更
     */
    handleStockChange(detail) {
        console.log('Stock changed:', detail.stockNo);
        this.appState.setState('ui', { stockNo: detail.stockNo });
    }

    /**
     * 生成緩存鍵
     */
    generateCacheKey(params) {
        return `${params.marketType}_${params.stockNo}_${params.startDate}_${params.endDate}`;
    }

    /**
     * 檢查緩存是否過期
     */
    isCacheExpired(cached) {
        return cached.expires && Date.now() > cached.expires;
    }

    /**
     * 獲取可用策略列表
     */
    getAvailableStrategies() {
        return this.strategyManager.getRegisteredStrategies();
    }

    /**
     * 獲取應用程式狀態
     */
    getAppState() {
        return {
            initialized: this.isInitialized,
            currentBacktest: this.currentBacktest,
            availableStrategies: this.getAvailableStrategies(),
            cache: this.appState.getAllCache()
        };
    }

    /**
     * 清理資源
     */
    destroy() {
        console.log('Destroying LazyBacktest application...');

        if (this.optimizationWorker) {
            this.optimizationWorker.terminate();
        }

        this.uiController.destroy();
        this.appState.clearAll();
        this.isInitialized = false;
    }
}

// 全局應用程式實例
let lazyBacktestApp = null;

/**
 * 初始化 LazyBacktest 應用程式
 */
async function initializeLazyBacktest() {
    if (lazyBacktestApp) {
        console.warn('LazyBacktest already initialized');
        return lazyBacktestApp;
    }

    try {
        lazyBacktestApp = new LazyBacktestApp();
        await lazyBacktestApp.initialize();
        
        // 將應用程式實例暴露到全局
        if (typeof window !== 'undefined') {
            window.lazyBacktestApp = lazyBacktestApp;
        }

        return lazyBacktestApp;
    } catch (error) {
        console.error('Failed to initialize LazyBacktest:', error);
        throw error;
    }
}

// 自動初始化 (如果在瀏覽器環境中)
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLazyBacktest);
} else if (typeof window !== 'undefined') {
    // DOM 已經載入完成
    initializeLazyBacktest().catch(console.error);
}

// 導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LazyBacktestApp, initializeLazyBacktest };
} else if (typeof window !== 'undefined') {
    window.LazyBacktestApp = LazyBacktestApp;
    window.initializeLazyBacktest = initializeLazyBacktest;
}