# OFI 指標拆解與規格對照（LB-OFI-DOCS-20250924A）

> 適用模組：`LB-OFI-METRICS-20250923A`

本文件將批量優化流程中每一個 OFI 構面、子分數與實作細節完整展開，並與原始規格比對差異與影響，方便前後端工程師與產品夥伴追蹤。

---

## 0. 前置設定

- 回測結果會先轉為**日報酬序列**，若資料量達到 `desiredSegments`（預設 10 段）才進入 OFI 分析。
- 依序切成 `S` 個連續區塊，採「**平均分配 + 前段補一筆**」策略確保總樣本被用盡。【F:js/overfit-score.js†L248-L270】
- 聚合子預設使用中位數（`median`），亦可透過設定改為平均數（`mean`）。【F:js/overfit-score.js†L276-L288】

---

## 1. Flow 層級（全體策略共用）

### 1.1 PBO（Probability of Backtest Overfitting）

1. 為每個 CSCV 切分組合計算 IS / OOS 聚合值。
2. 取 IS 冠軍並比較其 OOS 表現的分位數 `q`，之後套用 `\lambda = \log\frac{q}{1-q}`。
3. `PBO = Pr(\lambda < 0)`，最終轉成 `R^{PBO} = 1 - PBO`。

**差異 & 影響**
- 實作額外對 `q` 做邊界夾住（clamp），避免排名落在 0 或 1 時出現無限大的 `\lambda`。【F:js/overfit-score.js†L313-L345】
- 若 OOS 聚合值不足則跳過該切分，降低極端樣本污染結果。
- 與原規格邏輯一致，僅增加數值穩定性。

### 1.2 SPA 與 MCS

- **SPA**：蒐集 `spaPValue` 等欄位，統計小於 `\alpha`（預設 0.1）的策略占比作為 `R^{SPA}`。【F:js/overfit-score.js†L421-L435】
- **MCS**：根據 `mcsSurvivor/mcsInclusion/mcsRank` 等旗標，計算存活策略比率作為 `R^{MCS}`。【F:js/overfit-score.js†L437-L463】

**差異 & 影響**
- 若伺服端尚未回填對應欄位，分數會為 `null`，後續加權時自動重新正規化有效權重，避免因缺資料導致總分崩潰。【F:js/overfit-score.js†L404-L419】

### 1.3 Flow 綜合分數

- `R^{Flow} = 0.6 R^{PBO} + 0.2 R^{SPA} + 0.2 R^{MCS}`，缺值會重新正規化權重。【F:js/overfit-score.js†L404-L419】【F:js/overfit-score.js†L986-L1019】

---

## 2. 策略層級（逐策略）

### 2.1 OOS 穩健性（CSCV 分布）

- 收集每個策略在所有切分的 OOS 聚合值，計算中位數 `\tilde m_k` 與 IQR。【F:js/overfit-score.js†L465-L504】
- 中位數、IQR 分別使用 P10/P90 量化後夾住到 [0,1]，得到 `mid_norm` 與 `iqr_norm`。【F:js/overfit-score.js†L505-L517】
- `R^{OOS}_k = 0.6 · mid_norm + 0.4 · (1 - iqr_norm)`。【F:js/overfit-score.js†L518-L523】

**差異 & 影響**
- 當策略 IQR 無法估計（樣本不足）時，實作會將 `iqr_norm` 視為 1，等同給予最低穩健度，提醒使用者樣本不足。【F:js/overfit-score.js†L510-L521】
- 此做法較原規格保守，避免極少數 OOS 样本被誤判為穩定。

### 2.2 Walk-forward（滾動視窗）

- 依設定的訓練、測試窗進行滑動切分，測試段累積報酬正值視為勝場，並計算平均測試報酬。【F:js/overfit-score.js†L525-L579】
- `R^{WF}_k = 0.6 · WR + 0.4 · ret_norm`，其中 `ret_norm` 仍採 P10/P90 正規化。【F:js/overfit-score.js†L507-L520】【F:js/overfit-score.js†L557-L568】

**差異 & 影響**
- 累積報酬以測試視窗內「日報酬總和」近似原規格的 `\bar r_k`。對短視窗來說等效於平均報酬；對長視窗則更貼近實際資金曲線的相對變化。

### 2.3 IslandScore（參數敏感度）

- 以策略參數為軸重建熱圖，設定門檻 `\tau = P75(G)`，使用 8 連通元尋找高原島嶼。【F:js/overfit-score.js†L644-L811】
- 每座島計算：
  - 面積 `A_j`、
  - 島內 IQR `D_j`、
  - 邊緣懲罰 `E_j = \frac{\mu_{core} - \mu_{edge}}{|\mu_{core}| + \varepsilon}`。【F:js/overfit-score.js†L812-L860】
- 先以 P25/P95 做穩健正規化後求出 `S_j = A^{norm}_j · (1 - D^{norm}_j) · (1 - E^{pen}_j)`，最後再除以所有島的 `max S_j`，得到 `R^{Island}_k`。【F:js/overfit-score.js†L598-L618】【F:js/overfit-score.js†L618-L642】

**差異 & 影響**
- 新增 `max S_j` 步驟，確保最佳島嶼分數被拉到 1，與原規格完全一致並維持相對排序。
- `meta` 會回傳面積、分布、原始分數等資訊，供 UI/診斷使用。【F:js/overfit-score.js†L618-L642】

### 2.4 DSR／PSR（顯著性）

- 先取 `rawResult.sharpeRatio` 與樣本數估計 PSR、以 logistic (`η=0.5`) 近似 DSR。【F:js/overfit-score.js†L580-L617】
- 若伺服端傳回 `psr` / `dsr` 機率，實作會與近似值一併取最大值作為 `R^{DSR/PSR}_k`。【F:js/overfit-score.js†L604-L617】

**差異 & 影響**
- 目前前端使用 Sharpe 估計作為暫時替代，待伺服端 block bootstrap 結果回填後會自動採用後端值，避免雙方不一致。
- 若 Sharpe 或樣本不足會回傳 `null`，提醒需要更多資料。

### 2.5 策略層綜合

- `R^{Strategy}_k = 0.25 R^{DSR/PSR}_k + 0.25 R^{OOS}_k + 0.25 R^{WF}_k + 0.25 R^{Island}_k`，缺值同樣會重新分配有效權重。【F:js/overfit-score.js†L986-L1019】

---

## 3. 最終 OFI（0–100）

- `OFI_k = 100 · (0.30 · R^{Flow} + 0.70 · R^{Strategy}_k)`。
- 同步輸出評語：「👍 穩健／✅ 良好／😐 一般／⚠️ 高風險／資料不足」。【F:js/overfit-score.js†L986-L1032】【F:js/overfit-score.js†L1033-L1051】

---

## 4. UI 與輸出欄位

- `computeOFIForResults` 會回傳 `flow` 物件（含 `PBO/q/λ` 分布）與每個策略的 `components`，UI 以 tooltip 呈現所有子分數。【F:js/batch-optimization.js†L1991-L2011】
- IslandScore `meta` 包含原始/正規化數值，可直接渲染至診斷視窗。【F:js/overfit-score.js†L618-L642】

---

## 5. 規格差異總表

| 模組 | 規格差異 | 影響評估 |
| --- | --- | --- |
| PBO | clamp `q` 避免 0/1，忽略缺失切分 | 僅提升穩定性，不改變整體定義。【F:js/overfit-score.js†L313-L345】 |
| OOS | IQR 缺值視為最差，防止樣本過少被誤判 | 對資料不足的策略更保守，提醒需補樣本。【F:js/overfit-score.js†L505-L517】 |
| Walk-forward | 測試報酬以日報酬加總近似 `\bar r_k` | 與平均報酬差異極小，且更貼近資金曲線表現。【F:js/overfit-score.js†L541-L579】 |
| Island | 明確除以 `max S_j`、回傳原始分數 | 與規格完全對齊，並提供診斷所需中繼值。【F:js/overfit-score.js†L598-L642】 |
| DSR/PSR | 前端先用 Sharpe 估計，後端值覆蓋 | 可在伺服端完成 bootstrap 後自動同步結果。【F:js/overfit-score.js†L580-L617】 |
| 加權 | 權重會依有效子分數重新正規化 | 避免任何一項缺資料時整體評分消失。【F:js/overfit-score.js†L986-L1019】 |

---

如需在 UI 顯示更多細節，可直接讀取 `result.ofiComponents` 與 `result.meta.island`；若需進一步驗證流程，可利用 `flow.lambda` / `flow.qValues` 重繪 CSCV 分布。還想追蹤哪個指標的調整對使用者決策影響最大呢？
