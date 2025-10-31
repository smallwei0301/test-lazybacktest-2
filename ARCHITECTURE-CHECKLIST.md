# ✅ 架構檢查清單 (Vibe Coding 版)

> **使用方法**: 在提交代碼前，使用這份清單驗證 AI 生成的代碼是否符合架構規範。

---

## 📋 目錄

1. [快速檢查 (5 分鐘)](#快速檢查-5-分鐘)
2. [詳細檢查 (15 分鐘)](#詳細檢查-15-分鐘)
3. [完整檢查 (30 分鐘)](#完整檢查-30-分鐘)
4. [層級專項檢查](#層級專項檢查)
5. [測試檢查](#測試檢查)
6. [代碼品質檢查](#代碼品質檢查)
7. [檢查失敗排查](#檢查失敗排查)

---

## ⚡ 快速檢查 (5 分鐘)

**在繁忙的 Vibe Coding 時使用 - 最基本的檢查**

### 代碼位置檢查
```
□ API 層代碼 → 在 js/layers/api/ 中
□ Core 層代碼 → 在 js/layers/core/ 中
□ UI 層代碼 → 在 js/layers/ui/ 中
□ Utils 代碼 → 在 js/layers/utils/ 中
```

### 層級邊界檢查
```
□ 沒有在 UI 層看到 API 調用
□ 沒有在 API 層看到業務計算
□ 沒有在 Core 層看到 DOM 操作
□ 沒有在 Utils 層看到狀態依賴
```

### 測試檢查
```
□ 代碼改動對應的測試文件存在
□ 運行 npm test 沒有新的失敗
□ 至少覆蓋了主要場景的測試
```

### 最終檢查
```
✅ 代碼在正確的位置
✅ 沒有跨層混合邏輯
✅ 測試通過
→ 準備好提交！
```

---

## 🔍 詳細檢查 (15 分鐘)

**添加新功能時使用 - 更全面的檢查**

### 1️⃣ 架構檢查

#### API 層 (如果修改了 API)
```
□ 所有 HTTP 調用都在 API 層
□ 使用了 withRetry 機制
□ 有超時設置
□ 有完整的錯誤處理
□ 不做任何業務計算
□ 不操作 DOM 元素
□ 不訪問全局狀態（除了配置）

檢查方法:
grep -r "fetch\|axios" js/layers/core/   # 不應該有結果
grep -r "document\." js/layers/api/       # 不應該有結果
```

#### Core 層 (如果修改了業務邏輯)
```
□ 所有計算邏輯都在 Core 層
□ 沒有 HTTP 調用
□ 沒有 DOM 操作
□ 沒有 localStorage 操作
□ 函數參數清晰
□ 有輸入驗證
□ 有邊界情況處理
□ 計算結果可驗證

檢查方法:
grep -r "fetch\|axios" js/layers/core/backtest* # 不應該有結果
grep -r "document\." js/layers/core/            # 不應該有結果
grep -r "localStorage" js/layers/core/          # 不應該有結果
```

#### UI 層 (如果修改了 UI)
```
□ 所有 DOM 操作都在 UI 層
□ 數據收集邏輯清晰
□ 調用 Core 層做計算（不是直接計算）
□ 使用 StateManager 保存狀態
□ 有用戶輸入驗證
□ 有友好的錯誤提示
□ 代碼 Readable（易於理解）

檢查方法:
grep -r "calculate\|compute" js/layers/ui/    # 應該較少，都應該調用 Core 層
grep -r "Math\." js/layers/ui/ui-controller   # 應該很少，計算應在 Core
```

#### Utils 層 (如果添加了工具)
```
□ 工具函數是純函數
□ 無副作用
□ 無狀態依賴
□ 可被多個層使用
□ 參數清晰
□ 返回值明確
□ 有詳細註釋
```

---

### 2️⃣ 代碼質量檢查

```
□ 變數名清晰有意義
□ 函數名動詞開頭且清楚
□ 沒有單字母變數（除了循環計數器 i, j, k）
□ 沒有魔數（數字直接出現在代碼中）
□ 有適當的註釋
□ 代碼縮排一致（2 個空格）
□ 沒有多餘的空白行
□ 沒有 console.log（除非必要的調試）
```

---

### 3️⃣ 測試檢查

```
□ 編寫了單元測試
□ 測試在正確的文件中
□ 測試名稱清晰（描述應該測什麼）
□ 正常情況有測試
□ 異常情況有測試
□ 邊界情況有測試
□ 運行 npm test 所有測試通過
```

---

### 4️⃣ 依賴檢查

```
□ 導入聲明清晰正確
□ 沒有循環依賴
□ 只導入需要的部分
□ 導入順序合理（標準庫 → 項目庫 → 相對路徑）

檢查方法:
# 查看文件頭部的 import/require 聲明
head -20 [修改的文件]
```

---

## 🎯 完整檢查 (30 分鐘)

**重大功能修改時使用 - 全面深度檢查**

### 包含以上所有檢查，加上:

### 5️⃣ 功能整合檢查

```
□ 端到端流程工作正常
□ API → Core → UI 的調用鏈正確
□ 數據轉換正確
□ 狀態更新正確
□ 錯誤能正確傳遞

測試方法:
npm run test:integration  # 運行整合測試
```

---

### 6️⃣ 性能檢查

```
□ 沒有 O(n²) 或更差的算法
□ 大數據集測試通過
□ 性能指標滿足要求
□ 沒有多餘的循環或遞歸

檢查方法:
npm run test:coverage     # 檢查代碼覆蓋率
```

---

### 7️⃣ 向後兼容性檢查

```
□ 現有 API 沒有改變
□ 如改變了，有清楚的遷移路徑
□ 現有功能沒有被破壞
□ 所有舊測試仍然通過

檢查方法:
npm test  # 確保所有現有測試通過
```

---

### 8️⃣ 文檔和註釋檢查

```
□ 複雜函數有 JSDoc 註釋
□ 複雜邏輯有行內註釋
□ 參數說明清晰
□ 返回值說明清晰
□ 包含使用示例（如適用）
□ 包含邊界情況說明（如適用）
```

---

## 🏗️ 層級專項檢查

### API 層檢查清單

```
添加新 API 端點時:

□ 有適當的 HTTP 方法（GET/POST/PUT/DELETE）
□ 有完整的 URL 構建
□ 有參數驗證
□ 有查詢參數或請求體的正確處理
□ 有超時設置（通常 30 秒）
□ 有重試機制（最多 3 次）
□ 有驗證 HTTP 狀態碼
□ 有錯誤分類（4xx vs 5xx）
□ 有適當的 Content-Type

測試應該涵蓋:
□ 成功響應 (200)
□ 客戶端錯誤 (4xx)
□ 服務器錯誤 (5xx)
□ 網絡超時
□ 重試機制

代碼示例:
✅ 正確
async getStockData(ticker) {
  return this.withRetry(() => 
    fetch(`/api/stock/${ticker}`, { timeout: 30000 })
  );
}

❌ 錯誤
getStockData(ticker) {
  return fetch(`/api/stock/${ticker}`);  // 沒有超時、沒有重試
}
```

---

### Core 層檢查清單

#### BacktestEngine 檢查
```
添加新計算方法時:

□ 輸入參數驗證完整
□ 邊界情況都處理了
□ 計算邏輯清晰
□ 結果精度合理
□ 變數名清晰
□ 計算過程有註釋
□ 沒有副作用
□ 性能滿足要求 (10K 筆交易 < 100ms)

測試應該涵蓋:
□ 正常數據集
□ 空數組
□ 單個元素
□ 大數據集
□ 異常值 (負數、零、極大值)
□ 性能基準測試

代碼示例:
✅ 正確
calculateProfit(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return 0;
  
  return trades.reduce((sum, trade) => {
    return sum + (trade.closePrice - trade.openPrice);
  }, 0);
}

❌ 錯誤
calculateProfit(trades) {
  let profit = 0;
  for (let i = 0; i < trades.length; i++) {
    profit = profit + trades[i].profit;  // 沒有驗證
  }
  return profit;
}
```

#### Indicators 檢查
```
添加新指標時:

□ 是純函數（相同輸入→相同輸出）
□ 沒有副作用
□ 沒有狀態依賴
□ 支持大數據集
□ 計算準確性高
□ 參數驗證完整
□ 有意義的錯誤信息

測試應該涵蓋:
□ 已知計算結果（用標準實現驗證）
□ 邊界情況
□ 大數據集
□ 浮點精度
□ 性能 (1000 個數據點 < 100ms)

代碼示例:
✅ 正確
calculateSMA(data, period) {
  if (!Array.isArray(data) || data.length < period) {
    throw new Error(`需要至少 ${period} 個數據點`);
  }
  
  const result = data
    .slice(-period)
    .reduce((sum, val) => sum + val, 0) / period;
  
  return Math.round(result * 100) / 100;
}

❌ 錯誤
calculateSMA(data, period) {
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];  // 沒有邊界檢查
  }
  return sum / period;
}
```

#### StrategyManager 檢查
```
修改策略管理時:

□ 策略配置驗證完整
□ 策略隔離正確
□ 版本管理清晰
□ 參數管理完善
□ 沒有策略間的干擾
□ 有適當的錯誤提示

測試應該涵蓋:
□ 策略註冊
□ 策略驗證
□ 策略更新
□ 策略刪除
□ 參數驗證
□ 邊界情況
```

---

### UI 層檢查清單

#### UIController 檢查
```
修改 UI 控制時:

□ DOM 選擇器清晰
□ DOM 元素存在檢查
□ 值提取正確
□ 輸入驗證完整
□ 調用 Core 層方法（不是直接計算）
□ 使用 StateManager 保存狀態
□ 錯誤提示友好清晰
□ 沒有硬編碼的 DOM 訪問

測試應該涵蓋:
□ DOM 元素存在
□ 值提取
□ 驗證規則
□ 錯誤顯示
□ 狀態保存
□ 核心邏輯調用

代碼示例:
✅ 正確
getTickerValue() {
  const element = document.getElementById('ticker');
  if (!element) {
    throw new Error('Ticker 輸入框不存在');
  }
  return element.value.trim().toUpperCase();
}

❌ 錯誤
getTickerValue() {
  return document.getElementById('ticker').value;  // 沒有檢查
}
```

#### StateManager 檢查
```
修改狀態管理時:

□ 狀態結構清晰
□ 狀態初始化完整
□ localStorage 操作正確
□ 過期處理正確
□ 同步機制清晰
□ 沒有狀態污染
□ TTL 管理正確

測試應該涵蓋:
□ 狀態保存
□ 狀態讀取
□ 狀態更新
□ 過期處理
□ localStorage 操作
□ 同步機制
```

---

### Utils 層檢查清單

```
添加工具函數時:

□ 是純函數
□ 無副作用
□ 無狀態依賴
□ 參數類型清晰
□ 返回值類型清晰
□ 有 JSDoc 註釋
□ 邊界情況處理

測試應該涵蓋:
□ 正常輸入
□ 邊界情況
□ 異常輸入
□ 類型檢查

代碼示例:
✅ 正確
/**
 * 格式化幣值
 * @param {number} value - 幣值
 * @param {string} currency - 幣種 (預設: USD)
 * @returns {string} 格式化後的幣值
 * @example
 * formatCurrency(1234.56) // $1,234.56
 * formatCurrency(1234.56, 'CNY') // ¥1,234.56
 */
function formatCurrency(value, currency = 'USD') {
  if (typeof value !== 'number') {
    throw new TypeError('value 必須是數字');
  }
  // ... 實現
}

❌ 錯誤
function format(v) {
  return '$' + v;  // 沒有格式化，沒有註釋
}
```

---

## 🧪 測試檢查

### 單元測試檢查

```
□ 測試文件位置正確
  - js/layers/api/* → tests/unit/api/*
  - js/layers/core/* → tests/unit/core/*
  - js/layers/ui/* → tests/unit/ui/*
  - js/layers/utils/* → tests/unit/utils/*

□ 測試文件名稱正確
  - [模塊名].test.js 或 [模塊名].spec.js

□ 測試套件組織清晰
  describe('模塊名', () => {
    describe('方法名', () => {
      test('should ...', () => {});
    });
  });

□ 測試名稱清晰
  ✅ test('should return profit when trades array is valid', () => {})
  ❌ test('test 1', () => {})

□ 每個測試只測試一個功能
□ 使用 setup/teardown (beforeEach/afterEach)
□ Mock 依賴清晰正確
□ 斷言清晰有力
```

---

### 測試覆蓋率檢查

```
運行覆蓋率檢查:
npm run test:coverage

檢查項目:
□ 語句覆蓋率 (Statements) > 85%
□ 分支覆蓋率 (Branches) > 80%
□ 函數覆蓋率 (Functions) > 85%
□ 行數覆蓋率 (Lines) > 85%

特別注意:
□ 關鍵函數覆蓋率 > 95%
□ 錯誤處理路徑有測試
□ 邊界情況有測試
```

---

### 整合測試檢查

```
□ 整合測試文件存在 tests/integration/
□ 測試完整的功能流程
□ 測試層與層之間的協作
□ 測試異常情況
□ 測試性能指標

運行整合測試:
npm run test:integration
```

---

## 📊 代碼品質檢查

### 代碼複雜度檢查

```
□ 函數不超過 50 行代碼
  - 如果超過，考慮拆分成更小的函數

□ 嵌套深度不超過 3-4 層
  - 太深的嵌套降低可讀性

□ 循環複雜度 (Cyclomatic Complexity) < 10
  - 太高表示邏輯太複雜

檢查方法:
npm run test:verbose  # 會顯示一些代碼複雜度信息
```

---

### 命名規範檢查

```
變數名:
□ camelCase (myVariable)
□ 有意義 (不是 a, b, c)
□ 名詞形式 (user, configuration)
□ 佈爾值以 is, has, should 開頭
  ✅ isValid, hasData, shouldRetry
  ❌ valid, data, retry

函數名:
□ camelCase
□ 動詞開頭 (get, fetch, calculate, validate)
□ 清晰表達功能
  ✅ getStockPrice(), calculateProfit()
  ❌ func(), do()

常數:
□ UPPER_SNAKE_CASE (MAX_RETRIES)
□ 在文件頂部定義
□ 有清晰的含義
```

---

### 註釋品質檢查

```
□ 複雜算法有詳細註釋
□ 非直觀代碼有解釋
□ JSDoc 註釋完整
  - 參數說明
  - 返回值說明
  - 使用示例

□ 沒有多餘的註釋
  ✅ // 檢查用戶是否已認證
     if (!user.authenticated) { ... }
  ❌ // x = x + 1
     x = x + 1;

□ 沒有過時的註釋
□ 沒有 TODO / FIXME 沒有時間表
```

---

## ❌ 檢查失敗排查

### 檢查失敗: "代碼不在正確的層"

**症狀**: API 層有計算邏輯，Core 層有 DOM 操作等

**排查步驟**:
```
1. 識別代碼的職責
   - 是網絡請求？→ API 層
   - 是業務計算？→ Core 層
   - 是 UI 操作？→ UI 層
   - 是通用工具？→ Utils 層

2. 移動到正確的層

3. 更新導入聲明

4. 重新編寫/移動相關測試

5. 運行 npm test 驗證
```

---

### 檢查失敗: "測試不完整"

**症狀**: 測試只覆蓋了主路徑，沒有異常情況

**排查步驟**:
```
1. 分析代碼邏輯
   - 有哪些主要路徑？
   - 有哪些異常情況？
   - 有哪些邊界情況？

2. 為每個路徑添加測試
   - 正常情況
   - 異常情況（錯誤輸入、網絡失敗等）
   - 邊界情況（空、零、最大值等）

3. 檢查測試覆蓋率
   npm run test:coverage

4. 補充缺失的測試
```

---

### 檢查失敗: "代碼風格不一致"

**症狀**: 代碼風格與現有代碼不符

**排查步驟**:
```
1. 對比現有代碼風格
   - 查看相同功能的現有代碼
   - 提取風格規則

2. 統一以下方面:
   - 命名規範
   - 縮排（2 個空格）
   - 空白行用法
   - 註釋風格
   - 導入順序

3. 重新格式化代碼

4. 運行 npm test 驗證
```

---

### 檢查失敗: "循環依賴"

**症狀**: A 模塊導入 B，B 模塊導入 A

**排查步驟**:
```
1. 畫出依賴圖
   A → B
   ↓   ↑
   C ←┘

2. 找到循環
   A → B → A 或 A → B → C → A

3. 打破循環
   選項 1: 提取共同邏輯到第三個模塊
   選項 2: 反轉其中一個依賴
   選項 3: 延遲導入（動態 require）

4. 驗證依賴無循環
```

---

### 檢查失敗: "性能不符合要求"

**症狀**: 測試執行時間過長

**排查步驟**:
```
1. 運行性能分析
   npm run test:verbose  # 顯示每個測試的執行時間

2. 定位慢的測試
   - 通常是計算密集型或 I/O 操作

3. 優化代碼
   - 使用更高效的算法
   - 避免多餘的循環
   - 使用向量化計算

4. 設置性能基準
   - 使用 performance.now()
   - 測試大數據集

5. 再次驗證性能
```

---

## 🎯 快速檢查流程圖

```
代碼修改完成
    ↓
【快速檢查 5分鐘】
  - 位置對嗎？
  - 有測試嗎？
  - npm test 通過？
    ↓
✅ 簡單修改 → 準備提交
❌ 複雜修改 → 進行詳細檢查
    ↓
【詳細檢查 15分鐘】
  - 架構清晰嗎？
  - 測試完整嗎？
  - 代碼質量好嗎？
    ↓
✅ 中等改動 → 準備提交
❌ 大型改動 → 進行完整檢查
    ↓
【完整檢查 30分鐘】
  - 整合測試通過？
  - 性能達要求？
  - 向後兼容？
    ↓
✅ 所有檢查通過
    ↓
準備提交！🎉
```

---

## 📞 檢查失敗快速求助

| 問題 | 解決方案 | 命令 |
|------|--------|------|
| 不知道該去哪層 | 看 [VIBE-CODING-ASSISTANT-GUIDE.md](VIBE-CODING-ASSISTANT-GUIDE.md) 的架構規則部分 | - |
| 測試失敗 | 運行 `npm run test:verbose` 看詳細信息 | `npm run test:verbose` |
| 測試覆蓋率低 | 查看 coverage 報告找缺失測試 | `npm run test:coverage` |
| 不知道怎麼寫測試 | 看相同功能的現有測試作為參考 | - |
| 性能問題 | 使用性能基準測試找瓶頸 | `npm run test:verbose` |
| 風格不一致 | 參考相同層的代碼風格 | - |

---

## ✅ 最終檢查清單

在點擊「提交」前，最後檢查一次:

```
代碼檢查:
□ 代碼在正確的層
□ 沒有跨層混合邏輯
□ 代碼風格一致
□ 有適當的註釋
□ 變數名清晰

測試檢查:
□ 編寫了必要的測試
□ npm test 所有測試通過
□ 測試覆蓋率滿足要求
□ 異常情況有測試
□ 邊界情況有測試

質量檢查:
□ 沒有 console.log
□ 沒有註釋掉的代碼
□ 沒有未使用的變數
□ 沒有多餘的導入

最終檢查:
□ 功能工作正常
□ 現有功能沒被破壞
□ 性能滿足要求
□ 代碼可被他人維護

✅ 一切都準備好了
→ 提交代碼！🚀
```

---

## 📚 相關資源

- [`VIBE-CODING-ASSISTANT-GUIDE.md`](VIBE-CODING-ASSISTANT-GUIDE.md) - 完整助手指南
- [`VIBE-CODING-PROMPTS.md`](VIBE-CODING-PROMPTS.md) - 快速提示詞
- [`AUTOMATED-TESTING-GUIDE.md`](AUTOMATED-TESTING-GUIDE.md) - 自動測試指南

---

**Happy Vibe Coding! 🎵💻**

**記住**: 好的檢查清單確保代碼質量！