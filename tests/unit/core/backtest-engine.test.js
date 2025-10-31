/**
 * 回測引擎核心邏輯測試
 * 測試純回測計算邏輯，不涉及 UI 和資料獲取
 */

const { BacktestEngine } = require('../../../js/layers/core/backtest-engine');

describe('BacktestEngine 回測引擎核心', () => {
    let backtestEngine;
    
    // 模擬股價資料
    const mockStockData = [
        { date: '2024-01-01', open: 100, high: 105, low: 95, close: 102, volume: 1000 },
        { date: '2024-01-02', open: 102, high: 108, low: 101, close: 106, volume: 1200 },
        { date: '2024-01-03', open: 106, high: 110, low: 104, close: 109, volume: 1100 },
        { date: '2024-01-04', open: 109, high: 112, low: 107, close: 111, volume: 1300 },
        { date: '2024-01-05', open: 111, high: 115, low: 110, close: 114, volume: 1400 },
    ];

    // 簡單策略：價格上漲時買入，下跌時賣出
    const mockStrategy = {
        name: '簡單趨勢策略',
        calculateSignal: (data, index) => {
            if (index === 0) return 0; // 第一天無信號
            const current = data[index];
            const previous = data[index - 1];
            
            if (current.close > previous.close) return 1; // 買入信號
            if (current.close < previous.close) return -1; // 賣出信號
            return 0; // 無操作
        }
    };

    // 基本配置
    const mockConfig = {
        initialCapital: 100000,
        transactionCost: 0.001425, // 0.1425%
        slippage: 0.001, // 0.1%
        maxPositionSize: 1.0, // 100%
    };

    beforeEach(() => {
        backtestEngine = new BacktestEngine(mockConfig);
    });

    describe('初始化和配置', () => {
        test('應該正確初始化回測引擎', () => {
            expect(backtestEngine).toBeDefined();
            expect(backtestEngine.getConfig()).toEqual(mockConfig);
        });

        test('應該可以更新配置', () => {
            const newConfig = { initialCapital: 200000, transactionCost: 0.002 };
            backtestEngine.updateConfig(newConfig);
            
            const updatedConfig = backtestEngine.getConfig();
            expect(updatedConfig.initialCapital).toBe(200000);
            expect(updatedConfig.transactionCost).toBe(0.002);
            expect(updatedConfig.slippage).toBe(0.001); // 保持原值
        });
    });

    describe('回測執行', () => {
        test('應該執行基本回測並返回結果', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            
            expect(result).toBeDefined();
            expect(result.trades).toBeDefined();
            expect(result.performance).toBeDefined();
            expect(result.portfolio).toBeDefined();
            expect(Array.isArray(result.trades)).toBe(true);
        });

        test('應該正確計算交易信號', () => {
            const signals = backtestEngine.calculateSignals(mockStockData, mockStrategy);
            
            expect(signals).toHaveLength(mockStockData.length);
            expect(signals[0]).toBe(0); // 第一天無信號
            expect(signals[1]).toBe(1); // 102 > 100，買入信號
            expect(signals[2]).toBe(1); // 106 > 102，買入信號
        });

        test('應該處理空資料', () => {
            expect(() => {
                backtestEngine.runBacktest([], mockStrategy);
            }).toThrow('股價資料不能為空');
        });

        test('應該處理無效策略', () => {
            expect(() => {
                backtestEngine.runBacktest(mockStockData, null);
            }).toThrow('策略不能為空');
        });
    });

    describe('交易執行', () => {
        test('應該正確執行買入交易', () => {
            const tradeResult = backtestEngine.executeTrade({
                type: 'buy',
                price: 100,
                quantity: 1000,
                date: '2024-01-01'
            });

            expect(tradeResult.success).toBe(true);
            expect(tradeResult.executedPrice).toBeGreaterThan(100); // 考慮滑價
            expect(tradeResult.totalCost).toBeGreaterThan(0); // 有交易成本
            expect(tradeResult.quantity).toBeGreaterThan(0); // 有實際買入數量
            
            // 驗證交易後的投資組合狀態
            const portfolio = backtestEngine.getPortfolio();
            expect(portfolio.cash).toBeLessThan(mockConfig.initialCapital); // 現金減少
            expect(portfolio.positions).toBeGreaterThan(0); // 持有股份
        });

        test('應該正確執行賣出交易', () => {
            // 先買入
            backtestEngine.executeTrade({
                type: 'buy',
                price: 100,
                quantity: 1000,
                date: '2024-01-01'
            });

            // 再賣出
            const sellResult = backtestEngine.executeTrade({
                type: 'sell',
                price: 110,
                quantity: 1000,
                date: '2024-01-02'
            });

            expect(sellResult.success).toBe(true);
            expect(sellResult.executedPrice).toBeLessThan(110); // 考慮滑價
        });

        test('應該處理資金不足情況', () => {
            const tradeResult = backtestEngine.executeTrade({
                type: 'buy',
                price: 200000, // 極高價格，超過總資金
                quantity: 1, // 即使只買1股也買不起
                date: '2024-01-01'
            });

            expect(tradeResult.success).toBe(false);
            expect(tradeResult.error).toContain('資金不足');
        });
    });

    describe('績效計算', () => {
        test('應該計算基本績效指標', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            const performance = result.performance;

            expect(performance.totalReturn).toBeDefined();
            expect(performance.annualizedReturn).toBeDefined();
            expect(performance.sharpeRatio).toBeDefined();
            expect(performance.maxDrawdown).toBeDefined();
            expect(performance.winRate).toBeDefined();
        });

        test('應該計算正確的總報酬', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            
            const initialValue = mockConfig.initialCapital;
            const finalValue = result.portfolio.finalValue;
            const expectedReturn = (finalValue - initialValue) / initialValue;
            
            expect(result.performance.totalReturn).toBeCloseTo(expectedReturn, 4);
        });

        test('應該計算交易統計', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            const stats = result.performance.tradeStats;

            expect(stats.totalTrades).toBeDefined();
            expect(stats.winningTrades).toBeDefined();
            expect(stats.losingTrades).toBeDefined();
            expect(stats.averageWin).toBeDefined();
            expect(stats.averageLoss).toBeDefined();
        });
    });

    describe('投資組合管理', () => {
        test('應該正確追蹤投資組合狀態', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            const portfolio = result.portfolio;

            expect(portfolio.initialValue).toBe(mockConfig.initialCapital);
            expect(portfolio.finalValue).toBeDefined();
            expect(portfolio.cash).toBeDefined();
            expect(portfolio.positions).toBeDefined();
        });

        test('應該正確計算持倉價值', () => {
            const buyResult = backtestEngine.executeTrade({
                type: 'buy',
                price: 100,
                quantity: 1000,
                date: '2024-01-01'
            });

            // 確保買入成功
            expect(buyResult.success).toBe(true);
            
            // 計算股價上漲後的投資組合價值
            const portfolioValue = backtestEngine.calculatePortfolioValue(110);
            expect(portfolioValue).toBeGreaterThan(mockConfig.initialCapital);
            
            // 檢查投資組合狀態
            const portfolio = backtestEngine.getPortfolio();
            expect(portfolio.positions).toBeGreaterThan(0);
        });

        test('應該追蹤投資組合歷史', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            
            expect(result.portfolioHistory).toBeDefined();
            expect(Array.isArray(result.portfolioHistory)).toBe(true);
            expect(result.portfolioHistory.length).toBe(mockStockData.length);
        });
    });

    describe('風險管理', () => {
        test('應該限制最大持倉比例', () => {
            const largeQuantityTrade = backtestEngine.executeTrade({
                type: 'buy',
                price: 50, // 低價格以測試數量限制
                quantity: 10000, // 大數量
                date: '2024-01-01'
            });

            // 應該被限制在最大持倉比例內
            const portfolio = backtestEngine.getPortfolio();
            const positionValue = portfolio.positions * 50;
            const totalValue = portfolio.cash + positionValue;
            const positionRatio = positionValue / totalValue;
            
            expect(positionRatio).toBeLessThanOrEqual(mockConfig.maxPositionSize);
        });

        test('應該計算最大回撤', () => {
            const result = backtestEngine.runBacktest(mockStockData, mockStrategy);
            
            expect(result.performance.maxDrawdown).toBeDefined();
            expect(result.performance.maxDrawdown).toBeGreaterThanOrEqual(0);
            expect(result.performance.maxDrawdown).toBeLessThanOrEqual(1);
        });
    });

    describe('邊界情況處理', () => {
        test('應該處理策略返回無效信號', () => {
            const invalidStrategy = {
                name: '無效策略',
                calculateSignal: () => 'invalid' // 返回無效信號
            };

            expect(() => {
                backtestEngine.runBacktest(mockStockData, invalidStrategy);
            }).not.toThrow(); // 應該優雅處理，不拋出錯誤
        });

        test('應該處理資料中的缺失值', () => {
            const dataWithMissing = [...mockStockData];
            dataWithMissing[2] = { ...dataWithMissing[2], close: null };

            expect(() => {
                backtestEngine.runBacktest(dataWithMissing, mockStrategy);
            }).not.toThrow();
        });

        test('應該處理極小的初始資金', () => {
            const smallCapitalEngine = new BacktestEngine({ 
                ...mockConfig, 
                initialCapital: 1 
            });

            const result = smallCapitalEngine.runBacktest(mockStockData, mockStrategy);
            expect(result.performance.totalReturn).toBeDefined();
        });
    });
});