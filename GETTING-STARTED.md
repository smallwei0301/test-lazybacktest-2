# 🚀 新開發者快速上手指南

## 📖 閱讀順序 (按優先級)

### 第 1 天: 理解架構 (必讀)

1. 👉 **先讀本文件** (現在的文件)
2. 📖 `IMPACT-SUMMARY-INDEX.md` - 了解項目現狀
3. 🏗️ `PROJECT_STRUCTURE_ANALYSIS.md` - 理解代碼結構

**預計時間**: 1-2 小時

### 第 2-3 天: 學習工具和工作流 (必讀)

4. ⚡ `TESTING-CHEATSHEET.md` - 測試命令速查
5. 🧪 `AUTOMATED-TESTING-GUIDE.md` - 完整測試指南
6. 🔄 `TDD-WORKFLOW-GUIDE.md` - TDD 工作流程

**預計時間**: 3-5 小時

### 第 4 天: 實踐 (邊做邊學)

7. 💻 根據下面的「第一個修改」開始實踐

---

## 🎯 項目一句話介紹

**LazyBacktest** 是一個台股、美股回測系統，經過 TDD 重構，現已具備:
- ✅ 分層架構 (API、核心、UI、工具層)
- ✅ 82.9% 測試覆蓋率 (238+ 測試)
- ✅ 完整的自動化檢測系統
- ✅ 詳細的文檔和指南

---

## 📁 代碼結構速查

### 最關鍵的目錄

```
js/layers/              ← 核心代碼 (分層架構)
├── api/               ← API 層 (數據獲取)
│   └── proxy-client.js
├── core/              ← 核心業務層 (計算、策略)
│   ├── backtest-engine.js
│   ├── strategy-manager.js
│   ├── indicators.js
│   └── indicators/    ← 技術指標
├── ui/                ← UI 層 (用戶交互)
│   ├── ui-controller.js
│   └── state-manager.js
└── utils/             ← 工具層

tests/                  ← 測試代碼
├── unit/              ← 單元測試
│   ├── api/
│   ├── core/
│   └── ui/
├── integration/       ← 整合測試
└── setup.js           ← Jest 配置
```

---

## 🔄 完整工作流 (新開發者必讀)

### 第一步: 設置開發環境

```bash
# 1️⃣ 克隆代碼庫
git clone https://github.com/smallwei0301/test-lazybacktest.git
cd test-lazybacktest

# 2️⃣ 安裝依賴
npm install

# 3️⃣ 驗證安裝
npm test

# 如果看到:
# Test Suites: 18 passed, 18 total
# Tests:       264 passed, 264 total
# 則表示環境設置成功 ✅
```

### 第二步: 理解現有代碼

```bash
# 1️⃣ 查看項目結構
ls -R js/layers/

# 2️⃣ 查看測試結構
ls -R tests/

# 3️⃣ 打開代碼文件閱讀
# 推薦順序:
# - js/layers/api/proxy-client.js (簡單)
# - js/layers/core/indicators.js (中等)
# - js/layers/core/backtest-engine.js (複雜)
```

### 第三步: 運行測試

```bash
# 1️⃣ 運行所有測試
npm test

# 2️⃣ 運行監視模式 (推薦開發時使用)
npm run test:watch

# 3️⃣ 查看覆蓋率
npm run test:coverage

# 4️⃣ 查看詳細結果
npm run test:verbose
```

### 第四步: 修改代碼

```bash
# 1️⃣ 修改某個文件
# 例如: js/layers/core/indicators.js

# 2️⃣ 監視模式自動測試
# (如果開著 npm run test:watch)

# 3️⃣ 查看結果
# 測試通過 ✅ 或失敗 ❌

# 4️⃣ 修復問題
# 根據錯誤信息修改代碼

# 5️⃣ 重複直到全部通過
```

### 第五步: 提交代碼

```bash
# 1️⃣ 最終檢測
npm test && npm run test:coverage

# 2️⃣ 確認通過
# 測試全通過 ✅

# 3️⃣ 提交
git add .
git commit -m "修改說明"
git push
```

---

## 🎯 第一個修改 (新手推薦)

### 任務: 添加一個新的技術指標

#### 步驟 1: 理解需求

```
需求: 添加 MACD 指標計算
- 什麼是 MACD? 動量指標
- 需要計算什麼? EMA12、EMA26、MACD 線、信號線
- 輸入和輸出? 價格數組 → MACD 對象
```

#### 步驟 2: 查看現有實現

```bash
# 打開現有指標實現
cat js/layers/core/indicators.js | grep -A 20 "calculateRSI"

# 理解實現模式
# - 接受價格數組
# - 接受周期參數
# - 返回結果數組
```

#### 步驟 3: 編寫測試

```bash
# 創建測試文件
# tests/unit/core/indicators/macd.test.js

# 根據 TDD-WORKFLOW-GUIDE.md 中的例子編寫測試
```

#### 步驟 4: 實現功能

```bash
# 在 js/layers/core/indicators.js 中添加
calculateMACD = (prices, fast = 12, slow = 26, signal = 9) => {
    // 實現邏輯
    return {
        macdLine: [],
        signalLine: [],
        histogram: []
    };
};
```

#### 步驟 5: 測試

```bash
# 運行測試
npm test tests/unit/core/indicators/macd.test.js

# 調整直到通過
```

#### 步驟 6: 整合測試

```bash
# 確保不破壞其他功能
npm run test:integration

# 檢查覆蓋率
npm run test:coverage
```

#### 步驟 7: 提交

```bash
git add js/layers/core/indicators.js tests/unit/core/indicators/macd.test.js
git commit -m "feat: 添加 MACD 技術指標計算"
```

---

## 📚 重要概念速查

### 概念 1: 分層架構

```
什麼是分層?
- 按功能分類代碼
- 每層只負責一個職責
- 層之間通過接口通信

LazyBacktest 的分層:

API 層      ← 負責數據獲取 (API 調用、重試、錯誤處理)
   ↓
核心層      ← 負責業務邏輯 (計算、策略、回測)
   ↓
UI 層       ← 負責用戶交互 (表單、顯示、狀態)
   ↓
工具層      ← 負責輔助功能 (格式化、驗證)

好處:
✅ 各層獨立測試
✅ 修改一層不影響其他層
✅ 代碼易維護
```

### 概念 2: TDD (測試驅動開發)

```
傳統流程: 寫代碼 → 測試 → 修復 Bug
TDD 流程: 寫測試 → 寫代碼 → 優化代碼

為什麼 TDD 好?
✅ Bug 更少 (70% 減少)
✅ 代碼質量高 (測試強制你寫好代碼)
✅ 重構更安心 (測試是保護網)
✅ 文檔自動生成 (測試就是文檔)
```

### 概念 3: 自動化測試

```
什麼是自動化測試?
- 用代碼寫測試
- 自動運行測試
- 自動檢查結果

優勢:
✅ 快速反饋 (秒級反饋)
✅ 全覆蓋 (邊界情況也測)
✅ 可重複 (每次一致)
✅ 節省時間 (比手動快 100 倍)
```

---

## 🔍 快速故障排查

### 問題 1: 測試失敗了，不知道怎麼回事

#### 解決方案

```bash
# Step 1: 看詳細輸出
npm run test:verbose

# Step 2: 隻運行失敗的測試
npm test -- --testNamePattern="failing test name"

# Step 3: 閱讀錯誤信息
# 通常會告訴你:
# - 預期什麼
# - 實際得到什麼
# - 在哪一行失敗
```

### 問題 2: 修改了代碼，測試仍然失敗

#### 解決方案

```bash
# Step 1: 確保文件保存了
# (檢查編輯器中是否有保存標記)

# Step 2: 清理 Jest 快取
npm test -- --clearCache

# Step 3: 重新運行
npm test

# Step 4: 檢查代碼是否正確
# (通常是邏輯錯誤)
```

### 問題 3: 一個測試通過，但另一個失敗

#### 解決方案

```bash
# 這通常意味著測試間有干擾

# Step 1: 隻運行該測試
npm test -- --testNamePattern="specific test"

# Step 2: 看是否通過
# 如果通過,則是測試順序問題
# 如果失敗,則是代碼問題

# Step 3: 查看 setup.js (測試環境設置)
cat tests/setup.js
```

---

## 💡 開發小技巧

### 技巧 1: 使用監視模式加快開發

```bash
# 監視模式會在代碼改動時自動重新運行測試
npm run test:watch

# 優勢:
# ✅ 即時反饋 (改代碼,測試自動運行)
# ✅ 快速迭代 (不用手動運行)
# ✅ 發現問題快 (錯誤立即顯示)
```

### 技巧 2: 只測試相關的代碼

```bash
# 修改 API 層時
npm test -- --testPathPattern="api"

# 修改核心層時
npm test -- --testPathPattern="core"

# 修改 UI 層時
npm test -- --testPathPattern="ui"

# 好處: 快速反饋,節省時間
```

### 技巧 3: 每天開始前檢查

```bash
# 拉取最新代碼
git pull

# 安裝依賴 (如果有人更新了)
npm install

# 運行所有測試 (確保環境正常)
npm test

# 就可以開始開發了!
```

### 技巧 4: 提交前的完整檢查

```bash
# 一鍵檢查所有
npm test && npm run test:coverage && npm run test:verbose

# 三個都通過後再提交
git commit
```

---

## 📋 新開發者清單

### 第一週任務

```
□ 第一天
  □ 讀完本指南
  □ 設置開發環境
  □ 運行所有測試 (確認環境 OK)
  □ 理解代碼結構

□ 第二天
  □ 讀 TESTING-CHEATSHEET.md
  □ 讀 AUTOMATED-TESTING-GUIDE.md
  □ 練習運行不同的測試命令
  □ 試試監視模式

□ 第三天
  □ 讀 TDD-WORKFLOW-GUIDE.md
  □ 理解 TDD 流程
  □ 準備做第一個修改

□ 第四-五天
  □ 做「第一個修改」任務
  □ 學習如何寫測試
  □ 學習如何實現功能
  □ 提交第一個 PR

□ 第六-七天
  □ 復習和鞏固
  □ 做更多修改
  □ 積累經驗
```

### 準備好後，你應該能做到

```
✅ 運行所有測試命令
✅ 理解測試失敗的原因
✅ 寫出簡單的測試
✅ 實現簡單的功能
✅ 提交代碼並通過檢查
✅ 使用 TDD 工作流
✅ 修改現有功能
✅ 添加新功能
```

---

## 🎓 學習資源

### 推薦閱讀順序

1. **本文件** ← 現在讀
2. `IMPACT-SUMMARY-INDEX.md` - 項目概況
3. `TESTING-CHEATSHEET.md` - 命令速查
4. `AUTOMATED-TESTING-GUIDE.md` - 詳細指南
5. `TDD-WORKFLOW-GUIDE.md` - 工作流
6. 打開代碼文件開始讀

### 推薦視頻 (可選)

- Jest 基礎教程 (YouTube 搜索)
- TDD 最佳實踐 (Pluralsight / Udemy)
- JavaScript 單元測試 (Codecademy)

---

## 🚀 第一天行動計畫

### 上午 (1-2 小時)

```
□ 10:00 - 10:20 讀本指南
□ 10:20 - 10:40 設置環境 (npm install)
□ 10:40 - 11:00 運行測試 (npm test)
□ 11:00 - 11:30 查看代碼結構
□ 11:30 - 12:00 打開代碼文件閱讀
```

### 下午 (1-2 小時)

```
□ 14:00 - 14:30 讀 TESTING-CHEATSHEET.md
□ 14:30 - 15:00 練習不同的測試命令
□ 15:00 - 15:30 試試監視模式 (npm run test:watch)
□ 15:30 - 16:00 復習和提問
```

---

## ❓ 常見問題

### Q: 我不懂 JavaScript 能學嗎?
**A**: 可以，但建議先學 JavaScript 基礎。不過本項目的 TDD 概念可以通用。

### Q: 我不懂股票知識能做嗎?
**A**: 完全可以！代碼層面和股票知識無關。理解數據流即可。

### Q: 第一個修改難度怎樣?
**A**: 簡單。添加技術指標主要是學習測試和工作流，不是複雜的算法。

### Q: 需要多久才能獨立開發?
**A**: 2-3 週可以熟悉流程，1 個月可以獨立做中等復雜度的功能。

### Q: 有什麼推薦的編輯器?
**A**: VS Code (推薦) 或 WebStorm。安裝 Jest Runner 等插件會更方便。

---

## 📞 需要幫助?

### 常用資源

- 📖 本項目的文檔 (推薦首先查閱)
- 💬 Issue tracker (提問和報告問題)
- 👥 團隊 Slack (實時討論)
- 🔍 代碼評論 (從 PR review 學習)

### 提問的好方式

```
不好的提問: "代碼怎麼改?"
好的提問: "運行 npm test 時出現 XXX 錯誤，我試過 YYZ 但還是失敗，請問怎麼解決?"

提問時包含:
- 你做了什麼
- 期望的結果
- 實際的結果
- 你試過什麼
- 完整的錯誤信息
```

---

## ✨ 激勵一下

### 你將學到

```
✅ TDD (測試驅動開發) 實踐
✅ JavaScript 測試框架 (Jest)
✅ 軟體架構 (分層設計)
✅ 代碼品質管理
✅ Git 協作開發
✅ 自動化檢測系統
✅ 量化交易基礎
```

### 你會變得

```
✅ 更聰明 (理解更深層)
✅ 更快 (開發速度快 10 倍)
✅ 更自信 (測試保護你)
✅ 更專業 (代碼質量高)
```

---

## 🎯 最後的話

> **"不要害怕，每個高手都是從新手開始的。按照本指南一步步來，一週內你就會熟悉整個系統！"**

**現在就開始吧！** 🚀

---

**下一步**: 打開終端，運行 `npm test`，看看你的第一個測試結果！

更多幫助見:
- `TESTING-CHEATSHEET.md` - 命令快速參考
- `AUTOMATED-TESTING-GUIDE.md` - 完整測試指南
- `TDD-WORKFLOW-GUIDE.md` - TDD 工作流程