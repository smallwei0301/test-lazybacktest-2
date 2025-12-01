
const workerYearSupersetCache = new Map();

// Mock dependencies
const getPriceModeKey = () => 'raw';
const computeMissingRanges = (coverage, start, end) => {
    // Simplified mock: if coverage is empty, return full range
    if (!coverage || coverage.length === 0) return [{ start, end }];
    // If coverage covers everything, return empty
    // This is a simple mock, real one is more complex
    return [];
};
const dedupeAndSortData = (data) => data;
const fetchWithAdaptiveRetry = jest.fn();
const normalizeProxyRow = (row) => ({ ...row, date: row.date }); // Simple pass-through
const self = { postMessage: jest.fn() };

// Helper functions from worker.js (copied for testing)
function getYearSupersetEntry(marketKey, stockNo, priceModeKey, year, split) {
    if (!workerYearSupersetCache.has(marketKey)) return null;
    const marketCache = workerYearSupersetCache.get(marketKey);
    const stockKey = `${stockNo}|${priceModeKey}|${split ? 'split' : 'raw'}`;
    if (!marketCache.has(stockKey)) return null;
    const stockCache = marketCache.get(stockKey);
    return stockCache.get(year) || null;
}

function setYearSupersetEntry(marketKey, stockNo, priceModeKey, year, split, entry) {
    if (!workerYearSupersetCache.has(marketKey)) {
        workerYearSupersetCache.set(marketKey, new Map());
    }
    const marketCache = workerYearSupersetCache.get(marketKey);
    const stockKey = `${stockNo}|${priceModeKey}|${split ? 'split' : 'raw'}`;
    if (!marketCache.has(stockKey)) {
        marketCache.set(stockKey, new Map());
    }
    const stockCache = marketCache.get(stockKey);
    stockCache.set(year, entry);
}

function filterDatasetForWindow(data, start, end) {
    if (!Array.isArray(data)) return [];
    return data.filter(row => row.date >= start && row.date <= end);
}

async function tryFetchSmartGapMergedRange({
    stockNo,
    startDate,
    endDate,
    marketKey,
    split = false,
    fetchDiagnostics,
    cacheKey,
    optionEffectiveStart,
    optionLookbackDays,
    primaryForceSource,
    fallbackForceSource,
}) {
    if (marketKey !== "TWSE" && marketKey !== "TPEX" && marketKey !== "US") return null;

    const startYear = parseInt(startDate.slice(0, 4), 10);
    const endYear = parseInt(endDate.slice(0, 4), 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;

    const chunks = [];
    for (let year = startYear; year <= endYear; year++) {
        const chunkStart = year === startYear ? startDate : `${year}-01-01`;
        const chunkEnd = year === endYear ? endDate : `${year}-12-31`;
        chunks.push({
            year,
            start: chunkStart,
            end: chunkEnd,
            cached: false,
            data: []
        });
    }

    const priceModeKey = getPriceModeKey(false);

    for (const chunk of chunks) {
        const entry = getYearSupersetEntry(marketKey, stockNo, priceModeKey, chunk.year, split);
        if (entry && Array.isArray(entry.data)) {
            const missing = computeMissingRanges(entry.coverage, chunk.start, chunk.end);
            if (missing.length === 0) {
                chunk.cached = true;
                chunk.data = filterDatasetForWindow(entry.data, chunk.start, chunk.end);
            }
        }
    }

    const fetchRequests = [];
    let currentRequest = null;

    const MAX_MERGE_YEARS = 3;
    for (const chunk of chunks) {
        if (!chunk.cached) {
            if (!currentRequest) {
                currentRequest = {
                    start: chunk.start,
                    end: chunk.end,
                    years: [chunk.year]
                };
            } else {
                // Check if adding this year exceeds the max merge limit
                if (currentRequest.years.length < MAX_MERGE_YEARS) {
                    currentRequest.end = chunk.end;
                    currentRequest.years.push(chunk.year);
                } else {
                    // Push current request and start a new one
                    fetchRequests.push(currentRequest);
                    currentRequest = {
                        start: chunk.start,
                        end: chunk.end,
                        years: [chunk.year]
                    };
                }
            }
        } else {
            if (currentRequest) {
                fetchRequests.push(currentRequest);
                currentRequest = null;
            }
        }
    }
    if (currentRequest) {
        fetchRequests.push(currentRequest);
    }

    if (fetchRequests.length === 0) {
        const allData = chunks.flatMap(c => c.data);
        const deduped = dedupeAndSortData(allData);
        if (fetchDiagnostics) fetchDiagnostics.usedCache = true;

        return {
            data: deduped,
            dataSource: "Worker Year Cache",
            stockName: stockNo,
            fetchRange: { start: startDate, end: endDate },
            dataStartDate: startDate,
            effectiveStartDate: optionEffectiveStart,
            lookbackDays: optionLookbackDays,
            diagnostics: fetchDiagnostics,
        };
    }

    let proxyPath = "/api/twse/";
    if (marketKey === "TPEX") proxyPath = "/api/tpex/";
    else if (marketKey === "US") proxyPath = "/api/us/";

    const combinedData = [];
    const sourceFlags = new Set();
    let fetchedStockName = "";

    for (const req of fetchRequests) {
        const params = new URLSearchParams({
            stockNo,
            start: req.start,
            end: req.end,
        });
        if (split) params.set("split", "1");
        if (primaryForceSource) params.set("forceSource", primaryForceSource);

        const url = `${proxyPath}?${params.toString()}`;

        self.postMessage({
            type: "progress",
            progress: 15,
            message: `補抓年份區間 ${req.start} ~ ${req.end}...`,
        });

        try {
            const responsePayload = await fetchWithAdaptiveRetry(url, {
                headers: { Accept: "application/json" },
            });

            if (responsePayload && !responsePayload.error) {
                const rows = Array.isArray(responsePayload.aaData)
                    ? responsePayload.aaData
                    : Array.isArray(responsePayload.data)
                        ? responsePayload.data
                        : [];

                const normalized = [];
                const sDate = new Date(req.start);
                const eDate = new Date(req.end);
                rows.forEach(row => {
                    const norm = normalizeProxyRow(row, marketKey === "TPEX", sDate, eDate);
                    if (norm) normalized.push(norm);
                });

                if (responsePayload.stockName) fetchedStockName = responsePayload.stockName;
                if (responsePayload.dataSource) sourceFlags.add(responsePayload.dataSource);

                for (const year of req.years) {
                    const yearStart = `${year}-01-01`;
                    const yearEnd = `${year}-12-31`;
                    const yearData = normalized.filter(d => d.date >= yearStart && d.date <= yearEnd);

                    if (yearData.length > 0) {
                        const entry = {
                            data: yearData,
                            coverage: [{ start: yearStart, end: yearEnd }],
                            lastUpdated: Date.now()
                        };
                        setYearSupersetEntry(marketKey, stockNo, priceModeKey, year, split, entry);
                    }
                }
                combinedData.push(...normalized);
            } else {
                return null;
            }
        } catch (e) {
            console.warn(`[Worker] Smart Gap Fetch failed for ${url}`, e);
            return null;
        }
    }

    for (const chunk of chunks) {
        if (chunk.cached) {
            combinedData.push(...chunk.data);
        }
    }

    const deduped = dedupeAndSortData(combinedData);

    return {
        data: deduped,
        dataSource: "Smart Gap Merged",
        stockName: fetchedStockName || stockNo,
        fetchRange: { start: startDate, end: endDate },
        dataStartDate: startDate,
        effectiveStartDate: optionEffectiveStart,
        lookbackDays: optionLookbackDays,
        diagnostics: fetchDiagnostics,
    };
}

describe('Smart Gap Merging Logic', () => {
    beforeEach(() => {
        workerYearSupersetCache.clear();
        fetchWithAdaptiveRetry.mockClear();
        self.postMessage.mockClear();
    });

    test('should fetch data for a single year range', async () => {
        fetchWithAdaptiveRetry.mockResolvedValue({
            data: [{ date: '2023-01-01', close: 100 }],
            stockName: 'Test Stock'
        });

        const result = await tryFetchSmartGapMergedRange({
            stockNo: '2330',
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            marketKey: 'TWSE',
            fetchDiagnostics: {}
        });

        expect(fetchWithAdaptiveRetry).toHaveBeenCalledWith(
            expect.stringContaining('/api/twse/?stockNo=2330&start=2023-01-01&end=2023-12-31'),
            expect.any(Object)
        );
        expect(result).not.toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.stockName).toBe('Test Stock');
    });

    test('should merge multiple years into one request', async () => {
        fetchWithAdaptiveRetry.mockResolvedValue({
            data: [
                { date: '2023-01-01', close: 100 },
                { date: '2024-01-01', close: 110 }
            ]
        });

        await tryFetchSmartGapMergedRange({
            stockNo: '2330',
            startDate: '2023-01-01',
            endDate: '2024-12-31',
            marketKey: 'TWSE',
            fetchDiagnostics: {}
        });

        expect(fetchWithAdaptiveRetry).toHaveBeenCalledTimes(1);
        expect(fetchWithAdaptiveRetry).toHaveBeenCalledWith(
            expect.stringContaining('start=2023-01-01&end=2024-12-31'),
            expect.any(Object)
        );
    });

    test('should use cached data and fetch only missing years', async () => {
        // Pre-populate cache for 2023
        setYearSupersetEntry('TWSE', '2330', 'raw', 2023, false, {
            data: [{ date: '2023-06-01', close: 100 }],
            coverage: [{ start: '2023-01-01', end: '2023-12-31' }]
        });

        fetchWithAdaptiveRetry.mockResolvedValue({
            data: [{ date: '2024-01-01', close: 110 }]
        });

        const result = await tryFetchSmartGapMergedRange({
            stockNo: '2330',
            startDate: '2023-01-01',
            endDate: '2024-12-31',
            marketKey: 'TWSE',
            fetchDiagnostics: {}
        });

        // Should only fetch 2024
        expect(fetchWithAdaptiveRetry).toHaveBeenCalledTimes(1);
        expect(fetchWithAdaptiveRetry).toHaveBeenCalledWith(
            expect.stringContaining('start=2024-01-01&end=2024-12-31'),
            expect.any(Object)
        );

        expect(result.data).toHaveLength(2); // 1 from cache, 1 from fetch
    });

    test('should limit merged chunk size to 3 years', async () => {
        fetchWithAdaptiveRetry.mockResolvedValue({
            data: []
        });

        await tryFetchSmartGapMergedRange({
            stockNo: '2330',
            startDate: '2020-01-01',
            endDate: '2024-12-31', // 5 years: 2020, 2021, 2022, 2023, 2024
            marketKey: 'TWSE',
            fetchDiagnostics: {}
        });

        // Should be split into 2 requests: 3 years + 2 years
        console.log('Calls:', JSON.stringify(fetchWithAdaptiveRetry.mock.calls, null, 2));
        expect(fetchWithAdaptiveRetry).toHaveBeenCalledTimes(2);

        // First request: 2020-2022 (3 years)
        expect(fetchWithAdaptiveRetry).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('start=2020-01-01&end=2022-12-31'),
            expect.any(Object)
        );

        // Second request: 2023-2024 (2 years)
        expect(fetchWithAdaptiveRetry).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('start=2023-01-01&end=2024-12-31'),
            expect.any(Object)
        );
    });
});
