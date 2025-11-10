/**
 * 策略適配器測試
 * 測試現有策略插件系統的整合
 */

const { StrategyManager } = require('../../../js/layers/core/strategy-manager');
const { StrategyPluginAdapter } = require('../../../js/layers/core/strategy-plugin-adapter');

describe('StrategyPluginAdapter 策略適配器', () => {
    let strategyManager;
    let adapter;
    let mockPluginRegistry;
    let mockContract;

    // 模擬插件註冊中心
    beforeEach(() => {
        strategyManager = new StrategyManager();
        adapter = new StrategyPluginAdapter(strategyManager);

        // 模擬插件註冊中心
        mockPluginRegistry = {
            getRegisteredStrategies: jest.fn(() => ['ma-cross', 'rsi-strategy']),
            getStrategyMetaById: jest.fn((id) => {
                const metas = {
                    'ma-cross': {
                        id: 'ma-cross',
                        label: '移動平均交叉',
                        paramsSchema: {
                            shortPeriod: { default: 5, min: 1, max: 50, description: '短期週期' },
                            longPeriod: { default: 20, min: 1, max: 200, description: '長期週期' }
                        }
                    },
                    'rsi-strategy': {
                        id: 'rsi-strategy',
                        label: 'RSI 策略',
                        paramsSchema: {
                            period: { default: 14, min: 2, max: 100 },
                            overbought: { default: 70, min: 50, max: 90 },
                            oversold: { default: 30, min: 10, max: 50 }
                        }
                    }
                };
                return metas[id];
            }),
            getStrategyById: jest.fn((id) => {
                const implementations = {
                    'ma-cross': {
                        calculate: (context) => {
                            const { series, index } = context;
                            if (index === 0) return { enter: false, exit: false };
                            
                            // 模擬移動平均交叉邏輯
                            const currentPrice = series.close[index];
                            const previousPrice = series.close[index - 1];
                            
                            return {
                                enter: currentPrice > previousPrice,
                                exit: currentPrice < previousPrice,
                                meta: { price: currentPrice }
                            };
                        }
                    },
                    'rsi-strategy': (context) => {
                        // 函數式策略實作
                        return {
                            enter: context.index % 3 === 0, // 簡單的模擬邏輯
                            exit: context.index % 3 === 2,
                            meta: { rsi: 50 }
                        };
                    }
                };
                return implementations[id];
            })
        };

        mockContract = {
            createLegacyStrategyPlugin: jest.fn()
        };

        // 模擬全域範圍
        const mockGlobalScope = {
            StrategyPluginRegistry: mockPluginRegistry,
            StrategyPluginContract: mockContract
        };

        adapter.initialize(mockGlobalScope);
    });

    describe('初始化', () => {
        test('應該正確初始化適配器', () => {
            expect(adapter.pluginRegistry).toBe(mockPluginRegistry);
            expect(adapter.contract).toBe(mockContract);
        });

        test('應該拋出錯誤當插件系統不可用時', () => {
            const newAdapter = new StrategyPluginAdapter(strategyManager);
            
            expect(() => {
                newAdapter.initialize({});
            }).toThrow('無法找到策略插件系統');
        });
    });

    describe('策略載入', () => {
        test('應該載入單一策略', () => {
            const strategy = adapter.loadStrategy('ma-cross');
            
            expect(strategy).toBeDefined();
            expect(strategy.id).toBe('ma-cross');
            expect(strategy.label).toBe('移動平均交叉');
            expect(typeof strategy.calculate).toBe('function');
        });

        test('應該載入所有策略', () => {
            const loadedStrategies = adapter.loadAllStrategies();
            
            expect(loadedStrategies).toHaveLength(2);
            expect(loadedStrategies).toContain('ma-cross');
            expect(loadedStrategies).toContain('rsi-strategy');
            
            // 驗證策略已註冊到管理器
            expect(strategyManager.hasStrategy('ma-cross')).toBe(true);
            expect(strategyManager.hasStrategy('rsi-strategy')).toBe(true);
        });

        test('應該處理不存在的策略', () => {
            mockPluginRegistry.getStrategyMetaById.mockReturnValue(null);
            
            const strategy = adapter.loadStrategy('non-existent');
            
            expect(strategy).toBeNull();
        });
    });

    describe('參數模式適配', () => {
        test('應該轉換 LazyBacktest 參數模式為 JSON Schema', () => {
            const strategy = adapter.loadStrategy('ma-cross');
            
            expect(strategy.paramsSchema.type).toBe('object');
            expect(strategy.paramsSchema.properties.shortPeriod).toEqual({
                type: 'number',
                default: 5,
                minimum: 1,
                maximum: 50,
                description: '短期週期'
            });
        });

        test('應該處理已經是 JSON Schema 格式的參數', () => {
            const jsonSchema = {
                type: 'object',
                properties: {
                    period: { type: 'number', default: 14 }
                }
            };

            const adapted = adapter.adaptParamsSchema(jsonSchema);
            
            expect(adapted).toEqual(jsonSchema);
        });

        test('應該推斷參數類型', () => {
            expect(adapter.inferTypeFromDescriptor({ default: 42 })).toBe('number');
            expect(adapter.inferTypeFromDescriptor({ default: 'test' })).toBe('string');
            expect(adapter.inferTypeFromDescriptor({ default: true })).toBe('boolean');
            expect(adapter.inferTypeFromDescriptor({})).toBe('string');
        });
    });

    describe('上下文適配', () => {
        test('應該適配策略管理器上下文為插件格式', () => {
            const originalContext = {
                index: 2,
                series: {
                    close: [100, 105, 110],
                    open: [98, 103, 108],
                    high: [102, 107, 112],
                    low: [97, 102, 107],
                    date: ['2024-01-01', '2024-01-02', '2024-01-03']
                },
                helpers: {
                    getIndicator: jest.fn(),
                    log: jest.fn()
                }
            };

            const pluginContext = adapter.adaptContextForPlugin(originalContext);

            expect(pluginContext.role).toBe('longEntry');
            expect(pluginContext.index).toBe(2);
            expect(pluginContext.series.close).toEqual([100, 105, 110]);
            expect(typeof pluginContext.helpers.getIndicator).toBe('function');
        });

        test('應該處理缺失的上下文資料', () => {
            const minimalContext = { index: 1 };
            
            const pluginContext = adapter.adaptContextForPlugin(minimalContext);
            
            expect(pluginContext.series.close).toEqual([]);
            expect(pluginContext.runtime.length).toBe(0);
        });
    });

    describe('結果適配', () => {
        test('應該轉換插件結果為標準格式', () => {
            const pluginResult = {
                enter: true,
                exit: false,
                stopLossPercent: 5,
                meta: { indicator: 'MA' }
            };

            const adapted = adapter.adaptResultFromPlugin(pluginResult);

            expect(adapted).toEqual({
                enter: true,
                exit: false,
                short: false,
                cover: false,
                stopLossPercent: 5,
                takeProfitPercent: null,
                meta: { indicator: 'MA' }
            });
        });

        test('應該處理無效的結果', () => {
            const adapted = adapter.adaptResultFromPlugin(null);
            
            expect(adapted).toEqual({
                enter: false,
                exit: false,
                short: false,
                cover: false
            });
        });
    });

    describe('策略執行', () => {
        test('應該執行適配的策略', () => {
            adapter.loadAllStrategies();

            const context = {
                index: 1,
                series: {
                    close: [100, 105],
                    date: ['2024-01-01', '2024-01-02']
                },
                helpers: {
                    getIndicator: jest.fn(),
                    log: jest.fn()
                }
            };

            const result = strategyManager.executeStrategy('ma-cross', context);

            expect(result.success).toBe(true);
            expect(typeof result.signals.enter).toBe('boolean');
        });

        test('應該處理函數式策略實作', () => {
            adapter.loadAllStrategies();

            const context = {
                index: 3, // 應該觸發進場信號 (3 % 3 === 0)
                series: { close: [100, 105, 110, 115] },
                helpers: { getIndicator: jest.fn(), log: jest.fn() }
            };

            const result = strategyManager.executeStrategy('rsi-strategy', context);

            expect(result.success).toBe(true);
            expect(result.signals.enter).toBe(true);
        });
    });

    describe('策略載入器', () => {
        test('應該建立插件載入器', () => {
            const loader = adapter.createPluginLoader();
            
            expect(typeof loader.loadStrategy).toBe('function');
        });

        test('應該從來源載入策略', async () => {
            const loader = adapter.createPluginLoader();
            
            const strategy = await loader.loadStrategy('plugin://ma-cross');
            
            expect(strategy).toBeDefined();
            expect(strategy.id).toBe('ma-cross');
        });

        test('應該提取策略 ID 從不同來源格式', () => {
            expect(adapter.extractStrategyIdFromSource('plugin://ma-cross')).toBe('ma-cross');
            expect(adapter.extractStrategyIdFromSource('/path/to/rsi-strategy.js')).toBe('rsi-strategy');
            expect(adapter.extractStrategyIdFromSource('simple-strategy')).toBe('simple-strategy');
        });
    });

    describe('統計資訊', () => {
        test('應該提供適配器統計資訊', () => {
            adapter.loadAllStrategies();
            
            const stats = adapter.getStats();
            
            expect(stats.pluginRegistryAvailable).toBe(true);
            expect(stats.contractAvailable).toBe(true);
            expect(stats.totalPluginStrategies).toBe(2);
            expect(stats.adaptedStrategies).toHaveLength(2);
        });

        test('應該處理插件系統不可用的情況', () => {
            const newAdapter = new StrategyPluginAdapter(strategyManager);
            
            const stats = newAdapter.getStats();
            
            expect(stats.pluginRegistryAvailable).toBe(false);
            expect(stats.contractAvailable).toBe(false);
        });
    });
});