# ⚡ 立即執行網站自動化驗證

**最快方式**: 3 條命令執行完整的網站驗證

---

## 🚀 30 秒快速開始

### 1️⃣ 安裝依賴 (1 分鐘)

```bash
npm install puppeteer dotenv
```

### 2️⃣ 執行驗證 (2-3 分鐘)

```bash
node website-automated-verification.js
```

### 3️⃣ 查看結果 (10 秒)

```bash
cat WEBSITE_VERIFICATION_RESULTS.json
```

---

## 📊 預期成功結果

執行後應該看到：

```
================================================================================
  🎉 全部檢查項通過！
================================================================================

✅ 瀏覽器緩存清除
✅ 網站可正常訪問
✅ 批量優化可執行
✅ 滾動測試可執行
✅ P1 日誌消息出現
✅ P2 日誌消息出現
✅ lookbackDays 值一致
✅ Console 無紅色錯誤

驗證結果: 8/8 通過
```

---

## 💾 保存驗證結果

驗證完成後，結果自動保存到：
```
WEBSITE_VERIFICATION_RESULTS.json
```

您可以隨時查看詳細結果。

---

## ⚠️ 如果遇到問題

### 問題 1: "找不到 puppeteer"

```bash
npm install puppeteer --save-dev
```

### 問題 2: 瀏覽器窗口不可見

編輯 `website-automated-verification.js` 第 20 行：
```javascript
headless: false, // 改為 false 以顯示瀏覽器
```

### 問題 3: 超時

增加超時時間，編輯第 22 行：
```javascript
timeout: 120000, // 改為 120 秒
```

---

## 🎯 下一步

### 若驗證通過 ✅

```bash
# 查看完整報告
cat WEBSITE_VERIFICATION_RESULTS.json

# 或用 JSON 查看器打開
code WEBSITE_VERIFICATION_RESULTS.json
```

### 若驗證失敗 ❌

```bash
# 查看詳細的錯誤信息
cat WEBSITE_VERIFICATION_RESULTS.json | jq '.details.errors'

# 查看控制台日誌
cat WEBSITE_VERIFICATION_RESULTS.json | jq '.details.consoleLogs'
```

---

## 📋 檢查項清單

驗證腳本會自動檢查以下 8 項：

- [ ] 瀏覽器緩存已清除
- [ ] 網站可正常訪問
- [ ] 批量優化可執行
- [ ] 滾動測試可執行
- [ ] P1 日誌消息出現
- [ ] P2 日誌消息出現
- [ ] lookbackDays 值一致
- [ ] Console 無紅色錯誤

---

## 🎬 完整命令序列

複製粘貼即可執行：

```bash
# 安裝依賴並執行驗證
npm install puppeteer dotenv && node website-automated-verification.js && echo "✅ 驗證完成！" && cat WEBSITE_VERIFICATION_RESULTS.json | jq '.checks'
```

---

## 📞 需要幫助？

查看詳細指南：
```
RUN_AUTOMATED_WEBSITE_VERIFICATION.md
```

---

**準備好了嗎？開始驗證吧！** 🚀

```bash
npm install puppeteer dotenv && node website-automated-verification.js
```

