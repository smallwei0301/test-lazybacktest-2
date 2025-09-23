// --- 主 JavaScript 邏輯 (Part 1 of X) - v3.5.3 ---
// Patch Tag: LB-ADJ-SPLIT-20250518A
// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-US-YAHOO-20250613A
// Patch Tag: LB-TW-DIRECTORY-20250620A
// Patch Tag: LB-US-BACKTEST-20250621A

// 全局變量
let stockChart = null;
let backtestWorker = null;
let optimizationWorker = null;
let workerUrl = null; // Loader 會賦值
let cachedStockData = null;
const cachedDataStore = new Map(); // Map<market|stockNo|priceMode, CacheEntry>
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

// --- Data Source Tester (LB-DATASOURCE-20241005A) ---
const dataSourceTesterState = {
    open: false,
    busy: false,
};

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
    return '上市 (TWSE)';
}

function applyMarketPreset(market) {
    const adjustedCheckbox = document.getElementById('adjustedPriceCheckbox');
    const splitCheckbox = document.getElementById('splitAdjustmentCheckbox');
    const disableAdjusted = market === 'US';

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
        return;
    }
    const market = getCurrentMarketFromUI();
    const adjusted = isAdjustedMode();
    const splitEnabled = isSplitAdjustmentEnabled();
    let requestUrl = '';
    let parseMode = 'proxy';
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
        const params = new URLSearchParams({
            stockNo,
            start,
            end,
        });
        if (sourceId) params.set('forceSource', sourceId);
        requestUrl = `${endpoint}?${params.toString()}`;
    }

    dataSourceTesterState.busy = true;
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
            if (payload?.fallback?.reason) {
                const fallbackSource = testerEscapeHtml(payload.dataSource || '備援來源');
                const fallbackReason = testerEscapeHtml(payload.fallback.reason);
                detailLines.push(`備援狀態: <span class="font-semibold">改用 ${fallbackSource}</span> ・ 原因：${fallbackReason}`);
            }
            detailHtml = detailLines.join('<br>');
        }
        showTesterResult(
            'success',
            `來源 <span class="font-semibold">${sourceLabel}</span> 測試成功。<br>${detailHtml}`,
        );
    } catch (error) {
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
    const market = getCurrentMarketFromUI();
    const adjusted = isAdjustedMode();
    const splitEnabled = isSplitAdjustmentEnabled();
    const { start, end } = getDateRangeFromUI();
    const stockNo = getStockNoValue();
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
    const market = normalizeMarketValue(marketSelect?.value || currentMarket || 'TWSE');
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
        marketType: currentMarket,
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
    const rawMode = (cur.priceMode || (cur.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const priceModeKey = rawMode === 'adjusted' ? 'ADJ' : 'RAW';
    const splitFlag = cur.splitAdjustment ? 'SPLIT' : 'NOSPLIT';
    return `${market}|${cur.stockNo}|${priceModeKey}|${splitFlag}`;
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
        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        const maxPeriod = sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(params)
            : 0;
        const lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
            ? sharedUtils.estimateLookbackBars(maxPeriod, { minBars: 90, multiplier: 2 })
            : Math.max(90, maxPeriod * 2);
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

        if (window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.init === 'function') {
            window.lazybacktestStagedEntry.init();
        }

        if (window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.init === 'function') {
            window.lazybacktestStagedExit.init();
        }

        // 初始化資料來源測試面板
        initDataSourceTester();

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
