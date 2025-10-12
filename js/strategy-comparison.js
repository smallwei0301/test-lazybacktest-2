// Module: LB-STRATEGY-COMPARE-20250702A
/* global getSavedStrategies, SAVED_STRATEGIES_KEY, lucide */

(function() {
    const MODULE_VERSION = 'LB-STRATEGY-COMPARE-20250702A';
    const compareState = {
        initialized: false,
        selectedStrategies: new Set(),
        selectedMetrics: new Set(),
    };

    const METRIC_GROUPS = [
        { key: 'core', label: '核心績效', description: '檢視年化報酬、Sharpe 與交易密度等基本指標。' },
        { key: 'risk', label: '風險控制', description: '觀察最大回撤與勝率，評估策略的下行風險。' },
        { key: 'walk', label: 'Walk-Forward / 滾動測試', description: '若已執行 Walk-Forward，會顯示綜合評分與等級。' },
        { key: 'trend', label: '趨勢區間分析（預留）', description: '預留趨勢模組欄位，尚未啟用時會顯示「待補」。' },
        { key: 'meta', label: '其他資訊', description: '補充儲存時間等管理資訊。' },
    ];

    const METRIC_DEFINITIONS = [
        { key: 'annualizedReturn', label: '年化報酬率 (%)', group: 'core', defaultChecked: true, format: formatPercent },
        { key: 'sharpeRatio', label: '夏普比率', group: 'core', defaultChecked: true, format: formatNumber },
        { key: 'sortinoRatio', label: '索提諾比率', group: 'core', defaultChecked: false, format: formatNumber },
        { key: 'maxDrawdown', label: '最大回撤 (%)', group: 'risk', defaultChecked: true, format: formatPercent },
        { key: 'winRate', label: '勝率 (%)', group: 'risk', defaultChecked: false, format: formatPercent },
        { key: 'totalTrades', label: '總交易次數', group: 'core', defaultChecked: false, format: formatInteger },
        { key: 'rollingScore', label: 'Walk-Forward 評分', group: 'walk', defaultChecked: true, format: formatScore, placeholder: '尚未評分' },
        { key: 'rollingGradeLabel', label: 'Walk-Forward 等級', group: 'walk', defaultChecked: false, format: formatText, placeholder: '待補' },
        { key: 'trendCurrentReturn', label: '趨勢區間回報 (%)', group: 'trend', defaultChecked: false, format: formatPercent, placeholder: '待補' },
        { key: 'trendCurrentLabel', label: '目前趨勢區間', group: 'trend', defaultChecked: false, format: formatText, placeholder: '待補' },
        { key: 'savedAt', label: '儲存時間', group: 'meta', defaultChecked: true, format: formatDateTime },
    ];

    const METRIC_MAP = METRIC_DEFINITIONS.reduce((acc, item) => {
        acc[item.key] = item;
        return acc;
    }, {});

    document.addEventListener('DOMContentLoaded', () => {
        const tab = document.getElementById('strategy-compare-tab');
        if (!tab) return;
        initialiseStrategyComparison();
    });

    function initialiseStrategyComparison() {
        if (compareState.initialized) return;
        compareState.initialized = true;

        const defaultMetrics = METRIC_DEFINITIONS.filter((metric) => metric.defaultChecked).map((metric) => metric.key);
        compareState.selectedMetrics = new Set(defaultMetrics);

        renderMetricGroups();
        renderStrategyList();
        updateComparisonTable();

        const refreshBtn = document.getElementById('strategy-compare-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                renderStrategyList({ preserveSelection: true, forceRefresh: true });
                updateComparisonTable();
            });
        }

        const selectAllBtn = document.getElementById('strategy-compare-select-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                setAllStrategyCheckboxes(true);
                updateComparisonTable();
                updateStatus();
            });
        }

        const clearBtn = document.getElementById('strategy-compare-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                setAllStrategyCheckboxes(false);
                updateComparisonTable();
                updateStatus();
            });
        }

        const runBtn = document.getElementById('strategy-compare-run');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                updateComparisonTable({ focus: true });
            });
        }

        const tabButton = document.querySelector('[data-tab="strategy-compare"]');
        if (tabButton) {
            tabButton.addEventListener('click', () => {
                renderStrategyList({ preserveSelection: true });
                updateComparisonTable();
            });
        }

        document.addEventListener('lazybacktest:strategies-updated', () => {
            renderStrategyList({ preserveSelection: true, forceRefresh: true });
            updateComparisonTable();
        });

        window.addEventListener('storage', (event) => {
            if (event.key === SAVED_STRATEGIES_KEY) {
                renderStrategyList({ preserveSelection: true, forceRefresh: true });
                updateComparisonTable();
            }
        });
    }

    function safeGetSavedStrategies() {
        try {
            if (typeof getSavedStrategies === 'function') {
                return getSavedStrategies();
            }
        } catch (error) {
            console.warn('[Strategy Comparison] 讀取策略時發生錯誤:', error);
        }
        return {};
    }

    function renderStrategyList(options = {}) {
        const container = document.getElementById('strategy-compare-strategy-list');
        const emptyState = document.getElementById('strategy-compare-empty-state');
        if (!container || !emptyState) return;

        const strategies = safeGetSavedStrategies();
        const names = Object.keys(strategies).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

        if (!options.preserveSelection) {
            compareState.selectedStrategies.clear();
        } else if (options.forceRefresh) {
            Array.from(compareState.selectedStrategies).forEach((name) => {
                if (!names.includes(name)) {
                    compareState.selectedStrategies.delete(name);
                }
            });
        }

        container.innerHTML = '';

        if (names.length === 0) {
            emptyState.classList.remove('hidden');
            container.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.classList.remove('hidden');

        if (compareState.selectedStrategies.size === 0) {
            names.slice(0, 2).forEach((name) => compareState.selectedStrategies.add(name));
        }

        names.forEach((name) => {
            const strategy = strategies[name];
            const label = document.createElement('label');
            label.className = 'flex items-start justify-between gap-3 border rounded-lg px-3 py-2 text-xs hover:border-primary transition-colors';
            label.style.borderColor = 'color-mix(in srgb, var(--border) 90%, transparent)';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = name;
            input.className = 'mt-1';
            input.checked = compareState.selectedStrategies.has(name);
            input.addEventListener('change', () => {
                if (input.checked) {
                    compareState.selectedStrategies.add(name);
                } else {
                    compareState.selectedStrategies.delete(name);
                }
                updateComparisonTable();
                updateStatus();
            });

            const meta = document.createElement('div');
            meta.className = 'flex-1 space-y-1';

            const title = document.createElement('div');
            title.className = 'font-semibold text-foreground';
            title.textContent = name;

            const details = document.createElement('div');
            details.className = 'text-[11px] text-muted-foreground space-y-0.5';
            const settings = strategy?.settings || {};
            const stockLabel = settings.stockNo ? `代碼：${settings.stockNo}` : '代碼：—';
            const rangeLabel = settings.startDate && settings.endDate
                ? `區間：${settings.startDate} ~ ${settings.endDate}`
                : '區間：—';
            const positionLabel = settings.positionBasis || '—';
            details.innerHTML = `<div>${stockLabel}</div><div>${rangeLabel}</div><div>部位基準：${resolvePositionBasisLabel(positionLabel)}</div>`;

            meta.appendChild(title);
            meta.appendChild(details);

            label.appendChild(input);
            label.appendChild(meta);
            container.appendChild(label);
        });

        updateStatus();

        if (typeof lucide !== 'undefined' && lucide?.createIcons) {
            lucide.createIcons();
        }
    }

    function renderMetricGroups() {
        const container = document.getElementById('strategy-compare-metric-groups');
        if (!container) return;
        container.innerHTML = '';

        METRIC_GROUPS.forEach((group) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'space-y-2 border rounded-lg p-3';
            wrapper.style.borderColor = 'color-mix(in srgb, var(--border) 90%, transparent)';

            const header = document.createElement('div');
            header.className = 'flex items-start justify-between gap-3';
            const title = document.createElement('div');
            title.className = 'text-sm font-semibold';
            title.textContent = group.label;
            const description = document.createElement('p');
            description.className = 'text-[11px] text-muted-foreground';
            description.textContent = group.description;
            header.appendChild(title);
            header.appendChild(description);

            const grid = document.createElement('div');
            grid.className = 'grid gap-2 sm:grid-cols-2';

            METRIC_DEFINITIONS.filter((metric) => metric.group === group.key).forEach((metric) => {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'flex items-center gap-2 text-xs';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = metric.key;
                checkbox.checked = compareState.selectedMetrics.has(metric.key);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        compareState.selectedMetrics.add(metric.key);
                    } else {
                        compareState.selectedMetrics.delete(metric.key);
                    }
                    updateComparisonTable();
                });

                const text = document.createElement('span');
                text.textContent = metric.label;

                optionLabel.appendChild(checkbox);
                optionLabel.appendChild(text);
                grid.appendChild(optionLabel);
            });

            wrapper.appendChild(header);
            wrapper.appendChild(grid);
            container.appendChild(wrapper);
        });
    }

    function setAllStrategyCheckboxes(checked) {
        const container = document.getElementById('strategy-compare-strategy-list');
        if (!container) return;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        compareState.selectedStrategies.clear();
        checkboxes.forEach((checkbox) => {
            checkbox.checked = checked;
            if (checked) {
                compareState.selectedStrategies.add(checkbox.value);
            }
        });
    }

    function getSelectedMetricKeys() {
        if (!compareState.selectedMetrics || compareState.selectedMetrics.size === 0) {
            return [];
        }
        return METRIC_DEFINITIONS
            .filter((metric) => compareState.selectedMetrics.has(metric.key))
            .map((metric) => metric.key);
    }

    function updateComparisonTable(options = {}) {
        const emptyEl = document.getElementById('strategy-compare-empty');
        const tableWrapper = document.getElementById('strategy-compare-table-wrapper');
        const thead = document.getElementById('strategy-compare-thead');
        const tbody = document.getElementById('strategy-compare-tbody');
        if (!emptyEl || !tableWrapper || !thead || !tbody) return;

        const strategies = safeGetSavedStrategies();
        const selectedMetrics = getSelectedMetricKeys();
        const orderedNames = Object.keys(strategies)
            .sort((a, b) => a.localeCompare(b, 'zh-Hant'))
            .filter((name) => compareState.selectedStrategies.has(name));

        if (orderedNames.length === 0 || selectedMetrics.length === 0) {
            tableWrapper.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            if (orderedNames.length === 0) {
                emptyEl.textContent = '請至少選擇一個策略，系統才能建立比較表。';
            } else {
                emptyEl.textContent = '尚未選擇分析模組，請勾選想比較的指標後再產出表格。';
            }
            return;
        }

        emptyEl.classList.add('hidden');
        tableWrapper.classList.remove('hidden');

        thead.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.className = 'text-left';

        const strategyHeader = document.createElement('th');
        strategyHeader.className = 'px-4 py-3 text-left text-xs font-semibold tracking-wide';
        strategyHeader.textContent = '策略';
        headerRow.appendChild(strategyHeader);

        selectedMetrics.forEach((metricKey) => {
            const definition = METRIC_MAP[metricKey];
            const th = document.createElement('th');
            th.className = 'px-4 py-3 text-left text-xs font-semibold tracking-wide';
            th.textContent = definition ? definition.label : metricKey;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        tbody.innerHTML = '';

        orderedNames.forEach((name) => {
            const strategy = strategies[name];
            const row = document.createElement('tr');
            row.className = 'border-b';
            row.style.borderColor = 'color-mix(in srgb, var(--border) 80%, transparent)';

            const firstCell = document.createElement('td');
            firstCell.className = 'px-4 py-3 align-top';
            const title = document.createElement('div');
            title.className = 'text-sm font-semibold text-foreground';
            title.textContent = name;
            const meta = document.createElement('div');
            meta.className = 'text-[11px] text-muted-foreground space-y-0.5 mt-1';
            const settings = strategy?.settings || {};
            const stockLabel = settings.stockNo ? `代碼：${settings.stockNo}` : '代碼：—';
            const rangeLabel = settings.startDate && settings.endDate
                ? `區間：${settings.startDate} ~ ${settings.endDate}`
                : '區間：—';
            meta.innerHTML = `<div>${stockLabel}</div><div>${rangeLabel}</div>`;
            firstCell.appendChild(title);
            firstCell.appendChild(meta);
            row.appendChild(firstCell);

            const metrics = strategy?.metrics || {};
            const metaInfo = strategy?.meta || {};

            selectedMetrics.forEach((metricKey) => {
                const definition = METRIC_MAP[metricKey];
                const td = document.createElement('td');
                td.className = 'px-4 py-3 text-xs align-top text-foreground';

                let rawValue = metrics[metricKey];
                if (metricKey === 'savedAt' && !rawValue) {
                    rawValue = metaInfo.savedAt || null;
                }

                const formatted = definition && typeof definition.format === 'function'
                    ? definition.format(rawValue, { placeholder: definition.placeholder })
                    : (rawValue ?? '—');

                td.textContent = formatted;
                row.appendChild(td);
            });

            tbody.appendChild(row);
        });

        if (typeof lucide !== 'undefined' && lucide?.createIcons) {
            lucide.createIcons();
        }

        if (options.focus) {
            tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function updateStatus() {
        const statusEl = document.getElementById('strategy-compare-status');
        if (!statusEl) return;
        const total = Object.keys(safeGetSavedStrategies()).length;
        const selected = compareState.selectedStrategies.size;
        statusEl.innerHTML = `<i data-lucide="info" class="lucide-xs"></i><span>目前選取 ${selected}/${total} 策略。</span>`;
        if (typeof lucide !== 'undefined' && lucide?.createIcons) {
            lucide.createIcons();
        }
    }

    function resolvePositionBasisLabel(value) {
        if (value === 'initialCapital') return '初始本金-固定金額買入';
        if (value === 'totalCapital') return '總資金-獲利再投入';
        if (typeof value === 'string' && value.trim() !== '') return value;
        return '—';
    }

    function formatPercent(value, { placeholder } = {}) {
        if (!Number.isFinite(value)) return placeholder || '—';
        return `${value.toFixed(2)}%`;
    }

    function formatNumber(value, { placeholder } = {}) {
        if (!Number.isFinite(value)) return placeholder || '—';
        return value.toFixed(2);
    }

    function formatInteger(value, { placeholder } = {}) {
        if (!Number.isFinite(value)) return placeholder || '—';
        return Math.round(value).toLocaleString('en-US');
    }

    function formatScore(value, { placeholder } = {}) {
        if (!Number.isFinite(value)) return placeholder || '待補';
        return `${Math.round(value)} 分`;
    }

    function formatText(value, { placeholder } = {}) {
        if (value === null || value === undefined || value === '') return placeholder || '—';
        return `${value}`;
    }

    function formatDateTime(value, { placeholder } = {}) {
        if (typeof value !== 'string' || value.trim() === '') return placeholder || '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return placeholder || '—';
        return date.toLocaleString('zh-TW', { hour12: false });
    }
})();
