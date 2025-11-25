export const STRATEGY_WIKI = {
  "RSI": {
    title: "什麼是 RSI 相對強弱指標？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">RSI 指標定義</h3>
          <p class="leading-relaxed">
            相對強弱指標 (Relative Strength Index, RSI) 是由 J. Welles Wilder 於 1978 年提出的一種動量震盪指標，主要用於評估股票價格變動的速度和變化，以判斷市場是否處於超買 (Overbought) 或超賣 (Oversold) 狀態。RSI 的值介於 0 到 100 之間，通常以 14 天為計算週期。
          </p>
        </section>
        
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">RSI 的黃金交叉與死亡交叉</h3>
          <p class="leading-relaxed">
            在 Lazybacktest 的回測系統中，我們採用更具實戰意義的策略。傳統上，RSI 超過 70 被視為超買（賣出訊號），低於 30 被視為超賣（買進訊號）。然而，在強勢趨勢中，RSI 可能會長時間停留在超買區。因此，我們也測試了 RSI 突破 50 中軸線的趨勢跟隨策略，這往往能捕捉到更大的波段行情。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">RSI 在台股的適用性</h3>
          <p class="leading-relaxed">
            根據歷史數據，RSI 在台股的大型權值股（如台積電、聯發科）上表現較為穩定，因為這些股票的流動性高，較不易被人為操縱。然而，對於中小型股，RSI 容易出現鈍化現象。這也是為什麼我們建議投資人參考 Lazybacktest 的「冠軍策略」，透過參數優化來克服指標鈍化的問題。
          </p>
        </section>
      </div>
    `
  },
  "MACD": { 
    title: "什麼是 MACD 平滑異同移動平均線？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">MACD 指標定義</h3>
          <p class="leading-relaxed">
            MACD (Moving Average Convergence Divergence) 是一種趨勢追蹤動量指標，顯示兩條移動平均線之間的關係。它由 Gerald Appel 在 1970 年代後期開發。MACD 由 MACD 線（快線）、信號線（慢線）和柱狀圖（Histogram）組成，是技術分析中最受歡迎的工具之一。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">MACD 的交易訊號</h3>
          <p class="leading-relaxed">
            最常見的 MACD 訊號是「黃金交叉」（快線向上突破慢線，視為買進）和「死亡交叉」（快線向下跌破慢線，視為賣出）。此外，柱狀圖由負轉正也常被視為多頭力道增強的訊號。Lazybacktest 的回測會驗證這些訊號在特定個股上的有效性。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">MACD 的優缺點</h3>
          <p class="leading-relaxed">
            MACD 的最大優點是能同時捕捉趨勢和動能，且相對滯後性較小。然而，在盤整市場中，MACD 容易發出錯誤的交叉訊號，導致頻繁停損。這就是為什麼我們需要透過「策略競技場」來比較 MACD 與其他策略在當前市場環境下的表現差異。
          </p>
        </section>
      </div>
    `
  },
  "KD": {
    title: "什麼是 KD 隨機指標？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">KD 指標定義</h3>
          <p class="leading-relaxed">
            隨機指標 (Stochastic Oscillator)，俗稱 KD 指標，由 George Lane 在 1950 年代推廣。它透過比較特定期間內的收盤價與價格範圍，來預測價格的反轉點。KD 值包含 K 值（快線）和 D 值（慢線），範圍都在 0 到 100 之間。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">KD 的高檔鈍化</h3>
          <p class="leading-relaxed">
            KD 指標最著名的特性是「高檔鈍化」與「低檔鈍化」。在強勢多頭行情中，K 值與 D 值可能會長時間維持在 80 以上，這時不應視為賣出訊號，反而可能是強勢持有的訊號。Lazybacktest 的冠軍策略往往能精準識別這種鈍化帶來的獲利機會。
          </p>
        </section>
      </div>
    `
  },
  "Bollinger": {
    title: "什麼是布林通道 (Bollinger Bands)？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">布林通道定義</h3>
          <p class="leading-relaxed">
            布林通道由 John Bollinger 發明，由三條軌道組成：中軌（通常是 20 日移動平均線）、上軌（中軌加 2 個標準差）和下軌（中軌減 2 個標準差）。這個指標結合了趨勢與波動率的概念，通道寬度會隨著價格波動而縮放。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">布林通道的擠壓與突破</h3>
          <p class="leading-relaxed">
            當布林通道收縮（Squeeze）時，代表市場波動率降低，往往預示著即將出現劇烈的價格變動。當價格強勢突破上軌時，可能是新趨勢的開始。我們的回測系統會特別關注這種波動率突破策略在個股上的表現。
          </p>
        </section>
      </div>
    `
  },
  "MA_Crossover": {
    title: "什麼是均線穿越策略？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">均線穿越定義</h3>
          <p class="leading-relaxed">
            均線穿越是最基礎但也最有效的趨勢跟隨策略之一。最經典的組合是「黃金交叉」，即短天期均線（如 5 日或 20 日）向上穿越長天期均線（如 60 日），象徵短線動能強於長線趨勢，為買進訊號。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">均線策略的滯後性</h3>
          <p class="leading-relaxed">
            均線是落後指標，這意味著它確認趨勢時，價格通常已經走了一段距離。雖然這能確保我們站在趨勢的一方，但也可能錯失最佳進場點。透過 Lazybacktest 的大數據運算，我們可以找到每檔股票最適配的均線週期組合，將滯後性的影響降到最低。
          </p>
        </section>
      </div>
    `
  }
};
