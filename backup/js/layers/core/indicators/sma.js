/**
 * SMA (Simple Moving Average) 簡單移動平均線計算模組
 * 
 * 簡單移動平均線是最基本的技術指標之一，計算指定週期內價格的算術平均值。
 * 
 * @author LazyBacktest Team
 * @version 1.0.0
 * @since 2025-10-31
 */

/**
 * 計算簡單移動平均線 (SMA)
 * 
 * @param {number[]} prices - 價格陣列，通常是收盤價
 * @param {number} period - 移動平均週期，必須是正整數
 * @param {object} options - 可選參數
 * @param {boolean} options.skipInvalid - 是否跳過無效值 (null, undefined, NaN)，預設 true
 * @param {number} options.precision - 小數點精度，預設不限制
 * @returns {number[]} SMA 值陣列，長度為 max(0, prices.length - period + 1)
 * 
 * @example
 * // 基本用法  
 * const prices = [10, 20, 30, 40, 50];
 * const sma3 = calculateSMA(prices, 3);
 * console.log(sma3); // [20, 30, 40]
 * 
 * @example
 * // 處理無效值
 * const prices = [10, 20, null, 40, 50];
 * const sma3 = calculateSMA(prices, 3, { skipInvalid: true });
 * 
 * @example
 * // 指定精度
 * const prices = [1.1, 2.2, 3.3];
 * const sma3 = calculateSMA(prices, 3, { precision: 2 });
 */
function calculateSMA(prices, period, options = {}) {
  // 參數驗證
  if (!Array.isArray(prices)) {
    return [];
  }
  
  if (!Number.isInteger(period) || period <= 0) {
    return [];
  }
  
  if (prices.length < period) {
    return [];
  }
  
  // 預設選項
  const {
    skipInvalid = true,
    precision = null
  } = options;
  
  const sma = [];
  
  // 計算每個移動窗口的平均值
  for (let i = period - 1; i < prices.length; i++) {
    const window = prices.slice(i - period + 1, i + 1);
    
    // 處理無效值
    let validPrices = window;
    if (skipInvalid) {
      validPrices = window.filter(price => 
        price !== null && 
        price !== undefined && 
        !Number.isNaN(price) &&
        typeof price === 'number'
      );
      
      // 如果有效資料不足，跳過此窗口或使用 NaN
      if (validPrices.length === 0) {
        sma.push(NaN);
        continue;
      }
    } else {
      // 如果不跳過無效值，檢查是否包含無效值
      const hasInvalid = window.some(price => 
        price === null || 
        price === undefined || 
        Number.isNaN(price) ||
        typeof price !== 'number'
      );
      
      if (hasInvalid) {
        sma.push(NaN);
        continue;
      }
    }
    
    // 計算平均值
    const sum = validPrices.reduce((acc, price) => acc + price, 0);
    const average = sum / validPrices.length;
    
    // 應用精度限制
    const finalValue = precision !== null ? 
      Number(average.toFixed(precision)) : 
      average;
      
    sma.push(finalValue);
  }
  
  return sma;
}

/**
 * 計算加權移動平均線 (WMA) - 簡單實作
 * 線性權重，最新值權重最高
 * 
 * @param {number[]} prices - 價格陣列
 * @param {number} period - 移動平均週期
 * @returns {number[]} WMA 值陣列
 */
function calculateWMA(prices, period) {
  if (!Array.isArray(prices) || !Number.isInteger(period) || period <= 0 || prices.length < period) {
    return [];
  }
  
  const wma = [];
  const weightSum = (period * (period + 1)) / 2; // 權重總和: 1+2+...+period
  
  for (let i = period - 1; i < prices.length; i++) {
    let weightedSum = 0;
    
    for (let j = 0; j < period; j++) {
      const weight = j + 1; // 權重從 1 到 period
      const priceIndex = i - period + 1 + j;
      weightedSum += prices[priceIndex] * weight;
    }
    
    wma.push(weightedSum / weightSum);
  }
  
  return wma;
}

/**
 * 驗證價格陣列格式
 * @param {any} prices - 待驗證的價格資料
 * @returns {boolean} 是否為有效的價格陣列
 */
function validatePrices(prices) {
  if (!Array.isArray(prices)) {
    return false;
  }
  
  return prices.every(price => 
    typeof price === 'number' && 
    !Number.isNaN(price) && 
    Number.isFinite(price)
  );
}

/**
 * 取得 SMA 計算的統計資訊
 * @param {number[]} prices - 價格陣列
 * @param {number} period - 週期
 * @returns {object} 統計資訊
 */
function getSMAStats(prices, period) {
  const sma = calculateSMA(prices, period);
  
  if (sma.length === 0) {
    return null;
  }
  
  const validSMA = sma.filter(value => !Number.isNaN(value));
  
  return {
    count: sma.length,
    validCount: validSMA.length,
    min: Math.min(...validSMA),
    max: Math.max(...validSMA),
    first: sma[0],
    last: sma[sma.length - 1],
    average: validSMA.reduce((a, b) => a + b, 0) / validSMA.length
  };
}

// 導出函數 (支援 CommonJS 和 ES6)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateSMA,
    calculateWMA,
    validatePrices,
    getSMAStats
  };
}

// ES6 模組導出 (當支援時)
if (typeof window !== 'undefined') {
  window.SMAIndicator = {
    calculateSMA,
    calculateWMA,
    validatePrices,
    getSMAStats
  };
}