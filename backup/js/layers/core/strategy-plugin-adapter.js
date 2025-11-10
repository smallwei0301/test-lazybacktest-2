/**
 * 策略適配器 - 整合現有策略插件系統
 * 將 LazyBacktest 的策略插件轉換為 StrategyManager 格式
 */

class StrategyPluginAdapter {
    constructor(strategyManager) {
        this.strategyManager = strategyManager;
        this.pluginRegistry = null;
        this.contract = null;
    }

    /**
     * 初始化適配器，連接到現有的插件系統
     */
    initialize(globalScope = window) {
        this.pluginRegistry = globalScope?.StrategyPluginRegistry;
        this.contract = globalScope?.StrategyPluginContract;
        
        if (!this.pluginRegistry || !this.contract) {
            throw new Error('無法找到策略插件系統');
        }
        
        return this;
    }

    /**
     * 從插件註冊中心載入所有策略
     */
    loadAllStrategies() {
        if (!this.pluginRegistry) {
            throw new Error('插件註冊中心未初始化');
        }

        const loadedStrategies = [];
        
        // 取得所有已註冊的策略
        if (typeof this.pluginRegistry.getRegisteredStrategies === 'function') {
            const registeredStrategies = this.pluginRegistry.getRegisteredStrategies();
            
            for (const strategyId of registeredStrategies) {
                try {
                    const strategy = this.loadStrategy(strategyId);
                    if (strategy) {
                        const result = this.strategyManager.registerStrategy(strategy);
                        if (result.success) {
                            loadedStrategies.push(strategyId);
                        } else {
                            console.warn(`載入策略 ${strategyId} 失敗:`, result.errors);
                        }
                    }
                } catch (error) {
                    console.error(`載入策略 ${strategyId} 時發生錯誤:`, error);
                }
            }
        }
        
        return loadedStrategies;
    }

    /**
     * 載入單一策略
     */
    loadStrategy(strategyId) {
        if (!this.pluginRegistry) {
            throw new Error('插件註冊中心未初始化');
        }

        // 取得策略元資料
        const meta = this.pluginRegistry.getStrategyMetaById?.(strategyId);
        if (!meta) {
            console.warn(`找不到策略 ${strategyId} 的元資料`);
            return null;
        }

        // 取得策略實作
        const implementation = this.pluginRegistry.getStrategyById?.(strategyId);
        if (!implementation) {
            console.warn(`找不到策略 ${strategyId} 的實作`);
            return null;
        }

        // 轉換為 StrategyManager 格式
        return this.adaptStrategy(meta, implementation);
    }

    /**
     * 將插件格式的策略轉換為 StrategyManager 格式
     */
    adaptStrategy(meta, implementation) {
        return {
            id: meta.id,
            label: meta.label || meta.id,
            paramsSchema: this.adaptParamsSchema(meta.paramsSchema),
            calculate: (context) => {
                return this.adaptCalculateFunction(implementation, context);
            },
            originalMeta: meta,
            originalImplementation: implementation
        };
    }

    /**
     * 轉換參數模式
     */
    adaptParamsSchema(originalSchema) {
        if (!originalSchema) {
            return { type: 'object', properties: {} };
        }

        // 如果已經是 JSON Schema 格式，直接返回
        if (originalSchema.type && originalSchema.properties) {
            return originalSchema;
        }

        // 轉換 LazyBacktest 特有的參數描述格式
        const properties = {};
        
        if (typeof originalSchema === 'object') {
            for (const [key, descriptor] of Object.entries(originalSchema)) {
                if (typeof descriptor === 'object') {
                    properties[key] = {
                        type: this.inferTypeFromDescriptor(descriptor),
                        default: descriptor.default,
                        minimum: descriptor.min,
                        maximum: descriptor.max,
                        description: descriptor.description
                    };
                }
            }
        }

        return {
            type: 'object',
            properties
        };
    }

    /**
     * 從描述器推斷參數類型
     */
    inferTypeFromDescriptor(descriptor) {
        if (descriptor.type) {
            return descriptor.type;
        }
        
        if (typeof descriptor.default === 'number') {
            return 'number';
        }
        
        if (typeof descriptor.default === 'string') {
            return 'string';
        }
        
        if (typeof descriptor.default === 'boolean') {
            return 'boolean';
        }
        
        return 'string'; // 預設為字串
    }

    /**
     * 適配策略計算函數
     */
    adaptCalculateFunction(implementation, context) {
        try {
            // 準備插件格式的上下文
            const pluginContext = this.adaptContextForPlugin(context);
            
            // 呼叫原始策略實作
            const result = implementation.calculate?.(pluginContext) || implementation(pluginContext);
            
            // 轉換結果格式
            return this.adaptResultFromPlugin(result);
        } catch (error) {
            console.error('策略計算錯誤:', error);
            throw error;
        }
    }

    /**
     * 為插件準備上下文
     */
    adaptContextForPlugin(context) {
        const series = context.series || {};
        
        return {
            role: 'longEntry', // 預設角色，可能需要根據實際需求調整
            index: context.index,
            series: {
                close: Array.isArray(series.close) ? [...series.close] : [],
                open: Array.isArray(series.open) ? [...series.open] : [],
                high: Array.isArray(series.high) ? [...series.high] : [],
                low: Array.isArray(series.low) ? [...series.low] : [],
                date: Array.isArray(series.date) ? [...series.date] : []
            },
            helpers: {
                getIndicator: context.helpers?.getIndicator || (() => null),
                log: context.helpers?.log || (() => {}),
                setCache: context.helpers?.setCache || (() => {}),
                getCache: context.helpers?.getCache || (() => undefined)
            },
            runtime: context.runtime || {
                warmupStartIndex: 0,
                effectiveStartIndex: 0,
                length: series.close?.length || 0
            }
        };
    }

    /**
     * 轉換插件結果格式
     */
    adaptResultFromPlugin(result) {
        if (!result || typeof result !== 'object') {
            return { enter: false, exit: false, short: false, cover: false };
        }

        return {
            enter: Boolean(result.enter),
            exit: Boolean(result.exit),
            short: Boolean(result.short),
            cover: Boolean(result.cover),
            stopLossPercent: result.stopLossPercent || null,
            takeProfitPercent: result.takeProfitPercent || null,
            meta: result.meta || {}
        };
    }

    /**
     * 建立策略載入器
     */
    createPluginLoader() {
        return {
            loadStrategy: async (source) => {
                // 解析策略 ID 從來源路徑
                const strategyId = this.extractStrategyIdFromSource(source);
                return this.loadStrategy(strategyId);
            }
        };
    }

    /**
     * 從來源路徑提取策略 ID
     */
    extractStrategyIdFromSource(source) {
        // 處理不同的來源格式
        if (source.startsWith('plugin://')) {
            return source.replace('plugin://', '');
        }
        
        if (source.includes('/')) {
            const parts = source.split('/');
            return parts[parts.length - 1].replace('.js', '');
        }
        
        return source;
    }

    /**
     * 取得適配器統計資訊
     */
    getStats() {
        const stats = {
            pluginRegistryAvailable: Boolean(this.pluginRegistry),
            contractAvailable: Boolean(this.contract),
            adaptedStrategies: []
        };

        if (this.pluginRegistry && typeof this.pluginRegistry.getRegisteredStrategies === 'function') {
            const registeredStrategies = this.pluginRegistry.getRegisteredStrategies();
            stats.totalPluginStrategies = registeredStrategies.length;
            
            // 檢查哪些策略已經被適配
            for (const strategyId of registeredStrategies) {
                if (this.strategyManager.hasStrategy(strategyId)) {
                    stats.adaptedStrategies.push(strategyId);
                }
            }
        }

        return stats;
    }
}

// 使用 CommonJS 導出（適用於 Node.js 測試環境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StrategyPluginAdapter };
}

// 使用 ES6 導出（適用於瀏覽器環境）
if (typeof window !== 'undefined') {
    window.StrategyPluginAdapter = StrategyPluginAdapter;
}