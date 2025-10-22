// --- 主 JavaScript 邏輯 (Part 1 of X) - v3.5.3 ---
// Patch Tag: LB-ADJ-SPLIT-20250518A
// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-US-YAHOO-20250613A
// Patch Tag: LB-TW-DIRECTORY-20250620A
// Patch Tag: LB-US-BACKTEST-20250621A
// Patch Tag: LB-DEVELOPER-HERO-20250711A
// Patch Tag: LB-TODAY-SUGGESTION-20250904A
// Patch Tag: LB-TODAY-SUGGESTION-DIAG-20250907A
// Patch Tag: LB-PROGRESS-PIPELINE-20251116A
// Patch Tag: LB-PROGRESS-PIPELINE-20251116B
// Patch Tag: LB-PROGRESS-MASCOT-20260310A
// Patch Tag: LB-PROGRESS-MASCOT-20260703A
// Patch Tag: LB-PROGRESS-MASCOT-20260705A
// Patch Tag: LB-INDEX-YAHOO-20250726A

// 全局變量
let stockChart = null;
let backtestWorker = null;
let optimizationWorker = null;
let workerUrl = null; // Loader 會賦值
let cachedStockData = null;
const cachedDataStore = new Map(); // Map<market|stockNo|priceMode, CacheEntry>
const progressAnimator = createProgressAnimator();
const LOADING_MASCOT_VERSION = 'LB-PROGRESS-MASCOT-20260709A';
const LOADING_MASCOT_ROTATION_INTERVAL = 4000;
const loadingMascotState = {
    lastSource: null,
    rotation: {
        fingerprint: '',
        queue: [],
        timerId: null,
        lastTotalSources: 0,
    },
    visibility: {
        hidden: false,
    },
};

window.cachedDataStore = cachedDataStore;
let lastFetchSettings = null;
let currentOptimizationResults = [];
let sortState = { key: 'annualizedReturn', direction: 'desc' };
let lastOverallResult = null; // 儲存最近一次的完整回測結果
let lastSubPeriodResults = null; // 儲存子週期結果
let preOptimizationResult = null; // 儲存優化前的回測結果，用於對比顯示
let batchDebugLogUnsubscribe = null;
// SAVED_STRATEGIES_KEY, strategyDescriptions, longEntryToCoverMap, longExitToShortMap, globalOptimizeTargets 移至 config.js

// --- Utility Functions ---
function initDates() { const eD=new Date(); const sD=new Date(eD); sD.setFullYear(eD.getFullYear()-5); document.getElementById('endDate').value=formatDate(eD); document.getElementById('startDate').value=formatDate(sD); document.getElementById('recentYears').value=5; }
function applyRecentYears() { const nYI=document.getElementById('recentYears'); const eDI=document.getElementById('endDate'); const sDI=document.getElementById('startDate'); const nY=parseInt(nYI.value); const eDS=eDI.value; if(isNaN(nY)||nY<1){showError("請輸入有效年數");return;} if(!eDS){showError("請先選結束日期");return;} const eD=new Date(eDS); if(isNaN(eD)){showError("結束日期格式無效");return;} const sD=new Date(eD); sD.setFullYear(eD.getFullYear()-nY); const eY=1992; if(sD.getFullYear()<eY){sD.setFullYear(eY,0,1); const aY=eD.getFullYear()-eY; nYI.value=aY; showInfo(`資料最早至 ${eY} 年，已調整`);} else {showInfo(`已設定開始日期 ${formatDate(sD)}`);} sDI.value=formatDate(sD); }
function formatDate(d) { if(!(d instanceof Date)||isNaN(d))return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function showError(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-times-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md'; }
function showSuccess(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-check-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-green-100 border-l-4 border-green-500 text-green-700 rounded-md'; }
function showInfo(m) { const el=document.getElementById("result"); el.innerHTML=`<i class="fas fa-info-circle mr-2"></i> ${m}`; el.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md'; }

// Patch Tag: LB-ENTRY-STAGING-20250623A / LB-STAGED-ENTRY-EXIT-20250626A
const stagedEntryControls = (() => {
    const state = {
        container: null,
        list: null,
        addButton: null,
        manual: false,
    };

    const getPositionSizeValue = () => {
        const positionInput = document.getElementById('positionSize');
        const value = parseFloat(positionInput?.value);
        return Number.isFinite(value) && value > 0 ? value : 100;
    };

    const setManual = (flag) => {
        state.manual = Boolean(flag);
    };

    const createStageRow = (initialValue) => {
        const fallback = getPositionSizeValue();
        const value = Number.isFinite(initialValue) && initialValue > 0 ? initialValue : fallback;
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3';
        row.dataset.entryStageRow = 'true';

        const label = document.createElement('span');
        label.className = 'text-xs font-medium min-w-[52px]';
        label.style.color = 'var(--muted-foreground)';
        label.dataset.stageLabel = 'true';
        label.textContent = '第 1 段';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '100';
        input.step = '0.1';
        input.value = Number(value.toFixed ? value.toFixed(2) : value).toString();
        input.className = 'w-full max-w-[120px] px-3 py-1.5 border border-border rounded-md text-sm focus:ring-accent focus:border-accent bg-input text-foreground';
        input.setAttribute('data-entry-stage-percent', 'true');
        input.addEventListener('input', () => setManual(true));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '移除';
        removeBtn.className = 'text-xs px-2 py-1 rounded border transition-colors';
        removeBtn.style.borderColor = 'var(--border)';
        removeBtn.style.color = 'var(--destructive)';
        removeBtn.addEventListener('click', () => {
            if (!state.list) return;
            if (state.list.children.length <= 1) {
                input.value = getPositionSizeValue().toString();
                setManual(false);
                return;
            }
            setManual(true);
            row.remove();
            renumberStages();
        });

        row.append(label, input, removeBtn);
        return row;
    };

    const renumberStages = () => {
        if (!state.list) return;
        const rows = Array.from(state.list.querySelectorAll('[data-entry-stage-row="true"]'));
        rows.forEach((row, index) => {
            const label = row.querySelector('[data-stage-label="true"]');
            if (label) label.textContent = `第 ${index + 1} 段`;
            const removeBtn = row.querySelector('button');
            if (removeBtn) {
                removeBtn.disabled = rows.length <= 1;
                removeBtn.classList.toggle('opacity-50', removeBtn.disabled);
                removeBtn.classList.toggle('cursor-not-allowed', removeBtn.disabled);
            }
        });
    };

    const addStage = (value) => {
        if (!state.list) return;
        const row = createStageRow(value);
        state.list.appendChild(row);
        renumberStages();
    };

    const syncFromPositionSize = () => {
        if (!state.list || state.manual) return;
        const fallback = getPositionSizeValue();
        const input = state.list.querySelector('input[data-entry-stage-percent]');
        if (input) input.value = fallback.toString();
        else addStage(fallback);
        renumberStages();
    };

    const getValues = () => {
        if (!state.list) return [];
        return Array.from(
            state.list.querySelectorAll('input[data-entry-stage-percent]')
        )
            .map((input) => parseFloat(input.value))
            .filter((value) => Number.isFinite(value) && value > 0);
    };

    const setValues = (values, options = {}) => {
        if (!state.list) return;
        const fallback = getPositionSizeValue();
        const validValues = Array.isArray(values)
            ? values.filter((val) => Number.isFinite(val) && val > 0)
            : [];
        state.list.innerHTML = '';
        if (validValues.length === 0) {
            addStage(fallback);
            setManual(false);
            return;
        }
        validValues.forEach((val) => addStage(val));
        const manualFlag = options.manual ?? (validValues.length > 1 || Math.abs(validValues[0] - fallback) > 1e-6);
        setManual(manualFlag);
        renumberStages();
    };

    const init = () => {
        state.container = document.getElementById('stagedEntryContainer');
        state.list = document.getElementById('entryStageList');
        state.addButton = document.getElementById('addEntryStageButton');
        if (!state.container || !state.list) return;

        const positionInput = document.getElementById('positionSize');
        if (positionInput) {
            positionInput.addEventListener('input', () => syncFromPositionSize());
        }

        if (state.addButton) {
            state.addButton.addEventListener('click', () => {
                setManual(true);
                addStage(getPositionSizeValue());
            });
        }

        setValues([getPositionSizeValue()], { manual: false });
    };

    return {
        init,
        getValues,
        setValues,
        reset: (defaultPercent) => setValues([defaultPercent], { manual: false }),
        syncFromPositionSize,
        markManual: () => setManual(true),
        clearManual: () => setManual(false),
    };
})();

window.lazybacktestStagedEntry = {
    init: stagedEntryControls.init,
    getValues: () => stagedEntryControls.getValues(),
    setValues: (values, options) => {
        if (options && typeof options === 'object') {
            stagedEntryControls.setValues(values, options);
        } else {
            stagedEntryControls.setValues(values);
        }
    },
    resetToDefault: (percent) => stagedEntryControls.reset(percent),
    syncFromPositionSize: () => stagedEntryControls.syncFromPositionSize(),
    markManual: () => stagedEntryControls.markManual(),
    clearManual: () => stagedEntryControls.clearManual(),
};

const stagedExitControls = (() => {
    const state = {
        container: null,
        list: null,
        addButton: null,
        manual: false,
    };

    const getDefaultPercent = () => 100;

    const setManual = (flag) => {
        state.manual = Boolean(flag);
    };

    const createStageRow = (initialValue) => {
        const fallback = getDefaultPercent();
        const value = Number.isFinite(initialValue) && initialValue > 0 ? initialValue : fallback;
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3';
        row.dataset.exitStageRow = 'true';

        const label = document.createElement('span');
        label.className = 'text-xs font-medium min-w-[52px]';
        label.style.color = 'var(--muted-foreground)';
        label.dataset.stageLabel = 'true';
        label.textContent = '第 1 段';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '100';
        input.step = '0.1';
        input.value = Number(value.toFixed ? value.toFixed(2) : value).toString();
        input.className = 'w-full max-w-[120px] px-3 py-1.5 border border-border rounded-md text-sm focus:ring-accent focus:border-accent bg-input text-foreground';
        input.setAttribute('data-exit-stage-percent', 'true');
        input.addEventListener('input', () => setManual(true));

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '移除';
        removeBtn.className = 'text-xs px-2 py-1 rounded border transition-colors';
        removeBtn.style.borderColor = 'var(--border)';
        removeBtn.style.color = 'var(--destructive)';
        removeBtn.addEventListener('click', () => {
            if (!state.list) return;
            if (state.list.children.length <= 1) {
                input.value = getDefaultPercent().toString();
                setManual(false);
                return;
            }
            setManual(true);
            row.remove();
            renumberStages();
        });

        row.append(label, input, removeBtn);
        return row;
    };

    const renumberStages = () => {
        if (!state.list) return;
        const rows = Array.from(state.list.querySelectorAll('[data-exit-stage-row="true"]'));
        rows.forEach((row, index) => {
            const label = row.querySelector('[data-stage-label="true"]');
            if (label) label.textContent = `第 ${index + 1} 段`;
            const removeBtn = row.querySelector('button');
            if (removeBtn) {
                removeBtn.disabled = rows.length <= 1;
                removeBtn.classList.toggle('opacity-50', removeBtn.disabled);
                removeBtn.classList.toggle('cursor-not-allowed', removeBtn.disabled);
            }
        });
    };

    const addStage = (value) => {
        if (!state.list) return;
        const row = createStageRow(value);
        state.list.appendChild(row);
        renumberStages();
    };

    const getValues = () => {
        if (!state.list) return [];
        return Array.from(
            state.list.querySelectorAll('input[data-exit-stage-percent]')
        )
            .map((input) => parseFloat(input.value))
            .filter((value) => Number.isFinite(value) && value > 0);
    };

    const setValues = (values, options = {}) => {
        if (!state.list) return;
        const fallback = getDefaultPercent();
        const validValues = Array.isArray(values)
            ? values.filter((val) => Number.isFinite(val) && val > 0)
            : [];
        state.list.innerHTML = '';
        if (validValues.length === 0) {
            addStage(fallback);
            setManual(false);
            return;
        }
        validValues.forEach((val) => addStage(val));
        const manualFlag = options.manual ?? (validValues.length > 1 || Math.abs(validValues[0] - fallback) > 1e-6);
        setManual(manualFlag);
        renumberStages();
    };

    const init = () => {
        state.container = document.getElementById('stagedExitContainer');
        state.list = document.getElementById('exitStageList');
        state.addButton = document.getElementById('addExitStageButton');
        if (!state.container || !state.list) return;

        if (state.addButton) {
            state.addButton.addEventListener('click', () => {
                setManual(true);
                addStage(getDefaultPercent());
            });
        }

        setValues([getDefaultPercent()], { manual: false });
    };

    return {
        init,
        getValues,
        setValues,
        reset: (defaultPercent) => setValues([defaultPercent], { manual: false }),
        markManual: () => setManual(true),
        clearManual: () => setManual(false),
    };
})();

window.lazybacktestStagedExit = {
    init: stagedExitControls.init,
    getValues: () => stagedExitControls.getValues(),
    setValues: (values, options) => {
        if (options && typeof options === 'object') {
            stagedExitControls.setValues(values, options);
        } else {
            stagedExitControls.setValues(values);
        }
    },
    resetToDefault: (percent) => stagedExitControls.reset(percent),
    markManual: () => stagedExitControls.markManual(),
    clearManual: () => stagedExitControls.clearManual(),
};

const multiStagePanelController = (() => {
    const state = {
        container: null,
        toggle: null,
        icon: null,
        content: null,
        expanded: false,
    };

    const ensureElements = () => {
        if (state.container && state.toggle && state.icon && state.content) {
            return true;
        }
        state.container = document.getElementById('multiStagePanel');
        state.toggle = document.getElementById('multiStageToggle');
        state.icon = document.getElementById('multiStageToggleIcon');
        state.content = document.getElementById('multiStageContent');
        return Boolean(state.container && state.toggle && state.icon && state.content);
    };

    const applyState = () => {
        if (!ensureElements()) return;
        const expanded = Boolean(state.expanded);
        state.toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (expanded) {
            state.content.classList.remove('hidden');
            state.icon.textContent = '−';
        } else {
            state.content.classList.add('hidden');
            state.icon.textContent = '+';
        }
    };

    const setExpanded = (flag) => {
        state.expanded = Boolean(flag);
        applyState();
    };

    const toggle = () => {
        setExpanded(!state.expanded);
    };

    const bindEvents = () => {
        if (!ensureElements()) return;
        state.toggle.addEventListener('click', (event) => {
            event.preventDefault();
            toggle();
        });
    };

    const init = () => {
        if (!ensureElements()) return;
        state.expanded = state.toggle.getAttribute('aria-expanded') === 'true';
        bindEvents();
        applyState();
    };

    return {
        init,
        open: () => setExpanded(true),
        close: () => setExpanded(false),
        toggle,
        isOpen: () => Boolean(state.expanded),
        ensure: ensureElements,
    };
})();

window.lazybacktestMultiStagePanel = {
    init: () => multiStagePanelController.init(),
    open: () => multiStagePanelController.open(),
    close: () => multiStagePanelController.close(),
    toggle: () => multiStagePanelController.toggle(),
    isOpen: () => multiStagePanelController.isOpen(),
};

// --- Data Source Tester (LB-DATASOURCE-20241005A) ---
const dataSourceTesterState = {
    open: false,
    busy: false,
    tableOpen: false,
    lastRows: [],
    lastSourceLabel: '',
};

const DATA_SOURCE_TESTER_TABLE_LIMIT = 120;

// Patch Tag: LB-DATASOURCE-20250328A
// Patch Tag: LB-DATASOURCE-20250402A
// Patch Tag: LB-DATASOURCE-20250410A
const testerAdjustmentReasonLabels = {
    missingPriceRow: '缺少對應價格',
    invalidBaseClose: '無效基準價',
    ratioOutOfRange: '調整比例異常',
};

function testerEscapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTesterSkipReasons(skipReasons) {
    if (!skipReasons || typeof skipReasons !== 'object') return '';
    const entries = Object.entries(skipReasons);
    if (entries.length === 0) return '';
    return entries
        .map(([reason, count]) => {
            const label = testerAdjustmentReasonLabels[reason] || reason;
            return `${testerEscapeHtml(label)}×${testerEscapeHtml(count)}`;
        })
        .join('、');
}

function formatTesterNumber(value, digits = 4) {
    if (!Number.isFinite(value)) return '—';
    const formatted = Number(value).toFixed(digits);
    return testerEscapeHtml(formatted.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1'));
}

function formatTesterFieldHints(fields) {
    if (!Array.isArray(fields) || fields.length === 0) return '';
    return fields
        .map((field) => {
            const key = testerEscapeHtml(field.key ?? '');
            const raw = testerEscapeHtml(field.raw ?? '');
            const numeric = Number.isFinite(field.numeric) ? formatTesterNumber(field.numeric, 4) : '';
            return numeric ? `${key}=${raw}（解析後 ${numeric}）` : `${key}=${raw}`;
        })
        .join('、');
}

function normalizeTesterNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.replace(/,/g, '').trim();
        if (!trimmed || trimmed === '--' || trimmed === '-') return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'bigint') {
        return Number(value);
    }
    return null;
}

function normalizeTesterDate(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }
    const raw = String(value).trim();
    if (!raw) return '';
    if (/^\d{3}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
        return rocToIsoDate(raw) || '';
    }
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(raw)) {
        const normalized = raw.replace(/\//g, '-');
        const [y, m, d] = normalized.split('-');
        return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{8}$/.test(raw)) {
        return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
        if (raw.length === 8) {
            return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
        if (numeric > 1e11) {
            const fromMs = new Date(numeric);
            if (!Number.isNaN(fromMs.getTime())) return fromMs.toISOString().split('T')[0];
        }
        if (numeric > 1e9) {
            const fromSeconds = new Date(numeric * 1000);
            if (!Number.isNaN(fromSeconds.getTime())) return fromSeconds.toISOString().split('T')[0];
        }
    }
    return raw;
}

function resolveTesterValue(row, keys) {
    if (!row || typeof row !== 'object' || !Array.isArray(keys)) return null;
    for (const key of keys) {
        if (key in row) {
            const numeric = normalizeTesterNumber(row[key]);
            if (numeric !== null) return numeric;
        }
    }
    return null;
}

function normalizeTesterRows(payload, parseMode) {
    const rows = [];
    const pushRow = (rawDate, rawOpen, rawHigh, rawLow, rawClose, rawVolume) => {
        const date = normalizeTesterDate(rawDate);
        const open = normalizeTesterNumber(rawOpen);
        const high = normalizeTesterNumber(rawHigh);
        const low = normalizeTesterNumber(rawLow);
        const close = normalizeTesterNumber(rawClose);
        const volume = normalizeTesterNumber(rawVolume);
        if (!date) return;
        const hasValue = [open, high, low, close, volume].some((value) => value !== null);
        if (!hasValue) return;
        rows.push({ date, open, high, low, close, volume });
    };

    if (parseMode === 'adjustedComposer') {
        const dataRows = Array.isArray(payload?.data) ? payload.data : [];
        dataRows.forEach((row) => {
            if (!row || typeof row !== 'object') return;
            const date = row.date || row.trade_date || row.tradeDate || row.tradingDate;
            const open = resolveTesterValue(row, ['open', 'Open', 'openPrice', 'openingPrice', 'opening_price']);
            const high = resolveTesterValue(row, ['high', 'High', 'max', 'highestPrice', 'highest_price']);
            const low = resolveTesterValue(row, ['low', 'Low', 'min', 'lowestPrice', 'lowest_price']);
            const close = resolveTesterValue(row, ['close', 'Close', 'adjClose', 'closingPrice', 'closing_price']);
            const volume = resolveTesterValue(row, ['volume', 'Volume', 'Trading_Volume', 'tradingVolume', 'rawVolume']);
            pushRow(date, open, high, low, close, volume);
        });
    }

    if (rows.length === 0 && Array.isArray(payload?.aaData)) {
        payload.aaData.forEach((entry) => {
            if (!Array.isArray(entry) || entry.length < 9) return;
            const [rawDate, , , open, high, low, close, , volume] = entry;
            const date = rocToIsoDate(rawDate) || normalizeTesterDate(rawDate);
            pushRow(date, open, high, low, close, volume);
        });
    }

    if (rows.length === 0 && Array.isArray(payload?.data)) {
        payload.data.forEach((row) => {
            if (!row || typeof row !== 'object') return;
            const date = row.date || row.Date || row.trade_date || row.trading_date;
            const open = resolveTesterValue(row, ['open', 'Open', 'open_price', 'first_price', 'opening_price']);
            const high = resolveTesterValue(row, ['high', 'High', 'max', 'highest_price']);
            const low = resolveTesterValue(row, ['low', 'Low', 'min', 'lowest_price']);
            const close = resolveTesterValue(row, ['close', 'Close', 'price', 'closing_price', 'adj_close']);
            const volume = resolveTesterValue(row, [
                'volume',
                'Volume',
                'Trading_Volume',
                'TradingVolume',
                'trade_volume',
                'tradeVolume',
                'total_volume',
                'totalVolume',
                'vol',
                'volume_shares',
                'volumeShares',
            ]);
            pushRow(date, open, high, low, close, volume);
        });
    }

    if (rows.length === 0 && payload?.chart?.result?.[0]) {
        const result = payload.chart.result[0];
        const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
        const quote = result?.indicators?.quote?.[0] || {};
        for (let i = 0; i < timestamps.length; i += 1) {
            const ts = timestamps[i];
            if (!Number.isFinite(ts)) continue;
            const date = normalizeTesterDate(ts * 1000);
            const open = Array.isArray(quote.open) ? quote.open[i] : null;
            const high = Array.isArray(quote.high) ? quote.high[i] : null;
            const low = Array.isArray(quote.low) ? quote.low[i] : null;
            const close = Array.isArray(quote.close) ? quote.close[i] : null;
            const volume = Array.isArray(quote.volume) ? quote.volume[i] : null;
            pushRow(date, open, high, low, close, volume);
        }
    }

    return rows;
}

function formatTesterTablePrice(value) {
    if (!Number.isFinite(value)) return '—';
    const fixed = Number(value).toFixed(4).replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
    return fixed;
}

function formatTesterTableVolume(value) {
    if (!Number.isFinite(value)) return '—';
    const rounded = Math.round(Number(value));
    return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderTesterTableRows() {
    const tbody = document.getElementById('dataSourceTesterTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = Array.isArray(dataSourceTesterState.lastRows) ? dataSourceTesterState.lastRows : [];
    const limit = Math.min(rows.length, DATA_SOURCE_TESTER_TABLE_LIMIT);
    for (let i = 0; i < limit; i += 1) {
        const row = rows[i];
        const tr = document.createElement('tr');
        if (i % 2 === 1) {
            tr.className = 'bg-slate-50/60';
        }
        const dateTd = document.createElement('td');
        dateTd.className = 'px-3 py-1.5 border-b text-left whitespace-nowrap';
        dateTd.style.borderColor = 'var(--border)';
        dateTd.textContent = row?.date || '—';
        tr.appendChild(dateTd);

        const numericValues = [
            formatTesterTablePrice(row?.open),
            formatTesterTablePrice(row?.high),
            formatTesterTablePrice(row?.low),
            formatTesterTablePrice(row?.close),
            formatTesterTableVolume(row?.volume),
        ];
        numericValues.forEach((text) => {
            const td = document.createElement('td');
            td.className = 'px-3 py-1.5 border-b text-right font-mono';
            td.style.borderColor = 'var(--border)';
            td.textContent = text;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
}

function updateTesterTableAvailability() {
    const controls = document.getElementById('dataSourceTesterTableControls');
    const wrapper = document.getElementById('dataSourceTesterTableWrapper');
    const toggleBtn = document.getElementById('openDataSourceTesterTable');
    const countEl = document.getElementById('dataSourceTesterTableCount');
    const sourceEl = document.getElementById('dataSourceTesterTableSource');
    const noteEl = document.getElementById('dataSourceTesterTableNote');
    if (!controls || !wrapper || !toggleBtn || !noteEl) return;
    const rows = Array.isArray(dataSourceTesterState.lastRows) ? dataSourceTesterState.lastRows : [];
    const hasRows = rows.length > 0;
    controls.classList.toggle('hidden', !hasRows);
    wrapper.classList.toggle('hidden', !hasRows || !dataSourceTesterState.tableOpen);
    toggleBtn.disabled = dataSourceTesterState.busy || !hasRows;
    toggleBtn.textContent = dataSourceTesterState.tableOpen ? '隱藏資料表格' : '查看資料表格';
    toggleBtn.setAttribute('aria-expanded', dataSourceTesterState.tableOpen ? 'true' : 'false');

    if (hasRows) {
        const total = rows.length;
        const limit = Math.min(rows.length, DATA_SOURCE_TESTER_TABLE_LIMIT);
        if (countEl) {
            countEl.textContent = `共 ${total} 筆`;
            countEl.classList.remove('hidden');
        }
        if (sourceEl) {
            if (dataSourceTesterState.lastSourceLabel) {
                sourceEl.textContent = `來源：${dataSourceTesterState.lastSourceLabel}`;
                sourceEl.classList.remove('hidden');
            } else {
                sourceEl.textContent = '';
                sourceEl.classList.add('hidden');
            }
        }
        noteEl.textContent = total > limit
            ? `顯示前 ${limit} 筆，總計 ${total} 筆資料。`
            : `共顯示 ${total} 筆資料。`;
    } else {
        if (countEl) {
            countEl.textContent = '';
            countEl.classList.add('hidden');
        }
        if (sourceEl) {
            sourceEl.textContent = '';
            sourceEl.classList.add('hidden');
        }
        noteEl.textContent = '';
    }
}

function clearTesterTableData() {
    dataSourceTesterState.lastRows = [];
    dataSourceTesterState.lastSourceLabel = '';
    dataSourceTesterState.tableOpen = false;
    renderTesterTableRows();
    updateTesterTableAvailability();
}

function setTesterTableData(rows, sourceLabel) {
    dataSourceTesterState.lastRows = Array.isArray(rows) ? rows : [];
    dataSourceTesterState.lastSourceLabel = sourceLabel || '';
    dataSourceTesterState.tableOpen = false;
    renderTesterTableRows();
    updateTesterTableAvailability();
}

function toggleTesterTable() {
    if (dataSourceTesterState.busy) return;
    if (!Array.isArray(dataSourceTesterState.lastRows) || dataSourceTesterState.lastRows.length === 0) return;
    dataSourceTesterState.tableOpen = !dataSourceTesterState.tableOpen;
    if (dataSourceTesterState.tableOpen) {
        renderTesterTableRows();
    }
    updateTesterTableAvailability();
}

function buildTesterDebugStepsHtml(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return '';
    const items = steps
        .map((step) => {
            const statusClass = step.status === 'success'
                ? 'text-emerald-600'
                : step.status === 'warning'
                    ? 'text-amber-600'
                    : 'text-rose-600';
            const label = testerEscapeHtml(step.label || step.key || '未命名步驟');
            const details = [];
            if (step.detail) details.push(testerEscapeHtml(step.detail));
            const skipText = formatTesterSkipReasons(step.skipReasons);
            if (skipText) details.push(skipText);
            const suffix = details.length > 0 ? ` ・ ${details.join(' ・ ')}` : '';
            return `<div class="flex items-start gap-2"><span class="${statusClass}">●</span><span class="text-[11px]" style="color: var(--foreground);">${label}${suffix}</span></div>`;
        })
        .join('');
    return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">還原流程檢查</div><div class="mt-1 space-y-1">${items}</div></div>`;
}

function buildFinMindResponseLogHtml(log, options = {}) {
    if (!Array.isArray(log) || log.length === 0) return '';
    const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : 6;
    const limited = log.slice(0, limit);
    const title = testerEscapeHtml(options.title || 'FinMind 請求紀錄');
    const rows = limited
        .map((entry) => {
            const spanStart = entry?.spanStart ? testerEscapeHtml(entry.spanStart) : '—';
            const spanEnd = entry?.spanEnd ? testerEscapeHtml(entry.spanEnd) : '—';
            const status = Number.isFinite(entry?.status) ? Number(entry.status) : entry?.status;
            const statusLabel = status === null || status === undefined ? '—' : testerEscapeHtml(status);
            const statusClass = Number.isFinite(status) && Number(status) >= 400 ? 'text-rose-600' : 'text-slate-600';
            const rowCount = Number.isFinite(entry?.rowCount) ? testerEscapeHtml(entry.rowCount) : '—';
            const message = entry?.message ? testerEscapeHtml(entry.message) : '';
            const messageLine = message
                ? `<div class="text-[10px]" style="color: var(--muted-foreground);">訊息：${message}</div>`
                : '';
            return `<div class="rounded border px-3 py-2 bg-white/70" style="border-color: var(--border);"><div class="flex flex-wrap items-center gap-x-3 text-[10px]" style="color: var(--foreground);"><span>區間：${spanStart} ~ ${spanEnd}</span><span class="${statusClass}">狀態：${statusLabel}</span><span style="color: var(--muted-foreground);">筆數：${rowCount}</span></div>${messageLine}</div>`;
        })
        .join('');
    const note = log.length > limited.length
        ? `<div class="text-[10px]" style="color: var(--muted-foreground);">僅顯示前 ${limited.length} 筆記錄，總計 ${testerEscapeHtml(log.length)} 筆。</div>`
        : '';
    return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">${title}</div><div class="mt-2 space-y-2">${rows}</div>${note}</div>`;
}

function buildAdjustmentDiagnosticsHtml(adjustments) {
    if (!Array.isArray(adjustments)) return '';
    if (adjustments.length === 0) {
        return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">還原事件追蹤</div><div class="mt-1 rounded-md border border-dashed px-3 py-2 text-[11px]" style="border-color: var(--border); color: var(--muted-foreground);">尚未產生任何還原事件，請檢查配息結果或略過原因統計。</div></div>`;
    }
    const items = adjustments
        .slice(0, 3)
        .map((event) => {
            const statusClass = event.skipped ? 'text-amber-600' : 'text-emerald-600';
            const statusLabel = testerEscapeHtml(event.skipped ? '略過' : '已套用');
            const metaLines = [];
            if (event.date) {
                metaLines.push(`除權息日 ${testerEscapeHtml(event.date)}`);
            }
            if (event.appliedDate && event.appliedDate !== event.date) {
                metaLines.push(`基準價日 ${testerEscapeHtml(event.appliedDate)}`);
            }
            if (Number.isFinite(event.baseClose)) {
                metaLines.push(`基準價 ${formatTesterNumber(event.baseClose, 3)}`);
            }
            const composition = [];
            if (Number.isFinite(event.cashDividend) && event.cashDividend > 0) {
                composition.push(`現金 ${formatTesterNumber(event.cashDividend, 4)}`);
            }
            if (Number.isFinite(event.stockDividend) && event.stockDividend > 0) {
                composition.push(`股票 ${formatTesterNumber(event.stockDividend, 4)}`);
            }
            if (Number.isFinite(event.cashCapitalIncrease) && event.cashCapitalIncrease > 0) {
                composition.push(`現增 ${formatTesterNumber(event.cashCapitalIncrease, 4)}`);
            }
            if (Number.isFinite(event.stockCapitalIncrease) && event.stockCapitalIncrease > 0) {
                composition.push(`轉增 ${formatTesterNumber(event.stockCapitalIncrease, 4)}`);
            }
            if (composition.length > 0) {
                metaLines.push(`成分 ${composition.join('、')}`);
            }
            if (!event.skipped && Number.isFinite(event.ratio)) {
                metaLines.push(`調整係數 ${formatTesterNumber(event.ratio, 6)}`);
            }
            const factorBefore = Number(event.factorBefore);
            const factorAfter = Number(event.factorAfter);
            if (Number.isFinite(factorBefore) || Number.isFinite(factorAfter)) {
                const beforeText = Number.isFinite(factorBefore)
                    ? formatTesterNumber(factorBefore, 6)
                    : '—';
                const afterText = Number.isFinite(factorAfter)
                    ? formatTesterNumber(factorAfter, 6)
                    : '—';
                metaLines.push(`FinMind 係數 ${beforeText} → ${afterText}`);
            }
            if (Number.isFinite(event.factorDelta) && event.factorDelta !== 0) {
                metaLines.push(`係數差 ${formatTesterNumber(event.factorDelta, 6)}`);
            }
            if (event.factorDirection) {
                const directionLabel =
                    event.factorDirection === 'up'
                        ? '向上'
                        : event.factorDirection === 'down'
                            ? '向下'
                            : '持平';
                metaLines.push(`係數趨勢 ${directionLabel}`);
            }
            if (event.skipped) {
                const reasonLabel = testerAdjustmentReasonLabels[event.reason] || event.reason || '未知原因';
                metaLines.push(`原因 ${testerEscapeHtml(reasonLabel)}`);
            }
            const originLabel = event.source
                ? testerEscapeHtml(event.source)
                : event.derivedFrom === 'finmindAdjustedSeries'
                    ? 'FinMind 還原序列'
                    : '股利計算';
            if (originLabel) {
                metaLines.push(`來源 ${originLabel}`);
            }
            const metaHtml = metaLines.map((line) => `<div>${line}</div>`).join('');
            return `<div class="rounded-md border px-3 py-2 bg-white/70" style="border-color: var(--border);"><div class="flex items-center gap-2"><span class="${statusClass}">●</span><span class="font-medium" style="color: var(--foreground);">${statusLabel}</span></div><div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">${metaHtml}</div></div>`;
        })
        .join('');
    const remainderNote = adjustments.length > 3
        ? `<div class="text-[10px]" style="color: var(--muted-foreground);">僅顯示前 3 筆事件，總計 ${testerEscapeHtml(adjustments.length)} 筆。</div>`
        : '';
    return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">還原事件追蹤</div><div class="mt-1 space-y-1">${items}</div>${remainderNote}</div>`;
}

function buildAdjustmentDebugLogHtml(logEntries, options = {}) {
    if (!Array.isArray(logEntries) || logEntries.length === 0) return '';
    const title = testerEscapeHtml(options.title || '還原係數檢查');
    const items = logEntries
        .map((entry) => {
            const status = entry?.status;
            const statusClass = status === 'warning'
                ? 'text-amber-600'
                : status === 'success'
                    ? 'text-emerald-600'
                    : status === 'skipped'
                        ? 'text-slate-500'
                        : 'text-slate-600';
            const titleText = testerEscapeHtml(entry?.title || entry?.source || '還原事件');
            const linesHtml = Array.isArray(entry?.lines)
                ? entry.lines
                      .map((line) => `<div class="text-[10px]" style="color: var(--muted-foreground);">${testerEscapeHtml(line)}</div>`)
                      .join('')
                : '';
            return `<div class="rounded border px-3 py-2 bg-white/70" style="border-color: var(--border);">
    <div class="flex items-center gap-2 text-[11px]" style="color: var(--foreground);">
        <span class="${statusClass}">●</span>
        <span class="font-semibold">${titleText}</span>
    </div>
    ${linesHtml}
</div>`;
        })
        .join('');
    return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">${title}</div><div class="mt-2 space-y-2">${items}</div></div>`;
}

function buildDividendEventPreviewHtml(events) {
    if (!Array.isArray(events) || events.length === 0) return '';
    const blocks = events.slice(0, 3).map((event) => {
        const lines = [];
        if (event.date) {
            lines.push(`除權息日 ${testerEscapeHtml(event.date)}`);
        }
        const compositions = [];
        if (Number.isFinite(event.cashDividend) && event.cashDividend > 0) {
            compositions.push(`現金 ${formatTesterNumber(event.cashDividend, 4)}`);
        }
        if (Number.isFinite(event.stockDividend) && event.stockDividend > 0) {
            compositions.push(`股票 ${formatTesterNumber(event.stockDividend, 4)}`);
        }
        if (Number.isFinite(event.cashCapitalIncrease) && event.cashCapitalIncrease > 0) {
            compositions.push(`現增 ${formatTesterNumber(event.cashCapitalIncrease, 4)}`);
        }
        if (Number.isFinite(event.stockCapitalIncrease) && event.stockCapitalIncrease > 0) {
            compositions.push(`轉增 ${formatTesterNumber(event.stockCapitalIncrease, 4)}`);
        }
        if (compositions.length > 0) {
            lines.push(`成分 ${compositions.join('、')}`);
        }
        if (Number.isFinite(event.subscriptionPrice) && event.subscriptionPrice > 0) {
            lines.push(`申購價 ${formatTesterNumber(event.subscriptionPrice, 4)}`);
        }
        if (event.dateSources && Array.isArray(event.dateSources) && event.dateSources.length > 0) {
            const sources = event.dateSources
                .map((src) => (src.key ? testerEscapeHtml(src.key) : null))
                .filter(Boolean);
            if (sources.length > 0) {
                lines.push(`日期欄位 ${sources.join('、')}`);
            }
        } else if (event.dateSource) {
            lines.push(`日期欄位 ${testerEscapeHtml(event.dateSource)}`);
        }
        const body = lines.map((line) => `<div>${line}</div>`).join('');
        return `<div class="rounded-md border px-3 py-2 bg-white/70" style="border-color: var(--border);"><div class="text-[10px]" style="color: var(--muted-foreground);">${body}</div></div>`;
    }).join('');
    const note = events.length > 3
        ? `<div class="text-[10px]" style="color: var(--muted-foreground);">僅顯示前 3 筆彙整事件，總計 ${testerEscapeHtml(events.length)} 筆。</div>`
        : '';
    return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">FinMind 彙整事件</div><div class="mt-1 space-y-1">${blocks}</div>${note}</div>`;
}

function resolveFinMindStatusColor(status) {
    switch (status) {
        case 'success':
            return 'text-emerald-600';
        case 'noData':
        case 'parameterError':
        case 'networkError':
            return 'text-amber-600';
        case 'permissionDenied':
        case 'tokenInvalid':
        case 'missingToken':
        case 'serverError':
            return 'text-rose-600';
        default:
            return 'text-slate-600';
    }
}

function buildFinMindApiStatusHtml(finmindStatus) {
    if (!finmindStatus || typeof finmindStatus !== 'object') return '';
    const items = [];
    if (finmindStatus.tokenPresent === false) {
        items.push(
            `<div class="rounded-md border px-3 py-2 bg-white/70" style="border-color: var(--border);">
                <div class="text-[11px] font-medium text-rose-600">未設定 FINMIND_TOKEN，無法呼叫 FinMind API。</div>
                <div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">請於 Netlify 或環境變數中設定 FINMIND_TOKEN 後重新測試。</div>
            </div>`,
        );
    }
    const statusConfigs = [
        { key: 'dividendResult', title: 'FinMind 配息結果 API 狀態' },
        { key: 'splitPrice', title: 'FinMind 股票拆分 API 狀態' },
    ];
    statusConfigs.forEach((config) => {
        const statusObj = finmindStatus[config.key];
        if (!statusObj || typeof statusObj !== 'object') return;
        const tone = resolveFinMindStatusColor(statusObj.status);
        const hint = statusObj.hint
            ? `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">${testerEscapeHtml(statusObj.hint)}</div>`
            : '';
        const statusCode = Number.isFinite(statusObj.statusCode)
            ? `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">狀態碼：${testerEscapeHtml(statusObj.statusCode)}</div>`
            : '';
        const message = statusObj.message
            ? `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">訊息：${testerEscapeHtml(statusObj.message)}</div>`
            : '';
        const spanText = statusObj.spanStart || statusObj.spanEnd
            ? `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">請求區間：${testerEscapeHtml(statusObj.spanStart || '—')} ~ ${testerEscapeHtml(statusObj.spanEnd || '—')}</div>`
            : '';
        const dataset = statusObj.dataset
            ? `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">資料集：${testerEscapeHtml(statusObj.dataset)}</div>`
            : '';
        items.push(
            `<div class="rounded-md border px-3 py-2 bg-white/70" style="border-color: var(--border);">
                <div class="text-[11px] font-medium" style="color: var(--foreground);">${testerEscapeHtml(config.title)}：<span class="${tone}">${testerEscapeHtml(statusObj.label || statusObj.status || '未知狀態')}</span></div>
                ${dataset}
                ${statusCode}
                ${message}
                ${spanText}
                ${hint}
            </div>`,
        );
    });
    if (items.length === 0) return '';
    return `<div class="mt-3 text-[11px]"><div class="font-semibold" style="color: var(--foreground);">FinMind API 診斷</div><div class="mt-2 space-y-2">${items.join('')}</div></div>`;
}

function getStockNoValue() {
    const input = document.getElementById('stockNo');
    return (input?.value || '').trim().toUpperCase();
}

function isIndexSymbol(stockNo) {
    if (!stockNo) return false;
    return stockNo.startsWith('^') && stockNo.length > 1;
}

function normalizeMarketValue(value) {
    const normalized = (value || 'TWSE').toUpperCase();
    if (normalized === 'NASDAQ' || normalized === 'NYSE') return 'US';
    return normalized;
}

function getCurrentMarketFromUI() {
    const selectEl = document.getElementById('marketSelect');
    return normalizeMarketValue(selectEl?.value || 'TWSE');
}

function getMarketLabel(market) {
    if (market === 'TPEX') return '上櫃 (TPEX)';
    if (market === 'US') return '美股 (US)';
    if (market === 'INDEX') return '指數 (Yahoo)';
    return '上市 (TWSE)';
}

function applyMarketPreset(market) {
    const adjustedCheckbox = document.getElementById('adjustedPriceCheckbox');
    const splitCheckbox = document.getElementById('splitAdjustmentCheckbox');
    const disableAdjusted = market === 'US' || market === 'INDEX';

    if (adjustedCheckbox) {
        if (disableAdjusted && adjustedCheckbox.checked) {
            adjustedCheckbox.checked = false;
        }
        if (disableAdjusted) {
            adjustedCheckbox.dataset.marketDisabled = 'true';
        } else {
            delete adjustedCheckbox.dataset.marketDisabled;
        }
        adjustedCheckbox.disabled = disableAdjusted;
        adjustedCheckbox.setAttribute('aria-disabled', String(disableAdjusted));
        const adjustedContainer = adjustedCheckbox.closest('.flex.items-center');
        if (adjustedContainer) {
            adjustedContainer.classList.toggle('opacity-60', disableAdjusted);
        }
    }

    if (splitCheckbox) {
        if (disableAdjusted) {
            splitCheckbox.dataset.marketDisabled = 'true';
        } else {
            delete splitCheckbox.dataset.marketDisabled;
        }
    }

    syncSplitAdjustmentState();

    const marketHint = document.getElementById('marketAdjustedHint');
    if (marketHint) {
        marketHint.classList.toggle('hidden', market !== 'US');
    }
}

function isAdjustedMode() {
    const checkbox = document.getElementById('adjustedPriceCheckbox');
    return Boolean(checkbox && checkbox.checked);
}

function isSplitAdjustmentEnabled() {
    const checkbox = document.getElementById('splitAdjustmentCheckbox');
    if (!checkbox) return false;
    if (!isAdjustedMode()) return false;
    return Boolean(checkbox.checked);
}

function syncSplitAdjustmentState() {
    const splitCheckbox = document.getElementById('splitAdjustmentCheckbox');
    if (!splitCheckbox) return;
    const marketDisabled = splitCheckbox.dataset.marketDisabled === 'true';
    const shouldDisable = !isAdjustedMode();
    const effectiveDisabled = marketDisabled || shouldDisable;
    if (effectiveDisabled && splitCheckbox.checked) {
        splitCheckbox.checked = false;
    }
    splitCheckbox.disabled = effectiveDisabled;
    splitCheckbox.setAttribute('aria-disabled', String(effectiveDisabled));
    const container = splitCheckbox.closest('.flex.items-center');
    if (container) {
        container.classList.toggle('opacity-60', effectiveDisabled);
    }
}

function getDateRangeFromUI() {
    const start = document.getElementById('startDate')?.value || '';
    const end = document.getElementById('endDate')?.value || '';
    return { start, end };
}

function getTesterSourceConfigs(market, adjusted, splitEnabled) {
    if (adjusted) {
        const netlifyDescription = splitEnabled
            ? 'TWSE/FinMind 原始 + FinMind 配息 + 股票拆分'
            : 'TWSE/FinMind 原始 + FinMind 配息';
        return [
            { id: 'yahoo', label: 'Yahoo 還原價', description: '主來源 (還原股價)' },
            {
                id: 'netlifyAdjusted',
                label: 'Netlify 還原備援',
                description: netlifyDescription,
            },
        ];
    }
    if (market === 'INDEX') {
        return [
            { id: 'yahoo', label: 'Yahoo 指數資料', description: 'Yahoo Finance 指數日線' },
        ];
    }
    if (market === 'US') {
        return [
            { id: 'finmind', label: 'FinMind 主來源', description: 'FinMind 美股日線資料' },
            { id: 'yahoo', label: 'Yahoo 備援', description: 'FinMind 失效時啟用' },
        ];
    }
    if (market === 'TPEX') {
        return [
            { id: 'finmind', label: 'FinMind 主來源', description: '預設資料來源' },
            { id: 'yahoo', label: 'Yahoo 備援', description: 'FinMind 失效時啟用' },
        ];
    }
    return [
        { id: 'twse', label: 'TWSE 主來源', description: '預設資料來源' },
        { id: 'finmind', label: 'FinMind 備援', description: 'TWSE 失效時啟用' },
    ];
}

function rocToIsoDate(rocDate) {
    if (!rocDate) return null;
    const parts = String(rocDate).split('/');
    if (parts.length !== 3) return null;
    const [rocYear, month, day] = parts.map((val) => parseInt(val, 10));
    if (!Number.isFinite(rocYear) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const year = rocYear + 1911;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function showTesterResult(status, message) {
    const resultEl = document.getElementById('dataSourceTesterResult');
    if (!resultEl) return;
    resultEl.className = 'text-xs rounded-md px-3 py-2 border transition-colors';
    if (status === 'success') {
        resultEl.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-700');
    } else if (status === 'error') {
        resultEl.classList.add('bg-rose-50', 'border-rose-200', 'text-rose-700');
    } else {
        resultEl.classList.add('bg-sky-50', 'border-sky-200', 'text-sky-700');
    }
    resultEl.innerHTML = message;
    resultEl.classList.remove('hidden');
}

function clearTesterResult() {
    const resultEl = document.getElementById('dataSourceTesterResult');
    if (!resultEl) return;
    resultEl.innerHTML = '';
    resultEl.className = 'text-xs hidden';
}

function renderDataSourceTesterButtons(sources, disabled) {
    const container = document.getElementById('dataSourceTesterButtons');
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(sources) || sources.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.className = 'text-[11px] text-muted-foreground';
        placeholder.style.color = 'var(--muted-foreground)';
        placeholder.textContent = '目前沒有可測試的資料來源。';
        container.appendChild(placeholder);
        return;
    }
    sources.forEach((source) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'px-3 py-2 text-xs border rounded-md bg-white hover:bg-slate-50 transition-colors flex flex-col items-start gap-0.5 disabled:opacity-60 disabled:cursor-not-allowed';
        btn.style.borderColor = 'var(--border)';
        btn.disabled = disabled;
        btn.dataset.source = source.id;
        btn.dataset.label = source.label;
        btn.innerHTML = `<span class="font-medium" style="color: var(--foreground);">${source.label}</span>`
            + (source.description
                ? `<span class="text-[10px]" style="color: var(--muted-foreground);">${source.description}</span>`
                : '');
        btn.addEventListener('click', () => runDataSourceTester(source.id, source.label));
        container.appendChild(btn);
    });
}

function setTesterButtonsDisabled(disabled) {
    const container = document.getElementById('dataSourceTesterButtons');
    if (!container) return;
    container.querySelectorAll('button').forEach((btn) => {
        btn.disabled = disabled;
    });
}

async function runDataSourceTester(sourceId, sourceLabel) {
    if (dataSourceTesterState.busy) return;
    const stockNo = getStockNoValue();
    const { start, end } = getDateRangeFromUI();
    if (!stockNo || !start || !end) {
        showTesterResult('error', '請先輸入股票代碼並設定開始與結束日期。');
        clearTesterTableData();
        return;
    }
    const uiMarket = getCurrentMarketFromUI();
    const market = isIndexSymbol(stockNo) ? 'INDEX' : uiMarket;
    const adjusted = isAdjustedMode();
    const splitEnabled = isSplitAdjustmentEnabled();
    let requestUrl = '';
    let parseMode = 'proxy';
    clearTesterTableData();
    if (adjusted) {
        if (sourceId === 'netlifyAdjusted') {
            const params = new URLSearchParams({
                stockNo,
                startDate: start,
                endDate: end,
                market,
            });
            if (splitEnabled) params.set('split', '1');
            requestUrl = `/api/adjusted-price/?${params.toString()}`;
            parseMode = 'adjustedComposer';
        } else if (sourceId === 'yahoo') {
            const endpoint = market === 'TPEX' ? '/api/tpex/' : '/api/twse/';
            const params = new URLSearchParams({
                stockNo,
                start,
                end,
            });
            params.set('adjusted', '1');
            params.set('forceSource', 'yahoo');
            requestUrl = `${endpoint}?${params.toString()}`;
        } else {
            showTesterResult('error', '還原股價目前僅支援 Yahoo 或 Netlify 備援測試。');
            return;
        }
    } else {
        let endpoint = '/api/twse/';
        if (market === 'TPEX') endpoint = '/api/tpex/';
        else if (market === 'US') endpoint = '/api/us/';
        else if (market === 'INDEX') endpoint = '/api/index/';
        const params = new URLSearchParams({
            stockNo,
            start,
            end,
        });
        if (sourceId) params.set('forceSource', sourceId);
        requestUrl = `${endpoint}?${params.toString()}`;
    }

    dataSourceTesterState.busy = true;
    updateTesterTableAvailability();
    setTesterButtonsDisabled(true);
    showTesterResult('info', `⌛ 正在測試 <span class="font-semibold">${sourceLabel}</span>，請稍候...`);

    try {
        const response = await fetch(requestUrl, {
            headers: { Accept: 'application/json' },
        });
        const text = await response.text();
        let payload = {};
        try {
            payload = text ? JSON.parse(text) : {};
        } catch (error) {
            payload = {};
        }
        if (!response.ok || payload?.error) {
            const message = payload?.error || `HTTP ${response.status}`;
            throw new Error(message);
        }
        let detailHtml = '';
        let tableSourceLabel = sourceLabel;
        const extraSections = [];
        if (parseMode === 'adjustedComposer') {
            const rows = Array.isArray(payload.data) ? payload.data : [];
            const total = rows.length;
            const firstDate = rows.length > 0 ? rows[0]?.date || start : start;
            const lastDate = rows.length > 0 ? rows[rows.length - 1]?.date || end : end;
            const summary = payload && typeof payload.summary === 'object' ? payload.summary : {};
            const summarySources = Array.isArray(summary?.sources)
                ? summary.sources.join(' + ')
                : null;
            const sourceSummary = payload?.dataSource || summarySources || 'Netlify 還原管線';
            tableSourceLabel = sourceSummary;
            const debugSteps = Array.isArray(payload?.debugSteps) ? payload.debugSteps : [];
            const adjustmentsList = Array.isArray(payload?.adjustments) ? payload.adjustments : [];
            const aggregatedEvents = Array.isArray(payload?.dividendEvents) ? payload.dividendEvents : [];
            const fallbackInfo =
                payload?.adjustmentFallback && typeof payload.adjustmentFallback === 'object'
                    ? payload.adjustmentFallback
                    : null;
            const fallbackAppliedFlag = Boolean(payload?.adjustmentFallbackApplied);
            const appliedAdjustments = adjustmentsList.filter((event) => !event.skipped).length;
            const skippedAdjustments = adjustmentsList.filter((event) => event.skipped).length;
            const {
                priceSource,
                priceRows,
                dividendRows,
                dividendRowsTotal,
                dividendEvents,
                dividendFetchStart,
                dividendFetchEnd,
                dividendLookbackDays: lookbackDays,
                adjustmentEvents,
                skippedEvents,
                adjustmentSkipReasons,
                splitRows,
                splitRowsTotal,
                splitEvents,
                splitFetchStart,
                splitFetchEnd,
            } = summary;
            const dividendDiagnostics =
                payload?.dividendDiagnostics && typeof payload.dividendDiagnostics === 'object'
                    ? payload.dividendDiagnostics
                    : null;
            const splitDiagnostics =
                payload?.splitDiagnostics && typeof payload.splitDiagnostics === 'object'
                    ? payload.splitDiagnostics
                    : null;
            const splitResult =
                splitDiagnostics?.splitResult && typeof splitDiagnostics.splitResult === 'object'
                    ? splitDiagnostics.splitResult
                    : null;
            const lines = [
                `來源摘要: <span class="font-semibold">${testerEscapeHtml(sourceSummary)}</span>`,
                `資料筆數: <span class="font-semibold">${testerEscapeHtml(total)}</span>`,
                `涵蓋區間: <span class="font-semibold">${testerEscapeHtml(firstDate)} ~ ${testerEscapeHtml(lastDate)}</span>`,
                `有效還原事件: <span class="font-semibold">${testerEscapeHtml(appliedAdjustments)}</span> 件${
                    skippedAdjustments > 0
                        ? `，跳過 <span class="font-semibold">${testerEscapeHtml(skippedAdjustments)}</span> 件`
                        : ''
                }`,
            ];
            if (Number.isFinite(priceRows)) {
                lines.push(`價格筆數: <span class="font-semibold">${testerEscapeHtml(priceRows)}</span>`);
            }
            if (priceSource) {
                lines.push(`原始價格來源: <span class="font-semibold">${testerEscapeHtml(priceSource)}</span>`);
            }
            if (Number.isFinite(adjustmentEvents)) {
                lines.push(
                    `成功還原事件: <span class="font-semibold">${testerEscapeHtml(adjustmentEvents)}</span> 件`,
                );
            }
            if (Number.isFinite(skippedEvents) && skippedEvents > 0) {
                lines.push(`略過事件: <span class="font-semibold">${testerEscapeHtml(skippedEvents)}</span> 件`);
            }
            if (Number.isFinite(dividendRowsTotal)) {
                const effectiveText = Number.isFinite(dividendRows)
                    ? `，其中 <span class="font-semibold">${testerEscapeHtml(dividendRows)}</span> 筆落在回測區間`
                    : '';
                lines.push(
                    `FinMind 配息結果筆數: <span class="font-semibold">${testerEscapeHtml(dividendRowsTotal)}</span> 筆${effectiveText}`,
                );
            } else if (Number.isFinite(dividendRows)) {
                lines.push(
                    `FinMind 配息結果筆數: <span class="font-semibold">${testerEscapeHtml(dividendRows)}</span> 筆`,
                );
            }
            if (Number.isFinite(dividendEvents)) {
                lines.push(
                    `FinMind 有效配息事件: <span class="font-semibold">${testerEscapeHtml(dividendEvents)}</span> 件`,
                );
            }
            if (Number.isFinite(splitRowsTotal)) {
                const effectiveSplitText = Number.isFinite(splitRows)
                    ? `，其中 <span class="font-semibold">${testerEscapeHtml(splitRows)}</span> 筆落在回測區間`
                    : '';
                lines.push(
                    `FinMind 股票拆分筆數: <span class="font-semibold">${testerEscapeHtml(splitRowsTotal)}</span> 筆${effectiveSplitText}`,
                );
            } else if (Number.isFinite(splitRows)) {
                lines.push(
                    `FinMind 股票拆分筆數: <span class="font-semibold">${testerEscapeHtml(splitRows)}</span> 筆`,
                );
            }
            if (Number.isFinite(splitEvents)) {
                lines.push(
                    `FinMind 有效拆分事件: <span class="font-semibold">${testerEscapeHtml(splitEvents)}</span> 件`,
                );
            }
            if (dividendFetchStart || dividendFetchEnd) {
                const rangeStart = dividendFetchStart || '—';
                const rangeEnd = dividendFetchEnd || '—';
                const suffix = Number.isFinite(lookbackDays)
                    ? `，向前延伸 <span class="font-semibold">${testerEscapeHtml(lookbackDays)}</span> 天`
                    : '';
                lines.push(
                    `FinMind 配息查詢區間: <span class="font-semibold">${testerEscapeHtml(rangeStart)} ~ ${testerEscapeHtml(rangeEnd)}</span>${suffix}`,
                );
            }
            if (splitFetchStart || splitFetchEnd) {
                const splitRangeStart = splitFetchStart || '—';
                const splitRangeEnd = splitFetchEnd || '—';
                lines.push(
                    `FinMind 拆分查詢區間: <span class="font-semibold">${testerEscapeHtml(splitRangeStart)} ~ ${testerEscapeHtml(splitRangeEnd)}</span>`,
                );
            }
            if (dividendDiagnostics && dividendDiagnostics.dividendResult && typeof dividendDiagnostics.dividendResult === 'object') {
                const resultDiag = dividendDiagnostics.dividendResult;
                const resultParts = [];
                if (Number.isFinite(resultDiag.totalRecords)) {
                    resultParts.push(`原始 ${testerEscapeHtml(resultDiag.totalRecords)} 筆`);
                }
                if (Number.isFinite(resultDiag.filteredRecords)) {
                    resultParts.push(`區間 ${testerEscapeHtml(resultDiag.filteredRecords)} 筆`);
                }
                if (Number.isFinite(resultDiag.eventCount)) {
                    resultParts.push(`事件 ${testerEscapeHtml(resultDiag.eventCount)} 件`);
                }
                if (Number.isFinite(resultDiag.appliedAdjustments)) {
                    resultParts.push(`成功 ${testerEscapeHtml(resultDiag.appliedAdjustments)} 件`);
                }
                if (resultParts.length > 0) {
                    lines.push(`FinMind 配息結果：<span class="font-semibold">${resultParts.join(' / ')}</span>`);
                }
                const resultLogHtml = buildFinMindResponseLogHtml(
                    Array.isArray(resultDiag.responseLog) ? resultDiag.responseLog : [],
                    { title: 'FinMind 配息結果紀錄' },
                );
                if (resultLogHtml) {
                    extraSections.push(resultLogHtml);
                }
            }
            if (splitResult) {
                const splitParts = [];
                if (Number.isFinite(splitResult.totalRecords)) {
                    splitParts.push(`原始 ${testerEscapeHtml(splitResult.totalRecords)} 筆`);
                }
                if (Number.isFinite(splitResult.filteredRecords)) {
                    splitParts.push(`區間 ${testerEscapeHtml(splitResult.filteredRecords)} 筆`);
                }
                if (Number.isFinite(splitResult.eventCount)) {
                    splitParts.push(`事件 ${testerEscapeHtml(splitResult.eventCount)} 件`);
                }
                if (Number.isFinite(splitResult.appliedAdjustments)) {
                    splitParts.push(`成功 ${testerEscapeHtml(splitResult.appliedAdjustments)} 件`);
                }
                if (splitParts.length > 0) {
                    lines.push(`FinMind 股票拆分：<span class="font-semibold">${splitParts.join(' / ')}</span>`);
                }
                if (splitResult.resultInfo?.detail) {
                    lines.push(`拆分資料摘要：<span class="font-semibold">${testerEscapeHtml(splitResult.resultInfo.detail)}</span>`);
                }
            }
            if (Array.isArray(dividendDiagnostics?.eventPreview) && dividendDiagnostics.eventPreview.length > 0) {
                const previewLimit = Number.isFinite(dividendDiagnostics?.eventPreviewLimit)
                    ? dividendDiagnostics.eventPreviewLimit
                    : dividendDiagnostics.eventPreview.length;
                const previewItems = dividendDiagnostics.eventPreview
                    .slice(0, previewLimit)
                    .map((item) => {
                        const ratioValue = Number.isFinite(item.manualRatio) ? item.manualRatio : null;
                        const ratioPercent = ratioValue !== null
                            ? `${formatTesterNumber(ratioValue * 100, 3)}%`
                            : '—';
                        const beforeText = Number.isFinite(item.beforePrice)
                            ? formatTesterNumber(item.beforePrice, 4)
                            : '—';
                        const afterText = Number.isFinite(item.afterPrice)
                            ? formatTesterNumber(item.afterPrice, 4)
                            : '—';
                        const ratioEquation = ratioValue !== null && beforeText !== '—' && afterText !== '—'
                            ? `${afterText} ÷ ${beforeText} ≈ ${formatTesterNumber(ratioValue, 6)}`
                            : '';
                        const dividendTotalText = Number.isFinite(item.dividendTotal)
                            ? formatTesterNumber(item.dividendTotal, 4)
                            : '—';
                        const ratioLine = `<div>手動還原比率：<span class="font-semibold">${testerEscapeHtml(ratioPercent)}</span></div>`;
                        const equationLine = ratioEquation
                            ? `<div>計算：<span class="font-semibold">${testerEscapeHtml(ratioEquation)}</span></div>`
                            : '';
                        return `<div class="rounded-md border px-3 py-2 text-[10px]" style="border-color: var(--border);">`
                            + `<div>除權息日：<span class="font-semibold">${testerEscapeHtml(item.date || '—')}</span></div>`
                            + `${ratioLine}`
                            + `<div>前收盤：<span class="font-semibold">${testerEscapeHtml(beforeText)}</span> ・ 後參考：<span class="font-semibold">${testerEscapeHtml(afterText)}</span></div>`
                            + `${equationLine}`
                            + `<div>股利總額（stock_and_cache_dividend）：<span class="font-semibold">${testerEscapeHtml(dividendTotalText)}</span></div>`
                            + `</div>`;
                    })
                    .join('');
                const moreCount = Number.isFinite(dividendDiagnostics?.eventPreviewMore)
                    ? dividendDiagnostics.eventPreviewMore
                    : Math.max(
                        0,
                        (Number.isFinite(dividendDiagnostics?.eventPreviewTotal)
                            ? dividendDiagnostics.eventPreviewTotal
                            : dividendDiagnostics.eventPreview.length)
                            - Math.min(previewLimit, dividendDiagnostics.eventPreview.length),
                    );
                const moreNote = moreCount > 0
                    ? `<div class="text-[10px]" style="color: var(--muted-foreground);">尚有 ${testerEscapeHtml(moreCount)} 筆配息結果未顯示，請於 JSON 回應內查看完整列表。</div>`
                    : '';
                const formulaHint = `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">資料來源：FinMind TaiwanStockDividendResult ・ 計算方式：after_price ÷ before_price = 手動還原係數</div>`;
                lines.push(`<div class="mt-2"><div class="font-semibold text-[11px]">FinMind 配息推算</div>${formulaHint}<div class="mt-1 space-y-1">${previewItems}</div>${moreNote}</div>`);
            }
            if (Array.isArray(splitDiagnostics?.eventPreview) && splitDiagnostics.eventPreview.length > 0) {
                const previewLimit = Number.isFinite(splitDiagnostics?.eventPreviewLimit)
                    ? splitDiagnostics.eventPreviewLimit
                    : splitDiagnostics.eventPreview.length;
                const previewItems = splitDiagnostics.eventPreview
                    .slice(0, previewLimit)
                    .map((item) => {
                        const ratioValue = Number.isFinite(item.manualRatio) ? item.manualRatio : null;
                        const ratioPercent = ratioValue !== null
                            ? `${formatTesterNumber(ratioValue * 100, 3)}%`
                            : '—';
                        const beforeText = Number.isFinite(item.beforePrice)
                            ? formatTesterNumber(item.beforePrice, 4)
                            : '—';
                        const afterText = Number.isFinite(item.afterPrice)
                            ? formatTesterNumber(item.afterPrice, 4)
                            : '—';
                        const ratioEquation = ratioValue !== null && beforeText !== '—' && afterText !== '—'
                            ? `${afterText} ÷ ${beforeText} ≈ ${formatTesterNumber(ratioValue, 6)}`
                            : '';
                        const ratioLine = `<div>手動還原比率：<span class="font-semibold">${testerEscapeHtml(ratioPercent)}</span></div>`;
                        const equationLine = ratioEquation
                            ? `<div>計算：<span class="font-semibold">${testerEscapeHtml(ratioEquation)}</span></div>`
                            : '';
                        return `<div class="rounded-md border px-3 py-2 text-[10px]" style="border-color: var(--border);">`
                            + `<div>拆分基準日：<span class="font-semibold">${testerEscapeHtml(item.date || '—')}</span></div>`
                            + `${ratioLine}`
                            + `<div>前收盤：<span class="font-semibold">${testerEscapeHtml(beforeText)}</span> ・ 後參考：<span class="font-semibold">${testerEscapeHtml(afterText)}</span></div>`
                            + `${equationLine}`
                            + `</div>`;
                    })
                    .join('');
                const moreCount = Number.isFinite(splitDiagnostics?.eventPreviewMore)
                    ? splitDiagnostics.eventPreviewMore
                    : Math.max(
                        0,
                        (Number.isFinite(splitDiagnostics?.eventPreviewTotal)
                            ? splitDiagnostics.eventPreviewTotal
                            : splitDiagnostics.eventPreview.length)
                            - Math.min(previewLimit, splitDiagnostics.eventPreview.length),
                    );
                const moreNote = moreCount > 0
                    ? `<div class="text-[10px]" style="color: var(--muted-foreground);">尚有 ${testerEscapeHtml(moreCount)} 筆拆分事件未顯示，請於 JSON 回應內查看完整列表。</div>`
                    : '';
                const formulaHintSplit = `<div class="mt-1 text-[10px]" style="color: var(--muted-foreground);">資料來源：FinMind TaiwanStockSplitPrice ・ 計算方式：after_price ÷ before_price = 手動還原係數</div>`;
                lines.push(`<div class="mt-2"><div class="font-semibold text-[11px]">FinMind 拆分推算</div>${formulaHintSplit}<div class="mt-1 space-y-1">${previewItems}</div>${moreNote}</div>`);
            }
            const splitResponseHtml = buildFinMindResponseLogHtml(
                Array.isArray(splitDiagnostics?.responseLog) ? splitDiagnostics.responseLog : [],
                { title: 'FinMind 股票拆分請求紀錄' },
            );
            if (splitResponseHtml) {
                extraSections.push(splitResponseHtml);
            }
            if (dividendDiagnostics?.resultInfo?.detail) {
                lines.push(`配息資料摘要：<span class="font-semibold">${testerEscapeHtml(dividendDiagnostics.resultInfo.detail)}</span>`);
            }
            const dividendResponseHtml = buildFinMindResponseLogHtml(
                Array.isArray(dividendDiagnostics?.responseLog) ? dividendDiagnostics.responseLog : [],
                { title: 'FinMind 配息結果請求紀錄' },
            );
            if (dividendResponseHtml) {
                extraSections.push(dividendResponseHtml);
            }
            if (fallbackInfo) {
                const fallbackLabel = testerEscapeHtml(fallbackInfo.label || 'FinMind 還原序列');
                const statusText = fallbackInfo.applied ? '已啟用' : '未啟用';
                const detailText = fallbackInfo.detail ? ` ・ ${testerEscapeHtml(fallbackInfo.detail)}` : '';
                lines.push(`備援還原: <span class="font-semibold">${fallbackLabel}</span> ${statusText}${detailText}`);
                if (Number.isFinite(fallbackInfo.matchedCount) || Number.isFinite(fallbackInfo.adjustmentCount)) {
                    const matchedText = Number.isFinite(fallbackInfo.matchedCount)
                        ? `對齊 ${testerEscapeHtml(fallbackInfo.matchedCount)} 筆`
                        : '';
                    const adjustmentText = Number.isFinite(fallbackInfo.adjustmentCount)
                        ? `事件 ${testerEscapeHtml(fallbackInfo.adjustmentCount)} 件`
                        : '';
                    const ratioSampleText = Number.isFinite(fallbackInfo.ratioSamples)
                        ? `係數樣本 ${testerEscapeHtml(fallbackInfo.ratioSamples)}`
                        : '';
                    const metaParts = [matchedText, adjustmentText, ratioSampleText].filter(Boolean);
                    if (metaParts.length > 0) {
                        lines.push(`備援統計: <span class="font-semibold">${metaParts.join(' ・ ')}</span>`);
                    }
                }
                if (fallbackInfo.error) {
                    lines.push(`備援錯誤: <span class="font-semibold">${testerEscapeHtml(fallbackInfo.error)}</span>`);
                }
                const fallbackLogHtml = buildFinMindResponseLogHtml(
                    Array.isArray(fallbackInfo.responseLog) ? fallbackInfo.responseLog : [],
                    { title: `${fallbackInfo.label || 'FinMind 還原序列'} 請求紀錄` },
                );
                if (fallbackLogHtml) {
                    extraSections.push(fallbackLogHtml);
                }
            } else if (fallbackAppliedFlag) {
                lines.push('備援還原: <span class="font-semibold">已啟用</span>');
            }
            if (
                adjustmentSkipReasons &&
                typeof adjustmentSkipReasons === 'object' &&
                Object.keys(adjustmentSkipReasons).length > 0
            ) {
                const skipDetailsText = formatTesterSkipReasons(adjustmentSkipReasons);
                if (skipDetailsText) {
                    lines.push(`跳過原因統計: <span class="font-semibold">${skipDetailsText}</span>`);
                }
            }

            detailHtml = lines.join('<br>');
            const debugStepsHtml = buildTesterDebugStepsHtml(debugSteps);
            if (debugStepsHtml) {
                detailHtml += debugStepsHtml;
            }
            if (extraSections.length > 0) {
                detailHtml += extraSections.join('');
            }
            const dividendPreviewHtml = buildDividendEventPreviewHtml(aggregatedEvents);
            if (dividendPreviewHtml) {
                detailHtml += dividendPreviewHtml;
            }
            const adjustmentHtml = buildAdjustmentDiagnosticsHtml(adjustmentsList);
            if (adjustmentHtml) {
                detailHtml += adjustmentHtml;
            }
            const combinedLogHtml = buildAdjustmentDebugLogHtml(
                Array.isArray(payload?.adjustmentDebugLog) ? payload.adjustmentDebugLog : [],
                { title: '整合還原係數檢查' },
            );
            if (combinedLogHtml) {
                detailHtml += combinedLogHtml;
            }
            const splitLogHtml = buildAdjustmentDebugLogHtml(
                Array.isArray(splitDiagnostics?.debugLog) ? splitDiagnostics.debugLog : [],
                { title: '拆分係數檢查' },
            );
            if (splitLogHtml) {
                detailHtml += splitLogHtml;
            }
            const dividendLogHtml = buildAdjustmentDebugLogHtml(
                Array.isArray(dividendDiagnostics?.debugLog) ? dividendDiagnostics.debugLog : [],
                { title: '配息還原檢查' },
            );
            if (dividendLogHtml) {
                detailHtml += dividendLogHtml;
            }
            const finmindStatusHtml = buildFinMindApiStatusHtml(
                payload?.finmindStatus || dividendDiagnostics?.finmindStatus || null,
            );
            if (finmindStatusHtml) {
                detailHtml += finmindStatusHtml;
            }
        } else {
            const aaData = Array.isArray(payload.aaData) ? payload.aaData : [];
            const dataRows = Array.isArray(payload.data) ? payload.data : [];
            const total = Number.isFinite(payload.iTotalRecords)
                ? payload.iTotalRecords
                : aaData.length > 0
                    ? aaData.length
                    : dataRows.length;
            const isoDates = aaData
                .map((row) => (Array.isArray(row) ? rocToIsoDate(row[0]) : null))
                .filter((value) => Boolean(value));
            let firstDate = isoDates.length > 0 ? isoDates[0] : start;
            let lastDate = isoDates.length > 0 ? isoDates[isoDates.length - 1] : end;
            if (isoDates.length === 0 && dataRows.length > 0) {
                const dataDates = dataRows
                    .map((row) => (row && typeof row.date === 'string' ? row.date : null))
                    .filter((value) => Boolean(value))
                    .sort();
                if (dataDates.length > 0) {
                    firstDate = dataDates[0];
                    lastDate = dataDates[dataDates.length - 1];
                }
            }
            const sourcesRaw = Array.isArray(payload?.dataSources) && payload.dataSources.length > 0
                ? payload.dataSources
                : payload?.dataSource
                    ? [payload.dataSource]
                    : ['未知資料來源'];
            const detailLines = [
                `來源摘要: <span class="font-semibold">${testerEscapeHtml(sourcesRaw.join('、'))}</span>`,
                `資料筆數: <span class="font-semibold">${testerEscapeHtml(total)}</span>`,
                `涵蓋區間: <span class="font-semibold">${testerEscapeHtml(firstDate)} ~ ${testerEscapeHtml(lastDate)}</span>`,
            ];
            tableSourceLabel = sourcesRaw.join('、');
            if (payload?.fallback?.reason) {
                const fallbackSource = testerEscapeHtml(payload.dataSource || '備援來源');
                const fallbackReason = testerEscapeHtml(payload.fallback.reason);
                detailLines.push(`備援狀態: <span class="font-semibold">改用 ${fallbackSource}</span> ・ 原因：${fallbackReason}`);
            }
            detailHtml = detailLines.join('<br>');
        }
        const normalizedRows = normalizeTesterRows(payload, parseMode);
        setTesterTableData(normalizedRows, tableSourceLabel);
        showTesterResult(
            'success',
            `來源 <span class="font-semibold">${sourceLabel}</span> 測試成功。<br>${detailHtml}`,
        );
    } catch (error) {
        clearTesterTableData();
        showTesterResult(
            'error',
            `來源 <span class="font-semibold">${sourceLabel}</span> 測試失敗：${error.message || error}`,
        );
    } finally {
        dataSourceTesterState.busy = false;
        refreshDataSourceTester();
    }
}

function refreshDataSourceTester() {
    const modeEl = document.getElementById('dataSourceTesterMode');
    const hintEl = document.getElementById('dataSourceTesterHint');
    if (!modeEl || !hintEl) return;
    syncSplitAdjustmentState();
    const { start, end } = getDateRangeFromUI();
    const stockNo = getStockNoValue();
    const uiMarket = getCurrentMarketFromUI();
    const market = isIndexSymbol(stockNo) ? 'INDEX' : uiMarket;
    const adjusted = market === 'INDEX' ? false : isAdjustedMode();
    const splitEnabled = adjusted && isSplitAdjustmentEnabled();
    const sources = getTesterSourceConfigs(market, adjusted, splitEnabled);
    const missingInputs = !stockNo || !start || !end;
    const modeText = adjusted
        ? splitEnabled
            ? '還原股價（含拆分）'
            : '還原股價'
        : '原始股價';
    modeEl.textContent = `${getMarketLabel(market)} ・ ${modeText}`;
    renderDataSourceTesterButtons(sources, missingInputs || dataSourceTesterState.busy);
    const messageLines = [];
    let messageColor = 'var(--muted-foreground)';
    if (missingInputs) {
        messageLines.push('請輸入股票代碼並選擇開始與結束日期後，再執行資料來源測試。');
        clearTesterResult();
    } else if (adjusted) {
        messageLines.push(
            splitEnabled
                ? '還原股價以 Yahoo Finance 為主來源，Netlify 會結合 TWSE/FinMind 原始行情、FinMind 配息與股票拆分資訊。'
                : '還原股價以 Yahoo Finance 為主來源，Netlify 會結合 TWSE/FinMind 原始行情與 FinMind 配息做備援。',
        );
    } else if (market === 'INDEX') {
        messageLines.push('Yahoo Finance 為唯一資料來源，支援常見指數（例如 ^TWII、^GSPC）。');
    } else if (market === 'US') {
        messageLines.push('FinMind 為主來源，Yahoo Finance 為備援來源。建議兩者都測試一次並確認 FINMIND_TOKEN 設定。');
    } else if (market === 'TPEX') {
        messageLines.push('FinMind 為主來源，上櫃備援由 Yahoo 提供。建議主備來源都測試一次。');
    } else {
        messageLines.push('TWSE 為主來源，FinMind 為備援來源。建議主備來源都測試一次。');
    }

    if (!missingInputs && (market === 'TWSE' || market === 'TPEX')) {
        const directoryMeta = typeof window.getTaiwanDirectoryMeta === 'function' ? window.getTaiwanDirectoryMeta() : null;
        if (directoryMeta?.version) {
            const sourceLabel = directoryMeta.source || '台股官方清單';
            const updatedLabel = directoryMeta.updatedAt ? `，更新於 ${directoryMeta.updatedAt}` : '';
            messageLines.push(`${sourceLabel} 版本 ${directoryMeta.version}${updatedLabel}`);
        } else if (directoryMeta && directoryMeta.ready === false) {
            messageLines.push('台股官方清單載入中，請稍候。');
        }
    }

    hintEl.style.color = messageColor;
    hintEl.innerHTML = messageLines.map((line) => testerEscapeHtml(line)).join('<br>');
    if (missingInputs) {
        clearTesterTableData();
    } else {
        updateTesterTableAvailability();
    }
    setTesterButtonsDisabled(dataSourceTesterState.busy || missingInputs);
}

function toggleDataSourceTester(forceOpen) {
    const panel = document.getElementById('dataSourceTester');
    const toggleBtn = document.getElementById('toggleDataSourceTester');
    if (!panel || !toggleBtn) return;
    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : !dataSourceTesterState.open;
    dataSourceTesterState.open = shouldOpen;
    panel.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
        toggleBtn.classList.add('border-primary', 'text-primary', 'bg-primary/10');
        toggleBtn.setAttribute('aria-expanded', 'true');
        refreshDataSourceTester();
    } else {
        toggleBtn.classList.remove('border-primary', 'text-primary', 'bg-primary/10');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }
}

function initDataSourceTester() {
    const toggleBtn = document.getElementById('toggleDataSourceTester');
    const closeBtn = document.getElementById('closeDataSourceTester');
    if (!toggleBtn || !closeBtn) return;
    toggleBtn.addEventListener('click', () => toggleDataSourceTester());
    closeBtn.addEventListener('click', () => toggleDataSourceTester(false));

    const tableToggleBtn = document.getElementById('openDataSourceTesterTable');
    if (tableToggleBtn) {
        tableToggleBtn.addEventListener('click', toggleTesterTable);
    }

    const stockNoInput = document.getElementById('stockNo');
    if (stockNoInput) {
        stockNoInput.addEventListener('input', refreshDataSourceTester);
    }
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    startInput?.addEventListener('change', refreshDataSourceTester);
    endInput?.addEventListener('change', refreshDataSourceTester);
    const marketSelect = document.getElementById('marketSelect');
    marketSelect?.addEventListener('change', refreshDataSourceTester);
    const adjustedCheckbox = document.getElementById('adjustedPriceCheckbox');
    adjustedCheckbox?.addEventListener('change', () => {
        syncSplitAdjustmentState();
        refreshDataSourceTester();
    });
    const splitCheckbox = document.getElementById('splitAdjustmentCheckbox');
    if (splitCheckbox) {
        splitCheckbox.addEventListener('change', () => {
            const adjustedCheckbox = document.getElementById('adjustedPriceCheckbox');
            if (splitCheckbox.checked && adjustedCheckbox && !adjustedCheckbox.checked) {
                adjustedCheckbox.checked = true;
                adjustedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
            refreshDataSourceTester();
        });
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    syncSplitAdjustmentState();
    refreshDataSourceTester();
    window.refreshDataSourceTester = refreshDataSourceTester;
    window.applyMarketPreset = applyMarketPreset;
}

function initStrategyRegistryTester() {
    const container = document.getElementById('strategyRegistryTester');
    if (!container) {
        return;
    }

    const registry = window.StrategyPluginRegistry || null;
    const auditBtn = container.querySelector('[data-action="audit-strategies"]');
    const sampleBtn = container.querySelector('[data-action="sample-backtest"]');
    const summaryEl = container.querySelector('[data-role="audit-summary"]');
    const detailsEl = container.querySelector('[data-role="audit-details"]');
    const sampleStatusEl = container.querySelector('[data-role="sample-status"]');
    const timeFormatter = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
        ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'medium' })
        : null;

    let lastManifest = [];

    const getLabelElement = (button) => (button ? button.querySelector('[data-role="label"]') : null);

    const rememberButtonLabel = (button) => {
        const labelEl = getLabelElement(button);
        if (labelEl && !labelEl.dataset.originalText) {
            labelEl.dataset.originalText = labelEl.textContent || '';
        }
    };

    const setButtonBusy = (button, busy, busyLabel) => {
        if (!button) return;
        rememberButtonLabel(button);
        const labelEl = getLabelElement(button);
        button.disabled = Boolean(busy);
        button.classList.toggle('opacity-70', Boolean(busy));
        if (!labelEl) {
            return;
        }
        if (busy && busyLabel) {
            labelEl.textContent = busyLabel;
        } else if (!busy && labelEl.dataset.originalText) {
            labelEl.textContent = labelEl.dataset.originalText;
        }
    };

    const resetAuditDisplay = () => {
        if (summaryEl) {
            summaryEl.classList.add('hidden');
            summaryEl.textContent = '';
        }
        if (detailsEl) {
            detailsEl.classList.add('hidden');
            detailsEl.innerHTML = '';
        }
    };

    const formatTimestamp = () => {
        try {
            return timeFormatter ? timeFormatter.format(new Date()) : new Date().toLocaleString();
        } catch (error) {
            return new Date().toISOString();
        }
    };

    const classifyStrategyMeta = (meta) => {
        if (!meta || typeof meta.id !== 'string') {
            return 'longEntry';
        }
        const label = typeof meta.label === 'string' ? meta.label : '';
        if (/空單回補/.test(label) || meta.id.startsWith('cover_') || (/空單/.test(label) && /停損/.test(label))) {
            return 'shortExit';
        }
        if (/做空/.test(label) || /空單進場/.test(label) || meta.id.startsWith('short_')) {
            return 'shortEntry';
        }
        if (/多頭出場/.test(label) || /出場/.test(label) || meta.id === 'trailing_stop') {
            return 'longExit';
        }
        if (/空單/.test(label)) {
            return 'shortExit';
        }
        return 'longEntry';
    };

    const buildDefaultParams = (meta) => {
        const params = {};
        const schema = meta?.paramsSchema;
        if (!schema || typeof schema !== 'object' || !schema.properties) {
            return params;
        }
        Object.keys(schema.properties).forEach((key) => {
            const descriptor = schema.properties[key];
            if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
                params[key] = descriptor.default;
            }
        });
        return params;
    };

    const renderFailureDetails = (failures) => {
        if (!detailsEl) {
            return;
        }
        if (!Array.isArray(failures) || failures.length === 0) {
            detailsEl.classList.add('hidden');
            detailsEl.innerHTML = '';
            return;
        }
        const items = failures
            .map((failure) => {
                const id = failure.id || '(未知)';
                const reason = failure.reason?.message || failure.reason?.toString?.() || '未知錯誤';
                return `<div class="py-1"><span class="font-semibold" style="color: var(--foreground);">${testerEscapeHtml(id)}</span>：${testerEscapeHtml(reason)}</div>`;
            })
            .join('');
        detailsEl.innerHTML = `<div class="font-medium mb-1" style="color: var(--foreground);">載入失敗的策略</div>${items}`;
        detailsEl.classList.remove('hidden');
    };

    const runAudit = async () => {
        if (!registry || typeof registry.listStrategies !== 'function') {
            if (summaryEl) {
                summaryEl.textContent = 'StrategyPluginRegistry 尚未就緒，無法檢查。';
                summaryEl.classList.remove('hidden');
            }
            return;
        }
        setButtonBusy(auditBtn, true, '檢查中...');
        resetAuditDisplay();
        let manifest = [];
        try {
            manifest = registry.listStrategies({ includeLazy: true }) || [];
            lastManifest = manifest;
        } catch (error) {
            if (summaryEl) {
                summaryEl.textContent = `讀取策略清單失敗：${error?.message || error}`;
                summaryEl.classList.remove('hidden');
            }
            setButtonBusy(auditBtn, false);
            return;
        }
        if (!Array.isArray(manifest) || manifest.length === 0) {
            if (summaryEl) {
                summaryEl.textContent = '策略清單為空，請確認策略是否已註冊。';
                summaryEl.classList.remove('hidden');
            }
            setButtonBusy(auditBtn, false);
            return;
        }
        const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const outcomes = await Promise.all(
            manifest.map((meta) => {
                const id = typeof meta?.id === 'string' ? meta.id : null;
                if (!id) {
                    return Promise.resolve({ id: '(未知)', status: 'rejected', reason: new Error('缺少策略 ID') });
                }
                if (typeof registry.loadStrategyById === 'function') {
                    return registry
                        .loadStrategyById(id)
                        .then(() => ({ id, status: 'fulfilled' }))
                        .catch((error) => ({ id, status: 'rejected', reason: error }));
                }
                return new Promise((resolve) => {
                    try {
                        if (typeof registry.ensureStrategyLoaded === 'function') {
                            registry.ensureStrategyLoaded(id);
                        } else if (typeof registry.getStrategyById === 'function') {
                            registry.getStrategyById(id);
                        }
                        resolve({ id, status: 'fulfilled' });
                    } catch (error) {
                        resolve({ id, status: 'rejected', reason: error });
                    }
                });
            }),
        );
        const endedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const durationMs = Math.round(Math.max(0, endedAt - startedAt));
        const successCount = outcomes.filter((entry) => entry.status === 'fulfilled').length;
        const failureList = outcomes.filter((entry) => entry.status === 'rejected');

        if (summaryEl) {
            summaryEl.textContent = `於 ${formatTimestamp()} 檢查 ${manifest.length} 策略，成功 ${successCount}，失敗 ${failureList.length}，耗時 ${durationMs} ms。`;
            summaryEl.classList.remove('hidden');
        }
        renderFailureDetails(failureList);
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        setButtonBusy(auditBtn, false);
    };

    const pickRandom = (list) => {
        if (!Array.isArray(list) || list.length === 0) {
            return null;
        }
        const index = Math.floor(Math.random() * list.length);
        return list[index];
    };

    const ensureManifest = () => {
        if (lastManifest && lastManifest.length > 0) {
            return lastManifest;
        }
        if (registry && typeof registry.listStrategies === 'function') {
            try {
                lastManifest = registry.listStrategies({ includeLazy: true }) || [];
            } catch (error) {
                lastManifest = [];
            }
        }
        return lastManifest;
    };

    const runSample = async () => {
        if (!window.BacktestRunner || typeof window.BacktestRunner.run !== 'function') {
            if (sampleStatusEl) {
                sampleStatusEl.textContent = 'BacktestRunner 尚未載入，無法抽樣回測。';
                sampleStatusEl.style.color = '#b91c1c';
            }
            return;
        }
        const manifest = ensureManifest();
        if (!Array.isArray(manifest) || manifest.length === 0) {
            if (sampleStatusEl) {
                sampleStatusEl.textContent = '尚未取得策略清單，請先執行註冊檢查。';
                sampleStatusEl.style.color = '#b91c1c';
            }
            return;
        }
        const groups = manifest.reduce(
            (acc, meta) => {
                const bucket = classifyStrategyMeta(meta);
                if (!acc[bucket]) {
                    acc[bucket] = [];
                }
                acc[bucket].push(meta);
                return acc;
            },
            { longEntry: [], longExit: [], shortEntry: [], shortExit: [] },
        );
        const entryMeta = pickRandom(groups.longEntry);
        const exitMeta = pickRandom(groups.longExit.length > 0 ? groups.longExit : groups.longEntry);
        if (!entryMeta || !exitMeta) {
            if (sampleStatusEl) {
                sampleStatusEl.textContent = '策略清單不足，無法抽樣回測。';
                sampleStatusEl.style.color = '#b91c1c';
            }
            return;
        }
        if (typeof getBacktestParams !== 'function') {
            if (sampleStatusEl) {
                sampleStatusEl.textContent = '無法取得回測參數（getBacktestParams 未定義）。';
                sampleStatusEl.style.color = '#b91c1c';
            }
            return;
        }
        const params = getBacktestParams();
        params.entryStrategy = entryMeta.id;
        params.entryParams = buildDefaultParams(entryMeta);
        params.exitStrategy = exitMeta.id;
        params.exitParams = buildDefaultParams(exitMeta);
        params.enableShorting = false;
        params.shortEntryStrategy = null;
        params.shortExitStrategy = null;
        params.shortEntryParams = {};
        params.shortExitParams = {};

        if (sampleStatusEl) {
            sampleStatusEl.textContent = `使用 ${entryMeta.label} / ${exitMeta.label} 回測中...`;
            sampleStatusEl.style.color = 'var(--muted-foreground)';
        }
        setButtonBusy(sampleBtn, true, '回測中...');

        try {
            if (registry && typeof registry.loadStrategyById === 'function') {
                await Promise.all([entryMeta.id, exitMeta.id].map((id) => registry.loadStrategyById(id)));
            }
        } catch (error) {
            if (sampleStatusEl) {
                sampleStatusEl.textContent = `策略載入失敗：${error?.message || error}`;
                sampleStatusEl.style.color = '#b91c1c';
            }
            setButtonBusy(sampleBtn, false);
            return;
        }

        try {
            const response = await window.BacktestRunner.run({
                params,
                strategies: [entryMeta.id, exitMeta.id],
            });
            const annualized = Number.isFinite(response?.result?.annualizedReturn)
                ? response.result.annualizedReturn.toFixed(2)
                : 'N/A';
            const trades = Number.isFinite(response?.result?.tradesCount)
                ? response.result.tradesCount
                : 0;
            const durationText = Number.isFinite(response?.durationMs)
                ? `${Math.round(response.durationMs)} ms`
                : '—';
            if (sampleStatusEl) {
                sampleStatusEl.textContent = `完成抽樣：${entryMeta.label} → ${exitMeta.label}，年化報酬 ${annualized}% ，交易次數 ${trades}，耗時 ${durationText}。`;
                sampleStatusEl.style.color = 'var(--foreground)';
            }
        } catch (error) {
            if (sampleStatusEl) {
                sampleStatusEl.textContent = `抽樣回測失敗：${error?.message || error}`;
                sampleStatusEl.style.color = '#b91c1c';
            }
        } finally {
            setButtonBusy(sampleBtn, false);
        }
    };

    auditBtn?.addEventListener('click', runAudit);
    sampleBtn?.addEventListener('click', runSample);
}

function formatBatchDebugTime(value) {
    if (value === null || value === undefined) {
        return '';
    }
    let date;
    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'number') {
        date = new Date(value);
    } else {
        date = new Date(String(value));
    }
    if (!Number.isFinite(date.getTime())) {
        return typeof value === 'string' ? value : String(value);
    }
    try {
        return date.toLocaleString('zh-TW', { hour12: false });
    } catch (error) {
        return date.toISOString().replace('T', ' ').replace('Z', 'Z');
    }
}

function parseBatchDebugTime(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value : null;
    }
    const date = new Date(typeof value === 'number' ? value : String(value));
    return Number.isFinite(date.getTime()) ? date : null;
}

function formatBatchDebugDuration(startValue, endValue) {
    const startDate = parseBatchDebugTime(startValue);
    const endDate = parseBatchDebugTime(endValue);
    if (!startDate || !endDate) {
        return '';
    }
    const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
    if (!Number.isFinite(diffMs) || diffMs <= 0) {
        return '';
    }
    const seconds = diffMs / 1000;
    if (seconds < 1) {
        return `${seconds.toFixed(2)} 秒`;
    }
    if (seconds < 60) {
        return `${seconds.toFixed(1)} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;
    if (minutes < 60) {
        return remainSeconds > 0
            ? `${minutes} 分 ${remainSeconds.toFixed(1)} 秒`
            : `${minutes} 分鐘`;
    }
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return remainMinutes > 0
        ? `${hours} 小時 ${remainMinutes} 分`
        : `${hours} 小時`;
}

const BATCH_DEBUG_LEVEL_PRESETS = {
    info: {
        label: '資訊',
        english: 'INFO',
        background: 'rgba(8, 145, 178, 0.12)',
        border: 'rgba(8, 145, 178, 0.28)',
        color: '#0f766e',
    },
    success: {
        label: '完成',
        english: 'SUCCESS',
        background: 'rgba(16, 185, 129, 0.16)',
        border: 'rgba(16, 185, 129, 0.28)',
        color: '#047857',
    },
    warn: {
        label: '警示',
        english: 'WARN',
        background: 'rgba(245, 158, 11, 0.18)',
        border: 'rgba(245, 158, 11, 0.30)',
        color: '#b45309',
    },
    warning: {
        label: '警示',
        english: 'WARN',
        background: 'rgba(245, 158, 11, 0.18)',
        border: 'rgba(245, 158, 11, 0.30)',
        color: '#b45309',
    },
    error: {
        label: '錯誤',
        english: 'ERROR',
        background: 'rgba(220, 38, 38, 0.14)',
        border: 'rgba(220, 38, 38, 0.30)',
        color: '#b91c1c',
    },
    debug: {
        label: '偵錯',
        english: 'DEBUG',
        background: 'rgba(107, 114, 128, 0.12)',
        border: 'rgba(107, 114, 128, 0.28)',
        color: '#374151',
    },
    trace: {
        label: '追蹤',
        english: 'TRACE',
        background: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.30)',
        color: '#1d4ed8',
    },
};

function resolveBatchDebugLevelMeta(level) {
    const key = typeof level === 'string' ? level.trim().toLowerCase() : '';
    const preset = key && Object.prototype.hasOwnProperty.call(BATCH_DEBUG_LEVEL_PRESETS, key)
        ? BATCH_DEBUG_LEVEL_PRESETS[key]
        : null;
    const fallbackLabel = typeof level === 'string' && level.trim()
        ? level.trim().toUpperCase()
        : '資訊';
    const englishLabel = preset?.english || fallbackLabel;
    return {
        label: preset?.label || fallbackLabel,
        english: englishLabel,
        background: preset?.background || 'rgba(148, 163, 184, 0.16)',
        border: preset?.border || 'rgba(148, 163, 184, 0.26)',
        color: preset?.color || '#334155',
    };
}

const BATCH_DEBUG_PHASE_LABELS = {
    init: '初始化流程',
    worker: '回測執行',
    backtest: '回測流程',
    optimize: '參數優化',
    collect: '結果彙整',
    render: '畫面更新',
    compare: '結果對拍',
    headless: '背景作業',
    summary: '結果摘要',
    storage: '快取快照'
};

const BATCH_DEBUG_EVENT_NAME_MAP = {
    'session-start': '除錯會話啟動',
    'session-complete': '除錯會話結束',
    'batch-start': '批量優化啟動',
    'results-reset': '重設結果列表',
    'execute-start': '開始執行批量回測',
    'batch-processing-start': '併發優化啟動',
    'combo-iteration-start': '組合迭代啟動',
    'combo-iteration-cycle': '組合迭代進行',
    'combo-iteration-final': '組合迭代完成',
    'combo-iteration-error': '組合迭代錯誤',
    'combination-start': '回測組合啟動',
    'combination-complete': '回測組合完成',
    'combination-error': '回測組合錯誤',
    'combination-no-result': '回測組合無結果',
    'combination-batch-empty': '本輪無任何回測結果',
    'batch-results-appended': '寫入批量結果',
    'cached-data-evaluation': '批量快取診斷',
    'cached-data-slice-applied': '快取資料裁切',
    'cached-data-coverage-mismatch': '快取覆蓋異常',
    'worker-run-start': '啟動回測工作',
    'worker-run-result': '回測結果返回',
    'worker-run-error': '回測工作錯誤',
    'worker-run-timeout': '回測工作逾時',
    'worker-run-exception': '回測工作異常',
    'worker-missing-url': '回測 Worker 缺少來源',
    'param-optimization-complete': '參數優化完成',
    'param-optimization-error': '參數優化錯誤',
    'combo-optimize-complete': '組合優化完成',
    'combo-optimize-error': '組合優化錯誤',
    'headless-cache-state': '背景快取狀態',
    'headless-cache-restore': '背景快取還原',
    'headless-state-snapshot': '背景狀態快照',
    'headless-state-restore': '背景狀態還原',
    'headless-compare': '背景結果對拍',
    'headless-compare-error': '背景對拍錯誤',
    'headless-result': '背景最佳結果',
    'dom-sync-pass': '畫面同步通過',
    'dom-sync-mismatch': '畫面同步差異',
    'dom-sync-error': '畫面同步錯誤',
    'best-result-found': '找到最佳結果',
    'best-result-missing': '最佳結果缺失',
    'storageRestored': '快取儲存還原',
    'storagerestored': '快取儲存還原'
};

const BATCH_DEBUG_SOURCE_LABELS = {
    'global-cache': '全域快取',
    override: '覆寫資料',
    none: '無快取',
    worker: '即時抓取'
};

const BATCH_DEBUG_MARKET_LABELS = {
    TWSE: '台股上市（TWSE）',
    TPEX: '台股上櫃（TPEX）',
    OTC: '台股上櫃（OTC）',
    TPEx: '台股上櫃（TPEX）',
    US: '美股（US）',
    HK: '港股（HK）'
};

const BATCH_DEBUG_PRICE_MODE_LABELS = {
    adjusted: '還原價',
    raw: '原始價'
};

const BATCH_DEBUG_TRADE_TIMING_LABELS = {
    close: '當日收盤',
    open: '當日開盤',
    next_open: '次日開盤',
    next_close: '次日收盤'
};

const BATCH_DEBUG_COVERAGE_REASON_LABELS = {
    ok: '覆蓋符合需求',
    'dataset-empty': '快取資料為空',
    'dataset-start-after-required-start': '快取起點晚於需求起點',
    'dataset-end-before-required-end': '快取終點早於需求終點',
    'dataset-end-missing': '快取缺少終點資訊',
    'dataset-start-missing': '快取缺少起點資訊'
};

const batchDebugEventTimeFormatter = (() => {
    try {
        return new Intl.DateTimeFormat('zh-TW', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (error) {
        console.warn('[Batch Debug] Intl DateTimeFormat unavailable:', error);
        return null;
    }
})();

const batchDebugNumberFormatter = new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 4
});

function formatBatchDebugPhaseLabel(phase) {
    if (!phase) {
        return '';
    }
    if (typeof phase !== 'string') {
        return String(phase);
    }
    const trimmed = phase.trim();
    if (!trimmed) {
        return '';
    }
    const key = trimmed.toLowerCase();
    const localized = Object.prototype.hasOwnProperty.call(BATCH_DEBUG_PHASE_LABELS, key)
        ? BATCH_DEBUG_PHASE_LABELS[key]
        : null;
    if (!localized) {
        return trimmed;
    }
    return localized.includes(trimmed) ? localized : `${localized}（${trimmed}）`;
}

function formatBatchDebugEventName(label) {
    if (label === null || label === undefined) {
        return '批量優化事件';
    }
    const raw = typeof label === 'string' ? label.trim() : String(label);
    if (!raw) {
        return '批量優化事件';
    }
    const lower = raw.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(BATCH_DEBUG_EVENT_NAME_MAP, raw)) {
        return BATCH_DEBUG_EVENT_NAME_MAP[raw];
    }
    if (Object.prototype.hasOwnProperty.call(BATCH_DEBUG_EVENT_NAME_MAP, lower)) {
        return BATCH_DEBUG_EVENT_NAME_MAP[lower];
    }
    return raw;
}

function formatBatchDebugEventTimeLabel(value) {
    const date = parseBatchDebugTime(value);
    if (!date) {
        return value ? String(value) : '';
    }
    if (batchDebugEventTimeFormatter) {
        try {
            return batchDebugEventTimeFormatter.format(date);
        } catch (error) {
            // ignore and fall back to manual formatting
        }
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${m}/${d} ${hh}:${mm}:${ss}`;
}

function formatBatchDebugDateValue(value) {
    if (value === null || value === undefined) {
        return '—';
    }
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) {
            return '—';
        }
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (value > 1e12) {
            const date = new Date(value);
            return formatBatchDebugDateValue(date);
        }
        if (value > 1e5) {
            const text = String(Math.trunc(value));
            if (text.length === 8) {
                return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
            }
        }
        const date = new Date(value * 1000);
        if (Number.isFinite(date.getTime())) {
            return formatBatchDebugDateValue(date);
        }
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return '—';
        }
        if (/^\d{8}$/.test(trimmed)) {
            return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
        }
        const parsed = parseBatchDebugTime(trimmed);
        if (parsed) {
            return formatBatchDebugDateValue(parsed);
        }
        return trimmed;
    }
    return String(value);
}

function formatBatchDebugRangeText(range) {
    if (!range || typeof range !== 'object') {
        return '—';
    }
    const start = range.startDate || range.dataStartDate || range.effectiveStartDate || range.from || null;
    const end = range.endDate || range.to || null;
    const startText = formatBatchDebugDateValue(start);
    const endText = formatBatchDebugDateValue(end);
    if ((!startText || startText === '—') && (!endText || endText === '—')) {
        return '—';
    }
    if (!start || startText === '—') {
        return endText;
    }
    if (!end || endText === '—') {
        return startText;
    }
    return `${startText} → ${endText}`;
}

function formatBatchDebugSummaryText(summary) {
    if (!summary || typeof summary !== 'object') {
        return '—';
    }
    const range = formatBatchDebugRangeText(summary);
    const lengthLabel = Number.isFinite(summary.length)
        ? `${formatBatchDebugNumber(summary.length)} 筆`
        : null;
    if (lengthLabel && range && range !== '—') {
        return `${range}｜${lengthLabel}`;
    }
    if (range && range !== '—') {
        return range;
    }
    if (lengthLabel) {
        return lengthLabel;
    }
    return '—';
}

function formatBatchDebugNumber(value, options = {}) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (options.percentage) {
            const decimals = Number.isFinite(options.decimals) ? options.decimals : 2;
            return `${(value * 100).toFixed(decimals)}%`;
        }
        if (Number.isFinite(options.decimals)) {
            return value.toFixed(options.decimals);
        }
        return batchDebugNumberFormatter.format(value);
    }
    if (typeof value === 'string') {
        return value;
    }
    return String(value);
}

function formatBatchDebugCoverageText(coverage) {
    if (!coverage || typeof coverage !== 'object') {
        return '—';
    }
    if (coverage.coverageSatisfied) {
        return '覆蓋符合需求';
    }
    const reasonText = typeof coverage.reason === 'string' ? coverage.reason : '';
    const reasons = reasonText ? reasonText.split('|') : [];
    if (reasons.length === 0) {
        return '覆蓋不足';
    }
    const mapped = reasons.map((code) => {
        const key = code.trim();
        if (!key) return null;
        if (Object.prototype.hasOwnProperty.call(BATCH_DEBUG_COVERAGE_REASON_LABELS, key)) {
            return BATCH_DEBUG_COVERAGE_REASON_LABELS[key];
        }
        return key;
    }).filter(Boolean);
    const text = mapped.length > 0 ? mapped.join('、') : reasons.join('、');
    return `覆蓋不足：${text}`;
}

function formatBatchDebugSourceLabel(source) {
    if (source === null || source === undefined) {
        return '—';
    }
    const raw = String(source).trim();
    if (!raw) {
        return '—';
    }
    const lower = raw.toLowerCase();
    const mapped = Object.prototype.hasOwnProperty.call(BATCH_DEBUG_SOURCE_LABELS, lower)
        ? BATCH_DEBUG_SOURCE_LABELS[lower]
        : Object.prototype.hasOwnProperty.call(BATCH_DEBUG_SOURCE_LABELS, raw)
            ? BATCH_DEBUG_SOURCE_LABELS[raw]
            : null;
    if (!mapped) {
        return raw;
    }
    return mapped.includes(raw) ? mapped : `${mapped}（${raw}）`;
}

function formatBatchDebugPriceModeLabel(mode) {
    if (!mode) {
        return '—';
    }
    const raw = String(mode).trim();
    const lower = raw.toLowerCase();
    const mapped = Object.prototype.hasOwnProperty.call(BATCH_DEBUG_PRICE_MODE_LABELS, lower)
        ? BATCH_DEBUG_PRICE_MODE_LABELS[lower]
        : Object.prototype.hasOwnProperty.call(BATCH_DEBUG_PRICE_MODE_LABELS, raw)
            ? BATCH_DEBUG_PRICE_MODE_LABELS[raw]
            : null;
    if (!mapped) {
        return raw;
    }
    return mapped.includes(raw) ? mapped : `${mapped}（${raw}）`;
}

function formatBatchDebugMarketLabel(market) {
    if (!market) {
        return '—';
    }
    const raw = String(market).trim();
    const upper = raw.toUpperCase();
    const mapped = Object.prototype.hasOwnProperty.call(BATCH_DEBUG_MARKET_LABELS, upper)
        ? BATCH_DEBUG_MARKET_LABELS[upper]
        : Object.prototype.hasOwnProperty.call(BATCH_DEBUG_MARKET_LABELS, raw)
            ? BATCH_DEBUG_MARKET_LABELS[raw]
            : null;
    if (!mapped) {
        return raw;
    }
    return mapped.includes(raw) ? mapped : `${mapped}（${upper}）`;
}

function formatBatchDebugTradeTimingLabel(value) {
    if (!value) {
        return '—';
    }
    const raw = String(value).trim();
    const lower = raw.toLowerCase();
    const mapped = Object.prototype.hasOwnProperty.call(BATCH_DEBUG_TRADE_TIMING_LABELS, lower)
        ? BATCH_DEBUG_TRADE_TIMING_LABELS[lower]
        : Object.prototype.hasOwnProperty.call(BATCH_DEBUG_TRADE_TIMING_LABELS, raw)
            ? BATCH_DEBUG_TRADE_TIMING_LABELS[raw]
            : null;
    if (!mapped) {
        return raw;
    }
    return mapped.includes(raw) ? mapped : `${mapped}（${raw}）`;
}

function formatBatchDebugScene(detail, event) {
    if (detail && typeof detail === 'object') {
        if (detail.scene) return String(detail.scene);
        if (detail.context) return String(detail.context);
    }
    if (event && event.phase) {
        return formatBatchDebugPhaseLabel(event.phase) || String(event.phase);
    }
    return '批量流程';
}

function extractCombinationDetail(detail) {
    if (!detail || typeof detail !== 'object') {
        return null;
    }
    if (detail.combination && typeof detail.combination === 'object') {
        return detail.combination;
    }
    if (detail.result && typeof detail.result === 'object') {
        return detail.result;
    }
    return null;
}

function formatBatchDebugCombinationHeadline(detail) {
    const combination = extractCombinationDetail(detail);
    if (!combination) {
        return '';
    }
    const buy = combination.buyStrategy || combination.entryStrategy || '—';
    const sell = combination.sellStrategy || combination.exitStrategy || '';
    let base = sell ? `${buy} → ${sell}` : buy;
    if (combination.metricLabel && typeof combination.metric === 'number') {
        base = `${base}｜${combination.metricLabel}=${formatBatchDebugNumber(combination.metric)}`;
    } else if (typeof combination.metric === 'number') {
        base = `${base}｜指標=${formatBatchDebugNumber(combination.metric)}`;
    }
    return base;
}

function formatBatchDebugParamPairs(params) {
    if (!params || typeof params !== 'object') {
        return '';
    }
    const entries = Object.entries(params)
        .filter(([key]) => typeof key === 'string')
        .map(([key, value]) => {
            if (value === null || value === undefined) {
                return `${key}=—`;
            }
            if (typeof value === 'number' && Number.isFinite(value)) {
                return `${key}=${formatBatchDebugNumber(value)}`;
            }
            if (typeof value === 'boolean') {
                return `${key}=${value ? '是' : '否'}`;
            }
            return `${key}=${value}`;
        });
    return entries.join('、');
}

function formatBatchDebugCombinationParams(detail) {
    const combination = extractCombinationDetail(detail);
    if (!combination) {
        return '';
    }
    const parts = [];
    if (combination.buyParams) {
        const text = formatBatchDebugParamPairs(combination.buyParams);
        if (text) parts.push(`買入：${text}`);
    }
    if (combination.sellParams) {
        const text = formatBatchDebugParamPairs(combination.sellParams);
        if (text) parts.push(`出場：${text}`);
    }
    return parts.join('｜');
}

function formatBatchDebugRiskSummary(detail) {
    const combination = extractCombinationDetail(detail);
    if (!combination || !combination.riskManagement) {
        return '';
    }
    const parts = Object.entries(combination.riskManagement)
        .filter(([key]) => typeof key === 'string')
        .map(([key, value]) => `${key}=${formatBatchDebugNumber(value)}`);
    return parts.length > 0 ? parts.join('、') : '';
}

function formatBatchDebugSliceBreakdown(breakdown) {
    if (!breakdown || typeof breakdown !== 'object') {
        return '';
    }
    const parts = [];
    if (Number.isFinite(breakdown.beforeStart) && breakdown.beforeStart > 0) {
        parts.push(`起點之前 ${formatBatchDebugNumber(breakdown.beforeStart)} 筆`);
    }
    if (Number.isFinite(breakdown.afterEnd) && breakdown.afterEnd > 0) {
        parts.push(`終點之後 ${formatBatchDebugNumber(breakdown.afterEnd)} 筆`);
    }
    if (Number.isFinite(breakdown.undetermined) && breakdown.undetermined > 0) {
        parts.push(`未判定 ${formatBatchDebugNumber(breakdown.undetermined)} 筆`);
    }
    return parts.join('、');
}

function buildBatchDebugRow(label, value, options = {}) {
    if (!label) {
        return null;
    }
    if (value === null || value === undefined || value === '') {
        return null;
    }
    return {
        key: options.key || label,
        label,
        value,
        allowHtml: Boolean(options.allowHtml)
    };
}

function normalizeBatchDebugRow(row) {
    if (!row || typeof row !== 'object') {
        return null;
    }
    const label = row.label ? String(row.label) : '';
    if (!label) {
        return null;
    }
    const rawValue = row.value;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return null;
    }
    const value = row.allowHtml ? String(rawValue) : String(rawValue);
    if (!value) {
        return null;
    }
    return {
        key: row.key || label,
        label,
        value,
        allowHtml: Boolean(row.allowHtml)
    };
}

function buildDefaultBatchDebugPresentation(event) {
    const detail = event?.detail && typeof event.detail === 'object' ? event.detail : null;
    const rows = [];
    if (detail) {
        Object.entries(detail).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                return;
            }
            if (typeof value === 'object') {
                return;
            }
            rows.push(buildBatchDebugRow(key, value, { key }));
        });
    }
    return {
        category: formatBatchDebugEventName(event?.label),
        highlight: '',
        rows,
        showDetailJson: true
    };
}

const BATCH_DEBUG_EVENT_TEMPLATES = {
    'cached-data-evaluation': (event, detail) => {
        const highlight = detail.useCachedData ? '沿用快取' : '重新抓取資料';
        const decisionCode = detail.decision
            || (detail.useCachedData ? 'globalCacheReusable' : 'fetchFreshData');
        const sliceSummary = detail.sliceSummary || null;
        const summaryRangeText = formatBatchDebugRangeText(sliceSummary || detail.summary);
        const datasetLength = Number.isFinite(sliceSummary?.length)
            ? sliceSummary.length
            : detail.datasetLength;
        const rows = [
            buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' }),
            buildBatchDebugRow('決策', decisionCode, { key: 'decision' }),
            buildBatchDebugRow('狀態', highlight, { key: 'status' }),
            buildBatchDebugRow('覆蓋檢查', formatBatchDebugCoverageText(detail.coverage), { key: 'coverage' }),
            buildBatchDebugRow('來源', formatBatchDebugSourceLabel(detail.source), { key: 'source' }),
            buildBatchDebugRow('需求區間', formatBatchDebugRangeText(detail.requiredRange), { key: 'requiredRange' }),
            buildBatchDebugRow('資料筆數', formatBatchDebugNumber(datasetLength), { key: 'datasetLength' }),
            buildBatchDebugRow('資料範圍', summaryRangeText, { key: 'summaryRange' })
        ];
        if (detail.summary && sliceSummary) {
            rows.push(buildBatchDebugRow('原範圍', formatBatchDebugRangeText(detail.summary), { key: 'summary' }));
            rows.push(buildBatchDebugRow('裁切後', formatBatchDebugRangeText(sliceSummary), { key: 'sliceSummary' }));
        }
        const extraMessages = [];
        if (detail.sliceRemovedCount > 0) {
            extraMessages.push(`快取資料已依需求區間裁切（移除 ${formatBatchDebugNumber(detail.sliceRemovedCount)} 筆）`);
        }
        if (detail.sliceRemovedBreakdown) {
            const breakdown = formatBatchDebugSliceBreakdown(detail.sliceRemovedBreakdown);
            if (breakdown) {
                extraMessages.push(`裁切明細：${breakdown}`);
            }
        }
        if (detail.overrideProvided) {
            rows.push(buildBatchDebugRow('覆寫資料', detail.overrideProvided ? '已提供' : '未提供', { key: 'overrideProvided' }));
        }
        const extra = extraMessages.length > 0 ? extraMessages.join('\n') : '';
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight,
            rows,
            extra,
            showDetailJson: false
        };
    },
    'cached-data-slice-applied': (event, detail) => {
        const removed = Number.isFinite(detail.removedCount) ? detail.removedCount : 0;
        const highlight = removed > 0
            ? `裁切 ${formatBatchDebugNumber(removed)} 筆`
            : '無需裁切資料';
        const rows = [
            buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' }),
            buildBatchDebugRow('資料來源', formatBatchDebugSourceLabel(detail.source), { key: 'source' }),
            buildBatchDebugRow('裁切前', formatBatchDebugSummaryText(detail.summaryBefore), { key: 'summaryBefore' }),
            buildBatchDebugRow('裁切後', formatBatchDebugSummaryText(detail.summaryAfter), { key: 'summaryAfter' }),
            buildBatchDebugRow('需求區間', formatBatchDebugRangeText(detail.requiredRange), { key: 'requiredRange' })
        ];
        const breakdown = formatBatchDebugSliceBreakdown(detail.removedBreakdown);
        if (breakdown) {
            rows.push(buildBatchDebugRow('移除統計', breakdown, { key: 'sliceBreakdown' }));
        }
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight,
            rows,
            showDetailJson: false
        };
    },
    'cached-data-coverage-mismatch': (event, detail) => {
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight: '覆蓋不足，改以重新抓取資料',
            rows: [
                buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' }),
                buildBatchDebugRow('資料來源', formatBatchDebugSourceLabel(detail.source), { key: 'source' }),
                buildBatchDebugRow('需求區間', formatBatchDebugRangeText(detail.requiredRange), { key: 'requiredRange' }),
                buildBatchDebugRow('現有範圍', formatBatchDebugSummaryText(detail.summary), { key: 'summary' }),
                buildBatchDebugRow('覆蓋檢查', formatBatchDebugCoverageText(detail.coverage), { key: 'coverage' })
            ],
            showDetailJson: false
        };
    },
    'worker-run-start': (event, detail) => {
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight: detail.useCachedData ? '使用快取執行回測' : '重新載入資料執行回測',
            rows: [
                buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' }),
                buildBatchDebugRow('資料來源', formatBatchDebugSourceLabel(detail.cachedSource || detail.source), { key: 'source' }),
                buildBatchDebugRow('沿用快取', detail.useCachedData ? '是' : '否', { key: 'useCachedData' }),
                buildBatchDebugRow('快取筆數', formatBatchDebugNumber(detail.datasetLength), { key: 'datasetLength' }),
                buildBatchDebugRow('裁切後筆數', formatBatchDebugNumber(detail.sliceLength), { key: 'sliceLength' })
            ],
            showDetailJson: false
        };
    },
    'worker-run-result': (event, detail) => {
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight: '回測工作完成',
            rows: [
                buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' }),
                buildBatchDebugRow('沿用快取', detail.usedCachedData ? '是' : '否', { key: 'usedCachedData' }),
                buildBatchDebugRow('年化報酬', detail.result?.annualizedReturn !== undefined ? formatBatchDebugNumber(detail.result.annualizedReturn) : '', { key: 'annualizedReturn' }),
                buildBatchDebugRow('最大回撤', detail.result?.maxDrawdown !== undefined ? formatBatchDebugNumber(detail.result.maxDrawdown) : '', { key: 'maxDrawdown' }),
                buildBatchDebugRow('交易次數', detail.result?.tradeCount !== undefined ? formatBatchDebugNumber(detail.result.tradeCount) : '', { key: 'tradeCount' })
            ],
            showDetailJson: false
        };
    },
    'worker-run-error': (event, detail) => {
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight: detail.message ? `錯誤：${detail.message}` : '回測工作發生錯誤',
            rows: [
                buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' }),
                buildBatchDebugRow('資料來源', formatBatchDebugSourceLabel(detail.cachedSource || detail.source), { key: 'source' })
            ],
            showDetailJson: true
        };
    },
    'worker-run-timeout': (event, detail) => {
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight: detail.message || '回測工作逾時',
            rows: [
                buildBatchDebugRow('場景', formatBatchDebugScene(detail, event), { key: 'scene' })
            ],
            showDetailJson: true
        };
    },
    'param-optimization-complete': (event, detail) => {
        return {
            category: formatBatchDebugEventName(event?.label),
            highlight: '參數優化完成',
            rows: [
                buildBatchDebugRow('策略類型', detail.strategyType, { key: 'strategyType' }),
                buildBatchDebugRow('優化目標', detail.optimizeTarget, { key: 'optimizeTarget' }),
                buildBatchDebugRow('指標', detail.targetMetric, { key: 'targetMetric' }),
                buildBatchDebugRow('選定數值', formatBatchDebugNumber(detail.selectedValue), { key: 'selectedValue' }),
                buildBatchDebugRow('指標數值', formatBatchDebugNumber(detail.metric), { key: 'metric' })
            ],
            showDetailJson: false
        };
    }
};

function normalizeBatchDebugPresentation(presentation, event, detail) {
    const normalized = {
        category: presentation.category || formatBatchDebugEventName(event?.label),
        highlight: presentation.highlight ? String(presentation.highlight) : '',
        rows: Array.isArray(presentation.rows) ? presentation.rows.map(normalizeBatchDebugRow).filter(Boolean) : [],
        showDetailJson: presentation.showDetailJson === true,
        extra: presentation.extra ? String(presentation.extra) : ''
    };

    const usedKeys = new Set(normalized.rows.map((row) => row.key));

    const combinationHeadline = formatBatchDebugCombinationHeadline(detail);
    if (combinationHeadline && !usedKeys.has('combination')) {
        const row = normalizeBatchDebugRow({ key: 'combination', label: '策略', value: combinationHeadline });
        if (row) {
            normalized.rows.unshift(row);
            usedKeys.add(row.key);
        }
        const paramsText = formatBatchDebugCombinationParams(detail);
        if (paramsText && !usedKeys.has('combinationParams')) {
            const paramRow = normalizeBatchDebugRow({ key: 'combinationParams', label: '參數', value: paramsText });
            if (paramRow) {
                normalized.rows.splice(1, 0, paramRow);
                usedKeys.add(paramRow.key);
            }
        }
        const riskText = formatBatchDebugRiskSummary(detail);
        if (riskText && !usedKeys.has('riskManagement')) {
            const riskRow = normalizeBatchDebugRow({ key: 'riskManagement', label: '風險管理', value: riskText });
            if (riskRow) {
                normalized.rows.push(riskRow);
                usedKeys.add(riskRow.key);
            }
        }
    }

    const includeRequestRange = !usedKeys.has('requiredRange');
    const datasetRows = [
        buildBatchDebugRow('標的代碼', detail?.stockNo, { key: 'stockNo' }),
        buildBatchDebugRow('市場', formatBatchDebugMarketLabel(detail?.market), { key: 'market' }),
        buildBatchDebugRow('價格模式', formatBatchDebugPriceModeLabel(detail?.priceMode), { key: 'priceMode' }),
        buildBatchDebugRow('交易時點', formatBatchDebugTradeTimingLabel(detail?.tradeTiming), { key: 'tradeTiming' }),
        includeRequestRange
            ? buildBatchDebugRow('請求區間', formatBatchDebugRangeText({ startDate: detail?.requestStartDate, endDate: detail?.requestEndDate }), { key: 'requestRange' })
            : null
    ].filter(Boolean);

    datasetRows.forEach((row) => {
        const normalizedRow = normalizeBatchDebugRow(row);
        if (normalizedRow && normalizedRow.value !== '—' && !usedKeys.has(normalizedRow.key)) {
            normalized.rows.push(normalizedRow);
            usedKeys.add(normalizedRow.key);
        }
    });

    return normalized;
}

function buildBatchDebugEventPresentation(event) {
    if (!event || typeof event !== 'object') {
        return buildDefaultBatchDebugPresentation(event);
    }
    const detail = event.detail && typeof event.detail === 'object' ? event.detail : {};
    const label = typeof event.label === 'string' ? event.label : '';
    const builder = Object.prototype.hasOwnProperty.call(BATCH_DEBUG_EVENT_TEMPLATES, label)
        ? BATCH_DEBUG_EVENT_TEMPLATES[label]
        : (label && Object.prototype.hasOwnProperty.call(BATCH_DEBUG_EVENT_TEMPLATES, label.toLowerCase())
            ? BATCH_DEBUG_EVENT_TEMPLATES[label.toLowerCase()]
            : null);

    let presentation = null;
    if (typeof builder === 'function') {
        try {
            presentation = builder(event, detail);
        } catch (error) {
            console.error('[Batch Debug] Failed to build presentation:', label, error);
        }
    }
    if (!presentation) {
        presentation = buildDefaultBatchDebugPresentation(event);
    }
    const normalized = normalizeBatchDebugPresentation(presentation, event, detail);
    normalized.detail = detail;
    return normalized;
}

function renderBatchDebugEvent(event) {
    const presentation = buildBatchDebugEventPresentation(event);
    const levelMeta = resolveBatchDebugLevelMeta(event?.level);
    const timeLabel = formatBatchDebugEventTimeLabel(event?.iso || event?.ts || Date.now());
    const phaseLabel = formatBatchDebugPhaseLabel(event?.phase);
    const badges = [];
    if (levelMeta.english) {
        badges.push(`<span class="inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-semibold tracking-wide uppercase" style="color: ${levelMeta.color}; border-color: ${levelMeta.color};">${testerEscapeHtml(levelMeta.english)}</span>`);
    }
    if (levelMeta.label && levelMeta.label !== levelMeta.english) {
        badges.push(`<span class="text-[10px] font-medium" style="color: ${levelMeta.color};">${testerEscapeHtml(levelMeta.label)}</span>`);
    }
    if (phaseLabel) {
        badges.push(`<span class="inline-flex items-center rounded-full border border-dashed px-2 py-[1px] text-[10px]" style="color: var(--muted-foreground); border-color: rgba(148, 163, 184, 0.45); background-color: rgba(148, 163, 184, 0.12);">${testerEscapeHtml(phaseLabel)}</span>`);
    }

    const rowsHtml = presentation.rows.map((row) => {
        const valueHtml = row.allowHtml ? row.value : testerEscapeHtml(String(row.value));
        return `<div class="text-[12px] leading-[20px]"><span class="text-[12px]" style="color: var(--muted-foreground);">${testerEscapeHtml(row.label)}：</span><span class="font-medium" style="color: var(--foreground);">${valueHtml}</span></div>`;
    }).join('');

    const highlightHtml = presentation.highlight
        ? `<div class="text-[12px] font-semibold" style="color: ${levelMeta.color};">${testerEscapeHtml(presentation.highlight)}</div>`
        : '';

    const extraHtml = presentation.extra
        ? `<div class="rounded-md border px-3 py-2 text-[11px] leading-[18px]" style="border-color: ${levelMeta.border}; color: ${levelMeta.color}; background-color: ${levelMeta.background};">${testerEscapeHtml(presentation.extra).replace(/\n/g, '<br />')}</div>`
        : '';

    let detailJsonHtml = '';
    if (presentation.showDetailJson && presentation.detail && Object.keys(presentation.detail).length > 0) {
        detailJsonHtml = `<pre class="text-[10px] leading-relaxed whitespace-pre-wrap break-all rounded-md border px-3 py-2" style="background-color: rgba(15, 23, 42, 0.04); border-color: var(--border); color: var(--muted-foreground);">${testerEscapeHtml(JSON.stringify(presentation.detail, null, 2))}</pre>`;
    }

    return `
        <div class="space-y-2 rounded-lg border px-4 py-3" style="background-color: rgba(248, 250, 252, 0.88); border-color: ${levelMeta.border};">
            <div class="text-[13px] font-semibold" style="color: var(--foreground);">${testerEscapeHtml(presentation.category)}</div>
            ${badges.length > 0 ? `<div class="flex flex-wrap items-center gap-2">${badges.join('')}</div>` : ''}
            ${highlightHtml}
            <div class="text-[11px]" style="color: var(--muted-foreground);">${testerEscapeHtml(timeLabel)}</div>
            ${rowsHtml ? `<div class="space-y-1">${rowsHtml}</div>` : ''}
            ${extraHtml}
            ${detailJsonHtml}
        </div>
    `;
}

function initBatchDebugLogPanel() {
    const container = document.getElementById('batchDebugLogContainer');
    if (!container) return;

    const metaEl = document.getElementById('batchDebugSessionMeta');
    const listEl = document.getElementById('batchDebugEventList');
    const emptyEl = document.getElementById('batchDebugEmptyHint');
    const refreshBtn = document.getElementById('batchDebugRefreshBtn');
    const downloadBtn = document.getElementById('batchDebugDownloadBtn');
    const clearBtn = document.getElementById('batchDebugClearBtn');
    const markFirstBtn = document.getElementById('batchDebugMarkFirstBtn');
    const markSecondBtn = document.getElementById('batchDebugMarkSecondBtn');
    const compareBtn = document.getElementById('batchDebugCompareBtn');
    const copyBtn = document.getElementById('batchDebugCopyBtn');
    const compareOutput = document.getElementById('batchDebugCompareOutput');
    const compareStatus = document.getElementById('batchDebugCompareStatus');

    let comparisonSnapshotA = null;
    let comparisonSnapshotB = null;
    let latestComparisonText = '';

    const describeSnapshot = (snapshot) => {
        if (!snapshot) return '尚未設定';
        if (window.batchOptimization && typeof window.batchOptimization.formatDebugSnapshotLabel === 'function') {
            try {
                const label = window.batchOptimization.formatDebugSnapshotLabel(snapshot);
                if (label) return label;
            } catch (error) {
                console.warn('[Batch Debug] Failed to format snapshot label:', error);
            }
        }
        const eventCount = Array.isArray(snapshot.events) ? snapshot.events.length : 0;
        const id = snapshot.sessionId ? `#${snapshot.sessionId}` : '紀錄';
        return `${id}｜事件 ${eventCount}`;
    };

    const updateCompareStatus = (message = null) => {
        if (!compareStatus) return;
        if (message) {
            compareStatus.textContent = message;
            compareStatus.style.color = 'var(--foreground)';
        } else {
            const parts = [
                `A：${describeSnapshot(comparisonSnapshotA)}`,
                `B：${describeSnapshot(comparisonSnapshotB)}`
            ];
            compareStatus.textContent = parts.join(' ｜ ');
            compareStatus.style.color = 'var(--muted-foreground)';
        }

        if (copyBtn) {
            copyBtn.disabled = !latestComparisonText;
            copyBtn.style.color = latestComparisonText ? 'var(--foreground)' : 'var(--muted-foreground)';
        }
    };

    if (compareOutput) {
        compareOutput.value = '';
    }
    updateCompareStatus();

    const applySnapshot = (snapshot) => {
        if (!metaEl || !listEl || !emptyEl) return;

        if (!snapshot) {
            metaEl.innerHTML = '<div class="text-[11px]" style="color: var(--muted-foreground);">尚未啟動批量優化除錯。</div>';
            listEl.innerHTML = '';
            listEl.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            emptyEl.textContent = '暫無批量優化事件，請先啟動批量優化或滾動測試。';
            return;
        }

        const sessionTitleParts = [];
        if (snapshot.sessionId) sessionTitleParts.push(`會話 #${snapshot.sessionId}`);
        if (snapshot.version) sessionTitleParts.push(`版本 ${snapshot.version}`);
        const sessionTitle = sessionTitleParts.join(' ｜ ') || '批量優化除錯會話';

        const statusBadges = [];
        if (snapshot.outcome?.status) statusBadges.push(`狀態：${snapshot.outcome.status}`);
        if (Array.isArray(snapshot.events)) statusBadges.push(`事件：${snapshot.events.length} 筆`);
        if (snapshot.outcome?.message) statusBadges.push(`說明：${snapshot.outcome.message}`);

        const timeBadges = [];
        if (snapshot.startedAtIso) {
            timeBadges.push(`開始：${formatBatchDebugTime(snapshot.startedAtIso)}`);
        }
        if (snapshot.completedAtIso) {
            timeBadges.push(`結束：${formatBatchDebugTime(snapshot.completedAtIso)}`);
        }
        const durationLabel = formatBatchDebugDuration(snapshot.startedAtIso, snapshot.completedAtIso);
        if (durationLabel) {
            timeBadges.push(`耗時：${durationLabel}`);
        }

        const buildBadges = (items) => items.map((text) => (
            `<span class="inline-flex items-center rounded-full border px-2 py-[2px] text-[10px]" style="border-color: var(--border); color: var(--foreground); background-color: rgba(255, 255, 255, 0.75);">${testerEscapeHtml(text)}</span>`
        )).join('<span class="sr-only"> </span>');

        const lines = [
            `<div class="text-[11px] font-semibold" style="color: var(--foreground);">${testerEscapeHtml(sessionTitle)}</div>`,
        ];
        if (statusBadges.length > 0) {
            lines.push(`<div class="flex flex-wrap gap-2">${buildBadges(statusBadges)}</div>`);
        }
        if (timeBadges.length > 0) {
            lines.push(`<div class="flex flex-wrap gap-2">${buildBadges(timeBadges)}</div>`);
        }

        metaEl.innerHTML = lines.join('');

        const events = Array.isArray(snapshot.events)
            ? snapshot.events.slice(Math.max(snapshot.events.length - 50, 0))
            : [];

        listEl.innerHTML = '';
        if (events.length === 0) {
            listEl.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            emptyEl.textContent = '暫無批量優化事件，請先執行批量優化或滾動測試。';
        } else {
            emptyEl.classList.add('hidden');
            listEl.classList.remove('hidden');

            events.forEach((event) => {
                const li = document.createElement('li');
                li.className = 'border rounded-lg px-3 py-3 bg-white/80 shadow-sm';
                li.style.borderColor = 'var(--border)';

                let content = '';
                try {
                    content = renderBatchDebugEvent(event);
                } catch (error) {
                    console.error('[Batch Debug] Failed to render event:', event?.label, error);
                    const fallbackDetail = event && event.detail ? testerEscapeHtml(JSON.stringify(event.detail, null, 2)) : '—';
                    content = `
                        <div class="space-y-2">
                            <div class="text-[12px] font-semibold" style="color: var(--foreground);">${testerEscapeHtml(event?.label || '事件')}</div>
                            <div class="text-[10px]" style="color: var(--muted-foreground);">${testerEscapeHtml(formatBatchDebugTime(event?.iso || event?.ts) || '—')}</div>
                            <div class="text-[10px]" style="color: var(--muted-foreground);">${testerEscapeHtml(event?.message || '渲染失敗')}</div>
                            <pre class="text-[10px] leading-relaxed whitespace-pre-wrap break-all rounded-md border px-3 py-2" style="background-color: rgba(15, 23, 42, 0.04); border-color: var(--border); color: var(--muted-foreground);">${fallbackDetail}</pre>
                        </div>
                    `;
                }

                li.innerHTML = content;
                listEl.appendChild(li);
            });
        }
    };

    const getSnapshot = () => {
        if (window.batchOptimization && typeof window.batchOptimization.getDebugLog === 'function') {
            return window.batchOptimization.getDebugLog();
        }
        return null;
    };

    const ensureSubscription = () => {
        if (!window.batchOptimization || typeof window.batchOptimization.subscribeDebugLog !== 'function') {
            return false;
        }
        if (typeof batchDebugLogUnsubscribe === 'function') {
            batchDebugLogUnsubscribe();
            batchDebugLogUnsubscribe = null;
        }
        batchDebugLogUnsubscribe = window.batchOptimization.subscribeDebugLog((snapshot) => {
            applySnapshot(snapshot);
        });
        applySnapshot(getSnapshot());
        return true;
    };

    const attemptSubscription = (retry = 0) => {
        if (ensureSubscription()) {
            return;
        }
        if (retry < 5) {
            setTimeout(() => attemptSubscription(retry + 1), 300 * (retry + 1));
        }
    };

    refreshBtn?.addEventListener('click', () => {
        applySnapshot(getSnapshot());
    });

    downloadBtn?.addEventListener('click', () => {
        if (window.batchOptimization && typeof window.batchOptimization.downloadDebugLog === 'function') {
            window.batchOptimization.downloadDebugLog('batch-optimization-debug');
        }
    });

    clearBtn?.addEventListener('click', () => {
        if (window.batchOptimization && typeof window.batchOptimization.clearDebugLog === 'function') {
            window.batchOptimization.clearDebugLog();
        }
    });

    markFirstBtn?.addEventListener('click', () => {
        comparisonSnapshotA = getSnapshot();
        updateCompareStatus();
    });

    markSecondBtn?.addEventListener('click', () => {
        comparisonSnapshotB = getSnapshot();
        updateCompareStatus();
    });

    compareBtn?.addEventListener('click', () => {
        if (!comparisonSnapshotA || !comparisonSnapshotB) {
            latestComparisonText = '';
            if (compareOutput) {
                compareOutput.value = '請先設定紀錄A與紀錄B後再產生比較。';
            }
            updateCompareStatus('請先設定紀錄A與紀錄B。');
            return;
        }

        if (window.batchOptimization && typeof window.batchOptimization.diffDebugLogs === 'function') {
            try {
                const diff = window.batchOptimization.diffDebugLogs(comparisonSnapshotA, comparisonSnapshotB) || {};
                latestComparisonText = diff.text || '';
            } catch (error) {
                console.error('[Batch Debug] Failed to diff logs:', error);
                latestComparisonText = '';
            }
        } else {
            latestComparisonText = '';
        }

        if (compareOutput) {
            compareOutput.value = latestComparisonText || '（比較結果為空）';
        }
        updateCompareStatus();
    });

    copyBtn?.addEventListener('click', async () => {
        if (!latestComparisonText) {
            return;
        }
        try {
            await navigator.clipboard.writeText(latestComparisonText);
            updateCompareStatus('已複製比較結果到剪貼簿。');
            setTimeout(() => updateCompareStatus(), 2500);
        } catch (error) {
            console.error('[Batch Debug] Failed to copy diff:', error);
            updateCompareStatus('複製失敗，請手動選取文字。');
            setTimeout(() => updateCompareStatus(), 2500);
        }
    });

    applySnapshot(getSnapshot());
    attemptSubscription();
}

function initDeveloperAreaToggle() {
    const toggleBtn = document.getElementById('developerAreaToggle');
    const wrapper = document.getElementById('developerAreaWrapper');
    if (!toggleBtn || !wrapper) return;

    let expanded = false;

    const applyState = (open) => {
        expanded = Boolean(open);
        wrapper.classList.toggle('hidden', !expanded);
        wrapper.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggleBtn.classList.toggle('developer-toggle-active', expanded);
    };

    applyState(false);

    toggleBtn.addEventListener('click', () => {
        applyState(!expanded);
        if (expanded) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && expanded) {
            applyState(false);
            toggleBtn.focus();
        }
    });
}

function getLoadingTextElement() {
    return document.getElementById('loadingText');
}

function normaliseLoadingMessage(message) {
    if (typeof message !== 'string') return '處理中...';
    return message.replace(/^⌛\s*/, '').trim() || '處理中...';
}

function getLoadingMascotContainer() {
    return document.getElementById('loadingGif');
}

function getLoadingMascotVisibilityState() {
    if (!loadingMascotState.visibility) {
        loadingMascotState.visibility = { hidden: false };
    }
    return loadingMascotState.visibility;
}

function isLoadingMascotHidden() {
    return Boolean(getLoadingMascotVisibilityState().hidden);
}

function setLoadingMascotHiddenFlag(hidden) {
    const visibility = getLoadingMascotVisibilityState();
    visibility.hidden = Boolean(hidden);
}

function handleLoadingMascotToggle(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const sourceButton = event?.currentTarget || event?.target || null;
    const containerEl =
        (sourceButton && sourceButton.closest && sourceButton.closest('.loading-mascot-canvas')) ||
        getLoadingMascotContainer();

    if (!containerEl) return;

    const nextHidden = !isLoadingMascotHidden();
    setLoadingMascotHiddenFlag(nextHidden);
    applyLoadingMascotHiddenState(containerEl, nextHidden);

    if (nextHidden) {
        cancelLoadingMascotRotation();
    } else {
        refreshLoadingMascotImage({ forceNew: true, allowSameWhenSingle: true });
    }
}

function bindLoadingMascotToggle(toggle) {
    if (!toggle || toggle.dataset.lbMascotToggleBound === 'true') {
        return;
    }

    toggle.type = 'button';
    toggle.classList.add('loading-mascot-toggle');
    toggle.dataset.lbMascotToggle = 'true';
    toggle.addEventListener('click', handleLoadingMascotToggle);
    toggle.dataset.lbMascotToggleBound = 'true';
}

function ensureLoadingMascotInfrastructure(container) {
    if (!container) return {};

    let toggle = container.querySelector('[data-lb-mascot-toggle]');
    if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        container.insertBefore(toggle, container.firstChild);
    }

    bindLoadingMascotToggle(toggle);
    toggle.setAttribute('aria-label', '隱藏進度吉祥物圖片');
    toggle.setAttribute('aria-pressed', 'false');
    if (!toggle.textContent || !toggle.textContent.trim()) {
        toggle.textContent = '-';
    }

    let fallback = container.querySelector('[data-lb-mascot-fallback]');
    if (!fallback) {
        fallback = document.createElement('div');
        fallback.className = 'loading-mascot-fallback-visual';
        fallback.textContent = '⌛';
        container.appendChild(fallback);
    }
    fallback.dataset.lbMascotFallback = 'true';
    if (!fallback.hasAttribute('aria-hidden')) {
        fallback.setAttribute('aria-hidden', 'true');
    }

    if (typeof container.dataset.lbMascotMode !== 'string' || !container.dataset.lbMascotMode) {
        container.dataset.lbMascotMode = 'image';
    }

    if (container.dataset.lbMascotHidden === 'true') {
        setLoadingMascotHiddenFlag(true);
    } else if (container.dataset.lbMascotHidden === 'false') {
        setLoadingMascotHiddenFlag(false);
    }

    return { toggle, fallback };
}

function applyLoadingMascotHiddenState(container, hidden) {
    if (!container) return;
    const flag = hidden ? 'true' : 'false';
    container.dataset.lbMascotHidden = flag;
    container.classList.toggle('loading-mascot-collapsed', hidden);

    const toggle = container.querySelector('[data-lb-mascot-toggle]');
    if (toggle) {
        toggle.dataset.state = hidden ? 'hidden' : 'visible';
        toggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
        toggle.setAttribute('aria-label', hidden ? '顯示進度吉祥物圖片' : '隱藏進度吉祥物圖片');
        toggle.textContent = hidden ? '+' : '-';
    }

    const fallback = container.querySelector('[data-lb-mascot-fallback]');
    if (fallback) {
        const fallbackVisible = container.dataset.lbMascotMode === 'fallback' && !hidden;
        fallback.setAttribute('aria-hidden', fallbackVisible ? 'false' : 'true');
    }

    const img = container.querySelector('img.loading-mascot-image');
    if (img) {
        const imageVisible = container.dataset.lbMascotMode !== 'fallback' && !hidden;
        img.setAttribute('aria-hidden', imageVisible ? 'false' : 'true');
    }
}

function computeLoadingMascotSources(container) {
    const externalSources = Array.isArray(window.LAZYBACKTEST_LOADING_MASCOT_SOURCES)
        ? window.LAZYBACKTEST_LOADING_MASCOT_SOURCES
        : [];
    const datasetDefaults = typeof container?.dataset?.lbMascotDefault === 'string'
        ? container.dataset.lbMascotDefault
              .split(',')
              .map((src) => src.trim())
              .filter(Boolean)
        : [];

    const unique = [];
    const seen = new Set();
    for (const raw of [...externalSources, ...datasetDefaults]) {
        if (typeof raw !== 'string') continue;
        const src = raw.trim();
        if (!src || seen.has(src)) continue;
        seen.add(src);
        unique.push(src);
    }

    return unique;
}

function getLoadingMascotRotationState() {
    return loadingMascotState.rotation;
}

function shuffleMascotSources(sources) {
    const list = Array.isArray(sources) ? sources.slice() : [];
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = list[i];
        list[i] = list[j];
        list[j] = temp;
    }
    return list;
}

function cancelLoadingMascotRotation() {
    const rotation = getLoadingMascotRotationState();
    if (!rotation) return;
    if (rotation.timerId) {
        clearTimeout(rotation.timerId);
        rotation.timerId = null;
    }
}

function scheduleLoadingMascotRotation(totalSources) {
    const rotation = getLoadingMascotRotationState();
    if (!rotation) return;
    cancelLoadingMascotRotation();

    rotation.lastTotalSources = Number.isFinite(totalSources) ? totalSources : 0;

    if (isLoadingMascotHidden()) {
        return;
    }

    if (!Number.isFinite(LOADING_MASCOT_ROTATION_INTERVAL) || LOADING_MASCOT_ROTATION_INTERVAL <= 0) {
        return;
    }

    if (rotation.lastTotalSources <= 0) {
        return;
    }

    rotation.timerId = setTimeout(() => {
        rotation.timerId = null;
        refreshLoadingMascotImage({ forceNew: true, allowSameWhenSingle: true });
    }, LOADING_MASCOT_ROTATION_INTERVAL);
}

function handleLoadingMascotDisplayed(source, totalSources) {
    loadingMascotState.lastSource = source || null;
    const rotation = getLoadingMascotRotationState();
    if (rotation) {
        rotation.lastTotalSources = Number.isFinite(totalSources) ? totalSources : 0;
    }
    if (isLoadingMascotHidden()) {
        cancelLoadingMascotRotation();
        return;
    }
    scheduleLoadingMascotRotation(totalSources);
}

function ensureLoadingMascotImageElement(container) {
    if (!container) return null;
    ensureLoadingMascotInfrastructure(container);
    let img = container.querySelector('img.loading-mascot-image');
    if (!img) {
        img = document.createElement('img');
        img.className = 'loading-mascot-image';
        img.alt = 'LazyBacktest 進度吉祥物動畫';
        img.decoding = 'async';
        img.loading = 'eager';
        img.referrerPolicy = 'no-referrer';
        img.setAttribute('aria-hidden', isLoadingMascotHidden() ? 'true' : 'false');
        container.appendChild(img);
    }
    container.classList.remove('loading-mascot-fallback');
    container.dataset.lbMascotMode = 'image';
    const fallback = container.querySelector('[data-lb-mascot-fallback]');
    if (fallback) {
        fallback.setAttribute('aria-hidden', 'true');
    }
    applyLoadingMascotHiddenState(container, isLoadingMascotHidden());
    return img;
}

function showMascotHourglassFallback(container) {
    if (!container) return;
    ensureLoadingMascotInfrastructure(container);
    container.classList.add('loading-mascot-fallback');
    container.dataset.lbMascotSource = 'hourglass';
    container.dataset.lbMascotCurrent = 'hourglass';
    container.dataset.lbMascotMode = 'fallback';
    const fallback = container.querySelector('[data-lb-mascot-fallback]');
    if (fallback) {
        fallback.textContent = '⌛';
        fallback.setAttribute('aria-hidden', isLoadingMascotHidden() ? 'true' : 'false');
    }
    const img = container.querySelector('img.loading-mascot-image');
    if (img) {
        img.setAttribute('aria-hidden', 'true');
        img.removeAttribute('src');
    }
    loadingMascotState.lastSource = null;
    applyLoadingMascotHiddenState(container, isLoadingMascotHidden());
    cancelLoadingMascotRotation();
}

function refreshLoadingMascotImage(options = {}) {
    const container = getLoadingMascotContainer();
    if (!container) {
        cancelLoadingMascotRotation();
        return;
    }

    ensureLoadingMascotInfrastructure(container);

    const hidden = isLoadingMascotHidden();
    applyLoadingMascotHiddenState(container, hidden);

    const sources = computeLoadingMascotSources(container);
    const poolSize = Array.isArray(sources) ? sources.length : 0;
    container.dataset.lbMascotSanitiser = LOADING_MASCOT_VERSION;
    container.dataset.lbMascotPoolSize = String(poolSize);
    container.dataset.lbMascotVersion = LOADING_MASCOT_VERSION;

    cancelLoadingMascotRotation();

    if (!Array.isArray(sources) || poolSize === 0) {
        showMascotHourglassFallback(container);
        return;
    }

    if (hidden) {
        return;
    }

    const forceNew = Boolean(options.forceNew);
    const allowSameWhenSingle = options.allowSameWhenSingle !== false;

    const previous = loadingMascotState.lastSource || container.dataset.lbMascotCurrent || null;
    const rotation = getLoadingMascotRotationState();
    const fingerprint = sources.join('|');

    if (rotation) {
        if (rotation.fingerprint !== fingerprint) {
            rotation.fingerprint = fingerprint;
            rotation.queue = [];
        }
        rotation.lastTotalSources = sources.length;
    }

    const getNextCandidate = (avoidPreviousFirst = false) => {
        if (!rotation) return null;

        let refilled = false;
        if (!Array.isArray(rotation.queue)) {
            rotation.queue = [];
        }

        if (rotation.queue.length === 0) {
            rotation.queue = shuffleMascotSources(sources);
            refilled = true;
        }

        if (rotation.queue.length === 0) {
            return null;
        }

        const shouldAvoidPrevious = Boolean(previous) && rotation.queue.length > 1 && (avoidPreviousFirst || refilled);
        if (shouldAvoidPrevious && rotation.queue[0] === previous) {
            const altIndex = rotation.queue.findIndex((src) => src !== previous);
            if (altIndex > 0) {
                const [replacement] = rotation.queue.splice(altIndex, 1);
                rotation.queue.unshift(replacement);
            }
        }

        if (!allowSameWhenSingle && sources.length === 1 && rotation.queue[0] === previous) {
            return null;
        }

        const candidate = rotation.queue.shift();
        if (!candidate) {
            return null;
        }

        if (!allowSameWhenSingle && sources.length === 1 && candidate === previous) {
            return null;
        }

        return candidate;
    };

    const attemptNext = (avoidPreviousFirst = false) => {
        const candidate = getNextCandidate(avoidPreviousFirst);
        if (!candidate) {
            showMascotHourglassFallback(container);
            return;
        }

        const img = ensureLoadingMascotImageElement(container);
        if (!img) {
            showMascotHourglassFallback(container);
            return;
        }

        const finalize = () => {
            container.classList.remove('loading-mascot-fallback');
            container.dataset.lbMascotSource = candidate;
            container.dataset.lbMascotCurrent = candidate;
            handleLoadingMascotDisplayed(candidate, sources.length);
        };

        if (img.src === candidate && img.complete && img.naturalWidth > 0) {
            finalize();
            return;
        }

        const handleLoad = () => {
            cleanup();
            finalize();
        };

        const handleError = () => {
            cleanup();
            attemptNext(false);
        };

        const cleanup = () => {
            img.removeEventListener('error', handleError);
            img.removeEventListener('load', handleLoad);
        };

        img.addEventListener('error', handleError);
        img.addEventListener('load', handleLoad);

        if (img.src === candidate) {
            img.removeAttribute('src');
            const rerender =
                typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
                    ? window.requestAnimationFrame.bind(window)
                    : (cb) => setTimeout(cb, 16);
            rerender(() => {
                img.src = candidate;
            });
        } else {
            img.src = candidate;
        }
    };

    attemptNext(forceNew);
}

function initLoadingMascotSanitiser() {
    const container = getLoadingMascotContainer();
    if (!container) {
        return;
    }

    refreshLoadingMascotImage({ forceNew: true, allowSameWhenSingle: true });

    if (typeof window === 'object') {
        const bridge = window.lazybacktestMascot || {};
        bridge.refresh = (options) => refreshLoadingMascotImage(options || {});
        bridge.version = LOADING_MASCOT_VERSION;
        bridge.getSources = () => computeLoadingMascotSources(getLoadingMascotContainer());
        window.lazybacktestMascot = bridge;
    }
}

function setLoadingBaseMessage(message) {
    const el = getLoadingTextElement();
    if (!el) return;
    const normalised = normaliseLoadingMessage(message);
    el.dataset.rawMessage = normalised;
}

function renderLoadingMessage(percent) {
    const el = getLoadingTextElement();
    if (!el) return;
    const base = el.dataset.rawMessage || '處理中...';
    if (Number.isFinite(percent)) {
        const safe = Math.max(0, Math.min(100, Math.round(percent)));
        el.textContent = `${base}（${safe}%）`;
    } else {
        el.textContent = base;
    }
}

function scrollElementIntoViewSmooth(element) {
    if (!element) return;

    const performScroll = () => {
        let scrolled = false;
        if (typeof element.scrollIntoView === 'function') {
            try {
                element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                scrolled = true;
            } catch (error) {
                console.warn('[Loading] scrollIntoView failed, falling back to window scroll:', error);
            }
        }
        if (!scrolled && typeof element.getBoundingClientRect === 'function') {
            const rect = element.getBoundingClientRect();
            if (rect && Number.isFinite(rect.top)) {
                const offsetTop = Math.max(0, (window.scrollY || window.pageYOffset || 0) + rect.top - 24);
                if (typeof window.scrollTo === 'function') {
                    window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                } else {
                    window.scrollY = offsetTop;
                }
            }
        }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(performScroll);
    } else {
        setTimeout(performScroll, 16);
    }
}

function showLoading(m = "處理中...") {
    const el = document.getElementById("loading");
    if (el) {
        el.classList.remove("hidden");
        scrollElementIntoViewSmooth(el);
    }

    refreshLoadingMascotImage({ forceNew: true });

    progressAnimator.reset();
    progressAnimator.start();
    setLoadingBaseMessage(m);
    renderLoadingMessage(progressAnimator.getTarget());

    const spinner = el?.querySelector('.fa-spinner');
    if (spinner) spinner.classList.add('fa-spin');
}
function hideLoading() {
    const el = document.getElementById("loading");
    progressAnimator.stop();
    if (el) el.classList.add("hidden");
}
function updateProgress(p) {
    const target = progressAnimator.update(p);
    const effective = Number.isFinite(target) ? target : progressAnimator.getTarget();
    renderLoadingMessage(effective);
}

function createProgressAnimator() {
    const STAGES = [
        { id: 'bootstrap', min: 0, max: 6, hold: 0.6 },
        { id: 'cache', min: 6, max: 18, hold: 0.8 },
        { id: 'fetch', min: 18, max: 55, hold: 1.4 },
        { id: 'organise', min: 55, max: 70, hold: 1 },
        { id: 'simulate', min: 70, max: 95, hold: 1.8 },
        { id: 'finalise', min: 95, max: 100, hold: 0.3 },
    ];
    const MIN_DURATION = 200;
    const MAX_DURATION = 900;
    const MS_PER_PERCENT = 28;

    const raf =
        (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
            ? window.requestAnimationFrame.bind(window)
            : (cb) => setTimeout(() => cb(Date.now()), 16);
    const caf =
        (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function')
            ? window.cancelAnimationFrame.bind(window)
            : clearTimeout;

    let currentValue = 0;
    let targetValue = 0;
    let animationFrom = 0;
    let animationStart = 0;
    let animationEnd = 0;
    let rafId = null;
    let lastReported = 0;
    let lastDisplayTarget = 0;
    let lastStageId = 'bootstrap';

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

    function findStage(value) {
        const stage = STAGES.find((entry) => value < entry.max);
        return stage || STAGES[STAGES.length - 1];
    }

    function computeStageTarget(value) {
        const stage = findStage(value);
        const floor = stage.min;
        const span = stage.max - floor;
        const guard = Math.min(span, Math.max(0, stage.hold || 0));
        const ceiling = stage.max - guard;
        if (value >= stage.max - 0.01) {
            return stage.max;
        }
        if (ceiling <= floor) {
            return Math.max(floor, Math.min(value, stage.max));
        }
        const limited = Math.min(value, ceiling);
        return Math.max(floor, limited);
    }

    function apply(value) {
        const bar = document.getElementById('progressBar');
        if (!bar) return;
        bar.style.width = `${value}%`;
        bar.setAttribute('aria-valuenow', value.toFixed(1));
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        const stage = findStage(value >= 100 ? 99.999 : value);
        if (stage) {
            if (stage.id !== lastStageId) {
                lastStageId = stage.id;
            }
            bar.dataset.stage = stage.id;
        }
    }

    function stopAnimation() {
        if (rafId) {
            caf(rafId);
            rafId = null;
        }
    }
    function now() {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }
        return Date.now();
    }

    function scheduleAnimation(newTarget) {
        stopAnimation();
        if (newTarget <= currentValue + 0.001) {
            currentValue = newTarget;
            apply(currentValue);
            return;
        }
        animationFrom = currentValue;
        animationStart = now();
        const distance = newTarget - animationFrom;
        const duration = Math.max(
            MIN_DURATION,
            Math.min(MAX_DURATION, distance * MS_PER_PERCENT),
        );
        animationEnd = animationStart + duration;
        targetValue = newTarget;
        apply(currentValue);
        rafId = raf(step);
    }

    function step(timestamp) {
        if (!rafId) return;
        const currentTime = typeof timestamp === 'number' ? timestamp : now();
        if (currentTime >= animationEnd || animationEnd <= animationStart) {
            currentValue = targetValue;
            apply(currentValue);
            stopAnimation();
            return;
        }
        const ratio = (currentTime - animationStart) / (animationEnd - animationStart);
        const eased = ratio * ratio * (3 - 2 * ratio);
        currentValue = animationFrom + (targetValue - animationFrom) * eased;
        apply(currentValue);
        rafId = raf(step);
    }

    function setTarget(value) {
        const clamped = clamp(value);
        if (clamped <= currentValue + 0.001 && clamped <= targetValue + 0.001) {
            targetValue = clamped;
            if (!rafId) {
                currentValue = clamped;
                apply(currentValue);
            }
            return;
        }
        if (clamped < currentValue) {
            currentValue = clamped;
            targetValue = clamped;
            apply(currentValue);
            stopAnimation();
            return;
        }
        scheduleAnimation(clamped);
    }

    return {
        start() {
            lastReported = 0;
            lastDisplayTarget = 0;
            apply(currentValue);
        },
        stop() {
            stopAnimation();
        },
        reset() {
            stopAnimation();
            currentValue = 0;
            targetValue = 0;
            animationFrom = 0;
            animationStart = 0;
            animationEnd = 0;
            lastReported = 0;
            lastDisplayTarget = 0;
            lastStageId = 'bootstrap';
            apply(0);
        },
        update(nextProgress) {
            const clamped = clamp(nextProgress);
            if (clamped <= lastReported) {
                if (clamped >= 100) {
                    lastDisplayTarget = 100;
                    setTarget(100);
                    return lastDisplayTarget;
                }
                return lastDisplayTarget;
            }
            lastReported = clamped;
            const stageTarget = computeStageTarget(clamped);
            lastDisplayTarget = stageTarget;
            setTarget(stageTarget);
            if (clamped >= 100) {
                lastDisplayTarget = 100;
                setTarget(100);
            }
            return lastDisplayTarget;
        },
        getTarget() {
            return lastDisplayTarget;
        },
    };
}
function getStrategyParams(type) { const strategySelectId = `${type}Strategy`; const strategySelect = document.getElementById(strategySelectId); if (!strategySelect) { console.error(`[Main] Cannot find select element with ID: ${strategySelectId}`); return {}; } const key = strategySelect.value; let internalKey = key; if (type === 'exit') { if(['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(key)) { internalKey = `${key}_exit`; } } else if (type === 'shortEntry') { internalKey = key; if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(key)) { internalKey = `short_${key}`; } } else if (type === 'shortExit') { internalKey = key; if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(key)) { internalKey = `cover_${key}`; } } const cfg = strategyDescriptions[internalKey]; const prm = {}; if (!cfg?.defaultParams) { return {}; } for (const pName in cfg.defaultParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY'; else if (internalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX'; else if (internalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod'; else if (internalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod'; else if (internalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod'; else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod'; else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage'; const id = `${type}${idSfx}`; const inp = document.getElementById(id); if (inp) { prm[pName] = (inp.type === 'number') ? (parseFloat(inp.value) || cfg.defaultParams[pName]) : inp.value; } else { prm[pName] = cfg.defaultParams[pName]; } } return prm; }
function getBacktestParams() {
    const stockInput = document.getElementById('stockNo');
    const stockNo = stockInput?.value.trim().toUpperCase() || '2330';
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    const initialCapital = parseFloat(document.getElementById('initialCapital')?.value) || 100000;
    const positionSize = parseFloat(document.getElementById('positionSize')?.value) || 100;
    const stagedEntryValues = (window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.getValues === 'function')
        ? window.lazybacktestStagedEntry.getValues()
        : [];
    const entryStages = Array.isArray(stagedEntryValues) && stagedEntryValues.length > 0
        ? stagedEntryValues.filter((value) => Number.isFinite(value) && value > 0)
        : [positionSize];
    const entryStagingModeSelect = document.getElementById('entryStagingMode');
    const entryStagingMode = entryStagingModeSelect?.value || 'signal_repeat';
    const stagedExitValues = (window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.getValues === 'function')
        ? window.lazybacktestStagedExit.getValues()
        : [];
    const exitStages = Array.isArray(stagedExitValues) && stagedExitValues.length > 0
        ? stagedExitValues.filter((value) => Number.isFinite(value) && value > 0)
        : [100];
    const exitStagingModeSelect = document.getElementById('exitStagingMode');
    const exitStagingMode = exitStagingModeSelect?.value || 'signal_repeat';
    const stopLoss = parseFloat(document.getElementById('stopLoss')?.value) || 0;
    const takeProfit = parseFloat(document.getElementById('takeProfit')?.value) || 0;
    const tradeTiming = document.querySelector('input[name="tradeTiming"]:checked')?.value || 'close';
    const adjustedPrice = document.getElementById('adjustedPriceCheckbox')?.checked ?? false;
    const splitAdjustment = adjustedPrice && document.getElementById('splitAdjustmentCheckbox')?.checked;
    const entryStrategy = document.getElementById('entryStrategy')?.value;
    const exitStrategy = document.getElementById('exitStrategy')?.value;
    const entryParams = getStrategyParams('entry');
    const exitParams = getStrategyParams('exit');
    const enableShorting = document.getElementById('enableShortSelling')?.checked ?? false;

    let shortEntryStrategy = null;
    let shortExitStrategy = null;
    let shortEntryParams = {};
    let shortExitParams = {};
    if (enableShorting) {
        shortEntryStrategy = document.getElementById('shortEntryStrategy')?.value;
        shortExitStrategy = document.getElementById('shortExitStrategy')?.value;
        shortEntryParams = getStrategyParams('shortEntry');
        shortExitParams = getStrategyParams('shortExit');
    }

    const buyFee = parseFloat(document.getElementById('buyFee')?.value) || 0;
    const sellFee = parseFloat(document.getElementById('sellFee')?.value) || 0;
    const positionBasis = document.querySelector('input[name="positionBasis"]:checked')?.value || 'initialCapital';
    const marketSelect = document.getElementById('marketSelect');
    const rawMarket = normalizeMarketValue(marketSelect?.value || currentMarket || 'TWSE');
    const market = isIndexSymbol(stockNo) ? 'INDEX' : rawMarket;
    const priceMode = adjustedPrice ? 'adjusted' : 'raw';

    return {
        stockNo,
        startDate,
        endDate,
        initialCapital,
        positionSize,
        stopLoss,
        takeProfit,
        tradeTiming,
        adjustedPrice,
        splitAdjustment: Boolean(splitAdjustment),
        priceMode,
        entryStrategy,
        exitStrategy,
        entryParams,
        exitParams,
        entryStagingMode,
        exitStages,
        exitStagingMode,
        enableShorting,
        shortEntryStrategy,
        shortExitStrategy,
        shortEntryParams,
        shortExitParams,
        buyFee,
        sellFee,
        positionBasis,
        market,
        marketType: isIndexSymbol(stockNo) ? 'INDEX' : currentMarket,
        entryStages,
    };
}
const TAIWAN_STOCK_PATTERN = /^\d{4,6}[A-Z0-9]?$/;
const US_STOCK_PATTERN = /^[A-Z0-9]{1,6}(?:[.-][A-Z0-9]{1,4})?$/;

function validateStockNoByMarket(stockNo, market) {
    if (!stockNo) {
        showError('請輸入有效代碼');
        return false;
    }
    if (isIndexSymbol(stockNo)) {
        return true;
    }
    const normalizedMarket = normalizeMarketValue(market || currentMarket || 'TWSE');
    if (normalizedMarket === 'US') {
        if (!US_STOCK_PATTERN.test(stockNo)) {
            showError('美股代號需為 1～6 碼英數字，可加上「.」或「-」後綴，例如 AAPL、BRK.B、AAPL.US。');
            return false;
        }
        return true;
    }
    if (!TAIWAN_STOCK_PATTERN.test(stockNo)) {
        showError('台股代號需為四到六碼數字，可選擇性附上一碼英數後綴，例如 2330、1101B、00878。');
        return false;
    }
    return true;
}

function validateBacktestParams(p) {
    const normalizedMarket = normalizeMarketValue(p.market || p.marketType || currentMarket || 'TWSE');
    if (!validateStockNoByMarket(p.stockNo, normalizedMarket)) return false;
    if (!p.startDate || !p.endDate) { showError('請選擇日期'); return false; }
    if (new Date(p.startDate) >= new Date(p.endDate)) { showError('結束日期需晚於開始日期'); return false; }
    if (p.initialCapital <= 0) { showError('本金需>0'); return false; }
    if (p.positionSize <= 0 || p.positionSize > 100) { showError('部位大小1-100%'); return false; }
    if (!Array.isArray(p.entryStages) || p.entryStages.length === 0) { showError('請設定至少一個進場百分比'); return false; }
    if (p.entryStages.some((val) => typeof val !== 'number' || !Number.isFinite(val) || val <= 0 || val > 100)) {
        showError('分段進場百分比需介於1-100%');
        return false;
    }
    if (!Array.isArray(p.exitStages) || p.exitStages.length === 0) { showError('請設定至少一個出場百分比'); return false; }
    if (p.exitStages.some((val) => typeof val !== 'number' || !Number.isFinite(val) || val <= 0 || val > 100)) {
        showError('分段出場百分比需介於1-100%');
        return false;
    }
    if (p.stopLoss < 0 || p.stopLoss > 100) { showError('停損0-100%'); return false; }
    if (p.takeProfit < 0) { showError('停利>=0%'); return false; }
    if (p.buyFee < 0) { showError('買入手續費不能小於 0%'); return false; }
    if (p.sellFee < 0) { showError('賣出手續費+稅不能小於 0%'); return false; }
    const chkP = (ps, t) => {
        if (!ps) return true;
        for (const k in ps) {
            if (typeof ps[k] !== 'number' || Number.isNaN(ps[k])) {
                if (Object.keys(ps).length > 0) {
                    showError(`${t}策略的參數 ${k} 錯誤 (值: ${ps[k]})`);
                    return false;
                }
            }
        }
        return true;
    };
    if (!chkP(p.entryParams, '做多進場')) return false;
    if (!chkP(p.exitParams, '做多出場')) return false;
    if (p.enableShorting) {
        if (!chkP(p.shortEntryParams, '做空進場')) return false;
        if (!chkP(p.shortExitParams, '回補出場')) return false;
    }
    return true;
}

const MAIN_DAY_MS = 24 * 60 * 60 * 1000;

function buildCacheKey(cur) {
    if (!cur) return '';
    const market = (cur.market || cur.marketType || 'TWSE').toUpperCase();
    const stockNo = (cur.stockNo || '').toString().toUpperCase();
    const rawMode = (cur.priceMode || (cur.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const priceModeKey = rawMode === 'adjusted' ? 'ADJ' : 'RAW';
    const splitFlag = cur.splitAdjustment ? 'SPLIT' : 'NOSPLIT';
    const dataStart = cur.dataStartDate || cur.startDate || cur.effectiveStartDate || 'NA';
    const effectiveStart = cur.effectiveStartDate || cur.startDate || 'NA';
    const lookbackKey = Number.isFinite(cur.lookbackDays)
        ? `LB${Math.round(cur.lookbackDays)}`
        : 'LB-';
    return `${market}|${stockNo}|${priceModeKey}|${splitFlag}|${dataStart}|${effectiveStart}|${lookbackKey}`;
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

function parseSourceLabelDescriptor(label) {
    const original = (label || '').toString().trim();
    if (!original) return null;
    let base = original;
    let extra = null;
    const match = original.match(/\(([^)]+)\)\s*$/);
    if (match) {
        extra = match[1].trim();
        base = original.slice(0, match.index).trim() || base;
    }
    const normalizedAll = original.toLowerCase();
    const typeOrder = [
        { pattern: /(瀏覽器|browser|session|local|記憶體|memory)/, type: '本地快取' },
        { pattern: /(netlify|blob)/, type: 'Blob 快取' },
        { pattern: /(proxy)/, type: 'Proxy 快取' },
        { pattern: /(cache|快取)/, type: 'Proxy 快取' },
    ];
    let resolvedType = null;
    for (let i = 0; i < typeOrder.length && !resolvedType; i += 1) {
        if (typeOrder[i].pattern.test(normalizedAll)) {
            resolvedType = typeOrder[i].type;
        }
    }
    if (!resolvedType && extra && /(cache|快取)/i.test(extra)) {
        resolvedType = 'Proxy 快取';
    }
    return {
        base: base || original,
        extra,
        type: resolvedType,
        original,
    };
}

function decorateSourceBase(descriptor) {
    if (!descriptor) return '';
    const base = descriptor.base || descriptor.original || '';
    if (!base) return '';
    if (descriptor.extra && !/^(?:cache|快取)$/i.test(descriptor.extra)) {
        return `${base}｜${descriptor.extra}`;
    }
    return base;
}

function summariseSourceLabels(labels) {
    if (!Array.isArray(labels) || labels.length === 0) return '';
    const parsed = labels
        .map((label) => parseSourceLabelDescriptor(label))
        .filter((item) => item && (item.base || item.original));
    if (parsed.length === 0) return '';

    const baseOrder = [];
    const baseSeen = new Set();
    parsed.forEach((item) => {
        const decorated = decorateSourceBase(item);
        if (decorated && !baseSeen.has(decorated)) {
            baseSeen.add(decorated);
            baseOrder.push(decorated);
        }
    });

    const remoteOrder = [];
    const remoteSeen = new Set();
    parsed.forEach((item) => {
        const decorated = decorateSourceBase(item);
        if (!decorated || remoteSeen.has(decorated)) return;
        const normalizedBase = (item.base || '').toLowerCase();
        const isLocal = /(瀏覽器|browser|session|local|記憶體|memory)/.test(normalizedBase);
        const isBlob = /(netlify|blob)/.test(normalizedBase);
        const isProxy = item.type === 'Proxy 快取';
        if (!isLocal && (!item.type || isProxy) && !isBlob) {
            remoteSeen.add(decorated);
            remoteOrder.push(decorated);
        }
    });

    const suffixMap = new Map();
    parsed.forEach((item) => {
        if (!item.type) return;
        let descriptor = item.type;
        if (item.extra && !/^(?:cache|快取)$/i.test(item.extra)) {
            descriptor = `${descriptor}｜${item.extra}`;
        }
        if (!suffixMap.has(descriptor)) {
            suffixMap.set(descriptor, true);
        }
    });

    const primaryOrder = remoteOrder.length > 0 ? remoteOrder : baseOrder;
    if (primaryOrder.length === 0) return '';

    const suffixes = Array.from(suffixMap.keys());
    if (suffixes.length === 0) {
        return primaryOrder.join(' + ');
    }
    return `${primaryOrder.join(' + ')}（${suffixes.join('、')}）`;
}

function needsDataFetch(cur) {
    if (!cur || !cur.stockNo || !(cur.startDate || cur.dataStartDate) || !cur.endDate) return true;
    const key = buildCacheKey(cur);

    const normalizedMarket = typeof normalizeMarketKeyForCache === 'function'
        ? normalizeMarketKeyForCache(cur.market || cur.marketType || currentMarket || 'TWSE')
        : normalizeMarketValue(cur.market || cur.marketType || currentMarket || 'TWSE');
    const entry = typeof ensureDatasetCacheEntryFresh === 'function'
        ? ensureDatasetCacheEntryFresh(key, cachedDataStore.get(key), normalizedMarket)
        : cachedDataStore.get(key);
    if (!entry) return true;
    if (!Array.isArray(entry.coverage) || entry.coverage.length === 0) return true;
    const rangeStart = cur.dataStartDate || cur.startDate;
    return !coverageCoversRange(entry.coverage, { start: rangeStart, end: cur.endDate });

}
// --- 新增：請求並顯示策略建議 ---
function getSuggestion() {
    console.log("[Main] getSuggestion called");
    const suggestionUI = window.lazybacktestTodaySuggestion;
    if (!suggestionUI || typeof suggestionUI.showLoading !== 'function') {
        console.warn('[Main] Suggestion UI controller not available.');
        return;
    }

    if (!Array.isArray(cachedStockData) || cachedStockData.length === 0) {
        suggestionUI.showError('請先執行回測以建立建議所需的資料。');
        return;
    }

    if (!workerUrl || !backtestWorker) {
        console.warn('[Suggestion] Worker not ready or busy.');
        suggestionUI.showError('引擎未就緒或忙碌中');
        return;
    }

    suggestionUI.showLoading();

    try {
        const params = getBacktestParams();
        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
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
        if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && sharedUtils && typeof sharedUtils.resolveLookbackDays === 'function') {
            const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
            if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                lookbackDays = fallbackDecision.lookbackDays;
                if (!lookbackDecision) lookbackDecision = fallbackDecision;
            }
        }
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
                ? sharedUtils.estimateLookbackBars(fallbackMaxPeriod, { minBars: 90, multiplier: 2 })
                : Math.max(90, fallbackMaxPeriod * 2);
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

        const dataDebug = (lastOverallResult && lastOverallResult.dataDebug) || {};
        const diagnostics = lastDatasetDiagnostics || null;
        const cacheCoverage = computeCoverageFromRows(cachedStockData);
        const coverageFingerprint = computeCoverageFingerprint(cacheCoverage);
        request.cachedMeta = {
            summary: dataDebug.summary || null,
            adjustments: Array.isArray(dataDebug.adjustments) ? dataDebug.adjustments : [],
            debugSteps: Array.isArray(dataDebug.debugSteps) ? dataDebug.debugSteps : [],
            adjustmentFallbackApplied: Boolean(dataDebug.adjustmentFallbackApplied),
            adjustmentFallbackInfo: dataDebug.adjustmentFallbackInfo || null,
            priceSource: dataDebug.priceSource || null,
            dataSource: dataDebug.dataSource || null,
            splitDiagnostics: dataDebug.splitDiagnostics || null,
            finmindStatus: dataDebug.finmindStatus || null,
            fetchRange: dataDebug.fetchRange || null,
            diagnostics,
            lookbackDays,
            coverage: cacheCoverage,
            coverageFingerprint,
        };

        backtestWorker.postMessage(request);
    } catch (error) {
        console.error('[Main] Error getting suggestion:', error);
        suggestionUI.showError(error?.message || '計算建議時出錯');
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

function initRollingTestFeature() {
    const initHandler = () => {
        if (window.rollingTest && typeof window.rollingTest.init === 'function') {
            window.rollingTest.init();
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHandler);
    } else {
        initHandler();
    }
}

// --- 初始化調用 ---
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Main] DOM loaded, initializing...');
    
    try {
        // 初始化日期
        initDates();

        initLoadingMascotSanitiser();

        if (window.lazybacktestMultiStagePanel && typeof window.lazybacktestMultiStagePanel.init === 'function') {
            window.lazybacktestMultiStagePanel.init();
        }

        if (window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.init === 'function') {
            window.lazybacktestStagedEntry.init();
        }

        if (window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.init === 'function') {
            window.lazybacktestStagedExit.init();
        }

        // 初始化資料來源測試面板
        initDataSourceTester();

        // 初始化開發者區域切換
        initDeveloperAreaToggle();
        initStrategyRegistryTester();
        initBatchDebugLogPanel();

        // 初始化頁籤功能
        initTabs();
        
        // 延遲初始化批量優化功能，確保所有依賴都已載入
        setTimeout(() => {
            initBatchOptimizationFeature();
            initRollingTestFeature();
        }, 100);

        console.log('[Main] Initialization completed');
    } catch (error) {
        console.error('[Main] Initialization failed:', error);
    }
});
