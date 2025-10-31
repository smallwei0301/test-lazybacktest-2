# 🎵 Vibe Coding 助手指南

## 快速開始

**當您進行 Vibe Coding（邊聽音樂邊寫代碼）時，如何讓 AI 助手自動遵循您的架構和測試流程。**

---

## 📋 目錄

1. [核心概念](#核心概念)
2. [架構規則](#架構規則)
3. [代碼修改模板](#代碼修改模板)
4. [快速提示詞](#快速提示詞)
5. [修改檢查清單](#修改檢查清單)
6. [常見場景指南](#常見場景指南)
7. [故障排查](#故障排查)

---

## 🎯 核心概念

### Vibe Coding 工作流

```
您的想法 → 告訴 AI → AI 生成代碼 → 驗證 → 測試 → 完成
  ↑                                              ↓
  └──────────────────────────────────────────────┘
              修改和迭代
```

### AI 助手的責任

✅ **必須做**
- 遵循 7 層架構
- 在正確的層添加代碼
- 編寫對應的測試
- 檢查現有測試

❌ **不應做**
- 跨越層的邊界
- 在不同層混合邏輯
- 跳過測試編寫
- 使用不符合架構的模式

---

## 🏗️ 架構規則

### 項目架構總覽

```
┌─────────────────────────────────────────────────────┐
│ js/layers/                                          │
├─────────────────────────────────────────────────────┤
│ api/           → 外部數據來源（API、網絡請求）      │
│ ├─ proxy-client.js                                 │
├─────────────────────────────────────────────────────┤
│ core/          → 業務邏輯（計算、算法、管理）        │
│ ├─ backtest-engine.js                              │
│ ├─ strategy-manager.js                             │
│ ├─ indicators.js                                   │
├─────────────────────────────────────────────────────┤
│ ui/            → 用戶界面（顯示、交互）              │
│ ├─ ui-controller.js                                │
│ ├─ state-manager.js                                │
├─────────────────────────────────────────────────────┤
│ utils/         → 工具函數（通用、輔助）              │
│ ├─ date-utils.js                                   │
│ ├─ math-utils.js                                   │
│ ├─ format-utils.js                                 │
├─────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────┘
```

### 層級職責

#### 1️⃣ API 層 (`api/proxy-client.js`)
**職責**: 所有外部數據通信

```javascript
// ✅ 正確: 獲取股票數據
async getStockData(ticker) {
  return fetch(`/api/stock/${ticker}`);
}

// ❌ 錯誤: 在 API 層做數據計算
calculateProfit(data) {
  return data.close - data.open; // 這應該在 Core 層
}
```

**規則**:
- 只負責 HTTP 請求/響應
- 只做基本的驗證和錯誤處理
- 不做業務邏輯計算
- 需要有超時和重試機制

---

#### 2️⃣ Core 層 - 子模塊

**A) 回測引擎 (`core/backtest-engine.js`)**
職責: 執行回測和計算統計數據

```javascript
// ✅ 正確: 計算回測結果
calculateStats(trades) {
  return {
    winRate: trades.wins / trades.total,
    profitFactor: trades.profit / Math.abs(trades.loss),
    sharpeRatio: this.calculateSharpe(trades)
  };
}

// ❌ 錯誤: 獲取外部數據
async fetchHistoricalData() {
  // 這應該在 API 層
}
```

**規則**:
- 處理所有回測邏輯
- 計算性能指標
- 生成交易信號
- 編寫測試驗證計算準確性

---

**B) 策略管理器 (`core/strategy-manager.js`)**
職責: 管理交易策略

```javascript
// ✅ 正確: 管理策略
registerStrategy(name, config) {
  this.strategies[name] = new Strategy(config);
  this.validate(config);
}

// ❌ 錯誤: 直接計算指標
calculateRSI(data) {
  // 這應該在 indicators.js
}
```

**規則**:
- 註冊和管理策略
- 驗證策略配置
- 管理策略版本
- 使用 Indicators 進行計算

---

**C) 指標計算 (`core/indicators.js`)**
職責: 所有技術指標計算

```javascript
// ✅ 正確: 計算 SMA
calculateSMA(data, period) {
  return data.slice(-period).reduce((a,b) => a+b) / period;
}

// ❌ 錯誤: 從 API 獲取數據
async getHistoricalData() {
  // 這應該在 API 層
}
```

**規則**:
- 只做數學計算
- 無狀態的純函數
- 快速且優化（支持大量數據）
- 單元測試要覆蓋所有場景

---

#### 3️⃣ UI 層

**A) UI 控制器 (`ui/ui-controller.js`)**
職責: 處理用戶交互

```javascript
// ✅ 正確: 從表單獲取數據
getFormData() {
  return {
    ticker: document.getElementById('ticker').value,
    startDate: document.getElementById('startDate').value
  };
}

// ❌ 錯誤: 做業務計算
calculateProfit(data) {
  // 這應該在 Core 層
}
```

**規則**:
- 處理 DOM 元素
- 收集用戶輸入
- 調用 Core 層邏輯
- 使用 StateManager 保存狀態

---

**B) 狀態管理器 (`ui/state-manager.js`)**
職責: 管理應用狀態

```javascript
// ✅ 正確: 保存和檢索狀態
saveState(key, value) {
  this.cache[key] = value;
  localStorage.setItem(key, JSON.stringify(value));
}

// ❌ 錯誤: 計算狀態內容
deriveBacktestResults(data) {
  // 這應該在 BacktestEngine
}
```

**規則**:
- 持久化應用狀態
- 管理 localStorage 和內存緩存
- 清理過期數據
- 同步狀態變化

---

#### 4️⃣ Utils 層
職責: 通用工具函數

```javascript
// ✅ 正確的工具函數

// date-utils.js
formatDate(date) { }
parseDate(dateStr) { }

// math-utils.js
roundTo(value, decimals) { }
calculatePercentage(value, total) { }

// format-utils.js
formatCurrency(value) { }
formatPercent(value) { }
```

**規則**:
- 純函數，無副作用
- 可被任何層使用
- 高度可復用
- 完整的單元測試

---

## 📝 代碼修改模板

### 📋 修改 API 層

**場景**: 添加新的 API 端點

```javascript
// 📁 js/layers/api/proxy-client.js

// 3️⃣ 添加方法
async getNewData(param) {
  try {
    const response = await this.withRetry(
      () => fetch(`/api/new-endpoint?param=${param}`, {
        timeout: this.timeout
      })
    );
    
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  } catch (error) {
    this.handleError(error);
    throw error;
  }
}

// 📝 對應的測試
// 📁 tests/unit/api/proxy-client.test.js

test('should fetch new data successfully', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => ({ data: 'test' })
  });
  
  const result = await client.getNewData('test-param');
  expect(result).toEqual({ data: 'test' });
  expect(fetch).toHaveBeenCalledWith(
    '/api/new-endpoint?param=test-param',
    expect.any(Object)
  );
});

test('should retry on failure', async () => {
  // 測試重試機制
});

test('should timeout on slow request', async () => {
  // 測試超時
});
```

✅ **檢查清單**
- [ ] 使用 `withRetry` 機制
- [ ] 有錯誤處理
- [ ] 有超時設置
- [ ] 編寫了單元測試
- [ ] 測試覆蓋正常、異常、超時場景

---

### 📋 修改 Core 層 - BacktestEngine

**場景**: 添加新的性能指標

```javascript
// 📁 js/layers/core/backtest-engine.js

class BacktestEngine {
  // 添加新方法
  calculateNewMetric(trades) {
    // 驗證輸入
    if (!Array.isArray(trades) || trades.length === 0) {
      return 0;
    }
    
    // 計算邏輯
    const metric = trades.reduce((sum, trade) => {
      return sum + trade.profit;
    }, 0) / trades.length;
    
    return this.roundTo(metric, 2);
  }
  
  // 輔助方法
  roundTo(value, decimals) {
    return Math.round(value * Math.pow(10, decimals)) / 
           Math.pow(10, decimals);
  }
}

// 📝 對應的測試
// 📁 tests/unit/core/backtest-engine.test.js

describe('calculateNewMetric', () => {
  test('should calculate average profit correctly', () => {
    const trades = [
      { profit: 100 },
      { profit: 200 },
      { profit: 300 }
    ];
    
    const result = engine.calculateNewMetric(trades);
    expect(result).toBe(200);
  });
  
  test('should handle empty trades array', () => {
    expect(engine.calculateNewMetric([])).toBe(0);
  });
  
  test('should handle single trade', () => {
    const trades = [{ profit: 150 }];
    expect(engine.calculateNewMetric(trades)).toBe(150);
  });
  
  test('should round correctly to 2 decimals', () => {
    const trades = [{ profit: 100.555 }];
    expect(engine.calculateNewMetric(trades)).toBe(100.56);
  });
});
```

✅ **檢查清單**
- [ ] 輸入驗證
- [ ] 邊界情況處理
- [ ] 計算邏輯清晰
- [ ] 編寫了單元測試
- [ ] 測試覆蓋所有情況

---

### 📋 修改 Core 層 - Indicators

**場景**: 添加新的技術指標

```javascript
// 📁 js/layers/core/indicators.js

class Indicators {
  // 新指標: 加權移動平均線 (WMA)
  calculateWMA(data, period) {
    // 輸入驗證
    if (!Array.isArray(data) || data.length < period) {
      throw new Error(`需要至少 ${period} 個數據點`);
    }
    
    // 計算權重
    const weights = Array.from(
      { length: period }, 
      (_, i) => (i + 1) / (period * (period + 1) / 2)
    );
    
    // 計算 WMA
    const wma = data.slice(-period).reduce((sum, value, idx) => {
      return sum + value * weights[idx];
    }, 0);
    
    return Math.round(wma * 100) / 100;
  }
}

// 📝 對應的測試
// 📁 tests/unit/core/indicators.test.js

describe('calculateWMA', () => {
  test('should calculate WMA correctly', () => {
    const data = [10, 20, 30, 40, 50];
    const wma = indicators.calculateWMA(data, 5);
    
    // WMA = (10*1 + 20*2 + 30*3 + 40*4 + 50*5) / 15
    const expected = (10 + 40 + 90 + 160 + 250) / 15;
    expect(wma).toBeCloseTo(expected, 2);
  });
  
  test('should throw error for insufficient data', () => {
    expect(() => {
      indicators.calculateWMA([1, 2], 5);
    }).toThrow('需要至少 5 個數據點');
  });
  
  test('should handle large datasets efficiently', () => {
    const data = Array.from({ length: 10000 }, () => Math.random() * 100);
    const start = Date.now();
    const wma = indicators.calculateWMA(data, 20);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100); // 性能測試
    expect(wma).toBeGreaterThan(0);
  });
});
```

✅ **檢查清單**
- [ ] 輸入驗證
- [ ] 有意義的錯誤信息
- [ ] 計算準確性測試
- [ ] 邊界情況測試
- [ ] 性能測試（大數據集）

---

### 📋 修改 UI 層

**場景**: 添加新的表單字段

```javascript
// 📁 js/layers/ui/ui-controller.js

class UIController {
  // 添加新的表單字段提取方法
  getNewFormField() {
    const element = document.getElementById('newField');
    if (!element) {
      throw new Error('表單字段不存在');
    }
    return element.value.trim();
  }
  
  // 添加表單驗證
  validateNewField(value) {
    if (!value) return { valid: false, error: '字段不能為空' };
    if (value.length > 100) return { valid: false, error: '字段太長' };
    return { valid: true };
  }
  
  // 處理表單提交
  handleNewFieldSubmit() {
    try {
      const value = this.getNewFormField();
      const validation = this.validateNewField(value);
      
      if (!validation.valid) {
        this.showError(validation.error);
        return;
      }
      
      // 調用 Core 層邏輯
      const result = this.engineCore.processNewField(value);
      this.displayResult(result);
      
      // 保存到狀態
      this.stateManager.saveState('newField', value);
    } catch (error) {
      this.showError(error.message);
    }
  }
}

// 📝 對應的測試
// 📁 tests/unit/ui/ui-controller.test.js

describe('UIController - New Field', () => {
  let controller;
  let mockDOM;
  
  beforeEach(() => {
    mockDOM = {
      getElementById: jest.fn((id) => ({
        value: 'test-value',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }))
    };
    controller = new UIController(mockDOM);
  });
  
  test('should extract form field value', () => {
    const value = controller.getNewFormField();
    expect(value).toBe('test-value');
  });
  
  test('should validate field successfully', () => {
    const result = controller.validateNewField('valid-value');
    expect(result.valid).toBe(true);
  });
  
  test('should reject empty field', () => {
    const result = controller.validateNewField('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('不能為空');
  });
  
  test('should reject too long field', () => {
    const result = controller.validateNewField('a'.repeat(101));
    expect(result.valid).toBe(false);
  });
  
  test('should handle form submit successfully', () => {
    controller.stateManager = { saveState: jest.fn() };
    controller.engineCore = { processNewField: jest.fn().mockReturnValue({ success: true }) };
    controller.displayResult = jest.fn();
    
    controller.handleNewFieldSubmit();
    
    expect(controller.stateManager.saveState).toHaveBeenCalledWith('newField', 'test-value');
    expect(controller.displayResult).toHaveBeenCalled();
  });
});
```

✅ **檢查清單**
- [ ] DOM 元素存在檢查
- [ ] 字段值驗證
- [ ] 錯誤處理
- [ ] 調用 Core 層邏輯（而不是直接計算）
- [ ] 保存狀態到 StateManager
- [ ] 編寫了單元測試

---

## 🚀 快速提示詞

### 用法

**直接複製這些提示詞，粘貼給 AI 助手。AI 會自動按照架構修改代碼。**

---

### 1️⃣ 添加新 API 端點

```
我要添加一個新的 API 端點來獲取 [數據類型]。

請按照 LazyBacktest 架構：
1. 在 js/layers/api/proxy-client.js 中添加新方法
2. 包含錯誤處理、重試和超時機制
3. 在 tests/unit/api/proxy-client.test.js 中編寫測試

參數：
- 端點: [API 路徑]
- 參數: [參數列表]
- 返回值: [返回格式]

請確保：
✓ 遵循現有代碼風格
✓ 包含詳細註釋
✓ 編寫全面的單元測試（正常、異常、超時）
✓ 使用現有的重試和超時機制
```

---

### 2️⃣ 添加新的計算函數

```
我要在 BacktestEngine 中添加新的性能指標 [指標名稱]。

請按照 LazyBacktest 架構：
1. 在 js/layers/core/backtest-engine.js 中添加計算方法
2. 編寫清晰的計算邏輯，包含邊界情況處理
3. 在 tests/unit/core/backtest-engine.test.js 中編寫測試

計算公式：[公式描述]
輸入: [輸入格式]
輸出: [輸出格式]

請確保：
✓ 輸入驗證和錯誤處理
✓ 邊界情況測試（空數組、單個元素等）
✓ 計算準確性測試
✓ 清晰的變數名和註釋
```

---

### 3️⃣ 添加新的技術指標

```
我要在 Indicators 中添加新指標 [指標名稱]。

請按照 LazyBacktest 架構：
1. 在 js/layers/core/indicators.js 中實現計算方法
2. 使用純函數，無狀態設計
3. 在 tests/unit/core/indicators.test.js 中編寫測試

計算方法：[方法描述]
輸入: [輸入參數]
輸出: [輸出格式]

請確保：
✓ 輸入驗證和錯誤提示
✓ 性能優化（支持大數據集）
✓ 邊界情況測試
✓ 計算準確性測試
✓ 性能基準測試
```

---

### 4️⃣ 修改 UI 表單

```
我要在 UIController 中修改表單來 [功能描述]。

請按照 LazyBacktest 架構：
1. 在 js/layers/ui/ui-controller.js 中添加方法
2. 提取數據、驗證、調用 Core 層邏輯
3. 使用 StateManager 保存狀態
4. 在 tests/unit/ui/ui-controller.test.js 中編寫測試

表單字段：[字段列表]
驗證規則：[驗證規則]
後續邏輯：[調用哪些 Core 層方法]

請確保：
✓ DOM 元素存在檢查
✓ 字段值驗證
✓ 不在 UI 層做業務計算
✓ 使用 StateManager 保存狀態
✓ 完整的錯誤處理
```

---

### 5️⃣ 添加工具函數

```
我要在 Utils 層添加 [工具函數名稱]。

請按照 LazyBacktest 架構：
1. 在 js/layers/utils/[相關文件].js 中實現
2. 創建純函數，無副作用
3. 在 tests/unit/utils/[相關文件].test.js 中編寫測試

功能：[功能描述]
輸入: [參數列表]
輸出: [返回值]

請確保：
✓ 是否可以被多個層使用
✓ 無副作用和狀態依賴
✓ 邊界情況處理
✓ 詳細的註釋
✓ 全面的單元測試
```

---

### 6️⃣ 修復 Bug

```
我遇到了一個 Bug：[Bug 描述]

發生位置：[文件名]
現象：[現象描述]
期望行為：[期望行為]

請按照 LazyBacktest 架構：
1. 定位 Bug 的具體原因
2. 修改最小化但完整的代碼
3. 在相應的測試文件中添加回歸測試

請確保：
✓ 修改只在正確的層
✓ 添加測試防止回歸
✓ 修改不破壞現有功能
✓ 所有相關測試都通過
```

---

### 7️⃣ 進行整合

```
我要將不同層的功能整合在一起。

流程：
API 層：[API 方法]
  ↓
Core 層：[計算邏輯]
  ↓
UI 層：[顯示結果]

請按照 LazyBacktest 架構：
1. 確保層與層之間的調用關係正確
2. 每一層都有適當的測試
3. 編寫整合測試驗證端到端流程

請確保：
✓ 層與層之間清晰分離
✓ 每層都有單元測試
✓ 編寫整合測試
✓ 錯誤能正確傳遞
```

---

## ✅ 修改檢查清單

### 在提交代碼前，使用這份清單檢查

#### 📍 架構檢查
- [ ] 代碼在正確的層中
- [ ] 沒有跨層的邏輯混合
- [ ] 依賴關係遵循架構（API → Core → UI/Utils）
- [ ] 導入聲明清晰正確

#### 📝 代碼質量
- [ ] 變數名清晰有意義
- [ ] 函數職責單一
- [ ] 代碼註釋詳細
- [ ] 異常捕獲和處理完善

#### 🧪 測試檢查
- [ ] 編寫了單元測試
- [ ] 測試覆蓋正常情況
- [ ] 測試覆蓋異常情況
- [ ] 測試覆蓋邊界情況
- [ ] 運行 `npm test` 全部通過
- [ ] 代碼覆蓋率滿意

#### 🔍 功能驗證
- [ ] 新功能能正常運行
- [ ] 現有功能沒有被破壞
- [ ] 運行整合測試
- [ ] UI 操作流暢
- [ ] 性能指標滿意

#### 📊 最終檢查
- [ ] 改動數量合理
- [ ] 改動清晰易懂
- [ ] 提交消息清楚
- [ ] 沒有調試代碼或 console.log
- [ ] 沒有臨時變數或文件

---

## 📚 常見場景指南

### 場景 1: 添加新的回測策略

**步驟**:

```
1. 定義策略配置
   → 在 js/layers/core/strategy-manager.js 註冊

2. 實現信號生成
   → 在相應的策略文件中實現

3. 添加計算邏輯
   → 如需要新指標，在 indicators.js 添加

4. 整合到回測引擎
   → 在 backtest-engine.js 中使用

5. 添加 UI 控制
   → 在 ui-controller.js 中添加表單

6. 編寫測試
   → 在 tests/ 中添加相應測試
```

**AI 提示詞**:
```
我要添加一個新的交易策略 [策略名稱]。

信號規則：[規則描述]
參數：[參數列表]
回測期間：[時間範圍]

請按照架構創建：
1. 策略配置和註冊
2. 信號生成邏輯
3. 所需的計算函數
4. UI 表單
5. 完整的測試套件

遵循現有的 [參考策略] 模式。
```

---

### 場景 2: 優化性能

**步驟**:

```
1. 識別性能瓶頸
   → 運行性能測試或分析

2. 優化計算層
   → 改進 indicators.js 或 backtest-engine.js

3. 優化數據層
   → 改進 API 調用或緩存策略

4. 優化 UI 層
   → 改進渲染或交互

5. 驗證性能改善
   → 編寫性能基準測試
   → 比較改善前後
```

**AI 提示詞**:
```
我要優化 [組件名稱] 的性能。

當前性能：[現象]
目標：[目標值]
瓶頸分析：[分析結果]

請按照架構進行優化，在保留功能的同時改進性能。
編寫性能基準測試驗證改善效果。
```

---

### 場景 3: 修復 Bug

**步驟**:

```
1. 重現 Bug
   → 編寫失敗的測試用例

2. 分析根本原因
   → 定位代碼中的問題

3. 最小化修改
   → 只改必要的部分

4. 驗證修複
   → 確保測試通過

5. 檢查回歸
   → 運行所有相關測試
```

**AI 提示詞**:
```
我發現了一個 Bug：[Bug 描述]

復現步驟：
1. [步驟 1]
2. [步驟 2]
3. [步驟 3]

期望結果：[期望]
實際結果：[實際]

請幫我修復這個 Bug，並添加測試防止回歸。
最小化代碼改動。
```

---

### 場景 4: 添加新數據源

**步驟**:

```
1. 添加 API 方法
   → 在 api/proxy-client.js 中

2. 數據格式轉換
   → 添加轉換函數在 utils/ 中

3. 整合到核心邏輯
   → 在 backtest-engine.js 中使用

4. 添加 UI 表單
   → 在 ui-controller.js 中

5. 編寫測試
   → 所有層都要有測試
```

**AI 提示詞**:
```
我要集成新的數據源 [數據源名稱]。

API 端點：[端點]
數據格式：[格式描述]
認證方式：[認證方式]

請按照架構添加：
1. API 調用方法
2. 數據格式轉換
3. 緩存策略
4. 錯誤處理
5. UI 集成
6. 完整測試

參考現有的 [參考數據源] 實現。
```

---

## 🔧 故障排查

### 問題 1: AI 修改了多個層

**症狀**: 修改涉及 API、Core 和 UI 層，但邏輯混雜

**解決方案**:
```
提示詞中明確指出：
"只在 [層名] 進行修改，其他層保持不變"

或者提供清晰的架構圖幫助 AI 理解。
```

---

### 問題 2: 缺少必要的測試

**症狀**: AI 生成的代碼沒有相應的測試

**解決方案**:
```
修訂提示詞：
"完成代碼後，必須在 tests/ 目錄中編寫對應的測試"

或者明確指出：
"編寫測試用例覆蓋：正常情況、異常情況、邊界情況"
```

---

### 問題 3: 代碼風格不一致

**症狀**: AI 生成的代碼風格與現有代碼不符

**解決方案**:
```
在提示詞中加入：
"遵循現有代碼的風格和命名規範"

或提供參考文件：
"參考 js/layers/api/proxy-client.js 的代碼風格"
```

---

### 問題 4: 性能問題

**症狀**: 新添加的代碼運行緩慢

**解決方案**:
```
提示詞中加入性能要求：
"必須支持 10,000+ 數據點的處理"
"性能基準要在 100ms 內完成"

要求 AI 編寫性能測試用例。
```

---

### 問題 5: 依賴關係混亂

**症狀**: 層之間的依賴關係不清晰

**解決方案**:
```
提示詞明確依賴關係：
"API 層調用獲取數據"
"Core 層處理數據"
"UI 層顯示結果"

不允許：
- UI 層直接調用 API
- UI 層做業務計算
- Core 層做 UI 操作
```

---

## 🎵 完美的 Vibe Coding 流程

### 終極工作流

```
🎶 打開音樂

1️⃣ 想到一個想法
   ↓
2️⃣ 用提示詞告訴 AI
   ↓
3️⃣ AI 生成代碼
   ↓
4️⃣ 快速掃過修改檢查清單
   ↓
5️⃣ 運行 npm test
   ↓
✅ 測試通過 → 提交
❌ 測試失敗 → 回到 2️⃣

🎶 繼續享受音樂
```

### 快速命令參考

```bash
# 開發過程
npm run test:watch      # 邊改邊測試

# 完成後
npm test                # 完整測試
npm run test:coverage   # 檢查覆蓋率
npm run test:verbose    # 詳細輸出

# 提交前
npm test && npm run test:coverage
```

---

## 💡 最佳實踐

### DO ✅

- ✅ 一次修改一個層
- ✅ 為每個修改編寫測試
- ✅ 遵循現有代碼風格
- ✅ 使用清晰的變數名
- ✅ 寫清楚的提示詞
- ✅ 運行所有測試驗證
- ✅ 添加詳細註釋

### DON'T ❌

- ❌ 不要混合多個層的邏輯
- ❌ 不要跳過測試
- ❌ 不要直接在 UI 層做計算
- ❌ 不要在 API 層做業務邏輯
- ❌ 不要忽視錯誤處理
- ❌ 不要有不必要的依賴
- ❌ 不要提交未測試的代碼

---

## 📞 快速參考

### 層的職責速查

| 層 | 職責 | 示例 |
|----|------|------|
| **API** | 外部通信 | HTTP 請求、數據獲取 |
| **Core** | 業務邏輯 | 計算、分析、管理 |
| **UI** | 用戶交互 | 表單、顯示、事件 |
| **Utils** | 工具函數 | 格式化、計算輔助 |

### 文件位置速查

```
修改 API 層         → js/layers/api/proxy-client.js
修改計算邏輯        → js/layers/core/backtest-engine.js
修改指標計算        → js/layers/core/indicators.js
修改策略管理        → js/layers/core/strategy-manager.js
修改表單和控制      → js/layers/ui/ui-controller.js
修改狀態管理        → js/layers/ui/state-manager.js
添加工具函數        → js/layers/utils/*
編寫測試            → tests/unit/*
```

### 命令速查

```bash
# 開發
npm run test:watch       # 監視模式

# 驗證
npm test                # 所有測試
npm run test:unit       # 單元測試
npm run test:integration # 整合測試
npm run test:coverage   # 覆蓋率

# 調試
npm run test:verbose    # 詳細輸出
npm test -- --no-coverage  # 無覆蓋率
```

---

## 🎉 總結

**Vibe Coding 的黃金法則**:

> 用清晰的提示詞告訴 AI，AI 遵循架構生成代碼，你驗證並運行測試。完美的協作，繼續享受編碼的快樂！

---

**Happy Vibe Coding! 🎵💻**

相關文檔：
- [`AUTOMATED-TESTING-GUIDE.md`](AUTOMATED-TESTING-GUIDE.md) - 完整測試指南
- [`TDD-WORKFLOW-GUIDE.md`](TDD-WORKFLOW-GUIDE.md) - TDD 工作流
- [`TESTING-CHEATSHEET.md`](TESTING-CHEATSHEET.md) - 命令速查