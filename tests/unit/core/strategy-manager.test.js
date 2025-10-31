/**
 * 策略管理器測試
 * 統一策略載入、驗證和執行邏輯
 */

const { StrategyManager } = require('../../../js/layers/core/strategy-manager');

describe('StrategyManager 策略管理器', () => {
    let strategyManager;
    
    // 模擬策略定義
    const mockStrategy = {
        id: 'test-ma-cross',
        label: '測試移動平均交叉',
        paramsSchema: {
            type: 'object',
            properties: {
                shortPeriod: { type: 'number', minimum: 1, default: 5 },
                longPeriod: { type: 'number', minimum: 1, default: 20 }
            }
        },
        calculate: (context) => {
            const { series, index, helpers } = context;
            const shortMA = helpers.getIndicator('SMA_5');
            const longMA = helpers.getIndicator('SMA_20');
            
            if (!shortMA || !longMA || index === 0) {
                return { enter: false, exit: false };
            }
            
            const currentShort = shortMA[index];
            const prevShort = shortMA[index - 1];
            const currentLong = longMA[index];
            const prevLong = longMA[index - 1];
            
            // 黃金交叉：短均線向上突破長均線
            const goldenCross = prevShort <= prevLong && currentShort > currentLong;
            // 死亡交叉：短均線向下跌破長均線
            const deathCross = prevShort >= prevLong && currentShort < currentLong;
            
            return {
                enter: goldenCross,
                exit: deathCross,
                meta: {
                    shortMA: currentShort,
                    longMA: currentLong
                }
            };
        }
    };

    // 模擬股價資料
    const mockStockData = [
        { date: '2024-01-01', open: 100, high: 105, low: 95, close: 102 },
        { date: '2024-01-02', open: 102, high: 108, low: 101, close: 106 },
        { date: '2024-01-03', open: 106, high: 110, low: 104, close: 109 },
        { date: '2024-01-04', open: 109, high: 112, low: 107, close: 111 },
        { date: '2024-01-05', open: 111, high: 115, low: 110, close: 114 },
    ];

    // 模擬指標資料
    const mockIndicators = {
        'SMA_5': [null, 102, 105.6, 108.4, 110.8],
        'SMA_20': [null, 102, 104, 106, 108]
    };

    beforeEach(() => {
        strategyManager = new StrategyManager();
    });

    describe('策略註冊與管理', () => {
        test('應該正確註冊策略', () => {
            const result = strategyManager.registerStrategy(mockStrategy);
            
            expect(result.success).toBe(true);
            expect(strategyManager.hasStrategy('test-ma-cross')).toBe(true);
        });

        test('應該驗證策略必要欄位', () => {
            const invalidStrategy = { id: 'invalid' }; // 缺少必要欄位
            
            const result = strategyManager.registerStrategy(invalidStrategy);
            
            expect(result.success).toBe(false);
            expect(result.errors).toContain('策略缺少必要的 label 欄位');
        });

        test('應該防止重複註冊相同 ID 的策略', () => {
            strategyManager.registerStrategy(mockStrategy);
            
            const duplicateResult = strategyManager.registerStrategy(mockStrategy);
            
            expect(duplicateResult.success).toBe(false);
            expect(duplicateResult.errors).toContain('策略 ID test-ma-cross 已存在');
        });

        test('應該列出所有已註冊的策略', () => {
            strategyManager.registerStrategy(mockStrategy);
            
            const strategies = strategyManager.listStrategies();
            
            expect(strategies).toHaveLength(1);
            expect(strategies[0].id).toBe('test-ma-cross');
            expect(strategies[0].label).toBe('測試移動平均交叉');
        });

        test('應該能取得特定策略資訊', () => {
            strategyManager.registerStrategy(mockStrategy);
            
            const strategy = strategyManager.getStrategy('test-ma-cross');
            
            expect(strategy).toBeDefined();
            expect(strategy.id).toBe('test-ma-cross');
        });

        test('應該能移除策略', () => {
            strategyManager.registerStrategy(mockStrategy);
            
            const removeResult = strategyManager.removeStrategy('test-ma-cross');
            
            expect(removeResult.success).toBe(true);
            expect(strategyManager.hasStrategy('test-ma-cross')).toBe(false);
        });
    });

    describe('參數驗證', () => {
        beforeEach(() => {
            strategyManager.registerStrategy(mockStrategy);
        });

        test('應該驗證策略參數', () => {
            const validParams = { shortPeriod: 5, longPeriod: 20 };
            
            const result = strategyManager.validateParameters('test-ma-cross', validParams);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('應該拒絕無效參數', () => {
            const invalidParams = { shortPeriod: -1, longPeriod: 'invalid' };
            
            const result = strategyManager.validateParameters('test-ma-cross', invalidParams);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('應該使用預設參數值', () => {
            const partialParams = { shortPeriod: 10 }; // 只提供部分參數
            
            const normalizedParams = strategyManager.normalizeParameters('test-ma-cross', partialParams);
            
            expect(normalizedParams.shortPeriod).toBe(10);
            expect(normalizedParams.longPeriod).toBe(20); // 使用預設值
        });

        test('應該處理不存在的策略', () => {
            const result = strategyManager.validateParameters('non-existent', {});
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('策略 non-existent 不存在');
        });
    });

    describe('策略執行', () => {
        beforeEach(() => {
            strategyManager.registerStrategy(mockStrategy);
        });

        test('應該執行策略計算', () => {
            const context = {
                series: {
                    close: mockStockData.map(d => d.close),
                    open: mockStockData.map(d => d.open),
                    high: mockStockData.map(d => d.high),
                    low: mockStockData.map(d => d.low),
                    date: mockStockData.map(d => d.date)
                },
                index: 2, // 第三天
                helpers: {
                    getIndicator: (key) => mockIndicators[key],
                    log: jest.fn(),
                    setCache: jest.fn(),
                    getCache: jest.fn()
                },
                runtime: {
                    warmupStartIndex: 0,
                    effectiveStartIndex: 1,
                    length: mockStockData.length
                }
            };

            const result = strategyManager.executeStrategy('test-ma-cross', context);

            expect(result.success).toBe(true);
            expect(result.signals).toBeDefined();
            expect(typeof result.signals.enter).toBe('boolean');
            expect(typeof result.signals.exit).toBe('boolean');
        });

        test('應該處理策略執行錯誤', () => {
            const errorStrategy = {
                id: 'error-strategy',
                label: '錯誤策略',
                paramsSchema: { type: 'object' },
                calculate: () => {
                    throw new Error('策略計算錯誤');
                }
            };

            strategyManager.registerStrategy(errorStrategy);

            const context = {
                series: { close: [100, 105], date: ['2024-01-01', '2024-01-02'] },
                index: 1,
                helpers: { getIndicator: () => null, log: jest.fn() }
            };

            const result = strategyManager.executeStrategy('error-strategy', context);

            expect(result.success).toBe(false);
            expect(result.error).toContain('策略計算錯誤');
        });

        test('應該支援批次執行多個策略', () => {
            const anotherStrategy = {
                id: 'simple-strategy',
                label: '簡單策略',
                paramsSchema: { type: 'object' },
                calculate: () => ({ enter: true, exit: false })
            };

            strategyManager.registerStrategy(anotherStrategy);

            const context = {
                series: { close: [100, 105], date: ['2024-01-01', '2024-01-02'] },
                index: 1,
                helpers: { getIndicator: () => null, log: jest.fn() }
            };

            const results = strategyManager.executeStrategies(['test-ma-cross', 'simple-strategy'], context);

            expect(results).toHaveLength(2);
            expect(results[0].strategyId).toBe('test-ma-cross');
            expect(results[1].strategyId).toBe('simple-strategy');
        });
    });

    describe('策略組合', () => {
        test('應該支援策略組合', () => {
            const strategy1 = { ...mockStrategy, id: 'strategy1' };
            const strategy2 = { 
                ...mockStrategy, 
                id: 'strategy2',
                calculate: () => ({ enter: false, exit: true })
            };

            strategyManager.registerStrategy(strategy1);
            strategyManager.registerStrategy(strategy2);

            const combo = strategyManager.createCombo('test-combo', {
                strategies: ['strategy1', 'strategy2'],
                combineLogic: 'AND' // 兩個策略都同意才執行
            });

            expect(combo.success).toBe(true);
            expect(strategyManager.hasCombo('test-combo')).toBe(true);
        });

        test('應該執行策略組合', () => {
            const strategy1 = { 
                ...mockStrategy, 
                id: 'strategy1',
                calculate: () => ({ enter: true, exit: false })
            };
            const strategy2 = { 
                ...mockStrategy, 
                id: 'strategy2',
                calculate: () => ({ enter: true, exit: false })
            };

            strategyManager.registerStrategy(strategy1);
            strategyManager.registerStrategy(strategy2);
            strategyManager.createCombo('test-combo', {
                strategies: ['strategy1', 'strategy2'],
                combineLogic: 'AND'
            });

            const context = {
                series: { close: [100, 105], date: ['2024-01-01', '2024-01-02'] },
                index: 1,
                helpers: { getIndicator: () => null, log: jest.fn() }
            };

            const result = strategyManager.executeCombo('test-combo', context);

            expect(result.success).toBe(true);
            expect(result.signals.enter).toBe(true); // 兩個策略都同意進場
        });
    });

    describe('快取管理', () => {
        beforeEach(() => {
            strategyManager.registerStrategy(mockStrategy);
        });

        test('應該支援策略快取', () => {
            const cacheKey = 'test-cache-key';
            const cacheData = { someData: 'cached' };

            strategyManager.setCache('test-ma-cross', cacheKey, cacheData);
            const retrieved = strategyManager.getCache('test-ma-cross', cacheKey);

            expect(retrieved).toEqual(cacheData);
        });

        test('應該清理策略快取', () => {
            strategyManager.setCache('test-ma-cross', 'key1', 'data1');
            strategyManager.setCache('test-ma-cross', 'key2', 'data2');

            strategyManager.clearCache('test-ma-cross');

            expect(strategyManager.getCache('test-ma-cross', 'key1')).toBeUndefined();
            expect(strategyManager.getCache('test-ma-cross', 'key2')).toBeUndefined();
        });
    });

    describe('策略載入器', () => {
        test('應該從檔案載入策略', async () => {
            const mockLoader = {
                loadStrategy: jest.fn().mockResolvedValue(mockStrategy)
            };

            strategyManager.registerLoader('file', mockLoader);

            const result = await strategyManager.loadStrategyFromSource('file:///path/to/strategy.js');

            expect(result.success).toBe(true);
            expect(mockLoader.loadStrategy).toHaveBeenCalled();
            expect(strategyManager.hasStrategy('test-ma-cross')).toBe(true);
        });

        test('應該處理載入錯誤', async () => {
            const mockLoader = {
                loadStrategy: jest.fn().mockRejectedValue(new Error('載入失敗'))
            };

            strategyManager.registerLoader('http', mockLoader);

            const result = await strategyManager.loadStrategyFromSource('http://example.com/strategy.js');

            expect(result.success).toBe(false);
            expect(result.error).toContain('載入失敗');
        });
    });

    describe('事件系統', () => {
        test('應該支援策略生命週期事件', () => {
            const onRegister = jest.fn();
            const onExecute = jest.fn();

            strategyManager.on('strategy:register', onRegister);
            strategyManager.on('strategy:execute', onExecute);

            strategyManager.registerStrategy(mockStrategy);

            expect(onRegister).toHaveBeenCalledWith({
                strategyId: 'test-ma-cross',
                strategy: expect.objectContaining({ id: 'test-ma-cross' })
            });
        });

        test('應該清理事件監聽器', () => {
            const listener = jest.fn();
            
            strategyManager.on('strategy:register', listener);
            strategyManager.off('strategy:register', listener);
            
            strategyManager.registerStrategy(mockStrategy);
            
            expect(listener).not.toHaveBeenCalled();
        });
    });
});