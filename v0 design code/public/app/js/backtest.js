
// Patch Tag: LB-TW-DIRECTORY-20250620A
// Patch Tag: LB-STAGING-OPTIMIZER-20250627A
// Patch Tag: LB-COVERAGE-STREAM-20250705A
// Patch Tag: LB-TREND-SENSITIVITY-20250726A
// Patch Tag: LB-TREND-SENSITIVITY-20250817A
// Patch Tag: LB-TREND-REGRESSION-20250903A
// Patch Tag: LB-TODAY-SUGGESTION-20250904A
// Patch Tag: LB-TODAY-SUGGESTION-DEVLOG-20250905A
// Patch Tag: LB-TODAY-SUGGESTION-DIAG-20250907A
// Patch Tag: LB-TODAY-SUGGESTION-DIAG-20250908A
// Patch Tag: LB-TODAY-SUGGESTION-DIAG-20250909A
// Patch Tag: LB-REGIME-HMM-20251012A
// Patch Tag: LB-REGIME-RANGEBOUND-20251013A
// Patch Tag: LB-REGIME-FEATURES-20250718A
// Patch Tag: LB-INDEX-YAHOO-20250726A
// Patch Tag: LB-SENSITIVITY-ANNUAL-THRESHOLD-20250716A
// Patch Tag: LB-SENSITIVITY-ANNUAL-SCORE-20250730A
// Patch Tag: LB-PERFORMANCE-ANALYSIS-20260730A
// Patch Tag: LB-STRATEGY-ADVICE-20260730A
// Patch Tag: LB-COVERAGE-TAIWAN-20251029A

const ANNUALIZED_SENSITIVITY_THRESHOLDS = Object.freeze({
    driftStable: 6,
    driftCaution: 12,
    directionSafe: 6,
    directionWatch: 10,
    directionRisk: 12,
    summaryMaxComfort: 12,
    summaryMaxWatch: 18,
});

const ANNUALIZED_SENSITIVITY_SCORING = Object.freeze({
    comfortPenaltyMax: 10,
    cautionPenaltyMax: 30,
    overflowPenaltySlope: 4,
});

function resolveDriftPenaltyBandLabel(band, stable, caution) {
    switch (band) {
        case 'comfort':
            return `穩定區（≤ ${stable}pp）`;
        case 'caution':
            return `觀察區（${stable}～${caution}pp）`;
        case 'critical':
            return `警戒區（> ${caution}pp）`;
        default:
            return '';
    }
}

// 確保 zoom 插件正確註冊
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chart object:', typeof Chart);
    console.log('Available Chart plugins:', Chart.registry ? Object.keys(Chart.registry.plugins.items) : 'No registry');
});

document.addEventListener('DOMContentLoaded', () => {
    const shouldForceRefresh = !taiwanDirectoryState.cachedAt
        || (Date.now() - taiwanDirectoryState.cachedAt) > TAIWAN_DIRECTORY_CACHE_TTL_MS;
    ensureTaiwanDirectoryReady({ forceRefresh: shouldForceRefresh }).catch((error) => {
        console.warn('[Taiwan Directory] 預載入失敗:', error);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    renderBlobUsageCard();
    initTrendAnalysisToggle();
    initMultiStagePanel();
    updateDataSourceDisplay(null, null);
});

let lastPriceDebug = {
    steps: [],
    summary: null,
    adjustments: [],
    fallbackApplied: false,
    priceSource: null,
    dataSource: null,
    dataSources: [],
    priceMode: null,
    splitDiagnostics: null,
    finmindStatus: null,
};

let visibleStockData = [];
let lastIndicatorSeries = null;
let lastPositionStates = [];
let lastDatasetDiagnostics = null;
let lastRecentYearsSetting = null;

const ensureAIBridge = () => {
    if (typeof window === 'undefined') return null;
    if (!window.lazybacktestAIBridge || typeof window.lazybacktestAIBridge !== 'object') {
        window.lazybacktestAIBridge = {};
    }
    return window.lazybacktestAIBridge;
};

const updateAIBridgeMarket = (market) => {
    const bridge = ensureAIBridge();
    if (!bridge) return;
    const normalized = typeof market === 'string' ? market.toUpperCase() : null;
    bridge.currentMarket = normalized;
    if (typeof bridge.getCurrentMarket !== 'function') {
        bridge.getCurrentMarket = () => bridge.currentMarket;
    }
};

function setVisibleStockData(data) {
    visibleStockData = Array.isArray(data) ? data : [];
    const bridge = ensureAIBridge();
    if (bridge) {
        bridge.getVisibleStockData = () => (Array.isArray(visibleStockData) ? [...visibleStockData] : []);
        if (typeof bridge.handleVisibleDataUpdate === 'function') {
            try {
                bridge.handleVisibleDataUpdate(visibleStockData);
            } catch (error) {
                console.warn('[AI Bridge] handleVisibleDataUpdate failed:', error);
            }
        }
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
            window.dispatchEvent(
                new CustomEvent('lazybacktest:visible-data-changed', {
                    detail: { length: Array.isArray(visibleStockData) ? visibleStockData.length : 0 },
                })
            );
        } catch (error) {
            console.warn('[AI Bridge] dispatch visible-data-changed failed:', error);
        }
    }
    return visibleStockData;
}

function normaliseStrategyIdForRole(role, strategyId) {
    if (!strategyId) return strategyId;
    if (typeof window !== 'undefined' && window.LazyStrategyId) {
        if (typeof window.LazyStrategyId.normalise === 'function') {
            return window.LazyStrategyId.normalise(role, strategyId);
        }
        const table = window.LazyStrategyId.map?.[role];
        if (table && table[strategyId]) {
            return table[strategyId];
        }
    }
    if (role === 'exit' && ['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(strategyId)) {
        return `${strategyId}_exit`;
    }
    if (role === 'shortEntry' && !strategyId.startsWith('short_')) {
        return `short_${strategyId}`;
    }
    if (role === 'shortExit' && !strategyId.startsWith('cover_')) {
        return `cover_${strategyId}`;
    }
    return strategyId;
}

function normaliseStrategyIdAny(strategyId) {
    if (!strategyId) return strategyId;
    if (typeof window !== 'undefined' && window.LazyStrategyId) {
        if (typeof window.LazyStrategyId.normaliseAny === 'function') {
            return window.LazyStrategyId.normaliseAny(strategyId);
        }
        const maps = window.LazyStrategyId.map || {};
        for (const role of Object.keys(maps)) {
            const migrated = maps[role]?.[strategyId];
            if (migrated) {
                return migrated;
            }
        }
    }
    const exitCandidate = normaliseStrategyIdForRole('exit', strategyId);
    if (exitCandidate !== strategyId) return exitCandidate;
    const shortEntryCandidate = normaliseStrategyIdForRole('shortEntry', strategyId);
    if (shortEntryCandidate !== strategyId) return shortEntryCandidate;
    const shortExitCandidate = normaliseStrategyIdForRole('shortExit', strategyId);
    if (shortExitCandidate !== strategyId) return shortExitCandidate;
    return strategyId;
}

setVisibleStockData(visibleStockData);

function normaliseTextKey(value) {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'string' ? value : String(value);
    return text
        .trim()
        .replace(/[\s\u3000]+/g, '')
        .replace(/[。，．,.、；;！!？?（）()【】\[\]{}<>「」『』“”"'`~]/g, '')
        .toLowerCase();
}

function dedupeTextList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    list.forEach((item) => {
        if (!item && item !== 0) return;
        const text = typeof item === 'string' ? item.trim() : String(item).trim();
        if (!text) return;
        const key = normaliseTextKey(text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(text);
    });
    return result;
}

const todaySuggestionDeveloperLog = (() => {
    const MAX_ENTRIES = 30;
    const entries = [];
    let container = null;
    let clearBtn = null;
    let panel = null;
    let toggleBtn = null;
    let toggleLabel = null;
    let panelExpanded = false;
    let initialised = false;

    const severityClassMap = {
        success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        info: 'bg-sky-100 text-sky-700 border-sky-200',
        warning: 'bg-amber-100 text-amber-700 border-amber-200',
        error: 'bg-rose-100 text-rose-700 border-rose-200',
        neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    const severityLabelMap = {
        success: '成功',
        info: '資訊',
        warning: '提醒',
        error: '錯誤',
        neutral: '紀錄',
    };

    const priceModeLabelMap = {
        RAW: '原始收盤價',
        ADJ: '調整後價格',
    };

    const issueCodeDescriptions = {
        final_evaluation_missing: '回測未產生最終評估結果，需檢查暖身或策略是否產生倉位',
        latest_date_missing: '回傳資料缺少最新日期，請確認抓取範圍與資料筆數',
        final_evaluation_degraded_missing_price: '最新資料缺少有效收盤價，已回退至前一有效交易日',
    };

    function resolveIssueLabel(issueCode) {
        if (!issueCode) return null;
        const code = issueCode.toString();
        const description = issueCodeDescriptions[code];
        if (description) {
            return `${description}（${code}）`;
        }
        return `Issue Code：${code}`;
    }

    function setPanelExpanded(open) {
        panelExpanded = Boolean(open);
        if (panel) {
            panel.classList.toggle('hidden', !panelExpanded);
            panel.setAttribute('aria-hidden', panelExpanded ? 'false' : 'true');
        }
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', panelExpanded ? 'true' : 'false');
        }
        if (toggleLabel) {
            toggleLabel.textContent = panelExpanded ? '收合' : '展開';
        }
        if (toggleBtn) {
            const indicator = toggleBtn.querySelector('.toggle-indicator');
            if (indicator) {
                indicator.textContent = panelExpanded ? '－' : '＋';
            }
        }
    }

    function ensureElements() {
        if (initialised) return;
        container = document.getElementById('today-suggestion-log-body');
        clearBtn = document.getElementById('todaySuggestionLogClear');
        panel = document.getElementById('todaySuggestionLogPanel');
        toggleBtn = document.getElementById('todaySuggestionLogToggle');
        toggleLabel = toggleBtn ? toggleBtn.querySelector('.toggle-label') : null;
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                entries.length = 0;
                renderEntries();
            });
        }
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                setPanelExpanded(!panelExpanded);
            });
        }
        setPanelExpanded(false);
        initialised = true;
    }

    function cloneValue(value) {
        if (value === null || typeof value !== 'object') return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                console.warn('[TodaySuggestionLog] structuredClone failed, fallback to JSON clone.', error);
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            if (Array.isArray(value)) {
                return value.slice();
            }
            return { ...value };
        }
    }

    function formatTimestamp(timestamp) {
        const date = new Date(Number(timestamp));
        if (Number.isNaN(date.getTime())) return '—';
        if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
            try {
                return new Intl.DateTimeFormat('zh-TW', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                }).format(date);
            } catch (error) {
                console.warn('[TodaySuggestionLog] Failed to format timestamp with Intl.', error);
            }
        }
        const pad = (value) => String(value).padStart(2, '0');
        return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function resolveSeverity(entry) {
        const statusKey = (entry?.payload?.status || '').toString().toLowerCase();
        if (entry?.kind === 'error' || statusKey === 'error') {
            return 'error';
        }
        if (statusKey === 'ok') {
            return 'success';
        }
        if (statusKey === 'future_start') {
            return 'info';
        }
        if (statusKey === 'no_data') {
            return 'warning';
        }
        if (entry?.kind === 'warning') {
            return 'warning';
        }
        if (entry?.payload?.tone === 'error') {
            return 'error';
        }
        return 'neutral';
    }

    function resolvePriceModeLabel(modeKey) {
        if (!modeKey) return null;
        const key = typeof modeKey === 'string' ? modeKey.toUpperCase() : String(modeKey);
        return priceModeLabelMap[key] || null;
    }

    function buildSummaryParts(entry) {
        const parts = [];
        const latestDate = entry?.payload?.latestDate;
        if (latestDate) {
            parts.push(`最新 ${latestDate}`);
        }
        const highlight = entry?.meta?.highlightMessage || entry?.meta?.priceText;
        if (highlight) {
            parts.push(highlight);
        }
        const datasetRange = entry?.meta?.datasetRange;
        if (datasetRange) {
            const rowCount = Number.isFinite(entry?.meta?.rowsWithinRange)
                ? entry.meta.rowsWithinRange
                : Number.isFinite(entry?.meta?.datasetRows)
                    ? entry.meta.datasetRows
                    : null;
            const modeLabel = resolvePriceModeLabel(entry?.meta?.priceMode || entry?.payload?.priceMode);
            const coverageText = Number.isFinite(entry?.meta?.coverageSegments) && entry.meta.coverageSegments > 0
                ? `覆蓋 ${entry.meta.coverageSegments} 段`
                : null;
            const segmentParts = [`區間 ${datasetRange}`];
            if (rowCount !== null) {
                segmentParts.push(`${rowCount} 筆${modeLabel ? `（${modeLabel}）` : ''}`);
            } else if (modeLabel) {
                segmentParts.push(modeLabel);
            }
            if (coverageText) segmentParts.push(coverageText);
            parts.push(segmentParts.join(' ・ '));
        }
        if (entry?.meta?.positionSummary && entry.meta.positionSummary !== '—') {
            parts.push(`部位 ${entry.meta.positionSummary}`);
        }
        if (entry?.meta?.longText && entry.meta.longText !== '—') {
            parts.push(`多單 ${entry.meta.longText}`);
        }
        if (entry?.meta?.shortText && entry.meta.shortText !== '—') {
            parts.push(`空單 ${entry.meta.shortText}`);
        }
        if (Number.isFinite(entry?.meta?.dataLagDays) && entry.meta.dataLagDays > 0) {
            parts.push(`資料延遲 ${entry.meta.dataLagDays} 日`);
        }
        if (entry?.meta?.finalStateLabel && entry.meta.finalStateDate) {
            parts.push(`模擬最終狀態 ${entry.meta.finalStateLabel}（${entry.meta.finalStateDate}）`);
        } else if (entry?.meta?.finalStateLabel) {
            parts.push(`模擬最終狀態 ${entry.meta.finalStateLabel}`);
        }
        if (entry?.meta?.pendingTradeLabel) {
            parts.push(`待執行交易 ${entry.meta.pendingTradeLabel}`);
        }
        if (entry?.meta?.finalEvaluationCaptured === false) {
            parts.push('finalEvaluation 未捕捉');
        }
        if (entry?.meta?.finalStateReason) {
            parts.push(entry.meta.finalStateReason);
        }
        const issueLabel = resolveIssueLabel(entry?.payload?.issueCode || entry?.meta?.issueCode);
        if (issueLabel) {
            parts.push(issueLabel);
        }
        return dedupeTextList(parts);
    }

    function buildDetailSections(entry) {
        const userFacing = [];
        if (entry?.payload?.message) {
            userFacing.push(entry.payload.message);
        }
        if (Array.isArray(entry?.payload?.notes)) {
            userFacing.push(...entry.payload.notes);
        }
        const developerNotes = [];
        if (Array.isArray(entry?.payload?.developerNotes)) {
            developerNotes.push(...entry.payload.developerNotes);
        }
        const issueLabel = resolveIssueLabel(entry?.payload?.issueCode || entry?.meta?.issueCode);
        if (issueLabel) {
            developerNotes.unshift(issueLabel);
        }
        if (entry?.meta?.finalStateLabel && entry.meta.finalStateDate) {
            developerNotes.push(`模擬最終狀態：${entry.meta.finalStateLabel}（${entry.meta.finalStateDate}）`);
        } else if (entry?.meta?.finalStateLabel) {
            developerNotes.push(`模擬最終狀態：${entry.meta.finalStateLabel}`);
        }
        if (entry?.meta?.pendingTradeLabel) {
            developerNotes.push(`待執行交易：${entry.meta.pendingTradeLabel}`);
        }
        if (entry?.meta?.finalEvaluationCaptured === false) {
            developerNotes.push('runStrategy 未產生 finalEvaluation');
        }
        if (entry?.meta?.finalStateReason) {
            developerNotes.push(`finalState 診斷：${entry.meta.finalStateReason}`);
        }
        if (entry?.meta?.datasetLastDate && entry?.meta?.finalEvaluationDate && entry.meta.datasetLastDate !== entry.meta.finalEvaluationDate) {
            developerNotes.push(`資料最後日期 ${entry.meta.datasetLastDate} 缺少有效收盤價，已回退至 ${entry.meta.finalEvaluationDate} 推導建議。`);
        }
        if (Number.isFinite(entry?.meta?.finalEvaluationFallbackLagDays)) {
            developerNotes.push(`最新有效建議日期落後資料最後日期 ${entry.meta.finalEvaluationFallbackLagDays} 日。`);
        }
        if (Number.isFinite(entry?.meta?.finalEvaluationFallbackLagBars)) {
            developerNotes.push(`資料索引落後 ${entry.meta.finalEvaluationFallbackLagBars} 筆。`);
        }
        if (entry?.meta?.finalEvaluationFallbackFromDate && entry?.meta?.finalEvaluationRequestedLastDate) {
            developerNotes.push(`finalEvaluation fallback ${entry.meta.finalEvaluationFallbackFromDate} ← ${entry.meta.finalEvaluationRequestedLastDate}`);
        }
        if (entry?.meta?.finalStateSnapshotDate && entry.meta.finalStateSnapshotDate !== entry.meta.finalStateDate) {
            developerNotes.push(`finalState 快照原始日期：${entry.meta.finalStateSnapshotDate}`);
        }
        if (entry?.meta?.finalStateLatestValidDate && entry.meta.finalStateLatestValidDate !== entry.meta.finalStateDate) {
            developerNotes.push(`最新有效倉位日期：${entry.meta.finalStateLatestValidDate}`);
        }
        if (entry?.meta?.missingFinalClose) {
            developerNotes.push('最新資料列缺少有效收盤價');
        }

        const diagnostics = [];
        const modeLabel = resolvePriceModeLabel(entry?.meta?.priceMode || entry?.payload?.priceMode);
        if (modeLabel) {
            diagnostics.push(`價格模式：${modeLabel}`);
        }
        if (entry?.meta?.datasetRange) {
            diagnostics.push(`資料區間：${entry.meta.datasetRange}`);
        }
        if (Number.isFinite(entry?.meta?.datasetRows)) {
            diagnostics.push(`總筆數：${entry.meta.datasetRows}`);
        }
        if (Number.isFinite(entry?.meta?.rowsWithinRange)) {
            diagnostics.push(`使用者區間筆數：${entry.meta.rowsWithinRange}`);
        }
        if (Number.isFinite(entry?.meta?.warmupRows)) {
            diagnostics.push(`暖身筆數：${entry.meta.warmupRows}`);
        }
        if (Number.isFinite(entry?.meta?.rowCount)) {
            diagnostics.push(`回傳資料筆數：${entry.meta.rowCount}`);
        }
        if (Number.isFinite(entry?.meta?.lookbackDaysUsed)) {
            diagnostics.push(`計算暖身天數：${entry.meta.lookbackDaysUsed}`);
        }
        if (Number.isFinite(entry?.meta?.lookbackResolved)) {
            diagnostics.push(`暖身推算結果：${entry.meta.lookbackResolved}`);
        }
        if (entry?.meta?.startDateUsed) {
            diagnostics.push(`策略起算日：${entry.meta.startDateUsed}`);
        }
        if (entry?.meta?.dataStartDateUsed) {
            diagnostics.push(`暖身起點：${entry.meta.dataStartDateUsed}`);
        }
        if (entry?.meta?.todayISO) {
            diagnostics.push(`請求日期：${entry.meta.todayISO}`);
        }
        if (Number.isFinite(entry?.meta?.firstValidGap)) {
            const firstValidDate = entry?.meta?.firstValidDate
                ? `（${entry.meta.firstValidDate}）`
                : '';
            diagnostics.push(`暖身後首筆有效收盤落後 ${entry.meta.firstValidGap} 日${firstValidDate}`);
        } else if (entry?.meta?.firstValidDate) {
            diagnostics.push(`暖身後首筆有效收盤：${entry.meta.firstValidDate}`);
        }
        if (entry?.meta?.fetchRange) {
            const start = entry.meta.fetchRange?.start || '未知';
            const end = entry.meta.fetchRange?.end || '未知';
            diagnostics.push(`抓取範圍：${start} ~ ${end}`);
        }
        if (entry?.meta?.dataSource) {
            diagnostics.push(`資料來源：${entry.meta.dataSource}`);
        }
        if (entry?.meta?.priceSource) {
            diagnostics.push(`價格來源：${entry.meta.priceSource}`);
        }
        if (entry?.meta?.coverageFingerprint) {
            diagnostics.push(`Coverage Fingerprint：${entry.meta.coverageFingerprint}`);
        }
        if (Number.isFinite(entry?.meta?.coverageSegments)) {
            diagnostics.push(`覆蓋區段 ${entry.meta.coverageSegments} 段`);
        }
        if (entry?.meta?.finalStateDate) {
            diagnostics.push(`模擬最終日期：${entry.meta.finalStateDate}`);
        }
        if (entry?.meta?.finalPortfolioValue) {
            diagnostics.push(`模擬最終市值：${entry.meta.finalPortfolioValue}`);
        }
        if (entry?.meta?.finalStrategyReturn) {
            diagnostics.push(`模擬報酬率：${entry.meta.finalStrategyReturn}`);
        }
        if (entry?.meta?.finalLongShares) {
            diagnostics.push(`多單股數：${entry.meta.finalLongShares}`);
        }
        if (entry?.meta?.finalShortShares) {
            diagnostics.push(`空單股數：${entry.meta.finalShortShares}`);
        }

        const sections = [];
        const dedupedUserFacing = dedupeTextList(userFacing);
        if (dedupedUserFacing.length > 0) {
            sections.push({ title: '使用者提示', items: dedupedUserFacing });
        }
        const dedupedDeveloper = dedupeTextList(developerNotes);
        if (dedupedDeveloper.length > 0) {
            sections.push({ title: '開發者備註', items: dedupedDeveloper });
        }
        const dedupedDiagnostics = dedupeTextList(diagnostics);
        if (dedupedDiagnostics.length > 0) {
            sections.push({ title: '資料診斷', items: dedupedDiagnostics });
        }

        return sections;
    }

    function renderEntries() {
        ensureElements();
        if (!container) return;
        if (entries.length === 0) {
            container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">執行回測後，會在此列出今日建議的狀態與錯誤訊息。</div>`;
            return;
        }

        const html = entries
            .map((entry) => {
                const severity = resolveSeverity(entry);
                const badgeClass = severityClassMap[severity] || severityClassMap.neutral;
                const severityLabel = severityLabelMap[severity] || severityLabelMap.neutral;
                const statusLabel = (entry?.payload?.status || entry?.meta?.status || severity).toString();
                const label = entry?.payload?.label || (entry?.kind === 'error' ? '計算失敗' : '—');
                const summaryParts = buildSummaryParts(entry)
                    .map((part) => `<span>${escapeHtml(part)}</span>`)
                    .join('');
                const summaryHtml = summaryParts
                    ? `<div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px]" style="color: var(--muted-foreground);">${summaryParts}</div>`
                    : '';
                const detailSections = buildDetailSections(entry)
                    .map((section) => {
                        const itemsHtml = section.items
                            .map((note) => `<li>${escapeHtml(note)}</li>`)
                            .join('');
                        return `
                            <div class="space-y-0.5">
                                <div class="font-medium" style="color: var(--foreground);">${escapeHtml(section.title)}</div>
                                <ul class="list-disc list-inside space-y-0.5">${itemsHtml}</ul>
                            </div>
                        `;
                    })
                    .join('');
                const detailsHtml = detailSections
                    ? `<div class="space-y-1.5">${detailSections}</div>`
                    : '';

                return `
                    <div class="border rounded-md px-3 py-2 space-y-1 text-[11px]" style="border-color: var(--border);">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <span class="font-medium" style="color: var(--foreground);">${escapeHtml(label)}</span>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${badgeClass}">
                                    <span>${escapeHtml(severityLabel)}</span>
                                    <span style="color: var(--muted-foreground);">${escapeHtml(statusLabel)}</span>
                                </span>
                            </div>
                            <span class="text-[10px]" style="color: var(--muted-foreground);">${escapeHtml(formatTimestamp(entry.timestamp))}</span>
                        </div>
                        ${summaryHtml}
                        ${detailsHtml}
                    </div>
                `;
            })
            .join('');
        container.innerHTML = html;
    }

    return {
        record(kind, payload = {}, meta = {}) {
            ensureElements();
            const entry = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                timestamp: Date.now(),
                kind: kind || 'info',
                payload: cloneValue(payload),
                meta: cloneValue(meta),
            };
            entries.unshift(entry);
            if (entries.length > MAX_ENTRIES) {
                entries.length = MAX_ENTRIES;
            }
            renderEntries();
        },
        clear() {
            entries.length = 0;
            renderEntries();
        },
        render() {
            renderEntries();
        },
        getEntries() {
            return entries.slice();
        },
    };
})();

window.lazybacktestTodaySuggestionLog = todaySuggestionDeveloperLog;

document.addEventListener('DOMContentLoaded', () => {
    try {
        todaySuggestionDeveloperLog.render();
    } catch (error) {
        console.warn('[TodaySuggestionLog] Failed to render on DOMContentLoaded.', error);
    }
});

const todaySuggestionUI = (() => {
    const area = document.getElementById('today-suggestion-area');
    const body = document.getElementById('today-suggestion-body');
    const empty = document.getElementById('today-suggestion-empty');
    const banner = document.getElementById('today-suggestion-banner');
    const labelEl = document.getElementById('today-suggestion-label');
    const dateEl = document.getElementById('today-suggestion-date');
    const messageEl = document.getElementById('today-suggestion-message');
    const longEl = document.getElementById('today-suggestion-long');
    const shortEl = document.getElementById('today-suggestion-short');
    const positionEl = document.getElementById('today-suggestion-position');
    const portfolioEl = document.getElementById('today-suggestion-portfolio');
    const notesEl = document.getElementById('today-suggestion-notes');
    const notesContainer = document.getElementById('today-suggestion-notes-container');
    const statsWrapper = document.getElementById('today-suggestion-stats-wrapper');
    const statsToggle = document.getElementById('today-suggestion-stats-toggle');
    const statsToggleLabel = statsToggle ? statsToggle.querySelector('.toggle-label') : null;
    const statsControls = document.getElementById('today-suggestion-controls');
    const toneClasses = ['is-bullish', 'is-bearish', 'is-exit', 'is-neutral', 'is-info', 'is-warning', 'is-error'];
    const numberFormatter = typeof Intl !== 'undefined'
        ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 })
        : { format: (value) => (Number.isFinite(value) ? value.toString() : '—') };
    const integerFormatter = typeof Intl !== 'undefined'
        ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })
        : { format: (value) => (Number.isFinite(value) ? value.toString() : '—') };
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
    const priceTypeLabel = {
        close: '收盤',
        open: '開盤',
        high: '最高',
        low: '最低',
    };

    let statsExpanded = false;

    function setStatsExpanded(open) {
        statsExpanded = Boolean(open);
        if (statsWrapper) {
            statsWrapper.classList.toggle('hidden', !statsExpanded);
            statsWrapper.setAttribute('aria-hidden', statsExpanded ? 'false' : 'true');
        }
        if (statsToggle) {
            statsToggle.setAttribute('aria-expanded', statsExpanded ? 'true' : 'false');
            const indicator = statsToggle.querySelector('.toggle-indicator');
            if (indicator) {
                indicator.textContent = statsExpanded ? '－' : '＋';
            }
        }
        if (statsToggleLabel) {
            statsToggleLabel.textContent = statsExpanded ? '隱藏部位概況' : '顯示部位概況';
        }
    }

    function setStatsControlsVisible(visible) {
        if (statsControls) {
            statsControls.classList.toggle('hidden', !visible);
        }
        if (statsToggle) {
            statsToggle.disabled = !visible;
        }
        if (!visible) {
            setStatsExpanded(false);
        }
    }

    if (statsToggle) {
        statsToggle.addEventListener('click', () => {
            setStatsExpanded(!statsExpanded);
        });
    }

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

    function setText(el, text) {
        if (!el) return;
        el.textContent = text ?? '—';
    }

    function formatPriceValue(value, type) {
        if (!Number.isFinite(value)) return null;
        const formatted = numberFormatter.format(value);
        if (!type) return `${formatted} 元`;
        const label = priceTypeLabel[type] || '價格';
        return `${label} ${formatted} 元`;
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

    function setNotes(notes, options = {}) {
        if (!notesEl) return;
        notesEl.innerHTML = '';
        const source = Array.isArray(notes) ? notes : [];
        const dedupedNotes = options.skipDedup
            ? source
                .map((note) => {
                    if (note === null || note === undefined) return '';
                    return typeof note === 'string' ? note.trim() : String(note).trim();
                })
                .filter((note) => note.length > 0)
            : dedupeTextList(source);
        if (dedupedNotes.length === 0) {
            notesEl.style.display = 'none';
            if (notesContainer) notesContainer.classList.add('hidden');
            return;
        }
        notesEl.style.display = 'block';
        if (notesContainer) notesContainer.classList.remove('hidden');
        dedupedNotes.forEach((note) => {
            if (!note) return;
            const li = document.createElement('li');
            li.textContent = note;
            notesEl.appendChild(li);
        });
    }

    function applyResultPayload(payload) {
        setStatsExpanded(false);
        const statusKey = (payload.status || 'ok').toString().toLowerCase();
        const dedupedNotes = dedupeTextList(Array.isArray(payload.notes) ? payload.notes : []);
        const highlightText = dedupedNotes.length > 0
            ? dedupedNotes[0]
            : (payload.message || '—');
        setText(labelEl, payload.label || '—');
        const lagDays = Number.isFinite(payload.dataLagDays) ? payload.dataLagDays : null;
        let dateText = payload.latestDate || '';
        if (lagDays !== null && lagDays > 0) {
            const dayLabel = lagDays === 1 ? '距今日 1 日' : `距今日 ${lagDays} 日`;
            dateText = dateText ? `${dateText}（${dayLabel}）` : dayLabel;
        }
        setText(dateEl, dateText || '—');
        setText(messageEl, highlightText || '—');
        payload.highlightMessage = highlightText;
        setText(longEl, describePosition(payload.longPosition));
        setText(shortEl, describePosition(payload.shortPosition));
        setText(positionEl, payload.positionSummary || '—');
        if (portfolioEl) {
            const portfolioText = formatCurrency(payload.evaluation?.portfolioValue);
            setText(portfolioEl, portfolioText || '—');
        }
        setNotes(dedupedNotes.slice(1), { skipDedup: true });
        setStatsControlsVisible(statusKey === 'ok');
    }

    setStatsControlsVisible(false);

    return {
        reset() {
            if (!area) return;
            ensureAreaVisible();
            showPlaceholderContent();
            setTone('neutral');
            setText(labelEl, '尚未產生建議');
            setText(dateEl, '—');
            setText(messageEl, '—');
            setText(longEl, '—');
            setText(shortEl, '—');
            setText(positionEl, '—');
            if (portfolioEl) setText(portfolioEl, '—');
            setNotes([]);
            setStatsControlsVisible(false);
        },
        showLoading() {
            if (!area) return;
            ensureAreaVisible();
            showBodyContent();
            setTone('info');
            setText(labelEl, '取得今日建議中...');
            setText(dateEl, '—');
            setText(messageEl, '資料同步中，請稍候取得最新操作提示');
            setText(longEl, '—');
            setText(shortEl, '—');
            setText(positionEl, '—');
            if (portfolioEl) setText(portfolioEl, '—');
            setNotes([]);
            setStatsControlsVisible(false);
        },
        showResult(payload = {}) {
            if (!area) return;
            ensureAreaVisible();
            showBodyContent();
            const status = payload.status || 'ok';
            const fallbackNotes = [];
            let displayPayload = payload;
            let tone = payload.tone || 'neutral';
            if (status !== 'ok') {
                if (payload.message) fallbackNotes.push(payload.message);
                if (Array.isArray(payload.notes)) fallbackNotes.push(...payload.notes);
                const dedupedNotes = dedupeTextList(fallbackNotes);
                tone = status === 'no_data' ? 'warning' : status === 'future_start' ? 'info' : 'neutral';
                displayPayload = {
                    ...payload,
                    status,
                    tone,
                    label: payload.label || (status === 'future_start' ? '策略尚未開始' : '無法取得建議'),
                    latestDate: payload.latestDate || '—',
                    price: { text: payload.price?.text || payload.message || '—' },
                    longPosition: { state: '空手' },
                    shortPosition: { state: '空手' },
                    positionSummary: '—',
                    notes: dedupedNotes,
                    evaluation: payload.evaluation || {},
                };
            }
            setTone(tone);
            applyResultPayload(displayPayload);
            if (window.lazybacktestTodaySuggestionLog && typeof window.lazybacktestTodaySuggestionLog.record === 'function') {
                const highlightMessage = displayPayload.highlightMessage
                    || displayPayload.message
                    || displayPayload.price?.text
                    || formatPriceValue(displayPayload.price?.value, displayPayload.price?.type)
                    || '—';
                const meta = {
                    status,
                    highlightMessage,
                    priceText: highlightMessage,
                    longText: describePosition(displayPayload.longPosition),
                    shortText: describePosition(displayPayload.shortPosition),
                    positionSummary: displayPayload.positionSummary || '—',
                };
                if (Number.isFinite(displayPayload.dataLagDays)) {
                    meta.dataLagDays = displayPayload.dataLagDays;
                }
                if (Number.isFinite(displayPayload.lookbackDaysUsed)) {
                    meta.lookbackDaysUsed = displayPayload.lookbackDaysUsed;
                }
                if (Number.isFinite(displayPayload.rowCount)) {
                    meta.rowCount = displayPayload.rowCount;
                }
                if (displayPayload.priceMode) {
                    meta.priceMode = displayPayload.priceMode;
                }
                if (displayPayload.dataSource) {
                    meta.dataSource = displayPayload.dataSource;
                }
                if (displayPayload.priceSource) {
                    meta.priceSource = displayPayload.priceSource;
                }
                if (displayPayload.issueCode) {
                    meta.issueCode = displayPayload.issueCode;
                }
                if (displayPayload.startDateUsed) {
                    meta.startDateUsed = displayPayload.startDateUsed;
                }
                if (displayPayload.dataStartDateUsed) {
                    meta.dataStartDateUsed = displayPayload.dataStartDateUsed;
                }
                if (displayPayload.todayISO) {
                    meta.todayISO = displayPayload.todayISO;
                }
                if (displayPayload.fetchRange && typeof displayPayload.fetchRange === 'object') {
                    meta.fetchRange = displayPayload.fetchRange;
                }
                if (displayPayload.coverageFingerprint) {
                    meta.coverageFingerprint = displayPayload.coverageFingerprint;
                }
                if (Array.isArray(displayPayload.coverage)) {
                    meta.coverageSegments = displayPayload.coverage.length;
                }
                if (displayPayload.datasetLastDate) {
                    meta.datasetLastDate = displayPayload.datasetLastDate;
                }
                if (displayPayload.evaluationDate) {
                    meta.finalEvaluationDate = displayPayload.evaluationDate;
                }
                if (Number.isFinite(displayPayload.evaluationLagFromDatasetDays)) {
                    meta.finalEvaluationFallbackLagDays = displayPayload.evaluationLagFromDatasetDays;
                }
                if (displayPayload.dataset && typeof displayPayload.dataset === 'object') {
                    const ds = displayPayload.dataset;
                    const rangeStart = ds.firstDate
                        || ds.firstRowOnOrAfterEffectiveStart?.date
                        || null;
                    const rangeEnd = ds.lastDate || null;
                    if (rangeStart || rangeEnd) {
                        meta.datasetRange = rangeStart && rangeEnd && rangeStart !== rangeEnd
                            ? `${rangeStart} ~ ${rangeEnd}`
                            : rangeStart || rangeEnd;
                    }
                    if (Number.isFinite(ds.totalRows)) {
                        meta.datasetRows = ds.totalRows;
                    }
                    if (Number.isFinite(ds.rowsWithinRange)) {
                        meta.rowsWithinRange = ds.rowsWithinRange;
                    }
                    if (Number.isFinite(ds.warmupRows)) {
                        meta.warmupRows = ds.warmupRows;
                    }
                    if (Number.isFinite(ds.firstValidCloseGapFromEffective)) {
                        meta.firstValidGap = ds.firstValidCloseGapFromEffective;
                    }
                    if (ds.firstValidCloseOnOrAfterEffectiveStart?.date) {
                        meta.firstValidDate = ds.firstValidCloseOnOrAfterEffectiveStart.date;
                    }
                }
                if (displayPayload.warmup && typeof displayPayload.warmup === 'object') {
                    const warmup = displayPayload.warmup;
                    if (Number.isFinite(warmup.lookbackDays)) {
                        meta.lookbackResolved = warmup.lookbackDays;
                    }
                }
                if (displayPayload.strategyDiagnostics && typeof displayPayload.strategyDiagnostics === 'object') {
                    const finalState = displayPayload.strategyDiagnostics.finalState;
                    if (finalState && typeof finalState === 'object') {
                        const evaluationDate = displayPayload.evaluation?.date || null;
                        if (finalState.snapshot && typeof finalState.snapshot === 'object') {
                            const snapshot = finalState.snapshot;
                            const snapshotDate = snapshot.date || null;
                            const resolvedFinalDate = evaluationDate || snapshotDate;
                            if (resolvedFinalDate) {
                                meta.finalStateDate = resolvedFinalDate;
                            } else if (snapshotDate) {
                                meta.finalStateDate = snapshotDate;
                            }
                            if (snapshotDate && evaluationDate && snapshotDate !== evaluationDate) {
                                meta.finalStateSnapshotDate = snapshotDate;
                            }
                            if (snapshot.latestValidDate) {
                                meta.finalStateLatestValidDate = snapshot.latestValidDate;
                            }
                            if (Number.isFinite(snapshot.fallbackLagDays)) {
                                meta.finalEvaluationFallbackLagDays = snapshot.fallbackLagDays;
                            }
                            if (Number.isFinite(snapshot.fallbackLagBars)) {
                                meta.finalEvaluationFallbackLagBars = snapshot.fallbackLagBars;
                            }
                            if (typeof snapshot.missingFinalClose === 'boolean') {
                                meta.missingFinalClose = snapshot.missingFinalClose;
                            }
                            const stateParts = [];
                            if (snapshot.longState) {
                                stateParts.push(`多單 ${snapshot.longState}`);
                            }
                            if (snapshot.shortState) {
                                stateParts.push(`空單 ${snapshot.shortState}`);
                            }
                            if (stateParts.length > 0) {
                                meta.finalStateLabel = stateParts.join('，');
                            }
                            if (Number.isFinite(snapshot.portfolioValue)) {
                                meta.finalPortfolioValue = `${numberFormatter.format(snapshot.portfolioValue)} 元`;
                            }
                            if (Number.isFinite(snapshot.strategyReturn)) {
                                meta.finalStrategyReturn = `${numberFormatter.format(snapshot.strategyReturn)}%`;
                            }
                            if (Number.isFinite(snapshot.longShares)) {
                                meta.finalLongShares = `${integerFormatter.format(snapshot.longShares)} 股`;
                            }
                            if (Number.isFinite(snapshot.shortShares)) {
                                meta.finalShortShares = `${integerFormatter.format(snapshot.shortShares)} 股`;
                            }
                        }
                        if (displayPayload.evaluation && typeof displayPayload.evaluation.meta === 'object') {
                            const evalMeta = displayPayload.evaluation.meta;
                            if (evalMeta.fallbackReason && !meta.finalStateReason) {
                                meta.finalStateReason = evalMeta.fallbackReason;
                            }
                            if (evalMeta.fallbackFromDate) {
                                meta.finalEvaluationFallbackFromDate = evalMeta.fallbackFromDate;
                            }
                            if (evalMeta.requestedLastDate) {
                                meta.finalEvaluationRequestedLastDate = evalMeta.requestedLastDate;
                            }
                            if (Number.isFinite(evalMeta.fallbackLagDays)) {
                                meta.finalEvaluationFallbackLagDays = evalMeta.fallbackLagDays;
                            }
                            if (Number.isFinite(evalMeta.fallbackLagBars)) {
                                meta.finalEvaluationFallbackLagBars = evalMeta.fallbackLagBars;
                            }
                            if (typeof evalMeta.missingFinalClose === 'boolean') {
                                meta.missingFinalClose = evalMeta.missingFinalClose;
                            }
                        }
                        if (finalState.pendingNextDayTrade && typeof finalState.pendingNextDayTrade === 'object') {
                            const pending = finalState.pendingNextDayTrade;
                            const pendingParts = [];
                            if (pending.type || pending.action) {
                                pendingParts.push(pending.type || pending.action);
                            }
                            if (pending.strategy) {
                                pendingParts.push(pending.strategy);
                            }
                            if (pending.reason) {
                                pendingParts.push(pending.reason);
                            }
                            if (pending.triggeredAt) {
                                pendingParts.push(`觸發於 ${pending.triggeredAt}`);
                            }
                            if (pending.plannedDate) {
                                pendingParts.push(`預計日期 ${pending.plannedDate}`);
                            }
                            if (pendingParts.length > 0) {
                                meta.pendingTradeLabel = pendingParts.join('｜');
                            }
                        }
                        if (typeof finalState.captured === 'boolean') {
                            meta.finalEvaluationCaptured = finalState.captured;
                        }
                        if (finalState.reason) {
                            meta.finalStateReason = finalState.reason;
                        }
                        if (finalState.fallback && typeof finalState.fallback === 'object') {
                            meta.finalStateFallback = finalState.fallback;
                            if (!meta.finalStateReason && finalState.fallback.fallbackReason) {
                                meta.finalStateReason = finalState.fallback.fallbackReason;
                            }
                        }
                        if (Number.isFinite(finalState.evaluationIndex)) {
                            meta.finalEvaluationIndex = finalState.evaluationIndex;
                        }
                        if (finalState.datasetLastDate) {
                            meta.datasetLastDate = finalState.datasetLastDate;
                        }
                        if (finalState.lastValidEvaluationDate && !meta.finalEvaluationDate) {
                            meta.finalEvaluationDate = finalState.lastValidEvaluationDate;
                        }
                    }
                }
                window.lazybacktestTodaySuggestionLog.record(
                    status === 'ok' ? 'result' : 'warning',
                    displayPayload,
                    meta,
                );
            }
        },
        showError(message) {
            if (!area) return;
            ensureAreaVisible();
            showBodyContent();
            setTone('error');
            const displayPayload = {
                status: 'error',
                label: '計算失敗',
                latestDate: '—',
                price: { text: message || '計算建議時發生錯誤' },
                longPosition: { state: '空手' },
                shortPosition: { state: '空手' },
                positionSummary: '—',
                notes: message ? [message] : [],
                evaluation: {},
            };
            applyResultPayload(displayPayload);
            if (window.lazybacktestTodaySuggestionLog && typeof window.lazybacktestTodaySuggestionLog.record === 'function') {
                const highlightMessage = displayPayload.highlightMessage
                    || displayPayload.message
                    || displayPayload.price?.text
                    || '—';
                window.lazybacktestTodaySuggestionLog.record('error', displayPayload, {
                    status: 'error',
                    highlightMessage,
                    priceText: highlightMessage,
                    longText: describePosition(displayPayload.longPosition),
                    shortText: describePosition(displayPayload.shortPosition),
                    positionSummary: displayPayload.positionSummary || '—',
                });
            }
        },
        showPlaceholder() {
            if (!area) return;
            ensureAreaVisible();
            showPlaceholderContent();
            setNotes([]);
            setStatsControlsVisible(false);
        },
    };
})();

window.lazybacktestTodaySuggestion = todaySuggestionUI;

const BACKTEST_DAY_MS = 24 * 60 * 60 * 1000;
const START_GAP_TOLERANCE_DAYS = 7;
const START_GAP_RETRY_MS = 6 * 60 * 60 * 1000; // 六小時後再嘗試重新抓取
const DATA_CACHE_INDEX_KEY = 'LB_DATA_CACHE_INDEX_V20250723A';
const DATA_CACHE_VERSION = 'LB-SUPERSET-CACHE-20250723A';
const TW_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const US_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const DEFAULT_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const SESSION_DATA_CACHE_VERSION = 'LB-SUPERSET-CACHE-20250723A';
const SESSION_DATA_CACHE_INDEX_KEY = 'LB_SESSION_DATA_CACHE_INDEX_V20250723A';
const SESSION_DATA_CACHE_ENTRY_PREFIX = 'LB_SESSION_DATA_CACHE_ENTRY_V20250723A::';
const SESSION_DATA_CACHE_LIMIT = 24;

const STRATEGY_STATUS_VERSION = 'LB-STRATEGY-STATUS-20260802A';

const STRATEGY_STATUS_CONFIG = {
    idle: {
        badgeText: '待回測',
        badgeStyle: {
            backgroundColor: 'color-mix(in srgb, var(--muted) 28%, transparent)',
            color: 'var(--muted-foreground)',
        },
        title: '尚未啟動策略摘要',
        subtitle: '請先執行一次回測，我們會整理策略與買入持有的比較結果。',
    },
    loading: {
        badgeText: '計算中',
        badgeStyle: {
            backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
            color: 'var(--accent)',
        },
        title: '正在整理回測摘要',
        subtitle: '系統正同步績效、指標與建議，稍後將更新重點。',
    },
    leading: {
        badgeText: '策略領先',
        badgeStyle: {
            backgroundColor: 'rgba(16, 185, 129, 0.18)',
            color: 'rgb(5, 122, 85)',
        },
        title: '策略暫時領先買入持有',
        subtitle: '請記錄當前行情與設定，並檢視是否需要鎖定獲利與控管風險。',
    },
    tie: {
        badgeText: '差距接近',
        badgeStyle: {
            backgroundColor: 'rgba(251, 191, 36, 0.18)',
            color: 'rgb(180, 83, 9)',
        },
        title: '策略與買入持有差距不大',
        subtitle: '兩者表現相近，建議搭配更多指標或延長觀察區間。',
    },
    behind: {
        badgeText: '策略落後',
        badgeStyle: {
            backgroundColor: 'rgba(248, 113, 113, 0.18)',
            color: 'rgb(220, 38, 38)',
        },
        title: '買入持有暫時表現較好',
        subtitle: '請檢視交易條件、資金控管與擾動結果，找出需要調整的設定。',
    },
    missing: {
        badgeText: '等待資料',
        badgeStyle: {
            backgroundColor: 'rgba(148, 163, 184, 0.2)',
            color: 'rgb(71, 85, 105)',
        },
        title: '仍在取得比較基準',
        subtitle: '買入持有基準尚未回傳，請先完成回測或重新整理資料。',
    },
    error: {
        badgeText: '摘要失敗',
        badgeStyle: {
            backgroundColor: 'rgba(248, 113, 113, 0.24)',
            color: 'rgb(185, 28, 28)',
        },
        title: '策略摘要暫停更新',
        subtitle: '計算過程發生例外，請重新執行回測或調整參數後再試。',
    },
};

const strategyStatusElements = (() => {
    if (typeof document === 'undefined') {
        return {};
    }
    return {
        card: document.getElementById('strategy-status-card') || null,
        badge: document.getElementById('strategy-status-badge') || null,
        diff: document.getElementById('strategy-status-diff') || null,
        title: document.getElementById('strategy-status-title') || null,
        subtitle: document.getElementById('strategy-status-subtitle') || null,
        detail: document.getElementById('strategy-status-detail') || null,
    };
})();

function formatPercentSigned(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(digits)}%`;
}

function splitSummaryIntoBulletLines(content) {
    if (!content) return [];
    if (Array.isArray(content)) {
        return content.flatMap((item) => splitSummaryIntoBulletLines(item));
    }
    if (typeof content === 'string') {
        return content
            .split(/\n+/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }
    return [];
}

function renderStrategyStatusDetail({
    emphasisedLine = null,
    bulletLines = [],
    detailHTML = null,
    collapsible = false,
    collapsibleSummary = '展開重點條列',
} = {}) {
    const detailEl = strategyStatusElements.detail;
    if (!detailEl) return;
    if (typeof detailHTML === 'string' && detailHTML.length > 0) {
        detailEl.innerHTML = detailHTML;
        return;
    }
    const lines = splitSummaryIntoBulletLines(bulletLines);
    const htmlParts = [];
    if (emphasisedLine) {
        htmlParts.push(
            `<p class="text-lg font-semibold leading-relaxed" style="color: var(--foreground);">${escapeHtml(
                emphasisedLine
            )}</p>`
        );
    }
    if (lines.length > 0) {
        const items = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
        if (collapsible) {
            const summaryLabel = `${collapsibleSummary || '展開重點條列'}（${lines.length} 則）`;
            const summaryText = escapeHtml(summaryLabel);
            htmlParts.push(
                [
                    '<details class="mt-2 rounded-md border border-dashed px-3 py-2" style="border-color: color-mix(in srgb, var(--border) 70%, transparent);">',
                    `<summary class="text-xs font-semibold leading-relaxed cursor-pointer" style="color: var(--primary);">${summaryText}</summary>`,
                    `<ul class="list-disc pl-5 mt-2 space-y-1 text-sm" style="color: var(--muted-foreground);">${items}</ul>`,
                    '</details>',
                ].join('')
            );
        } else {
            htmlParts.push(
                `<ul class="mt-2 list-disc pl-5 space-y-1 text-sm" style="color: var(--muted-foreground);">${items}</ul>`
            );
        }
    }
    if (htmlParts.length === 0) {
        htmlParts.push('<p class="text-sm" style="color: var(--muted-foreground);">—</p>');
    }
    detailEl.innerHTML = htmlParts.join('');
}

function applyStrategyStatusState(stateKey, options = {}) {
    const elements = strategyStatusElements;
    const config = STRATEGY_STATUS_CONFIG[stateKey] || STRATEGY_STATUS_CONFIG.idle;
    if (elements.card && STRATEGY_STATUS_VERSION) {
        elements.card.dataset.lbStrategyStatusVersion = STRATEGY_STATUS_VERSION;
    }
    if (elements.badge) {
        elements.badge.textContent = config.badgeText;
        elements.badge.style.backgroundColor = config.badgeStyle.backgroundColor;
        elements.badge.style.color = config.badgeStyle.color;
    }
    if (elements.title) {
        elements.title.textContent = options.titleOverride || config.title;
    }
    if (elements.subtitle) {
        elements.subtitle.textContent = options.subtitleOverride || config.subtitle;
    }
    if (elements.diff) {
        const diffText = typeof options.diffText === 'string' ? options.diffText : '';
        elements.diff.textContent = diffText;
        if (typeof elements.diff.classList?.toggle === 'function') {
            elements.diff.classList.toggle('hidden', diffText.length === 0);
        } else if (diffText.length === 0) {
            elements.diff.style.display = 'none';
        } else {
            elements.diff.style.display = '';
        }
    }
    renderStrategyStatusDetail(options.detail || {});
}

function resetStrategyStatusCard(stateKey = 'idle') {
    if (!strategyStatusElements.card) return;
    applyStrategyStatusState(stateKey, {
        detail: {
            bulletLines: [
                '啟動回測後，系統會即時比對策略與買入持有的差距。',
                '摘要完成時將提供重點條列、風險提醒與後續建議。',
            ],
        },
    });
}

function showStrategyStatusLoading() {
    if (!strategyStatusElements.card) return;
    applyStrategyStatusState('loading', {
        detail: {
            bulletLines: [
                '回測計算中，正在同步績效、指標與交易紀錄。',
                '完成後會更新策略差距、風險指標與建議重點。',
            ],
        },
    });
}

function buildStrategyComparisonSummary(result) {
    const strategyReturn = Number.isFinite(result?.returnRate) ? Number(result.returnRate) : null;
    let buyHoldReturn = null;
    if (Array.isArray(result?.buyHoldReturns) && result.buyHoldReturns.length > 0) {
        const last = Number.parseFloat(result.buyHoldReturns[result.buyHoldReturns.length - 1]);
        if (Number.isFinite(last)) buyHoldReturn = last;
    } else if (Number.isFinite(result?.buyHoldReturn)) {
        buyHoldReturn = Number(result.buyHoldReturn);
    }
    const diff = Number.isFinite(strategyReturn) && Number.isFinite(buyHoldReturn)
        ? strategyReturn - buyHoldReturn
        : null;
    let line = null;
    if (Number.isFinite(strategyReturn) && Number.isFinite(buyHoldReturn)) {
        const diffValue = Number.isFinite(diff) ? diff : 0;
        const diffText = Math.abs(diffValue).toFixed(2);
        if (diffValue >= 1.5) {
            line = `策略總報酬率 ${formatPercentSigned(strategyReturn, 2)}，買入持有 ${formatPercentSigned(buyHoldReturn, 2)}，領先約 ${diffText} 個百分點。請同步檢視倉位與風控，確保優勢能延續。`;
        } else if (diffValue <= -1.5) {
            line = `策略總報酬率 ${formatPercentSigned(strategyReturn, 2)}，買入持有 ${formatPercentSigned(buyHoldReturn, 2)}，目前落後約 ${diffText} 個百分點。建議檢查策略條件、交易成本與關鍵指標，找出需要調整的環節。`;
        } else {
            line = `策略總報酬率 ${formatPercentSigned(strategyReturn, 2)}，買入持有 ${formatPercentSigned(buyHoldReturn, 2)}，差距維持在 ${diffText} 個百分點內。建議延長觀察區間或搭配其他指標確認方向。`;
        }
    }
    return {
        strategyReturn,
        buyHoldReturn,
        diff,
        line,
    };
}

// Patch Tag: LB-ADVICE-OVERFIT-20240829A
function buildStrategyHealthSummary(result) {
    const annualizedReturn = Number.isFinite(result?.annualizedReturn) ? Number(result.annualizedReturn) : null;
    const sharpe = Number.isFinite(result?.sharpeRatio) ? Number(result.sharpeRatio) : null;
    const sortino = Number.isFinite(result?.sortinoRatio) ? Number(result.sortinoRatio) : null;
    const maxDrawdown = Number.isFinite(result?.maxDrawdown) ? Number(result.maxDrawdown) : null;
    const halfReturn1 = Number.isFinite(result?.annReturnHalf1) ? Number(result.annReturnHalf1) : null;
    const halfReturn2 = Number.isFinite(result?.annReturnHalf2) ? Number(result.annReturnHalf2) : null;
    const halfSharpe1 = Number.isFinite(result?.sharpeHalf1) ? Number(result.sharpeHalf1) : null;
    const halfSharpe2 = Number.isFinite(result?.sharpeHalf2) ? Number(result.sharpeHalf2) : null;

    const returnRatio = Number.isFinite(halfReturn1) && Math.abs(halfReturn1) > 1e-6
        ? halfReturn2 / halfReturn1
        : null;
    const sharpeHalfRatio = Number.isFinite(halfSharpe1) && Math.abs(halfSharpe1) > 1e-6
        ? halfSharpe2 / halfSharpe1
        : null;

    const warnings = [];
    const positives = [];

    if (!Number.isFinite(annualizedReturn)) {
        warnings.push('年化報酬尚未計算，請確認回測期間涵蓋足夠交易日。');
    } else if (annualizedReturn >= 12) {
        positives.push(`年化報酬 ${formatPercentSigned(annualizedReturn, 2)}`);
    } else {
        warnings.push(`年化報酬為 ${formatPercentSigned(annualizedReturn, 2)}，建議檢視進出場條件與資金運用效率。`);
    }

    if (!Number.isFinite(sharpe)) {
        warnings.push('夏普值尚未產生，請確認風險指標是否成功輸出。');
    } else if (sharpe >= 1) {
        positives.push(`夏普值 ${sharpe.toFixed(2)}`);
    } else {
        warnings.push(`夏普值為 ${sharpe.toFixed(2)}，建議強化風控或調整倉位以提升風險調整後報酬。`);
    }

    if (!Number.isFinite(sortino)) {
        warnings.push('索提諾比率尚未取得，請確認策略是否成功輸出下檔風險指標。');
    } else if (sortino >= 1) {
        positives.push(`索提諾比率 ${sortino.toFixed(2)}`);
    } else {
        warnings.push(`索提諾比率為 ${sortino.toFixed(2)}，回檔時的保護力不足，請檢查停損與資金控管。`);
    }

    if (!Number.isFinite(maxDrawdown)) {
        warnings.push('最大回撤資料缺少，請重新整理回測結果或延長觀察區間。');
    } else if (maxDrawdown <= 15) {
        positives.push(`最大回撤僅 ${maxDrawdown.toFixed(2)}%`);
    } else {
        warnings.push(`最大回撤達 ${maxDrawdown.toFixed(2)}%，請檢視資金控管與停損規則。`);
    }

    if (Number.isFinite(returnRatio)) {
        if (returnRatio >= 0.5 && returnRatio <= 1.5) {
            positives.push(`前後段報酬比 ${returnRatio.toFixed(2)}，不同時期報酬維持一致。`);
        } else {
            warnings.push(`前後段報酬比僅 ${returnRatio.toFixed(2)}，建議進行滾動驗證以確認穩定度。`);
        }
    }

    if (Number.isFinite(sharpeHalfRatio)) {
        if (sharpeHalfRatio >= 0.5 && sharpeHalfRatio <= 1.5) {
            positives.push(`前後段夏普比 ${sharpeHalfRatio.toFixed(2)}，風險調整後表現維持一致。`);
        } else {
            warnings.push(`前後段夏普比為 ${sharpeHalfRatio.toFixed(2)}，可能存在過度擬合，請增加樣本或調整驗證方式。`);
        }
    }

    const warningLines = warnings.slice();
    if (warningLines.length > 0) {
        warningLines[0] = warningLines[0].startsWith('指標檢查：')
            ? warningLines[0]
            : `指標檢查：${warningLines[0]}`;
    }

    const allGood = warningLines.length === 0 && positives.length > 0;

    let positiveLine = null;
    if (positives.length > 0) {
        const unique = Array.from(new Set(positives));
        if (allGood) {
            positiveLine = `體檢結論：${unique.join('、')} 表現穩健，建議維持現行設定並持續監測。`;
        } else {
            positiveLine = `指標亮點：${unique.join('、')}，請搭配調整建議優化策略表現。`;
        }
    }

    return {
        warningLines,
        positiveLine,
        allGood,
        overfitReturnRatio: Number.isFinite(returnRatio) ? returnRatio : null,
        overfitSharpeRatio: Number.isFinite(sharpeHalfRatio) ? sharpeHalfRatio : null,
    };
}

function buildStrategyAdviceFlow(result = {}) {
    const advice = [];
    const comparison = buildStrategyComparisonSummary(result || {});
    const health = buildStrategyHealthSummary(result || {});
    const warnings = Array.isArray(health.warningLines) ? health.warningLines : [];
    const positiveLine = typeof health.positiveLine === 'string' ? health.positiveLine : null;
    const returnRatio = Number.isFinite(health.overfitReturnRatio)
        ? Number(health.overfitReturnRatio)
        : null;
    const sharpeHalfRatio = Number.isFinite(health.overfitSharpeRatio)
        ? Number(health.overfitSharpeRatio)
        : null;

    if (Number.isFinite(comparison.diff)) {
        if (comparison.diff <= -1.5) {
            advice.push('報酬落後買入持有，請用參數優化重測策略。');
        } else if (comparison.diff >= 1.5) {
            advice.push('報酬領先買入持有，建議啟用滾動測試驗證。');
        } else {
            advice.push('報酬接近買入持有，延長期間並搭配趨勢診斷。');
        }
    } else {
        advice.push('尚未取得買入持有基準，請檢查資料暖身。');
    }

    let riskMessage = null;
    if (warnings.some((line) => line.includes('最大回撤'))) {
        riskMessage = '最大回撤偏高，請在風控設定調整停損與部位。';
    } else if (warnings.some((line) => line.includes('夏普值'))) {
        riskMessage = '夏普值偏低，建議啟用風險優化調整倉位。';
    } else if (warnings.some((line) => line.includes('索提諾比率'))) {
        riskMessage = '索提諾偏低，請檢查停損或調整出場策略。';
    } else if (warnings.some((line) => line.includes('年化報酬'))) {
        riskMessage = '年化報酬不足，請微調進出場條件或資金運用。';
    } else if (positiveLine) {
        riskMessage = '風險指標穩定，可保留設定並建立績效追蹤。';
    }
    if (riskMessage) advice.push(riskMessage);

    if (returnRatio === null && sharpeHalfRatio === null) {
        advice.push('過擬合指標缺資料，請重新執行分段統計。');
    } else {
        const ratioSegments = [];
        if (returnRatio !== null) {
            ratioSegments.push(`報酬比${returnRatio.toFixed(2)}`);
        }
        if (sharpeHalfRatio !== null) {
            ratioSegments.push(`夏普比${sharpeHalfRatio.toFixed(2)}`);
        }
        const ratioSummary = ratioSegments.join('、');
        const ratioRisk = (
            returnRatio !== null && (returnRatio < 0.5 || returnRatio > 1.5)
        ) || (
            sharpeHalfRatio !== null && (sharpeHalfRatio < 0.5 || sharpeHalfRatio > 1.5)
        );
        if (ratioRisk) {
            advice.push(`過擬合警示：${ratioSummary}，請延長樣本。`);
        } else if (ratioSummary.length > 0) {
            advice.push(`過擬合檢查：${ratioSummary}，維持設定。`);
        }
    }

    const totalTrades = Number.isFinite(result?.tradesCount)
        ? Number(result.tradesCount)
        : Number.isFinite(result?.totalTrades)
            ? Number(result.totalTrades)
            : null;
    if (Number.isFinite(totalTrades)) {
        if (totalTrades < 10) {
            advice.push('交易筆數少於10筆，請延長期間或放寬策略條件。');
        } else {
            advice.push('交易樣本充足，請檢查交易記錄確認執行品質。');
        }
    }

    const sensitivitySummary = result?.sensitivityAnalysis?.summary
        || result?.parameterSensitivity?.summary
        || result?.sensitivityData?.summary
        || null;
    if (sensitivitySummary) {
        const score = Number.isFinite(sensitivitySummary.stabilityScore)
            ? Number(sensitivitySummary.stabilityScore)
            : null;
        const averageDrift = Number.isFinite(sensitivitySummary.averageDriftPercent)
            ? Math.abs(Number(sensitivitySummary.averageDriftPercent))
            : null;
        const scenarioCount = Number.isFinite(sensitivitySummary.scenarioCount)
            ? Number(sensitivitySummary.scenarioCount)
            : null;
        if (score !== null && score >= 70 && (averageDrift === null || averageDrift <= ANNUALIZED_SENSITIVITY_THRESHOLDS.driftStable)) {
            advice.push('敏感度穩健，請排程定期重跑並更新策略備註。');
        } else if (score !== null && score >= 40) {
            advice.push('敏感度普通，建議調整擾動步長並再次優化。');
        } else if (score !== null) {
            advice.push('敏感度偏危險，請縮小參數範圍並搭配滾動測試。');
        } else if (scenarioCount !== null && scenarioCount < 10) {
            advice.push('敏感度樣本不足，請增加擾動組數後再評估。');
        } else {
            advice.push('敏感度資訊不完整，請重新執行參數擾動測試。');
        }
    } else {
        advice.push('尚未執行敏感度分析，請啟用參數擾動檢查穩定度。');
    }

    return dedupeTextList(advice.filter((line) => typeof line === 'string' && line.length > 0));
}

function buildSensitivityScoreAdvice(result) {
    const data = result?.sensitivityAnalysis || result?.parameterSensitivity || result?.sensitivityData;
    const summary = data?.summary || null;
    if (!summary) {
        return null;
    }

    const {
        driftStable,
        driftCaution,
        directionSafe,
        directionWatch,
        directionRisk,
    } = ANNUALIZED_SENSITIVITY_THRESHOLDS;

    const rawScore = Number.isFinite(summary.stabilityScore) ? Number(summary.stabilityScore) : null;
    const averageDrift = Number.isFinite(summary.averageDriftPercent)
        ? Math.abs(Number(summary.averageDriftPercent))
        : null;
    const positiveDrift = Number.isFinite(summary.positiveDriftPercent)
        ? Math.abs(Number(summary.positiveDriftPercent))
        : null;
    const negativeDrift = Number.isFinite(summary.negativeDriftPercent)
        ? Math.abs(Number(summary.negativeDriftPercent))
        : null;
    const sampleCount = Number.isFinite(summary.scenarioCount) ? Number(summary.scenarioCount) : null;

    const segments = [];

    if (rawScore === null) {
        segments.push('敏感度總分缺少資料，請重新執行參數擾動測試。');
    } else if (rawScore >= 70) {
        segments.push(`敏感度總分 ${Math.round(rawScore)} 分，屬於穩健區間，參數變動對績效影響有限。`);
    } else if (rawScore >= 40) {
        segments.push(`敏感度總分 ${Math.round(rawScore)} 分，建議列入觀察並在重大行情變化時重新檢測。`);
    } else {
        segments.push(`敏感度總分 ${Math.round(rawScore)} 分，策略對參數較敏感，請建立保護機制並控管風險。`);
    }

    if (averageDrift !== null) {
        if (averageDrift <= driftStable) {
            segments.push(`平均漂移控制在 ±${driftStable}pp內，報酬變動穩定。`);
        } else if (averageDrift <= driftCaution) {
            segments.push(`平均漂移約 ${averageDrift.toFixed(1)}pp，建議增加樣本或調整倉位分散風險。`);
        } else {
            segments.push(`平均漂移達 ${averageDrift.toFixed(1)}pp，請強化風控或縮小部位以降低波動。`);
        }
    }

    if (positiveDrift !== null || negativeDrift !== null) {
        const positiveValue = positiveDrift ?? -Infinity;
        const negativeValue = negativeDrift ?? -Infinity;
        const dominantDirection = positiveValue >= negativeValue ? '調高' : '調低';
        const dominantMagnitude = dominantDirection === '調高' ? positiveDrift : negativeDrift;
        const oppositeMagnitude = dominantDirection === '調高' ? negativeDrift : positiveDrift;
        if (Number.isFinite(dominantMagnitude)) {
            if (dominantMagnitude > directionRisk) {
                segments.push(`${dominantDirection}方向平均偏移超過 ${directionRisk}pp，請優先檢視該組參數的穩定度。`);
            } else if (dominantMagnitude > directionWatch) {
                segments.push(`${dominantDirection}方向平均偏移落在 ${directionWatch}～${directionRisk}pp，建議再做滾動驗證。`);
            } else if (Number.isFinite(oppositeMagnitude) && oppositeMagnitude <= directionSafe && dominantMagnitude <= directionSafe) {
                segments.push(`調高與調低方向平均偏移皆在 ${directionSafe}pp 內，參數變動可控。`);
            } else {
                segments.push(`${dominantDirection}方向平均偏移約 ${dominantMagnitude.toFixed(1)}pp，請持續追蹤擾動趨勢。`);
            }
        }
    }

    if (sampleCount !== null) {
        segments.push(`擾動樣本共 ${sampleCount} 組，資料量足以支撐判斷。`);
    }

    if (segments.length === 0) {
        return null;
    }

    const message = `${segments.join('，')}。`;
    return message.replace(/([，。！？、；])([，。！？、；]+)/g, '$1');
}

function determineStrategyStatusState(diff, comparisonAvailable) {
    if (!comparisonAvailable) {
        return 'missing';
    }
    if (!Number.isFinite(diff)) {
        return 'missing';
    }
    if (Math.abs(diff) < 1.5) {
        return 'tie';
    }
    if (diff >= 1.5) {
        return 'leading';
    }
    return 'behind';
}

function updateStrategyStatusCard(result) {
    if (!strategyStatusElements.card) return;
    const comparison = buildStrategyComparisonSummary(result || {});
    const comparisonAvailable = Number.isFinite(comparison.strategyReturn) && Number.isFinite(comparison.buyHoldReturn);
    const state = determineStrategyStatusState(comparison.diff, comparisonAvailable);
    const diffText = '';
    const detailLines = buildStrategyAdviceFlow(result || {});

    applyStrategyStatusState(state, {
        diffText,
        detail: {
            emphasisedLine: null,
            bulletLines: detailLines,
            collapsible: false,
        },
    });
}

resetStrategyStatusCard();

const YEAR_STORAGE_VERSION = 'LB-CACHE-TIER-20250720A';
const YEAR_STORAGE_PREFIX = 'LB_YEAR_DATA_CACHE_V20250720A';
const YEAR_STORAGE_TW_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const YEAR_STORAGE_US_TTL_MS = 1000 * 60 * 60 * 24 * 1;
const YEAR_STORAGE_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 2;

const BLOB_LEDGER_STORAGE_KEY = 'LB_BLOB_LEDGER_V20250720A';
const BLOB_LEDGER_VERSION = 'LB-CACHE-TIER-20250720A';
const BLOB_LEDGER_MAX_EVENTS = 36;

const TREND_ANALYSIS_VERSION = 'LB-TREND-CARD-20251107A';
const TREND_BACKGROUND_PLUGIN_ID = 'trendBackgroundOverlay';
const TREND_SENSITIVITY_MIN = 0;
const TREND_SENSITIVITY_MAX = 10;
const TREND_SENSITIVITY_DEFAULT = 5;
const TREND_SENSITIVITY_ANCHOR = 5;
const TREND_SENSITIVITY_EFFECTIVE_MIN = 1;
const TREND_SENSITIVITY_EFFECTIVE_MAX = 1000;
const TREND_SENSITIVITY_CALIBRATION_STEPS = 1000;
const TREND_SENSITIVITY_CALIBRATION_MARGIN_MIN = 0.001;
const TREND_SENSITIVITY_CALIBRATION_MARGIN_MAX = 0.08;
const TREND_SENSITIVITY_CALIBRATION_MARGIN_DEFAULT = 0.04;
const TREND_SIGMOID_STEEPNESS = 7.2;
const TREND_TARGET_TREND_MIN = 0.38;
const TREND_TARGET_TREND_MAX = 0.86;
const TREND_PROMOTION_BASE = 0.68;
const TREND_PROMOTION_GAIN = 0.28;

const TREND_STYLE_MAP = {
    bullHighVol: {
        label: '強勢上漲',
        overlay: 'rgba(239, 68, 68, 0.2)',
        accent: '#dc2626',
        border: 'rgba(239, 68, 68, 0.38)',
    },
    rangeBound: {
        label: '盤整區間',
        overlay: 'rgba(148, 163, 184, 0.18)',
        accent: '#475569',
        border: 'rgba(148, 163, 184, 0.38)',
    },
    bearHighVol: {
        label: '強勢下跌',
        overlay: 'rgba(34, 197, 94, 0.2)',
        accent: '#16a34a',
        border: 'rgba(34, 197, 94, 0.35)',
    },
};

function clampValue(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

function logistic(value) {
    if (!Number.isFinite(value)) return 0.5;
    if (value > 60) return 1;
    if (value < -60) return 0;
    return 1 / (1 + Math.exp(-value));
}

function createDefaultTrendSensitivityCalibration() {
    const range = Math.max(1e-9, TREND_SENSITIVITY_MAX - TREND_SENSITIVITY_MIN);
    const anchorNormalized = clamp01((TREND_SENSITIVITY_ANCHOR - TREND_SENSITIVITY_MIN) / range);
    const defaultNormalized = clamp01((TREND_SENSITIVITY_DEFAULT - TREND_SENSITIVITY_MIN) / range);
    const effectiveRange = TREND_SENSITIVITY_EFFECTIVE_MAX - TREND_SENSITIVITY_EFFECTIVE_MIN;
    const bestEffective = TREND_SENSITIVITY_EFFECTIVE_MIN + defaultNormalized * effectiveRange;
    return {
        anchorValue: TREND_SENSITIVITY_ANCHOR,
        anchorNormalized,
        targetNormalized: anchorNormalized,
        bestSlider: TREND_SENSITIVITY_ANCHOR,
        bestScore: null,
        bestEffective,
        steps: TREND_SENSITIVITY_CALIBRATION_STEPS,
        normalizedMargin: TREND_SENSITIVITY_CALIBRATION_MARGIN_DEFAULT,
    };
}

function sanitizeTrendRawRow(row) {
    if (!row || typeof row !== 'object') return null;
    const date = typeof row.date === 'string' ? row.date : null;
    if (!date) return null;
    const parseValue = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    };
    return {
        date,
        open: parseValue(row.open),
        high: parseValue(row.high),
        low: parseValue(row.low),
        close: parseValue(row.close),
        volume: parseValue(row.volume),
    };
}

function areSameTrendDateSequence(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function captureTrendAnalysisSource(result, options = {}) {
    if (!result || typeof result !== 'object') {
        return { dates: [], strategyReturns: [], rawData: [] };
    }
    const previous = options.previousResult || null;
    const dates = Array.isArray(result.dates)
        ? result.dates.map((value) => (typeof value === 'string' ? value : null))
        : [];
    const strategyReturns = Array.isArray(result.strategyReturns)
        ? result.strategyReturns.map((value) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
        })
        : [];
    let rawSource = Array.isArray(result.rawData) && result.rawData.length > 0
        ? result.rawData
        : Array.isArray(result.rawDataUsed) && result.rawDataUsed.length > 0
            ? result.rawDataUsed
            : [];
    if (rawSource.length === 0 && previous && areSameTrendDateSequence(dates, previous.dates)) {
        rawSource = Array.isArray(previous.rawData) ? previous.rawData : [];
    }
    const rawData = rawSource
        .map((row) => sanitizeTrendRawRow(row))
        .filter((row) => row !== null);
    return {
        dates,
        strategyReturns,
        rawData,
    };
}

function applyTrendCalibrationNormalized(linearNormalized, calibration) {
    const normalized = clamp01(linearNormalized);
    const base = calibration && typeof calibration === 'object' ? calibration : null;
    if (!base) return normalized;
    const anchor = clamp01(base.anchorNormalized ?? 0.5);
    const target = clamp01(base.targetNormalized ?? anchor);
    if (anchor <= 0 || anchor >= 1 || Math.abs(target - anchor) < 1e-6) {
        return normalized;
    }
    if (normalized <= anchor) {
        if (anchor <= 0) return 0;
        const ratio = normalized / anchor;
        return clamp01(ratio * target);
    }
    const upperSpan = 1 - anchor;
    if (upperSpan <= 0) return 1;
    const targetSpan = Math.max(1e-6, 1 - target);
    const ratio = (1 - normalized) / upperSpan;
    return clamp01(1 - ratio * targetSpan);
}

function mapSliderToEffectiveSensitivity(sensitivity, calibration) {
    const min = TREND_SENSITIVITY_MIN;
    const max = TREND_SENSITIVITY_MAX;
    const safe = clampValue(Number.isFinite(sensitivity) ? sensitivity : TREND_SENSITIVITY_DEFAULT, min, max);
    const range = Math.max(1e-9, max - min);
    const linearNormalized = clamp01((safe - min) / range);
    const calibratedNormalized = applyTrendCalibrationNormalized(linearNormalized, calibration);
    const effective = TREND_SENSITIVITY_EFFECTIVE_MIN
        + calibratedNormalized * (TREND_SENSITIVITY_EFFECTIVE_MAX - TREND_SENSITIVITY_EFFECTIVE_MIN);
    return {
        safe,
        linearNormalized,
        calibratedNormalized,
        effective,
    };
}

function calibrateTrendSensitivity(base) {
    const calibration = createDefaultTrendSensitivityCalibration();
    if (!base || !Array.isArray(base.dates) || base.dates.length === 0) {
        return calibration;
    }
    const steps = Math.max(2, Math.min(5000, Math.floor(TREND_SENSITIVITY_CALIBRATION_STEPS)));
    const stepSize = steps > 1
        ? (TREND_SENSITIVITY_MAX - TREND_SENSITIVITY_MIN) / (steps - 1)
        : 0;
    const neutralCalibration = {
        ...calibration,
        targetNormalized: calibration.anchorNormalized,
    };
    let bestSlider = calibration.bestSlider;
    let bestScore = Number.isFinite(calibration.bestScore)
        ? calibration.bestScore
        : Number.NEGATIVE_INFINITY;
    let bestEffective = calibration.bestEffective;
    for (let i = 0; i < steps; i += 1) {
        const sliderValue = TREND_SENSITIVITY_MIN + (i * stepSize);
        const thresholds = computeTrendThresholds(sliderValue, neutralCalibration);
        const classification = classifyRegimes(base, thresholds);
        const score = Number.isFinite(classification?.summary?.averageConfidence)
            ? classification.summary.averageConfidence
            : Number.NEGATIVE_INFINITY;
        const preferCurrent = Math.abs(sliderValue - TREND_SENSITIVITY_ANCHOR)
            < Math.abs(bestSlider - TREND_SENSITIVITY_ANCHOR);
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && preferCurrent)) {
            bestScore = score;
            bestSlider = sliderValue;
            bestEffective = thresholds.effectiveSensitivity;
        }
    }
    const range = Math.max(1e-9, TREND_SENSITIVITY_MAX - TREND_SENSITIVITY_MIN);
    let targetNormalized = clamp01((bestSlider - TREND_SENSITIVITY_MIN) / range);
    const dynamicMargin = clampValue(
        Math.max(
            TREND_SENSITIVITY_CALIBRATION_MARGIN_MIN,
            1 / Math.max(4, steps * 2),
        ),
        TREND_SENSITIVITY_CALIBRATION_MARGIN_MIN,
        TREND_SENSITIVITY_CALIBRATION_MARGIN_MAX,
    );
    targetNormalized = clampValue(targetNormalized, dynamicMargin, 1 - dynamicMargin);
    return {
        anchorValue: TREND_SENSITIVITY_ANCHOR,
        anchorNormalized: calibration.anchorNormalized,
        targetNormalized,
        bestSlider,
        bestScore: Number.isFinite(bestScore) ? bestScore : null,
        bestEffective,
        steps,
        normalizedMargin: dynamicMargin,
    };
}

function computeLogScaledProgress(value, min, max) {
    const safeMin = Math.max(1e-6, Math.min(min, max));
    const safeMax = Math.max(safeMin * 1.0001, Math.max(min, max));
    const clamped = clampValue(value, safeMin, safeMax);
    const logMin = Math.log(safeMin);
    const logMax = Math.log(safeMax);
    const logValue = Math.log(Math.max(safeMin, clamped));
    if (!Number.isFinite(logMin) || !Number.isFinite(logMax) || logMax === logMin) {
        return Math.max(0, Math.min(1, (clamped - safeMin) / (safeMax - safeMin)));
    }
    return Math.max(0, Math.min(1, (logValue - logMin) / (logMax - logMin)));
}

const trendAnalysisState = {
    version: TREND_ANALYSIS_VERSION,
    sensitivity: TREND_SENSITIVITY_DEFAULT,
    calibration: createDefaultTrendSensitivityCalibration(),
    thresholds: null,
    segments: [],
    summary: null,
    result: null,
    base: null,
};

const trendBackgroundPlugin = {
    id: TREND_BACKGROUND_PLUGIN_ID,
    beforeDatasetsDraw(chart, _args, opts) {
        const chartArea = chart.chartArea;
        const xScale = chart.scales?.x;
        if (!chartArea || !xScale) return;
        const pluginOptions = chart.options?.plugins?.[TREND_BACKGROUND_PLUGIN_ID] || opts || {};
        const segments = Array.isArray(pluginOptions.segments) ? pluginOptions.segments : [];
        if (!segments.length) return;
        const labels = chart.data?.labels || [];
        if (!labels.length) return;
        let step = 0;
        if (labels.length > 1) {
            const firstPixel = xScale.getPixelForValue(labels[0], 0);
            const secondPixel = xScale.getPixelForValue(labels[1], 1);
            step = secondPixel - firstPixel;
        } else {
            step = chartArea.width;
        }
        const halfStep = step / 2;
        const { top, bottom } = chartArea;
        const ctx = chart.ctx;
        ctx.save();
        segments.forEach((segment) => {
            const startIdx = segment?.startIndex;
            const endIdx = segment?.endIndex;
            if (!Number.isFinite(startIdx) || !Number.isFinite(endIdx)) return;
            const boundedEndIdx = Math.min(endIdx, labels.length - 1);
            const startLabel = labels[startIdx];
            const endLabel = labels[boundedEndIdx];
            const startCenter = xScale.getPixelForValue(startLabel, startIdx);
            const endCenter = xScale.getPixelForValue(endLabel, boundedEndIdx);
            if (!Number.isFinite(startCenter) || !Number.isFinite(endCenter)) return;
            const left = startCenter - halfStep;
            const right = endCenter + halfStep;
            const width = Math.max(1, right - left);
            const fillStyle = segment.overlay || TREND_STYLE_MAP[segment.type]?.overlay || 'rgba(0,0,0,0.06)';
            ctx.fillStyle = fillStyle;
            ctx.fillRect(left, top, width, bottom - top);
        });
        ctx.restore();
    },
};

if (typeof Chart !== 'undefined' && Chart.register) {
    Chart.register(trendBackgroundPlugin);
}

function computeTrendThresholds(sensitivity, calibrationOverride) {
    const calibration = calibrationOverride || trendAnalysisState.calibration || createDefaultTrendSensitivityCalibration();
    const mapping = mapSliderToEffectiveSensitivity(sensitivity, calibration);
    const { safe, linearNormalized, calibratedNormalized, effective } = mapping;
    const logProgress = computeLogScaledProgress(
        effective,
        TREND_SENSITIVITY_EFFECTIVE_MIN,
        TREND_SENSITIVITY_EFFECTIVE_MAX,
    );
    const sigmoidProgress = logistic((logProgress - 0.5) * TREND_SIGMOID_STEEPNESS);
    const adxTrend = 40 - sigmoidProgress * 24;
    const adxFlat = Math.max(7, adxTrend * (0.52 - sigmoidProgress * 0.12));
    const bollTrend = Math.max(0.07, 0.17 - sigmoidProgress * 0.08);
    const bollFlat = Math.max(0.018, bollTrend * (0.48 - sigmoidProgress * 0.16));
    const atrTrend = Math.max(0.03, 0.07 - sigmoidProgress * 0.028);
    const atrFlat = Math.max(0.004, atrTrend * (0.46 - sigmoidProgress * 0.14));
    const smoothingWindow = Math.max(1, Math.round(7 - sigmoidProgress * 4));
    const minSegmentLength = Math.max(2, Math.round(6 - sigmoidProgress * 3));
    const targetTrendCoverage = TREND_TARGET_TREND_MIN
        + sigmoidProgress * (TREND_TARGET_TREND_MAX - TREND_TARGET_TREND_MIN);
    const targetRangeCoverage = Math.max(0, 1 - targetTrendCoverage);
    const promotionFloor = Math.max(
        0.35,
        TREND_PROMOTION_BASE - sigmoidProgress * TREND_PROMOTION_GAIN,
    );
    return {
        sensitivity: safe,
        effectiveSensitivity: effective,
        normalized: logProgress,
        linearProgress: linearNormalized,
        logisticProgress: sigmoidProgress,
        calibrationNormalized: calibratedNormalized,
        calibrationTargetNormalized: calibration?.targetNormalized ?? null,
        calibrationAnchorNormalized: calibration?.anchorNormalized ?? null,
        calibrationBestSlider: calibration?.bestSlider ?? null,
        calibrationBestScore: Number.isFinite(calibration?.bestScore)
            ? calibration.bestScore
            : null,
        calibrationBestEffective: Number.isFinite(calibration?.bestEffective)
            ? calibration.bestEffective
            : null,
        adxTrend,
        adxFlat,
        bollTrend,
        bollFlat,
        atrTrend,
        atrFlat,
        smoothingWindow,
        minSegmentLength,
        targetTrendCoverage,
        targetRangeCoverage,
        promotionFloor,
    };
}

function formatPercentPlain(value, digits = 1) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toFixed(digits)}%`;
}

function formatIsoDateLabel(iso) {
    if (typeof iso !== 'string' || iso.trim() === '') return '';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function formatTrendLatestDate(dateString) {
    if (typeof dateString !== 'string' || dateString.length < 8) return null;
    const parts = dateString.split('-');
    if (parts.length < 3) return null;
    const month = Number.parseInt(parts[1], 10);
    const day = Number.parseInt(parts[2], 10);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    return `${month}／${day}`;
}

function computeMedian(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const filtered = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (filtered.length === 0) return null;
    const mid = Math.floor(filtered.length / 2);
    if (filtered.length % 2 === 0) {
        return (filtered[mid - 1] + filtered[mid]) / 2;
    }
    return filtered[mid];
}

function computeLogReturns(closes) {
    const length = Array.isArray(closes) ? closes.length : 0;
    const result = new Array(length).fill(null);
    for (let i = 1; i < length; i += 1) {
        const prev = Number(closes[i - 1]);
        const current = Number(closes[i]);
        if (Number.isFinite(prev) && prev > 0 && Number.isFinite(current) && current > 0) {
            result[i] = Math.log(current / prev);
        }
    }
    return result;
}

function computeStrategyLogReturns(strategyReturns) {
    const length = Array.isArray(strategyReturns) ? strategyReturns.length : 0;
    const result = new Array(length).fill(null);
    for (let i = 1; i < length; i += 1) {
        const prev = Number(strategyReturns[i - 1]);
        const current = Number(strategyReturns[i]);
        if (!Number.isFinite(prev) || !Number.isFinite(current)) continue;
        const prevEquity = 1 + (prev / 100);
        const currentEquity = 1 + (current / 100);
        if (prevEquity > 0 && currentEquity > 0) {
            result[i] = Math.log(currentEquity / prevEquity);
        }
    }
    return result;
}

function computeRollingSkewness(values, period = 20) {
    const length = Array.isArray(values) ? values.length : 0;
    const windowSize = Math.max(1, Math.round(Number(period) || 20));
    const result = new Array(length).fill(null);
    const window = [];
    for (let i = 0; i < length; i += 1) {
        const value = Number(values[i]);
        if (Number.isFinite(value)) {
            window.push({ index: i, value });
        } else {
            window.push({ index: i, value: null });
        }
        while (window.length > 0 && window[0].index < i - windowSize + 1) {
            window.shift();
        }
        const finiteValues = window
            .map((entry) => entry.value)
            .filter((val) => Number.isFinite(val));
        const n = finiteValues.length;
        if (n >= 3) {
            const mean = finiteValues.reduce((acc, val) => acc + val, 0) / n;
            let m2 = 0;
            let m3 = 0;
            finiteValues.forEach((val) => {
                const diff = val - mean;
                m2 += diff * diff;
                m3 += diff * diff * diff;
            });
            const variance = m2 / n;
            const std = Math.sqrt(variance);
            if (std > 0) {
                const adjustment = n / ((n - 1) * (n - 2));
                result[i] = adjustment * (m3 / (std * std * std));
            } else {
                result[i] = 0;
            }
        }
    }
    return result;
}

function computeRollingZScore(values, period = 20) {
    const length = Array.isArray(values) ? values.length : 0;
    const windowSize = Math.max(1, Math.round(Number(period) || 20));
    const result = new Array(length).fill(null);
    const window = [];
    let sum = 0;
    let sumSquares = 0;
    let count = 0;
    for (let i = 0; i < length; i += 1) {
        const raw = Number(values[i]);
        const value = Number.isFinite(raw) ? raw : null;
        window.push({ index: i, value });
        if (Number.isFinite(value)) {
            sum += value;
            sumSquares += value * value;
            count += 1;
        }
        while (window.length > 0 && window[0].index < i - windowSize + 1) {
            const removed = window.shift();
            if (Number.isFinite(removed.value)) {
                sum -= removed.value;
                sumSquares -= removed.value * removed.value;
                count -= 1;
            }
        }
        if (Number.isFinite(value) && count >= 2) {
            const mean = sum / count;
            const variance = Math.max((sumSquares / count) - (mean * mean), 0);
            const std = Math.sqrt(variance);
            result[i] = std > 0 ? (value - mean) / std : 0;
        }
    }
    return result;
}

function normalizeObservationMatrix(observations) {
    if (!Array.isArray(observations) || observations.length === 0) {
        return { normalized: [], mean: [], std: [] };
    }
    const dimension = observations[0].length;
    const mean = new Array(dimension).fill(0);
    observations.forEach((row) => {
        row.forEach((value, idx) => {
            mean[idx] += value;
        });
    });
    for (let i = 0; i < dimension; i += 1) {
        mean[i] /= observations.length;
    }
    const variance = new Array(dimension).fill(0);
    observations.forEach((row) => {
        row.forEach((value, idx) => {
            const diff = value - mean[idx];
            variance[idx] += diff * diff;
        });
    });
    const std = variance.map((value) => {
        const computed = Math.sqrt(value / observations.length);
        return Number.isFinite(computed) && computed > 0 ? computed : 1;
    });
    const normalized = observations.map((row) => row.map((value, idx) => {
        const divisor = std[idx] || 1;
        return (value - mean[idx]) / divisor;
    }));
    return { normalized, mean, std };
}

function computeTrueRangeSeries(highs, lows, closes) {
    const length = Math.min(
        Array.isArray(highs) ? highs.length : 0,
        Array.isArray(lows) ? lows.length : 0,
        Array.isArray(closes) ? closes.length : 0,
    );
    const result = new Array(length).fill(null);
    for (let i = 0; i < length; i += 1) {
        const high = Number(highs[i]);
        const low = Number(lows[i]);
        const currentClose = Number(closes[i]);
        const previousClose = i > 0 ? Number(closes[i - 1]) : null;
        if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(currentClose)) {
            continue;
        }
        let tr = high - low;
        if (Number.isFinite(previousClose)) {
            tr = Math.max(tr, Math.abs(high - previousClose), Math.abs(low - previousClose));
        }
        result[i] = tr;
    }
    return result;
}

function computeATRSeries(highs, lows, closes, period = 14) {
    const trSeries = computeTrueRangeSeries(highs, lows, closes);
    const length = trSeries.length;
    const p = Math.max(1, Math.round(Number(period) || 14));
    const result = new Array(length).fill(null);
    let sum = 0;
    let count = 0;
    let prevAtr = null;
    for (let i = 0; i < length; i += 1) {
        const tr = trSeries[i];
        if (!Number.isFinite(tr)) {
            result[i] = prevAtr;
            continue;
        }
        if (prevAtr === null) {
            sum += tr;
            count += 1;
            if (count >= p) {
                prevAtr = sum / p;
                result[i] = prevAtr;
            }
        } else {
            prevAtr = ((prevAtr * (p - 1)) + tr) / p;
            result[i] = prevAtr;
        }
    }
    return result;
}

function computeBollingerBandwidth(closes, period = 20, deviations = 2) {
    const length = Array.isArray(closes) ? closes.length : 0;
    const p = Math.max(1, Math.round(Number(period) || 20));
    const dev = Number.isFinite(deviations) ? deviations : 2;
    const result = new Array(length).fill(null);
    const window = [];
    let sum = 0;
    let sumSquares = 0;
    let validCount = 0;
    for (let i = 0; i < length; i += 1) {
        const price = Number(closes[i]);
        window.push(price);
        if (Number.isFinite(price)) {
            sum += price;
            sumSquares += price * price;
            validCount += 1;
        }
        if (window.length > p) {
            const removed = window.shift();
            if (Number.isFinite(removed)) {
                sum -= removed;
                sumSquares -= removed * removed;
                validCount -= 1;
            }
        }
        if (window.length === p && validCount === p) {
            const mean = sum / p;
            const variance = Math.max(0, sumSquares / p - mean * mean);
            const std = Math.sqrt(variance);
            const upper = mean + dev * std;
            const lower = mean - dev * std;
            const bandwidth = mean !== 0 ? (upper - lower) / mean : null;
            result[i] = Number.isFinite(bandwidth) ? bandwidth : null;
        } else {
            result[i] = null;
        }
    }
    return result;
}

function computeADXSeries(highs, lows, closes, period = 14) {
    const length = Math.min(
        Array.isArray(highs) ? highs.length : 0,
        Array.isArray(lows) ? lows.length : 0,
        Array.isArray(closes) ? closes.length : 0,
    );
    const p = Math.max(1, Math.round(Number(period) || 14));
    const result = new Array(length).fill(null);
    if (length < p + 1) {
        return result;
    }
    const plusDM = new Array(length).fill(0);
    const minusDM = new Array(length).fill(0);
    const trSeries = new Array(length).fill(null);
    for (let i = 1; i < length; i += 1) {
        const high = Number(highs[i]);
        const low = Number(lows[i]);
        const prevHigh = Number(highs[i - 1]);
        const prevLow = Number(lows[i - 1]);
        const prevClose = Number(closes[i - 1]);
        if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevHigh)
            || !Number.isFinite(prevLow) || !Number.isFinite(prevClose)) {
            continue;
        }
        const upMove = high - prevHigh;
        const downMove = prevLow - low;
        plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
        minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
        const range1 = high - low;
        const range2 = Math.abs(high - prevClose);
        const range3 = Math.abs(low - prevClose);
        trSeries[i] = Math.max(range1, range2, range3);
    }
    let atr = null;
    let plusSmoothed = null;
    let minusSmoothed = null;
    let trSum = 0;
    let plusSum = 0;
    let minusSum = 0;
    const dxSeries = new Array(length).fill(null);
    for (let i = 1; i < length; i += 1) {
        const tr = trSeries[i];
        if (!Number.isFinite(tr)) {
            continue;
        }
        trSum += tr;
        plusSum += plusDM[i];
        minusSum += minusDM[i];
        if (i === p) {
            atr = trSum / p;
            plusSmoothed = plusSum / p;
            minusSmoothed = minusSum / p;
        } else if (i > p && atr !== null) {
            atr = ((atr * (p - 1)) + tr) / p;
            plusSmoothed = ((plusSmoothed * (p - 1)) + plusDM[i]) / p;
            minusSmoothed = ((minusSmoothed * (p - 1)) + minusDM[i]) / p;
        }
        if (atr !== null && atr > 0 && plusSmoothed !== null && minusSmoothed !== null) {
            const plusDI = (plusSmoothed / atr) * 100;
            const minusDI = (minusSmoothed / atr) * 100;
            const denominator = plusDI + minusDI;
            const dx = denominator > 0 ? (Math.abs(plusDI - minusDI) / denominator) * 100 : 0;
            dxSeries[i] = dx;
        }
    }
    let dxSum = 0;
    let dxCount = 0;
    let adx = null;
    for (let i = 0; i < length; i += 1) {
        const dx = dxSeries[i];
        if (!Number.isFinite(dx)) {
            result[i] = adx;
            continue;
        }
        if (adx === null) {
            dxSum += dx;
            dxCount += 1;
            if (dxCount >= p) {
                adx = dxSum / p;
                result[i] = adx;
            }
        } else {
            adx = ((adx * (p - 1)) + dx) / p;
            result[i] = adx;
        }
    }
    return result;
}

function trainFourStateHMM(observations, options = {}) {
    if (!Array.isArray(observations) || observations.length === 0) return null;
    const clean = observations
        .filter((row) => Array.isArray(row) && row.every((value) => Number.isFinite(value)))
        .map((row) => row.slice());
    const numStates = Math.max(2, Math.round(options.numStates || 4));
    const maxIterations = Math.max(1, Math.round(options.maxIterations || 100));
    const tolerance = Number.isFinite(options.tolerance) ? options.tolerance : 1e-4;
    if (clean.length < numStates) return null;
    const dimension = clean[0].length;

    const initialProbabilities = new Array(numStates).fill(1 / numStates);
    const transitionMatrix = new Array(numStates).fill(null).map((_, stateIndex) => {
        const row = new Array(numStates).fill((1 - 0.7) / Math.max(1, numStates - 1));
        row[stateIndex] = 0.7;
        return row;
    });

    const returns = clean.map((row) => row[0]);
    const vols = clean.map((row) => row[1]);
    const returnMedian = computeMedian(returns) ?? 0;
    const volMedian = computeMedian(vols) ?? 0;

    const assignments = clean.map((row) => {
        const direction = row[0] >= returnMedian ? 0 : 1; // 0 bull, 1 bear
        const volClass = row[1] >= volMedian ? 0 : 1; // 0 high, 1 low
        if (direction === 0 && volClass === 0) return 0; // bull high
        if (direction === 0 && volClass === 1) return 1; // bull low
        if (direction === 1 && volClass === 0) return 2; // bear high
        return 3; // bear low
    }).map((state) => state % numStates);

    const stateSamples = new Array(numStates).fill(null).map(() => []);
    assignments.forEach((stateIndex, idx) => {
        stateSamples[stateIndex].push(clean[idx]);
    });
    for (let i = 0; i < numStates; i += 1) {
        if (stateSamples[i].length === 0) {
            stateSamples[i].push(clean[i % clean.length]);
        }
    }

    const means = stateSamples.map((samples) => {
        const mean = new Array(dimension).fill(0);
        samples.forEach((row) => {
            row.forEach((value, idx) => {
                mean[idx] += value;
            });
        });
        return mean.map((value) => value / samples.length);
    });

    const variances = stateSamples.map((samples, stateIndex) => {
        const variance = new Array(dimension).fill(0);
        samples.forEach((row) => {
            row.forEach((value, idx) => {
                const diff = value - means[stateIndex][idx];
                variance[idx] += diff * diff;
            });
        });
        return variance.map((value) => Math.max(value / samples.length, 1e-6));
    });

    let prevLogLikelihood = -Infinity;
    let logLikelihood = -Infinity;
    let iterations = 0;
    let gamma = null;

    const gaussianProbability = (vector, mean, variance) => {
        let logProb = 0;
        for (let i = 0; i < vector.length; i += 1) {
            const varValue = Math.max(variance[i] || 1e-6, 1e-6);
            const diff = vector[i] - mean[i];
            logProb += -0.5 * (Math.log(2 * Math.PI * varValue) + (diff * diff) / varValue);
        }
        return Math.exp(logProb);
    };

    const forwardBackward = (emissions) => {
        const T = emissions.length;
        const K = initialProbabilities.length;
        const alpha = new Array(T).fill(null).map(() => new Array(K).fill(0));
        const beta = new Array(T).fill(null).map(() => new Array(K).fill(0));
        const xi = new Array(Math.max(0, T - 1)).fill(null).map(() => new Array(K).fill(null).map(() => new Array(K).fill(0)));
        const scales = new Array(T).fill(1);

        let sumAlpha = 0;
        for (let k = 0; k < K; k += 1) {
            alpha[0][k] = initialProbabilities[k] * emissions[0][k];
            sumAlpha += alpha[0][k];
        }
        if (!Number.isFinite(sumAlpha) || sumAlpha <= 0) sumAlpha = 1e-12;
        scales[0] = sumAlpha;
        for (let k = 0; k < K; k += 1) {
            alpha[0][k] /= sumAlpha;
        }

        for (let t = 1; t < T; t += 1) {
            let rowSum = 0;
            for (let j = 0; j < K; j += 1) {
                let accum = 0;
                for (let i = 0; i < K; i += 1) {
                    accum += alpha[t - 1][i] * transitionMatrix[i][j];
                }
                alpha[t][j] = accum * emissions[t][j];
                rowSum += alpha[t][j];
            }
            if (!Number.isFinite(rowSum) || rowSum <= 0) rowSum = 1e-12;
            scales[t] = rowSum;
            for (let j = 0; j < K; j += 1) {
                alpha[t][j] /= rowSum;
            }
        }

        for (let k = 0; k < K; k += 1) {
            beta[T - 1][k] = 1;
        }
        for (let t = T - 2; t >= 0; t -= 1) {
            for (let i = 0; i < K; i += 1) {
                let accum = 0;
                for (let j = 0; j < K; j += 1) {
                    accum += transitionMatrix[i][j] * emissions[t + 1][j] * beta[t + 1][j];
                }
                beta[t][i] = accum / scales[t + 1];
            }
        }

        gamma = new Array(T).fill(null).map(() => new Array(K).fill(0));
        for (let t = 0; t < T; t += 1) {
            let denom = 0;
            for (let i = 0; i < K; i += 1) {
                gamma[t][i] = alpha[t][i] * beta[t][i];
                denom += gamma[t][i];
            }
            if (!Number.isFinite(denom) || denom <= 0) denom = 1e-12;
            for (let i = 0; i < K; i += 1) {
                gamma[t][i] /= denom;
            }
        }

        for (let t = 0; t < T - 1; t += 1) {
            let denom = 0;
            for (let i = 0; i < K; i += 1) {
                for (let j = 0; j < K; j += 1) {
                    xi[t][i][j] = alpha[t][i] * transitionMatrix[i][j] * emissions[t + 1][j] * beta[t + 1][j];
                    denom += xi[t][i][j];
                }
            }
            if (!Number.isFinite(denom) || denom <= 0) denom = 1e-12;
            for (let i = 0; i < K; i += 1) {
                for (let j = 0; j < K; j += 1) {
                    xi[t][i][j] /= denom;
                }
            }
        }

        const logLik = scales.reduce((acc, value) => acc + Math.log(value), 0);
        return { gamma, xi, logLikelihood: logLik };
    };

    while (iterations < maxIterations) {
        iterations += 1;
        const emissions = clean.map((row) => {
            const emissionRow = new Array(numStates).fill(0);
            for (let stateIndex = 0; stateIndex < numStates; stateIndex += 1) {
                const probability = gaussianProbability(row, means[stateIndex], variances[stateIndex]);
                emissionRow[stateIndex] = Number.isFinite(probability) && probability > 0 ? probability : 1e-12;
            }
            return emissionRow;
        });

        const fb = forwardBackward(emissions);
        if (!fb || !fb.gamma) break;
        gamma = fb.gamma;
        logLikelihood = fb.logLikelihood;

        const K = numStates;
        const T = clean.length;
        const gammaSums = new Array(K).fill(0);
        for (let t = 0; t < T; t += 1) {
            for (let k = 0; k < K; k += 1) {
                gammaSums[k] += gamma[t][k];
            }
        }

        for (let k = 0; k < K; k += 1) {
            initialProbabilities[k] = gamma[0][k];
        }

        for (let i = 0; i < K; i += 1) {
            const denom = gammaSums[i] - gamma[T - 1][i];
            for (let j = 0; j < K; j += 1) {
                let numerator = 0;
                for (let t = 0; t < T - 1; t += 1) {
                    numerator += fb.xi[t][i][j];
                }
                transitionMatrix[i][j] = denom > 0 ? numerator / denom : 1 / K;
            }
            let rowSum = transitionMatrix[i].reduce((acc, value) => acc + value, 0);
            if (!Number.isFinite(rowSum) || rowSum <= 0) {
                transitionMatrix[i] = new Array(K).fill(1 / K);
            } else {
                transitionMatrix[i] = transitionMatrix[i].map((value) => {
                    const normalized = value / rowSum;
                    return Number.isFinite(normalized) ? Math.max(1e-6, normalized) : 1 / K;
                });
                const renorm = transitionMatrix[i].reduce((acc, value) => acc + value, 0);
                transitionMatrix[i] = transitionMatrix[i].map((value) => value / renorm);
            }
        }

        for (let stateIndex = 0; stateIndex < numStates; stateIndex += 1) {
            const sumGamma = gammaSums[stateIndex];
            const mean = new Array(dimension).fill(0);
            for (let t = 0; t < clean.length; t += 1) {
                const weight = gamma[t][stateIndex];
                for (let d = 0; d < dimension; d += 1) {
                    mean[d] += weight * clean[t][d];
                }
            }
            if (sumGamma > 0) {
                for (let d = 0; d < dimension; d += 1) {
                    mean[d] /= sumGamma;
                }
            } else {
                for (let d = 0; d < dimension; d += 1) {
                    mean[d] = means[stateIndex][d];
                }
            }
            means[stateIndex] = mean;

            const variance = new Array(dimension).fill(0);
            for (let t = 0; t < clean.length; t += 1) {
                const weight = gamma[t][stateIndex];
                for (let d = 0; d < dimension; d += 1) {
                    const diff = clean[t][d] - mean[d];
                    variance[d] += weight * diff * diff;
                }
            }
            for (let d = 0; d < dimension; d += 1) {
                variance[d] = sumGamma > 0 ? Math.max(variance[d] / sumGamma, 1e-6) : variances[stateIndex][d];
            }
            variances[stateIndex] = variance;
        }

        if (Number.isFinite(logLikelihood) && Number.isFinite(prevLogLikelihood)) {
            if (Math.abs(logLikelihood - prevLogLikelihood) < tolerance) {
                break;
            }
        }
        prevLogLikelihood = logLikelihood;
    }

    const sequence = Array.isArray(gamma)
        ? gamma.map((row) => {
            let maxValue = -Infinity;
            let index = 0;
            row.forEach((value, idx) => {
                if (value > maxValue) {
                    maxValue = value;
                    index = idx;
                }
            });
            return index;
        })
        : [];

    return {
        iterations,
        logLikelihood,
        initial: initialProbabilities,
        transition: transitionMatrix,
        means,
        variances,
        posteriors: gamma,
        sequence,
    };
}

function mapStatesToRegimes(model) {
    if (!model || !Array.isArray(model.means)) return null;
    const descriptors = model.means.map((mean, index) => ({
        index,
        returnMean: Number(mean?.[0]) || 0,
        volMean: Number(mean?.[1]) || 0,
    }));
    if (descriptors.length === 0) return null;
    const sortedByReturn = descriptors.slice().sort((a, b) => a.returnMean - b.returnMean);
    const bears = sortedByReturn.slice(0, Math.min(2, sortedByReturn.length));
    const bulls = sortedByReturn.slice(-Math.min(2, sortedByReturn.length));
    bears.sort((a, b) => a.volMean - b.volMean);
    bulls.sort((a, b) => a.volMean - b.volMean);
    const labelToState = {
        bearLowVol: bears[0]?.index,
        bearHighVol: bears[1]?.index,
        bullLowVol: bulls[0]?.index,
        bullHighVol: bulls[1]?.index,
    };
    const used = new Set();
    const allIndices = descriptors.map((item) => item.index);
    Object.keys(labelToState).forEach((label) => {
        const stateIndex = labelToState[label];
        if (Number.isInteger(stateIndex) && !used.has(stateIndex)) {
            used.add(stateIndex);
        } else {
            const fallback = allIndices.find((idx) => !used.has(idx));
            if (fallback !== undefined) {
                labelToState[label] = fallback;
                used.add(fallback);
            }
        }
    });
    const stateToLabel = {};
    Object.entries(labelToState).forEach(([label, index]) => {
        if (Number.isInteger(index)) {
            stateToLabel[index] = label;
        }
    });
    return { labelToState, stateToLabel, descriptors };
}

function combineDirectionVol(direction, volatility) {
    if (volatility === 'low') {
        return 'rangeBound';
    }
    return direction === 'bear' ? 'bearHighVol' : 'bullHighVol';
}

function parseRegimeLabel(label) {
    switch (label) {
    case 'bullHighVol':
        return { direction: 'bull', volatility: 'high' };
    case 'bearHighVol':
        return { direction: 'bear', volatility: 'high' };
    case 'rangeBound':
        return { direction: 'bear', volatility: 'low' };
    case 'bullLowVol':
        return { direction: 'bull', volatility: 'low' };
    case 'bearLowVol':
        return { direction: 'bear', volatility: 'low' };
    default:
        return { direction: 'bear', volatility: 'low' };
    }
}

function resolveVolatilityClass(adx, bollWidth, atrRatio, thresholds) {
    if (!thresholds) return null;
    let highScore = 0;
    let lowScore = 0;
    if (Number.isFinite(adx)) {
        if (adx >= thresholds.adxTrend) highScore += 1;
        if (adx <= thresholds.adxFlat) lowScore += 1;
    }
    if (Number.isFinite(bollWidth)) {
        if (bollWidth >= thresholds.bollTrend) highScore += 1;
        if (bollWidth <= thresholds.bollFlat) lowScore += 1;
    }
    if (Number.isFinite(atrRatio)) {
        if (atrRatio >= thresholds.atrTrend) highScore += 1;
        if (atrRatio <= thresholds.atrFlat) lowScore += 1;
    }
    if (highScore >= 2) return 'high';
    if (lowScore >= 2) return 'low';
    return null;
}

function inferTrendDirection(index, base, thresholds, hmmLabel, logReturn) {
    if (hmmLabel === 'bullHighVol' || hmmLabel === 'bullLowVol') {
        return 'bull';
    }
    if (hmmLabel === 'bearHighVol' || hmmLabel === 'bearLowVol') {
        return 'bear';
    }
    if (Number.isFinite(logReturn) && Math.abs(logReturn) > 1e-5) {
        return logReturn >= 0 ? 'bull' : 'bear';
    }
    const closes = Array.isArray(base?.closes) ? base.closes : [];
    if (index > 0 && closes.length > index) {
        const prev = Number(closes[index - 1]);
        const current = Number(closes[index]);
        if (Number.isFinite(prev) && Number.isFinite(current) && current !== prev) {
            return current >= prev ? 'bull' : 'bear';
        }
    }
    const atrRatio = Number(base?.atrRatio?.[index]);
    if (Number.isFinite(atrRatio) && Number.isFinite(thresholds?.atrTrend)) {
        if (atrRatio >= thresholds.atrTrend) return 'bull';
        if (atrRatio <= thresholds.atrFlat) return 'bear';
    }
    return null;
}

function computeTrendPromotionScore(index, base, thresholds) {
    if (!base || !thresholds) return null;
    const adx = Number(base.adx?.[index]);
    const bollWidth = Number(base.bollWidth?.[index]);
    const atrRatio = Number(base.atrRatio?.[index]);
    const logReturn = Number(base.logReturns?.[index]);
    const hmmLabel = base.hmm?.assignments?.[index] || null;
    const posteriors = Array.isArray(base.hmm?.posteriors?.[index])
        ? base.hmm.posteriors[index]
        : null;
    const labelToState = base.hmm?.mapping?.labelToState || {};

    const adxPivot = (thresholds.adxTrend + thresholds.adxFlat) / 2;
    const adxScale = Math.max(1, (thresholds.adxTrend - thresholds.adxFlat) / 2);
    const bollPivot = (thresholds.bollTrend + thresholds.bollFlat) / 2;
    const bollScale = Math.max(0.005, (thresholds.bollTrend - thresholds.bollFlat) / 2);
    const atrPivot = (thresholds.atrTrend + thresholds.atrFlat) / 2;
    const atrScale = Math.max(0.003, (thresholds.atrTrend - thresholds.atrFlat) / 2);

    const adxScore = logistic((adx - adxPivot) / adxScale);
    const bollScore = logistic((bollWidth - bollPivot) / bollScale);
    const atrScore = logistic((atrRatio - atrPivot) / atrScale);
    const momentumScore = logistic((Number.isFinite(logReturn) ? logReturn : 0) * 180);

    let highPosterior = 0;
    let lowPosterior = 0;
    if (posteriors) {
        const bullHighIndex = Number.isInteger(labelToState.bullHighVol)
            ? labelToState.bullHighVol
            : null;
        const bearHighIndex = Number.isInteger(labelToState.bearHighVol)
            ? labelToState.bearHighVol
            : null;
        const bullLowIndex = Number.isInteger(labelToState.bullLowVol)
            ? labelToState.bullLowVol
            : null;
        const bearLowIndex = Number.isInteger(labelToState.bearLowVol)
            ? labelToState.bearLowVol
            : null;
        if (Number.isInteger(bullHighIndex) && Number.isFinite(posteriors[bullHighIndex])) {
            highPosterior += Math.max(0, posteriors[bullHighIndex]);
        }
        if (Number.isInteger(bearHighIndex) && Number.isFinite(posteriors[bearHighIndex])) {
            highPosterior += Math.max(0, posteriors[bearHighIndex]);
        }
        if (Number.isInteger(bullLowIndex) && Number.isFinite(posteriors[bullLowIndex])) {
            lowPosterior += Math.max(0, posteriors[bullLowIndex]);
        }
        if (Number.isInteger(bearLowIndex) && Number.isFinite(posteriors[bearLowIndex])) {
            lowPosterior += Math.max(0, posteriors[bearLowIndex]);
        }
    }
    const posteriorScore = logistic((highPosterior - lowPosterior) * 5);

    const combinedScore = (
        (adxScore * 0.3)
        + (bollScore * 0.25)
        + (atrScore * 0.2)
        + (momentumScore * 0.15)
        + (posteriorScore * 0.1)
    );

    const direction = inferTrendDirection(index, base, thresholds, hmmLabel, logReturn);
    if (!direction) return null;
    return { index, score: combinedScore, direction };
}

function applyTrendCoverageTarget(labels, base, thresholds) {
    if (!Array.isArray(labels)) {
        return { labels: Array.isArray(labels) ? labels.slice() : [], promotions: 0, reached: true };
    }
    if (!thresholds || !Number.isFinite(thresholds.targetTrendCoverage)) {
        return { labels: labels.slice(), promotions: 0, reached: true };
    }
    const working = labels.slice();
    const totalDays = working.reduce(
        (acc, label) => (TREND_STYLE_MAP[label] ? acc + 1 : acc),
        0,
    );
    if (totalDays === 0) {
        return { labels: working, promotions: 0, reached: true };
    }
    const targetTrendDays = Math.min(
        totalDays,
        Math.ceil(totalDays * thresholds.targetTrendCoverage),
    );
    let currentTrendDays = working.reduce((acc, label) => {
        if (label === 'bullHighVol' || label === 'bearHighVol') return acc + 1;
        return acc;
    }, 0);
    if (currentTrendDays >= targetTrendDays) {
        return { labels: working, promotions: 0, reached: true };
    }
    const candidates = [];
    for (let i = 0; i < working.length; i += 1) {
        if (working[i] !== 'rangeBound') continue;
        const candidate = computeTrendPromotionScore(i, base, thresholds);
        if (candidate) {
            candidates.push(candidate);
        }
    }
    if (!candidates.length) {
        return { labels: working, promotions: 0, reached: currentTrendDays >= targetTrendDays };
    }
    candidates.sort((a, b) => b.score - a.score);
    const floor = Number.isFinite(thresholds.promotionFloor)
        ? thresholds.promotionFloor
        : 0.45;
    let promotions = 0;
    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        if (candidate.score < floor) break;
        const newLabel = candidate.direction === 'bear' ? 'bearHighVol' : 'bullHighVol';
        working[candidate.index] = newLabel;
        promotions += 1;
        currentTrendDays += 1;
        if (currentTrendDays >= targetTrendDays) break;
    }
    return {
        labels: working,
        promotions,
        reached: currentTrendDays >= targetTrendDays,
    };
}

function fillMissingLabels(labels) {
    if (!Array.isArray(labels)) return [];
    let last = null;
    for (let i = 0; i < labels.length; i += 1) {
        if (labels[i]) {
            last = labels[i];
        } else if (last) {
            labels[i] = last;
        }
    }
    let next = null;
    for (let i = labels.length - 1; i >= 0; i -= 1) {
        if (labels[i]) {
            next = labels[i];
        } else if (next) {
            labels[i] = next;
        }
    }
    for (let i = 0; i < labels.length; i += 1) {
        if (!labels[i]) labels[i] = 'rangeBound';
    }
    return labels;
}

function smoothLabels(labels, windowSize) {
    if (!Array.isArray(labels) || windowSize <= 1) return Array.isArray(labels) ? labels.slice() : [];
    const result = labels.slice();
    const half = Math.floor(windowSize / 2);
    for (let i = 0; i < labels.length; i += 1) {
        const counts = {};
        let maxLabel = result[i] || 'rangeBound';
        let maxCount = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(labels.length - 1, i + half); j += 1) {
            const label = labels[j];
            if (!label) continue;
            counts[label] = (counts[label] || 0) + 1;
            if (counts[label] > maxCount) {
                maxCount = counts[label];
                maxLabel = label;
            }
        }
        result[i] = maxLabel;
    }
    return result;
}

function enforceMinSegmentLength(labels, minLength) {
    if (!Array.isArray(labels) || minLength <= 1) return Array.isArray(labels) ? labels.slice() : [];
    const result = labels.slice();
    let index = 0;
    while (index < result.length) {
        const label = result[index];
        let end = index + 1;
        while (end < result.length && result[end] === label) {
            end += 1;
        }
        const segmentLength = end - index;
        if (segmentLength > 0 && segmentLength < minLength) {
            const prev = index > 0 ? result[index - 1] : null;
            const next = end < result.length ? result[end] : null;
            const replacement = next ?? prev ?? label;
            for (let i = index; i < end; i += 1) {
                result[i] = replacement;
            }
        }
        index = end;
    }
    return result;
}

function buildSegmentsAndAggregate(labels, logReturns, strategyLogReturns) {
    const length = Array.isArray(labels) ? labels.length : 0;
    const aggregated = {};
    const returnCounts = {};
    Object.keys(TREND_STYLE_MAP).forEach((key) => {
        aggregated[key] = {
            segments: 0,
            days: 0,
            logReturnSum: 0,
            strategyLogReturnSum: 0,
            coveragePct: 0,
            returnPct: null,
            strategyReturnPct: null,
            strategyDays: 0,
        };
        returnCounts[key] = 0;
    });
    const segments = [];
    if (length === 0) {
        return { segments, aggregated, totalDays: 0 };
    }
    let current = labels[0];
    let start = 0;
    let totalDays = 0;
    for (let i = 0; i < length; i += 1) {
        const label = labels[i];
        if (!label || !TREND_STYLE_MAP[label]) continue;
        totalDays += 1;
        aggregated[label].days += 1;
        if (Number.isFinite(logReturns?.[i])) {
            aggregated[label].logReturnSum += logReturns[i];
            returnCounts[label] += 1;
        }
        if (Number.isFinite(strategyLogReturns?.[i])) {
            aggregated[label].strategyLogReturnSum += strategyLogReturns[i];
            aggregated[label].strategyDays += 1;
        }
        if (i === 0) {
            current = label;
            start = 0;
        } else if (label !== current) {
            segments.push({
                type: current,
                startIndex: start,
                endIndex: i - 1,
                overlay: TREND_STYLE_MAP[current]?.overlay,
            });
            aggregated[current].segments += 1;
            current = label;
            start = i;
        }
    }
    if (current && TREND_STYLE_MAP[current]) {
        segments.push({
            type: current,
            startIndex: start,
            endIndex: length - 1,
            overlay: TREND_STYLE_MAP[current]?.overlay,
        });
        aggregated[current].segments += 1;
    }
    Object.keys(aggregated).forEach((key) => {
        const entry = aggregated[key];
        const count = returnCounts[key];
        if (count > 0) {
            entry.returnPct = Math.expm1(entry.logReturnSum) * 100;
        } else {
            entry.returnPct = null;
        }
        if (entry.strategyDays > 0) {
            entry.strategyReturnPct = Math.expm1(entry.strategyLogReturnSum) * 100;
        } else {
            entry.strategyReturnPct = null;
            entry.strategyLogReturnSum = null;
        }
        entry.coveragePct = totalDays > 0 ? (entry.days / totalDays) * 100 : 0;
    });
    return { segments, aggregated, totalDays };
}

function computeAverageConfidence(labels, posteriors, labelToState) {
    if (!Array.isArray(labels) || !Array.isArray(posteriors)) return null;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];
        const posteriorRow = posteriors[i];
        if (!label || !Array.isArray(posteriorRow)) continue;
        const candidateStates = [];
        if (label === 'rangeBound') {
            const bullLowIndex = labelToState?.bullLowVol;
            const bearLowIndex = labelToState?.bearLowVol;
            if (Number.isInteger(bullLowIndex)) candidateStates.push(bullLowIndex);
            if (Number.isInteger(bearLowIndex)) candidateStates.push(bearLowIndex);
        } else {
            const stateIndex = labelToState?.[label];
            if (Number.isInteger(stateIndex)) candidateStates.push(stateIndex);
        }
        let value = null;
        if (candidateStates.length > 0) {
            const finiteValues = candidateStates
                .map((idx) => (Number.isFinite(posteriorRow[idx]) ? posteriorRow[idx] : null))
                .filter((val) => Number.isFinite(val));
            if (finiteValues.length > 0) {
                value = Math.max(...finiteValues);
            }
        }
        if (!Number.isFinite(value)) {
            const finiteValues = posteriorRow.filter((val) => Number.isFinite(val));
            if (finiteValues.length > 0) {
                value = Math.max(...finiteValues);
            }
        }
        if (Number.isFinite(value)) {
            sum += value;
            count += 1;
        }
    }
    if (count === 0) return null;
    return sum / count;
}

function prepareRegimeBaseData(result, options = {}) {
    const dates = Array.isArray(result?.dates) ? result.dates.slice() : [];
    if (dates.length === 0) return null;
    const previousBase = options.previousBase || null;
    const fallbackRawData = Array.isArray(options.fallbackRawData) ? options.fallbackRawData : null;
    const rawCandidates = [];
    if (Array.isArray(result?.rawData) && result.rawData.length > 0) {
        rawCandidates.push(result.rawData);
    }
    if (Array.isArray(result?.rawDataUsed) && result.rawDataUsed.length > 0) {
        rawCandidates.push(result.rawDataUsed);
    }
    if (fallbackRawData && fallbackRawData.length > 0) {
        rawCandidates.push(fallbackRawData);
    }
    let rawRows = [];
    for (let i = 0; i < rawCandidates.length; i += 1) {
        if (Array.isArray(rawCandidates[i]) && rawCandidates[i].length > 0) {
            rawRows = rawCandidates[i];
            break;
        }
    }
    if (rawRows.length === 0) {
        if (previousBase && areSameTrendDateSequence(dates, previousBase.dates)) {
            return previousBase;
        }
        return null;
    }
    const rowByDate = new Map();
    rawRows.forEach((row) => {
        const sanitized = sanitizeTrendRawRow(row);
        if (sanitized) {
            rowByDate.set(sanitized.date, sanitized);
        }
    });
    if (rowByDate.size === 0) {
        if (previousBase && areSameTrendDateSequence(dates, previousBase.dates)) {
            return previousBase;
        }
        return null;
    }
    const opens = [];
    const highs = [];
    const lows = [];
    const closes = [];
    const volumes = [];
    dates.forEach((date) => {
        const row = rowByDate.get(date) || null;
        const open = Number(row?.open);
        const high = Number(row?.high);
        const low = Number(row?.low);
        const close = Number(row?.close);
        const volume = Number(row?.volume);
        opens.push(Number.isFinite(open) ? open : null);
        highs.push(Number.isFinite(high) ? high : null);
        lows.push(Number.isFinite(low) ? low : null);
        closes.push(Number.isFinite(close) ? close : null);
        volumes.push(Number.isFinite(volume) ? volume : null);
    });
    const logReturns = computeLogReturns(closes);
    const strategyReturns = dates.map((_, idx) => {
        const raw = Number(result?.strategyReturns?.[idx]);
        return Number.isFinite(raw) ? raw : null;
    });
    const strategyLogReturns = computeStrategyLogReturns(strategyReturns);
    const atrSeries = computeATRSeries(highs, lows, closes, 14);
    const atrRatio = atrSeries.map((atr, idx) => {
        const close = closes[idx];
        if (!Number.isFinite(atr) || !Number.isFinite(close) || close === 0) return null;
        return atr / close;
    });
    const bollWidth = computeBollingerBandwidth(closes, 20, 2);
    const adx = computeADXSeries(highs, lows, closes, 14);
    const logReturnSkewness = computeRollingSkewness(logReturns, 20);
    const volumeZScore = computeRollingZScore(volumes, 20);
    const observations = [];
    const indices = [];
    for (let i = 0; i < dates.length; i += 1) {
        if (
            Number.isFinite(logReturns[i])
            && Number.isFinite(atrRatio[i])
            && Number.isFinite(logReturnSkewness[i])
            && Number.isFinite(volumeZScore[i])
        ) {
            observations.push([
                logReturns[i],
                atrRatio[i],
                logReturnSkewness[i],
                volumeZScore[i],
            ]);
            indices.push(i);
        }
    }
    let normalization = null;
    let hmmModel = null;
    if (observations.length >= 16) {
        normalization = normalizeObservationMatrix(observations);
        hmmModel = trainFourStateHMM(normalization.normalized, { maxIterations: 100, tolerance: 1e-4 });
    }
    const hmmAssignments = new Array(dates.length).fill(null);
    const hmmPosteriors = new Array(dates.length).fill(null);
    let mapping = null;
    if (hmmModel) {
        mapping = mapStatesToRegimes(hmmModel);
        const reverseMap = mapping?.stateToLabel || {};
        indices.forEach((targetIndex, seqIndex) => {
            const stateIndex = Array.isArray(hmmModel.sequence) ? hmmModel.sequence[seqIndex] : null;
            const label = Number.isInteger(stateIndex) ? reverseMap[stateIndex] : null;
            hmmAssignments[targetIndex] = label || null;
            const posteriorRow = Array.isArray(hmmModel.posteriors?.[seqIndex])
                ? hmmModel.posteriors[seqIndex].slice()
                : null;
            if (posteriorRow) {
                hmmPosteriors[targetIndex] = posteriorRow;
            }
        });
    }

    return {
        dates,
        opens,
        highs,
        lows,
        closes,
        volumes,
        logReturns,
        strategyLogReturns,
        atrSeries,
        atrRatio,
        bollWidth,
        adx,
        logReturnSkewness,
        volumeZScore,
        hmm: {
            model: hmmModel,
            assignments: hmmAssignments,
            posteriors: hmmPosteriors,
            mapping,
            iterations: hmmModel?.iterations ?? null,
            logLikelihood: hmmModel?.logLikelihood ?? null,
            normalization: normalization
                ? { mean: normalization.mean, std: normalization.std }
                : null,
        },
    };
}

function classifyRegimes(base, thresholds) {
    if (!base || !Array.isArray(base.dates) || base.dates.length === 0) {
        return { labels: [], segments: [], summary: null };
    }
    const length = base.dates.length;
    const baseAssignments = Array.isArray(base.hmm?.assignments) ? base.hmm.assignments : [];
    const posteriors = Array.isArray(base.hmm?.posteriors) ? base.hmm.posteriors : [];
    const labelToState = base.hmm?.mapping?.labelToState || null;
    const finalLabels = new Array(length).fill(null);
    const atrMedian = computeMedian(base.atrRatio);
    for (let i = 0; i < length; i += 1) {
        const baseLabel = baseAssignments[i];
        const parsed = parseRegimeLabel(baseLabel);
        let direction = parsed.direction;
        let volatility = parsed.volatility;
        if (!baseLabel) {
            direction = Number.isFinite(base.logReturns?.[i]) && base.logReturns[i] >= 0 ? 'bull' : 'bear';
            if (Number.isFinite(base.atrRatio?.[i]) && Number.isFinite(atrMedian)) {
                volatility = base.atrRatio[i] >= atrMedian ? 'high' : 'low';
            }
        }
        const override = resolveVolatilityClass(base.adx?.[i], base.bollWidth?.[i], base.atrRatio?.[i], thresholds);
        if (override) {
            volatility = override;
        }
        finalLabels[i] = combineDirectionVol(direction, volatility);
    }
    fillMissingLabels(finalLabels);
    let working = thresholds?.smoothingWindow > 1
        ? smoothLabels(finalLabels, thresholds.smoothingWindow)
        : finalLabels.slice();
    let promotions = 0;
    let coverageResult = applyTrendCoverageTarget(working, base, thresholds);
    working = coverageResult.labels;
    promotions += coverageResult.promotions;
    if (thresholds?.minSegmentLength > 1) {
        working = enforceMinSegmentLength(working, thresholds.minSegmentLength);
        coverageResult = applyTrendCoverageTarget(working, base, thresholds);
        working = coverageResult.labels;
        promotions += coverageResult.promotions;
    }
    const enforced = working;
    const aggregation = buildSegmentsAndAggregate(enforced, base.logReturns, base.strategyLogReturns);
    const averageConfidence = computeAverageConfidence(enforced, posteriors, labelToState);
    const bullCoverage = aggregation.aggregated?.bullHighVol?.coveragePct || 0;
    const bearCoverage = aggregation.aggregated?.bearHighVol?.coveragePct || 0;
    const rangeCoverage = aggregation.aggregated?.rangeBound?.coveragePct || 0;
    const targetTrendPct = Number.isFinite(thresholds?.targetTrendCoverage)
        ? thresholds.targetTrendCoverage * 100
        : null;
    const targetRangePct = Number.isFinite(thresholds?.targetRangeCoverage)
        ? thresholds.targetRangeCoverage * 100
        : null;
    const lastIndex = enforced.length > 0 ? enforced.length - 1 : -1;
    const latestLabel = lastIndex >= 0 ? enforced[lastIndex] || null : null;
    const latestDate = lastIndex >= 0 && Array.isArray(base.dates)
        ? base.dates[lastIndex] || null
        : null;
    const latestStats = latestLabel ? aggregation.aggregated?.[latestLabel] : null;
    const latestStrategyReturn = Number.isFinite(latestStats?.strategyReturnPct)
        ? latestStats.strategyReturnPct
        : null;
    const latestPriceReturn = Number.isFinite(latestStats?.returnPct)
        ? latestStats.returnPct
        : null;
    const summary = {
        aggregatedByType: aggregation.aggregated,
        totalDays: aggregation.totalDays,
        averageConfidence,
        hmm: {
            iterations: base.hmm?.iterations ?? null,
            logLikelihood: base.hmm?.logLikelihood ?? null,
        },
        coverage: {
            targetTrendPct,
            targetRangePct,
            actualTrendPct: bullCoverage + bearCoverage,
            actualRangePct: rangeCoverage,
            promotions,
            satisfied: coverageResult?.reached
                || (Number.isFinite(targetTrendPct)
                    ? (bullCoverage + bearCoverage) >= targetTrendPct - 0.5
                    : true),
        },
        latest: {
            label: latestLabel,
            date: latestDate,
            strategyReturnPct: latestStrategyReturn,
            returnPct: Number.isFinite(latestStrategyReturn) ? latestStrategyReturn : latestPriceReturn,
        },
    };
    return {
        labels: enforced,
        segments: aggregation.segments,
        summary,
    };
}


function computeTrendAnalysisFromResult(result, thresholds) {
    const fallbackRawData = Array.isArray(result?.rawData) && result.rawData.length > 0
        ? result.rawData
        : Array.isArray(result?.rawDataUsed) && result.rawDataUsed.length > 0
            ? result.rawDataUsed
            : trendAnalysisState.result?.rawData || null;
    let base = prepareRegimeBaseData(result, {
        previousBase: trendAnalysisState.base || null,
        fallbackRawData,
    });
    if (base) {
        trendAnalysisState.base = base;
    } else if (trendAnalysisState.base) {
        base = trendAnalysisState.base;
    } else {
        trendAnalysisState.base = null;
    }
    if (!base) {
        trendAnalysisState.classifiedLabels = [];
        return { segments: [], summary: null };
    }
    const classification = classifyRegimes(base, thresholds);
    trendAnalysisState.classifiedLabels = classification.labels || [];
    return {
        segments: classification.segments || [],
        summary: classification.summary || null,
    };
}

function isTrendAnalysisCardExpanded() {
    if (typeof document === 'undefined') return true;
    const card = document.getElementById('trend-analysis-card');
    if (!card) return true;
    return (card.dataset.collapsed || 'true') !== 'true';
}

function resolveTrendOverlaySegments() {
    if (!isTrendAnalysisCardExpanded()) {
        return [];
    }
    return Array.isArray(trendAnalysisState.segments) ? trendAnalysisState.segments : [];
}

function updateChartTrendOverlay() {
    if (!stockChart) return;
    if (!stockChart.options) stockChart.options = {};
    if (!stockChart.options.plugins) stockChart.options.plugins = {};
    stockChart.options.plugins[TREND_BACKGROUND_PLUGIN_ID] = {
        ...(stockChart.options.plugins[TREND_BACKGROUND_PLUGIN_ID] || {}),
        segments: resolveTrendOverlaySegments(),
    };
    stockChart.update('none');
}

function renderTrendSummary() {
    const sliderValueEl = document.getElementById('trendSensitivityValue');
    const calibration = trendAnalysisState.calibration || createDefaultTrendSensitivityCalibration();
    const summary = trendAnalysisState.summary;
    if (sliderValueEl) {
        const averageText = Number.isFinite(summary?.averageConfidence)
            ? formatPercentPlain(summary.averageConfidence * 100, 1)
            : '—';
        sliderValueEl.textContent = `平均狀態信心：${averageText}`;
    }
    const thresholdTextEl = document.getElementById('trend-threshold-text');
    if (thresholdTextEl) {
        thresholdTextEl.textContent = '';
        thresholdTextEl.classList.add('hidden');
    }
    const container = document.getElementById('trend-summary-container');
    const placeholder = document.getElementById('trend-summary-placeholder');
    const metaEl = document.getElementById('trend-summary-meta');
    const parameterDetailsEl = document.getElementById('trend-parameter-details');
    if (!container || !placeholder) return;
    if (!summary) {
        container.innerHTML = '';
        placeholder.classList.remove('hidden');
        if (metaEl) {
            metaEl.innerHTML = '';
            metaEl.classList.add('hidden');
        }
        if (parameterDetailsEl) {
            parameterDetailsEl.innerHTML = '';
        }
        return;
    }
    placeholder.classList.add('hidden');
    const order = ['bullHighVol', 'rangeBound', 'bearHighVol'];
    const latestLabel = summary.latest?.label || null;
    const latestDateLabel = formatTrendLatestDate(summary.latest?.date);
    const aggregatedEntries = Object.values(summary.aggregatedByType || {});
    const hasStrategyData = aggregatedEntries.some((entry) => Number.isFinite(entry?.strategyReturnPct));
    const totalLogReturn = aggregatedEntries.reduce((acc, entry) => {
        const value = hasStrategyData
            ? entry?.strategyLogReturnSum
            : entry?.logReturnSum;
        return Number.isFinite(value) ? acc + value : acc;
    }, 0);
    const totalReturnPct = Number.isFinite(totalLogReturn)
        ? Math.expm1(totalLogReturn) * 100
        : null;
    const totalReturnText = Number.isFinite(totalReturnPct)
        ? formatPercentSigned(totalReturnPct, 2)
        : '—';
    const totalDays = Number.isFinite(summary.totalDays) ? summary.totalDays : 0;
    const coverageSummary = Number.isFinite(summary.coverage?.actualTrendPct)
        && Number.isFinite(summary.coverage?.actualRangePct)
        ? formatPercentPlain(summary.coverage.actualTrendPct + summary.coverage.actualRangePct, 1)
        : '—';
    const totalBlock = `
        <div class="trend-summary-total mb-3 rounded-lg border px-4 py-3" style="border-color: color-mix(in srgb, var(--border) 80%, transparent); background: color-mix(in srgb, var(--muted) 6%, var(--background));">
            <div class="flex items-center justify-between text-[11px]" style="color: var(--muted-foreground);">
                <div>總報酬 ${latestDateLabel ? `(${latestDateLabel})` : ''}</div>
                <div>${totalDays ? `${totalDays} 日` : '—'} / ${coverageSummary}</div>
            </div>
            <div class="text-2xl font-semibold mt-1" style="color: var(--foreground);">${totalReturnText}</div>
            <div class="text-[11px] mt-1" style="color: var(--muted-foreground);">整體覆蓋 ${coverageSummary}，含 ${totalDays} 日</div>
        </div>`;
    const cardMarkup = order.map((key) => {
        const style = TREND_STYLE_MAP[key] || {};
        const stats = summary.aggregatedByType?.[key]
            || { segments: 0, days: 0, coveragePct: 0, returnPct: null, strategyReturnPct: null };
        const coverageText = formatPercentPlain(stats.coveragePct || 0, 1);
        const valueToDisplay = hasStrategyData
            ? stats.strategyReturnPct
            : stats.returnPct;
        const returnText = Number.isFinite(valueToDisplay) ? formatPercentSigned(valueToDisplay, 2) : '—';
        const borderColor = style.border || 'rgba(148, 163, 184, 0.35)';
        const background = style.overlay || 'rgba(148, 163, 184, 0.15)';
        const accent = style.accent || 'var(--foreground)';
        const label = style.label || key;
        const latestTag = latestLabel === key && latestDateLabel
            ? `<span class="trend-summary-latest-date">（${latestDateLabel}）</span>`
            : '';
        return `<div class="trend-summary-item" style="border-color: ${borderColor}; background: ${background};">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2" style="color: ${accent};">
                    <span class="trend-summary-chip" style="background-color: ${background}; border-color: ${accent};"></span>
                    <strong>${label}</strong>${latestTag}
                </div>
                <span class="trend-summary-meta">${stats.segments} 段</span>
            </div>
            <div class="trend-summary-value" style="color: ${accent};">${returnText}</div>
            <div class="trend-summary-meta">覆蓋 ${coverageText} ／ ${stats.days} 日</div>
        </div>`;
    }).join('');
    const distributionHeading = `
        <div class="text-[11px] font-semibold mb-2" style="color: var(--foreground);">策略總報酬分布</div>`;
    container.innerHTML = totalBlock + distributionHeading + cardMarkup;
    const coverage = summary.coverage || {};
    const avgConfidence = Number.isFinite(summary.averageConfidence)
        ? formatPercentPlain(summary.averageConfidence * 100, 1)
        : '—';
    const iterationsText = Number.isFinite(summary.hmm?.iterations) ? summary.hmm.iterations : '—';
    const logLikelihoodText = Number.isFinite(summary.hmm?.logLikelihood)
        ? summary.hmm.logLikelihood.toFixed(1)
        : '—';
    const actualTrendText = Number.isFinite(coverage.actualTrendPct)
        ? formatPercentPlain(coverage.actualTrendPct, 1)
        : '—';
    const targetTrendText = Number.isFinite(coverage.targetTrendPct)
        ? formatPercentPlain(coverage.targetTrendPct, 0)
        : '—';
    const rangeText = Number.isFinite(coverage.actualRangePct)
        ? formatPercentPlain(coverage.actualRangePct, 1)
        : '—';
    const promotionsText = Number.isFinite(coverage.promotions)
        ? `${coverage.promotions} 日`
        : '—';
    const statusText = coverage.satisfied ? '達標' : '需再觀察';
    const calibrationSliderText = Number.isFinite(calibration?.bestSlider)
        ? calibration.bestSlider.toFixed(1)
        : '—';
    const calibrationEffectiveText = Number.isFinite(calibration?.bestEffective)
        ? calibration.bestEffective.toFixed(0)
        : '—';
    const calibrationScoreText = Number.isFinite(calibration?.bestScore)
        ? calibration.bestScore.toFixed(3)
        : '—';
    const diagnosticsLines = [
        `HMM 迭代：${iterationsText}`,
        `對數概似：${logLikelihoodText}`,
        `平均狀態信心：${avgConfidence}`,
        `趨勢覆蓋：${actualTrendText}（目標 ${targetTrendText}）`,
        `盤整覆蓋：${rangeText}`,
        `校準峰值：滑桿 ${calibrationSliderText}／等效 ${calibrationEffectiveText}／信心 ${calibrationScoreText}`,
        `Sigmoid 補償：${promotionsText}／${statusText}`,
        `總報酬：${totalReturnText}`,
    ];
    if (parameterDetailsEl) {
        const thresholds = trendAnalysisState.thresholds || computeTrendThresholds(
            trendAnalysisState.sensitivity,
            trendAnalysisState.calibration,
        );
        const formatNumber = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '—');
        const formatPercent = (value, digits = 1) => (Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—');
        const detailRows = [
            { label: '滑桿值', value: formatNumber(thresholds.sensitivity, 1) },
            { label: '有效敏感度', value: formatNumber(thresholds.effectiveSensitivity, 1) },
            { label: 'ADX 門檻（趨勢 / 盤整）', value: `${formatNumber(thresholds.adxTrend, 1)} / ${formatNumber(thresholds.adxFlat, 1)}` },
            { label: '布林通道（趨勢 / 盤整）', value: `${formatPercent(thresholds.bollTrend)} / ${formatPercent(thresholds.bollFlat)}` },
            { label: 'ATR 比率（趨勢 / 盤整）', value: `${formatPercent(thresholds.atrTrend)} / ${formatPercent(thresholds.atrFlat)}` },
            { label: '段長 / 平滑窗', value: `${Number.isFinite(thresholds.minSegmentLength) ? thresholds.minSegmentLength : '—'} / ${Number.isFinite(thresholds.smoothingWindow) ? thresholds.smoothingWindow : '—'}` },
            { label: '趨勢 / 盤整目標', value: `${formatPercent(thresholds.targetTrendCoverage)} / ${formatPercent(thresholds.targetRangeCoverage)}` },
            { label: 'Sigmoid 補償下限', value: formatPercent(thresholds.promotionFloor) },
        ];
        const detailMarkup = detailRows
            .map((row) => `<div class="flex items-center justify-between" style="color: var(--muted-foreground);"><span>${row.label}</span><span>${row.value}</span></div>`)
            .join('');
        const diagnosticsMarkup = `
            <div class="pt-3 mt-3 border-t" style="border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                <div class="text-[11px] font-semibold mb-2" style="color: var(--foreground);">趨勢校準指標</div>
                <div class="space-y-1 text-[11px]" style="color: var(--muted-foreground);">
                    ${diagnosticsLines.map((line) => `<div>${line}</div>`).join('')}
                </div>
            </div>`;
        parameterDetailsEl.innerHTML = detailMarkup + diagnosticsMarkup;
    }
    if (metaEl) {
        metaEl.innerHTML = '';
        metaEl.classList.add('hidden');
    }
    initSensitivityCollapse(document.getElementById('trend-analysis-content'));
}

function recomputeTrendAnalysis(options = {}) {
    trendAnalysisState.thresholds = computeTrendThresholds(
        trendAnalysisState.sensitivity,
        trendAnalysisState.calibration,
    );
    trendAnalysisState.sensitivity = trendAnalysisState.thresholds.sensitivity;
    if (trendAnalysisState.result) {
        const analysis = computeTrendAnalysisFromResult(trendAnalysisState.result, trendAnalysisState.thresholds);
        trendAnalysisState.segments = analysis.segments;
        trendAnalysisState.summary = analysis.summary;
    } else {
        trendAnalysisState.segments = [];
        trendAnalysisState.summary = null;
    }
    renderTrendSummary();
    if (!options.skipChartUpdate) {
        updateChartTrendOverlay();
    }
}

function initialiseTrendControls() {
    const slider = document.getElementById('trendSensitivitySlider');
    if (slider) {
        slider.value = `${trendAnalysisState.sensitivity}`;
        slider.addEventListener('input', (event) => {
            const value = Number.parseFloat(event.target.value);
            if (Number.isFinite(value)) {
                trendAnalysisState.sensitivity = Math.max(TREND_SENSITIVITY_MIN, Math.min(TREND_SENSITIVITY_MAX, value));
                recomputeTrendAnalysis();
            }
        });
    }
    trendAnalysisState.thresholds = computeTrendThresholds(
        trendAnalysisState.sensitivity,
        trendAnalysisState.calibration,
    );
    trendAnalysisState.sensitivity = trendAnalysisState.thresholds.sensitivity;
    renderTrendSummary();
}

document.addEventListener('DOMContentLoaded', initialiseTrendControls);

function cloneArrayOfRanges(ranges) {
    if (!Array.isArray(ranges)) return undefined;
    return ranges
        .map((range) => {
            if (!range || typeof range !== 'object') return null;
            return {
                start: range.start || null,
                end: range.end || null,
            };
        })
        .filter((range) => range !== null);
}

function normaliseFetchDiagnosticsForCacheReplay(diagnostics, options = {}) {
    const base = diagnostics && typeof diagnostics === 'object' ? diagnostics : {};
    const requestedRange = options.requestedRange || base.requested || null;
    const requestedStart = requestedRange?.start || null;
    const requestedEnd = requestedRange?.end || null;
    const coverageRanges = options.coverage || base.coverage || null;
    const sourceLabel = options.source || base.replaySource || base.source || 'cache-replay';
    const sanitized = {
        ...base,
        source: sourceLabel,
        replaySource: sourceLabel,
        cacheReplay: true,
        usedCache: true,
        replayedAt: Date.now(),
    };
    sanitized.requested = {
        start: requestedStart,
        end: requestedEnd,
    };
    if (coverageRanges) {
        sanitized.coverage = cloneArrayOfRanges(coverageRanges);
    }
    if (sanitized.rangeFetch && typeof sanitized.rangeFetch === 'object') {
        const rangeFetch = { ...sanitized.rangeFetch };
        rangeFetch.cacheReplay = true;
        rangeFetch.readOps = 0;
        rangeFetch.writeOps = 0;
        if (Array.isArray(rangeFetch.operations)) {
            rangeFetch.operations = [];
        }
        if (typeof rangeFetch.status === 'string' && !/cache/i.test(rangeFetch.status)) {
            rangeFetch.status = `${rangeFetch.status}-cache`;
        }
        sanitized.rangeFetch = rangeFetch;
    }
    const blobInfo = base.blob && typeof base.blob === 'object' ? { ...base.blob } : {};
    blobInfo.operations = [];
    blobInfo.readOps = 0;
    blobInfo.writeOps = 0;
    blobInfo.cacheReplay = true;
    if (!blobInfo.provider && sourceLabel) {
        blobInfo.provider = sourceLabel;
    }
    sanitized.blob = blobInfo;
    if (Array.isArray(base.months)) {
        sanitized.months = base.months.map((month) => ({
            ...(typeof month === 'object' ? month : {}),
            operations: [],
            cacheReplay: true,
            readOps: 0,
            writeOps: 0,
        }));
    }
    if (Array.isArray(sanitized.operations)) {
        sanitized.operations = [];
    }
    return sanitized;
}

function normalizeMarketKeyForCache(market) {
    const normalized = (market || 'TWSE').toString().toUpperCase();
    if (normalized === 'NASDAQ' || normalized === 'NYSE') return 'US';
    return normalized;
}

function getDatasetCacheTTLMs(market) {
    const normalized = normalizeMarketKeyForCache(market);
    if (normalized === 'US') return US_DATA_CACHE_TTL_MS;
    if (normalized === 'TPEX' || normalized === 'TWSE') return TW_DATA_CACHE_TTL_MS;
    return DEFAULT_DATA_CACHE_TTL_MS;
}

function getYearStorageTtlMs(market) {
    const normalized = normalizeMarketKeyForCache(market);
    if (normalized === 'US') return YEAR_STORAGE_US_TTL_MS;
    if (normalized === 'TPEX' || normalized === 'TWSE') return YEAR_STORAGE_TW_TTL_MS;
    return YEAR_STORAGE_DEFAULT_TTL_MS;
}

function buildSessionStorageEntryKey(cacheKey) {
    return `${SESSION_DATA_CACHE_ENTRY_PREFIX}${cacheKey}`;
}

function loadSessionDataCacheIndex() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return new Map();
    }
    try {
        const raw = window.sessionStorage.getItem(SESSION_DATA_CACHE_INDEX_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed?.records)
            ? parsed.records
            : Array.isArray(parsed)
                ? parsed
                : [];
        const map = new Map();
        records.forEach((record) => {
            if (!record || typeof record !== 'object') return;
            const key = record.key || record.cacheKey;
            const cachedAt = Number(record.cachedAt);
            const market = record.market || record.marketType || null;
            const priceMode = record.priceMode || null;
            const split = Boolean(record.splitAdjustment);
            if (!key || !Number.isFinite(cachedAt)) return;
            map.set(key, {
                cachedAt,
                market,
                priceMode,
                splitAdjustment: split,
            });
        });
        return map;
    } catch (error) {
        console.warn('[Main] 無法載入 Session 回測快取索引:', error);
        return new Map();
    }
}

function saveSessionDataCacheIndex() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (!(sessionDataCacheIndex instanceof Map)) return;
    try {
        const records = Array.from(sessionDataCacheIndex.entries()).map(([key, entry]) => ({
            key,
            cachedAt: Number.isFinite(entry?.cachedAt) ? entry.cachedAt : Date.now(),
            market: entry?.market || null,
            priceMode: entry?.priceMode || null,
            splitAdjustment: entry?.splitAdjustment ? 1 : 0,
        }));
        const payload = { version: SESSION_DATA_CACHE_VERSION, records };
        window.sessionStorage.setItem(SESSION_DATA_CACHE_INDEX_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Main] 無法寫入 Session 回測快取索引:', error);
    }
}

function pruneSessionDataCacheEntries(options = {}) {
    if (!(sessionDataCacheIndex instanceof Map)) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const now = Date.now();
    const removedKeys = [];
    const ttlMs = YEAR_STORAGE_DEFAULT_TTL_MS;
    for (const [key, entry] of sessionDataCacheIndex.entries()) {
        const cachedAt = Number(entry?.cachedAt);
        if (!Number.isFinite(cachedAt)) {
            sessionDataCacheIndex.delete(key);
            removedKeys.push(key);
            continue;
        }
        const ttl = getYearStorageTtlMs(entry?.market || null) || ttlMs;
        if (ttl > 0 && now - cachedAt > ttl) {
            sessionDataCacheIndex.delete(key);
            removedKeys.push(key);
        }
    }
    const limit = Number.isFinite(options?.limit) ? options.limit : SESSION_DATA_CACHE_LIMIT;
    if (limit > 0 && sessionDataCacheIndex.size > limit) {
        const sorted = Array.from(sessionDataCacheIndex.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
        while (sorted.length > limit) {
            const [key] = sorted.shift();
            sessionDataCacheIndex.delete(key);
            removedKeys.push(key);
        }
    }
    if (removedKeys.length > 0) {
        removedKeys.forEach((key) => {
            try {
                window.sessionStorage.removeItem(buildSessionStorageEntryKey(key));
            } catch (error) {
                console.warn('[Main] 無法移除 Session 回測快取項目:', error);
            }
        });
    }
    if (options?.save !== false) {
        saveSessionDataCacheIndex();
    }
}

function getSessionDataCacheEntry(cacheKey) {
    if (!cacheKey) return null;
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
        const raw = window.sessionStorage.getItem(buildSessionStorageEntryKey(cacheKey));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== SESSION_DATA_CACHE_VERSION) return null;
        if (!Array.isArray(parsed.data) || parsed.data.length === 0) return null;
        return parsed;
    } catch (error) {
        console.warn('[Main] 解析 Session 回測快取失敗:', error);
        return null;
    }
}

function persistSessionDataCacheEntry(cacheKey, cacheEntry, options = {}) {
    if (!cacheKey || !cacheEntry) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const payload = {
        version: SESSION_DATA_CACHE_VERSION,
        cachedAt: Date.now(),
        data: Array.isArray(cacheEntry.data) ? cacheEntry.data : [],
        coverage: Array.isArray(cacheEntry.coverage) ? cacheEntry.coverage : [],
        meta: {
            stockName: cacheEntry.stockName || null,
            stockNo: cacheEntry.stockNo || null,
            market: options.market || null,
            dataSource: cacheEntry.dataSource || null,
            dataSources: Array.isArray(cacheEntry.dataSources) ? cacheEntry.dataSources : [],
            priceMode: cacheEntry.priceMode || null,
            splitAdjustment: Boolean(cacheEntry.splitAdjustment),
            dataStartDate: cacheEntry.dataStartDate || null,
            effectiveStartDate: cacheEntry.effectiveStartDate || null,
            lookbackDays: cacheEntry.lookbackDays || null,
            summary: cacheEntry.summary || null,
            adjustments: Array.isArray(cacheEntry.adjustments) ? cacheEntry.adjustments : [],
            debugSteps: Array.isArray(cacheEntry.debugSteps) ? cacheEntry.debugSteps : [],
            priceSource: cacheEntry.priceSource || null,
            fetchRange: cacheEntry.fetchRange || null,
            fetchDiagnostics: cacheEntry.fetchDiagnostics || null,
            coverageFingerprint: cacheEntry.coverageFingerprint || null,
        },
    };
    try {
        window.sessionStorage.setItem(buildSessionStorageEntryKey(cacheKey), JSON.stringify(payload));
        sessionDataCacheIndex.set(cacheKey, {
            cachedAt: payload.cachedAt,
            market: options.market || null,
            priceMode: cacheEntry.priceMode || null,
            splitAdjustment: Boolean(cacheEntry.splitAdjustment),
        });
        pruneSessionDataCacheEntries({ save: true });
    } catch (error) {
        console.warn('[Main] 寫入 Session 回測快取失敗:', error);
    }
}

function removeSessionDataCacheEntry(cacheKey) {
    if (!cacheKey) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        window.sessionStorage.removeItem(buildSessionStorageEntryKey(cacheKey));
    } catch (error) {
        console.warn('[Main] 移除 Session 回測快取失敗:', error);
    }
    if (sessionDataCacheIndex instanceof Map) {
        sessionDataCacheIndex.delete(cacheKey);
        saveSessionDataCacheIndex();
    }
}

function buildYearStorageKey(context, year) {
    if (!context || !context.stockNo) return null;
    const market = normalizeMarketKeyForCache(context.market || context.marketType || currentMarket || 'TWSE');
    const stockNo = (context.stockNo || '').toString().toUpperCase();
    const priceMode = (context.priceMode || (context.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const priceModeKey = priceMode === 'adjusted' ? 'ADJ' : 'RAW';
    const splitFlag = context.splitAdjustment ? 'SPLIT' : 'NOSPLIT';
    return `${YEAR_STORAGE_PREFIX}::${market}|${stockNo}|${priceModeKey}|${splitFlag}|${year}`;
}

function loadYearStorageSlice(context, year) {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const key = buildYearStorageKey(context, year);
    if (!key) return null;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== YEAR_STORAGE_VERSION) return null;
        const cachedAt = Number(parsed.cachedAt);
        if (!Number.isFinite(cachedAt)) return null;
        const ttl = getYearStorageTtlMs(parsed.market || context.market || null);
        if (ttl > 0 && Date.now() - cachedAt > ttl) {
            window.localStorage.removeItem(key);
            return null;
        }
        if (!Array.isArray(parsed.data) || parsed.data.length === 0) return null;
        return parsed;
    } catch (error) {
        console.warn('[Main] 解析年度快取失敗:', error);
        return null;
    }
}

function computeCoverageFromRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const sorted = rows
        .map((row) => (row && row.date ? parseISODateToUTC(row.date) : NaN))
        .filter((ms) => Number.isFinite(ms))
        .sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const tolerance = MAIN_DAY_MS * 6;
    const segments = [];
    let segStart = sorted[0];
    let segEnd = segStart + MAIN_DAY_MS;
    for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i];
        if (!Number.isFinite(current)) continue;
        if (current <= segEnd + tolerance) {
            if (current + MAIN_DAY_MS > segEnd) {
                segEnd = current + MAIN_DAY_MS;
            }
        } else {
            segments.push({ start: utcToISODate(segStart), end: utcToISODate(segEnd - MAIN_DAY_MS) });
            segStart = current;
            segEnd = current + MAIN_DAY_MS;
        }
    }
    segments.push({ start: utcToISODate(segStart), end: utcToISODate(segEnd - MAIN_DAY_MS) });
    return segments;
}

function computeCoverageFingerprint(coverage) {
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

function persistYearStorageSlices(context, dataset, options = {}) {
    if (!context || !Array.isArray(dataset) || dataset.length === 0) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    const grouped = new Map();
    dataset.forEach((row) => {
        if (!row || typeof row.date !== 'string') return;
        const year = parseInt(row.date.slice(0, 4), 10);
        if (!Number.isFinite(year)) return;
        if (!grouped.has(year)) grouped.set(year, []);
        grouped.get(year).push(row);
    });
    const now = Date.now();
    grouped.forEach((rows, year) => {
        const key = buildYearStorageKey(context, year);
        if (!key) return;
        const payload = {
            version: YEAR_STORAGE_VERSION,
            cachedAt: now,
            market: context.market || null,
            stockNo: context.stockNo || null,
            priceMode: context.priceMode || null,
            splitAdjustment: Boolean(context.splitAdjustment),
            data: rows,
            coverage: computeCoverageFromRows(rows),
        };
        try {
            window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn('[Main] 寫入年度快取失敗:', error);
        }
    });
    if (options?.prune !== false) {
        pruneYearStorageEntries();
    }
}

function pruneYearStorageEntries() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const now = Date.now();
    const toRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(`${YEAR_STORAGE_PREFIX}::`)) continue;
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                toRemove.push(key);
                continue;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== YEAR_STORAGE_VERSION) {
                toRemove.push(key);
                continue;
            }
            const ttl = getYearStorageTtlMs(parsed.market || null);
            const cachedAt = Number(parsed.cachedAt);
            if (!Number.isFinite(cachedAt) || (ttl > 0 && now - cachedAt > ttl)) {
                toRemove.push(key);
            }
        } catch (error) {
            console.warn('[Main] 檢查年度快取時失敗:', error);
            toRemove.push(key);
        }
    }
    toRemove.forEach((key) => {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn('[Main] 移除年度快取失敗:', error);
        }
    });
}

const sessionDataCacheIndex = loadSessionDataCacheIndex();
pruneSessionDataCacheEntries({ save: false });

const persistentDataCacheIndex = loadPersistentDataCacheIndex();
prunePersistentDataCacheIndex();

pruneYearStorageEntries();

function loadBlobUsageLedger() {
    const base = { version: BLOB_LEDGER_VERSION, updatedAt: null, months: {} };
    if (typeof window === 'undefined' || !window.localStorage) {
        return base;
    }
    try {
        const raw = window.localStorage.getItem(BLOB_LEDGER_STORAGE_KEY);
        if (!raw) return base;
        const parsed = JSON.parse(raw);
        const months = parsed && typeof parsed.months === 'object' ? parsed.months : {};
        const ledger = { version: BLOB_LEDGER_VERSION, updatedAt: parsed?.updatedAt || null, months: {} };
        const now = new Date();
        const limit = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        Object.entries(months).forEach(([monthKey, stats]) => {
            if (!monthKey || typeof stats !== 'object') return;
            const [yearStr, monthStr] = monthKey.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1;
            if (!Number.isFinite(year) || !Number.isFinite(month)) return;
            const monthDate = new Date(year, month, 1);
            if (monthDate < limit) return;
            ledger.months[monthKey] = {
                readOps: Number(stats.readOps) || 0,
                writeOps: Number(stats.writeOps) || 0,
                cacheHits: Number(stats.cacheHits) || 0,
                cacheMisses: Number(stats.cacheMisses) || 0,
                stocks: stats.stocks && typeof stats.stocks === 'object' ? stats.stocks : {},
                events: Array.isArray(stats.events) ? stats.events.slice(0, BLOB_LEDGER_MAX_EVENTS) : [],
            };
        });
        return ledger;
    } catch (error) {
        console.warn('[Main] 載入 Blob 用量紀錄失敗:', error);
        return base;
    }
}

const blobUsageLedger = loadBlobUsageLedger();
const blobUsageAccordionState = { overrides: {} };

function isBlobUsageGroupExpanded(dateKey, defaultExpanded) {
    if (!dateKey) return defaultExpanded;
    if (Object.prototype.hasOwnProperty.call(blobUsageAccordionState.overrides, dateKey)) {
        return Boolean(blobUsageAccordionState.overrides[dateKey]);
    }
    return defaultExpanded;
}

function setBlobUsageGroupExpanded(dateKey, expanded) {
    if (!dateKey) return;
    blobUsageAccordionState.overrides[dateKey] = Boolean(expanded);
}

function recordTaiwanDirectoryBlobUsage(cacheMeta) {
    if (!cacheMeta || cacheMeta.store !== 'blob') return;
    const operations = [
        {
            action: 'read',
            cacheHit: Boolean(cacheMeta.hit),
            key: 'taiwan-directory',
            source: 'taiwan-directory',
            count: 1,
        },
    ];
    if (!cacheMeta.hit) {
        operations.push({
            action: 'write',
            cacheHit: false,
            key: 'taiwan-directory',
            source: 'taiwan-directory',
            count: 1,
        });
    }
    recordBlobUsageEvents(operations, { source: 'taiwan-directory' });
    renderBlobUsageCard();
}

function saveBlobUsageLedger() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(BLOB_LEDGER_STORAGE_KEY, JSON.stringify(blobUsageLedger));
    } catch (error) {
        console.warn('[Main] 寫入 Blob 用量紀錄失敗:', error);
    }
}

function recordBlobUsageEvents(operations, options = {}) {
    if (!Array.isArray(operations) || operations.length === 0) return;
    if (!blobUsageLedger || typeof blobUsageLedger !== 'object') return;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!blobUsageLedger.months[monthKey]) {
        blobUsageLedger.months[monthKey] = {
            readOps: 0,
            writeOps: 0,
            cacheHits: 0,
            cacheMisses: 0,
            stocks: {},
            events: [],
        };
    }
    const monthRecord = blobUsageLedger.months[monthKey];
    operations.forEach((op) => {
        if (!op || typeof op !== 'object') return;
        const action = op.action || op.type || 'read';
        const stockNo = op.stockNo || options.stockNo || null;
        const market = op.market || options.market || null;
        const cacheHit = Boolean(op.cacheHit);
        const opCount = Number(op.count) || 1;
        if (action === 'write') {
            monthRecord.writeOps += opCount;
        } else {
            monthRecord.readOps += opCount;
        }
        if (cacheHit) {
            monthRecord.cacheHits += opCount;
        } else {
            monthRecord.cacheMisses += opCount;
        }
        if (stockNo) {
            if (!monthRecord.stocks[stockNo]) {
                monthRecord.stocks[stockNo] = { count: 0, market: market || null };
            }
            monthRecord.stocks[stockNo].count += opCount;
            monthRecord.stocks[stockNo].market = market || monthRecord.stocks[stockNo].market || null;
        }
        const event = {
            timestamp: Date.now(),
            action,
            cacheHit,
            key: op.key || op.yearKey || null,
            stockNo,
            market,
            source: op.source || options.source || null,
            count: opCount,
        };
        monthRecord.events.unshift(event);
        if (monthRecord.events.length > BLOB_LEDGER_MAX_EVENTS) {
            monthRecord.events.length = BLOB_LEDGER_MAX_EVENTS;
        }
    });
    blobUsageLedger.updatedAt = Date.now();
    saveBlobUsageLedger();
}

function resolvePriceMode(settings) {
    if (!settings) return 'raw';
    const mode = settings.priceMode || (settings.adjustedPrice ? 'adjusted' : 'raw');
    return mode === 'adjusted' ? 'adjusted' : 'raw';
}

function enumerateYearsBetween(startISO, endISO) {
    if (!startISO || !endISO) return [];
    const startYear = parseInt(startISO.slice(0, 4), 10);
    const endYear = parseInt(endISO.slice(0, 4), 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return [];
    const years = [];
    const step = startYear <= endYear ? 1 : -1;
    for (let year = startYear; step > 0 ? year <= endYear : year >= endYear; year += step) {
        years.push(year);
    }
    return years;
}

function rebuildCacheEntryFromSessionPayload(payload, context = {}) {
    if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) return null;
    const meta = payload.meta || {};
    const dataSourceLabel = meta.dataSource || '瀏覽器 Session 快取';
    const sourceLabels = Array.isArray(meta.dataSources) && meta.dataSources.length > 0
        ? meta.dataSources
        : [dataSourceLabel];
    const requestedRange = meta.fetchRange && typeof meta.fetchRange === 'object'
        ? { start: meta.fetchRange.start || null, end: meta.fetchRange.end || null }
        : {
            start: context.startDate || meta.dataStartDate || null,
            end: context.endDate || null,
        };
    const replayDiagnostics = normaliseFetchDiagnosticsForCacheReplay(meta.fetchDiagnostics || null, {
        source: 'session-storage-cache',
        requestedRange,
        coverage: payload.coverage,
    });
    return {
        data: payload.data,
        coverage: Array.isArray(payload.coverage) ? payload.coverage : [],
        coverageFingerprint: computeCoverageFingerprint(payload.coverage),
        stockName: meta.stockName || context.stockNo || null,
        stockNo: meta.stockNo || context.stockNo || null,
        market: meta.market || context.market || null,
        dataSources: sourceLabels,
        dataSource: summariseSourceLabels(sourceLabels),
        fetchedAt: payload.cachedAt || Date.now(),
        adjustedPrice: meta.priceMode === 'adjusted' || meta.adjustedPrice,
        splitAdjustment: Boolean(meta.splitAdjustment),
        priceMode: meta.priceMode || (meta.adjustedPrice ? 'adjusted' : 'raw'),
        dataStartDate: meta.dataStartDate || null,
        effectiveStartDate: meta.effectiveStartDate || null,
        lookbackDays: meta.lookbackDays || null,
        summary: meta.summary || null,
        adjustments: Array.isArray(meta.adjustments) ? meta.adjustments : [],
        debugSteps: Array.isArray(meta.debugSteps) ? meta.debugSteps : [],
        priceSource: meta.priceSource || null,
        fetchRange: meta.fetchRange || null,
        fetchDiagnostics: replayDiagnostics,
    };
}

function loadYearDatasetForRange(context, startISO, endISO) {
    const years = enumerateYearsBetween(startISO, endISO);
    if (years.length === 0) return null;
    const slices = [];
    for (let i = 0; i < years.length; i += 1) {
        const slice = loadYearStorageSlice(context, years[i]);
        if (!slice) return null;
        slices.push(slice);
    }
    const merged = new Map();
    slices.forEach((slice) => {
        if (!slice || !Array.isArray(slice.data)) return;
        slice.data.forEach((row) => {
            if (row && row.date) {
                merged.set(row.date, row);
            }
        });
    });
    if (merged.size === 0) return null;
    const combined = Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
    const coverage = computeCoverageFromRows(combined);
    if (!coverageCoversRange(coverage, { start: startISO, end: endISO })) {
        return null;
    }
    const fetchedAt = Math.max(...slices.map((slice) => Number(slice.cachedAt) || 0));
    return {
        data: combined,
        coverage,
        coverageFingerprint: computeCoverageFingerprint(coverage),
        fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Date.now(),
        stockName: slices.find((slice) => slice.stockNo)?.stockNo || context.stockNo || null,
        stockNo: context.stockNo || null,
        market: context.market || null,
        dataSource: '瀏覽器年度快取',
        dataSources: ['瀏覽器年度快取'],
    };
}

function hydrateDatasetFromStorage(cacheKey, curSettings) {
    if (!cacheKey || !curSettings) return null;
    if (!(cachedDataStore instanceof Map)) return null;
    const existing = cachedDataStore.get(cacheKey);
    if (existing && Array.isArray(existing.data) && existing.data.length > 0) {
        return existing;
    }
    const normalizedMarket = normalizeMarketKeyForCache(curSettings.market || curSettings.marketType || currentMarket || 'TWSE');
    const sessionPayload = getSessionDataCacheEntry(cacheKey);
    if (sessionPayload) {
        const sessionEntry = rebuildCacheEntryFromSessionPayload(sessionPayload, {
            stockNo: curSettings.stockNo,
            startDate: curSettings.dataStartDate || curSettings.startDate,
            endDate: curSettings.endDate,
            market: normalizedMarket,
        });
        if (sessionEntry) {
            sessionEntry.stockNo = sessionEntry.stockNo || curSettings.stockNo;
            sessionEntry.market = sessionEntry.market || normalizedMarket;
            sessionEntry.coverageFingerprint = sessionEntry.coverageFingerprint
                || computeCoverageFingerprint(sessionEntry.coverage);
            applyCacheStartMetadata(cacheKey, sessionEntry, curSettings.effectiveStartDate || curSettings.startDate, {
                toleranceDays: START_GAP_TOLERANCE_DAYS,
                acknowledgeExcessGap: true,
            });
            cachedDataStore.set(cacheKey, sessionEntry);
            persistDataCacheIndexEntry(cacheKey, {
                market: normalizedMarket,
                fetchedAt: sessionEntry.fetchedAt,
                priceMode: sessionEntry.priceMode || resolvePriceMode(curSettings),
                splitAdjustment: curSettings.splitAdjustment,
                dataStartDate: sessionEntry.dataStartDate || curSettings.dataStartDate || curSettings.startDate,
                coverageFingerprint: sessionEntry.coverageFingerprint || computeCoverageFingerprint(sessionEntry.coverage),
            });
            return sessionEntry;
        }
    }
    const priceMode = resolvePriceMode(curSettings);
    const yearDataset = loadYearDatasetForRange({
        market: normalizedMarket,
        stockNo: curSettings.stockNo,
        priceMode,
        splitAdjustment: curSettings.splitAdjustment,
    }, curSettings.dataStartDate || curSettings.startDate, curSettings.endDate);
    if (yearDataset) {
        const entry = {
            data: yearDataset.data,
            coverage: yearDataset.coverage,
            coverageFingerprint: yearDataset.coverageFingerprint,
            stockName: yearDataset.stockName || curSettings.stockNo,
            stockNo: curSettings.stockNo,
            market: normalizedMarket,
            dataSources: yearDataset.dataSources || [yearDataset.dataSource],
            dataSource: summariseSourceLabels(yearDataset.dataSources || [yearDataset.dataSource]),
            fetchedAt: yearDataset.fetchedAt,
            adjustedPrice: priceMode === 'adjusted',
            splitAdjustment: Boolean(curSettings.splitAdjustment),
            priceMode,
            dataStartDate: curSettings.dataStartDate || curSettings.startDate,
            effectiveStartDate: curSettings.effectiveStartDate || curSettings.startDate,
            lookbackDays: curSettings.lookbackDays || null,
            fetchRange: { start: curSettings.dataStartDate || curSettings.startDate, end: curSettings.endDate },
            fetchDiagnostics: normaliseFetchDiagnosticsForCacheReplay(null, {
                source: 'browser-year-cache',
                requestedRange: { start: curSettings.dataStartDate || curSettings.startDate, end: curSettings.endDate },
                coverage: yearDataset.coverage,
            }),
        };
        applyCacheStartMetadata(cacheKey, entry, curSettings.effectiveStartDate || curSettings.startDate, {
            toleranceDays: START_GAP_TOLERANCE_DAYS,
            acknowledgeExcessGap: true,
        });
        cachedDataStore.set(cacheKey, entry);
        persistDataCacheIndexEntry(cacheKey, {
            market: normalizedMarket,
            fetchedAt: entry.fetchedAt,
            priceMode,
            splitAdjustment: curSettings.splitAdjustment,
            dataStartDate: entry.dataStartDate,
            coverageFingerprint: entry.coverageFingerprint || computeCoverageFingerprint(entry.coverage),
        });
        persistSessionDataCacheEntry(cacheKey, entry, { market: normalizedMarket });
        return entry;
    }
    return null;
}

function findSupersetDatasetCandidate(curSettings, options = {}) {
    if (!curSettings || !(cachedDataStore instanceof Map)) return null;
    const normalizedMarket = normalizeMarketKeyForCache(
        curSettings.market || curSettings.marketType || currentMarket || 'TWSE',
    );
    const targetStockNo = (curSettings.stockNo || '').toUpperCase();
    const targetRange = {
        start: curSettings.dataStartDate || curSettings.startDate,
        end: curSettings.endDate,
    };
    const priceMode = resolvePriceMode(curSettings);
    const splitFlag = Boolean(curSettings.splitAdjustment);
    let best = null;
    cachedDataStore.forEach((entry, key) => {
        if (!entry || !Array.isArray(entry.data) || entry.data.length === 0) return;
        const entryStock = (entry.stockNo || '').toUpperCase();
        if (entryStock !== targetStockNo) return;
        const entryMarket = normalizeMarketKeyForCache(entry.market || normalizedMarket);
        if (entryMarket !== normalizedMarket) return;
        const entryMode = resolvePriceMode(entry);
        if ((entryMode === 'adjusted') !== (priceMode === 'adjusted')) return;
        if (Boolean(entry.splitAdjustment) !== splitFlag) return;
        if (!Array.isArray(entry.coverage) || entry.coverage.length === 0) return;
        if (!coverageCoversRange(entry.coverage, targetRange)) return;
        if (options.excludeKey && options.excludeKey === key) return;
        if (!best || (Number(entry.fetchedAt) || 0) > (Number(best.entry.fetchedAt) || 0)) {
            best = { key, entry };
        }
    });
    return best;
}

function materializeSupersetCacheEntry(cacheKey, curSettings) {
    if (!cacheKey || !curSettings || !(cachedDataStore instanceof Map)) return null;
    const normalizedMarket = normalizeMarketKeyForCache(
        curSettings.market || curSettings.marketType || currentMarket || 'TWSE',
    );
    const existing = cachedDataStore.get(cacheKey);
    const targetRange = {
        start: curSettings.dataStartDate || curSettings.startDate,
        end: curSettings.endDate,
    };
    if (
        existing &&
        Array.isArray(existing.data) &&
        existing.data.length > 0 &&
        coverageCoversRange(existing.coverage, targetRange)
    ) {
        existing.stockNo = existing.stockNo || curSettings.stockNo;
        existing.market = existing.market || normalizedMarket;
        existing.coverageFingerprint = existing.coverageFingerprint
            || computeCoverageFingerprint(existing.coverage);
        return existing;
    }
    const candidate = findSupersetDatasetCandidate(curSettings, { excludeKey: cacheKey });
    if (!candidate) return null;
    const priceMode = resolvePriceMode(curSettings);
    const sliceStart = curSettings.dataStartDate || curSettings.startDate;
    const sliceEnd = curSettings.endDate;
    const sliceRows = candidate.entry.data.filter((row) =>
        row && row.date >= sliceStart && row.date <= sliceEnd,
    );
    if (sliceRows.length === 0) return null;
    const coverage = computeCoverageFromRows(sliceRows);
    if (!coverageCoversRange(coverage, targetRange)) return null;
    const coverageFingerprint = computeCoverageFingerprint(coverage);
    const sourceLabels = Array.isArray(candidate.entry.dataSources)
        ? candidate.entry.dataSources.slice()
        : candidate.entry.dataSource
            ? [candidate.entry.dataSource]
            : [];
    const supersetEntry = {
        data: sliceRows,
        coverage,
        coverageFingerprint,
        stockName: candidate.entry.stockName || curSettings.stockNo,
        stockNo: curSettings.stockNo,
        market: normalizedMarket,
        dataSources: sourceLabels,
        dataSource: summariseSourceLabels(sourceLabels),
        fetchedAt: Number.isFinite(candidate.entry.fetchedAt)
            ? candidate.entry.fetchedAt
            : Date.now(),
        adjustedPrice: priceMode === 'adjusted',
        splitAdjustment: Boolean(curSettings.splitAdjustment),
        priceMode,
        dataStartDate: sliceStart,
        effectiveStartDate: curSettings.effectiveStartDate || curSettings.startDate,
        lookbackDays: curSettings.lookbackDays || candidate.entry.lookbackDays || null,
        fetchRange: { start: sliceStart, end: sliceEnd },
        summary: candidate.entry.summary || null,
        adjustments: Array.isArray(candidate.entry.adjustments)
            ? candidate.entry.adjustments
            : [],
        debugSteps: Array.isArray(candidate.entry.debugSteps)
            ? candidate.entry.debugSteps
            : [],
        priceSource: candidate.entry.priceSource || null,
        splitDiagnostics: candidate.entry.splitDiagnostics || null,
        finmindStatus: candidate.entry.finmindStatus || null,
        adjustmentFallbackApplied: Boolean(candidate.entry.adjustmentFallbackApplied),
        adjustmentDebugLog: Array.isArray(candidate.entry.adjustmentDebugLog)
            ? candidate.entry.adjustmentDebugLog
            : [],
        adjustmentChecks: Array.isArray(candidate.entry.adjustmentChecks)
            ? candidate.entry.adjustmentChecks
            : [],
        datasetDiagnostics: candidate.entry.datasetDiagnostics || null,
        fetchDiagnostics: normaliseFetchDiagnosticsForCacheReplay(
            candidate.entry.fetchDiagnostics || null,
            {
                source: 'main-superset-cache',
                requestedRange: { start: sliceStart, end: sliceEnd },
                coverage,
            },
        ),
    };
    applyCacheStartMetadata(cacheKey, supersetEntry, supersetEntry.effectiveStartDate, {
        toleranceDays: START_GAP_TOLERANCE_DAYS,
        acknowledgeExcessGap: true,
    });
    cachedDataStore.set(cacheKey, supersetEntry);
    persistDataCacheIndexEntry(cacheKey, {
        market: normalizedMarket,
        fetchedAt: supersetEntry.fetchedAt,
        priceMode,
        splitAdjustment: curSettings.splitAdjustment,
        dataStartDate: supersetEntry.dataStartDate,
        coverageFingerprint,
    });
    persistSessionDataCacheEntry(cacheKey, supersetEntry, { market: normalizedMarket });
    persistYearStorageSlices({
        market: normalizedMarket,
        stockNo: curSettings.stockNo,
        priceMode,
        splitAdjustment: curSettings.splitAdjustment,
    }, supersetEntry.data);
    console.log(
        `[Main] 使用年度 Superset 快取回填 ${curSettings.stockNo} (${sliceStart} ~ ${sliceEnd})。`,
    );
    return supersetEntry;
}

function parseISODateToUTC(iso) {
    if (!iso || typeof iso !== 'string') return NaN;
    const [y, m, d] = iso.split('-').map((val) => parseInt(val, 10));
    if ([y, m, d].some((num) => Number.isNaN(num))) return NaN;
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

function formatNumberWithComma(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('zh-TW');
}

function computeEffectiveStartGap(data, effectiveStartISO) {
    if (!Array.isArray(data) || data.length === 0 || !effectiveStartISO) return null;
    const startUTC = parseISODateToUTC(effectiveStartISO);
    if (!Number.isFinite(startUTC)) return null;
    for (let i = 0; i < data.length; i += 1) {
        const row = data[i];
        if (!row || typeof row.date !== 'string') continue;
        if (row.date < effectiveStartISO) continue;
        const rowUTC = parseISODateToUTC(row.date);
        if (!Number.isFinite(rowUTC)) continue;
        const diffDays = Math.floor((rowUTC - startUTC) / BACKTEST_DAY_MS);
        return {
            firstEffectiveDate: row.date,
            gapDays: diffDays,
        };
    }
    return {
        firstEffectiveDate: null,
        gapDays: Number.POSITIVE_INFINITY,
    };
}

function applyCacheStartMetadata(cacheKey, cacheEntry, effectiveStartISO, options = {}) {
    if (!cacheEntry || !Array.isArray(cacheEntry.data) || !effectiveStartISO) return { gapDays: null, firstEffectiveDate: null };
    const { toleranceDays = START_GAP_TOLERANCE_DAYS, acknowledgeExcessGap = false } = options;
    const info = computeEffectiveStartGap(cacheEntry.data, effectiveStartISO) || { gapDays: null, firstEffectiveDate: null };
    const gapDays = Number.isFinite(info.gapDays) ? info.gapDays : null;
    cacheEntry.firstEffectiveRowDate = info.firstEffectiveDate || null;
    cacheEntry.startGapEffectiveStart = effectiveStartISO;
    cacheEntry.startGapDays = gapDays;
    if (gapDays !== null && gapDays > toleranceDays) {
        if (acknowledgeExcessGap) {
            cacheEntry.startGapAcknowledgedAt = Date.now();
        } else {
            cacheEntry.startGapAcknowledgedAt = cacheEntry.startGapAcknowledgedAt || null;
        }
    } else {
        cacheEntry.startGapAcknowledgedAt = null;
    }
    if (cacheKey) {
        cachedDataStore.set(cacheKey, cacheEntry);
    }
    return {
        gapDays,
        firstEffectiveDate: info.firstEffectiveDate || null,
    };
}

function evaluateCacheStartGap(cacheKey, cacheEntry, effectiveStartISO, options = {}) {
    const { toleranceDays = START_GAP_TOLERANCE_DAYS, retryMs = START_GAP_RETRY_MS } = options;
    if (!cacheEntry || !Array.isArray(cacheEntry.data) || !effectiveStartISO) {
        return { shouldForce: true, reason: 'missingCache' };
    }
    const { gapDays, firstEffectiveDate } = applyCacheStartMetadata(cacheKey, cacheEntry, effectiveStartISO, { toleranceDays });
    if (gapDays === null) {
        return { shouldForce: false, reason: 'noGapInfo', firstEffectiveDate: firstEffectiveDate || null };
    }
    if (gapDays <= toleranceDays) {
        return { shouldForce: false, gapDays, firstEffectiveDate };
    }
    const ackStart = cacheEntry.startGapEffectiveStart || null;
    const ackGap = Number.isFinite(cacheEntry.startGapDays) ? cacheEntry.startGapDays : null;
    const ackAt = Number.isFinite(cacheEntry.startGapAcknowledgedAt) ? cacheEntry.startGapAcknowledgedAt : null;
    const sameContext = ackStart === effectiveStartISO && ackGap === gapDays && ackAt;
    const now = Date.now();
    if (!sameContext) {
        cacheEntry.startGapAcknowledgedAt = null;
        if (cacheKey) cachedDataStore.set(cacheKey, cacheEntry);
        return { shouldForce: true, gapDays, firstEffectiveDate, reason: 'unacknowledged' };
    }
    if (retryMs && ackAt && now - ackAt > retryMs) {
        cacheEntry.startGapAcknowledgedAt = null;
        if (cacheKey) cachedDataStore.set(cacheKey, cacheEntry);
        return { shouldForce: true, gapDays, firstEffectiveDate, reason: 'retryWindowElapsed' };
    }
    cacheEntry.startGapAcknowledgedAt = ackAt || now;
    if (cacheKey) cachedDataStore.set(cacheKey, cacheEntry);
    return { shouldForce: false, gapDays, firstEffectiveDate, acknowledged: true };
}

function loadPersistentDataCacheIndex() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(DATA_CACHE_INDEX_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed?.records)
            ? parsed.records
            : Array.isArray(parsed)
                ? parsed
                : [];
        const now = Date.now();
        const map = new Map();
        records.forEach((record) => {
            if (!record || typeof record !== 'object') return;
            const key = record.key || record.cacheKey;
            const fetchedAt = Number(record.fetchedAt);
            if (!key || !Number.isFinite(fetchedAt)) return;
            const normalizedMarket = normalizeMarketKeyForCache(record.market);
            const ttl = getDatasetCacheTTLMs(normalizedMarket);
            if (ttl > 0 && now - fetchedAt > ttl) return;
            map.set(key, {
                market: normalizedMarket,
                fetchedAt,
                priceMode: record.priceMode || null,
                splitAdjustment: Boolean(record.splitAdjustment),
                dataStartDate: record.dataStartDate || null,
                coverageFingerprint: record.coverageFingerprint || null,
            });
        });
        return map;
    } catch (error) {
        console.warn('[Main] 無法載入資料快取索引:', error);
        return new Map();
    }
}

function savePersistentDataCacheIndex() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!(persistentDataCacheIndex instanceof Map)) return;
    try {
        const records = Array.from(persistentDataCacheIndex.entries()).map(([key, entry]) => ({
            key,
            market: entry.market,
            fetchedAt: entry.fetchedAt,
            priceMode: entry.priceMode || null,
            splitAdjustment: entry.splitAdjustment ? 1 : 0,
            dataStartDate: entry.dataStartDate || null,
            coverageFingerprint: entry.coverageFingerprint || null,
        }));
        const payload = { version: DATA_CACHE_VERSION, records };
        window.localStorage.setItem(DATA_CACHE_INDEX_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Main] 無法寫入資料快取索引:', error);
    }
}

function persistDataCacheIndexEntry(cacheKey, meta) {
    if (!(persistentDataCacheIndex instanceof Map)) return;
    if (!cacheKey || !meta) return;
    const normalizedMarket = normalizeMarketKeyForCache(meta.market);
    const record = {
        market: normalizedMarket,
        fetchedAt: Number.isFinite(meta.fetchedAt) ? meta.fetchedAt : Date.now(),
        priceMode: meta.priceMode || null,
        splitAdjustment: Boolean(meta.splitAdjustment),
        dataStartDate: meta.dataStartDate || null,
        coverageFingerprint: meta.coverageFingerprint || null,
    };
    persistentDataCacheIndex.set(cacheKey, record);
    prunePersistentDataCacheIndex({ save: false });
    savePersistentDataCacheIndex();
}

function removePersistentDataCacheEntry(cacheKey) {
    if (!(persistentDataCacheIndex instanceof Map)) return;
    if (!cacheKey) return;
    const removed = persistentDataCacheIndex.delete(cacheKey);
    if (removed) {
        savePersistentDataCacheIndex();
    }
    if (cachedDataStore instanceof Map) {
        cachedDataStore.delete(cacheKey);
    }
}

function clearPersistentDataCacheIndex() {
    if (persistentDataCacheIndex instanceof Map) {
        persistentDataCacheIndex.clear();
    }
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.removeItem(DATA_CACHE_INDEX_KEY);
        } catch (error) {
            console.warn('[Main] 無法清除資料快取索引:', error);
        }
    }
}

function prunePersistentDataCacheIndex(options = {}) {
    if (!(persistentDataCacheIndex instanceof Map)) return false;
    const now = Date.now();
    let mutated = false;
    for (const [key, entry] of persistentDataCacheIndex.entries()) {
        if (!entry || !Number.isFinite(entry.fetchedAt)) continue;
        const ttl = getDatasetCacheTTLMs(entry.market);
        if (ttl > 0 && now - entry.fetchedAt > ttl) {
            persistentDataCacheIndex.delete(key);
            mutated = true;
            if (cachedDataStore instanceof Map) {
                cachedDataStore.delete(key);
            }
        }
    }
    if (mutated && options.save !== false) {
        savePersistentDataCacheIndex();
    }
    return mutated;
}

function ensureDatasetCacheEntryFresh(cacheKey, entry, market) {
    const normalizedMarket = normalizeMarketKeyForCache(market || 'TWSE');
    const ttl = getDatasetCacheTTLMs(normalizedMarket);
    const meta = persistentDataCacheIndex instanceof Map ? persistentDataCacheIndex.get(cacheKey) : null;
    const fetchedAtCandidate = Number.isFinite(entry?.fetchedAt)
        ? entry.fetchedAt
        : Number.isFinite(meta?.fetchedAt)
            ? meta.fetchedAt
            : null;
    if (
        ttl > 0 &&
        Number.isFinite(fetchedAtCandidate) &&
        Date.now() - fetchedAtCandidate > ttl
    ) {
        if (cachedDataStore instanceof Map && cachedDataStore.has(cacheKey)) {
            cachedDataStore.delete(cacheKey);
        }
        if (persistentDataCacheIndex instanceof Map && persistentDataCacheIndex.has(cacheKey)) {
            persistentDataCacheIndex.delete(cacheKey);
            savePersistentDataCacheIndex();
        }
        return null;
    }
    if (entry && persistentDataCacheIndex instanceof Map) {
        const needsUpdate =
            !meta ||
            meta.market !== normalizedMarket ||
            !Number.isFinite(meta.fetchedAt) ||
            (Number.isFinite(entry.fetchedAt) && entry.fetchedAt !== meta.fetchedAt);
        if (needsUpdate) {
            persistentDataCacheIndex.set(cacheKey, {
                market: normalizedMarket,
                fetchedAt: Number.isFinite(entry.fetchedAt) ? entry.fetchedAt : Date.now(),
                priceMode: entry.priceMode || null,
                splitAdjustment: Boolean(entry.splitAdjustment),
                dataStartDate: entry.dataStartDate || null,
                coverageFingerprint: entry.coverageFingerprint || null,
            });
            savePersistentDataCacheIndex();
        }
    }
    return entry || null;
}

// --- 主回測函數 ---
function runBacktestInternal() {
    console.log("[Main] runBacktestInternal called");
    if (!workerUrl) { showError("背景計算引擎尚未準備就緒，請稍候再試或重新載入頁面。"); hideLoading(); resetStrategyStatusCard('error'); return; }
    try {
        const params=getBacktestParams();
        lastRecentYearsSetting = Number.isFinite(params.recentYears) && params.recentYears > 0
            ? params.recentYears
            : null;
        if (lastRecentYearsSetting !== null) {
            params.recentYears = lastRecentYearsSetting;
        } else {
            delete params.recentYears;
        }
        console.log("[Main] Params:", params);
        const isValid = validateBacktestParams(params);
        console.log("[Main] Validation:", isValid);
        if(!isValid) return;

        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        const windowOptions = {
            minBars: 90,
            multiplier: 2,
            marginTradingDays: 12,
            extraCalendarDays: 7,
            minDate: sharedUtils?.MIN_DATA_DATE,
            defaultStartDate: params.startDate,
        };
        let windowDecision = null;
        if (sharedUtils && typeof sharedUtils.resolveDataWindow === 'function') {
            windowDecision = sharedUtils.resolveDataWindow(params, windowOptions);
        }
        const fallbackMaxPeriod = sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(params)
            : 0;
        const maxIndicatorPeriod = Number.isFinite(windowDecision?.maxIndicatorPeriod)
            ? windowDecision.maxIndicatorPeriod
            : fallbackMaxPeriod;
        let lookbackDays = Number.isFinite(windowDecision?.lookbackDays)
            ? windowDecision.lookbackDays
            : null;
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            if (sharedUtils && typeof sharedUtils.resolveLookbackDays === 'function') {
                const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
                if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                    lookbackDays = fallbackDecision.lookbackDays;
                }
                if (!Number.isFinite(windowDecision?.maxIndicatorPeriod) && Number.isFinite(fallbackDecision?.maxIndicatorPeriod)) {
                    windowDecision = { ...(windowDecision || {}), maxIndicatorPeriod: fallbackDecision.maxIndicatorPeriod };
                }
            }
        }
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
                ? sharedUtils.estimateLookbackBars(maxIndicatorPeriod, { minBars: 90, multiplier: 2 })
                : Math.max(90, maxIndicatorPeriod * 2);
        }
        let effectiveStartDate = windowDecision?.effectiveStartDate || params.startDate || windowDecision?.minDataDate || windowOptions.defaultStartDate;
        const bufferTradingDays = Number.isFinite(windowDecision?.bufferTradingDays)
            ? windowDecision.bufferTradingDays
            : windowOptions.marginTradingDays;
        const extraCalendarDays = Number.isFinite(windowDecision?.extraCalendarDays)
            ? windowDecision.extraCalendarDays
            : windowOptions.extraCalendarDays;
        let dataStartDate = windowDecision?.dataStartDate || null;
        if (!dataStartDate && effectiveStartDate) {
            if (sharedUtils && typeof sharedUtils.computeBufferedStartDate === 'function') {
                dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
                    minDate: sharedUtils?.MIN_DATA_DATE,
                    marginTradingDays: bufferTradingDays,
                    extraCalendarDays,
                }) || effectiveStartDate;
            } else {
                dataStartDate = effectiveStartDate;
            }
        }
        if (!dataStartDate) {
            dataStartDate = effectiveStartDate || sharedUtils?.MIN_DATA_DATE || windowOptions.minDate || params.startDate;
        }
        params.effectiveStartDate = effectiveStartDate;
        params.dataStartDate = dataStartDate;
        params.lookbackDays = lookbackDays;

        const marketKey = (params.marketType || params.market || currentMarket || 'TWSE').toUpperCase();
        const priceMode = params.adjustedPrice ? 'adjusted' : 'raw';
        const curSettings={
            stockNo:params.stockNo,
            startDate:dataStartDate,
            dataStartDate:dataStartDate,
            endDate:params.endDate,
            effectiveStartDate,
            market:marketKey,
            adjustedPrice: params.adjustedPrice,
            splitAdjustment: params.splitAdjustment,
            priceMode: priceMode,
            lookbackDays,
        };
        const cacheKey = buildCacheKey(curSettings);
        hydrateDatasetFromStorage(cacheKey, curSettings);
        materializeSupersetCacheEntry(cacheKey, curSettings);
        let useCache=!needsDataFetch(curSettings);
        let cachedEntry = null;
        if (useCache) {
            cachedEntry = ensureDatasetCacheEntryFresh(cacheKey, cachedDataStore.get(cacheKey), curSettings.market);
            if (cachedEntry && Array.isArray(cachedEntry.data)) {
                const startCheck = evaluateCacheStartGap(cacheKey, cachedEntry, effectiveStartDate);
                if (startCheck.shouldForce) {
                    const gapText = Number.isFinite(startCheck.gapDays)
                        ? `${startCheck.gapDays} 天`
                        : '未知天數';
                    const firstDateText = startCheck.firstEffectiveDate || '無';
                    console.warn(`[Main] 快取首筆有效日期 (${firstDateText}) 較設定起點落後 ${gapText}，改為重新抓取。 start=${effectiveStartDate}`);
                    useCache = false;
                    cachedEntry = null;
                } else if (startCheck.acknowledged && Number.isFinite(startCheck.gapDays) && startCheck.gapDays > START_GAP_TOLERANCE_DAYS) {
                    console.warn(`[Main] 快取首筆有效日期已落後 ${startCheck.gapDays} 天，已在近期確認資料缺口，暫時沿用快取資料。`);
                }
            } else {
                console.warn('[Main] 快取內容不存在或結構異常，改為重新抓取。');
                useCache = false;
                cachedEntry = null;
            }
        }
        const msg=useCache?"⌛ 使用快取執行回測...":"⌛ 獲取數據並回測...";
        showLoading(msg);
        showStrategyStatusLoading();
        if (useCache && cachedEntry && Array.isArray(cachedEntry.data)) {
            const cacheDiagnostics = normaliseFetchDiagnosticsForCacheReplay(
                cachedEntry.fetchDiagnostics || null,
                {
                    source: 'main-memory-cache',
                    requestedRange: {
                        start: curSettings.dataStartDate || curSettings.startDate,
                        end: curSettings.endDate,
                    },
                    coverage: cachedEntry.coverage,
                }
            );
            cachedEntry.fetchDiagnostics = cacheDiagnostics;
            const sliceStart = curSettings.effectiveStartDate || effectiveStartDate;
            setVisibleStockData(extractRangeData(cachedEntry.data, sliceStart, curSettings.endDate));
            cachedStockData = cachedEntry.data;
            lastFetchSettings = { ...curSettings };
            refreshPriceInspectorControls();
            updatePriceDebug(cachedEntry);
            console.log(`[Main] 從快取命中 ${cacheKey}，範圍 ${curSettings.startDate} ~ ${curSettings.endDate}`);
        }
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
            const{type,data,progress,message, stockName, dataSource}=e.data;
            console.log("[Main] Received message from worker:", type, data); // Debug log

            if(type==='progress'){
                updateProgress(progress);
                if(message){
                    setLoadingBaseMessage(message);
                    renderLoadingMessage(progressAnimator.getTarget());
                }
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
                if(!useCache&&data?.rawData){
                     const existingEntry = ensureDatasetCacheEntryFresh(cacheKey, cachedDataStore.get(cacheKey), curSettings.market);
                     const mergedDataMap = new Map(Array.isArray(existingEntry?.data) ? existingEntry.data.map(row => [row.date, row]) : []);
                     if (Array.isArray(data.rawData)) {
                         data.rawData.forEach(row => {
                             if (row && row.date) {
                                 mergedDataMap.set(row.date, row);
                             }
                         });
                     }
                     const mergedData = Array.from(mergedDataMap.values()).sort((a,b)=>a.date.localeCompare(b.date));
                     const fetchedRange = (data?.rawMeta && data.rawMeta.fetchRange && data.rawMeta.fetchRange.start && data.rawMeta.fetchRange.end)
                        ? data.rawMeta.fetchRange
                        : { start: curSettings.startDate, end: curSettings.endDate };
                     const mergedCoverage = typeof computeCoverageFromRows === 'function'
                        ? computeCoverageFromRows(mergedData)
                        : mergeIsoCoverage(
                            existingEntry?.coverage || [],
                            fetchedRange && fetchedRange.start && fetchedRange.end
                                ? { start: fetchedRange.start, end: fetchedRange.end }
                                : null
                        );
                     const sourceSet = new Set(Array.isArray(existingEntry?.dataSources) ? existingEntry.dataSources : []);
                     if (dataSource) sourceSet.add(dataSource);
                     const sourceArray = Array.from(sourceSet);
                     const rawMeta = data.rawMeta || {};
                     const debugSteps = Array.isArray(rawMeta.debugSteps)
                         ? rawMeta.debugSteps
                         : (Array.isArray(data?.dataDebug?.debugSteps) ? data.dataDebug.debugSteps : []);
                     const summaryMeta = rawMeta.summary || data?.dataDebug?.summary || null;
                     const adjustmentsMeta = Array.isArray(rawMeta.adjustments)
                         ? rawMeta.adjustments
                         : (Array.isArray(data?.dataDebug?.adjustments) ? data.dataDebug.adjustments : []);
                     const fallbackFlag = typeof rawMeta.adjustmentFallbackApplied === 'boolean'
                         ? rawMeta.adjustmentFallbackApplied
                         : Boolean(data?.dataDebug?.adjustmentFallbackApplied);
                    const priceSourceMeta = rawMeta.priceSource || data?.dataDebug?.priceSource || null;
                    const splitDiagnosticsMeta = rawMeta.splitDiagnostics
                        || data?.dataDebug?.splitDiagnostics
                        || existingEntry?.splitDiagnostics
                        || null;
                    const finmindStatusMeta = rawMeta.finmindStatus
                        || data?.dataDebug?.finmindStatus
                        || existingEntry?.finmindStatus
                        || null;
                    const adjustmentDebugLogMeta = Array.isArray(rawMeta.adjustmentDebugLog)
                        ? rawMeta.adjustmentDebugLog
                        : (Array.isArray(data?.dataDebug?.adjustmentDebugLog) ? data.dataDebug.adjustmentDebugLog : []);
                    const adjustmentChecksMeta = Array.isArray(rawMeta.adjustmentChecks)
                        ? rawMeta.adjustmentChecks
                        : (Array.isArray(data?.dataDebug?.adjustmentChecks) ? data.dataDebug.adjustmentChecks : []);
                    const rawEffectiveStart = data?.rawMeta?.effectiveStartDate || effectiveStartDate;
                    const resolvedLookback = Number.isFinite(data?.rawMeta?.lookbackDays)
                        ? data.rawMeta.lookbackDays
                        : lookbackDays;
                    const rawFetchDiagnostics = data?.datasetDiagnostics?.fetch || existingEntry?.fetchDiagnostics || null;
                    const cacheDiagnostics = normaliseFetchDiagnosticsForCacheReplay(rawFetchDiagnostics, {
                        source: 'main-memory-cache',
                        requestedRange: fetchedRange,
                        coverage: mergedCoverage,
                    });
                    const cacheEntry = {
                        data: mergedData,
                        stockName: stockName || existingEntry?.stockName || params.stockNo,
                        stockNo: curSettings.stockNo,
                        market: curSettings.market,
                        dataSources: sourceArray,
                        dataSource: summariseSourceLabels(sourceArray.length > 0 ? sourceArray : [dataSource || '']),
                        coverage: mergedCoverage,
                        coverageFingerprint: computeCoverageFingerprint(mergedCoverage),
                        fetchedAt: Date.now(),
                        adjustedPrice: params.adjustedPrice,
                        splitAdjustment: params.splitAdjustment,
                        priceMode: priceMode,
                        dataStartDate: curSettings.dataStartDate || curSettings.startDate,
                        adjustmentFallbackApplied: fallbackFlag,
                        summary: summaryMeta,
                        adjustments: adjustmentsMeta,
                        debugSteps,
                        priceSource: priceSourceMeta,
                        splitDiagnostics: splitDiagnosticsMeta,
                        finmindStatus: finmindStatusMeta,
                        adjustmentDebugLog: adjustmentDebugLogMeta,
                        adjustmentChecks: adjustmentChecksMeta,
                        fetchRange: fetchedRange,
                        effectiveStartDate: rawEffectiveStart,
                        lookbackDays: resolvedLookback,
                        datasetDiagnostics: data?.datasetDiagnostics || existingEntry?.datasetDiagnostics || null,
                        fetchDiagnostics: cacheDiagnostics,
                        lastRemoteFetchDiagnostics: rawFetchDiagnostics,
                    };
                     applyCacheStartMetadata(cacheKey, cacheEntry, rawEffectiveStart || effectiveStartDate, {
                        toleranceDays: START_GAP_TOLERANCE_DAYS,
                        acknowledgeExcessGap: true,
                    });
                     cachedDataStore.set(cacheKey, cacheEntry);
                    persistDataCacheIndexEntry(cacheKey, {
                        market: curSettings.market,
                        fetchedAt: cacheEntry.fetchedAt || Date.now(),
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                        dataStartDate: cacheEntry.dataStartDate || curSettings.startDate,
                        coverageFingerprint: cacheEntry.coverageFingerprint || null,
                     });
                     persistSessionDataCacheEntry(cacheKey, cacheEntry, { market: curSettings.market });
                     persistYearStorageSlices({
                        market: curSettings.market,
                        stockNo: curSettings.stockNo,
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                     }, cacheEntry.data);
                    setVisibleStockData(extractRangeData(mergedData, rawEffectiveStart || effectiveStartDate, curSettings.endDate));
                    cachedStockData = mergedData;
                     lastFetchSettings = { ...curSettings };
                     refreshPriceInspectorControls();
                     updatePriceDebug(cacheEntry);
                     console.log(`[Main] Data cached/merged for ${cacheKey}.`);
                     cachedEntry = cacheEntry;
                } else if (useCache && cachedEntry && Array.isArray(cachedEntry.data) ) {
                     const updatedSources = new Set(Array.isArray(cachedEntry.dataSources) ? cachedEntry.dataSources : []);
                     if (dataSource) updatedSources.add(dataSource);
                     const updatedArray = Array.from(updatedSources);
                     const debugSteps = Array.isArray(data?.dataDebug?.debugSteps)
                         ? data.dataDebug.debugSteps
                         : Array.isArray(cachedEntry.debugSteps) ? cachedEntry.debugSteps : [];
                     const summaryMeta = data?.dataDebug?.summary || cachedEntry.summary || null;
                     const adjustmentsMeta = Array.isArray(data?.dataDebug?.adjustments)
                         ? data.dataDebug.adjustments
                         : Array.isArray(cachedEntry.adjustments) ? cachedEntry.adjustments : [];
                     const fallbackFlag = typeof data?.dataDebug?.adjustmentFallbackApplied === 'boolean'
                         ? data.dataDebug.adjustmentFallbackApplied
                         : Boolean(cachedEntry.adjustmentFallbackApplied);
                    const priceSourceMeta = data?.dataDebug?.priceSource || cachedEntry.priceSource || null;
                    const splitDiagnosticsMeta = data?.dataDebug?.splitDiagnostics
                        || cachedEntry.splitDiagnostics
                        || null;
                    const finmindStatusMeta = data?.dataDebug?.finmindStatus
                        || cachedEntry.finmindStatus
                        || null;
                    const adjustmentDebugLogMeta = Array.isArray(data?.dataDebug?.adjustmentDebugLog)
                        ? data.dataDebug.adjustmentDebugLog
                        : Array.isArray(cachedEntry.adjustmentDebugLog) ? cachedEntry.adjustmentDebugLog : [];
                    const adjustmentChecksMeta = Array.isArray(data?.dataDebug?.adjustmentChecks)
                        ? data.dataDebug.adjustmentChecks
                        : Array.isArray(cachedEntry.adjustmentChecks) ? cachedEntry.adjustmentChecks : [];
                    const rawFetchDiagnostics = data?.datasetDiagnostics?.fetch || cachedEntry.fetchDiagnostics || null;
                    const updatedCoverage = typeof computeCoverageFromRows === 'function'
                        ? computeCoverageFromRows(cachedEntry.data)
                        : (Array.isArray(cachedEntry.coverage) ? cachedEntry.coverage : []);
                    const updatedDiagnostics = normaliseFetchDiagnosticsForCacheReplay(rawFetchDiagnostics, {
                        source: 'main-memory-cache',
                        requestedRange: cachedEntry.fetchRange || { start: curSettings.startDate, end: curSettings.endDate },
                        coverage: updatedCoverage,
                    });
                    const updatedEntry = {
                        ...cachedEntry,
                        coverage: updatedCoverage,
                        stockName: stockName || cachedEntry.stockName || params.stockNo,
                        stockNo: curSettings.stockNo,
                        market: curSettings.market,
                        dataSources: updatedArray,
                        dataSource: summariseSourceLabels(updatedArray),
                        fetchedAt: cachedEntry.fetchedAt || Date.now(),
                        adjustedPrice: params.adjustedPrice,
                        splitAdjustment: params.splitAdjustment,
                        priceMode: priceMode,
                        adjustmentFallbackApplied: fallbackFlag,
                        summary: summaryMeta,
                        adjustments: adjustmentsMeta,
                        debugSteps,
                        priceSource: priceSourceMeta,
                        splitDiagnostics: splitDiagnosticsMeta,
                        finmindStatus: finmindStatusMeta,
                        adjustmentDebugLog: adjustmentDebugLogMeta,
                        adjustmentChecks: adjustmentChecksMeta,
                        fetchRange: cachedEntry.fetchRange || { start: curSettings.startDate, end: curSettings.endDate },
                        effectiveStartDate: cachedEntry.effectiveStartDate || effectiveStartDate,
                        dataStartDate: curSettings.dataStartDate || curSettings.startDate,
                        lookbackDays: cachedEntry.lookbackDays || lookbackDays,
                        datasetDiagnostics: data?.datasetDiagnostics || cachedEntry.datasetDiagnostics || null,
                        fetchDiagnostics: updatedDiagnostics,
                        lastRemoteFetchDiagnostics: rawFetchDiagnostics,
                        coverageFingerprint: computeCoverageFingerprint(updatedCoverage),
                    };
                    applyCacheStartMetadata(cacheKey, updatedEntry, curSettings.effectiveStartDate || effectiveStartDate, {
                        toleranceDays: START_GAP_TOLERANCE_DAYS,
                        acknowledgeExcessGap: false,
                    });
                    cachedDataStore.set(cacheKey, updatedEntry);
                    persistDataCacheIndexEntry(cacheKey, {
                        market: curSettings.market,
                        fetchedAt: updatedEntry.fetchedAt || Date.now(),
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                        dataStartDate: updatedEntry.dataStartDate || curSettings.startDate,
                        coverageFingerprint: updatedEntry.coverageFingerprint || null,
                    });
                    persistSessionDataCacheEntry(cacheKey, updatedEntry, { market: curSettings.market });
                    persistYearStorageSlices({
                        market: curSettings.market,
                        stockNo: curSettings.stockNo,
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                    }, updatedEntry.data);
                    setVisibleStockData(extractRangeData(updatedEntry.data, curSettings.effectiveStartDate || effectiveStartDate, curSettings.endDate));
                    cachedStockData = updatedEntry.data;
                    lastFetchSettings = { ...curSettings };
                    refreshPriceInspectorControls();
                    updatePriceDebug(updatedEntry);
                     cachedEntry = updatedEntry;
                     console.log("[Main] 使用主執行緒快取資料執行回測。");

                } else if(!useCache) {
                     console.warn("[Main] No rawData to cache from backtest.");
                }
                if (data?.datasetDiagnostics) {
                    const enrichedDiagnostics = { ...data.datasetDiagnostics };
                    const existingMeta = (data.datasetDiagnostics && data.datasetDiagnostics.meta) || {};
                    const nameInfo = resolveCachedStockNameInfo(params?.stockNo, params?.marketType || params?.market);
                    enrichedDiagnostics.meta = {
                        ...existingMeta,
                        stockNo: params?.stockNo || existingMeta.stockNo || null,
                        stockName: nameInfo?.info?.name || existingMeta.stockName || stockName || null,
                        nameSource: nameInfo?.info?.sourceLabel || existingMeta.nameSource || null,
                        nameMarket: nameInfo?.market || existingMeta.nameMarket || null,
                        directoryVersion: taiwanDirectoryState.version || existingMeta.directoryVersion || null,
                        directoryUpdatedAt: taiwanDirectoryState.updatedAt || existingMeta.directoryUpdatedAt || null,
                        directorySource: taiwanDirectoryState.source || existingMeta.directorySource || null,
                    };
                    lastDatasetDiagnostics = enrichedDiagnostics;
                    const runtimeDataset = data.datasetDiagnostics.runtime?.dataset || null;
                    const warmupDiag = data.datasetDiagnostics.runtime?.warmup || null;
                    const fetchDiag = data.datasetDiagnostics.fetch || null;
                    if (typeof console.groupCollapsed === 'function') {
                        console.groupCollapsed('[Main] Dataset diagnostics', params?.stockNo || '');
                        console.log('[Main] Runtime dataset summary', runtimeDataset);
                        console.log('[Main] Warmup summary', warmupDiag);
                        console.log('[Main] Fetch diagnostics', fetchDiag);
                        console.groupEnd();
                    } else {
                        console.log('[Main] Runtime dataset summary', runtimeDataset);
                        console.log('[Main] Warmup summary', warmupDiag);
                        console.log('[Main] Fetch diagnostics', fetchDiag);
                    }
                    if (runtimeDataset && Number.isFinite(runtimeDataset.firstValidCloseGapFromEffective) && runtimeDataset.firstValidCloseGapFromEffective > 1) {
                        console.warn(`[Main] ${params?.stockNo || ''} 第一筆有效收盤價落後暖身起點 ${runtimeDataset.firstValidCloseGapFromEffective} 天。`);
                    }
                    if (runtimeDataset?.invalidRowsInRange?.count > 0) {
                        const reasonSummary = formatDiagnosticsReasonCounts(runtimeDataset.invalidRowsInRange.reasons);
                        console.warn(`[Main] ${params?.stockNo || ''} 區間內偵測到 ${runtimeDataset.invalidRowsInRange.count} 筆無效資料，原因統計: ${reasonSummary}`);
                    }
                    if (fetchDiag?.overview?.invalidRowsInRange?.count > 0) {
                        const fetchReason = formatDiagnosticsReasonCounts(fetchDiag.overview.invalidRowsInRange.reasons);
                        console.warn(`[Main] ${params?.stockNo || ''} 遠端回應包含 ${fetchDiag.overview.invalidRowsInRange.count} 筆無效欄位，原因統計: ${fetchReason}`);
                    }
                } else {
                    lastDatasetDiagnostics = null;
                }
                refreshDataDiagnosticsPanel(lastDatasetDiagnostics);
                const fetchDiagnostics = data?.datasetDiagnostics?.fetch || null;
                const blobOps = Array.isArray(fetchDiagnostics?.blob?.operations)
                    ? fetchDiagnostics.blob.operations
                    : [];
                const shouldRecordBlob =
                    !fetchDiagnostics?.cacheReplay &&
                    blobOps.length > 0;
                if (shouldRecordBlob) {
                    recordBlobUsageEvents(blobOps, {
                        stockNo: params?.stockNo || curSettings.stockNo,
                        market: params?.marketType || params?.market || curSettings.market,
                        source: fetchDiagnostics?.blob?.source || fetchDiagnostics?.blob?.provider || null,
                    });
                    renderBlobUsageCard();
                }
                handleBacktestResult(data, stockName, dataSource); // Process and display main results

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
                showError(data?.message||'回測過程錯誤');
                resetStrategyStatusCard('error');
                if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
                hideLoading();
                if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.showError === 'function') {
                    window.lazybacktestTodaySuggestion.showError(data?.message || '回測過程錯誤');
                }
            }
        };

        backtestWorker.onerror=e=>{
             showError(`Worker錯誤: ${e.message}`); console.error("[Main] Worker Error:",e);
             resetStrategyStatusCard('error');
             if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
             hideLoading();
             const suggestionArea = document.getElementById('today-suggestion-area');
              if (suggestionArea) suggestionArea.classList.add('hidden');
        };

        const workerMsg={
            type:'runBacktest',
            params:params,
            useCachedData:useCache,
            dataStartDate:dataStartDate,
            effectiveStartDate:effectiveStartDate,
            lookbackDays:lookbackDays,
        };
        if(useCache) {
            const cachePayload = cachedEntry?.data || cachedStockData;
            if (Array.isArray(cachePayload)) {
                workerMsg.cachedData = cachePayload; // Prefer完整快取資料
            }
            if (cachedEntry) {
                workerMsg.cachedMeta = {
                    summary: cachedEntry.summary || null,
                    adjustments: Array.isArray(cachedEntry.adjustments) ? cachedEntry.adjustments : [],
                    debugSteps: Array.isArray(cachedEntry.debugSteps) ? cachedEntry.debugSteps : [],
                    adjustmentFallbackApplied: Boolean(cachedEntry.adjustmentFallbackApplied),
                    priceSource: cachedEntry.priceSource || null,
                    dataSource: cachedEntry.dataSource || null,
                    splitAdjustment: Boolean(cachedEntry.splitAdjustment),
                    fetchRange: cachedEntry.fetchRange || null,
                    effectiveStartDate: cachedEntry.effectiveStartDate || effectiveStartDate,
                    lookbackDays: cachedEntry.lookbackDays || lookbackDays,
                    diagnostics: cachedEntry.fetchDiagnostics || cachedEntry.datasetDiagnostics || null,
                };
            }
            console.log("[Main] Sending cached data to worker for backtest.");
        } else {
            console.log("[Main] Fetching new data for backtest.");
        }
        backtestWorker.postMessage(workerMsg);

    } catch (error) {
        console.error("[Main] Error in runBacktestInternal:", error);
        showError(`執行回測時發生錯誤: ${error.message}`);
        hideLoading();
        const suggestionArea = document.getElementById('today-suggestion-area');
        if (suggestionArea) suggestionArea.classList.add('hidden');
        if(backtestWorker)backtestWorker.terminate(); backtestWorker = null;
    }
}

function clearPreviousResults() {
    document.getElementById("backtest-result").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("trade-results").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">請執行優化</p>`;
    setPerformanceAnalysisPlaceholder();
    if(stockChart){
        stockChart.destroy(); 
        stockChart=null; 
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas><div class="text-muted text-center" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>執行回測後將顯示淨值曲線</p></div>';
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
    const resEl=document.getElementById("result");
    resEl.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md';
    resEl.innerHTML = `<i class="fas fa-info-circle mr-2"></i> 請設定參數並執行。`;
    lastOverallResult = null; lastSubPeriodResults = null;
    lastIndicatorSeries = null;
    lastPositionStates = [];
    lastDatasetDiagnostics = null;

    if (window.lazybacktestTodaySuggestion && typeof window.lazybacktestTodaySuggestion.reset === 'function') {
        window.lazybacktestTodaySuggestion.reset();
    } else {
        const suggestionArea = document.getElementById('today-suggestion-area');
        if (suggestionArea) suggestionArea.classList.add('hidden');
    }
    setVisibleStockData([]);
    renderPricePipelineSteps();
    renderPriceInspectorDebug();
    refreshDataDiagnosticsPanel();
}

const adjustmentReasonLabels = {
    missingPriceRow: '缺少對應價格',
    invalidBaseClose: '無效基準價',
    ratioOutOfRange: '調整比例異常',
};

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PERFORMANCE_TABLE_CONTAINER_ID = 'performance-table-container';
const PERFORMANCE_CONTAINER_FLEX_CLASSES = ['flex', 'items-center', 'justify-center', 'border-dashed'];
const PERFORMANCE_PLACEHOLDER_TEXT = '請先執行回測以生成期間績效數據。';
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

function setPerformanceAnalysisPlaceholder(message = PERFORMANCE_PLACEHOLDER_TEXT) {
    const container = document.getElementById(PERFORMANCE_TABLE_CONTAINER_ID);
    if (!container) return;
    PERFORMANCE_CONTAINER_FLEX_CLASSES.forEach((cls) => container.classList.add(cls));
    container.style.borderColor = 'var(--card)';
    container.innerHTML = `<p class="text-sm" style="color: var(--muted-foreground);">${escapeHtml(message)}</p>`;
    container.scrollLeft = 0;
}

// Patch Tag: LB-PERF-TABLE-20240829A
function renderPerformanceAnalysis(result) {
    const container = document.getElementById(PERFORMANCE_TABLE_CONTAINER_ID);
    if (!container) return;
    const parseValidDate = (value) => {
        const timestamp = Date.parse(value);
        return Number.isFinite(timestamp) ? new Date(timestamp) : null;
    };
    const datasetDates = Array.isArray(result?.dates)
        ? result.dates.map((value) => (typeof value === 'string' ? value : null)).filter(Boolean)
        : [];
    const datasetStart = datasetDates.length > 0 ? parseValidDate(datasetDates[0]) : null;
    const datasetEnd = datasetDates.length > 0 ? parseValidDate(datasetDates[datasetDates.length - 1]) : null;
    const datasetYearSpan = datasetStart && datasetEnd && datasetEnd > datasetStart
        ? Math.ceil((datasetEnd - datasetStart) / MS_PER_YEAR)
        : 0;
    const subPeriodResults = (result && typeof result === 'object' && result.subPeriodResults)
        ? result.subPeriodResults
        : lastSubPeriodResults;
    const yearsSetting = Number.isFinite(lastRecentYearsSetting) && lastRecentYearsSetting > 0
        ? Math.min(lastRecentYearsSetting, 50)
        : null;

    if (!yearsSetting || !subPeriodResults || typeof subPeriodResults !== 'object') {
        setPerformanceAnalysisPlaceholder(PERFORMANCE_PLACEHOLDER_TEXT);
        return;
    }

    const periodEntries = [];
    const appendPeriod = (key, label) => {
        const entry = Object.prototype.hasOwnProperty.call(subPeriodResults, key)
            ? subPeriodResults[key]
            : null;
        const normalized = entry && typeof entry === 'object' ? entry : null;
        periodEntries.push({ key, label, data: normalized });
    };

    appendPeriod('1M', '最近一個月');
    appendPeriod('6M', '最近六個月');
    const desiredYearRows = Math.max(yearsSetting || 0, datasetYearSpan, 1);
    const effectiveYearRows = Math.min(desiredYearRows, 50);
    for (let year = 1; year <= effectiveYearRows; year += 1) {
        const key = `${year}Y`;
        const label = `最近${year === 1 ? '一年' : `${year}年`}`;
        appendPeriod(key, label);
    }

    const visiblePeriodEntries = periodEntries.filter((entry) => entry.data !== null);
    if (visiblePeriodEntries.length === 0) {
        setPerformanceAnalysisPlaceholder('尚無足夠期間績效資料，請延長期間或縮小 N。');
        return;
    }

    PERFORMANCE_CONTAINER_FLEX_CLASSES.forEach((cls) => container.classList.remove(cls));
    container.style.borderColor = 'var(--border)';

    const missingHtml = '<span class="text-muted-foreground/70 italic">資料不足</span>';
    const formatPercent = (value, { showSign = true, positiveIsGood = true } = {}) => {
        if (value === null || value === undefined || value === '') {
            return missingHtml;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            if (numeric === Infinity) {
                return '<span class="text-emerald-600">∞</span>';
            }
            if (numeric === -Infinity) {
                return '<span class="text-rose-600">-∞</span>';
            }
            return missingHtml;
        }
        const signPrefix = showSign && numeric > 0 ? '+' : '';
        const text = `${signPrefix}${numeric.toFixed(2)}%`;
        let className = 'text-muted-foreground';
        if (numeric > 0) {
            className = positiveIsGood ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold';
        } else if (numeric < 0) {
            className = positiveIsGood ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold';
        }
        return `<span class="${className}">${text}</span>`;
    };
    const formatNumber = (value) => {
        if (value === null || value === undefined || value === '') {
            return missingHtml;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            if (numeric === Infinity) return '<span class="text-emerald-600">∞</span>';
            if (numeric === -Infinity) return '<span class="text-rose-600">-∞</span>';
            return missingHtml;
        }
        return `<span>${numeric.toFixed(2)}</span>`;
    };

    const metrics = [
        { key: 'annualizedReturn', label: '策略年化報酬(%)', formatter: (value) => formatPercent(value, { showSign: true, positiveIsGood: true }) },
        { key: 'totalReturn', label: '策略累積報酬(%)', formatter: (value) => formatPercent(value, { showSign: true, positiveIsGood: true }) },
        { key: 'totalBuyHoldReturn', label: '買入持有累積報酬(%)', formatter: (value) => formatPercent(value, { showSign: true, positiveIsGood: true }) },
        { key: 'sharpeRatio', label: '夏普值', formatter: formatNumber },
        { key: 'sortinoRatio', label: '索提諾比率', formatter: formatNumber },
        { key: 'maxDrawdown', label: '最大回撤(%)', formatter: (value) => formatPercent(value, { showSign: false, positiveIsGood: false }) },
    ];

    const headerCells = metrics
        .map((metric) => `<th scope="col" class="px-3 py-2 font-medium text-center whitespace-nowrap">${escapeHtml(metric.label)}</th>`)
        .join('');
    const bodyRows = visiblePeriodEntries
        .map((entry) => {
            const cells = metrics
                .map((metric) => {
                    const raw = entry.data ? entry.data[metric.key] : null;
                    return `<td class="px-3 py-2 text-center">${metric.formatter(raw)}</td>`;
                })
                .join('');
            return `
                <tr>
                    <th scope="row" class="px-3 py-2 text-left font-medium whitespace-nowrap" style="color: var(--foreground);">${escapeHtml(entry.label)}</th>
                    ${cells}
                </tr>`;
        })
        .join('');

    const tableHtml = [
        '<div class="inline-block min-w-full align-middle">',
        '<table class="min-w-full divide-y divide-border text-xs text-left" style="color: var(--foreground);">',
        `<thead class="bg-muted/10 text-[11px] uppercase tracking-wide" style="color: var(--muted-foreground);">`,
        `<tr><th scope="col" class="px-3 py-2 font-medium">期間</th>${headerCells}</tr></thead>`,
        `<tbody class="divide-y divide-border">${bodyRows}</tbody>`,
        '</table>',
        '</div>',
    ].join('');

    container.innerHTML = tableHtml;
    container.scrollLeft = 0;
}

function formatSkipReasons(skipReasons) {
    if (!skipReasons || typeof skipReasons !== 'object') return '';
    const entries = Object.entries(skipReasons);
    if (entries.length === 0) return '';
    return entries
        .map(([reason, count]) => {
            const label = adjustmentReasonLabels[reason] || reason;
            return `${label}: ${count}`;
        })
        .join('、');
}

function updatePriceDebug(meta = {}) {
    const steps = Array.isArray(meta.debugSteps) ? meta.debugSteps : Array.isArray(meta.steps) ? meta.steps : [];
    const summary = meta.summary || null;
    const adjustments = Array.isArray(meta.adjustments) ? meta.adjustments : [];
    const fallbackApplied = typeof meta.adjustmentFallbackApplied === 'boolean'
        ? meta.adjustmentFallbackApplied
        : Boolean(meta.fallbackApplied);
    const priceSourceLabel = meta.priceSource || (summary && summary.priceSource) || null;
    const aggregateSource = meta.dataSource || null;
    const sourceList = Array.isArray(meta.dataSources) ? meta.dataSources : [];
    const priceMode = meta.priceMode || (typeof meta.adjustedPrice === 'boolean' ? (meta.adjustedPrice ? 'adjusted' : 'raw') : null);
    const splitDiagnostics = meta.splitDiagnostics || null;
    const finmindStatus = meta.finmindStatus || null;
    const adjustmentDebugLog = Array.isArray(meta.adjustmentDebugLog) ? meta.adjustmentDebugLog : [];
    const adjustmentChecks = Array.isArray(meta.adjustmentChecks) ? meta.adjustmentChecks : [];
    lastPriceDebug = {
        steps,
        summary,
        adjustments,
        fallbackApplied,
        priceSource: priceSourceLabel,
        dataSource: aggregateSource,
        dataSources: sourceList,
        priceMode,
        splitDiagnostics,
        finmindStatus,
        adjustmentDebugLog,
        adjustmentChecks,
    };
    renderPricePipelineSteps();
    renderPriceInspectorDebug();
}

function renderPricePipelineSteps() {
    const container = document.getElementById('pricePipelineSteps');
    if (!container) return;
    const hasData = Array.isArray(visibleStockData) && visibleStockData.length > 0;
    const hasSteps = Array.isArray(lastPriceDebug.steps) && lastPriceDebug.steps.length > 0;
    if (!hasData || !hasSteps) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    const rows = lastPriceDebug.steps.map((step) => {
        const status = step.status === 'success' ? 'text-emerald-600'
            : step.status === 'warning' ? 'text-amber-600' : 'text-rose-600';
        let detailText = step.detail ? ` ・ ${escapeHtml(step.detail)}` : '';
        if (step.key === 'adjustmentApply' && lastPriceDebug.fallbackApplied) {
            detailText += ' ・ 已啟用備援縮放';
        }
        const reasonFormatted = step.skipReasons ? formatSkipReasons(step.skipReasons) : '';
        const reasonText = reasonFormatted ? ` ・ ${escapeHtml(reasonFormatted)}` : '';
        return `<div class="flex items-center gap-2 text-[11px]">
            <span class="${status}">●</span>
            <span style="color: var(--foreground);">${escapeHtml(step.label)}${detailText}${reasonText}</span>
        </div>`;
    }).join('');
    container.innerHTML = rows;
    container.classList.remove('hidden');
}

function renderPriceInspectorDebug() {
    const panel = document.getElementById('priceInspectorDebugPanel');
    if (!panel) return;
    const hasData = Array.isArray(visibleStockData) && visibleStockData.length > 0;
    const hasSteps = Array.isArray(lastPriceDebug.steps) && lastPriceDebug.steps.length > 0;
    if (!hasData || !hasSteps) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }
    const summaryItems = [];
    if (lastPriceDebug.summary && typeof lastPriceDebug.summary === 'object') {
        const applied = Number(lastPriceDebug.summary.adjustmentEvents || 0);
        const skipped = Number(lastPriceDebug.summary.skippedEvents || 0);
        summaryItems.push(`成功 ${applied} 件`);
        summaryItems.push(`略過 ${skipped} 件`);
    }
    if (lastPriceDebug.fallbackApplied) {
        summaryItems.push('備援縮放已啟用');
    }
    const summaryLine = summaryItems.length > 0
        ? `<div class="text-[11px] font-medium" style="color: var(--foreground);">${escapeHtml(summaryItems.join(' ・ '))}</div>`
        : '';
    const stepsHtml = lastPriceDebug.steps.map((step) => {
        const status = step.status === 'success' ? 'text-emerald-600'
            : step.status === 'warning' ? 'text-amber-600' : 'text-rose-600';
        let detailText = step.detail ? ` ・ ${escapeHtml(step.detail)}` : '';
        if (step.key === 'adjustmentApply' && lastPriceDebug.fallbackApplied) {
            detailText += ' ・ 已啟用備援縮放';
        }
        const reasonFormatted = step.skipReasons ? formatSkipReasons(step.skipReasons) : '';
        const reasonText = reasonFormatted ? ` ・ ${escapeHtml(reasonFormatted)}` : '';
        return `<div class="flex items-start gap-2 text-[11px]">
            <span class="${status}">●</span>
            <span style="color: var(--foreground);">${escapeHtml(step.label)}${detailText}${reasonText}</span>
        </div>`;
    }).join('');
    panel.innerHTML = `<div class="space-y-2">${summaryLine}${stepsHtml}</div>`;
    panel.classList.remove('hidden');
}

const dataDiagnosticsState = { open: false };

function formatDiagnosticsValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return '—';
        return value.toString();
    }
    return String(value);
}

function formatDiagnosticsRange(start, end) {
    if (!start && !end) return '—';
    if (start && end) return `${start} ~ ${end}`;
    return start || end || '—';
}

function formatDiagnosticsIndex(entry) {
    if (!entry || typeof entry !== 'object') return '—';
    const date = entry.date || '—';
    const index = Number.isFinite(entry.index) ? `#${entry.index}` : '#—';
    return `${date} (${index})`;
}

function formatDiagnosticsGap(days) {
    if (!Number.isFinite(days)) return '—';
    if (days === 0) return '0 天';
    return `${days > 0 ? '+' : ''}${days} 天`;
}

function formatDiagnosticsReasonCounts(reasons) {
    if (!reasons || typeof reasons !== 'object') return '—';
    const entries = Object.entries(reasons)
        .map(([reason, count]) => [reason, Number(count)])
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return '—';
    return entries.map(([reason, count]) => `${reason}×${count}`).join('、');
}

function renderDiagnosticsEntries(containerId, entries) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(entries) || entries.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">無資料</p>`;
        return;
    }
    container.innerHTML = entries
        .map((entry) => {
            const label = escapeHtml(entry.label || '');
            const value = escapeHtml(formatDiagnosticsValue(entry.value));
            const valueClass = entry.emphasis ? 'font-semibold' : '';
            return `<div class="flex justify-between gap-2 text-[11px]">
                <span class="text-muted-foreground" style="color: var(--muted-foreground);">${label}</span>
                <span class="${valueClass}" style="color: var(--foreground);">${value}</span>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsSamples(containerId, samples, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(samples) || samples.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">${options.emptyText || '無異常樣本'}</p>`;
        return;
    }
    container.innerHTML = samples
        .map((sample) => {
            const date = escapeHtml(sample.date || '');
            const index = Number.isFinite(sample.index) ? `#${sample.index}` : '#—';
            const reasons = Array.isArray(sample.reasons)
                ? escapeHtml(sample.reasons.join('、'))
                : '—';
            const close = sample.close !== undefined && sample.close !== null
                ? escapeHtml(sample.close.toString())
                : '—';
            const volume = sample.volume !== undefined && sample.volume !== null
                ? escapeHtml(sample.volume.toString())
                : '—';
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div style="color: var(--foreground);">${date} (${index})</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">原因: ${reasons}</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">收盤: ${close} ｜ 量: ${volume}</div>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsPreview(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">尚未取得鄰近樣本。</p>`;
        return;
    }
    container.innerHTML = rows
        .map((row) => {
            const index = Number.isFinite(row.index) ? `#${row.index}` : '#—';
            const date = escapeHtml(row.date || '');
            const close = row.close !== undefined && row.close !== null
                ? escapeHtml(row.close.toString())
                : '—';
            const open = row.open !== undefined && row.open !== null
                ? escapeHtml(row.open.toString())
                : '—';
            const high = row.high !== undefined && row.high !== null
                ? escapeHtml(row.high.toString())
                : '—';
            const low = row.low !== undefined && row.low !== null
                ? escapeHtml(row.low.toString())
                : '—';
            const volume = row.volume !== undefined && row.volume !== null
                ? escapeHtml(row.volume.toString())
                : '—';
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div style="color: var(--foreground);">${date} (${index})</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">開:${open} 高:${high} 低:${low}</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">收:${close} ｜ 量:${volume}</div>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsTestingGuidance(diag) {
    const container = document.getElementById('dataDiagnosticsTesting');
    if (!container) return;
    if (!diag) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">執行回測後會在此提供建議的手動測試步驟。</p>`;
        return;
    }
    const dataset = diag.runtime?.dataset || {};
    const buyHold = diag.runtime?.buyHold || {};
    const fetchOverview = diag.fetch?.overview || {};
    const reasonSummary = formatDiagnosticsReasonCounts(dataset.invalidRowsInRange?.reasons);
    const buyHoldFirst = buyHold.firstValidPriceDate || '—';
    const fetchRange = formatDiagnosticsRange(fetchOverview.firstDate, fetchOverview.lastDate);
    container.innerHTML = `<ol class="list-decimal pl-4 space-y-1">
        <li style="color: var(--foreground);">請比對圖表起點（${escapeHtml(dataset.requestedStart || '—')}）與買入持有首日（${escapeHtml(buyHoldFirst)}），並於回報時附上此卡片截圖。</li>
        <li style="color: var(--foreground);">若「無效欄位統計」顯示 ${escapeHtml(reasonSummary)}，請擷取 console 中 [Worker] dataset/fetch summary 的表格輸出。</li>
        <li style="color: var(--foreground);">確認遠端資料範圍 ${escapeHtml(fetchRange)} 是否覆蓋暖身期，如仍缺資料請於回報時註記。</li>
    </ol>`;
}

function renderDiagnosticsFetch(fetchDiag) {
    const summaryContainer = document.getElementById('dataDiagnosticsFetchSummary');
    const monthsContainer = document.getElementById('dataDiagnosticsFetchMonths');
    if (!summaryContainer || !monthsContainer) return;
    if (!fetchDiag) {
        summaryContainer.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">尚未擷取遠端資料。</p>`;
        monthsContainer.innerHTML = '';
        return;
    }
    const overview = fetchDiag.overview || {};
    renderDiagnosticsEntries('dataDiagnosticsFetchSummary', [
        { label: '抓取起點', value: fetchDiag.dataStartDate || fetchDiag.requested?.start || '—' },
        { label: '遠端資料範圍', value: formatDiagnosticsRange(overview.firstDate, overview.lastDate) },
        { label: '暖身起點', value: overview.warmupStartDate || fetchDiag.dataStartDate || fetchDiag.requested?.start || '—' },
        { label: '第一筆有效收盤', value: formatDiagnosticsIndex(overview.firstValidCloseOnOrAfterWarmupStart || overview.firstValidCloseOnOrAfterEffectiveStart) },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(overview.firstValidCloseGapFromWarmup ?? overview.firstValidCloseGapFromEffective) },
        { label: '遠端無效筆數', value: overview.invalidRowsInRange?.count ?? 0 },
        { label: '遠端無效欄位', value: formatDiagnosticsReasonCounts(overview.invalidRowsInRange?.reasons) },
        { label: '月度分段', value: Array.isArray(fetchDiag.months) ? fetchDiag.months.length : 0 },
    ]);
    if (!Array.isArray(fetchDiag.months) || fetchDiag.months.length === 0) {
        monthsContainer.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">沒有月度快取紀錄。</p>`;
        return;
    }
    const recentMonths = fetchDiag.months.slice(-6);
    monthsContainer.innerHTML = recentMonths
        .map((month) => {
            const monthLabel = escapeHtml(month.label || month.monthKey || '—');
            const rows = formatDiagnosticsValue(month.rowsReturned);
            const missing = formatDiagnosticsValue(month.missingSegments);
            const forced = formatDiagnosticsValue(month.forcedRepairs);
            const firstDate = escapeHtml(month.firstRowDate || '—');
            const cacheUsed = month.usedCache ? '是' : '否';
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">${monthLabel}</div>
                <div class="flex flex-wrap gap-2 text-muted-foreground" style="color: var(--muted-foreground);">
                    <span>筆數 ${rows}</span>
                    <span>缺口 ${missing}</span>
                    <span>強制補抓 ${forced}</span>
                    <span>首筆 ${firstDate}</span>
                    <span>使用快取 ${cacheUsed}</span>
                </div>
            </div>`;
        })
        .join('');
}

function refreshDataDiagnosticsPanel(diag = lastDatasetDiagnostics) {
    const hintEl = document.getElementById('dataDiagnosticsHint');
    const contentEl = document.getElementById('dataDiagnosticsContent');
    const titleEl = document.getElementById('dataDiagnosticsTitle');
    if (!hintEl || !contentEl || !titleEl) return;
    if (!diag) {
        hintEl.textContent = '請先執行回測後，再查看暖身與快取診斷資訊。';
        contentEl.classList.add('hidden');
        titleEl.textContent = '資料暖身診斷';
        renderDiagnosticsEntries('dataDiagnosticsSummary', []);
        renderDiagnosticsEntries('dataDiagnosticsName', []);
        renderDiagnosticsEntries('dataDiagnosticsWarmup', []);
        renderDiagnosticsEntries('dataDiagnosticsBuyHold', []);
        renderDiagnosticsSamples('dataDiagnosticsInvalidSamples', []);
        renderDiagnosticsSamples('dataDiagnosticsBuyHoldSamples', []);
        renderDiagnosticsFetch(null);
        renderDiagnosticsPreview('dataDiagnosticsPreview', []);
        renderDiagnosticsTestingGuidance(null);
        return;
    }
    hintEl.textContent = '若需回報問題，請一併提供此卡片內容與 console 診斷資訊。';
    contentEl.classList.remove('hidden');
    const meta = diag.meta || {};
    const dataset = diag.runtime?.dataset || {};
    const warmup = diag.runtime?.warmup || {};
    const buyHold = diag.runtime?.buyHold || {};
    titleEl.textContent = `資料暖身診斷：${dataset.requestedStart || warmup.requestedStart || '—'} → ${dataset.endDate || diag.fetch?.requested?.end || '—'}`;
    renderDiagnosticsEntries('dataDiagnosticsName', [
        { label: '股票代碼', value: meta.stockNo || dataset.stockNo || '—' },
        { label: '股票名稱', value: meta.stockName || '—' },
        { label: '名稱來源', value: meta.nameSource || '—' },
        { label: '名稱市場', value: meta.nameMarket ? getMarketDisplayName(meta.nameMarket) : '—' },
        { label: '台股清單來源', value: meta.directorySource || '—' },
        { label: '清單版本', value: meta.directoryVersion || '—' },
        { label: '清單更新時間', value: meta.directoryUpdatedAt || '—' },
    ]);
    renderDiagnosticsEntries('dataDiagnosticsSummary', [
        { label: '資料總筆數', value: dataset.totalRows },
        { label: '資料範圍', value: formatDiagnosticsRange(dataset.firstDate, dataset.lastDate) },
        { label: '使用者起點', value: dataset.requestedStart || warmup.requestedStart || '—' },
        { label: '暖身起點', value: dataset.warmupStartDate || warmup.warmupStartDate || dataset.dataStartDate || warmup.dataStartDate || '—' },
        { label: '暖身筆數', value: dataset.warmupRows },
        { label: '區間筆數', value: dataset.rowsWithinRange },
        { label: '第一筆>=使用者起點', value: formatDiagnosticsIndex(dataset.firstRowOnOrAfterRequestedStart) },
        { label: '第一筆有效收盤', value: formatDiagnosticsIndex(dataset.firstValidCloseOnOrAfterRequestedStart) },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(dataset.firstValidCloseGapFromWarmup ?? dataset.firstValidCloseGapFromEffective) },
        { label: '距使用者起點天數', value: formatDiagnosticsGap(dataset.firstValidCloseGapFromRequested) },
        { label: '區間內無效筆數', value: dataset.invalidRowsInRange?.count ?? 0 },
        { label: '第一筆無效資料', value: dataset.firstInvalidRowOnOrAfterEffectiveStart ? formatDiagnosticsIndex(dataset.firstInvalidRowOnOrAfterEffectiveStart) : '—' },
        { label: '無效欄位統計', value: formatDiagnosticsReasonCounts(dataset.invalidRowsInRange?.reasons) },
    ]);
    renderDiagnosticsSamples(
        'dataDiagnosticsInvalidSamples',
        dataset.invalidRowsInRange?.samples || [],
        { emptyText: '區間內尚未觀察到無效筆數。' }
    );
    renderDiagnosticsEntries('dataDiagnosticsWarmup', [
        { label: '暖身起點', value: warmup.warmupStartDate || warmup.dataStartDate || dataset.warmupStartDate || '—' },
        { label: 'Longest 指標窗', value: warmup.longestLookback },
        { label: 'KD 需求 (多/空)', value: `${formatDiagnosticsValue(warmup.kdNeedLong)} / ${formatDiagnosticsValue(warmup.kdNeedShort)}` },
        { label: 'MACD 需求 (多/空)', value: `${formatDiagnosticsValue(warmup.macdNeedLong)} / ${formatDiagnosticsValue(warmup.macdNeedShort)}` },
        { label: '模擬起始索引', value: warmup.computedStartIndex },
        { label: '有效起始索引', value: warmup.effectiveStartIndex },
        { label: '暖身耗用筆數', value: warmup.barsBeforeFirstTrade },
        { label: '設定 Lookback 天數', value: warmup.lookbackDays },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(warmup.firstValidCloseGapFromWarmup ?? dataset.firstValidCloseGapFromWarmup) },
    ]);
    renderDiagnosticsEntries('dataDiagnosticsBuyHold', [
        { label: '首筆有效收盤索引', value: buyHold.firstValidPriceIdx },
        { label: '首筆有效收盤日期', value: buyHold.firstValidPriceDate || '—' },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(buyHold.firstValidPriceGapFromEffective) },
        { label: '距使用者起點天數', value: formatDiagnosticsGap(buyHold.firstValidPriceGapFromRequested) },
        { label: '暖身後無效收盤筆數', value: buyHold.invalidBarsBeforeFirstValid?.count ?? 0 },
    ]);
    renderDiagnosticsSamples(
        'dataDiagnosticsBuyHoldSamples',
        buyHold.invalidBarsBeforeFirstValid?.samples || [],
        { emptyText: '暖身後未觀察到收盤價缺失。' }
    );
    renderDiagnosticsPreview('dataDiagnosticsPreview', warmup.previewRows || []);
    renderDiagnosticsFetch(diag.fetch || null);
    renderDiagnosticsTestingGuidance(diag);
}

function renderBlobUsageCard() {
    const container = document.getElementById('blobUsageContent');
    const updatedAtEl = document.getElementById('blobUsageUpdatedAt');
    if (!container) return;
    if (!blobUsageLedger || typeof blobUsageLedger !== 'object') {
        container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">尚未累積 Blob 用量統計，執行回測後將在此顯示本月操作數與熱門查詢。</div>`;
        if (updatedAtEl) updatedAtEl.textContent = '';
        return;
    }
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthRecord = blobUsageLedger.months?.[monthKey] || null;
    if (!monthRecord) {
        container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">本月尚未觸發任何 Blob 操作。</div>`;
        if (updatedAtEl) updatedAtEl.textContent = '';
        return;
    }
    const totalOps = Number(monthRecord.readOps || 0) + Number(monthRecord.writeOps || 0);
    const hit = Number(monthRecord.cacheHits || 0);
    const miss = Number(monthRecord.cacheMisses || 0);
    const hitRate = totalOps > 0 ? `${((hit / totalOps) * 100).toFixed(1)}%` : '—';
    const topStocks = Object.entries(monthRecord.stocks || {})
        .map(([stock, info]) => ({
            stock,
            count: Number(info?.count) || 0,
            market: info?.market || null,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    const topStocksHtml = topStocks.length > 0
        ? topStocks
            .map((item) => `<div class="flex items-center justify-between"><span>${escapeHtml(item.stock)}</span><span style="color: var(--muted-foreground);">${item.count} 次${item.market ? `・${escapeHtml(item.market)}` : ''}</span></div>`)
            .join('')
        : '<div style="color: var(--muted-foreground);">尚無熱門查詢</div>';

    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const events = Array.isArray(monthRecord.events) ? monthRecord.events : [];
    const grouped = [];
    const groupMap = new Map();
    const writeEventsList = events.filter((event) => (event?.action || event?.type) === 'write');
    events.forEach((event) => {
        const when = new Date(Number(event.timestamp) || Date.now());
        const dateKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
        if (!groupMap.has(dateKey)) {
            groupMap.set(dateKey, {
                key: dateKey,
                label: `${when.getFullYear()}/${String(when.getMonth() + 1).padStart(2, '0')}/${String(when.getDate()).padStart(2, '0')}`,
                rows: [],
            });
            grouped.push(groupMap.get(dateKey));
        }
        groupMap.get(dateKey).rows.push({ raw: event, when });
    });

    const writeSummaryHtml = writeEventsList.length > 0
        ? writeEventsList.slice(0, 5).map((event) => {
            const when = new Date(Number(event.timestamp) || Date.now());
            const timeLabel = `${String(when.getMonth() + 1).padStart(2, '0')}/${String(when.getDate()).padStart(2, '0')} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
            const stockParts = [];
            if (event.stockNo) {
                stockParts.push(escapeHtml(event.stockNo));
            }
            if (event.market) {
                stockParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(event.market)}</span>`);
            }
            const stockLabel = stockParts.length > 0 ? stockParts.join('・') : '系統';
            const sourceLabel = event.source ? escapeHtml(event.source) : '—';
            const keyLabel = event.key ? `｜${escapeHtml(event.key)}` : '';
            return `<div class="flex items-center justify-between text-[11px]" style="gap: 0.5rem;">
                <span>${stockLabel}</span>
                <span style="color: var(--muted-foreground); white-space: nowrap;">${timeLabel}｜${sourceLabel}${keyLabel}</span>
            </div>`;
        }).join('')
        : '<div style="color: var(--muted-foreground);">本月尚未發生寫入操作。</div>';

    const eventsHtml = grouped.length > 0
        ? grouped.map((group) => {
            const defaultExpanded = group.key === todayKey;
            const expanded = isBlobUsageGroupExpanded(group.key, defaultExpanded);
            const indicator = expanded ? '－' : '＋';
            const rowsHtml = group.rows.map((item) => {
                const actionLabel = item.raw.action === 'write' ? '寫入' : '讀取';
                const badgeClass = item.raw.action === 'write'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                const statusLabel = item.raw.cacheHit ? '命中' : '補抓';
                const timeLabel = `${String(item.when.getHours()).padStart(2, '0')}:${String(item.when.getMinutes()).padStart(2, '0')}`;
                const infoParts = [];
                if (item.raw.stockNo) infoParts.push(`<span>${escapeHtml(item.raw.stockNo)}</span>`);
                if (item.raw.market) infoParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(item.raw.market)}</span>`);
                if (item.raw.key) infoParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(item.raw.key)}</span>`);
                if (item.raw.source) infoParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(item.raw.source)}</span>`);
                infoParts.push(`<span style="color: var(--muted-foreground);">${statusLabel}</span>`);
                infoParts.push(`<span style="color: var(--muted-foreground);">${timeLabel}</span>`);
                return `<div class="border rounded px-3 py-2 text-[11px]" style="border-color: var(--border);">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${badgeClass}">${actionLabel}</span>
                        ${infoParts.join(' ')}
                    </div>
                </div>`;
            }).join('');
            return `<div class="border rounded-md" data-blob-group="${group.key}" style="border-color: var(--border); background-color: color-mix(in srgb, var(--background) 96%, transparent);">
                <button type="button" class="w-full flex items-center justify-between px-3 py-2 text-left text-[11px] font-medium" data-blob-group-toggle="${group.key}" aria-expanded="${expanded ? 'true' : 'false'}" style="color: var(--foreground);">
                    <span>${group.label}</span>
                    <span class="flex items-center gap-2" style="color: var(--muted-foreground);">
                        <span>${group.rows.length} 筆</span>
                        <span data-blob-group-indicator="${group.key}" aria-hidden="true">${indicator}</span>
                    </span>
                </button>
                <div class="space-y-2 px-3 pb-3 ${expanded ? '' : 'hidden'}" data-blob-group-body="${group.key}">
                    ${rowsHtml}
                </div>
            </div>`;
        }).join('')
        : '<div style="color: var(--muted-foreground);">尚未記錄近期操作</div>';

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-[11px]">
            <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">本月操作數</div>
                <div class="mt-1 text-lg font-semibold" style="color: var(--foreground);">${formatNumberWithComma(totalOps)}</div>
                <div class="mt-1 text-xs" style="color: var(--muted-foreground);">讀取 ${formatNumberWithComma(monthRecord.readOps || 0)}・寫入 ${formatNumberWithComma(monthRecord.writeOps || 0)}</div>
            </div>
            <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">命中率</div>
                <div class="mt-1 text-lg font-semibold" style="color: var(--foreground);">${hitRate}</div>
                <div class="mt-1 text-xs" style="color: var(--muted-foreground);">命中 ${formatNumberWithComma(hit)}・補抓 ${formatNumberWithComma(miss)}</div>
            </div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">熱門股票</div>
            <div class="space-y-1">${topStocksHtml}</div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">寫入監控</div>
            <div class="text-[11px]" style="color: var(--muted-foreground);">本月寫入 ${formatNumberWithComma(monthRecord.writeOps || 0)} 次</div>
            <div class="mt-2 space-y-1">${writeSummaryHtml}</div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">近期操作</div>
            <div class="space-y-2" style="max-height: 16rem; overflow-y: auto; padding-right: 0.25rem;">${eventsHtml}</div>
        </div>
    `;

    if (grouped.length > 0) {
        const toggles = container.querySelectorAll('[data-blob-group-toggle]');
        toggles.forEach((btn) => {
            btn.addEventListener('click', () => {
                const dateKey = btn.getAttribute('data-blob-group-toggle');
                const body = container.querySelector(`[data-blob-group-body="${dateKey}"]`);
                const indicator = container.querySelector(`[data-blob-group-indicator="${dateKey}"]`);
                if (!body) return;
                const currentlyExpanded = !body.classList.contains('hidden');
                const nextState = !currentlyExpanded;
                body.classList.toggle('hidden', !nextState);
                btn.setAttribute('aria-expanded', nextState ? 'true' : 'false');
                if (indicator) indicator.textContent = nextState ? '－' : '＋';
                setBlobUsageGroupExpanded(dateKey, nextState);
            });
        });
    }

    if (updatedAtEl) {
        updatedAtEl.textContent = blobUsageLedger.updatedAt
            ? `更新於 ${new Date(blobUsageLedger.updatedAt).toLocaleString('zh-TW')}`
            : '';
    }
}

function toggleDataDiagnostics(forceOpen) {
    const panel = document.getElementById('dataDiagnosticsPanel');
    const toggleBtn = document.getElementById('toggleDataDiagnostics');
    if (!panel || !toggleBtn) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !dataDiagnosticsState.open;
    dataDiagnosticsState.open = shouldOpen;
    if (shouldOpen) {
        panel.classList.remove('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
        refreshDataDiagnosticsPanel();
    } else {
        panel.classList.add('hidden');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }
}

function initDataDiagnosticsPanel() {
    const toggleBtn = document.getElementById('toggleDataDiagnostics');
    const closeBtn = document.getElementById('closeDataDiagnostics');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleDataDiagnostics());
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleDataDiagnostics(false));
    }
    refreshDataDiagnosticsPanel();
    window.refreshDataDiagnosticsPanel = refreshDataDiagnosticsPanel;
}

function initTrendAnalysisToggle() {
    const toggleBtn = document.getElementById('trendAnalysisToggle');
    const content = document.getElementById('trend-analysis-content');
    const legend = document.getElementById('trend-legend');
    const card = document.getElementById('trend-analysis-card');
    if (!toggleBtn || !content || !card) return;

    const indicator = toggleBtn.querySelector('.trend-toggle-indicator');
    const labelEl = toggleBtn.querySelector('[data-trend-toggle-label]');
    let expanded = false;

    const applyState = (open) => {
        expanded = Boolean(open);
        content.classList.toggle('hidden', !expanded);
        content.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        card.dataset.collapsed = expanded ? 'false' : 'true';
        if (indicator) {
            indicator.classList.toggle('open', expanded);
            indicator.textContent = expanded ? '－' : '＋';
        }
        if (labelEl) {
            labelEl.textContent = expanded ? '隱藏趨勢總覽' : '顯示趨勢總覽';
            labelEl.classList.toggle('open', expanded);
        }
        if (legend) {
            legend.classList.toggle('hidden', !expanded);
            legend.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        }
        updateChartTrendOverlay();
    };

    applyState(false);

    toggleBtn.addEventListener('click', () => {
        applyState(!expanded);
    });
}

function initMultiStagePanel() {
    const toggleBtn = document.getElementById('multiStageToggle');
    const content = document.getElementById('multiStageContent');
    const icon = document.getElementById('multiStageToggleIcon');
    if (!toggleBtn || !content) return;

    let expanded = false;

    const applyState = (open) => {
        expanded = Boolean(open);
        content.classList.toggle('hidden', !expanded);
        content.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', expanded ? '隱藏多次進出場設定' : '顯示多次進出場設定');
        if (icon) {
            icon.textContent = expanded ? '－' : '＋';
        }
    };

    toggleBtn.addEventListener('click', () => {
        applyState(!expanded);
    });

    window.lazybacktestMultiStagePanel = {
        open() {
            applyState(true);
        },
        close() {
            applyState(false);
        },
        toggle() {
            applyState(!expanded);
        },
        isOpen() {
            return expanded;
        },
    };

    applyState(false);
}

function initSensitivityCollapse(rootEl) {
    const scope = rootEl || document;
    const toggleBtn = scope.querySelector('[data-sensitivity-toggle]');
    const body = scope.querySelector('[data-sensitivity-body]');
    if (!toggleBtn || !body) return;
    if (toggleBtn.dataset.sensitivityInitialized === 'true') return;
    toggleBtn.dataset.sensitivityInitialized = 'true';
    const indicator = toggleBtn.querySelector('.toggle-indicator');
    const label = toggleBtn.querySelector('.toggle-label');
    let expanded = false;

    const applyState = (open) => {
        expanded = Boolean(open);
        body.classList.toggle('hidden', !expanded);
        body.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (indicator) {
            indicator.textContent = expanded ? '－' : '＋';
        }
        if (label) {
            label.textContent = expanded ? '收合敏感度表格' : '展開敏感度表格';
        }
    };

    applyState(false);

    toggleBtn.addEventListener('click', () => {
        applyState(!expanded);
    });
}

function updateDataSourceDisplay(dataSource, stockName) {
    const displayEl = document.getElementById('dataSourceDisplay');
    const tagEl = document.getElementById('dataSourceSummaryTag');
    if (!displayEl) return;

    if (tagEl) {
        tagEl.textContent = stockName ? `標的 ${stockName}` : '';
    }

    if (dataSource) {
        const segments = Array.isArray(dataSource)
            ? dataSource
            : dataSource.toString().split(/\s*\n\s*/).filter((segment) => segment && segment.trim().length > 0);
        const list = (segments.length > 0 ? segments : [dataSource])
            .map((segment) => `<div>${escapeHtml(segment)}</div>`)
            .join('');
        displayEl.innerHTML = list;
        if (typeof window.refreshDataSourceTester === 'function') {
            try {
                window.refreshDataSourceTester();
            } catch (error) {
                console.warn('[Main] 更新資料來源測試面板時發生例外:', error);
            }
        }
    } else {
        displayEl.innerHTML = '<div style="color: var(--muted-foreground);">執行回測後會顯示最新的主來源、快取命中與備援情況。</div>';
    }
}

// Patch Tag: LB-PRICE-INSPECTOR-20250518A
function resolvePriceInspectorSourceLabel() {
    const summarySources = Array.isArray(lastPriceDebug?.summary?.sources)
        ? lastPriceDebug.summary.sources.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
    const candidates = [
        lastPriceDebug?.priceSource,
        lastPriceDebug?.summary?.priceSource,
        lastPriceDebug?.dataSource,
        summarySources.length > 0 ? summarySources.join(' + ') : null,
        Array.isArray(lastPriceDebug?.dataSources) && lastPriceDebug.dataSources.length > 0
            ? lastPriceDebug.dataSources.join(' + ')
            : null,
    ];
    const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return resolved || '';
}

// Patch Tag: LB-PRICE-INSPECTOR-20250302A
function refreshPriceInspectorControls() {
    const controls = document.getElementById('priceInspectorControls');
    const openBtn = document.getElementById('openPriceInspector');
    const summaryEl = document.getElementById('priceInspectorSummary');
    if (!controls || !openBtn) return;

    const hasData = Array.isArray(visibleStockData) && visibleStockData.length > 0;
    if (!hasData) {
        controls.classList.add('hidden');
        openBtn.disabled = true;
        if (summaryEl) summaryEl.textContent = '';
        return;
    }

    const modeKey = (lastFetchSettings?.priceMode || (lastFetchSettings?.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const modeLabel = modeKey === 'adjusted' ? '還原價格' : '原始收盤價';
    const lastStartFallback = lastFetchSettings?.effectiveStartDate || lastFetchSettings?.startDate || '';
    const displayData = visibleStockData.length > 0 ? visibleStockData : [];
    const firstDate = displayData[0]?.date || lastStartFallback;
    const lastDate = displayData[displayData.length - 1]?.date || lastFetchSettings?.endDate || '';

    controls.classList.remove('hidden');
    openBtn.disabled = false;
    if (summaryEl) {
        const summaryParts = [`${firstDate} ~ ${lastDate}`, `${displayData.length} 筆 (${modeLabel})`];
        summaryEl.textContent = summaryParts.join(' ・ ');
    }
    renderPricePipelineSteps();
}

function resolveStrategyLookupKey(strategyId, roleHint) {
    if (!strategyId) return strategyId;

    const tryRole = (role) => {
        if (!role || typeof normaliseStrategyIdForRole !== 'function') {
            return null;
        }
        const migrated = normaliseStrategyIdForRole(role, strategyId);
        if (migrated && strategyDescriptions?.[migrated]) {
            return migrated;
        }
        return migrated;
    };

    const primary = tryRole(roleHint);
    if (primary && strategyDescriptions?.[primary]) {
        return primary;
    }

    if (strategyDescriptions?.[strategyId]) {
        return strategyId;
    }

    const rolesToTry = ['exit', 'shortExit', 'shortEntry'];
    for (const role of rolesToTry) {
        if (role === roleHint) continue;
        const migrated = tryRole(role);
        if (migrated && strategyDescriptions?.[migrated]) {
            return migrated;
        }
    }

    if (typeof normaliseStrategyIdAny === 'function') {
        const fallback = normaliseStrategyIdAny(strategyId);
        if (fallback && strategyDescriptions?.[fallback]) {
            return fallback;
        }
        if (fallback) {
            return fallback;
        }
    }

    const exitVariant = `${strategyId}_exit`;
    if (strategyDescriptions?.[exitVariant]) {
        return exitVariant;
    }

    return strategyId;
}

function resolveStrategyDisplayName(key, roleHint) {
    if (!key) return '';
    let lookupKey = key;
    if (typeof resolveStrategyLookupKey === 'function') {
        lookupKey = resolveStrategyLookupKey(key, roleHint) || key;
    }
    const description = strategyDescriptions?.[lookupKey];
    if (description?.name) {
        return description.name;
    }
    if (lookupKey !== key && strategyDescriptions?.[key]?.name) {
        return strategyDescriptions[key].name;
    }
    return lookupKey || key;
}

function collectPriceInspectorIndicatorColumns() {
    if (!lastOverallResult) return [];
    const series = lastIndicatorSeries || {};
    const columns = [];
    const pushColumn = (seriesKey, headerLabel) => {
        const entry = series?.[seriesKey];
        if (entry && Array.isArray(entry.columns) && entry.columns.length > 0) {
            columns.push({ key: seriesKey, header: headerLabel, series: entry });
        }
    };

    pushColumn('longEntry', `多單進場｜${resolveStrategyDisplayName(lastOverallResult.entryStrategy, 'entry')}`);
    pushColumn('longExit', `多單出場｜${resolveStrategyDisplayName(lastOverallResult.exitStrategy, 'exit')}`);
    if (lastOverallResult.enableShorting) {
        pushColumn('shortEntry', `做空進場｜${resolveStrategyDisplayName(lastOverallResult.shortEntryStrategy, 'shortEntry')}`);
        pushColumn('shortExit', `做空出場｜${resolveStrategyDisplayName(lastOverallResult.shortExitStrategy, 'shortExit')}`);
    }
    return columns;
}

function formatIndicatorNumericValue(value, column) {
    if (!Number.isFinite(value)) return '不足';
    if (column?.format === 'integer') {
        return Math.round(value).toLocaleString('zh-TW');
    }
    const digits = typeof column?.decimals === 'number' ? column.decimals : 2;
    return Number(value).toFixed(digits);
}

function renderIndicatorCell(columnGroup, rowIndex) {
    if (!columnGroup || !Array.isArray(columnGroup.columns) || columnGroup.columns.length === 0) {
        return '—';
    }
    const lines = [];
    columnGroup.columns.forEach((col) => {
        const values = Array.isArray(col.values) ? col.values : [];
        const rawValue = values[rowIndex];
        if (col.format === 'text') {
            const textValue = rawValue !== null && rawValue !== undefined && rawValue !== ''
                ? String(rawValue)
                : '—';
            lines.push(`${escapeHtml(col.label)}: ${escapeHtml(textValue)}`);
        } else {
            const formatted = formatIndicatorNumericValue(rawValue, col);
            lines.push(`${escapeHtml(col.label)}: ${formatted}`);
        }
    });
    return lines.length > 0 ? lines.join('<br>') : '—';
}

function formatStageModeLabel(mode, type) {
    if (!mode) return '';
    if (type === 'entry') {
        return mode === 'price_pullback' ? '價格回落加碼' : '策略訊號再觸發';
    }
    if (type === 'exit') {
        return mode === 'price_rally' ? '價格走高分批出場' : '策略訊號再觸發';
    }
    return '';
}

function resolveStageModeDisplay(stageCandidate, stageMode, type) {
    if (stageCandidate && stageCandidate.isSingleFull) {
        return '皆可';
    }
    const explicitLabel = stageMode && typeof stageMode === 'object' && typeof stageMode.label === 'string'
        ? stageMode.label
        : '';
    const modeValue = stageMode && typeof stageMode === 'object' && stageMode.value !== undefined
        ? stageMode.value
        : stageMode;
    const fallbackLabel = formatStageModeLabel(modeValue, type);
    return explicitLabel || fallbackLabel || '—';
}

function renderStageStateCell(state, context) {
    if (!state || typeof state !== 'object') return '—';
    const type = context?.type === 'exit' ? 'exit' : 'entry';
    const parts = [];
    const modeLabel = formatStageModeLabel(state.mode, type);
    if (modeLabel) parts.push(escapeHtml(modeLabel));

    if (type === 'entry') {
        if (Number.isFinite(state.filledStages) && Number.isFinite(state.totalStages)) {
            parts.push(`已進 ${state.filledStages}/${state.totalStages} 段`);
        }
        if (Number.isFinite(state.sharesHeld)) {
            parts.push(`持股 ${state.sharesHeld} 股`);
        }
        if (Number.isFinite(state.averageEntryPrice)) {
            parts.push(`均價 ${state.averageEntryPrice.toFixed(2)}`);
        }
        if (Number.isFinite(state.lastStagePrice)) {
            parts.push(`最新段 ${state.lastStagePrice.toFixed(2)}`);
        }
        if (state.totalStages > state.filledStages) {
            if (state.mode === 'price_pullback' && Number.isFinite(state.nextTriggerPrice)) {
                parts.push(`待觸發：收盤 < ${state.nextTriggerPrice.toFixed(2)}`);
            } else {
                parts.push('待觸發：策略訊號');
            }
        } else if (state.totalStages > 0 && state.filledStages >= state.totalStages) {
            parts.push('已全數進場');
        }
    } else {
        if (Number.isFinite(state.executedStages) && Number.isFinite(state.totalStages)) {
            parts.push(`已出 ${state.executedStages}/${state.totalStages} 段`);
        }
        if (Number.isFinite(state.remainingShares)) {
            parts.push(`剩餘 ${state.remainingShares} 股`);
        }
        if (Number.isFinite(state.lastStagePrice)) {
            parts.push(`最新段 ${state.lastStagePrice.toFixed(2)}`);
        }
        if (state.totalStages > state.executedStages) {
            if (state.mode === 'price_rally' && Number.isFinite(state.nextTriggerPrice)) {
                parts.push(`待觸發：收盤 > ${state.nextTriggerPrice.toFixed(2)}`);
            } else {
                parts.push('待觸發：策略訊號');
            }
        } else if (state.totalStages > 0 && state.executedStages >= state.totalStages) {
            parts.push('已全數出場');
        }
    }

    if (parts.length === 0) return '—';
    return parts.map((part) => escapeHtml(part)).join('<br>');
}

function openPriceInspectorModal() {
    if (!Array.isArray(visibleStockData) || visibleStockData.length === 0) {
        showError('尚未取得價格資料，請先執行回測。');
        return;
    }
    const modal = document.getElementById('priceInspectorModal');
    const tbody = document.getElementById('priceInspectorTableBody');
    const subtitle = document.getElementById('priceInspectorSubtitle');
    if (!modal || !tbody) return;

    const sourceLabel = resolvePriceInspectorSourceLabel();
    const modeKey = (lastFetchSettings?.priceMode || (lastFetchSettings?.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const modeLabel = modeKey === 'adjusted' ? '顯示還原後價格' : '顯示原始收盤價';
    if (subtitle) {
        const marketLabel = (lastFetchSettings?.market || lastFetchSettings?.marketType || currentMarket || 'TWSE').toUpperCase();
        const subtitleParts = [`${modeLabel}`, marketLabel, `${visibleStockData.length} 筆`];
        subtitle.textContent = subtitleParts.join(' ・ ');
    }
    renderPriceInspectorDebug();

    // Patch Tag: LB-PRICE-INSPECTOR-20250512A
    const headerRow = document.getElementById('priceInspectorHeaderRow');
    const indicatorColumns = collectPriceInspectorIndicatorColumns();
    const longEntryStageStates = Array.isArray(lastOverallResult?.longEntryStageStates)
        ? lastOverallResult.longEntryStageStates
        : [];
    const longExitStageStates = Array.isArray(lastOverallResult?.longExitStageStates)
        ? lastOverallResult.longExitStageStates
        : [];
    const baseHeaderConfig = [
        { key: 'date', label: '日期', align: 'left' },
        { key: 'open', label: '開盤', align: 'right' },
        { key: 'high', label: '最高', align: 'right' },
        { key: 'low', label: '最低', align: 'right' },
        { key: 'rawClose', label: '原始收盤', align: 'right' },
        { key: 'close', label: '還原收盤', align: 'right' },
        { key: 'factor', label: '還原因子', align: 'right' },
    ];
    indicatorColumns.forEach((col) => {
        baseHeaderConfig.push({ key: col.key, label: col.header, align: 'left', isIndicator: true, series: col.series });
    });
    baseHeaderConfig.push(
        { key: 'longEntryStage', label: '多單進場分段', align: 'left' },
        { key: 'longExitStage', label: '多單出場分段', align: 'left' },
    );
    baseHeaderConfig.push(
        { key: 'position', label: '倉位狀態', align: 'left' },
        { key: 'formula', label: '計算公式', align: 'left' },
        { key: 'volume', label: '(千股)量', align: 'right' },
        { key: 'source', label: '價格來源', align: 'left' },
    );

    if (headerRow) {
        headerRow.innerHTML = baseHeaderConfig
            .map((cfg) => `<th class="px-3 py-2 text-${cfg.align} font-medium">${escapeHtml(cfg.label)}</th>`)
            .join('');
    }

    const totalColumns = baseHeaderConfig.length;

    const formatNumber = (value, digits = 2) => (Number.isFinite(value) ? Number(value).toFixed(digits) : '—');
    const formatFactor = (value) => (Number.isFinite(value) && value !== 0 ? Number(value).toFixed(6) : '—');
    const computeRawClose = (row) => {
        if (!row) return null;
        const rawCandidates = [
            row.rawClose,
            row.raw_close,
            row.baseClose,
            row.base_close,
        ]
            .map((candidate) => (candidate !== null && candidate !== undefined ? Number(candidate) : null))
            .filter((candidate) => Number.isFinite(candidate));
        if (rawCandidates.length > 0) {
            return rawCandidates[0];
        }
        if (!Number.isFinite(row.close)) return null;
        const factor = Number(row.adjustedFactor);
        if (!Number.isFinite(factor) || Math.abs(factor) < 1e-8) {
            return Number(row.close);
        }
        const raw = Number(row.close) / factor;
        return Number.isFinite(raw) ? raw : Number(row.close);
    };
    const rowsHtml = visibleStockData
        .map((row, rowIndex) => {
            const volumeLabel = Number.isFinite(row?.volume)
                ? Number(row.volume).toLocaleString('zh-TW')
                : '—';
            const factor = Number(row?.adjustedFactor);
            const closeValue = Number(row?.close);
            const rawCloseValue = computeRawClose(row);
            const rawCloseText = formatNumber(rawCloseValue);
            const closeText = formatNumber(closeValue);
            const factorText = formatFactor(factor);
            const hasFactor = Number.isFinite(factor) && Math.abs(factor) > 0;
            let formulaText = '—';
            if (closeText !== '—') {
                if (hasFactor && rawCloseText !== '—' && factorText !== '—') {
                    formulaText = `${rawCloseText} × ${factorText} = ${closeText}`;
                } else {
                    formulaText = `${closeText}（未調整）`;
                }
            }
            const rowSource =
                typeof row?.priceSource === 'string' && row.priceSource.trim().length > 0
                    ? row.priceSource.trim()
                    : sourceLabel || '—';
            const indicatorCells = indicatorColumns
                .map((col) =>
                    `<td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${renderIndicatorCell(col.series, rowIndex)}</td>`
                )
                .join('');
            const entryStageState = longEntryStageStates[rowIndex] || null;
            const exitStageState = longExitStageStates[rowIndex] || null;
            const entryStageCell = renderStageStateCell(entryStageState, { type: 'entry' });
            const exitStageCell = renderStageStateCell(exitStageState, { type: 'exit' });
            const positionLabel = lastPositionStates[rowIndex] || '空手';
            return `
                <tr>
                    <td class="px-3 py-2 whitespace-nowrap" style="color: var(--foreground);">${row?.date || ''}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${formatNumber(row?.open)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${formatNumber(row?.high)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${formatNumber(row?.low)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${rawCloseText}</td>
                    <td class="px-3 py-2 text-right font-medium" style="color: var(--foreground);">${closeText}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--muted-foreground);">${factorText}</td>
                    ${indicatorCells}
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${entryStageCell}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${exitStageCell}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${escapeHtml(positionLabel)}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${escapeHtml(formulaText)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--muted-foreground);">${volumeLabel}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${escapeHtml(rowSource)}</td>
                </tr>`;
        })
        .join('');

    tbody.innerHTML =
        rowsHtml ||
        `<tr><td class="px-3 py-4 text-center" colspan="${totalColumns}" style="color: var(--muted-foreground);">無資料</td></tr>`;

    const scroller = modal.querySelector('.overflow-auto');
    if (scroller) scroller.scrollTop = 0;

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closePriceInspectorModal() {
    const modal = document.getElementById('priceInspectorModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('openPriceInspector');
    const closeBtn = document.getElementById('closePriceInspector');
    const modal = document.getElementById('priceInspectorModal');

    openBtn?.addEventListener('click', openPriceInspectorModal);
    closeBtn?.addEventListener('click', closePriceInspectorModal);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) {
            closePriceInspectorModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closePriceInspectorModal();
        }
    });

    refreshPriceInspectorControls();
});

document.addEventListener('DOMContentLoaded', initDataDiagnosticsPanel);

function handleBacktestResult(result, stockName, dataSource) {
    console.log("[Main] Executing latest version of handleBacktestResult (v2).");
    const suggestionArea = document.getElementById('today-suggestion-area');
    if(!result||!result.dates||result.dates.length===0){
        showError("回測結果無效或無數據");
        lastOverallResult = null; lastSubPeriodResults = null;
        trendAnalysisState.result = null;
        trendAnalysisState.base = null;
        trendAnalysisState.classifiedLabels = [];
        trendAnalysisState.segments = [];
        trendAnalysisState.summary = null;
        trendAnalysisState.calibration = createDefaultTrendSensitivityCalibration();
        trendAnalysisState.thresholds = null;
        renderTrendSummary();
        updateChartTrendOverlay();
        if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
        return;
    }
    try {
        lastOverallResult = result;
        lastSubPeriodResults = result.subPeriodResults;
        lastIndicatorSeries = result.priceIndicatorSeries || null;
        lastPositionStates = Array.isArray(result.positionStates) ? result.positionStates : [];

        const previousTrendResult = trendAnalysisState.result || null;
        const previousTrendBase = trendAnalysisState.base || null;
        trendAnalysisState.result = captureTrendAnalysisSource(result, { previousResult: previousTrendResult });
        trendAnalysisState.base = prepareRegimeBaseData(result, {
            previousBase: previousTrendBase,
            fallbackRawData: trendAnalysisState.result?.rawData || null,
        });
        trendAnalysisState.calibration = calibrateTrendSensitivity(trendAnalysisState.base);
        trendAnalysisState.sensitivity = TREND_SENSITIVITY_DEFAULT;
        recomputeTrendAnalysis({ skipChartUpdate: true });
        const trendSlider = document.getElementById('trendSensitivitySlider');
        if (trendSlider) {
            trendSlider.value = `${trendAnalysisState.sensitivity}`;
        }

        updateDataSourceDisplay(dataSource, stockName);
        displayBacktestResult(result);
        renderPerformanceAnalysis(result);
        displayTradeResults(result);
        renderChart(result);
        updateChartTrendOverlay();
        activateTab('summary');

        setTimeout(() => {
            const rightPanel = document.querySelector('.right-panel');
            if (rightPanel) {
                try {
                    if (typeof rightPanel.scrollTo === 'function') {
                        rightPanel.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                        rightPanel.scrollTop = 0;
                    }
                } catch (panelError) {
                    console.warn('[Main] Failed to reset right panel scroll:', panelError);
                }
            }
            const strategyCard = document.getElementById('strategy-status-card');
            if (strategyCard) {
                try {
                    strategyCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (scrollError) {
                    console.warn('[Main] scrollIntoView for strategy card failed:', scrollError);
                    if (typeof scrollElementIntoViewSmooth === 'function') {
                        scrollElementIntoViewSmooth(strategyCard);
                    }
                }
                return;
            }
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer) {
                try {
                    chartContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (chartScrollError) {
                    console.warn('[Main] scrollIntoView for chart failed:', chartScrollError);
                    if (typeof scrollElementIntoViewSmooth === 'function') {
                        scrollElementIntoViewSmooth(chartContainer);
                    }
                }
            }
        }, 400);

    } catch (error) {
         console.error("[Main] Error processing backtest result:", error);
         showError(`處理回測結果時發生錯誤: ${error.message}`);
         resetStrategyStatusCard('error');
         if (suggestionArea) suggestionArea.classList.add('hidden');
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
        resetStrategyStatusCard('missing');
        el.innerHTML = `<p class="text-gray-500">無效結果</p>`;
        return;
    }
    updateStrategyStatusCard(result);
    const entryKey = resolveStrategyLookupKey(result.entryStrategy, 'entry');
    const exitKey = resolveStrategyLookupKey(result.exitStrategy, 'exit');
    const entryDesc = strategyDescriptions[entryKey] || { name: entryKey || result.entryStrategy || 'N/A', desc: 'N/A' };
    const exitDesc = strategyDescriptions[exitKey] || { name: exitKey || result.exitStrategy || 'N/A', desc: 'N/A' };
    let shortEntryDesc = null;
    let shortExitDesc = null;
    if (result.enableShorting && result.shortEntryStrategy && result.shortExitStrategy) {
        const shortEntryKey = resolveStrategyLookupKey(result.shortEntryStrategy, 'shortEntry');
        const shortExitKey = resolveStrategyLookupKey(result.shortExitStrategy, 'shortExit');
        shortEntryDesc = strategyDescriptions[shortEntryKey] || { name: shortEntryKey || result.shortEntryStrategy, desc: 'N/A' };
        shortExitDesc = strategyDescriptions[shortExitKey] || { name: shortExitKey || result.shortExitStrategy, desc: 'N/A' };
    }
    const avgP = result.completedTrades?.length > 0 ? result.completedTrades.reduce((s, t) => s + (t.profit||0), 0) / result.completedTrades.length : 0; const maxCL = result.maxConsecutiveLosses || 0; const bhR = parseFloat(result.buyHoldReturns?.[result.buyHoldReturns.length - 1] ?? 0); const bhAnnR = result.buyHoldAnnualizedReturn ?? 0; const sharpe = result.sharpeRatio?.toFixed(2) ?? 'N/A'; const sortino = result.sortinoRatio ? (isFinite(result.sortinoRatio) ? result.sortinoRatio.toFixed(2) : '∞') : 'N/A'; const maxDD = result.maxDrawdown?.toFixed(2) ?? 0; const totalTrades = result.tradesCount ?? 0; const winTrades = result.winTrades ?? 0; const winR = totalTrades > 0 ? (winTrades / totalTrades * 100).toFixed(1) : 0; const returnRate = result.returnRate ?? 0; const annualizedReturn = result.annualizedReturn ?? 0; const finalValue = result.finalValue ?? result.initialCapital; const sensitivityData = result.sensitivityAnalysis ?? result.parameterSensitivity ?? result.sensitivityData ?? null; let annReturnRatioStr = 'N/A'; let sharpeRatioStr = 'N/A'; if (result.annReturnHalf1 !== null && result.annReturnHalf2 !== null && result.annReturnHalf1 !== 0) { annReturnRatioStr = (result.annReturnHalf2 / result.annReturnHalf1).toFixed(2); } if (result.sharpeHalf1 !== null && result.sharpeHalf2 !== null && result.sharpeHalf1 !== 0) { sharpeRatioStr = (result.sharpeHalf2 / result.sharpeHalf1).toFixed(2); } const overfittingTooltip = "將回測期間前後對半分，計算兩段各自的總報酬率與夏普值，再計算其比值 (後段/前段)。比值接近 1 較佳，代表策略績效在不同時期較穩定。一般認為 > 0.5 可接受。"; let performanceHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">績效指標</h4>
            <div class="summary-metrics-grid summary-metrics-grid--performance">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">年化報酬率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">將總報酬率根據實際回測期間（從第一個有效數據點到最後一個數據點）轉換為年平均複利報酬率。<br>公式：((最終價值 / 初始本金-固定金額買入)^(1 / 年數) - 1) * 100%<br>注意：此數值對回測時間長度敏感，短期高報酬可能導致極高的年化報酬率。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${annualizedReturn>=0?'text-emerald-600':'text-rose-600'}">${annualizedReturn>=0?'+':''}${annualizedReturn.toFixed(2)}%</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
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
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">總報酬率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">策略最終總資產相對於初始本金-固定金額買入的報酬率。<br>公式：(最終價值 - 初始本金-固定金額買入) / 初始本金-固定金額買入 * 100%<br>此為線性報酬率，不考慮時間因素。</span>
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
            <div class="summary-metrics-grid summary-metrics-grid--risk">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--background)) 0%, color-mix(in srgb, #ef4444 4%, var(--background)) 100%); border-color: color-mix(in srgb, #ef4444 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-rose-600">最大回撤</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">策略**總資金-獲利再投入**曲線從歷史最高點回落到最低點的最大百分比跌幅。公式：(峰值 - 谷值) / 峰值 * 100%</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold text-rose-600">${maxDD}%</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
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
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background:  color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
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
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
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

    // Patch Tag: LB-SENSITIVITY-RENDER-20250724A
    const sensitivityHtml = (() => {
        const data =
            sensitivityData && Array.isArray(sensitivityData.groups) && sensitivityData.groups.length > 0
                ? sensitivityData
                : null;
        const {
            driftStable,
            driftCaution,
            directionSafe,
            directionWatch,
            directionRisk,
            summaryMaxComfort,
            summaryMaxWatch,
        } = ANNUALIZED_SENSITIVITY_THRESHOLDS;
        const tooltipContent =
            `參考 QuantConnect、Portfolio123 等國外回測平臺的 Parameter Sensitivity 規範：<br>1. 穩定度分數 ≥ 70：±10% 調整下的年化報酬漂移通常低於 ${driftCaution}pp，策略抗震。<br>2. 40 ~ 69：建議再進行樣本延伸或優化驗證。<br>3. < 40：代表策略對參數高度敏感，常見於過擬合案例。<br><br>PP（百分點）代表回報率絕對差值：調整後報酬 − 基準報酬。`;
        const headerHtml = `
        <div class="flex items-center mb-6">
            <h4 class="text-lg font-semibold" style="color: var(--foreground);">敏感度分析</h4>
            <span class="tooltip ml-2">
                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                <span class="tooltiptext">${tooltipContent}</span>
            </span>
        </div>`;
        if (!data) {
            return `
        <div class="mb-8">
            ${headerHtml}
            <div class="p-6 rounded-xl border shadow-sm" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 70%, transparent);">
                <p class="text-sm" style="color: var(--muted-foreground);">此策略的參數未提供可量化的敏感度資訊，或計算時發生例外，暫無結果可顯示。</p>
            </div>
        </div>`;
        }
        const formatPercentMagnitude = (value, digits = 1) => {
            if (!Number.isFinite(value)) return '—';
            return `${Math.abs(value).toFixed(digits)}%`;
        };
        const formatDelta = (value) => {
            if (!Number.isFinite(value)) return '—';
            return `${value >= 0 ? '+' : ''}${value.toFixed(2)}pp`;
        };
        const formatSharpeDelta = (value) => {
            if (!Number.isFinite(value)) return '—';
            return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
        };
        const formatScore = (value) => {
            if (!Number.isFinite(value)) return '—';
            return Math.round(value);
        };
        const formatParamValue = (value) => {
            if (!Number.isFinite(value)) return '—';
            if (Number.isInteger(value)) return value.toString();
            return value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
        };
        const scoreClass = (value) => {
            if (!Number.isFinite(value)) return 'text-muted-foreground';
            if (value >= 80) return 'text-emerald-600';
            if (value >= 60) return 'text-amber-500';
            return 'text-rose-600';
        };
        const driftClass = (value) => {
            if (!Number.isFinite(value)) return 'text-muted-foreground';
            const abs = Math.abs(value);
            if (abs <= driftStable) return 'text-emerald-600';
            if (abs <= driftCaution) return 'text-amber-500';
            return 'text-rose-600';
        };
        const baselineMetrics = {
            returnRate: Number.isFinite(data?.baseline?.returnRate) ? data.baseline.returnRate : null,
            annualizedReturn: Number.isFinite(data?.baseline?.annualizedReturn)
                ? data.baseline.annualizedReturn
                : Number.isFinite(data?.baseline?.returnRate)
                    ? data.baseline.returnRate
                    : null,
            sharpeRatio: Number.isFinite(data?.baseline?.sharpeRatio) ? data.baseline.sharpeRatio : null,
        };
        const renderScenarioChip = (scenario) => {
            if (!scenario) {
                return `<div class="sensitivity-scenario-chip sensitivity-scenario-chip--empty">—</div>`;
            }
            const label = escapeHtml(scenario.label || '變動');
            const directionIcon = scenario.direction === 'decrease' ? '▼' : '▲';
            const badge = scenario.type === 'absolute' ? 'Δ' : '%';
            if (!scenario.run) {
                const status = scenario.error ? '計算失敗' : '無結果';
                return `<div class="sensitivity-scenario-chip sensitivity-scenario-chip--empty">
                    <div class="sensitivity-scenario-chip__header">
                        <span class="sensitivity-scenario-chip__label">${directionIcon} ${label}<span class="sensitivity-scenario-chip__badge">${badge}</span></span>
                    </div>
                    <p class="sensitivity-scenario-chip__empty">${status}</p>
                </div>`;
            }
            const scenarioAnnualized = Number.isFinite(scenario?.run?.annualizedReturn)
                ? scenario.run.annualizedReturn
                : Number.isFinite(scenario?.run?.returnRate)
                    ? scenario.run.returnRate
                    : null;
            const baselineAnnualized = Number.isFinite(baselineMetrics.annualizedReturn)
                ? baselineMetrics.annualizedReturn
                : null;
            const computedDelta = baselineAnnualized !== null && scenarioAnnualized !== null
                ? scenarioAnnualized - baselineAnnualized
                : (Number.isFinite(scenario.deltaReturn) ? scenario.deltaReturn : null);
            const deltaText = formatDelta(computedDelta);
            const driftText = formatPercentMagnitude(scenario.driftPercent, 1);
            const sharpeText = formatSharpeDelta(scenario.deltaSharpe);
            const deltaCls = Number.isFinite(computedDelta)
                ? (computedDelta >= 0 ? 'text-emerald-600' : 'text-rose-600')
                : 'text-muted-foreground';
            const driftCls = driftClass(scenario.driftPercent);
            const returnText = formatPercentSigned(scenarioAnnualized ?? NaN, 2);
            const baselineReturnText = formatPercentSigned(baselineAnnualized ?? NaN, 2);
            const ppTooltip = `PP（百分點）= 調整後年化報酬 (${returnText}) − 基準年化報酬 (${baselineReturnText})。`;
            const sharpeBase = Number.isFinite(baselineMetrics.sharpeRatio)
                ? `（基準 Sharpe ${baselineMetrics.sharpeRatio.toFixed(2)}）`
                : '';
            const tooltipContent = [
                `調整值：${formatParamValue(scenario.value)}`,
                `回報：${returnText}`,
                ppTooltip,
                `漂移：${driftText}`,
                `Sharpe Δ：${sharpeText}${sharpeBase}`
            ].join('<br>');
            return `<div class="sensitivity-scenario-chip tooltip">
                <div class="sensitivity-scenario-chip__header">
                    <span class="sensitivity-scenario-chip__label">${directionIcon} ${label}<span class="sensitivity-scenario-chip__badge">${badge}</span></span>
                    <span class="sensitivity-scenario-chip__delta ${deltaCls}">${deltaText}</span>
                </div>
                <div class="sensitivity-scenario-chip__metrics">
                    <span class="${driftCls}">漂移 ${driftText}</span>
                    <span class="text-[11px]" style="color: var(--muted-foreground);">Sharpe ${sharpeText}</span>
                </div>
                <span class="tooltiptext tooltiptext--sensitivity">${tooltipContent}</span>
            </div>`;
        };
        const renderDirectionalCell = (param) => {
            const positiveText = formatDelta(param.positiveDriftPercent);
            const negativeText = formatDelta(param.negativeDriftPercent);
            const positiveCls = Number.isFinite(param.positiveDriftPercent) ? 'text-emerald-600' : 'text-muted-foreground';
            const negativeCls = Number.isFinite(param.negativeDriftPercent) ? 'text-rose-600' : 'text-muted-foreground';
            return `<div class="sensitivity-direction-cell">
                <div class="sensitivity-direction-cell__item">
                    <span class="sensitivity-direction-cell__icon sensitivity-direction-cell__icon--up">▲</span>
                    <span class="sensitivity-direction-cell__value ${positiveCls}">${positiveText}</span>
                </div>
                <div class="sensitivity-direction-cell__item">
                    <span class="sensitivity-direction-cell__icon sensitivity-direction-cell__icon--down">▼</span>
                    <span class="sensitivity-direction-cell__value ${negativeCls}">${negativeText}</span>
                </div>
            </div>`;
        };
        const renderGroup = (group) => {
            const params = Array.isArray(group.parameters) ? group.parameters : [];
            if (params.length === 0) return '';
            const groupAvgDriftValues = params
                .map((item) => (Number.isFinite(item.averageDriftPercent) ? item.averageDriftPercent : null))
                .filter((value) => value !== null);
            const computedGroupAvgDrift = groupAvgDriftValues.length > 0
                ? groupAvgDriftValues.reduce((sum, cur) => sum + cur, 0) / groupAvgDriftValues.length
                : null;
            const groupScoreValues = params
                .map((item) => (Number.isFinite(item.stabilityScore) ? item.stabilityScore : null))
                .filter((value) => value !== null);
            const computedGroupScore = groupScoreValues.length > 0
                ? groupScoreValues.reduce((sum, cur) => sum + cur, 0) / groupScoreValues.length
                : null;
            const groupMaxValues = params
                .map((item) => (Number.isFinite(item.maxDriftPercent) ? item.maxDriftPercent : null))
                .filter((value) => value !== null);
            const computedGroupMaxDrift = groupMaxValues.length > 0 ? Math.max(...groupMaxValues) : null;
            const groupPositiveValues = params
                .map((item) => (Number.isFinite(item.positiveDriftPercent) ? item.positiveDriftPercent : null))
                .filter((value) => value !== null);
            const computedGroupPositive = groupPositiveValues.length > 0
                ? groupPositiveValues.reduce((sum, cur) => sum + cur, 0) / groupPositiveValues.length
                : null;
            const groupNegativeValues = params
                .map((item) => (Number.isFinite(item.negativeDriftPercent) ? item.negativeDriftPercent : null))
                .filter((value) => value !== null);
            const computedGroupNegative = groupNegativeValues.length > 0
                ? groupNegativeValues.reduce((sum, cur) => sum + cur, 0) / groupNegativeValues.length
                : null;
            const groupAvgDrift = Number.isFinite(group.averageDriftPercent)
                ? group.averageDriftPercent
                : computedGroupAvgDrift;
            const groupScore = Number.isFinite(group.stabilityScore)
                ? group.stabilityScore
                : computedGroupScore;
            const groupMaxDrift = Number.isFinite(group.maxDriftPercent)
                ? group.maxDriftPercent
                : computedGroupMaxDrift;
            const groupPositive = Number.isFinite(group.positiveDriftPercent)
                ? group.positiveDriftPercent
                : computedGroupPositive;
            const groupNegative = Number.isFinite(group.negativeDriftPercent)
                ? group.negativeDriftPercent
                : computedGroupNegative;
            const scenarioSamples = params.reduce((sum, param) => sum + (param.scenarioCount || 0), 0);
            const strategyKey = group.strategy || '';
            const strategyInfo = strategyDescriptions[strategyKey] || { name: strategyKey };
            const rowPairs = params.map((param) => {
                const driftCls = driftClass(param.averageDriftPercent);
                const driftValue = formatPercentMagnitude(param.averageDriftPercent, 1);
                const maxValue = formatPercentMagnitude(param.maxDriftPercent, 1);
                const scoreCls = scoreClass(param.stabilityScore);
                const scoreValue = formatScore(param.stabilityScore);
                const baseValueText = formatParamValue(param.baseValue);
                const scenarioHtml = Array.isArray(param.scenarios)
                    ? param.scenarios.map((scenario) => renderScenarioChip(scenario)).join('')
                    : '';
                const scenarioGrid = `<div class="sensitivity-scenario-grid">${scenarioHtml || '<div class="sensitivity-scenario-chip sensitivity-scenario-chip--empty">—</div>'}</div>`;
                const scenarioCountText = Number.isFinite(param.scenarioCount) && param.scenarioCount > 0
                    ? `<p class="sensitivity-scenario-count">樣本 ${param.scenarioCount}</p>`
                    : '';
                const tableRow = `<tr class="border-t" style="border-color: var(--border);">
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${escapeHtml(param.name)}</td>
                    <td class="px-3 py-2 text-center" style="color: var(--foreground);">${baseValueText}</td>
                    <td class="px-3 py-2">
                        <div class="sensitivity-scenario-cell">
                            ${scenarioGrid}
                            ${scenarioCountText}
                        </div>
                    </td>
                    <td class="px-3 py-2 text-center">
                        <span class="text-sm font-semibold ${driftCls}">${driftValue}</span>
                        <p class="text-[11px]" style="color: var(--muted-foreground);">平均漂移</p>
                    </td>
                    <td class="px-3 py-2 text-center">
                        <span class="text-sm font-semibold ${driftClass(param.maxDriftPercent)}">${maxValue}</span>
                        <p class="text-[11px]" style="color: var(--muted-foreground);">最大偏移</p>
                    </td>
                    <td class="px-3 py-2 text-center">${renderDirectionalCell(param)}</td>
                    <td class="px-3 py-2 text-center">
                        <span class="text-sm font-semibold ${scoreCls}">${scoreValue}</span>
                        <p class="text-[11px]" style="color: var(--muted-foreground);">滿分 100</p>
                    </td>
                </tr>`;
                const mobileRow = `<div class="sensitivity-mobile-row">
                    <div class="sensitivity-mobile-header">
                        <span class="sensitivity-mobile-param">${escapeHtml(param.name)}</span>
                        <span class="sensitivity-mobile-base">基準值 ${baseValueText}</span>
                    </div>
                    <div class="sensitivity-mobile-section">
                        <p class="sensitivity-mobile-label">擾動網格</p>
                        <div class="sensitivity-mobile-grid">${scenarioGrid}</div>
                        ${scenarioCountText}
                    </div>
                    <div class="sensitivity-mobile-metrics sensitivity-mobile-metrics--grid">
                        <div>
                            <p class="sensitivity-mobile-label">平均漂移</p>
                            <span class="text-sm font-semibold ${driftCls}">${driftValue}</span>
                        </div>
                        <div>
                            <p class="sensitivity-mobile-label">最大偏移</p>
                            <span class="text-sm font-semibold ${driftClass(param.maxDriftPercent)}">${maxValue}</span>
                        </div>
                        <div>
                            <p class="sensitivity-mobile-label">方向偏移</p>
                            ${renderDirectionalCell(param)}
                        </div>
                        <div>
                            <p class="sensitivity-mobile-label">穩定度</p>
                            <span class="text-sm font-semibold ${scoreCls}">${scoreValue}</span>
                            <p class="text-[11px]" style="color: var(--muted-foreground);">滿分 100</p>
                        </div>
                    </div>
                </div>`;
                return { tableRow, mobileRow };
            });
            const tableRows = rowPairs.map((row) => row.tableRow).join('');
            const mobileRows = rowPairs.map((row) => row.mobileRow).join('');
            return `<div class="sensitivity-card p-6 rounded-xl border shadow-sm" style="background: color-mix(in srgb, var(--muted) 8%, var(--background)); border-color: color-mix(in srgb, var(--border) 70%, transparent);">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                        <p class="text-sm font-semibold" style="color: var(--foreground);">${escapeHtml(group.label)}</p>
                        <p class="text-xs" style="color: var(--muted-foreground);">策略：${escapeHtml(strategyInfo.name || String(strategyKey || 'N/A'))}</p>
                    </div>
                    <div class="flex items-center gap-4 flex-wrap">
                        <div class="text-right">
                            <p class="text-[11px]" style="color: var(--muted-foreground);">平均漂移</p>
                            <p class="text-base font-semibold ${driftClass(groupAvgDrift)}">${formatPercentMagnitude(groupAvgDrift, 1)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[11px]" style="color: var(--muted-foreground);">最大偏移</p>
                            <p class="text-base font-semibold ${driftClass(groupMaxDrift)}">${formatPercentMagnitude(groupMaxDrift, 1)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[11px]" style="color: var(--muted-foreground);">平均穩定度</p>
                            <p class="text-base font-semibold ${scoreClass(groupScore)}">${formatScore(groupScore)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[11px]" style="color: var(--muted-foreground);">偏移方向</p>
                            <p class="text-sm font-semibold" style="color: var(--foreground);">▲ ${formatDelta(groupPositive)}／▼ ${formatDelta(groupNegative)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[11px]" style="color: var(--muted-foreground);">擾動樣本</p>
                            <p class="text-base font-semibold" style="color: var(--foreground);">${scenarioSamples}</p>
                        </div>
                    </div>
                </div>
                <div class="sensitivity-table-wrapper">
                    <table class="sensitivity-table-desktop w-full text-xs">
                        <thead>
                            <tr class="bg-white/40" style="color: var(--muted-foreground);">
                                <th class="px-3 py-2 text-left font-medium">參數</th>
                                <th class="px-3 py-2 text-center font-medium">基準值</th>
                                <th class="px-3 py-2 text-center font-medium">
                                    <span class="inline-flex items-center justify-center gap-1">
                                        擾動網格
                                        <span class="tooltip">
                                            <span class="info-icon inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                            <span class="tooltiptext tooltiptext--sensitivity">針對該參數套用 ±5%、±10%、±20% 及步階調整等多個擾動樣本，觀察報酬與 Sharpe 的變化。</span>
                                        </span>
                                    </span>
                                </th>
                                <th class="px-3 py-2 text-center font-medium">平均漂移</th>
                                <th class="px-3 py-2 text-center font-medium">最大偏移</th>
                                <th class="px-3 py-2 text-center font-medium">方向偏移</th>
                                <th class="px-3 py-2 text-center font-medium">穩定度</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="sensitivity-table-mobile">
                        ${mobileRows}
                    </div>
                </div>
            </div>`;
        };
        const overallScore = data?.summary?.stabilityScore ?? null;
        const overallDrift = data?.summary?.averageDriftPercent ?? null;
        const overallMaxDrift = data?.summary?.maxDriftPercent ?? null;
        const overallPositive = data?.summary?.positiveDriftPercent ?? null;
        const overallNegative = data?.summary?.negativeDriftPercent ?? null;
        const overallSamples = data?.summary?.scenarioCount ?? null;
        const summarySharpeDrop = Number.isFinite(data?.summary?.averageSharpeDrop)
            ? data.summary.averageSharpeDrop
            : null;
        const summarySharpeGain = Number.isFinite(data?.summary?.averageSharpeGain)
            ? data.summary.averageSharpeGain
            : null;
        const stabilityComponents = data?.summary?.stabilityComponents || null;
        const stabilityDriftPenalty = Number.isFinite(stabilityComponents?.driftPenalty)
            ? stabilityComponents.driftPenalty
            : null;
        const stabilitySharpePenalty = Number.isFinite(stabilityComponents?.sharpePenalty)
            ? stabilityComponents.sharpePenalty
            : null;
        const driftPenaltyBand = stabilityComponents?.driftPenaltyBand || null;
        const { comfortPenaltyMax, cautionPenaltyMax, overflowPenaltySlope } = ANNUALIZED_SENSITIVITY_SCORING;
        const stabilityTooltipLines = [
            '穩定度分數 = 100 − 漂移扣分 − Sharpe 下滑懲罰。',
            `漂移扣分：平均漂移 ≤ ${driftStable}pp 約 0～${comfortPenaltyMax} 分；${driftStable}～${driftCaution}pp 線性放大到 ${cautionPenaltyMax} 分；超過 ${driftCaution}pp 每多 1pp 再扣 ${overflowPenaltySlope} 分（最多扣到 100 分）。`,
            Number.isFinite(stabilityDriftPenalty)
                ? `漂移扣分：約 ${stabilityDriftPenalty.toFixed(1)} 分${driftPenaltyBand ? `（${resolveDriftPenaltyBandLabel(driftPenaltyBand, driftStable, driftCaution)}）` : ''}`
                : null,
            Number.isFinite(summarySharpeDrop) && Number.isFinite(stabilitySharpePenalty)
                ? `平均 Sharpe 下滑 ${(-summarySharpeDrop).toFixed(2)} → 扣分 ${stabilitySharpePenalty.toFixed(1)} 分`
                : Number.isFinite(summarySharpeDrop)
                    ? `平均 Sharpe 下滑 ${(-summarySharpeDrop).toFixed(2)}，每下降 0.01 約扣 1 分`
                    : null,
            '分數 ≥ 70 視為穩健；40～69 建議延長樣本，<40 則需謹慎。'
        ].filter(Boolean);
        const stabilityTooltip = stabilityTooltipLines.join('<br>');

        const stabilityStageHint = (() => {
            if (!Number.isFinite(overallScore)) {
                return '資料仍不足，等待更多擾動樣本。';
            }
            if (overallScore >= 70) {
                return '穩定度穩健';
            }
            if (overallScore >= 40) {
                return '建議延長測試區間';
            }
            return '策略穩定度不佳';
        })();
        let directionSafeTooltip = null;
        const directionAdvice = (() => {
            const positiveAbs = Number.isFinite(overallPositive) ? Math.abs(overallPositive) : null;
            const negativeAbs = Number.isFinite(overallNegative) ? Math.abs(overallNegative) : null;
            if (positiveAbs === null && negativeAbs === null) {
                return '樣本還不夠，暫時看不出調高或調低的差別。';
            }
            const dominantDirection = positiveAbs !== null && (negativeAbs === null || positiveAbs >= negativeAbs)
                ? '調高'
                : '調低';
            const dominantAbs = dominantDirection === '調高' ? positiveAbs : negativeAbs;
            if (dominantAbs !== null && dominantAbs <= directionSafe && (dominantDirection === '調高'
                ? (negativeAbs === null || negativeAbs <= directionSafe)
                : (positiveAbs === null || positiveAbs <= directionSafe))) {
                directionSafeTooltip = `兩側平均偏移都在 ±${directionSafe}pp 內，方向調整相對安全。`;
                return '兩側偏移都不大，照現在的節奏繼續跑即可。';
            }
            if (dominantAbs !== null && dominantAbs > directionRisk) {
                return `${dominantDirection}側平均偏移超過 ${directionRisk}pp，請優先針對該方向調整風控或做批量優化。`;
            }
            if (dominantAbs !== null && dominantAbs > directionWatch) {
                return `${dominantDirection}側平均偏移落在 ${directionWatch}～${directionRisk}pp，建議多補樣本再做方向驗證。`;
            }
            const formattedDominant = Number.isFinite(dominantAbs) ? dominantAbs.toFixed(1) : '—';
            return `${dominantDirection}側平均偏移約 ${formattedDominant}pp，維持觀察節奏即可。`;
        })();
        const summarySentence = (() => {
            const stabilityScore = Number.isFinite(overallScore) ? overallScore : null;
            const driftAbs = Number.isFinite(overallDrift) ? Math.abs(overallDrift) : null;
            const maxAbs = Number.isFinite(overallMaxDrift) ? Math.abs(overallMaxDrift) : null;
            if (stabilityScore === null && driftAbs === null && maxAbs === null) {
                return '樣本不足，先補完擾動測試再回來看結論。';
            }
            if (stabilityScore !== null && stabilityScore >= 75 && (driftAbs === null || driftAbs <= driftStable) && (maxAbs === null || maxAbs <= summaryMaxComfort)) {
                return '整體偏移小又穩，維持原參數觀察即可。';
            }
            if (stabilityScore !== null && stabilityScore >= 55 && (driftAbs === null || driftAbs <= driftCaution) && (maxAbs === null || maxAbs <= summaryMaxWatch)) {
                return '漂移開始放大，搭配分段風控或拉長觀察期會更安心。';
            }
            return '漂移明顯偏大，先縮小部位並重新檢視參數設定。';
        })();
        const directionTooltipHtml = directionSafeTooltip
            ? `<span class="tooltip"><span class="info-icon inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span><span class="tooltiptext tooltiptext--sensitivity">${directionSafeTooltip}</span></span>`
            : '';
        const summaryCards = `
            <div class="summary-metrics-grid summary-metrics-grid--sensitivity mb-6">
                <div class="p-6 rounded-xl border shadow-sm" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="flex flex-col items-center text-center gap-3">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">穩定度分數</p>
                            <span class="tooltip">
                                <span class="info-icon inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext tooltiptext--sensitivity">${stabilityTooltip}</span>
                            </span>
                        </div>
                        <p class="text-3xl font-bold ${scoreClass(overallScore)}">${formatScore(overallScore)}</p>
                        <p class="text-xs" style="color: var(--muted-foreground); line-height: 1.6;">${stabilityStageHint}</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm" style="background: linear-gradient(135deg, color-mix(in srgb, var(--secondary) 8%, var(--background)) 0%, color-mix(in srgb, var(--secondary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--secondary) 25%, transparent);">
                    <div class="flex flex-col items-center text-center gap-3">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">平均漂移幅度</p>
                            <span class="tooltip">
                                <span class="info-icon inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext tooltiptext--sensitivity">平均漂移 = 各擾動樣本的年化報酬差異絕對值平均。<br><strong>&le; ${driftStable}pp</strong>：偏移小，策略較穩健。<br><strong>${driftStable}～${driftCaution}pp</strong>：建議延長樣本或用批量優化比對不同視窗。<br><strong>&gt; ${driftCaution}pp</strong>：對參數相當敏感，需特別留意過擬合。</span>
                            </span>
                        </div>
                        <p class="text-3xl font-bold ${driftClass(overallDrift)}">${formatPercentMagnitude(overallDrift, 1)}</p>
                        <div class="text-xs text-muted-foreground leading-relaxed flex flex-col items-center gap-1">
                            <span>最大偏移 ${formatPercentMagnitude(overallMaxDrift, 1)}</span>
                            <span>樣本數 ${Number.isFinite(overallSamples) ? overallSamples : '—'}</span>
                        </div>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm" style="background: linear-gradient(135deg, color-mix(in srgb, #60a5fa 10%, var(--background)) 0%, color-mix(in srgb, #3b82f6 4%, var(--background)) 100%); border-color: color-mix(in srgb, #3b82f6 20%, transparent);">
                    <div class="flex flex-col items-center text-center gap-3">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">偏移方向 (平均)</p>
                            ${directionTooltipHtml}
                        </div>
                        <div class="flex items-center justify-center gap-4 text-lg font-semibold">
                            <span class="text-emerald-600">▲ ${formatDelta(overallPositive)}</span>
                            <span class="text-rose-600">▼ ${formatDelta(overallNegative)}</span>
                        </div>
                        <p class="text-xs" style="color: var(--muted-foreground); line-height: 1.6;">${directionAdvice}</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm" style="background: linear-gradient(135deg, color-mix(in srgb, var(--muted) 10%, var(--background)) 0%, color-mix(in srgb, var(--muted) 6%, var(--background)) 100%); border-color: color-mix(in srgb, var(--border) 70%, transparent);">
                    <div class="flex flex-col items-center text-center gap-3">
                        <p class="text-sm font-medium" style="color: var(--muted-foreground);">敏感度摘要提醒</p>
                        <p class="text-xs" style="color: var(--muted-foreground); line-height: 1.6;">${summarySentence}</p>
                    </div>
                </div>
            </div>`;
        const interpretationHint = `
            <div class="p-4 rounded-xl border" style="background: color-mix(in srgb, var(--muted) 10%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                <div class="flex items-start gap-3">
                    <span class="info-icon inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full" style="background-color: var(--primary); color: var(--primary-foreground);">i</span>
                    <div>
                        <p class="text-sm font-semibold mb-2" style="color: var(--foreground);">如何解讀敏感度結果</p>
                        <ul style="margin: 0; padding-left: 1.1rem; color: var(--muted-foreground); font-size: 12px; line-height: 1.6; list-style: disc;">
                            <li><strong>PP（百分點）</strong>：調整後報酬率與原始回測報酬率的差異，正值代表績效提升，負值代表下滑。</li>
                            <li><strong>擾動網格</strong>：同時觀察比例（±5%、±10%、±20%）與整數步階調整，快速找出最敏感的方向與幅度。</li>
                            <li><strong>漂移幅度</strong>：所有擾動樣本的報酬偏移絕對值平均，越小代表策略對參數較不敏感。</li>
                            <li><strong>最大偏移</strong>：所有樣本中偏離最大的情境，可視為「最糟／最佳」的幅度參考。</li>
                            <li><strong>偏移方向</strong>：比較調高（▲）與調低（▼）的平均 PP，雙側落在 ±${directionSafe}pp 內屬於常見穩健區間，超過 ${directionRisk}pp 則建議針對該方向再驗證。</li>
                            <li><strong>穩定度分數</strong>：以 100 分為滿分，計算式為 100 − 平均漂移（%） − Sharpe 下滑懲罰（平均下滑 × 100，上限 40 分）。≥ 70 為穩健；40～69 建議延長樣本；< 40 需謹慎。</li>
                            <li><strong>Sharpe Δ</strong>：調整後 Sharpe 與基準 Sharpe 的差值；若下調幅度超過 0.10，代表風險調整報酬明顯惡化，建議強化風控或調整參數。</li>
                        </ul>
                    </div>
                </div>
            </div>`;
        const groupsHtml = data.groups.map((group) => renderGroup(group)).filter(Boolean).join('');
        const groupSection = groupsHtml || `<div class="p-6 rounded-xl border shadow-sm" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 70%, transparent);">
                <p class="text-sm" style="color: var(--muted-foreground);">偵測到的參數皆為非數值型或結果不完整，暫無敏感度表格可供顯示。</p>
            </div>`;
        return `
        <div class="mb-8">
            ${headerHtml}
            ${summaryCards}
            <div class="sensitivity-collapse-controls flex justify-end mt-4">
                <button type="button" class="sensitivity-collapse-toggle inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 border rounded-full" data-sensitivity-toggle aria-expanded="false" style="border-color: color-mix(in srgb, var(--border) 70%, transparent); color: color-mix(in srgb, var(--foreground) 88%, var(--muted-foreground)); background: color-mix(in srgb, var(--background) 95%, transparent);">
                    <span class="toggle-indicator">＋</span>
                    <span class="toggle-label">展開敏感度表格</span>
                </button>
            </div>
            <div class="space-y-4 sensitivity-collapse-body hidden" data-sensitivity-body aria-hidden="true">
                ${interpretationHint}
                ${groupSection}
            </div>
        </div>`;
    })();
    let tradeStatsHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">交易統計</h4>
            <div class="summary-metrics-grid summary-metrics-grid--trade">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
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
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
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
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">平均交易盈虧</p>
                        <p class="text-2xl font-bold ${avgP>=0?'text-emerald-600':'text-rose-600'}">${avgP>=0?'+':''}${Math.round(avgP).toLocaleString()}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">元</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
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
            <div class="summary-metrics-grid summary-metrics-grid--strategy">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
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
                </div>
                ${ result.enableShorting && shortEntryDesc && shortExitDesc ? `                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
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
                        <p class="text-sm text-blue-600 font-medium mb-3">💰 初始本金-固定金額買入</p>
                        <p class="text-base font-semibold text-gray-800">${result.initialCapital.toLocaleString()}元</p>
                    </div>
                </div>
                <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-yellow-600 font-medium mb-3">🏆 最終資產</p>
                        <p class="text-base font-semibold text-gray-800">${Math.round(finalValue).toLocaleString()}元</p>
                    </div>
                </div>
            </div>
        </div>`;

        // 將四個區塊垂直排列，並添加適當的間距
        el.innerHTML = `
            <div class="space-y-8">
                ${performanceHtml}
                ${riskHtml}
                ${sensitivityHtml}
                ${tradeStatsHtml}
                ${strategySettingsHtml}
            </div>
        `;

        initSensitivityCollapse(el);

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
                [TREND_BACKGROUND_PLUGIN_ID]: {
                    segments: resolveTrendOverlaySegments(),
                },
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
    
    const curSettings={
        stockNo: params.stockNo,
        startDate: params.startDate,
        endDate: params.endDate,
        market: (params.market || params.marketType || currentMarket || 'TWSE').toUpperCase(),
        adjustedPrice: Boolean(params.adjustedPrice),
        priceMode: (params.priceMode || (params.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toLowerCase(),
    };
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
        
        if(useCache && cachedStockData) {
            workerMsg.cachedData=cachedStockData;
            const cacheEntry = ensureDatasetCacheEntryFresh(
                buildCacheKey(curSettings),
                cachedDataStore.get(buildCacheKey(curSettings)),
                curSettings.market,
            );
                if (cacheEntry) {
                    workerMsg.cachedMeta = {
                        summary: cacheEntry.summary || null,
                        adjustments: Array.isArray(cacheEntry.adjustments) ? cacheEntry.adjustments : [],
                        debugSteps: Array.isArray(cacheEntry.debugSteps) ? cacheEntry.debugSteps : [],
                        adjustmentFallbackApplied: Boolean(cacheEntry.adjustmentFallbackApplied),
                        priceSource: cacheEntry.priceSource || null,
                        dataSource: cacheEntry.dataSource || null,
                        splitAdjustment: Boolean(cacheEntry.splitAdjustment),
                        splitDiagnostics: cacheEntry.splitDiagnostics || null,
                        finmindStatus: cacheEntry.finmindStatus || null,
                    };
                }
        } else console.log(`[Main] Fetching data for ${optimizeType} opt.`);
        
        optimizationWorker.postMessage(workerMsg); 
        
        optimizationWorker.onmessage=e=>{ 
            const{type,data,progress,message}=e.data; 
            
            if(type==='progress'){
                // 使用優化專用的進度更新
                updateOptimizationProgress(progress, message);
            } else if(type==='result'){ 
                if(!useCache&&data?.rawDataUsed){
                    cachedStockData=data.rawDataUsed;
                    if (Array.isArray(data.rawDataUsed)) {
                        setVisibleStockData(data.rawDataUsed);
                    }
                    lastFetchSettings={ ...curSettings };
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
const stagingOptimizationState = {
    running: false,
    results: [],
    bestResult: null,
    combinations: [],
};

function formatStagePercentages(values) {
    if (!Array.isArray(values) || values.length === 0) return '—';
    return values
        .map((val) => {
            if (!Number.isFinite(val)) return '0%';
            const rounded = Number.parseFloat(val.toFixed(2));
            if (Math.abs(rounded) < 0.01) return '0%';
            if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
                return `${Math.round(rounded)}%`;
            }
            return `${rounded.toFixed(2)}%`;
        })
        .join(' / ');
}

function scaleStageWeights(base, weights) {
    if (!Array.isArray(weights) || weights.length === 0) return [];
    const sanitizedWeights = weights
        .map((weight) => Number.parseFloat(weight))
        .filter((weight) => Number.isFinite(weight) && weight > 0);
    if (sanitizedWeights.length === 0) return [];
    if (!Number.isFinite(base) || base <= 0) {
        return sanitizedWeights.map((value) => Number.parseFloat(value.toFixed(2)));
    }
    const totalWeight = sanitizedWeights.reduce((sum, weight) => sum + weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) return [];
    const scaled = [];
    let allocated = 0;
    sanitizedWeights.forEach((weight, index) => {
        let value = (base * weight) / totalWeight;
        value = Number.isFinite(value) ? value : 0;
        value = Number.parseFloat(value.toFixed(2));
        if (value <= 0) {
            value = Number.parseFloat((base / sanitizedWeights.length).toFixed(2));
        }
        if (index === sanitizedWeights.length - 1) {
            value = Number.parseFloat((base - allocated).toFixed(2));
        }
        allocated = Number.parseFloat((allocated + value).toFixed(2));
        scaled.push(Math.max(value, 0.1));
    });
    const scaledTotal = scaled.reduce((sum, val) => sum + val, 0);
    const diff = Number.parseFloat((base - scaledTotal).toFixed(2));
    if (Math.abs(diff) >= 0.01 && scaled.length > 0) {
        const lastIndex = scaled.length - 1;
        const adjusted = Number.parseFloat((scaled[lastIndex] + diff).toFixed(2));
        scaled[lastIndex] = Math.max(adjusted, 0.1);
    }
    return scaled.map((val) => Number.parseFloat(val.toFixed(2)));
}

function normalizeStageValues(values, base) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const sanitized = values
        .map((val) => Number.parseFloat(val))
        .filter((val) => Number.isFinite(val) && val > 0);
    if (sanitized.length === 0) return [];
    if (!Number.isFinite(base) || base <= 0) {
        return sanitized.map((val) => Number.parseFloat(val.toFixed(2)));
    }
    const total = sanitized.reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - base) < 0.01) {
        return sanitized.map((val) => Number.parseFloat(val.toFixed(2)));
    }
    return scaleStageWeights(base, sanitized);
}

function dedupeStageCandidates(candidates) {
    const map = new Map();
    candidates.forEach((candidate) => {
        if (!candidate || !Array.isArray(candidate.values) || candidate.values.length === 0) return;
        const key = candidate.values.map((val) => Number.parseFloat(val).toFixed(2)).join('|');
        if (!map.has(key)) {
            map.set(key, candidate);
        }
    });
    return Array.from(map.values());
}

function isFullAllocationSingleStage(values, base) {
    if (!Array.isArray(values) || values.length === 0) return false;
    const sanitized = values
        .map((val) => Number.parseFloat(val))
        .filter((val) => Number.isFinite(val) && val > 0);
    if (sanitized.length !== 1) return false;
    const total = sanitized[0];
    if (!Number.isFinite(total)) return false;
    const target = Number.isFinite(base) && base > 0 ? base : total;
    const tolerance = Math.max(0.1, target * 0.001);
    return Math.abs(total - target) <= tolerance;
}

function resolveModesForCandidate(isSingleFull, options, preferredValue) {
    if (!Array.isArray(options) || options.length === 0) return [];
    if (!isSingleFull) return options.slice();
    const preferred = preferredValue ? options.find((opt) => opt && opt.value === preferredValue) : null;
    return [preferred || options[0]];
}

function buildStagingOptimizationCombos(params) {
    const positionSize = Number.parseFloat(params.positionSize) || 100;
    const entryBase = Math.max(positionSize, 1);
    const exitBase = 100;

    const entryCandidates = [];
    const normalizedEntry = normalizeStageValues(params.entryStages, entryBase);
    if (normalizedEntry.length > 0) {
        entryCandidates.push({
            id: 'entry_current',
            label: '目前設定',
            values: normalizedEntry,
            display: formatStagePercentages(normalizedEntry),
            isSingleFull: isFullAllocationSingleStage(normalizedEntry, entryBase),
        });
    }
    const entryProfiles = [
        { id: 'entry_single', label: '單段滿倉', weights: [1] },
        { id: 'entry_even_two', label: '兩段平均', weights: [0.5, 0.5] },
        { id: 'entry_front_heavy', label: '先重後輕 (60/40)', weights: [0.6, 0.4] },
        { id: 'entry_back_heavy', label: '先輕後重 (40/60)', weights: [0.4, 0.6] },
        { id: 'entry_pyramid', label: '金字塔 (50/30/20)', weights: [0.5, 0.3, 0.2] },
        { id: 'entry_reverse_pyramid', label: '倒金字塔 (20/30/50)', weights: [0.2, 0.3, 0.5] },
        { id: 'entry_ladder', label: '階梯遞增 (30/30/40)', weights: [0.3, 0.3, 0.4] },
    ];
    entryProfiles.forEach((profile) => {
        const values = scaleStageWeights(entryBase, profile.weights);
        if (values.length === 0) return;
        entryCandidates.push({
            id: profile.id,
            label: profile.label,
            values,
            display: formatStagePercentages(values),
            isSingleFull: isFullAllocationSingleStage(values, entryBase),
        });
    });
    const dedupedEntry = dedupeStageCandidates(entryCandidates);

    const exitCandidates = [];
    const normalizedExit = normalizeStageValues(params.exitStages, exitBase);
    if (normalizedExit.length > 0) {
        exitCandidates.push({
            id: 'exit_current',
            label: '目前設定',
            values: normalizedExit,
            display: formatStagePercentages(normalizedExit),
            isSingleFull: isFullAllocationSingleStage(normalizedExit, exitBase),
        });
    }
    const exitProfiles = [
        { id: 'exit_single', label: '一次出清', weights: [1] },
        { id: 'exit_even_two', label: '兩段平均', weights: [0.5, 0.5] },
        { id: 'exit_front_heavy', label: '先重後輕 (60/40)', weights: [0.6, 0.4] },
        { id: 'exit_back_heavy', label: '先輕後重 (40/60)', weights: [0.4, 0.6] },
        { id: 'exit_triplet', label: '三段階梯 (30/30/40)', weights: [0.3, 0.3, 0.4] },
        { id: 'exit_tail_hold', label: '保留尾段 (25/25/50)', weights: [0.25, 0.25, 0.5] },
    ];
    exitProfiles.forEach((profile) => {
        const values = scaleStageWeights(exitBase, profile.weights);
        if (values.length === 0) return;
        exitCandidates.push({
            id: profile.id,
            label: profile.label,
            values,
            display: formatStagePercentages(values),
            isSingleFull: isFullAllocationSingleStage(values, exitBase),
        });
    });
    const dedupedExit = dedupeStageCandidates(exitCandidates);

    const entryModeOptionsRaw = [
        { value: 'price_pullback', label: formatStageModeLabel('price_pullback', 'entry') || '價格回落加碼' },
        { value: 'signal_repeat', label: formatStageModeLabel('signal_repeat', 'entry') || '策略訊號再觸發' },
    ];
    const exitModeOptionsRaw = [
        { value: 'price_rally', label: formatStageModeLabel('price_rally', 'exit') || '價格走高分批出場' },
        { value: 'signal_repeat', label: formatStageModeLabel('signal_repeat', 'exit') || '策略訊號再觸發' },
    ];

    const sortModeOptions = (options, targetValue) => {
        if (!targetValue) return options.slice();
        return options.slice().sort((a, b) => {
            if (a.value === targetValue) return -1;
            if (b.value === targetValue) return 1;
            return 0;
        });
    };

    const entryModeOptions = sortModeOptions(entryModeOptionsRaw, params.entryStagingMode || null);
    const exitModeOptions = sortModeOptions(exitModeOptionsRaw, params.exitStagingMode || null);

    const combos = [];
    dedupedEntry.forEach((entryCandidate) => {
        const entryModes = resolveModesForCandidate(
            isFullAllocationSingleStage(entryCandidate.values, entryBase),
            entryModeOptions,
            params.entryStagingMode || null,
        );
        if (!entryModes.length) return;
        dedupedExit.forEach((exitCandidate) => {
            const exitModes = resolveModesForCandidate(
                isFullAllocationSingleStage(exitCandidate.values, exitBase),
                exitModeOptions,
                params.exitStagingMode || null,
            );
            if (!exitModes.length) return;
            entryModes.forEach((entryMode) => {
                exitModes.forEach((exitMode) => {
                    combos.push({
                        entry: entryCandidate,
                        exit: exitCandidate,
                        entryMode,
                        exitMode,
                    });
                });
            });
        });
    });

    return {
        entryCandidates: dedupedEntry,
        exitCandidates: dedupedExit,
        combos,
    };
}

function buildCachedMetaFromEntry(entry, effectiveStartDate, lookbackDays) {
    if (!entry) return null;
    return {
        summary: entry.summary || null,
        adjustments: Array.isArray(entry.adjustments) ? entry.adjustments : [],
        debugSteps: Array.isArray(entry.debugSteps) ? entry.debugSteps : [],
        adjustmentFallbackApplied: Boolean(entry.adjustmentFallbackApplied),
        priceSource: entry.priceSource || null,
        dataSource: entry.dataSource || null,
        splitAdjustment: Boolean(entry.splitAdjustment),
        fetchRange: entry.fetchRange || null,
        effectiveStartDate: entry.effectiveStartDate || effectiveStartDate,
        lookbackDays: entry.lookbackDays || lookbackDays,
        diagnostics: entry.fetchDiagnostics || entry.datasetDiagnostics || null,
    };
}

function syncCacheFromBacktestResult(data, dataSource, params, curSettings, cacheKey, effectiveStartDate, lookbackDays, existingEntry) {
    if (!data) return existingEntry || null;
    const priceMode = curSettings.priceMode || (params.adjustedPrice ? 'adjusted' : 'raw');

    const mergeRawData = Array.isArray(data.rawData) && data.rawData.length > 0;
    const mergedDataMap = new Map(Array.isArray(existingEntry?.data) ? existingEntry.data.map((row) => [row.date, row]) : []);
    if (mergeRawData) {
        data.rawData.forEach((row) => {
            if (row && row.date) {
                mergedDataMap.set(row.date, row);
            }
        });
    }
    let mergedData = Array.from(mergedDataMap.values());
    mergedData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let fetchedRange = null;
    if (data?.rawMeta?.fetchRange && data.rawMeta.fetchRange.start && data.rawMeta.fetchRange.end) {
        fetchedRange = {
            start: data.rawMeta.fetchRange.start,
            end: data.rawMeta.fetchRange.end,
        };
    } else if (curSettings.startDate && curSettings.endDate) {
        fetchedRange = { start: curSettings.startDate, end: curSettings.endDate };
    }

    if (!mergeRawData && Array.isArray(data.rawDataUsed) && data.rawDataUsed.length > 0) {
        mergedData = data.rawDataUsed.slice();
        mergedData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        if (!fetchedRange && mergedData.length > 0) {
            fetchedRange = {
                start: mergedData[0].date || curSettings.startDate,
                end: mergedData[mergedData.length - 1].date || curSettings.endDate,
            };
        }
    }

    if (!mergedData || mergedData.length === 0) {
        return existingEntry || null;
    }

    const mergedCoverage = typeof computeCoverageFromRows === 'function'
        ? computeCoverageFromRows(mergedData)
        : mergeIsoCoverage(
            existingEntry?.coverage || [],
            fetchedRange && fetchedRange.start && fetchedRange.end ? { start: fetchedRange.start, end: fetchedRange.end } : null,
        );
    const sourceSet = new Set(Array.isArray(existingEntry?.dataSources) ? existingEntry.dataSources : []);
    if (dataSource) sourceSet.add(dataSource);
    const sourceArray = Array.from(sourceSet);

    const rawMeta = data.rawMeta || {};
    const dataDebug = data.dataDebug || {};
    const debugSteps = Array.isArray(rawMeta.debugSteps)
        ? rawMeta.debugSteps
        : (Array.isArray(dataDebug.debugSteps) ? dataDebug.debugSteps : []);
    const summaryMeta = rawMeta.summary || dataDebug.summary || existingEntry?.summary || null;
    const adjustmentsMeta = Array.isArray(rawMeta.adjustments)
        ? rawMeta.adjustments
        : (Array.isArray(dataDebug.adjustments) ? dataDebug.adjustments : existingEntry?.adjustments || []);
    const fallbackFlag = typeof rawMeta.adjustmentFallbackApplied === 'boolean'
        ? rawMeta.adjustmentFallbackApplied
        : (typeof dataDebug.adjustmentFallbackApplied === 'boolean'
            ? dataDebug.adjustmentFallbackApplied
            : Boolean(existingEntry?.adjustmentFallbackApplied));
    const priceSourceMeta = rawMeta.priceSource || dataDebug.priceSource || existingEntry?.priceSource || null;
    const splitDiagnosticsMeta = rawMeta.splitDiagnostics || dataDebug.splitDiagnostics || existingEntry?.splitDiagnostics || null;
    const finmindStatusMeta = rawMeta.finmindStatus || dataDebug.finmindStatus || existingEntry?.finmindStatus || null;
    const adjustmentDebugLogMeta = rawMeta.adjustmentDebugLog || dataDebug.adjustmentDebugLog || existingEntry?.adjustmentDebugLog || null;
    const adjustmentChecksMeta = rawMeta.adjustmentChecks || dataDebug.adjustmentChecks || existingEntry?.adjustmentChecks || null;

    const updatedEntry = {
        ...(existingEntry || {}),
        data: mergedData,
        coverage: mergedCoverage,
        coverageFingerprint: computeCoverageFingerprint(mergedCoverage),
        dataSources: sourceArray,
        dataSource: summariseSourceLabels(sourceArray),
        fetchedAt: Date.now(),
        adjustedPrice: params.adjustedPrice,
        splitAdjustment: params.splitAdjustment,
        priceMode,
        adjustmentFallbackApplied: fallbackFlag,
        summary: summaryMeta,
        adjustments: adjustmentsMeta,
        debugSteps,
        priceSource: priceSourceMeta,
        splitDiagnostics: splitDiagnosticsMeta,
        finmindStatus: finmindStatusMeta,
        adjustmentDebugLog: adjustmentDebugLogMeta,
        adjustmentChecks: adjustmentChecksMeta,
        fetchRange: fetchedRange,
        effectiveStartDate: curSettings.effectiveStartDate || effectiveStartDate,
        lookbackDays,
        datasetDiagnostics: data?.datasetDiagnostics || existingEntry?.datasetDiagnostics || null,
        fetchDiagnostics: data?.datasetDiagnostics?.fetch || existingEntry?.fetchDiagnostics || null,
    };

    applyCacheStartMetadata(cacheKey, updatedEntry, curSettings.effectiveStartDate || effectiveStartDate, {
        toleranceDays: START_GAP_TOLERANCE_DAYS,
        acknowledgeExcessGap: false,
    });
    cachedDataStore.set(cacheKey, updatedEntry);
    setVisibleStockData(extractRangeData(updatedEntry.data, curSettings.effectiveStartDate || effectiveStartDate, curSettings.endDate));
    cachedStockData = updatedEntry.data;
    lastFetchSettings = { ...curSettings };
    refreshPriceInspectorControls();
    updatePriceDebug(updatedEntry);
    return updatedEntry;
}

function updateStagingOptimizationStatus(message, isError = false) {
    const statusEl = document.getElementById('staging-optimization-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'var(--destructive)' : 'var(--muted-foreground)';
    statusEl.classList.toggle('font-semibold', Boolean(isError));
}

function updateStagingOptimizationProgress(currentIndex, total, entryLabel, exitLabel, entryModeLabel, exitModeLabel) {
    const progressWrapper = document.getElementById('staging-optimization-progress');
    const progressBar = document.getElementById('staging-optimization-progress-bar');
    if (progressWrapper) {
        progressWrapper.classList.remove('hidden');
    }
    if (progressBar && Number.isFinite(total) && total > 0) {
        const percent = Math.max(0, Math.min(100, Math.round((currentIndex / total) * 100)));
        progressBar.style.width = `${percent}%`;
    }
    const entryText = entryLabel || '—';
    const exitText = exitLabel || '—';
    const entryModeText = entryModeLabel ? `（${entryModeLabel}）` : '';
    const exitModeText = exitModeLabel ? `（${exitModeLabel}）` : '';
    updateStagingOptimizationStatus(`測試第 ${currentIndex} / ${total} 組：進場 ${entryText}${entryModeText}，出場 ${exitText}${exitModeText}`);
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return 'N/A';
    const rounded = Number.parseFloat(value.toFixed(2));
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded}%`;
}

function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toFixed(digits);
}

function renderStagingOptimizationResults(results) {
    const resultsContainer = document.getElementById('staging-optimization-results');
    const tableBody = document.getElementById('staging-optimization-table-body');
    const summaryEl = document.getElementById('staging-optimization-summary');
    if (!resultsContainer || !tableBody || !summaryEl) return;

    if (!Array.isArray(results) || results.length === 0) {
        tableBody.innerHTML = '';
        summaryEl.textContent = '未取得有效的分段組合結果。';
        resultsContainer.classList.add('hidden');
        return;
    }

    const sorted = [...results].sort((a, b) => {
        const aAnn = Number.isFinite(a.metrics?.annualizedReturn) ? a.metrics.annualizedReturn : -Infinity;
        const bAnn = Number.isFinite(b.metrics?.annualizedReturn) ? b.metrics.annualizedReturn : -Infinity;
        if (bAnn !== aAnn) return bAnn - aAnn;
        const aSharpe = Number.isFinite(a.metrics?.sharpeRatio) ? a.metrics.sharpeRatio : -Infinity;
        const bSharpe = Number.isFinite(b.metrics?.sharpeRatio) ? b.metrics.sharpeRatio : -Infinity;
        if (bSharpe !== aSharpe) return bSharpe - aSharpe;
        const aDrawdown = Number.isFinite(a.metrics?.maxDrawdown) ? a.metrics.maxDrawdown : Infinity;
        const bDrawdown = Number.isFinite(b.metrics?.maxDrawdown) ? b.metrics.maxDrawdown : Infinity;
        return aDrawdown - bDrawdown;
    });

    stagingOptimizationState.results = sorted;
    stagingOptimizationState.bestResult = sorted[0] || null;

    const rows = sorted.slice(0, Math.min(sorted.length, 10)).map((item, index) => {
        const metrics = item.metrics || {};
        const annCls = Number.isFinite(metrics.annualizedReturn) && metrics.annualizedReturn >= 0 ? 'text-emerald-600' : 'text-rose-600';
        const drawCls = Number.isFinite(metrics.maxDrawdown) ? 'text-rose-600' : '';
        const sharpeText = Number.isFinite(metrics.sharpeRatio) ? metrics.sharpeRatio.toFixed(2) : 'N/A';
        const drawdownText = Number.isFinite(metrics.maxDrawdown) ? `${metrics.maxDrawdown.toFixed(2)}%` : 'N/A';
        const tradesText = Number.isFinite(metrics.tradesCount) ? metrics.tradesCount : (Number.isFinite(metrics.tradeCount) ? metrics.tradeCount : 'N/A');
        const entryModeLabel = resolveStageModeDisplay(item.combination?.entry, item.combination?.entryMode, 'entry');
        const exitModeLabel = resolveStageModeDisplay(item.combination?.exit, item.combination?.exitMode, 'exit');
        return `<tr class="${index === 0 ? 'bg-emerald-50 font-semibold' : 'hover:bg-muted/40'}">
            <td class="px-3 py-2">${index + 1}</td>
            <td class="px-3 py-2">${item.combination.entry.display}</td>
            <td class="px-3 py-2">${entryModeLabel}</td>
            <td class="px-3 py-2">${item.combination.exit.display}</td>
            <td class="px-3 py-2">${exitModeLabel}</td>
            <td class="px-3 py-2 ${annCls}">${formatPercent(metrics.annualizedReturn)}</td>
            <td class="px-3 py-2">${sharpeText}</td>
            <td class="px-3 py-2 ${drawCls}">${drawdownText}</td>
            <td class="px-3 py-2">${tradesText}</td>
            <td class="px-3 py-2">
                <button type="button" class="px-3 py-1.5 text-xs font-semibold rounded-md border" data-apply-staging-index="${index}" data-apply-staging-rank="${index + 1}" style="border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    套用並回測
                </button>
            </td>
        </tr>`;
    }).join('');

    tableBody.innerHTML = rows;
    resultsContainer.classList.remove('hidden');
    initStagingOptimizationActions();

    const best = stagingOptimizationState.bestResult;
    if (best && best.metrics) {
        const metrics = best.metrics;
        const entryModeLabel = resolveStageModeDisplay(best.combination?.entry, best.combination?.entryMode, 'entry');
        const exitModeLabel = resolveStageModeDisplay(best.combination?.exit, best.combination?.exitMode, 'exit');
        summaryEl.innerHTML = `推薦組合：<strong>${best.combination.entry.display}</strong>（${entryModeLabel}） × <strong>${best.combination.exit.display}</strong>（${exitModeLabel}）。` +
            ` 年化報酬 <span class="${metrics.annualizedReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatPercent(metrics.annualizedReturn)}</span>` +
            ` ／ 夏普比率 ${formatNumber(metrics.sharpeRatio, 2)} ／ 最大回撤 <span class="text-rose-600">${formatPercent(metrics.maxDrawdown)}</span>。` +
            `<br><span class="text-xs" style="color: var(--muted-foreground);">共完成 ${sorted.length} 組測試。</span>`;
    } else {
        summaryEl.textContent = '未找到適合的分段組合。';
    }

    updateStagingOptimizationStatus('分段優化完成！可於下方查看推薦清單。', false);
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function initStagingOptimizationActions() {
    const tableBody = document.getElementById('staging-optimization-table-body');
    if (!tableBody || tableBody.dataset.applyActionsBound === 'true') return;
    tableBody.dataset.applyActionsBound = 'true';
    tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('[data-apply-staging-index]');
        if (!button) return;
        const index = Number(button.dataset.applyStagingIndex);
        if (!Number.isFinite(index)) return;
        const candidate = Array.isArray(stagingOptimizationState.results)
            ? stagingOptimizationState.results[index]
            : null;
        if (!candidate) {
            updateStagingOptimizationStatus('找不到對應的分段組合，請重新執行分段優化。', true);
            return;
        }
        const rankLabel = button.dataset.applyStagingRank || `${index + 1}`;
        const entryLabel = candidate.combination?.entry?.display || '—';
        const exitLabel = candidate.combination?.exit?.display || '—';
        const confirmMessage = `確定要套用第 ${rankLabel} 名「${entryLabel} × ${exitLabel}」並立即回測嗎？`;
        if (!window.confirm(confirmMessage)) {
            return;
        }
        applyStagingCombination(candidate, { autoRun: true, source: 'table' });
    });
}

async function runStagingOptimization() {
    if (!workerUrl) {
        showError('背景計算引擎尚未準備就緒，請稍候再試。');
        return;
    }
    if (stagingOptimizationState.running) {
        updateStagingOptimizationStatus('分段優化進行中，請稍候。');
        return;
    }

    if (window.lazybacktestMultiStagePanel && typeof window.lazybacktestMultiStagePanel.open === 'function') {
        window.lazybacktestMultiStagePanel.open();
    }

    const runButton = document.getElementById('stagingOptimizationBtn');

    const baseParams = getBacktestParams();
    if (!validateBacktestParams(baseParams)) {
        activateTab('staging-optimizer');
        updateStagingOptimizationStatus('請先修正回測設定後再嘗試分段優化。', true);
        return;
    }

    activateTab('staging-optimizer');
    const progressBar = document.getElementById('staging-optimization-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    const resultsContainer = document.getElementById('staging-optimization-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    updateStagingOptimizationStatus('正在整理候選分段組合...', false);

    stagingOptimizationState.running = true;
    stagingOptimizationState.results = [];
    stagingOptimizationState.bestResult = null;

    if (runButton) {
        runButton.disabled = true;
        runButton.innerHTML = '<i data-lucide="loader-2" class="lucide-sm animate-spin"></i> 分段優化中...';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    try {
        const combinations = buildStagingOptimizationCombos(baseParams);
        stagingOptimizationState.combinations = combinations.combos;
        if (!Array.isArray(combinations.combos) || combinations.combos.length === 0) {
            updateStagingOptimizationStatus('目前設定無法產生有效的分段組合。', true);
            stagingOptimizationState.running = false;
            if (runButton) {
                runButton.disabled = false;
                runButton.innerHTML = '<i data-lucide="play-circle" class="lucide-sm"></i> 一鍵優化分段策略';
                if (typeof lucide !== 'undefined' && lucide.createIcons) {
                    lucide.createIcons();
                }
            }
            return;
        }

        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        const maxIndicatorPeriod = sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(baseParams)
            : 0;
        const lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
            ? sharedUtils.estimateLookbackBars(maxIndicatorPeriod, { minBars: 90, multiplier: 2 })
            : Math.max(90, maxIndicatorPeriod * 2);
        const effectiveStartDate = baseParams.startDate;
        let dataStartDate = effectiveStartDate;
        if (sharedUtils && typeof sharedUtils.computeBufferedStartDate === 'function') {
            dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
                minDate: sharedUtils.MIN_DATA_DATE,
                marginTradingDays: 12,
                extraCalendarDays: 7,
            }) || effectiveStartDate;
        }
        if (!dataStartDate) dataStartDate = effectiveStartDate;

        const curSettings = {
            stockNo: baseParams.stockNo,
            startDate: dataStartDate,
            endDate: baseParams.endDate,
            effectiveStartDate,
            market: (baseParams.market || baseParams.marketType || currentMarket || 'TWSE').toUpperCase(),
            adjustedPrice: baseParams.adjustedPrice,
            splitAdjustment: baseParams.splitAdjustment,
            priceMode: (baseParams.priceMode || (baseParams.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toLowerCase(),
            lookbackDays,
        };
        const cacheKey = buildCacheKey(curSettings);
        let cachedEntry = cachedDataStore.get(cacheKey) || null;
        let cachedPayload = Array.isArray(cachedEntry?.data) ? cachedEntry.data : (Array.isArray(cachedStockData) ? cachedStockData : null);
        let cachedMeta = cachedEntry ? buildCachedMetaFromEntry(cachedEntry, effectiveStartDate, lookbackDays) : null;
        let datasetReady = Array.isArray(cachedPayload) && cachedPayload.length > 0;

        const results = [];
        const total = combinations.combos.length;
        let index = 0;

        for (const combo of combinations.combos) {
            index += 1;
            const entryModeProgressLabel = resolveStageModeDisplay(combo.entry, combo.entryMode, 'entry');
            const exitModeProgressLabel = resolveStageModeDisplay(combo.exit, combo.exitMode, 'exit');
            updateStagingOptimizationProgress(
                index - 1,
                total,
                combo.entry.display,
                combo.exit.display,
                entryModeProgressLabel === '—' ? '' : entryModeProgressLabel,
                exitModeProgressLabel === '—' ? '' : exitModeProgressLabel
            );

            const candidateParams = {
                ...baseParams,
                entryStages: combo.entry.values.slice(),
                exitStages: combo.exit.values.slice(),
                entryStagingMode: combo.entryMode?.value || combo.entryMode || baseParams.entryStagingMode,
                exitStagingMode: combo.exitMode?.value || combo.exitMode || baseParams.exitStagingMode,
            };

            const runOptions = {
                useCache: datasetReady,
                cachedData: datasetReady ? cachedPayload : null,
                cachedMeta: datasetReady ? cachedMeta : null,
                dataStartDate,
                effectiveStartDate,
                lookbackDays,
                curSettings,
                cacheKey,
                existingEntry: cachedEntry,
            };

            const { result, updatedEntry, rawDataUsed } = await executeStagingCandidate(candidateParams, runOptions);
            if (!datasetReady) {
                if (updatedEntry && Array.isArray(updatedEntry.data)) {
                    cachedEntry = updatedEntry;
                    cachedPayload = updatedEntry.data;
                    cachedMeta = buildCachedMetaFromEntry(updatedEntry, effectiveStartDate, lookbackDays);
                    datasetReady = true;
                } else if (Array.isArray(rawDataUsed) && rawDataUsed.length > 0) {
                    cachedPayload = rawDataUsed;
                    cachedMeta = null;
                    datasetReady = true;
                    cachedStockData = rawDataUsed;
                }
            } else if (updatedEntry && Array.isArray(updatedEntry.data)) {
                cachedEntry = updatedEntry;
                cachedPayload = updatedEntry.data;
                cachedMeta = buildCachedMetaFromEntry(updatedEntry, effectiveStartDate, lookbackDays);
            }

            const entryModeCompleteLabel = resolveStageModeDisplay(combo.entry, combo.entryMode, 'entry');
            const exitModeCompleteLabel = resolveStageModeDisplay(combo.exit, combo.exitMode, 'exit');
            updateStagingOptimizationProgress(
                index,
                total,
                combo.entry.display,
                combo.exit.display,
                entryModeCompleteLabel === '—' ? '' : entryModeCompleteLabel,
                exitModeCompleteLabel === '—' ? '' : exitModeCompleteLabel
            );

            const metrics = {
                annualizedReturn: Number.isFinite(result?.annualizedReturn) ? result.annualizedReturn : null,
                sharpeRatio: Number.isFinite(result?.sharpeRatio) ? result.sharpeRatio : null,
                maxDrawdown: Number.isFinite(result?.maxDrawdown) ? result.maxDrawdown : null,
                tradesCount: Number.isFinite(result?.tradesCount) ? result.tradesCount : Number.isFinite(result?.tradeCount) ? result.tradeCount : null,
            };

            results.push({
                combination: combo,
                metrics,
                raw: result,
            });
        }

        renderStagingOptimizationResults(results);
    } catch (error) {
        console.error('[Staging Optimization] 發生錯誤:', error);
        updateStagingOptimizationStatus(`分段優化發生錯誤：${error.message}`, true);
    } finally {
        stagingOptimizationState.running = false;
        if (runButton) {
            runButton.disabled = false;
            runButton.innerHTML = '<i data-lucide="play-circle" class="lucide-sm"></i> 一鍵優化分段策略';
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
}

function executeStagingCandidate(params, options) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl);
        const cleanup = () => {
            try { worker.terminate(); } catch (err) { console.warn('[Staging Optimization] Worker terminate failed:', err); }
        };
        worker.onerror = (err) => {
            cleanup();
            reject(err);
        };
        worker.onmessage = (event) => {
            const { type, data, dataSource } = event.data;
            if (type === 'result') {
                let updatedEntry = null;
                if (!options.useCache || !options.existingEntry || Array.isArray(data?.rawData)) {
                    updatedEntry = syncCacheFromBacktestResult(
                        data,
                        dataSource,
                        params,
                        options.curSettings,
                        options.cacheKey,
                        options.effectiveStartDate,
                        options.lookbackDays,
                        options.existingEntry,
                    );
                }
                cleanup();
                resolve({ result: data, updatedEntry, rawDataUsed: data?.rawDataUsed || null });
            } else if (type === 'error') {
                cleanup();
                reject(new Error(data?.message || '分段優化運算失敗'));
            }
        };

        const message = {
            type: 'runBacktest',
            params,
            useCachedData: Boolean(options.useCache && Array.isArray(options.cachedData) && options.cachedData.length > 0),
            dataStartDate: options.dataStartDate,
            effectiveStartDate: options.effectiveStartDate,
            lookbackDays: options.lookbackDays,
        };
        if (message.useCachedData) {
            message.cachedData = options.cachedData;
            if (options.cachedMeta) {
                message.cachedMeta = options.cachedMeta;
            }
        }
        worker.postMessage(message);
    });
}

function applyStagingCombination(candidate, options = {}) {
    if (!candidate || !candidate.combination) {
        updateStagingOptimizationStatus('無法套用分段設定，請重新執行分段優化。', true);
        return false;
    }
    if (window.lazybacktestMultiStagePanel && typeof window.lazybacktestMultiStagePanel.open === 'function') {
        window.lazybacktestMultiStagePanel.open();
    }
    const entryValues = candidate.combination.entry?.values;
    const exitValues = candidate.combination.exit?.values;
    if (entryValues && window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.setValues === 'function') {
        window.lazybacktestStagedEntry.setValues(entryValues, { manual: true });
    }
    if (exitValues && window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.setValues === 'function') {
        window.lazybacktestStagedExit.setValues(exitValues, { manual: true });
    }
    const entryModeSelect = document.getElementById('entryStagingMode');
    if (entryModeSelect && candidate.combination.entryMode) {
        entryModeSelect.value = candidate.combination.entryMode.value || candidate.combination.entryMode;
        entryModeSelect.dispatchEvent(new Event('change'));
    }
    const exitModeSelect = document.getElementById('exitStagingMode');
    if (exitModeSelect && candidate.combination.exitMode) {
        exitModeSelect.value = candidate.combination.exitMode.value || candidate.combination.exitMode;
        exitModeSelect.dispatchEvent(new Event('change'));
    }
    const entryLabel = candidate.combination.entry?.display || '—';
    const exitLabel = candidate.combination.exit?.display || '—';
    if (options.autoRun) {
        updateStagingOptimizationStatus(`已套用「${entryLabel} × ${exitLabel}」，準備立即回測。`, false);
        showInfo(`已套用「${entryLabel} × ${exitLabel}」，正在啟動回測。`);
        runBacktestInternal();
    } else {
        updateStagingOptimizationStatus(`已套用「${entryLabel} × ${exitLabel}」，請執行回測確認績效。`, false);
        showSuccess('已套用推薦分段設定，建議重新回測以確認績效表現。');
    }
    return true;
}

function applyBestStagingRecommendation() {
    const best = stagingOptimizationState.bestResult;
    if (!best) {
        updateStagingOptimizationStatus('尚未產生推薦分段，請先執行分段優化。', true);
        return;
    }
    applyStagingCombination(best, { autoRun: false, source: 'best' });
}


function updateStrategyParams(type) {
    const strategySelect = document.getElementById(`${type}Strategy`);
    const paramsContainer = document.getElementById(`${type}Params`);
    if (!strategySelect || !paramsContainer) {
        console.error(`[Main] Cannot find elements for type: ${type}`);
        return;
    }
    
    const strategyKey = strategySelect.value;
    const normalizedKey = normaliseStrategyIdForRole(type, strategyKey);
    if (normalizedKey && normalizedKey !== strategyKey) {
        const hasOption = Array.from(strategySelect.options || []).some((option) => option.value === normalizedKey);
        if (hasOption) {
            strategySelect.value = normalizedKey;
        }
    }
    const internalKey = normalizedKey || strategyKey;
    
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

function resetSettings() {
    document.getElementById("stockNo").value = "2330";
    initDates();
    document.getElementById("initialCapital").value = "100000";
    document.getElementById("positionSize").value = "100";
    if (window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.resetToDefault === 'function') {
        window.lazybacktestStagedEntry.resetToDefault(100);
    }
    if (window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.resetToDefault === 'function') {
        window.lazybacktestStagedExit.resetToDefault(100);
    }
    const entryModeSelect = document.getElementById("entryStagingMode");
    if (entryModeSelect) entryModeSelect.value = "signal_repeat";
    const exitModeSelect = document.getElementById("exitStagingMode");
    if (exitModeSelect) exitModeSelect.value = "signal_repeat";
    document.getElementById("stopLoss").value = "0";
    document.getElementById("takeProfit").value = "0";
    document.getElementById("positionBasisInitial").checked = true;
    setDefaultFees("2330");
    document.querySelector('input[name="tradeTiming"][value="close"]').checked = true;
    document.getElementById("entryStrategy").value = "ma_cross";
    updateStrategyParams('entry');
    document.getElementById("exitStrategy").value = "ma_cross_exit";
    updateStrategyParams('exit');
    const shortCheckbox = document.getElementById("enableShortSelling");
    const shortArea = document.getElementById("short-strategy-area");
    shortCheckbox.checked = false;
    shortArea.style.display = 'none';
    document.getElementById("shortEntryStrategy").value = "short_ma_cross";
    updateStrategyParams('shortEntry');
    document.getElementById("shortExitStrategy").value = "cover_ma_cross";
    updateStrategyParams('shortExit');
    cachedStockData = null;
    cachedDataStore.clear();
    lastFetchSettings = null;
    refreshPriceInspectorControls();
    clearPreviousResults();
    showSuccess("設定已重置");
}

function initTabs() {
    // Initialize with summary tab active
    activateTab('summary');
}
// Patch Tag: LB-TAB-UI-20240829A
function activateTab(tabId) {
    const tabs = document.querySelectorAll('[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    const baseClass = 'tab py-4 px-1 border-b-2 font-medium text-xs whitespace-nowrap';
    const activeClass = `${baseClass} border-primary text-primary`;
    const inactiveClass = `${baseClass} border-transparent text-muted hover:text-foreground`;

    tabs.forEach((tab) => {
        const currentTabId = tab.getAttribute('data-tab');
        const isActive = currentTabId === tabId;
        tab.className = isActive ? activeClass : inactiveClass;
        tab.style.color = isActive ? 'var(--primary)' : 'var(--muted-foreground)';
        tab.style.borderColor = isActive ? 'var(--primary)' : 'transparent';
        if (isActive) {
            tab.setAttribute('aria-current', 'page');
        } else {
            tab.setAttribute('aria-current', 'false');
        }
    });

    contents.forEach((content) => {
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
function setDefaultFees(stockNo) {
    const buyFeeInput = document.getElementById('buyFee');
    const sellFeeInput = document.getElementById('sellFee');
    if (!buyFeeInput || !sellFeeInput) return;

    const stockCode = typeof stockNo === 'string' ? stockNo.trim().toUpperCase() : '';
    const isETF = stockCode.startsWith('00');
    const isTAIEX = stockCode === 'TAIEX';
    const isUSMarket = currentMarket === 'US';
    const isIndex = isIndexTicker(stockCode);

    if (isUSMarket || isIndex) {
        buyFeeInput.value = '0.0000';
        sellFeeInput.value = '0.0000';
        console.log(`[Fees] ${(isUSMarket ? 'US market' : 'Index')} defaults applied for ${stockCode || '(未輸入)'}`);
        return;
    }

    const stockBuyFeeRate = 0.1425;
    const stockSellFeeRate = 0.1425;
    const stockTaxRate = 0.3;
    const etfBuyFeeRate = 0.1;
    const etfSellFeeRate = 0.1;
    const etfTaxRate = 0.1;

    if (isTAIEX) {
        buyFeeInput.value = '0.0000';
        sellFeeInput.value = '0.0000';
        console.log(`[Fees] 指數預設費率 for ${stockCode}`);
    } else if (isETF) {
        buyFeeInput.value = etfBuyFeeRate.toFixed(4);
        sellFeeInput.value = (etfSellFeeRate + etfTaxRate).toFixed(4);
        console.log(`[Fees] ETF 預設費率 for ${stockCode} -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`);
    } else {
        buyFeeInput.value = stockBuyFeeRate.toFixed(4);
        sellFeeInput.value = (stockSellFeeRate + stockTaxRate).toFixed(4);
        console.log(`[Fees] Stock 預設費率 for ${stockCode} -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`);
    }
}

const STRATEGY_COMPARISON_VERSION = 'LB-STRATEGY-COMPARE-20260710C';
const STRATEGY_COMPARISON_SELECTION_KEY = 'lazybacktest_strategy_compare_selection';
const STRATEGY_COMPARISON_METRICS = [
    {
        key: 'annualizedReturn',
        label: '年化報酬率',
        description: '最近一次回測的年化報酬率 (%)',
        defaultChecked: true,
    },
    {
        key: 'sharpeRatio',
        label: '夏普值',
        description: '最近一次回測的 Sharpe Ratio',
        defaultChecked: true,
    },
    {
        key: 'maxDrawdown',
        label: '最大回撤',
        description: '最近一次回測的最大回撤 (%)',
        defaultChecked: true,
    },
    {
        key: 'totalTrades',
        label: '交易次數',
        description: '最近一次回測完成的交易筆數',
        defaultChecked: true,
    },
    {
        key: 'sensitivityScore',
        label: '敏感度測試',
        description: '敏感度總分與平均漂移（需完成敏感度測試後儲存）',
        defaultChecked: true,
    },
    {
        key: 'rollingScore',
        label: '滾動測試評分',
        description: 'Walk-Forward 評分與視窗達標率（需完成滾動測試後儲存）',
        defaultChecked: true,
    },
    {
        key: 'trendCurrent',
        label: '目前趨勢區間',
        description: '趨勢摘要推論的最新區間、近況報酬與平均狀態信心',
        defaultChecked: true,
    },
];

const strategyComparisonState = {
    initialized: false,
    selectedStrategies: new Set(),
    selectedMetrics: new Set(),
    lastRenderedStrategyNames: [],
};

function getStrategyComparisonMetricConfig() {
    return STRATEGY_COMPARISON_METRICS.slice();
}

function normaliseMetricNumber(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function resolveTotalTradesMetric(performance) {
    if (!performance) return null;
    const candidates = [performance.totalTrades, performance.tradesCount, performance.tradeCount];
    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        if (Number.isFinite(candidate)) {
            return Number(candidate);
        }
    }
    return null;
}

function collectStrategyMetricSnapshot(fallbackMetrics) {
    const performance = lastOverallResult || {};
    const sensitivitySummary = performance?.sensitivityAnalysis?.summary
        || performance?.parameterSensitivity?.summary
        || performance?.sensitivityData?.summary
        || null;
    const rollingState = (typeof window !== 'undefined' && window.rollingTest && window.rollingTest.state)
        ? window.rollingTest.state
        : null;
    const rollingAggregate = rollingState?.aggregate || null;
    const trendSummary = trendAnalysisState?.summary || null;
    const fallback = fallbackMetrics && typeof fallbackMetrics === 'object' ? fallbackMetrics : null;
    const latestLabelKey = trendSummary?.latest?.label || null;
    let latestReturn = null;
    let latestCoverage = null;
    if (Number.isFinite(trendSummary?.latest?.strategyReturnPct)) {
        latestReturn = Number(trendSummary.latest.strategyReturnPct);
    } else if (Number.isFinite(trendSummary?.latest?.returnPct)) {
        latestReturn = Number(trendSummary.latest.returnPct);
    }
    if (latestLabelKey && trendSummary?.aggregatedByType && trendSummary.aggregatedByType[latestLabelKey]) {
        const stats = trendSummary.aggregatedByType[latestLabelKey];
        if (latestReturn === null) {
            if (Number.isFinite(stats?.strategyReturnPct)) {
                latestReturn = Number(stats.strategyReturnPct);
            } else if (Number.isFinite(stats?.returnPct)) {
                latestReturn = Number(stats.returnPct);
            }
        }
        if (Number.isFinite(stats?.coveragePct)) latestCoverage = Number(stats.coveragePct);
    }

    const rollingScore = normaliseMetricNumber(rollingAggregate?.score);
    const rollingPassRate = normaliseMetricNumber(rollingAggregate?.passRate);
    const fallbackRollingScore = fallback ? normaliseMetricNumber(fallback.rollingScore) : null;
    const fallbackRollingPassRate = fallback ? normaliseMetricNumber(fallback.rollingPassRate) : null;
    const summaryText = typeof rollingAggregate?.summaryText === 'string'
        ? rollingAggregate.summaryText
        : (typeof fallback?.rollingSummaryText === 'string' ? fallback.rollingSummaryText : null);
    const generatedAt = typeof rollingState?.aggregateGeneratedAt === 'string'
        ? rollingState.aggregateGeneratedAt
        : (typeof fallback?.rollingGeneratedAt === 'string' ? fallback.rollingGeneratedAt : null);
    const rollingVersion = typeof rollingState?.version === 'string'
        ? rollingState.version
        : (typeof fallback?.rollingVersion === 'string' ? fallback.rollingVersion : null);

    const snapshot = {
        version: STRATEGY_COMPARISON_VERSION,
        capturedAt: new Date().toISOString(),
        annualizedReturn: normaliseMetricNumber(performance?.annualizedReturn),
        sharpeRatio: normaliseMetricNumber(performance?.sharpeRatio),
        maxDrawdown: normaliseMetricNumber(performance?.maxDrawdown),
        totalTrades: resolveTotalTradesMetric(performance),
        sensitivityScore: normaliseMetricNumber(sensitivitySummary?.stabilityScore),
        sensitivityAverageDrift: normaliseMetricNumber(sensitivitySummary?.averageDriftPercent),
        sensitivityScenarioCount: Number.isFinite(sensitivitySummary?.scenarioCount)
            ? Number(sensitivitySummary.scenarioCount)
            : null,
        rollingScore: rollingScore !== null ? rollingScore : fallbackRollingScore,
        rollingPassRate: rollingPassRate !== null ? rollingPassRate : fallbackRollingPassRate,
        rollingSummaryText: summaryText,
        rollingGeneratedAt: generatedAt,
        rollingVersion,
        trendLatestLabel: latestLabelKey || null,
        trendLatestDate: typeof trendSummary?.latest?.date === 'string' ? trendSummary.latest.date : null,
        trendLatestReturnPct: normaliseMetricNumber(latestReturn),
        trendLatestCoveragePct: normaliseMetricNumber(latestCoverage),
        trendAverageConfidence: normaliseMetricNumber(trendSummary?.averageConfidence),
    };

    return snapshot;
}

function loadStrategyComparisonPreferences() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = localStorage.getItem(STRATEGY_COMPARISON_SELECTION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            strategies: Array.isArray(parsed.strategies) ? parsed.strategies : [],
            metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
        };
    } catch (error) {
        console.warn('[StrategyCompare] 無法讀取偏好設定：', error);
        return null;
    }
}

function persistStrategyComparisonPreferences() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload = {
            strategies: Array.from(strategyComparisonState.selectedStrategies),
            metrics: Array.from(strategyComparisonState.selectedMetrics),
        };
        localStorage.setItem(STRATEGY_COMPARISON_SELECTION_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[StrategyCompare] 儲存偏好設定失敗：', error);
    }
}

function ensureStrategyComparisonInitialized() {
    if (strategyComparisonState.initialized) return;
    const config = getStrategyComparisonMetricConfig();
    config.forEach((item) => {
        if (item.defaultChecked) {
            strategyComparisonState.selectedMetrics.add(item.key);
        }
    });
    const saved = loadStrategyComparisonPreferences();
    if (saved) {
        if (Array.isArray(saved.metrics) && saved.metrics.length > 0) {
            strategyComparisonState.selectedMetrics = new Set(saved.metrics);
        }
        if (Array.isArray(saved.strategies) && saved.strategies.length > 0) {
            strategyComparisonState.selectedStrategies = new Set(saved.strategies);
        }
    }
    const tab = document.getElementById('strategy-compare-tab');
    if (tab) {
        tab.addEventListener('change', (event) => {
            const target = event.target;
            if (!target) return;
            if (target.matches('[data-strategy-selector]')) {
                const name = target.value;
                if (!name) return;
                if (target.checked) {
                    strategyComparisonState.selectedStrategies.add(name);
                } else {
                    strategyComparisonState.selectedStrategies.delete(name);
                }
                persistStrategyComparisonPreferences();
                updateStrategyComparisonTable();
            } else if (target.matches('[data-metric-selector]')) {
                const metricKey = target.value;
                if (!metricKey) return;
                if (target.checked) {
                    strategyComparisonState.selectedMetrics.add(metricKey);
                } else {
                    strategyComparisonState.selectedMetrics.delete(metricKey);
                }
                persistStrategyComparisonPreferences();
                updateStrategyComparisonTable();
            }
        });
    }
    strategyComparisonState.initialized = true;
}

document.addEventListener('DOMContentLoaded', ensureStrategyComparisonInitialized);

function refreshStrategyComparisonPanel(strategies) {
    ensureStrategyComparisonInitialized();
    const names = Array.isArray(strategies)
        ? strategies.slice()
        : (strategies ? Object.keys(strategies) : []);
    names.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const emptyEl = document.getElementById('strategy-comparison-empty');
    const controlsEl = document.getElementById('strategy-comparison-controls');
    if (!emptyEl || !controlsEl) return;
    if (names.length === 0) {
        emptyEl.classList.remove('hidden');
        controlsEl.classList.add('hidden');
        strategyComparisonState.selectedStrategies.clear();
        updateStrategyComparisonTable();
        return;
    }
    emptyEl.classList.add('hidden');
    controlsEl.classList.remove('hidden');
    ensureStrategyComparisonSelections(names);
    renderStrategyComparisonStrategyOptions(names);
    renderStrategyComparisonMetricOptions();
    updateStrategyComparisonTable();
}

function ensureStrategyComparisonSelections(strategyNames) {
    const available = new Set(strategyNames);
    const current = Array.from(strategyComparisonState.selectedStrategies);
    current.forEach((name) => {
        if (!available.has(name)) {
            strategyComparisonState.selectedStrategies.delete(name);
        }
    });
    if (strategyComparisonState.selectedStrategies.size === 0) {
        strategyNames.slice(0, Math.min(strategyNames.length, 3)).forEach((name) => {
            strategyComparisonState.selectedStrategies.add(name);
        });
    }
    const metricConfig = getStrategyComparisonMetricConfig();
    const validMetricKeys = new Set(metricConfig.map((item) => item.key));
    const selectedMetricKeys = Array.from(strategyComparisonState.selectedMetrics);
    selectedMetricKeys.forEach((key) => {
        if (!validMetricKeys.has(key)) {
            strategyComparisonState.selectedMetrics.delete(key);
        }
    });
    if (strategyComparisonState.selectedMetrics.size === 0) {
        metricConfig.forEach((item) => {
            if (item.defaultChecked) {
                strategyComparisonState.selectedMetrics.add(item.key);
            }
        });
    }
    persistStrategyComparisonPreferences();
}

function renderStrategyComparisonStrategyOptions(strategyNames) {
    const container = document.getElementById('strategy-comparison-strategy-options');
    if (!container) return;
    container.innerHTML = '';
    strategyComparisonState.lastRenderedStrategyNames = strategyNames.slice();
    strategyNames.forEach((name) => {
        const id = `strategy-compare-strategy-${normaliseTextKey(name)}`;
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-2 px-3 py-2 border rounded text-xs cursor-pointer transition-colors';
        wrapper.style.borderColor = 'var(--border)';
        wrapper.style.backgroundColor = 'var(--background)';
        wrapper.style.color = 'var(--foreground)';
        wrapper.title = name;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'h-4 w-4';
        checkbox.id = id;
        checkbox.value = name;
        checkbox.checked = strategyComparisonState.selectedStrategies.has(name);
        checkbox.setAttribute('data-strategy-selector', 'true');
        const label = document.createElement('span');
        label.className = 'font-medium truncate';
        label.textContent = name;
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
    });
}

function renderStrategyComparisonMetricOptions() {
    const container = document.getElementById('strategy-comparison-metric-options');
    if (!container) return;
    container.innerHTML = '';
    getStrategyComparisonMetricConfig().forEach((metric) => {
        const id = `strategy-compare-metric-${metric.key}`;
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-2 px-3 py-2 border rounded text-xs cursor-pointer transition-colors';
        wrapper.style.borderColor = 'var(--border)';
        wrapper.style.backgroundColor = 'var(--background)';
        wrapper.style.color = 'var(--foreground)';
        wrapper.title = metric.description || metric.label;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'h-4 w-4';
        checkbox.id = id;
        checkbox.value = metric.key;
        checkbox.checked = strategyComparisonState.selectedMetrics.has(metric.key);
        checkbox.setAttribute('data-metric-selector', 'true');
        const label = document.createElement('span');
        label.className = 'font-medium';
        label.textContent = metric.label;
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
    });
}

function updateStrategyComparisonTable() {
    const tableWrapper = document.getElementById('strategy-comparison-table-wrapper');
    const tableEmpty = document.getElementById('strategy-comparison-table-empty');
    const head = document.getElementById('strategy-comparison-table-head');
    const body = document.getElementById('strategy-comparison-table-body');
    if (!tableWrapper || !tableEmpty || !head || !body) return;
    const strategies = getSavedStrategies();
    const selectedStrategyNames = Array.from(strategyComparisonState.selectedStrategies)
        .filter((name) => Boolean(strategies?.[name]));
    const selectedMetricConfig = getStrategyComparisonMetricConfig()
        .filter((metric) => strategyComparisonState.selectedMetrics.has(metric.key));
    if (selectedStrategyNames.length === 0 || selectedMetricConfig.length === 0) {
        head.innerHTML = '';
        body.innerHTML = '';
        tableWrapper.classList.add('hidden');
        tableEmpty.classList.remove('hidden');
        tableEmpty.textContent = '請勾選至少一個策略與一個欄位，表格會即時更新。';
        return;
    }
    tableEmpty.classList.add('hidden');
    tableWrapper.classList.remove('hidden');
    const headerCells = ['<th class="px-3 py-2 text-left font-semibold" style="color: var(--muted-foreground);">指標</th>']
        .concat(selectedStrategyNames.map((name) => `<th class="px-3 py-2 text-left font-semibold" style="color: var(--foreground);">${escapeHtml(name)}</th>`));
    head.innerHTML = `<tr>${headerCells.join('')}</tr>`;
    const rows = selectedMetricConfig.map((metric) => {
        const cells = [`<td class="px-3 py-2 align-top font-medium" style="color: var(--foreground);">${escapeHtml(metric.label)}</td>`];
        selectedStrategyNames.forEach((name) => {
            const strategy = strategies[name];
            const metrics = strategy?.metrics || {};
            const valueText = formatStrategyComparisonValue(metric.key, metrics);
            const cell = `<td class="px-3 py-2 align-top text-xs" style="color: var(--muted-foreground);">${valueText}</td>`;
            cells.push(cell);
        });
        return `<tr>${cells.join('')}</tr>`;
    });
    body.innerHTML = rows.join('');
}

function formatStrategyComparisonValue(metricKey, metrics) {
    const placeholder = '<span style="color: var(--secondary);">請先測試後保存策略</span>';
    if (!metrics || typeof metrics !== 'object') return placeholder;
    switch (metricKey) {
        case 'annualizedReturn': {
            const value = normaliseMetricNumber(metrics.annualizedReturn);
            if (value === null) return placeholder;
            return formatPercentSigned(value, 2);
        }
        case 'sharpeRatio': {
            const value = normaliseMetricNumber(metrics.sharpeRatio);
            if (value === null) return placeholder;
            return value.toFixed(2);
        }
        case 'maxDrawdown': {
            const value = normaliseMetricNumber(metrics.maxDrawdown);
            if (value === null) return placeholder;
            return formatPercentPlain(value, 2);
        }
        case 'totalTrades': {
            const value = normaliseMetricNumber(metrics.totalTrades);
            if (value === null) return placeholder;
            return `${Math.round(value)} 筆`;
        }
        case 'sensitivityScore': {
            const score = normaliseMetricNumber(metrics.sensitivityScore);
            if (score === null) return placeholder;
            const drift = normaliseMetricNumber(metrics.sensitivityAverageDrift);
            const driftText = drift === null ? '平均漂移 —' : `平均漂移 ${Math.abs(drift).toFixed(1)}pp`;
            const scenarioCount = Number.isFinite(metrics.sensitivityScenarioCount)
                ? `樣本 ${metrics.sensitivityScenarioCount}`
                : null;
            const parts = [`${Math.round(score)} 分`, driftText];
            if (scenarioCount) parts.push(scenarioCount);
            return parts.join('｜');
        }
        case 'rollingScore': {
            const score = normaliseMetricNumber(metrics.rollingScore);
            if (score === null) {
                return placeholder;
            }
            return `${Math.round(score)} 分`;
        }
        case 'trendCurrent': {
            const label = resolveStrategyComparisonTrendLabel(metrics.trendLatestLabel);
            if (!label) return placeholder;
            const returnText = normaliseMetricNumber(metrics.trendLatestReturnPct);
            const confidenceRaw = normaliseMetricNumber(metrics.trendAverageConfidence);
            const parts = [label];
            if (returnText !== null) parts.push(`近況 ${formatPercentSigned(returnText, 2)}`);
            if (confidenceRaw === null) {
                return placeholder;
            }
            const confidencePercent = confidenceRaw > 1 ? confidenceRaw : confidenceRaw * 100;
            parts.push(`平均狀態信心 ${formatPercentPlain(confidencePercent, 1)}`);
            return parts.join('｜');
        }
        default:
            return placeholder;
    }
}

function resolveStrategyComparisonTrendLabel(labelKey) {
    if (!labelKey) return null;
    if (TREND_STYLE_MAP && TREND_STYLE_MAP[labelKey] && TREND_STYLE_MAP[labelKey].label) {
        return TREND_STYLE_MAP[labelKey].label;
    }
    return labelKey;
}

function migrateStrategySettings(settings) {
    if (!settings || typeof settings !== 'object') {
        return settings;
    }

    let changed = false;
    const migrated = { ...settings };

    if (settings.exitStrategy) {
        const normalizedExit = normaliseStrategyIdForRole('exit', settings.exitStrategy);
        if (normalizedExit && normalizedExit !== settings.exitStrategy) {
            migrated.exitStrategy = normalizedExit;
            changed = true;
        }
    }

    if (settings.shortEntryStrategy) {
        const normalizedShortEntry = normaliseStrategyIdForRole('shortEntry', settings.shortEntryStrategy);
        if (normalizedShortEntry && normalizedShortEntry !== settings.shortEntryStrategy) {
            migrated.shortEntryStrategy = normalizedShortEntry;
            changed = true;
        }
    }

    if (settings.shortExitStrategy) {
        const normalizedShortExit = normaliseStrategyIdForRole('shortExit', settings.shortExitStrategy);
        if (normalizedShortExit && normalizedShortExit !== settings.shortExitStrategy) {
            migrated.shortExitStrategy = normalizedShortExit;
            changed = true;
        }
    }

    return changed ? migrated : settings;
}

function getSavedStrategies() {
    const raw = localStorage.getItem(SAVED_STRATEGIES_KEY);
    if (!raw) {
        return {};
    }
    try {
        const parsed = raw ? JSON.parse(raw) : {};
        const cleaned = {};
        let mutated = false;
        for (const [name, data] of Object.entries(parsed)) {
            if (data && typeof data === 'object' && data.settings) {
                const migratedSettings = migrateStrategySettings(data.settings);
                if (migratedSettings !== data.settings) {
                    data.settings = migratedSettings;
                    mutated = true;
                }
                cleaned[name] = data;
            } else {
                mutated = true;
                console.warn(`[Storage] Removing corrupted strategy: ${name}`, data);
            }
        }
        if (mutated || Object.keys(cleaned).length !== Object.keys(parsed).length) {
            localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
    } catch (error) {
        console.error('讀取策略時解析JSON錯誤:', error);
        return {};
    }
}
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
                entryStages: settings.entryStages,
                entryStagingMode: settings.entryStagingMode,
                exitStrategy: settings.exitStrategy,
                exitParams: settings.exitParams,
                exitStages: settings.exitStages,
                exitStagingMode: settings.exitStagingMode,
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
            metrics: metrics,
            metricsVersion: STRATEGY_COMPARISON_VERSION
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

    refreshStrategyComparisonPanel(strategies);
}
function saveStrategy() { 
    // 生成預設策略名稱（使用中文名稱）
    const stockNo = document.getElementById('stockNo').value.trim().toUpperCase() || '2330';
    const entrySelect = document.getElementById('entryStrategy');
    const exitSelect = document.getElementById('exitStrategy');
    const entryStrategyRaw = entrySelect?.value || '';
    const exitStrategyRaw = exitSelect?.value || '';
    const entryStrategy = normaliseStrategyIdForRole('entry', entryStrategyRaw) || entryStrategyRaw;
    const exitStrategy = normaliseStrategyIdForRole('exit', exitStrategyRaw) || exitStrategyRaw;
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
    const exitStrategyName = strategyDescriptions[exitStrategy]?.name || exitStrategy;
    
    let defaultName = `${stockNo}_${entryStrategyName}_${exitStrategyName}`;
    if (enableShorting) {
        const shortEntrySelect = document.getElementById('shortEntryStrategy');
        const shortExitSelect = document.getElementById('shortExitStrategy');
        const shortEntryRaw = shortEntrySelect?.value || '';
        const shortExitRaw = shortExitSelect?.value || '';
        const shortEntryStrategy = normaliseStrategyIdForRole('shortEntry', shortEntryRaw) || shortEntryRaw;
        const shortExitStrategy = normaliseStrategyIdForRole('shortExit', shortExitRaw) || shortExitRaw;
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
    const existingMetrics = strategies[trimmedName]?.metrics || null;
    const currentMetrics = collectStrategyMetricSnapshot(existingMetrics);
    
    if (saveStrategyToLocalStorage(trimmedName, currentSettings, currentMetrics)) { 
        populateSavedStrategiesDropdown(); 
        showSuccess(`策略 "${trimmedName}" 已儲存！`); 
    }
}
function loadStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("請先從下拉選單選擇要載入的策略。"); return; } const strategies = getSavedStrategies(); const strategyData = strategies[strategyName]; if (!strategyData || !strategyData.settings) { showError(`載入策略 "${strategyName}" 失敗：找不到策略數據。`); return; } let settings = strategyData.settings; const migratedSettings = migrateStrategySettings(settings); if (migratedSettings !== settings) { settings = migratedSettings; strategyData.settings = migratedSettings; strategies[strategyName] = strategyData; localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(strategies)); } console.log(`[Main] Loading strategy: ${strategyName}`, settings); try { document.getElementById('stockNo').value = settings.stockNo || '2330'; setDefaultFees(settings.stockNo || '2330'); document.getElementById('startDate').value = settings.startDate || ''; document.getElementById('endDate').value = settings.endDate || ''; document.getElementById('initialCapital').value = settings.initialCapital || 100000; document.getElementById('recentYears').value = 5; const tradeTimingInput = document.querySelector(`input[name="tradeTiming"][value="${settings.tradeTiming || 'close'}"]`); if (tradeTimingInput) tradeTimingInput.checked = true; document.getElementById('buyFee').value = (settings.buyFee !== undefined) ? settings.buyFee : (document.getElementById('buyFee').value || 0.1425); document.getElementById('sellFee').value = (settings.sellFee !== undefined) ? settings.sellFee : (document.getElementById('sellFee').value || 0.4425); document.getElementById('positionSize').value = settings.positionSize || 100;
        if (window.lazybacktestStagedEntry) {
            if (Array.isArray(settings.entryStages) && settings.entryStages.length > 0 && typeof window.lazybacktestStagedEntry.setValues === 'function') {
                window.lazybacktestStagedEntry.setValues(settings.entryStages);
            } else if (typeof window.lazybacktestStagedEntry.resetToDefault === 'function') {
                window.lazybacktestStagedEntry.resetToDefault(settings.positionSize || 100);
            }
        }
        const entryModeSelect = document.getElementById('entryStagingMode');
        if (entryModeSelect) entryModeSelect.value = settings.entryStagingMode || 'signal_repeat';
        if (window.lazybacktestStagedExit) {
            if (Array.isArray(settings.exitStages) && settings.exitStages.length > 0 && typeof window.lazybacktestStagedExit.setValues === 'function') {
                window.lazybacktestStagedExit.setValues(settings.exitStages);
            } else if (typeof window.lazybacktestStagedExit.resetToDefault === 'function') {
                window.lazybacktestStagedExit.resetToDefault(100);
            }
        }
        const exitModeSelect = document.getElementById('exitStagingMode');
        if (exitModeSelect) exitModeSelect.value = settings.exitStagingMode || 'signal_repeat'; document.getElementById('stopLoss').value = settings.stopLoss ?? 0; document.getElementById('takeProfit').value = settings.takeProfit ?? 0; const positionBasisInput = document.querySelector(`input[name="positionBasis"][value="${settings.positionBasis || 'initialCapital'}"]`); if (positionBasisInput) positionBasisInput.checked = true; document.getElementById('entryStrategy').value = settings.entryStrategy || 'ma_cross'; updateStrategyParams('entry'); if(settings.entryParams) { for (const pName in settings.entryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; if (settings.entryStrategy === 'k_d_cross' && pName === 'thresholdX') finalIdSfx = 'KdThresholdX'; else if ((settings.entryStrategy === 'macd_cross') && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`entry${finalIdSfx}`); if (inputElement) inputElement.value = settings.entryParams[pName]; else console.warn(`[Load] Entry Param Input not found: entry${finalIdSfx}`); } } document.getElementById('exitStrategy').value = settings.exitStrategy || 'ma_cross'; updateStrategyParams('exit'); if(settings.exitParams) { for (const pName in settings.exitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(settings.exitStrategy)) ? `${settings.exitStrategy}_exit` : settings.exitStrategy; if (exitInternalKey === 'k_d_cross_exit' && pName === 'thresholdY') finalIdSfx = 'KdThresholdY'; else if (exitInternalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'StopLossPeriod'; else if (exitInternalKey === 'macd_cross_exit' && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`exit${finalIdSfx}`); if (inputElement) inputElement.value = settings.exitParams[pName]; else console.warn(`[Load] Exit Param Input not found: exit${finalIdSfx}`); } } const shortCheckbox = document.getElementById('enableShortSelling'); const shortArea = document.getElementById('short-strategy-area'); shortCheckbox.checked = settings.enableShorting || false; shortArea.style.display = shortCheckbox.checked ? 'grid' : 'none'; if (settings.enableShorting) { document.getElementById('shortEntryStrategy').value = settings.shortEntryStrategy || 'short_ma_cross'; updateStrategyParams('shortEntry'); if(settings.shortEntryParams) { for (const pName in settings.shortEntryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortEntryInternalKey = `short_${settings.shortEntryStrategy}`; if (shortEntryInternalKey === 'short_k_d_cross' && pName === 'thresholdY') finalIdSfx = 'ShortKdThresholdY'; else if (shortEntryInternalKey === 'short_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'ShortSignalPeriod'; else if (shortEntryInternalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'ShortStopLossPeriod'; const inputElement = document.getElementById(`shortEntry${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortEntryParams[pName]; else console.warn(`[Load] Short Entry Param Input not found: shortEntry${finalIdSfx}`); } } document.getElementById('shortExitStrategy').value = settings.shortExitStrategy || 'cover_ma_cross'; updateStrategyParams('shortExit'); if(settings.shortExitParams) { for (const pName in settings.shortExitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortExitInternalKey = `cover_${settings.shortExitStrategy}`; if (shortExitInternalKey === 'cover_k_d_cross' && pName === 'thresholdX') finalIdSfx = 'CoverKdThresholdX'; else if (shortExitInternalKey === 'cover_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'CoverSignalPeriod'; else if (shortExitInternalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') finalIdSfx = 'CoverBreakoutPeriod'; else if (shortExitInternalKey === 'cover_trailing_stop' && pName === 'percentage') finalIdSfx = 'CoverTrailingStopPercentage'; const inputElement = document.getElementById(`shortExit${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortExitParams[pName]; else console.warn(`[Load] Short Exit Param Input not found: shortExit${finalIdSfx}`); } } } else { document.getElementById('shortEntryStrategy').value = 'short_ma_cross'; updateStrategyParams('shortEntry'); document.getElementById('shortExitStrategy').value = 'cover_ma_cross'; updateStrategyParams('shortExit'); } showSuccess(`策略 "${strategyName}" 已載入！`); 
    
    // 顯示確認對話框並自動執行回測
    if (confirm(`策略參數已載入完成！\n\n是否立即執行回測以查看策略表現？`)) {
        // 自動執行回測
        setTimeout(() => {
            runBacktestInternal();
        }, 100);
    }
    
    lastOverallResult = null; lastSubPeriodResults = null; } catch (error) { console.error(`載入策略 "${strategyName}" 時發生錯誤:`, error); showError(`載入策略失敗: ${error.message}`); } }
function deleteStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("請先從下拉選單選擇要刪除的策略。"); return; } if (confirm(`確定要刪除策略 "${strategyName}" 嗎？此操作無法復原。`)) { if (deleteStrategyFromLocalStorage(strategyName)) { populateSavedStrategiesDropdown(); showSuccess(`策略 "${strategyName}" 已刪除！`); } } }
function randomizeSettings() { const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)]; const getRandomValue = (min, max, step) => { if (step === undefined || step === 0) step = 1; const range = max - min; if (range <= 0 && step > 0) return min; if (step <= 0) return min; const steps = Math.max(0, Math.floor(range / step)); const randomStep = Math.floor(Math.random() * (steps + 1)); let value = min + randomStep * step; if (step.toString().includes('.')) { const precision = step.toString().split('.')[1].length; value = parseFloat(value.toFixed(precision)); } return Math.max(min, Math.min(max, value)); }; const allKeys = Object.keys(strategyDescriptions); const entryKeys = allKeys.filter(k => !k.startsWith('short_') && !k.startsWith('cover_') && !k.endsWith('_exit') && k !== 'fixed_stop_loss'); const exitKeysRaw = allKeys.filter(k => (k.endsWith('_exit') || ['ma_below', 'rsi_overbought', 'bollinger_reversal', 'trailing_stop', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss', 'fixed_stop_loss'].includes(k)) && !k.startsWith('short_') && !k.startsWith('cover_')); const exitKeys = exitKeysRaw.map(k => k.replace('_exit', '')).filter(k => k !== 'fixed_stop_loss'); const shortEntryKeys = allKeys.filter(k => k.startsWith('short_') && k !== 'short_fixed_stop_loss'); const coverKeys = allKeys.filter(k => k.startsWith('cover_') && k !== 'cover_fixed_stop_loss'); const setRandomParams = (type, strategyKey) => { let internalKey = strategyKey; if (type === 'exit' && ['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(strategyKey)) internalKey = `${strategyKey}_exit`; else if (type === 'shortEntry') { if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(strategyKey)) internalKey = `short_${strategyKey}`; } else if (type === 'shortExit') { if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(strategyKey)) internalKey = `cover_${strategyKey}`; } const config = strategyDescriptions[internalKey]; if (!config || !config.defaultParams) return; let params = {}; for (const pName in config.defaultParams) { const target = config.optimizeTargets?.find(t => t.name === pName); let randomVal; if (target?.range) { randomVal = getRandomValue(target.range.from, target.range.to, target.range.step); } else { if (pName.includes('Period') || pName.includes('period')) randomVal = getRandomValue(5, 100, 1); else if (pName === 'threshold' && internalKey.includes('rsi')) randomVal = getRandomValue(10, 90, 1); else if (pName === 'threshold' && internalKey.includes('williams')) randomVal = getRandomValue(-90, -10, 1); else if (pName === 'thresholdX' || pName === 'thresholdY') randomVal = getRandomValue(10, 90, 1); else if (pName === 'deviations') randomVal = getRandomValue(1, 3, 0.1); else if (pName === 'multiplier') randomVal = getRandomValue(1.5, 5, 0.1); else if (pName === 'percentage') randomVal = getRandomValue(1, 25, 0.5); else randomVal = config.defaultParams[pName]; } params[pName] = randomVal; } if (['ma_cross', 'ema_cross', 'short_ma_cross', 'short_ema_cross', 'cover_ma_cross', 'cover_ema_cross'].some(prefix => internalKey.startsWith(prefix))) { if (params.shortPeriod && params.longPeriod && params.shortPeriod >= params.longPeriod) { params.shortPeriod = getRandomValue(3, Math.max(4, params.longPeriod - 1), 1); console.log(`[Random] Adjusted ${type} shortPeriod to ${params.shortPeriod} (long: ${params.longPeriod})`); } } for (const pName in params) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY'; else if (internalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX'; else if (internalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod'; else if (internalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod'; else if (internalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod'; else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod'; else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage'; const inputId = `${type}${idSfx}`; const inputEl = document.getElementById(inputId); if (inputEl) { inputEl.value = params[pName]; } else { console.warn(`[Random] Input element not found for ${type} - ${pName}: #${inputId}`); } } }; const randomEntryKey = getRandomElement(entryKeys); const randomExitKey = getRandomElement(exitKeys); document.getElementById('entryStrategy').value = randomEntryKey; document.getElementById('exitStrategy').value = randomExitKey; updateStrategyParams('entry'); updateStrategyParams('exit'); setRandomParams('entry', randomEntryKey); setRandomParams('exit', randomExitKey); if (document.getElementById('enableShortSelling').checked) { const randomShortEntryKey = getRandomElement(shortEntryKeys); const randomCoverKey = getRandomElement(coverKeys); document.getElementById('shortEntryStrategy').value = randomShortEntryKey; document.getElementById('shortExitStrategy').value = randomCoverKey; updateStrategyParams('shortEntry'); updateStrategyParams('shortExit'); setRandomParams('shortEntry', randomShortEntryKey.replace('short_', '')); setRandomParams('shortExit', randomCoverKey.replace('cover_', '')); } showSuccess("策略與參數已隨機設定！"); }

// --- 市場切換和股票代碼智慧功能 ---

// 全域變數
let currentMarket = 'TWSE'; // 預設為上市
updateAIBridgeMarket(currentMarket);
let isAutoSwitching = false; // 防止無限重複切換
// Patch Tag: LB-TW-NAMELOCK-20250616A
let manualMarketOverride = false; // 使用者手動鎖定市場時停用自動辨識
let manualOverrideCodeSnapshot = ''; // 紀錄觸發鎖定時的股票代碼
let isFetchingName = false; // 防止重複查詢股票名稱
// Patch Tag: LB-US-NAMECACHE-20250622A
const stockNameLookupCache = new Map(); // Map<cacheKey, { info, cachedAt }>
const STOCK_NAME_CACHE_LIMIT = 4096;
const STOCK_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 小時記憶體快取
const LOCAL_STOCK_NAME_CACHE_KEY = 'LB_TW_NAME_CACHE_V20250620A';
const LOCAL_STOCK_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 台股名稱保留 7 天
const LOCAL_US_NAME_CACHE_KEY = 'LB_US_NAME_CACHE_V20250622A';
const LOCAL_US_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 美股名稱保留 3 天
const TAIWAN_DIRECTORY_CACHE_KEY = 'LB_TW_DIRECTORY_CACHE_V20250620A';
const TAIWAN_DIRECTORY_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 台股官方清單 24 小時過期
const TAIWAN_DIRECTORY_VERSION = 'LB-TW-DIRECTORY-20250620A';
const MIN_STOCK_LOOKUP_LENGTH = 4;
const STOCK_NAME_DEBOUNCE_MS = 800;
const persistentTaiwanNameCache = loadPersistentTaiwanNameCache();
const persistentUSNameCache = loadPersistentUSNameCache();
const taiwanDirectoryState = {
    ready: false,
    loading: false,
    version: null,
    updatedAt: null,
    source: null,
    cache: null,
    cachedAt: null,
    entries: new Map(),
    lastError: null,
};
let taiwanDirectoryReadyPromise = null;
hydrateTaiwanNameCache();
hydrateUSNameCache();
preloadTaiwanDirectory({ skipNetwork: true }).catch((error) => {
    console.warn('[Taiwan Directory] 本地清單預載失敗:', error);
});

// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-NAME-CACHE-20250614A
const MARKET_META = {
    TWSE: { label: '上市', fetchName: fetchStockNameFromTWSE },
    TPEX: { label: '上櫃', fetchName: fetchStockNameFromTPEX },
    US: { label: '美股', fetchName: fetchStockNameFromUS },
    INDEX: { label: '指數', fetchName: fetchStockNameFromIndex },
};

function loadPersistentTaiwanNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(LOCAL_STOCK_NAME_CACHE_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const map = new Map();
        if (Array.isArray(parsed)) {
            for (const entry of parsed) {
                if (!entry || typeof entry !== 'object') continue;
                const { key, info, cachedAt } = entry;
                if (!key || !info || !info.name) continue;
                const stampedAt = typeof cachedAt === 'number' ? cachedAt : now;
                if (now - stampedAt > LOCAL_STOCK_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info, cachedAt: stampedAt });
            }
        } else if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object') continue;
                if (!value.info || !value.info.name) continue;
                const stampedAt = typeof value.cachedAt === 'number' ? value.cachedAt : now;
                if (now - stampedAt > LOCAL_STOCK_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info: value.info, cachedAt: stampedAt });
            }
        }
        return map;
    } catch (error) {
        console.warn('[Stock Name] 無法載入台股名稱快取:', error);
        return new Map();
    }
}

function loadPersistentUSNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(LOCAL_US_NAME_CACHE_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const map = new Map();
        if (Array.isArray(parsed)) {
            for (const entry of parsed) {
                if (!entry || typeof entry !== 'object') continue;
                const { key, info, cachedAt } = entry;
                if (!key || !info || !info.name) continue;
                const stampedAt = typeof cachedAt === 'number' ? cachedAt : now;
                if (now - stampedAt > LOCAL_US_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info, cachedAt: stampedAt });
            }
        } else if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object') continue;
                if (!value.info || !value.info.name) continue;
                const stampedAt = typeof value.cachedAt === 'number' ? value.cachedAt : now;
                if (now - stampedAt > LOCAL_US_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info: value.info, cachedAt: stampedAt });
            }
        }
        return map;
    } catch (error) {
        console.warn('[Stock Name] 無法載入美股名稱快取:', error);
        return new Map();
    }
}

function hydrateTaiwanNameCache() {
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    if (persistentTaiwanNameCache.size === 0) return;
    let removed = false;
    const now = Date.now();
    for (const [key, entry] of persistentTaiwanNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentTaiwanNameCache.delete(key);
            removed = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_STOCK_NAME_CACHE_TTL_MS) {
            persistentTaiwanNameCache.delete(key);
            removed = true;
            continue;
        }
        if (!stockNameLookupCache.has(key)) {
            stockNameLookupCache.set(key, { info: entry.info, cachedAt: entry.cachedAt });
        }
    }
    if (removed) {
        savePersistentTaiwanNameCache();
    }
}

function hydrateUSNameCache() {
    if (!(persistentUSNameCache instanceof Map)) return;
    if (persistentUSNameCache.size === 0) return;
    let removed = false;
    const now = Date.now();
    for (const [key, entry] of persistentUSNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentUSNameCache.delete(key);
            removed = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_US_NAME_CACHE_TTL_MS) {
            persistentUSNameCache.delete(key);
            removed = true;
            continue;
        }
        if (!stockNameLookupCache.has(key)) {
            stockNameLookupCache.set(key, { info: entry.info, cachedAt: entry.cachedAt });
        }
    }
    if (removed) {
        savePersistentUSNameCache();
    }
}

function savePersistentTaiwanNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    try {
        const payload = Array.from(persistentTaiwanNameCache.entries()).map(([key, value]) => ({
            key,
            info: value.info,
            cachedAt: value.cachedAt,
        }));
        window.localStorage.setItem(LOCAL_STOCK_NAME_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Stock Name] 無法寫入台股名稱快取:', error);
    }
}

function savePersistentUSNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!(persistentUSNameCache instanceof Map)) return;
    try {
        const payload = Array.from(persistentUSNameCache.entries()).map(([key, value]) => ({
            key,
            info: value.info,
            cachedAt: value.cachedAt,
        }));
        window.localStorage.setItem(LOCAL_US_NAME_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Stock Name] 無法寫入美股名稱快取:', error);
    }
}

function prunePersistentTaiwanNameCache() {
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    const now = Date.now();
    let mutated = false;
    for (const [key, entry] of persistentTaiwanNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentTaiwanNameCache.delete(key);
            mutated = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_STOCK_NAME_CACHE_TTL_MS) {
            persistentTaiwanNameCache.delete(key);
            mutated = true;
        }
    }
    while (persistentTaiwanNameCache.size > STOCK_NAME_CACHE_LIMIT) {
        const oldest = persistentTaiwanNameCache.keys().next().value;
        if (!oldest) break;
        persistentTaiwanNameCache.delete(oldest);
        mutated = true;
    }
    if (mutated) {
        savePersistentTaiwanNameCache();
    }
}

function prunePersistentUSNameCache() {
    if (!(persistentUSNameCache instanceof Map)) return;
    const now = Date.now();
    let mutated = false;
    for (const [key, entry] of persistentUSNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentUSNameCache.delete(key);
            mutated = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_US_NAME_CACHE_TTL_MS) {
            persistentUSNameCache.delete(key);
            mutated = true;
        }
    }
    while (persistentUSNameCache.size > STOCK_NAME_CACHE_LIMIT) {
        const oldest = persistentUSNameCache.keys().next().value;
        if (!oldest) break;
        persistentUSNameCache.delete(oldest);
        mutated = true;
    }
    if (mutated) {
        savePersistentUSNameCache();
    }
}

function persistTaiwanNameCacheEntry(key, entry) {
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    if (!key || !entry || !entry.info || !entry.info.name) return;
    persistentTaiwanNameCache.set(key, entry);
    prunePersistentTaiwanNameCache();
    savePersistentTaiwanNameCache();
}

function persistUSNameCacheEntry(key, entry) {
    if (!(persistentUSNameCache instanceof Map)) return;
    if (!key || !entry || !entry.info || !entry.info.name) return;
    persistentUSNameCache.set(key, entry);
    prunePersistentUSNameCache();
    savePersistentUSNameCache();
}

function removePersistentUSNameCacheEntry(key) {
    if (!(persistentUSNameCache instanceof Map)) return;
    if (!key) return;
    if (persistentUSNameCache.delete(key)) {
        savePersistentUSNameCache();
    }
}

function createStockNameCacheKey(market, stockCode) {
    const normalizedMarket = normalizeMarketValue(typeof market === 'string' ? market : '');
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    if (!normalizedMarket || !normalizedCode) return null;
    return `${normalizedMarket}|${normalizedCode}`;
}

function getLeadingDigitCount(symbol) {
    if (!symbol) return 0;
    const match = symbol.match(/^\d+/);
    return match ? match[0].length : 0;
}

function isIndexTicker(symbol) {
    if (!symbol) return false;
    return symbol.startsWith('^') && symbol.length > 1;
}

function shouldEnforceNumericLookupGate(symbol) {
    if (!symbol) return false;
    return /^\d/.test(symbol);
}

function shouldRestrictToTaiwanMarkets(symbol) {
    if (!symbol) return false;
    const normalized = symbol.trim().toUpperCase();
    if (normalized.length < MIN_STOCK_LOOKUP_LENGTH) return false;
    const prefix = normalized.slice(0, MIN_STOCK_LOOKUP_LENGTH);
    return /^\d{4}$/.test(prefix);
}

function isTaiwanMarket(market) {
    const normalized = normalizeMarketValue(market || '');
    return normalized === 'TWSE' || normalized === 'TPEX';
}

function isStockNameCacheEntryFresh(entry, ttlMs) {
    if (!entry) return false;
    if (!ttlMs || !Number.isFinite(ttlMs) || ttlMs <= 0) return true;
    const cachedAt = typeof entry.cachedAt === 'number' ? entry.cachedAt : 0;
    if (!cachedAt) return true;
    return Date.now() - cachedAt <= ttlMs;
}

function storeStockNameCacheEntry(market, stockCode, info, options = {}) {
    const key = createStockNameCacheKey(market, stockCode);
    if (!key || !info || !info.name) return;
    const now = Date.now();
    if (stockNameLookupCache.has(key)) {
        stockNameLookupCache.delete(key);
    }
    const entry = { info, cachedAt: now };
    stockNameLookupCache.set(key, entry);
    while (stockNameLookupCache.size > STOCK_NAME_CACHE_LIMIT) {
        const oldest = stockNameLookupCache.keys().next().value;
        if (!oldest) break;
        stockNameLookupCache.delete(oldest);
    }
    const normalizedMarket = normalizeMarketValue(market);
    if (isTaiwanMarket(normalizedMarket) && options.persist !== false) {
        persistTaiwanNameCacheEntry(key, entry);
    } else if (normalizedMarket === 'US' && options.persist !== false) {
        persistUSNameCacheEntry(key, entry);
    }
}

function loadTaiwanDirectoryFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(TAIWAN_DIRECTORY_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const cachedAt = typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0;
        if (cachedAt && Date.now() - cachedAt > TAIWAN_DIRECTORY_CACHE_TTL_MS) {
            return null;
        }
        const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
        return {
            version: parsed.version || null,
            updatedAt: parsed.updatedAt || null,
            source: parsed.source || null,
            cache: parsed.cache || null,
            entries,
            cachedAt,
        };
    } catch (error) {
        console.warn('[Taiwan Directory] 無法讀取本地清單快取:', error);
        return null;
    }
}

function saveTaiwanDirectoryToStorage(payload) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!payload) return;
    try {
        const cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : Date.now();
        const record = {
            version: payload.version || null,
            updatedAt: payload.updatedAt || null,
            source: payload.source || null,
            entries: Array.isArray(payload.entries) ? payload.entries : [],
            cachedAt,
            cache: payload.cache || null,
        };
        window.localStorage.setItem(TAIWAN_DIRECTORY_CACHE_KEY, JSON.stringify(record));
    } catch (error) {
        console.warn('[Taiwan Directory] 無法寫入本地清單快取:', error);
    }
}

function normaliseDirectoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const stockId = (entry.stockId || entry.stock_id || '').toString().trim().toUpperCase();
    const name = (entry.name || entry.stock_name || '').toString().trim();
    if (!stockId || !name) return null;
    const market = entry.market ? normalizeMarketValue(entry.market) : null;
    const board = entry.board || (market === 'TWSE' ? '上市' : market === 'TPEX' ? '上櫃' : null);
    const instrumentType = entry.instrumentType || (entry.isETF ? 'ETF' : null);
    const isETF = entry.isETF === true || /^00\d{2,4}$/.test(stockId);
    const marketCategory = entry.marketCategory || entry.rawType || null;
    return {
        stockId,
        name,
        market,
        board,
        instrumentType,
        isETF,
        marketCategory,
    };
}

function applyTaiwanDirectoryPayload(payload, options = {}) {
    if (!payload) return false;
    const seedCache = options.seedCache !== false;
    const rawEntries = Array.isArray(payload.entries)
        ? payload.entries
        : Array.isArray(payload.data)
            ? payload.data
            : payload.data && typeof payload.data === 'object'
                ? Object.values(payload.data)
                : payload.entries && typeof payload.entries === 'object'
                    ? Object.values(payload.entries)
                    : [];
    const map = new Map();
    const sourceLabel = payload.source || '台股官方清單';
    const versionLabel = payload.version ? `${sourceLabel}｜${payload.version}` : sourceLabel;

    for (const raw of rawEntries) {
        const entry = normaliseDirectoryEntry(raw);
        if (!entry) continue;
        map.set(entry.stockId, entry);

        if (seedCache && entry.market) {
            const info = {
                name: entry.name,
                board: entry.board,
                instrumentType: entry.instrumentType,
                marketCategory: entry.marketCategory,
                market: entry.market,
                sourceLabel: versionLabel,
                matchStrategy: 'taiwan-directory',
                directoryVersion: payload.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: entry.stockId,
                infoSource: sourceLabel,
            };
            storeStockNameCacheEntry(entry.market, entry.stockId, info, { persist: false });
        }
    }

    if (map.size === 0) return false;

    taiwanDirectoryState.entries = map;
    taiwanDirectoryState.version = payload.version || TAIWAN_DIRECTORY_VERSION;
    taiwanDirectoryState.updatedAt = payload.updatedAt || payload.fetchedAt || null;
    taiwanDirectoryState.source = sourceLabel;
    taiwanDirectoryState.cache = payload.cache || null;
    taiwanDirectoryState.cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : Date.now();
    taiwanDirectoryState.ready = true;
    taiwanDirectoryState.lastError = null;

    if (options.persist !== false) {
        const storedEntries = Array.from(map.values()).map((entry) => ({
            stockId: entry.stockId,
            name: entry.name,
            market: entry.market,
            board: entry.board,
            instrumentType: entry.instrumentType,
            isETF: entry.isETF,
            marketCategory: entry.marketCategory,
        }));
        saveTaiwanDirectoryToStorage({
            version: taiwanDirectoryState.version,
            updatedAt: taiwanDirectoryState.updatedAt,
            source: taiwanDirectoryState.source,
            entries: storedEntries,
            cache: taiwanDirectoryState.cache,
            cachedAt: taiwanDirectoryState.cachedAt,
        });
    }

    return true;
}

async function preloadTaiwanDirectory(options = {}) {
    if (taiwanDirectoryState.ready && !options.forceRefresh) {
        return taiwanDirectoryState;
    }
    if (taiwanDirectoryState.loading) {
        return taiwanDirectoryReadyPromise || taiwanDirectoryState;
    }

    taiwanDirectoryState.loading = true;

    try {
        if (!options.forceRefresh) {
            const stored = loadTaiwanDirectoryFromStorage();
            if (stored) {
                applyTaiwanDirectoryPayload(
                    {
                        version: stored.version,
                        updatedAt: stored.updatedAt,
                        source: stored.source,
                        cache: stored.cache,
                        entries: stored.entries,
                        cachedAt: stored.cachedAt,
                    },
                    { seedCache: options.seedCache !== false, persist: false },
                );
            }
            if (taiwanDirectoryState.ready && options.skipNetwork) {
                return taiwanDirectoryState;
            }
        }

        if (options.skipNetwork) {
            return taiwanDirectoryState;
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 16000) : null;
        const response = await fetch('/.netlify/functions/taiwan-directory', {
            signal: controller?.signal,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!payload || payload.status === 'error') {
            throw new Error(payload?.message || '台股官方清單回應異常');
        }
        const entries = payload.data && typeof payload.data === 'object' ? Object.values(payload.data) : [];
        applyTaiwanDirectoryPayload(
            {
                version: payload.version || null,
                updatedAt: payload.updatedAt || null,
                source: payload.source || null,
                cache: payload.cache || null,
                entries,
                cachedAt: Date.now(),
            },
            { seedCache: options.seedCache !== false },
        );
        recordTaiwanDirectoryBlobUsage(payload.cache || null);
    } catch (error) {
        taiwanDirectoryState.lastError = error;
        console.warn('[Taiwan Directory] 載入失敗:', error);
    } finally {
        taiwanDirectoryState.loading = false;
    }

    return taiwanDirectoryState;
}

function ensureTaiwanDirectoryReady(options = {}) {
    if (taiwanDirectoryState.ready && !options.forceRefresh) {
        return Promise.resolve(taiwanDirectoryState);
    }
    if (!taiwanDirectoryReadyPromise) {
        taiwanDirectoryReadyPromise = preloadTaiwanDirectory(options).finally(() => {
            taiwanDirectoryReadyPromise = null;
        });
    }
    return taiwanDirectoryReadyPromise;
}

function getTaiwanDirectoryEntry(stockCode) {
    if (!stockCode) return null;
    const normalized = stockCode.trim().toUpperCase();
    if (!normalized) return null;
    if (!(taiwanDirectoryState.entries instanceof Map)) return null;
    return taiwanDirectoryState.entries.get(normalized) || null;
}

function resolveCachedStockNameInfo(stockCode, preferredMarket) {
    const normalized = (stockCode || '').trim().toUpperCase();
    if (!normalized) return null;
    const candidateMarkets = preferredMarket
        ? [normalizeMarketValue(preferredMarket), 'TWSE', 'TPEX', 'US']
        : ['TWSE', 'TPEX', 'US'];
    const cacheHit = findStockNameCacheEntry(normalized, candidateMarkets.filter(Boolean));
    if (cacheHit && cacheHit.info) {
        return {
            market: cacheHit.market,
            info: cacheHit.info,
        };
    }
    const directoryEntry = getTaiwanDirectoryEntry(normalized);
    if (directoryEntry) {
        return {
            market: directoryEntry.market || preferredMarket || null,
            info: {
                name: directoryEntry.name,
                board: directoryEntry.board,
                instrumentType: directoryEntry.instrumentType,
                marketCategory: directoryEntry.marketCategory,
                sourceLabel: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `｜${taiwanDirectoryState.version}` : ''}`
                    : '台股官方清單',
                infoSource: taiwanDirectoryState.source || 'Taiwan Directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                market: directoryEntry.market || preferredMarket || null,
            },
        };
    }
    return null;
}

function findStockNameCacheEntry(stockCode, markets) {
    if (!Array.isArray(markets) || markets.length === 0) return null;
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    if (!normalizedCode) return null;
    for (const market of markets) {
        const key = createStockNameCacheKey(market, normalizedCode);
        if (!key) continue;
        const entry = stockNameLookupCache.get(key);
        if (entry && entry.info && entry.info.name) {
            const normalizedMarket = normalizeMarketValue(market);
            const ttl = isTaiwanMarket(normalizedMarket)
                ? LOCAL_STOCK_NAME_CACHE_TTL_MS
                : normalizedMarket === 'US'
                    ? LOCAL_US_NAME_CACHE_TTL_MS
                    : STOCK_NAME_CACHE_TTL_MS;
            if (!isStockNameCacheEntryFresh(entry, ttl)) {
                stockNameLookupCache.delete(key);
                if (isTaiwanMarket(normalizedMarket) && persistentTaiwanNameCache instanceof Map) {
                    persistentTaiwanNameCache.delete(key);
                    savePersistentTaiwanNameCache();
                } else if (normalizedMarket === 'US') {
                    removePersistentUSNameCacheEntry(key);
                }
                continue;
            }
            return { market: normalizedMarket, info: entry.info, cachedAt: entry.cachedAt };
        }
    }
    return null;
}

function isLikelyTaiwanETF(symbol) {
    const normalized = (symbol || '').trim().toUpperCase();
    if (!normalized.startsWith('00')) return false;
    const base = normalized.replace(/[A-Z]$/, '');
    return /^\d{4,6}$/.test(base);
}

function deriveNameSourceLabel(market) {
    const normalized = normalizeMarketValue(market || '');
    if (normalized === 'US') return 'FinMind USStockInfo';
    if (normalized === 'TPEX') return 'TPEX 公開資訊';
    if (normalized === 'TWSE') return 'TWSE 日成交資訊';
    return '';
}

function getMarketDisplayName(market) {
    return MARKET_META[market]?.label || market;
}

function resolveStockNameSearchOrder(stockCode, preferredMarket) {
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    const hasAlpha = /[A-Z]/.test(normalizedCode);
    const isNumeric = /^\d+$/.test(normalizedCode);
    const leadingDigits = getLeadingDigitCount(normalizedCode);
    const startsWithFourDigits = leadingDigits >= MIN_STOCK_LOOKUP_LENGTH;
    const restrictToTaiwan = shouldRestrictToTaiwanMarkets(normalizedCode);
    const preferred = normalizeMarketValue(preferredMarket || '');
    const baseOrder = [];
    if (isIndexTicker(normalizedCode)) {
        baseOrder.push('INDEX');
    }
    if (restrictToTaiwan || startsWithFourDigits) {
        baseOrder.push('TWSE', 'TPEX');
    } else if (hasAlpha && !isNumeric && leadingDigits === 0) {
        baseOrder.push('US', 'TWSE', 'TPEX');
    } else {
        baseOrder.push('TWSE', 'TPEX', 'US');
    }
    const order = [];
    const seen = new Set();
    const push = (market) => {
        const normalized = normalizeMarketValue(market || '');
        if (!normalized || seen.has(normalized) || !MARKET_META[normalized]) return;
        if (restrictToTaiwan && !isTaiwanMarket(normalized)) return;
        seen.add(normalized);
        order.push(normalized);
    };
    push(preferred);
    baseOrder.forEach(push);
    return order;
}

function normalizeStockNameResult(result, context = {}) {
    if (!result) return null;
    const stockCode = (context.stockCode || '').trim().toUpperCase();
    const market = normalizeMarketValue(context.market || currentMarket || 'TWSE');
    const defaultSource = deriveNameSourceLabel(market);

    if (typeof result === 'string') {
        const trimmed = result.trim();
        if (!trimmed) return null;
        return {
            name: trimmed,
            market,
            board: MARKET_META[market]?.label || market,
            sourceLabel: defaultSource,
            symbol: stockCode || trimmed,
        };
    }

    if (typeof result !== 'object') return null;
    if (result.error) return null;

    const name = (result.name || result.stockName || result.stock_name || result.fullName || '').toString().trim();
    if (!name) return null;

    const info = {
        name,
        market: result.market ? normalizeMarketValue(result.market) : market,
        board: result.board || result.marketLabel || result.marketType || MARKET_META[market]?.label || market,
        instrumentType: result.instrumentType || result.securityType || result.type || null,
        marketCategory: result.marketCategory || result.marketCategoryName || result.exchange || null,
        sourceLabel: result.source || result.sourceLabel || result.infoSource || defaultSource,
        symbol: (result.symbol || result.stockNo || result.stock_id || result.stockId || result.data_id || result.ticker || stockCode || '').toString().toUpperCase(),
        matchStrategy: result.matchStrategy || null,
        resolvedSymbol: result.resolvedSymbol || null,
        directoryVersion: result.directoryVersion || result.directory_version || null,
        infoSource: result.infoSource || result.info_source || null,
    };

    if ((result.isETF || result.etf === true) && !info.instrumentType) {
        info.instrumentType = 'ETF';
    }

    if (!info.instrumentType && info.market !== 'US' && isLikelyTaiwanETF(stockCode)) {
        info.instrumentType = 'ETF';
    }

    return info;
}

function formatStockNameDisplay(info, options = {}) {
    if (!info || !info.name) return null;
    const classificationParts = [];
    const marketLabel = info.market ? getMarketDisplayName(info.market) : null;
    if (marketLabel) classificationParts.push(marketLabel);
    else if (info.board) classificationParts.push(info.board);
    if (info.instrumentType) classificationParts.push(info.instrumentType);
    if (info.marketCategory) classificationParts.push(info.marketCategory);
    const uniqueClassification = [...new Set(classificationParts.filter(Boolean))];

    const suffixParts = [];
    if (options.autoSwitched && options.targetLabel) {
        suffixParts.push(`已切換至${options.targetLabel}`);
    }
    if (options.fromCache) {
        suffixParts.push('快取');
    }

    const main = `${info.name}${uniqueClassification.length > 0 ? `（${uniqueClassification.join('・')}）` : ''}`;
    const suffix = suffixParts.length > 0 ? `（${suffixParts.join('・')}）` : '';

    return {
        text: `${main}${suffix}`,
        sourceLabel: info.sourceLabel || '',
    };
}

function composeStockNameText(display, fallback = '') {
    if (!display) return fallback;
    return display.text || fallback;
}

// 初始化市場切換功能
function initializeMarketSwitch() {
    const marketSelect = document.getElementById('marketSelect');
    const stockNoInput = document.getElementById('stockNo');

    if (!marketSelect || !stockNoInput) return;

    currentMarket = normalizeMarketValue(marketSelect.value || 'TWSE');
    updateAIBridgeMarket(currentMarket);
    window.applyMarketPreset?.(currentMarket);

    marketSelect.addEventListener('change', () => {
        const nextMarket = normalizeMarketValue(marketSelect.value || 'TWSE');
        if (currentMarket === nextMarket) return;

        const triggeredByAuto = isAutoSwitching === true;
        currentMarket = nextMarket;
        updateAIBridgeMarket(currentMarket);
        console.log(`[Market Switch] 切換到: ${currentMarket}`);
        if (triggeredByAuto) {
            manualMarketOverride = false;
            manualOverrideCodeSnapshot = '';
        } else {
            manualMarketOverride = true;
            manualOverrideCodeSnapshot = (stockNoInput.value || '').trim().toUpperCase();
        }
        window.applyMarketPreset?.(currentMarket);
        window.refreshDataSourceTester?.();

        if (!triggeredByAuto) {
            hideStockName();
        }

        const stockCode = stockNoInput.value.trim().toUpperCase();
        if (stockCode && stockCode !== 'TAIEX') {
            debouncedFetchStockName(stockCode, { force: true, immediate: true });
        }
        setDefaultFees(stockCode);
    });

    stockNoInput.addEventListener('input', function() {
        const stockCode = this.value.trim().toUpperCase();
        if (manualMarketOverride && stockCode !== manualOverrideCodeSnapshot) {
            manualMarketOverride = false;
            manualOverrideCodeSnapshot = '';
        }
        manualOverrideCodeSnapshot = stockCode;
        hideStockName();
        if (stockCode === 'TAIEX') {
            showStockName('台灣加權指數', 'success');
            return;
        }
        if (stockCode) {
            debouncedFetchStockName(stockCode);
        }
    });

    stockNoInput.addEventListener('blur', function() {
        const stockCode = this.value.trim().toUpperCase();
        if (stockCode && stockCode !== 'TAIEX') {
            debouncedFetchStockName(stockCode, { force: true, immediate: true });
        }
    });
}

// 防抖函數 - 避免頻繁 API 請求
let stockNameTimeout;
function debouncedFetchStockName(stockCode, options = {}) {
    clearTimeout(stockNameTimeout);
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    if (!normalizedCode || normalizedCode === 'TAIEX') return;
    const enforceGate = shouldEnforceNumericLookupGate(normalizedCode);
    if (!options.force && enforceGate) {
        const leadingDigits = getLeadingDigitCount(normalizedCode);
        if (leadingDigits < MIN_STOCK_LOOKUP_LENGTH) {
            console.log(
                `[Stock Name] Skip auto lookup (${normalizedCode}), leading digits ${leadingDigits} < ${MIN_STOCK_LOOKUP_LENGTH}`
            );
            return;
        }
    }
    const delay = options.immediate ? 0 : STOCK_NAME_DEBOUNCE_MS;
    stockNameTimeout = setTimeout(() => {
        fetchStockName(normalizedCode, options);
    }, delay);
}

async function resolveStockName(fetcher, stockCode, market) {
    try {
        const result = await fetcher(stockCode);
        return normalizeStockNameResult(result, { stockCode, market });
    } catch (error) {
        console.warn('[Stock Name] 查詢時發生錯誤:', error);
        return null;
    }
}

async function fetchStockName(stockCode, options = {}) {
    if (!stockCode || stockCode === 'TAIEX') return;
    const normalizedCode = stockCode.trim().toUpperCase();
    const enforceGate = shouldEnforceNumericLookupGate(normalizedCode);
    if (!options.force && enforceGate) {
        const leadingDigits = getLeadingDigitCount(normalizedCode);
        if (leadingDigits < MIN_STOCK_LOOKUP_LENGTH) {
            console.log(
                `[Stock Name] Skip lookup (${normalizedCode}), leading digits ${leadingDigits} < ${MIN_STOCK_LOOKUP_LENGTH}`
            );
            return;
        }
    }
    if (isFetchingName) {
        console.log('[Stock Name] 已有進行中的查詢，跳過本次請求');
        return;
    }
    isFetchingName = true;

    console.log(`[Stock Name] 查詢股票名稱: ${normalizedCode} (市場: ${currentMarket})`);

    try {
        showStockName('查詢中...', 'info');
        const allowAutoSwitch = !manualMarketOverride;
        const restrictToTaiwan = shouldRestrictToTaiwanMarkets(normalizedCode);
        if (restrictToTaiwan) {
            console.log(`[Stock Name] ${normalizedCode} 前四碼為數字，限定查詢上市/上櫃來源`);
        }
        const searchOrder = allowAutoSwitch
            ? resolveStockNameSearchOrder(normalizedCode, currentMarket)
            : restrictToTaiwan
                ? ['TWSE', 'TPEX']
                : [currentMarket];

        const cacheHit = findStockNameCacheEntry(normalizedCode, searchOrder);
        if (cacheHit && cacheHit.info) {
            if (cacheHit.cachedAt) {
                const cachedISO = new Date(cacheHit.cachedAt).toISOString();
                console.log(`[Stock Name] 快取命中 ${cacheHit.market} ｜ ${cachedISO}`);
            }
            if (cacheHit.market === currentMarket || !allowAutoSwitch) {
                const display = formatStockNameDisplay(cacheHit.info, { fromCache: true });
                showStockName(composeStockNameText(display, cacheHit.info.name), 'success');
                return;
            }
            if (allowAutoSwitch) {
                await switchToMarket(cacheHit.market, normalizedCode, {
                    presetInfo: cacheHit.info,
                    fromCache: true,
                    skipToast: true,
                });
                return;
            }
        }

        for (const market of searchOrder) {
            const fetcher = MARKET_META[market]?.fetchName;
            if (typeof fetcher !== 'function') continue;
            const info = await resolveStockName(fetcher, normalizedCode, market);
            if (!info) continue;

            storeStockNameCacheEntry(market, normalizedCode, info);

            if (market === currentMarket || !allowAutoSwitch) {
                const display = formatStockNameDisplay(info);
                showStockName(composeStockNameText(display, info.name), 'success');
                return;
            }

            if (allowAutoSwitch) {
                await switchToMarket(market, normalizedCode, { presetInfo: info });
                return;
            }
        }

        const currentLabel = getMarketDisplayName(currentMarket);
        showMarketSwitchSuggestion(normalizedCode, currentLabel, null);
    } catch (error) {
        console.error('[Stock Name] 查詢錯誤:', error);
        showStockName('查詢失敗', 'error');
    } finally {
        isFetchingName = false;
    }
}
// 從 TWSE 取得股票名稱
async function fetchStockNameFromTWSE(stockCode) {
    try {
        await ensureTaiwanDirectoryReady();
        const directoryEntry = getTaiwanDirectoryEntry(stockCode);
        if (directoryEntry) {
            return {
                name: directoryEntry.name,
                board: directoryEntry.board || '上市',
                source: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `｜${taiwanDirectoryState.version}` : ''}`
                    : '台股官方清單',
                instrumentType: directoryEntry.instrumentType,
                market: directoryEntry.market || 'TWSE',
                marketCategory: directoryEntry.marketCategory || null,
                matchStrategy: 'taiwan-directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: directoryEntry.stockId,
            };
        }

        // 使用當月第一天作為查詢日期
        const now = new Date();
        const queryDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}01`;

        const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${stockCode}&date=${queryDate}&_=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (data.stat === 'OK' && data.title) {
            // 從 title 提取股票名稱，通常格式為："110年01月 2330 台積電 各日成交資訊"
            const match = data.title.match(/\d+年\d+月\s+\d+\s+(.+?)\s+各日成交資訊/);
            if (match && match[1]) {
                const name = match[1].trim();
                return {
                    name,
                    board: '上市',
                    source: 'TWSE 日成交資訊',
                    instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
                };
            }
        }

        return null;
    } catch (error) {
        console.error('[TWSE API] 查詢股票名稱失敗:', error);
        return null;
    }
}

// 從 TPEX 取得股票名稱 (使用代理伺服器解決CORS問題)
async function fetchStockNameFromTPEX(stockCode) {
    try {
        await ensureTaiwanDirectoryReady();
        const directoryEntry = getTaiwanDirectoryEntry(stockCode);
        if (directoryEntry) {
            return {
                name: directoryEntry.name,
                board: directoryEntry.board || '上櫃',
                source: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `｜${taiwanDirectoryState.version}` : ''}`
                    : '台股官方清單',
                instrumentType: directoryEntry.instrumentType,
                market: directoryEntry.market || 'TPEX',
                marketCategory: directoryEntry.marketCategory || null,
                matchStrategy: 'taiwan-directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: directoryEntry.stockId,
            };
        }

        console.log(`[TPEX Name] 查詢股票代碼: ${stockCode}`);

        // 方法1: 使用代理伺服器 (如果可用)
        const proxyResult = await fetchTPEXNameViaProxy(stockCode);
        if (proxyResult && !proxyResult.error && proxyResult.name) {
            return {
                name: proxyResult.name.trim(),
                board: '上櫃',
                source: proxyResult.source || 'TPEX 公開資訊代理',
                instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
            };
        }

        // 方法2: 使用JSONP方式嘗試舊API
        const jsonpResult = await fetchTPEXNameViaJSONP(stockCode);
        if (jsonpResult) {
            return {
                name: typeof jsonpResult === 'string' ? jsonpResult.trim() : String(jsonpResult),
                board: '上櫃',
                source: 'TPEX JSONP',
                instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
            };
        }

        console.warn(`[TPEX Name] 無法取得股票代碼 ${stockCode} 的名稱`);
        return null;

    } catch (error) {
        console.error(`[TPEX Name] 查詢股票名稱失敗:`, error);
        return null;
    }
}

async function fetchStockNameFromUS(stockCode) {
    try {
        const url = `/api/us/?mode=info&stockNo=${encodeURIComponent(stockCode)}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[US Name] API 回傳狀態碼 ${response.status}`);
            return null;
        }
        const data = await response.json();
        if (!data || data.error) return null;
        if (typeof data === 'string') {
            const name = data.trim();
            if (!name) return null;
            return {
                name,
                market: 'US',
                source: 'FinMind USStockInfo',
                symbol: stockCode,
            };
        }
        if (typeof data === 'object') {
            const name = (data.stockName || data.name || '').toString().trim();
            if (!name) return null;
            return {
                name,
                market: 'US',
                marketCategory: data.marketCategory || data.marketCategoryName || data.market || null,
                source: data.source || data.infoSource || 'FinMind USStockInfo',
                instrumentType: data.securityType || data.instrumentType || null,
                symbol: (data.symbol || data.stockNo || stockCode || '').toString().toUpperCase(),
                matchStrategy: data.matchStrategy || null,
                resolvedSymbol: data.resolvedSymbol || null,
            };
        }
        return null;
    } catch (error) {
        console.error('[US Name] 查詢股票名稱失敗:', error);
        return null;
    }
}

async function fetchStockNameFromIndex(stockCode) {
    const normalized = (stockCode || '').trim().toUpperCase();
    if (!normalized) return null;
    try {
        const params = new URLSearchParams({ stockNo: normalized, mode: 'info' });
        const response = await fetch(`/api/index/?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        });
        if (response.ok) {
            const payload = await response.json();
            if (payload && typeof payload === 'object') {
                const name = (payload.stockName || payload.shortName || payload.displayName || '').toString().trim();
                if (name) {
                    const info = {
                        name,
                        market: 'INDEX',
                        marketLabel: '指數 (Yahoo)',
                        source: payload.source || 'Yahoo Finance',
                        symbol: normalized,
                    };
                    storeStockNameCacheEntry('INDEX', normalized, info, { persistent: true });
                    return info;
                }
            }
        }
    } catch (error) {
        console.warn('[Index Name] 透過 Yahoo 取得指數名稱失敗:', error);
    }
    const fallbackName = normalized.replace(/^\^/, '') || normalized;
    const info = {
        name: fallbackName,
        market: 'INDEX',
        marketLabel: '指數 (Yahoo)',
        source: 'Yahoo Finance',
        symbol: normalized,
    };
    storeStockNameCacheEntry('INDEX', normalized, info, { persistent: true });
    return info;
}

// 使用代理伺服器獲取TPEX股票名稱
async function fetchTPEXNameViaProxy(stockNo) {
    // **關鍵修正：使用一個固定的、格式完整的歷史日期**
    const placeholderDate = '113/01/01'; 

    const url = `/.netlify/functions/tpex-proxy?stockNo=${stockNo}&date=${placeholderDate}`;
    
    console.log(`[TPEX Proxy Name] Fetching name for ${stockNo} via proxy: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[TPEX Proxy Name] 代理回傳 HTTP ${response.status}`);
            return { error: `HTTP status ${response.status}` };
        }
        const data = await response.json();

        if (data.error) {
            console.warn('[TPEX Proxy Name] 代理回傳錯誤標記', data);
            return data;
        }

        if (data.iTotalRecords > 0 && data.stockName) {
            return { name: data.stockName.trim(), source: 'TPEX Proxy' };
        } else if (data.aaData && data.aaData.length > 0) {
            const nameField = data.aaData[0][1] || '';
            const name = nameField.replace(stockNo, '').trim();
            return { name, source: 'TPEX Proxy' };
        } else {
             return { error: 'no_data' };
        }
    } catch (error) {
        console.error('[TPEX Proxy Name] 呼叫代理時發生錯誤:', error);
        return { error: error.message };
    }
}

// 使用JSONP方式嘗試獲取TPEX股票名稱
function fetchTPEXNameViaJSONP(stockCode) {
    return new Promise((resolve) => {
        try {
            // 嘗試使用支援JSONP的舊API端點
            const now = new Date();
            const rocYear = now.getFullYear() - 1911;
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const queryDate = `${rocYear}/${month}`;
            
            const callbackName = `tpexCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const script = document.createElement('script');
            
            // 設置超時
            const timeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 5000);
            
            const cleanup = () => {
                clearTimeout(timeout);
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                if (window[callbackName]) {
                    delete window[callbackName];
                }
            };
            
            window[callbackName] = (data) => {
                cleanup();
                
                try {
                    if (data && data.stat === 'OK' && data.aaData) {
                        for (const row of data.aaData) {
                            if (row && row[0] === stockCode && row[1]) {
                                resolve(row[1].trim());
                                return;
                            }
                        }
                    }
                    resolve(null);
                } catch (e) {
                    console.warn(`[TPEX JSONP] 解析錯誤:`, e);
                    resolve(null);
                }
            };
            
            // 嘗試JSONP格式的URL
            script.src = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${queryDate}&stkno=${stockCode}&callback=${callbackName}`;
            script.onerror = () => {
                cleanup();
                resolve(null);
            };
            
            document.head.appendChild(script);
            
        } catch (error) {
            console.warn(`[TPEX JSONP] 設置錯誤:`, error);
            resolve(null);
        }
    });
}

// 顯示市場切換建議
function showMarketSwitchSuggestion(stockCode, currentMarketLabel, targetMarket) {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (!stockNameDisplay) return;

    stockNameDisplay.style.display = 'block';
    if (targetMarket && MARKET_META[targetMarket]) {
        const targetLabel = getMarketDisplayName(targetMarket);
        stockNameDisplay.innerHTML = `
            <div class="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded-md" style="background-color: #fffbeb; border-color: #fde68a;">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-yellow-800 text-xs">
                        ${currentMarketLabel}市場查無「${stockCode}」
                    </span>
                </div>
                <button
                    id="switchMarketBtn"
                    class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onclick="switchToMarket('${targetMarket}', '${stockCode}')"
                >
                    切換至${targetLabel}
                </button>
            </div>
        `;
    } else {
        stockNameDisplay.innerHTML = `
            <div class="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md" style="background-color: #fffbeb; border-color: #fde68a;">
                <svg class="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <span class="text-yellow-800 text-xs">
                    ${currentMarketLabel}、上櫃與美股市場皆未找到「${stockCode}」。
                </span>
            </div>
        `;
    }
}

async function switchToMarket(targetMarket, stockCode, options = {}) {
    const normalizedMarket = normalizeMarketValue(targetMarket || 'TWSE');
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    const targetLabel = getMarketDisplayName(normalizedMarket);
    const { presetInfo = null, fromCache = false, skipToast = false } = options;

    console.log(`[Market Switch] 切換到 ${normalizedMarket} 查詢 ${normalizedCode}`);

    manualMarketOverride = false;
    manualOverrideCodeSnapshot = '';
    isAutoSwitching = true;
    currentMarket = normalizedMarket;
    updateAIBridgeMarket(currentMarket);

    const marketSelect = document.getElementById('marketSelect');
    if (marketSelect && marketSelect.value !== normalizedMarket) {
        marketSelect.value = normalizedMarket;
    }
    window.applyMarketPreset?.(currentMarket);
    window.refreshDataSourceTester?.();
    setDefaultFees(normalizedCode);

    if (!presetInfo) {
        showStockName('查詢中...', 'info');
    }

    try {
        let info = presetInfo;
        if (!info) {
            const fetcher = MARKET_META[normalizedMarket]?.fetchName;
            info = fetcher ? await resolveStockName(fetcher, normalizedCode, normalizedMarket) : null;
        }

        if (info) {
            storeStockNameCacheEntry(normalizedMarket, normalizedCode, info);
            const display = formatStockNameDisplay(info, { autoSwitched: true, targetLabel, fromCache });
            showStockName(composeStockNameText(display, info.name), 'success');
            if (!skipToast) {
                showSuccess(`已切換至${targetLabel}市場並找到: ${info.name}`);
            }
            return info;
        }

        showStockName(`當前市場查無「${normalizedCode}」`, 'error');
        return null;
    } catch (error) {
        console.error('[Market Switch] 查詢錯誤:', error);
        showStockName('查詢失敗', 'error');
        return null;
    } finally {
        isAutoSwitching = false;
    }
}
// 顯示股票名稱
function showStockName(name, type = 'success') {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (!stockNameDisplay) return;

    stockNameDisplay.style.display = 'block';
    const safeText = escapeHtml(typeof name === 'string' ? name : String(name ?? ''));
    stockNameDisplay.innerHTML = `<span class="stock-name-text">${safeText}</span>`;
    
    // 獲取內部的文字元素來設定顏色
    const textElement = stockNameDisplay.querySelector('.stock-name-text');
    if (textElement) {
        if (type === 'success') {
            textElement.style.color = 'var(--emerald-600, #059669)';
        } else if (type === 'error') {
            textElement.style.color = 'var(--rose-600, #dc2626)';
        } else if (type === 'info') {
            textElement.style.color = 'var(--blue-600, #2563eb)';
        } else {
            textElement.style.color = 'var(--muted-foreground)';
        }
    }
}

// 隱藏股票名稱
function hideStockName() {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (stockNameDisplay) {
        stockNameDisplay.style.display = 'none';
        stockNameDisplay.innerHTML = '';
    }
}

// --- 全局函數 ---
// 將 switchToMarket 函數添加到全局範圍，供 HTML onclick 調用
window.getTaiwanDirectoryMeta = function getTaiwanDirectoryMeta() {
    return {
        ready: taiwanDirectoryState.ready,
        version: taiwanDirectoryState.version,
        updatedAt: taiwanDirectoryState.updatedAt,
        source: taiwanDirectoryState.source,
        cachedAt: taiwanDirectoryState.cachedAt,
    };
};
window.switchToMarket = switchToMarket;

// --- 初始化 ---
// 在 DOM 載入完成後初始化市場切換功能
document.addEventListener('DOMContentLoaded', function() {
    // 延遲一點初始化，確保其他初始化完成
    setTimeout(() => {
        initializeMarketSwitch();
        console.log('[Market Switch] 市場切換功能已初始化');
    }, 100);
});