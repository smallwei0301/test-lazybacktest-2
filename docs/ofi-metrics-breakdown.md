# OFI 指標拆解與規格對照（LB-OFI-DOCS-20251014A）

> 適用模組：`LB-OFI-ISLANDTIP-20251014A`

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
- 實作額外對 `q` 做邊界夾住（clamp），避免排名落在 0 或 1 時出現無限大的 `\lambda`。【F:js/overfit-score.js†L308-L352】
- 若 OOS 聚合值不足則跳過該切分，降低極端樣本污染結果。
- 與原規格邏輯一致，僅增加數值穩定性。

### 1.2 樣本長度充足度 `R^{Len}`

- 取得所有有效策略的日報酬筆數中位數，作為樣本長度 `T`。【F:js/overfit-score.js†L354-L402】
- 依 `T` 位置給分：`T < 250 → 0`、`250 ≤ T < 500 → 0.5`、`T ≥ 500 → 1`，對應 block bootstrap 是否可行。【F:js/overfit-score.js†L354-L402】
- 同步輸出建議的 block 長度 `T^{1/3}` 與文字標籤（不足／偏弱／充足），供 UI 提醒樣本是否達標。【F:js/overfit-score.js†L354-L402】

### 1.3 策略池廣度 `R^{Pool}`

- 以有效策略數 `K` 為基準：`K < 20 → 0`、`20 ≤ K < 100 → 0.7`、`K ≥ 100 → 1`，評估策略池是否足夠廣泛。【F:js/overfit-score.js†L404-L426】
- 標記策略池狀態（過小／合理／充足），讓前端可直接在 Flow 卡片顯示建議。【F:js/overfit-score.js†L404-L426】

### 1.4 SPA 與 MCS

- **SPA**：蒐集 `spaPValue` 等欄位，統計小於 `\alpha`（預設 0.1）的策略占比作為 `R^{SPA}`。【F:js/overfit-score.js†L428-L442】
- **MCS**：根據 `mcsSurvivor/mcsInclusion/mcsRank` 等旗標，計算存活策略比率作為 `R^{MCS}`。【F:js/overfit-score.js†L444-L470】

**差異 & 影響**
- 若伺服端尚未回填對應欄位，分數會為 `null`，後續加權時自動重新正規化有效權重，避免因缺資料導致總分崩潰。【F:js/overfit-score.js†L310-L350】【F:js/overfit-score.js†L404-L476】

### 1.5 FlowScore（總分與門檻）

- `R^{Flow} = 0.40 R^{PBO} + 0.20 R^{Len} + 0.15 R^{Pool} + 0.15 R^{SPA} + 0.10 R^{MCS}`。【F:js/overfit-score.js†L308-L352】【F:js/overfit-score.js†L428-L476】
- `FlowScore = 100 · R^{Flow}`，同時輸出文字判定：`≥70` 合格、`50–69` 邊界、`<50` 不合格。【F:js/overfit-score.js†L308-L352】【F:js/overfit-score.js†L308-L352】
- FlowScore 不合格時會標記 `allowStrategyRanking = false`，UI 直接鎖定策略排序並顯示改善建議（延長樣本、擴充策略池等）。【F:js/overfit-score.js†L308-L352】【F:js/overfit-score.js†L354-L402】【F:js/overfit-score.js†L404-L476】【F:js/batch-optimization.js†L1685-L1905】

---

## 2. 策略層級（逐策略）

### 2.1 OOS 穩健性（CSCV 分布）

- 收集每個策略在所有切分的 OOS 聚合值，計算中位數 `\tilde m_k` 與 IQR。【F:js/overfit-score.js†L668-L696】
- 中位數、IQR 分別使用 P10/P90 量化後夾住到 [0,1]，得到 `mid_norm` 與 `iqr_norm`。【F:js/overfit-score.js†L690-L695】
- `R^{OOS}_k = 0.6 · mid_norm + 0.4 · (1 - iqr_norm)`。【F:js/overfit-score.js†L694-L695】

**差異 & 影響**
- 當策略 IQR 無法估計（樣本不足）時，實作會將 `iqr_norm` 視為 1，等同給予最低穩健度，提醒使用者樣本不足。【F:js/overfit-score.js†L690-L692】
- 此做法較原規格保守，避免極少數 OOS 样本被誤判為穩定。

### 2.2 Walk-forward（滾動視窗）

- 依設定的訓練、測試窗進行滑動切分，測試段累積報酬正值視為勝場，並計算平均測試報酬。【F:js/overfit-score.js†L525-L579】
- `R^{WF}_k = 0.6 · WR + 0.4 · ret_norm`，其中 `ret_norm` 仍採 P10/P90 正規化。【F:js/overfit-score.js†L719-L726】

**差異 & 影響**
- 累積報酬以測試視窗內「日報酬總和」近似原規格的 `\bar r_k`。對短視窗來說等效於平均報酬；對長視窗則更貼近實際資金曲線的相對變化。

### 2.3 IslandScore（參數敏感度）

- 以策略參數為軸重建熱圖，設定門檻 `\tau = P75(G)`，使用 8 連通元尋找高原島嶼。【F:js/overfit-score.js†L644-L811】
- 每座島計算：
  - 面積 `A_j`、
  - 島內 IQR `D_j`、
  - 邊緣懲罰 `E_j = \frac{\mu_{core} - \mu_{edge}}{|\mu_{core}| + \varepsilon}`。【F:js/overfit-score.js†L812-L860】
- 先以 P25/P95 做穩健正規化後求出 `S_j = A^{norm}_j · (1 - D^{norm}_j) · (1 - E^{pen}_j)`，最後再除以所有島的 `max S_j`，得到 `R^{Island}_k`。【F:js/overfit-score.js†L864-L868】【F:js/overfit-score.js†L871-L894】

**差異 & 影響**
- 新增 `max S_j` 步驟，確保最佳島嶼分數被拉到 1，與原規格完全一致並維持相對排序。【F:js/overfit-score.js†L914-L958】
- 修正 `normaliseWithQuantiles` 在分位範圍塌縮時回傳 1 的問題，現在平坦邊緣會維持 0 懲罰，符合 Lopez de Prado 對平坦島嶼給出最高分的定義。【F:js/overfit-score.js†L1267-L1283】
- 若無法建構島嶼（參數軸不足或僅有尖峰）會主動回傳 `R^{Island}_k = 0` 與提示訊息，避免 UI 顯示空白。【F:js/overfit-score.js†L1202-L1224】
- 針對「僅有一個數值參數」或「進出場參數名稱重複」等情境，額外回傳 `duplicate_param_names` 等診斷，UI 會顯示「參數名稱重複會導致熱島為 0」提醒。【F:js/overfit-score.js†L815-L905】【F:js/overfit-score.js†L922-L1035】【F:js/batch-optimization.js†L2084-L2119】
- `meta` 會回傳面積、分布、原始分數等資訊，供 UI/診斷使用。【F:js/overfit-score.js†L880-L893】

### 2.4 DSR／PSR（顯著性）

- 先取 `rawResult.sharpeRatio` 與樣本數估計 PSR、以 logistic (`η=0.5`) 近似 DSR。【F:js/overfit-score.js†L768-L812】
- 若伺服端傳回 `psr` / `dsr` 機率，實作會與近似值一併取最大值作為 `R^{DSR/PSR}_k`。【F:js/overfit-score.js†L780-L793】

**差異 & 影響**
- 目前前端使用 Sharpe 估計作為暫時替代，待伺服端 block bootstrap 結果回填後會自動採用後端值，避免雙方不一致。
- 若 Sharpe 或樣本不足會回傳 `null`，提醒需要更多資料。

### 2.5 策略層綜合

- `R^{Strategy}_k = 0.25 R^{DSR/PSR}_k + 0.25 R^{OOS}_k + 0.25 R^{WF}_k + 0.25 R^{Island}_k`，缺值視為 0 分並保持原權重，與規格完全對齊。【F:js/overfit-score.js†L1131-L1162】【F:js/overfit-score.js†L1217-L1233】
- `components` 同步回傳 `RStrategy`（0–1）與百分比，以及 Flow/Strategy 對最終 OFI 的貢獻，便於 tooltip 與交叉驗證。【F:js/overfit-score.js†L1140-L1161】

---

## 3. 最終 OFI（0–100）

- `OFI_k = 100 · (0.30 · R^{Flow} + 0.70 · R^{Strategy}_k)`，若 Flow 或 Strategy 缺值則以 0 分處理但仍維持原權重；最終值與貢獻拆解存於 `components.finalOfi*` 與 `meta.finalOfi` 供驗證。【F:js/overfit-score.js†L1131-L1161】【F:js/overfit-score.js†L1235-L1262】
- 同步輸出評語：「👍 穩健／✅ 良好／😐 一般／⚠️ 高風險／資料不足」。【F:js/overfit-score.js†L1163-L1172】
- 批量優化表格直接顯示最終 `OFI_k`（0–100），並在 tooltip 與指標欄位同步列出 Flow 與 Strategy 子分數；Flow 橫幅依舊負責整體判定與改善建議。【F:js/batch-optimization.js†L1890-L1932】【F:js/batch-optimization.js†L2069-L2162】

### 3.1 與原規格 / 文獻的比較

- **OOS 穩健度**：維持規格的中位數 + IQR 組合；當 IQR 無法估計時以 0 分處理，與 Bailey et al. (2017) 對於樣本不足需降低信賴度的建議一致。【F:js/overfit-score.js†L735-L773】
- **Walk-forward**：採用測試窗日報酬總和近似平均報酬，對短視窗與原文完全等價，對長視窗則更貼近資金曲線；勝率定義與規格一致。【F:js/overfit-score.js†L775-L851】
- **IslandScore**：沿用 Lopez de Prado (2018) 的高原探勘，另在無島時回傳 0 分與提示訊息，提醒需要補齊參數網格或提升密度。【F:js/overfit-score.js†L902-L1107】
- **DSR/PSR**：若伺服端尚未回傳 bootstrap 結果，前端以 Sharpe 近似 Probability/Deflated Sharpe Ratio；此近似較保守，待後端覆蓋即可回到文獻計算。【F:js/overfit-score.js†L853-L900】

上述調整皆屬穩健性強化：僅在資料不足或伺服端尚未回填時提供保守估計，不會改變合格策略間的相對排序。

---

## 4. UI 與輸出欄位

- `computeOFIForResults` 會回傳 `flow` 物件（含 `PBO/q/λ` 分布）與每個策略的 `components`；結果表 tooltip 與指標欄位會同時列出 Flow 與 Strategy 子分數並保留 Flow 判定與 Island 提示，方便快速對照兩層評分。【F:js/batch-optimization.js†L1889-L2162】
- FlowScore 透過 `renderOfiFlowBanner` 呈現於結果卡片上，會顯示樣本長度／策略池狀態與改善建議，並在 FlowScore < 50 時鎖定排序按鈕與結果列。【F:js/batch-optimization.js†L1685-L1905】【F:js/batch-optimization.js†L2441-L2515】
- IslandScore `meta` 會提供島嶼原始分數、正規化值與缺島提示，tooltip 亦會顯示「Island 提示」協助定位參數網格不足。【F:js/overfit-score.js†L880-L1119】【F:js/batch-optimization.js†L2069-L2162】

---

## 5. 規格差異總表

| 模組 | 規格差異 | 影響評估 |
| --- | --- | --- |
| PBO | clamp `q` 避免 0/1，忽略缺失切分 | 僅提升穩定性，不改變整體定義。【F:js/overfit-score.js†L313-L345】 |
| OOS | IQR 缺值視為最差，防止樣本過少被誤判 | 對資料不足的策略更保守，提醒需補樣本。【F:js/overfit-score.js†L690-L695】 |
| Walk-forward | 測試報酬以日報酬加總近似 `\bar r_k` | 與平均報酬差異極小，且更貼近資金曲線表現。【F:js/overfit-score.js†L699-L727】 |
| Island | 明確除以 `max S_j`、回傳原始分數 | 與規格完全對齊，並提供診斷所需中繼值。【F:js/overfit-score.js†L864-L894】 |
| DSR/PSR | 前端先用 Sharpe 估計，後端值覆蓋 | 可在伺服端完成 bootstrap 後自動同步結果。【F:js/overfit-score.js†L768-L812】 |
| 加權 | Flow 缺值會重新正規化；Strategy 缺值視為 0 分但保留原權重 | 避免 Flow 資料缺失時整體崩潰，同時維持策略層與規格一致。【F:js/overfit-score.js†L308-L352】【F:js/overfit-score.js†L1131-L1162】【F:js/overfit-score.js†L1217-L1262】 |

---
## 6. 指標公式總表（LB-OFI-TABLE-20251013A）

下表彙整 OFI 所有構面、計算公式與權重，可搭配 [下載用 CSV](../assets/ofi-metrics-parameters.csv) 交叉檢查設定；批量優化頁面亦提供「查看 OFI 指標表」按鈕，會直接載入此資料並可一鍵下載。

| 層級 | 構面 / 指標 | 計算公式 | 正規化 / 門檻 | 權重 / 參數 | 備註 |
| --- | --- | --- | --- | --- | --- |
| 前置 | CSCV 分段 | 將每日報酬切成 `S` 段，`S=desiredSegments=10`，`|I_t|=|O_t|=S/2` | 每段至少 `minPointsPerSegment=5` 筆樣本，無法均分時前段補一筆 | 聚合子 `agg=median`（可改 `mean`） | 參考 `DEFAULT_CONFIG.desiredSegments` 與 `aggregator` 設定。【F:js/overfit-score.js†L9-L29】【F:js/overfit-score.js†L248-L288】 |
| Strategy | `\tilde m_k` | OOS 中位數 | P10/P90 分位夾住至 [0,1] | - | 核心穩健度指標。【F:js/overfit-score.js†L668-L696】 |
| Strategy | `\text{IQR}_k` | OOS IQR | P10/P90 分位夾住至 [0,1] | - | 缺值視為 1，代表最差穩健度。【F:js/overfit-score.js†L690-L695】 |
| Strategy | `R^{OOS}_k` | `0.6 · \text{mid\_norm}_k + 0.4 · (1 - \text{iqr\_norm}_k)` | `mid\_norm`、`iqr\_norm` 均限制在 [0,1] | `α = oosAlpha = 0.6` | 提醒樣本不足時偏保守。【F:js/overfit-score.js†L694-L695】 |
| Strategy | `\text{WR}_k` | `\text{WR}_k = \frac{1}{W}\sum 1_{r_{k,w}>0}` | 已在 [0,1] | - | Walk-forward 勝率。【F:js/overfit-score.js†L730-L756】 |
| Strategy | `\bar r_k` | `\bar r_k = \frac{1}{W}\sum r_{k,w}`（以日報酬總和近似） | P10/P90 正規化為 `ret_norm` | - | 反映 OOS 平均報酬。【F:js/overfit-score.js†L699-L727】 |
| Strategy | `R^{WF}_k` | `0.6 · \text{WR}_k + 0.4 · \text{ret\_norm}_k` | `ret_norm` 限制在 [0,1] | 權重比 `(0.6, 0.4)` | 加權勝率與報酬。【F:js/overfit-score.js†L724-L726】 |
| Strategy | `S_j` | `S_j = A^{norm}_j · (1 - D^{norm}_j) · (1 - E^{pen}_j)` | - | - | 以最大島嶼為 1 正規化。【F:js/overfit-score.js†L864-L894】 |
| Strategy | `R^{Island}_k` | `R^{Island}_k = S_{j(k)} / \max_j S_j` | 結果落在 [0,1] | - | `meta` 回傳 raw 與 normalised 值。【F:js/overfit-score.js†L864-L894】 |
| Strategy | `\text{PSR}_k` | `\Pr(\text{Sharpe} > \theta)` | `\theta = dsrSharpeThreshold = 0` | - | 伺服端可覆蓋前端估計。【F:js/overfit-score.js†L798-L804】 |
| Strategy | `\text{DSR}_k` | `\sigma(η · z)`，`z = \text{Sharpe}·\sqrt{n-1}` | 夾住 [0,1] | `η = dsrLogisticEta = 0.5` | 亦支援伺服端傳回機率。【F:js/overfit-score.js†L780-L793】 |
| Strategy | `R^{DSR/PSR}_k` | `\max(\text{PSR}_k, \text{DSR}_k)` | - | 權重 `γ_1 = 0.25` | 取較保守的顯著性估計。【F:js/overfit-score.js†L780-L795】【F:js/overfit-score.js†L1131-L1162】 |
| Strategy | `R^{Strategy}_k` | `0.25 R^{DSR/PSR}_k + 0.25 R^{OOS}_k + 0.25 R^{WF}_k + 0.25 R^{Island}_k` | 缺值視為 0 分 | `γ = (0.25, 0.25, 0.25, 0.25)` | 每策略獨立計算並符合規格。【F:js/overfit-score.js†L1131-L1162】【F:js/overfit-score.js†L1217-L1233】 |
| 綜合 | `OFI_k` | `100 · (0.30 R^{Flow} + 0.70 R^{Strategy}_k)` | 缺值視為 0 分但保留權重 | `w_F = 0.30`、`w_S = 0.70` | 輸出 0–100 分並附評語。【F:js/overfit-score.js†L1131-L1162】【F:js/overfit-score.js†L1235-L1262】 |
| 綜合 | Verdict 門檻 | 👍 ≥ 80、✅ 65–79、😐 50–64、⚠️ < 50 | - | - | 資料不足時顯示「資料不足」。【F:js/overfit-score.js†L1186-L1197】 |
| Strategy | `\tilde m_k` | OOS 中位數 | P10/P90 分位夾住至 [0,1] | - | 核心穩健度指標。【F:js/overfit-score.js†L465-L517】 |
| Strategy | `\text{IQR}_k` | OOS IQR | P10/P90 分位夾住至 [0,1] | - | 缺值視為 1，代表最差穩健度。【F:js/overfit-score.js†L505-L521】 |
| Strategy | `R^{OOS}_k` | `0.6 · \text{mid\_norm}_k + 0.4 · (1 - \text{iqr\_norm}_k)` | `mid\_norm`、`iqr\_norm` 均限制在 [0,1] | `α = oosAlpha = 0.6` | 提醒樣本不足時偏保守。【F:js/overfit-score.js†L505-L523】 |
| Strategy | `\text{WR}_k` | `\text{WR}_k = \frac{1}{W}\sum 1_{r_{k,w}>0}` | 已在 [0,1] | - | Walk-forward 勝率。【F:js/overfit-score.js†L525-L556】 |
| Strategy | `\bar r_k` | `\bar r_k = \frac{1}{W}\sum r_{k,w}`（以日報酬總和近似） | P10/P90 正規化為 `ret_norm` | - | 反映 OOS 平均報酬。【F:js/overfit-score.js†L541-L579】 |
| Strategy | `R^{WF}_k` | `0.6 · \text{WR}_k + 0.4 · \text{ret\_norm}_k` | `ret_norm` 限制在 [0,1] | 權重比 `(0.6, 0.4)` | 加權勝率與報酬。【F:js/overfit-score.js†L557-L568】 |
| Strategy | Island 門檻 | `\tau = P75(G)` | 高於門檻的格點進入島探索 | - | 採 8 連通尋找島嶼。【F:js/overfit-score.js†L644-L811】 |
| Strategy | `A^{norm}_j` | 面積以 P25/P95 正規化 | 夾住 [0,1] | - | 反映穩定高原面積。【F:js/overfit-score.js†L812-L860】 |
| Strategy | `D^{norm}_j` | IQR 以 P25/P95 正規化 | 夾住 [0,1] | - | 代表島內分散度。【F:js/overfit-score.js†L812-L860】 |
| Strategy | `E^{pen}_j` | 邊緣懲罰取負值後 P25/P95 正規化 | 夾住 [0,1] | - | 避免尖銳邊界。【F:js/overfit-score.js†L812-L860】 |
| Strategy | `S_j` | `S_j = A^{norm}_j · (1 - D^{norm}_j) · (1 - E^{pen}_j)` | - | - | 以最大島嶼為 1 正規化。【F:js/overfit-score.js†L598-L642】 |
| Strategy | `R^{Island}_k` | `R^{Island}_k = S_{j(k)} / \max_j S_j` | 結果落在 [0,1] | - | `meta` 回傳 raw 與 normalised 值。【F:js/overfit-score.js†L598-L642】 |
| Strategy | `\text{PSR}_k` | `\Pr(\text{Sharpe} > \theta)` | `\theta = dsrSharpeThreshold = 0` | - | 伺服端可覆蓋前端估計。【F:js/overfit-score.js†L580-L606】 |
| Strategy | `\text{DSR}_k` | `\sigma(η · z)`，`z = \text{Sharpe}·\sqrt{n-1}` | 夾住 [0,1] | `η = dsrLogisticEta = 0.5` | 亦支援伺服端傳回機率。【F:js/overfit-score.js†L604-L617】 |
| Strategy | `R^{DSR/PSR}_k` | `\max(\text{PSR}_k, \text{DSR}_k)` | - | 權重 `γ_1 = 0.25` | 取較保守的顯著性估計。【F:js/overfit-score.js†L604-L617】【F:js/overfit-score.js†L986-L1019】 |
| Strategy | `R^{Strategy}_k` | `0.25 R^{DSR/PSR}_k + 0.25 R^{OOS}_k + 0.25 R^{WF}_k + 0.25 R^{Island}_k` | 缺值時重算有效權重 | `γ = (0.25, 0.25, 0.25, 0.25)` | 每策略獨立計算。【F:js/overfit-score.js†L986-L1019】 |
| 綜合 | `OFI_k` | `100 · (0.30 R^{Flow} + 0.70 R^{Strategy}_k)` | - | `w_F = 0.30`、`w_S = 0.70` | 輸出 0–100 分並附評語。【F:js/overfit-score.js†L986-L1051】 |
| 綜合 | Verdict 門檻 | 👍 ≥ 80、✅ 65–79、😐 50–64、⚠️ < 50 | - | - | 資料不足時顯示「資料不足」。【F:js/overfit-score.js†L1033-L1051】 |

如需在 UI 顯示更多細節，可直接讀取 `result.ofiComponents` 與 `result.meta.island`；若需進一步驗證流程，可利用 `flow.lambda` / `flow.qValues` 重繪 CSCV 分布。還想追蹤哪個指標的調整對使用者決策影響最大呢？
