# 🤖 網站自動化驗證 - 執行指南

**目的**: 使用 Puppeteer 進行完整的網站自動化測試  
**狀態**: ✅ 已生成 `website-automated-verification.js`

---

## 📋 快速開始

### 步驟 1: 安裝依賴

```bash
npm install puppeteer dotenv
```

或使用 yarn:

```bash
yarn add puppeteer dotenv
```

### 步驟 2: 執行驗證腳本

```bash
node website-automated-verification.js
```

### 步驟 3: 查看結果

驗證完成後，查看生成的報告：

```bash
cat WEBSITE_VERIFICATION_RESULTS.json
```

---

## 🎯 腳本做了什麼？

### ✅ 8 項自動化檢查

1. **瀏覽器緩存清除** - 清除所有緩存和存儲
2. **網站訪問** - 驗證網站可正常訪問
3. **批量優化執行** - 進入批量優化頁面並執行
4. **滾動測試執行** - 進入滾動測試頁面並執行
5. **P1 日誌檢查** - 驗證 P1 日誌消息是否出現
6. **P2 日誌檢查** - 驗證 P2 日誌消息是否出現
7. **lookbackDays 一致性** - 驗證兩側值是否相同
8. **錯誤檢查** - 驗證 Console 中無紅色錯誤

---

## 📊 預期輸出

執行後您應看到：

```
================================================================================
  🌐 網站自動化驗證
================================================================================

目標 URL: https://test-lazybacktest.netlify.app
無頭模式: 關閉（可見瀏覽器窗口）

================================================================================
  🚀 初始化瀏覽器
================================================================================

✅ 瀏覽器初始化
   └─ 已啟動 Chromium

================================================================================
  🗑️  清除瀏覽器緩存
================================================================================

✅ 清除緩存
   └─ 已清除所有緩存和存儲

================================================================================
  🌐 訪問網站
================================================================================

🌐 正在訪問: https://test-lazybacktest.netlify.app
✅ 網站訪問
   └─ 頁面標題: Test LazyBacktest
✅ 頁面加載
   └─ 頁面內容已加載

...

================================================================================
  📊 驗證結果
================================================================================

📈 驗證結果: 8/8 通過

✅ 驗證報告已保存到: /path/to/WEBSITE_VERIFICATION_RESULTS.json

================================================================================
  ✅ 驗證完成
================================================================================

🎉 全部檢查項通過！
```

---

## 🔧 自定義配置

### 修改目標 URL

方式 1 - 環境變數:
```bash
URL=https://your-url.com node website-automated-verification.js
```

方式 2 - 修改腳本:
編輯 `website-automated-verification.js` 中的 `CONFIG.url`

### 修改瀏覽器模式

編輯第 20 行：
```javascript
headless: false, // 改為 true 以隱藏瀏覽器窗口
```

### 調整超時時間

編輯 `CONFIG.timeout`:
```javascript
timeout: 60000, // 毫秒，默認 60 秒
```

---

## 📝 報告格式

驗證完成後生成的 `WEBSITE_VERIFICATION_RESULTS.json` 包含：

```json
{
  "timestamp": "2025-11-17T10:00:00.000Z",
  "duration": 30000,
  "website": "https://test-lazybacktest.netlify.app",
  "checks": {
    "cacheCleared": true,
    "websiteAccess": true,
    "batchOptimizationExecutable": true,
    "rollingTestExecutable": true,
    "p1LogsFound": true,
    "p2LogsFound": true,
    "lookbackValuesConsistent": true,
    "noErrors": true
  },
  "details": {
    "p1Logs": [
      "[Batch Optimization] P1: Calculated lookback for strategies [...]: 90 days",
      "[Rolling Test] P1: Calculated lookback for strategies [...]: 90 days"
    ],
    "p2Logs": [
      "[Batch Optimization] P2: Using provided lookbackDays=90 from strategy calculation",
      "[Rolling Test] P2: Using provided lookbackDays=90 from strategy calculation"
    ],
    "lookbackValues": {
      "batchOptimization": 90,
      "rollingTest": 90
    },
    "errors": [],
    "consoleLogs": [...]
  }
}
```

---

## ⚙️ 故障排查

### 問題 1: "Puppeteer 未安裝"

```bash
npm install puppeteer
```

### 問題 2: "瀏覽器初始化失敗"

可能原因:
- Puppeteer 的 Chromium 未下載完成
- 系統缺少必要的依賴

解決:
```bash
npm install --save-dev puppeteer
# 重新下載 Chromium
```

### 問題 3: "網站訪問超時"

可能原因:
- 網絡連接問題
- 網站伺服器響應慢

解決:
- 增加超時時間
- 檢查網絡連接
- 檢查網站是否在線

### 問題 4: "找不到批量優化按鈕"

可能原因:
- 網頁結構已更改
- 元素選擇器不準確

解決:
- 手動檢查網站中按鈕的 HTML 結構
- 更新腳本中的選擇器

---

## 🎬 完整執行流程

### 推薦執行步驟

1. **安裝依賴**
   ```bash
   npm install puppeteer dotenv
   ```

2. **執行驗證**
   ```bash
   node website-automated-verification.js
   ```

3. **查看結果**
   ```bash
   cat WEBSITE_VERIFICATION_RESULTS.json | jq .checks
   ```

4. **分析詳情**
   - 查看 P1/P2 日誌
   - 驗證 lookbackDays 值
   - 檢查任何錯誤

---

## 📊 檢查項詳解

### ✅ 瀏覽器緩存清除
- 使用 CDP 清除瀏覽器緩存
- 清除 localStorage 和 sessionStorage

### ✅ 網站訪問
- 訪問指定的 URL
- 等待網絡空閒
- 驗證頁面內容已加載

### ✅ 批量優化執行
- 進入批量優化頁面
- 選擇策略
- 設置參數
- 點擊開始按鈕
- 等待執行完成

### ✅ 滾動測試執行
- 進入滾動測試頁面
- 選擇相同策略
- 點擊開始按鈕
- 等待執行完成

### ✅ P1/P2 日誌檢查
- 監聽所有 console 消息
- 提取包含 "P1:" 和 "P2:" 的日誌
- 記錄日誌內容

### ✅ lookbackDays 一致性
- 從 P1 日誌中提取日期值
- 比較批量優化和滾動測試的值
- 驗證它們是否相同

### ✅ 錯誤檢查
- 監聽 console.error 消息
- 捕獲頁面錯誤
- 記錄所有錯誤

---

## 🎯 成功標準

### ✅ 全部通過 (8/8)

```json
{
  "checks": {
    "cacheCleared": true,
    "websiteAccess": true,
    "batchOptimizationExecutable": true,
    "rollingTestExecutable": true,
    "p1LogsFound": true,
    "p2LogsFound": true,
    "lookbackValuesConsistent": true,
    "noErrors": true
  }
}
```

結論: **驗證成功** ✅

### ⚠️  部分通過

某些檢查項失敗，需要進一步調查

### ❌ 完全失敗

多數檢查項失敗，可能的原因:
- 網站無法訪問
- 代碼部署有誤
- 功能實現有問題

---

## 📋 後續步驟

### 若全部通過

1. 保存驗證報告
2. 可進行性能測試
3. 準備上線

### 若部分失敗

1. 檢查詳細的日誌信息
2. 在 Console 中手動驗證
3. 修復發現的問題
4. 重新執行驗證

### 若完全失敗

1. 手動訪問網站並檢查功能
2. 查看 Netlify 部署日誌
3. 檢查代碼部署過程
4. 驗證部署的檔案內容

---

## 💡 提示

- **保留瀏覽器窗口打開** - 將 `headless: false` 便於觀察執行過程
- **調整執行速度** - 增加 `slowMo` 值以減慢操作速度
- **查看控制台輸出** - 實時監控驗證進度
- **保存報告** - 每次驗證都會保存新報告

---

## 🚀 現在就執行！

```bash
# 1. 安裝依賴
npm install puppeteer dotenv

# 2. 執行驗證
node website-automated-verification.js

# 3. 查看結果
cat WEBSITE_VERIFICATION_RESULTS.json
```

---

**準備好了嗎？執行驗證腳本吧！** 🎯

