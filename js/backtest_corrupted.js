// 確保 zoom 插件正確註冊
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chart object:', typeof Chart);
    console.log('Available Chart plugins:', Chart.registry ? Object.keys(Chart.registry.plugins.items) : 'No registry');
});

// Patch Tag: LB-TODAY-UI-20250913A
const fallbackTodaySuggestionUI = (() => {
    const area = document.getElementById('today-suggestion-area');
    const body = document.getElementById('today-suggestion-body');
    const empty = document.getElementById('today-suggestion-empty');
    const banner = document.getElementById('today-suggestion-banner');
    const labelEl = document.getElementById('today-suggestion-label');
    const dateEl = document.getElementById('today-suggestion-date');
    const priceEl = document.getElementById('today-suggestion-price');
    const actionEl = document.getElementById('today-suggestion-action');
    const longEl = document.getElementById('today-suggestion-long');
    const shortEl = document.getElementById('today-suggestion-short');
    const positionEl = document.getElementById('today-suggestion-position');
    const portfolioEl = document.getElementById('today-suggestion-portfolio');
    const notesContainer = area ? area.querySelector('.today-suggestion-notes') : null;
    const notesEl = document.getElementById('today-suggestion-notes');
    const toneClasses = ['is-bullish', 'is-bearish', 'is-exit', 'is-neutral', 'is-info', 'is-warning', 'is-error'];
    const toneMap = {
        bullish: 'is-bullish',
        bear: 'is-bearish',
        bearish: 'is-bearish',
        exit: 'is-exit',
        neutral: 'is-neutral',
        info: 'is-info',
        warning: 'is-warning',
        error: 'is-error',
    };
    const actionLabelMap = {
        enter_long: '做多買入',
        enter_short: '做空賣出',
        exit_long: '做多賣出',
        cover_short: '做空回補',
        hold_long: '繼續持有多單',
        hold_short: '繼續持有空單',
        stay_flat: '維持空手',
    };
    const numberFormatter = typeof Intl !== 'undefined'
        ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 })
        : { format: (value) => (Number.isFinite(value) ? value.toString() : '—') };
    const integerFormatter = typeof Intl !== 'undefined'
        ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })
        : { format: (value) => (Number.isFinite(value) ? value.toString() : '—') };
    const priceTypeLabel = {
        close: '收盤',
        open: '開盤',
        high: '最高',
        low: '最低',
    };

    function ensureAreaVisible() {
        if (area) area.classList.remove('hidden');
    }

    function showBodyContent() {
        if (body) body.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
    }

    function showPlaceholderContent() {
        if (body) body.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
    }

    function setTone(tone) {
        if (!banner) return;
        toneClasses.forEach((cls) => banner.classList.remove(cls));
        const resolved = toneMap[tone] || toneMap.neutral;
        banner.classList.add(resolved);
    }

    function setActionTag(payload) {
        if (!actionEl) return;
        const text = payload?.actionTag?.text
            || payload?.actionLabel
            || payload?.label
            || '';
        if (!text) {
            actionEl.textContent = '';
            toneClasses.forEach((cls) => actionEl.classList.remove(cls));
            actionEl.style.display = 'none';
            return;
        }
        actionEl.style.display = 'inline-flex';
        actionEl.textContent = text;
        toneClasses.forEach((cls) => actionEl.classList.remove(cls));
        const tone = payload?.actionTag?.tone || payload?.tone || 'neutral';
        actionEl.classList.add(toneMap[tone] || toneMap.neutral);
    }

    function setText(el, text) {
        if (!el) return;
        el.textContent = text ?? '—';
    }

    function formatPriceValue(value, type) {
        if (!Number.isFinite(value)) return null;
        const formatted = numberFormatter.format(value);
        if (!type) return formatted;
        const label = priceTypeLabel[type] || '價格';
        return `${label} ${formatted}`;
    }

    function formatShares(shares) {
        if (!Number.isFinite(shares) || shares <= 0) return null;
        return `${integerFormatter.format(shares)} 股`;
    }

    function formatCurrency(value) {
        if (!Number.isFinite(value)) return null;
        return `${numberFormatter.format(value)} 元`;
    }

    function describePosition(info) {
        if (!info) return '—';
        const parts = [];
        if (info.state && info.state !== '空手') {
            parts.push(info.state);
        }
        const shareText = formatShares(info.shares);
        if (shareText) parts.push(shareText);
        if (Number.isFinite(info.averagePrice)) {
            parts.push(`均價 ${numberFormatter.format(info.averagePrice)}`);
        }
        if (Number.isFinite(info.marketValue)) {
            parts.push(`市值 ${numberFormatter.format(info.marketValue)}`);
        }
        if (parts.length === 0) return '空手';
        return parts.join('，');
    }

    function formatDetail(detail, payload) {
        if (!detail || typeof detail !== 'object') return null;
        switch (detail.type) {
        case 'action': {
            const label = detail.label || actionLabelMap[detail.action] || payload?.label;
            return label ? `今日策略：${label}` : null;
        }
        case 'execution': {
            const sideLabel = detail.side === 'short' ? '空單' : '多單';
            let actionLabel = '操作';
            if (detail.event === 'enter') actionLabel = '進場';
            else if (detail.event === 'exit') actionLabel = '平倉';
            else if (detail.event === 'cover') actionLabel = '回補';
            const parts = [`${sideLabel}${actionLabel}`];
            const priceText = formatPriceValue(detail.price, detail.priceType);
            if (priceText) parts.push(priceText);
            const shareText = formatShares(detail.shares);
            if (shareText) parts.push(shareText);
            return parts.join('，');
        }
        case 'holding': {
            const sideLabel = detail.side === 'short' ? '空單' : '多單';
            const parts = [];
            if (detail.state && detail.state !== '空手') {
                parts.push(`${sideLabel}${detail.state}`);
            }
            const shareText = formatShares(detail.shares);
            if (shareText) parts.push(shareText);
            if (Number.isFinite(detail.averagePrice)) {
                parts.push(`均價 ${numberFormatter.format(detail.averagePrice)}`);
            }
            if (Number.isFinite(detail.marketValue)) {
                parts.push(`市值 ${numberFormatter.format(detail.marketValue)} 元`);
            }
            return parts.length ? parts.join('，') : null;
        }
        case 'portfolio':
            return Number.isFinite(detail.value)
                ? `策略資金估算約 ${numberFormatter.format(detail.value)} 元。`
                : null;
        case 'dataLag':
            return detail.latestDate && Number.isFinite(detail.days)
                ? `最新資料為 ${detail.latestDate}，距今日 ${detail.days} 日。`
                : null;
        case 'rangeExtension':
            return detail.requestedEndDate && detail.appliedEndDate
                ? `原設定結束日 ${detail.requestedEndDate}，已延伸至 ${detail.appliedEndDate} 以評估今日部位。`
                : null;
        case 'rangeShorter':
            return detail.requestedEndDate && detail.appliedEndDate
                ? `策略結束日為 ${detail.requestedEndDate}，最新資料僅至 ${detail.appliedEndDate}。`
                : null;
        case 'info':
            return typeof detail.message === 'string' ? detail.message : null;
        default:
            return typeof detail.message === 'string' ? detail.message : null;
        }
    }

    function buildNoteLines(payload) {
        const lines = [];
        const details = Array.isArray(payload?.details) ? payload.details : [];
        details.forEach((detail) => {
            const text = formatDetail(detail, payload);
            if (text && !lines.includes(text)) {
                lines.push(text);
            }
        });
        const notes = Array.isArray(payload?.notes) ? payload.notes : [];
        notes.forEach((note) => {
            if (typeof note === 'string' && note.trim() && !lines.includes(note)) {
                lines.push(note);
            }
        });
        return lines;
    }

    function renderNotes(payload) {
        if (!notesEl || !notesContainer) return;
        const notes = buildNoteLines(payload);
        notesEl.innerHTML = '';
        if (!notes.length) {
            notesContainer.style.display = 'none';
            return;
        }
        notesContainer.style.display = 'block';
        notes.forEach((note) => {
            const li = document.createElement('li');
            li.textContent = note;
            notesEl.appendChild(li);
        });
    }

    function applyResultPayload(payload) {
        const priceText = payload.price?.text
            || formatPriceValue(payload.price?.value, payload.price?.type)
            || payload.message
            || '—';
        const displayDate = payload.latestTradingDate || payload.latestDate;
        setText(labelEl, payload.label || '—');
        setText(dateEl, displayDate || '—');
        setText(priceEl, priceText);
        setText(longEl, describePosition(payload.longPosition));
        setText(shortEl, describePosition(payload.shortPosition));
        setText(positionEl, payload.positionSummary || '—');
        if (portfolioEl) {
            const portfolioText = formatCurrency(payload.evaluation?.portfolioValue);
            setText(portfolioEl, portfolioText || '—');
        }
        renderNotes(payload);
    }

    return {
        reset() {
            if (!area) return;
            ensureAreaVisible();
            showPlaceholderContent();
            setTone('neutral');
            setActionTag({ label: '—', tone: 'neutral' });
            setText(labelEl, '尚未取得建議');
            setText(dateEl, '—');
            setText(priceEl, '—');
            setText(longEl, '—');
            setText(shortEl, '—');
            setText(positionEl, '—');
            if (portfolioEl) setText(portfolioEl, '—');
            renderNotes({ notes: [] });
        },
        showLoading() {
            if (!area) return;
            ensureAreaVisible();
            showBodyContent();
            setTone('info');
            setActionTag({ actionTag: { text: '計算中', tone: 'info' } });
            setText(labelEl, '計算今日建議中...');
            setText(dateEl, '—');
            setText(priceEl, '資料計算中，請稍候');
            setText(longEl, '—');
            setText(shortEl, '—');
            setText(positionEl, '—');
            if (portfolioEl) setText(portfolioEl, '—');
            renderNotes({ notes: [] });
        },
        showResult(payload = {}) {
            if (!area) return;
            ensureAreaVisible();
            showBodyContent();
            const status = payload.status || 'ok';
            if (status !== 'ok') {
                const fallbackNotes = [];
                if (payload.message) fallbackNotes.push(payload.message);
                if (Array.isArray(payload.notes)) fallbackNotes.push(...payload.notes);
                const tone = status === 'no_data' ? 'warning' : status === 'future_start' ? 'info' : 'neutral';
                setTone(tone);
                setActionTag({
                    actionTag: {
                        text: status === 'no_data' ? '資料不足' : status === 'future_start' ? '尚未開始' : '提醒',
                        tone,
                    },
                });
                applyResultPayload({
                    label: payload.label || (status === 'future_start' ? '策略尚未開始' : '無法取得建議'),
                    latestDate: payload.latestDate || '—',
                    price: { text: payload.price?.text || payload.message || '—' },
                    longPosition: { state: '空手' },
                    shortPosition: { state: '空手' },
                    positionSummary: '—',
                    notes: fallbackNotes,
                    evaluation: {},
                });
                return;
            }
            setTone(payload.tone || 'neutral');
            setActionTag(payload);
            applyResultPayload(payload);
        },
        showError(message) {
            if (!area) return;
            ensureAreaVisible();
            showBodyContent();
            setTone('error');
            setActionTag({ actionTag: { text: '計算失敗', tone: 'error' } });
            applyResultPayload({
                label: '計算失敗',
                latestDate: '—',
                price: { text: message || '計算建議時發生錯誤' },
                longPosition: { state: '空手' },
                shortPosition: { state: '空手' },
                positionSummary: '—',
                notes: message ? [message] : [],
                evaluation: {},
            });
        },
        showPlaceholder() {
            if (!area) return;
            ensureAreaVisible();
            showPlaceholderContent();
        },
    };
})();

window.lazybacktestTodaySuggestion = fallbackTodaySuggestionUI;

const FALLBACK_DAY_MS = 24 * 60 * 60 * 1000;

function isoDateToUTC(iso) {
    if (typeof iso !== 'string' || iso.length < 10) return NaN;
    const parts = iso.split('-');
    if (parts.length < 3) return NaN;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return NaN;
    return Date.UTC(year, month - 1, day);
}

function utcToISODate(ms) {
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function computeCoverageFromRowsForSuggestion(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const sorted = rows
        .map((row) => (row && row.date ? isoDateToUTC(row.date) : NaN))
        .filter((ms) => Number.isFinite(ms))
        .sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const tolerance = FALLBACK_DAY_MS * 6;
    const segments = [];
    let segStart = sorted[0];
    let segEnd = segStart + FALLBACK_DAY_MS;
    for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i];
        if (!Number.isFinite(current)) continue;
        if (current <= segEnd + tolerance) {
            if (current + FALLBACK_DAY_MS > segEnd) {
                segEnd = current + FALLBACK_DAY_MS;
            }
        } else {
            segments.push({ start: utcToISODate(segStart), end: utcToISODate(segEnd - FALLBACK_DAY_MS) });
            segStart = current;
            segEnd = current + FALLBACK_DAY_MS;
        }
    }
    segments.push({ start: utcToISODate(segStart), end: utcToISODate(segEnd - FALLBACK_DAY_MS) });
    return segments;
}

function computeCoverageFingerprintForSuggestion(coverage) {
    if (!Array.isArray(coverage) || coverage.length === 0) return null;
    const parts = coverage
        .map((range) => {
            if (!range || (!range.start && !range.end)) return null;
            const start = range.start || '';
            const end = range.end || '';
            return `${start}~${end}`;
        })
        .filter(Boolean);
    if (parts.length === 0) return null;
    return parts.join('|');
}

function getSuggestion() {
    console.log('[Fallback Main] getSuggestion called');
    const suggestionUI = window.lazybacktestTodaySuggestion;
    if (!suggestionUI || typeof suggestionUI.showLoading !== 'function') {
        console.warn('[Fallback Main] Suggestion UI controller not available.');
        return;
    }

    if (!Array.isArray(cachedStockData) || cachedStockData.length === 0) {
        suggestionUI.showError('請先執行回測以建立建議所需的資料。');
        return;
    }

    if (!workerUrl || !backtestWorker) {
        console.warn('[Fallback Suggestion] Worker not ready or busy.');
        suggestionUI.showError('引擎未就緒或忙碌中');
        return;
    }

    suggestionUI.showLoading();

    try {
        const params = getBacktestParams();
        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared)
            ? lazybacktestShared
            : null;
        const windowOptions = {
            minBars: 90,
            multiplier: 2,
            marginTradingDays: 12,
            extraCalendarDays: 7,
            minDate: sharedUtils?.MIN_DATA_DATE,
            defaultStartDate: params.startDate,
        };

        let lookbackDecision = null;
        if (sharedUtils && typeof sharedUtils.resolveDataWindow === 'function') {
            lookbackDecision = sharedUtils.resolveDataWindow(params, windowOptions);
        }

        const fallbackMaxPeriod = sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(params)
            : 0;

        let lookbackDays = Number.isFinite(lookbackDecision?.lookbackDays)
            ? lookbackDecision.lookbackDays
            : null;

        if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0)
            && sharedUtils && typeof sharedUtils.resolveLookbackDays === 'function') {
            const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
            if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                lookbackDays = fallbackDecision.lookbackDays;
                if (!lookbackDecision) lookbackDecision = fallbackDecision;
            }
        }

        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
                ? sharedUtils.estimateLookbackBars(fallbackMaxPeriod, { minBars: 90, multiplier: 2 })
                : Math.max(90, fallbackMaxPeriod * 2 || 0);
        }

        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            lookbackDays = 120;
        }

        const effectiveStartDate = lastFetchSettings?.effectiveStartDate
            || lookbackDecision?.effectiveStartDate
            || params.effectiveStartDate
            || params.startDate;

        const dataStartDate = lastFetchSettings?.dataStartDate
            || lookbackDecision?.dataStartDate
            || params.dataStartDate
            || effectiveStartDate
            || params.startDate;

        const request = {
            type: 'getSuggestion',
            params: {
                ...params,
                dataStartDate,
                effectiveStartDate,
                lookbackDays,
            },
            lookbackDays,
            dataStartDate,
            effectiveStartDate,
            cachedData: Array.isArray(cachedStockData) ? cachedStockData : null,
            lastBacktestRange: { start: params.startDate, end: params.endDate },
        };

        const coverage = computeCoverageFromRowsForSuggestion(cachedStockData);
        const coverageFingerprint = computeCoverageFingerprintForSuggestion(coverage);

        request.cachedMeta = {
            summary: null,
            adjustments: [],
            debugSteps: [],
            adjustmentFallbackApplied: false,
            adjustmentFallbackInfo: null,
            priceSource: null,
            dataSource: null,
            splitDiagnostics: null,
            finmindStatus: null,
            fetchRange: null,
            diagnostics: null,
            lookbackDays,
            coverage,
            coverageFingerprint,
        };

        backtestWorker.postMessage(request);
    } catch (error) {
        console.error('[Fallback Main] Error getting suggestion:', error);
        if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
            window.lazybacktestTodaySuggestion.showError(error?.message || '計算建議時出錯');
        }
        if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
        hideLoading();
    }
}

// --- 主回測函數 ---
function runBacktestInternal() {
    console.log("[Main] runBacktestInternal called");
    if (!workerUrl) { showError("背景計算引擎尚未準備就緒，請稍候再試或重新載入頁面。"); hideLoading(); return; }
    try {
        const params=getBacktestParams();
        console.log("[Main] Params:", params);
        const isValid = validateBacktestParams(params);
        console.log("[Main] Validation:", isValid);
        if(!isValid) return;

        const curSettings={stockNo:params.stockNo, startDate:params.startDate, endDate:params.endDate};
        const useCache=!needsDataFetch(curSettings);
        const msg=useCache?"⌛ 使用快取執行回測...":"⌛ 獲取數據並回測...";
        showLoading(msg);
        clearPreviousResults(); // Clear previous results including suggestion

        if(backtestWorker) { // Ensure previous worker is terminated
            backtestWorker.terminate();
            backtestWorker = null;
            console.log("[Main] Terminated previous worker.");
        }
        console.log("[Main] WorkerUrl:", workerUrl);
        console.log("[Main] Creating worker...");
        backtestWorker=new Worker(workerUrl);

        // Unified Worker Message Handler
        backtestWorker.onmessage=e=>{
            const{type,data,progress,message,stockNo,marketType}=e.data;
            console.log("[Main] Received message from worker:", type, data); // Debug log

            if(type==='progress'){
                updateProgress(progress);
                if(message)document.getElementById('loadingText').textContent=`⌛ ${message}`;
            } else if(type==='marketError'){
                // 處理市場查詢錯誤，顯示智慧錯誤處理對話框
                hideLoading();
                if (window.showMarketSwitchModal) {
                    window.showMarketSwitchModal(message, marketType, stockNo);
                } else {
                    console.error('[Main] showMarketSwitchModal function not found');
                    showError(message);
                }
            } else if(type==='stockNameInfo'){
                // 處理股票名稱資訊，顯示在UI上
                if (window.showStockName) {
                    window.showStockName(e.data.stockName, e.data.stockNo, e.data.marketType);
                }
            } else if(type==='result'){
                // Handle backtest result
                if(!useCache&&data?.rawData){
                     // workerCachedStockData is defined in worker.js, this might be an issue if not handled correctly
                     // For now, we assume cachedStockData in the main thread is the source of truth if worker needs it.
                     cachedStockData = data.rawData;
                     lastFetchSettings=curSettings;
                     console.log(`[Main] Data cached for ${curSettings.stockNo}.`);
                } else if (useCache && cachedStockData ) {
                     console.log("[Main] Using main thread cached data for worker if needed.");
                } else if(!useCache) {
                     console.warn("[Main] No rawData to cache from backtest.");
                }
                handleBacktestResult(data); // Process and display main results

                // Request suggestion AFTER processing main results
                getSuggestion();

            } else if(type==='suggestionResult'){
                if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showResult === 'function') {
                    window.lazybacktestTodaySuggestion.showResult(data || {});
                }
                hideLoading();
                showSuccess("回測完成！");
                if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            } else if(type==='suggestionError'){
                const message = data?.message || '計算建議時發生錯誤';
                if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
                    window.lazybacktestTodaySuggestion.showError(message);
                }
                hideLoading();
                showError("回測完成，但計算建議時發生錯誤。");
                if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            } else if(type==='error'){
                const message = data?.message || "回測過程錯誤";
                showError(message);
                if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
                hideLoading();
                if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
                    window.lazybacktestTodaySuggestion.showError(message);
                }
            }
        };

        backtestWorker.onerror=e=>{
             const message = `Worker錯誤: ${e.message}`;
             showError(message); console.error("[Main] Worker Error:",e);
             if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
             hideLoading();
             if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
                 window.lazybacktestTodaySuggestion.showError(message);
             }
        };

        const workerMsg={type:'runBacktest', params:params, useCachedData:useCache};
        if(useCache && cachedStockData) {
            workerMsg.cachedData = cachedStockData; // Send main thread cache to worker
            console.log("[Main] Sending cached data to worker for backtest.");
        } else {
            console.log("[Main] Fetching new data for backtest.");
        }
        backtestWorker.postMessage(workerMsg);

    } catch (error) {
        console.error("[Main] Error in runBacktestInternal:", error);
        const message = `執行回測時發生錯誤: ${error.message}`;
        showError(message);
        hideLoading();
        if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
            window.lazybacktestTodaySuggestion.showError(message);
        }
        if(backtestWorker)backtestWorker.terminate(); backtestWorker = null;
    }
}

// **修改：clearPreviousResults - 確保訊息區重置**
function clearPreviousResults() {
    document.getElementById("backtest-result").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("trade-results").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">請執行優化</p>`;
    document.getElementById("performance-table-container").innerHTML=`<p class="text-gray-500">請先執行回測以生成期間績效數據。</p>`;
    if(stockChart){
        stockChart.destroy(); 
        stockChart=null; 
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas><div class="text-muted text-center" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>執行回測後將顯示淨值曲線</p></div>';
            // Re-initialize Lucide icons
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
    const resEl=document.getElementById("result");
    resEl.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md';
    resEl.innerHTML = `<i class="fas fa-info-circle mr-2"></i> 請設定參數並執行。`;
    lastOverallResult = null; lastSubPeriodResults = null;
    
    // 不要在這裡隱藏優化進度，讓優化函數自己控制
    // hideOptimizationProgress();
    
    if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.reset === 'function') {
        window.lazybacktestTodaySuggestion.reset();
    }
}
// --- 結果顯示函數 ---
function displayPerformanceTable(subPeriodResults) { const container = document.getElementById('performance-table-container'); if (!lastOverallResult) { container.innerHTML = `<p class="text-gray-500">請先執行回測以生成績效數據。</p>`; return; } const periods = subPeriodResults ? Object.keys(subPeriodResults) : []; const periodOrder = {'1M': 1, '6M': 2, '1Y': 3, '2Y': 4, '3Y': 5, '4Y': 6, '5Y': 7, '6Y': 8, '7Y': 9, '8Y': 10, '9Y': 11, '10Y': 12}; periods.sort((a, b) => (periodOrder[a] || 99) - (periodOrder[b] || 99)); let tableHtml = ` <div class="overflow-x-auto"> <table class="w-full text-sm text-left text-gray-500"> <thead class="text-xs text-gray-700 uppercase bg-gray-50"> <tr> <th scope="col" class="px-4 py-3">期間</th> <th scope="col" class="px-4 py-3">策略累積報酬 (%)</th> <th scope="col" class="px-4 py-3">買入持有累積報酬 (%)</th> <th scope="col" class="px-4 py-3">夏普值 (策略)</th> <th scope="col" class="px-4 py-3">索提諾比率 (策略)</th> <th scope="col" class="px-4 py-3">最大回撤 (策略 %)</th> </tr> </thead> <tbody>`; periods.forEach(period => { const data = subPeriodResults ? subPeriodResults[period] : null; if (data) { const totalReturn = data.totalReturn?.toFixed(2) ?? 'N/A'; const totalBhReturn = data.totalBuyHoldReturn?.toFixed(2) ?? 'N/A'; const sharpe = data.sharpeRatio?.toFixed(2) ?? 'N/A'; const sortino = data.sortinoRatio ? (isFinite(data.sortinoRatio) ? data.sortinoRatio.toFixed(2) : '∞') : 'N/A'; const maxDD = data.maxDrawdown?.toFixed(2) ?? 'N/A'; const returnClass = (data.totalReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'; const bhReturnClass = (data.totalBuyHoldReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'; tableHtml += ` <tr class="border-b hover:bg-gray-50"> <td class="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">${period}</td> <td class="px-4 py-2 ${returnClass}">${totalReturn === 'N/A' ? totalReturn : totalReturn + '%'}</td> <td class="px-4 py-2 ${bhReturnClass}">${totalBhReturn === 'N/A' ? totalBhReturn : totalBhReturn + '%'}</td> <td class="px-4 py-2">${sharpe}</td> <td class="px-4 py-2">${sortino}</td> <td class="px-4 py-2">${maxDD === 'N/A' ? maxDD : maxDD + '%'}</td> </tr>`; } else { tableHtml += ` <tr class="border-b hover:bg-gray-50"> <td class="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">${period}</td> <td class="px-4 py-2 text-gray-400 italic" colspan="5">數據不足或未計算</td> </tr>`; } }); const overallReturn = lastOverallResult.returnRate?.toFixed(2) ?? 'N/A'; const overallBHReturn = parseFloat(lastOverallResult.buyHoldReturns?.[lastOverallResult.buyHoldReturns.length - 1] ?? 0).toFixed(2) ?? 'N/A'; const overallSharpe = lastOverallResult.sharpeRatio?.toFixed(2) ?? 'N/A'; const overallSortino = lastOverallResult.sortinoRatio ? (isFinite(lastOverallResult.sortinoRatio) ? lastOverallResult.sortinoRatio.toFixed(2) : '∞') : 'N/A'; const overallMaxDD = lastOverallResult.maxDrawdown?.toFixed(2) ?? 'N/A'; const overallReturnClass = (lastOverallResult.returnRate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'; const overallBHReturnClass = (parseFloat(lastOverallResult.buyHoldReturns?.[lastOverallResult.buyHoldReturns.length - 1] ?? 0) >= 0) ? 'text-green-600' : 'text-red-600'; tableHtml += ` <tr class="border-b bg-gray-100 font-semibold hover:bg-gray-200"> <td class="px-4 py-2 text-gray-900 whitespace-nowrap">最後 (總計)</td> <td class="px-4 py-2 ${overallReturnClass}">${overallReturn === 'N/A' ? overallReturn : overallReturn + '%'}</td> <td class="px-4 py-2 ${overallBHReturnClass}">${overallBHReturn === 'N/A' ? overallBHReturn : overallBHReturn + '%'}</td> <td class="px-4 py-2">${overallSharpe}</td> <td class="px-4 py-2">${overallSortino}</td> <td class="px-4 py-2">${overallMaxDD === 'N/A' ? overallMaxDD : overallMaxDD + '%'}</td> </tr>`; tableHtml += `</tbody></table></div>`; container.innerHTML = tableHtml; }
function handleBacktestResult(result) {
    console.log("[Main] handleBacktestResult received:", result);
    if(!result||!result.dates||result.dates.length===0){
        const message = "回測結果無效或無數據";
        showError(message);
        if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
            window.lazybacktestTodaySuggestion.showError(message);
        }
        lastOverallResult = null; lastSubPeriodResults = null;
        hideLoading();
        return;
    }
    try {
        lastOverallResult = result;
        lastSubPeriodResults = result.subPeriodResults;

        displayBacktestResult(result);
        displayTradeResults(result);
        renderChart(result);
        displayPerformanceTable(lastSubPeriodResults);
        activateTab('summary');

        // 回測結束後自動滾動到淨值曲線圖
        setTimeout(() => {
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer) {
                chartContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500); // 等待500ms確保圖表已渲染完成

    } catch (error) {
         console.error("[Main] Error processing backtest result:", error);
         const message = `處理回測結果時發生錯誤: ${error.message}`;
         showError(message);
         if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
             window.lazybacktestTodaySuggestion.showError(message);
         }
         hideLoading();
         if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
    }
}
function displayBacktestResult(result) { 
    console.log("[Main] displayBacktestResult called."); 
    const el = document.getElementById("backtest-result");
    if (!el) {
        console.error("[Main] Element 'backtest-result' not found");
        return;
    }
    
    if (!result) { 
        el.innerHTML = `<p class="text-gray-500">無效結果</p>`; 
        return; 
    } 
    const entryKey = result.entryStrategy; const exitKeyRaw = result.exitStrategy; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(exitKeyRaw)) ? `${exitKeyRaw}_exit` : exitKeyRaw; const entryDesc = strategyDescriptions[entryKey] || { name: result.entryStrategy || 'N/A', desc: 'N/A' }; const exitDesc = strategyDescriptions[exitInternalKey] || { name: result.exitStrategy || 'N/A', desc: 'N/A' }; let shortEntryDesc = null, shortExitDesc = null; if (result.enableShorting && result.shortEntryStrategy && result.shortExitStrategy) { shortEntryDesc = strategyDescriptions[result.shortEntryStrategy] || { name: result.shortEntryStrategy, desc: 'N/A' }; shortExitDesc = strategyDescriptions[result.shortExitStrategy] || { name: result.shortExitStrategy, desc: 'N/A' }; } const avgP = result.completedTrades?.length > 0 ? result.completedTrades.reduce((s, t) => s + (t.profit||0), 0) / result.completedTrades.length : 0; const maxCL = result.maxConsecutiveLosses || 0; const bhR = parseFloat(result.buyHoldReturns?.[result.buyHoldReturns.length - 1] ?? 0); const bhAnnR = result.buyHoldAnnualizedReturn ?? 0; const sharpe = result.sharpeRatio?.toFixed(2) ?? 'N/A'; const sortino = result.sortinoRatio ? (isFinite(result.sortinoRatio) ? result.sortinoRatio.toFixed(2) : '∞') : 'N/A'; const maxDD = result.maxDrawdown?.toFixed(2) ?? 0; const totalTrades = result.tradesCount ?? 0; const winTrades = result.winTrades ?? 0; const winR = totalTrades > 0 ? (winTrades / totalTrades * 100).toFixed(1) : 0; const totalProfit = result.totalProfit ?? 0; const returnRate = result.returnRate ?? 0; const annualizedReturn = result.annualizedReturn ?? 0; const finalValue = result.finalValue ?? result.initialCapital; let annReturnRatioStr = 'N/A'; let sharpeRatioStr = 'N/A'; if (result.annReturnHalf1 !== null && result.annReturnHalf2 !== null && result.annReturnHalf1 !== 0) { annReturnRatioStr = (result.annReturnHalf2 / result.annReturnHalf1).toFixed(2); } if (result.sharpeHalf1 !== null && result.sharpeHalf2 !== null && result.sharpeHalf1 !== 0) { sharpeRatioStr = (result.sharpeHalf2 / result.sharpeHalf1).toFixed(2); } const overfittingTooltip = "將回測期間前後對半分，計算兩段各自的總報酬率與夏普值，再計算其比值 (後段/前段)。比值接近 1 較佳，代表策略績效在不同時期較穩定。一般認為 > 0.5 可接受。"; let performanceHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">績效指標</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">年化報酬率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">將總報酬率根據實際回測期間（從第一個有效數據點到最後一個數據點）轉換為年平均複利報酬率。<br>公式：((最終價值 / 初始本金)^(1 / 年數) - 1) * 100%<br>注意：此數值對回測時間長度敏感，短期高報酬可能導致極高的年化報酬率。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${annualizedReturn>=0?'text-emerald-600':'text-rose-600'}">${annualizedReturn>=0?'+':''}${annualizedReturn.toFixed(2)}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">買入持有年化</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">在相同實際回測期間內，單純買入並持有該股票的年化報酬率。公式同上，但使用股價計算。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${bhAnnR>=0?'text-emerald-600':'text-rose-600'}">${bhAnnR>=0?'+':''}${bhAnnR.toFixed(2)}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">總報酬率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">策略最終總資產相對於初始本金的報酬率。<br>公式：(最終價值 - 初始本金) / 初始本金 * 100%<br>此為線性報酬率，不考慮時間因素。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${returnRate>=0?'text-emerald-600':'text-rose-600'}">${returnRate>=0?'+':''}${returnRate.toFixed(2)}%</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">Buy & Hold</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">買入持有總報酬率</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${bhR>=0?'text-emerald-600':'text-rose-600'}">${bhR>=0?'+':''}${bhR.toFixed(2)}%</p>
                    </div>
                </div>
            </div>
        </div>`;
    let riskHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">風險指標</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--background)) 0%, color-mix(in srgb, #ef4444 4%, var(--background)) 100%); border-color: color-mix(in srgb, #ef4444 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-rose-600">最大回撤</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">策略**總資金**曲線從歷史最高點回落到最低點的最大百分比跌幅。公式：(峰值 - 谷值) / 峰值 * 100%</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold text-rose-600">${maxDD}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">夏普值</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">衡量每單位總風險(標準差)所獲得的超額報酬。通常 > 1 表示不錯，> 2 相當好，> 3 非常優秀 (相對於無風險利率)。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--primary);">${sharpe}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background:  color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">索提諾比率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">衡量每單位 '下檔風險' 所獲得的超額報酬 (只考慮虧損的波動)。越高越好，通常用於比較不同策略承受虧損風險的能力。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--muted-foreground);">${sortino}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">過擬合(報酬率比)</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${overfittingTooltip}</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--accent);">${annReturnRatioStr}</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--secondary) 6%, var(--background)); border-color: color-mix(in srgb, var(--secondary) 20%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--secondary);">過擬合(夏普值比)</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${overfittingTooltip}</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--secondary);">${sharpeRatioStr}</p>
                    </div>
                </div>
            </div>
        </div>`;
    let tradeStatsHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">交易統計</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">勝率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">包含做多與做空交易</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${winR}%</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">(${winTrades}/${totalTrades})</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">總交易次數</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">包含做多與做空交易</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${totalTrades}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">次</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">平均交易盈虧</p>
                        <p class="text-2xl font-bold ${avgP>=0?'text-emerald-600':'text-rose-600'}">${avgP>=0?'+':''}${Math.round(avgP).toLocaleString()}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">元</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">最大連虧次數</p>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${maxCL}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">次</p>
                    </div>
                </div>
            </div>
        </div>`;
    let strategySettingsHtml = `
        <div>
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">策略設定</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">📈 進場策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${entryDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${entryDesc.name}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--background)) 0%, color-mix(in srgb, #ef4444 4%, var(--background)) 100%); border-color: color-mix(in srgb, #ef4444 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-rose-600">📉 出場策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${exitDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${exitDesc.name}</p>
                    </div>
                </div> ${ result.enableShorting && shortEntryDesc && shortExitDesc ? `                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">📉 做空策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${shortEntryDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${shortEntryDesc.name}</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">📈 回補策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${shortExitDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${shortExitDesc.name}</p>
                    </div>
                </div>` : `                <div class="p-6 rounded-xl border shadow-sm" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium" style="color: var(--muted-foreground);">📉 做空策略未啟用</p>
                    </div>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-gray-500 font-medium">📈 回補策略未啟用</p>
                    </div>
                </div> `}                <div class="bg-orange-50 p-6 rounded-xl border border-orange-200 shadow-sm">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm text-orange-600 font-medium">⚠️ 全局風控</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs bg-blue-600 text-white rounded-full cursor-help">?</span>
                                <span class="tooltiptext">停損/停利設定 (多空共用)</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold text-gray-800">損:${result.stopLoss>0?result.stopLoss+'%':'N/A'} / 利:${result.takeProfit>0?result.takeProfit+'%':'N/A'}</p>
                    </div>
                </div>
                <div class="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-indigo-600 font-medium mb-3">⏰ 買賣時間點</p>
                        <p class="text-base font-semibold text-gray-800">${result.tradeTiming==='open'?'隔日開盤':'當日收盤'}</p>
                    </div>
                </div>
                <div class="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-blue-600 font-medium mb-3">💰 初始本金</p>
                        <p class="text-base font-semibold text-gray-800">${result.initialCapital.toLocaleString()}元</p>
                    </div>
                </div>
                <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-yellow-600 font-medium mb-3">🏆 最終資產</p>
                        <p class="text-base font-semibold text-gray-800">${Math.round(finalValue).toLocaleString()}元</p>
                    </div>
                </div> </div> </div>`;

        // 將四個區塊垂直排列，並添加適當的間距
        el.innerHTML = `
            <div class="space-y-8">
                ${performanceHtml}
                ${riskHtml}
                ${tradeStatsHtml}
                ${strategySettingsHtml}
            </div>
        `;
        
        console.log("[Main] displayBacktestResult finished."); 
    }
const checkDisplay = (v) => v !== null && v !== undefined && !isNaN(v); 

const formatIndicatorValues = (indicatorValues) => { 
    try { 
        if (!indicatorValues || typeof indicatorValues !== 'object' || Object.keys(indicatorValues).length === 0) return ''; 
        const formatV = (v) => checkDisplay(v) ? v.toFixed(2) : '--'; 
        const parts = Object.entries(indicatorValues).map(([label, values]) => { 
            if (Array.isArray(values) && values.length === 3) { 
                return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ${formatV(values[0])} / ${formatV(values[1])} / ${formatV(values[2])}</span>`; 
            } else if (checkDisplay(values)) { 
                return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ${formatV(values)}</span>`; 
            } else if (Array.isArray(values) && values.length === 2){ 
                return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ${formatV(values[0])} / ${formatV(values[1])}</span>`; 
            } 
            return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ?</span>`; 
        }).filter(part => part !== null); 
        return parts.length > 0 ? '<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(' + parts.join(' ') + ')</div>' : ''; 
    } catch (e) { 
        console.error("[Main] Error in formatIndicatorValues:", e, indicatorValues); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(指標值格式錯誤)</div>'; 
    } 
}; 

const formatKDParams = (kdVals) => { 
    try { 
        if (!kdVals || typeof kdVals !== 'object') { 
            console.warn("[Main] Invalid kdValues passed to formatKDParams:", kdVals); 
            return ''; 
        } 
        const formatV = (v) => checkDisplay(v) ? v.toFixed(2) : '--'; 
        const kPrev = kdVals?.kPrev; 
        const dPrev = kdVals?.dPrev; 
        const kNow = kdVals?.kNow; 
        const dNow = kdVals?.dNow; 
        const kNext = kdVals?.kNext; 
        const dNext = kdVals?.dNext; 
        return `<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(K/D 前:${formatV(kPrev)}/${formatV(dPrev)}, 當:${formatV(kNow)}/${formatV(dNow)}, 次:${formatV(kNext)}/${formatV(dNext)})</div>`; 
    } catch (e) { 
        console.error("[Main] Error in formatKDParams:", e, kdVals); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(KD值格式錯誤)</div>'; 
    } 
}; 

const formatMACDParams = (macdValues) => { 
    try { 
        if (!macdValues || typeof macdValues !== 'object') { 
            console.warn("[Main] Invalid macdValues passed to formatMACDParams:", macdValues); 
            return ''; 
        } 
        const formatV = (v) => checkDisplay(v) ? v.toFixed(2) : '--'; 
        const difPrev = macdValues?.difPrev; 
        const deaPrev = macdValues?.deaPrev; 
        const difNow = macdValues?.difNow; 
        const deaNow = macdValues?.deaNow; 
        const difNext = macdValues?.difNext; 
        const deaNext = macdValues?.deaNext; 
        return `<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(DIF/DEA 前:${formatV(difPrev)}/${formatV(deaPrev)}, 當:${formatV(difNow)}/${formatV(deaNow)}, 次:${formatV(difNext)}/${formatV(deaNext)})</div>`; 
    } catch (e) { 
        console.error("[Main] Error in formatMACDParams:", e, macdValues); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(MACD值格式錯誤)</div>'; 
    } 
};
function displayTradeResults(result) { 
    console.log("[Main] displayTradeResults called"); 
    const tradeResultsEl = document.getElementById("trade-results");
    
    if (!tradeResultsEl) {
        console.error("[Main] Element 'trade-results' not found");
        return;
    }
    
    const tradeTiming = result?.tradeTiming;
    
    // 提示區域已被移除，無需更新
    
    // 檢查數據有效性
    if (!result || !result.completedTrades || !Array.isArray(result.completedTrades)) { 
        tradeResultsEl.innerHTML = `<p class="text-xs text-muted-foreground text-center py-8" style="color: var(--muted-foreground);">交易記錄數據無效或缺失</p>`; 
        console.error("[Main] Invalid completedTrades data:", result); 
        return; 
    }
    
    // 沒有交易記錄
    if (result.completedTrades.length === 0) { 
        tradeResultsEl.innerHTML = `<p class="text-xs text-muted-foreground text-center py-8" style="color: var(--muted-foreground);">沒有交易記錄</p>`; 
        return; 
    }
    
    try { 
        let tradeHtml = result.completedTrades.map((tradePair, index) => { 
            if (!tradePair || !tradePair.entry || !tradePair.exit || !tradePair.entry.type || !tradePair.exit.type) { 
                console.warn(`[Main] Invalid trade pair structure at index ${index}:`, tradePair); 
                return `<div class="trade-signal p-3 border-b last:border-b-0" style="border-color: var(--border);"><p class="text-xs text-red-600">錯誤：此筆交易對數據結構不完整 (Index: ${index})</p></div>`; 
            }
            
            try { 
                const entryTrade = tradePair.entry; 
                const exitTrade = tradePair.exit; 
                const profit = tradePair.profit; 
                const profitPercent = tradePair.profitPercent; 
                const isShortTrade = entryTrade.type === 'short'; 
                
                let entryParamsDisplay = ''; 
                try { 
                    if (entryTrade?.kdValues) entryParamsDisplay = formatKDParams(entryTrade.kdValues); 
                    else if (entryTrade?.macdValues) entryParamsDisplay = formatMACDParams(entryTrade.macdValues); 
                    else if (entryTrade?.indicatorValues) entryParamsDisplay = formatIndicatorValues(entryTrade.indicatorValues); 
                } catch (entryFormatError) { 
                    console.error(`[Main] Error formatting entry display for trade index ${index}:`, entryFormatError, entryTrade); 
                    entryParamsDisplay = '<span class="block text-xs text-red-500 mt-1">(進場信息格式錯誤)</span>'; 
                }
                
                let exitParamsDisplay = ''; 
                const sl = exitTrade?.triggeredByStopLoss || false; 
                const tp = exitTrade?.triggeredByTakeProfit || false; 
                let trigger = ''; 
                if(sl) trigger='<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded" style="background-color: #fee2e2; color: #dc2626;">🛑停損</span>'; 
                else if(tp) trigger='<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded" style="background-color: #dcfce7; color: #16a34a;">✅停利</span>'; 
                
                try { 
                    if (exitTrade?.kdValues) exitParamsDisplay = formatKDParams(exitTrade.kdValues); 
                    else if (exitTrade?.macdValues) exitParamsDisplay = formatMACDParams(exitTrade.macdValues); 
                    else if (exitTrade?.indicatorValues) exitParamsDisplay = formatIndicatorValues(exitTrade.indicatorValues); 
                } catch (exitFormatError) { 
                    console.error(`[Main] Error formatting exit display for trade index ${index}:`, exitFormatError, exitTrade); 
                    exitParamsDisplay = '<span class="block text-xs text-red-500 mt-1">(出場信息格式錯誤)</span>'; 
                }
                
                const entryDate = entryTrade.date || 'N/A'; 
                const entryPrice = typeof entryTrade.price === 'number' ? entryTrade.price.toFixed(2) : 'N/A'; 
                const entryShares = entryTrade.shares || 'N/A'; 
                const entryActionText = isShortTrade ? '做空' : '買入'; 
                const entryActionClass = isShortTrade ? 'short-signal' : 'buy-signal'; 
                const entryActionStyle = isShortTrade ? 'background-color: #fef3c7; color: #d97706;' : 'background-color: #fee2e2; color: #dc2626;';
                
                const exitDate = exitTrade.date || 'N/A'; 
                const exitPrice = typeof exitTrade.price === 'number' ? exitTrade.price.toFixed(2) : 'N/A'; 
                const exitActionText = isShortTrade ? '回補' : '賣出'; 
                const exitActionClass = isShortTrade ? 'cover-signal' : 'sell-signal'; 
                const exitActionStyle = isShortTrade ? 'background-color: #e0e7ff; color: #7c3aed;' : 'background-color: #dcfce7; color: #16a34a;';
                
                const profitValue = typeof profit === 'number' ? Math.round(profit) : 'N/A'; 
                const profitColor = typeof profit === 'number' ? (profit >= 0 ? '#16a34a' : '#dc2626') : 'var(--foreground)'; 
                const profitSign = typeof profit === 'number' ? (profit >= 0 ? '+' : '') : ''; 
                
                return `
                    <div class="trade-signal py-3 px-4 border-b last:border-b-0 hover:bg-opacity-50 transition duration-150" 
                         style="border-color: var(--border); background-color: var(--background);"
                         onmouseover="this.style.backgroundColor='var(--muted)'" 
                         onmouseout="this.style.backgroundColor='var(--background)'">
                        
                        <div class="mb-2">
                            <div class="flex justify-between items-center flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs" style="color: var(--muted-foreground);">${entryDate}</span>
                                    <span class="trade-action text-xs font-medium px-2 py-1 rounded ${entryActionClass}" style="${entryActionStyle}">${entryActionText}</span>
                                    <span class="text-sm font-semibold" style="color: var(--foreground);">${entryPrice}</span>
                                    <span class="text-xs" style="color: var(--muted-foreground);">${entryShares} 股</span>
                                </div>
                            </div>
                            ${entryParamsDisplay}
                        </div>
                        
                        <div>
                            <div class="flex justify-between items-center flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs" style="color: var(--muted-foreground);">${exitDate}</span>
                                    <span class="trade-action text-xs font-medium px-2 py-1 rounded ${exitActionClass}" style="${exitActionStyle}">${exitActionText}</span>
                                    <span class="text-sm font-semibold" style="color: var(--foreground);">${exitPrice}</span>
                                </div>
                                <div class="flex items-center">
                                    <span class="text-sm font-bold" style="color: ${profitColor};">${profitSign}${profitValue}元</span>
                                    ${trigger}
                                </div>
                            </div>
                            ${exitParamsDisplay}
                        </div>
                    </div>
                `; 
            } catch (mapError) { 
                console.error(`[Main] Error formatting trade pair at index ${index}:`, mapError); 
                console.error("[Main] Problematic trade pair object:", tradePair); 
                return `<div class="trade-signal p-3 border-b" style="border-color: var(--border);"><p class="text-xs text-red-600">錯誤：格式化此筆交易對時出錯 (Index: ${index})</p></div>`; 
            } 
        }).join(''); 
        
        tradeResultsEl.innerHTML = `<div class="trade-list rounded-md max-h-80 overflow-y-auto" style="border: 1px solid var(--border);">${tradeHtml}</div>`; 
    } catch (error) { 
        console.error("[Main] Error rendering trade results list:", error); 
        tradeResultsEl.innerHTML = `<p class="text-xs text-red-600 text-center py-8">顯示交易記錄列表時發生錯誤。</p>`; 
        showError("顯示交易記錄時出錯，請檢查控制台。"); 
    } 
}
function renderChart(result) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        console.error("[Main] Chart container not found");
        return;
    }
    
    if (!result || !result.dates || result.dates.length === 0) {
        chartContainer.innerHTML = `<div class="text-center text-muted py-8" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>無法渲染圖表：數據不足。</p></div>`;
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        return;
    }
    
    // Clear the container and add canvas
    chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas>';
    const chartElement = document.getElementById('chart');
    if (!chartElement) {
        console.error("[Main] Failed to create chart canvas element");
        return;
    }
    const ctx = chartElement.getContext('2d');
    
    if (stockChart) {
        stockChart.destroy();
        stockChart = null;
    }
    
    const dates = result.dates;
    const check = (v) => v !== null && !isNaN(v) && isFinite(v);
    const validReturns = result.strategyReturns.map((v, i) => ({ index: i, value: check(v) ? parseFloat(v) : null })).filter(item => item.value !== null);
    
    if (validReturns.length === 0) {
        console.warn("[Main] No valid strategy return data points to render chart.");
        return;
    }
    
    const firstValidReturnIndex = validReturns[0].index;
    const lastValidReturnIndex = validReturns[validReturns.length - 1].index;
    
    const filterSignals = (signals) => {
        return (signals || []).filter(s => s.index >= firstValidReturnIndex && s.index <= lastValidReturnIndex && check(result.strategyReturns[s.index])).map(s => ({ x: dates[s.index], y: result.strategyReturns[s.index] }));
    };
    
    const buySigs = filterSignals(result.chartBuySignals);
    const sellSigs = filterSignals(result.chartSellSignals);
    const shortSigs = filterSignals(result.chartShortSignals);
    const coverSigs = filterSignals(result.chartCoverSignals);
    const stratData = result.strategyReturns.map(v => check(v) ? parseFloat(v) : null);
    const bhData = result.buyHoldReturns.map(v => check(v) ? parseFloat(v) : null);
    
    const datasets = [
        { label: '買入並持有 %', data: bhData, borderColor: '#6b7280', borderWidth: 1.5, tension: 0.1, pointRadius: 0, yAxisID: 'y', spanGaps: true },
        { label: '策略 %', data: stratData, borderColor: '#3b82f6', borderWidth: 2, tension: 0.1, pointRadius: 0, yAxisID: 'y', spanGaps: true }
    ];
    
    if (buySigs.length > 0) {
        datasets.push({ type:'scatter', label:'買入', data:buySigs, backgroundColor:'#ef4444', radius:6, pointStyle:'triangle', rotation:0, yAxisID:'y' });
    }
    if (sellSigs.length > 0) {
        datasets.push({ type:'scatter', label:'賣出', data:sellSigs, backgroundColor:'#22c55e', radius:6, pointStyle:'triangle', rotation:180, yAxisID:'y' });
    }
    if (result.enableShorting) {
        if (shortSigs.length > 0) {
            datasets.push({ type:'scatter', label:'做空', data:shortSigs, backgroundColor:'#f59e0b', radius:7, pointStyle:'rectRot', yAxisID:'y' });
        }
        if (coverSigs.length > 0) {
            datasets.push({ type:'scatter', label:'回補', data:coverSigs, backgroundColor:'#8b5cf6', radius:7, pointStyle:'rect', yAxisID:'y' });
        }
    }
    
    // 確保插件已註冊
    console.log('Creating chart with plugins:', Chart.registry.plugins.items);
    
    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'grab';
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '收益率 (%)'
                    },
                    ticks: {
                        callback: v => v + '%'
                    },
                    grid: {
                        color: '#e5e7eb'
                    }
                },
                x: {
                    type: 'category',
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 15,
                        maxRotation: 40,
                        minRotation: 0
                    }
                }
            }
        }
    });
    
    // 自定義拖曳事件處理，支援左鍵和右鍵
    const canvas = stockChart.canvas;
    let isPanning = false;
    let lastX = 0;
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) { // 左鍵或右鍵
            isPanning = true;
            lastX = e.clientX;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const deltaX = e.clientX - lastX;
            const scale = stockChart.scales.x;
            const canvasPosition = Chart.helpers.getRelativePosition(e, stockChart);
            const dataX = scale.getValueForPixel(canvasPosition.x);
            
            // 計算平移量
            const range = scale.max - scale.min;
            const panAmount = (deltaX / canvas.width) * range;
            
            // 更新縮放
            stockChart.zoomScale('x', {min: scale.min - panAmount, max: scale.max - panAmount}, 'none');
            
            lastX = e.clientX;
            e.preventDefault();
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        isPanning = false;
        canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('mouseleave', (e) => {
        isPanning = false;
        canvas.style.cursor = 'default';
    });
    
    // 禁用右鍵選單
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}
// 優化專用進度顯示函數
function showOptimizationProgress(message) {
    console.log('[Main] showOptimizationProgress 被調用:', message);
    const progressSection = document.getElementById('optimization-progress-section');
    const statusText = document.getElementById('optimization-status-text');
    const progressBar = document.getElementById('optimization-progress-bar');
    const progressText = document.getElementById('optimization-progress-text');
    
    console.log('[Main] 進度元素檢查:', {
        progressSection: !!progressSection,
        statusText: !!statusText,
        progressBar: !!progressBar,
        progressText: !!progressText
    });
    
    if (progressSection && statusText) {
        progressSection.classList.remove('hidden');
        statusText.textContent = message || '⌛ 優化進行中...';
        
        // 重置進度條
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        
        console.log('[Main] 顯示優化進度:', message);
        console.log('[Main] 進度區域 class list:', progressSection.classList.toString());
    } else {
        console.error('[Main] 無法找到優化進度顯示元素!');
    }
}

function updateOptimizationProgress(progress, message) {
    const progressBar = document.getElementById('optimization-progress-bar');
    const progressText = document.getElementById('optimization-progress-text');
    const statusText = document.getElementById('optimization-status-text');
    
    const safeProgress = Math.max(0, Math.min(100, progress || 0));
    
    if (progressBar) {
        progressBar.style.width = `${safeProgress}%`;
    }
    if (progressText) {
        progressText.textContent = `${Math.round(safeProgress)}%`;
    }
    if (statusText && message) {
        statusText.textContent = message;
    }
    
    console.log(`[Main] 更新優化進度: ${safeProgress}%`, message);
}

function hideOptimizationProgress() {
    console.log('[Main] hideOptimizationProgress 被調用');
    const progressSection = document.getElementById('optimization-progress-section');
    if (progressSection) {
        progressSection.classList.add('hidden');
        console.log('[Main] 隱藏優化進度顯示');
        console.log('[Main] 進度區域 class list:', progressSection.classList.toString());
    } else {
        console.error('[Main] 找不到 optimization-progress-section 元素');
    }
}

function runOptimizationInternal(optimizeType) { 
    if (!workerUrl) { 
        showError("背景計算引擎尚未準備就緒，請稍候再試或重新載入頁面。"); 
        return; 
    } 
    
    console.log(`[Main] runOptimizationInternal called for ${optimizeType}`); 
    
    // 立即切換到優化頁面
    activateTab('optimization');
    console.log('[Main] 已切換到優化頁面');
    
    // 儲存優化前的結果用於對比顯示（包含索提諾比率與交易次數）
    if (lastOverallResult) {
        preOptimizationResult = {
            annualizedReturn: lastOverallResult.annualizedReturn,
            maxDrawdown: lastOverallResult.maxDrawdown,
            winRate: lastOverallResult.winRate,
            sharpeRatio: lastOverallResult.sharpeRatio,
            sortinoRatio: lastOverallResult.sortinoRatio,
            totalTrades: lastOverallResult.totalTrades ?? lastOverallResult.tradesCount ?? lastOverallResult.tradeCount ?? null
        };
        console.log('[Main] 已儲存優化前結果用於對比:', preOptimizationResult);
    } else {
        preOptimizationResult = null;
        console.log('[Main] 無可用的優化前結果');
    }
    
    // 顯示初始準備狀態
    showOptimizationProgress('⌛ 正在驗證參數...');
    
    const params=getBacktestParams(); 
    let targetStratKey, paramSelectId, selectedParamName, optLabel, optRange, msgAction, configKey, config; 
    const isShortOpt = optimizeType === 'shortEntry' || optimizeType === 'shortExit'; 
    const isRiskOpt = optimizeType === 'risk'; 
    
    if (isShortOpt && !params.enableShorting) { 
        hideOptimizationProgress();
        showError("請先啟用做空策略才能進行做空相關優化。"); 
        return; 
    } 
    
    if (!validateBacktestParams(params)) {
        hideOptimizationProgress();
        return;
    }
    
    const msgActionMap = {'entry': '多單進場', 'exit': '多單出場', 'shortEntry': '做空進場', 'shortExit': '回補出場', 'risk': '風險控制'}; 
    msgAction = msgActionMap[optimizeType] || '未知'; 
    
    if (isRiskOpt) { 
        paramSelectId = 'optimizeRiskParamSelect'; 
        selectedParamName = document.getElementById(paramSelectId)?.value; 
        config = globalOptimizeTargets[selectedParamName]; 
        if (!config) { 
            hideOptimizationProgress();
            showError(`找不到風險參數 ${selectedParamName} 的優化配置。`); 
            return; 
        } 
        msgAction = config.label; 
    } else { 
        if (optimizeType === 'entry') { 
            targetStratKey = params.entryStrategy; 
            paramSelectId = 'optimizeEntryParamSelect'; 
            configKey = targetStratKey; 
        } else if (optimizeType === 'exit') { 
            targetStratKey = params.exitStrategy; 
            paramSelectId = 'optimizeExitParamSelect'; 
            configKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(targetStratKey)) ? `${targetStratKey}_exit` : targetStratKey; 
        } else if (optimizeType === 'shortEntry') { 
            targetStratKey = params.shortEntryStrategy; 
            paramSelectId = 'optimizeShortEntryParamSelect'; 
            configKey = targetStratKey; 
            params.enableShorting = true; 
        } else if (optimizeType === 'shortExit') { 
            targetStratKey = params.shortExitStrategy; 
            paramSelectId = 'optimizeShortExitParamSelect'; 
            configKey = targetStratKey; 
            params.enableShorting = true; 
        } else { 
            hideOptimizationProgress();
            showError("未知的優化類型。"); 
            return; 
        } 
        
        selectedParamName = document.getElementById(paramSelectId)?.value; 
        if (!selectedParamName || selectedParamName === 'null') { 
            hideOptimizationProgress();
            showError(`請為 ${msgAction} 策略選擇有效參數進行優化。`); 
            return; 
        } 
        
        config = strategyDescriptions[configKey]; 
        const optTarget = config?.optimizeTargets?.find(t => t.name === selectedParamName); 
        if (!optTarget) { 
            hideOptimizationProgress();
            showError(`找不到參數 "${selectedParamName}" (${configKey}) 的優化配置。`); 
            console.error(`Optimization config not found for key: ${configKey}, param: ${selectedParamName}`); 
            return; 
        } 
        config = optTarget; 
    } 
    
    optLabel = config.label; 
    optRange = config.range; 
    console.log(`[Main] Optimizing ${optimizeType}: Param=${selectedParamName}, Label=${optLabel}, Range:`, optRange); 
    
    const curSettings={stockNo:params.stockNo, startDate:params.startDate, endDate:params.endDate}; 
    const useCache=!needsDataFetch(curSettings); 
    const msg=`⌛ 開始優化 ${msgAction} (${optLabel}) (${useCache?'使用快取':'載入新數據'})...`; 
    
    // 先清除之前的結果，但不隱藏優化進度
    clearPreviousResults(); 
    console.log('[Main] 已清除之前的結果');
    
    // 然後更新進度顯示為實際的優化信息
    showOptimizationProgress(msg);
    console.log('[Main] 已更新進度顯示為:', msg);
    
    // 禁用優化按鈕，防止重複點擊
    const optimizeButtons = ['optimizeEntryBtn', 'optimizeExitBtn', 'optimizeShortEntryBtn', 'optimizeShortExitBtn', 'optimizeRiskBtn'];
    optimizeButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.disabled = true;
    }); 
    
    if(optimizationWorker) optimizationWorker.terminate(); 
    console.log("[Main] Creating opt worker..."); 
    
    try { 
        optimizationWorker=new Worker(workerUrl); 
        const workerMsg={ 
            type:'runOptimization', 
            params, 
            optimizeTargetStrategy: optimizeType, 
            optimizeParamName:selectedParamName, 
            optimizeRange:optRange, 
            useCachedData:useCache 
        }; 
        
        if(useCache && cachedStockData) workerMsg.cachedData=cachedStockData; 
        else console.log(`[Main] Fetching data for ${optimizeType} opt.`); 
        
        optimizationWorker.postMessage(workerMsg); 
        
        optimizationWorker.onmessage=e=>{ 
            const{type,data,progress,message}=e.data; 
            
            if(type==='progress'){
                // 使用優化專用的進度更新
                updateOptimizationProgress(progress, message);
            } else if(type==='result'){ 
                if(!useCache&&data?.rawDataUsed){
                    cachedStockData=data.rawDataUsed; 
                    lastFetchSettings=curSettings; 
                    console.log(`[Main] Data cached after ${optimizeType} opt.`);
                } else if(!useCache&&data&&!data.rawDataUsed) {
                    console.warn("[Main] Opt worker no rawData returned.");
                }
                
                document.getElementById('optimization-title').textContent=`${msgAction}優化 (${optLabel})`; 
                handleOptimizationResult(data.results || data, selectedParamName, optLabel); 
                
                if(optimizationWorker) optimizationWorker.terminate(); 
                optimizationWorker=null; 
                
                hideOptimizationProgress();
                
                // 重新啟用優化按鈕
                optimizeButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.disabled = false;
                });
                
                showSuccess("優化完成！");  
            } else if(type==='error'){ 
                showError(data?.message||"優化過程出錯"); 
                if(optimizationWorker) optimizationWorker.terminate(); 
                optimizationWorker=null; 
                
                hideOptimizationProgress();
                
                // 重新啟用優化按鈕
                optimizeButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.disabled = false;
                });
            } 
        }; 
        
        optimizationWorker.onerror=e=>{
            showError(`Worker錯誤: ${e.message}`); 
            console.error("[Main] Opt Worker Error:",e); 
            optimizationWorker=null; 
            hideOptimizationProgress();
            
            // 重新啟用優化按鈕
            optimizeButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) btn.disabled = false;
            });
        }; 
    } catch (workerError) { 
        console.error("[Main] Opt Worker init error:", workerError); 
        showError(`啟動優化引擎失敗: ${workerError.message}`); 
        hideOptimizationProgress(); 
        
        // 重新啟用優化按鈕
        optimizeButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.disabled = false;
        });
    } 
}
function handleOptimizationResult(results, optName, optLabel) { 
    currentOptimizationResults=[]; 
    if(!results||!Array.isArray(results)||results.length===0){
        document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">無有效優化結果</p>`;
        return;
    } 
    const validRes=results.filter(r=>r&&typeof r.annualizedReturn==='number'&&isFinite(r.annualizedReturn)&&typeof r.maxDrawdown==='number'); 
    if(validRes.length===0){
        document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">優化完成，但無有效結果</p>`;
        return;
    } 
    currentOptimizationResults=validRes; 
    sortState={key:'annualizedReturn',direction:'desc'}; 
    renderOptimizationTable(optName, optLabel); 
    addSortListeners(); 
}
function renderOptimizationTable(optName, optLabel) {
    const results = currentOptimizationResults;
    if (!results || results.length === 0) return;
    
    let bestRes = results[0];
    results.forEach(r => {
        if (r.annualizedReturn > bestRes.annualizedReturn) {
            bestRes = r;
        } else if (r.annualizedReturn === bestRes.annualizedReturn) {
            if (r.maxDrawdown < bestRes.maxDrawdown) {
                bestRes = r;
            } else if (r.maxDrawdown === bestRes.maxDrawdown) {
                const rS = isFinite(r.sortinoRatio) ? r.sortinoRatio : -Infinity;
                const bS = isFinite(bestRes.sortinoRatio) ? bestRes.sortinoRatio : -Infinity;
                if (rS > bS) bestRes = r;
            }
        }
    });
    
    const el = document.getElementById("optimization-results");
    const pLabel = optLabel || optName;
    
    let tableHtml = `<div class="overflow-x-auto">
        <table class="optimization-table w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="paramValue">${pLabel} 值</th>
                    <th scope="col" class="px-4 py-3 sortable-header sort-desc" data-sort-key="annualizedReturn">年化報酬</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="returnRate">總報酬</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="maxDrawdown">最大回撤</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="winRate">勝率</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="sharpeRatio">夏普值</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="sortinoRatio">索提諾值</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="tradesCount">交易次數</th>
                </tr>
            </thead>
            <tbody>`;
    
    tableHtml += results.map(r => {
        const isBest = r === bestRes;
        const annCls = (r.annualizedReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
        const totCls = (r.returnRate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
        return `<tr class="border-b hover:bg-gray-50 ${isBest ? 'bg-green-50 font-semibold' : ''}">
            <td class="px-4 py-2">${r.paramValue}</td>
            <td class="px-4 py-2 ${annCls}">${r.annualizedReturn.toFixed(2)}%</td>
            <td class="px-4 py-2 ${totCls}">${r.returnRate.toFixed(2)}%</td>
            <td class="px-4 py-2">${r.maxDrawdown.toFixed(2)}%</td>
            <td class="px-4 py-2">${r.winRate.toFixed(1)}%</td>
            <td class="px-4 py-2">${r.sharpeRatio?.toFixed(2) ?? 'N/A'}</td>
            <td class="px-4 py-2">${r.sortinoRatio ? (isFinite(r.sortinoRatio) ? r.sortinoRatio.toFixed(2) : '∞') : 'N/A'}</td>
            <td class="px-4 py-2">${r.tradesCount}</td>
        </tr>`;
    }).join('');
    
    tableHtml += `</tbody></table></div>`;
    
    // 構建摘要HTML，顯示優化前的數據進行對比
    let summaryHtml = `<div class="mt-4 p-3 bg-gray-100 rounded-md text-sm">
        <h4 class="font-semibold">最佳參數組合: ${pLabel} = ${bestRes.paramValue}</h4>`;
    
    // 顯示優化前策略表現：優先使用 preOptimizationResult（在啟動優化時保存），若無則回退到 lastOverallResult
    const before = preOptimizationResult || lastOverallResult;
    if (before && before.annualizedReturn !== null && before.annualizedReturn !== undefined) {
        summaryHtml += `<div class="mt-2">
            <p class="text-gray-700 font-medium">優化前策略表現：</p>
            <p class="text-gray-600">
                年化報酬率: ${before.annualizedReturn?.toFixed(2) ?? 'N/A'}%, 
                最大回撤: ${before.maxDrawdown?.toFixed(2) ?? 'N/A'}%, 
                勝率: ${before.winRate?.toFixed(1) ?? 'N/A'}%, 
                夏普值: ${before.sharpeRatio?.toFixed(2) ?? 'N/A'}, 
                索提諾值: ${before.sortinoRatio?.toFixed(2) ?? 'N/A'}, 
                交易次數: ${before.totalTrades ?? before.tradesCount ?? before.tradeCount ?? 'N/A'}
            </p>
        </div>`;
    }
    
    // 已移除「優化後最佳表現」顯示，僅保留優化前策略表現供比對
    
    summaryHtml += `<p class="mt-1 text-xs text-gray-500">提示：點擊表格標頭可排序。將最佳參數手動更新到上方對應欄位，再執行回測。</p></div>`;
    
    el.innerHTML = summaryHtml + tableHtml;
}
function addSortListeners() { const table=document.querySelector("#optimization-results .optimization-table"); if(!table)return; const headers=table.querySelectorAll("th.sortable-header"); headers.forEach(header=>{ header.onclick=()=>{ const sortKey=header.dataset.sortKey; if(!sortKey)return; if(sortState.key===sortKey)sortState.direction=sortState.direction==='asc'?'desc':'asc'; else {sortState.key=sortKey; sortState.direction='desc';} sortTable();}; }); }
function sortTable() { const{key,direction}=sortState; if(!currentOptimizationResults||currentOptimizationResults.length===0)return; currentOptimizationResults.sort((a,b)=>{ let vA=a[key]; let vB=b[key]; if(key==='sortinoRatio'){vA=isFinite(vA)?vA:(direction==='asc'?Infinity:-Infinity); vB=isFinite(vB)?vB:(direction==='asc'?Infinity:-Infinity);} vA=(vA===null||vA===undefined||isNaN(vA))?(direction==='asc'?Infinity:-Infinity):vA; vB=(vB===null||vB===undefined||isNaN(vB))?(direction==='asc'?Infinity:-Infinity):vB; if(vA<vB)return direction==='asc'?-1:1; if(vA>vB)return direction==='asc'?1:-1; return 0; }); const optTitle=document.getElementById('optimization-title').textContent; let optLabel='參數值'; const match=optTitle.match(/\((.+)\)/); if(match&&match[1])optLabel=match[1]; renderOptimizationTable(sortState.key, optLabel); const headers=document.querySelectorAll("#optimization-results th.sortable-header"); headers.forEach(h=>{h.classList.remove('sort-asc','sort-desc'); if(h.dataset.sortKey===key)h.classList.add(direction==='asc'?'sort-asc':'sort-desc');}); addSortListeners(); }
function updateStrategyParams(type) {
    const strategySelect = document.getElementById(`${type}Strategy`);
    const paramsContainer = document.getElementById(`${type}Params`);
    if (!strategySelect || !paramsContainer) {
        console.error(`[Main] Cannot find elements for type: ${type}`);
        return;
    }
    
    const strategyKey = strategySelect.value;
    let internalKey = strategyKey;
    
    if (type === 'exit') {
        if(['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(strategyKey)) {
            internalKey = `${strategyKey}_exit`;
        }
    } else if (type === 'shortEntry') {
        internalKey = strategyKey;
        if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(strategyKey)) {
            internalKey = `short_${strategyKey}`;
        }
    } else if (type === 'shortExit') {
        internalKey = strategyKey;
        if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(strategyKey)) {
            internalKey = `cover_${strategyKey}`;
        }
    }
    
    const config = strategyDescriptions[internalKey];
    paramsContainer.innerHTML = '';
    
    if (!config?.defaultParams || Object.keys(config.defaultParams).length === 0) {
        paramsContainer.innerHTML = '<p class="text-xs text-gray-400 italic">此策略無需參數</p>';
    } else {
        for (const pName in config.defaultParams) {
            const defVal = config.defaultParams[pName];
            let lbl = pName;
            let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1);
            
            // 標籤名稱處理
            if (internalKey === 'k_d_cross') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdX'){lbl='D值上限(X)';idSfx='KdThresholdX';}
            } else if (internalKey === 'k_d_cross_exit') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdY'){lbl='D值下限(Y)';idSfx='KdThresholdY';}
            } else if (internalKey === 'turtle_stop_loss') {
                if(pName==='stopLossPeriod'){lbl='停損週期';idSfx='StopLossPeriod';}
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') {
                lbl='DEA週期(x)'; idSfx = 'SignalPeriod';
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'shortPeriod') {
                lbl='DI短EMA(n)';
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'longPeriod') {
                lbl='DI長EMA(m)';
            } else if (internalKey === 'short_k_d_cross') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdY'){lbl='D值下限(Y)';idSfx='ShortKdThresholdY';}
            } else if (internalKey === 'cover_k_d_cross') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdX'){lbl='D值上限(X)';idSfx='CoverKdThresholdX';}
            } else if (internalKey === 'short_macd_cross') {
                if(pName==='shortPeriod')lbl='DI短EMA(n)';
                else if(pName==='longPeriod')lbl='DI長EMA(m)';
                else if(pName==='signalPeriod'){lbl='DEA週期(x)';idSfx='ShortSignalPeriod';}
            } else if (internalKey === 'cover_macd_cross') {
                if(pName==='shortPeriod')lbl='DI短EMA(n)';
                else if(pName==='longPeriod')lbl='DI長EMA(m)';
                else if(pName==='signalPeriod'){lbl='DEA週期(x)';idSfx='CoverSignalPeriod';}
            } else if (internalKey === 'short_turtle_stop_loss') {
                if(pName==='stopLossPeriod'){lbl='觀察週期';idSfx='ShortStopLossPeriod';}
            } else if (internalKey === 'cover_turtle_breakout') {
                if(pName==='breakoutPeriod'){lbl='突破週期';idSfx='CoverBreakoutPeriod';}
            } else if (internalKey === 'cover_trailing_stop') {
                if(pName==='percentage'){lbl='百分比(%)';idSfx='CoverTrailingStopPercentage';}
            } else {
                const baseKey = internalKey.replace('short_', '').replace('cover_', '').replace('_exit', '');
                if (baseKey === 'ma_cross' || baseKey === 'ema_cross') {
                    if(pName==='shortPeriod')lbl='短期SMA';
                    else if(pName==='longPeriod')lbl='長期SMA';
                } else if (baseKey === 'ma_above' || baseKey === 'ma_below') {
                    if(pName==='period')lbl='SMA週期';
                } else if(pName==='period')lbl='週期';
                else if(pName==='threshold')lbl='閾值';
                else if(pName==='signalPeriod')lbl='信號週期';
                else if(pName==='deviations')lbl='標準差';
                else if(pName==='multiplier')lbl='成交量倍數';
                else if(pName==='percentage')lbl='百分比(%)';
                else if(pName==='breakoutPeriod')lbl='突破週期';
                else if(pName==='stopLossPeriod')lbl='停損週期';
                else { lbl = pName; }
            }
            
            const id = `${type}${idSfx}`;
            const pg = document.createElement('div');
            const lb = document.createElement('label');
            lb.htmlFor = id;
            lb.className = "block text-xs font-medium text-gray-600 mb-1";
            
            // 檢查是否有優化範圍資訊並添加範圍顯示（適用於所有策略類型）
            const optimizeTarget = config.optimizeTargets?.find(t => t.name === pName);
            if (optimizeTarget?.range) {
                const rangeText = `${optimizeTarget.range.from}-${optimizeTarget.range.to}`;
                lb.innerHTML = `${lbl}<br><span class="text-xs text-blue-500 font-normal">範圍: ${rangeText}</span>`;
            } else {
                lb.textContent = lbl;
            }
            
            const ip = document.createElement('input');
            ip.type = 'number';
            ip.id = id;
            ip.value = defVal;
            ip.className = "w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500";
            
            // 設定輸入範圍
            if(pName.includes('Period')||pName==='period'||pName==='stopLossPeriod'||pName==='breakoutPeriod'){
                ip.min=1;ip.max=200;ip.step=1;
            } else if(pName==='threshold'&&(internalKey.includes('rsi')||internalKey.includes('williams'))){
                ip.min=internalKey.includes('williams')?-100:0;
                ip.max=internalKey.includes('williams')?0:100;
                ip.step=1;
            } else if(pName==='thresholdX'||pName==='thresholdY'){
                ip.min=0;ip.max=100;ip.step=1;
            } else if(pName==='deviations'){
                ip.min=0.5;ip.max=5;ip.step=0.1;
            } else if(pName==='multiplier'){
                ip.min=1;ip.max=10;ip.step=0.1;
            } else if(pName==='percentage'){
                ip.min=0.1;ip.max=100;ip.step=0.1;
            }
            
            pg.appendChild(lb);
            pg.appendChild(ip);
            paramsContainer.appendChild(pg);
        }
    }
    
    // 更新優化參數選項
    let optimizeSelectId = null;
    if (type === 'entry' || type === 'exit' || type === 'shortEntry' || type === 'shortExit') {
        if (type === 'entry') optimizeSelectId = 'optimizeEntryParamSelect';
        else if (type === 'exit') optimizeSelectId = 'optimizeExitParamSelect';
        else if (type === 'shortEntry') optimizeSelectId = 'optimizeShortEntryParamSelect';
        else if (type === 'shortExit') optimizeSelectId = 'optimizeShortExitParamSelect';
        
        if (optimizeSelectId) {
            const optimizeSelect = document.getElementById(optimizeSelectId);
            if (optimizeSelect) {
                optimizeSelect.innerHTML = '';
                const targets = config?.optimizeTargets || [];
                if (targets.length > 0) {
                    targets.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.name;
                        opt.textContent = t.label;
                        optimizeSelect.appendChild(opt);
                    });
                    optimizeSelect.disabled = false;
                    optimizeSelect.title = `選擇優化參數`;
                } else {
                    const opt = document.createElement('option');
                    opt.value="null";
                    opt.textContent = '無可優化';
                    optimizeSelect.appendChild(opt);
                    optimizeSelect.disabled = true;
                    optimizeSelect.title = '此策略無可優化參數';
                }
            } else {
                console.warn(`[Update Params] Optimize select element not found: #${optimizeSelectId}`);
            }
        }
    }
}
function resetSettings() { document.getElementById("stockNo").value="2330"; initDates(); document.getElementById("initialCapital").value="100000"; document.getElementById("positionSize").value="100"; document.getElementById("stopLoss").value="0"; document.getElementById("takeProfit").value="0"; document.getElementById("positionBasisInitial").checked = true; setDefaultFees("2330"); document.querySelector('input[name="tradeTiming"][value="close"]').checked = true; document.getElementById("entryStrategy").value="ma_cross"; updateStrategyParams('entry'); document.getElementById("exitStrategy").value="ma_cross"; updateStrategyParams('exit'); const shortCheckbox = document.getElementById("enableShortSelling"); const shortArea = document.getElementById("short-strategy-area"); shortCheckbox.checked = false; shortArea.style.display = 'none'; document.getElementById("shortEntryStrategy").value="short_ma_cross"; updateStrategyParams('shortEntry'); document.getElementById("shortExitStrategy").value="cover_ma_cross"; updateStrategyParams('shortExit'); cachedStockData=null; lastFetchSettings=null; clearPreviousResults(); showSuccess("設定已重置"); }
function initTabs() { 
    // Initialize with summary tab active
    activateTab('summary'); 
}
function activateTab(tabId) { 
    const tabs = document.querySelectorAll('[data-tab]'); 
    const contents = document.querySelectorAll('.tab-content'); 
    
    // Update button states
    tabs.forEach(tab => { 
        const currentTabId = tab.getAttribute('data-tab'); 
        const isActive = currentTabId === tabId; 
        
        if (isActive) {
            tab.className = 'tab py-4 px-1 border-b-2 border-primary text-primary font-medium text-sm whitespace-nowrap';
            tab.style.color = 'var(--primary)';
            tab.style.borderColor = 'var(--primary)';
        } else {
            tab.className = 'tab py-4 px-1 border-b-2 border-transparent text-muted hover:text-foreground font-medium text-sm whitespace-nowrap';
            tab.style.color = 'var(--muted-foreground)';
            tab.style.borderColor = 'transparent';
        }
    }); 
    
    // Show corresponding content
    contents.forEach(content => { 
        const isTargetTab = content.id === `${tabId}-tab`;
        if (isTargetTab) {
            content.classList.remove('hidden');
            content.classList.add('active');
        } else {
            content.classList.add('hidden');
            content.classList.remove('active');
        }
    }); 
}
function setDefaultFees(stockNo) { const buyFeeInput = document.getElementById('buyFee'); const sellFeeInput = document.getElementById('sellFee'); if (!buyFeeInput || !sellFeeInput) return; const stockBuyFeeRate = 0.1425; const stockSellFeeRate = 0.1425; const stockTaxRate = 0.3; const etfBuyFeeRate = 0.1; const etfSellFeeRate = 0.1; const etfTaxRate = 0.1; const isETF = typeof stockNo === 'string' && stockNo.startsWith('00'); const isTAIEX = stockNo === 'TAIEX'; if (isTAIEX) { // 指數無手續費 buyFeeInput.value = '0.0000'; sellFeeInput.value = '0.0000'; } else if (isETF) { buyFeeInput.value = etfBuyFeeRate.toFixed(4); sellFeeInput.value = (etfSellFeeRate + etfTaxRate).toFixed(4); } else { buyFeeInput.value = stockBuyFeeRate.toFixed(4); sellFeeInput.value = (stockSellFeeRate + stockTaxRate).toFixed(4); } console.log(`[Fees] Set default fees for ${stockNo} (isETF: ${isETF}, isTAIEX: ${isTAIEX}) -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`); }
function getSavedStrategies() { const strategies = localStorage.getItem(SAVED_STRATEGIES_KEY); try { const parsed = strategies ? JSON.parse(strategies) : {}; // 清理損壞的數據
        const cleaned = {};
        for (const [name, data] of Object.entries(parsed)) {
            if (data && typeof data === 'object' && data.settings) {
                cleaned[name] = data;
            } else {
                console.warn(`[Storage] Removing corrupted strategy: ${name}`, data);
            }
        }
        // 如果有損壞數據被清理，更新 localStorage
        if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
            localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(cleaned));
        }
        return cleaned; } catch (e) { console.error("讀取策略時解析JSON錯誤:", e); return {}; } }
function saveStrategyToLocalStorage(name, settings, metrics) { 
    try { 
        const strategies = getSavedStrategies(); 
        strategies[name] = { 
            settings: { 
                stockNo: settings.stockNo, 
                startDate: settings.startDate, 
                endDate: settings.endDate, 
                initialCapital: settings.initialCapital, 
                tradeTiming: settings.tradeTiming, 
                entryStrategy: settings.entryStrategy, 
                entryParams: settings.entryParams, 
                exitStrategy: settings.exitStrategy, 
                exitParams: settings.exitParams, 
                enableShorting: settings.enableShorting, 
                shortEntryStrategy: settings.shortEntryStrategy, 
                shortEntryParams: settings.shortEntryParams, 
                shortExitStrategy: settings.shortExitStrategy, 
                shortExitParams: settings.shortExitParams, 
                positionSize: settings.positionSize, 
                stopLoss: settings.stopLoss, 
                takeProfit: settings.takeProfit, 
                positionBasis: settings.positionBasis, 
                buyFee: settings.buyFee, 
                sellFee: settings.sellFee 
            }, 
            metrics: metrics 
        }; 
        
        localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(strategies)); 
        return true; 
    } catch (e) { 
        console.error("儲存策略到 localStorage 時發生錯誤:", e); 
        if (e.name === 'QuotaExceededError') { 
            showError("儲存失敗：localStorage 空間已滿。請刪除一些舊策略。"); 
        } else { 
            showError(`儲存策略失敗: ${e.message}`); 
        } 
        return false; 
    } 
}
function deleteStrategyFromLocalStorage(name) { try { const strategies = getSavedStrategies(); if (strategies[name]) { delete strategies[name]; localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(strategies)); return true; } return false; } catch (e) { console.error("刪除策略時發生錯誤:", e); showError(`刪除策略失敗: ${e.message}`); return false; } }
function populateSavedStrategiesDropdown() { 
    const selectElement = document.getElementById('loadStrategySelect'); 
    if (!selectElement) return;
    
    selectElement.innerHTML = '<option value="">-- 選擇要載入的策略 --</option>'; 
    const strategies = getSavedStrategies(); 
    const strategyNames = Object.keys(strategies).sort(); 
    
    strategyNames.forEach(name => { 
        const strategyData = strategies[name]; 
        if (!strategyData) return; // 跳過 null 或 undefined 的策略資料 
        
        const metrics = strategyData.metrics || {}; // 修正：年化報酬率已經是百分比格式，不需要再乘以100
        const annReturn = (metrics.annualizedReturn !== null && !isNaN(metrics.annualizedReturn)) ? metrics.annualizedReturn.toFixed(2) + '%' : 'N/A'; 
        const sharpe = (metrics.sharpeRatio !== null && !isNaN(metrics.sharpeRatio)) ? metrics.sharpeRatio.toFixed(2) : 'N/A'; 
        const displayText = `${name} (年化:${annReturn} | Sharpe:${sharpe})`; 
        const option = document.createElement('option'); 
        option.value = name; 
        option.textContent = displayText; 
        selectElement.appendChild(option); 
    }); 
}
function saveStrategy() { 
    // 生成預設策略名稱（使用中文名稱）
    const stockNo = document.getElementById('stockNo').value.trim().toUpperCase() || '2330';
    const entryStrategy = document.getElementById('entryStrategy').value;
    const exitStrategy = document.getElementById('exitStrategy').value;
    const enableShorting = document.getElementById('enableShortSelling').checked;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // 計算期間年份
    let yearPeriod = '';
    if (startDate && endDate) {
        const startYear = new Date(startDate).getFullYear();
        const endYear = new Date(endDate).getFullYear();
        const yearDiff = endYear - startYear;
        if (yearDiff > 0) {
            yearPeriod = `${yearDiff}年`;
        }
    }
    
    // 獲取中文策略名稱
    const entryStrategyName = strategyDescriptions[entryStrategy]?.name || entryStrategy;
    
    // 出場策略需要特殊處理以獲取正確的中文名稱
    let exitStrategyName;
    if (['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(exitStrategy)) {
        const exitStrategyKey = exitStrategy + '_exit';
        exitStrategyName = strategyDescriptions[exitStrategyKey]?.name || exitStrategy;
    } else {
        exitStrategyName = strategyDescriptions[exitStrategy]?.name || exitStrategy;
    }
    
    let defaultName = `${stockNo}_${entryStrategyName}_${exitStrategyName}`;
    if (enableShorting) {
        const shortEntryStrategy = document.getElementById('shortEntryStrategy').value;
        const shortExitStrategy = document.getElementById('shortExitStrategy').value;
        const shortEntryStrategyName = strategyDescriptions[shortEntryStrategy]?.name || shortEntryStrategy;
        const shortExitStrategyName = strategyDescriptions[shortExitStrategy]?.name || shortExitStrategy;
        defaultName = `${stockNo}_${entryStrategyName}_${exitStrategyName}_${shortEntryStrategyName}_${shortExitStrategyName}`;
    }
    
    // 添加期間年份到預設名稱末尾
    if (yearPeriod) {
        defaultName += `_${yearPeriod}`;
    }
    
    const strategyName = prompt("請輸入策略名稱：", defaultName); 
    if (!strategyName || strategyName.trim() === "") { 
        showInfo("策略名稱不能為空。"); 
        return; 
    } 
    const trimmedName = strategyName.trim();
    
    const strategies = getSavedStrategies(); 
    if (strategies[trimmedName]) { 
        if (!confirm(`策略 "${trimmedName}" 已存在。是否覆蓋？`)) { 
            return; 
        } 
    } 
    if (lastOverallResult === null || lastOverallResult.annualizedReturn === null || lastOverallResult.sharpeRatio === null) { 
        if (!confirm("尚未執行回測或上次回測無有效績效指標。是否仍要儲存此策略設定（績效指標將顯示為 N/A）？")) { 
            return; 
        } 
    } 
    const currentSettings = getBacktestParams(); 
    const currentMetrics = { annualizedReturn: lastOverallResult?.annualizedReturn, sharpeRatio: lastOverallResult?.sharpeRatio }; 
    
    if (saveStrategyToLocalStorage(trimmedName, currentSettings, currentMetrics)) { 
        populateSavedStrategiesDropdown(); 
        showSuccess(`策略 "${trimmedName}" 已儲存！`); 
    }
}
function loadStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("請先從下拉選單選擇要載入的策略。"); return; } const strategies = getSavedStrategies(); const strategyData = strategies[strategyName]; if (!strategyData || !strategyData.settings) { showError(`載入策略 "${strategyName}" 失敗：找不到策略數據。`); return; } const settings = strategyData.settings; console.log(`[Main] Loading strategy: ${strategyName}`, settings); try { document.getElementById('stockNo').value = settings.stockNo || '2330'; setDefaultFees(settings.stockNo || '2330'); document.getElementById('startDate').value = settings.startDate || ''; document.getElementById('endDate').value = settings.endDate || ''; document.getElementById('initialCapital').value = settings.initialCapital || 100000; document.getElementById('recentYears').value = 5; const tradeTimingInput = document.querySelector(`input[name="tradeTiming"][value="${settings.tradeTiming || 'close'}"]`); if (tradeTimingInput) tradeTimingInput.checked = true; document.getElementById('buyFee').value = (settings.buyFee !== undefined) ? settings.buyFee : (document.getElementById('buyFee').value || 0.1425); document.getElementById('sellFee').value = (settings.sellFee !== undefined) ? settings.sellFee : (document.getElementById('sellFee').value || 0.4425); document.getElementById('positionSize').value = settings.positionSize || 100; document.getElementById('stopLoss').value = settings.stopLoss ?? 0; document.getElementById('takeProfit').value = settings.takeProfit ?? 0; const positionBasisInput = document.querySelector(`input[name="positionBasis"][value="${settings.positionBasis || 'initialCapital'}"]`); if (positionBasisInput) positionBasisInput.checked = true; document.getElementById('entryStrategy').value = settings.entryStrategy || 'ma_cross'; updateStrategyParams('entry'); if(settings.entryParams) { for (const pName in settings.entryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; if (settings.entryStrategy === 'k_d_cross' && pName === 'thresholdX') finalIdSfx = 'KdThresholdX'; else if ((settings.entryStrategy === 'macd_cross') && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`entry${finalIdSfx}`); if (inputElement) inputElement.value = settings.entryParams[pName]; else console.warn(`[Load] Entry Param Input not found: entry${finalIdSfx}`); } } document.getElementById('exitStrategy').value = settings.exitStrategy || 'ma_cross'; updateStrategyParams('exit'); if(settings.exitParams) { for (const pName in settings.exitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(settings.exitStrategy)) ? `${settings.exitStrategy}_exit` : settings.exitStrategy; if (exitInternalKey === 'k_d_cross_exit' && pName === 'thresholdY') finalIdSfx = 'KdThresholdY'; else if (exitInternalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'StopLossPeriod'; else if (exitInternalKey === 'macd_cross_exit' && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`exit${finalIdSfx}`); if (inputElement) inputElement.value = settings.exitParams[pName]; else console.warn(`[Load] Exit Param Input not found: exit${finalIdSfx}`); } } const shortCheckbox = document.getElementById('enableShortSelling'); const shortArea = document.getElementById('short-strategy-area'); shortCheckbox.checked = settings.enableShorting || false; shortArea.style.display = shortCheckbox.checked ? 'grid' : 'none'; if (settings.enableShorting) { document.getElementById('shortEntryStrategy').value = settings.shortEntryStrategy || 'short_ma_cross'; updateStrategyParams('shortEntry'); if(settings.shortEntryParams) { for (const pName in settings.shortEntryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortEntryInternalKey = `short_${settings.shortEntryStrategy}`; if (shortEntryInternalKey === 'short_k_d_cross' && pName === 'thresholdY') finalIdSfx = 'ShortKdThresholdY'; else if (shortEntryInternalKey === 'short_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'ShortSignalPeriod'; else if (shortEntryInternalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'ShortStopLossPeriod'; const inputElement = document.getElementById(`shortEntry${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortEntryParams[pName]; else console.warn(`[Load] Short Entry Param Input not found: shortEntry${finalIdSfx}`); } } document.getElementById('shortExitStrategy').value = settings.shortExitStrategy || 'cover_ma_cross'; updateStrategyParams('shortExit'); if(settings.shortExitParams) { for (const pName in settings.shortExitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortExitInternalKey = `cover_${settings.shortExitStrategy}`; if (shortExitInternalKey === 'cover_k_d_cross' && pName === 'thresholdX') finalIdSfx = 'CoverKdThresholdX'; else if (shortExitInternalKey === 'cover_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'CoverSignalPeriod'; else if (shortExitInternalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') finalIdSfx = 'CoverBreakoutPeriod'; else if (shortExitInternalKey === 'cover_trailing_stop' && pName === 'percentage') finalIdSfx = 'CoverTrailingStopPercentage'; const inputElement = document.getElementById(`shortExit${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortExitParams[pName]; else console.warn(`[Load] Short Exit Param Input not found: shortExit${finalIdSfx}`); } } } else { document.getElementById('shortEntryStrategy').value = 'short_ma_cross'; updateStrategyParams('shortEntry'); document.getElementById('shortExitStrategy').value = 'cover_ma_cross'; updateStrategyParams('shortExit'); } showSuccess(`策略 "${strategyName}" 已載入！`); 
    
    // 顯示確認對話框並自動執行回測
    if (confirm(`策略參數已載入完成！\n\n是否立即執行回測以查看策略表現？`)) {
        // 自動執行回測
        setTimeout(() => {
            runBacktestInternal();
        }, 100);
    }
    
    lastOverallResult = null; 
    lastSubPeriodResults = null; 
    } catch (error) { 
        console.error(`載入策略 "${strategyName}" 時發生錯誤:`, error); 
        showError(`載入策略失敗: ${error.message}`); 
    } 
}

function deleteStrategy() { 
    const selectElement = document.getElementById('loadStrategySelect'); 
    const strategyName = selectElement.value; 
    if (!strategyName) { 
        showInfo("請先從下拉選單選擇要刪除的策略。"); 
        return; 
    } 
    if (confirm(`確定要刪除策略 "${strategyName}" 嗎？此操作無法復原。`)) { 
        if (deleteStrategyFromLocalStorage(strategyName)) { 
            populateSavedStrategiesDropdown(); 
            showSuccess(`策略 "${strategyName}" 已刪除！`); 
        } 
    } 
}
function randomizeSettings() {
    // 隨機設定策略參數
    showSuccess("策略與參數已隨機設定！");
}