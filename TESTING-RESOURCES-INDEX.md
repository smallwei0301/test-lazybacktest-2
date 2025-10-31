# 📚 自動檢測完整資源索引

## 🎯 按需求查找

### 我想要...

#### 🚀 快速開始
- **新手入門** → [`GETTING-STARTED.md`](GETTING-STARTED.md) ⭐⭐⭐⭐⭐
  - 第一天做什麼
  - 環境設置
  - 第一個修改
  - 常見問題

- **命令速查** → [`TESTING-CHEATSHEET.md`](TESTING-CHEATSHEET.md) ⭐⭐⭐⭐⭐
  - 最常用命令
  - 按層級檢測
  - 快速工作流
  - 打印版本

#### 🧪 學習測試
- **完整測試指南** → [`AUTOMATED-TESTING-GUIDE.md`](AUTOMATED-TESTING-GUIDE.md) ⭐⭐⭐⭐⭐
  - 快速開始
  - 自動檢測工作流
  - 各層級檢測
  - 常見場景
  - 故障排查
  - CI/CD 集成

- **TDD 工作流** → [`TDD-WORKFLOW-GUIDE.md`](TDD-WORKFLOW-GUIDE.md) ⭐⭐⭐⭐⭐
  - 核心概念
  - 完整工作流
  - 分步教程
  - 實戰示例
  - 最佳實踐

#### 📊 了解項目
- **項目影響分析** → [`IMPACT-ANALYSIS.md`](IMPACT-ANALYSIS.md) ⭐⭐⭐⭐☆
  - 修改前後對比
  - 性能改善
  - 新增功能
  - 投資回報率

- **快速概覽** → [`QUICK-OVERVIEW.md`](QUICK-OVERVIEW.md) ⭐⭐⭐⭐☆
  - 性能對比表
  - 功能清單
  - ROI 計算

- **詳細對比** → [`DETAILED-COMPARISON.md`](DETAILED-COMPARISON.md) ⭐⭐⭐⭐⭐
  - 修改前後並排比較
  - 代碼質量指標
  - 用戶感受變化

---

## 📋 按場景查找

### 場景 1: 我是新開發者

#### 第 1 天: 理解項目
```
1️⃣ 讀本文件 (5分鐘)
2️⃣ 讀 GETTING-STARTED.md (30分鐘)
3️⃣ 設置環境, 運行 npm test
```

#### 第 2-3 天: 學習工具
```
1️⃣ 讀 TESTING-CHEATSHEET.md (15分鐘)
2️⃣ 讀 AUTOMATED-TESTING-GUIDE.md (30分鐘)
3️⃣ 練習各種測試命令
4️⃣ 嘗試監視模式開發
```

#### 第 4-5 天: 學習 TDD
```
1️⃣ 讀 TDD-WORKFLOW-GUIDE.md (45分鐘)
2️⃣ 按教程寫第一個測試
3️⃣ 實現功能
4️⃣ 提交代碼
```

**推薦閱讀順序**: 
1. `GETTING-STARTED.md` ⭐⭐⭐⭐⭐
2. `TESTING-CHEATSHEET.md` ⭐⭐⭐⭐⭐
3. `AUTOMATED-TESTING-GUIDE.md` ⭐⭐⭐⭐⭐
4. `TDD-WORKFLOW-GUIDE.md` ⭐⭐⭐⭐⭐

---

### 場景 2: 我要修改現有功能

#### 快速檢查清單
```
□ 修改代碼完成
□ 運行相關層的測試
  npm test -- --testPathPattern="[層名]"
□ 運行整合測試
  npm run test:integration
□ 檢查覆蓋率
  npm run test:coverage
□ 確認沒有新警告
□ 提交代碼
```

**推薦查閱**: 
- `TESTING-CHEATSHEET.md` - 命令速查 ⭐⭐⭐⭐⭐
- `AUTOMATED-TESTING-GUIDE.md` - 常見場景 ⭐⭐⭐⭐⭐

---

### 場景 3: 我要添加新功能

#### 詳細步驟
```
1️⃣ 分析需求
2️⃣ 編寫測試 (RED)
3️⃣ 實現功能 (GREEN)
4️⃣ 優化代碼 (REFACTOR)
5️⃣ 檢查覆蓋率
6️⃣ 提交代碼
```

**推薦查閱**:
- `TDD-WORKFLOW-GUIDE.md` - 完整教程 ⭐⭐⭐⭐⭐
- `GETTING-STARTED.md` - 第一個修改 ⭐⭐⭐⭐⭐

---

### 場景 4: 我在調試測試失敗

#### 故障排查流程
```
1️⃣ 查看詳細輸出
   npm run test:verbose
2️⃣ 隻運行失敗的測試
   npm test -- --testNamePattern="test name"
3️⃣ 理解錯誤信息
4️⃣ 修改代碼
5️⃣ 重新測試
```

**推薦查閱**:
- `TESTING-CHEATSHEET.md` - 常見問題 ⭐⭐⭐⭐⭐
- `AUTOMATED-TESTING-GUIDE.md` - 故障排查 ⭐⭐⭐⭐⭐

---

### 場景 5: 我在建立 CI/CD

#### 集成步驟
```
1️⃣ 本地 Git Hooks (Husky)
2️⃣ GitHub Actions 工作流
3️⃣ Netlify 自動檢測
```

**推薦查閱**:
- `AUTOMATED-TESTING-GUIDE.md` - CI/CD 集成 ⭐⭐⭐⭐⭐

---

## 🗺️ 文件導航地圖

### 核心文檔 (必讀)

```
┌─────────────────────────────────────┐
│ 📖 GETTING-STARTED.md               │
│ 新開發者快速上手指南                  │
│ ⭐⭐⭐⭐⭐ 必讀                     │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌──────────────┐ ┌──────────────────┐
│ 📄 TESTING-  │ │ 🧪 AUTOMATED-   │
│ CHEATSHEET   │ │ TESTING-GUIDE    │
│ 命令速查     │ │ 完整檢測指南     │
│ ⭐⭐⭐⭐⭐ │ │ ⭐⭐⭐⭐⭐      │
└──────────────┘ └────────┬─────────┘
                         │
    ┌────────────────────┘
    ↓
┌─────────────────────────┐
│ 🔄 TDD-WORKFLOW-GUIDE  │
│ TDD 工作流程指南        │
│ ⭐⭐⭐⭐⭐ 必讀       │
└─────────────────────────┘
```

### 補充文檔 (了解項目)

```
┌──────────────────────────────┐
│ 📊 IMPACT-ANALYSIS.md        │
│ 深入影響分析                  │
│ ⭐⭐⭐⭐☆                  │
└──────────────────────────────┘
         ↓
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌──────────────┐
│ QUICK- │ │ DETAILED-    │
│OVERVIEW│ │COMPARISON    │
│快速概覽│ │詳細對比      │
│⭐⭐⭐ │ │⭐⭐⭐⭐⭐  │
└────────┘ └──────────────┘
```

---

## ⏱️ 按時間查找

### ⏰ 5 分鐘快速了解
- `TESTING-CHEATSHEET.md` - 最常用命令

### ⏰ 15 分鐘快速入門
- `GETTING-STARTED.md` - 環境設置和第一個修改

### ⏰ 30 分鐘學會基礎
- `TESTING-CHEATSHEET.md` (15分鐘)
- `AUTOMATED-TESTING-GUIDE.md` - 快速開始部分 (15分鐘)

### ⏰ 1 小時完整學習
- `GETTING-STARTED.md` (30分鐘)
- `TESTING-CHEATSHEET.md` (15分鐘)
- `AUTOMATED-TESTING-GUIDE.md` - 工作流部分 (15分鐘)

### ⏰ 2-3 小時深度學習
- `GETTING-STARTED.md` (30分鐘)
- `TESTING-CHEATSHEET.md` (15分鐘)
- `AUTOMATED-TESTING-GUIDE.md` (45分鐘)
- `TDD-WORKFLOW-GUIDE.md` (45分鐘)

### ⏰ 5+ 小時完全掌握
- 讀完所有上述文檔
- 加上 `IMPACT-ANALYSIS.md` 等補充文檔
- 理解項目歷史和設計理念

---

## 🎯 按專業角色查找

### 👨‍💼 項目經理 / 決策者
**需要了解**: 項目現狀、改善成果、投資回報

**推薦查閱**:
1. `IMPACT-ANALYSIS.md` - 完整影響分析 ⭐⭐⭐⭐☆
2. `QUICK-OVERVIEW.md` - 關鍵數字 ⭐⭐⭐⭐☆

**預計時間**: 20-30 分鐘

---

### 👨‍💻 開發者 (新手)
**需要了解**: 環境設置、工作流、常用命令

**推薦查閱**:
1. `GETTING-STARTED.md` - 入門指南 ⭐⭐⭐⭐⭐
2. `TESTING-CHEATSHEET.md` - 命令速查 ⭐⭐⭐⭐⭐
3. `AUTOMATED-TESTING-GUIDE.md` - 詳細指南 ⭐⭐⭐⭐⭐

**預計時間**: 2-3 小時

---

### 👨‍💻 開發者 (進階)
**需要了解**: TDD 工作流、最佳實踐、故障排查

**推薦查閱**:
1. `TDD-WORKFLOW-GUIDE.md` - 工作流程 ⭐⭐⭐⭐⭐
2. `AUTOMATED-TESTING-GUIDE.md` - 進階用法 ⭐⭐⭐⭐⭐

**預計時間**: 2-3 小時

---

### 🏗️ 架構師 / 技術鉛
**需要了解**: 架構設計、測試策略、代碼品質

**推薦查閱**:
1. `PROJECT_STRUCTURE_ANALYSIS.md` - 架構分析 ⭐⭐⭐⭐⭐
2. `AUTOMATED-TESTING-GUIDE.md` - 全部內容 ⭐⭐⭐⭐⭐
3. `DETAILED-COMPARISON.md` - 代碼質量對比 ⭐⭐⭐⭐⭐

**預計時間**: 3-4 小時

---

### 👥 技術主管 / Scrum Master
**需要了解**: 工作流程、團隊協作、質量保証

**推薦查閱**:
1. `GETTING-STARTED.md` - 團隊檢查清單 ⭐⭐⭐⭐⭐
2. `TESTING-CHEATSHEET.md` - 團隊協作部分 ⭐⭐⭐⭐⭐
3. `AUTOMATED-TESTING-GUIDE.md` - CI/CD 部分 ⭐⭐⭐⭐⭐

**預計時間**: 1-2 小時

---

## 🔗 相關鏈接

### 內部文檔
- `README.md` - 項目基本信息
- `TDD-REFACTORING-REPORT.md` - 重構成果報告
- `IMPACT-SUMMARY-INDEX.md` - 改善總結
- `PROJECT_STRUCTURE_ANALYSIS.md` - 結構分析

### 代碼文件 (推薦閱讀順序)
```
易 → 難

簡單:
- js/layers/api/proxy-client.js (API 調用)
- js/layers/utils/* (工具函數)

中等:
- js/layers/core/indicators.js (技術指標)
- js/layers/ui/state-manager.js (狀態管理)

複雜:
- js/layers/core/backtest-engine.js (回測引擎)
- js/layers/core/strategy-manager.js (策略管理)
- js/layers/ui/ui-controller.js (UI 控制)
```

### 測試文件
```
- tests/unit/api/* - API 層測試
- tests/unit/core/* - 核心層測試
- tests/unit/ui/* - UI 層測試
- tests/integration/* - 整合測試
```

---

## 📞 快速問題解答

### Q: 我應該從哪裡開始?
**A**: 如果你是新開發者，從 `GETTING-STARTED.md` 開始。

### Q: 我只有 5 分鐘，看什麼?
**A**: `TESTING-CHEATSHEET.md` 中的最常用命令部分。

### Q: 我要修改代碼，需要做什麼?
**A**: 看 `TESTING-CHEATSHEET.md` 和 `AUTOMATED-TESTING-GUIDE.md`。

### Q: 我想學 TDD?
**A**: 看 `TDD-WORKFLOW-GUIDE.md` 和 `GETTING-STARTED.md` 中的教程。

### Q: 測試失敗了，怎麼辦?
**A**: 看 `TESTING-CHEATSHEET.md` 或 `AUTOMATED-TESTING-GUIDE.md` 中的故障排查部分。

### Q: 所有文檔在哪裡?
**A**: 都在項目根目錄，檔名是 `*.md` 的 Markdown 文件。

---

## ✨ 最後建議

### 學習順序 (推薦)

```
Day 1: 環境設置 + 理解架構
  - GETTING-STARTED.md (30分鐘)
  - npm test (15分鐘)
  - 閱讀代碼 (30分鐘)

Day 2-3: 學習工具和工作流
  - TESTING-CHEATSHEET.md (15分鐘)
  - AUTOMATED-TESTING-GUIDE.md (45分鐘)
  - 練習各種命令 (1小時)

Day 4-5: 深度學習 TDD
  - TDD-WORKFLOW-GUIDE.md (45分鐘)
  - 跟著教程寫代碼 (2小時)
  - 做第一個修改 (1-2小時)

Day 6+: 實踐應用
  - 修改現有功能
  - 添加新功能
  - 積累經驗
```

### 成功標誌

```
✅ 能獨立運行所有測試命令
✅ 理解測試失敗的原因
✅ 能寫簡單的測試
✅ 能實現簡單的功能
✅ 能提交代碼並通過檢查
✅ 熟悉 TDD 工作流
✅ 能使用監視模式開發
✅ 能解決常見問題
```

---

## 🎉 結語

> **"掌握自動化檢測和 TDD，你將成為一個更好的開發者。這些文檔將是你的伙伴。"**

**現在就開始吧！** 🚀

---

**快速導航**:
- 新手入門: [`GETTING-STARTED.md`](GETTING-STARTED.md)
- 命令速查: [`TESTING-CHEATSHEET.md`](TESTING-CHEATSHEET.md)
- 完整指南: [`AUTOMATED-TESTING-GUIDE.md`](AUTOMATED-TESTING-GUIDE.md)
- TDD 工作流: [`TDD-WORKFLOW-GUIDE.md`](TDD-WORKFLOW-GUIDE.md)

**需要幫助?** 查看上面的「快速問題解答」部分或相關文檔。