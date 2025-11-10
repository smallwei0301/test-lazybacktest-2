# UI 層 (User Interface Layer)

負責所有使用者介面相關的邏輯，包括 DOM 操作、事件處理、狀態管理和視覺化。

## 職責

- 狀態管理 (取代分散的全域變數)
- DOM 操作和事件監聽
- 圖表渲染和更新
- 表單處理和驗證
- 通知和提示訊息

## 規劃檔案

- `state-manager.js` - 中央狀態管理器
- `chart-renderer.js` - 圖表渲染引擎
- `form-handler.js` - 表單處理工具
- `dom-utils.js` - DOM 操作工具
- `notifications.js` - 通知系統

## 狀態管理設計

```javascript
class AppState {
  constructor() {
    this.data = {
      stocks: {},      // 股票資料
      cache: {},       // 快取資料  
      settings: {},    // 使用者設定
      results: {},     // 回測結果
      ui: {}          // UI 狀態
    };
  }
  
  setState(path, value) { /* ... */ }
  getState(path) { /* ... */ }
  subscribe(path, callback) { /* ... */ }
}
```

## 設計原則

1. **單向資料流**: 資料只能從父元件流向子元件
2. **事件驅動**: 使用事件來通知狀態變化
3. **元件化**: 將 UI 拆分成可重用的元件
4. **回應式**: 狀態變化自動更新相關 UI

## 範例用法

```javascript
import { AppState } from './ui/state-manager.js';

const appState = new AppState();
appState.setState('stock.TSMC.price', 500);
appState.subscribe('stock.TSMC.price', (newPrice) => {
  updatePriceDisplay(newPrice);
});
```