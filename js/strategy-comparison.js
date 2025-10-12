/* Strategy Comparison Module - LB-STRATEGY-COMPARISON-20250919A */
/* global SAVED_STRATEGIES_KEY, TREND_STYLE_MAP, resolveStrategyDisplayMetrics */

(function() {
    const MODULE_VERSION = 'LB-STRATEGY-COMPARISON-20250919A';
    const DEFAULT_SELECTED_METRICS = new Set([
        'annualizedReturn',
        'returnRate',
        'rollingScore',
        'trendLatestReturn',
    ]);

    const METRIC_DEFINITIONS = [
        {
            key: 'annualizedReturn',
            label: '年化報酬率',
            group: 'performance',
            description: '以初始本金-固定金額買入為基準的年平均複利報酬率。',
            extractor: (record) => record.metrics.annualizedReturn ?? null,
            formatter: formatPercent,
        },
        {
            key: 'returnRate',
            label: '總報酬率',
            group: 'performance',
            description: '策略期間的整體報酬率。',
            extractor: (record) => record.metrics.returnRate ?? null,
            formatter: formatPercent,
        },
        {
            key: 'maxDrawdown',
            label: '最大回撤',
            group: 'risk',
            description: '總資金-獲利再投入曲線的最大跌幅。',
            extractor: (record) => record.metrics.maxDrawdown ?? null,
            formatter: formatPercent,
        },
        {
            key: 'sharpeRatio',
            label: 'Sharpe Ratio',
            group: 'risk',
            description: '夏普比率，用於衡量風險調整後的報酬。',
            extractor: (record) => record.metrics.sharpeRatio ?? null,
            formatter: formatNumber,
        },
        {
            key: 'sortinoRatio',
            label: 'Sortino Ratio',
            group: 'risk',
            description: '僅計入下行波動的索提諾比率。',
            extractor: (record) => record.metrics.sortinoRatio ?? null,
            formatter: formatNumber,
        },
        {
            key: 'winRate',
            label: '勝率',
            group: 'trading',
            description: '完成交易中獲利部位的比例。',
            extractor: (record) => record.metrics.winRate ?? null,
            formatter: formatPercent,
        },
        {
            key: 'totalTrades',
            label: '交易次數',
            group: 'trading',
            description: '策略完成交易的筆數。',
            extractor: (record) => record.metrics.totalTrades ?? null,
            formatter: formatInteger,
        },
        {
            key: 'rollingScore',
            label: '滾動測試評分',
            group: 'rolling',
            description: 'Walk-Forward 滾動測試的綜合評分。',
            extractor: (record) => record.rolling?.score ?? null,
            formatter: formatScore,
        },
        {
            key: 'rollingPassRate',
            label: '滾動測試通過率',
            group: 'rolling',
            description: '達成門檻的測試視窗比例。',
            extractor: (record) => record.rolling?.passRate ?? null,
            formatter: formatPercent,
        },
        {
            key: 'trendLatestLabel',
            label: '目前趨勢狀態',
            group: 'trend',
            description: '摘要中標示的最新市況分類。',
            extractor: (record) => resolveTrendLabel(record.trend),
            formatter: (value) => value || '—',
        },
        {
            key: 'trendLatestReturn',
            label: '趨勢區間回報率',
            group: 'trend',
            description: '目前趨勢狀態下的累積報酬率。',
            extractor: (record) => record.trend?.latestReturnPct ?? null,
            formatter: formatPercent,
        },
        {
            key: 'trendLatestCoverage',
            label: '趨勢覆蓋率',
            group: 'trend',
            description: '最新趨勢狀態覆蓋樣本的比例。',
            extractor: (record) => record.trend?.latestCoveragePct ?? null,
            formatter: formatPercent,
        },
    ];

    const state = {
        initialized: false,
        pendingRefresh: false,
        strategies: [],
        selectedStrategies: new Set(),
        selectedMetrics: new Set(DEFAULT_SELECTED_METRICS),
    };

    function initialize() {
        if (state.initialized) return;
        const tab = document.getElementById('strategy-comparison-tab');
        if (!tab) {
            return;
        }
        state.initialized = true;
        bindSelectAllButton();
        renderMetricOptions();
        if (state.pendingRefresh) {
            state.pendingRefresh = false;
            performRefresh();
        } else {
            performRefresh();
        }
    }

    function refresh() {
        if (!state.initialized) {
            state.pendingRefresh = true;
            initialize();
            return;
        }
        performRefresh();
    }

    function performRefresh() {
        const records = loadSavedStrategies();
        state.strategies = records;
        const availableNames = new Set(records.map((record) => record.name));
        Array.from(state.selectedStrategies).forEach((name) => {
            if (!availableNames.has(name)) {
                state.selectedStrategies.delete(name);
            }
        });
        if (state.selectedStrategies.size === 0 && records.length > 0 && records.length <= 3) {
            records.forEach((record) => state.selectedStrategies.add(record.name));
        }
        renderStrategyOptions();
        syncStrategyCheckboxes();
        updateComparisonTable();
    }

    function loadSavedStrategies() {
        try {
            const raw = typeof localStorage !== 'undefined'
                ? localStorage.getItem(SAVED_STRATEGIES_KEY)
                : null;
            const parsed = raw ? JSON.parse(raw) : {};
            return Object.entries(parsed)
                .filter(([, value]) => value && typeof value === 'object' && value.settings)
                .map(([name, value]) => normalizeStrategyRecord(name, value));
        } catch (error) {
            console.warn('[StrategyComparison] 無法讀取儲存的策略：', error);
            return [];
        }
    }

    function normalizeStrategyRecord(name, raw) {
        const metrics = mergeMetrics(raw);
        const rolling = (raw?.analysis && typeof raw.analysis === 'object') ? raw.analysis.rolling || null : null;
        const trend = (raw?.analysis && typeof raw.analysis === 'object') ? raw.analysis.trend || null : null;
        return {
            name,
            label: buildStrategyLabel(name, raw),
            metrics,
            rolling,
            trend,
        };
    }

    function mergeMetrics(raw) {
        const merged = {};
        const sources = [];
        if (raw?.analysis && typeof raw.analysis.metrics === 'object') {
            sources.push(raw.analysis.metrics);
        }
        if (raw?.metrics && typeof raw.metrics === 'object') {
            sources.push(raw.metrics);
        }
        sources.forEach((source) => {
            Object.entries(source).forEach(([key, value]) => {
                const numeric = toNumber(value);
                if (numeric !== null) {
                    merged[key] = numeric;
                }
            });
        });
        return merged;
    }

    function buildStrategyLabel(name, raw) {
        if (typeof resolveStrategyDisplayMetrics === 'function') {
            const metrics = resolveStrategyDisplayMetrics(raw);
            const ann = metrics.annualizedReturn !== null ? `${metrics.annualizedReturn.toFixed(2)}%` : 'N/A';
            const sharpe = metrics.sharpeRatio !== null ? metrics.sharpeRatio.toFixed(2) : 'N/A';
            return `${name} (年化:${ann} | Sharpe:${sharpe})`;
        }
        const metrics = mergeMetrics(raw);
        const ann = metrics.annualizedReturn !== undefined && metrics.annualizedReturn !== null
            ? `${Number(metrics.annualizedReturn).toFixed(2)}%`
            : 'N/A';
        const sharpe = metrics.sharpeRatio !== undefined && metrics.sharpeRatio !== null
            ? Number(metrics.sharpeRatio).toFixed(2)
            : 'N/A';
        return `${name} (年化:${ann} | Sharpe:${sharpe})`;
    }

    function bindSelectAllButton() {
        const button = document.getElementById('comparison-select-all');
        if (!button) return;
        button.addEventListener('click', () => {
            if (state.strategies.length === 0) return;
            const allSelected = state.strategies.every((record) => state.selectedStrategies.has(record.name));
            if (allSelected) {
                state.selectedStrategies.clear();
            } else {
                state.selectedStrategies = new Set(state.strategies.map((record) => record.name));
            }
            syncStrategyCheckboxes();
            updateComparisonTable();
        });
    }

    function renderStrategyOptions() {
        const container = document.getElementById('comparison-strategy-list');
        const emptyState = document.getElementById('comparison-strategy-empty');
        if (!container) return;

        container.innerHTML = '';
        if (state.strategies.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

        state.strategies.forEach((record) => {
            const label = document.createElement('label');
            label.className = 'flex items-start gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors';
            label.style.borderColor = 'var(--border)';
            label.style.backgroundColor = 'var(--background)';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = record.name;
            checkbox.className = 'mt-0.5 h-3.5 w-3.5 rounded border-muted-foreground text-primary focus:ring-primary';
            checkbox.checked = state.selectedStrategies.has(record.name);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    state.selectedStrategies.add(record.name);
                } else {
                    state.selectedStrategies.delete(record.name);
                }
                updateComparisonTable();
            });

            const text = document.createElement('span');
            text.textContent = record.label;
            text.className = 'leading-relaxed';
            text.style.color = 'var(--foreground)';

            label.appendChild(checkbox);
            label.appendChild(text);
            container.appendChild(label);
        });
    }

    function syncStrategyCheckboxes() {
        const container = document.getElementById('comparison-strategy-list');
        if (!container) return;
        container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            const name = input.value;
            input.checked = state.selectedStrategies.has(name);
        });
    }

    function renderMetricOptions() {
        const container = document.getElementById('comparison-metric-options');
        if (!container) return;
        container.innerHTML = '';

        METRIC_DEFINITIONS.forEach((definition) => {
            const label = document.createElement('label');
            label.className = 'flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] cursor-pointer transition-colors';
            label.dataset.metricKey = definition.key;
            label.style.borderColor = 'var(--border)';
            label.style.backgroundColor = 'var(--background)';
            label.title = definition.description;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = definition.key;
            checkbox.className = 'mt-0.5 h-3 w-3 rounded border-muted-foreground text-primary focus:ring-primary';
            if (state.selectedMetrics.has(definition.key)) {
                checkbox.checked = true;
            }
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    state.selectedMetrics.add(definition.key);
                } else {
                    state.selectedMetrics.delete(definition.key);
                }
                updateComparisonTable();
            });

            const content = document.createElement('div');
            content.className = 'flex flex-col';

            const title = document.createElement('span');
            title.textContent = definition.label;
            title.className = 'font-medium';
            title.style.color = 'var(--foreground)';

            const hint = document.createElement('span');
            hint.textContent = definition.description;
            hint.className = 'mt-0.5 text-[10px]';
            hint.style.color = 'var(--muted-foreground)';

            content.appendChild(title);
            content.appendChild(hint);
            label.appendChild(checkbox);
            label.appendChild(content);
            container.appendChild(label);
        });
    }

    function updateComparisonTable() {
        const container = document.getElementById('comparison-table-container');
        const emptyState = document.getElementById('comparison-table-empty');
        if (!container) return;

        const activeMetrics = METRIC_DEFINITIONS.filter((definition) => state.selectedMetrics.has(definition.key));
        const selectedRecords = state.strategies.filter((record) => state.selectedStrategies.has(record.name));

        const existingTable = container.querySelector('table');
        if (existingTable) {
            existingTable.remove();
        }

        if (selectedRecords.length === 0 || activeMetrics.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-border text-xs';
        table.style.borderColor = 'var(--border)';

        const thead = document.createElement('thead');
        thead.className = 'bg-muted';
        thead.style.backgroundColor = 'var(--muted)';
        const headerRow = document.createElement('tr');

        const nameHeader = document.createElement('th');
        nameHeader.textContent = '策略';
        nameHeader.className = 'px-3 py-2 text-left font-semibold uppercase tracking-wide';
        nameHeader.style.color = 'var(--muted-foreground)';
        headerRow.appendChild(nameHeader);

        activeMetrics.forEach((definition) => {
            const th = document.createElement('th');
            th.textContent = definition.label;
            th.className = 'px-3 py-2 text-left font-semibold uppercase tracking-wide';
            th.style.color = 'var(--muted-foreground)';
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'divide-y divide-border';
        tbody.style.borderColor = 'var(--border)';

        selectedRecords.forEach((record) => {
            const tr = document.createElement('tr');
            tr.className = 'bg-background';
            tr.style.backgroundColor = 'var(--background)';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-3 py-2 align-top font-medium';
            nameCell.style.color = 'var(--foreground)';
            nameCell.textContent = record.label;
            tr.appendChild(nameCell);

            activeMetrics.forEach((definition) => {
                const td = document.createElement('td');
                td.className = 'px-3 py-2 align-top';
                td.style.color = 'var(--foreground)';
                const rawValue = definition.extractor(record);
                td.textContent = definition.formatter(rawValue, record);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);
    }

    function resolveTrendLabel(trend) {
        if (!trend) return null;
        if (trend.latestLabel) return trend.latestLabel;
        if (trend.latestKey && typeof TREND_STYLE_MAP === 'object' && TREND_STYLE_MAP && TREND_STYLE_MAP[trend.latestKey]?.label) {
            return TREND_STYLE_MAP[trend.latestKey].label;
        }
        return trend.latestKey || null;
    }

    function toNumber(value) {
        if (value === null || value === undefined) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function formatPercent(value) {
        const number = toNumber(value);
        if (number === null) return '—';
        const sign = number > 0 ? '+' : '';
        return `${sign}${number.toFixed(2)}%`;
    }

    function formatNumber(value) {
        const number = toNumber(value);
        if (number === null) return '—';
        return number.toFixed(2);
    }

    function formatInteger(value) {
        const number = toNumber(value);
        if (number === null) return '—';
        return Math.round(number).toString();
    }

    function formatScore(value) {
        const number = toNumber(value);
        if (number === null) return '—';
        return `${number.toFixed(0)} 分`;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.strategyComparison = {
        version: MODULE_VERSION,
        refresh,
        getSelection() {
            return {
                strategies: Array.from(state.selectedStrategies),
                metrics: Array.from(state.selectedMetrics),
            };
        },
    };
})();
