// --- 主 JavaScript 邏輯 (Part 1 of X) - v3.5.2 ---

// 全局變量
let stockChart = null;
let backtestWorker = null;
let optimizationWorker = null;
let workerUrl = null; // Loader 會賦值
let cachedStockData = null;
const cachedDataStore = new Map(); // Map<market|stockNo|priceMode, CacheEntry>
const progressAnimator = createProgressAnimator();
const adjustedComparisonState = {
    version: 'LB-ADJ-CARD-20241015A',
    lastContextKey: null,
    busy: false,
};

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

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (match) => {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return match;
        }
    });
}

// --- Data Source Tester (LB-DATASOURCE-20241005A) ---
const dataSourceTesterState = {
    open: false,
    busy: false,
};

function getStockNoValue() {
    const input = document.getElementById('stockNo');
    return (input?.value || '').trim().toUpperCase();
}

function getCurrentMarketFromUI() {
    const switchEl = document.getElementById('marketSwitch');
    return switchEl && switchEl.checked ? 'TPEX' : 'TWSE';
}

function getMarketLabel(market) {
    return market === 'TPEX' ? '上櫃 (TPEX)' : '上市 (TWSE)';
}

function isAdjustedMode() {
    const checkbox = document.getElementById('adjustedPriceCheckbox');
    return Boolean(checkbox && checkbox.checked);
}

function getDateRangeFromUI() {
    const start = document.getElementById('startDate')?.value || '';
    const end = document.getElementById('endDate')?.value || '';
    return { start, end };
}

function getTesterSourceConfigs(market, adjusted) {
    if (adjusted) {
        return [
            { id: 'yahoo', label: 'Yahoo 還原價', description: '主來源 (還原股價)' },
            { id: 'goodinfo', label: 'Goodinfo 還原備援', description: 'Yahoo 失效時啟用' },
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
    clearDataSourceTesterLog();
}

function clearDataSourceTesterLog() {
    const logEl = document.getElementById('dataSourceTesterLog');
    if (!logEl) return;
    logEl.innerHTML = '';
    logEl.classList.add('hidden');
}

function extractGoodinfoDebug(meta) {
    if (!meta || typeof meta !== 'object') return null;
    if (meta.goodinfo && typeof meta.goodinfo === 'object') {
        return {
            version: meta.goodinfo.version || '',
            attempts: Array.isArray(meta.goodinfo.attempts) ? meta.goodinfo.attempts : [],
        };
    }
    if (Array.isArray(meta.goodinfoDebug)) {
        return {
            version: meta.goodinfoVersion || '',
            attempts: meta.goodinfoDebug,
        };
    }
    if (Array.isArray(meta.goodinfoAttempts)) {
        return {
            version: meta.goodinfoVersion || '',
            attempts: meta.goodinfoAttempts,
        };
    }
    return null;
}

function renderDataSourceTesterLog(meta) {
    const logEl = document.getElementById('dataSourceTesterLog');
    if (!logEl) return;
    const debug = extractGoodinfoDebug(meta);
    if (!debug) {
        clearDataSourceTesterLog();
        return;
    }
    const { version, attempts } = debug;
    const parts = [];
    parts.push(
        `<div class="mb-1 text-[10px] font-medium" style="color: var(--foreground);">Goodinfo 模組版本：<span class="font-semibold">${escapeHtml(version || '未知')}</span></div>`,
    );
    if (!Array.isArray(attempts) || attempts.length === 0) {
        parts.push('<div class="text-[10px]">尚未提供 Goodinfo 偵錯資訊。</div>');
    } else {
        attempts.forEach((attempt, index) => {
            const status = (attempt?.status || 'unknown').toLowerCase();
            let statusLabel = '未知';
            let statusClass = 'text-sky-600';
            if (status === 'success') {
                statusLabel = '成功';
                statusClass = 'text-emerald-600';
            } else if (status === 'http-error') {
                statusLabel = 'HTTP 錯誤';
                statusClass = 'text-amber-600';
            } else if (status === 'no-table') {
                statusLabel = '未找到表格';
                statusClass = 'text-rose-600';
            } else if (status === 'parse-error') {
                statusLabel = '解析失敗';
                statusClass = 'text-rose-600';
            } else if (status === 'error') {
                statusLabel = '錯誤';
                statusClass = 'text-rose-600';
            }
            const diagnostics = attempt?.diagnostics || {};
            const detailPieces = [];
            const rowCount = Number.isFinite(attempt?.rowCount) ? attempt.rowCount : diagnostics.rowCount;
            if (Number.isFinite(rowCount)) detailPieces.push(`筆數: ${rowCount}`);
            const firstDate = attempt?.firstDate || diagnostics.firstDate;
            const lastDate = attempt?.lastDate || diagnostics.lastDate;
            if (firstDate) detailPieces.push(`首日: ${escapeHtml(firstDate)}`);
            if (lastDate) detailPieces.push(`末日: ${escapeHtml(lastDate)}`);
            if (diagnostics.matchedBy) detailPieces.push(`定位: ${escapeHtml(diagnostics.matchedBy)}`);
            if (Number.isFinite(diagnostics.documentWriteExpressions)) {
                detailPieces.push(`document.write: ${(diagnostics.documentWriteHits || 0)}/${diagnostics.documentWriteExpressions}`);
            }
            if (Number.isFinite(diagnostics.scriptAssignments)) {
                const total = Number.isFinite(diagnostics.scriptAssignmentCandidates)
                    ? diagnostics.scriptAssignmentCandidates
                    : diagnostics.scriptAssignments;
                detailPieces.push(`腳本賦值: ${diagnostics.scriptAssignments}/${total}`);
            }
            if (Number.isFinite(diagnostics.candidateCount)) {
                detailPieces.push(`候選表格: ${diagnostics.candidateCount}`);
            }
            if (Number.isFinite(diagnostics.directTables)) {
                detailPieces.push(`直接表格: ${diagnostics.directTables}`);
            }
            if (Number.isFinite(diagnostics.assignmentTables)) {
                detailPieces.push(`變數表格: ${diagnostics.assignmentTables}`);
            }
            if (Number.isFinite(diagnostics.markerHits)) {
                detailPieces.push(`標記命中: ${diagnostics.markerHits}`);
            }
            const urlLabel = attempt?.url ? escapeHtml(attempt.url) : '未知 URL';
            const detailLine = detailPieces.length > 0 ? `<div class="mt-1">${detailPieces.join(' ・ ')}</div>` : '';
            const errorLine = attempt?.error
                ? `<div class="mt-1 text-rose-600">錯誤：${escapeHtml(attempt.error)}</div>`
                : '';
            parts.push(`
                <div class="pt-2 mt-2 border-t first:border-t-0 first:pt-0 first:mt-1" style="border-color: var(--border);">
                    <div class="flex items-center justify-between text-[10px]">
                        <span class="font-semibold">嘗試 #${index + 1}</span>
                        <span class="${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="text-[10px] break-words">URL：${urlLabel}</div>
                    ${detailLine}
                    ${errorLine}
                </div>
            `);
        });
    }
    logEl.innerHTML = parts.join('');
    logEl.classList.remove('hidden');
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
    if (adjusted && !['yahoo', 'goodinfo'].includes(sourceId)) {
        showTesterResult('error', '還原股價目前僅支援 Yahoo 或 Goodinfo 測試來源。');
        return;
    }
    const endpoint = market === 'TPEX' ? '/api/tpex/' : '/api/twse/';
    const params = new URLSearchParams({
        stockNo,
        start,
        end,
        forceSource: sourceId,
    });
    if (adjusted) params.set('adjusted', '1');

    dataSourceTesterState.busy = true;
    setTesterButtonsDisabled(true);
    showTesterResult('info', `⌛ 正在測試 <span class="font-semibold">${sourceLabel}</span>，請稍候...`);
    clearDataSourceTesterLog();

    try {
        const response = await fetch(`${endpoint}?${params.toString()}`, {
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
            const errorObj = new Error(message);
            if (payload?.meta) errorObj.meta = payload.meta;
            throw errorObj;
        }
        const aaData = Array.isArray(payload.aaData) ? payload.aaData : [];
        const total = Number.isFinite(payload.iTotalRecords)
            ? payload.iTotalRecords
            : aaData.length;
        const isoDates = aaData
            .map((row) => (Array.isArray(row) ? rocToIsoDate(row[0]) : null))
            .filter((value) => Boolean(value));
        const firstDate = isoDates.length > 0 ? isoDates[0] : start;
        const lastDate = isoDates.length > 0 ? isoDates[isoDates.length - 1] : end;
        const sourceSummary = payload?.dataSource || '未知資料來源';
        const detailHtml = [
            `來源摘要: <span class="font-semibold">${sourceSummary}</span>`,
            `資料筆數: <span class="font-semibold">${total}</span>`,
            `涵蓋區間: <span class="font-semibold">${firstDate} ~ ${lastDate}</span>`,
        ].join('<br>');
        showTesterResult(
            'success',
            `來源 <span class="font-semibold">${sourceLabel}</span> 測試成功。<br>${detailHtml}`,
        );
        renderDataSourceTesterLog(payload?.meta || null);
    } catch (error) {
        showTesterResult(
            'error',
            `來源 <span class="font-semibold">${sourceLabel}</span> 測試失敗：${error.message || error}`,
        );
        renderDataSourceTesterLog(error?.meta || null);
    } finally {
        dataSourceTesterState.busy = false;
        refreshDataSourceTester();
    }
}

function refreshDataSourceTester() {
    const modeEl = document.getElementById('dataSourceTesterMode');
    const hintEl = document.getElementById('dataSourceTesterHint');
    if (!modeEl || !hintEl) return;
    const market = getCurrentMarketFromUI();
    const adjusted = isAdjustedMode();
    const { start, end } = getDateRangeFromUI();
    const stockNo = getStockNoValue();
    const sources = getTesterSourceConfigs(market, adjusted);
    const missingInputs = !stockNo || !start || !end;
    modeEl.textContent = `${getMarketLabel(market)} ・ ${adjusted ? '還原股價' : '原始股價'}`;
    renderDataSourceTesterButtons(sources, missingInputs || dataSourceTesterState.busy);
    if (missingInputs) {
        hintEl.textContent = '請輸入股票代碼並選擇開始與結束日期後，再執行資料來源測試。';
        hintEl.style.color = 'var(--muted-foreground)';
        clearTesterResult();
    } else if (adjusted) {
        hintEl.textContent = '還原股價目前由 Yahoo Finance 提供，如需使用 FinMind 還原資料請升級 Sponsor 等級。';
        hintEl.style.color = 'var(--muted-foreground)';
    } else if (market === 'TPEX') {
        hintEl.textContent = 'FinMind 為主來源，上櫃備援由 Yahoo 提供。建議主備來源都測試一次。';
        hintEl.style.color = 'var(--muted-foreground)';
    } else {
        hintEl.textContent = 'TWSE 為主來源，FinMind 為備援來源。建議主備來源都測試一次。';
        hintEl.style.color = 'var(--muted-foreground)';
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

    const stockNoInput = document.getElementById('stockNo');
    if (stockNoInput) {
        stockNoInput.addEventListener('input', refreshDataSourceTester);
    }
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    startInput?.addEventListener('change', refreshDataSourceTester);
    endInput?.addEventListener('change', refreshDataSourceTester);
    const marketSwitch = document.getElementById('marketSwitch');
    marketSwitch?.addEventListener('change', refreshDataSourceTester);
    const adjustedCheckbox = document.getElementById('adjustedPriceCheckbox');
    adjustedCheckbox?.addEventListener('change', refreshDataSourceTester);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    refreshDataSourceTester();
    window.refreshDataSourceTester = refreshDataSourceTester;
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
function getBacktestParams() { const sN=document.getElementById("stockNo").value.trim().toUpperCase()||"2330"; const sD=document.getElementById("startDate").value; const eD=document.getElementById("endDate").value; const iC=parseFloat(document.getElementById("initialCapital").value)||100000; const pS=parseFloat(document.getElementById("positionSize").value)||100; const sL=parseFloat(document.getElementById("stopLoss").value)||0; const tP=parseFloat(document.getElementById("takeProfit").value)||0; const tT=document.querySelector('input[name="tradeTiming"]:checked')?.value||'close'; const adjP=document.getElementById("adjustedPriceCheckbox").checked; const eS=document.getElementById("entryStrategy").value; const xS=document.getElementById("exitStrategy").value; const eP=getStrategyParams('entry'); const xP=getStrategyParams('exit'); const enableShorting = document.getElementById("enableShortSelling").checked; let shortES = null, shortXS = null, shortEP = {}, shortXP = {}; if (enableShorting) { shortES = document.getElementById("shortEntryStrategy").value; shortXS = document.getElementById("shortExitStrategy").value; shortEP = getStrategyParams('shortEntry'); shortXP = getStrategyParams('shortExit'); } const buyFee = parseFloat(document.getElementById("buyFee").value) || 0; const sellFee = parseFloat(document.getElementById("sellFee").value) || 0;     const positionBasis = document.querySelector('input[name="positionBasis"]:checked')?.value || 'initialCapital'; const marketSwitch = document.getElementById("marketSwitch"); const market = (marketSwitch && marketSwitch.checked) ? 'TPEX' : 'TWSE'; const priceMode = adjP ? 'adjusted' : 'raw'; return { stockNo: sN, startDate: sD, endDate: eD, initialCapital: iC, positionSize: pS, stopLoss: sL, takeProfit: tP, tradeTiming: tT, adjustedPrice: adjP, priceMode: priceMode, entryStrategy: eS, exitStrategy: xS, entryParams: eP, exitParams: xP, enableShorting: enableShorting, shortEntryStrategy: shortES, shortExitStrategy: shortXS, shortEntryParams: shortEP, shortExitParams: shortXP, buyFee: buyFee, sellFee: sellFee, positionBasis: positionBasis, market: market, marketType: currentMarket }; }
function validateBacktestParams(p) { if(!/^[0-9A-Z]{3,7}$/.test(p.stockNo)){showError("請輸入有效代碼");return false;} if(!p.startDate||!p.endDate){showError("請選擇日期");return false;} if(new Date(p.startDate)>=new Date(p.endDate)){showError("結束日期需晚於開始日期");return false;} if(p.initialCapital<=0){showError("本金需>0");return false;} if(p.positionSize<=0||p.positionSize>100){showError("部位大小1-100%");return false;} if(p.stopLoss<0||p.stopLoss>100){showError("停損0-100%");return false;} if(p.takeProfit<0){showError("停利>=0%");return false;} if (p.buyFee < 0) { showError("買入手續費不能小於 0%"); return false; } if (p.sellFee < 0) { showError("賣出手續費+稅不能小於 0%"); return false; } const chkP=(ps,t)=>{ if (!ps) return true; for(const k in ps){ if(typeof ps[k]!=='number'||isNaN(ps[k])){ if(Object.keys(ps).length > 0) { showError(`${t}策略的參數 ${k} 錯誤 (值: ${ps[k]})`); return false; } } } return true; }; if(!chkP(p.entryParams,'做多進場'))return false; if(!chkP(p.exitParams,'做多出場'))return false; if (p.enableShorting) { if(!chkP(p.shortEntryParams,'做空進場'))return false; if(!chkP(p.shortExitParams,'回補出場'))return false; } return true; }

const MAIN_DAY_MS = 24 * 60 * 60 * 1000;

function buildCacheKey(cur) {
    if (!cur) return '';
    const market = (cur.market || cur.marketType || 'TWSE').toUpperCase();
    const rawMode = (cur.priceMode || (cur.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const priceModeKey = rawMode === 'adjusted' ? 'ADJ' : 'RAW';
    return `${market}|${cur.stockNo}|${priceModeKey}`;
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

function buildUiCacheKey(stockNo, startDate, endDate, adjusted) {
    const mode = adjusted ? 'ADJ' : 'RAW';
    return `${stockNo}__${startDate}__${endDate}__${mode}`;
}

function parsePriceValue(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseVolumeValue(value) {
    if (value === null || value === undefined) return 0;
    const num = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
}

function normalizePriceSeries(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => {
            if (!row) return null;
            const date = row.date;
            if (!date) return null;
            const close = parsePriceValue(row.close);
            const open = parsePriceValue(row.open ?? close);
            const base = close ?? open ?? 0;
            const highCandidate = parsePriceValue(row.high);
            const lowCandidate = parsePriceValue(row.low);
            const high = highCandidate !== null ? highCandidate : Math.max(open ?? base, close ?? base);
            const low = lowCandidate !== null ? lowCandidate : Math.min(open ?? base, close ?? base);
            const change = parsePriceValue(row.change);
            const volume = parseVolumeValue(row.volume);
            return {
                date,
                open,
                high,
                low,
                close,
                change: Number.isFinite(change) ? change : null,
                volume,
            };
        })
        .filter((entry) => entry && entry.close !== null)
        .sort((a, b) => a.date.localeCompare(b.date));
}

function getCachedSeriesForComparison(stockNo, startDate, endDate, adjusted) {
    if (!stockNo || !startDate || !endDate) return null;
    const key = buildUiCacheKey(stockNo, startDate, endDate, adjusted);
    const entry = cachedDataStore.get(key);
    if (!entry || !Array.isArray(entry.data)) return null;
    const rows = normalizePriceSeries(extractRangeData(entry.data, startDate, endDate));
    return {
        rows,
        dataSource: entry.dataSource || summariseSourceLabels(entry.dataSources || []),
        stockName: entry.stockName || stockNo,
    };
}

async function fetchPricePreviewSeries(stockNo, market, startISO, endISO, adjusted) {
    const endpoint = market === 'TPEX' ? '/api/tpex/' : '/api/twse/';
    const params = new URLSearchParams({ stockNo });
    if (startISO) params.set('start', startISO);
    if (endISO) params.set('end', endISO);
    if (adjusted) params.set('adjusted', '1');
    params.set('preview', '1');
    const response = await fetch(`${endpoint}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    const rawText = await response.text();
    let payload = {};
    try {
        payload = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
        console.warn('[AdjustedComparison] 無法解析預覽回應 JSON:', error);
        payload = {};
    }
    if (!response.ok || payload?.error) {
        const message = payload?.error || `HTTP ${response.status}`;
        throw new Error(message);
    }
    const aaData = Array.isArray(payload.aaData) ? payload.aaData : [];
    const converted = aaData
        .map((row) => {
            if (!Array.isArray(row) || row.length < 7) return null;
            const isoDate = rocToIsoDate(row[0]);
            if (!isoDate) return null;
            return {
                date: isoDate,
                open: parsePriceValue(row[3]),
                high: parsePriceValue(row[4]),
                low: parsePriceValue(row[5]),
                close: parsePriceValue(row[6]),
                change: parsePriceValue(row[7]),
                volume: parseVolumeValue(row[8]),
                stockName: row[2] || payload.stockName || stockNo,
            };
        })
        .filter(Boolean);
    const rows = normalizePriceSeries(converted);
    return {
        rows,
        dataSource: payload.dataSource || '',
        stockName: payload.stockName || (converted[0]?.stockName) || stockNo,
    };
}

function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    return Number(value).toFixed(digits);
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

window.hideAdjustedComparisonCard = function hideAdjustedComparisonCard() {
    const card = document.getElementById('adjustedComparisonCard');
    const contentEl = document.getElementById('adjustedComparisonContent');
    adjustedComparisonState.lastContextKey = null;
    adjustedComparisonState.busy = false;
    if (card) card.classList.add('hidden');
    if (contentEl) {
        contentEl.innerHTML = '<p class="text-xs text-muted-foreground">啟用「除權息還原股價」後將顯示原始與還原股價的對比摘要。</p>';
    }
};

window.updateAdjustedComparisonCard = async function updateAdjustedComparisonCard(result, context = {}) {
    const card = document.getElementById('adjustedComparisonCard');
    const contentEl = document.getElementById('adjustedComparisonContent');
    if (!card || !contentEl) return;

    const settings = context.settings || lastFetchSettings;
    if (!settings || !settings.adjustedPrice) {
        window.hideAdjustedComparisonCard();
        return;
    }

    const stockNo = settings.stockNo;
    const startISO = settings.startDate;
    const endISO = settings.endDate;
    if (!stockNo || !startISO || !endISO) {
        window.hideAdjustedComparisonCard();
        return;
    }

    const marketValue = settings.market || settings.marketType || getCurrentMarketFromUI() || 'TWSE';
    const market = typeof marketValue === 'string' ? marketValue.toUpperCase() : 'TWSE';
    const contextKey = JSON.stringify([stockNo, startISO, endISO, market, settings.adjustedPrice]);
    adjustedComparisonState.lastContextKey = contextKey;
    adjustedComparisonState.busy = true;

    card.classList.remove('hidden');
    contentEl.innerHTML = '<p class="text-xs text-muted-foreground">正在準備還原股價對比...</p>';

    try {
        let stockName = context.stockName || stockNo;
        let adjustedSource = context.dataSource || '';
        let adjustedSeries = [];

        if (Array.isArray(result?.rawData) && result.rawData.length > 0) {
            adjustedSeries = normalizePriceSeries(result.rawData);
        } else if (Array.isArray(cachedStockData) && cachedStockData.length > 0) {
            adjustedSeries = normalizePriceSeries(extractRangeData(cachedStockData, startISO, endISO));
        } else {
            const cachedAdjusted = getCachedSeriesForComparison(stockNo, startISO, endISO, true);
            if (cachedAdjusted) {
                adjustedSeries = cachedAdjusted.rows;
                adjustedSource = cachedAdjusted.dataSource || adjustedSource;
                stockName = cachedAdjusted.stockName || stockName;
            } else {
                const fetchedAdjusted = await fetchPricePreviewSeries(stockNo, market, startISO, endISO, true);
                adjustedSeries = fetchedAdjusted.rows;
                adjustedSource = fetchedAdjusted.dataSource || adjustedSource;
                stockName = fetchedAdjusted.stockName || stockName;
            }
        }

        if (adjustedComparisonState.lastContextKey !== contextKey) {
            return;
        }

        if (!Array.isArray(adjustedSeries) || adjustedSeries.length === 0) {
            contentEl.innerHTML = '<p class="text-xs text-rose-600">未能取得還原股價資料供對比。</p>';
            return;
        }

        let rawSeries = [];
        let rawSource = '';
        let rawError = null;
        const cachedRaw = getCachedSeriesForComparison(stockNo, startISO, endISO, false);
        if (cachedRaw) {
            rawSeries = cachedRaw.rows;
            rawSource = cachedRaw.dataSource || rawSource;
        } else {
            try {
                const fetchedRaw = await fetchPricePreviewSeries(stockNo, market, startISO, endISO, false);
                rawSeries = fetchedRaw.rows;
                rawSource = fetchedRaw.dataSource || rawSource;
            } catch (error) {
                rawError = error;
                console.warn('[AdjustedComparison] 原始價格預覽取得失敗:', error);
            }
        }

        if (adjustedComparisonState.lastContextKey !== contextKey) {
            return;
        }

        if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
            const reason = rawError ? ` (${rawError.message})` : '。請先關閉「除權息還原股價」執行一次回測建立原始資料快取。';
            contentEl.innerHTML = `<p class="text-xs text-amber-600">尚未取得原始股價對照${reason}</p>`;
            return;
        }

        const adjustedMap = new Map(adjustedSeries.map((item) => [item.date, item]));
        const rawMap = new Map(rawSeries.map((item) => [item.date, item]));
        const commonDates = Array.from(adjustedMap.keys())
            .filter((date) => rawMap.has(date))
            .sort((a, b) => a.localeCompare(b));

        if (commonDates.length === 0) {
            contentEl.innerHTML = '<p class="text-xs text-amber-600">還原資料與原始資料無共同交易日，請確認查詢日期區間。</p>';
            return;
        }

        const latestDate = commonDates[commonDates.length - 1];
        const latestAdjusted = adjustedMap.get(latestDate);
        const latestRaw = rawMap.get(latestDate);
        const diff = latestAdjusted && latestRaw && latestAdjusted.close !== null && latestRaw.close !== null
            ? latestAdjusted.close - latestRaw.close
            : null;
        const diffRatio = diff !== null && latestRaw && latestRaw.close
            ? ((latestAdjusted.close / latestRaw.close) - 1) * 100
            : null;

        const recentRows = commonDates.slice(-3).map((date) => {
            const adj = adjustedMap.get(date);
            const raw = rawMap.get(date);
            return {
                date,
                rawClose: raw?.close ?? null,
                adjClose: adj?.close ?? null,
                diff: raw && adj && raw.close !== null && adj.close !== null ? adj.close - raw.close : null,
            };
        }).reverse();

        const diffLabel = diff !== null ? `${diff >= 0 ? '+' : ''}${formatNumber(diff)}` : '—';
        const ratioLabel = diffRatio !== null ? `${diffRatio >= 0 ? '+' : ''}${formatNumber(diffRatio, 2)}%` : '—';
        const statusClass = diff !== null && Math.abs(diff) < 0.0001 ? 'bg-emerald-600' : 'bg-sky-600';
        const statusText = diff !== null && Math.abs(diff) < 0.0001 ? '已對齊' : '已還原';

        const rowsHtml = recentRows
            .map((row) => {
                const diffText = row.diff !== null ? `${row.diff >= 0 ? '+' : ''}${formatNumber(row.diff)}` : '—';
                const diffClass = row.diff === null ? 'text-muted-foreground' : row.diff >= 0 ? 'text-emerald-600' : 'text-rose-600';
                return `<tr>
                        <td class="py-1 pr-2 text-left text-muted-foreground">${row.date}</td>
                        <td class="py-1 pr-2 text-right">${formatNumber(row.rawClose)}</td>
                        <td class="py-1 pr-2 text-right">${formatNumber(row.adjClose)}</td>
                        <td class="py-1 text-right ${diffClass}">${diffText}</td>
                    </tr>`;
            })
            .join('');

        contentEl.innerHTML = `
            <div class="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>最近交易日</span>
                <span>${latestDate}</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="p-3 border rounded-md bg-white/70">
                    <p class="text-[11px] text-muted-foreground">原始收盤</p>
                    <p class="text-lg font-semibold" style="color: var(--foreground);">${formatNumber(latestRaw?.close)}</p>
                    <p class="text-[11px] text-muted-foreground truncate">來源: ${rawSource || '未知'}</p>
                </div>
                <div class="p-3 border rounded-md ${diff !== null ? (diff >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200') : 'bg-white/70'}">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-[11px] text-muted-foreground">還原收盤</p>
                        <span class="px-2 py-0.5 text-[10px] text-white rounded-full ${statusClass}">${statusText}</span>
                    </div>
                    <p class="text-lg font-semibold" style="color: var(--foreground);">${formatNumber(latestAdjusted?.close)}</p>
                    <p class="text-[11px] text-muted-foreground truncate">來源: ${adjustedSource || '未知'}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-2">
                <div class="p-3 rounded-md border bg-muted/20">
                    <p class="text-[11px] text-muted-foreground">價差</p>
                    <p class="text-sm font-semibold">${diffLabel}</p>
                </div>
                <div class="p-3 rounded-md border bg-muted/20">
                    <p class="text-[11px] text-muted-foreground">還原倍率</p>
                    <p class="text-sm font-semibold">${ratioLabel}</p>
                </div>
            </div>
            <div class="mt-3">
                <p class="text-[11px] text-muted-foreground mb-1">最近三筆對比</p>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-xs">
                        <thead>
                            <tr class="text-muted-foreground">
                                <th class="text-left py-1 pr-2">日期</th>
                                <th class="text-right py-1 pr-2">原始收盤</th>
                                <th class="text-right py-1 pr-2">還原收盤</th>
                                <th class="text-right py-1">差值</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('[AdjustedComparison] 更新還原對比卡片失敗:', error);
        contentEl.innerHTML = `<p class="text-xs text-rose-600">還原股價對比更新失敗：${error.message}</p>`;
    } finally {
        if (adjustedComparisonState.lastContextKey === contextKey) {
            adjustedComparisonState.busy = false;
        }
    }
};

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
