// --- 主 JavaScript 邏輯 (Part 1 of X) - v3.5.2 ---
// Patch Tag: LB-PRICE-MODE-20240513A

// 全局變量
let stockChart = null;
let backtestWorker = null;
let optimizationWorker = null;
let workerUrl = null; // Loader 會賦值
let cachedStockData = null;
const cachedDataStore = new Map(); // Map<market|stockNo, CacheEntry>
const progressAnimator = createProgressAnimator();

window.cachedDataStore = cachedDataStore;
let lastFetchSettings = null;
let currentOptimizationResults = [];
let sortState = { key: 'annualizedReturn', direction: 'desc' };
let lastOverallResult = null; // 儲存最近一次的完整回測結果
let lastSubPeriodResults = null; // 儲存子週期結果
let preOptimizationResult = null; // 儲存優化前的回測結果，用於對比顯示
// SAVED_STRATEGIES_KEY, strategyDescriptions, longEntryToCoverMap, longExitToShortMap, globalOptimizeTargets 移至 config.js

// --- Utility Functions ---
function initDates() { const eD=new Date(); const sD=new Date(eD); sD.setFullYear(eD.getFullYear()-5); document.getElementById('endDate').value=formatDate(eD); document.getElementById('startDate').value=formatDate(sD); document.getElementById('recentYears').value=5; }
function applyRecentYears() { const nYI=document.getElementById('recentYears'); const eDI=document.getElementById('endDate'); const sDI=document.getElementById('startDate'); const nY=parseInt(nYI.value); const eDS=eDI.value; if(isNaN(nY)||nY<1){showError("請輸入有效年數");return;} if(!eDS){showError("請先選結束日期");return;} const eD=new Date(eDS); if(isNaN(eD)){showError("結束日期格式無效");return;} const sD=new Date(eD); sD.setFullYear(eD.getFullYear()-nY); const eY=1992; if(sD.getFullYear()<eY){sD.setFullYear(eY,0,1); const aY=eD.getFullYear()-eY; nYI.value=aY; showInfo(`資料最早至 ${eY} 年，已調整`);} else {showInfo(`已設定開始日期 ${formatDate(sD)}`);} sDI.value=formatDate(sD); }
function formatDate(d) { if(!(d instanceof Date)||isNaN(d))return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function showError(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-times-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md'; }
function showSuccess(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-check-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-green-100 border-l-4 border-green-500 text-green-700 rounded-md'; }
function showInfo(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-info-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md'; }
function showLoading(m="⌛ 處理中...") {
    const el = document.getElementById("loading");
    const loadingText = document.getElementById('loadingText');

    if (loadingText) loadingText.textContent = m;
    if (el) el.classList.remove("hidden");
    progressAnimator.reset();
    progressAnimator.start();

    const spinner = el?.querySelector('.fa-spinner');
    if (spinner) spinner.classList.add('fa-spin');
}
function hideLoading() {
    const el = document.getElementById("loading");
    progressAnimator.stop();
    if (el) el.classList.add("hidden");
}
function updateProgress(p) {
    progressAnimator.update(p);
}

function createProgressAnimator() {
    const AUTO_INTERVAL = 200;
    const AUTO_STEP = 1.8;
    const MAX_AUTO_PROGRESS = 99;
    const MIN_DURATION = 320;
    const MAX_DURATION = 2400;
    const MS_PER_PERCENT = 45;
    const SHORT_TASK_THRESHOLD = 4000;
    const SHORT_FIRST_SEGMENT_PROGRESS = 50;
    const SHORT_SECOND_SEGMENT_PROGRESS = 50;
    const SHORT_FIRST_SEGMENT_SPEEDUP = 3;
    const SHORT_SECOND_SEGMENT_SLOWDOWN = 2;
    const SHORT_SECOND_SEGMENT_MULTIPLIER = 1 / SHORT_SECOND_SEGMENT_SLOWDOWN;
    const SHORT_TIME_WEIGHT =
        (SHORT_FIRST_SEGMENT_PROGRESS / SHORT_FIRST_SEGMENT_SPEEDUP)
        + (SHORT_SECOND_SEGMENT_PROGRESS / SHORT_SECOND_SEGMENT_MULTIPLIER);
    const SHORT_FIRST_SEGMENT_TIME_RATIO =
        (SHORT_FIRST_SEGMENT_PROGRESS / SHORT_FIRST_SEGMENT_SPEEDUP)
        / SHORT_TIME_WEIGHT;
    const SHORT_FINAL_MIN_DURATION = 1700;
    const SHORT_FINAL_MAX_DURATION = 2600;

    const raf =
        (typeof window !== 'undefined' && window.requestAnimationFrame)
            ? window.requestAnimationFrame.bind(window)
            : (cb) => setTimeout(() => cb(Date.now()), 16);
    const caf =
        (typeof window !== 'undefined' && window.cancelAnimationFrame)
            ? window.cancelAnimationFrame.bind(window)
            : clearTimeout;

    let currentValue = 0;
    let targetValue = 0;
    let animationFrom = 0;
    let animationStart = 0;
    let animationEnd = 0;
    let rafId = null;
    let autoTimer = null;
    let reportedValue = 0;
    let autoCeiling = 0;
    let startTimestamp = 0;

    function now() {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }
        return Date.now();
    }

    function clamp(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.max(0, Math.min(100, num));
    }

    function apply(value) {
        const bar = document.getElementById('progressBar');
        if (bar) {
            bar.style.width = `${value}%`;
        }
    }

    function stopAnimation() {
        if (rafId) {
            caf(rafId);
            rafId = null;
        }
    }

    function stopAutoTimer() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    function syncCurrent() {
        if (!rafId) return;
        const currentTime = now();
        if (animationEnd <= animationStart || currentTime >= animationEnd) {
            currentValue = targetValue;
            stopAnimation();
            return;
        }
        const ratio = (currentTime - animationStart) / (animationEnd - animationStart);
        const easedRatio = Math.min(1, Math.max(0, ratio));
        currentValue = animationFrom + (targetValue - animationFrom) * easedRatio;
    }

    function scheduleAnimation() {
        stopAnimation();
        if (targetValue <= currentValue + 0.01) {
            currentValue = targetValue;
            apply(currentValue);
            return;
        }
        animationFrom = currentValue;
        animationStart = now();
        const distance = targetValue - animationFrom;
        if (distance <= 0) {
            currentValue = targetValue;
            apply(currentValue);
            return;
        }
        let duration = distance * MS_PER_PERCENT;
        duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));
        if (targetValue >= 100) {
            const elapsed = startTimestamp ? now() - startTimestamp : 0;
            if (elapsed > 0 && elapsed <= SHORT_TASK_THRESHOLD) {
                duration = Math.max(duration, SHORT_FINAL_MIN_DURATION);
                duration = Math.min(duration, SHORT_FINAL_MAX_DURATION);
            } else {
                duration = Math.min(duration, 900);
            }
        }
        animationEnd = animationStart + duration;
        apply(currentValue);
        rafId = raf(step);
    }

    function step(timestamp) {
        if (!rafId) return;
        const currentTime = typeof timestamp === 'number' ? timestamp : now();
        if (animationEnd <= animationStart || currentTime >= animationEnd) {
            currentValue = targetValue;
            apply(currentValue);
            stopAnimation();
            return;
        }
        const ratio = (currentTime - animationStart) / (animationEnd - animationStart);
        const easedRatio = Math.min(1, Math.max(0, ratio));
        currentValue = animationFrom + (targetValue - animationFrom) * easedRatio;
        apply(currentValue);
        rafId = raf(step);
    }

    function ensureAutoTimer() {
        if (autoTimer) return;
        autoTimer = setInterval(() => {
            if (reportedValue >= 100) {
                autoCeiling = 100;
                setTarget(100);
                stopAutoTimer();
                return;
            }
            let nextCeiling = Math.max(reportedValue, autoCeiling + AUTO_STEP);
            const elapsed = startTimestamp ? now() - startTimestamp : 0;
            if (elapsed > 0 && elapsed <= SHORT_TASK_THRESHOLD) {
                const normalizedTime = elapsed / SHORT_TASK_THRESHOLD;
                if (normalizedTime <= SHORT_FIRST_SEGMENT_TIME_RATIO) {
                    const fastRatio = normalizedTime / SHORT_FIRST_SEGMENT_TIME_RATIO;
                    const fastProgress = fastRatio * SHORT_FIRST_SEGMENT_PROGRESS;
                    nextCeiling = Math.max(nextCeiling, fastProgress);
                } else {
                    const remainingTimeRatio = (normalizedTime - SHORT_FIRST_SEGMENT_TIME_RATIO)
                        / (1 - SHORT_FIRST_SEGMENT_TIME_RATIO);
                    const slowProgress = SHORT_FIRST_SEGMENT_PROGRESS
                        + (remainingTimeRatio * SHORT_SECOND_SEGMENT_PROGRESS);
                    nextCeiling = Math.max(nextCeiling, slowProgress);
                }
            }
            autoCeiling = Math.min(MAX_AUTO_PROGRESS, nextCeiling);
            if (autoCeiling > targetValue + 0.05) {
                setTarget(autoCeiling);
            }
        }, AUTO_INTERVAL);
    }

    function setTarget(value) {
        const clamped = clamp(value);
        if (clamped <= currentValue + 0.01 && clamped <= targetValue + 0.01) {
            targetValue = clamped;
            if (!rafId) {
                currentValue = clamped;
                apply(currentValue);
            }
            return;
        }
        syncCurrent();
        if (clamped <= currentValue) {
            targetValue = clamped;
            currentValue = clamped;
            apply(currentValue);
            if (clamped >= 100) {
                stopAnimation();
                stopAutoTimer();
            }
            return;
        }
        if (Math.abs(clamped - targetValue) < 0.05) {
            targetValue = clamped;
            return;
        }
        targetValue = clamped;
        scheduleAnimation();
        if (clamped >= 100) {
            stopAutoTimer();
        }
    }

    return {
        start() {
            startTimestamp = now();
            ensureAutoTimer();
        },
        stop() {
            stopAutoTimer();
            stopAnimation();
        },
        reset() {
            stopAutoTimer();
            stopAnimation();
            currentValue = 0;
            targetValue = 0;
            animationFrom = 0;
            animationStart = 0;
            animationEnd = 0;
            reportedValue = 0;
            autoCeiling = 0;
            startTimestamp = 0;
            apply(0);
        },
        update(nextProgress) {
            const clamped = clamp(nextProgress);
            if (clamped >= 100) {
                reportedValue = 100;
                setTarget(100);
                return;
            }
            if (clamped > reportedValue) {
                reportedValue = clamped;
            }
            if (clamped > autoCeiling) {
                autoCeiling = clamped;
            }
            setTarget(Math.max(targetValue, clamped));
            ensureAutoTimer();
        },
    };
}
function getStrategyParams(type) { const strategySelectId = `${type}Strategy`; const strategySelect = document.getElementById(strategySelectId); if (!strategySelect) { console.error(`[Main] Cannot find select element with ID: ${strategySelectId}`); return {}; } const key = strategySelect.value; let internalKey = key; if (type === 'exit') { if(['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(key)) { internalKey = `${key}_exit`; } } else if (type === 'shortEntry') { internalKey = key; if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(key)) { internalKey = `short_${key}`; } } else if (type === 'shortExit') { internalKey = key; if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(key)) { internalKey = `cover_${key}`; } } const cfg = strategyDescriptions[internalKey]; const prm = {}; if (!cfg?.defaultParams) { return {}; } for (const pName in cfg.defaultParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY'; else if (internalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX'; else if (internalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod'; else if (internalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod'; else if (internalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod'; else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod'; else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage'; const id = `${type}${idSfx}`; const inp = document.getElementById(id); if (inp) { prm[pName] = (inp.type === 'number') ? (parseFloat(inp.value) || cfg.defaultParams[pName]) : inp.value; } else { prm[pName] = cfg.defaultParams[pName]; } } return prm; }
function getBacktestParams() { const sN=document.getElementById("stockNo").value.trim().toUpperCase()||"2330"; const sD=document.getElementById("startDate").value; const eD=document.getElementById("endDate").value; const iC=parseFloat(document.getElementById("initialCapital").value)||100000; const pS=parseFloat(document.getElementById("positionSize").value)||100; const sL=parseFloat(document.getElementById("stopLoss").value)||0; const tP=parseFloat(document.getElementById("takeProfit").value)||0; const tT=document.querySelector('input[name="tradeTiming"]:checked')?.value||'close'; const adjP=document.getElementById("adjustedPriceCheckbox").checked; const eS=document.getElementById("entryStrategy").value; const xS=document.getElementById("exitStrategy").value; const eP=getStrategyParams('entry'); const xP=getStrategyParams('exit'); const enableShorting = document.getElementById("enableShortSelling").checked; let shortES = null, shortXS = null, shortEP = {}, shortXP = {}; if (enableShorting) { shortES = document.getElementById("shortEntryStrategy").value; shortXS = document.getElementById("shortExitStrategy").value; shortEP = getStrategyParams('shortEntry'); shortXP = getStrategyParams('shortExit'); } const buyFee = parseFloat(document.getElementById("buyFee").value) || 0; const sellFee = parseFloat(document.getElementById("sellFee").value) || 0;     const positionBasis = document.querySelector('input[name="positionBasis"]:checked')?.value || 'initialCapital'; const marketSwitch = document.getElementById("marketSwitch"); const market = (marketSwitch && marketSwitch.checked) ? 'TPEX' : 'TWSE'; return { stockNo: sN, startDate: sD, endDate: eD, initialCapital: iC, positionSize: pS, stopLoss: sL, takeProfit: tP, tradeTiming: tT, adjustedPrice: adjP, entryStrategy: eS, exitStrategy: xS, entryParams: eP, exitParams: xP, enableShorting: enableShorting, shortEntryStrategy: shortES, shortExitStrategy: shortXS, shortEntryParams: shortEP, shortExitParams: shortXP, buyFee: buyFee, sellFee: sellFee, positionBasis: positionBasis, market: market, marketType: currentMarket, priceMode: adjP ? 'adjusted' : 'raw' }; }
function validateBacktestParams(p) { if(!/^[0-9A-Z]{3,7}$/.test(p.stockNo)){showError("請輸入有效代碼");return false;} if(!p.startDate||!p.endDate){showError("請選擇日期");return false;} if(new Date(p.startDate)>=new Date(p.endDate)){showError("結束日期需晚於開始日期");return false;} if(p.initialCapital<=0){showError("本金需>0");return false;} if(p.positionSize<=0||p.positionSize>100){showError("部位大小1-100%");return false;} if(p.stopLoss<0||p.stopLoss>100){showError("停損0-100%");return false;} if(p.takeProfit<0){showError("停利>=0%");return false;} if (p.buyFee < 0) { showError("買入手續費不能小於 0%"); return false; } if (p.sellFee < 0) { showError("賣出手續費+稅不能小於 0%"); return false; } const chkP=(ps,t)=>{ if (!ps) return true; for(const k in ps){ if(typeof ps[k]!=='number'||isNaN(ps[k])){ if(Object.keys(ps).length > 0) { showError(`${t}策略的參數 ${k} 錯誤 (值: ${ps[k]})`); return false; } } } return true; }; if(!chkP(p.entryParams,'做多進場'))return false; if(!chkP(p.exitParams,'做多出場'))return false; if (p.enableShorting) { if(!chkP(p.shortEntryParams,'做空進場'))return false; if(!chkP(p.shortExitParams,'回補出場'))return false; } return true; }

const MAIN_DAY_MS = 24 * 60 * 60 * 1000;

function buildCacheKey(cur) {
    if (!cur) return '';
    const market = (cur.market || cur.marketType || 'TWSE').toUpperCase();
    const priceMode = cur.adjustedPrice || cur.priceMode === 'adjusted' ? 'ADJ' : 'RAW';
    return `${market}|${cur.stockNo}|${priceMode}`;
}

function parseISOToUTC(iso) {
    if (!iso) return NaN;
    const [y, m, d] = iso.split('-').map((val) => parseInt(val, 10));
    if ([y, m, d].some((num) => Number.isNaN(num))) return NaN;
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

function utcToISODate(ms) {
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function mergeRangeBounds(ranges) {
    if (!Array.isArray(ranges) || ranges.length === 0) return [];
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i];
        const last = merged[merged.length - 1];
        if (current.start <= last.end) {
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push({ ...current });
        }
    }
    return merged;
}

function normalizeRange(startISO, endISO) {
    const start = parseISOToUTC(startISO);
    const end = parseISOToUTC(endISO);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return { start, end: end + MAIN_DAY_MS };
}

function mergeIsoCoverage(existing, additionalRange) {
    const bounds = [];
    (existing || []).forEach((range) => {
        const normalized = normalizeRange(range.start, range.end);
        if (normalized) bounds.push(normalized);
    });
    if (additionalRange) {
        const normalized = normalizeRange(additionalRange.start, additionalRange.end);
        if (normalized) bounds.push(normalized);
    }
    const mergedBounds = mergeRangeBounds(bounds);
    return mergedBounds.map((range) => ({
        start: utcToISODate(range.start),
        end: utcToISODate(range.end - MAIN_DAY_MS),
    }));
}

function coverageCoversRange(coverage, targetRange) {
    if (!targetRange) return false;
    const targetBounds = normalizeRange(targetRange.start, targetRange.end);
    if (!targetBounds) return false;
    const mergedBounds = mergeRangeBounds(
        (coverage || [])
            .map((range) => normalizeRange(range.start, range.end))
            .filter((range) => !!range)
    );
    if (mergedBounds.length === 0) return false;
    let cursor = targetBounds.start;
    for (let i = 0; i < mergedBounds.length && cursor < targetBounds.end; i += 1) {
        const segment = mergedBounds[i];
        if (segment.end <= cursor) continue;
        if (segment.start > cursor) return false;
        cursor = Math.max(cursor, segment.end);
    }
    return cursor >= targetBounds.end;
}

function extractRangeData(data, startISO, endISO) {
    if (!Array.isArray(data)) return [];
    return data.filter((row) => row && row.date >= startISO && row.date <= endISO);
}

function summariseSourceLabels(labels) {
    if (!Array.isArray(labels) || labels.length === 0) return '';
    const unique = Array.from(new Set(labels.filter((label) => !!label)));
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];
    const hasCache = unique.some((label) => /快取|cache/i.test(label));
    const hasRemote = unique.some((label) => !/快取|cache/i.test(label));
    if (hasRemote && hasCache) {
        const primary = unique.find((label) => !/快取|cache/i.test(label)) || unique[0];
        return `${primary} (部分快取)`;
    }
    if (hasCache) {
        return `${unique[0]} (快取)`;
    }
    return unique.join(' / ');

}

function needsDataFetch(cur) {
    if (!cur || !cur.stockNo || !cur.startDate || !cur.endDate) return true;
    const key = buildCacheKey(cur);

    const entry = cachedDataStore.get(key);
    if (!entry) return true;
    if (!Array.isArray(entry.coverage) || entry.coverage.length === 0) return true;
    return !coverageCoversRange(entry.coverage, { start: cur.startDate, end: cur.endDate });

}
function getMaxPeriod(params) { let maxP = 0; const checkParams = (paramObj) => { if (!paramObj) return; for (const key in paramObj) { if (key.toLowerCase().includes('period') && !key.toLowerCase().includes('signal')) { const value = parseFloat(paramObj[key]); if (!isNaN(value) && value > maxP) maxP = value; } else if (['shortperiod', 'longperiod', 'breakoutperiod', 'stoplossperiod'].includes(key.toLowerCase())) { const value = parseFloat(paramObj[key]); if (!isNaN(value) && value > maxP) maxP = value; } } }; checkParams(params.entryParams); checkParams(params.exitParams); if (params.enableShorting) { checkParams(params.shortEntryParams); checkParams(params.shortExitParams); } console.log("[getMaxPeriod] Found max period:", maxP); return maxP; }

// --- 新增：請求並顯示策略建議 ---
function getSuggestion() {
    console.log("[Main] getSuggestion called");
    const suggestionArea = document.getElementById('today-suggestion-area');
    const suggestionText = document.getElementById('suggestion-text');
    if (!suggestionArea || !suggestionText) return;

    if (!cachedStockData || cachedStockData.length < 2) {
        suggestionText.textContent = "請先執行回測獲取數據";
        suggestionArea.className = 'my-4 p-4 bg-gray-100 border-l-4 border-gray-400 text-gray-600 rounded-md text-center'; // Neutral color
        suggestionArea.classList.remove('hidden');
        return;
    }

    suggestionText.textContent = "計算中...";
    suggestionArea.classList.remove('hidden');
    suggestionArea.className = 'my-4 p-4 bg-sky-50 border-l-4 border-sky-500 text-sky-800 rounded-md text-center loading'; // Loading style

    if (!workerUrl || !backtestWorker) {
        console.warn("[Suggestion] Worker not ready or busy.");
        suggestionText.textContent = "引擎未就緒或忙碌中";
        suggestionArea.classList.remove('loading');
        suggestionArea.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        return;
    }

    try {
        const params = getBacktestParams();
        const maxPeriod = getMaxPeriod(params);
        const lookbackDays = Math.max(20, maxPeriod * 2);
        console.log(`[Main] Max Period: ${maxPeriod}, Lookback Days for Suggestion: ${lookbackDays}`);

        if (cachedStockData.length < lookbackDays) {
            suggestionText.textContent = `數據不足 (${cachedStockData.length} < ${lookbackDays})`;
            suggestionArea.classList.remove('loading');
            suggestionArea.classList.add('bg-yellow-100', 'border-yellow-500', 'text-yellow-800');
            console.warn(`[Suggestion] Insufficient cached data for lookback: ${cachedStockData.length} < ${lookbackDays}`);
            if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            return;
        }

        // 檢查 worker 是否可用
        if (backtestWorker && workerUrl) {
            backtestWorker.postMessage({
                type: 'getSuggestion',
                params: params,
                lookbackDays: lookbackDays
            });
        } else {
            suggestionText.textContent = "回測引擎未就緒";
            suggestionArea.classList.remove('loading');
            suggestionArea.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        }

    } catch (error) {
        console.error("[Main] Error getting suggestion:", error);
        suggestionText.textContent = "計算建議時出錯";
        suggestionArea.classList.remove('loading');
        suggestionArea.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
    }
}

// --- 新增：頁籤切換功能 ---
function initTabs() {
    // Tab functionality is now handled in the HTML directly
    // This function is kept for compatibility but does nothing
    console.log("[Main] Tab initialization - handled by HTML event listeners");
}

// --- 新增：初始化批量優化功能 ---
function initBatchOptimizationFeature() {
    // 等待DOM加載完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (window.batchOptimization && window.batchOptimization.init) {
                window.batchOptimization.init();
            }
        });
    } else {
        if (window.batchOptimization && window.batchOptimization.init) {
            window.batchOptimization.init();
        }
    }
}

// --- 初始化調用 ---
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Main] DOM loaded, initializing...');
    
    try {
        // 初始化日期
        initDates();
        
        // 初始化頁籤功能
        initTabs();
        
        // 延遲初始化批量優化功能，確保所有依賴都已載入
        setTimeout(() => {
            initBatchOptimizationFeature();
        }, 100);
        
        console.log('[Main] Initialization completed');
    } catch (error) {
        console.error('[Main] Initialization failed:', error);
    }
});
