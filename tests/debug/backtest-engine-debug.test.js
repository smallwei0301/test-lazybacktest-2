/**
 * 回測引擎核心邏輯測試 - 調試版本
 * 測試純回測計算邏輯，不涉及 UI 和資料獲取
 */

const { BacktestEngine } = require('../../js/layers/core/backtest-engine');

describe('BacktestEngine 回測引擎核心 - 調試', () => {
    let backtestEngine;
    
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

    describe('交易執行調試', () => {
        test('應該正確執行買入交易 - 調試', () => {
            console.log('初始投資組合狀態:', backtestEngine.getPortfolio());
            
            const tradeResult = backtestEngine.executeTrade({
                type: 'buy',
                price: 100,
                quantity: 1000,
                date: '2024-01-01'
            });

            console.log('交易結果:', tradeResult);
            console.log('交易後投資組合狀態:', backtestEngine.getPortfolio());
            
            // 計算預期值
            const expectedPrice = 100 * (1 + 0.001); // 100.1
            const expectedCost = expectedPrice * 1000 * (1 + 0.001425); // 考慮手續費
            console.log('預期執行價格:', expectedPrice);
            console.log('預期總成本:', expectedCost);
            console.log('可用資金:', mockConfig.initialCapital);
            
            expect(tradeResult.success).toBe(true);
        });

        test('應該處理資金不足情況 - 調試', () => {
            console.log('初始投資組合狀態:', backtestEngine.getPortfolio());
            
            // 設置一個極高的價格，讓單股價格都超過總資金
            const tradeResult = backtestEngine.executeTrade({
                type: 'buy',
                price: 200000, // 極高價格，超過總資金
                quantity: 1, // 即使只買1股也買不起
                date: '2024-01-01'
            });

            console.log('高價股交易結果:', tradeResult);
            
            // 計算預期值
            const expectedPrice = 200000 * (1 + 0.001); // 200200
            const costPerShare = expectedPrice * (1 + 0.001425); // ~200485
            console.log('預期執行價格:', expectedPrice);
            console.log('每股成本:', costPerShare);
            console.log('可用資金:', mockConfig.initialCapital);
            console.log('是否買得起1股:', costPerShare <= mockConfig.initialCapital);
            
            expect(tradeResult.success).toBe(false);
        });
    });
});