// Version: LB-FOOTER-NAV-20250819A
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "LazyBacktest 使用教學｜6 個步驟完成回測",
  description: "透過圖解學會 LazyBacktest 的所有功能：從一鍵回測、進階參數設定、風險管理到 AI 預測與紀錄比對。",
}

const steps = [
  {
    id: 1,
    title: "啟動一鍵回測，熟悉操作節奏",
    description:
      "在回測頁面頂部可以看到「一鍵回測」按鈕與可編輯的股票欄位。先讓系統替您跑一遍預設範例（台積電），確認畫面會自動切換到結果區塊。之後只要點擊股票名稱即可改成自己的目標標的。",
    image: "/guide/step-1.svg",
    tip: "如果不知道該從哪支股票開始，點選欄位旁的提示文字即可呼叫內建的台股代碼搜尋器。",
    links: [
      { href: "/backtest", label: "前往股票回測頁", emphasis: true },
      { href: "/faq", label: "查看快速入門常見問題" },
    ],
  },
  {
    id: 2,
    title: "調整基本設定：股票代號、期間與資金",
    description:
      "進入「基本設定」分頁後，依序輸入股票代碼、回測起訖日期以及初始資金。LazyBacktest 預設顯示最近三年的台股交易日，您也可以直接從下拉選單套用常用期間。",
    image: "/guide/step-2.svg",
    tip: "設定完成後按下「套用最近 N 年」能快速切換測試範圍，記得每次修改都要再次執行回測以更新結果。",
    links: [
      { href: "/faq", label: "常見日期與交易日計算方式" },
    ],
  },
  {
    id: 3,
    title: "完整設定交易成本與風險控管",
    description:
      "在基本設定卡片下方可以找到「交易成本」與「風險管理」區塊，分別對應手續費、交易稅、停損停利與最大持股金額。所有欄位都支援即時調整，數值會同步帶入後續策略計算。",
    image: "/guide/step-3.svg",
    tip: "若策略包含分批買進或資金控管，建議先在這裡設定好停損停利條件，避免回測結果與實際操作落差太大。",
    links: [
      { href: "/privacy", label: "了解我們如何保護設定資料" },
    ],
  },
  {
    id: 4,
    title: "切換到績效分析與交易明細",
    description:
      "回測完成後，使用上方的標籤切換至「績效分析」與「交易記錄」。前者會顯示年化報酬、勝率、最大回檔等指標，後者則逐筆列出買賣明細，方便輸出 CSV 或人工對帳。",
    image: "/guide/step-4.svg",
    tip: "建議先確認績效指標是否符合策略邏輯，再下載交易紀錄留存，避免只看最終報酬而忽略中間波動。",
    links: [
      { href: "/stock-records", label: "把交易結果同步到股票紀錄" },
    ],
  },
  {
    id: 5,
    title: "儲存策略組合並進行紀錄比較",
    description:
      "在右側「策略面板」可以將當前參數儲存為自訂方案，或載入過去的最佳組合。利用紀錄 A、紀錄 B 可以快速對照不同設定的績效差異，並將結果匯出供團隊討論。",
    image: "/guide/step-5.svg",
    tip: "儲存前記得為策略命名並加入備註，日後在股票紀錄頁面就能更快回顧每次調整的目的。",
    links: [
      { href: "/community", label: "把策略分享至社群討論" },
    ],
  },
  {
    id: 6,
    title: "啟用 AI 預測與批量優化功能",
    description:
      "想同時測試多組條件時，開啟「AI 預測」或「批量優化」區塊。系統會針對進出場規則、持股天數與風險參數進行自動調校，並以報酬率排序方便挑選。",
    image: "/guide/step-6.svg",
    tip: "批量優化需要較長運算時間，建議先鎖定兩到三個核心條件再啟動，並隨時留意上方進度條。",
    links: [
      { href: "/faq", label: "批量優化常見疑問" },
      { href: "/contact", label: "需要協助？寄信給我們" },
    ],
  },
]

const entryGlossary = [
  {
    label: "均線黃金交叉",
    description:
      "均線是把多個收盤價平均化的線，短期均線像最近幾日的溫度、長期均線則像幾週的天氣。當短期均線從下方向上跨越長期均線時稱為黃金交叉，它代表短期動能開始顯著提升並追上長期趨勢線，等於提醒你近期買盤力量較過去強，適合把它當成趨勢轉折的第一道訊號。",
  },
  {
    label: "價格突破均線",
    description:
      "這個指標不是單純看漲跌，而是衡量價格相對於某條均線的位置。均線會把一段時間的價格平滑成線，突破表示最新成交價已高於過去平均值，等於告訴你多頭蠢蠢欲動，價格站在自己平均線之上意味著市場已逐步消化先前的波動，適合把它當成多方重新掌握節奏的學習樣本。",
  },
  {
    label: "RSI 超賣",
    description:
      "RSI 是一條衡量最近幾日漲跌力道的百分比指標，數值落在 0 到 100 之間。當 RSI 下降到超賣區（通常 30 以下）表示下跌天數比上漲天數多很多，不代表價格一定會反彈，而是告訴你買方力量變小、賣方過熱，像熱水燒太久冷卻一樣，若指標緩慢轉向上升就表示壓力正在退，提示你可以開始觀察是否需要佈局。",
  },
  {
    label: "MACD 黃金交叉 (DI版)",
    description:
      "MACD 由快線、慢線與差離值組成，快線代表近期價格移動速度，慢線則是更長期的速度。快線往上穿過慢線是所謂黃金交叉，這個指標的重點在於比較短期與長期動能是否一致，類似把兩條不同時間的速度計放在一起，當短期速度轉強超過長期速度時就代表趨勢方向可能有變化。",
  },
  {
    label: "布林通道突破",
    description:
      "布林通道用的是價格的移動平均值加減標準差，讓你可以看到市場普通波動範圍。突破上下軌並不是單純漲跌，而是當價格離開這個區間時代表近期波動變大，特別是突破上軌就意味著短期價格高於過去平均加上偏移值，換句話說，市場的平均震幅變大，代表多方以高於常態的強度推高價格，可用來理解力量是否正擴散。",
  },
  {
    label: "KD 黃金交叉 (D<X)",
    description:
      "KD 指標是利用最高價、最低價與收盤價計算出的兩條線，K 線反應近期價格相對位置，D 線則是 K 線的移動平均。當 K 線往上穿過 D 線表示近期價格比過去更接近高點，這不只是價格上漲，而是告訴你漲勢已經超過近期平均，像是溫度計連續升高，讓你理解短期動能是否正在增溫。",
  },
  {
    label: "成交量暴增",
    description:
      "成交量是衡量交易活躍程度，暴增表示當天價格附近有大量買賣委託成交。這個指標本身不是看方向，而是提醒你現在市場參與度有別於平時，就像一場派對突然開場，進出的人數暴增，營造出強烈的聲勢。搭配價格位置看，可以知道是多空加碼還是交戰激烈，對新手來說是理解趨勢可靠度的關鍵。",
  },
  {
    label: "價格突破前高",
    description:
      "前高是過去一段時間的最高價，突破這個水準代表市場已經願意以更高的價格成交。這個指標提供的是價格和心理強度的比較，像是排行榜上創新高，代表買方願意為恐懼而不是壓力買單。它不是純粹看漲，而是告訴你市場已經跳脫先前成交區間，適合理解趨勢是否正在建立。",
  },
  {
    label: "威廉指標超賣",
    description:
      "威廉指標透過比較收盤價與近期高低價計算，數值在 0 到 100 之間，靠近 0 表示價格貼近區間下限。它本質是在量度價格相對位置而非未來漲跌，其用意是把眼光放在波動區間中，告訴你目前價格是否偏低，像用尺量高度就知道差距，有助新手建立對價格強弱的基礎認知。",
  },
  {
    label: "海龜突破 (僅進場)",
    description:
      "海龜突破策略會觀察過去特定天數的最高價，當價格跨越那段期間的高點就代表新的相對高點已經形成。指標的意義在於對比現在價格與過去一段時間的極值，幫你理解是否出現新的高點，並非僅看瞬間漲幅，而是提供一種依據過去區間的相對位置判斷趨勢延續的方法。",
  },
]

const exitGlossary = [
  {
    label: "均線死亡交叉",
    description:
      "均線死亡交叉是指短期均線下穿長期均線，這兩條線都是不同天數的價格平均。這個指標的焦點在於說明最近一段時間的價格已經低於更長期的平均值，等於告訴你短期動能比過去弱下來，像兩個速度計中慢的那一條變得更慢，對新手而言，它是理解短期與長期趨勢差距的視覺化訊號。",
  },
  {
    label: "價格跌破均線",
    description:
      "此指標比較當前價格與某條均線的相對位置，目的是了解價格是否已經下滑到低於過去平均。均線把一段時間的價格平滑，如果價格跌破這條線，就代表價格已經低於過去表現，提醒你市場的平均水平正在往下移動。對新手而言，它是學會將價格與趨勢平均比較的好起點。",
  },
  {
    label: "RSI 超買",
    description:
      "RSI 指標會把漲勢天數和跌勢天數做一個比值，數值靠近 100 表示多方主導。這個指標本身不是在預測下跌，而是讓你知道目前漲勢已經比前幾天強很多，等於在告訴你市場中的情緒偏向樂觀。新手能從這裡學會觀察漲跌動能的平衡，提醒自己不要只是因為價格高就盲目持有。",
  },
  {
    label: "MACD 死亡交叉 (DI版)",
    description:
      "當 MACD 快線由上向下穿過慢線，代表近期速度明顯小於長期平均。這個交叉提供的是動能強弱的比較，幫助你了解短期走勢是否已經失去推力。將它比喻成雙車速表，當小車速慢到比大車速慢，就表示推進力正在減弱，讓你學習如何分辨趨勢是否正在退場。",
  },
  {
    label: "布林通道反轉",
    description:
      "布林通道的中軌是移動平均，兩側是標準差乘上後形成範圍。當價格從上軌回到中軌或下軌時，指標在說這段時間的波動回歸正常，表示原本距離平均值太遠的行情正在收斂。它的核心不是漲跌，而是說明價格失去比過去更大的偏移幅度，幫助你理解超出常態的價格是否回歸。",
  },
  {
    label: "KD 死亡交叉 (D>Y)",
    description:
      "KD 指標中的 D 線是 K 線的移動平均，當 D 線比 K 線高而被 K 線往下穿時，就表示近期價格的短期位置低於過去平均。這個指標讓你理解價格在高低區間中的位置，換句話說是把最新價格放在過去區間的坐標上看是否偏高或偏低，適合新手學會相對位置的概念。",
  },
  {
    label: "成交量暴增 (下跌)",
    description:
      "這個指標的重點不是價格方向，而是成交量本身。當成交量暴增，表示一段時間內大量委託被成交，市場參與者變多。若這種暴量發生在下跌時，表示賣方力量用成交數據說話，提供的是多空活躍程度的資訊。新手可以把成交量當作市場熱度計，理解買賣雙方到底誰更積極。",
  },
  {
    label: "價格跌破前低",
    description:
      "前低是過去一段時間的最低價，這指標主要在對比現在價格和歷史低點的距離。當價格跌破這個值時，說明市場已經比先前更悲觀，但核心在於揭示跌勢比前低還要深，把它當成理解市場情緒極端度的參考。新手可從中學會如何把現在位置和過去低點一起看，建立風險判斷。",
  },
  {
    label: "威廉指標超買",
    description:
      "威廉指標衡量收盤價與過去高低價的相對位置，接近 100 表示收盤價靠近高點，數字越高代表價格偏向區間上緣。這個指標可以幫助你理解價格目前處於波動區間的哪一端，而不只是看目前漲幅。新手可以把它想成在游泳池邊測水位，數值提醒你已經游到多高，是否準備轉向。",
  },
  {
    label: "海龜停損 (N日低)",
    description:
      "海龜停損會把過去 N 天的最低價當成參考，目標是理解價格是否跌破這段期間的底部。指標本身說的是現在價格和過去低點的距離，越接近甚至跌破代表波動已經擴張到不同區間，提醒你應該重新評估持有部位。它提供的是一個明確的價格界線，而不是對漲跌的預測。",
  },
  {
    label: "移動停損 (%)",
    description:
      "移動停損是根據價格或百分比自動調整止損位置，核心在於把止損點跟隨價格上漲時同步上移。這個指標不看漲跌方向，而是告訴你能接受的最大回撤幅度隨價格變動而變，像是安全帶的拉力隨車速自動調整，提供一種動態風控觀念給剛入門的你。",
  },
  {
    label: "固定停損 (風險管理)",
    description:
      "固定停損是把某個價格或百分比當作最大虧損門檻，與其他指標不同，它不隨市場波動而變，只想告訴你如果價格跌到這個值就要離場。這使它成為最容易理解的風控工具，適合初學者學習設定風險承受度，像是訂出旅途中不可超過的預算，使你在操作前就有一條清晰的保護線。",
  },
]

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader activePath="/guide" />
      <main>
        <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 py-20 lg:py-28">
          <div className="absolute inset-0 opacity-10">
            <div className="mx-auto h-full max-w-6xl rounded-full bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.35),_transparent_70%)]" />
          </div>
          <div className="container relative mx-auto px-4 text-center">
            <Badge variant="outline" className="mb-4 border-primary text-primary">
              Step by Step 教學
            </Badge>
            <h1 className="text-4xl font-bold text-foreground md:text-5xl">6 個步驟，完整掌握 LazyBacktest</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              每張圖都標記了功能所在的位置，依照順序操作就能完成回測、儲存紀錄並啟用 AI 優化。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <Link href="/backtest" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                直接進入回測頁面
              </Link>
              <Link href="/stock-records" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                管理我的股票紀錄
              </Link>
              <Link href="/community" className="rounded-full border border-border px-3 py-1 transition-colors hover:border-primary hover:text-primary">
                加入社群討論經驗
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid gap-8">
            {steps.map((step) => (
              <Card key={step.id} className="border-border/60 shadow-sm transition-shadow hover:shadow-lg">
                <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-6">
                  <Badge variant="outline" className="self-start border-primary/60 text-primary">
                    STEP {step.id}
                  </Badge>
                  <CardTitle className="text-2xl text-foreground">{step.title}</CardTitle>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center">
                  <div className="order-2 space-y-4 lg:order-1">
                    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                      <strong className="block text-foreground">提醒：</strong>
                      <span className="text-foreground">{step.tip}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {step.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`rounded-md border px-3 py-1.5 transition-colors ${
                            link.emphasis
                              ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                              : "border-border hover:border-primary hover:text-primary"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="order-1 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm lg:order-2">
                    <Image
                      src={step.image}
                      alt={`${step.title} 示意圖`}
                      width={960}
                      height={540}
                      className="h-auto w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="strategy-guide" className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-5xl rounded-3xl border border-border/70 bg-card p-8 shadow-xl shadow-primary/10">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-bold text-foreground">策略指南：一次搞懂進／出場術語</h2>
              <p className="text-sm text-muted-foreground">
                在「策略設定」區塊挑選進場或出場條件時，可以回來這裡查閱每個策略的核心意義，協助你判斷什麼訊號適合當前市場階段。
              </p>
            </div>

            <div className="mt-8 grid gap-6 text-sm text-muted-foreground md:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-border/60 bg-background/50 p-4">
                <h3 className="text-base font-semibold text-foreground">做多進場常見條件</h3>
                  <Accordion type="single" collapsible className="space-y-3">
                    {entryGlossary.map((item) => (
                      <AccordionItem
                        key={item.label}
                        value={item.label}
                        className="rounded-xl border border-border/80 bg-card/80 px-4"
                      >
                        <AccordionTrigger className="text-left text-sm font-semibold text-foreground py-3">
                          {item.label}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 pt-0 text-[13px] leading-relaxed text-muted-foreground">
                          {item.description}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
              </div>

              <div className="space-y-4 rounded-2xl border border-border/60 bg-background/50 p-4">
                <h3 className="text-base font-semibold text-foreground">出場與風控邏輯速查</h3>
                  <Accordion type="single" collapsible className="space-y-3">
                    {exitGlossary.map((item) => (
                      <AccordionItem key={item.label} value={item.label} className="rounded-xl border border-border/80 bg-card/80 px-4">
                        <AccordionTrigger className="text-left text-sm font-semibold text-foreground py-3">
                          {item.label}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 pt-0 text-[13px] leading-relaxed text-muted-foreground">
                          {item.description}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
              </div>
            </div>

          </div>
        </section>

        <section className="border-t border-border/60 bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-3xl font-bold text-foreground">下一步：把策略變成可重複的流程</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                完成上述 6 個步驟後，別忘了把重要成果備份到「股票紀錄」，並在社群討論區分享心得。遇到問題時，也可以先查閱
                <Link href="/faq" className="text-primary underline-offset-4 hover:underline"> 常見問題</Link>
                ，或直接
                <Link href="/contact" className="text-primary underline-offset-4 hover:underline"> 寄信給我</Link>
                。
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
