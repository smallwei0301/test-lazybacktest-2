# 🔍 滾動測試 vs 批量優化 - 參數優化差異快速總結

## 問題
滾動測試和批量優化產生不同的最佳參數，應該使用相同 worker 和前置作業。

## ✅ 發現的差異

### 1️⃣ 參數清除差異 (最關鍵)

**滾動測試** (`rolling-test.js:3142-3178`):
```javascript
function clearWindowDerivedFields(target) {
    // ⚠️ 無條件刪除這些字段
    ['dataStartDate', 'effectiveStartDate', 'lookbackDays'].forEach((key) => {
        if (key in target) delete target[key];
    });
}
```
- **結果**: 每次優化前都清除 lookback 字段
- **影響**: Worker 每次都重新計算

**批量優化** (`batch-optimization.js:1654-1661`):
```javascript
optimizeWorker.postMessage({
    type: "runOptimization",
    params: params,  // ⚠️ 不清除字段
    // ...
});
```
- **結果**: 不清除 lookback 字段
- **影響**: 可能重複使用或直接傳送

---

### 2️⃣ 時間範圍差異

| 項目 | 滾動測試 | 批量優化 |
|------|---------|---------|
| **startDate** | 訓練期開始 (e.g., 2024-01-01) | 全局開始 (e.g., 2020-01-01) |
| **endDate** | 訓練期結束 (e.g., 2024-06-30) | 全局結束 (e.g., 2024-12-31) |
| **時間窗** | ~6 個月 | ~5 年 |
| **Lookback** | 基於訓練期計算 | 基於全局計算 |

**結果**: 使用不同大小的數據窗口進行優化 → **最優參數必然不同**

---

### 3️⃣ 優化流程差異

#### 滾動測試流程
```
1. 準備參數 baseWindowParams
2. normalizeWindowBaseParams() → 設置訓練期時間範圍
3. clearWindowDerivedFields() → ❌ 刪除 lookback 字段
4. 優化時 worker 內重新計算 lookback
5. 基於訓練期數據優化參數
```

#### 批量優化流程
```
1. 準備參數 params
2. ✅ 不清除 lookback 字段
3. 優化時可能保留或重新計算
4. 基於全局時間範圍數據優化參數
5. 結果不同 ❌
```

---

## 🎯 根本原因

```
滾動測試: 清除字段 → 訓練期窗 → 訓練期 lookback → 訓練期最優參數
                      ⬇️
批量優化: 不清除字段 → 全局窗 → 全局 lookback → 全局最優參數
                      ⬇️
                    結果不同 ❌❌❌
```

---

## 💊 修正方案

### 方案 A: 統一清除邏輯 (推薦)

**位置**: `rolling-test.js` 的 `normalizeWindowBaseParams()`

**當前**:
```javascript
function normalizeWindowBaseParams(target, windowInfo) {
    // ...
    clearWindowDerivedFields(target);  // ❌ 清除
}
```

**修改為**:
```javascript
function normalizeWindowBaseParams(target, windowInfo) {
    // ...
    // 不清除，改為主動計算和驗證
    // 使用 enrichParamsWithLookback 統一計算
    const enriched = enrichParamsWithLookback(target);
    Object.assign(target, enriched);
}
```

或在優化前統一應用:
```javascript
const workingParams = deepClone(baseWindowParams);
normalizeWindowBaseParams(workingParams, windowInfo);
// ✅ 應用 enrichParamsWithLookback 確保一致性
const enrichedParams = enrichParamsWithLookback(workingParams);
```

---

## 🔬 驗證步驟

1. **添加日誌驗證**
   - 在 `clearWindowDerivedFields` 前後記錄參數
   - 在優化前後比較滾動測試 vs 批量優化
   
2. **時間範圍驗證**
   - 檢查優化時使用的 `startDate`/`endDate`
   - 比較計算出的 `lookbackDays`

3. **結果對比**
   - 使用相同參數運行兩個功能
   - 驗證優化結果是否一致

---

## 📊 影響評估

| 項目 | 嚴重性 | 影響 |
|------|--------|------|
| 參數清除邏輯不同 | 🔴 高 | 導致 lookback 計算完全不同 |
| 時間範圍不同 | 🔴 高 | 優化基於不同大小的數據集 |
| Worker 接收參數不同 | 🔴 高 | 最優參數必然不同 |

---

## 📁 詳細報告位置

完整分析報告: `ROLLING_VS_BATCH_OPTIMIZATION_ANALYSIS.md`

---

**調查日期**: 2025-11-17  
**狀態**: ✅ 完成  
**建議**: 立即修正 `clearWindowDerivedFields()` 邏輯
