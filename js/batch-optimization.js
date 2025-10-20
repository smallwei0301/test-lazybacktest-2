// --- 批量策略優化功能 - v1.2.5 ---
// Patch Tag: LB-BATCH-OPT-20260718A

const BATCH_STRATEGY_NAME_OVERRIDES = {
    // 出場策略映射
    'ma_cross_exit': 'ma_cross',
    'ema_cross_exit': 'ema_cross',
    'k_d_cross_exit': 'k_d_cross',
    'macd_cross_exit': 'macd_cross',
    'rsi_overbought_exit': 'rsi_overbought',
    'williams_overbought_exit': 'williams_overbought',
    'ma_below_exit': 'ma_below',
    'rsi_reversal_exit': 'rsi_reversal',
    'williams_reversal_exit': 'williams_reversal',

    // 做空入場策略映射
    'short_ma_cross': 'short_ma_cross',
    'short_ema_cross': 'short_ema_cross',
    'short_k_d_cross': 'short_k_d_cross',
    'short_macd_cross': 'short_macd_cross',
    'short_rsi_overbought': 'short_rsi_overbought',
    'short_williams_overbought': 'short_williams_overbought',
    'short_ma_below': 'short_ma_below',
    'short_rsi_reversal': 'short_rsi_reversal',
    'short_williams_reversal': 'short_williams_reversal',

    // 回補策略映射
    'cover_ma_cross': 'cover_ma_cross',
    'cover_ema_cross': 'cover_ema_cross',
    'cover_k_d_cross': 'cover_k_d_cross',
    'cover_macd_cross': 'cover_macd_cross',
    'cover_rsi_oversold': 'cover_rsi_oversold',
    'cover_williams_oversold': 'cover_williams_oversold',
    'cover_ma_above': 'cover_ma_above',
    'cover_rsi_reversal': 'cover_rsi_reversal',
    'cover_williams_reversal': 'cover_williams_reversal'
};

const BATCH_STRATEGY_NAME_MAP = (() => {
    const map = new Map(Object.entries(BATCH_STRATEGY_NAME_OVERRIDES));
    if (typeof strategyDescriptions === 'object' && strategyDescriptions) {
        Object.keys(strategyDescriptions).forEach((key) => {
            if (!map.has(key)) {
                map.set(key, key);
            }
        });
    }
    return map;
})();

const BATCH_DEBUG_VERSION_TAG = 'LB-BATCH-OPT-20260718A';

let batchDebugSession = null;
const batchDebugListeners = new Set();

function hydrateStrategyNameMap() {
    if (typeof strategyDescriptions !== 'object' || !strategyDescriptions) {
        return;
    }

    Object.keys(strategyDescriptions).forEach((key) => {
        if (!BATCH_STRATEGY_NAME_MAP.has(key)) {
            BATCH_STRATEGY_NAME_MAP.set(key, key);
        }
    });
}

function getWorkerStrategyName(batchStrategyName) {
    if (batchStrategyName === 'none') {
        return null;
    }

    if (!batchStrategyName) {
        const message = '[Batch Optimization] Strategy name is required for worker mapping';
        console.error(message);
        if (batchDebugSession) {
            recordBatchDebug('strategy-name-missing', { requested: batchStrategyName }, {
                level: 'error',
                consoleLevel: 'error'
            });
        }
        if (typeof showError === 'function') {
            showError('批量優化缺少策略名稱，無法建立回測請求。');
        }
        throw new Error(message);
    }

    if (!BATCH_STRATEGY_NAME_MAP.has(batchStrategyName)) {
        hydrateStrategyNameMap();
    }

    if (!BATCH_STRATEGY_NAME_MAP.has(batchStrategyName)) {
        const message = `[Batch Optimization] Missing worker strategy mapping for "${batchStrategyName}"`;
        console.error(message);
        if (batchDebugSession) {
            recordBatchDebug('strategy-mapping-missing', { strategy: batchStrategyName }, {
                level: 'error',
                consoleLevel: 'error'
            });
        }
        if (typeof showError === 'function') {
            showError(`批量優化缺少「${batchStrategyName}」的策略映射，請補齊批量設定。`);
        }
        throw new Error(message);
    }

    return BATCH_STRATEGY_NAME_MAP.get(batchStrategyName);
}

function resolveWorkerStrategyName(strategyName) {
    if (!strategyName) {
        return null;
    }
    return getWorkerStrategyName(strategyName);
}

// 全局變量
let batchOptimizationWorker = null;
let batchOptimizationResults = [];
let batchOptimizationConfig = {};
let isBatchOptimizationStopped = false;
let batchOptimizationStartTime = null;
let lastHeadlessOptimizationSummary = null;

function clonePlainObject(value) {
    if (!value || typeof value !== 'object') return {};
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            console.warn('[Batch Optimization] structuredClone failed, falling back to JSON clone:', error);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('[Batch Optimization] JSON clone failed, returning shallow copy:', error);
        return { ...value };
    }
}

function cloneStructuredValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (error) {
            console.warn('[Batch Optimization] structuredClone failed, falling back to JSON clone:', error);
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('[Batch Optimization] JSON clone failed, returning shallow copy:', error);
        if (Array.isArray(value)) {
            return value.slice();
        }
        if (value && typeof value === 'object') {
            return { ...value };
        }
        return value;
    }
}

function getActiveCacheStore() {
    if (typeof cachedDataStore !== 'undefined' && cachedDataStore instanceof Map) {
        return cachedDataStore;
    }
    if (typeof window !== 'undefined' && window.cachedDataStore instanceof Map) {
        return window.cachedDataStore;
    }
    return null;
}

function captureCacheStoreSnapshot(store = getActiveCacheStore()) {
    if (!(store instanceof Map)) {
        return null;
    }
    const snapshot = [];
    store.forEach((value, key) => {
        snapshot.push([key, cloneStructuredValue(value)]);
    });
    return snapshot;
}

function restoreCacheStoreSnapshot(snapshot, store = getActiveCacheStore()) {
    if (!(store instanceof Map)) {
        return;
    }
    store.clear();
    if (!Array.isArray(snapshot)) {
        return;
    }
    snapshot.forEach(([key, value]) => {
        store.set(key, cloneStructuredValue(value));
    });
}

function captureLastFetchSettingsSnapshot() {
    if (typeof lastFetchSettings !== 'undefined') {
        return clonePlainObject(lastFetchSettings);
    }
    if (typeof window !== 'undefined' && typeof window.lastFetchSettings !== 'undefined') {
        return clonePlainObject(window.lastFetchSettings);
    }
    return undefined;
}

function restoreLastFetchSettingsSnapshot(snapshot) {
    if (typeof lastFetchSettings !== 'undefined') {
        lastFetchSettings = snapshot ? clonePlainObject(snapshot) : snapshot;
        return;
    }
    if (typeof window !== 'undefined' && typeof window.lastFetchSettings !== 'undefined') {
        window.lastFetchSettings = snapshot ? clonePlainObject(snapshot) : snapshot;
    }
}

function summarizeDatasetRange(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return { length: 0, startDate: null, endDate: null };
    }

    const first = rows[0] || {};
    const last = rows[rows.length - 1] || {};

    const extractDate = (row) => {
        if (!row || typeof row !== 'object') return null;
        return row.date || row.Date || row.tradeDate || row.trade_date || row.timestamp || row.time || row.t || null;
    };

    return {
        length: rows.length,
        startDate: extractDate(first),
        endDate: extractDate(last)
    };
}

function ensureBatchDebugSession(context = {}) {
    if (!batchDebugSession) {
        startBatchDebugSession(context);
    }
    return batchDebugSession;
}

function notifyBatchDebugListeners() {
    if (batchDebugListeners.size === 0) {
        return;
    }
    const snapshot = getBatchDebugSnapshot();
    batchDebugListeners.forEach((listener) => {
        try {
            listener(snapshot);
        } catch (error) {
            console.error('[Batch Debug] Listener error:', error);
        }
    });
}

function subscribeBatchDebugLog(listener) {
    if (typeof listener !== 'function') {
        return () => {};
    }
    batchDebugListeners.add(listener);
    try {
        listener(getBatchDebugSnapshot());
    } catch (error) {
        console.error('[Batch Debug] Initial listener dispatch failed:', error);
    }
    return () => {
        batchDebugListeners.delete(listener);
    };
}

function startBatchDebugSession(context = {}) {
    const timestamp = Date.now();
    batchDebugSession = {
        version: BATCH_DEBUG_VERSION_TAG,
        sessionId: `BATCH-${timestamp}`,
        startedAt: timestamp,
        startedAtIso: new Date(timestamp).toISOString(),
        context: clonePlainObject(context),
        events: [],
        summary: {}
    };

    const initEvent = {
        ts: timestamp,
        iso: batchDebugSession.startedAtIso,
        label: 'session-start',
        detail: clonePlainObject(context),
        phase: context.phase || 'init',
        level: 'info'
    };
    batchDebugSession.events.push(initEvent);

    if (context.quiet !== true) {
        console.log('[Batch Debug][session-start]', initEvent.detail);
    }

    notifyBatchDebugListeners();

    return batchDebugSession;
}

function recordBatchDebug(event, detail = {}, options = {}) {
    ensureBatchDebugSession(options.sessionContext || {});

    if (!batchDebugSession) {
        return null;
    }

    const timestamp = Date.now();
    const entry = {
        ts: timestamp,
        iso: new Date(timestamp).toISOString(),
        label: event,
        detail: clonePlainObject(detail),
        phase: options.phase || null,
        level: options.level || 'info'
    };

    batchDebugSession.events.push(entry);
    batchDebugSession.lastEventAt = timestamp;

    if (options.updateSummary && typeof options.updateSummary === 'function') {
        batchDebugSession.summary = batchDebugSession.summary || {};
        options.updateSummary(batchDebugSession.summary, entry);
    }

    if (options.console !== false) {
        const consoleLevel = options.consoleLevel
            || (entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log');
        const printer = console[consoleLevel] || console.log;
        try {
            printer.call(console, `[Batch Debug][${event}]`, detail);
        } catch (error) {
            console.log('[Batch Debug][fallback]', event, detail);
        }
    }

    notifyBatchDebugListeners();

    return entry;
}

function finalizeBatchDebugSession(outcome = {}) {
    if (!batchDebugSession) {
        return null;
    }

    if (batchDebugSession.completedAt) {
        batchDebugSession.outcome = {
            ...batchDebugSession.outcome,
            ...clonePlainObject(outcome)
        };
        return batchDebugSession;
    }

    const timestamp = Date.now();
    batchDebugSession.completedAt = timestamp;
    batchDebugSession.completedAtIso = new Date(timestamp).toISOString();
    batchDebugSession.outcome = clonePlainObject(outcome);

    recordBatchDebug('session-complete', batchDebugSession.outcome, {
        phase: 'complete',
        consoleLevel: 'log'
    });

    notifyBatchDebugListeners();

    return batchDebugSession;
}

function getBatchDebugSnapshot() {
    if (!batchDebugSession) {
        return null;
    }
    return clonePlainObject(batchDebugSession);
}

function downloadBatchDebugLog(filenamePrefix = 'batch-debug-log') {
    if (!batchDebugSession) {
        console.warn('[Batch Debug] No session available for export');
        return;
    }

    try {
        const snapshot = getBatchDebugSnapshot();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `${filenamePrefix}-${snapshot.sessionId || Date.now()}.json`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 0);

        console.log('[Batch Debug] Exported log:', filename);
    } catch (error) {
        console.error('[Batch Debug] Failed to export log:', error);
    }
}

function clearBatchDebugSession() {
    batchDebugSession = null;
    notifyBatchDebugListeners();
}

function summarizeCombination(combination) {
    if (!combination || typeof combination !== 'object') {
        return null;
    }

    const summary = {
        buyStrategy: combination.buyStrategy || null,
        sellStrategy: combination.sellStrategy || null
    };

    if (combination.buyParams) {
        summary.buyParams = { ...combination.buyParams };
    }
    if (combination.sellParams) {
        summary.sellParams = { ...combination.sellParams };
    }
    if (combination.riskManagement) {
        summary.riskManagement = { ...combination.riskManagement };
    }
    if (combination.__finalMetric !== undefined) {
        summary.metric = combination.__finalMetric;
        summary.metricLabel = combination.__metricLabel || null;
    }

    return summary;
}

function summarizeResult(result) {
    if (!result || typeof result !== 'object') {
        return null;
    }

    const summary = {
        buyStrategy: result.buyStrategy ?? result.entryStrategy ?? null,
        sellStrategy: result.sellStrategy ?? result.exitStrategy ?? null,
        annualizedReturn: typeof result.annualizedReturn === 'number' ? result.annualizedReturn : null,
        sharpeRatio: typeof result.sharpeRatio === 'number' ? result.sharpeRatio : null,
        maxDrawdown: typeof result.maxDrawdown === 'number' ? result.maxDrawdown : null,
        totalReturn: typeof result.totalReturn === 'number' ? result.totalReturn : null
    };

    if (result.tradeCount !== undefined) {
        summary.tradeCount = result.tradeCount;
    } else if (result.totalTrades !== undefined) {
        summary.tradeCount = result.totalTrades;
    }
    if (result.optimizationType) {
        summary.optimizationType = result.optimizationType;
    }
    if (Array.isArray(result.optimizationTypes) && result.optimizationTypes.length > 0) {
        summary.optimizationTypes = [...result.optimizationTypes];
    }
    if (result.riskManagement) {
        summary.riskManagement = { ...result.riskManagement };
    }
    if (result.usedStopLoss !== undefined) {
        summary.usedStopLoss = result.usedStopLoss;
    }
    if (result.usedTakeProfit !== undefined) {
        summary.usedTakeProfit = result.usedTakeProfit;
    }
    if (result.__finalMetric !== undefined) {
        summary.metric = result.__finalMetric;
        summary.metricLabel = result.__metricLabel || null;
    }

    return summary;
}

const EXIT_STRATEGY_SELECT_MAP = {
    'ma_cross': 'ma_cross',
    'ma_cross_exit': 'ma_cross',
    'ma_below': 'ma_below',
    'ma_below_exit': 'ma_below',
    'rsi_overbought': 'rsi_overbought',
    'rsi_overbought_exit': 'rsi_overbought',
    'macd_cross': 'macd_cross',
    'macd_cross_exit': 'macd_cross',
    'bollinger_reversal': 'bollinger_reversal',
    'k_d_cross': 'k_d_cross',
    'k_d_cross_exit': 'k_d_cross',
    'volume_spike': 'volume_spike',
    'price_breakdown': 'price_breakdown',
    'williams_overbought': 'williams_overbought',
    'williams_overbought_exit': 'williams_overbought',
    'turtle_stop_loss': 'turtle_stop_loss',
    'trailing_stop': 'trailing_stop',
    'fixed_stop_loss': 'fixed_stop_loss'
};

const BATCH_PARAM_SUFFIX_OVERRIDES = {
    'k_d_cross': { thresholdX: 'KdThresholdX' },
    'k_d_cross_exit': { thresholdY: 'KdThresholdY' },
    'short_k_d_cross': { thresholdY: 'ShortKdThresholdY' },
    'cover_k_d_cross': { thresholdX: 'CoverKdThresholdX' },
    'short_macd_cross': { signalPeriod: 'ShortSignalPeriod' },
    'cover_macd_cross': { signalPeriod: 'CoverSignalPeriod' },
    'turtle_stop_loss': { stopLossPeriod: 'StopLossPeriod' },
    'short_turtle_stop_loss': { stopLossPeriod: 'ShortStopLossPeriod' },
    'cover_turtle_breakout': { breakoutPeriod: 'CoverBreakoutPeriod' },
    'cover_trailing_stop': { percentage: 'CoverTrailingStopPercentage' }
};

const BATCH_PARAM_FIELD_CACHE = new Map();

function capitalizeParamKey(key) {
    if (!key) return '';
    return key.charAt(0).toUpperCase() + key.slice(1);
}

function resolveParamFieldMap(strategyKey) {
    if (!strategyKey) return null;
    if (BATCH_PARAM_FIELD_CACHE.has(strategyKey)) {
        return BATCH_PARAM_FIELD_CACHE.get(strategyKey);
    }

    const config = typeof strategyDescriptions === 'object' ? strategyDescriptions?.[strategyKey] : null;
    const overrides = BATCH_PARAM_SUFFIX_OVERRIDES[strategyKey] || {};
    const mapping = {};

    if (config?.defaultParams && typeof config.defaultParams === 'object') {
        Object.keys(config.defaultParams).forEach((paramKey) => {
            const suffix = overrides[paramKey] || capitalizeParamKey(paramKey);
            mapping[paramKey] = suffix;
        });
    }

    BATCH_PARAM_FIELD_CACHE.set(strategyKey, mapping);
    return mapping;
}

function prepareBaseParamsForOptimization(source) {
    const clone = clonePlainObject(source || {});
    if (!clone || typeof clone !== 'object') return {};
    clone.entryParams = clone.entryParams && typeof clone.entryParams === 'object' ? { ...clone.entryParams } : {};
    clone.exitParams = clone.exitParams && typeof clone.exitParams === 'object' ? { ...clone.exitParams } : {};
    clone.shortEntryParams = clone.shortEntryParams && typeof clone.shortEntryParams === 'object' ? { ...clone.shortEntryParams } : {};
    clone.shortExitParams = clone.shortExitParams && typeof clone.shortExitParams === 'object' ? { ...clone.shortExitParams } : {};
    clone.entryStages = Array.isArray(clone.entryStages) ? [...clone.entryStages] : [];
    clone.exitStages = Array.isArray(clone.exitStages) ? [...clone.exitStages] : [];
    return clone;
}

// Worker / per-combination 狀態追蹤
let batchWorkerStatus = {
    concurrencyLimit: 0,
    inFlightCount: 0,
    entries: [] // { index, buyStrategy, sellStrategy, status: 'queued'|'running'|'done'|'error', startTime, endTime }
};

function enrichParamsWithLookback(params) {
    if (!params || typeof params !== 'object') return params;
    const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
    if (!sharedUtils) return params;
    const windowOptions = {
        minBars: 90,
        multiplier: 2,
        marginTradingDays: 12,
        extraCalendarDays: 7,
        minDate: sharedUtils?.MIN_DATA_DATE,
        defaultStartDate: params.startDate,
    };
    let windowDecision = null;
    if (typeof sharedUtils.resolveDataWindow === 'function') {
        windowDecision = sharedUtils.resolveDataWindow(params, windowOptions);
    }
    const fallbackMaxPeriod = typeof sharedUtils.getMaxIndicatorPeriod === 'function'
        ? sharedUtils.getMaxIndicatorPeriod(params)
        : 0;
    let lookbackDays = Number.isFinite(windowDecision?.lookbackDays)
        ? windowDecision.lookbackDays
        : null;
    if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
        if (typeof sharedUtils.resolveLookbackDays === 'function') {
            const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
            if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                lookbackDays = fallbackDecision.lookbackDays;
            }
        }
    }
    if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
        lookbackDays = typeof sharedUtils.estimateLookbackBars === 'function'
            ? sharedUtils.estimateLookbackBars(fallbackMaxPeriod, { minBars: 90, multiplier: 2 })
            : Math.max(90, fallbackMaxPeriod * 2);
    }
    const effectiveStartDate = windowDecision?.effectiveStartDate || params.startDate || windowDecision?.minDataDate || windowOptions.defaultStartDate;
    let dataStartDate = windowDecision?.dataStartDate || null;
    if (!dataStartDate && effectiveStartDate && typeof sharedUtils.computeBufferedStartDate === 'function') {
        dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
            minDate: sharedUtils?.MIN_DATA_DATE,
            marginTradingDays: windowDecision?.bufferTradingDays || windowOptions.marginTradingDays,
            extraCalendarDays: windowDecision?.extraCalendarDays || windowOptions.extraCalendarDays,
        }) || effectiveStartDate;
    }
    if (!dataStartDate) dataStartDate = effectiveStartDate;
    return {
        ...params,
        effectiveStartDate,
        dataStartDate,
        lookbackDays,
    };
}

function resetBatchWorkerStatus() {
    batchWorkerStatus.concurrencyLimit = 0;
    batchWorkerStatus.inFlightCount = 0;
    batchWorkerStatus.entries = [];
    renderBatchWorkerStatus();
}

function renderBatchWorkerStatus() {
    try {
        const panel = document.getElementById('batch-worker-status-panel');
        const concurrencyEl = document.getElementById('batch-current-concurrency');
        const inflightEl = document.getElementById('batch-inflight-count');
        const tbody = document.getElementById('batch-worker-status-tbody');

        if (!panel || !concurrencyEl || !inflightEl || !tbody) return;

        // 顯示/隱藏面板
        if (batchWorkerStatus.entries.length === 0) {
            panel.classList.add('hidden');
        } else {
            panel.classList.remove('hidden');
        }

        concurrencyEl.textContent = batchWorkerStatus.concurrencyLimit || '-';
        inflightEl.textContent = batchWorkerStatus.inFlightCount.toString();

        // 只顯示最近 50 筆
        const recent = batchWorkerStatus.entries.slice(-50).reverse();
        tbody.innerHTML = '';
        recent.forEach((e, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-2 py-1">${e.index}</td>
                <td class="px-2 py-1">${getStrategyChineseName(e.buyStrategy)}</td>
                <td class="px-2 py-1">${getStrategyChineseName(e.sellStrategy)}</td>
                <td class="px-2 py-1">${getStatusChineseText(e.status)}${e.error ? ' - ' + e.error : ''}</td>
                <td class="px-2 py-1">${e.startTime ? new Date(e.startTime).toLocaleTimeString() : '-'}${e.endTime ? ' → ' + new Date(e.endTime).toLocaleTimeString() : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('[Batch Worker Status] render error:', error);
    }
}

// 初始化批量優化功能
function initBatchOptimization() {
    console.log('[Batch Optimization] Initializing...');
    
    try {
        // 檢查必要的依賴是否存在
        if (typeof strategyDescriptions === 'undefined') {
            console.error('[Batch Optimization] strategyDescriptions not found');
            return;
        }

        hydrateStrategyNameMap();

        // 生成策略選項
        generateStrategyOptions();
        
        // 綁定事件
        bindBatchOptimizationEvents();
        
        // 添加測試按鈕（僅在開發模式）
        if (window.location.hostname === 'localhost') {
            addTestButton();
        }
        
        // 初始化設定
        batchOptimizationConfig = {
            batchSize: 100,
            maxCombinations: 10000,
            optimizeTargets: ['annualizedReturn', 'sharpeRatio']
        };
        
        // 在 UI 中顯示推薦的 concurrency（若瀏覽器支援）
        try {
            const hint = document.getElementById('batch-optimize-concurrency-hint');
            if (hint && navigator.hardwareConcurrency) {
                hint.textContent = `建議值：≤ CPU 核心數 (${navigator.hardwareConcurrency})。預設 4。`;
            }
        } catch (e) {
            // ignore
        }
        
        console.log('[Batch Optimization] Initialized successfully');
    } catch (error) {
        console.error('[Batch Optimization] Initialization failed:', error);
    }
}

// 生成策略選項
function generateStrategyOptions() {
    try {
        const buyStrategiesList = document.getElementById('buy-strategies-list');
        const sellStrategiesList = document.getElementById('sell-strategies-list');
        
        if (!buyStrategiesList || !sellStrategiesList) {
            console.error('[Batch Optimization] Strategy lists not found');
            return;
        }
        
        // 清空現有內容
        buyStrategiesList.innerHTML = '';
        sellStrategiesList.innerHTML = '';
        
        // 買入策略 (做多進場)
        const buyStrategies = [
            'ma_cross', 'ma_above', 'rsi_oversold', 'macd_cross', 'bollinger_breakout',
            'k_d_cross', 'volume_spike', 'price_breakout', 'williams_oversold', 
            'ema_cross', 'turtle_breakout'
        ];
        
        // 賣出策略 (做多出場)
        const sellStrategies = [
            'ma_cross_exit', 'ma_below', 'rsi_overbought', 'macd_cross_exit', 'bollinger_reversal',
            'k_d_cross_exit', 'volume_spike', 'price_breakdown', 'williams_overbought',
            'ema_cross_exit', 'turtle_stop_loss', 'trailing_stop', 'fixed_stop_loss'
        ];
        
        // 生成買入策略選項
        buyStrategies.forEach(strategy => {
            const strategyInfo = strategyDescriptions[strategy];
            if (strategyInfo) {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input type="checkbox" id="buy-${strategy}" value="${strategy}" class="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2">
                    <label for="buy-${strategy}" class="text-sm text-gray-700 cursor-pointer">
                        ${strategyInfo.name}
                    </label>
                `;
                buyStrategiesList.appendChild(div);
            }
        });
        
        // 生成賣出策略選項
        sellStrategies.forEach(strategy => {
            const strategyInfo = strategyDescriptions[strategy];
            if (strategyInfo) {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input type="checkbox" id="sell-${strategy}" value="${strategy}" class="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2">
                    <label for="sell-${strategy}" class="text-sm text-gray-700 cursor-pointer">
                        ${strategyInfo.name}
                    </label>
                `;
                sellStrategiesList.appendChild(div);
            }
        });
        
        console.log('[Batch Optimization] Strategy options generated successfully');
    } catch (error) {
        console.error('[Batch Optimization] Error generating strategy options:', error);
    }
}

// 綁定事件
function bindBatchOptimizationEvents() {
    try {
        // 全選/清除按鈕
        const selectAllBuyBtn = document.getElementById('select-all-buy');
        if (selectAllBuyBtn) {
            selectAllBuyBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('#buy-strategies-list input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
            });
        }
        
        const selectAllSellBtn = document.getElementById('select-all-sell');
        if (selectAllSellBtn) {
            selectAllSellBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('#sell-strategies-list input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
            });
        }
        
        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                const checkboxes = document.querySelectorAll('#buy-strategies-list input[type="checkbox"], #sell-strategies-list input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = false);
            });
        }
        
        // 開始批量優化按鈕
        const startBtn = document.getElementById('start-batch-optimization');
        if (startBtn) {
            // 移除舊的事件監聽器
            startBtn.removeEventListener('click', startBatchOptimization);
            // 添加新的事件監聽器
            startBtn.addEventListener('click', startBatchOptimization);
        }
        
        // 停止批量優化按鈕
        const stopBtn = document.getElementById('stop-batch-optimization');
        if (stopBtn) {
            // 移除舊的事件監聽器
            stopBtn.removeEventListener('click', stopBatchOptimization);
            // 添加新的事件監聽器
            stopBtn.addEventListener('click', stopBatchOptimization);
        }
        
        // 排序相關
        const sortKeySelect = document.getElementById('batch-sort-key');
        if (sortKeySelect) {
            sortKeySelect.addEventListener('change', (e) => {
                batchOptimizationConfig.sortKey = e.target.value;
                sortBatchResults();
            });
        }
        
        const sortDirectionBtn = document.getElementById('batch-sort-direction');
        if (sortDirectionBtn) {
            sortDirectionBtn.addEventListener('click', () => {
                batchOptimizationConfig.sortDirection = batchOptimizationConfig.sortDirection === 'asc' ? 'desc' : 'asc';
                updateSortDirectionButton();
                sortBatchResults();
            });
        }
        
        console.log('[Batch Optimization] Events bound successfully');
    } catch (error) {
        console.error('[Batch Optimization] Error binding events:', error);
    }
}

// 開始批量優化
function startBatchOptimization() {
    console.log('[Batch Optimization] Starting batch optimization...');
    
    // 防止重複執行
    if (window.batchOptimizationRunning) {
        console.log('[Batch Optimization] Already running, skipping...');
        return;
    }
    
    // 重置停止標誌和開始時間
    isBatchOptimizationStopped = false;
    batchOptimizationStartTime = Date.now();
    
    // 初始化進度追蹤
    currentBatchProgress.startTime = Date.now();
    currentBatchProgress.current = 0;
    currentBatchProgress.total = 0;
    currentBatchProgress.phase = 'preparing';
    currentBatchProgress.isLongRunning = false;
    currentBatchProgress.estimatedTotalTime = null;
    
    window.batchOptimizationRunning = true;
    
    // 更新 UI - 顯示停止按鈕，隱藏/禁用開始按鈕
    const startBtn = document.getElementById('start-batch-optimization');
    const stopBtn = document.getElementById('stop-batch-optimization');
    
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.classList.add('opacity-50');
    }
    
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
    }
    
    // 驗證進出場條件不可為 null
    if (!validateBatchStrategies()) {
        restoreBatchOptimizationUI();
        return;
    }
    
    // 檢查是否有足夠的股票數據
    if (!cachedStockData || cachedStockData.length < 20) {
        showError('請先執行回測以建立快取股票數據，然後再進行批量優化');
        restoreBatchOptimizationUI();
        return;
    }
    
    try {
        // 獲取批量優化設定
        const config = getBatchOptimizationConfig();

        batchOptimizationConfig = {
            ...batchOptimizationConfig,
            ...config
        };

        const selectedStrategies = {
            buy: getSelectedStrategies('batch-buy-strategies'),
            sell: getSelectedStrategies('batch-sell-strategies')
        };

        const baseParamsSnapshot = typeof getBacktestParams === 'function'
            ? clonePlainObject(getBacktestParams())
            : {};

        startBatchDebugSession({
            phase: 'init',
            configSnapshot: clonePlainObject(config),
            selectedStrategies,
            baseParams: baseParamsSnapshot,
            cachedDataLength: Array.isArray(cachedStockData) ? cachedStockData.length : 0
        });

        recordBatchDebug('batch-start', {
            config: clonePlainObject(config),
            selectedStrategies,
            baseParams: baseParamsSnapshot
        }, { phase: 'init', consoleLevel: 'log' });

        // 重置結果
        batchOptimizationResults = [];
        recordBatchDebug('results-reset', {}, { phase: 'init', console: false });

        // 初始化 worker 狀態面板
        resetBatchWorkerStatus();
        const panel = document.getElementById('batch-worker-status-panel');
        if (panel) {
            panel.classList.remove('hidden');
        }

        // 顯示進度
        showBatchProgress();

        // 執行批量優化
        executeBatchOptimization(config);
    } catch (error) {
        console.error('[Batch Optimization] Error starting batch optimization:', error);
        showError('批量優化啟動失敗：' + error.message);
        restoreBatchOptimizationUI();
    }
}

// 驗證批量優化策略設定
function validateBatchStrategies() {
    console.log('[Batch Optimization] Validating strategies...');
    
    const buyStrategies = getSelectedStrategies('batch-buy-strategies');
    const sellStrategies = getSelectedStrategies('batch-sell-strategies');
    
    console.log('[Batch Optimization] Buy strategies:', buyStrategies);
    console.log('[Batch Optimization] Sell strategies:', sellStrategies);
    
    if (buyStrategies.length === 0) {
        showError('請至少選擇一個進場策略');
        return false;
    }
    
    if (sellStrategies.length === 0) {
        showError('請至少選擇一個出場策略');
        return false;
    }
    
    // 檢查選擇的策略是否為 null 或無效
    const invalidBuyStrategies = buyStrategies.filter(strategy => 
        !strategy || strategy === 'null' || !strategyDescriptions[strategy]
    );
    
    const invalidSellStrategies = sellStrategies.filter(strategy => 
        !strategy || strategy === 'null' || !strategyDescriptions[strategy]
    );
    
    if (invalidBuyStrategies.length > 0) {
        showError('進場策略包含無效選項，請重新選擇');
        return false;
    }
    
    if (invalidSellStrategies.length > 0) {
        showError('出場策略包含無效選項，請重新選擇');
        return false;
    }
    
    console.log('[Batch Optimization] Strategy validation passed');
    return true;
}

// 獲取選中的策略
function getSelectedStrategies(type) {
    console.log('[Batch Optimization] getSelectedStrategies called with type:', type);
    
    // 修正 ID 對應
    const idMapping = {
        'batch-buy-strategies': 'buy-strategies-list',
        'batch-sell-strategies': 'sell-strategies-list',
        'buy-strategies': 'buy-strategies-list',
        'sell-strategies': 'sell-strategies-list'
    };
    
    const actualId = idMapping[type] || type;
    console.log('[Batch Optimization] Using actual ID:', actualId);
    
    const checkboxes = document.querySelectorAll(`#${actualId} input[type="checkbox"]:checked`);
    console.log('[Batch Optimization] Found checkboxes:', checkboxes.length);
    
    const selected = Array.from(checkboxes).map(cb => {
        console.log('[Batch Optimization] Checkbox value:', cb.value);
        return cb.value;
    });
    
    console.log('[Batch Optimization] Selected strategies:', selected);
    return selected;
}

// 獲取批量優化設定
function getBatchOptimizationConfig() {
    try {
        // 初始化配置，設定預設值
        const config = {
            batchSize: 100,        // 預設批次大小
            maxCombinations: 10000, // 預設最大組合數  
            parameterTrials: 100,   // 預設參數優化次數
            targetMetric: 'annualizedReturn', // 預設優化目標指標
            concurrency: 4,         // 預設併發數
            iterationLimit: 6,      // 預設迭代上限
            optimizeTargets: ['annualizedReturn', 'sharpeRatio', 'maxDrawdown', 'sortinoRatio'] // 顯示所有指標
        };
        
        // 獲取參數優化次數
        const parameterTrialsElement = document.getElementById('batch-optimize-parameter-trials');
        if (parameterTrialsElement && parameterTrialsElement.value) {
            config.parameterTrials = parseInt(parameterTrialsElement.value) || 100;
        }
        
        // 獲取優化目標指標（單選按鈕）
        const targetMetricRadios = document.querySelectorAll('input[name="batch-target-metric"]:checked');
        if (targetMetricRadios.length > 0) {
            config.targetMetric = targetMetricRadios[0].value;
        }
        
        // 獲取併發數
        const concurrencyElement = document.getElementById('batch-optimize-concurrency');
        if (concurrencyElement && concurrencyElement.value) {
            config.concurrency = parseInt(concurrencyElement.value) || 4;
        }
        
        // 獲取迭代上限
        const iterationLimitElement = document.getElementById('batch-optimize-iteration-limit');
        if (iterationLimitElement && iterationLimitElement.value) {
            config.iterationLimit = parseInt(iterationLimitElement.value) || 6;
        }
        
        // 安全檢查優化目標
        const annualReturnElement = document.getElementById('optimize-annual-return');
        if (annualReturnElement && annualReturnElement.checked) {
        }
        
        const sharpeElement = document.getElementById('optimize-sharpe');
        if (sharpeElement && sharpeElement.checked) {
            config.optimizeTargets.push('sharpeRatio');
        }
        
        // 設定排序鍵值為選擇的目標指標
        config.sortKey = config.targetMetric;
        config.sortDirection = 'desc';
        
        return config;
    } catch (error) {
        console.error('[Batch Optimization] Error getting config:', error);
        // 返回預設設定
        return {
            batchSize: 100,
            maxCombinations: 10000,
            optimizeTargets: ['annualizedReturn'],
            sortKey: 'annualizedReturn',
            sortDirection: 'desc'
        };
    }
}

// 顯示進度區域
function showBatchProgress() {
    try {
        const progressElement = document.getElementById('batch-optimization-progress');
        const resultsElement = document.getElementById('batch-optimization-results');
        
        if (progressElement) {
            progressElement.classList.remove('hidden');
        }
        
        if (resultsElement) {
            resultsElement.classList.add('hidden');
        }
        
        // 重置進度
        currentBatchProgress = { current: 0, total: 0, phase: 'preparing' };
        updateBatchProgress();
    } catch (error) {
        console.error('[Batch Optimization] Error showing progress:', error);
    }
}

// 批量優化進度追蹤
let currentBatchProgress = {
    current: 0,
    total: 0,
    phase: 'preparing',
    startTime: null,
    lastUpdateTime: null,
    estimatedTotalTime: null,
    isLongRunning: false
};

// 獲取策略的中文名稱
function getStrategyChineseName(strategyKey) {
    if (typeof strategyDescriptions !== 'undefined' && strategyDescriptions[strategyKey]) {
        return strategyDescriptions[strategyKey].name || strategyKey;
    }
    return strategyKey;
}

// 獲取執行狀態的中文顯示
function getStatusChineseText(status) {
    const statusMap = {
        'preparing': '準備中',
        'running': '執行中',
        'optimizing': '優化中',
        'completed': '已完成',
        'failed': '失敗',
        'stopped': '已停止',
        'waiting': '等待中',
        'processing': '處理中'
    };
    return statusMap[status] || status;
}

// 重置批量優化進度
function resetBatchProgress() {
    currentBatchProgress = {
        current: 0,
        total: 0,
        phase: 'preparing',
        startTime: null,
        lastUpdateTime: null,
        estimatedTotalTime: null,
        isLongRunning: false
    };
    
    // 清空進度顯示
    const progressText = document.getElementById('batch-progress-text');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressDetail = document.getElementById('batch-progress-detail');
    const timeEstimate = document.getElementById('batch-time-estimate');
    const longWaitNotice = document.getElementById('batch-long-wait-notice');
    const hourglass = document.getElementById('batch-progress-hourglass');
    
    if (progressText) progressText.textContent = '0%';
    if (progressBar) progressBar.style.width = '0%';
    if (progressDetail) progressDetail.textContent = '已停止';
    if (timeEstimate) timeEstimate.textContent = '';
    if (longWaitNotice) longWaitNotice.classList.add('hidden');
    if (hourglass) hourglass.classList.remove('animate-spin');
}

// 更新進度顯示
function updateBatchProgress(currentCombination = null) {
    const progressText = document.getElementById('batch-progress-text');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressDetail = document.getElementById('batch-progress-detail');
    const progressCombination = document.getElementById('batch-progress-combination');
    const timeEstimate = document.getElementById('batch-time-estimate');
    const longWaitNotice = document.getElementById('batch-long-wait-notice');
    const hourglass = document.getElementById('batch-progress-hourglass');
    
    if (progressText && progressBar && progressDetail) {
        // 計算精確的百分比（每1%更新）
        const rawPercentage = currentBatchProgress.total > 0 ? 
            (currentBatchProgress.current / currentBatchProgress.total) * 100 : 0;
        const percentage = Math.floor(rawPercentage); // 確保是整數百分比
        
        // 避免NaN%問題
        const displayPercentage = isNaN(percentage) ? 0 : percentage;
        
        progressText.textContent = `${displayPercentage}%`;
        progressBar.style.width = `${displayPercentage}%`;
        
        // 顯示當前處理組合資訊
        if (progressCombination && currentCombination) {
            const { buyStrategy, sellStrategy, current, total } = currentCombination;
            const buyStrategyName = strategyDescriptions[buyStrategy]?.name || buyStrategy;
            const sellStrategyName = strategyDescriptions[sellStrategy]?.name || sellStrategy;
            progressCombination.textContent = `🔄 正在優化組合 ${current}/${total}：${buyStrategyName} + ${sellStrategyName}`;
        } else if (progressCombination) {
            progressCombination.textContent = '';
        }
        
        // 計算剩餘時間預估
        if (currentBatchProgress.startTime && currentBatchProgress.current > 0) {
            const elapsedTime = Date.now() - currentBatchProgress.startTime;
            const avgTimePerItem = elapsedTime / currentBatchProgress.current;
            const remaining = currentBatchProgress.total - currentBatchProgress.current;
            const estimatedRemainingTime = avgTimePerItem * remaining;
            
            // 更加保守的時間預估策略：
            // 1. 如果沒有初始預估，使用當前預估
            // 2. 如果有初始預估，使用較大值（更保守）
            // 3. 添加 20% 的緩衝時間避免預估過於樂觀
            const conservativeRemainingTime = estimatedRemainingTime * 1.2;
            
            if (!currentBatchProgress.estimatedTotalTime) {
                currentBatchProgress.estimatedTotalTime = conservativeRemainingTime;
            } else {
                // 使用移動平均來平滑預估時間，避免大幅波動
                const alpha = 0.3; // 平滑因子
                currentBatchProgress.estimatedTotalTime = 
                    alpha * conservativeRemainingTime + (1 - alpha) * currentBatchProgress.estimatedTotalTime;
            }
            
            // 顯示剩餘時間
            if (timeEstimate) {
                const remainingMinutes = Math.ceil(currentBatchProgress.estimatedTotalTime / 60000);
                if (remainingMinutes > 0) {
                    timeEstimate.textContent = `預估剩餘時間：約 ${remainingMinutes} 分鐘`;
                    
                    // 檢查是否為長時間運行
                    if (remainingMinutes > 2 && !currentBatchProgress.isLongRunning) {
                        currentBatchProgress.isLongRunning = true;
                        if (longWaitNotice) {
                            longWaitNotice.classList.remove('hidden');
                        }
                    }
                } else {
                    timeEstimate.textContent = '預估剩餘時間：不到1分鐘';
                }
            }
        }
        
        // 更新沙漏動畫
        if (hourglass) {
            if (currentBatchProgress.phase === 'optimizing' || currentBatchProgress.phase === 'preparing') {
                hourglass.classList.add('animate-spin');
            } else {
                hourglass.classList.remove('animate-spin');
            }
        }
        
        let detailText = '';
        switch (currentBatchProgress.phase) {
            case 'preparing':
                detailText = '準備策略組合...';
                break;
            case 'optimizing':
                detailText = `優化中... ${currentBatchProgress.current}/${currentBatchProgress.total}`;
                break;
                break;
            case 'completed':
                detailText = '優化完成！';
                break;
        }
        progressDetail.textContent = detailText;
    }
}

// 執行批量優化
async function executeBatchOptimization(config) {
    console.log('[Batch Optimization] executeBatchOptimization called with config:', config);

    recordBatchDebug('execute-start', {
        config: clonePlainObject(config),
        cachedDataLength: Array.isArray(cachedStockData) ? cachedStockData.length : 0
    }, { phase: 'execute', console: false });

    try {
        // 步驟1：取得策略列表
        let buyStrategies = getSelectedStrategies('batch-buy-strategies');
        let sellStrategies = getSelectedStrategies('batch-sell-strategies');

        console.log('[Batch Optimization] Retrieved strategies - Buy:', buyStrategies, 'Sell:', sellStrategies);

        recordBatchDebug('strategies-resolved', {
            buyStrategies: [...buyStrategies],
            sellStrategies: [...sellStrategies]
        }, { phase: 'prepare', consoleLevel: 'log' });

        updateBatchProgress(5, '準備策略參數優化...');

        // 步驟2：先生成所有選中的策略組合，然後逐個對每個組合依序優化參數
        console.log('[Batch Optimization] Generating strategy combinations...');
        const rawCombinations = generateStrategyCombinations(buyStrategies, sellStrategies);
        const totalRaw = rawCombinations.length;
        console.log(`[Batch Optimization] Generated ${totalRaw} raw strategy combinations`);

        recordBatchDebug('combinations-generated', {
            count: totalRaw,
            sample: rawCombinations.slice(0, Math.min(5, totalRaw)).map(summarizeCombination)
        }, { phase: 'prepare', console: false });

        updateBatchProgress(30, '對每個組合進行參數優化...');

        // 步驟3：針對每個組合進行並行的 per-combination 優化
        const optimizedCombinations = await optimizeCombinations(rawCombinations, config);

        recordBatchDebug('combinations-optimized', {
            count: optimizedCombinations.length,
            sample: optimizedCombinations.slice(0, Math.min(5, optimizedCombinations.length)).map(summarizeCombination)
        }, { phase: 'optimize', consoleLevel: 'log' });

        const totalCombinations = Math.min(optimizedCombinations.length, config.maxCombinations);
        console.log(`[Batch Optimization] Completed per-combination parameter optimization for ${optimizedCombinations.length} combinations`);

        // 限制組合數量
        const limitedCombinations = optimizedCombinations.slice(0, config.maxCombinations);

        recordBatchDebug('combinations-limited', {
            limit: config.maxCombinations,
            finalCount: limitedCombinations.length
        }, { phase: 'optimize', console: false });

        // 重置進度狀態，接著分批處理
        currentBatchProgress = {
            current: 0,
            total: limitedCombinations.length
        };

        updateBatchProgress(35, `開始處理 ${limitedCombinations.length} 個優化組合...`);

        // 分批處理
        const batches = [];
        for (let i = 0; i < limitedCombinations.length; i += config.batchSize) {
            batches.push(limitedCombinations.slice(i, i + config.batchSize));
        }

        console.log(`[Batch Optimization] Processing in ${batches.length} batches`);

        recordBatchDebug('batch-processing-start', {
            batchCount: batches.length,
            batchSize: config.batchSize,
            totalCombinations: limitedCombinations.length
        }, { phase: 'collect', consoleLevel: 'log' });

        // 開始處理每一批
        processBatch(batches, 0, config);
    } catch (error) {
        console.error('[Batch Optimization] Error in executeBatchOptimization:', error);
        recordBatchDebug('execute-error', {
            message: error?.message || String(error),
            stack: error?.stack || null
        }, { phase: 'execute', level: 'error', consoleLevel: 'error' });
        finalizeBatchDebugSession({ status: 'failed', stage: 'executeBatchOptimization', error: error?.message || String(error) });
        showError('批量優化執行失敗：' + error.message);
        hideBatchProgress();
        restoreBatchOptimizationUI();
    }
}

// 比較 metric 值，針對某些指標（例如 maxDrawdown）越小越好
function isBetterMetric(a, b, metric) {
    if (a === null || a === undefined || isNaN(a)) return false;
    if (b === null || b === undefined || isNaN(b)) return true;
    if (metric === 'maxDrawdown') {
        return Math.abs(a) < Math.abs(b);
    }
    return a > b;
}

// 取得 result 的目標指標值，若無則回傳 NaN
function getMetricFromResult(result, metric) {
    if (!result) return NaN;
    const val = result[metric];
    if (val === undefined || val === null || isNaN(val)) return NaN;
    return val;
}

// 用來深度比較參數物件是否相等（簡單 JSON 比較）
function paramsEqual(a, b) {
    try {
        return JSON.stringify(a || {}) === JSON.stringify(b || {});
    } catch (e) {
        return false;
    }
}

// 修復：實現真正的交替迭代優化直到收斂
// 模擬用戶手動操作：進場優化 ↔ 出場優化 直到參數不再改變
async function optimizeCombinationIterative(combination, config, options = {}) {
    console.log(`[Batch Optimization] Starting iterative combination optimization for ${combination.buyStrategy} + ${combination.sellStrategy}`);

    const maxIterations = (config && typeof config.iterationLimit !== 'undefined') ? (parseInt(config.iterationLimit, 10) || 6) : 6;

    const enabledScopes = Array.isArray(options?.enabledScopes) && options.enabledScopes.length > 0
        ? new Set(options.enabledScopes)
        : null;
    const allowEntryOptimization = !enabledScopes || enabledScopes.has('entry');
    const allowExitOptimization = !enabledScopes || enabledScopes.has('exit');

    let currentCombo = {
        buyStrategy: combination.buyStrategy,
        sellStrategy: combination.sellStrategy,
        buyParams: { ...combination.buyParams },
        sellParams: { ...combination.sellParams },
        riskManagement: combination.riskManagement
    };

    recordBatchDebug('combo-iteration-start', {
        combination: summarizeCombination(currentCombo),
        maxIterations,
        enabledScopes: options?.enabledScopes || null
    }, { phase: 'optimize', console: false });

    try {
        console.log(`[Batch Optimization] Initial combination:`, {
            buyStrategy: currentCombo.buyStrategy,
            buyParams: currentCombo.buyParams,
            sellStrategy: currentCombo.sellStrategy,
            sellParams: currentCombo.sellParams,
            riskManagement: currentCombo.riskManagement
        });

        // 修復：實現策略間的交替迭代優化直到收斂
        // 這模擬了用戶手動操作的完整過程
        for (let iter = 0; iter < maxIterations; iter++) {
            console.log(`[Batch Optimization] === Iteration ${iter + 1}/${maxIterations} ===`);

            recordBatchDebug('combo-iteration-cycle', {
                iteration: iter + 1,
                combination: summarizeCombination(currentCombo)
            }, { phase: 'optimize', console: false });

            // 記錄本輪迭代前的參數
            const prevBuyParams = JSON.parse(JSON.stringify(currentCombo.buyParams || {}));
            const prevSellParams = JSON.parse(JSON.stringify(currentCombo.sellParams || {}));
            
            // Phase 1: 優化進場策略的所有參數直到內部收斂
            console.log(`[Batch Optimization] Phase 1: Optimizing entry strategy ${currentCombo.buyStrategy}`);
            if (allowEntryOptimization && currentCombo.buyStrategy && strategyDescriptions[currentCombo.buyStrategy]) {
                const optimizedEntryParams = await optimizeStrategyWithInternalConvergence(
                    currentCombo.buyStrategy,
                    'entry',
                    strategyDescriptions[currentCombo.buyStrategy],
                    config.targetMetric,
                    config.parameterTrials,
                    currentCombo, // 包含當前出場參數的完整上下文
                    options
                );

                // 更新進場參數
                currentCombo.buyParams = { ...optimizedEntryParams };
                console.log(`[Batch Optimization] Updated entry params:`, optimizedEntryParams);
            } else if (!allowEntryOptimization) {
                console.log('[Batch Optimization] Entry optimization skipped by scope configuration');
            }

            // Phase 2: 基於最新進場參數，優化出場策略的所有參數直到內部收斂
            console.log(`[Batch Optimization] Phase 2: Optimizing exit strategy ${currentCombo.sellStrategy}`);
            if (allowExitOptimization && currentCombo.sellStrategy && strategyDescriptions[currentCombo.sellStrategy]) {
                const optimizedExitParams = await optimizeStrategyWithInternalConvergence(
                    currentCombo.sellStrategy,
                    'exit',
                    strategyDescriptions[currentCombo.sellStrategy],
                    config.targetMetric,
                    config.parameterTrials,
                    currentCombo, // 包含已更新的進場參數
                    options
                );

                // 更新出場參數
                currentCombo.sellParams = { ...optimizedExitParams };
                console.log(`[Batch Optimization] Updated exit params:`, optimizedExitParams);
            } else if (!allowExitOptimization) {
                console.log('[Batch Optimization] Exit optimization skipped by scope configuration');
            }

            // Phase 3: 檢查策略間是否收斂
            const entryConverged = paramsEqual(prevBuyParams, currentCombo.buyParams);
            const exitConverged = paramsEqual(prevSellParams, currentCombo.sellParams);
            
            console.log(`[Batch Optimization] Convergence check - Entry: ${entryConverged}, Exit: ${exitConverged}`);
            
            if (entryConverged && exitConverged) {
                console.log(`[Batch Optimization] ✓ Converged after ${iter + 1} iterations`);
                break;
            }
            
            // 顯示本輪變化
            if (!entryConverged) {
                console.log(`[Batch Optimization] Entry params changed:`, {
                    from: prevBuyParams,
                    to: currentCombo.buyParams
                });
            }
            if (!exitConverged) {
                console.log(`[Batch Optimization] Exit params changed:`, {
                    from: prevSellParams,
                    to: currentCombo.sellParams
                });
            }
        }

        // 最終驗證：執行完整回測確認結果
        const finalResult = await executeBacktestForCombination(currentCombo, options);
        const finalMetric = getMetricFromResult(finalResult, config.targetMetric);
        console.log(`[Batch Optimization] Final combination metric (${config.targetMetric}): ${finalMetric.toFixed(4)}`);

        currentCombo.__finalResult = finalResult || null;
        currentCombo.__finalMetric = Number.isFinite(finalMetric) ? finalMetric : null;
        currentCombo.__metricLabel = config.targetMetric;

        if (!finalResult) {
            recordBatchDebug('combo-iteration-missing-result', {
                combination: summarizeCombination(currentCombo)
            }, { phase: 'optimize', level: 'warn', consoleLevel: 'warn' });
        }

        recordBatchDebug('combo-iteration-final', {
            combination: summarizeCombination(currentCombo),
            finalMetric: currentCombo.__finalMetric,
            metricLabel: currentCombo.__metricLabel
        }, { phase: 'optimize', console: false });

        return currentCombo;

    } catch (error) {
        console.error(`[Batch Optimization] Error in iterative optimization for ${combination.buyStrategy} + ${combination.sellStrategy}:`, error);
        recordBatchDebug('combo-iteration-error', {
            combination: summarizeCombination(combination),
            message: error?.message || String(error),
            stack: error?.stack || null
        }, { phase: 'optimize', level: 'error', consoleLevel: 'error' });
        // 返回原始組合作為備用
        return combination;
    }
}

// 新增：策略內參數迭代優化直到內部收斂
// 這模擬了用戶在單一策略內反覆優化參數的過程
async function optimizeStrategyWithInternalConvergence(strategy, strategyType, strategyInfo, targetMetric, trials, baseCombo, options = {}) {
    console.log(`[Batch Optimization] Starting internal convergence optimization for ${strategy}`);

    const maxInternalIterations = 5; // 策略內參數迭代次數限制
    const optimizeTargets = strategyInfo.optimizeTargets;
    const baseParamsOverride = options?.baseParamsOverride;

    if (!optimizeTargets || optimizeTargets.length === 0) {
        console.log(`[Batch Optimization] No parameters to optimize for ${strategy}`);
        return strategyInfo.defaultParams || {};
    }
    
    // 初始化參數：使用組合中的當前參數
    let currentParams = strategyType === 'entry' ? 
        { ...baseCombo.buyParams } : 
        { ...baseCombo.sellParams };
    
    // 如果當前參數為空，使用預設參數
    if (!currentParams || Object.keys(currentParams).length === 0) {
        currentParams = { ...strategyInfo.defaultParams };
    }
    
    console.log(`[Batch Optimization] Initial ${strategyType} params for ${strategy}:`, currentParams);
    
    // 策略內參數迭代優化直到收斂
    for (let iter = 0; iter < maxInternalIterations; iter++) {
        console.log(`[Batch Optimization] ${strategy} internal iteration ${iter + 1}/${maxInternalIterations}`);
        
        const prevParams = JSON.parse(JSON.stringify(currentParams));
        
        // 逐個優化策略內的每個參數
        for (let i = 0; i < optimizeTargets.length; i++) {
            const optimizeTarget = optimizeTargets[i];
            console.log(`[Batch Optimization] Optimizing ${strategy}.${optimizeTarget.name}...`);
            
            // 構建完整的 baseParams
            const baseParams = baseParamsOverride
                ? prepareBaseParamsForOptimization(baseParamsOverride)
                : getBacktestParams();

            if (baseParamsOverride) {
                ['stockNo', 'startDate', 'endDate', 'market', 'marketType', 'adjustedPrice', 'splitAdjustment', 'tradeTiming', 'initialCapital', 'positionSize', 'enableShorting', 'entryStages', 'exitStages'].forEach((key) => {
                    if (baseParamsOverride[key] !== undefined) {
                        baseParams[key] = Array.isArray(baseParamsOverride[key])
                            ? [...baseParamsOverride[key]]
                            : baseParamsOverride[key];
                    }
                });
            }

            // 設定當前策略的參數
            if (strategyType === 'entry') {
                const workerEntryStrategy = resolveWorkerStrategyName(strategy);
                if (workerEntryStrategy) {
                    baseParams.entryStrategy = workerEntryStrategy;
                }
                baseParams.entryParams = { ...currentParams };
                // 包含完整的出場參數
                if (baseCombo && baseCombo.sellParams) {
                    baseParams.exitParams = { ...baseCombo.sellParams };
                    const workerExitStrategy = resolveWorkerStrategyName(baseCombo.sellStrategy);
                    if (workerExitStrategy) {
                        baseParams.exitStrategy = workerExitStrategy;
                    }
                }
            } else {
                const workerExitStrategy = resolveWorkerStrategyName(strategy);
                if (workerExitStrategy) {
                    baseParams.exitStrategy = workerExitStrategy;
                }
                baseParams.exitParams = { ...currentParams };
                // 包含完整的進場參數
                if (baseCombo && baseCombo.buyParams) {
                    baseParams.entryParams = { ...baseCombo.buyParams };
                    const workerEntryStrategy = resolveWorkerStrategyName(baseCombo.buyStrategy);
                    if (workerEntryStrategy) {
                        baseParams.entryStrategy = workerEntryStrategy;
                    }
                }
            }
            
            // 包含風險管理參數
            if (baseCombo && baseCombo.riskManagement) {
                baseParams.stopLoss = baseCombo.riskManagement.stopLoss || 0;
                baseParams.takeProfit = baseCombo.riskManagement.takeProfit || 0;
            }
            
            // 優化當前參數
            const bestParam = await optimizeSingleStrategyParameter(
                baseParams,
                optimizeTarget,
                strategyType,
                targetMetric,
                Math.max(1, parseInt(trials, 10) || 1),
                { cachedDataOverride: options?.cachedDataOverride }
            );
            
            if (bestParam.value !== undefined) {
                currentParams[optimizeTarget.name] = bestParam.value;
                console.log(`[Batch Optimization] Updated ${strategy}.${optimizeTarget.name}: ${bestParam.value} (${targetMetric}: ${bestParam.metric.toFixed(4)})`);
            }
        }
        
        // 檢查策略內是否收斂
        const converged = paramsEqual(prevParams, currentParams);
        console.log(`[Batch Optimization] ${strategy} internal convergence: ${converged}`);
        
        if (converged) {
            console.log(`[Batch Optimization] ✓ ${strategy} converged after ${iter + 1} internal iterations`);
            break;
        }
        
        console.log(`[Batch Optimization] ${strategy} params changed:`, {
            from: prevParams,
            to: currentParams
        });
    }
    
    console.log(`[Batch Optimization] Final ${strategy} params:`, currentParams);
    return currentParams;
}


// 對所有組合依序執行 optimizeCombinationIterative（可改為批次並行以加速）
async function optimizeCombinations(combinations, config) {
    const optimized = [];

    const maxConcurrency = config.optimizeConcurrency || navigator.hardwareConcurrency || 4;
    console.log(`[Batch Optimization] Running per-combination optimization with concurrency = ${maxConcurrency}`);

    recordBatchDebug('combo-optimize-start', {
        total: combinations.length,
        concurrency: maxConcurrency,
        iterationLimit: config.iterationLimit,
        parameterTrials: config.parameterTrials
    }, { phase: 'optimize', console: false });

    // 初始化狀態面板
    batchWorkerStatus.concurrencyLimit = maxConcurrency;
    batchWorkerStatus.inFlightCount = 0;
    batchWorkerStatus.entries = combinations.map((c, idx) => ({ index: idx + 1, buyStrategy: c.buyStrategy, sellStrategy: c.sellStrategy, status: 'queued', startTime: null, endTime: null }));
    renderBatchWorkerStatus();

    let index = 0;
    const inFlight = new Set();

    return new Promise((resolve) => {
        function launchNext() {
            if (isBatchOptimizationStopped) {
                console.log('[Batch Optimization] Stopped during per-combination optimization');
                // 等待現有任務完成後返回
                if (inFlight.size === 0) resolve(optimized);
                return;
            }

            while (index < combinations.length && inFlight.size < maxConcurrency) {
                const i = index++;
                const combo = combinations[i];

                recordBatchDebug('combo-optimize-launch', {
                    index: i + 1,
                    total: combinations.length,
                    combination: summarizeCombination(combo)
                }, { phase: 'optimize', console: false });

                const p = optimizeCombinationIterative(combo, config)
                    .then(res => {
                        optimized[i] = res;

                        // 標記為完成
                        const entry = batchWorkerStatus.entries[i];
                        if (entry) {
                            entry.status = 'done';
                            entry.endTime = Date.now();
                        }

                        // 更新進度（以整體百分比顯示）
                        const completedCount = optimized.filter(Boolean).length;
                        updateBatchProgress(30 + (completedCount / combinations.length) * 30, `優化組合 ${completedCount}/${combinations.length}`);

                        recordBatchDebug('combo-optimize-complete', {
                            index: i + 1,
                            combination: summarizeCombination(res),
                            metric: res ? res.__finalMetric : null,
                            metricLabel: res ? res.__metricLabel : null
                        }, { phase: 'optimize', console: false });
                    })
                    .catch(err => {
                        console.error('[Batch Optimization] Error optimizing combination:', err);
                        optimized[i] = combo; // fallback

                        const entry = batchWorkerStatus.entries[i];
                        if (entry) {
                            entry.status = 'error';
                            entry.endTime = Date.now();
                            entry.error = (err && err.message) ? err.message : String(err);
                        }

                        recordBatchDebug('combo-optimize-error', {
                            index: i + 1,
                            combination: summarizeCombination(combo),
                            message: err?.message || String(err),
                            stack: err?.stack || null
                        }, { phase: 'optimize', level: 'error', consoleLevel: 'error' });
                    })
                    .finally(() => {
                        inFlight.delete(p);
                        batchWorkerStatus.inFlightCount = inFlight.size;
                        renderBatchWorkerStatus();

                        // 如果還有可以啟動的任務，繼續啟動
                        if (index < combinations.length) {
                            launchNext();
                        } else if (inFlight.size === 0) {
                            // 全部完成
                            renderBatchWorkerStatus();
                            recordBatchDebug('combo-optimize-finish', {
                                total: combinations.length,
                                completed: optimized.filter(Boolean).length
                            }, { phase: 'optimize', console: false });
                            resolve(optimized.filter(Boolean));
                        }
                    });

                inFlight.add(p);

                // 更新狀態：任務從 queued -> running
                const entry = batchWorkerStatus.entries[i];
                if (entry) {
                    entry.status = 'running';
                    entry.startTime = Date.now();
                }
                batchWorkerStatus.inFlightCount = inFlight.size;
                renderBatchWorkerStatus();
            }
        }

        // 啟動初始併發
        launchNext();
    });
}

// 獲取策略預設參數
function getDefaultStrategyParams(strategy) {
    try {
        const strategyInfo = strategyDescriptions[strategy];
        if (strategyInfo && strategyInfo.defaultParams) {
            return { ...strategyInfo.defaultParams };
        }
        return {};
    } catch (error) {
        console.error(`[Batch Optimization] Error getting default params for strategy ${strategy}:`, error);
        return {};
    }
}

// 分批處理
function computeCombinationDifferences(headlessSummary, batchSummary) {
    if (!headlessSummary || !batchSummary) {
        return { missing: true };
    }

    const differences = {};
    if ((headlessSummary.buyStrategy || null) !== (batchSummary.buyStrategy || null)
        || (headlessSummary.sellStrategy || null) !== (batchSummary.sellStrategy || null)) {
        differences.strategy = {
            headlessBuy: headlessSummary.buyStrategy || null,
            batchBuy: batchSummary.buyStrategy || null,
            headlessSell: headlessSummary.sellStrategy || null,
            batchSell: batchSummary.sellStrategy || null
        };
    }

    const scopes = ['buyParams', 'sellParams', 'riskManagement'];
    scopes.forEach((scope) => {
        const headlessParams = headlessSummary[scope] || {};
        const batchParams = batchSummary[scope] || {};
        const keys = new Set([...Object.keys(headlessParams), ...Object.keys(batchParams)]);
        const mismatches = [];

        keys.forEach((key) => {
            const headlessValue = headlessParams[key];
            const batchValue = batchParams[key];
            if (JSON.stringify(headlessValue) !== JSON.stringify(batchValue)) {
                mismatches.push({ key, headless: headlessValue, batch: batchValue });
            }
        });

        if (mismatches.length > 0) {
            differences[scope] = mismatches;
        }
    });

    return Object.keys(differences).length > 0 ? differences : null;
}

function recordHeadlessBatchComparison(bestResult) {
    try {
        if (!lastHeadlessOptimizationSummary) {
            recordBatchDebug('headless-compare-skip', {
                reason: 'no-headless-summary',
                batchBest: bestResult ? summarizeCombination(bestResult) : null
            }, { phase: 'collect', console: false });
            return;
        }

        const summary = lastHeadlessOptimizationSummary;
        const metricLabel = summary.metricLabel || batchOptimizationConfig.targetMetric || 'annualizedReturn';
        const headlessMetric = Number.isFinite(summary.metric) ? summary.metric : null;
        const batchMetricValue = bestResult ? getMetricFromResult(bestResult, metricLabel) : NaN;
        const batchMetric = Number.isFinite(batchMetricValue) ? batchMetricValue : null;
        const metricDelta = headlessMetric !== null && batchMetric !== null ? batchMetric - headlessMetric : null;
        const matched = metricDelta !== null ? Math.abs(metricDelta) <= 1e-6 : false;

        const headlessCombination = summary.combination || null;
        const batchCombination = bestResult ? summarizeCombination(bestResult) : null;
        const differences = computeCombinationDifferences(headlessCombination, batchCombination);

        recordBatchDebug('headless-compare', {
            matched,
            metricLabel,
            headlessMetric,
            batchMetric,
            metricDelta,
            headlessCombination,
            batchCombination,
            differences,
            headlessTimestamp: summary.timestamp,
            headlessSource: summary.source || 'external-headless'
        }, {
            phase: 'collect',
            console: matched ? false : 'warn',
            consoleLevel: matched ? 'log' : 'warn',
            level: matched ? 'info' : 'warn'
        });

        if (!matched) {
            console.warn('[Batch Optimization] Headless optimization and batch panel best metrics differ:', {
                metricLabel,
                headlessMetric,
                batchMetric,
                metricDelta,
                headlessCombination,
                batchCombination,
                differences
            });
        }

        summary.lastComparedAt = Date.now();
        summary.lastComparisonMatched = matched;
        summary.lastComparisonDelta = metricDelta;
    } catch (error) {
        console.error('[Batch Optimization] Failed to compare headless and batch results:', error);
        recordBatchDebug('headless-compare-error', {
            message: error?.message || String(error),
            stack: error?.stack || null
        }, { phase: 'collect', level: 'error', consoleLevel: 'error' });
    }
}

function processBatch(batches, batchIndex, config) {
    // 檢查是否被停止
    if (isBatchOptimizationStopped) {
        console.log('[Batch Optimization] Process stopped by user');
        recordBatchDebug('batch-stopped', { batchIndex }, { phase: 'collect', level: 'warn', consoleLevel: 'warn' });
        return;
    }

    if (batchIndex >= batches.length) {
        // 所有批次處理完成
        updateBatchProgress(100, '批量優化完成');

        // 顯示結果並恢復 UI
        showBatchResults();
        restoreBatchOptimizationUI();
        const bestResult = batchOptimizationResults && batchOptimizationResults.length > 0
            ? summarizeResult(batchOptimizationResults[0])
            : null;
        if (batchOptimizationResults && batchOptimizationResults.length > 0) {
            recordHeadlessBatchComparison(batchOptimizationResults[0]);
        } else {
            recordHeadlessBatchComparison(null);
        }
        finalizeBatchDebugSession({
            status: 'completed',
            processedBatches: batches.length,
            resultCount: batchOptimizationResults.length,
            bestResult
        });
        return;
    }

    const currentBatch = batches[batchIndex];
    console.log(`[Batch Optimization] Processing batch ${batchIndex + 1}/${batches.length} with ${currentBatch.length} combinations`);

    recordBatchDebug('batch-processing', {
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        batchSize: currentBatch.length
    }, { phase: 'collect', console: false });

    // 計算進度百分比
    const progressPercentage = 35 + ((batchIndex / batches.length) * 65);
    updateBatchProgress(progressPercentage, `處理批次 ${batchIndex + 1}/${batches.length}...`);

    // 處理當前批次
    processStrategyCombinations(currentBatch, config).then(() => {
        // 檢查是否被停止
        if (isBatchOptimizationStopped) {
            console.log('[Batch Optimization] Process stopped by user');
            return;
        }

        // 處理下一批次
        setTimeout(() => {
            processBatch(batches, batchIndex + 1, config);
        }, 100); // 小延遲避免阻塞UI
    }).catch(error => {
        console.error('[Batch Optimization] Error processing batch:', error);
        recordBatchDebug('batch-error', {
            batchIndex: batchIndex + 1,
            message: error?.message || String(error),
            stack: error?.stack || null
        }, { phase: 'collect', level: 'error', consoleLevel: 'error' });
        finalizeBatchDebugSession({ status: 'failed', stage: 'processBatch', error: error?.message || String(error) });
        restoreBatchOptimizationUI();
    });
}

// 處理策略組合
async function processStrategyCombinations(combinations, config) {
    const results = [];
    
    for (let i = 0; i < combinations.length; i++) {
        // 檢查是否被停止
        if (isBatchOptimizationStopped) {
            console.log('[Batch Optimization] Process stopped by user during combination processing');
            break;
        }

        const combination = combinations[i];

        // 更新進度顯示，包含當前組合資訊
        const combinationInfo = {
            buyStrategy: combination.buyStrategy,
            sellStrategy: combination.sellStrategy,
            current: currentBatchProgress.current + 1,
            total: currentBatchProgress.total
        };

        recordBatchDebug('combination-start', {
            index: i + 1,
            total: combinations.length,
            combination: summarizeCombination(combination)
        }, { phase: 'backtest', console: false });

        try {
            // 執行回測
            const result = await executeBacktestForCombination(combination);
            if (result) {
                // 確保保留原始的策略 ID，不被 worker 結果覆蓋
                const combinedResult = {
                    ...result,
                    // 強制保留原始的策略 ID 和參數，覆蓋任何從 worker 來的值
                    buyStrategy: combination.buyStrategy,
                    sellStrategy: combination.sellStrategy,
                    buyParams: combination.buyParams,
                    sellParams: combination.sellParams
                };
                
                // 保留風險管理參數（如果有的話）
                if (combination.riskManagement) {
                    combinedResult.riskManagement = combination.riskManagement;
                    console.log(`[Batch Debug] Preserved risk management:`, combination.riskManagement);
                }
                
                // 移除可能會造成混淆的字段
                delete combinedResult.entryStrategy;
                delete combinedResult.exitStrategy;
                delete combinedResult.entryParams;
                delete combinedResult.exitParams;

                console.log(`[Batch Debug] Strategy preserved: ${combination.buyStrategy} -> ${combination.sellStrategy}`);
                console.log(`[Batch Debug] Final result sellStrategy:`, combinedResult.sellStrategy);
                results.push(combinedResult);

                recordBatchDebug('combination-complete', {
                    index: i + 1,
                    combination: summarizeCombination(combination),
                    result: summarizeResult(combinedResult)
                }, { phase: 'backtest', console: false });
            } else {
                recordBatchDebug('combination-no-result', {
                    index: i + 1,
                    combination: summarizeCombination(combination)
                }, { phase: 'backtest', level: 'warn', consoleLevel: 'warn' });
            }
        } catch (error) {
            console.error(`[Batch Optimization] Error processing combination:`, error);
            recordBatchDebug('combination-error', {
                index: i + 1,
                combination: summarizeCombination(combination),
                message: error?.message || String(error),
                stack: error?.stack || null
            }, { phase: 'backtest', level: 'error', consoleLevel: 'error' });
        }

        // 更新進度
        currentBatchProgress.current++;
        if (currentBatchProgress.current % 10 === 0) { // 每10個更新一次進度
            updateBatchProgress(combinationInfo);
        }
    }

    // 將結果添加到全局結果中
    batchOptimizationResults.push(...results);

    if (results.length === 0) {
        recordBatchDebug('combination-batch-empty', {
            processed: combinations.length
        }, { phase: 'backtest', level: 'warn', consoleLevel: 'warn' });
    } else {
        recordBatchDebug('batch-results-appended', {
            appended: results.length,
            total: batchOptimizationResults.length,
            sample: results.slice(0, Math.min(5, results.length)).map(summarizeResult)
        }, { phase: 'backtest', console: false });
    }

    console.log(`[Batch Optimization] Processed ${combinations.length} combinations, total results: ${batchOptimizationResults.length}`);
}

// 執行單個策略組合的回測
async function executeBacktestForCombination(combination, options = {}) {
    return new Promise((resolve) => {
        try {
            // 使用現有的回測邏輯
            const baseParamsOverride = options?.baseParamsOverride;
            const params = baseParamsOverride
                ? prepareBaseParamsForOptimization(baseParamsOverride)
                : getBacktestParams();

            if (baseParamsOverride) {
                ['stockNo', 'startDate', 'endDate', 'market', 'marketType', 'adjustedPrice', 'splitAdjustment', 'tradeTiming', 'initialCapital', 'positionSize', 'enableShorting', 'entryStages', 'exitStages'].forEach((key) => {
                    if (baseParamsOverride[key] !== undefined) {
                        params[key] = Array.isArray(baseParamsOverride[key])
                            ? [...baseParamsOverride[key]]
                            : baseParamsOverride[key];
                    }
                });
            }

            // 更新策略設定（使用 worker 能理解的策略名稱）
            const workerEntryStrategy = resolveWorkerStrategyName(combination.buyStrategy);
            if (workerEntryStrategy) {
                params.entryStrategy = workerEntryStrategy;
            }
            const workerExitStrategy = resolveWorkerStrategyName(combination.sellStrategy);
            if (workerExitStrategy) {
                params.exitStrategy = workerExitStrategy;
            } else if (!combination.sellStrategy) {
                delete params.exitStrategy;
            }
            params.entryParams = combination.buyParams ? { ...combination.buyParams } : {};
            params.exitParams = combination.sellParams ? { ...combination.sellParams } : {};

            // 如果有風險管理參數，則應用到全局設定中
            if (combination.riskManagement) {
                if (combination.riskManagement.stopLoss !== undefined) {
                    params.stopLoss = combination.riskManagement.stopLoss;
                }
                if (combination.riskManagement.takeProfit !== undefined) {
                    params.takeProfit = combination.riskManagement.takeProfit;
                }
                console.log(`[Batch Optimization] Applied risk management:`, combination.riskManagement);
            }

            recordBatchDebug('worker-run-start', {
                combination: summarizeCombination(combination),
                useOverride: Boolean(baseParamsOverride)
            }, { phase: 'worker', console: false });

            // 創建臨時worker執行回測
            if (workerUrl) {
                const tempWorker = new Worker(workerUrl);

                const overrideData = Array.isArray(options?.cachedDataOverride) && options.cachedDataOverride.length > 0
                    ? options.cachedDataOverride
                    : null;
                const cachedPayload = overrideData
                    || (typeof cachedStockData !== 'undefined' && Array.isArray(cachedStockData) ? cachedStockData : null);
                const useCachedData = Array.isArray(cachedPayload) && cachedPayload.length > 0;

                tempWorker.onmessage = function(e) {
                    if (e.data.type === 'result') {
                        const result = e.data.data;

                        // 確保結果包含實際使用的停損停利參數
                        if (result) {
                            result.usedStopLoss = params.stopLoss;
                            result.usedTakeProfit = params.takeProfit;
                            console.log(`[Batch Optimization] Backtest completed with stopLoss: ${params.stopLoss}, takeProfit: ${params.takeProfit}`);
                        }

                        recordBatchDebug('worker-run-result', {
                            combination: summarizeCombination(combination),
                            result: summarizeResult(result),
                            usedCachedData: useCachedData
                        }, { phase: 'worker', console: false });

                        tempWorker.terminate();
                        resolve(result);
                    } else if (e.data.type === 'error') {
                        console.error('[Batch Optimization] Worker error:', e.data.data?.message || e.data.error);
                        recordBatchDebug('worker-run-error', {
                            combination: summarizeCombination(combination),
                            message: e.data.data?.message || e.data.error
                        }, { phase: 'worker', level: 'error', consoleLevel: 'error' });
                        tempWorker.terminate();
                        resolve(null);
                    }
                };

                tempWorker.onerror = function(error) {
                    console.error('[Batch Optimization] Worker error:', error);
                    recordBatchDebug('worker-run-error', {
                        combination: summarizeCombination(combination),
                        message: error?.message || String(error),
                        stack: error?.stack || null
                    }, { phase: 'worker', level: 'error', consoleLevel: 'error' });
                    tempWorker.terminate();
                    resolve(null);
                };

                const preparedParams = enrichParamsWithLookback(params);
                tempWorker.postMessage({
                    type: 'runBacktest',
                    params: preparedParams,
                    useCachedData,
                    cachedData: cachedPayload
                });

                // 設定超時
                setTimeout(() => {
                    tempWorker.terminate();
                    recordBatchDebug('worker-run-timeout', {
                        combination: summarizeCombination(combination)
                    }, { phase: 'worker', level: 'warn', consoleLevel: 'warn' });
                    resolve(null);
                }, 30000); // 30秒超時
            } else {
                console.warn('[Batch Optimization] Worker URL not available');
                recordBatchDebug('worker-missing-url', {
                    combination: summarizeCombination(combination)
                }, { phase: 'worker', level: 'error', consoleLevel: 'error' });
                resolve(null);
            }
        } catch (error) {
            console.error('[Batch Optimization] Error in executeBacktestForCombination:', error);
            recordBatchDebug('worker-run-exception', {
                combination: summarizeCombination(combination),
                message: error?.message || String(error),
                stack: error?.stack || null
            }, { phase: 'worker', level: 'error', consoleLevel: 'error' });
            resolve(null);
        }
    });
}

// 優化策略參數
async function optimizeStrategyParameters(strategy, strategyType, targetMetric, trials = 100) {
    return new Promise((resolve) => {
        try {
            const strategyInfo = strategyDescriptions[strategy];
            
            // 檢查是否為風險管理控制策略
            const isRiskManagementStrategy = strategy === 'fixed_stop_loss' || strategy === 'cover_fixed_stop_loss';
            
            if (isRiskManagementStrategy) {
                console.log(`[Batch Optimization] Optimizing risk management parameters for ${strategy} (${targetMetric})`);
                
                // 對於風險管理策略，優化停損和停利參數
                const params = getBacktestParams();
                
                // 修復：使用與單次風險管理優化相同的參數範圍和步長
                // 確保批量優化和單次優化的搜索空間一致
                const globalStopLossConfig = globalOptimizeTargets.stopLoss;
                const globalTakeProfitConfig = globalOptimizeTargets.takeProfit;
                
                // 定義風險管理參數的優化範圍（與單次優化一致）
                const riskOptimizeTargets = [
                    {
                        name: 'stopLoss',
                        range: globalStopLossConfig.range // 使用全局配置：{from: 1, to: 30, step: 0.5}
                    },
                    {
                        name: 'takeProfit', 
                        range: globalTakeProfitConfig.range // 使用全局配置：{from: 5, to: 100, step: 1}
                    }
                ];
                
                console.log(`[Batch Optimization] Risk management optimization ranges (consistent with single optimization):`, riskOptimizeTargets);
                
                // 順序優化兩個參數：先優化停損，再基於最佳停損值優化停利
                optimizeRiskManagementParameters(params, riskOptimizeTargets, targetMetric, trials)
                    .then(resolve)
                    .catch(error => {
                        console.error('[Batch Optimization] Risk management optimization error:', error);
                        resolve({});
                    });
                
                return;
            }
            
            // 原本的策略參數優化邏輯
            if (!strategyInfo || !strategyInfo.optimizeTargets || strategyInfo.optimizeTargets.length === 0) {
                // 如果沒有可優化的參數，返回預設參數
                resolve(strategyInfo?.defaultParams || {});
                return;
            }
            
            console.log(`[Batch Optimization] Optimizing ${strategy} parameters for ${targetMetric}`);
            console.log(`[Batch Optimization] Found ${strategyInfo.optimizeTargets.length} parameters to optimize:`, 
                strategyInfo.optimizeTargets.map(t => t.name));
            
            // 對所有可優化參數進行順序優化
            optimizeMultipleStrategyParameters(strategy, strategyType, strategyInfo, targetMetric, trials)
                .then(resolve)
                .catch(error => {
                    console.error('[Batch Optimization] Strategy parameters optimization error:', error);
                    resolve(strategyInfo?.defaultParams || {});
                });
                
            return;
        } catch (error) {
            console.error('[Batch Optimization] Error in optimizeStrategyParameters:', error);
            resolve(strategyDescriptions[strategy]?.defaultParams || {});
        }
    });
}

// 優化多個策略參數
// 修復：正確初始化 baseParams，確保包含當前組合的完整參數
// 這是批量優化無法找到最佳參數的關鍵問題：之前使用默認參數而非組合參數
async function optimizeMultipleStrategyParameters(strategy, strategyType, strategyInfo, targetMetric, trials, order = 'forward', baseCombo = null) {
    console.log(`[Batch Optimization] Starting simplified multi-parameter optimization for ${strategy}...`);
    
    try {
        const optimizeTargets = strategyInfo.optimizeTargets;
        
        // 修復：使用完整的組合參數作為基礎，而非預設參數
        // 這確保優化時的 baseParams 與用戶手動操作時一致
        const baseParams = getBacktestParams();
        
        // 每個參數使用使用者指定的優化次數
        const trialsPerParam = Math.max(1, parseInt(trials, 10) || 1);
        console.log(`[Batch Optimization] Optimizing ${optimizeTargets.length} parameters with ${trialsPerParam} trials each`);
        
        // 修復：設定策略參數時，使用組合中的實際參數而非預設參數
        if (strategyType === 'entry') {
            const workerEntryStrategy = resolveWorkerStrategyName(strategy);
            if (workerEntryStrategy) {
                baseParams.entryStrategy = workerEntryStrategy;
            }
            // 使用組合中的進場參數作為起始點（如果有的話）
            if (baseCombo && baseCombo.buyParams) {
                baseParams.entryParams = { ...baseCombo.buyParams };
            } else {
                baseParams.entryParams = { ...strategyInfo.defaultParams };
            }
            // 確保包含當前組合的出場參數
            if (baseCombo && baseCombo.sellParams) {
                baseParams.exitParams = { ...baseCombo.sellParams };
                const workerExitStrategy = resolveWorkerStrategyName(baseCombo.sellStrategy);
                if (workerExitStrategy) {
                    baseParams.exitStrategy = workerExitStrategy;
                }
            }
        } else {
            const workerExitStrategy = resolveWorkerStrategyName(strategy);
            if (workerExitStrategy) {
                baseParams.exitStrategy = workerExitStrategy;
            }
            // 使用組合中的出場參數作為起始點（如果有的話）
            if (baseCombo && baseCombo.sellParams) {
                baseParams.exitParams = { ...baseCombo.sellParams };
            } else {
                baseParams.exitParams = { ...strategyInfo.defaultParams };
            }
            // 確保包含當前組合的進場參數
            if (baseCombo && baseCombo.buyParams) {
                baseParams.entryParams = { ...baseCombo.buyParams };
                const workerEntryStrategy = resolveWorkerStrategyName(baseCombo.buyStrategy);
                if (workerEntryStrategy) {
                    baseParams.entryStrategy = workerEntryStrategy;
                }
            }
        }
        
        // 包含風險管理參數
        if (baseCombo && baseCombo.riskManagement) {
            baseParams.stopLoss = baseCombo.riskManagement.stopLoss || 0;
            baseParams.takeProfit = baseCombo.riskManagement.takeProfit || 0;
        }
        
        console.log(`[Batch Optimization] Initial baseParams for ${strategy}:`, {
            entryStrategy: baseParams.entryStrategy,
            exitStrategy: baseParams.exitStrategy,
            entryParams: baseParams.entryParams,
            exitParams: baseParams.exitParams,
            stopLoss: baseParams.stopLoss,
            takeProfit: baseParams.takeProfit
        });
        
        let optimizedParams = strategyType === 'entry' ? 
            { ...baseParams.entryParams } : 
            { ...baseParams.exitParams };
        
        // 修復：使用固定的參數優化順序，避免 reverse 導致的不穩定性
        // 按照參數在 optimizeTargets 中的自然順序進行優化
        for (let i = 0; i < optimizeTargets.length; i++) {
            const optimizeTarget = optimizeTargets[i];
            console.log(`[Batch Optimization] Phase ${i + 1}/${optimizeTargets.length}: Optimizing ${optimizeTarget.name}...`);
            
            // 更新當前最佳參數到 baseParams
            if (strategyType === 'entry') {
                baseParams.entryParams = { ...optimizedParams };
                // 保持出場參數不變
            } else {
                baseParams.exitParams = { ...optimizedParams };
                // 保持進場參數不變
            }
            
            console.log(`[Batch Optimization] baseParams before optimizing ${optimizeTarget.name}:`, {
                entryParams: baseParams.entryParams,
                exitParams: baseParams.exitParams
            });
            
            // 優化當前參數
            const bestParam = await optimizeSingleStrategyParameter(
                baseParams, 
                optimizeTarget, 
                strategyType, 
                targetMetric, 
                trialsPerParam
            );
            
            if (bestParam.value !== undefined) {
                optimizedParams[optimizeTarget.name] = bestParam.value;
                console.log(`[Batch Optimization] Best ${optimizeTarget.name}: ${bestParam.value}, ${targetMetric}: ${bestParam.metric.toFixed(4)}`);
            } else {
                console.warn(`[Batch Optimization] No valid optimization result for ${optimizeTarget.name}, keeping default value`);
            }
        }
        
        console.log(`[Batch Optimization] Final optimized parameters for ${strategy}:`, optimizedParams);
        return optimizedParams;
        
    } catch (error) {
        console.error('[Batch Optimization] Error in multi-parameter strategy optimization:', error);
        // 返回預設參數作為備用
        return { ...strategyInfo.defaultParams };
    }
}

// 優化單一策略參數
async function optimizeSingleStrategyParameter(params, optimizeTarget, strategyType, targetMetric, trials, options = {}) {
    return new Promise((resolve) => {
        if (!workerUrl) {
            console.error('[Batch Optimization] Worker not available');
            resolve({ value: undefined, metric: -Infinity });
            return;
        }

        const optimizeWorker = new Worker(workerUrl);

        const overrideData = Array.isArray(options?.cachedDataOverride) && options.cachedDataOverride.length > 0
            ? options.cachedDataOverride
            : null;
        const cachedPayload = overrideData
            || (typeof cachedStockData !== 'undefined' && Array.isArray(cachedStockData) ? cachedStockData : null);
        const useCachedData = Array.isArray(cachedPayload) && cachedPayload.length > 0;
        
        optimizeWorker.onmessage = function(e) {
            const { type, data } = e.data;
            
            if (type === 'result') {
                optimizeWorker.terminate();

                console.debug('[Batch Optimization] optimizeSingleStrategyParameter worker returned data:', data);

                if (!data || !Array.isArray(data.results) || data.results.length === 0) {
                    console.warn(`[Batch Optimization] No optimization results for ${optimizeTarget.name}`);
                    recordBatchDebug('param-optimization-empty', {
                        strategyType,
                        optimizeTarget: optimizeTarget.name,
                        trials,
                        paramsPreview: params ? { entryStrategy: params.entryStrategy, exitStrategy: params.exitStrategy } : null
                    }, { phase: 'optimize', level: 'warn', consoleLevel: 'warn' });
                    resolve({ value: undefined, metric: -Infinity });
                    return;
                }

                // Normalize and sort using getMetricFromResult to be tolerant to missing/NaN metrics
                const results = data.results.map(r => ({
                    __orig: r,
                    paramValue: (r.paramValue !== undefined) ? r.paramValue : (r.value !== undefined ? r.value : (r.param !== undefined ? r.param : undefined)),
                    metricVal: getMetricFromResult(r, targetMetric)
                }));

                // Filter out entries without a paramValue
                const validResults = results.filter(r => r.paramValue !== undefined && !isNaN(r.metricVal));
                if (validResults.length === 0) {
                    console.warn(`[Batch Optimization] Optimization returned results but none had usable paramValue/metric for ${optimizeTarget.name}`);
                    // fallback: try to pick first result that has paramValue even if metric NaN
                    const fallback = results.find(r => r.paramValue !== undefined);
                    if (fallback) {
                        resolve({ value: fallback.paramValue, metric: fallback.metricVal });
                    } else {
                        resolve({ value: undefined, metric: -Infinity });
                    }
                    return;
                }

                // Sort: for maxDrawdown smaller is better
                validResults.sort((a, b) => {
                    if (targetMetric === 'maxDrawdown') {
                        return Math.abs(a.metricVal) - Math.abs(b.metricVal);
                    }
                    return b.metricVal - a.metricVal;
                });

                const best = validResults[0];
                console.debug('[Batch Optimization] Selected best optimization result:', best);
                recordBatchDebug('param-optimization-complete', {
                    strategyType,
                    optimizeTarget: optimizeTarget.name,
                    selectedValue: best.paramValue,
                    metric: best.metricVal,
                    targetMetric
                }, { phase: 'optimize', console: false });
                resolve({ value: best.paramValue, metric: best.metricVal });
            } else if (type === 'error') {
                console.error(`[Batch Optimization] ${optimizeTarget.name} optimization error:`, e.data.data?.message);
                recordBatchDebug('param-optimization-error', {
                    strategyType,
                    optimizeTarget: optimizeTarget.name,
                    message: e.data.data?.message
                }, { phase: 'optimize', level: 'error', consoleLevel: 'error' });
                optimizeWorker.terminate();
                resolve({ value: undefined, metric: -Infinity });
            }
        };

        optimizeWorker.onerror = function(error) {
            console.error(`[Batch Optimization] ${optimizeTarget.name} optimization worker error:`, error);
            recordBatchDebug('param-optimization-error', {
                strategyType,
                optimizeTarget: optimizeTarget.name,
                message: error?.message || String(error),
                stack: error?.stack || null
            }, { phase: 'optimize', level: 'error', consoleLevel: 'error' });
            optimizeWorker.terminate();
            resolve({ value: undefined, metric: -Infinity });
        };
        
        // 使用策略配置中的原始步長，不進行動態調整
        // 修復：批量優化應該使用與單次優化相同的參數範圍和步長，
        // 以確保搜索空間的一致性，避免跳過最優參數值
        const range = optimizeTarget.range;
        const optimizedRange = {
            from: range.from,
            to: range.to,
            step: range.step || 1  // 使用原始步長，確保與單次優化一致
        };
        
        console.log(`[Batch Optimization] Optimizing ${optimizeTarget.name} with range:`, optimizedRange);
        
        const preparedParams = enrichParamsWithLookback(params);

        // 發送優化任務
        optimizeWorker.postMessage({
            type: 'runOptimization',
            params: preparedParams,
            optimizeTargetStrategy: strategyType,
            optimizeParamName: optimizeTarget.name,
            optimizeRange: optimizedRange,
            useCachedData,
            cachedData: cachedPayload
        });
        
        // 設定超時
        setTimeout(() => {
            optimizeWorker.terminate();
            resolve({ value: undefined, metric: -Infinity });
        }, 60000); // 60秒超時
    });
}

// 優化風險管理參數（停損和停利）
async function optimizeRiskManagementParameters(baseParams, optimizeTargets, targetMetric, trials, options = {}) {
    console.log('[Batch Optimization] Starting multi-parameter risk management optimization...');
    
    try {
        // 第一階段：優化停損參數
        const stopLossTarget = optimizeTargets.find(t => t.name === 'stopLoss');
        console.log('[Batch Optimization] Phase 1: Optimizing stopLoss...', stopLossTarget);
        
        const bestStopLoss = await optimizeSingleRiskParameter(
            baseParams,
            stopLossTarget,
            targetMetric,
            Math.floor(trials / 2),
            options,
        );
        console.log('[Batch Optimization] Best stopLoss result:', bestStopLoss);
        
        // 第二階段：基於最佳停損值優化停利參數
        const takeProfitTarget = optimizeTargets.find(t => t.name === 'takeProfit');
        const paramsWithBestStopLoss = { ...baseParams };
        if (bestStopLoss.value !== undefined) {
            paramsWithBestStopLoss.stopLoss = bestStopLoss.value;
        }
        
        console.log('[Batch Optimization] Phase 2: Optimizing takeProfit with stopLoss =', bestStopLoss.value);
        const bestTakeProfit = await optimizeSingleRiskParameter(
            paramsWithBestStopLoss,
            takeProfitTarget,
            targetMetric,
            Math.floor(trials / 2),
            options,
        );
        console.log('[Batch Optimization] Best takeProfit result:', bestTakeProfit);
        
        // 組合最佳參數
        const optimizedParams = {};
        if (bestStopLoss.value !== undefined) {
            optimizedParams.stopLoss = bestStopLoss.value;
        }
        if (bestTakeProfit.value !== undefined) {
            optimizedParams.takeProfit = bestTakeProfit.value;
        }
        
        console.log('[Batch Optimization] Final optimized risk management parameters:', optimizedParams);
        return optimizedParams;
        
    } catch (error) {
        console.error('[Batch Optimization] Error in multi-parameter optimization:', error);
        return {};
    }
}

// 優化單一風險管理參數
async function optimizeSingleRiskParameter(params, optimizeTarget, targetMetric, trials, options = {}) {
    return new Promise((resolve) => {
        if (!workerUrl) {
            console.error('[Batch Optimization] Worker not available');
            resolve({ value: undefined, metric: -Infinity });
            return;
        }

        const optimizeWorker = new Worker(workerUrl);

        const overrideData = Array.isArray(options?.cachedDataOverride) && options.cachedDataOverride.length > 0
            ? options.cachedDataOverride
            : null;
        const cachedPayload = overrideData
            || (typeof cachedStockData !== 'undefined' && Array.isArray(cachedStockData) ? cachedStockData : null);
        const useCachedData = Array.isArray(cachedPayload) && cachedPayload.length > 0;
        
        optimizeWorker.onmessage = function(e) {
            const { type, data } = e.data;
            
            if (type === 'result') {
                optimizeWorker.terminate();
                
                if (data && data.results && data.results.length > 0) {
                    // 根據目標指標排序結果
                    const sortedResults = data.results.sort((a, b) => {
                        const aValue = a[targetMetric] || -Infinity;
                        const bValue = b[targetMetric] || -Infinity;
                        
                        if (targetMetric === 'maxDrawdown') {
                            // 最大回撤越小越好
                            return Math.abs(aValue) - Math.abs(bValue);
                        } else {
                            // 其他指標越大越好
                            return bValue - aValue;
                        }
                    });
                    
                    const bestResult = sortedResults[0];
                    console.log(`[Batch Optimization] Best ${optimizeTarget.name}: ${bestResult.paramValue}, ${targetMetric}: ${bestResult[targetMetric]}`);
                    
                    resolve({
                        value: bestResult.paramValue,
                        metric: bestResult[targetMetric]
                    });
                } else {
                    console.warn(`[Batch Optimization] No optimization results for ${optimizeTarget.name}`);
                    resolve({ value: undefined, metric: -Infinity });
                }
            } else if (type === 'error') {
                console.error(`[Batch Optimization] ${optimizeTarget.name} optimization error:`, e.data.data?.message);
                optimizeWorker.terminate();
                resolve({ value: undefined, metric: -Infinity });
            }
        };
        
        optimizeWorker.onerror = function(error) {
            console.error(`[Batch Optimization] ${optimizeTarget.name} optimization worker error:`, error);
            optimizeWorker.terminate();
            resolve({ value: undefined, metric: -Infinity });
        };
        
        const preparedParams = enrichParamsWithLookback(params);

        // 發送優化任務
        optimizeWorker.postMessage({
            type: 'runOptimization',
            params: preparedParams,
            optimizeTargetStrategy: 'risk',
            optimizeParamName: optimizeTarget.name,
            optimizeRange: optimizeTarget.range,
            useCachedData,
            cachedData: cachedPayload
        });
    });
}

// 顯示批量優化結果
function showBatchResults() {
    try {
        console.log(`[Batch Optimization] Showing ${batchOptimizationResults.length} results`);

        recordBatchDebug('show-results', {
            total: batchOptimizationResults.length
        }, { phase: 'render', consoleLevel: 'log' });

        // 隱藏進度區域
        const progressElement = document.getElementById('batch-optimization-progress');
        if (progressElement) {
            progressElement.classList.add('hidden');
        }
        
        // 顯示結果區域
        const resultsDiv = document.getElementById('batch-optimization-results');
        if (resultsDiv) {
            resultsDiv.classList.remove('hidden');
        }
        
        // 排序結果
        sortBatchResults();
        
        // 渲染結果表格
        renderBatchResultsTable();
        
        // 重置運行狀態
        restoreBatchOptimizationUI();
    } catch (error) {
        console.error('[Batch Optimization] Error showing results:', error);
        restoreBatchOptimizationUI();
    }
}

// 排序結果
function sortBatchResults() {
    const config = batchOptimizationConfig;
    const sortKey = config.sortKey || config.targetMetric || 'annualizedReturn';
    const sortDirection = config.sortDirection || 'desc';

    batchOptimizationResults.sort((a, b) => {
        let aValue = a[sortKey] || 0;
        let bValue = b[sortKey] || 0;
        
        // 處理特殊情況
        if (sortKey === 'maxDrawdown') {
            // 最大回撤越小越好
            aValue = Math.abs(aValue);
            bValue = Math.abs(bValue);
            // 對於回撤，我們要倒序排列（小的值排在前面）
            if (sortDirection === 'desc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        }
        
        // 處理 NaN 值，將它們排到最後
        if (isNaN(aValue) && isNaN(bValue)) return 0;
        if (isNaN(aValue)) return 1;
        if (isNaN(bValue)) return -1;
        
        if (sortDirection === 'asc') {
            return aValue - bValue;
        } else {
            return bValue - aValue;
        }
    });

    // 重新渲染表格
    renderBatchResultsTable();

    recordBatchDebug('results-sorted', {
        sortKey,
        sortDirection,
        topResults: batchOptimizationResults.slice(0, Math.min(3, batchOptimizationResults.length)).map(summarizeResult)
    }, { phase: 'render', console: false });
}

// 更新排序方向按鈕
function updateSortDirectionButton() {
    const button = document.getElementById('batch-sort-direction');
    if (button) {
        const icon = button.querySelector('i');
        if (batchOptimizationConfig.sortDirection === 'asc') {
            icon.className = 'fas fa-sort-up';
        } else {
            icon.className = 'fas fa-sort-down';
        }
    }
}

// 渲染結果表格
function renderBatchResultsTable() {
    const tbody = document.getElementById('batch-results-tbody');
    if (!tbody) return;
    
    // 添加交叉優化控制面板
    addCrossOptimizationControls();
    
    tbody.innerHTML = '';
    
    batchOptimizationResults.forEach((result, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const buyStrategyName = strategyDescriptions[result.buyStrategy]?.name || result.buyStrategy;
        const sellStrategyName = result.sellStrategy ? 
            (strategyDescriptions[result.sellStrategy]?.name || result.sellStrategy) : 
            '未觸發';
        
        // 判斷優化類型並處理合併的類型標籤
        let optimizationType = '基礎';
        let typeClass = 'bg-gray-100 text-gray-700';
        const typeMap = {
            'entry-fixed': '進場固定',
            'exit-fixed': '出場固定',
            '基礎': '基礎',
            'refinement-spsa': '微調',
            'refinement-cem': '微調'
        };

        if (result.optimizationTypes && result.optimizationTypes.length > 1) {
            // 多重結果，顯示合併標籤
            const mappedTypes = Array.from(new Set(result.optimizationTypes.map(type => typeMap[type] || type)));
            optimizationType = mappedTypes.join(',');
            typeClass = 'bg-yellow-100 text-yellow-700';
        } else if (result.crossOptimization) {
            if (result.optimizationType === 'entry-fixed') {
                optimizationType = '進場固定';
                typeClass = 'bg-purple-100 text-purple-700';
            } else if (result.optimizationType === 'exit-fixed') {
                optimizationType = '出場固定';
                typeClass = 'bg-blue-100 text-blue-700';
            } else if (result.optimizationType === 'refinement-spsa' || result.optimizationType === 'refinement-cem') {
                optimizationType = '微調';
                typeClass = 'bg-emerald-100 text-emerald-700';
            }
        } else if (result.optimizationType === 'refinement-spsa' || result.optimizationType === 'refinement-cem') {
            optimizationType = '微調';
            typeClass = 'bg-emerald-100 text-emerald-700';
        }
        
        // 顯示風險管理參數（如果有的話）
        let riskManagementInfo = '';
        if (result.riskManagement) {
            // 優化的風險管理參數
            const stopLoss = result.riskManagement.stopLoss ? `停損:${result.riskManagement.stopLoss}%` : '';
            const takeProfit = result.riskManagement.takeProfit ? `停利:${result.riskManagement.takeProfit}%` : '';
            const parts = [stopLoss, takeProfit].filter(part => part);
            if (parts.length > 0) {
                riskManagementInfo = `<small class="text-gray-600 block">(優化: ${parts.join(', ')})</small>`;
            }
        } else if (result.usedStopLoss !== undefined || result.usedTakeProfit !== undefined) {
            // 實際使用的風險管理參數
            const stopLoss = result.usedStopLoss !== undefined ? `停損:${result.usedStopLoss}%` : '';
            const takeProfit = result.usedTakeProfit !== undefined ? `停利:${result.usedTakeProfit}%` : '';
            const parts = [stopLoss, takeProfit].filter(part => part);
            if (parts.length > 0) {
                riskManagementInfo = `<small class="text-gray-600 block">(使用: ${parts.join(', ')})</small>`;
            }
        }
        
        row.innerHTML = `
            <td class="px-3 py-2 text-sm text-gray-900 font-medium">${index + 1}</td>
            <td class="px-3 py-2 text-sm">
                <span class="px-2 py-1 text-xs rounded-full ${typeClass}">${optimizationType}</span>
            </td>
            <td class="px-3 py-2 text-sm text-gray-900">${buyStrategyName}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${sellStrategyName}${riskManagementInfo}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatPercentage(result.annualizedReturn)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatNumber(result.sharpeRatio)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatNumber(result.sortinoRatio)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${formatPercentage(result.maxDrawdown)}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${result.tradesCount || result.totalTrades || result.tradeCount || 0}</td>
            <td class="px-3 py-2 text-sm text-gray-900">
                <button class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded border" 
                        onclick="loadBatchStrategy(${index})">
                    載入
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// 添加交叉優化控制面板
function addCrossOptimizationControls() {
    // 檢查是否已經添加過控制面板
    if (document.getElementById('cross-optimization-controls')) {
        console.log('[Cross Optimization] Controls already exist');
        return;
    }
    
    // 檢查是否有批量優化結果
    const hasResults = batchOptimizationResults && batchOptimizationResults.length > 0;
    if (!hasResults) {
        console.log('[Cross Optimization] No batch results available, showing disabled controls');
    }
    
    const resultsDiv = document.getElementById('batch-optimization-results');
    if (!resultsDiv) {
        console.error('[Cross Optimization] Results div not found');
        return;
    }
    
    // 找到結果表格
    const table = resultsDiv.querySelector('table');
    if (!table) {
        console.error('[Cross Optimization] Results table not found');
        return;
    }
    
    console.log('[Cross Optimization] Adding control panel');
    
    // 創建控制面板
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'cross-optimization-controls';
    controlsDiv.className = 'mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg';
    
    controlsDiv.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h4 class="text-lg font-semibold text-purple-800 flex items-center">
                🔄 智能交叉優化
                <span class="ml-2 px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">進階功能</span>
            </h4>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div class="space-y-2">
                <h5 class="font-medium text-purple-700">📈 第二階段：進場策略優化</h5>
                <p class="text-sm text-gray-600">固定最佳進場參數，優化所有出場策略組合</p>
                <button id="start-entry-cross-optimization"
                        class="w-full px-4 py-2 ${hasResults ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md transition-colors text-sm font-medium"
                        ${!hasResults ? 'disabled' : ''}>
                    🚀 開始進場策略交叉優化
                </button>
            </div>

            <div class="space-y-2">
                <h5 class="font-medium text-purple-700">📉 第三階段：出場策略優化</h5>
                <p class="text-sm text-gray-600">固定最佳出場參數，優化所有進場策略組合</p>
                <button id="start-exit-cross-optimization"
                        class="w-full px-4 py-2 ${hasResults ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md transition-colors text-sm font-medium"
                        ${!hasResults ? 'disabled' : ''}>
                    🎯 開始出場策略交叉優化
                </button>
            </div>

            <div class="space-y-3 md:col-span-2 lg:col-span-1">
                <h5 class="font-medium text-purple-700">🔬 第四階段：局部微調（SPSA 或 CEM）</h5>
                <p class="text-sm text-gray-600">依結果排名選擇候選組合，使用隨機微分或交叉熵演算法微調參數</p>
                <div class="space-y-2">
                    <label for="local-refinement-target-range" class="text-xs font-medium text-gray-600">微調目標排名</label>
                    <select id="local-refinement-target-range"
                            class="w-full px-3 py-2 border border-purple-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                        <option value="top3">前三名微調</option>
                        <option value="4-6">四到六名微調</option>
                        <option value="6-10">六到十名微調</option>
                        <option value="custom">更多微調（自訂名次）</option>
                    </select>
                    <div id="local-refinement-custom-range" class="grid grid-cols-2 gap-2 hidden">
                        <label class="text-xs text-gray-600">
                            從第
                            <input id="local-refinement-custom-start" type="number" min="1" step="1" value="1"
                                   class="mt-1 w-full px-2 py-1 border border-purple-200 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                        </label>
                        <label class="text-xs text-gray-600">
                            到第
                            <input id="local-refinement-custom-end" type="number" min="1" step="1" value="10"
                                   class="mt-1 w-full px-2 py-1 border border-purple-200 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                        </label>
                    </div>
                </div>
                <button id="start-local-refinement"
                        class="w-full px-4 py-2 ${hasResults ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md transition-colors text-sm font-medium"
                        ${!hasResults ? 'disabled' : ''}>
                    🧪 啟動局部微調流程
                </button>
            </div>
        </div>

        <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            ${hasResults
                ? '<strong>💡 優化流程：</strong> 1️⃣ 從當前結果中找出最佳進場策略參數 → 2️⃣ 套用到不同出場策略重新優化 → 3️⃣ 再找出最佳出場策略參數 → 4️⃣ 套用到不同進場策略最終優化 → 5️⃣ 局部微調（SPSA／CEM）'
                : '<strong>⚠️ 提示：</strong> 請先執行批量優化以獲得初始結果，然後才能進行交叉優化'
            }
        </div>
    `;
    
    // 插入到表格前面
    const tableWrapper = table.parentNode;
    const contentWrapper = tableWrapper && tableWrapper.parentNode ? tableWrapper.parentNode : tableWrapper;

    if (contentWrapper && tableWrapper) {
        contentWrapper.insertBefore(controlsDiv, tableWrapper);

        const progressCard = document.getElementById('cross-optimization-progress');
        if (progressCard) {
            progressCard.classList.remove('mb-6');
            progressCard.classList.add('mb-4');
            contentWrapper.insertBefore(progressCard, tableWrapper);
        }
    } else {
        table.parentNode.insertBefore(controlsDiv, table);

        const progressCard = document.getElementById('cross-optimization-progress');
        if (progressCard) {
            progressCard.classList.remove('mb-6');
            progressCard.classList.add('mb-4');
            table.parentNode.insertBefore(progressCard, table);
        }
    }
    
    // 添加事件監聽器
    const entryButton = document.getElementById('start-entry-cross-optimization');
    const exitButton = document.getElementById('start-exit-cross-optimization');
    const refineButton = document.getElementById('start-local-refinement');

    if (entryButton && exitButton && refineButton) {
        // 只在有結果時才添加事件監聽器
        if (hasResults) {
            entryButton.addEventListener('click', startEntryCrossOptimization);
            exitButton.addEventListener('click', startExitCrossOptimization);
            refineButton.addEventListener('click', startLocalRefinementOptimization);
            setupLocalRefinementRangeControls();
            console.log('[Cross Optimization] Event listeners added successfully');
        }

        // 添加到全局作用域以便調試
        window.startEntryCrossOptimization = startEntryCrossOptimization;
        window.startExitCrossOptimization = startExitCrossOptimization;
        window.startLocalRefinementOptimization = startLocalRefinementOptimization;

    } else {
        console.error('[Cross Optimization] Failed to find buttons:', {
            entryButton: !!entryButton,
            exitButton: !!exitButton,
            refineButton: !!refineButton
        });
    }
}

function setupLocalRefinementRangeControls() {
    try {
        const rangeSelector = document.getElementById('local-refinement-target-range');
        const customContainer = document.getElementById('local-refinement-custom-range');
        const startInput = document.getElementById('local-refinement-custom-start');
        const endInput = document.getElementById('local-refinement-custom-end');

        if (!rangeSelector || !customContainer) {
            return;
        }

        const sanitizeInputValue = (input) => {
            if (!input) return;
            const numeric = parseInt(input.value, 10);
            if (isNaN(numeric) || numeric < 1) {
                input.value = '1';
            } else {
                input.value = `${numeric}`;
            }
        };

        const toggleCustomInputs = () => {
            if (rangeSelector.value === 'custom') {
                customContainer.classList.remove('hidden');
            } else {
                customContainer.classList.add('hidden');
            }
        };

        rangeSelector.addEventListener('change', toggleCustomInputs);
        toggleCustomInputs();

        [startInput, endInput].forEach(input => {
            if (!input) return;
            input.addEventListener('change', () => sanitizeInputValue(input));
            input.addEventListener('blur', () => sanitizeInputValue(input));
        });
    } catch (error) {
        console.error('[Cross Optimization] Error initializing local refinement controls:', error);
    }
}

// 開始進場策略交叉優化
async function startEntryCrossOptimization() {
    console.log('[Cross Optimization] startEntryCrossOptimization called');
    
    try {
        // 顯示交叉優化進度
        showCrossOptimizationProgress('entry');
        showInfo('🔄 開始進場策略交叉優化...');
        
        // 1. 取得當前配置的所有進場和出場策略
        const entryStrategies = getSelectedEntryStrategies();
        const exitStrategies = getSelectedExitStrategies();
        
        if (entryStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇進場策略');
            return;
        }
        
        if (exitStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇出場策略');
            return;
        }
        
        // 2. 準備交叉優化任務
        const crossOptimizationTasks = [];
        
        for (let entryIndex = 0; entryIndex < entryStrategies.length; entryIndex++) {
            const entryStrategy = entryStrategies[entryIndex];
            
            // 找到該進場策略的最佳結果
            const bestEntryResult = findBestResultForStrategy(entryStrategy, 'entry');
            
            if (!bestEntryResult) {
                console.warn(`找不到 ${strategyDescriptions[entryStrategy]?.name || entryStrategy} 的最佳結果`);
                continue;
            }
            
            // 為每個出場策略創建任務
            for (let exitIndex = 0; exitIndex < exitStrategies.length; exitIndex++) {
                const exitStrategy = exitStrategies[exitIndex];
                crossOptimizationTasks.push({
                    entryStrategy: entryStrategy,
                    entryParams: bestEntryResult.buyParams || bestEntryResult.entryParams,
                    exitStrategy: exitStrategy,
                    optimizationType: 'entry-fixed',
                    taskId: `${entryStrategy}-${exitStrategy}`
                });
            }
        }
        
        showInfo(`📊 準備執行 ${crossOptimizationTasks.length} 個交叉優化任務...`);
        
        // 3. 使用批量優化的並行處理邏輯
        const results = await executeCrossOptimizationTasks(crossOptimizationTasks);
        
        // 4. 更新結果並顯示
        if (results.length > 0) {
            // 添加交叉優化結果到總結果中，並進行去重處理
            addCrossOptimizationResults(results);
            sortBatchResults();
            renderBatchResultsTable();
            hideCrossOptimizationProgress();
            showSuccess(`✅ 進場策略交叉優化完成！新增 ${results.length} 個優化結果`);
        } else {
            hideCrossOptimizationProgress();
            showError('交叉優化失敗，未產生有效結果');
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error in startEntryCrossOptimization:', error);
        hideCrossOptimizationProgress();
        showError('交叉優化執行失敗：' + error.message);
    }
}

// 執行交叉優化任務（使用批量優化的並行邏輯）
async function executeCrossOptimizationTasks(tasks) {
    const results = [];
    const maxConcurrency = navigator.hardwareConcurrency || 4;
    
    console.log(`[Cross Optimization] Running ${tasks.length} tasks with concurrency = ${maxConcurrency}`);
    
    // 設置交叉優化進度
    crossOptimizationProgress.total = tasks.length;
    crossOptimizationProgress.current = 0;
    
    let index = 0;
    const inFlight = new Set();
    
    return new Promise((resolve) => {
        function launchNext() {
            while (index < tasks.length && inFlight.size < maxConcurrency) {
                const i = index++;
                const task = tasks[i];
                
                // 更新進度顯示
                updateCrossOptimizationProgress(task);
                
                const promise = performCrossOptimization(
                    task.entryStrategy,
                    task.entryParams,
                    task.exitStrategy,
                    task.optimizationType
                ).then(result => {
                    if (result) {
                        results[i] = result;
                        console.log(`[Cross Optimization] Task ${i + 1} completed successfully`);
                    } else {
                        console.warn(`[Cross Optimization] Task ${i + 1} failed`);
                    }
                }).catch(error => {
                    console.error(`[Cross Optimization] Task ${i + 1} error:`, error);
                }).finally(() => {
                    inFlight.delete(promise);
                    
                    // 更新進度
                    crossOptimizationProgress.current++;
                    updateCrossOptimizationProgress();
                    
                    if (inFlight.size === 0 && index >= tasks.length) {
                        // 所有任務完成
                        const validResults = results.filter(Boolean);
                        console.log(`[Cross Optimization] All tasks completed. Valid results: ${validResults.length}/${tasks.length}`);
                        resolve(validResults);
                    } else {
                        // 啟動下一個任務
                        launchNext();
                    }
                });
                
                inFlight.add(promise);
            }
            
            // 如果沒有更多任務且所有任務都完成了
            if (index >= tasks.length && inFlight.size === 0) {
                const validResults = results.filter(Boolean);
                resolve(validResults);
            }
        }
        
        // 開始處理
        launchNext();
    });
}

// 開始出場策略交叉優化
async function startExitCrossOptimization() {
    console.log('[Cross Optimization] startExitCrossOptimization called');
    
    try {
        // 顯示交叉優化進度
        showCrossOptimizationProgress('exit');
        showInfo('🔄 開始出場策略交叉優化...');
        
        // 1. 取得當前配置的所有進場和出場策略
        const entryStrategies = getSelectedEntryStrategies();
        const exitStrategies = getSelectedExitStrategies();
        
        if (entryStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇進場策略');
            return;
        }
        
        if (exitStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇出場策略');
            return;
        }
        
        // 2. 準備交叉優化任務
        const crossOptimizationTasks = [];
        
        for (let exitIndex = 0; exitIndex < exitStrategies.length; exitIndex++) {
            const exitStrategy = exitStrategies[exitIndex];
            
            // 找到該出場策略的最佳結果
            const bestExitResult = findBestResultForStrategy(exitStrategy, 'exit');
            
            if (!bestExitResult) {
                console.warn(`找不到 ${strategyDescriptions[exitStrategy]?.name || exitStrategy} 的最佳結果`);
                continue;
            }
            
            // 為每個進場策略創建任務
            for (let entryIndex = 0; entryIndex < entryStrategies.length; entryIndex++) {
                const entryStrategy = entryStrategies[entryIndex];
                crossOptimizationTasks.push({
                    entryStrategy: entryStrategy,
                    entryParams: null,
                    exitStrategy: exitStrategy,
                    exitParams: bestExitResult.sellParams || bestExitResult.exitParams,
                    optimizationType: 'exit-fixed',
                    taskId: `${entryStrategy}-${exitStrategy}`
                });
            }
        }
        
        showInfo(`📊 準備執行 ${crossOptimizationTasks.length} 個交叉優化任務...`);
        
        // 3. 使用批量優化的並行處理邏輯
        const results = await executeCrossOptimizationTasksExit(crossOptimizationTasks);
        
        // 4. 更新結果並顯示
        if (results.length > 0) {
            // 添加交叉優化結果到總結果中，並進行去重處理
            addCrossOptimizationResults(results);
            sortBatchResults();
            renderBatchResultsTable();
            hideCrossOptimizationProgress();
            showSuccess(`✅ 出場策略交叉優化完成！新增 ${results.length} 個優化結果`);
        } else {
            hideCrossOptimizationProgress();
            showError('交叉優化失敗，未產生有效結果');
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error in startExitCrossOptimization:', error);
        hideCrossOptimizationProgress();
        showError('交叉優化執行失敗：' + error.message);
    }
}

// 執行出場策略交叉優化任務
async function executeCrossOptimizationTasksExit(tasks) {
    const results = [];
    const maxConcurrency = navigator.hardwareConcurrency || 4;

    console.log(`[Cross Optimization] Running ${tasks.length} exit tasks with concurrency = ${maxConcurrency}`);
    
    // 設置交叉優化進度
    crossOptimizationProgress.total = tasks.length;
    crossOptimizationProgress.current = 0;
    
    let index = 0;
    const inFlight = new Set();
    
    return new Promise((resolve) => {
        function launchNext() {
            while (index < tasks.length && inFlight.size < maxConcurrency) {
                const i = index++;
                const task = tasks[i];
                
                // 更新進度顯示
                updateCrossOptimizationProgress(task);
                
                const promise = performCrossOptimization(
                    task.entryStrategy,
                    task.entryParams,
                    task.exitStrategy,
                    task.optimizationType,
                    task.exitParams
                ).then(result => {
                    if (result) {
                        results[i] = result;
                        console.log(`[Cross Optimization] Exit task ${i + 1} completed successfully`);
                    } else {
                        console.warn(`[Cross Optimization] Exit task ${i + 1} failed`);
                    }
                    
                    // 更新交叉優化進度
                    crossOptimizationProgress.current++;
                    updateCrossOptimizationProgress();
                }).catch(error => {
                    console.error(`[Cross Optimization] Exit task ${i + 1} error:`, error);
                }).finally(() => {
                    inFlight.delete(promise);
                    
                    if (inFlight.size === 0 && index >= tasks.length) {
                        // 所有任務完成
                        const validResults = results.filter(Boolean);
                        console.log(`[Cross Optimization] All exit tasks completed. Valid results: ${validResults.length}/${tasks.length}`);
                        resolve(validResults);
                    } else {
                        // 啟動下一個任務
                        launchNext();
                    }
                });
                
                inFlight.add(promise);
            }
            
            // 如果沒有更多任務且所有任務都完成了
            if (index >= tasks.length && inFlight.size === 0) {
                const validResults = results.filter(Boolean);
                resolve(validResults);
            }
        }
        
        // 開始處理
        launchNext();
    });
}

// 開始局部微調（SPSA / CEM）
function resolveLocalRefinementRange(totalCandidates) {
    if (!totalCandidates || totalCandidates <= 0) {
        return null;
    }

    const rangeSelector = document.getElementById('local-refinement-target-range');
    const startInput = document.getElementById('local-refinement-custom-start');
    const endInput = document.getElementById('local-refinement-custom-end');

    const defaultEnd = Math.min(3, totalCandidates);

    if (!rangeSelector) {
        return {
            startRank: 1,
            endRank: defaultEnd,
            label: defaultEnd <= 1 ? '第1名' : `前${defaultEnd}名`
        };
    }

    let startRank = 1;
    let endRank = 3;

    switch (rangeSelector.value) {
        case '4-6':
            startRank = 4;
            endRank = 6;
            break;
        case '6-10':
            startRank = 6;
            endRank = 10;
            break;
        case 'custom': {
            const startValue = parseInt(startInput?.value, 10);
            const endValue = parseInt(endInput?.value, 10);

            if (isNaN(startValue) || isNaN(endValue)) {
                showError('請填寫完整的自訂微調名次範圍');
                return null;
            }

            if (startValue < 1 || endValue < 1) {
                showError('自訂名次需大於或等於 1');
                return null;
            }

            if (endValue < startValue) {
                showError('自訂名次的結束值需大於或等於開始值');
                return null;
            }

            startRank = startValue;
            endRank = endValue;
            break;
        }
        case 'top3':
        default:
            startRank = 1;
            endRank = 3;
            break;
    }

    if (startRank > totalCandidates) {
        showError(`目前僅有 ${totalCandidates} 筆優化結果，無法對第 ${startRank} 名之後的組合進行微調`);
        return null;
    }

    const clampedEnd = Math.min(endRank, totalCandidates);

    if (clampedEnd < startRank) {
        showError('微調名次範圍無效，請重新調整設定');
        return null;
    }

    const label = (rangeSelector.value === 'top3' && startRank === 1)
        ? (clampedEnd <= 1 ? '第1名' : `前${clampedEnd}名`)
        : (startRank === clampedEnd ? `第${startRank}名` : `第${startRank}至第${clampedEnd}名`);

    return {
        startRank,
        endRank: clampedEnd,
        label
    };
}

async function startLocalRefinementOptimization() {
    console.log('[Cross Optimization] startLocalRefinementOptimization called');

    try {
        showCrossOptimizationProgress('refine');
        showInfo('🔍 開始局部微調流程...');

        const entryStrategies = getSelectedEntryStrategies();
        const exitStrategies = getSelectedExitStrategies();

        if (entryStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇進場策略');
            return;
        }

        if (exitStrategies.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先在批量優化設定中選擇出場策略');
            return;
        }

        if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
            hideCrossOptimizationProgress();
            showError('請先完成批量優化並產出初始結果');
            return;
        }

        const config = getBatchOptimizationConfig() || {};
        const targetMetric = config.targetMetric || 'annualizedReturn';

        const candidates = batchOptimizationResults.filter(result =>
            entryStrategies.includes(result.buyStrategy) &&
            exitStrategies.includes(result.sellStrategy)
        );

        if (candidates.length === 0) {
            hideCrossOptimizationProgress();
            showError('當前勾選的策略尚無可進行局部微調的結果');
            return;
        }

        const sortedCandidates = [...candidates].sort((a, b) => {
            const metricA = getMetricFromResult(a, targetMetric);
            const metricB = getMetricFromResult(b, targetMetric);

            if (isBetterMetric(metricA, metricB, targetMetric)) return -1;
            if (isBetterMetric(metricB, metricA, targetMetric)) return 1;
            return 0;
        });

        const rangeSelection = resolveLocalRefinementRange(sortedCandidates.length);
        if (!rangeSelection) {
            hideCrossOptimizationProgress();
            return;
        }

        const selectedCandidates = sortedCandidates.slice(rangeSelection.startRank - 1, rangeSelection.endRank);

        if (!selectedCandidates.length) {
            hideCrossOptimizationProgress();
            showError('選定的名次範圍內沒有可進行局部微調的結果');
            return;
        }

        showInfo(`🧪 將針對排名 ${rangeSelection.label} 的 ${selectedCandidates.length} 個組合進行局部微調`);

        const tasks = selectedCandidates
            .map((candidate, index) => {
                const task = buildLocalRefinementTask(candidate, config, targetMetric);
                if (task) {
                    task.context = {
                        ...task.context,
                        rank: rangeSelection.startRank + index,
                        rangeLabel: rangeSelection.label
                    };
                }
                return task;
            })
            .filter(Boolean);

        if (tasks.length === 0) {
            hideCrossOptimizationProgress();
            showError('選定的策略缺少可調整參數，無法執行局部微調');
            return;
        }

        const totalEvaluations = tasks.reduce((sum, task) => sum + (task.totalEvaluations || 0), 0);
        crossOptimizationProgress.total = totalEvaluations > 0 ? totalEvaluations : tasks.length;
        crossOptimizationProgress.current = 0;
        crossOptimizationProgress.phase = 'refine';
        crossOptimizationProgress.startTime = Date.now();
        updateCrossOptimizationProgress();

        const refinedResults = [];

        for (const task of tasks) {
            updateCrossOptimizationProgress(task.context);
            const result = await runLocalRefinementTask(task);

            if (Array.isArray(result)) {
                result.forEach(item => { if (item) refinedResults.push(item); });
            } else if (result) {
                refinedResults.push(result);
            }
        }

        crossOptimizationProgress.current = crossOptimizationProgress.total;
        updateCrossOptimizationProgress();

        if (refinedResults.length > 0) {
            addCrossOptimizationResults(refinedResults);
            sortBatchResults();
            renderBatchResultsTable();
            hideCrossOptimizationProgress();
            showSuccess(`✅ 局部微調完成！新增 ${refinedResults.length} 個微調結果`);
        } else {
            hideCrossOptimizationProgress();
            showError('局部微調未產生有效結果');
        }

    } catch (error) {
        console.error('[Cross Optimization] Error in startLocalRefinementOptimization:', error);
        hideCrossOptimizationProgress();
        showError('局部微調執行失敗：' + error.message);
    }
}

function buildLocalRefinementTask(candidate, config, targetMetric) {
    if (!candidate || !candidate.buyStrategy || !candidate.sellStrategy) {
        return null;
    }

    const entryInfo = strategyDescriptions[candidate.buyStrategy];
    const exitInfo = strategyDescriptions[candidate.sellStrategy];

    const entryTargets = Array.isArray(entryInfo?.optimizeTargets)
        ? entryInfo.optimizeTargets.filter(target => target?.range && isFinite(target.range.from) && isFinite(target.range.to))
            .map(target => ({ ...target, strategyType: 'entry' }))
        : [];

    const exitTargets = Array.isArray(exitInfo?.optimizeTargets)
        ? exitInfo.optimizeTargets.filter(target => target?.range && isFinite(target.range.from) && isFinite(target.range.to))
            .map(target => ({ ...target, strategyType: 'exit' }))
        : [];

    const totalTargets = entryTargets.length + exitTargets.length;
    if (totalTargets === 0) {
        return null;
    }

    const iterationLimit = Math.max(3, parseInt(config.iterationLimit, 10) || 6);
    const algorithm = totalTargets > 2 ? 'cem' : 'spsa';
    const population = algorithm === 'cem'
        ? Math.max(4, Math.min(12, Math.round(Math.sqrt(config.parameterTrials || 30))))
        : 2;

    const initialEntryParams = ensureInitialParams(candidate.buyParams || candidate.entryParams || {}, candidate.buyStrategy);
    const initialExitParams = ensureInitialParams(candidate.sellParams || candidate.exitParams || {}, candidate.sellStrategy);
    const targetMap = buildRefinementTargetMap(entryTargets, exitTargets);

    return {
        candidate,
        entryTargets,
        exitTargets,
        algorithm,
        iterations: iterationLimit,
        population,
        totalEvaluations: algorithm === 'cem' ? iterationLimit * population : iterationLimit * 2,
        initialEntryParams,
        initialExitParams,
        initialMetric: getMetricFromResult(candidate, targetMetric),
        context: { entryStrategy: candidate.buyStrategy, exitStrategy: candidate.sellStrategy },
        refinementLabel: algorithm === 'cem' ? 'refinement-cem' : 'refinement-spsa',
        targetMetric,
        targetMap
    };
}

async function runLocalRefinementTask(task) {
    if (!task) return null;

    if (task.algorithm === 'cem') {
        return runCEMRefinement(task);
    }

    return runSPSARefinement(task);
}

async function runSPSARefinement(task) {
    try {
        const baseTemplate = buildRefinementBaseTemplate(task.candidate);
        const allTargets = [...task.entryTargets, ...task.exitTargets];

        if (allTargets.length === 0) {
            return cloneResultForRefinement(task.candidate, task);
        }

        const steps = allTargets.map(target => computeRefinementStep(target.range));
        const scaleSettings = deriveSPSAScaleSettings(allTargets);
        const totalIterations = Math.max(1, task.iterations);

        let bestEntryParams = { ...task.initialEntryParams };
        let bestExitParams = { ...task.initialExitParams };
        let bestMetric = task.initialMetric;

        if (isNaN(bestMetric)) {
            bestMetric = task.targetMetric === 'maxDrawdown' ? Infinity : -Infinity;
        }

        let bestResult = null;

        for (let iteration = 0; iteration < task.iterations; iteration++) {
            const directionVector = allTargets.map(() => (Math.random() < 0.5 ? 1 : -1));
            const denominator = totalIterations > 1 ? (totalIterations - 1) : totalIterations;
            const progressRatio = denominator > 0 ? (iteration / denominator) : 1;
            const scaleRange = scaleSettings.initialScale - scaleSettings.minimumScale;
            const scaleFactor = Math.max(
                scaleSettings.minimumScale,
                scaleSettings.initialScale - (scaleRange * progressRatio)
            );

            const plusParams = applyParameterPerturbation(
                bestEntryParams,
                bestExitParams,
                allTargets,
                steps,
                directionVector,
                scaleFactor,
                task.targetMap
            );

            const plusEvaluation = await evaluateLocalRefinementCandidate(baseTemplate, plusParams.entryParams, plusParams.exitParams, task);
            incrementLocalRefinementProgress(task.context);

            if (plusEvaluation && isBetterMetric(plusEvaluation.metric, bestMetric, task.targetMetric)) {
                bestMetric = plusEvaluation.metric;
                bestResult = plusEvaluation.result;
                bestEntryParams = { ...plusParams.entryParams };
                bestExitParams = { ...plusParams.exitParams };
                continue;
            }

            const minusParams = applyParameterPerturbation(
                bestEntryParams,
                bestExitParams,
                allTargets,
                steps,
                directionVector.map(value => -value),
                scaleFactor,
                task.targetMap
            );

            const minusEvaluation = await evaluateLocalRefinementCandidate(baseTemplate, minusParams.entryParams, minusParams.exitParams, task);
            incrementLocalRefinementProgress(task.context);

            if (minusEvaluation && isBetterMetric(minusEvaluation.metric, bestMetric, task.targetMetric)) {
                bestMetric = minusEvaluation.metric;
                bestResult = minusEvaluation.result;
                bestEntryParams = { ...minusParams.entryParams };
                bestExitParams = { ...minusParams.exitParams };
            }
        }

        if (bestResult) {
            return bestResult;
        }

        const fallback = cloneResultForRefinement(task.candidate, task);
        fallback.buyParams = { ...bestEntryParams };
        fallback.sellParams = { ...bestExitParams };
        return fallback;

    } catch (error) {
        console.error('[Cross Optimization] SPSA refinement error:', error);
        return cloneResultForRefinement(task.candidate, task);
    }
}

async function runCEMRefinement(task) {
    try {
        const baseTemplate = buildRefinementBaseTemplate(task.candidate);
        let centerEntry = { ...task.initialEntryParams };
        let centerExit = { ...task.initialExitParams };
        let bestMetric = task.initialMetric;

        if (isNaN(bestMetric)) {
            bestMetric = task.targetMetric === 'maxDrawdown' ? Infinity : -Infinity;
        }

        let bestResult = null;
        let bestEntryParams = { ...centerEntry };
        let bestExitParams = { ...centerExit };

        const radiusSettings = deriveCEMRadiusSettings(task);
        let radius = radiusSettings.initialRadius;
        const decayRate = radiusSettings.decayRate;

        for (let iteration = 0; iteration < task.iterations; iteration++) {
            const population = Math.max(2, task.population || 4);
            const samples = [];

            for (let index = 0; index < population; index++) {
                const sampled = sampleAroundCenter(centerEntry, centerExit, task, radius);
                const evaluation = await evaluateLocalRefinementCandidate(baseTemplate, sampled.entryParams, sampled.exitParams, task);
                incrementLocalRefinementProgress(task.context);

                if (evaluation) {
                    samples.push({ ...evaluation, params: sampled });

                    if (isBetterMetric(evaluation.metric, bestMetric, task.targetMetric)) {
                        bestMetric = evaluation.metric;
                        bestResult = evaluation.result;
                        bestEntryParams = { ...sampled.entryParams };
                        bestExitParams = { ...sampled.exitParams };
                    }
                }
            }

            if (samples.length > 0) {
                samples.sort((a, b) => {
                    if (isBetterMetric(a.metric, b.metric, task.targetMetric)) return -1;
                    if (isBetterMetric(b.metric, a.metric, task.targetMetric)) return 1;
                    return 0;
                });

                const eliteCount = Math.max(1, Math.floor(samples.length / 3));
                const elite = samples.slice(0, eliteCount);

                centerEntry = averageParamsForType(elite.map(item => item.params.entryParams), task, 'entry', centerEntry);
                centerExit = averageParamsForType(elite.map(item => item.params.exitParams), task, 'exit', centerExit);
            }

            radius = Math.max(radiusSettings.minimumRadius, radius * decayRate);
        }

        if (bestResult) {
            return bestResult;
        }

        const fallback = cloneResultForRefinement(task.candidate, task);
        fallback.buyParams = { ...bestEntryParams };
        fallback.sellParams = { ...bestExitParams };
        return fallback;

    } catch (error) {
        console.error('[Cross Optimization] CEM refinement error:', error);
        return cloneResultForRefinement(task.candidate, task);
    }
}

function buildRefinementBaseTemplate(candidate) {
    const baseParams = getBacktestParams();
    const workerEntryStrategy = resolveWorkerStrategyName(candidate.buyStrategy);
    if (workerEntryStrategy) {
        baseParams.entryStrategy = workerEntryStrategy;
    }
    const workerExitStrategy = resolveWorkerStrategyName(candidate.sellStrategy);
    if (workerExitStrategy) {
        baseParams.exitStrategy = workerExitStrategy;
    }
    return baseParams;
}

async function evaluateLocalRefinementCandidate(baseTemplate, entryParams, exitParams, task) {
    try {
        const preparedParams = prepareBaseParamsForOptimization(baseTemplate);
        preparedParams.entryStrategy = baseTemplate.entryStrategy;
        preparedParams.exitStrategy = baseTemplate.exitStrategy;
        preparedParams.entryParams = { ...entryParams };
        preparedParams.exitParams = { ...exitParams };

        const evaluation = await performSingleBacktestFast(preparedParams);
        if (!evaluation) {
            return null;
        }

        const enriched = prepareRefinementResult(evaluation, task, entryParams, exitParams);
        return {
            result: enriched,
            metric: getMetricFromResult(enriched, task.targetMetric)
        };

    } catch (error) {
        console.error('[Cross Optimization] Error evaluating refinement candidate:', error);
        return null;
    }
}

function prepareRefinementResult(result, task, entryParams, exitParams) {
    const enriched = { ...result };
    enriched.buyStrategy = task.candidate.buyStrategy;
    enriched.sellStrategy = task.candidate.sellStrategy;
    enriched.buyParams = { ...entryParams };
    enriched.sellParams = { ...exitParams };
    enriched.crossOptimization = true;
    enriched.optimizationType = task.refinementLabel;
    enriched.refinementAlgorithm = task.algorithm === 'cem' ? 'CEM' : 'SPSA';
    enriched.refinedFrom = task.candidate.optimizationType || (Array.isArray(task.candidate.optimizationTypes) ? task.candidate.optimizationTypes.join(', ') : 'batch');
    enriched.refinementIterations = task.iterations;
    enriched.refinementMetric = task.targetMetric;
    return enriched;
}

function cloneResultForRefinement(candidate, task) {
    const clone = clonePlainObject(candidate);
    clone.crossOptimization = true;
    clone.optimizationType = task.refinementLabel;
    clone.refinementAlgorithm = task.algorithm === 'cem' ? 'CEM' : 'SPSA';
    clone.refinedFrom = candidate.optimizationType || (Array.isArray(candidate.optimizationTypes) ? candidate.optimizationTypes.join(', ') : 'batch');
    clone.buyStrategy = candidate.buyStrategy;
    clone.sellStrategy = candidate.sellStrategy;
    clone.buyParams = { ...task.initialEntryParams };
    clone.sellParams = { ...task.initialExitParams };
    return clone;
}

function computeRefinementStep(range) {
    if (!range) return 1.2;

    const from = typeof range.from === 'number' ? range.from : parseFloat(range.from);
    const to = typeof range.to === 'number' ? range.to : parseFloat(range.to);
    const span = (isFinite(from) && isFinite(to)) ? Math.abs(to - from) : 0;
    const rawStep = (typeof range.step === 'number' ? range.step : parseFloat(range.step));
    const baseStep = (isFinite(rawStep) && rawStep > 0)
        ? rawStep
        : (span > 0 ? span / 10 : 1);

    const explorationWeight = computeRangeExplorationWeight(range);
    const spanBoost = span > 0 ? span * 0.08 * explorationWeight : 0;
    const expandedStep = baseStep * (1.75 + explorationWeight * 0.9) + spanBoost;
    const cappedStep = span > 0 ? Math.min(span, expandedStep) : expandedStep;

    return Math.max(baseStep * 1.1, cappedStep || baseStep || 1);
}

function computeRangeExplorationWeight(range) {
    if (!range) {
        return 1.25;
    }

    const from = typeof range.from === 'number' ? range.from : parseFloat(range.from);
    const to = typeof range.to === 'number' ? range.to : parseFloat(range.to);

    if (!isFinite(from) || !isFinite(to)) {
        return 1.25;
    }

    const span = Math.abs(to - from);
    if (!isFinite(span) || span === 0) {
        return 1.25;
    }

    const rawStep = (typeof range.step === 'number' ? range.step : parseFloat(range.step));
    const baseStep = (isFinite(rawStep) && rawStep > 0) ? rawStep : span / 10;
    if (!isFinite(baseStep) || baseStep <= 0) {
        return 1.25;
    }

    const ratio = Math.max(1, span / baseStep);
    const normalized = clampNormalizedValue(Math.log(ratio + 1) / Math.log(32));
    return 1.1 + normalized * 0.75;
}

function deriveSPSAScaleSettings(targets) {
    if (!Array.isArray(targets) || targets.length === 0) {
        return { initialScale: 1.95, minimumScale: 0.8 };
    }

    const weights = targets
        .map(target => computeRangeExplorationWeight(target && target.range))
        .filter(weight => typeof weight === 'number' && !isNaN(weight));

    if (weights.length === 0) {
        return { initialScale: 1.95, minimumScale: 0.8 };
    }

    const averageWeight = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    const normalized = clampNormalizedValue((averageWeight - 1.1) / 0.75);
    const initialScale = 1.9 + normalized * 1.1;
    const minimumCandidate = 0.8 + normalized * 0.55;
    const minimumScale = Math.max(0.75, Math.min(initialScale * 0.7, minimumCandidate));

    return { initialScale, minimumScale };
}

function deriveCEMRadiusSettings(task) {
    const entryTargets = Array.isArray(task?.entryTargets) ? task.entryTargets : [];
    const exitTargets = Array.isArray(task?.exitTargets) ? task.exitTargets : [];
    const combinedTargets = [...entryTargets, ...exitTargets];

    if (combinedTargets.length === 0) {
        return {
            initialRadius: 0.78,
            decayRate: 0.68,
            minimumRadius: 0.38
        };
    }

    const weights = combinedTargets
        .map(target => computeRangeExplorationWeight(target && target.range))
        .filter(weight => typeof weight === 'number' && !isNaN(weight));

    if (weights.length === 0) {
        return {
            initialRadius: 0.78,
            decayRate: 0.68,
            minimumRadius: 0.38
        };
    }

    const averageWeight = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    const normalized = clampNormalizedValue((averageWeight - 1.1) / 0.75);
    const initialRadius = Math.max(0.65, Math.min(1.15, 0.72 + normalized * 0.45));
    const decayRate = Math.max(0.58, Math.min(0.8, 0.62 + normalized * 0.12));
    const minimumRadius = Math.max(0.35, Math.min(0.55, 0.38 + normalized * 0.2));

    return {
        initialRadius,
        decayRate,
        minimumRadius
    };
}

function clampToRange(value, range) {
    if (!range || typeof value !== 'number' || isNaN(value)) {
        return range?.from ?? value;
    }
    return Math.max(range.from, Math.min(range.to, value));
}

function alignValueToStep(value, range) {
    if (!range) return value;
    if (typeof range.step !== 'number' || range.step <= 0) {
        return value;
    }

    const steps = Math.round((value - range.from) / range.step);
    const aligned = range.from + steps * range.step;
    const clamped = clampToRange(aligned, range);
    return Number.isInteger(range.step) ? Math.round(clamped) : parseFloat(clamped.toFixed(6));
}

function normalizeValueToRange(value, range) {
    if (!range) return 0.5;
    const clamped = clampToRange(typeof value === 'number' ? value : parseFloat(value), range);
    const span = range.to - range.from;
    if (!isFinite(span) || span === 0) {
        return 0.5;
    }
    return (clamped - range.from) / span;
}

function denormalizeValueFromRange(normalized, range) {
    if (!range) return normalized;
    const span = range.to - range.from;
    return range.from + normalized * span;
}

function clampNormalizedValue(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return 0.5;
    }
    return Math.max(0, Math.min(1, value));
}

function applyParameterPerturbation(entryParams, exitParams, targets, steps, directionVector, scaleFactor, targetMap) {
    const updatedEntry = { ...entryParams };
    const updatedExit = { ...exitParams };

    targets.forEach((target, index) => {
        const key = `${target.strategyType}:${target.name}`;
        const meta = targetMap.get(key) || target;
        const holder = meta.strategyType === 'entry' ? updatedEntry : updatedExit;
        const currentValue = typeof holder[meta.name] === 'number' ? holder[meta.name] : parseFloat(holder[meta.name]);
        const baseValue = isNaN(currentValue) ? denormalizeValueFromRange(0.5, meta.range) : currentValue;
        const step = steps[index] * scaleFactor * directionVector[index];
        const tentative = baseValue + step;
        holder[meta.name] = alignValueToStep(clampToRange(tentative, meta.range), meta.range);
    });

    return { entryParams: updatedEntry, exitParams: updatedExit };
}

function sampleAroundCenter(entryCenter, exitCenter, task, radius) {
    const entrySample = { ...entryCenter };
    const exitSample = { ...exitCenter };

    task.entryTargets.forEach(target => {
        const normalized = normalizeValueToRange(entrySample[target.name], target.range);
        const offset = (Math.random() * 2 - 1) * radius;
        const candidate = denormalizeValueFromRange(clampNormalizedValue(normalized + offset), target.range);
        entrySample[target.name] = alignValueToStep(candidate, target.range);
    });

    task.exitTargets.forEach(target => {
        const normalized = normalizeValueToRange(exitSample[target.name], target.range);
        const offset = (Math.random() * 2 - 1) * radius;
        const candidate = denormalizeValueFromRange(clampNormalizedValue(normalized + offset), target.range);
        exitSample[target.name] = alignValueToStep(candidate, target.range);
    });

    return { entryParams: entrySample, exitParams: exitSample };
}

function averageParamsForType(paramList, task, type, currentCenter) {
    if (!paramList || paramList.length === 0) {
        return { ...currentCenter };
    }

    const averaged = { ...currentCenter };
    const targets = type === 'entry' ? task.entryTargets : task.exitTargets;

    targets.forEach(target => {
        let sum = 0;
        let count = 0;

        paramList.forEach(params => {
            if (params && params[target.name] !== undefined) {
                const value = typeof params[target.name] === 'number' ? params[target.name] : parseFloat(params[target.name]);
                if (!isNaN(value)) {
                    sum += value;
                    count += 1;
                }
            }
        });

        if (count > 0) {
            const average = sum / count;
            averaged[target.name] = alignValueToStep(clampToRange(average, target.range), target.range);
        }
    });

    return averaged;
}

function buildRefinementTargetMap(entryTargets, exitTargets) {
    const map = new Map();
    entryTargets.forEach(target => map.set(`entry:${target.name}`, target));
    exitTargets.forEach(target => map.set(`exit:${target.name}`, target));
    return map;
}

function incrementLocalRefinementProgress(context) {
    const total = crossOptimizationProgress.total || 0;
    if (total > 0) {
        crossOptimizationProgress.current = Math.min(crossOptimizationProgress.current + 1, total);
    } else {
        crossOptimizationProgress.current += 1;
    }
    updateCrossOptimizationProgress(context);
}

function ensureInitialParams(params, strategyKey) {
    const cloned = clonePlainObject(params);
    const strategyInfo = strategyDescriptions[strategyKey];
    const defaults = strategyInfo?.defaultParams ? { ...strategyInfo.defaultParams } : {};
    const targets = Array.isArray(strategyInfo?.optimizeTargets) ? strategyInfo.optimizeTargets : [];

    targets.forEach(target => {
        if (cloned[target.name] === undefined) {
            if (defaults[target.name] !== undefined) {
                cloned[target.name] = defaults[target.name];
            } else if (target.range) {
                cloned[target.name] = (target.range.from + target.range.to) / 2;
            }
        }
    });

    return cloned;
}

// 找到最佳進場策略
function findBestEntryStrategy() {
    console.log('[Cross Optimization] Finding best entry strategy');
    console.log('[Cross Optimization] Batch results:', batchOptimizationResults);
    
    if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
        console.warn('[Cross Optimization] No batch optimization results available');
        if (batchDebugSession) {
            recordBatchDebug('best-result-missing', {
                strategy,
                strategyType,
                reason: 'no-results'
            }, { phase: 'cross', level: 'warn', consoleLevel: 'warn' });
        }
        return null;
    }
    
    // 按年化報酬率排序，找到最佳結果
    const sorted = [...batchOptimizationResults].sort((a, b) => {
        const aReturn = a.annualizedReturn || -Infinity;
        const bReturn = b.annualizedReturn || -Infinity;
        return bReturn - aReturn;
    });
    
    console.log('[Cross Optimization] Best entry strategy:', sorted[0]);
    return sorted[0];
}

// 找到最佳出場策略
function findBestExitStrategy() {
    if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
        return null;
    }
    
    // 按年化報酬率排序，找到最佳結果
    const sorted = [...batchOptimizationResults].sort((a, b) => (b.annualizedReturn || 0) - (a.annualizedReturn || 0));
    return sorted[0];
}

// 找到特定策略的最佳結果
function findBestResultForStrategy(strategy, strategyType) {
    console.log(`[Cross Optimization] Finding best result for ${strategyType} strategy:`, strategy);
    
    if (!batchOptimizationResults || batchOptimizationResults.length === 0) {
        console.warn('[Cross Optimization] No batch optimization results available');
        return null;
    }
    
    // 過濾出使用該策略的結果
    const filteredResults = batchOptimizationResults.filter(result => {
        if (strategyType === 'entry') {
            return result.buyStrategy === strategy;
        } else if (strategyType === 'exit') {
            return result.sellStrategy === strategy;
        }
        return false;
    });
    
    console.log(`[Cross Optimization] Filtered results for ${strategy}:`, filteredResults);
    
    if (filteredResults.length === 0) {
        console.warn(`[Cross Optimization] No results found for ${strategyType} strategy: ${strategy}`);
        if (batchDebugSession) {
            recordBatchDebug('best-result-missing', {
                strategy,
                strategyType,
                reason: 'no-filter-match'
            }, { phase: 'cross', level: 'warn', consoleLevel: 'warn' });
        }
        return null;
    }

    // 按年化報酬率排序，找到最佳結果
    const sorted = filteredResults.sort((a, b) => {
        const aReturn = a.annualizedReturn || -Infinity;
        const bReturn = b.annualizedReturn || -Infinity;
        return bReturn - aReturn;
    });

    console.log(`[Cross Optimization] Best result for ${strategy}:`, sorted[0]);
    if (batchDebugSession) {
        recordBatchDebug('best-result-found', {
            strategy,
            strategyType,
            result: summarizeResult(sorted[0])
        }, { phase: 'cross', console: false });
    }
    return sorted[0];
}

// 取得選中的進場策略
function getSelectedEntryStrategies() {
    const entryStrategies = [];
    const checkboxes = document.querySelectorAll('#buy-strategies-list input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        entryStrategies.push(checkbox.value);
    });
    return entryStrategies;
}

// 取得選中的出場策略
function getSelectedExitStrategies() {
    const exitStrategies = [];
    const checkboxes = document.querySelectorAll('#sell-strategies-list input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        exitStrategies.push(checkbox.value);
    });
    return exitStrategies;
}

// 執行交叉優化
async function performCrossOptimization(entryStrategy, entryParams, exitStrategy, optimizationType, exitParams = null) {
    try {
        console.log('[Cross Optimization] performCrossOptimization started:', {
            entryStrategy, entryParams, exitStrategy, optimizationType, exitParams
        });
        
        // 設定基礎參數
        const baseParams = getBacktestParams();
        console.log('[Cross Optimization] Base params obtained:', baseParams);

        const workerEntryStrategy = resolveWorkerStrategyName(entryStrategy);
        const workerExitStrategy = resolveWorkerStrategyName(exitStrategy);
        if (!workerEntryStrategy || !workerExitStrategy) {
            const message = '[Cross Optimization] 無法解析進出場策略映射，已停止交叉優化';
            console.error(message, { entryStrategy, exitStrategy });
            if (typeof showError === 'function') {
                showError('交叉優化無法解析進出場策略映射，請確認批量設定。');
            }
            return;
        }

        baseParams.entryStrategy = workerEntryStrategy;
        baseParams.exitStrategy = workerExitStrategy;
        
        console.log('[Cross Optimization] Strategy names converted:', {
            entryStrategy: baseParams.entryStrategy,
            exitStrategy: baseParams.exitStrategy
        });
        
        // 根據優化類型設定固定參數
        if (optimizationType === 'entry-fixed' && entryParams) {
            console.log('[Cross Optimization] Entry-fixed optimization, setting entry params:', entryParams);
            // 固定進場參數，優化出場參數
            baseParams.entryParams = { ...entryParams };
            
            // 優化出場策略參數
            const exitStrategyInfo = strategyDescriptions[exitStrategy];
            console.log('[Cross Optimization] Exit strategy info:', exitStrategyInfo);
            
            if (exitStrategyInfo && exitStrategyInfo.optimizeTargets) {
                console.log('[Cross Optimization] Starting exit strategy optimization...');
                const optimizedExitParams = await optimizeSingleStrategyParametersFast(exitStrategy, 'exit', exitStrategyInfo, baseParams);
                console.log('[Cross Optimization] Optimized exit params:', optimizedExitParams);
                baseParams.exitParams = optimizedExitParams;
            } else {
                console.log('[Cross Optimization] Using default exit params for:', exitStrategy);
                baseParams.exitParams = getDefaultStrategyParams(exitStrategy);
            }
            
        } else if (optimizationType === 'exit-fixed' && exitParams) {
            console.log('[Cross Optimization] Exit-fixed optimization, setting exit params:', exitParams);
            // 固定出場參數，優化進場參數
            baseParams.exitParams = { ...exitParams };
            
            // 優化進場策略參數
            const entryStrategyInfo = strategyDescriptions[entryStrategy];
            console.log('[Cross Optimization] Entry strategy info:', entryStrategyInfo);
            
            if (entryStrategyInfo && entryStrategyInfo.optimizeTargets) {
                console.log('[Cross Optimization] Starting entry strategy optimization...');
                const optimizedEntryParams = await optimizeSingleStrategyParametersFast(entryStrategy, 'entry', entryStrategyInfo, baseParams);
                console.log('[Cross Optimization] Optimized entry params:', optimizedEntryParams);
                baseParams.entryParams = optimizedEntryParams;
            } else {
                console.log('[Cross Optimization] Using default entry params for:', entryStrategy);
                baseParams.entryParams = getDefaultStrategyParams(entryStrategy);
            }
        } else {
            console.log('[Cross Optimization] Invalid optimization type or missing params:', {
                optimizationType, entryParams, exitParams
            });
            return null;
        }
        
        console.log('[Cross Optimization] Final backtest params:', baseParams);
        
        // 執行回測
        console.log('[Cross Optimization] Starting backtest...');
        const result = await performSingleBacktestFast(baseParams);
        console.log('[Cross Optimization] Backtest result:', result);
        
        if (result && result.annualizedReturn !== undefined) {
            console.log('[Cross Optimization] Valid result obtained, processing...');
            // 添加交叉優化標記
            result.crossOptimization = true;
            result.optimizationType = optimizationType;
            result.buyStrategy = entryStrategy;
            result.sellStrategy = exitStrategy;
            result.buyParams = baseParams.entryParams;
            result.sellParams = baseParams.exitParams;
            
            console.log('[Cross Optimization] Final result with metadata:', result);
            return result;
        } else {
            console.log('[Cross Optimization] Invalid or null result from backtest');
            return null;
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error in performCrossOptimization:', error);
        return null;
    }
}

// 優化單一策略參數（簡化版）
async function optimizeSingleStrategyParameters(strategy, strategyType, strategyInfo, baseParams) {
    try {
        console.log('[Cross Optimization] optimizeSingleStrategyParameters called:', {
            strategy, strategyType, strategyInfo: strategyInfo?.name
        });
        
        if (!strategyInfo.optimizeTargets || strategyInfo.optimizeTargets.length === 0) {
            console.log('[Cross Optimization] No optimize targets, using default params');
            const defaultParams = getDefaultStrategyParams(strategy);
            console.log('[Cross Optimization] Default params:', defaultParams);
            return defaultParams;
        }
        
        const optimizeTarget = strategyInfo.optimizeTargets[0]; // 優化第一個參數
        const range = optimizeTarget.range;
        
        console.log('[Cross Optimization] Optimization target:', optimizeTarget);
        
        let bestParams = getDefaultStrategyParams(strategy);
        let bestReturn = -Infinity;
        
        console.log('[Cross Optimization] Starting optimization with default params:', bestParams);
        
        // 簡單的網格搜索
        const steps = Math.min(10, Math.ceil((range.to - range.from) / range.step));
        const stepSize = (range.to - range.from) / steps;
        
        console.log('[Cross Optimization] Grid search parameters:', { steps, stepSize, range });
        
        for (let i = 0; i <= steps; i++) {
            const testValue = range.from + i * stepSize;
            const testParams = { ...bestParams };
            testParams[optimizeTarget.name] = testValue;
            
            // 設定測試參數
            const testBacktestParams = { ...baseParams };
            if (strategyType === 'entry') {
                testBacktestParams.entryParams = testParams;
            } else {
                testBacktestParams.exitParams = testParams;
            }
            
            console.log(`[Cross Optimization] Testing step ${i+1}/${steps+1} with value ${testValue}`);
            
            // 執行回測
            const result = await performSingleBacktest(testBacktestParams);
            
            if (result && result.annualizedReturn > bestReturn) {
                bestReturn = result.annualizedReturn;
                bestParams = { ...testParams };
                console.log(`[Cross Optimization] New best found: ${bestReturn}% with params:`, bestParams);
            }
        }
        
        console.log('[Cross Optimization] Optimization completed. Best params:', bestParams);
        return bestParams;
        
    } catch (error) {
        console.error('[Cross Optimization] Error optimizing single strategy:', error);
        return getDefaultStrategyParams(strategy);
    }
}

// 執行單次回測
function performSingleBacktest(params) {
    console.log('[Cross Optimization] performSingleBacktest called with:', {
        stockNo: params.stockNo,
        entryStrategy: params.entryStrategy,
        exitStrategy: params.exitStrategy,
        entryParams: params.entryParams,
        exitParams: params.exitParams
    });
    
    return new Promise((resolve) => {
        try {
            // 創建 Worker 進行回測
            const worker = new Worker(workerUrl);
            
            const timeoutId = setTimeout(() => {
                console.log('[Cross Optimization] Worker timeout');
                worker.terminate();
                resolve(null);
            }, 30000); // 30秒超時
            
            worker.onmessage = function(e) {
                console.log('[Cross Optimization] Worker response type:', e.data.type);
                
                // 處理進度消息，但不終止 Worker，繼續等待最終結果
                if (e.data.type === 'progress') {
                    console.log('[Cross Optimization] Progress update received, continuing...');
                    return; // 不要 resolve，繼續等待最終結果
                }
                
                // 處理最終結果
                clearTimeout(timeoutId);
                worker.terminate();
                
                if (e.data.type === 'result') {
                    console.log('[Cross Optimization] Worker returned valid result');
                    resolve(e.data.data);
                } else if (e.data.type === 'backtest_result') {
                    console.log('[Cross Optimization] Worker returned backtest_result');
                    resolve(e.data.result);
                } else if (e.data.type === 'error') {
                    console.error('[Cross Optimization] Worker error:', e.data.message);
                    resolve(null);
                } else {
                    console.log('[Cross Optimization] Unknown worker response type:', e.data.type);
                    resolve(null);
                }
            };
            
            worker.onerror = function(error) {
                console.error('[Cross Optimization] Worker onerror:', error);
                clearTimeout(timeoutId);
                worker.terminate();
                resolve(null);
            };
            
            // 發送回測請求 - 使用正確的消息類型
            console.log('[Cross Optimization] Sending message to worker...');
            const preparedParams = enrichParamsWithLookback(params);
            worker.postMessage({
                type: 'runBacktest',
                params: preparedParams,
                useCachedData: false
            });
            
        } catch (error) {
            console.error('[Cross Optimization] Error in performSingleBacktest:', error);
            resolve(null);
        }
    });
}

// 格式化百分比
function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    // 修正：數據已經是百分比格式，不需要再乘以100
    return `${value.toFixed(2)}%`;
}

// 格式化數字
function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return value.toFixed(2);
}

function ensureStrategyOption(selectElement, value, scopeLabel) {
    if (!selectElement) return;
    const hasOption = Array.from(selectElement.options).some((option) => option.value === value);
    if (!hasOption) {
        const message = `[Batch Optimization] Missing ${scopeLabel} option "${value}" in select element`;
        console.error(message);
        if (typeof showError === 'function') {
            const label = scopeLabel === 'entry' ? '進場' : '出場';
            showError(`批量優化載入失敗：找不到${label}策略選項「${value}」，請更新映射設定。`);
        }
        throw new Error(message);
    }
}

function resolveExitStrategySelectValue(strategyKey, exitStrategyElement) {
    if (!strategyKey) {
        const message = '[Batch Optimization] Result missing exit strategy field';
        console.error(message);
        if (typeof showError === 'function') {
            showError('批量優化結果缺少出場策略，請重新產出結果。');
        }
        throw new Error(message);
    }

    if (!Object.prototype.hasOwnProperty.call(EXIT_STRATEGY_SELECT_MAP, strategyKey)) {
        const message = `[Batch Optimization] Missing select mapping for exit strategy "${strategyKey}"`;
        console.error(message);
        if (typeof showError === 'function') {
            showError(`批量優化尚未定義「${strategyKey}」的欄位映射，請補齊對照表後再重試。`);
        }
        throw new Error(message);
    }

    const selectValue = EXIT_STRATEGY_SELECT_MAP[strategyKey];
    ensureStrategyOption(exitStrategyElement, selectValue, 'exit');
    return selectValue;
}

function applyRiskManagementSettings(result) {
    const stopLossInput = document.getElementById('stopLoss');
    const takeProfitInput = document.getElementById('takeProfit');
    const expectedStopLoss = result?.riskManagement?.stopLoss ?? result?.usedStopLoss;
    const expectedTakeProfit = result?.riskManagement?.takeProfit ?? result?.usedTakeProfit;

    if (stopLossInput && expectedStopLoss !== undefined && expectedStopLoss !== null) {
        stopLossInput.value = expectedStopLoss;
    }
    if (takeProfitInput && expectedTakeProfit !== undefined && expectedTakeProfit !== null) {
        takeProfitInput.value = expectedTakeProfit;
    }
}

function normalizeParamValue(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        return Number(numeric.toFixed(6));
    }
    return String(value);
}

function valuesAreEqual(expected, actual) {
    if (expected === actual) return true;
    if (typeof expected === 'number' && typeof actual === 'number') {
        return Math.abs(expected - actual) <= 1e-4;
    }
    return false;
}

function compareParamObjects(label, expectedParams = {}, actualParams = {}, mismatches = []) {
    const keys = new Set([...Object.keys(expectedParams || {}), ...Object.keys(actualParams || {})]);
    keys.forEach((key) => {
        const expected = normalizeParamValue(expectedParams?.[key]);
        const actual = normalizeParamValue(actualParams?.[key]);
        if (!valuesAreEqual(expected, actual)) {
            mismatches.push(`${label}「${key}」應為 ${expected ?? '無'}, 目前為 ${actual ?? '無'}`);
        }
    });
    return mismatches;
}

function assertBatchStrategySync(result) {
    if (typeof getBacktestParams !== 'function') {
        return true;
    }

    try {
        const currentParams = getBacktestParams();
        const mismatches = [];

        const expectedEntry = getWorkerStrategyName(result.buyStrategy);
        let currentEntryLabel = currentParams.entryStrategy;
        try {
            currentEntryLabel = getWorkerStrategyName(currentParams.entryStrategy);
        } catch (error) {
            mismatches.push('目前設定無法解析進場策略映射');
        }
        if (expectedEntry !== currentEntryLabel) {
            mismatches.push(`進場策略應為 ${expectedEntry}，目前為 ${currentEntryLabel ?? '無'}`);
        }

        const exitStrategyKey = result.sellStrategy || result.exitStrategy;
        if (exitStrategyKey) {
            const expectedExit = getWorkerStrategyName(exitStrategyKey);
            let currentExitLabel = currentParams.exitStrategy;
            try {
                currentExitLabel = getWorkerStrategyName(currentParams.exitStrategy);
            } catch (error) {
                mismatches.push('目前設定無法解析出場策略映射');
            }
            if (expectedExit !== currentExitLabel) {
                mismatches.push(`出場策略應為 ${expectedExit}，目前為 ${currentExitLabel ?? '無'}`);
            }
        }

        compareParamObjects('進場參數', result.buyParams, currentParams.entryParams, mismatches);

        const expectedExitParams = result.sellParams || result.exitParams;
        if (expectedExitParams && Object.keys(expectedExitParams).length > 0) {
            compareParamObjects('出場參數', expectedExitParams, currentParams.exitParams, mismatches);
        }

        const expectedStopLoss = normalizeParamValue(result?.riskManagement?.stopLoss ?? result?.usedStopLoss);
        const expectedTakeProfit = normalizeParamValue(result?.riskManagement?.takeProfit ?? result?.usedTakeProfit);
        const actualStopLoss = normalizeParamValue(currentParams?.stopLoss);
        const actualTakeProfit = normalizeParamValue(currentParams?.takeProfit);

        if (expectedStopLoss !== null && !valuesAreEqual(expectedStopLoss, actualStopLoss)) {
            mismatches.push(`停損應為 ${expectedStopLoss}%，目前為 ${actualStopLoss ?? '無'}`);
        }
        if (expectedTakeProfit !== null && !valuesAreEqual(expectedTakeProfit, actualTakeProfit)) {
            mismatches.push(`停利應為 ${expectedTakeProfit}%，目前為 ${actualTakeProfit ?? '無'}`);
        }

        if (mismatches.length > 0) {
            const detail = mismatches.join('；');
            const message = `[批量優化] 載入參數與結果不一致：${detail}`;
            console.error('[Batch Optimization] ' + message, { expected: result, current: currentParams });
            if (typeof showError === 'function') {
                showError(message);
            }
            if (batchDebugSession) {
                recordBatchDebug('dom-sync-mismatch', {
                    detail: mismatches,
                    result: summarizeResult(result)
                }, { phase: 'render', level: 'error', consoleLevel: 'error' });
            }
            return false;
        }

        console.log('[Batch Optimization] Loaded strategy matches current DOM parameters');
        if (batchDebugSession) {
            recordBatchDebug('dom-sync-pass', {
                result: summarizeResult(result)
            }, { phase: 'render', console: false });
        }
        return true;
    } catch (error) {
        console.error('[Batch Optimization] Failed to verify loaded batch strategy:', error);
        if (batchDebugSession) {
            recordBatchDebug('dom-sync-error', {
                message: error?.message || String(error),
                stack: error?.stack || null
            }, { phase: 'render', level: 'error', consoleLevel: 'error' });
        }
        return false;
    }
}

// 載入批量優化策略
function loadBatchStrategy(index) {
    const result = batchOptimizationResults[index];
    if (!result) {
        console.error('[Batch Optimization] No result found at index:', index);
        if (typeof showError === 'function') {
            showError('批量優化結果不存在，請重新選擇。');
        }
        if (batchDebugSession) {
            recordBatchDebug('load-strategy-missing', { index }, { phase: 'render', level: 'error', consoleLevel: 'error' });
        }
        return;
    }

    recordBatchDebug('load-strategy', {
        index,
        result: summarizeResult(result)
    }, { phase: 'render', consoleLevel: 'log' });

    try {
        const entryStrategyElement = document.getElementById('entryStrategy');
        const exitStrategyElement = document.getElementById('exitStrategy');

        if (!entryStrategyElement || !exitStrategyElement) {
            const message = '[Batch Optimization] Strategy select elements are missing';
            console.error(message);
            if (typeof showError === 'function') {
                showError('找不到進出場策略選單，請重新整理頁面後重試。');
            }
            if (batchDebugSession) {
                recordBatchDebug('load-strategy-error', {
                    message: 'select-missing',
                    result: summarizeResult(result)
                }, { phase: 'render', level: 'error', consoleLevel: 'error' });
            }
            return;
        }

        const entryStrategyKey = result.buyStrategy;
        ensureStrategyOption(entryStrategyElement, entryStrategyKey, 'entry');

        const exitStrategyKey = result.sellStrategy || result.exitStrategy;
        const exitSelectValue = resolveExitStrategySelectValue(exitStrategyKey, exitStrategyElement);

        entryStrategyElement.value = entryStrategyKey;
        exitStrategyElement.value = exitSelectValue;

        applyRiskManagementSettings(result);

        entryStrategyElement.dispatchEvent(new Event('change'));
        exitStrategyElement.dispatchEvent(new Event('change'));

        updateBatchStrategyParams('entry', result.buyParams, entryStrategyKey);

        const exitParams = result.sellParams || result.exitParams;
        if (exitParams && Object.keys(exitParams).length > 0) {
            updateBatchStrategyParams('exit', exitParams, exitStrategyKey);
        } else {
            console.log('[Batch Optimization] 出場策略參數為空，跳過參數更新');
        }

        const isConsistent = assertBatchStrategySync(result);

        const entryStrategyName = strategyDescriptions[entryStrategyKey]?.name || entryStrategyKey;
        if (typeof showSuccess === 'function') {
            showSuccess(`進場策略已載入：${entryStrategyName}`);
        }

        if (isConsistent && typeof confirm === 'function' && confirm(`批量優化策略參數已載入完成！\n\n是否立即執行回測以查看策略表現？`)) {
            setTimeout(() => {
                if (typeof runBacktestInternal === 'function') {
                    runBacktestInternal();
                }
            }, 100);
        }

        switchTab('optimization');
    } catch (error) {
        console.error('[Batch Optimization] Failed to load batch strategy:', error);
        if (batchDebugSession) {
            recordBatchDebug('load-strategy-error', {
                message: error?.message || String(error),
                stack: error?.stack || null,
                result: summarizeResult(result)
            }, { phase: 'render', level: 'error', consoleLevel: 'error' });
        }
    }
}

// 添加測試按鈕（開發用）
function addTestButton() {
    const batchOptimizationDiv = document.querySelector('#batchOptimization');
    if (batchOptimizationDiv) {
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 測試載入策略修復';
        testButton.className = 'px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded border mr-2';
        testButton.onclick = testLoadStrategyFix;
        
        const firstButton = batchOptimizationDiv.querySelector('button');
        if (firstButton) {
            firstButton.parentNode.insertBefore(testButton, firstButton);
        }
    }
}

// 測試載入策略修復
function testLoadStrategyFix() {
    console.log('[Test] Creating test batch optimization result with death cross strategies...');
    
    // 創建測試數據 - 包含各種死亡交叉策略
    const testResults = [
        {
            buyStrategy: 'ma_cross',
            sellStrategy: 'ma_cross_exit', // 均線死亡交叉
            buyParams: { shortPeriod: 5, longPeriod: 20 },
            sellParams: { shortPeriod: 3, longPeriod: 15 },
            annualizedReturn: 0.15,
            sharpeRatio: 1.2,
            maxDrawdown: 0.08,
            totalReturn: 0.45,
            // 模擬 worker 可能添加的混淆字段
            exitStrategy: null,
            entryStrategy: 'ma_cross',
            exitParams: null
        },
        {
            buyStrategy: 'rsi_oversold',
            sellStrategy: 'k_d_cross_exit', // KD死亡交叉
            buyParams: { period: 14, threshold: 30 },
            sellParams: { period: 9, thresholdY: 70 },
            annualizedReturn: 0.12,
            sharpeRatio: 1.0,
            maxDrawdown: 0.10,
            totalReturn: 0.38,
            exitStrategy: null,
            entryStrategy: 'rsi_oversold',
            exitParams: null
        },
        {
            buyStrategy: 'macd_cross',
            sellStrategy: 'macd_cross_exit', // MACD死亡交叉
            buyParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 },
            sellParams: { shortPeriod: 10, longPeriod: 24, signalPeriod: 8 },
            annualizedReturn: 0.18,
            sharpeRatio: 1.5,
            maxDrawdown: 0.06,
            totalReturn: 0.52,
            exitStrategy: null,
            entryStrategy: 'macd_cross',
            exitParams: null
        }
    ];
    
    // 添加到結果中
    batchOptimizationResults = testResults;
    
    // 顯示結果
    displayBatchOptimizationResults();
    
    console.log('[Test] Test results created with death cross strategies. Try loading them now.');
    showInfo('已創建包含死亡交叉策略的測試結果，請點擊表格中的"載入"按鈕測試修復效果');
}

// 更新策略參數
function updateBatchStrategyParams(type, params, strategyName = null) {
    // 檢查參數是否有效
    if (!params || typeof params !== 'object') {
        console.warn(`[Batch Optimization] Invalid params for ${type}:`, params);
        return;
    }

    try {
        let currentStrategy = strategyName;
        if (!currentStrategy) {
            const strategySelect = document.getElementById(`${type}Strategy`);
            currentStrategy = strategySelect ? strategySelect.value : '';
        }

        if (!currentStrategy) {
            console.warn(`[Batch Optimization] Cannot determine strategy for ${type} params update`, params);
            return;
        }

        const fieldMap = resolveParamFieldMap(currentStrategy);
        if (!fieldMap) {
            console.warn(`[Batch Optimization] No param mapping found for strategy ${currentStrategy}`);
            return;
        }

        console.log(`[Batch Optimization] Updating ${type} params for strategy: ${currentStrategy}`, params);

        for (const [key, value] of Object.entries(params)) {
            if (key && value !== undefined && value !== null) {
                const suffix = fieldMap[key];
                if (!suffix) {
                    const message = `[Batch Optimization] Missing field mapping for ${currentStrategy}.${key}`;
                    console.error(message);
                    if (typeof showError === 'function') {
                        showError(`批量優化缺少「${currentStrategy}.${key}」的欄位映射，請更新批量設定。`);
                    }
                    continue;
                }

                const inputId = `${type}${suffix}`;
                const input = document.getElementById(inputId);
                if (!input) {
                    const message = `[Batch Optimization] Input element not found for ${inputId} (${currentStrategy}.${key})`;
                    console.error(message);
                    if (typeof showError === 'function') {
                        showError(`批量優化無法找到欄位 ${inputId}，請確認表單欄位是否存在。`);
                    }
                    continue;
                }

                input.value = value;
            }
        }
    } catch (error) {
        console.error(`[Batch Optimization] Error updating strategy params for ${type}:`, error);
    }
}

// 儲存批量優化策略
// 切換頁籤
function switchTab(tabName) {
    // 隱藏所有頁籤內容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有頁籤按鈕的active狀態
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('border-blue-500', 'text-blue-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    
    // 顯示選中的頁籤內容
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 更新選中頁籤按鈕的狀態
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetButton) {
        targetButton.classList.remove('border-transparent', 'text-gray-500');
        targetButton.classList.add('border-blue-500', 'text-blue-600');
    }
}

// 優化所有策略參數
async function optimizeAllStrategies(buyStrategies, sellStrategies, config) {
    const optimizedBuy = {};
    const optimizedSell = {};
    
    const totalStrategies = buyStrategies.length + sellStrategies.length;
    let completedStrategies = 0;
    
    // 優化進場策略
    for (const strategy of buyStrategies) {
        updateBatchProgress(5 + (completedStrategies / totalStrategies) * 20, 
            `優化進場策略: ${strategyDescriptions[strategy]?.name || strategy}...`);
        
        optimizedBuy[strategy] = await optimizeStrategyParameters(strategy, 'entry', config.targetMetric, config.parameterTrials);
        completedStrategies++;
    }
    
    // 優化出場策略
    for (const strategy of sellStrategies) {
        updateBatchProgress(5 + (completedStrategies / totalStrategies) * 20, 
            `優化出場策略: ${strategyDescriptions[strategy]?.name || strategy}...`);
        
        optimizedSell[strategy] = await optimizeStrategyParameters(strategy, 'exit', config.targetMetric, config.parameterTrials);
        completedStrategies++;
    }
    
    return {
        buy: optimizedBuy,
        sell: optimizedSell
    };
}

// 生成優化後的策略組合
function generateOptimizedStrategyCombinations(optimizedBuyStrategies, optimizedSellStrategies) {
    const combinations = [];
    
    for (const [buyStrategy, buyParams] of Object.entries(optimizedBuyStrategies)) {
        for (const [sellStrategy, sellParams] of Object.entries(optimizedSellStrategies)) {
            const combination = {
                buyStrategy: buyStrategy,
                sellStrategy: sellStrategy,
                buyParams: buyParams,
                sellParams: sellParams
            };
            
            // 檢查是否為風險管理策略，如果是則將參數加入到風險管理設定中
            if ((sellStrategy === 'fixed_stop_loss' || sellStrategy === 'cover_fixed_stop_loss') && sellParams) {
                combination.riskManagement = sellParams;
                combination.sellParams = {}; // 風險管理策略本身沒有策略參數
                console.log(`[Batch Optimization] Risk management parameters for ${sellStrategy}:`, sellParams);
            }
            
            combinations.push(combination);
        }
    }
    
    return combinations;
}

// 生成策略組合（使用策略的預設參數）
function generateStrategyCombinations(buyStrategies, sellStrategies) {
    const combinations = [];

    for (const buyStrategy of buyStrategies) {
        const buyParams = getDefaultStrategyParams(buyStrategy) || {};

        for (const sellStrategy of sellStrategies) {
            const sellParams = getDefaultStrategyParams(sellStrategy) || {};
            const combination = {
                buyStrategy: buyStrategy,
                sellStrategy: sellStrategy,
                buyParams: { ...buyParams },
                sellParams: { ...sellParams }
            };

            // 處理風險管理策略（如 fixed_stop_loss, cover_fixed_stop_loss）
            if ((sellStrategy === 'fixed_stop_loss' || sellStrategy === 'cover_fixed_stop_loss') && sellParams && Object.keys(sellParams).length > 0) {
                combination.riskManagement = { ...sellParams };
                combination.sellParams = {}; // 風險管理策略本身不使用 exitParams
            }

            combinations.push(combination);
        }
    }

    return combinations;
}

// 更新批量進度（支援自訂訊息）
function updateBatchProgress(percentage, message) {
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    const progressDetail = document.getElementById('batch-progress-detail');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    if (progressDetail && message) {
        let displayMessage = message;
        
        // 計算剩餘時間（只有在進度 > 5% 時才顯示）
        if (percentage > 5 && batchOptimizationStartTime) {
            const elapsedTime = Date.now() - batchOptimizationStartTime;
            const estimatedTotal = (elapsedTime / percentage) * 100;
            const remainingTime = estimatedTotal - elapsedTime;
            
            if (remainingTime > 0) {
                const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));
                const remainingSeconds = Math.ceil((remainingTime % (1000 * 60)) / 1000);
                
                if (remainingMinutes > 0) {
                    displayMessage += ` (預計剩餘: ${remainingMinutes}分${remainingSeconds}秒)`;
                } else {
                    displayMessage += ` (預計剩餘: ${remainingSeconds}秒)`;
                }
            }
        }
        
        progressDetail.textContent = displayMessage;
    }
}

// 顯示批量優化進度
function showBatchProgress() {
    console.log('[Batch Optimization] showBatchProgress called');
    const progressElement = document.getElementById('batch-optimization-progress');
    if (progressElement) {
        console.log('[Batch Optimization] Progress element found, showing...');
        progressElement.classList.remove('hidden');
    } else {
        console.error('[Batch Optimization] Progress element not found!');
    }
    
    // 隱藏結果區域
    const resultsDiv = document.getElementById('batch-optimization-results');
    if (resultsDiv) {
        resultsDiv.classList.add('hidden');
    }
    
    // 初始化進度
    updateBatchProgress(0, '準備中...');
}

// 隱藏批量優化進度
function hideBatchProgress() {
    const progressElement = document.getElementById('batch-optimization-progress');
    if (progressElement) {
        progressElement.classList.add('hidden');
    }
}

function cloneCombinationInput(combination) {
    if (!combination || typeof combination !== 'object') {
        return null;
    }

    const clone = {
        buyStrategy: combination.buyStrategy || null,
        sellStrategy: combination.sellStrategy || null,
        buyParams: clonePlainObject(combination.buyParams || {}),
        sellParams: clonePlainObject(combination.sellParams || {}),
    };

    if (combination.riskManagement) {
        clone.riskManagement = clonePlainObject(combination.riskManagement);
    }
    if (combination.shortEntryStrategy) {
        clone.shortEntryStrategy = combination.shortEntryStrategy;
    }
    if (combination.shortExitStrategy) {
        clone.shortExitStrategy = combination.shortExitStrategy;
    }
    if (combination.shortEntryParams) {
        clone.shortEntryParams = clonePlainObject(combination.shortEntryParams);
    }
    if (combination.shortExitParams) {
        clone.shortExitParams = clonePlainObject(combination.shortExitParams);
    }

    return clone;
}

function cloneCombinationResult(result) {
    if (!result || typeof result !== 'object') {
        return null;
    }

    const clone = cloneCombinationInput(result) || {};

    if (result.optimizationType) {
        clone.optimizationType = result.optimizationType;
    }
    if (Array.isArray(result.optimizationTypes)) {
        clone.optimizationTypes = [...result.optimizationTypes];
    }
    if (result.__finalResult) {
        clone.__finalResult = clonePlainObject(result.__finalResult);
    }
    if (result.__finalMetric !== undefined) {
        clone.__finalMetric = result.__finalMetric;
    }
    if (result.__metricLabel !== undefined) {
        clone.__metricLabel = result.__metricLabel;
    }

    return clone;
}

function captureBatchResultsSnapshot() {
    if (!Array.isArray(batchOptimizationResults)) {
        return [];
    }

    try {
        return JSON.parse(JSON.stringify(batchOptimizationResults));
    } catch (error) {
        console.warn('[Batch Optimization] Failed to deep clone batch results snapshot via JSON:', error);
        return batchOptimizationResults.map(result => clonePlainObject(result));
    }
}

function restoreBatchResultsSnapshot(snapshot) {
    if (!Array.isArray(snapshot)) {
        batchOptimizationResults = [];
        return;
    }

    try {
        batchOptimizationResults = JSON.parse(JSON.stringify(snapshot));
    } catch (error) {
        console.warn('[Batch Optimization] Failed to restore batch results snapshot via JSON:', error);
        batchOptimizationResults = snapshot.map(result => clonePlainObject(result));
    }
}

function captureBatchWorkerStatusSnapshot(status) {
    if (!status || typeof status !== 'object') {
        return { concurrencyLimit: 0, inFlightCount: 0, entries: [] };
    }

    const snapshot = {
        concurrencyLimit: status.concurrencyLimit ?? 0,
        inFlightCount: status.inFlightCount ?? 0,
        entries: Array.isArray(status.entries)
            ? status.entries.map(entry => clonePlainObject(entry))
            : []
    };

    return snapshot;
}

function restoreBatchWorkerStatusSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        batchWorkerStatus = { concurrencyLimit: 0, inFlightCount: 0, entries: [] };
        return;
    }

    batchWorkerStatus = {
        concurrencyLimit: snapshot.concurrencyLimit ?? 0,
        inFlightCount: snapshot.inFlightCount ?? 0,
        entries: Array.isArray(snapshot.entries)
            ? snapshot.entries.map(entry => clonePlainObject(entry))
            : []
    };
}

function sanitizeOptimizationConfig(config = {}) {
    const sanitized = clonePlainObject(config) || {};

    if (!sanitized.targetMetric) {
        sanitized.targetMetric = 'annualizedReturn';
    }

    const parsedTrials = parseInt(sanitized.parameterTrials, 10);
    sanitized.parameterTrials = Number.isFinite(parsedTrials) && parsedTrials > 0
        ? parsedTrials
        : 100;

    const parsedIterations = parseInt(sanitized.iterationLimit, 10);
    sanitized.iterationLimit = Number.isFinite(parsedIterations) && parsedIterations > 0
        ? parsedIterations
        : 6;

    if (sanitized.optimizeTargets && !Array.isArray(sanitized.optimizeTargets)) {
        sanitized.optimizeTargets = [sanitized.optimizeTargets];
    }

    return sanitized;
}

function sanitizeOptimizationOptions(options = {}) {
    if (!options || typeof options !== 'object') {
        return {};
    }

    const sanitized = {};

    if (Array.isArray(options.enabledScopes)) {
        sanitized.enabledScopes = [...options.enabledScopes];
    }

    if (options.baseParamsOverride && typeof options.baseParamsOverride === 'object') {
        sanitized.baseParamsOverride = prepareBaseParamsForOptimization(options.baseParamsOverride);
    }

    if (Array.isArray(options.cachedDataOverride)) {
        sanitized.cachedDataOverride = options.cachedDataOverride.slice();
    }

    if (options.sessionContext && typeof options.sessionContext === 'object') {
        sanitized.sessionContext = clonePlainObject(options.sessionContext);
    }

    return sanitized;
}

async function runCombinationOptimizationHeadless(combination, config, options = {}) {
    const preparedCombination = cloneCombinationInput(combination);
    if (!preparedCombination) {
        throw new Error('[Batch Optimization] Invalid combination payload for optimization');
    }

    const preparedConfig = sanitizeOptimizationConfig(config);
    const preparedOptions = sanitizeOptimizationOptions(options);

    if (!preparedOptions.sessionContext) {
        preparedOptions.sessionContext = { source: 'external-headless' };
    }

    const previousCachedStockData = typeof cachedStockData !== 'undefined' ? cachedStockData : undefined;
    const previousDiagnostics = typeof lastDatasetDiagnostics !== 'undefined' ? lastDatasetDiagnostics : undefined;
    const previousOverallResult = typeof lastOverallResult !== 'undefined' ? lastOverallResult : undefined;
    const baselineCacheSummary = summarizeDatasetRange(previousCachedStockData);
    const overrideCacheSummary = summarizeDatasetRange(preparedOptions.cachedDataOverride);

    const previousDebugSession = batchDebugSession;
    const previousProgress = { ...currentBatchProgress };
    const previousStopFlag = isBatchOptimizationStopped;
    const previousResultsSnapshot = captureBatchResultsSnapshot();
    const previousWorkerStatusSnapshot = captureBatchWorkerStatusSnapshot(batchWorkerStatus);
    const previousConfigSnapshot = clonePlainObject(batchOptimizationConfig);
    const previousRunningFlag = Boolean(window.batchOptimizationRunning);
    const previousWorkerInstance = batchOptimizationWorker;
    const activeCacheStore = getActiveCacheStore();
    const previousCacheStoreSnapshot = captureCacheStoreSnapshot(activeCacheStore);
    const previousCacheEntryCount = Array.isArray(previousCacheStoreSnapshot) ? previousCacheStoreSnapshot.length : 0;
    const previousCacheKeysPreview = Array.isArray(previousCacheStoreSnapshot)
        ? previousCacheStoreSnapshot.slice(0, 5).map(([key]) => key)
        : [];
    const previousLastFetchSettings = captureLastFetchSettingsSnapshot();

    let headlessSession = null;

    lastHeadlessOptimizationSummary = null;

    try {
        isBatchOptimizationStopped = false;
        headlessSession = startBatchDebugSession({
            phase: 'external',
            source: preparedOptions.sessionContext.source,
            quiet: true,
            mode: 'headless'
        });

        recordBatchDebug('headless-state-snapshot', {
            resultsCount: previousResultsSnapshot.length,
            workerEntries: Array.isArray(previousWorkerStatusSnapshot.entries)
                ? previousWorkerStatusSnapshot.entries.length
                : 0,
            runningFlag: previousRunningFlag,
            stopFlag: previousStopFlag,
            progress: clonePlainObject(previousProgress),
            cacheEntries: previousCacheEntryCount,
            cacheKeysPreview: previousCacheKeysPreview,
            lastFetchSettingsPreserved: Boolean(previousLastFetchSettings)
        }, { phase: 'external', console: false });

        recordBatchDebug('headless-cache-state', {
            baselineCache: baselineCacheSummary,
            overrideCache: overrideCacheSummary,
            diagnosticsPreserved: Boolean(previousDiagnostics),
            overallResultPreserved: Boolean(previousOverallResult),
            cacheEntries: previousCacheEntryCount
        }, { phase: 'external', console: false });

        const result = await optimizeCombinationIterative(preparedCombination, preparedConfig, preparedOptions);

        if (result) {
            const metricLabel = result.__metricLabel || preparedConfig.targetMetric || 'annualizedReturn';
            let metricValue = Number.isFinite(result.__finalMetric) ? result.__finalMetric : null;
            if (metricValue === null) {
                const fallbackMetric = getMetricFromResult(result, metricLabel);
                metricValue = Number.isFinite(fallbackMetric) ? fallbackMetric : null;
            }

            lastHeadlessOptimizationSummary = {
                combination: summarizeCombination(result),
                metric: metricValue,
                metricLabel,
                timestamp: Date.now(),
                source: preparedOptions.sessionContext.source || 'external-headless',
                baselineCache: baselineCacheSummary,
                overrideCache: overrideCacheSummary
            };

            recordBatchDebug('headless-result', {
                combination: lastHeadlessOptimizationSummary.combination,
                metric: lastHeadlessOptimizationSummary.metric,
                metricLabel,
                baselineCache: baselineCacheSummary,
                overrideCache: overrideCacheSummary
            }, { phase: 'external', console: false });
        } else {
            lastHeadlessOptimizationSummary = null;
            recordBatchDebug('headless-result-missing', {
                combination: summarizeCombination(preparedCombination)
            }, { phase: 'external', level: 'warn', consoleLevel: 'warn' });
        }

        if (headlessSession && batchDebugSession === headlessSession) {
            finalizeBatchDebugSession({
                status: 'completed',
                mode: 'headless',
                combination: summarizeCombination(result)
            });
        }

        return cloneCombinationResult(result);
    } finally {
        restoreCacheStoreSnapshot(previousCacheStoreSnapshot, activeCacheStore);
        restoreLastFetchSettingsSnapshot(previousLastFetchSettings);

        const restoredCacheEntryCount = activeCacheStore instanceof Map ? activeCacheStore.size : previousCacheEntryCount;
        const restoredCacheKeysPreview = activeCacheStore instanceof Map
            ? Array.from(activeCacheStore.keys()).slice(0, 5)
            : previousCacheKeysPreview;

        if (headlessSession && batchDebugSession === headlessSession) {
            recordBatchDebug('headless-cache-restore', {
                restoredBaseline: baselineCacheSummary,
                restoredDiagnostics: Boolean(previousDiagnostics),
                restoredOverallResult: Boolean(previousOverallResult),
                cacheEntriesRestored: restoredCacheEntryCount,
                cacheKeysPreview: restoredCacheKeysPreview,
                lastFetchSettingsRestored: Boolean(previousLastFetchSettings)
            }, { phase: 'external', console: false });
        }

        if (typeof cachedStockData !== 'undefined') {
            cachedStockData = previousCachedStockData;
        }
        if (typeof lastDatasetDiagnostics !== 'undefined') {
            lastDatasetDiagnostics = previousDiagnostics;
        }
        if (typeof lastOverallResult !== 'undefined') {
            lastOverallResult = previousOverallResult;
        }

        restoreBatchResultsSnapshot(previousResultsSnapshot);
        restoreBatchWorkerStatusSnapshot(previousWorkerStatusSnapshot);
        batchOptimizationConfig = clonePlainObject(previousConfigSnapshot) || {};
        window.batchOptimizationRunning = previousRunningFlag;
        batchOptimizationWorker = previousWorkerInstance;
        currentBatchProgress = { ...previousProgress };
        isBatchOptimizationStopped = previousStopFlag;

        if (headlessSession && batchDebugSession === headlessSession) {
            recordBatchDebug('headless-state-restore', {
                resultsCount: Array.isArray(batchOptimizationResults) ? batchOptimizationResults.length : 0,
                workerEntries: Array.isArray(batchWorkerStatus.entries) ? batchWorkerStatus.entries.length : 0,
                runningFlag: window.batchOptimizationRunning,
                stopFlag: isBatchOptimizationStopped,
                progress: clonePlainObject(currentBatchProgress)
            }, { phase: 'external', console: false });
            batchDebugSession = previousDebugSession || null;
        } else if (previousDebugSession) {
            batchDebugSession = previousDebugSession;
        }

        notifyBatchDebugListeners();
    }
}

// 導出函數供外部使用
window.batchOptimization = {
    init: initBatchOptimization,
    loadStrategy: loadBatchStrategy,
    stop: stopBatchOptimization,
    getWorkerStrategyName: getWorkerStrategyName,
    runCombinationOptimization: (combination, config, options = {}) => runCombinationOptimizationHeadless(combination, config, options),
    getDebugLog: getBatchDebugSnapshot,
    downloadDebugLog: () => downloadBatchDebugLog('batch-optimization'),
    finalizeDebugSession: finalizeBatchDebugSession,
    startDebugSession: startBatchDebugSession,
    subscribeDebugLog: subscribeBatchDebugLog,
    clearDebugLog: clearBatchDebugSession
};

// 測試風險管理優化功能
function testRiskManagementOptimization() {
    console.log('[Test] Testing risk management optimization...');
    
    // 測試策略設定
    const testStrategies = [
        {
            entryStrategy: 'ma_cross',
            exitStrategy: 'fixed_stop_loss',
            shortEntryStrategy: 'none',
            shortExitStrategy: 'none'
        }
    ];
    
    console.log('[Test] Testing fixed_stop_loss strategy optimization with both stopLoss and takeProfit...');
    
    // 測試 optimizeStrategyParameters 函數（現在應該優化兩個參數）
    optimizeStrategyParameters('fixed_stop_loss', 'exit', 'annualizedReturn', 20)
        .then(result => {
            console.log('[Test] Risk management optimization result:', result);
            console.log('[Test] Expected: optimized stopLoss AND takeProfit parameters');
            
            const hasStopLoss = result && result.stopLoss !== undefined;
            const hasTakeProfit = result && result.takeProfit !== undefined;
            
            if (hasStopLoss && hasTakeProfit) {
                console.log('[Test] ✓ Multi-parameter optimization successful!');
                console.log('[Test] ✓ stopLoss:', result.stopLoss);
                console.log('[Test] ✓ takeProfit:', result.takeProfit);
            } else if (hasStopLoss) {
                console.log('[Test] ⚠ Only stopLoss optimized:', result.stopLoss);
                console.log('[Test] ✗ takeProfit missing');
            } else if (hasTakeProfit) {
                console.log('[Test] ⚠ Only takeProfit optimized:', result.takeProfit);
                console.log('[Test] ✗ stopLoss missing');
            } else {
                console.log('[Test] ✗ Risk management optimization failed or returned empty result');
            }
        })
        .catch(error => {
            console.error('[Test] Risk management optimization error:', error);
        });
}

// 測試多參數策略優化
function testMultiParameterStrategyOptimization() {
    console.log('[Test] Testing multi-parameter strategy optimization...');
    
    // 測試均線策略（有 shortPeriod 和 longPeriod 兩個參數）
    console.log('[Test] Testing ma_cross strategy with shortPeriod and longPeriod...');
    
    optimizeStrategyParameters('ma_cross', 'entry', 'annualizedReturn', 40)
        .then(result => {
            console.log('[Test] MA cross optimization result:', result);
            console.log('[Test] Expected: optimized shortPeriod AND longPeriod parameters');
            
            const hasShortPeriod = result && result.shortPeriod !== undefined;
            const hasLongPeriod = result && result.longPeriod !== undefined;
            
            if (hasShortPeriod && hasLongPeriod) {
                console.log('[Test] ✓ Multi-parameter strategy optimization successful!');
                console.log('[Test] ✓ shortPeriod:', result.shortPeriod);
                console.log('[Test] ✓ longPeriod:', result.longPeriod);
            } else {
                console.log('[Test] ✗ Some parameters missing in optimization result');
                console.log('[Test] hasShortPeriod:', hasShortPeriod);
                console.log('[Test] hasLongPeriod:', hasLongPeriod);
            }
        })
        .catch(error => {
            console.error('[Test] Multi-parameter strategy optimization error:', error);
        });
    
    // 測試 MACD 策略（有三個參數）
    console.log('[Test] Testing macd_cross strategy with three parameters...');
    
    optimizeStrategyParameters('macd_cross', 'entry', 'sharpeRatio', 60)
        .then(result => {
            console.log('[Test] MACD optimization result:', result);
            console.log('[Test] Expected: optimized shortPeriod, longPeriod AND signalPeriod');
            
            const hasShort = result && result.shortPeriod !== undefined;
            const hasLong = result && result.longPeriod !== undefined;
            const hasSignal = result && result.signalPeriod !== undefined;
            
            if (hasShort && hasLong && hasSignal) {
                console.log('[Test] ✓ Three-parameter optimization successful!');
                console.log('[Test] ✓ shortPeriod:', result.shortPeriod);
                console.log('[Test] ✓ longPeriod:', result.longPeriod);
                console.log('[Test] ✓ signalPeriod:', result.signalPeriod);
            } else {
                console.log('[Test] ✗ Some MACD parameters missing');
                console.log('[Test] hasShort:', hasShort, 'hasLong:', hasLong, 'hasSignal:', hasSignal);
            }
        })
        .catch(error => {
            console.error('[Test] MACD optimization error:', error);
        });
}

// 調試批量優化結果結構
function debugBatchResults() {
    console.log('[Debug] Checking batch optimization results...');
    console.log('[Debug] Results count:', batchOptimizationResults ? batchOptimizationResults.length : 0);
    
    if (batchOptimizationResults && batchOptimizationResults.length > 0) {
        batchOptimizationResults.forEach((result, index) => {
            console.log(`[Debug] Result ${index}:`, result);
            console.log(`[Debug] Result ${index} sellStrategy:`, result.sellStrategy);
            console.log(`[Debug] Result ${index} has riskManagement:`, 'riskManagement' in result);
            console.log(`[Debug] Result ${index} riskManagement:`, result.riskManagement);
            console.log(`[Debug] Result ${index} usedStopLoss:`, result.usedStopLoss);
            console.log(`[Debug] Result ${index} usedTakeProfit:`, result.usedTakeProfit);
            
            if (result.sellStrategy === 'fixed_stop_loss' || result.sellStrategy === 'cover_fixed_stop_loss') {
                if (!result.riskManagement) {
                    console.warn(`[Debug] Warning: Risk management strategy without riskManagement parameters!`);
                } else {
                    console.log(`[Debug] ✓ Risk management parameters found for result ${index}:`, result.riskManagement);
                }
            } else {
                // 非風險管理策略，檢查是否有實際使用的參數
                if (result.usedStopLoss !== undefined || result.usedTakeProfit !== undefined) {
                    console.log(`[Debug] ✓ Used risk parameters found for result ${index}: stopLoss=${result.usedStopLoss}, takeProfit=${result.usedTakeProfit}`);
                } else {
                    console.log(`[Debug] ⚠ No used risk parameters for result ${index}`);
                }
            }
        });
    } else {
        console.log('[Debug] No batch optimization results found');
    }
}

// 測試參數範圍和步進值計算
function testParameterRanges() {
    console.log('[Test] Testing parameter ranges calculation (using global config)...');
    
    // 使用全局配置的範圍和步長
    const stopLossConfig = globalOptimizeTargets.stopLoss;
    const takeProfitConfig = globalOptimizeTargets.takeProfit;
    
    console.log(`[Test] StopLoss config:`, stopLossConfig);
    console.log(`[Test] TakeProfit config:`, takeProfitConfig);
    
    const stopLossRange = stopLossConfig.range;
    const takeProfitRange = takeProfitConfig.range;
    
    const stopLossPoints = Math.floor((stopLossRange.to - stopLossRange.from) / stopLossRange.step) + 1;
    const takeProfitPoints = Math.floor((takeProfitRange.to - takeProfitRange.from) / takeProfitRange.step) + 1;
    
    console.log(`[Test] StopLoss: range ${stopLossRange.from}-${stopLossRange.to}, step ${stopLossRange.step}, points: ${stopLossPoints}`);
    console.log(`[Test] TakeProfit: range ${takeProfitRange.from}-${takeProfitRange.to}, step ${takeProfitRange.step}, points: ${takeProfitPoints}`);
    console.log(`[Test] Total risk combinations: ${stopLossPoints * takeProfitPoints}`);
}

// 檢查所有策略的參數配置
function checkAllStrategyParameters() {
    console.log('[Debug] Checking all strategy parameter configurations...');
    
    if (typeof strategyDescriptions === 'undefined') {
        console.error('[Debug] strategyDescriptions not found');
        return;
    }
    
    const strategies = Object.keys(strategyDescriptions);
    console.log(`[Debug] Found ${strategies.length} strategies to check`);
    
    strategies.forEach(strategyKey => {
        const strategy = strategyDescriptions[strategyKey];
        console.log(`\n[Debug] Strategy: ${strategyKey} (${strategy.name})`);
        console.log(`[Debug] Default params:`, strategy.defaultParams);
        
        if (strategy.optimizeTargets && strategy.optimizeTargets.length > 0) {
            console.log(`[Debug] ✓ Has ${strategy.optimizeTargets.length} optimizable parameters:`);
            strategy.optimizeTargets.forEach((target, index) => {
                console.log(`[Debug]   ${index + 1}. ${target.name} (${target.label}): range ${target.range.from}-${target.range.to}, step ${target.range.step}`);
            });
        } else {
            console.log(`[Debug] ⚠ No optimizable parameters defined`);
        }
    });
    
    // 統計
    const strategiesWithParams = strategies.filter(key => 
        strategyDescriptions[key].optimizeTargets && 
        strategyDescriptions[key].optimizeTargets.length > 0
    );
    
    const multiParamStrategies = strategies.filter(key => 
        strategyDescriptions[key].optimizeTargets && 
        strategyDescriptions[key].optimizeTargets.length > 1
    );
    
    console.log(`\n[Debug] Summary:`);
    console.log(`[Debug] - Total strategies: ${strategies.length}`);
    console.log(`[Debug] - Strategies with parameters: ${strategiesWithParams.length}`);
    console.log(`[Debug] - Multi-parameter strategies: ${multiParamStrategies.length}`);
    
    if (multiParamStrategies.length > 0) {
        console.log(`[Debug] - Multi-parameter strategies:`);
        multiParamStrategies.forEach(key => {
            const paramCount = strategyDescriptions[key].optimizeTargets.length;
            console.log(`[Debug]   * ${key}: ${paramCount} parameters`);
        });
    }
}

// 測試完整的批量優化功能（包含風險管理策略）
function testFullRiskManagementOptimization() {
    console.log('[Test] Testing full batch optimization with risk management...');
    
    if (!cachedStockData || cachedStockData.length < 20) {
        console.error('[Test] No cached stock data available. Please run a backtest first.');
        return;
    }
    
    // 模擬批量優化配置
    const testConfig = {
        buyStrategies: ['ma_cross'],
        sellStrategies: ['fixed_stop_loss'],
        maxCombinations: 2,
        batchSize: 1,
        sortKey: 'annualizedReturn',
        sortDirection: 'desc'
    };
    
    console.log('[Test] Starting test optimization with config:', testConfig);
    
    // 執行測試優化
    executeBatchOptimization(testConfig).then(() => {
        console.log('[Test] Batch optimization completed successfully');
        console.log('[Test] Results count:', batchOptimizationResults.length);
        
        if (batchOptimizationResults.length > 0) {
            const firstResult = batchOptimizationResults[0];
            console.log('[Test] First result:', firstResult);
            
            if (firstResult.riskManagement) {
                console.log('[Test] ✓ Risk management parameters found:', firstResult.riskManagement);
            } else {
                console.log('[Test] ✗ Risk management parameters missing');
            }
        }
        
        // 執行調試
        debugBatchResults();
    }).catch(error => {
        console.error('[Test] Batch optimization failed:', error);
    });
}

// 恢復批量優化UI狀態
function restoreBatchOptimizationUI() {
    const startBtn = document.getElementById('start-batch-optimization');
    const stopBtn = document.getElementById('stop-batch-optimization');
    
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50');
    }
    
    if (stopBtn) {
        stopBtn.classList.add('hidden');
    }
    
    window.batchOptimizationRunning = false;

    // 隱藏並重置 worker 狀態面板
    try {
        const panel = document.getElementById('batch-worker-status-panel');
        if (panel) panel.classList.add('hidden');
    } catch(e) {}
    resetBatchWorkerStatus();
}

// 停止批量優化
function stopBatchOptimization() {
    console.log('[Batch Optimization] Stopping batch optimization...');

    if (batchDebugSession) {
        recordBatchDebug('stop-requested', {
            resultCount: batchOptimizationResults.length
        }, { phase: 'finalize', level: 'warn', consoleLevel: 'warn' });
    }

    // 設置停止標誌
    isBatchOptimizationStopped = true;

    // 終止 worker
    if (batchOptimizationWorker) {
        batchOptimizationWorker.terminate();
        batchOptimizationWorker = null;
    }
    
    // 清空進度條並重置進度
    resetBatchProgress();
    
    // 恢復 UI
    restoreBatchOptimizationUI();

    // 隱藏並重置 worker 狀態面板（保險）
    try { resetBatchWorkerStatus(); } catch(e) {}
    
    // 更新進度顯示為已停止
    const progressDiv = document.getElementById('batch-optimization-progress');
    if (progressDiv) {
        const statusDiv = progressDiv.querySelector('.text-sm.text-blue-600');
        if (statusDiv) {
            statusDiv.textContent = '批量優化已停止';
            statusDiv.className = 'text-sm text-red-600 font-medium';
        }
    }

    console.log('[Batch Optimization] Stopped successfully');

    finalizeBatchDebugSession({
        status: 'stopped',
        resultCount: batchOptimizationResults.length
    });
}

// 將測試函數添加到導出對象
window.batchOptimization.testRiskManagement = testRiskManagementOptimization;
window.batchOptimization.testMultiParameterStrategy = testMultiParameterStrategyOptimization;
window.batchOptimization.testFullRiskManagement = testFullRiskManagementOptimization;
window.batchOptimization.debugResults = debugBatchResults;
window.batchOptimization.testParameterRanges = testParameterRanges;
window.batchOptimization.checkAllParameters = checkAllStrategyParameters;

// 交叉優化進度管理
let crossOptimizationProgress = {
    current: 0,
    total: 0,
    phase: 'idle',
    startTime: null
};

// 顯示交叉優化進度
function showCrossOptimizationProgress(phase = 'entry') {
    try {
        const progressDiv = document.getElementById('cross-optimization-progress');
        const progressIcon = document.getElementById('cross-progress-icon');
        const progressDetail = document.getElementById('cross-progress-detail');
        const progressStatus = document.getElementById('cross-progress-status');
        
        if (progressDiv) progressDiv.classList.remove('hidden');
        if (progressIcon) progressIcon.classList.add('animate-pulse');
        if (progressDetail) progressDetail.textContent = '正在初始化交叉優化...';
        if (progressStatus) {
            if (phase === 'entry') {
                progressStatus.textContent = '📈 第二階段：進場策略優化';
            } else if (phase === 'exit') {
                progressStatus.textContent = '📉 第三階段：出場策略優化';
            } else if (phase === 'refine') {
                progressStatus.textContent = '🔬 第四階段：局部微調（SPSA／CEM）';
            } else {
                progressStatus.textContent = '交叉優化';
            }
        }
        
        // 重置進度
        crossOptimizationProgress = { current: 0, total: 0, phase: phase, startTime: Date.now() };
        updateCrossOptimizationProgress();
    } catch (error) {
        console.error('[Cross Optimization] Error showing progress:', error);
    }
}

// 隱藏交叉優化進度
function hideCrossOptimizationProgress() {
    try {
        const progressDiv = document.getElementById('cross-optimization-progress');
        const progressIcon = document.getElementById('cross-progress-icon');
        
        if (progressDiv) progressDiv.classList.add('hidden');
        if (progressIcon) progressIcon.classList.remove('animate-pulse');
        
        console.log('[Cross Optimization] Progress hidden');
    } catch (error) {
        console.error('[Cross Optimization] Error hiding progress:', error);
    }
}

// 更新交叉優化進度
function updateCrossOptimizationProgress(currentTask = null) {
    try {
        const progressText = document.getElementById('cross-progress-text');
        const progressBar = document.getElementById('cross-progress-bar');
        const progressDetail = document.getElementById('cross-progress-detail');
        const timeEstimate = document.getElementById('cross-time-estimate');
        
        if (!progressText || !progressBar || !progressDetail) return;
        
        // 計算進度百分比
        const percentage = crossOptimizationProgress.total > 0 ? 
            Math.floor((crossOptimizationProgress.current / crossOptimizationProgress.total) * 100) : 0;
        
        progressText.textContent = `${percentage}%`;
        progressBar.style.width = `${percentage}%`;
        
        // 更新詳細信息
        if (currentTask) {
            const entryName = strategyDescriptions[currentTask.entryStrategy]?.name || currentTask.entryStrategy;
            const exitName = strategyDescriptions[currentTask.exitStrategy]?.name || currentTask.exitStrategy;
            const rankInfo = currentTask.rank ? `第${currentTask.rank}名 ` : '';
            const rangeInfo = currentTask.rangeLabel ? `（${currentTask.rangeLabel}）` : '';
            progressDetail.textContent = `🔄 正在優化: ${rankInfo}${entryName} + ${exitName}${rangeInfo} (${crossOptimizationProgress.current}/${crossOptimizationProgress.total})`;
        } else {
            progressDetail.textContent = `處理中... (${crossOptimizationProgress.current}/${crossOptimizationProgress.total})`;
        }
        
        // 時間估算
        if (timeEstimate && crossOptimizationProgress.startTime && crossOptimizationProgress.current > 0) {
            const elapsed = Date.now() - crossOptimizationProgress.startTime;
            const avgTime = elapsed / crossOptimizationProgress.current;
            const remaining = crossOptimizationProgress.total - crossOptimizationProgress.current;
            const estimatedMinutes = Math.ceil((avgTime * remaining) / 60000);
            
            if (estimatedMinutes > 0) {
                timeEstimate.textContent = `預估剩餘: ${estimatedMinutes} 分鐘`;
            } else {
                timeEstimate.textContent = '即將完成...';
            }
        }
        
    } catch (error) {
        console.error('[Cross Optimization] Error updating progress:', error);
    }
}

// 添加交叉優化結果到總結果中，並進行去重處理
function addCrossOptimizationResults(newResults) {
    newResults.forEach(newResult => {
        // 查找是否有相同的買入策略、賣出策略和年化報酬率的結果
        const existingIndex = batchOptimizationResults.findIndex(existing => 
            existing.buyStrategy === newResult.buyStrategy &&
            existing.sellStrategy === newResult.sellStrategy &&
            Math.abs(existing.annualizedReturn - newResult.annualizedReturn) < 0.0001 // 允許微小差異
        );
        
        if (existingIndex !== -1) {
            // 找到重複結果，合併優化類型標籤
            const existing = batchOptimizationResults[existingIndex];
            
            // 合併優化類型標籤
            const existingTypes = existing.optimizationTypes || [existing.optimizationType || '基礎'];
            const newType = newResult.optimizationType || '基礎';
            
            if (!existingTypes.includes(newType)) {
                existingTypes.push(newType);
            }
            
            // 更新現有結果
            existing.optimizationTypes = existingTypes;
            existing.isDuplicate = true;
            
            console.log(`[Cross Optimization] 合併重複結果: ${newResult.buyStrategy} + ${newResult.sellStrategy}, 優化類型: ${existingTypes.join(', ')}`);
        } else {
            // 沒有重複，直接添加新結果
            if (newResult.optimizationType) {
                newResult.optimizationTypes = [newResult.optimizationType];
            }
            batchOptimizationResults.push(newResult);
            console.log(`[Cross Optimization] 添加新結果: ${newResult.buyStrategy} + ${newResult.sellStrategy}, 類型: ${newResult.optimizationType}`);
        }
    });
}

// 快速優化單一策略參數（減少步數，用於交叉優化）
async function optimizeSingleStrategyParametersFast(strategy, strategyType, strategyInfo, baseParams) {
    try {
        if (!strategyInfo.optimizeTargets || strategyInfo.optimizeTargets.length === 0) {
            return getDefaultStrategyParams(strategy);
        }
        
        const optimizeTarget = strategyInfo.optimizeTargets[0]; // 優化第一個參數
        const range = optimizeTarget.range;
        
        // 獲取優化目標指標
        const config = getBatchOptimizationConfig();
        const targetMetric = config.targetMetric || 'annualizedReturn';
        
        let bestParams = getDefaultStrategyParams(strategy);
        let bestMetric = targetMetric === 'maxDrawdown' ? Infinity : -Infinity;
        
        // 根據迭代次數決定優化步驟（來自UI設定）
        const iterationLimit = parseInt(document.getElementById('batch-optimize-iteration-limit')?.value) || 6;
        const steps = Math.min(iterationLimit, Math.ceil((range.to - range.from) / range.step));
        const stepSize = (range.to - range.from) / steps;
        
        for (let i = 0; i <= steps; i++) {
            const testValue = range.from + i * stepSize;
            const testParams = { ...bestParams };
            testParams[optimizeTarget.name] = testValue;
            
            // 設定測試參數
            const testBacktestParams = { ...baseParams };
            if (strategyType === 'entry') {
                testBacktestParams.entryParams = testParams;
            } else {
                testBacktestParams.exitParams = testParams;
            }
            
            // 執行回測（使用緩存數據）
            const result = await performSingleBacktestFast(testBacktestParams);
            
            if (result) {
                const metric = getMetricFromResult(result, targetMetric);
                if (!isNaN(metric)) {
                    let isNewBest = false;
                    if (targetMetric === 'maxDrawdown') {
                        // 對於最大回撤，絕對值越小越好
                        isNewBest = Math.abs(metric) < Math.abs(bestMetric);
                    } else {
                        // 對於其他指標，值越大越好
                        isNewBest = metric > bestMetric;
                    }
                    
                    if (isNewBest) {
                        bestMetric = metric;
                        bestParams = { ...testParams };
                    }
                }
            }
        }
        
        return bestParams;
        
    } catch (error) {
        console.error('[Cross Optimization] Error optimizing single strategy:', error);
        return getDefaultStrategyParams(strategy);
    }
}

// 快速執行單次回測（使用緩存數據，用於交叉優化）
function performSingleBacktestFast(params) {
    return new Promise((resolve) => {
        try {
            // 創建 Worker 進行回測
            const worker = new Worker(workerUrl);
            
            const timeoutId = setTimeout(() => {
                worker.terminate();
                resolve(null);
            }, 15000); // 減少超時時間到15秒
            
            worker.onmessage = function(e) {
                // 處理進度消息，但不終止 Worker，繼續等待最終結果
                if (e.data.type === 'progress') {
                    return; // 不要 resolve，繼續等待最終結果
                }
                
                // 處理最終結果
                clearTimeout(timeoutId);
                worker.terminate();
                
                if (e.data.type === 'result') {
                    resolve(e.data.data);
                } else if (e.data.type === 'backtest_result') {
                    resolve(e.data.result);
                } else if (e.data.type === 'error') {
                    console.error('[Cross Optimization] Worker error:', e.data.message);
                    resolve(null);
                } else {
                    resolve(null);
                }
            };
            
            worker.onerror = function(error) {
                clearTimeout(timeoutId);
                worker.terminate();
                console.error('[Cross Optimization] Worker error:', error);
                resolve(null);
            };
            
            // 發送回測請求 - 使用緩存數據提高速度
            const preparedParams = enrichParamsWithLookback(params);
            worker.postMessage({
                type: 'runBacktest',
                params: preparedParams,
                useCachedData: true,
                cachedData: cachedStockData
            });
            
        } catch (error) {
            console.error('[Cross Optimization] Error in performSingleBacktestFast:', error);
            resolve(null);
        }
    });
}
