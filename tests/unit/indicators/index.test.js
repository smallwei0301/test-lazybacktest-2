/**
 * 技術指標統一模組測試
 * 測試 IndicatorCalculator 類別和統一導出介面
 */

describe('技術指標統一模組', () => {
  
  let IndicatorCalculator, calculator;
  
  beforeAll(() => {
    const indicatorModule = require('../../../js/layers/core/indicators/index.js');
    IndicatorCalculator = indicatorModule.IndicatorCalculator;
    calculator = indicatorModule.calculator;
  });

  describe('IndicatorCalculator 類別', () => {
    
    test('建立計算器實例', () => {
      const calc = new IndicatorCalculator();
      expect(calc).toBeInstanceOf(IndicatorCalculator);
      expect(calc.indicators).toBeDefined();
    });

    test('取得可用指標清單', () => {
      const indicators = calculator.getAvailableIndicators();
      expect(indicators).toHaveProperty('SMA');
      expect(indicators).toHaveProperty('RSI');
      expect(indicators.SMA).toContain('簡單移動平均線');
    });

    test('計算 SMA', () => {
      const prices = [10, 20, 30, 40, 50];
      const result = calculator.calculateSMA(prices, 3);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(20);
      expect(result[2]).toBe(40);
    });

    test('計算 WMA', () => {
      const prices = [10, 20, 30, 40];
      const result = calculator.calculateWMA(prices, 3);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBeCloseTo((10*1 + 20*2 + 30*3) / 6, 2);
    });

    test('計算 RSI', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 50 + i);
      const result = calculator.calculateRSI(prices, 14);
      
      expect(result).toHaveLength(6); // 20 - 14 = 6
      expect(result[0]).toBeGreaterThan(50); // 持續上漲應該 > 50
    });

  });

  describe('參數驗證', () => {
    
    test('驗證 SMA 參數', () => {
      const result1 = calculator.validateParams('SMA', [1, 2, 3, 4, 5], 3);
      expect(result1.valid).toBe(true);
      
      const result2 = calculator.validateParams('SMA', 'invalid', 3);
      expect(result2.valid).toBe(false);
    });

    test('驗證 RSI 參數', () => {
      const result1 = calculator.validateParams('RSI', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
      expect(result1.valid).toBe(true);
      
      const result2 = calculator.validateParams('RSI', [1, 2, 3], 14);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('資料長度 (3) 必須大於週期 (14)');
    });

    test('未知指標驗證', () => {
      const result = calculator.validateParams('UNKNOWN', [1, 2, 3], 2);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown indicator');
    });

  });

  describe('批量計算', () => {
    
    test('計算多個指標', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 50 + Math.sin(i * 0.2) * 10);
      const configs = [
        { name: 'SMA', period: 5 },
        { name: 'SMA', period: 10 },
        { name: 'RSI', period: 14 }
      ];
      
      const { results, errors } = calculator.calculateMultiple(prices, configs);
      
      expect(errors).toHaveLength(0);
      expect(results).toHaveProperty('SMA_5');
      expect(results).toHaveProperty('SMA_10');
      expect(results).toHaveProperty('RSI_14');
      
      expect(results.SMA_5).toHaveLength(26); // 30 - 5 + 1
      expect(results.SMA_10).toHaveLength(21); // 30 - 10 + 1
      expect(results.RSI_14).toHaveLength(16); // 30 - 14
    });

    test('處理無效指標配置', () => {
      const prices = [1, 2, 3, 4, 5];
      const configs = [
        { name: 'SMA', period: 3 },        // 有效
        { name: 'INVALID', period: 2 },    // 無效指標
        { name: 'RSI', period: 20 }        // 資料不足
      ];
      
      const { results, errors } = calculator.calculateMultiple(prices, configs);
      
      expect(results).toHaveProperty('SMA_3');
      expect(errors).toHaveLength(2);
      expect(errors[0].indicator).toBe('INVALID');
      expect(errors[1].indicator).toBe('RSI');
    });

  });

  describe('直接函數導出', () => {
    
    test('直接使用 calculateSMA', () => {
      const { calculateSMA } = require('../../../js/layers/core/indicators/index.js');
      const result = calculateSMA([10, 20, 30, 40], 3);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(20);
    });

    test('直接使用 calculateRSI', () => {
      const { calculateRSI } = require('../../../js/layers/core/indicators/index.js');
      const prices = Array.from({ length: 20 }, (_, i) => 50 + i);
      const result = calculateRSI(prices, 14);
      
      expect(result).toHaveLength(6);
      expect(result[0]).toBeGreaterThan(50);
    });

  });

  describe('常數導出', () => {
    
    test('AVAILABLE_INDICATORS 常數', () => {
      const { AVAILABLE_INDICATORS } = require('../../../js/layers/core/indicators/index.js');
      
      expect(AVAILABLE_INDICATORS).toHaveProperty('SMA');
      expect(AVAILABLE_INDICATORS).toHaveProperty('RSI');
      expect(typeof AVAILABLE_INDICATORS.SMA).toBe('string');
    });

  });

});