/* global getSavedStrategies, resolveStrategyDisplayName, strategyDescriptions */

(function() {
    const MODULE_VERSION = 'LB-STRATEGY-COMPARE-20260120A';
    const state = {
        availableStrategies: {},
        selectedStrategies: new Set(),
        selectedMetrics: new Set(),
        lastRenderedAt: null,
    };

    const METRIC_DEFINITIONS = [
        {
            key: 'annualizedReturn',
            label: '年化報酬率',
            type: 'percent',
            defaultSelected: true,
            description: '最近一次回測的年化報酬率',
        },
        {
            key: 'sharpeRatio',
            label: 'Sharpe Ratio',
            type: 'number',
            decimals: 2,
            defaultSelected: true,
            description: '回測期間的夏普值',
        },
        {
            key: 'rollingScore',
            label: '滾動測試評分',
            type: 'rolling',
            defaultSelected: true,
            description: 'Walk-Forward 測試整體評分',
        },
        {
            key: 'trendCurrentReturn',
            label: '趨勢區間評估｜目前趨勢回報',
            type: 'trend',
            defaultSelected: true,
            description: '目前趨勢狀態下的策略回報率',
        },
        {
            key: 'futurePlaceholder',
            label: '預留模組（即將推出）',
            type: 'placeholder',
            defaultSelected: false,
            disabled: true,
            description: '預留位置，未來可新增更多比較欄位',
        },
    ];

    function init() {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('strategy-compare-tab');
        if (!container) return;
        initialiseMetricOptions();
        refreshStrategyList();
        bindControls();
    }

    function bindControls() {
        const refreshBtn = document.getElementById('strategy-compare-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                renderComparisonTable();
            });
        }
        const selectAllBtn = document.getElementById('strategy-compare-select-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                Object.keys(state.availableStrategies).forEach((name) => {
                    state.selectedStrategies.add(name);
                });
                syncStrategyCheckboxes();
            });
        }
        const clearBtn = document.getElementById('strategy-compare-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                state.selectedStrategies.clear();
                syncStrategyCheckboxes();
            });
        }

        document.addEventListener('lazybacktest:savedStrategiesUpdated', () => {
            refreshStrategyList({ preserveSelection: true });
        });

        document.addEventListener('lazybacktest:rollingSummaryUpdated', () => {
            // 如果表格已顯示，重新整理以同步最新的滾動測試分數
            if (state.lastRenderedAt) {
                renderComparisonTable({ silent: true });
            }
        });
    }

    function initialiseMetricOptions() {
        const metricContainer = document.getElementById('strategy-compare-metric-list');
        if (!metricContainer) return;
        metricContainer.innerHTML = '';
        METRIC_DEFINITIONS.forEach((metric) => {
            const id = `strategy-metric-${metric.key}`;
            const wrapper = document.createElement('label');
            wrapper.className = 'flex items-start gap-2 rounded-md border px-3 py-2 text-xs';
            wrapper.style.borderColor = 'var(--border)';
            wrapper.style.backgroundColor = 'var(--background)';
            wrapper.style.color = 'var(--foreground)';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = id;
            checkbox.value = metric.key;
            checkbox.dataset.metricKey = metric.key;
            checkbox.className = 'mt-0.5 h-4 w-4';
            checkbox.style.accentColor = 'var(--accent)';
            checkbox.disabled = Boolean(metric.disabled);
            if (metric.defaultSelected && !metric.disabled) {
                checkbox.checked = true;
                state.selectedMetrics.add(metric.key);
            }
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    state.selectedMetrics.add(metric.key);
                } else {
                    state.selectedMetrics.delete(metric.key);
                }
            });

            const textWrapper = document.createElement('div');
            textWrapper.className = 'flex flex-col';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = metric.label;
            titleSpan.className = 'font-semibold';
            titleSpan.style.color = 'var(--foreground)';

            const descSpan = document.createElement('span');
            descSpan.textContent = metric.description || '';
            descSpan.className = 'text-[11px] mt-0.5';
            descSpan.style.color = 'var(--muted-foreground)';

            textWrapper.appendChild(titleSpan);
            if (metric.description) {
                textWrapper.appendChild(descSpan);
            }

            wrapper.appendChild(checkbox);
            wrapper.appendChild(textWrapper);
            metricContainer.appendChild(wrapper);
        });
    }

    function refreshStrategyList(options = {}) {
        const { preserveSelection = false } = options;
        const listContainer = document.getElementById('strategy-compare-strategy-list');
        if (!listContainer) return;
        const previousSelection = new Set(state.selectedStrategies);
        if (!preserveSelection) {
            state.selectedStrategies.clear();
        }

        let strategies = {};
        try {
            strategies = getSavedStrategies();
        } catch (error) {
            console.error('[Strategy Compare] Failed to load saved strategies:', error);
            strategies = {};
        }
        state.availableStrategies = strategies;
        const strategyNames = Object.keys(strategies).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

        listContainer.innerHTML = '';
        if (strategyNames.length === 0) {
            const placeholder = document.createElement('p');
            placeholder.className = 'text-xs';
            placeholder.style.color = 'var(--muted-foreground)';
            placeholder.textContent = '目前尚未儲存策略，請先在「策略管理」區域儲存設定。';
            listContainer.appendChild(placeholder);
            return;
        }

        strategyNames.forEach((name) => {
            const strategy = strategies[name];
            const id = `strategy-compare-item-${encodeURIComponent(name)}`;
            const label = document.createElement('label');
            label.className = 'flex items-start gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer hover:border-[var(--primary)]';
            label.htmlFor = id;
            label.style.borderColor = 'var(--border)';
            label.style.backgroundColor = 'var(--background)';
            label.style.color = 'var(--foreground)';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.value = name;
        checkbox.dataset.strategyName = name;
        checkbox.className = 'mt-0.5 h-4 w-4';
        checkbox.style.accentColor = 'var(--accent)';
            if ((preserveSelection && previousSelection.has(name)) || (!preserveSelection && state.selectedStrategies.has(name))) {
                checkbox.checked = true;
                state.selectedStrategies.add(name);
            }
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    state.selectedStrategies.add(name);
                } else {
                    state.selectedStrategies.delete(name);
                }
            });

            const content = document.createElement('div');
            content.className = 'flex flex-col';

            const title = document.createElement('span');
            title.className = 'font-semibold';
            title.textContent = name;
            title.style.color = 'var(--foreground)';

            const meta = document.createElement('span');
            meta.className = 'text-[11px] mt-0.5';
            meta.style.color = 'var(--muted-foreground)';
            meta.textContent = buildStrategyMetaSummary(strategy?.settings);

            content.appendChild(title);
            content.appendChild(meta);

            label.appendChild(checkbox);
            label.appendChild(content);
            listContainer.appendChild(label);
        });
    }

    function syncStrategyCheckboxes() {
        const listContainer = document.getElementById('strategy-compare-strategy-list');
        if (!listContainer) return;
        const inputs = listContainer.querySelectorAll('input[data-strategy-name]');
        inputs.forEach((input) => {
            const strategyName = input.dataset.strategyName;
            if (!strategyName) return;
            if (state.selectedStrategies.has(strategyName)) {
                input.checked = true;
            } else {
                input.checked = false;
            }
        });
    }

    function renderComparisonTable(options = {}) {
        const { silent = false } = options;
        const tableWrapper = document.getElementById('strategy-compare-table-wrapper');
        const headerRow = document.getElementById('strategy-compare-header-row');
        const body = document.getElementById('strategy-compare-body');
        const emptyState = document.getElementById('strategy-compare-empty');
        const updatedAt = document.getElementById('strategy-compare-updatedAt');
        if (!tableWrapper || !headerRow || !body || !emptyState) return;

        const selectedStrategies = Array.from(state.selectedStrategies).filter((name) => state.availableStrategies[name]);
        const selectedMetrics = Array.from(state.selectedMetrics);
        if (selectedStrategies.length === 0) {
            tableWrapper.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.textContent = '尚未選取策略。請在上方勾選至少一個已儲存策略並點擊「更新比較表」。';
            if (updatedAt) updatedAt.textContent = '';
            return;
        }
        if (selectedMetrics.length === 0) {
            tableWrapper.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.textContent = '請至少勾選一個分析維度後再更新比較表。';
            if (updatedAt) updatedAt.textContent = '';
            return;
        }

        const strategiesSnapshot = { ...state.availableStrategies };
        headerRow.innerHTML = '';
        body.innerHTML = '';

        tableWrapper.classList.remove('hidden');
        emptyState.classList.add('hidden');

        const columns = [{ key: 'name', label: '策略名稱', className: 'text-left w-40' }, { key: 'meta', label: '設定摘要', className: 'text-left min-w-[280px]' }];
        selectedMetrics.forEach((metricKey) => {
            const def = METRIC_DEFINITIONS.find((item) => item.key === metricKey);
            if (!def) return;
            columns.push({ key: metricKey, label: def.label, className: 'text-left' });
        });

        columns.forEach((column) => {
            const th = document.createElement('th');
            th.className = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide';
            th.style.color = 'var(--muted-foreground)';
            th.textContent = column.label;
            headerRow.appendChild(th);
        });

        selectedStrategies.forEach((name) => {
            const strategy = strategiesSnapshot[name];
            const settings = strategy?.settings || null;
            const metrics = strategy?.metrics || {};
            const insights = strategy?.insights || null;
            const tr = document.createElement('tr');
            tr.className = 'bg-background';
            tr.style.color = 'var(--foreground)';

            const nameCell = document.createElement('td');
            nameCell.className = 'px-3 py-2 text-sm font-semibold';
            nameCell.textContent = name;
            tr.appendChild(nameCell);

            const metaCell = document.createElement('td');
            metaCell.className = 'px-3 py-2 text-xs';
            metaCell.style.color = 'var(--muted-foreground)';
            metaCell.textContent = buildStrategyDescriptor(settings);
            tr.appendChild(metaCell);

            selectedMetrics.forEach((metricKey) => {
                const def = METRIC_DEFINITIONS.find((item) => item.key === metricKey);
                if (!def) return;
                const td = document.createElement('td');
                td.className = 'px-3 py-2 text-sm align-top';
                td.style.color = 'var(--foreground)';
                td.textContent = formatMetricValue(def, metrics, insights);
                tr.appendChild(td);
            });

            body.appendChild(tr);
        });

        state.lastRenderedAt = Date.now();
        if (updatedAt) {
            const timestamp = new Date(state.lastRenderedAt);
            updatedAt.textContent = `更新時間：${formatDateTime(timestamp)}`;
        }

        if (!silent && typeof lucide !== 'undefined') {
            try {
                lucide.createIcons();
            } catch (error) {
                console.warn('[Strategy Compare] lucide refresh failed:', error);
            }
        }
    }

    function buildStrategyMetaSummary(settings) {
        if (!settings) return '尚未執行回測';
        const stock = settings.stockNo || '—';
        const entry = resolveStrategyDisplayName(settings.entryStrategy || '') || settings.entryStrategy || '—';
        const exitKey = ['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(settings.exitStrategy)
            ? `${settings.exitStrategy}_exit`
            : settings.exitStrategy;
        const exit = resolveStrategyDisplayName(exitKey || '') || settings.exitStrategy || '—';
        const range = settings.startDate || settings.endDate
            ? `${settings.startDate || '—'} → ${settings.endDate || '—'}`
            : '未設定區間';
        return `${stock}｜${entry}→${exit}｜${range}`;
    }

    function buildStrategyDescriptor(settings) {
        if (!settings) return '尚未執行回測';
        const stock = settings.stockNo || '—';
        const entry = resolveStrategyDisplayName(settings.entryStrategy || '') || settings.entryStrategy || '—';
        const exitKey = ['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(settings.exitStrategy)
            ? `${settings.exitStrategy}_exit`
            : settings.exitStrategy;
        const exit = resolveStrategyDisplayName(exitKey || '') || settings.exitStrategy || '—';
        const range = settings.startDate || settings.endDate
            ? `${settings.startDate || '—'} → ${settings.endDate || '—'}`
            : '未設定區間';
        const basis = settings.positionBasis === 'totalCapital'
            ? '總資金-獲利再投入'
            : '初始本金-固定金額買入';
        const shortSummary = settings.enableShorting
            ? `＋做空：${resolveStrategyDisplayName(settings.shortEntryStrategy || '') || settings.shortEntryStrategy || '—'}→${resolveStrategyDisplayName(settings.shortExitStrategy || '') || settings.shortExitStrategy || '—'}`
            : '僅做多';
        return `${stock}｜${entry}→${exit}｜${range}｜${basis}｜${shortSummary}`;
    }

    function formatMetricValue(definition, metrics, insights) {
        switch (definition.type) {
            case 'percent':
                return formatPercent(metrics?.[definition.key]);
            case 'number':
                return formatNumber(metrics?.[definition.key], definition.decimals);
            case 'rolling':
                return formatRollingInsights(insights?.rollingTest);
            case 'trend':
                return formatTrendInsights(insights?.trend);
            case 'placeholder':
                return '敬請期待';
            default:
                return '—';
        }
    }

    function formatPercent(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return `${value.toFixed(digits)}%`;
    }

    function formatNumber(value, digits = 2) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits);
    }

    function formatRollingInsights(rolling) {
        if (!rolling) return '尚未產生滾動測試結果';
        const parts = [];
        if (Number.isFinite(rolling.score)) {
            parts.push(`${rolling.score.toFixed(0)} 分`);
        }
        if (rolling.gradeLabel) {
            parts.push(rolling.gradeLabel);
        }
        if (Number.isFinite(rolling.passCount) && Number.isFinite(rolling.totalWindows)) {
            parts.push(`通過 ${rolling.passCount}/${rolling.totalWindows}`);
        }
        if (Number.isFinite(rolling.passRate)) {
            parts.push(`通過率 ${rolling.passRate.toFixed(1)}%`);
        }
        if (Number.isFinite(rolling.averageAnnualizedReturn)) {
            parts.push(`平均年化 ${rolling.averageAnnualizedReturn.toFixed(2)}%`);
        }
        return parts.length > 0 ? parts.join('｜') : '尚未產生滾動測試結果';
    }

    function formatTrendInsights(trend) {
        if (!trend) return '尚未產生趨勢評估結果';
        const label = trend.latestLabelName || trend.latestLabel || '未知狀態';
        const parts = [label];
        if (Number.isFinite(trend.latestReturnPct)) {
            parts.push(`回報 ${trend.latestReturnPct.toFixed(2)}%`);
        }
        if (Number.isFinite(trend.latestCoveragePct)) {
            parts.push(`覆蓋 ${trend.latestCoveragePct.toFixed(1)}%`);
        }
        if (trend.latestDate) {
            parts.push(`截至 ${formatDate(trend.latestDate)}`);
        }
        return parts.join('｜');
    }

    function formatDate(dateInput) {
        if (!dateInput) return '—';
        const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
        if (Number.isNaN(date.getTime())) return '—';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatDateTime(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    }

    document.addEventListener('DOMContentLoaded', init);
})();
