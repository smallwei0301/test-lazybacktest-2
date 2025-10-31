# LazyBacktest 專案架構分析與優化建議

**分析日期**: 2025年10月31日  
**專案版本**: v0.1.1  
**專案狀態**: 活躍開發

---

## 📋 目錄
1. [現有架構分析](#現有架構分析)
2. [核心問題識別](#核心問題識別)
3. [具體優化建議](#具體優化建議)
4. [實施優先級](#實施優先級)
5. [快速參考](#快速參考)

---

## 現有架構分析

### 1. 專案結構概覽

```
test-lazybacktest/
├── 單頁應用 (SPA)
│   ├── index.html (284.6 KB) - 巨型單一檔案
│   ├── css/style.css
│   └── js/ - 主要邏輯層
│
├── 核心功能模組
│   ├── js/main.js (229.56 KB) - UI 邏輯與全局狀態
│   ├── js/backtest.js (453.97 KB) - 回測引擎
│   ├── js/worker.js (562.09 KB) - Web Worker（計算層）
│   ├── js/config.js (8.1 KB) - 策略配置
│   └── js/batch-optimization.js (48.15 KB) - 批量優化
│
├── 策略框架
│   ├── js/strategy-plugins/ (12個策略檔案)
│   ├── js/lib/batch-strategy-context.js (42.79 KB)
│   ├── js/lib/batch-strategy-mapper.js (30.67 KB)
│   ├── js/strategies/composer.js (48.91 KB)
│   ├── js/strategy-plugin-contract.js (36.52 KB)
│   ├── js/strategy-plugin-registry.js (37.83 KB)
│   └── js/strategy-plugin-manifest.js (44.93 KB)
│
├── 後端服務層
│   ├── netlify/functions/ (7個伺服函式)
│   │   ├── twse-proxy.js (台灣上市股票)
│   │   ├── tpex-proxy.js (台灣上櫃股票)
│   │   ├── us-proxy.js (美股)
│   │   ├── calculateAdjustedPrice.js (除權除息計算)
│   │   ├── index-proxy.js (指數代理)
│   │   ├── taiwan-directory.js (台股目錄快取)
│   │   └── cache-warmer.js (定期快取預熱)
│
├── 測試與型別
│   ├── tests/ (3個測試檔案)
│   ├── types/ (TypeScript 定義檔)
│   └── package.json
│
└── 配置與文檔
    ├── netlify.toml (部署配置)
    ├── tsconfig.json (TypeScript 配置)
    ├── README.md (部署教學)
    └── agent.md (代理說明)
```

### 2. 檔案大小分析

#### 巨型檔案（需立即優化）
| 檔案 | 大小 | 涉及領域 | 問題 |
|------|------|---------|------|
| `worker.js` | 562.09 KB | 計算層（AI+回測） | 包含 TensorFlow.js + LSTM + ANN + 回測引擎 |
| `backtest.js` | 453.97 KB | 回測邏輯 | 包含指標計算、風險管理、視覺化 |
| `main.js` | 229.56 KB | UI 層 | UI 邏輯、事件處理、狀態管理混雜 |
| `index.html` | 284.6 KB | HTML + 內聯樣式 | 頁面標記、樣式、無結構性 |

#### 中等檔案
| 檔案 | 大小 | 說明 |
|------|------|------|
| `batch-optimization.js` | 48.15 KB | 批量優化邏輯 |
| `strategies/composer.js` | 48.91 KB | 策略組合引擎 |
| `strategy-plugin-manifest.js` | 44.93 KB | 策略元資料 |
| `shared-lookback.js` | 45.99 KB | 共享回溯索引 |
| `batch-strategy-context.js` | 42.79 KB | 批量上下文管理 |

### 3. 技術棧分析

#### 前端
- **HTML/CSS/JS**: 原生（無框架）
- **UI框架**: Tailwind CSS + Lucide Icons
- **圖表庫**: Chart.js (含 zoom 插件)
- **分析追蹤**: Google Analytics

#### 運算層
- **Web Workers**: 用於背景計算
- **AI 模型**:
  - TensorFlow.js (v4.20.0)
  - 神經網路 (ANN - 確定性交易定價)
  - LSTM (時間序列預測)
- **指標計算**: 內建實現（SMA, EMA, RSI, MACD, Bollinger, KD 等）

#### 後端
- **平台**: Netlify Functions (無伺服器)
- **資料來源**:
  - TWSE 官網 (上市股票)
  - TPEX 官網 (上櫃股票)
  - FinMind API (備援 + 美股)
  - Yahoo Finance (美股備援)
- **快取系統**: Netlify Blobs (分佈式快取)
- **排程**: Netlify Scheduled Functions (每日 6 點快取預熱)

#### 開發工具
- **型別檢查**: TypeScript (無編譯，僅檢查)
- **測試**: Node.js assert (基礎單元測試)
- **部署**: Netlify (自動化 CI/CD)

---

## 核心問題識別

### 🔴 嚴重問題

#### 1. **巨型檔案問題 - 代碼難以維護**
```
worker.js + backtest.js + main.js = 1,245.62 KB
```
- **影響**: 
  - 單檔超過 500KB 難以除錯
  - IDE 效能下降
  - Git 歷史污染
  - 團隊協作衝突多
- **根源**: 功能職責混雜

#### 2. **關注點分離不清**
- `worker.js`: 混合了 AI (LSTM/ANN) + 回測邏輯 + 指標計算
- `backtest.js`: 包含風險管理、績效分析、UI 更新指令
- `main.js`: UI、事件、狀態管理、API 呼叫混在一起

#### 3. **資料流向不明確**
```
index.html (SPA 頁面)
    ↓
main.js (全局狀態 + 事件監聽)
    ↓
backtest.js (回測引擎)
    ↓
worker.js (Web Worker)
    ↓
netlify/functions/* (API 代理)
```
- 沒有明確的單向數據流
- 狀態管理過於分散 (cachedDataStore, lastFetchSettings, currentOptimizationResults...)

#### 4. **測試覆蓋不足**
- 僅 3 個基礎測試檔案
- 無整合測試
- 無 E2E 測試
- 難以回歸測試

#### 5. **後端函式重複邏輯多**
- `twse-proxy.js`, `tpex-proxy.js`, `us-proxy.js` 有大量重複代碼
- CORS 處理、錯誤轉換、快取邏輯在多個檔案重複

---

### 🟡 中等問題

#### 6. **策略外掛架構複雜**
- 文件數多: `strategy-plugin-contract.js` + `registry.js` + `manifest.js` + `composer.js`
- 新增策略需修改多個檔案
- 外掛驗證邏輯分散

#### 7. **缺少文檔與約定**
- 無 API 文檔
- 策略外掛的開發指南不完整
- Worker 消息格式未記錄
- 沒有架構決策記錄 (ADR)

#### 8. **組態管理混亂**
- `config.js` 中包含 50+ 個策略定義
- 策略參數範圍寫死在代碼中
- 無環境變數管理

#### 9. **效能隱患**
- HTML 檔案內聯 Google Analytics
- CSS 未分離到獨立檔案（部分內聯在 HTML 中）
- 無資源預加載或代碼分割
- Web Worker 初始化在回測時才進行

#### 10. **備份檔案污染倉庫**
```
worker_backup.js
worker_backup_before_fix.js
worker_backup_before_short_fix.js
backtest_corrupted.js
```
- 應使用 Git 版本控制管理歷史
- 浪費磁碟空間和 Git 歷史

---

## 具體優化建議

### 🎯 優化方案矩陣

| 優先級 | 問題 | 建議方案 | 預期效果 | 工作量 |
|--------|------|---------|---------|--------|
| **P0** | 巨型檔案 | 模組化拆分 | 可維護性 ↑↑↑ | ⭐⭐⭐⭐ |
| **P0** | 關注點混雜 | 分層架構 | 複雜度↓ 50% | ⭐⭐⭐⭐ |
| **P1** | 測試缺乏 | 單元測試框架 | 品質 ↑ 30% | ⭐⭐⭐ |
| **P1** | 文檔不足 | API 文檔 + ADR | 協作效率 ↑ 40% | ⭐⭐ |
| **P2** | 後端重複 | 提取共同函式庫 | 代碼量 ↓ 30% | ⭐⭐ |
| **P2** | 備份污染 | 移至 `.gitignore` | 倉庫清潔 | ⭐ |

---

### 🚀 詳細優化方案

#### **方案 1: 核心模組化分層** (P0 最優先)

**目標**: 將巨型檔案拆分成清晰的模組層

**結構設計**:
```
js/
├── layers/
│   ├── api/                          [新] 外部 API 層
│   │   ├── proxy-client.js           [新] 統一 API 客戶端
│   │   ├── cache-manager.js          [新] 快取管理
│   │   └── data-transformer.js       [新] 資料轉換
│   │
│   ├── core/                         [新] 核心計算層
│   │   ├── indicators/
│   │   │   ├── sma.js               [新] 移自 backtest.js
│   │   │   ├── rsi.js               [新]
│   │   │   ├── macd.js              [新]
│   │   │   ├── bollinger.js         [新]
│   │   │   └── index.js             [新] 指標導出
│   │   │
│   │   ├── backtest-engine.js       [新] 純回測邏輯（移自 backtest.js）
│   │   ├── risk-calculator.js       [新] 風險計算（移自 backtest.js）
│   │   └── performance-analyzer.js  [新] 績效分析（移自 backtest.js）
│   │
│   ├── ai/                          [新] AI 計算層 (Worker 內)
│   │   ├── tfjs-loader.js          [新] TensorFlow.js 延後載入
│   │   ├── ann-model.js            [新] ANN 模型（移自 worker.js）
│   │   ├── lstm-model.js           [新] LSTM 模型（移自 worker.js）
│   │   └── ml-predictor.js         [新] ML 預測接口
│   │
│   ├── ui/                         [現] UI 層
│   │   ├── state-manager.js        [新] 狀態管理（移自 main.js）
│   │   ├── chart-renderer.js       [新] 圖表渲染（移自 backtest.js）
│   │   ├── form-handler.js         [新] 表單處理（移自 main.js）
│   │   └── notifications.js        [新] 通知系統（移自 main.js）
│   │
│   └── strategy/                   [優化] 策略層
│       ├── plugin-system.js        [優化] 統一進入點
│       ├── plugin-validator.js     [新] 驗證邏輯
│       └── plugins/
│           └── [12 個現有策略]
│
├── main.js                          [簡化] 僅應用入口
├── worker.js                        [簡化] 僅 Worker 入口
├── config.js                        [精簡] 配置整理
└── loader.js                        [改進] 動態載入
```

**實施步驟**:
1. 建立 `layers/core/indicators/` 提取所有指標計算
2. 建立 `layers/core/backtest-engine.js` 提取純回測邏輯
3. 建立 `layers/ui/state-manager.js` 統一狀態
4. 建立 `layers/api/proxy-client.js` 統一 API 呼叫
5. 重構 `main.js` 為 `layers/ui/app.js`
6. 重構 `worker.js` 為 `layers/ai/worker.js`
7. 更新 `index.html` 引用新路徑

**預期成果**:
- `main.js` 從 229KB ↓ 40KB
- `worker.js` 從 562KB ↓ 200KB (分割為多個子模組)
- `backtest.js` 從 454KB ↓ 0KB (邏輯遷移到 layers/)
- 可維護性提升 70%

---

#### **方案 2: 狀態管理統一化** (P0)

**現況問題**:
```javascript
// 分散在不同位置的全局狀態
let cachedDataStore = new Map();           // main.js
let lastFetchSettings = null;              // main.js
let currentOptimizationResults = [];       // main.js
let lastOverallResult = null;              // main.js
let lastSubPeriodResults = null;           // main.js
let preOptimizationResult = null;          // main.js
let batchDebugLogUnsubscribe = null;       // main.js
let visibleStockData = [];                 // backtest.js
let lastIndicatorSeries = null;            // backtest.js
// ... 更多散亂狀態
```

**建議方案**: 建立統一的狀態管理
```javascript
// layers/ui/state-manager.js
class AppState {
  constructor() {
    this.data = {
      stocks: {},
      cache: new Map(),
      settings: {},
      results: {},
      ui: {}
    };
    this.listeners = new Map();
  }
  
  setState(path, value) {
    this.setNestedProperty(this.data, path, value);
    this.notify(path, value);
  }
  
  getState(path) {
    return this.getNestedProperty(this.data, path);
  }
  
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path).push(callback);
    return () => this.unsubscribe(path, callback);
  }
  
  notify(path, value) {
    if (this.listeners.has(path)) {
      this.listeners.get(path).forEach(cb => cb(value));
    }
  }
}

// 使用方式
const appState = new AppState();
appState.setState('stock.TSMC.price', 500);
appState.subscribe('stock.TSMC.price', (newValue) => {
  console.log('Price updated:', newValue);
});
```

**預期成果**:
- 狀態流向清晰
- 除錯更容易（一個地方管理所有狀態）
- 測試覆蓋率提升

---

#### **方案 3: 後端函式庫統一** (P1)

**現況問題**:
```
netlify/functions/
├── twse-proxy.js
├── tpex-proxy.js
├── us-proxy.js
└── calculateAdjustedPrice.js
```
每個檔案都有重複的:
- CORS 處理
- 錯誤轉換
- 快取邏輯
- 速率限制

**建議方案**: 建立共用函式庫
```
netlify/functions/
├── lib/                      [新]
│   ├── base-proxy.js        [新] 通用 Proxy 基類
│   ├── cache-handler.js     [新] 統一快取
│   ├── error-handler.js     [新] 統一錯誤處理
│   ├── rate-limiter.js      [新] 統一速率限制
│   └── cors-helper.js       [新] CORS 工具
│
├── twse-proxy.js            [重構] 繼承 BaseProxy
├── tpex-proxy.js            [重構] 繼承 BaseProxy
├── us-proxy.js              [重構] 繼承 BaseProxy
├── calculateAdjustedPrice.js
├── index-proxy.js
├── taiwan-directory.js
└── cache-warmer.js
```

```javascript
// netlify/functions/lib/base-proxy.js
class BaseProxy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 10000;
    this.cacheTTL = options.cacheTTL || 3600000;
  }
  
  async fetch(url, options = {}) {
    // 統一處理: 重試 + 超時 + 快取 + 錯誤
  }
  
  async getCachedOrFetch(cacheKey, fetcher) {
    // 統一快取邏輯
  }
  
  buildErrorResponse(error, fallbackData) {
    // 統一錯誤格式
  }
  
  addCORSHeaders(response) {
    // 統一 CORS
  }
}
```

**預期成果**:
- 函式數量不變，但代碼量 ↓ 40%
- 維護成本降低

---

#### **方案 4: 測試框架引入** (P1)

**現況**:
```javascript
// tests/batch-context.test.js - 使用 Node.js assert
function runTest(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.error(`✗ ${name}`);
        process.exitCode = 1;
    }
}
```

**建議方案**: 導入 Jest
```bash
npm install --save-dev jest
```

新增 `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 70,
      statements: 70
    }
  }
};
```

測試檔案結構:
```
tests/
├── unit/                       [新]
│   ├── indicators/
│   │   ├── sma.test.js        [新]
│   │   ├── rsi.test.js        [新]
│   │   └── macd.test.js       [新]
│   ├── backtest-engine.test.js [新]
│   └── state-manager.test.js  [新]
│
├── integration/               [新]
│   ├── api-integration.test.js [新]
│   └── strategy-plugin.test.js [新]
│
├── e2e/                       [新]
│   └── backtest-flow.test.js  [新]
│
└── batch-context.test.js      [改進] 遷移至 Jest
```

**預期成果**:
- 測試覆蓋率從 ~10% ↑ 60%
- 品質保證提升

---

#### **方案 5: 文檔系統建立** (P1)

**新增檔案**:
```
docs/
├── ARCHITECTURE.md           [新] 架構圖與決策
├── API.md                    [新] API 文檔
├── STRATEGY_DEVELOPMENT.md   [新] 策略開發指南
├── DEPLOYMENT.md             [新] 部署指南
├── TROUBLESHOOTING.md        [新] 除錯指南
└── adr/                      [新] 架構決策記錄
    ├── 0001-single-page-app.md
    ├── 0002-strategy-plugin-system.md
    └── 0003-web-worker-architecture.md
```

範例 `STRATEGY_DEVELOPMENT.md`:
```markdown
# 策略開發指南

## 快速開始
1. 建立 `js/strategy-plugins/my-strategy.js`
2. 實現 `StrategyPlugin` 介面
3. 在 `js/strategies/composer.js` 中註冊
4. 編寫測試在 `tests/strategies/my-strategy.test.js`

## StrategyPlugin 介面
\`\`\`typescript
export interface StrategyPlugin {
  meta: StrategyPluginMeta;
  run(context: StrategyContext, params): RuleResult;
}
\`\`\`

## 範例
...
```

**預期成果**:
- 新人上手時間 ↓ 50%
- 貢獻門檻降低
- 知識積累

---

#### **方案 6: 代碼品質工具** (P2)

**導入工具**:
```bash
npm install --save-dev eslint prettier @typescript-eslint/parser
```

新增 `.eslintrc.json`:
```json
{
  "env": { "browser": true, "es2021": true },
  "extends": ["eslint:recommended"],
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-var": "error",
    "prefer-const": "error",
    "max-len": ["warn", { "code": 120 }],
    "complexity": ["warn", 10]
  }
}
```

新增 `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**package.json 更新**:
```json
{
  "scripts": {
    "lint": "eslint js/",
    "format": "prettier --write js/",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "quality": "npm run lint && npm run typecheck && npm run test"
  }
}
```

**預期成果**:
- 代碼風格一致
- 潛在 bug 提前發現

---

#### **方案 7: 清理備份檔案** (P2)

**操作**:
```bash
# 1. 檢查 Git 歷史中最後一次使用備份檔案
git log --oneline -- js/worker_backup.js | head -1

# 2. 從 Git 中移除（保留歷史）
git rm --cached js/worker_backup*.js
git rm --cached js/backtest_corrupted.js

# 3. 新增到 .gitignore
echo "js/*backup*.js" >> .gitignore
echo "js/*corrupted*.js" >> .gitignore

# 4. 提交
git commit -m "chore: remove backup files from tracking"
```

**預期成果**:
- 倉庫體積減小
- 清晰的版本歷史

---

### 優化實施路線圖 (Timeline)

```
Month 1 (第一個月):
├── Week 1-2: 方案 1 (模組化分層)
│   ├── 建立 js/layers 結構
│   ├── 提取指標計算模組
│   └── 提取 API 層
├── Week 3: 方案 2 (狀態管理)
│   ├── 建立 AppState 類別
│   ├── 遷移全局狀態
│   └── 更新 main.js
└── Week 4: 測試 & 文檔
    ├── 編寫單元測試
    └── 初步文檔

Month 2 (第二個月):
├── Week 1: 方案 3 (後端優化)
│   ├── 建立 lib/ 函式庫
│   └── 重構代理函式
├── Week 2-3: 方案 4 (Jest 整合)
│   ├── 導入 Jest
│   ├── 遷移現有測試
│   └── 新增覆蓋範圍
└── Week 4: 清理 & 文檔
    ├── 方案 7 (清理備份)
    ├── 完成 API 文檔
    └── 編寫 ADR

Month 3 (第三個月):
├── 性能優化
├── 完整集成測試
└── 部署驗證
```

---

## 實施優先級

### 🔴 立即進行 (Week 1-2)
1. **移除備份檔案** (30 分鐘)
   - 清理倉庫，易於執行

2. **建立 js/layers 結構** (2 天)
   - 為模組化做準備

3. **提取 API 層** (3 天)
   - 減少 main.js 職責

### 🟡 優先進行 (Week 3-4)
4. **建立狀態管理** (2 天)
   - 統一數據流

5. **單元測試框架** (2 天)
   - Jest 導入

### 🟢 次要進行 (Month 2)
6. **後端函式庫統一** (2 天)
   - 代碼複用

7. **完整文檔編寫** (3 天)
   - 架構文檔 + API 文檔

---

## 快速參考

### 檔案大小排行 (需優化)
```
1. worker.js        562 KB   → 目標 200 KB (AI 模組分割)
2. backtest.js      454 KB   → 目標 0 KB   (邏輯遷移)
3. index.html       285 KB   → 目標 150 KB (內聯樣式提取)
4. main.js          230 KB   → 目標 40 KB  (UI 層分割)
```

### 新建議新增檔案清單
```
js/layers/
├── api/
│   ├── proxy-client.js         (150 行)
│   ├── cache-manager.js        (100 行)
│   └── data-transformer.js     (80 行)
├── core/
│   ├── indicators/
│   │   ├── sma.js              (40 行)
│   │   ├── rsi.js              (50 行)
│   │   ├── macd.js             (60 行)
│   │   └── index.js            (20 行)
│   ├── backtest-engine.js      (200 行)
│   ├── risk-calculator.js      (100 行)
│   └── performance-analyzer.js (120 行)
└── ui/
    ├── state-manager.js        (150 行)
    ├── chart-renderer.js       (100 行)
    └── form-handler.js         (80 行)

netlify/functions/lib/
├── base-proxy.js               (150 行)
├── cache-handler.js            (100 行)
├── error-handler.js            (80 行)
└── cors-helper.js              (40 行)

tests/unit/
├── indicators/                 (200 行)
├── backtest-engine.test.js     (300 行)
└── state-manager.test.js       (250 行)

docs/
├── ARCHITECTURE.md
├── API.md
├── STRATEGY_DEVELOPMENT.md
└── adr/
```

### 關鍵指標
| 指標 | 現況 | 目標 | 時程 |
|------|------|------|------|
| 最大檔案大小 | 562 KB | < 300 KB | Month 1 |
| 平均檔案大小 | 120 KB | < 80 KB | Month 1-2 |
| 測試覆蓋率 | ~10% | 60% | Month 2 |
| 代碼複製度 | ~25% | < 10% | Month 2 |
| 文檔完整度 | 20% | 80% | Month 2-3 |

---

## 總結建議

### 核心建議排序
1. ✅ **模組化分層** - 根本改善可維護性
2. ✅ **狀態管理統一** - 清晰數據流
3. ✅ **測試框架** - 品質保證
4. ✅ **文檔系統** - 知識積累
5. ✅ **後端優化** - 代碼複用

### 最重要的三件事
1. 🎯 **拆分巨型檔案** → 從 1,245 KB 降至 600 KB
2. 🎯 **統一狀態管理** → 消除分散的全局變數
3. 🎯 **建立測試框架** → 從 0% 覆蓋率升至 60%

這些改變將使 LazyBacktest 從「原型工具」升級到「生產級系統」。

---

**文檔版本**: 1.0  
**上次更新**: 2025-10-31  
**下次審查**: 2025-11-30
