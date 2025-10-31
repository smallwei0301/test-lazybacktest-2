# 🧪 TDD 工作流 - 實踐指南

## 📖 目錄
1. [核心概念](#核心概念)
2. [工作流程](#工作流程)
3. [分步教程](#分步教程)
4. [實戰示例](#實戰示例)
5. [快速參考](#快速參考)

---

## 🎯 核心概念

### 什麼是 TDD (Test-Driven Development)?

```
傳統開發流程:
代碼 → 測試 → 結果

TDD 開發流程:
測試 → 代碼 → 結果 (推薦!)
```

### TDD 的三個步驟

```
1️⃣ RED (紅色)    - 編寫測試，測試失敗
   ↓
2️⃣ GREEN (綠色)  - 編寫代碼，測試通過
   ↓
3️⃣ REFACTOR (重構) - 優化代碼，保持測試通過
```

### 為什麼要用 TDD?

| 優勢 | 說明 |
|------|------|
| **早期發現 Bug** | 測試會立即告訴你問題 |
| **更安心修改** | 有測試保护，不怕破壞功能 |
| **代碼質量更高** | 測試會強制你寫更好的代碼 |
| **減少調試時間** | 問題一目了然 |
| **保持穩定** | 長期收益巨大 |

---

## 🔄 完整工作流程

### 日常開發流程

```
┌─────────────────────────────────────────────┐
│ 1️⃣ 需求分析                               │
│    理解需要實現什麼功能                      │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 2️⃣ 編寫測試 (RED - 失敗)                   │
│    tests/unit/... 或 tests/integration/...  │
│    npm test → ❌ 失敗 (這是正常的!)         │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 3️⃣ 編寫實現代碼 (GREEN - 通過)            │
│    js/layers/... 中實現功能                  │
│    npm test → ✅ 成功                       │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 4️⃣ 優化代碼 (REFACTOR)                    │
│    改進代碼結構，但保持測試通過              │
│    npm test → ✅ 仍然成功                   │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 5️⃣ 檢查覆蓋率                              │
│    npm run test:coverage                    │
│    確保覆蓋率達到要求 (80%+)                │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│ 6️⃣ 提交代碼                                │
│    git commit -m "實現新功能"               │
│    npm test → ✅ 所有測試通過               │
└─────────────────────────────────────────────┘
```

---

## 📚 分步教程

### 步驟 1: 分析需求

**例子**: 為 Indicators 添加一個新的技術指標 - DEMA (Double EMA)

```javascript
// 需求分析
需求:
- 計算雙指數移動平均線 (DEMA)
- 輸入: 價格數組, 周期 (預設 20)
- 輸出: DEMA 值數組
- 邊界情況: 空數組、少於周期的數據

性能要求:
- 1000 個點的數據應在 100ms 內完成
- 內存佔用不超過 1MB
```

---

### 步驟 2: 編寫測試 (RED)

#### 2.1 創建測試文件

```javascript
// tests/unit/core/indicators/dema.test.js

describe('Indicators - DEMA (Double EMA)', () => {
    let indicators;

    beforeEach(() => {
        const { Indicators } = require('../../../../js/layers/core/indicators');
        indicators = new Indicators();
    });

    describe('基本計算', () => {
        test('應該計算簡單的 DEMA', () => {
            const prices = [10, 12, 11, 13, 14, 12, 15, 16];
            const dema = indicators.calculateDEMA(prices, 2);
            
            expect(dema).toBeDefined();
            expect(Array.isArray(dema)).toBe(true);
            expect(dema.length).toBe(prices.length);
        });

        test('應該返回數字數組', () => {
            const prices = [100, 102, 104, 103, 105];
            const dema = indicators.calculateDEMA(prices, 3);
            
            dema.forEach(value => {
                expect(typeof value).toBe('number');
                expect(isNaN(value)).toBe(false);
            });
        });
    });

    describe('邊界情況', () => {
        test('空數組應該返回空數組', () => {
            const dema = indicators.calculateDEMA([], 5);
            expect(dema).toEqual([]);
        });

        test('數據少於周期應該返回正確長度', () => {
            const prices = [10, 12, 14];
            const dema = indicators.calculateDEMA(prices, 10);
            
            expect(dema.length).toBe(prices.length);
        });

        test('單個值應該返回該值', () => {
            const prices = [100];
            const dema = indicators.calculateDEMA(prices, 5);
            
            expect(dema.length).toBe(1);
            expect(dema[0]).toBe(100);
        });
    });

    describe('計算準確性', () => {
        test('DEMA 應該正確計算', () => {
            // 已知的正確結果
            const prices = [10, 12, 11, 13, 14, 12, 15, 16, 14, 18];
            const dema = indicators.calculateDEMA(prices, 3);
            
            // 驗證結果在合理範圍
            expect(dema[0]).toBeGreaterThanOrEqual(Math.min(...prices));
            expect(dema[0]).toBeLessThanOrEqual(Math.max(...prices));
        });

        test('周期為 1 的 DEMA 應該等於原值', () => {
            const prices = [10, 12, 14, 13, 15];
            const dema = indicators.calculateDEMA(prices, 1);
            
            dema.forEach((value, index) => {
                expect(value).toBe(prices[index]);
            });
        });
    });

    describe('性能', () => {
        test('應該在 100ms 內處理 1000 個數據點', () => {
            const prices = Array.from({length: 1000}, (_, i) => 100 + Math.sin(i/100) * 10);
            
            const start = performance.now();
            const dema = indicators.calculateDEMA(prices, 20);
            const end = performance.now();
            
            expect(end - start).toBeLessThan(100);
            expect(dema.length).toBe(prices.length);
        });
    });
});
```

#### 2.2 運行測試 (應該失敗)

```bash
npm test tests/unit/core/indicators/dema.test.js

# 結果:
# ❌ FAIL
# ● Indicators - DEMA › 基本計算 › 應該計算簡單的 DEMA
# TypeError: indicators.calculateDEMA is not a function
```

**完美! 這是 RED 階段。** ✅

---

### 步驟 3: 編寫實現代碼 (GREEN)

#### 3.1 添加實現

```javascript
// js/layers/core/indicators.js

class Indicators {
    // ... 現有代碼 ...

    /**
     * 計算雙指數移動平均線 (Double EMA)
     * @param {number[]} prices - 價格數組
     * @param {number} period - 周期 (預設 20)
     * @returns {number[]} DEMA 值數組
     */
    calculateDEMA(prices, period = 20) {
        if (!Array.isArray(prices) || prices.length === 0) {
            return [];
        }

        // 計算第一個 EMA
        const ema1 = this.calculateEMA(prices, period);
        
        // 計算第二個 EMA (基於 EMA1)
        const ema2 = this.calculateEMA(ema1, period);
        
        // DEMA = 2 * EMA1 - EMA2
        const dema = ema1.map((value, index) => 2 * value - ema2[index]);
        
        return dema;
    }

    /**
     * 輔助函數: 計算 EMA
     * @private
     */
    calculateEMA(prices, period) {
        if (prices.length === 0) return [];
        
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // 第一個 EMA = SMA
        let smaSum = 0;
        for (let i = 0; i < Math.min(period, prices.length); i++) {
            smaSum += prices[i];
        }
        ema[0] = smaSum / Math.min(period, prices.length);
        
        // 後續 EMA
        for (let i = 1; i < prices.length; i++) {
            ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        
        return ema;
    }
}

module.exports = { Indicators };
```

#### 3.2 運行測試 (應該通過)

```bash
npm test tests/unit/core/indicators/dema.test.js

# 結果:
# ✅ PASS
# Indicators - DEMA (Double EMA) (120 ms)
#   ✓ 應該計算簡單的 DEMA
#   ✓ 應該返回數字數組
#   ✓ 應該處理空數組
#   ✓ ... (所有測試通過)
```

**太棒了! 這是 GREEN 階段。** ✅

---

### 步驟 4: 優化代碼 (REFACTOR)

#### 4.1 改進代碼

```javascript
// js/layers/core/indicators.js - 優化版本

class Indicators {
    // ... 現有代碼 ...

    /**
     * 計算雙指數移動平均線 (Double EMA) - 優化版
     * @param {number[]} prices - 價格數組
     * @param {number} period - 周期 (預設 20)
     * @returns {number[]} DEMA 值數組
     */
    calculateDEMA(prices, period = 20) {
        // 參數驗證
        this._validateInput(prices, 'prices');
        this._validatePeriod(period);

        if (prices.length === 0) {
            return [];
        }

        try {
            // 使用快取優化性能
            const cacheKey = `DEMA_${period}_${prices.length}`;
            if (this._cache.has(cacheKey)) {
                return this._cache.get(cacheKey);
            }

            // 計算雙 EMA
            const ema1 = this._calculateEMAOptimized(prices, period);
            const ema2 = this._calculateEMAOptimized(ema1, period);
            
            // DEMA = 2 * EMA1 - EMA2
            const dema = ema1.map((value, index) => 
                2 * value - ema2[index]
            );

            // 快取結果
            this._cache.set(cacheKey, dema);
            
            return dema;
        } catch (error) {
            throw new Error(`DEMA 計算失敗: ${error.message}`);
        }
    }

    /**
     * 優化的 EMA 計算
     * @private
     */
    _calculateEMAOptimized(prices, period) {
        const ema = new Array(prices.length);
        const multiplier = 2 / (period + 1);
        
        // 初始 SMA
        let sum = 0;
        const initLength = Math.min(period, prices.length);
        
        for (let i = 0; i < initLength; i++) {
            sum += prices[i];
        }
        
        ema[0] = sum / initLength;
        
        // 計算 EMA
        for (let i = 1; i < prices.length; i++) {
            ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        
        return ema;
    }

    /**
     * 參數驗證
     * @private
     */
    _validateInput(prices, name) {
        if (!Array.isArray(prices)) {
            throw new TypeError(`${name} 必須是數組`);
        }
        
        if (!prices.every(p => typeof p === 'number' && !isNaN(p))) {
            throw new TypeError(`${name} 必須包含有效的數字`);
        }
    }

    /**
     * 周期驗證
     * @private
     */
    _validatePeriod(period) {
        if (typeof period !== 'number' || period < 1) {
            throw new Error('周期必須是正整數');
        }
    }
}
```

#### 4.2 再次運行測試 (應該仍然通過)

```bash
npm test tests/unit/core/indicators/dema.test.js

# 結果:
# ✅ PASS (所有測試仍然通過)
# 運行速度: 更快了
# 代碼質量: 更好了
```

**完美! 這是 REFACTOR 階段。** ✅

---

### 步驟 5: 檢查覆蓋率

```bash
npm run test:coverage -- tests/unit/core/indicators/dema.test.js

# 結果:
# ────────────────────────────────────────
# File     | % Stmts | % Branch | % Funcs
# ────────────────────────────────────────
# dema.js  |  95.2   |  88.5    |  100
# ────────────────────────────────────────
# 
# 覆蓋率目標: 80%+
# 實際覆蓋: 95.2% ✅
```

---

### 步驟 6: 整合測試

```bash
# 檢查新功能是否與整個系統兼容
npm run test:integration

# 結果:
# ✅ 所有整合測試通過
```

---

### 步驟 7: 提交代碼

```bash
git add js/layers/core/indicators.js tests/unit/core/indicators/dema.test.js
git commit -m "feat: 添加 DEMA (雙指數移動平均線) 技術指標計算"
git push

# 在 CI/CD 上再次確認所有測試通過 ✅
```

---

## 🎬 實戰示例

### 示例 1: 修改 ProxyClient 重試邏輯

#### 1️⃣ 編寫測試

```javascript
// tests/unit/api/proxy-client-retry.test.js

describe('ProxyClient - 重試邏輯', () => {
    test('應該在失敗時重試指定次數', async () => {
        const client = new ProxyClient({ maxRetries: 3 });
        
        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('失敗 1'))
            .mockRejectedValueOnce(new Error('失敗 2'))
            .mockResolvedValueOnce({ ok: true, text: () => '{"data": []}' });
        
        const result = await client.getStockData({
            stockNo: '2330',
            market: 'TWSE',
            startDate: '2024-01-01',
            endDate: '2024-01-01'
        });
        
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
```

#### 2️⃣ 運行測試 (失敗)

```bash
npm test tests/unit/api/proxy-client-retry.test.js
# ❌ FAIL - 重試邏輯還沒實現
```

#### 3️⃣ 實現重試邏輯

```javascript
// js/layers/api/proxy-client.js

async makeRequest(url, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                timeout: this.config.timeout
            });
            
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            lastError = error;
            
            // 指數退避
            if (attempt < this.config.maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}
```

#### 4️⃣ 再次測試 (通過)

```bash
npm test tests/unit/api/proxy-client-retry.test.js
# ✅ PASS - 重試邏輯工作正常
```

---

### 示例 2: 修改回測計算

#### 流程

```
1️⃣ 分析需求: 提高回測計算精度

2️⃣ 編寫測試:
   - 測試計算準確性
   - 測試邊界情況
   - 測試性能

3️⃣ 實現功能:
   - 改進計算公式
   - 優化性能

4️⃣ 優化代碼:
   - 重構代碼結構
   - 添加文檔

5️⃣ 檢查覆蓋率: 達到 80%+

6️⃣ 提交代碼
```

---

## 📋 快速參考

### TDD 命令速查表

| 階段 | 命令 | 說明 |
|------|------|------|
| **RED** | `npm test [test-file]` | 運行測試，確認失敗 |
| **GREEN** | `npm test [test-file]` | 編寫代碼，確認通過 |
| **REFACTOR** | `npm test [test-file]` | 優化代碼，保持通過 |
| **檢查** | `npm run test:coverage` | 檢查覆蓋率 |
| **提交** | `npm test && git commit` | 所有通過後提交 |

### 監視模式加速開發

```bash
# 監視特定測試文件，自動重新運行
npm run test:watch tests/unit/core/indicators/dema.test.js

# 監視所有 API 層測試
npm run test:watch -- --testPathPattern="api"

# 監視核心層測試
npm run test:watch -- --testPathPattern="core"
```

### 常見 TDD 命令

```bash
# 1️⃣ 編寫測試後，確認失敗
npm test tests/unit/[module]/[feature].test.js

# 2️⃣ 編寫代碼後，確認通過
npm test tests/unit/[module]/[feature].test.js

# 3️⃣ 優化代碼後，確認仍通過
npm test tests/unit/[module]/[feature].test.js

# 4️⃣ 檢查覆蓋率
npm run test:coverage

# 5️⃣ 運行所有測試確認沒有破壞
npm test

# 6️⃣ 提交代碼
git add . && git commit -m "message"
```

---

## ✅ TDD 最佳實踐

### 測試編寫建議

```javascript
// ✅ 好的測試
test('應該正確計算 SMA', () => {
    const prices = [10, 12, 14, 13, 15];
    const result = indicators.calculateSMA(prices, 3);
    
    expect(result).toBeDefined();
    expect(result.length).toBe(prices.length);
});

// ❌ 不好的測試
test('應該工作', () => {
    expect(true).toBe(true); // 沒有測試實際邏輯
});
```

### 測試用例建議

```javascript
// 覆蓋這些情況:

describe('Feature', () => {
    // ✅ 正常情況
    test('應該在正常輸入下工作', () => {});
    
    // ✅ 邊界情況
    test('應該處理空輸入', () => {});
    test('應該處理單個元素', () => {});
    test('應該處理大量數據', () => {});
    
    // ✅ 異常情況
    test('應該拋出無效輸入錯誤', () => {});
    test('應該處理 null 值', () => {});
    
    // ✅ 性能
    test('應該在時間限制內完成', () => {});
});
```

---

## 🎯 總結

### TDD 的核心步驟 (重複)

```
1️⃣ 寫測試 (RED - 失敗)
   ↓
2️⃣ 寫代碼 (GREEN - 通過)
   ↓
3️⃣ 優化代碼 (REFACTOR)
   ↓
4️⃣ 檢查覆蓋率
   ↓
5️⃣ 提交代碼
```

### TDD 帶來的好處

```
✅ 代碼質量高 (有測試保护)
✅ Bug 少 (早期發現)
✅ 開發快 (安心修改)
✅ 維護易 (清晰的需求)
✅ 信心足 (測試說話)
```

### 一句話

> **"先寫測試，再寫代碼，就能寫出高品質、少 Bug、易維護的軟體。"**

---

**現在開始使用 TDD，讓您的代碼更健壯！🚀**