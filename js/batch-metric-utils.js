// --- 批量優化指標解析工具 - Patch Tag: LB-BATCH-METRIC-20260916C ---
(function(globalFactory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = globalFactory();
    } else {
        const globalScope = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this);
        const utils = globalFactory();
        globalScope.BatchMetricUtils = utils;
    }
})(function factory() {
    function normaliseNumericInput(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return null;
            }
            const normalised = trimmed
                .replace(/[,\s]+/g, '')
                .replace(/%$/, '');
            if (!normalised) {
                return null;
            }
            const parsed = Number.parseFloat(normalised);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    function buildResultSnapshot(result) {
        if (!result || typeof result !== 'object') {
            return null;
        }
        const snapshot = {};
        const fields = [
            'annualizedReturn', 'sharpeRatio', 'sortinoRatio', 'maxDrawdown',
            'metric', 'metricLabel', 'metricValue', '__finalMetric', '__metricLabel'
        ];
        fields.forEach((field) => {
            if (result[field] !== undefined) {
                snapshot[field] = result[field];
            }
        });
        if (result.metrics && typeof result.metrics === 'object') {
            snapshot.metrics = {};
            Object.keys(result.metrics).forEach((key) => {
                const value = result.metrics[key];
                if (typeof value === 'number' || typeof value === 'string') {
                    snapshot.metrics[key] = value;
                }
            });
        }
        if (result.summary && typeof result.summary === 'object' && result.summary.metrics) {
            snapshot.summaryMetrics = {};
            const summaryMetrics = result.summary.metrics;
            Object.keys(summaryMetrics).forEach((key) => {
                const value = summaryMetrics[key];
                if (typeof value === 'number' || typeof value === 'string') {
                    snapshot.summaryMetrics[key] = value;
                }
            });
        }
        return snapshot;
    }

    function resolveMetric(result, metric, options = {}) {
        if (!metric || !result || typeof result !== 'object') {
            if (options.onMissing) {
                options.onMissing({ metric, attempts: [], resultSnapshot: buildResultSnapshot(result) });
            }
            return Number.NaN;
        }

        const attempts = [];
        const notifyResolved = (source, rawValue, parsedValue) => {
            if (options.onResolved) {
                options.onResolved({ metric, source, rawValue, value: parsedValue, attempts });
            }
        };

        const checkCandidate = (source, rawValue) => {
            const parsed = normaliseNumericInput(rawValue);
            attempts.push({ source, rawValue, parsed });
            if (parsed !== null) {
                notifyResolved(source, rawValue, parsed);
                return parsed;
            }
            return null;
        };

        const direct = checkCandidate('direct', result[metric]);
        if (direct !== null) {
            return direct;
        }

        if (result.metrics && typeof result.metrics === 'object') {
            const metricsCandidate = checkCandidate('metrics', result.metrics[metric]);
            if (metricsCandidate !== null) {
                return metricsCandidate;
            }
        }

        if (result.metricLabel === metric) {
            const metricCandidate = checkCandidate('metric', result.metricValue !== undefined ? result.metricValue : result.metric);
            if (metricCandidate !== null) {
                return metricCandidate;
            }
        }

        if (result.summary && typeof result.summary === 'object' && result.summary.metrics) {
            const summaryCandidate = checkCandidate('summary.metrics', result.summary.metrics[metric]);
            if (summaryCandidate !== null) {
                return summaryCandidate;
            }
        }

        if (result.__finalMetric !== undefined && result.__metricLabel === metric) {
            const finalMetric = checkCandidate('__finalMetric', result.__finalMetric);
            if (finalMetric !== null) {
                return finalMetric;
            }
        }

        if (result.__finalResult && typeof result.__finalResult === 'object') {
            const finalResultCandidate = checkCandidate('__finalResult', result.__finalResult[metric]);
            if (finalResultCandidate !== null) {
                return finalResultCandidate;
            }
        }

        if (result.metrics && typeof result.metrics === 'object') {
            const fallbackKeys = Object.keys(result.metrics);
            for (const key of fallbackKeys) {
                const value = result.metrics[key];
                const parsed = normaliseNumericInput(value);
                attempts.push({ source: `metrics.${key}`, rawValue: value, parsed });
                if (parsed !== null && typeof options.onFallback === 'function') {
                    options.onFallback({ metric, source: `metrics.${key}`, rawValue: value, value: parsed, attempts });
                }
            }
        }

        if (options.onMissing) {
            options.onMissing({ metric, attempts, resultSnapshot: buildResultSnapshot(result) });
        }
        return Number.NaN;
    }

    return {
        normaliseNumericInput,
        resolveMetric,
    };
});
