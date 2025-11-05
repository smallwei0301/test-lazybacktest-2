/**
 * 回測引擎核心邏輯
 * 純業務邏輯，不涉及 UI 和資料獲取
 */

class BacktestEngine {
    constructor(config = {}) {
        this.config = {
            initialCapital: 100000,
            transactionCost: 0.001425, // 0.1425% 手續費
            slippage: 0.001, // 0.1% 滑價
            maxPositionSize: 1.0, // 100% 最大持倉比例
            ...config
        };
        
        this.reset();
    }

    /**
     * 重置引擎狀態
     */
    reset() {
        this.portfolio = {
            cash: this.config.initialCapital,
            positions: 0, // 持有股數
            initialValue: this.config.initialCapital,
            finalValue: this.config.initialCapital
        };
        
        this.trades = [];
        this.portfolioHistory = [];
        this.performance = null;
    }

    /**
     * 獲取當前配置
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * 執行回測
     */
    runBacktest(stockData, strategy) {
        if (!stockData || !Array.isArray(stockData) || stockData.length === 0) {
            throw new Error('股價資料不能為空');
        }
        
        if (!strategy || typeof strategy.calculateSignal !== 'function') {
            throw new Error('策略不能為空');
        }

        this.reset();
        
        // 計算交易信號
        const signals = this.calculateSignals(stockData, strategy);
        
        // 執行交易
        for (let i = 0; i < stockData.length; i++) {
            const data = stockData[i];
            const signal = signals[i];
            
            // 處理交易信號
            if (signal === 1 && this.portfolio.positions === 0) {
                // 買入信號且目前無持倉
                this.executeBuyOrder(data);
            } else if (signal === -1 && this.portfolio.positions > 0) {
                // 賣出信號且目前有持倉
                this.executeSellOrder(data);
            }
            
            // 記錄投資組合狀態
            const portfolioValue = this.calculatePortfolioValue(data.close);
            this.portfolioHistory.push({
                date: data.date,
                value: portfolioValue,
                cash: this.portfolio.cash,
                positions: this.portfolio.positions,
                price: data.close
            });
        }
        
        // 計算最終價值
        const lastPrice = stockData[stockData.length - 1].close;
        this.portfolio.finalValue = this.calculatePortfolioValue(lastPrice);
        
        // 計算績效指標
        this.performance = this.calculatePerformance();
        
        return {
            trades: this.trades,
            performance: this.performance,
            portfolio: this.portfolio,
            portfolioHistory: this.portfolioHistory
        };
    }

    /**
     * 計算交易信號
     */
    calculateSignals(stockData, strategy) {
        const signals = [];
        
        for (let i = 0; i < stockData.length; i++) {
            try {
                const signal = strategy.calculateSignal(stockData, i);
                // 驗證信號是否有效
                if (typeof signal === 'number' && (signal === -1 || signal === 0 || signal === 1)) {
                    signals.push(signal);
                } else {
                    signals.push(0); // 無效信號當作無操作
                }
            } catch (error) {
                console.warn(`策略計算錯誤於第 ${i} 天:`, error);
                signals.push(0); // 錯誤時無操作
            }
        }
        
        return signals;
    }

    /**
     * 執行交易（通用介面）
     */
    executeTrade(tradeOrder) {
        const { type, price, quantity, date } = tradeOrder;
        
        if (type === 'buy') {
            return this.executeBuyTrade(price, quantity, date);
        } else if (type === 'sell') {
            return this.executeSellTrade(price, quantity, date);
        }
        
        return { success: false, error: '無效的交易類型' };
    }

    /**
     * 執行買入交易
     */
    executeBuyTrade(price, quantity, date) {
        const executedPrice = price * (1 + this.config.slippage); // 考慮滑價
        let adjustedQuantity = quantity;
        
        // 檢查最大持倉限制 - 考慮交易成本後的實際可用資金
        const availableCash = this.portfolio.cash;
        const costPerShare = executedPrice * (1 + this.config.transactionCost);
        const maxAffordableQuantity = Math.floor(availableCash / costPerShare);
        
        // 限制數量不超過資金能負擔的範圍
        if (adjustedQuantity > maxAffordableQuantity) {
            adjustedQuantity = maxAffordableQuantity;
        }
        
        if (adjustedQuantity <= 0) {
            return { success: false, error: '資金不足' };
        }
        
        const actualTotalCost = executedPrice * adjustedQuantity * (1 + this.config.transactionCost);
        
        // 最終檢查（應該不會失敗，但以防萬一）
        if (actualTotalCost > this.portfolio.cash) {
            return { success: false, error: '資金不足' };
        }
        
        this.portfolio.cash -= actualTotalCost;
        this.portfolio.positions += adjustedQuantity;
        
        const trade = {
            type: 'buy',
            date,
            price: executedPrice,
            quantity: adjustedQuantity,
            totalCost: actualTotalCost,
            commission: actualTotalCost * this.config.transactionCost
        };
        
        this.trades.push(trade);
        
        return { 
            success: true, 
            executedPrice, 
            totalCost: actualTotalCost,
            quantity: adjustedQuantity 
        };
    }

    /**
     * 執行賣出交易
     */
    executeSellTrade(price, quantity, date) {
        if (this.portfolio.positions <= 0) {
            return { success: false, error: '無持倉可賣出' };
        }
        
        // 限制賣出數量不超過持倉
        quantity = Math.min(quantity, this.portfolio.positions);
        
        const executedPrice = price * (1 - this.config.slippage); // 考慮滑價
        const grossProceeds = executedPrice * quantity;
        const commission = grossProceeds * this.config.transactionCost;
        const netProceeds = grossProceeds - commission;
        
        this.portfolio.cash += netProceeds;
        this.portfolio.positions -= quantity;
        
        const trade = {
            type: 'sell',
            date,
            price: executedPrice,
            quantity,
            grossProceeds,
            netProceeds,
            commission
        };
        
        this.trades.push(trade);
        
        return { 
            success: true, 
            executedPrice, 
            netProceeds,
            quantity 
        };
    }

    /**
     * 執行買入訂單（簡化版，用於回測流程）
     */
    executeBuyOrder(data) {
        const availableCash = this.portfolio.cash;
        const price = data.close;
        const maxQuantity = Math.floor(availableCash / (price * (1 + this.config.slippage + this.config.transactionCost)));
        
        if (maxQuantity > 0) {
            this.executeBuyTrade(price, maxQuantity, data.date);
        }
    }

    /**
     * 執行賣出訂單（簡化版，用於回測流程）
     */
    executeSellOrder(data) {
        if (this.portfolio.positions > 0) {
            this.executeSellTrade(data.close, this.portfolio.positions, data.date);
        }
    }

    /**
     * 計算投資組合價值
     */
    calculatePortfolioValue(currentPrice) {
        if (!currentPrice || currentPrice <= 0) {
            return this.portfolio.cash;
        }
        
        const positionValue = this.portfolio.positions * currentPrice;
        return this.portfolio.cash + positionValue;
    }

    /**
     * 獲取投資組合狀態
     */
    getPortfolio() {
        return { ...this.portfolio };
    }

    /**
     * 計算績效指標
     */
    calculatePerformance() {
        const initialValue = this.config.initialCapital;
        const finalValue = this.portfolio.finalValue;
        
        // 基本報酬率
        const totalReturn = (finalValue - initialValue) / initialValue;
        
        // 年化報酬率（假設資料期間為1年）
        const annualizedReturn = totalReturn;
        
        // 交易統計
        const tradeStats = this.calculateTradeStats();
        
        // 最大回撤
        const maxDrawdown = this.calculateMaxDrawdown();
        
        // 夏普比率（簡化計算）
        const sharpeRatio = this.calculateSharpeRatio();
        
        return {
            totalReturn,
            annualizedReturn,
            sharpeRatio,
            maxDrawdown,
            winRate: tradeStats.winRate,
            tradeStats
        };
    }

    /**
     * 計算交易統計
     */
    calculateTradeStats() {
        const buyTrades = this.trades.filter(t => t.type === 'buy');
        const sellTrades = this.trades.filter(t => t.type === 'sell');
        
        const totalTrades = Math.min(buyTrades.length, sellTrades.length); // 配對交易數
        let winningTrades = 0;
        let losingTrades = 0;
        let totalWin = 0;
        let totalLoss = 0;
        
        for (let i = 0; i < totalTrades; i++) {
            const buyTrade = buyTrades[i];
            const sellTrade = sellTrades[i];
            
            const profit = sellTrade.netProceeds - buyTrade.totalCost;
            
            if (profit > 0) {
                winningTrades++;
                totalWin += profit;
            } else {
                losingTrades++;
                totalLoss += Math.abs(profit);
            }
        }
        
        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate: totalTrades > 0 ? winningTrades / totalTrades : 0,
            averageWin: winningTrades > 0 ? totalWin / winningTrades : 0,
            averageLoss: losingTrades > 0 ? totalLoss / losingTrades : 0
        };
    }

    /**
     * 計算最大回撤
     */
    calculateMaxDrawdown() {
        if (this.portfolioHistory.length === 0) return 0;
        
        let maxDrawdown = 0;
        let peak = this.portfolioHistory[0].value;
        
        for (const point of this.portfolioHistory) {
            if (point.value > peak) {
                peak = point.value;
            }
            
            const drawdown = (peak - point.value) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        
        return maxDrawdown;
    }

    /**
     * 計算夏普比率（簡化版）
     */
    calculateSharpeRatio() {
        if (this.portfolioHistory.length < 2) return 0;
        
        // 計算日報酬率
        const dailyReturns = [];
        for (let i = 1; i < this.portfolioHistory.length; i++) {
            const current = this.portfolioHistory[i].value;
            const previous = this.portfolioHistory[i - 1].value;
            const dailyReturn = (current - previous) / previous;
            dailyReturns.push(dailyReturn);
        }
        
        if (dailyReturns.length === 0) return 0;
        
        // 計算平均報酬率和標準差
        const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
        const stdDev = Math.sqrt(variance);
        
        // 假設無風險利率為0，簡化計算
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
}

// 使用 CommonJS 導出（適用於 Node.js 測試環境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BacktestEngine };
}

// 使用 ES6 導出（適用於瀏覽器環境）
if (typeof window !== 'undefined') {
    window.BacktestEngine = BacktestEngine;
}