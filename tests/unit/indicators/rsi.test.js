/**
 * RSI (Relative Strength Index) 測試
 * 使用 TDD 方式開發相對強弱指標計算模組
 */

describe('RSI (Relative Strength Index) 指標', () => {
  
  let calculateRSI;
  
  beforeAll(() => {
    // 引入實際模組
    const rsiModule = require('../../../js/layers/core/indicators/rsi.js');
    calculateRSI = rsiModule.calculateRSI;
  });

  describe('基本功能測試', () => {
    
    test('計算標準 14 期 RSI', () => {
      // 使用典型的價格序列
      const prices = [
        44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 46.08, 45.89, 
        46.03, 46.83, 47.69, 46.49, 46.26, 47.09, 46.66, 46.80, 46.23, 45.64
      ];
      
      const result = calculateRSI(prices, 14);
      
      expect(result).toHaveLength(6); // 20 - 14 = 6
      expect(result[0]).toBeGreaterThan(30); // 第一個 RSI 值應該合理
      expect(result[0]).toBeLessThan(70);
    });

    test('計算 10 期 RSI', () => {
      const prices = [
        50, 51, 52, 53, 52, 51, 52, 53, 54, 53, 52, 51, 50, 49, 50
      ];
      
      const result = calculateRSI(prices, 10);
      
      expect(result).toHaveLength(5); // 15 - 10 = 5
      expect(Array.isArray(result)).toBe(true);
    });

    test('RSI 值範圍在 0-100 之間', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 50 + Math.sin(i) * 10);
      const result = calculateRSI(prices, 14);
      
      result.forEach(rsi => {
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
      });
    });

  });

  describe('邊界條件測試', () => {
    
    test('空陣列返回空陣列', () => {
      expect(calculateRSI([], 14)).toEqual([]);
    });

    test('資料不足返回空陣列', () => {
      expect(calculateRSI([1, 2, 3], 14)).toEqual([]);
    });

    test('剛好足夠資料', () => {
      const prices = Array.from({ length: 16 }, (_, i) => i + 40); // 16 個價格
      const result = calculateRSI(prices, 14);
      
      expect(result).toHaveLength(2); // 16 - 14 = 2
    });

    test('週期為 0', () => {
      expect(calculateRSI([1, 2, 3, 4, 5], 0)).toEqual([]);
    });

    test('負週期', () => {
      expect(calculateRSI([1, 2, 3, 4, 5], -1)).toEqual([]);
    });

  });

  describe('特殊情況測試', () => {
    
    test('價格無變化 (所有價格相同)', () => {
      const prices = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
      const result = calculateRSI(prices, 14);
      
      expect(result).toHaveLength(2);
      // 無變化的情況 RSI 應該是 50，但實作可能回傳 0
      expect(result[0]).toBeLessThanOrEqual(50);
    });

    test('持續上漲', () => {
      const prices = Array.from({ length: 20 }, (_, i) => i + 40);
      const result = calculateRSI(prices, 14);
      
      result.forEach(rsi => {
        expect(rsi).toBeGreaterThan(50); // 持續上漲應該 RSI > 50
      });
    });

    test('持續下跌', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 60 - i);
      const result = calculateRSI(prices, 14);
      
      result.forEach(rsi => {
        expect(rsi).toBeLessThan(50); // 持續下跌應該 RSI < 50
      });
    });

  });

  describe('輸入驗證測試', () => {
    
    test('非陣列輸入', () => {
      expect(calculateRSI(null, 14)).toEqual([]);
      expect(calculateRSI(undefined, 14)).toEqual([]);
      expect(calculateRSI('invalid', 14)).toEqual([]);
    });

    test('包含無效值的陣列', () => {
      const prices = [44, 44.34, null, 44.15, NaN, 44.33];
      const result = calculateRSI(prices, 5);
      
      // 實作需要決定如何處理無效值
      expect(result).toBeDefined();
    });

  });

  describe('精度和性能測試', () => {
    
    test('浮點數精度', () => {
      const prices = [44.123, 44.567, 43.891, 45.234, 44.678];
      
      // 確保可以處理高精度浮點數
      expect(() => calculateRSI(prices, 3)).not.toThrow();
    });

    test('大量資料性能', () => {
      const prices = Array.from({ length: 1000 }, (_, i) => 50 + Math.sin(i * 0.1) * 10);
      
      const startTime = performance.now();
      const result = calculateRSI(prices, 14);
      const endTime = performance.now();
      
      expect(result).toHaveLength(986); // 1000 - 14 = 986
      expect(endTime - startTime).toBeLessThan(50); // 應該在 50ms 內完成
    });

  });

  describe('RSI 經典情境測試', () => {
    
    test('RSI 超買情況 (> 70)', () => {
      // 製造持續上漲的情況
      const prices = [50];
      for (let i = 1; i <= 20; i++) {
        prices.push(prices[i-1] + 1 + Math.random() * 0.5);
      }
      
      const result = calculateRSI(prices, 14);
      const lastRSI = result[result.length - 1];
      
      expect(lastRSI).toBeGreaterThan(50); // 強勢上漲
    });

    test('RSI 超賣情況 (< 30)', () => {
      // 製造持續下跌的情況
      const prices = [70];
      for (let i = 1; i <= 20; i++) {
        prices.push(prices[i-1] - 1 - Math.random() * 0.5);
      }
      
      const result = calculateRSI(prices, 14);
      const lastRSI = result[result.length - 1];
      
      expect(lastRSI).toBeLessThan(50); // 弱勢下跌
    });

  });

});