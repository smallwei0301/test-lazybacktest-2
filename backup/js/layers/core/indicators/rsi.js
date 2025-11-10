/**
 * RSI (Relative Strength Index) 相對強弱指標計算模組
 * 
 * RSI 是技術分析中最重要的振盪指標之一，用於衡量價格變動的速度和幅度。
 * RSI 值在 0-100 之間，通常 70 以上視為超買，30 以下視為超賣。
 * 
 * 計算方式：
 * 1. 計算價格變化 (gains 和 losses)
 * 2. 計算平均增幅和平均跌幅 (使用 EMA)
 * 3. RS = 平均增幅 / 平均跌幅
 * 4. RSI = 100 - (100 / (1 + RS))
 * 
 * @author LazyBacktest Team
 * @version 1.0.0
 * @since 2025-10-31
 */

/**
 * 計算相對強弱指標 (RSI)
 * 
 * @param {number[]} prices - 價格陣列，通常是收盤價
 * @param {number} period - 計算週期，預設 14
 * @param {object} options - 可選參數
 * @param {boolean} options.useEMA - 是否使用 EMA 計算平均值，預設 true
 * @param {boolean} options.skipInvalid - 是否跳過無效值，預設 true
 * @param {number} options.precision - 小數點精度，預設 2
 * @returns {number[]} RSI 值陣列，長度為 max(0, prices.length - period)
 * 
 * @example
 * // 基本用法
 * const prices = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85];
 * const rsi = calculateRSI(prices, 7);
 * console.log(rsi); // [RSI 值]
 * 
 * @example
 * // 使用 SMA 代替 EMA
 * const rsi = calculateRSI(prices, 14, { useEMA: false });
 */
function calculateRSI(prices, period = 14, options = {}) {
  // 參數驗證
  if (!Array.isArray(prices)) {
    return [];
  }
  
  if (!Number.isInteger(period) || period <= 0) {
    return [];
  }
  
  if (prices.length <= period) {
    return [];
  }
  
  // 預設選項
  const {
    useEMA = true,
    skipInvalid = true,
    precision = 2
  } = options;
  
  // 過濾無效值
  let validPrices = prices;
  if (skipInvalid) {
    validPrices = prices.filter(price => 
      price !== null && 
      price !== undefined && 
      !Number.isNaN(price) &&
      typeof price === 'number' &&
      Number.isFinite(price)
    );
    
    if (validPrices.length <= period) {
      return [];
    }
  }
  
  // 計算價格變化
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < validPrices.length; i++) {
    const change = validPrices[i] - validPrices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  const rsi = [];
  
  if (useEMA) {
    // 使用 EMA 方法 (Wilder's 方法)
    
    // 第一個週期使用 SMA
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    // 計算第一個 RSI
    let rs = avgLoss === 0 ? (avgGain === 0 ? 1 : 100) : avgGain / avgLoss;
    let rsiValue = 100 - (100 / (1 + rs));
    rsi.push(precision !== null ? Number(rsiValue.toFixed(precision)) : rsiValue);
    
    // 後續使用 EMA (Wilder's smoothing)
    const alpha = 1 / period;
    
    for (let i = period; i < gains.length; i++) {
      avgGain = (1 - alpha) * avgGain + alpha * gains[i];
      avgLoss = (1 - alpha) * avgLoss + alpha * losses[i];
      
      rs = avgLoss === 0 ? (avgGain === 0 ? 1 : 100) : avgGain / avgLoss;
      rsiValue = 100 - (100 / (1 + rs));
      rsi.push(precision !== null ? Number(rsiValue.toFixed(precision)) : rsiValue);
    }
    
  } else {
    // 使用 SMA 方法
    for (let i = period - 1; i < gains.length; i++) {
      const periodGains = gains.slice(i - period + 1, i + 1);
      const periodLosses = losses.slice(i - period + 1, i + 1);
      
      const avgGain = periodGains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = periodLosses.reduce((a, b) => a + b, 0) / period;
      
      const rs = avgLoss === 0 ? (avgGain === 0 ? 1 : 100) : avgGain / avgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      
      rsi.push(precision !== null ? Number(rsiValue.toFixed(precision)) : rsiValue);
    }
  }
  
  return rsi;
}

/**
 * 計算 RSI 的統計資訊
 * @param {number[]} rsiValues - RSI 值陣列
 * @returns {object|null} 統計資訊
 */
function getRSIStats(rsiValues) {
  if (!Array.isArray(rsiValues) || rsiValues.length === 0) {
    return null;
  }
  
  const validRSI = rsiValues.filter(value => !Number.isNaN(value));
  
  if (validRSI.length === 0) {
    return null;
  }
  
  const sorted = [...validRSI].sort((a, b) => a - b);
  
  return {
    count: validRSI.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: validRSI.reduce((a, b) => a + b, 0) / validRSI.length,
    median: sorted.length % 2 === 0 ? 
      (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 :
      sorted[Math.floor(sorted.length / 2)],
    overbought: validRSI.filter(v => v > 70).length,
    oversold: validRSI.filter(v => v < 30).length,
    neutral: validRSI.filter(v => v >= 30 && v <= 70).length
  };
}

/**
 * 檢測 RSI 信號
 * @param {number[]} rsiValues - RSI 值陣列
 * @param {object} options - 信號參數
 * @returns {object[]} 信號陣列
 */
function detectRSISignals(rsiValues, options = {}) {
  const {
    overboughtLevel = 70,
    oversoldLevel = 30,
    minSignalGap = 5  // 信號間最小間隔
  } = options;
  
  if (!Array.isArray(rsiValues) || rsiValues.length < 2) {
    return [];
  }
  
  const signals = [];
  let lastSignalIndex = -minSignalGap - 1;
  
  for (let i = 1; i < rsiValues.length; i++) {
    const prev = rsiValues[i - 1];
    const curr = rsiValues[i];
    
    if (Number.isNaN(prev) || Number.isNaN(curr)) {
      continue;
    }
    
    // 檢查間隔
    if (i - lastSignalIndex <= minSignalGap) {
      continue;
    }
    
    // 超買轉賣信號
    if (prev >= overboughtLevel && curr < overboughtLevel) {
      signals.push({
        index: i,
        type: 'sell',
        reason: 'overbought_exit',
        rsi: curr,
        strength: Math.min((prev - overboughtLevel) / (100 - overboughtLevel), 1)
      });
      lastSignalIndex = i;
    }
    
    // 超賣轉買信號
    if (prev <= oversoldLevel && curr > oversoldLevel) {
      signals.push({
        index: i,
        type: 'buy',
        reason: 'oversold_exit',
        rsi: curr,
        strength: Math.min((oversoldLevel - prev) / oversoldLevel, 1)
      });
      lastSignalIndex = i;
    }
  }
  
  return signals;
}

/**
 * 驗證 RSI 參數
 * @param {any} prices - 價格資料
 * @param {any} period - 週期參數
 * @returns {object} 驗證結果
 */
function validateRSIParams(prices, period) {
  const errors = [];
  
  if (!Array.isArray(prices)) {
    errors.push('價格必須是陣列');
  } else if (prices.length === 0) {
    errors.push('價格陣列不能為空');
  }
  
  if (!Number.isInteger(period)) {
    errors.push('週期必須是整數');
  } else if (period <= 0) {
    errors.push('週期必須大於 0');
  } else if (Array.isArray(prices) && prices.length <= period) {
    errors.push(`資料長度 (${prices.length}) 必須大於週期 (${period})`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 導出函數 (支援 CommonJS 和 ES6)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateRSI,
    getRSIStats,
    detectRSISignals,
    validateRSIParams
  };
}

// ES6 模組導出 (當支援時)
if (typeof window !== 'undefined') {
  window.RSIIndicator = {
    calculateRSI,
    getRSIStats,
    detectRSISignals,
    validateRSIParams
  };
}