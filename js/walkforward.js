// --- 滾動測試模組 - LB-WALKFORWARD-20250701A ---
(function() {
    const MODULE_VERSION = 'LB-WALKFORWARD-20250701A';
    const DAY_MS = 24 * 60 * 60 * 1000;

    function parseISODateInput(value) {
        if (!value || typeof value !== 'string') return null;
        const parts = value.split('-').map((item) => parseInt(item, 10));
        if (parts.length !== 3 || parts.some((num) => Number.isNaN(num))) return null;
        const [year, month, day] = parts;
        return new Date(Date.UTC(year, month - 1, day));
    }

    function isTradingDay(date) {
        if (!(date instanceof Date)) return false;
        const weekday = date.getUTCDay();
        return weekday !== 0 && weekday !== 6;
    }

    function addTradingDays(baseDate, days) {
        if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
        if (!Number.isFinite(days) || days < 0) return null;
        let remaining = Math.floor(days);
        let cursor = new Date(baseDate.getTime());
        while (remaining > 0) {
            cursor = new Date(cursor.getTime() + DAY_MS);
            if (isTradingDay(cursor)) remaining -= 1;
        }
        return cursor;
    }

    function countTradingDays(startDate, endDate) {
        if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
        if (startDate.getTime() > endDate.getTime()) return 0;
        let count = 0;
        let cursor = new Date(startDate.getTime());
        while (cursor.getTime() <= endDate.getTime()) {
            if (isTradingDay(cursor)) count += 1;
            cursor = new Date(cursor.getTime() + DAY_MS);
        }
        return count;
    }

    function formatDateRange(startDate, endDate) {
        if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime()) || !(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
            return '—';
        }
        return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
    }

    function formatDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
        const year = date.getUTCFullYear();
        const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${date.getUTCDate()}`.padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    function buildWalkforwardSchedule(startDate, endDate, inSampleLength, outSampleLength, stepLength) {
        if (!startDate || !endDate) return [];
        if (!Number.isFinite(inSampleLength) || !Number.isFinite(outSampleLength) || !Number.isFinite(stepLength)) return [];
        const schedule = [];
        let currentStart = new Date(startDate.getTime());
        while (currentStart.getTime() <= endDate.getTime()) {
            const inSampleEnd = addTradingDays(currentStart, inSampleLength - 1);
            if (!inSampleEnd || inSampleEnd.getTime() > endDate.getTime()) break;
            const outSampleStart = addTradingDays(inSampleEnd, 1);
            if (!outSampleStart) break;
            if (outSampleStart.getTime() > endDate.getTime()) break;
            const expectedOutSampleEnd = addTradingDays(outSampleStart, outSampleLength - 1);
            const truncated = !expectedOutSampleEnd || expectedOutSampleEnd.getTime() > endDate.getTime();
            const outSampleEnd = truncated ? new Date(endDate.getTime()) : expectedOutSampleEnd;
            schedule.push({
                index: schedule.length + 1,
                inSampleStart: new Date(currentStart.getTime()),
                inSampleEnd,
                outSampleStart,
                outSampleEnd,
                truncated,
            });
            if (truncated) break;
            const nextStart = addTradingDays(currentStart, stepLength);
            if (!nextStart) break;
            currentStart = nextStart;
        }
        return schedule;
    }

    function renderSummaryPlaceholder(tbody) {
        if (!tbody) return;
        tbody.innerHTML = '';
        const rows = [
            {
                metric: '年化報酬率',
                oos: '待測試',
                insample: '待測試',
                stability: '績效衰退比率：—',
                description: '策略在實戰中的預期報酬，以及相較於最佳化結果的衰退程度。',
            },
            {
                metric: '最大回撤 (MDD)',
                oos: '待測試',
                insample: '待測試',
                stability: '風險擴大率：—',
                description: '策略在模擬實戰中可能面臨的最大風險。',
            },
            {
                metric: '夏普值',
                oos: '待測試',
                insample: '待測試',
                stability: '夏普衰退比率：—',
                description: '衡量風險調整後的報酬表現。',
            },
            {
                metric: '獲利因子',
                oos: '待測試',
                insample: '待測試',
                stability: '—',
                description: '總獲利與總虧損的比率。',
            },
            {
                metric: '盈利週期百分比',
                oos: '待測試',
                insample: '—',
                stability: '—',
                description: '各考試期中獲利輪次的占比，用於衡量策略一致性。',
            },
        ];
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${row.metric}</td>
                <td class="px-3 py-2">${row.oos}</td>
                <td class="px-3 py-2">${row.insample}</td>
                <td class="px-3 py-2">${row.stability}</td>
                <td class="px-3 py-2">${row.description}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderScheduleTables(periodsBody, paramsBody, schedule) {
        if (periodsBody) {
            periodsBody.innerHTML = '';
            if (!schedule.length) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="6" class="px-3 py-3 text-center">尚未建立滾動窗格。</td>';
                periodsBody.appendChild(tr);
            } else {
                schedule.forEach((window) => {
                    const note = window.truncated ? '資料不足，自動截斷考試期。' : '等待滾動測試結果。';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-3 py-2">${window.index}</td>
                        <td class="px-3 py-2">${formatDate(window.outSampleStart)} ~ ${formatDate(window.outSampleEnd)}</td>
                        <td class="px-3 py-2">待分類</td>
                        <td class="px-3 py-2">—</td>
                        <td class="px-3 py-2">—</td>
                        <td class="px-3 py-2">${note}</td>
                    `;
                    periodsBody.appendChild(tr);
                });
            }
        }

        if (paramsBody) {
            paramsBody.innerHTML = '';
            if (!schedule.length) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="5" class="px-3 py-3 text-center">等待滾動測試結果。</td>';
                paramsBody.appendChild(tr);
            } else {
                schedule.forEach((window) => {
                    const remark = window.truncated ? '（最後一輪，樣本不足）' : '';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-3 py-2">${window.index}</td>
                        <td class="px-3 py-2">${formatDateRange(window.inSampleStart, window.inSampleEnd)}</td>
                        <td class="px-3 py-2">—</td>
                        <td class="px-3 py-2">—</td>
                        <td class="px-3 py-2">— ${remark}</td>
                    `;
                    paramsBody.appendChild(tr);
                });
            }
        }
    }

    function setWarningMessage(target, message, state = 'info') {
        if (!target) return;
        target.textContent = message || '';
        if (state === 'error') {
            target.dataset.state = 'error';
        } else {
            delete target.dataset.state;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.info(`[Walk-Forward] 初始化模組 ${MODULE_VERSION}`);

        const inSampleInput = document.getElementById('walkforward-in-sample');
        const outSampleInput = document.getElementById('walkforward-out-sample');
        const stepInput = document.getElementById('walkforward-step');
        const warningBox = document.getElementById('walkforward-warning');
        const totalPeriodDisplay = document.getElementById('walkforward-total-period');
        const planButton = document.getElementById('walkforward-generate-plan');
        const planSummary = document.getElementById('walkforward-plan-summary');
        const periodsBody = document.getElementById('walkforward-periods-body');
        const paramsBody = document.getElementById('walkforward-parameters-body');
        const summaryBody = document.getElementById('walkforward-summary-body');
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');

        if (!inSampleInput || !outSampleInput || !stepInput) {
            console.warn('[Walk-Forward] 找不到必要的滾動測試輸入欄位，略過初始化。');
            return;
        }

        renderSummaryPlaceholder(summaryBody);

        const syncStepLength = () => {
            if (!outSampleInput.value) return;
            stepInput.value = outSampleInput.value;
        };

        const updateTotalPeriod = () => {
            if (!totalPeriodDisplay) return { tradingDays: 0, startDate: null, endDate: null };
            const startDate = parseISODateInput(startInput ? startInput.value : null);
            const endDate = parseISODateInput(endInput ? endInput.value : null);
            if (!startDate || !endDate) {
                totalPeriodDisplay.textContent = '請先設定回測開始與結束日期。';
                return { tradingDays: 0, startDate, endDate };
            }
            if (startDate.getTime() > endDate.getTime()) {
                totalPeriodDisplay.textContent = '結束日期需晚於開始日期，請調整設定。';
                return { tradingDays: 0, startDate, endDate };
            }
            const tradingDays = countTradingDays(startDate, endDate);
            totalPeriodDisplay.textContent = `預估可用交易日：約 ${tradingDays} 天（排除週末）`;
            return { tradingDays, startDate, endDate };
        };

        const updateValidationHint = () => {
            const { tradingDays: totalDays, startDate, endDate } = updateTotalPeriod();
            const inSample = parseInt(inSampleInput.value, 10);
            const outSample = parseInt(outSampleInput.value, 10);
            const stepLength = parseInt(stepInput.value, 10) || outSample;

            if (!startDate || !endDate || !totalDays) {
                setWarningMessage(warningBox, '尚未取得有效的回測區間，請確認日期設定。', 'error');
                return;
            }
            if (totalDays < inSample + outSample) {
                setWarningMessage(warningBox, `目前總交易日約 ${totalDays} 天，小於學習期 (${inSample}) 與考試期 (${outSample}) 之和，請延長回測期間或調整窗格長度。`, 'error');
                return;
            }
            const previewSchedule = buildWalkforwardSchedule(startDate, endDate, inSample, outSample, stepLength);
            const approxRuns = previewSchedule.length || 1;
            const truncated = previewSchedule.some((window) => window.truncated);
            const hintTail = truncated ? '（最後一輪會因資料不足而截斷）' : '';
            setWarningMessage(warningBox, `設定有效，預估可執行 ${approxRuns} 輪滾動測試${hintTail}。`);
        };

        syncStepLength();
        updateValidationHint();

        outSampleInput.addEventListener('input', () => {
            syncStepLength();
            updateValidationHint();
        });
        inSampleInput.addEventListener('input', updateValidationHint);
        if (startInput) startInput.addEventListener('change', updateValidationHint);
        if (endInput) endInput.addEventListener('change', updateValidationHint);

        if (planButton) {
            planButton.addEventListener('click', (event) => {
                event.preventDefault();
                syncStepLength();
                const inSample = parseInt(inSampleInput.value, 10);
                const outSample = parseInt(outSampleInput.value, 10);
                const stepLength = parseInt(stepInput.value, 10);
                const { tradingDays: totalDays, startDate, endDate } = updateTotalPeriod();

                if (!startDate || !endDate) {
                    setWarningMessage(warningBox, '請先設定完整的回測期間再進行滾動測試規劃。', 'error');
                    return;
                }
                if (!Number.isFinite(inSample) || !Number.isFinite(outSample)) {
                    setWarningMessage(warningBox, '請輸入有效的學習期與考試期長度。', 'error');
                    return;
                }
                if (totalDays < inSample + outSample) {
                    setWarningMessage(warningBox, '回測期間不足以建立第一個窗格，請調整參數。', 'error');
                    return;
                }

                const schedule = buildWalkforwardSchedule(startDate, endDate, inSample, outSample, stepLength);
                renderScheduleTables(periodsBody, paramsBody, schedule);

                if (!schedule.length) {
                    planSummary.textContent = '目前的回測期間無法建立有效的滾動窗格，建議延長回測時間或縮短學習／考試期長度。';
                    setWarningMessage(warningBox, '沒有可用的滾動窗格。', 'error');
                    return;
                }

                const firstWindow = schedule[0];
                const lastWindow = schedule[schedule.length - 1];
                planSummary.textContent = `已建立 ${schedule.length} 個滾動窗格，第一輪涵蓋 ${formatDateRange(firstWindow.inSampleStart, firstWindow.outSampleEnd)}，最後一輪結束於 ${formatDate(lastWindow.outSampleEnd)}。`;
                const truncatedRuns = schedule.filter((window) => window.truncated).length;
                const hintTail = truncatedRuns ? `（含 ${truncatedRuns} 輪因資料不足而提前結束）` : '';
                setWarningMessage(warningBox, `規劃完成，可依序執行 ${schedule.length} 輪滾動測試${hintTail}。`);
            });
        }
    });
})();
