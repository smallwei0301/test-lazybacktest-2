# ⚡ 自動檢測命令備忘單

## 🎯 最常用 (複製即用)

### 修改代碼後

```bash
# ✅ 標準檢測 (推薦)
npm test

# ✅ 快速檢測 (邊改邊測)
npm run test:watch

# ✅ 詳細檢測 (了解細節)
npm run test:verbose
```

---

## 🔧 按層級檢測

### API 層 (ProxyClient)
```bash
npm test tests/unit/api/proxy-client.test.js
npm test -- --testPathPattern="api"
npm run test:watch -- --testPathPattern="api"
```

### 核心層 (回測、策略、指標)
```bash
# 回測引擎
npm test tests/unit/core/backtest-engine.test.js

# 策略管理
npm test tests/unit/core/strategy-manager.test.js

# 技術指標
npm test tests/unit/core/indicators.test.js

# 所有核心層
npm test -- --testPathPattern="core"
```

### UI 層 (UIController、狀態管理)
```bash
# UI 控制器
npm test tests/unit/ui/ui-controller.test.js

# 狀態管理器
npm test tests/unit/ui/state-manager.test.js

# 所有 UI 層
npm test -- --testPathPattern="ui"
```

### 整合測試 (多模組交互)
```bash
npm run test:integration
npm test tests/integration/final-integration.test.js
```

---

## 📊 質量檢查

```bash
# 查看覆蓋率
npm run test:coverage

# 針對特定模組的覆蓋率
npm run test:coverage -- --testPathPattern="api"
npm run test:coverage -- --testPathPattern="core"
npm run test:coverage -- --testPathPattern="ui"

# 生成 HTML 覆蓋報告 (在 coverage/lcov-report/ 中打開)
npm run test:coverage
# 然後打開: coverage/lcov-report/index.html
```

---

## 🚀 快速工作流

### 場景 1: 快速開發 (推薦)

```bash
# 步驟 1: 打開監視模式
npm run test:watch

# 步驟 2: 修改代碼
# (在編輯器中修改)

# 步驟 3: 自動測試 (監視模式會自動運行)
# 測試結果立即顯示

# 步驟 4: 修復問題 (重複直到通過)

# 步驟 5: 檢查覆蓋率
npm run test:coverage
```

### 場景 2: 完整檢測 (提交前)

```bash
# 1. 單元測試
npm run test:unit

# 2. 整合測試
npm run test:integration

# 3. 覆蓋率檢查
npm run test:coverage

# 4. 詳細檢查
npm run test:verbose

# 5. 一切正常 → 提交
git commit -m "修改說明"
```

### 場景 3: 故障排查

```bash
# 1. 查看詳細輸出
npm run test:verbose

# 2. 運行單個失敗測試
npm test -- --testNamePattern="failing test name"

# 3. 看完整堆棧
npm test -- --verbose --no-coverage

# 4. 監視單個測試
npm run test:watch -- --testNamePattern="test name"
```

---

## 🎯 常見命令組合

### 修改 API 層後
```bash
npm test tests/unit/api/ && npm run test:coverage
```

### 修改核心層後
```bash
npm test tests/unit/core/ && npm run test:integration
```

### 修改 UI 層後
```bash
npm test tests/unit/ui/ && npm run test:integration
```

### 準備提交前
```bash
npm test && npm run test:coverage && npm run test:verbose
```

### 快速確認沒破壞
```bash
npm test
```

---

## 📋 完整命令列表

| 命令 | 說明 | 適用場景 |
|------|------|---------|
| `npm test` | 運行所有測試 | 完整檢測 |
| `npm run test:watch` | 監視模式 | 邊改邊測 |
| `npm run test:coverage` | 覆蓋率報告 | 品質檢查 |
| `npm run test:verbose` | 詳細輸出 | 了解細節 |
| `npm run test:unit` | 只運行單元測試 | 快速檢查 |
| `npm run test:integration` | 只運行整合測試 | 檢查交互 |
| `npm run test:legacy` | 運行舊測試 | 兼容檢查 |
| `npm run typecheck` | TypeScript 檢查 | 類型檢查 |

---

## 🎪 按場景選擇

### 💻 日常開發
```bash
npm run test:watch
```

### 🚀 準備提交
```bash
npm test && npm run test:coverage
```

### 🐛 調試問題
```bash
npm run test:verbose
```

### ⚡ 快速確認
```bash
npm test
```

### 📊 檢查品質
```bash
npm run test:coverage
```

---

## 💡 提示

### 1️⃣ 監視模式很強大
```bash
npm run test:watch

# 優點:
# - 只測試有變更的文件
# - 自動重新運行
# - 實時反饋
# - 開發更快
```

### 2️⃣ 快速過濾測試
```bash
# 只測試包含 "api" 的測試
npm test -- --testPathPattern="api"

# 只測試包含 "should handle" 的測試
npm test -- --testNamePattern="should handle"
```

### 3️⃣ 清理 Jest 快取
```bash
# 快取有時會造成奇怪的問題
npm test -- --clearCache
npm test
```

### 4️⃣ 跳過某些測試
```bash
# 跳過包含 "slow" 的測試
npm test -- --testNamePattern="^((?!slow).)*$"

# 跳過某個測試
# 在測試中使用 test.skip()
test.skip('這個測試會被跳過', () => {});
```

---

## 🚨 常見問題快速解決

### 問題: 測試卡住不動
```bash
# 解決:
npm test -- --clearCache
npm test
```

### 問題: 某個測試持續失敗
```bash
# 看詳細信息:
npm run test:verbose -- --testNamePattern="failing test"
```

### 問題: 想看某個層的全部測試
```bash
# 看 API 層:
npm test -- --testPathPattern="api"

# 看核心層:
npm test -- --testPathPattern="core"

# 看 UI 層:
npm test -- --testPathPattern="ui"
```

### 問題: 不知道測試覆蓋率如何
```bash
npm run test:coverage

# 然後打開: coverage/lcov-report/index.html
```

---

## ⌨️ 鍵盤快捷鍵 (監視模式)

當使用 `npm run test:watch` 時:

| 快捷鍵 | 功能 |
|--------|------|
| `a` | 運行所有測試 |
| `p` | 按文件名過濾 |
| `t` | 按測試名過濾 |
| `q` | 退出 |
| `Enter` | 重新運行 |

---

## 📌 快速參考卡片

### 打印出來放在桌邊

```
┌─────────────────────────────────────┐
│   LazyBacktest 自動檢測備忘單      │
├─────────────────────────────────────┤
│ 開發中:   npm run test:watch       │
│ 提交前:   npm test                 │
│ 品質檢查: npm run test:coverage    │
│ 故障排查: npm run test:verbose     │
│ 快速確認: npm test                 │
├─────────────────────────────────────┤
│ 測試特定層:                        │
│ API:  npm test -- --testPath...api │
│ 核心: npm test -- --testPath...core│
│ UI:   npm test -- --testPath...ui  │
├─────────────────────────────────────┤
│ 整合測試:                          │
│ npm run test:integration           │
├─────────────────────────────────────┤
│ 監視快捷鍵:                        │
│ a - 全部  p - 文件  t - 名稱  q-退│
└─────────────────────────────────────┘
```

---

## 💼 團隊協作建議

### 提交代碼前檢查清單

```
□ npm test (全部通過)
□ npm run test:coverage (80%+)
□ npm run test:verbose (沒有警告)
□ git status (只有想提交的文件)
□ 準備提交!
```

### Code Review 時檢查

```
□ 有對應的測試嗎?
□ 測試是否充分?
□ 覆蓋率是否達到 80%?
□ 是否有新的警告?
□ 現有測試是否仍通過?
```

---

**祝您檢測愉快！** 🚀

更詳細的指南見:
- `AUTOMATED-TESTING-GUIDE.md` - 完整測試指南
- `TDD-WORKFLOW-GUIDE.md` - TDD 工作流程