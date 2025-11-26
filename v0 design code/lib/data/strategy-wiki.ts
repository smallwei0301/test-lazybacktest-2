export const STRATEGY_WIKI = {
  "RSI": {
    title: "什麼是 RSI 相對強弱指標？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">定義與原理</h3>
          <p class="leading-relaxed">
            相對強弱指標 (Relative Strength Index, RSI) 是由技術分析大師 J. Welles Wilder 於 1978 年在《技術交易系統新概念》一書中提出的動量震盪指標。RSI 的核心概念是透過比較一段時間內（通常為 14 天）股價上漲平均幅度與下跌平均幅度，來評估多空力量的強弱。
            <br><br>
            RSI 的數值介於 0 到 100 之間。當 RSI 上升時，代表多頭力道轉強；當 RSI 下降時，代表空頭力道佔優。這個指標就像是股價的「溫度計」，幫助投資人判斷市場是否過熱（超買）或過冷（超賣），進而尋找潛在的反轉點。
          </p>
        </section>
        
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">Lazybacktest 實戰策略</h3>
          <p class="leading-relaxed">
            在 <strong>懶人回測 Lazybacktest</strong> 的系統中，我們不只使用教科書上的標準用法，更結合了大數據回測來優化 RSI 策略：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>極端值逆勢操作：</strong>傳統上 RSI > 70 為超買，RSI < 30 為超賣。我們的回測發現，在某些股性活潑的標的上，將參數調整為 80/20 能更有效地過濾假訊號，捕捉真正的反轉機會。</li>
              <li><strong>中軸趨勢跟隨：</strong>除了逆勢操作，我們也測試「RSI 突破 50 中軸」的順勢策略。當 RSI 由下往上突破 50 時，視為多頭趨勢確立的進場點，這在波段行情中往往能吃到最肥美的一段。</li>
              <li><strong>背離訊號偵測：</strong>系統會自動偵測「股價創新低但 RSI 未創新低」的底背離形態，這通常是主力在低檔吃貨的跡象，勝率往往高於單純的數值判斷。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">優點與盲點分析</h3>
          <p class="leading-relaxed">
            <strong>優點：</strong>
            <br>
            RSI 對於價格變動的反應靈敏，能夠在趨勢反轉前提供早期預警。特別是在盤整盤（箱型整理）中，RSI 的高低檔訊號非常準確，是區間操作的神器。
            <br><br>
            <strong>盲點：</strong>
            <br>
            RSI 最大的致命傷是「鈍化」。在強勢的多頭趨勢中，RSI 可能會長時間停留在 80 以上的超買區，如果這時候貿然放空，會被「軋空」到懷疑人生。同理，在崩盤走勢中，RSI 也會長期在低檔鈍化。因此，RSI 必須搭配趨勢指標（如 MACD 或均線）一起使用，才能避開鈍化陷阱。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">適合的市場環境</h3>
          <p class="leading-relaxed">
            RSI 最適合用於<strong>「盤整震盪」</strong>或<strong>「緩漲緩跌」</strong>的市場環境。在這種情況下，股價會在一個區間內來回波動，RSI 的超買超賣訊號能精準捕捉高出低進的節奏。
            <br><br>
            然而，在<strong>「極端噴出」</strong>或<strong>「崩盤殺盤」</strong>的單邊趨勢市中，RSI 的參考價值會大幅降低，此時應改用趨勢追蹤策略，避免逆勢接刀。
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
          <h3 class="text-xl font-bold text-foreground mb-3">定義與原理</h3>
          <p class="leading-relaxed">
            MACD (Moving Average Convergence Divergence) 是由 Gerald Appel 在 1970 年代後期發明的趨勢追蹤指標，被譽為「指標之王」。它結合了移動平均線的趨勢性與震盪指標的靈敏度。
            <br><br>
            MACD 主要由三部分組成：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>DIF (快線)：</strong>短期均線與長期均線的差離值，反應股價短期變化的速度。</li>
              <li><strong>DEA (慢線)：</strong>DIF 的移動平均線，用來平滑訊號，確認趨勢方向。</li>
              <li><strong>柱狀圖 (Histogram)：</strong>DIF 與 DEA 的差值，用來判斷多空力道的強弱變化。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">Lazybacktest 實戰策略</h3>
          <p class="leading-relaxed">
            在 <strong>懶人回測 Lazybacktest</strong> 中，MACD 是我們判斷波段趨勢的核心工具：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>零軸上黃金交叉：</strong>這是最強勢的買進訊號。當 DIF 與 DEA 都在零軸上方（多頭市場），且 DIF 向上突破 DEA 時，代表股價整理結束，即將展開新一波攻勢。</li>
              <li><strong>柱狀圖翻紅策略：</strong>我們發現，柱狀圖由負轉正（綠翻紅）往往比均線交叉更早反應轉折。這是一個積極型的進場點，適合想要買在起漲點的投資人。</li>
              <li><strong>鴨子張嘴形態：</strong>當 MACD 在高檔死叉後，股價未跌，DIF 迅速再次金叉 DEA 且開口放大，這通常是主升段噴出的前兆，我們的回測系統會特別標註這種高勝率形態。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">優點與盲點分析</h3>
          <p class="leading-relaxed">
            <strong>優點：</strong>
            <br>
            MACD 最大的優勢在於「穩健」。它過濾掉了短期均線頻繁交叉的雜訊，能讓投資人抱得住波段單，吃到完整的魚身。對於趨勢明顯的大型股，MACD 是獲利最豐厚的策略之一。
            <br><br>
            <strong>盲點：</strong>
            <br>
            MACD 是「落後指標」，因為它是基於均線計算而來。在盤整行情中，MACD 經常會出現「雙巴」現象——金叉買進就跌，死叉賣出就漲。此外，對於急漲急跌的妖股，MACD 的反應會太慢，導致買在高點、賣在低點。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">適合的市場環境</h3>
          <p class="leading-relaxed">
            MACD 專為<strong>「趨勢明顯」</strong>的市場設計，無論是長多還是長空，MACD 都能發揮極佳的效果。它特別適合操作股性穩健、成交量大的權值股。
            <br><br>
            相反地，在<strong>「無趨勢盤整」</strong>或<strong>「成交量低迷」</strong>的殭屍股上，MACD 的訊號參考價值極低，建議改用 KD 或 RSI 等震盪指標。
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
          <h3 class="text-xl font-bold text-foreground mb-3">定義與原理</h3>
          <p class="leading-relaxed">
            隨機指標 (Stochastic Oscillator)，俗稱 KD 指標，由 George Lane 在 1950 年代提出。KD 的設計邏輯基於一個統計學現象：在多頭趨勢中，收盤價傾向於接近當日價格區間的高點；在空頭趨勢中，收盤價傾向於接近低點。
            <br><br>
            KD 指標由兩條線組成：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>K 值 (快線)：</strong>反應當前股價在近期波動範圍內的相對位置，對價格變化較敏感。</li>
              <li><strong>D 值 (慢線)：</strong>K 值的移動平均，反應較長期的趨勢，走勢較平穩。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">Lazybacktest 實戰策略</h3>
          <p class="leading-relaxed">
            <strong>懶人回測 Lazybacktest</strong> 針對 KD 指標的特性，開發了多種實戰應用：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>高檔鈍化追價：</strong>教科書說 KD > 80 要賣，但我們的回測數據顯示，強勢股的 KD 常在 80 以上鈍化（K 值一直維持在高檔）。這時候反而是最強的持有訊號，直到 K 值跌破 80 才考慮出場。</li>
              <li><strong>低檔黃金交叉：</strong>當 K 值與 D 值都在 20 以下（超賣區），且 K 值由下往上穿過 D 值，這是勝率極高的短線反彈買點，適合搶反彈操作。</li>
              <li><strong>週期共振：</strong>我們會同時觀察日 KD 與週 KD。當週 KD 黃金交叉且日 KD 也黃金交叉時，代表長短線趨勢同步向上，這種「共振」訊號的爆發力最強。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">優點與盲點分析</h3>
          <p class="leading-relaxed">
            <strong>優點：</strong>
            <br>
            KD 指標非常靈敏，能快速反應價格的短線波動，是短線交易者（當沖、隔日沖）的最愛。它能幫助你在盤整區間內，精準地買在相對低點，賣在相對高點。
            <br><br>
            <strong>盲點：</strong>
            <br>
            KD 的靈敏也是雙面刃，容易產生大量的「雜訊」。在強烈趨勢中，KD 會過早發出反向訊號（例如漲勢中一直出現超買賣訊），導致投資人太早下車，錯失大波段行情。這就是所謂的「指標鈍化」問題。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">適合的市場環境</h3>
          <p class="leading-relaxed">
            KD 指標是<strong>「震盪盤整盤」</strong>的王者。當市場沒有明確方向，在箱型區間整理時，KD 的高出低進策略績效驚人。
            <br><br>
            但在<strong>「單邊趨勢盤」</strong>（一路大漲或大跌）中，KD 的參考性較差，建議搭配 MACD 或布林通道來輔助判斷，避免逆勢操作。
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
          <h3 class="text-xl font-bold text-foreground mb-3">定義與原理</h3>
          <p class="leading-relaxed">
            布林通道 (Bollinger Bands) 是由 John Bollinger 在 1980 年代發明的技術分析工具。它結合了移動平均線和統計學的標準差概念。
            <br><br>
            布林通道由三條軌道組成：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>中軌：</strong>通常是 20 日移動平均線 (20MA)，代表股價的平均成本。</li>
              <li><strong>上軌：</strong>中軌 + 2 倍標準差，視為股價的壓力線。</li>
              <li><strong>下軌：</strong>中軌 - 2 倍標準差，視為股價的支撐線。</li>
            </ul>
            根據常態分佈理論，股價有 95% 的機率會落在上下軌之間的通道內。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">Lazybacktest 實戰策略</h3>
          <p class="leading-relaxed">
            <strong>懶人回測 Lazybacktest</strong> 利用布林通道的「壓縮」與「擴張」特性，捕捉變盤契機：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>擠壓突破 (Squeeze)：</strong>當布林通道的開口極度收縮時，代表市場波動率降到極致，即將變盤。此時若股價帶量突破上軌，是極佳的波段買點。我們的回測系統專門捕捉這種「暴風雨前的寧靜」。</li>
              <li><strong>回測中軌：</strong>在多頭趨勢中，股價沿著上軌走。當股價回檔修正時，中軌（20MA）通常是強力的支撐。若股價觸碰中軌不破且收紅 K，是勝率很高的加碼點。</li>
              <li><strong>樂隊花車 (Band Walking)：</strong>當股價緊貼著上軌不斷創新高，稱為「沿著布林帶漫步」。這代表趨勢極強，此時不應預設高點，直到股價跌回通道內部才考慮停利。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">優點與盲點分析</h3>
          <p class="leading-relaxed">
            <strong>優點：</strong>
            <br>
            布林通道最大的優點是能同時顯示「趨勢」與「波動率」。它不僅告訴你股價的方向，還告訴你目前市場的活躍程度。通道的寬窄變化，提供了直觀的變盤訊號，這是其他指標做不到的。
            <br><br>
            <strong>盲點：</strong>
            <br>
            布林通道是落後指標，上下軌會隨著股價變動而改變。有時候股價看似突破上軌，結果收盤卻留長上影線跌回通道，形成假突破。此外，在盤整盤中，股價觸碰上下軌的策略有效，但在強勢趨勢中，逆勢操作（碰上軌放空）會導致嚴重虧損。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">適合的市場環境</h3>
          <p class="leading-relaxed">
            布林通道適用於<strong>所有市場環境</strong>，關鍵在於用對策略：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>盤整期：</strong>使用「區間操作」策略，碰下軌買、碰上軌賣。</li>
              <li><strong>趨勢期：</strong>使用「突破跟隨」策略，突破上軌追價，沿著軌道操作。</li>
            </ul>
            能夠分辨目前是盤整還是趨勢，是使用布林通道獲利的關鍵。
          </p>
        </section>
      </div>
    `
  },
  "MovingAverage": {
    title: "什麼是均線穿越策略？",
    content: `
      <div class="space-y-6 text-muted-foreground">
        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">定義與原理</h3>
          <p class="leading-relaxed">
            移動平均線 (Moving Average, MA) 是最基礎、最普及的技術指標，它代表過去一段時間內市場投資人的平均持有成本。
            <br><br>
            均線穿越策略利用長短天期均線的交叉來判斷趨勢轉折：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>黃金交叉：</strong>短天期均線（如 5日、20日）由下往上穿越長天期均線（如 60日）。代表短線動能強勁，扭轉了長線趨勢，視為買進訊號。</li>
              <li><strong>死亡交叉：</strong>短天期均線由上往下穿越長天期均線。代表短線轉弱，長線趨勢遭到破壞，視為賣出訊號。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">Lazybacktest 實戰策略</h3>
          <p class="leading-relaxed">
            <strong>懶人回測 Lazybacktest</strong> 透過大數據運算，找出每檔股票的「最佳均線組合」：
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>參數優化：</strong>傳統的 5MA 穿 20MA 未必適合所有股票。我們的系統會測試 10MA 穿 50MA、20MA 穿 60MA 等各種組合，找出歷史回測績效最好的參數。</li>
              <li><strong>均線糾結突破：</strong>當多條均線（短、中、長）糾結在一起，代表市場成本趨於一致，籌碼沉澱完畢。此時若出現一根長紅 K 棒帶量突破所有均線，是爆發力最強的「起漲點」。</li>
              <li><strong>葛蘭碧八大法則：</strong>我們將葛蘭碧法則量化，例如「均線多頭排列回測不破」的買點，這比單純的交叉訊號更具實戰價值。</li>
            </ul>
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">優點與盲點分析</h3>
          <p class="leading-relaxed">
            <strong>優點：</strong>
            <br>
            均線策略簡單、直觀且客觀，完全排除了人為情緒的干擾。在明顯的趨勢行情中，均線策略能讓你抱完整個波段，不會因為短線震盪而被洗出場。它是「大賺小賠」的典型代表。
            <br><br>
            <strong>盲點：</strong>
            <br>
            均線最大的缺點是「滯後性」。因為要等均線交叉確認，往往股價已經漲了一段，導致買點不夠漂亮。此外，在「盤整盤」中，均線會頻繁交叉，導致不斷停損（被雙巴）。這是所有趨勢策略的共同死穴。
          </p>
        </section>

        <section>
          <h3 class="text-xl font-bold text-foreground mb-3">適合的市場環境</h3>
          <p class="leading-relaxed">
            均線穿越策略最適合<strong>「趨勢明確」</strong>的市場。當大盤或個股走出長多或長空行情時，均線策略的績效會非常驚人。
            <br><br>
            但在<strong>「箱型整理」</strong>或<strong>「無方向震盪」</strong>的時期，均線策略會失效。因此，使用此策略時，最好避開成交量低迷、股性牛皮的冷門股。
          </p>
        </section>
      </div>
    `
  }
};

