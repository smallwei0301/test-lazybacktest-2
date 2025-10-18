/* global getSavedStrategies, SAVED_STRATEGIES_KEY */

// --- 策略比較面板 - v1.1 ---
// Patch Tag: LB-STRATEGY-COMPARISON-20251001A
(function() {
    const MODULE_VERSION = 'LB-STRATEGY-COMPARISON-20251001A';
    const FALLBACK_TEXT = '請先測試後保存策略';
    const TREND_LABEL_MAP = {
        bullHighVol: '牛市・高波動',
        rangeBound: '盤整區域',
        bearHighVol: '熊市・高波動',
    };

    const state = {
        initialized: false,
        strategies: {},
        selectedKeys: new Set(),
        visibleFields: new Set(),
        elements: {},
    };

    const COMPARISON_FIELDS = [
        {
            key: 'annualizedReturn',
            label: '年化報酬率',
            description: '主回測年化複利報酬率',
            extractor: (data) => normalizeNumber(data?.metrics?.annualizedReturn),
            renderer: (cell, value) => renderPercentCell(cell, value, 2),
        },
        {
            key: 'sharpeRatio',
            label: '夏普值',
            description: '主回測 Sharpe Ratio',
            extractor: (data) => normalizeNumber(data?.metrics?.sharpeRatio),
            renderer: (cell, value) => renderNumberCell(cell, value, 2),
        },
        {
            key: 'maxDrawdown',
            label: '最大回撤',
            description: '主回測最大資金回落百分比',
            extractor: (data) => normalizeNumber(data?.metrics?.maxDrawdown),
            renderer: (cell, value) => renderPercentCell(cell, value, 2),
        },
        {
            key: 'totalTrades',
            label: '交易次數',
            description: '主回測完成的交易總數',
            extractor: (data) => normalizeInteger(data?.metrics?.totalTrades),
            renderer: (cell, value) => renderIntegerCell(cell, value),
        },
        {
            key: 'sensitivity',
            label: '敏感度測試',
            description: '參數擾動穩定度與漂移',
            extractor: (data) => data?.metrics?.sensitivity || null,
            renderer: (cell, value) => renderSensitivityCell(cell, value),
        },
        {
            key: 'rolling',
            label: '滾動測試評分',
            description: 'Walk-Forward 綜合得分與達標情況',
            extractor: (data) => data?.metrics?.rolling || null,
            renderer: (cell, value) => renderRollingCell(cell, value),
        },
        {
            key: 'trend',
            label: '趨勢區間評估',
            description: '摘要趨勢狀態與回報率',
            extractor: (data) => data?.metrics?.trend || null,
            renderer: (cell, value) => renderTrendCell(cell, value),
        },
    ];

    function init() {
        if (state.initialized) return;
        cacheElements();
        if (!state.elements.controls) return;
        if (state.visibleFields.size === 0) {
            COMPARISON_FIELDS.forEach((field) => state.visibleFields.add(field.key));
        }
        refreshFromStorage();
        bindStorageListener();
        state.initialized = true;
        console.log('[Strategy Comparison]', MODULE_VERSION, 'initialized');
    }

    function cacheElements() {
        state.elements.empty = document.getElementById('strategy-compare-empty');
        state.elements.controls = document.getElementById('strategy-compare-controls');
        state.elements.list = document.getElementById('strategy-compare-list');
        state.elements.fieldList = document.getElementById('strategy-compare-field-list');
        state.elements.tableCard = document.getElementById('strategy-compare-table-card');
        state.elements.tablePlaceholder = document.getElementById('strategy-compare-table-placeholder');
        state.elements.tableWrapper = document.getElementById('strategy-compare-table-wrapper');
        state.elements.tableHead = document.getElementById('strategy-compare-table-head');
        state.elements.tableBody = document.getElementById('strategy-compare-table-body');
    }

    function bindStorageListener() {
        window.addEventListener('storage', (event) => {
            if (event.key === SAVED_STRATEGIES_KEY) {
                refreshFromStorage();
            }
        });
    }

    function refreshFromStorage() {
        state.strategies = readStrategies();
        ensureSelectionIntegrity();
        const hasStrategies = Object.keys(state.strategies).length > 0;
        updateEmptyState(hasStrategies);
        renderStrategyList();
        renderFieldToggles();
        renderTable();
    }

    function readStrategies() {
        try {
            if (typeof getSavedStrategies === 'function') {
                return getSavedStrategies();
            }
        } catch (error) {
            console.warn('[Strategy Comparison] 讀取策略清單失敗：', error);
        }
        return {};
    }

    function ensureSelectionIntegrity() {
        const available = new Set(Object.keys(state.strategies));
        Array.from(state.selectedKeys).forEach((key) => {
            if (!available.has(key)) {
                state.selectedKeys.delete(key);
            }
        });
    }

    function updateEmptyState(hasStrategies) {
        const { empty, controls } = state.elements;
        if (!empty || !controls) return;
        if (hasStrategies) {
            empty.classList.add('hidden');
            controls.classList.remove('hidden');
        } else {
            empty.classList.remove('hidden');
            controls.classList.add('hidden');
        }
    }

    function renderStrategyList() {
        const container = state.elements.list;
        if (!container) return;
        clearElement(container);
        const strategyEntries = Object.keys(state.strategies).sort();
        strategyEntries.forEach((name) => {
            const strategy = state.strategies[name];
            const item = document.createElement('label');
            item.className = 'flex items-start gap-2 text-xs border rounded-md px-3 py-2 hover:border-accent transition-colors';
            item.style.borderColor = 'var(--border)';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mt-1 h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent';
            checkbox.checked = state.selectedKeys.has(name);
            checkbox.addEventListener('change', () => handleStrategyToggle(name, checkbox.checked));

            const textWrapper = document.createElement('div');
            textWrapper.className = 'flex-1';

            const title = document.createElement('div');
            title.className = 'font-semibold text-foreground';
            title.textContent = name;

            const meta = document.createElement('div');
            meta.className = 'text-[11px] text-muted-foreground';
            const capturedAt = strategy?.metrics?.capturedAt ? formatDateTime(strategy.metrics.capturedAt) : null;
            const ann = normalizeNumber(strategy?.metrics?.annualizedReturn);
            const annText = Number.isFinite(ann) ? `年化 ${formatPercent(ann, 2)}` : null;
            meta.textContent = [capturedAt, annText].filter(Boolean).join(' ｜ ');

            textWrapper.appendChild(title);
            textWrapper.appendChild(meta);

            item.appendChild(checkbox);
            item.appendChild(textWrapper);
            container.appendChild(item);
        });
    }

    function handleStrategyToggle(name, checked) {
        if (checked) {
            state.selectedKeys.add(name);
        } else {
            state.selectedKeys.delete(name);
        }
        renderTable();
    }

    function renderFieldToggles() {
        const container = state.elements.fieldList;
        if (!container) return;
        clearElement(container);
        COMPARISON_FIELDS.forEach((field) => {
            const wrapper = document.createElement('label');
            wrapper.className = 'flex items-center gap-2 text-xs border rounded-md px-3 py-2 hover:border-accent transition-colors';
            wrapper.style.borderColor = 'var(--border)';
            wrapper.title = field.description;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent';
            checkbox.checked = state.visibleFields.has(field.key);
            checkbox.addEventListener('change', () => handleFieldToggle(field.key, checkbox.checked, checkbox));

            const label = document.createElement('span');
            label.className = 'text-foreground';
            label.textContent = field.label;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            container.appendChild(wrapper);
        });
    }

    function handleFieldToggle(fieldKey, checked, checkbox) {
        if (checked) {
            state.visibleFields.add(fieldKey);
        } else {
            if (state.visibleFields.size <= 1) {
                checkbox.checked = true;
                return;
            }
            state.visibleFields.delete(fieldKey);
        }
        renderTable();
    }

    function renderTable() {
        const { tableWrapper, tablePlaceholder, tableHead, tableBody } = state.elements;
        if (!tableWrapper || !tablePlaceholder || !tableHead || !tableBody) return;

        const selected = Array.from(state.selectedKeys)
            .map((key) => ({ key, data: state.strategies[key] }))
            .filter((entry) => entry.data);
        const activeFields = getActiveFields();

        if (selected.length === 0) {
            tablePlaceholder.textContent = state.strategies && Object.keys(state.strategies).length > 0
                ? '請從上方勾選至少一個策略。'
                : '尚未儲存任何策略。';
            tablePlaceholder.classList.remove('hidden');
            tableWrapper.classList.add('hidden');
            clearElement(tableHead);
            clearElement(tableBody);
            return;
        }

        tablePlaceholder.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
        clearElement(tableHead);
        clearElement(tableBody);

        const headRow = document.createElement('tr');
        const nameHeader = document.createElement('th');
        nameHeader.className = 'px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
        nameHeader.textContent = '策略名稱';
        headRow.appendChild(nameHeader);

        activeFields.forEach((field) => {
            const th = document.createElement('th');
            th.className = 'px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
            th.textContent = field.label;
            th.title = field.description;
            headRow.appendChild(th);
        });
        tableHead.appendChild(headRow);

        selected.forEach((entry) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b';
            tr.style.borderColor = 'var(--border)';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-4 py-3 align-top text-xs';
            renderNameCell(nameCell, entry.key, entry.data);
            tr.appendChild(nameCell);

            activeFields.forEach((field) => {
                const cell = document.createElement('td');
                cell.className = 'px-4 py-3 align-top text-xs';
                const value = field.extractor(entry.data);
                field.renderer(cell, value, entry.data);
                tr.appendChild(cell);
            });

            tableBody.appendChild(tr);
        });
    }

    function renderNameCell(cell, name, data) {
        const title = document.createElement('div');
        title.className = 'font-semibold text-foreground';
        title.textContent = name;

        const meta = document.createElement('div');
        meta.className = 'text-[11px] text-muted-foreground';
        const version = typeof data?.metrics?.snapshotVersion === 'string' ? data.metrics.snapshotVersion : MODULE_VERSION;
        const capturedAt = data?.metrics?.capturedAt ? formatDateTime(data.metrics.capturedAt) : null;
        meta.textContent = [capturedAt, `版本 ${version}`].filter(Boolean).join(' ｜ ');

        cell.appendChild(title);
        cell.appendChild(meta);
    }

    function renderPercentCell(cell, value, digits = 2) {
        if (!Number.isFinite(value)) {
            renderFallback(cell);
            return;
        }
        cell.textContent = formatPercent(value, digits);
    }

    function renderNumberCell(cell, value, digits = 2) {
        if (!Number.isFinite(value)) {
            renderFallback(cell);
            return;
        }
        cell.textContent = formatNumber(value, digits);
    }

    function renderIntegerCell(cell, value) {
        if (!Number.isFinite(value)) {
            renderFallback(cell);
            return;
        }
        cell.textContent = `${Math.trunc(value)}`;
    }

    function renderSensitivityCell(cell, value) {
        if (!value || !Number.isFinite(value.stabilityScore)) {
            renderFallback(cell);
            return;
        }
        const score = document.createElement('div');
        score.className = 'font-semibold text-foreground';
        score.textContent = `${Math.round(value.stabilityScore)} 分`;

        const details = document.createElement('div');
        details.className = 'text-[11px] text-muted-foreground leading-relaxed';
        const average = Number.isFinite(value.averageDriftPercent)
            ? `平均漂移 ${formatNumber(Math.abs(value.averageDriftPercent), 1)}pp`
            : null;
        const pos = Number.isFinite(value.positiveDriftPercent)
            ? `調高 ${formatNumber(Math.abs(value.positiveDriftPercent), 1)}pp`
            : null;
        const neg = Number.isFinite(value.negativeDriftPercent)
            ? `調低 ${formatNumber(Math.abs(value.negativeDriftPercent), 1)}pp`
            : null;
        const scenarios = Number.isFinite(value.scenarioCount)
            ? `樣本 ${Math.trunc(value.scenarioCount)} 組`
            : null;
        details.textContent = [average, [pos, neg].filter(Boolean).join('／'), scenarios]
            .filter(Boolean)
            .join(' ｜ ');

        cell.appendChild(score);
        cell.appendChild(details);
    }

    function renderRollingCell(cell, value) {
        if (!value || (!Number.isFinite(value.score) && !Number.isFinite(value.passCount))) {
            renderFallback(cell);
            return;
        }
        const headline = document.createElement('div');
        headline.className = 'font-semibold text-foreground';
        const scoreText = Number.isFinite(value.score) ? `${Math.round(value.score)} 分` : null;
        const gradeText = value.gradeLabel ? value.gradeLabel : null;
        headline.textContent = [scoreText, gradeText].filter(Boolean).join(' ｜ ');

        const detail = document.createElement('div');
        detail.className = 'text-[11px] text-muted-foreground leading-relaxed';
        const pass = Number.isFinite(value.passCount) && Number.isFinite(value.totalWindows)
            ? `${Math.trunc(value.passCount)}/${Math.trunc(value.totalWindows)} 視窗達標`
            : null;
        const passRate = Number.isFinite(value.passRate)
            ? `通過率 ${formatPercent(value.passRate, 1)}`
            : null;
        const ann = Number.isFinite(value.averageAnnualizedReturn)
            ? `OOS 年化 ${formatPercent(value.averageAnnualizedReturn, 2)}`
            : null;
        detail.textContent = [pass, passRate, ann].filter(Boolean).join(' ｜ ');

        cell.appendChild(headline);
        cell.appendChild(detail);
    }

    function renderTrendCell(cell, value) {
        if (!value || !value.latestLabel) {
            renderFallback(cell);
            return;
        }
        const label = TREND_LABEL_MAP[value.latestLabel] || value.latestLabel;
        const title = document.createElement('div');
        title.className = 'font-semibold text-foreground';
        const latestDate = value.latestDate ? formatTrendDate(value.latestDate) : null;
        title.textContent = latestDate ? `${label} ｜ ${latestDate}` : label;

        const detail = document.createElement('div');
        detail.className = 'text-[11px] text-muted-foreground leading-relaxed';
        const ret = Number.isFinite(value.latestReturnPct)
            ? `區間回報 ${formatSignedPercent(value.latestReturnPct, 2)}`
            : null;
        const coverage = Number.isFinite(value.latestCoveragePct)
            ? `覆蓋 ${formatPercent(value.latestCoveragePct, 1)}`
            : null;
        const confidence = Number.isFinite(value.averageConfidence)
            ? `平均信心 ${formatPercent(value.averageConfidence * 100, 1)}`
            : null;
        detail.textContent = [ret, coverage, confidence].filter(Boolean).join(' ｜ ');

        cell.appendChild(title);
        cell.appendChild(detail);
    }

    function renderFallback(cell) {
        cell.textContent = FALLBACK_TEXT;
        cell.classList.add('text-muted-foreground');
    }

    function clearElement(element) {
        if (!element) return;
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function getActiveFields() {
        return COMPARISON_FIELDS.filter((field) => state.visibleFields.has(field.key));
    }

    function formatPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(digits)}%`;
    }

    function formatSignedPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        const formatted = value.toFixed(digits);
        return value > 0 ? `+${formatted}%` : `${formatted}%`;
    }

    function formatNumber(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        const fixed = value.toFixed(digits);
        return fixed.replace(/\.00$/, '').replace(/\.0$/, '');
    }

    function formatDateTime(isoString) {
        if (typeof isoString !== 'string') return null;
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hour}:${minute}`;
    }

    function formatTrendDate(dateString) {
        if (typeof dateString !== 'string' || dateString.length < 8) return dateString;
        const parts = dateString.split('-');
        if (parts.length < 2) return dateString;
        const month = parts[1];
        const day = parts[2]?.slice(0, 2) || '';
        return `${Number.parseInt(month, 10)}／${Number.parseInt(day, 10)}`;
    }

    function normalizeNumber(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed === '') return null;
            const sanitized = trimmed.replace(/,/g, '');
            const parsed = Number.parseFloat(sanitized);
            return Number.isFinite(parsed) ? parsed : null;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    function normalizeInteger(value) {
        const num = normalizeNumber(value);
        if (!Number.isFinite(num)) return null;
        return Math.trunc(num);
    }

    window.strategyComparisonPanel = {
        init,
        refreshFromStorage,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
