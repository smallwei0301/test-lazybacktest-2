# 核心計算層 (Core Layer)

包含所有純邏輯運算，不依賴 UI 或外部 API，是系統的計算核心。

## 職責

- 技術指標計算 (SMA, EMA, RSI, MACD, 等)
- 回測引擎核心邏輯
- 風險管理計算
- 績效分析算法

## 目錄結構

```
core/
├── indicators/          技術指標計算模組
│   ├── sma.js          Simple Moving Average
│   ├── ema.js          Exponential Moving Average  
│   ├── rsi.js          Relative Strength Index
│   ├── macd.js         MACD 指標
│   ├── bollinger.js    布林通道
│   ├── kd.js           KD 指標
│   └── index.js        統一導出介面
├── backtest-engine.js   回測引擎核心
├── risk-calculator.js  風險計算模組
└── performance-analyzer.js 績效分析模組
```

## 設計原則

1. **純函數**: 所有函數都是純函數，相同輸入產生相同輸出
2. **無副作用**: 不修改輸入參數，不產生副作用
3. **高效能**: 針對大量數據計算進行優化
4. **可組合**: 模組間可以自由組合使用

## 技術指標介面規範

每個技術指標都應該遵循統一的介面：

```javascript
/**
 * 計算技術指標
 * @param {number[]} prices - 價格陣列 
 * @param {object} options - 計算參數
 * @returns {number[]} 指標值陣列
 */
function calculateIndicator(prices, options = {}) {
  // 實作邏輯
}
```