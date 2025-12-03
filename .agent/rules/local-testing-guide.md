---
trigger: always_on
---

# 本地環境測試指南

> **版本**: LB-LOCAL-TEST-GUIDE-20251203A  
> **目的**: 防止在本地測試中遺漏真實環境問題  
> **適用**: 所有涉及 Web Worker、IndexedDB、或複雜代碼結構的測試

---

## 核心原則

### ✅ DO：正確的測試方式

1. **使用真實的檔案和環境**
   - 測試 worker 功能時，使用**真實的 worker.js**，不要複製代碼
   - 通過 Worker API 與真實文件通信
   - 在本地開發服務器中運行（如 `npm run dev`）

2. **檢查整個文件結構**
   - 搜尋是否有**重複的函數定義**（會導致覆蓋）
   - 使用工具如 `grep` 或 IDE 搜尋功能
   - 驗證所有相關函數的數量和位置

3. **添加測試消息處理器**
   - 在真實的 worker.js 中添加測試專用的消息處理器
   - 測試完成後可以保留（用於未來調試）
   - 示例：
     ```javascript
     else if (type === "testIDB") {
       // 測試邏輯
       const testCases = e.data.testCases || [...];
       // 執行測試並回傳結果
       self.postMessage({ type: "testResult", data: results });
     }
     ```

4. **驗證完整的執行路徑**  
   - 確認 Console 日誌從頭到尾都出現
   - 檢查所有預期的調試輸出
   - 驗證副作用（如 IndexedDB 寫入）是否發生

---

### ❌ DON'T：錯誤的測試方式

1. **不要複製代碼到獨立頁面**
   ```javascript
   // ❌ 錯誤：手動複製函數到測試頁面
   async function idbSetPermanentInvalid(stockNo, date) {
     // 複製的代碼...
   }
   ```
   - **問題**：會遺漏重複定義、全局變量衝突等問題
   - **影響**：測試通過但實際環境失敗

2. **不要只測試單一函數**
   - **問題**：無法發現函數被覆蓋、依賴缺失等問題
   - **影響**：孤立測試無法反映真實運行狀況

3. **不要假設代碼唯一性**
   - **問題**：JavaScript 允許重複定義，後者會覆蓋前者
   - **影響**：調試日誌不出現、函數行為異常

---

## 本次案例：IDB 寫入失敗調試

### 問題現象
- 日誌顯示 `[Worker Fallback Debug] 準備寫入永久無效: 2025-07-30`
- 但 `idbSetPermanentInvalid` 內部的所有調試日誌都**沒有出現**
- IndexedDB 中沒有寫入任何記錄

### 錯誤的測試方法
1. **創建了 `test-actual-worker-code.html`**
2. **手動複製**了 `idbSetPermanentInvalid` 函數
3. **測試通過**，以為代碼正確
4. **遺漏了問題**：worker.js 中有**兩個**同名函數定義

### 發現真相
在 Netlify 部署的 worker.js 中找到：
```javascript
// 第 775 行：第一個定義（正確的，帶調試日誌）
async function idbSetPermanentInvalid(stockNo, date) {
  console.log(`[Worker IDB Debug] idbSetPermanentInvalid called...`);
  // ...
}

// 第 904 行：第二個定義（錯誤的，覆蓋了第一個）
async function idbSetPermanentInvalid(stockNo, dates) {
  if (!Array.isArray(dates) || dates.length === 0) return; // 立即返回！
  // ...
}
```

**JavaScript 行為**：後定義的函數**覆蓋**前定義的函數。

### 正確的測試方法

1. **搜尋重複定義**
   ```bash
   grep "function idbSetPermanentInvalid" worker.js
   ```
   或使用 IDE 的「查找所有引用」功能

2. **在 worker.js 中添加測試處理器**
   ```javascript
   else if (type === "testIDB") {
     console.log('[Worker Test] 收到 testIDB 請求');
     const testCases = e.data.testCases || [
       { stockNo: '2317', date: '2025-07-30' }
     ];
     
     for (const { stockNo, date } of testCases) {
       await idbSetPermanentInvalid(stockNo, date);
     }
     
     self.postMessage({ type: "testIDBResult", data: { ... } });
   }
   ```

3. **創建測試頁面使用真實 worker**
   ```html
   <script>
     const worker = new Worker('app/js/worker.js'); // 真實文件
     
     worker.onmessage = (e) => {
       if (e.data.type === 'testIDBResult') {
         console.log('測試完成', e.data);
       }
     };
     
     worker.postMessage({
       type: 'testIDB',
       testCases: [...]
     });
   </script>
   ```

4. **驗證完整日誌**
   - ✅ 所有 `[Worker IDB Debug]` 日誌都出現
   - ✅ IndexedDB 成功寫入記錄

---

## 檢查清單

在聲稱「本地測試通過」之前，必須確認：

- [ ] **使用真實文件** - 不是複製的代碼
- [ ] **檢查重複定義** - 搜尋整個文件
- [ ] **驗證完整日誌** - 從頭到尾都出現
- [ ] **檢查副作用** - IndexedDB、快取、狀態變更等
- [ ] **測試相同路徑** - 模擬實際執行流程

---

## 測試模板

### Worker 功能測試模板

**步驟 1**：在 worker.js 添加測試處理器
```javascript
else if (type === "test[功能名稱]") {
  console.log('[Worker Test] 收到測試請求');
  // 執行要測試的功能
  const result = await 目標函數(...);
  self.postMessage({ 
    type: "test[功能名稱]Result", 
    data: result 
  });
}
```

**步驟 2**：創建測試頁面
```html
<!-- test-[功能名稱].html -->
<script>
  const worker = new Worker('app/js/worker.js');
  
  worker.onmessage = (e) => {
    if (e.data.type === 'test[功能名稱]Result') {
      console.log('✅ 測試結果:', e.data);
      // 驗證結果
    }
  };
  
  worker.postMessage({ type: 'test[功能名稱]', ... });
</script>
```

**步驟 3**：啟動開發服務器
```bash
npm run dev
```

**步驟 4**：訪問測試頁面
```
http://localhost:3000/test-[功能名稱].html
```

**步驟 5**：驗證
- [ ] Console 有完整日誌
- [ ] 功能正確執行
- [ ] 副作用已發生

---

## 常見陷阱

| 陷阱 | 表現 | 原因 | 解決方式 |
|------|------|------|---------|
| **函數重複定義** | 調試日誌不出現 | JavaScript 允許覆蓋 | 搜尋整個文件 |
| **params 未定義** | `Cannot read properties of undefined` | Worker 參數從 `e.data` 解構 | 使用 `e.data.xxx` |
| **測試通過但部署失敗** | 本地成功 Netlify 失敗 | 複製代碼與實際不同 | 使用真實文件測試 |
| **IndexedDB 靜默失敗** | 無錯誤但無寫入 | Promise 未正確處理 | 添加 `onsuccess/onerror` 日誌 |

---

## 關鍵教訓

> **教訓 1**: 「實際代碼路徑測試」≠ 「複製代碼到獨立環境」
> 
> **教訓 2**: 即使代碼「看起來正確」，也要檢查整個文件結構
> 
> **教訓 3**: 本地測試必須**完全模擬**真實執行環境
> 
> **教訓 4**: 調試日誌是驗證執行路徑的最佳工具

---

## 參考案例

- **案例編號**: LB-IDB-DUPLICATE-FUNCTION-20251203
- **問題**: `idbSetPermanentInvalid` 重複定義導致靜默失敗
- **解決**: 刪除第 904 行的重複定義，保留第 775 行的正確版本
- **預防**: 使用真實 worker 環境測試，搜尋重複定義

---

**最後提醒**：當測試「通過」但實際環境「失敗」時，首先懷疑測試方法，而非代碼本身。
