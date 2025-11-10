/**
 * 策略管理器
 * 統一策略載入、驗證和執行邏輯
 */

class StrategyManager {
    constructor() {
        this.strategies = new Map(); // 儲存已註冊的策略
        this.combos = new Map(); // 儲存策略組合
        this.caches = new Map(); // 儲存策略快取
        this.loaders = new Map(); // 儲存策略載入器
        this.eventListeners = new Map(); // 事件監聽器
    }

    /**
     * 註冊策略
     */
    registerStrategy(strategy) {
        try {
            // 驗證必要欄位
            const validation = this.validateStrategyDefinition(strategy);
            if (!validation.isValid) {
                return { success: false, errors: validation.errors };
            }

            // 檢查重複註冊
            if (this.strategies.has(strategy.id)) {
                return { success: false, errors: [`策略 ID ${strategy.id} 已存在`] };
            }

            // 註冊策略
            this.strategies.set(strategy.id, { ...strategy });

            // 觸發事件
            this.emit('strategy:register', {
                strategyId: strategy.id,
                strategy: this.strategies.get(strategy.id)
            });

            return { success: true };
        } catch (error) {
            return { success: false, errors: [error.message] };
        }
    }

    /**
     * 驗證策略定義
     */
    validateStrategyDefinition(strategy) {
        const errors = [];

        if (!strategy || typeof strategy !== 'object') {
            errors.push('策略必須是物件');
            return { isValid: false, errors };
        }

        if (!strategy.id || typeof strategy.id !== 'string') {
            errors.push('策略缺少必要的 id 欄位');
        }

        if (!strategy.label || typeof strategy.label !== 'string') {
            errors.push('策略缺少必要的 label 欄位');
        }

        if (!strategy.calculate || typeof strategy.calculate !== 'function') {
            errors.push('策略缺少必要的 calculate 函數');
        }

        if (strategy.paramsSchema && typeof strategy.paramsSchema !== 'object') {
            errors.push('策略的 paramsSchema 必須是物件');
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * 檢查策略是否存在
     */
    hasStrategy(strategyId) {
        return this.strategies.has(strategyId);
    }

    /**
     * 列出所有策略
     */
    listStrategies() {
        return Array.from(this.strategies.values()).map(strategy => ({
            id: strategy.id,
            label: strategy.label,
            paramsSchema: strategy.paramsSchema || {}
        }));
    }

    /**
     * 取得特定策略
     */
    getStrategy(strategyId) {
        return this.strategies.get(strategyId);
    }

    /**
     * 移除策略
     */
    removeStrategy(strategyId) {
        if (!this.strategies.has(strategyId)) {
            return { success: false, errors: [`策略 ${strategyId} 不存在`] };
        }

        this.strategies.delete(strategyId);
        
        // 清理相關快取
        this.clearCache(strategyId);

        // 觸發事件
        this.emit('strategy:remove', { strategyId });

        return { success: true };
    }

    /**
     * 驗證策略參數
     */
    validateParameters(strategyId, params) {
        const strategy = this.strategies.get(strategyId);
        
        if (!strategy) {
            return { isValid: false, errors: [`策略 ${strategyId} 不存在`] };
        }

        const errors = [];
        
        if (!strategy.paramsSchema) {
            return { isValid: true, errors: [] };
        }

        // 簡化的 JSON Schema 驗證
        if (strategy.paramsSchema.type === 'object' && strategy.paramsSchema.properties) {
            for (const [key, schema] of Object.entries(strategy.paramsSchema.properties)) {
                const value = params[key];
                
                if (value !== undefined) {
                    if (schema.type === 'number' && typeof value !== 'number') {
                        errors.push(`參數 ${key} 必須是數字`);
                    } else if (schema.type === 'string' && typeof value !== 'string') {
                        errors.push(`參數 ${key} 必須是字串`);
                    } else if (schema.minimum !== undefined && value < schema.minimum) {
                        errors.push(`參數 ${key} 不能小於 ${schema.minimum}`);
                    } else if (schema.maximum !== undefined && value > schema.maximum) {
                        errors.push(`參數 ${key} 不能大於 ${schema.maximum}`);
                    }
                }
            }
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * 標準化參數（填入預設值）
     */
    normalizeParameters(strategyId, params) {
        const strategy = this.strategies.get(strategyId);
        
        if (!strategy || !strategy.paramsSchema || !strategy.paramsSchema.properties) {
            return { ...params };
        }

        const normalized = { ...params };
        
        for (const [key, schema] of Object.entries(strategy.paramsSchema.properties)) {
            if (normalized[key] === undefined && schema.default !== undefined) {
                normalized[key] = schema.default;
            }
        }

        return normalized;
    }

    /**
     * 執行策略計算
     */
    executeStrategy(strategyId, context) {
        try {
            const strategy = this.strategies.get(strategyId);
            
            if (!strategy) {
                return { success: false, error: `策略 ${strategyId} 不存在` };
            }

            // 準備執行上下文
            const executionContext = {
                ...context,
                helpers: {
                    ...context.helpers,
                    setCache: (key, value) => this.setCache(strategyId, key, value),
                    getCache: (key) => this.getCache(strategyId, key),
                    log: (message, details) => this.log(strategyId, message, details)
                }
            };

            // 執行策略
            const signals = strategy.calculate(executionContext);

            // 觸發事件
            this.emit('strategy:execute', {
                strategyId,
                context: executionContext,
                signals
            });

            // 標準化信號格式
            const normalizedSignals = {
                enter: Boolean(signals.enter),
                exit: Boolean(signals.exit),
                short: Boolean(signals.short),
                cover: Boolean(signals.cover),
                stopLossPercent: signals.stopLossPercent || null,
                takeProfitPercent: signals.takeProfitPercent || null,
                meta: signals.meta || {}
            };

            return { success: true, signals: normalizedSignals };
        } catch (error) {
            return { 
                success: false, 
                error: `策略執行錯誤: ${error.message}`,
                stack: error.stack
            };
        }
    }

    /**
     * 批次執行多個策略
     */
    executeStrategies(strategyIds, context) {
        const results = [];
        
        for (const strategyId of strategyIds) {
            const result = this.executeStrategy(strategyId, context);
            results.push({
                strategyId,
                ...result
            });
        }
        
        return results;
    }

    /**
     * 創建策略組合
     */
    createCombo(comboId, config) {
        try {
            const { strategies, combineLogic } = config;
            
            if (!Array.isArray(strategies) || strategies.length === 0) {
                return { success: false, errors: ['組合必須包含至少一個策略'] };
            }

            // 驗證所有策略都存在
            for (const strategyId of strategies) {
                if (!this.strategies.has(strategyId)) {
                    return { success: false, errors: [`策略 ${strategyId} 不存在`] };
                }
            }

            // 驗證組合邏輯
            if (!['AND', 'OR', 'MAJORITY'].includes(combineLogic)) {
                return { success: false, errors: ['無效的組合邏輯'] };
            }

            this.combos.set(comboId, { strategies, combineLogic });
            
            return { success: true };
        } catch (error) {
            return { success: false, errors: [error.message] };
        }
    }

    /**
     * 檢查組合是否存在
     */
    hasCombo(comboId) {
        return this.combos.has(comboId);
    }

    /**
     * 執行策略組合
     */
    executeCombo(comboId, context) {
        const combo = this.combos.get(comboId);
        
        if (!combo) {
            return { success: false, error: `組合 ${comboId} 不存在` };
        }

        // 執行所有策略
        const results = this.executeStrategies(combo.strategies, context);

        // 檢查是否有任何策略執行失敗
        const failedResults = results.filter(r => !r.success);
        if (failedResults.length > 0) {
            return { 
                success: false, 
                error: '組合中有策略執行失敗',
                failedStrategies: failedResults 
            };
        }

        // 合併信號
        const combinedSignals = this.combineSignals(
            results.map(r => r.signals), 
            combo.combineLogic
        );

        return { success: true, signals: combinedSignals };
    }

    /**
     * 合併多個策略信號
     */
    combineSignals(signalsList, combineLogic) {
        const combined = {
            enter: false,
            exit: false,
            short: false,
            cover: false,
            stopLossPercent: null,
            takeProfitPercent: null,
            meta: {}
        };

        if (signalsList.length === 0) {
            return combined;
        }

        switch (combineLogic) {
            case 'AND':
                // 所有策略都同意才執行
                combined.enter = signalsList.every(s => s.enter);
                combined.exit = signalsList.every(s => s.exit);
                combined.short = signalsList.every(s => s.short);
                combined.cover = signalsList.every(s => s.cover);
                break;
                
            case 'OR':
                // 任一策略同意就執行
                combined.enter = signalsList.some(s => s.enter);
                combined.exit = signalsList.some(s => s.exit);
                combined.short = signalsList.some(s => s.short);
                combined.cover = signalsList.some(s => s.cover);
                break;
                
            case 'MAJORITY':
                // 多數策略同意才執行
                const half = signalsList.length / 2;
                combined.enter = signalsList.filter(s => s.enter).length > half;
                combined.exit = signalsList.filter(s => s.exit).length > half;
                combined.short = signalsList.filter(s => s.short).length > half;
                combined.cover = signalsList.filter(s => s.cover).length > half;
                break;
        }

        // 合併元資料
        combined.meta.strategies = signalsList.map((signals, index) => ({
            index,
            signals,
            meta: signals.meta
        }));

        return combined;
    }

    /**
     * 設定策略快取
     */
    setCache(strategyId, key, value) {
        if (!this.caches.has(strategyId)) {
            this.caches.set(strategyId, new Map());
        }
        this.caches.get(strategyId).set(key, value);
    }

    /**
     * 取得策略快取
     */
    getCache(strategyId, key) {
        const strategyCache = this.caches.get(strategyId);
        return strategyCache ? strategyCache.get(key) : undefined;
    }

    /**
     * 清理策略快取
     */
    clearCache(strategyId) {
        if (this.caches.has(strategyId)) {
            this.caches.get(strategyId).clear();
        }
    }

    /**
     * 註冊策略載入器
     */
    registerLoader(protocol, loader) {
        this.loaders.set(protocol, loader);
    }

    /**
     * 從來源載入策略
     */
    async loadStrategyFromSource(source) {
        try {
            // 解析來源協議
            const [protocol] = source.split(':', 1);
            const loader = this.loaders.get(protocol);
            
            if (!loader) {
                return { success: false, error: `不支援的協議: ${protocol}` };
            }

            // 載入策略
            const strategy = await loader.loadStrategy(source);
            
            // 註冊策略
            const registerResult = this.registerStrategy(strategy);
            
            return registerResult;
        } catch (error) {
            return { success: false, error: `載入策略失敗: ${error.message}` };
        }
    }

    /**
     * 記錄日誌
     */
    log(strategyId, message, details = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            strategyId,
            message,
            details
        };
        
        console.log(`[Strategy:${strategyId}] ${message}`, details);
        
        // 觸發日誌事件
        this.emit('strategy:log', logEntry);
    }

    /**
     * 事件監聽
     */
    on(eventName, listener) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(listener);
    }

    /**
     * 移除事件監聽器
     */
    off(eventName, listener) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 觸發事件
     */
    emit(eventName, data) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`事件監聽器執行錯誤 [${eventName}]:`, error);
                }
            });
        }
    }

    /**
     * 取得統計資訊
     */
    getStats() {
        return {
            strategiesCount: this.strategies.size,
            combosCount: this.combos.size,
            cachedStrategies: Array.from(this.caches.keys()),
            registeredLoaders: Array.from(this.loaders.keys())
        };
    }
}

// 使用 CommonJS 導出（適用於 Node.js 測試環境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StrategyManager };
}

// 使用 ES6 導出（適用於瀏覽器環境）
if (typeof window !== 'undefined') {
    window.StrategyManager = StrategyManager;
}