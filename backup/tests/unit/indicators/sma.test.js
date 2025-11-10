/**
 * SMA (Simple Moving Average) 測試
 * 使用 TDD 方式開發簡單移動平均線計算模組
 */

describe('SMA (Simple Moving Average) 指標', () => {
  
  // 將會在實作後引入模組
  let calculateSMA;
  
  beforeAll(() => {
    // 引入實際模組
    const smaModule = require('../../../js/layers/core/indicators/sma.js');
    calculateSMA = smaModule.calculateSMA;
  });

  describe('基本功能測試', () => {
    
    test('計算簡單的 3 期 SMA', () => {
      const prices = [10, 20, 30, 40, 50];
      const result = calculateSMA(prices, 3);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(20); // (10+20+30)/3 = 20
      expect(result[1]).toBe(30); // (20+30+40)/3 = 30  
      expect(result[2]).toBe(40); // (30+40+50)/3 = 40
    });

    test('計算 5 期 SMA', () => {
      const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = calculateSMA(prices, 5);
      
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(3);  // (1+2+3+4+5)/5 = 3
      expect(result[1]).toBe(4);  // (2+3+4+5+6)/5 = 4
      expect(result[5]).toBe(8);  // (6+7+8+9+10)/5 = 8
    });

    test('單一週期 SMA', () => {
      const prices = [100, 200, 300];
      const result = calculateSMA(prices, 1);
      
      expect(result).toEqual([100, 200, 300]);
    });

  });

  describe('邊界條件測試', () => {
    
    test('空陣列返回空陣列', () => {
      expect(calculateSMA([], 5)).toEqual([]);
    });

    test('資料不足返回空陣列', () => {
      expect(calculateSMA([1, 2], 3)).toEqual([]);
    });

    test('週期等於資料長度', () => {
      const prices = [10, 20, 30];
      const result = calculateSMA(prices, 3);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(20); // (10+20+30)/3 = 20
    });

    test('週期為 0', () => {
      expect(calculateSMA([1, 2, 3], 0)).toEqual([]);
    });

    test('負週期', () => {
      expect(calculateSMA([1, 2, 3], -1)).toEqual([]);
    });

  });

  describe('輸入驗證測試', () => {
    
    test('非陣列輸入', () => {
      expect(calculateSMA(null, 5)).toEqual([]);
      expect(calculateSMA(undefined, 5)).toEqual([]);
      expect(calculateSMA('invalid', 5)).toEqual([]);
      expect(calculateSMA(123, 5)).toEqual([]);
    });

    test('包含非數字的陣列', () => {
      const prices = [10, 20, null, 40, 50];
      const result = calculateSMA(prices, 3);
      
      // 應該處理 null 值 - 具體行為需要定義
      // 這裡假設跳過 null 值或產生 NaN
      expect(result).toBeDefined();
    });

    test('包含 NaN 的陣列', () => {
      const prices = [10, 20, NaN, 40, 50];
      const result = calculateSMA(prices, 3);
      
      expect(result).toBeDefined();
      // NaN 的處理行為待定義
    });

  });

  describe('性能測試', () => {
    
    test('大量資料計算性能', () => {
      // 生成 10000 個價格資料
      const prices = Array.from({ length: 10000 }, (_, i) => i + 1);
      
      const startTime = performance.now();
      const result = calculateSMA(prices, 20);
      const endTime = performance.now();
      
      expect(result).toHaveLength(9981); // 10000 - 20 + 1
      expect(endTime - startTime).toBeLessThan(100); // 應該在 100ms 內完成
    });

  });

  describe('精度測試', () => {
    
    test('浮點數精度', () => {
      const prices = [1.1, 2.2, 3.3, 4.4, 5.5];
      const result = calculateSMA(prices, 3);
      
      expect(result[0]).toBeCloseTo(2.2, 10); // (1.1+2.2+3.3)/3 = 2.2
      expect(result[1]).toBeCloseTo(3.3, 10); // (2.2+3.3+4.4)/3 = 3.3
      expect(result[2]).toBeCloseTo(4.4, 10); // (3.3+4.4+5.5)/3 = 4.4
    });

    test('大數值計算', () => {
      const prices = [1000000, 2000000, 3000000];
      const result = calculateSMA(prices, 3);
      
      expect(result[0]).toBe(2000000);
    });

  });

});