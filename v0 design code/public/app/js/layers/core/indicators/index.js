/**
 * 技術指標統一導出模組
 * 
 * 這個模組提供所有技術指標的統一導出介面，
 * 方便其他模組引用和使用各種技術指標計算函數。
 * 
 * @author LazyBacktest Team
 * @version 1.0.0
 * @since 2025-10-31
 */

// 引入各個指標模組
const SMAIndicator = require('./sma.js');
const RSIIndicator = require('./rsi.js');

/**
 * 所有可用的技術指標列表
 */
const AVAILABLE_INDICATORS = {
  SMA: 'Simple Moving Average - 簡單移動平均線',
  WMA: 'Weighted Moving Average - 加權移動平均線', 
  RSI: 'Relative Strength Index - 相對強弱指標',
  // TODO: 後續新增的指標
  // EMA: 'Exponential Moving Average - 指數移動平均線',
  // MACD: 'Moving Average Convergence Divergence - MACD 指標',
  // BOLLINGER: 'Bollinger Bands - 布林通道',
  // KD: 'Stochastic Oscillator - 隨機指標'
};

/**
 * 技術指標計算器類別
 * 提供統一的介面來計算各種技術指標
 */
class IndicatorCalculator {
  constructor() {
    this.indicators = {
      sma: SMAIndicator,
      rsi: RSIIndicator
    };
  }
  
  /**
   * 計算 SMA
   * @param {number[]} prices - 價格陣列
   * @param {number} period - 週期
   * @param {object} options - 選項
   * @returns {number[]} SMA 值
   */
  calculateSMA(prices, period, options) {
    return this.indicators.sma.calculateSMA(prices, period, options);
  }
  
  /**
   * 計算 WMA
   * @param {number[]} prices - 價格陣列
   * @param {number} period - 週期
   * @returns {number[]} WMA 值
   */
  calculateWMA(prices, period) {
    return this.indicators.sma.calculateWMA(prices, period);
  }
  
  /**
   * 計算 RSI
   * @param {number[]} prices - 價格陣列
   * @param {number} period - 週期
   * @param {object} options - 選項
   * @returns {number[]} RSI 值
   */
  calculateRSI(prices, period, options) {
    return this.indicators.rsi.calculateRSI(prices, period, options);
  }
  
  /**
   * 取得所有可用指標的清單
   * @returns {object} 指標清單
   */
  getAvailableIndicators() {
    return AVAILABLE_INDICATORS;
  }
  
  /**
   * 驗證指標參數
   * @param {string} indicatorName - 指標名稱
   * @param {any} prices - 價格資料
   * @param {any} period - 週期
   * @returns {object} 驗證結果
   */
  validateParams(indicatorName, prices, period) {
    switch (indicatorName.toLowerCase()) {
      case 'sma':
      case 'wma':
        return this.indicators.sma.validatePrices ? 
          this.indicators.sma.validatePrices(prices) ? 
            { valid: true, errors: [] } : 
            { valid: false, errors: ['Invalid price data'] } :
          { valid: Array.isArray(prices) && period > 0, errors: [] };
          
      case 'rsi':
        return this.indicators.rsi.validateRSIParams(prices, period);
        
      default:
        return { valid: false, errors: [`Unknown indicator: ${indicatorName}`] };
    }
  }
  
  /**
   * 批量計算多個指標
   * @param {number[]} prices - 價格陣列
   * @param {object[]} indicatorConfigs - 指標配置陣列
   * @returns {object} 計算結果
   */
  calculateMultiple(prices, indicatorConfigs) {
    const results = {};
    const errors = [];
    
    for (const config of indicatorConfigs) {
      const { name, period, options = {} } = config;
      
      try {
        const validation = this.validateParams(name, prices, period);
        if (!validation.valid) {
          errors.push({ indicator: name, errors: validation.errors });
          continue;
        }
        
        switch (name.toLowerCase()) {
          case 'sma':
            results[`${name}_${period}`] = this.calculateSMA(prices, period, options);
            break;
          case 'wma':
            results[`${name}_${period}`] = this.calculateWMA(prices, period);
            break;
          case 'rsi':
            results[`${name}_${period}`] = this.calculateRSI(prices, period, options);
            break;
          default:
            errors.push({ indicator: name, errors: [`Unsupported indicator: ${name}`] });
        }
      } catch (error) {
        errors.push({ indicator: name, errors: [error.message] });
      }
    }
    
    return { results, errors };
  }
}

// 建立全域計算器實例
const calculator = new IndicatorCalculator();

// 直接導出函數 (與原有程式碼相容)
const {
  calculateSMA,
  calculateWMA,
  validatePrices,
  getSMAStats
} = SMAIndicator;

const {
  calculateRSI,
  getRSIStats,
  detectRSISignals,
  validateRSIParams
} = RSIIndicator;

// CommonJS 導出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // 統一計算器
    IndicatorCalculator,
    calculator,
    
    // 直接函數導出
    calculateSMA,
    calculateWMA,
    validatePrices,
    getSMAStats,
    
    calculateRSI,
    getRSIStats,
    detectRSISignals,
    validateRSIParams,
    
    // 常數
    AVAILABLE_INDICATORS
  };
}

// 瀏覽器環境導出
if (typeof window !== 'undefined') {
  window.TechnicalIndicators = {
    IndicatorCalculator,
    calculator,
    
    calculateSMA,
    calculateWMA,
    validatePrices,
    getSMAStats,
    
    calculateRSI,
    getRSIStats,
    detectRSISignals,
    validateRSIParams,
    
    AVAILABLE_INDICATORS
  };
}