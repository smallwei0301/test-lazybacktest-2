/**
 * Jest 設定驗證測試
 * 確保測試環境正確設定並能正常運行
 */

describe('Jest 測試環境驗證', () => {
  
  test('基本數學運算', () => {
    expect(2 + 2).toBe(4);
    expect(10 * 3).toBe(30);
    expect(Math.max(1, 2, 3)).toBe(3);
  });

  test('陣列操作', () => {
    const testArray = [1, 2, 3, 4, 5];
    
    expect(testArray).toHaveLength(5);
    expect(testArray).toContain(3);
    expect(testArray.slice(0, 3)).toEqual([1, 2, 3]);
  });

  test('物件屬性', () => {
    const testObject = {
      name: 'LazyBacktest',
      version: '0.1.1',
      features: ['backtest', 'optimization', 'ai']
    };
    
    expect(testObject).toHaveProperty('name');
    expect(testObject.name).toBe('LazyBacktest');
    expect(testObject.features).toContain('ai');
  });

  test('非同步操作', async () => {
    const asyncOperation = () => {
      return new Promise((resolve) => {
        setTimeout(() => resolve('完成'), 100);
      });
    };
    
    const result = await asyncOperation();
    expect(result).toBe('完成');
  });

  test('錯誤處理', () => {
    const throwError = () => {
      throw new Error('測試錯誤');
    };
    
    expect(throwError).toThrow('測試錯誤');
  });

  test('Mock 函數', () => {
    const mockFn = jest.fn();
    mockFn('參數1', '參數2');
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('參數1', '參數2');
  });

  test('全域 console mock', () => {
    console.log('這應該被 mock');
    expect(console.log).toHaveBeenCalled();
  });

  test('localStorage mock', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.setItem).toHaveBeenCalledWith('test', 'value');
  });

});

describe('數學工具函數測試', () => {
  
  /**
   * 計算移動平均線 (Simple Moving Average)
   * @param {number[]} prices - 價格陣列
   * @param {number} period - 週期
   * @returns {number[]} SMA 值陣列
   */
  const calculateSMA = (prices, period) => {
    if (!Array.isArray(prices) || prices.length < period || period <= 0) {
      return [];
    }
    
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  };

  test('SMA 計算正確性', () => {
    const prices = [10, 20, 30, 40, 50];
    const sma3 = calculateSMA(prices, 3);
    
    expect(sma3).toHaveLength(3);
    expect(sma3[0]).toBe(20); // (10+20+30)/3
    expect(sma3[1]).toBe(30); // (20+30+40)/3  
    expect(sma3[2]).toBe(40); // (30+40+50)/3
  });

  test('SMA 邊界條件', () => {
    expect(calculateSMA([], 5)).toEqual([]);
    expect(calculateSMA([1, 2], 3)).toEqual([]);
    expect(calculateSMA([1, 2, 3], 3)).toEqual([2]);
  });

  test('SMA 無效輸入', () => {
    expect(calculateSMA(null, 5)).toEqual([]);
    expect(calculateSMA([1, 2, 3], 0)).toEqual([]);
  });

});