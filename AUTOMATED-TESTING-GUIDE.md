# 🔍 代碼更新自動檢測指南

## 📖 目錄
1. [快速開始](#快速開始)
2. [自動檢測工作流](#自動檢測工作流)
3. [各層級檢測](#各層級檢測)
4. [常見場景指南](#常見場景指南)
5. [故障排查](#故障排查)
6. [CI/CD 集成](#cicd-集成)

---

## 🚀 快速開始

### 最簡單的方式 (推薦新手使用)

```bash
# 1️⃣ 修改代碼後，運行完整檢測
npm test

# 2️⃣ 查看測試覆蓋報告
npm run test:coverage

# 3️⃣ 查看詳細結果
npm run test:verbose
```

**就這麼簡單!** ✅

---

## 🔄 自動檢測工作流

### 完整工作流 (推薦流程)

```
┌─────────────────────────────────────────────────────┐
│ 步驟 1: 修改代碼                                    │
│        在 js/layers/core, api, ui 等目錄修改代碼     │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 步驟 2: 運行自動檢測                                │
│        npm test (自動運行所有測試)                  │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 步驟 3: 查看結果                                    │
│ ✅ 全部通過 → 可以提交                              │
│ ❌ 有失敗 → 查看失敗原因，修改代碼                  │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 步驟 4: 重複檢測                                    │
│        npm test (再次檢測，直到全部通過)            │
└────────────────┬────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│ 步驟 5: 提交代碼                                    │
│        git commit -m "修改說明"                     │
└─────────────────────────────────────────────────────┘
```

### 快速檢測 (快速檢查，不需完整測試)

```bash
# 只測試特定模組
npm run test:unit -- --testPathPattern="api"      # 只測試 API 層
npm run test:unit -- --testPathPattern="core"     # 只測試核心層
npm run test:unit -- --testPathPattern="ui"       # 只測試 UI 層

# 監視模式 (改了代碼自動測試)
npm run test:watch

# 只測試相關文件 (基於 Git 變更)
npm test -- --onlyChanged
```

### 詳細檢測 (全面檢查，了解細節)

```bash
# 詳細輸出所有測試結果
npm run test:verbose

# 生成測試覆蓋報告
npm run test:coverage

# 生成 HTML 報告 (在瀏覽器中查看)
npm run test:coverage -- --collectCoverageFrom="js/layers/**/*.js"
```

---

## 📋 各層級檢測

### 1️⃣ API 層檢測

#### 修改 ProxyClient 後

```bash
# 檢測 API 層代碼
npm run test:unit -- --testPathPattern="api"

# 或者指定文件
npm test tests/unit/api/proxy-client.test.js
```

#### 自動檢測範圍
```javascript
// 會自動檢測:
✅ API 端點連接
✅ 錯誤處理邏輯
✅ 重試機制
✅ 參數驗證
✅ 超時管理
✅ 緩存行為
```

#### 檢測標準
```
通過標準:
- API 調用成功 ✅
- 錯誤處理正確 ✅
- 重試邏輯工作 ✅
- 參數驗證生效 ✅
- 超時控制準確 ✅

失敗提示:
❌ "Cannot read properties of undefined"
❌ "Network error not handled"
❌ "Retry logic failed"
```

---

### 2️⃣ 核心層檢測

#### 修改 BacktestEngine / StrategyManager / Indicators 後

```bash
# 檢測核心層代碼
npm run test:unit -- --testPathPattern="core"

# 或者指定模組
npm test tests/unit/core/backtest-engine.test.js
npm test tests/unit/core/strategy-manager.test.js
npm test tests/unit/core/indicators.test.js
```

#### 自動檢測範圍
```javascript
// 會自動檢測:
✅ 回測計算邏輯
✅ 策略執行流程
✅ 技術指標計算
✅ 數據輸入/輸出
✅ 邊界情況處理
✅ 性能基準
```

#### 檢測標準
```
通過標準:
- 計算結果準確 ✅
- 邊界情況正確 ✅
- 性能在基準內 ✅
- 錯誤處理完善 ✅

失敗提示:
❌ "Expected X but got Y"
❌ "Calculation exceeded time limit"
❌ "Edge case not handled"
```

---

### 3️⃣ UI 層檢測

#### 修改 UIController / AppState 後

```bash
# 檢測 UI 層代碼
npm run test:unit -- --testPathPattern="ui"

# 或者指定模組
npm test tests/unit/ui/ui-controller.test.js
npm test tests/unit/ui/state-manager.test.js
```

#### 自動檢測範圍
```javascript
// 會自動檢測:
✅ DOM 操作
✅ 事件處理
✅ 狀態同步
✅ 表單驗證
✅ 用戶交互
✅ 緩存管理
```

#### 檢測標準
```
通過標準:
- DOM 更新正確 ✅
- 事件觸發工作 ✅
- 狀態同步準確 ✅
- 驗證邏輯完善 ✅

失敗提示:
❌ "Element not found"
❌ "Event listener not attached"
❌ "State mismatch"
```

---

### 4️⃣ 整合測試檢測

#### 修改多個模組的交互邏輯後

```bash
# 運行整合測試
npm run test:integration

# 或者運行特定整合測試
npm test tests/integration/final-integration.test.js
```

#### 自動檢測範圍
```javascript
// 會自動檢測:
✅ 模組間通信
✅ 完整工作流
✅ 數據流向
✅ 跨層交互
✅ 系統穩定性
```

#### 檢測標準
```
通過標準:
- 完整流程正常 ✅
- 數據流向正確 ✅
- 所有層協調工作 ✅

失敗提示:
❌ "Module communication failed"
❌ "Data flow broken"
❌ "Integration test failed"
```

---

## 📚 常見場景指南

### 場景 1: 修改技術指標計算

#### 代碼修改
```javascript
// 修改 js/layers/core/indicators.js
calculateSMA = (prices, period) => {
    // 你的新實現
    return results;
};
```

#### 自動檢測命令
```bash
# 步驟 1: 運行指標測試
npm test tests/unit/core/indicators.test.js

# 步驟 2: 查看覆蓋報告
npm run test:coverage -- --testPathPattern="indicators"

# 步驟 3: 運行相關整合測試
npm run test:integration
```

#### 檢測會驗證
```
✅ 計算精度
✅ 邊界情況 (空數組、單個值、異常值)
✅ 性能 (1000+ 數據點)
✅ 返回值格式
✅ 與其他指標的兼容性
```

#### 故障診斷
```
如果測試失敗:
❌ "Expected 100.5 but got 100.4"
   → 檢查計算公式

❌ "TypeError: prices.map is not a function"
   → 檢查輸入參數類型

❌ "Test timeout"
   → 檢查算法複雜度
```

---

### 場景 2: 修改回測邏輯

#### 代碼修改
```javascript
// 修改 js/layers/core/backtest-engine.js
runBacktest = async (config) => {
    // 你的新實現
    return results;
};
```

#### 自動檢測命令
```bash
# 步驟 1: 運行回測引擎測試
npm test tests/unit/core/backtest-engine.test.js

# 步驟 2: 運行整合測試
npm run test:integration -- --testPathPattern="backtest"

# 步驟 3: 檢查覆蓋率
npm run test:coverage
```

#### 檢測會驗證
```
✅ 回測計算正確
✅ 交易信號生成正確
✅ 統計數據準確
✅ 邊界情況處理
✅ 性能在可接受範圍
✅ 與策略的交互
```

#### 故障診斷
```
如果測試失敗:
❌ "Returns incorrect number of trades"
   → 檢查交易邏輯

❌ "Performance result mismatch"
   → 檢查統計計算

❌ "Integration test failed"
   → 檢查策略交互
```

---

### 場景 3: 修改 API 客戶端

#### 代碼修改
```javascript
// 修改 js/layers/api/proxy-client.js
getStockData = async (params) => {
    // 你的新實現
    return data;
};
```

#### 自動檢測命令
```bash
# 步驟 1: 運行 API 測試
npm test tests/unit/api/proxy-client.test.js

# 步驟 2: 監視模式 (邊改邊測試)
npm run test:watch -- --testPathPattern="api"

# 步驟 3: 運行整合測試
npm run test:integration
```

#### 檢測會驗證
```
✅ API 端點連接
✅ 參數構造正確
✅ 錯誤處理完善
✅ 重試機制工作
✅ 緩存邏輯正確
✅ 超時管理準確
```

#### 故障診斷
```
如果測試失敗:
❌ "Network error not handled properly"
   → 檢查錯誤處理

❌ "Retry exceeded max attempts"
   → 檢查重試配置

❌ "Cache not working"
   → 檢查緩存邏輯
```

---

### 場景 4: 添加新策略

#### 代碼修改
```javascript
// 在 js/strategy-plugins/ 添加新文件
// my-strategy.js

module.exports = {
    name: 'my-strategy',
    description: '我的策略',
    execute: async (data, params) => {
        // 實現
        return signals;
    }
};
```

#### 自動檢測命令
```bash
# 步驟 1: 創建策略測試文件
# tests/unit/core/strategies/my-strategy.test.js

# 步驟 2: 運行策略測試
npm test tests/unit/core/strategies/my-strategy.test.js

# 步驟 3: 運行整合測試確保兼容
npm run test:integration
```

#### 檢測會驗證
```
✅ 策略介面正確
✅ 參數符合規範
✅ 返回值格式正確
✅ 異常情況處理
✅ 與回測引擎兼容
✅ 性能可接受
```

---

### 場景 5: 修改狀態管理

#### 代碼修改
```javascript
// 修改 js/layers/ui/state-manager.js
setCachedStockData = (data) => {
    // 你的新實現
};
```

#### 自動檢測命令
```bash
# 步驟 1: 運行狀態管理測試
npm test tests/unit/ui/state-manager.test.js

# 步驟 2: 監視相關測試
npm run test:watch -- --testPathPattern="state"

# 步驟 3: 檢查依賴模組
npm run test:integration
```

#### 檢測會驗證
```
✅ 狀態更新正確
✅ 緩存工作正常
✅ 數據同步準確
✅ 邊界情況處理
✅ 與 UI 交互正確
```

---

## 🛠️ 故障排查

### 問題 1: 測試失敗但不知道為什麼

#### 解決方案

```bash
# 1️⃣ 運行詳細輸出
npm run test:verbose

# 2️⃣ 運行單個失敗的測試
npm test -- --testNamePattern="failing test name"

# 3️⃣ 啟用調試模式
node --inspect-brk node_modules/.bin/jest --runInBand

# 4️⃣ 查看完整的錯誤堆棧
npm test -- --verbose --no-coverage
```

#### 理解錯誤信息

```
❌ "FAIL tests/unit/api/proxy-client.test.js"
   ↓ 文件路徑

● ProxyClient API 客戶端層 › 錯誤處理 › 應該處理網路錯誤
  ↓ 測試套件和測試名稱

Expected: toThrow("Network error")
Received: "Cannot read properties"
  ↓ 具體錯誤

41 | expect(received).toThrow(expected)
   ↓ 錯誤位置
```

---

### 問題 2: 性能測試超時

#### 解決方案

```bash
# 1️⃣ 增加測試超時時間
npm test -- --testTimeout=30000

# 2️⃣ 跳過性能測試進行快速檢測
npm test -- --testNamePattern="^((?!performance).)*$"

# 3️⃣ 分析性能瓶頸
npm test -- --logHeapUsage

# 4️⃣ 檢查代碼複雜度
npm run test:coverage -- --verbose
```

---

### 問題 3: Mock 數據不正確

#### 解決方案

```bash
# 1️⃣ 查看 setup.js 中的 mock 定義
cat tests/setup.js | grep -A 10 "global.fetch"

# 2️⃣ 檢查測試中的 mock 配置
npm test -- --verbose

# 3️⃣ 添加 debug 輸出
npm test -- --testNamePattern="your-test" --verbose
```

---

### 問題 4: 測試相互影響

#### 解決方案

```bash
# 1️⃣ 運行單個測試隔離
npm test tests/unit/api/proxy-client.test.js

# 2️⃣ 清理之前的 jest 快取
npm test -- --clearCache

# 3️⃣ 監視模式檢查
npm run test:watch

# 4️⃣ 重新初始化環境
npm install
npm test
```

---

## 🔧 CI/CD 集成

### 本地自動檢測設置 (Git Hooks)

#### 1️⃣ 安裝 Husky (自動檢測工具)

```bash
npm install husky --save-dev
npx husky install
```

#### 2️⃣ 添加提交前自動檢測

```bash
npx husky add .husky/pre-commit "npm test"
```

#### 3️⃣ 添加提交信息檢查

```bash
npx husky add .husky/commit-msg 'echo "Commit message validation"'
```

**效果**: 提交代碼前自動運行測試，失敗則阻止提交 ✅

---

### GitHub Actions 自動檢測設置

#### 創建文件: `.github/workflows/test.yml`

```yaml
name: 自動檢測

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: 使用 Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: 安裝依賴
      run: npm install
    
    - name: 運行單元測試
      run: npm run test:unit
    
    - name: 運行整合測試
      run: npm run test:integration
    
    - name: 生成覆蓋報告
      run: npm run test:coverage
    
    - name: 上傳覆蓋報告到 Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/coverage-final.json
        fail_ci_if_error: true
```

**效果**: 每次 push 或 PR 都自動運行完整測試 ✅

---

### Netlify 自動檢測設置

#### 在 `netlify.toml` 中添加

```toml
[build]
  command = "npm test && npm run build"
  publish = "dist"

[build.environment]
  NODE_ENV = "production"

# 預覽環境自動檢測
[build.processing]
  skip_processing = false
```

**效果**: 部署前自動運行測試 ✅

---

## 📊 檢測報告解讀

### 覆蓋率報告

```bash
npm run test:coverage
```

結果示例:
```
────────────────────────────────────────────────────
File            | % Stmts | % Branch | % Funcs | % Lines
────────────────────────────────────────────────────
All files       |   82.9  |   75.3   |   80.1  |   83.1
 api/           |   92.0  |   88.5   |   90.0  |   92.1
 core/          |   85.2  |   78.9   |   82.3  |   85.5
 ui/            |   75.3  |   70.2   |   76.8  |   76.2
 utils/         |   95.1  |   92.3   |   94.5  |   95.2
────────────────────────────────────────────────────
```

**解讀**:
- **% Stmts**: 語句覆蓋 (82.9% = 好)
- **% Branch**: 分支覆蓋 (75.3% = 中等)
- **% Funcs**: 函數覆蓋 (80.1% = 好)
- **% Lines**: 行覆蓋 (83.1% = 好)

**目標**: 都達到 80% 以上 ✅

---

### 詳細測試結果

```bash
npm run test:verbose
```

解讀:
```
✅ PASS - 測試通過
❌ FAIL - 測試失敗
⊘ SKIP - 測試跳過
● 未完成 - 測試超時或異常

總結:
Test Suites: 18 passed, 18 total (成功)
Tests:       264 passed, 264 total (全部通過)
Snapshots:   0 total (沒有快照)
Time:        18.754 s (總耗時)
```

---

## 📋 最佳實踐檢清單

### 每次提交前檢查清單

```
□ 修改代碼完成
□ 運行 npm test (所有測試通過)
□ 運行 npm run test:coverage (覆蓋率滿足要求)
□ 運行 npm run test:verbose (查看詳細結果)
□ 檢查是否有新的警告或錯誤
□ 提交代碼

✅ 所有項目通過後，安心提交!
```

### 新增功能檢查清單

```
□ 功能代碼完成
□ 創建對應測試文件
□ 單個測試運行通過
□ 整合測試運行通過
□ 覆蓋率達到 80%+
□ 沒有新增警告

✅ 準備提交!
```

### 修改現有功能檢查清單

```
□ 修改代碼完成
□ 相關測試運行通過
□ 不能破壞其他測試
□ 覆蓋率不能下降
□ 性能不能下降

✅ 準備提交!
```

---

## 🎯 命令速查表

### 最常用命令

| 命令 | 說明 | 適用場景 |
|------|------|---------|
| `npm test` | 運行所有測試 | 全面檢測 |
| `npm run test:watch` | 監視模式 | 邊改邊測試 |
| `npm run test:coverage` | 覆蓋率報告 | 品質檢查 |
| `npm run test:unit` | 只測單元 | 快速檢測 |
| `npm run test:integration` | 只測整合 | 檢查交互 |
| `npm run test:verbose` | 詳細輸出 | 除錯問題 |

### 按場景快速命令

```bash
# 📝 修改代碼後的快速檢測
npm test

# 🔄 邊改邊測試
npm run test:watch

# 📊 檢查代碼質量
npm run test:coverage

# 🐛 調試失敗的測試
npm run test:verbose

# 🚀 確保能部署
npm test && npm run test:coverage

# 🎯 只測試特定層
npm run test:unit -- --testPathPattern="api"
npm run test:unit -- --testPathPattern="core"
npm run test:unit -- --testPathPattern="ui"
```

---

## ✅ 總結

### 自動檢測的 3 個核心步驟

1. **修改代碼** → 在 `js/layers/` 中修改文件
2. **運行檢測** → `npm test` (自動執行所有檢測)
3. **提交代碼** → 所有測試通過後提交

### 核心概念

```
測試 = 自動驗證 = 保證質量 = 安心修改
```

### 檢測層級

```
單元測試 (API層、核心層、UI層)
    ↓
整合測試 (多模組交互)
    ↓
覆蓋率檢查 (代碼覆蓋)
    ↓
性能檢查 (執行速度)
    ↓
所有通過 = 準備上線 ✅
```

### 三句話總結

1. **修改後總是運行 `npm test`**
2. **所有測試通過才提交**
3. **用監視模式加快開發速度**

---

**祝您開發愉快！有任何問題隨時查看本指南。🚀**