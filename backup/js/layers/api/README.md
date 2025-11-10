# API 層 (API Layer)

負責統一管理外部資料來源的 API 呼叫、快取機制和錯誤處理。

## 職責

- 統一 TWSE、TPEX、美股等資料來源的 API 呼叫
- 實作快取機制減少重複請求
- 統一錯誤處理和重試邏輯
- 資料格式標準化和轉換

## 規劃檔案

- `proxy-client.js` - 統一 API 客戶端，處理所有外部呼叫
- `cache-manager.js` - 快取管理器，處理本地快取邏輯
- `data-transformer.js` - 資料轉換器，標準化不同來源的資料格式
- `error-handler.js` - 錯誤處理工具，統一錯誤回應格式

## 設計原則

1. **無狀態**: 不維護內部狀態，所有狀態由外部傳入
2. **可測試**: 所有網路呼叫都可以被 mock
3. **錯誤透明**: 提供清晰的錯誤資訊和恢復建議
4. **效能優化**: 智慧快取避免重複呼叫

## 範例用法

```javascript
import { ApiClient } from './api/proxy-client.js';

const client = new ApiClient();
const stockData = await client.getStockData('2330', 'taiwan', {
  startDate: '2023-01-01',
  endDate: '2023-12-31'
});
```