// --- 主 JavaScript 邏輯 (Part 1 of X) - v3.4.1 ---

// 全局變量
const stockChart = null
let backtestWorker = null
const optimizationWorker = null
const workerUrl = null // Loader 會賦值
const cachedStockData = null
const lastFetchSettings = null
const currentOptimizationResults = []
const sortState = { key: "annualizedReturn", direction: "desc" }
const lastOverallResult = null // 儲存最近一次的完整回測結果
const lastSubPeriodResults = null // 儲存子週期結果
const preOptimizationResult = null // 儲存優化前的回測結果，用於對比顯示

// 策略描述對象
const strategyDescriptions = {
  ma_cross: { defaultParams: { period: 20 } },
  macd_cross: { defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  k_d_cross: { defaultParams: { thresholdX: 20, thresholdY: 80 } },
  ema_cross: { defaultParams: { shortPeriod: 9, longPeriod: 26 } },
  short_ma_cross: { defaultParams: { period: 20 } },
  cover_ma_cross: { defaultParams: { period: 20 } },
  short_macd_cross: { defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  cover_macd_cross: { defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  short_k_d_cross: { defaultParams: { thresholdY: 80 } },
  cover_k_d_cross: { defaultParams: { thresholdX: 20 } },
  short_ema_cross: { defaultParams: { shortPeriod: 9, longPeriod: 26 } },
  cover_ema_cross: { defaultParams: { shortPeriod: 9, longPeriod: 26 } },
  short_rsi_overbought: { defaultParams: { overboughtThreshold: 70 } },
  cover_rsi_oversold: { defaultParams: { oversoldThreshold: 30 } },
  short_bollinger_reversal: { defaultParams: { period: 20, stdDev: 2 } },
  cover_bollinger_breakout: { defaultParams: { period: 20, stdDev: 2 } },
  short_price_breakdown: { defaultParams: { priceThreshold: 10 } },
  cover_price_breakout: { defaultParams: { priceThreshold: 10 } },
  short_williams_overbought: { defaultParams: { overboughtThreshold: -20 } },
  cover_williams_oversold: { defaultParams: { oversoldThreshold: -80 } },
  short_turtle_stop_loss: { defaultParams: { stopLossPeriod: 20 } },
  cover_turtle_breakout: { defaultParams: { breakoutPeriod: 20 } },
  cover_trailing_stop: { defaultParams: { percentage: 5 } },
}

// --- Utility Functions ---
function initDates() {
  const eD = new Date()
  const sD = new Date(eD)
  sD.setFullYear(eD.getFullYear() - 5)
  document.getElementById("endDate").value = formatDate(eD)
  document.getElementById("startDate").value = formatDate(sD)
  document.getElementById("recentYears").value = 5
}

function applyRecentYears() {
  const nYI = document.getElementById("recentYears")
  const eDI = document.getElementById("endDate")
  const sDI = document.getElementById("startDate")
  const nY = Number.parseInt(nYI.value)
  const eDS = eDI.value
  if (isNaN(nY) || nY < 1) {
    showError("請輸入有效年數")
    return
  }
  if (!eDS) {
    showError("請先選結束日期")
    return
  }
  const eD = new Date(eDS)
  if (isNaN(eD)) {
    showError("結束日期格式無效")
    return
  }
  const sD = new Date(eD)
  sD.setFullYear(eD.getFullYear() - nY)
  const eY = 1992
  if (sD.getFullYear() < eY) {
    sD.setFullYear(eY, 0, 1)
    const aY = eD.getFullYear() - eY
    nYI.value = aY
    showInfo(`資料最早至 ${eY} 年，已調整`)
  } else {
    showInfo(`已設定開始日期 ${formatDate(sD)}`)
  }
  sDI.value = formatDate(sD)
}

function formatDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function showError(m) {
  const el = document.getElementById("result")
  el.innerHTML = `<i class="fas fa-times-circle mr-2"></i> ${m}`
  el.className = "my-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md"
}

function showSuccess(m) {
  const el = document.getElementById("result")
  el.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${m}`
  el.className = "my-6 p-4 bg-green-100 border-l-4 border-green-500 text-green-700 rounded-md"
}

function showInfo(m) {
  const el = document.getElementById("result")
  el.innerHTML = `<i class="fas fa-info-circle mr-2"></i> ${m}`
  el.className = "my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md"
}

function showLoading(m = "⌛ 處理中...") {
  const el = document.getElementById("loading")
  document.getElementById("loadingText").textContent = m
  el.classList.remove("hidden")
  document.getElementById("progressBar").style.width = `0%`
  const spinner = el.querySelector(".fa-spinner")
  if (spinner) spinner.classList.add("fa-spin")
}

function hideLoading() {
  const el = document.getElementById("loading")
  el.classList.add("hidden")
}

function updateProgress(p) {
  const bar = document.getElementById("progressBar")
  bar.style.width = `${Math.min(100, Math.max(0, p))}%`
}

function getStrategyParams(type) {
  const strategySelectId = `${type}Strategy`
  const strategySelect = document.getElementById(strategySelectId)
  if (!strategySelect) {
    console.error(`[Main] Cannot find select element with ID: ${strategySelectId}`)
    return {}
  }
  const key = strategySelect.value
  let internalKey = key
  if (type === "exit") {
    if (["ma_cross", "macd_cross", "k_d_cross", "ema_cross"].includes(key)) {
      internalKey = `${key}_exit`
    }
  } else if (type === "shortEntry") {
    internalKey = key
    if (
      !strategyDescriptions[internalKey] &&
      [
        "ma_cross",
        "ma_below",
        "ema_cross",
        "rsi_overbought",
        "macd_cross",
        "bollinger_reversal",
        "k_d_cross",
        "price_breakdown",
        "williams_overbought",
        "turtle_stop_loss",
      ].includes(key)
    ) {
      internalKey = `short_${key}`
    }
  } else if (type === "shortExit") {
    internalKey = key
    if (
      !strategyDescriptions[internalKey] &&
      [
        "ma_cross",
        "ma_above",
        "ema_cross",
        "rsi_oversold",
        "macd_cross",
        "bollinger_breakout",
        "k_d_cross",
        "price_breakout",
        "williams_oversold",
        "turtle_breakout",
        "trailing_stop",
      ].includes(key)
    ) {
      internalKey = `cover_${key}`
    }
  }
  const cfg = strategyDescriptions[internalKey]
  const prm = {}
  if (!cfg?.defaultParams) {
    return {}
  }
  for (const pName in cfg.defaultParams) {
    let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1)
    if (internalKey === "k_d_cross" && pName === "thresholdX") idSfx = "KdThresholdX"
    else if (internalKey === "k_d_cross_exit" && pName === "thresholdY") idSfx = "KdThresholdY"
    else if (internalKey === "turtle_stop_loss" && pName === "stopLossPeriod") idSfx = "StopLossPeriod"
    else if ((internalKey === "macd_cross" || internalKey === "macd_cross_exit") && pName === "signalPeriod")
      idSfx = "SignalPeriod"
    else if (internalKey === "short_k_d_cross" && pName === "thresholdY") idSfx = "ShortKdThresholdY"
    else if (internalKey === "cover_k_d_cross" && pName === "thresholdX") idSfx = "CoverKdThresholdX"
    else if (internalKey === "short_macd_cross" && pName === "signalPeriod") idSfx = "ShortSignalPeriod"
    else if (internalKey === "cover_macd_cross" && pName === "signalPeriod") idSfx = "CoverSignalPeriod"
    else if (internalKey === "short_turtle_stop_loss" && pName === "stopLossPeriod") idSfx = "ShortStopLossPeriod"
    else if (internalKey === "cover_turtle_breakout" && pName === "breakoutPeriod") idSfx = "CoverBreakoutPeriod"
    else if (internalKey === "cover_trailing_stop" && pName === "percentage") idSfx = "CoverTrailingStopPercentage"
    const id = `${type}${idSfx}`
    const inp = document.getElementById(id)
    if (inp) {
      prm[pName] = inp.type === "number" ? Number.parseFloat(inp.value) || cfg.defaultParams[pName] : inp.value
    } else {
      prm[pName] = cfg.defaultParams[pName]
    }
  }
  return prm
}

function getBacktestParams() {
  const sN = document.getElementById("stockNo").value.trim().toUpperCase() || "2330"
  const sD = document.getElementById("startDate").value
  const eD = document.getElementById("endDate").value
  const iC = Number.parseFloat(document.getElementById("initialCapital").value) || 100000
  const pS = Number.parseFloat(document.getElementById("positionSize").value) || 100
  const sL = Number.parseFloat(document.getElementById("stopLoss").value) || 0
  const tP = Number.parseFloat(document.getElementById("takeProfit").value) || 0
  const tT = document.querySelector('input[name="tradeTiming"]:checked')?.value || "close"
  const adjP = document.getElementById("adjustedPriceCheckbox").checked
  const eS = document.getElementById("entryStrategy").value
  const xS = document.getElementById("exitStrategy").value
  const eP = getStrategyParams("entry")
  const xP = getStrategyParams("exit")
  const enableShorting = document.getElementById("enableShortSelling").checked
  let shortES = null,
    shortXS = null,
    shortEP = {},
    shortXP = {}
  if (enableShorting) {
    shortES = document.getElementById("shortEntryStrategy").value
    shortXS = document.getElementById("shortExitStrategy").value
    shortEP = getStrategyParams("shortEntry")
    shortXP = getStrategyParams("shortExit")
  }
  const buyFee = Number.parseFloat(document.getElementById("buyFee").value) || 0
  const sellFee = Number.parseFloat(document.getElementById("sellFee").value) || 0
  const positionBasis = document.querySelector('input[name="positionBasis"]:checked')?.value || "initialCapital"
  return {
    stockNo: sN,
    startDate: sD,
    endDate: eD,
    initialCapital: iC,
    positionSize: pS,
    stopLoss: sL,
    takeProfit: tP,
    tradeTiming: tT,
    adjustedPrice: adjP,
    entryStrategy: eS,
    exitStrategy: xS,
    entryParams: eP,
    exitParams: xP,
    enableShorting: enableShorting,
    shortEntryStrategy: shortES,
    shortExitStrategy: shortXS,
    shortEntryParams: shortEP,
    shortExitParams: shortXP,
    buyFee: buyFee,
    sellFee: sellFee,
    positionBasis: positionBasis,
  }
}

function validateBacktestParams(p) {
  if (!/^[0-9A-Z]{3,7}$/.test(p.stockNo)) {
    showError("請輸入有效代碼")
    return false
  }
  if (!p.startDate || !p.endDate) {
    showError("請選擇日期")
    return false
  }
  if (new Date(p.startDate) >= new Date(p.endDate)) {
    showError("結束日期需晚於開始日期")
    return false
  }
  if (p.initialCapital <= 0) {
    showError("本金需>0")
    return false
  }
  if (p.positionSize <= 0 || p.positionSize > 100) {
    showError("部位大小1-100%")
    return false
  }
  if (p.stopLoss < 0 || p.stopLoss > 100) {
    showError("停損0-100%")
    return false
  }
  if (p.takeProfit < 0) {
    showError("停利>=0%")
    return false
  }
  if (p.buyFee < 0) {
    showError("買入手續費不能小於 0%")
    return false
  }
  if (p.sellFee < 0) {
    showError("賣出手續費+稅不能小於 0%")
    return false
  }
  const chkP = (ps, t) => {
    if (!ps) return true
    for (const k in ps) {
      if (typeof ps[k] !== "number" || isNaN(ps[k])) {
        if (Object.keys(ps).length > 0) {
          showError(`${t}策略的參數 ${k} 錯誤 (值: ${ps[k]})`)
          return false
        }
      }
    }
    return true
  }
  if (!chkP(p.entryParams, "做多進場")) return false
  if (!chkP(p.exitParams, "做多出場")) return false
  if (p.enableShorting) {
    if (!chkP(p.shortEntryParams, "做空進場")) return false
    if (!chkP(p.shortExitParams, "回補出場")) return false
  }
  return true
}

function needsDataFetch(cur) {
  if (!cachedStockData || !lastFetchSettings) return true
  return (
    cur.stockNo !== lastFetchSettings.stockNo ||
    cur.startDate !== lastFetchSettings.startDate ||
    cur.endDate !== lastFetchSettings.endDate
  )
}

function getMaxPeriod(params) {
  let maxP = 0
  const checkParams = (paramObj) => {
    if (!paramObj) return
    for (const key in paramObj) {
      if (key.toLowerCase().includes("period") && !key.toLowerCase().includes("signal")) {
        const value = Number.parseFloat(paramObj[key])
        if (!isNaN(value) && value > maxP) maxP = value
      } else if (["shortperiod", "longperiod", "breakoutperiod", "stoplossperiod"].includes(key.toLowerCase())) {
        const value = Number.parseFloat(paramObj[key])
        if (!isNaN(value) && value > maxP) maxP = value
      }
    }
  }
  checkParams(params.entryParams)
  checkParams(params.exitParams)
  if (params.enableShorting) {
    checkParams(params.shortEntryParams)
    checkParams(params.shortExitParams)
  }
  console.log("[getMaxPeriod] Found max period:", maxP)
  return maxP
}

// --- 新增：請求並顯示策略建議 ---
function getSuggestion() {
  console.log("[Main] getSuggestion called")
  const suggestionArea = document.getElementById("today-suggestion-area")
  const suggestionText = document.getElementById("suggestion-text")
  if (!suggestionArea || !suggestionText) return

  if (!cachedStockData || cachedStockData.length < 2) {
    suggestionText.textContent = "請先執行回測獲取數據"
    suggestionArea.className = "my-4 p-4 bg-gray-100 border-l-4 border-gray-400 text-gray-600 rounded-md text-center" // Neutral color
    suggestionArea.classList.remove("hidden")
    return
  }

  suggestionText.textContent = "計算中..."
  suggestionArea.classList.remove("hidden")
  suggestionArea.className = "my-4 p-4 bg-sky-50 border-l-4 border-sky-500 text-sky-800 rounded-md text-center loading" // Loading style

  if (!workerUrl || !backtestWorker) {
    console.warn("[Suggestion] Worker not ready or busy.")
    suggestionText.textContent = "引擎未就緒或忙碌中"
    suggestionArea.classList.remove("loading")
    suggestionArea.classList.add("bg-red-100", "border-red-500", "text-red-700")
    return
  }

  try {
    const params = getBacktestParams()
    const maxPeriod = getMaxPeriod(params)
    const lookbackDays = Math.max(20, maxPeriod * 2)
    console.log(`[Main] Max Period: ${maxPeriod}, Lookback Days for Suggestion: ${lookbackDays}`)

    if (cachedStockData.length < lookbackDays) {
      suggestionText.textContent = `數據不足 (${cachedStockData.length} < ${lookbackDays})`
      suggestionArea.classList.remove("loading")
      suggestionArea.classList.add("bg-yellow-100", "border-yellow-500", "text-yellow-800")
      console.warn(`[Suggestion] Insufficient cached data for lookback: ${cachedStockData.length} < ${lookbackDays}`)
      if (backtestWorker) backtestWorker.terminate()
      backtestWorker = null
      return
    }

    // 檢查 worker 是否可用
    if (backtestWorker && workerUrl) {
      backtestWorker.postMessage({
        type: "getSuggestion",
        params: params,
        lookbackDays: lookbackDays,
      })
    } else {
      suggestionText.textContent = "回測引擎未就緒"
      suggestionArea.classList.remove("loading")
      suggestionArea.classList.add("bg-red-100", "border-red-500", "text-red-700")
    }
  } catch (error) {
    console.error("[Main] Error getting suggestion:", error)
    suggestionText.textContent = "計算建議時出錯"
    suggestionArea.classList.remove("loading")
    suggestionArea.classList.add("bg-red-100", "border-red-500", "text-red-700")
    if (backtestWorker) backtestWorker.terminate()
    backtestWorker = null
  }
}

// --- 新增：頁籤切換功能 ---
function initTabs() {
  const tabs = document.querySelectorAll(".tab")
  const tabContents = document.querySelectorAll(".tab-content")

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.getAttribute("data-tab")

      // 隱藏所有頁籤內容
      tabContents.forEach((content) => {
        content.classList.remove("active")
      })

      // 移除所有頁籤按鈕的active狀態
      tabs.forEach((t) => {
        t.classList.remove("border-blue-500", "text-blue-600")
        t.classList.add("border-transparent", "text-gray-500")
      })

      // 顯示選中的頁籤內容
      const targetContent = document.getElementById(`${targetTab}-tab`)
      if (targetContent) {
        targetContent.classList.add("active")
      }

      // 更新選中頁籤按鈕的狀態
      tab.classList.remove("border-transparent", "text-gray-500")
      tab.classList.add("border-blue-500", "text-blue-600")
    })
  })
}

// --- 新增：初始化批量優化功能 ---
function initBatchOptimizationFeature() {
  // 等待DOM加載完成後初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (window.initBatchOptimization && typeof window.initBatchOptimization === "function") {
        window.initBatchOptimization()
      }
    })
  } else {
    if (window.initBatchOptimization && typeof window.initBatchOptimization === "function") {
      window.initBatchOptimization()
    }
  }
}

// --- 初始化調用 ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Main] DOM loaded, initializing...")

  try {
    // 初始化日期
    initDates()

    // 初始化頁籤功能
    initTabs()

    // 延遲初始化批量優化功能，確保所有依賴都已載入
    setTimeout(() => {
      initBatchOptimizationFeature()
    }, 100)

    console.log("[Main] Initialization completed")
  } catch (error) {
    console.error("[Main] Initialization failed:", error)
  }
})
