---
description: 程式碼修改後的重複宣告與衝突檢查
---

# 程式碼修改後必做：重複宣告與函數衝突檢查

> **版本**: LB-DUPLICATE-CHECK-20251212A  
> **觸發時機**: 每次修改 JavaScript 檔案後，必須執行此檢查

---

## 檢查流程

### 步驟 1：搜尋被修改函數的重複定義

使用以下命令檢查函數是否有重複定義：

```powershell
# Windows PowerShell - 檢查特定函數
findstr /N "function 函數名稱" "目標檔案.js"

# 或搜尋 async function
findstr /N "async function" "目標檔案.js" | findstr "函數名稱"
```

### 步驟 2：確認結果只有一個定義

```
✅ 正確：只返回一行結果
   例如: "6147:async function tryFetchRangeFromBlob({"

❌ 錯誤：返回多行結果
   例如: "775:async function idbSetPermanentInvalid(...)"
         "904:async function idbSetPermanentInvalid(...)"
   → 存在重複定義，需刪除多餘的版本
```

### 步驟 3：檢查使用的變數作用域

確認修改中使用的變數在使用點之前已正確宣告：

```powershell
findstr /N "let 變數名" "目標檔案.js"
findstr /N "const 變數名" "目標檔案.js"
```

驗證：
- [ ] 變數宣告的行號 < 變數使用的行號
- [ ] 變數在同一個函數作用域內

---

## 必須檢查的情況

| 修改類型 | 必查項目 | 檢查命令 |
|----------|---------|---------|
| 新增函數 | 確認函數名在檔案中唯一 | `findstr /N "function 新函數名" 檔案.js` |
| 修改函數簽名 | 確認沒有舊版本殘留 | `findstr /N "function 函數名" 檔案.js` |
| 使用已有變數 | 確認變數在作用域內已宣告 | `findstr /N "let 變數名" 檔案.js` |
| 修改 worker.js | 額外確認沒有同名函數在不同區塊 | 全檔搜尋 |

---

## 範例：檢查 worker.js 中的 tryFetchRangeFromBlob

// turbo
```powershell
findstr /N "async function" "v0 design code\public\app\js\worker.js" | findstr "tryFetchRangeFromBlob"
```

預期結果：
```
6147:async function tryFetchRangeFromBlob({
```

如果出現多行結果，表示有重複定義需要處理。

---

## 範例：檢查 lastDate 變數作用域

// turbo
```powershell
findstr /N "let lastDate\|lastDate =" "v0 design code\public\app\js\worker.js"
```

預期結果：
- 初始宣告行號 < 使用行號
- 所有使用點都在同一函數作用域內

---

## 檢查清單

在宣稱「修改完成」之前，必須確認：

- [ ] **函數無重複定義** - 每個函數名只出現一次
- [ ] **變數作用域正確** - 使用前已宣告
- [ ] **無命名衝突** - 新增的識別符不與現有的衝突
- [ ] **執行路徑正確** - 修改點在正確的執行流程中

---

## 常見問題與解決

| 問題 | 症狀 | 原因 | 解決 |
|------|------|------|------|
| 函數重複定義 | 調試日誌不出現 | JavaScript 後者覆蓋前者 | 刪除多餘定義 |
| 變數未定義 | `ReferenceError` | 變數未在作用域內宣告 | 檢查宣告位置 |
| 舊版本殘留 | 行為與預期不符 | 複製貼上後未清理 | 全檔搜尋確認 |

---

## 參考案例

- **案例編號**: LB-IDB-DUPLICATE-FUNCTION-20251203
- **問題**: `idbSetPermanentInvalid` 重複定義導致靜默失敗
- **根因**: 第 775 行和第 904 行各有一個定義，後者覆蓋前者
- **解決**: 刪除第 904 行的重複定義
- **預防**: 每次修改後執行本工作流程的檢查步驟
