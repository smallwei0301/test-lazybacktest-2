
const workerYearSupersetCache = new Map();

// Mock dependencies
const getPriceModeKey = () => 'raw';
const computeMissingRanges = (coverage, start, end) => {
    // Simplified mock: if coverage is empty, return full range
    if (!coverage || coverage.length === 0) return [{ start, end }];

    const reqStart = start;
    const reqEnd = end;

    // Check if any range covers reqStart to reqEnd
    const covered = coverage.some(r => r.start <= reqStart && r.end >= reqEnd);
    if (covered) return [];

    return [{ start, end }];
};
const dedupeAndSortData = (data) => data.sort((a, b) => a.date.localeCompare(b.date));
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

    // Check if entry already exists
    const existing = stockCache.get(year);
    if (existing) {
        // Merge data
        const mergedData = dedupeAndSortData([...existing.data, ...entry.data]);

        // Merge coverage
        const mergedCoverage = [...(existing.coverage || []), ...(entry.coverage || [])];

        stockCache.set(year, {
            data: mergedData,
            coverage: mergedCoverage,
            lastUpdated: Date.now()
        });
    } else {
        stockCache.set(year, entry);
    }
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
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based

    for (let year = startYear; year <= endYear; year++) {
        const chunkStart = year === startYear ? startDate : `${year}-01-01`;
        const chunkEnd = year === endYear ? endDate : `${year}-12-31`;

        if (year === currentYear) {
            // Split current year into:
            // 1. Historical part: Jan 1 to End of Previous Month
            // 2. Current part: Start of Current Month to End Date

            const currentMonthStartStr = `${year}-${String(currentMonth).padStart(2, '0')}-01`;

            // Calculate end of previous month
            const prevMonthDate = new Date(year, currentMonth - 1, 0); // Day 0 of current month is last day of prev month
            const prevMonthEndStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`;

            // Chunk 1: Historical Part (if applicable)
            if (chunkStart < currentMonthStartStr) {
                const histEnd = chunkEnd < prevMonthEndStr ? chunkEnd : prevMonthEndStr;
                chunks.push({
                    year,
                    start: chunkStart,
                    end: histEnd,
                    cached: false,
                    data: [],
                    isHistorical: true
                });
            }

            // Chunk 2: Current Part (if applicable)
            if (chunkEnd >= currentMonthStartStr) {
                const currStart = chunkStart > currentMonthStartStr ? chunkStart : currentMonthStartStr;
                chunks.push({
                    year,
                    start: currStart,
                    end: chunkEnd,
                    cached: false,
                    data: [],
                    isHistorical: false
                });
            }
        } else {
            chunks.push({
                year,
                start: chunkStart,
                end: chunkEnd,
                cached: false,
                data: [],
                isHistorical: true
            });
        }
    }

    const priceModeKey = getPriceModeKey(false);

    // 1. Check Cache (Memory Only for Worker)
    for (const chunk of chunks) {
        // Only check cache for historical chunks
        if (chunk.isHistorical) {
            const entry = getYearSupersetEntry(marketKey, stockNo, split ? 'split' : 'raw', chunk.year, split);
            if (entry) {
                // Check if entry covers the chunk range
                const missing = computeMissingRanges(entry.coverage, chunk.start, chunk.end);
                if (missing.length === 0) {
                    chunk.cached = true;
                    chunk.data = filterDatasetForWindow(entry.data, chunk.start, chunk.end);
                }
            }
        }
    }

    // 2. Group missing chunks into requests
    const fetchRequests = [];
    let currentRequest = null;
    const MAX_MERGE_YEARS = 3;

    for (const chunk of chunks) {
        if (chunk.cached) continue;

        // If we have a current request, try to merge
        if (currentRequest) {
            // Check if contiguous
            const isContiguous = true; // Simplified for year iteration
            const isSameType = currentRequest.isHistorical === chunk.isHistorical;
            const withinLimit = (chunk.year - currentRequest.startYear) < MAX_MERGE_YEARS;

            if (isContiguous && isSameType && withinLimit) {
                currentRequest.end = chunk.end;
                currentRequest.years.push(chunk.year);
                currentRequest.chunks.push(chunk);
            } else {
                fetchRequests.push(currentRequest);
                currentRequest = {
                    start: chunk.start,
                    end: chunk.end,
                    years: [chunk.year],
                    chunks: [chunk],
                    isHistorical: chunk.isHistorical,
                    startYear: chunk.year
                };
            }
        } else {
            currentRequest = {
                start: chunk.start,
                end: chunk.end,
                years: [chunk.year],
                chunks: [chunk],
                isHistorical: chunk.isHistorical,
                startYear: chunk.year
            };
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

                // Save to cache (if historical)
                if (req.isHistorical) {
                    for (const year of req.years) {
                        const yearStartFull = `${year}-01-01`;
                        const yearEndFull = `${year}-12-31`;

                        // Calculate actual coverage for this year based on request range
                        const coverageStart = req.start > yearStartFull ? req.start : yearStartFull;
                        const coverageEnd = req.end < yearEndFull ? req.end : yearEndFull;

                        const yearData = normalized.filter(d => d.date >= yearStartFull && d.date <= yearEndFull);

                        if (yearData.length > 0) {
                            const entry = {
                                data: yearData,
                                coverage: [{ start: coverageStart, end: coverageEnd }],
                                lastUpdated: Date.now()
                            };
                            setYearSupersetEntry(marketKey, stockNo, priceModeKey, year, split, entry);
                        }
                    }
                }

                // Distribute data to chunks
                for (const chunk of req.chunks) {
                    chunk.data = filterDatasetForWindow(normalized, chunk.start, chunk.end);
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

    test('should split current year into historical and current chunks', async () => {
        // Mock date to 2025-12-01
        const mockDate = new Date('2025-12-01T00:00:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);

        fetchWithAdaptiveRetry.mockResolvedValue({
            data: []
        });

        await tryFetchSmartGapMergedRange({
            stockNo: '2330',
            startDate: '2024-01-01',
            endDate: '2025-12-01',
            marketKey: 'TWSE',
            fetchDiagnostics: {}
        });

        // Should be split into:
        // 1. 2024 (Historical)
        // 2. 2025-01-01 to 2025-11-30 (Historical part of current year)
        // 3. 2025-12-01 to 2025-12-01 (Current part)

        expect(fetchWithAdaptiveRetry).toHaveBeenCalledTimes(2);

        // First request: 2024 + 2025(Jan-Nov)
        expect(fetchWithAdaptiveRetry).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('start=2024-01-01&end=2025-11-30'),
            expect.any(Object)
        );

        // Second request: 2025(Dec)
        expect(fetchWithAdaptiveRetry).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('start=2025-12-01&end=2025-12-01'),
            expect.any(Object)
        );

        jest.useRealTimers();
    });

    test('should incrementally fetch and merge missing data', async () => {
        // Pre-populate cache with Jan-Nov 2025
        setYearSupersetEntry('TWSE', '2330', 'raw', 2025, false, {
            data: [{ date: '2025-01-01', close: 100 }],
            coverage: [{ start: '2025-01-01', end: '2025-11-30' }]
        });

        fetchWithAdaptiveRetry.mockResolvedValue({
            data: [{ date: '2025-12-01', close: 110 }]
        });

        const result = await tryFetchSmartGapMergedRange({
            stockNo: '2330',
            startDate: '2025-01-01',
            endDate: '2025-12-01',
            marketKey: 'TWSE',
            fetchDiagnostics: {}
        });

        // Should only fetch Dec 2025
        expect(fetchWithAdaptiveRetry).toHaveBeenCalledTimes(1);
        expect(fetchWithAdaptiveRetry).toHaveBeenCalledWith(
            expect.stringContaining('start=2025-12-01&end=2025-12-01'),
            expect.any(Object)
        );

        // Result should contain merged data (Jan + Dec)
        expect(result.data).toHaveLength(2);
        expect(result.data[0].date).toBe('2025-01-01');
        expect(result.data[1].date).toBe('2025-12-01');
    });
});
