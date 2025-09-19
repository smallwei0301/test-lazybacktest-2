
// --- Worker Data Acquisition & Cache (v10.3) ---
// Patch Tag: LB-PRICE-MODE-20240513A
const WORKER_DATA_VERSION = "v10.3";
const workerCachedStockData = new Map(); // Map<marketKey, Map<cacheKey, CacheEntry>>
const workerMonthlyCache = new Map(); // Map<marketKey, Map<stockKey, Map<monthKey, MonthCacheEntry>>>
let workerLastDataset = null;
let workerLastMeta = null;
let pendingNextDayTrade = null; // 隔日交易追蹤變數

const DAY_MS = 24 * 60 * 60 * 1000;

function getMarketKey(marketType) {
  return (marketType || "TWSE").toUpperCase();
}

function getPriceModeKey(adjusted) {
  return adjusted ? "ADJ" : "RAW";
}

function buildCacheKey(stockNo, startDate, endDate, adjusted = false) {
  return `${stockNo}__${startDate}__${endDate}__${getPriceModeKey(adjusted)}`;
}

function ensureMarketCache(marketKey) {
  if (!workerCachedStockData.has(marketKey)) {
    workerCachedStockData.set(marketKey, new Map());
  }
  return workerCachedStockData.get(marketKey);
}

function ensureMonthlyMarketCache(marketKey) {
  if (!workerMonthlyCache.has(marketKey)) {
    workerMonthlyCache.set(marketKey, new Map());
  }
  return workerMonthlyCache.get(marketKey);
}

function getStockCacheKey(stockNo, adjusted = false) {
  return `${stockNo}__${getPriceModeKey(adjusted)}`;
}

function ensureMonthlyStockCache(marketKey, stockNo, adjusted = false) {
  const marketCache = ensureMonthlyMarketCache(marketKey);
  const stockKey = getStockCacheKey(stockNo, adjusted);
  if (!marketCache.has(stockKey)) {
    marketCache.set(stockKey, new Map());
  }
  return marketCache.get(stockKey);
}

function getMonthlyCacheEntry(marketKey, stockNo, monthKey, adjusted = false) {
  const marketCache = workerMonthlyCache.get(marketKey);
  if (!marketCache) return null;
  const stockCache = marketCache.get(getStockCacheKey(stockNo, adjusted));
  if (!stockCache) return null;
  const entry = stockCache.get(monthKey);
  if (!entry) return null;
  if (!(entry.sources instanceof Set)) {
    entry.sources = new Set(entry.sources || []);
  }
  if (!Array.isArray(entry.coverage)) {
    entry.coverage = [];
  }
  if (!Array.isArray(entry.data)) {
    entry.data = [];
  }
  return entry;
}

function setMonthlyCacheEntry(marketKey, stockNo, monthKey, entry, adjusted = false) {
  const stockCache = ensureMonthlyStockCache(marketKey, stockNo, adjusted);
  if (!(entry.sources instanceof Set)) {
    entry.sources = new Set(entry.sources || []);
  }
  if (!Array.isArray(entry.coverage)) {
    entry.coverage = [];
  }
  if (!Array.isArray(entry.data)) {
    entry.data = [];
  }
  stockCache.set(monthKey, entry);
}

function isoToUTC(iso) {
  if (!iso) return NaN;
  const [y, m, d] = iso.split("-").map((val) => parseInt(val, 10));
  if ([y, m, d].some((num) => Number.isNaN(num))) return NaN;
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function utcToISO(ms) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function mergeRangeBounds(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function addCoverage(entry, startISO, endISO) {
  if (!entry) return;
  const start = isoToUTC(startISO);
  const end = isoToUTC(endISO);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
  const newRange = { start, end: end + DAY_MS };
  const normalized = Array.isArray(entry.coverage)
    ? entry.coverage.map((range) => ({ ...range }))
    : [];
  normalized.push(newRange);
  entry.coverage = mergeRangeBounds(normalized);
}

function computeMissingRanges(existingCoverage, targetStartISO, targetEndISO) {
  const targetStart = isoToUTC(targetStartISO);
  const targetEnd = isoToUTC(targetEndISO);
  if (
    !Number.isFinite(targetStart) ||
    !Number.isFinite(targetEnd) ||
    targetEnd < targetStart
  ) {
    return [];
  }
  const coverage = mergeRangeBounds(
    (existingCoverage || []).map((range) => ({ ...range })),
  );
  const targetEndExclusive = targetEnd + DAY_MS;
  const missing = [];
  let cursor = targetStart;
  for (let i = 0; i < coverage.length; i += 1) {
    const range = coverage[i];
    if (range.end <= cursor) continue;
    if (range.start >= targetEndExclusive) break;
    if (range.start > cursor) {
      missing.push({ start: cursor, end: Math.min(range.start, targetEndExclusive) });
    }
    cursor = Math.max(cursor, range.end);
    if (cursor >= targetEndExclusive) break;
  }
  if (cursor < targetEndExclusive) {
    missing.push({ start: cursor, end: targetEndExclusive });
  }
  return missing.filter((range) => range.end - range.start > 0);
}

function getCoveredLength(existingCoverage, targetStartISO, targetEndISO) {
  const targetStart = isoToUTC(targetStartISO);
  const targetEndExclusive = isoToUTC(targetEndISO) + DAY_MS;
  if (
    !Number.isFinite(targetStart) ||
    !Number.isFinite(targetEndExclusive) ||
    targetEndExclusive <= targetStart
  ) {
    return 0;
  }
  const coverage = mergeRangeBounds(
    (existingCoverage || []).map((range) => ({ ...range })),
  );
  let total = 0;
  for (let i = 0; i < coverage.length; i += 1) {
    const seg = coverage[i];
    const start = Math.max(seg.start, targetStart);
    const end = Math.min(seg.end, targetEndExclusive);
    if (end > start) total += end - start;
  }
  return total;
}

function rangeBoundsToISO(range) {
  const startISO = utcToISO(range.start);
  const endISO = utcToISO(range.end - DAY_MS);
  return { startISO, endISO };
}

function mergeMonthlyData(entry, newRows) {
  if (!entry || !Array.isArray(newRows)) return;
  const map = new Map(
    (entry.data || []).map((row) => [row.date, row]),
  );
  newRows.forEach((row) => {
    if (row && row.date) {
      map.set(row.date, row);
    }
  });
  entry.data = Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

}

function getWorkerCacheEntry(marketKey, cacheKey) {
  const marketCache = workerCachedStockData.get(marketKey);
  if (!marketCache) return null;
  const entry = marketCache.get(cacheKey);
  if (entry && Array.isArray(entry.data)) {
    workerLastDataset = entry.data;
    workerLastMeta = {
      ...entry.meta,
      marketKey,
      dataSource: entry.dataSource,
      stockName: entry.stockName,
    };
    return entry;
  }
  return null;
}

function setWorkerCacheEntry(marketKey, cacheKey, entry) {
  const marketCache = ensureMarketCache(marketKey);
  marketCache.set(cacheKey, entry);
  workerLastDataset = entry.data;
  workerLastMeta = {
    ...entry.meta,
    marketKey,
    dataSource: entry.dataSource,
    stockName: entry.stockName,
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatTWDateWorker(twDate) {
  try {
    if (!twDate || typeof twDate !== "string") return null;
    const parts = twDate.split("/");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const yInt = parseInt(y, 10);
    const mInt = parseInt(m, 10);
    const dInt = parseInt(d, 10);
    if (Number.isNaN(yInt) || mInt < 1 || mInt > 12 || dInt < 1 || dInt > 31)
      return null;
    return `${1911 + yInt}-${pad2(mInt)}-${pad2(dInt)}`;
  } catch (e) {
    console.warn(`Worker Date Error: ${twDate}`, e);
    return null;
  }
}

function enumerateMonths(startDate, endDate) {
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= last) {
    const monthKey = `${cursor.getFullYear()}${pad2(cursor.getMonth() + 1)}`;
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const rangeStart =
      startDate > monthStart ? new Date(startDate) : monthStart;
    const rangeEnd = endDate < monthEnd ? new Date(endDate) : monthEnd;
    months.push({
      monthKey,
      label: `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`,
      rangeStart,
      rangeEnd,
      rangeStartISO: rangeStart.toISOString().split("T")[0],
      rangeEndISO: rangeEnd.toISOString().split("T")[0],
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithAdaptiveRetry(url, options = {}, attempt = 1) {
  const response = await fetch(url, options);
  if (!response.ok) {
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const backoff = Math.min(1500, 250 * Math.pow(2, attempt - 1));
      await delay(backoff);
      return fetchWithAdaptiveRetry(url, options, attempt + 1);
    }
    const bodyText = await response.text();
    throw new Error(`HTTP ${response.status}: ${bodyText?.slice(0, 120)}`);
  }
  return response.json();
}

function normalizeProxyRow(item, isTpex, startDateObj, endDateObj) {
  try {
    let dateStr = null;
    let open = null,
      high = null,
      low = null,
      close = null,
      volume = 0;
    if (Array.isArray(item)) {
      dateStr = item[0];
      const parseNumber = (val) => {
        if (val === null || val === undefined) return null;
        const num = Number(String(val).replace(/,/g, ""));
        return Number.isFinite(num) ? num : null;
      };
      if (isTpex) {
        volume = parseNumber(item[1]) || 0;
        open = parseNumber(item[3]);
        high = parseNumber(item[4]);
        low = parseNumber(item[5]);
        close = parseNumber(item[6]);
      } else {
        volume = parseNumber(item[1]) || 0;
        open = parseNumber(item[3]);
        high = parseNumber(item[4]);
        low = parseNumber(item[5]);
        close = parseNumber(item[6]);
      }
    } else if (item && typeof item === "object") {
      dateStr = item.date || item.Date || item.tradeDate || null;
      open = Number(item.open ?? item.Open ?? item.Opening ?? null);
      high = Number(item.high ?? item.High ?? item.max ?? null);
      low = Number(item.low ?? item.Low ?? item.min ?? null);
      close = Number(item.close ?? item.Close ?? null);
      volume = Number(item.volume ?? item.Volume ?? item.Trading_Volume ?? 0);
    } else {
      return null;
    }
    if (!dateStr) return null;
    let isoDate = null;
    const trimmed = String(dateStr).trim();
    if (/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      isoDate = formatTWDateWorker(trimmed);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      isoDate = trimmed;
    } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("/");
      isoDate = `${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`;
    }
    if (!isoDate) return null;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime()) || d < startDateObj || d > endDateObj)
      return null;
    if ((open === null || open === 0) && close !== null) open = close;
    if ((high === null || high === 0) && close !== null)
      high = Math.max(open ?? close, close);
    if ((low === null || low === 0) && close !== null)
      low = Math.min(open ?? close, close);
    const clean = (val) => (val === null || Number.isNaN(val) ? null : val);
    const volNumber = Number(String(volume).replace(/,/g, "")) || 0;
    return {
      date: isoDate,
      open: clean(open),
      high: clean(high),
      low: clean(low),
      close: clean(close),
      volume: Math.round(volNumber / 1000),
    };
  } catch (error) {
    return null;
  }
}

function dedupeAndSortData(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row && row.date) map.set(row.date, row);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
}

function summariseDataSourceFlags(flags, defaultLabel) {
  if (!flags || flags.size === 0) return defaultLabel;
  if (flags.size === 1) return Array.from(flags)[0];
  const hasCache = Array.from(flags).some((src) => /快取|cache/i.test(src));
  const hasRemote = Array.from(flags).some((src) => !/快取|cache/i.test(src));
  if (hasRemote && hasCache) return `${defaultLabel} (部分快取)`;
  if (hasCache) return `${defaultLabel} (快取)`;
  return Array.from(flags).join(" / ");
}

async function runWithConcurrency(items, limit, workerFn) {
  const results = new Array(items.length);
  let index = 0;
  async function runner() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await workerFn(items[currentIndex], currentIndex);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    runner(),
  );
  await Promise.all(workers);
  return results;
}

async function fetchStockData(stockNo, startDate, endDate, marketType, options = {}) {
  if (!marketType) {
    throw new Error(
      "fetchStockData 缺少 marketType 參數! 無法判斷上市或上櫃。",
    );
  }
  const adjusted = Boolean(options.adjusted || options.adjustedPrice);
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  if (
    Number.isNaN(startDateObj.getTime()) ||
    Number.isNaN(endDateObj.getTime())
  ) {
    throw new Error("日期格式無效");
  }
  if (startDateObj > endDateObj) {
    throw new Error("開始日期需早於結束日期");
  }
  const marketKey = getMarketKey(marketType);
  const cacheKey = buildCacheKey(stockNo, startDate, endDate, adjusted);
  const cachedEntry = getWorkerCacheEntry(marketKey, cacheKey);
  if (cachedEntry) {
    self.postMessage({
      type: "progress",
      progress: 15,
      message: "命中背景快取...",
    });
    return {
      data: cachedEntry.data,
      dataSource: `${cachedEntry.dataSource || marketKey} (Worker快取)`,
      stockName: cachedEntry.stockName || stockNo,
    };
  }

  self.postMessage({
    type: "progress",
    progress: 5,
    message: "準備抓取原始數據...",
  });
  const months = enumerateMonths(startDateObj, endDateObj);
  if (months.length === 0) {
    const entry = {
      data: [],
      stockName: stockNo,
      dataSource: marketKey,
      timestamp: Date.now(),
      meta: { stockNo, startDate, endDate },
    };
    setWorkerCacheEntry(marketKey, cacheKey, entry);
    return { data: [], dataSource: marketKey, stockName };
  }
  const proxyPath = marketKey === "TPEX" ? "/api/tpex/" : "/api/twse/";
  const isTpex = marketKey === "TPEX";
  const concurrencyLimit = isTpex ? 3 : 4;
  let completed = 0;
  const monthResults = await runWithConcurrency(
    months,
    concurrencyLimit,
    async (monthInfo) => {
      try {
        let monthEntry = getMonthlyCacheEntry(
        marketKey,
        stockNo,
        monthInfo.monthKey,
        adjusted,
      );
      if (!monthEntry) {
        monthEntry = {
          data: [],
          coverage: [],
          sources: new Set(),
          stockName: "",
          lastUpdated: 0,
        };
        setMonthlyCacheEntry(
          marketKey,
          stockNo,
          monthInfo.monthKey,
          monthEntry,
          adjusted,
        );
      }

      const existingCoverage = Array.isArray(monthEntry.coverage)
        ? monthEntry.coverage.map((range) => ({ ...range }))
        : [];
      const missingRanges = computeMissingRanges(
        existingCoverage,
        monthInfo.rangeStartISO,
        monthInfo.rangeEndISO,
      );
      const coveredLengthBefore = getCoveredLength(
        existingCoverage,
        monthInfo.rangeStartISO,
        monthInfo.rangeEndISO,
      );
      const monthSourceFlags = new Set(
        monthEntry.sources instanceof Set
          ? Array.from(monthEntry.sources)
          : monthEntry.sources || [],
      );
      let monthStockName = monthEntry.stockName || "";

      if (missingRanges.length > 0) {
        for (let i = 0; i < missingRanges.length; i += 1) {
          const missingRange = missingRanges[i];
          const { startISO, endISO } = rangeBoundsToISO(missingRange);
          const params = new URLSearchParams({
            stockNo,
            month: monthInfo.monthKey,
            start: startISO,
            end: endISO,
          });
          if (adjusted) {
            params.set("adjusted", "1");
          }
          const url = `${proxyPath}?${params.toString()}`;
          try {
            const payload = await fetchWithAdaptiveRetry(url, {
              headers: { Accept: "application/json" },
            });
            const rows = Array.isArray(payload?.aaData)
              ? payload.aaData
              : Array.isArray(payload?.data)
                ? payload.data
                : [];
            const normalized = [];
            rows.forEach((row) => {
              const normalizedRow = normalizeProxyRow(
                row,
                isTpex,
                startDateObj,
                endDateObj,
              );
              if (normalizedRow) normalized.push(normalizedRow);
            });
            if (payload?.stockName) {
              monthStockName = payload.stockName;
            }
            const sourceLabel =
              payload?.dataSource || (isTpex ? "TPEX" : "TWSE");
            if (sourceLabel) {
              monthSourceFlags.add(sourceLabel);
              monthEntry.sources.add(sourceLabel);
            }
            if (normalized.length > 0) {
              mergeMonthlyData(monthEntry, normalized);
            }
            addCoverage(monthEntry, startISO, endISO);
            monthEntry.lastUpdated = Date.now();
            if (!monthEntry.stockName && monthStockName) {
              monthEntry.stockName = monthStockName;
            }
          } catch (error) {
            console.error(`[Worker] 抓取 ${url} 失敗:`, error);
          }
        }
      }

      const rowsForRange = (monthEntry.data || []).filter(
        (row) =>
          row &&
          row.date >= monthInfo.rangeStartISO &&
          row.date <= monthInfo.rangeEndISO,
      );

      const usedCache =
        missingRanges.length === 0 || coveredLengthBefore > 0;

      return {
        rows: rowsForRange,
        sourceFlags: Array.from(monthSourceFlags),
        stockName: monthStockName,
        usedCache,
      };

      } finally {
        completed += 1;
        const progress = 10 + Math.round((completed / months.length) * 35);
        self.postMessage({
          type: "progress",
          progress,
          message: `處理 ${monthInfo.label} 數據...`,
        });
      }
    },
  );

  const normalizedRows = [];
  const sourceFlags = new Set();
  let stockName = "";
  monthResults.forEach((res) => {
    if (!res) return;
    if (res.stockName && !stockName) stockName = res.stockName;
    if (Array.isArray(res.sourceFlags)) {
      res.sourceFlags.forEach((flag) => {
        if (flag) sourceFlags.add(flag);
      });
    }
    if (res.usedCache) {
      sourceFlags.add("Worker月度快取");
    }
    (res.rows || []).forEach((row) => {
      const normalized = normalizeProxyRow(
        row,
        isTpex,
        startDateObj,
        endDateObj,
      );
      if (normalized) normalizedRows.push(normalized);
    });
  });

  self.postMessage({ type: "progress", progress: 55, message: "整理數據..." });
  const deduped = dedupeAndSortData(normalizedRows);
  const dataSourceLabel = summariseDataSourceFlags(
    sourceFlags,
    isTpex ? "TPEX" : "TWSE",
  );

  setWorkerCacheEntry(marketKey, cacheKey, {
    data: deduped,
    stockName: stockName || stockNo,
    dataSource: dataSourceLabel,
    timestamp: Date.now(),
    meta: { stockNo, startDate, endDate, priceMode: getPriceModeKey(adjusted) },
    priceMode: getPriceModeKey(adjusted),
  });

  if (deduped.length === 0) {
    console.warn(
      `[Worker] 指定範圍 (${startDate} ~ ${endDate}) 無 ${stockNo} 交易數據`,
    );
  }

  return {
    data: deduped,
    dataSource: dataSourceLabel,
    stockName: stockName || stockNo,
  };
}

// --- TAIEX 數據獲取 ---
async function fetchTAIEXData(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const allData = [];

  // 獲取每日指數數據（簡化實現）
  let current = new Date(startDate);
  const dates = [];

  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    dates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }

  // 注意：這裡需要實際的 TAIEX API，暫時使用模擬數據結構
  // 在實際實現中，應該調用適當的台灣加權指數 API

  self.postMessage({
    type: "progress",
    progress: 25,
    message: "獲取加權指數數據...",
  });

  // 實際實現時應該替換為真實的 TAIEX API 調用
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    // 這裡應該調用實際的 TAIEX API
    // 暫時跳過，返回空數據表示需要實現
  }

  // 如果沒有找到 TAIEX 數據，拋出錯誤提示用戶使用具體股票代碼
  throw new Error("TAIEX 指數數據功能開發中，請使用具體的股票代碼進行回測");
}

// --- 技術指標計算工具 ---
function calculateMA(prices, period) {
  if (!Array.isArray(prices) || period <= 0) {
    return new Array(prices?.length || 0).fill(null);
  }
  const result = new Array(prices.length).fill(null);
  const window = new Array(period).fill(null);
  let sum = 0;
  let validCount = 0;
  let head = 0;

  for (let i = 0; i < prices.length; i++) {
    const incoming = Number.isFinite(prices[i]) ? prices[i] : null;
    const outgoing = window[head];
    if (outgoing !== null) {
      sum -= outgoing;
      validCount -= 1;
    }
    window[head] = incoming;
    head = (head + 1) % period;
    if (incoming !== null) {
      sum += incoming;
      validCount += 1;
    }
    if (i >= period - 1 && validCount === period) {
      result[i] = sum / period;
    }

  }

  return result;
}

function calculateEMA(prices, period) {
  if (!Array.isArray(prices) || period <= 0) {
    return new Array(prices?.length || 0).fill(null);
  }
  const result = new Array(prices.length).fill(null);
  const multiplier = 2 / (period + 1);
  let ema = null;
  let count = 0;
  let sum = 0;

  for (let i = 0; i < prices.length; i++) {
    const value = Number.isFinite(prices[i]) ? prices[i] : null;
    if (value === null) {
      ema = null;
      sum = 0;
      count = 0;
      continue;
    }

    if (ema === null) {
      sum += value;
      count += 1;
      if (count === period) {
        ema = sum / period;
        result[i] = ema;
      }
    } else {
      ema = (value - ema) * multiplier + ema;
      result[i] = ema;
    }
  }

  return result;
}

function calculateDIEMA(diValues, period) {
  if (!Array.isArray(diValues) || period <= 0) {
    return new Array(diValues?.length || 0).fill(null);
  }
  const result = new Array(diValues.length).fill(null);
  const multiplier = 2 / (period + 1);
  let ema = null;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < diValues.length; i++) {
    const value = Number.isFinite(diValues[i]) ? diValues[i] : null;
    if (value === null) {
      ema = null;
      sum = 0;
      count = 0;
      continue;
    }

    if (ema === null) {
      sum += value;
      count += 1;
      if (count === period) {
        ema = sum / period;
        result[i] = ema;
      }
    } else {
      ema = (value - ema) * multiplier + ema;
      result[i] = ema;
    }
  }

  return result;
}

function calculateRSI(prices, period = 14) {
  if (!Array.isArray(prices) || period <= 0 || prices.length <= period) {
    return new Array(prices.length || 0).fill(null);
  }
  const result = new Array(prices.length).fill(null);
  let gainSum = 0;
  let lossSum = 0;
  let initialized = false;
  let prevPrice = null;
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < prices.length; i++) {
    const current = Number.isFinite(prices[i]) ? prices[i] : null;
    if (current === null) {
      prevPrice = null;
      initialized = false;
      gainSum = 0;
      lossSum = 0;
      continue;
    }

    if (prevPrice === null) {
      prevPrice = current;
      continue;
    }

    const change = current - prevPrice;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    prevPrice = current;

    if (!initialized) {
      gainSum += gain;
      lossSum += loss;
      if (i >= period) {
        avgGain = gainSum / period;
        avgLoss = lossSum / period;
        initialized = true;
        result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

function calculateMACD(
  highs,
  lows,
  closes,
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9,
) {
  const length = closes.length;
  const empty = {
    macd: new Array(length).fill(null),
    signal: new Array(length).fill(null),
    histogram: new Array(length).fill(null),
  };
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length !== length ||
    lows.length !== length ||
    shortPeriod <= 0 ||
    longPeriod <= shortPeriod ||
    signalPeriod <= 0
  ) {
    return empty;
  }

  const diValues = new Array(length).fill(null);
  for (let i = 0; i < length; i++) {
    const h = Number.isFinite(highs[i]) ? highs[i] : null;
    const l = Number.isFinite(lows[i]) ? lows[i] : null;
    const c = Number.isFinite(closes[i]) ? closes[i] : null;
    if (h !== null && l !== null && c !== null) {
      diValues[i] = (h + l + 2 * c) / 4;
    }
  }

  const shortEma = calculateDIEMA(diValues, shortPeriod);
  const longEma = calculateDIEMA(diValues, longPeriod);
  const macd = new Array(length).fill(null);
  const validMacdValues = [];

  for (let i = 0; i < length; i++) {
    const emaShort = Number.isFinite(shortEma[i]) ? shortEma[i] : null;
    const emaLong = Number.isFinite(longEma[i]) ? longEma[i] : null;
    if (emaShort !== null && emaLong !== null) {
      const value = emaShort - emaLong;
      macd[i] = value;
      validMacdValues.push({ index: i, value });
    }
  }

  const signal = new Array(length).fill(null);
  if (validMacdValues.length >= signalPeriod) {
    let ema = null;
    const multiplier = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = 0; i < validMacdValues.length; i++) {
      const { index, value } = validMacdValues[i];
      if (ema === null) {
        sum += value;
        if (i + 1 === signalPeriod) {
          ema = sum / signalPeriod;
          signal[index] = ema;
        }
      } else {
        ema = (value - ema) * multiplier + ema;
        signal[index] = ema;
      }
    }
  }

  const histogram = new Array(length).fill(null);
  for (let i = 0; i < length; i++) {
    if (macd[i] !== null && signal[i] !== null) {
      histogram[i] = macd[i] - signal[i];
    }
  }


  return { macd, signal, histogram };
}

function calculateBollingerBands(prices, period = 20, deviations = 2) {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period) {
    return {
      upper: new Array(prices.length || 0).fill(null),
      middle: new Array(prices.length || 0).fill(null),
      lower: new Array(prices.length || 0).fill(null),
    };
  }

  const middle = calculateMA(prices, period);
  const upper = new Array(prices.length).fill(null);
  const lower = new Array(prices.length).fill(null);

  for (let i = period - 1; i < prices.length; i++) {
    if (!Number.isFinite(middle[i])) continue;
    let varianceSum = 0;
    let count = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const value = Number.isFinite(prices[j]) ? prices[j] : null;
      if (value === null) {
        valid = false;
        break;
      }
      const diff = value - middle[i];
      varianceSum += diff * diff;
      count += 1;
    }
    if (!valid || count !== period) continue;
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = middle[i] + deviations * stdDev;
    lower[i] = middle[i] - deviations * stdDev;
  }

  return { upper, middle, lower };
}

function calculateKD(highs, lows, closes, period = 9) {
  const length = closes.length;
  const empty = {
    k: new Array(length).fill(null),
    d: new Array(length).fill(null),
  };
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length !== length ||
    lows.length !== length ||
    period <= 0
  ) {
    return empty;
  }

  const rsv = new Array(length).fill(null);
  for (let i = period - 1; i < length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const h = Number.isFinite(highs[j]) ? highs[j] : null;
      const l = Number.isFinite(lows[j]) ? lows[j] : null;
      if (h === null || l === null) {
        valid = false;
        break;
      }
      highest = Math.max(highest, h);
      lowest = Math.min(lowest, l);
    }
    const close = Number.isFinite(closes[i]) ? closes[i] : null;
    if (!valid || close === null) continue;
    if (highest === lowest) {
      rsv[i] = i > 0 && rsv[i - 1] !== null ? rsv[i - 1] : 50;
    } else {
      rsv[i] = ((close - lowest) / (highest - lowest)) * 100;
    }
  }

  const kLine = new Array(length).fill(null);
  const dLine = new Array(length).fill(null);
  let kPrev = 50;
  let dPrev = 50;

  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(rsv[i])) {
      kPrev = 50;
      dPrev = 50;
      continue;
    }
    kPrev = (rsv[i] + 2 * kPrev) / 3;
    dPrev = (kPrev + 2 * dPrev) / 3;
    kLine[i] = Math.min(100, Math.max(0, kPrev));
    dLine[i] = Math.min(100, Math.max(0, dPrev));
  }

  return { k: kLine, d: dLine };
}

function calculateWilliams(highs, lows, closes, period = 14) {
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length !== lows.length ||
    highs.length !== closes.length ||
    period <= 0
  ) {
    return new Array(closes.length || 0).fill(null);
  }
  const result = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const h = Number.isFinite(highs[j]) ? highs[j] : null;
      const l = Number.isFinite(lows[j]) ? lows[j] : null;
      if (h === null || l === null) {
        valid = false;
        break;
      }
      highest = Math.max(highest, h);
      lowest = Math.min(lowest, l);
    }
    const close = Number.isFinite(closes[i]) ? closes[i] : null;
    if (!valid || close === null) continue;
    if (highest === lowest) {
      result[i] = i > 0 && result[i - 1] !== null ? result[i - 1] : -50;
    } else {
      result[i] = ((highest - close) / (highest - lowest)) * -100;
    }
  }
  return result;
}

function calculateDailyReturns(portfolioValues) {
  if (!Array.isArray(portfolioValues) || portfolioValues.length < 2) {
    return [];
  }
  const returns = [];
  for (let i = 1; i < portfolioValues.length; i++) {
    const today = Number.isFinite(portfolioValues[i])
      ? portfolioValues[i]
      : null;
    const yesterday = Number.isFinite(portfolioValues[i - 1])
      ? portfolioValues[i - 1]
      : null;
    if (today !== null && yesterday !== null && yesterday !== 0) {
      returns.push(today / yesterday - 1);
    } else {
      returns.push(0);
    }
  }
  return returns;
}

function calculateSharpeRatio(dailyReturns, annualReturnPct) {
  if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) return 0;
  const riskFreeRate = 0.01;
  const avg = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - avg) * (r - avg), 0) /
    dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  const annualStdDev = stdDev * Math.sqrt(252);
  const annualExcess = annualReturnPct / 100 - riskFreeRate;
  return annualStdDev !== 0 ? annualExcess / annualStdDev : 0;
}

function calculateSortinoRatio(dailyReturns, annualReturnPct) {
  if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) return 0;
  const targetAnnual = 0.01;
  const targetDaily = Math.pow(1 + targetAnnual, 1 / 252) - 1;
  const downsideDiffs = dailyReturns.map((r) => Math.min(0, r - targetDaily));
  const downsideVariance =
    downsideDiffs.reduce((sum, r) => sum + r * r, 0) / dailyReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return Infinity;
  const annualDownsideDev = downsideDev * Math.sqrt(252);
  const annualExcess = annualReturnPct / 100 - targetAnnual;
  return annualDownsideDev !== 0 ? annualExcess / annualDownsideDev : Infinity;
}

function calculateMaxDrawdown(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    peak = Math.max(peak, value);
    if (peak > 0) {
      const drawdown = ((peak - value) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  return maxDrawdown;
}

// --- 計算所有指標 ---
function calculateAllIndicators(data, params) {
  /* ... (程式碼與上次 Part 3 相同) ... */ self.postMessage({
    type: "progress",
    progress: 55,
    message: "計算指標...",
  });
  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);
  const indic = {};
  const {
    entryParams: ep,
    exitParams: xp,
    enableShorting,
    shortEntryParams: sep,
    shortExitParams: sxp,
  } = params;
  try {
    const maCalculator = calculateMA;

    // === 入場策略 MA 指標 ===
    const entryShortMAPeriod = ep?.shortPeriod || 5;
    const entryLongMAPeriod = ep?.longPeriod || 20;
    indic.maShort = maCalculator(closes, entryShortMAPeriod);
    indic.maLong = maCalculator(closes, entryLongMAPeriod);

    // === 出場策略 MA 指標 (獨立參數) ===
    const exitShortMAPeriod = xp?.shortPeriod || 5;
    const exitLongMAPeriod = xp?.longPeriod || 20;
    const exitMAPeriod = xp?.period || exitLongMAPeriod;
    indic.maShortExit = maCalculator(closes, exitShortMAPeriod);
    indic.maLongExit = maCalculator(closes, exitLongMAPeriod);
    indic.maExit = maCalculator(closes, exitMAPeriod);

    // === 做空策略 MA 指標 (獨立參數) ===
    if (enableShorting) {
      const shortEntryShortMAPeriod = sep?.shortPeriod || 5;
      const shortEntryLongMAPeriod = sep?.longPeriod || 20;
      const shortExitShortMAPeriod = sxp?.shortPeriod || 5;
      const shortExitLongMAPeriod = sxp?.longPeriod || 20;

      indic.maShortShortEntry = maCalculator(closes, shortEntryShortMAPeriod);
      indic.maLongShortEntry = maCalculator(closes, shortEntryLongMAPeriod);
      indic.maShortCover = maCalculator(closes, shortExitShortMAPeriod);
      indic.maLongCover = maCalculator(closes, shortExitLongMAPeriod);
    }
    const getParam = (longParam, shortParam, defaultVal) => {
      const p1 = longParam;
      const p2 = enableShorting ? shortParam : undefined;
      if (p1 !== undefined && p2 !== undefined && p1 !== p2) {
        return { long: p1 ?? defaultVal, short: p2 ?? defaultVal };
      }
      if (p1 !== undefined) return p1 ?? defaultVal;
      if (p2 !== undefined) return p2 ?? defaultVal;
      return defaultVal;
    };
    const rsiEntryPeriod = getParam(ep?.period, sxp?.period, 14);
    const rsiExitPeriod = getParam(xp?.period, sep?.period, 14);
    indic.rsiEntry = calculateRSI(
      closes,
      typeof rsiEntryPeriod === "object" ? rsiEntryPeriod.long : rsiEntryPeriod,
    );
    indic.rsiExit = calculateRSI(
      closes,
      typeof rsiExitPeriod === "object" ? rsiExitPeriod.long : rsiExitPeriod,
    );
    if (enableShorting) {
      indic.rsiCover = calculateRSI(
        closes,
        typeof rsiEntryPeriod === "object"
          ? rsiEntryPeriod.short
          : rsiEntryPeriod,
      );
      indic.rsiShortEntry = calculateRSI(
        closes,
        typeof rsiExitPeriod === "object" ? rsiExitPeriod.short : rsiExitPeriod,
      );
    }
    const macdEntryShort = ep?.shortPeriod || 12;
    const macdEntryLong = ep?.longPeriod || 26;
    const macdEntrySignal = ep?.signalPeriod || 9;
    const macdCoverShort = enableShorting
      ? (sxp?.shortPeriod ?? macdEntryShort)
      : macdEntryShort;
    const macdCoverLong = enableShorting
      ? (sxp?.longPeriod ?? macdEntryLong)
      : macdEntryLong;
    const macdCoverSignal = enableShorting
      ? (sxp?.signalPeriod ?? macdEntrySignal)
      : macdEntrySignal;
    if (
      !enableShorting ||
      (macdEntryShort === macdCoverShort &&
        macdEntryLong === macdCoverLong &&
        macdEntrySignal === macdCoverSignal)
    ) {
      const macdResult = calculateMACD(
        highs,
        lows,
        closes,
        macdEntryShort,
        macdEntryLong,
        macdEntrySignal,
      );
      indic.macdEntry = macdResult.macd;
      indic.macdSignalEntry = macdResult.signal;
      indic.macdHistEntry = macdResult.histogram;
      if (enableShorting) {
        indic.macdCover = indic.macdEntry;
        indic.macdSignalCover = indic.macdSignalEntry;
        indic.macdHistCover = indic.macdHistEntry;
      }
    } else {
      const macdEntryResult = calculateMACD(
        highs,
        lows,
        closes,
        macdEntryShort,
        macdEntryLong,
        macdEntrySignal,
      );
      indic.macdEntry = macdEntryResult.macd;
      indic.macdSignalEntry = macdEntryResult.signal;
      indic.macdHistEntry = macdEntryResult.histogram;
      const macdCoverResult = calculateMACD(
        highs,
        lows,
        closes,
        macdCoverShort,
        macdCoverLong,
        macdCoverSignal,
      );
      indic.macdCover = macdCoverResult.macd;
      indic.macdSignalCover = macdCoverResult.signal;
      indic.macdHistCover = macdCoverResult.histogram;
    }
    const macdExitShort = xp?.shortPeriod || 12;
    const macdExitLong = xp?.longPeriod || 26;
    const macdExitSignal = xp?.signalPeriod || 9;
    const macdShortEntryShort = enableShorting
      ? (sep?.shortPeriod ?? macdExitShort)
      : macdExitShort;
    const macdShortEntryLong = enableShorting
      ? (sep?.longPeriod ?? macdExitLong)
      : macdExitLong;
    const macdShortEntrySignal = enableShorting
      ? (sep?.signalPeriod ?? macdExitSignal)
      : macdExitSignal;
    if (
      !enableShorting ||
      (macdExitShort === macdShortEntryShort &&
        macdExitLong === macdShortEntryLong &&
        macdExitSignal === macdShortEntrySignal)
    ) {
      const macdResult = calculateMACD(
        highs,
        lows,
        closes,
        macdExitShort,
        macdExitLong,
        macdExitSignal,
      );
      indic.macdExit = macdResult.macd;
      indic.macdSignalExit = macdResult.signal;
      indic.macdHistExit = macdResult.histogram;
      if (enableShorting) {
        indic.macdShortEntry = indic.macdExit;
        indic.macdSignalShortEntry = indic.macdSignalExit;
        indic.macdHistShortEntry = indic.macdHistExit;
      }
    } else {
      const macdExitResult = calculateMACD(
        highs,
        lows,
        closes,
        macdExitShort,
        macdExitLong,
        macdExitSignal,
      );
      indic.macdExit = macdExitResult.macd;
      indic.macdSignalExit = macdExitResult.signal;
      indic.macdHistExit = macdExitResult.histogram;
      const macdShortEntryResult = calculateMACD(
        highs,
        lows,
        closes,
        macdShortEntryShort,
        macdShortEntryLong,
        macdShortEntrySignal,
      );
      indic.macdShortEntry = macdShortEntryResult.macd;
      indic.macdSignalShortEntry = macdShortEntryResult.signal;
      indic.macdHistShortEntry = macdShortEntryResult.histogram;
    }
    const bbEntryPeriod = ep?.period || 20;
    const bbEntryDev = ep?.deviations || 2;
    const bbCoverPeriod = enableShorting
      ? (sxp?.period ?? bbEntryPeriod)
      : bbEntryPeriod;
    const bbCoverDev = enableShorting
      ? (sxp?.deviations ?? bbEntryDev)
      : bbEntryDev;
    if (
      !enableShorting ||
      (bbEntryPeriod === bbCoverPeriod && bbEntryDev === bbCoverDev)
    ) {
      const bbResult = calculateBollingerBands(
        closes,
        bbEntryPeriod,
        bbEntryDev,
      );
      indic.bollingerUpperEntry = bbResult.upper;
      indic.bollingerMiddleEntry = bbResult.middle;
      indic.bollingerLowerEntry = bbResult.lower;
      if (enableShorting) {
        indic.bollingerUpperCover = indic.bollingerUpperEntry;
        indic.bollingerMiddleCover = indic.bollingerMiddleEntry;
        indic.bollingerLowerCover = indic.bollingerLowerEntry;
      }
    } else {
      const bbEntryResult = calculateBollingerBands(
        closes,
        bbEntryPeriod,
        bbEntryDev,
      );
      indic.bollingerUpperEntry = bbEntryResult.upper;
      indic.bollingerMiddleEntry = bbEntryResult.middle;
      indic.bollingerLowerEntry = bbEntryResult.lower;
      const bbCoverResult = calculateBollingerBands(
        closes,
        bbCoverPeriod,
        bbCoverDev,
      );
      indic.bollingerUpperCover = bbCoverResult.upper;
      indic.bollingerMiddleCover = bbCoverResult.middle;
      indic.bollingerLowerCover = bbCoverResult.lower;
    }
    const bbExitPeriod = xp?.period || 20;
    const bbExitDev = xp?.deviations || 2;
    const bbShortEntryPeriod = enableShorting
      ? (sep?.period ?? bbExitPeriod)
      : bbExitPeriod;
    const bbShortEntryDev = enableShorting
      ? (sep?.deviations ?? bbExitDev)
      : bbExitDev;
    if (
      !enableShorting ||
      (bbExitPeriod === bbShortEntryPeriod && bbExitDev === bbShortEntryDev)
    ) {
      const bbResult = calculateBollingerBands(closes, bbExitPeriod, bbExitDev);
      indic.bollingerUpperExit = bbResult.upper;
      indic.bollingerMiddleExit = bbResult.middle;
      indic.bollingerLowerExit = bbResult.lower;
      if (enableShorting) {
        indic.bollingerUpperShortEntry = indic.bollingerUpperExit;
        indic.bollingerMiddleShortEntry = indic.bollingerMiddleExit;
        indic.bollingerLowerShortEntry = indic.bollingerLowerExit;
      }
    } else {
      const bbExitResult = calculateBollingerBands(
        closes,
        bbExitPeriod,
        bbExitDev,
      );
      indic.bollingerUpperExit = bbExitResult.upper;
      indic.bollingerMiddleExit = bbExitResult.middle;
      indic.bollingerLowerExit = bbExitResult.lower;
      const bbShortEntryResult = calculateBollingerBands(
        closes,
        sep?.period || 20,
        sep?.deviations || 2,
      );
      indic.bollingerUpperShortEntry = bbShortEntryResult.upper;
      indic.bollingerMiddleShortEntry = bbShortEntryResult.middle;
      indic.bollingerLowerShortEntry = bbShortEntryResult.lower;
    }
    const kdEntryPeriod = ep?.period || 9;
    const kdCoverPeriod = enableShorting
      ? (sxp?.period ?? kdEntryPeriod)
      : kdEntryPeriod;
    if (!enableShorting || kdEntryPeriod === kdCoverPeriod) {
      const kdResult = calculateKD(highs, lows, closes, kdEntryPeriod);
      indic.kEntry = kdResult.k;
      indic.dEntry = kdResult.d;
      if (enableShorting) {
        indic.kCover = indic.kEntry;
        indic.dCover = indic.dEntry;
      }
    } else {
      const kdEntryResult = calculateKD(highs, lows, closes, kdEntryPeriod);
      indic.kEntry = kdEntryResult.k;
      indic.dEntry = kdEntryResult.d;
      const kdCoverResult = calculateKD(highs, lows, closes, kdCoverPeriod);
      indic.kCover = kdCoverResult.k;
      indic.dCover = kdCoverResult.d;
    }
    const kdExitPeriod = xp?.period || 9;
    const kdShortEntryPeriod = enableShorting
      ? (sep?.period ?? kdExitPeriod)
      : kdExitPeriod;
    if (!enableShorting || kdExitPeriod === kdShortEntryPeriod) {
      const kdResult = calculateKD(highs, lows, closes, kdExitPeriod);
      indic.kExit = kdResult.k;
      indic.dExit = kdResult.d;
      if (enableShorting) {
        indic.kShortEntry = indic.kExit;
        indic.dShortEntry = indic.dExit;
      }
    } else {
      const kdExitResult = calculateKD(highs, lows, closes, kdExitPeriod);
      indic.kExit = kdExitResult.k;
      indic.dExit = kdExitResult.d;
      const kdShortEntryResult = calculateKD(
        highs,
        lows,
        closes,
        kdShortEntryPeriod,
      );
      indic.kShortEntry = kdShortEntryResult.k;
      indic.dShortEntry = kdShortEntryResult.d;
    }
    indic.volumeAvgEntry = maCalculator(volumes, ep?.period || 20);
    const wrEntryPeriod = ep?.period || 14;
    const wrCoverPeriod = enableShorting
      ? (sxp?.period ?? wrEntryPeriod)
      : wrEntryPeriod;
    if (!enableShorting || wrEntryPeriod === wrCoverPeriod) {
      indic.williamsEntry = calculateWilliams(
        highs,
        lows,
        closes,
        wrEntryPeriod,
      );
      if (enableShorting) indic.williamsCover = indic.williamsEntry;
    } else {
      indic.williamsEntry = calculateWilliams(
        highs,
        lows,
        closes,
        wrEntryPeriod,
      );
      indic.williamsCover = calculateWilliams(
        highs,
        lows,
        closes,
        wrCoverPeriod,
      );
    }
    const wrExitPeriod = xp?.period || 14;
    const wrShortEntryPeriod = enableShorting
      ? (sep?.period ?? wrExitPeriod)
      : wrExitPeriod;
    if (!enableShorting || wrExitPeriod === wrShortEntryPeriod) {
      indic.williamsExit = calculateWilliams(highs, lows, closes, wrExitPeriod);
      if (enableShorting) indic.williamsShortEntry = indic.williamsExit;
    } else {
      indic.williamsExit = calculateWilliams(highs, lows, closes, wrExitPeriod);
      indic.williamsShortEntry = calculateWilliams(
        highs,
        lows,
        closes,
        wrShortEntryPeriod,
      );
    }
  } catch (calcError) {
    console.error("[Worker] Indicator calculation error:", calcError);
    throw new Error(`計算技術指標時發生錯誤: ${calcError.message}`);
  }
  self.postMessage({
    type: "progress",
    progress: 65,
    message: "指標計算完成...",
  });
  return indic;
}

// --- 運行策略回測 (修正年化報酬率計算) ---
function runStrategy(data, params) {
  // --- 新增的保護機制 ---
  if (!Array.isArray(data)) {
    // 如果傳進來的不是陣列，就拋出一個更明確的錯誤
    console.error("傳遞給 runStrategy 的資料格式錯誤，收到了:", data);
    throw new TypeError("傳遞給 runStrategy 的資料格式錯誤，必須是陣列。");
  }
  // --- 保護機制結束 ---

  self.postMessage({
    type: "progress",
    progress: 70,
    message: "回測模擬中...",
  });
  const n = data.length;
  // 初始化隔日交易追蹤
  pendingNextDayTrade = null;
  const {
    initialCapital,
    positionSize,
    stopLoss: globalSL,
    takeProfit: globalTP,
    entryStrategy,
    exitStrategy,
    entryParams,
    exitParams,
    enableShorting,
    shortEntryStrategy,
    shortExitStrategy,
    shortEntryParams,
    shortExitParams,
    tradeTiming,
    buyFee,
    sellFee,
    positionBasis,
  } = params;

  if (!data || n === 0) throw new Error("回測數據無效");
  const dates = data.map((d) => d.date);
  const opens = data.map((d) => d.open);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const closes = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume);
  let indicators;
  try {
    indicators = calculateAllIndicators(data, params);
  } catch (e) {
    throw e;
  }

  const check = (v) => v !== null && !isNaN(v) && isFinite(v);
  let allPeriods = [
    entryParams?.shortPeriod,
    entryParams?.longPeriod,
    entryParams?.period,
    entryParams?.breakoutPeriod,
    entryParams?.signalPeriod,
    exitParams?.shortPeriod,
    exitParams?.longPeriod,
    exitParams?.period,
    exitParams?.stopLossPeriod,
    exitParams?.signalPeriod,
    exitParams?.percentage,
    9,
    14,
    20,
    26,
  ];
  if (enableShorting) {
    allPeriods = allPeriods.concat([
      shortEntryParams?.shortPeriod,
      shortEntryParams?.longPeriod,
      shortEntryParams?.period,
      shortEntryParams?.stopLossPeriod,
      shortEntryParams?.signalPeriod,
      shortExitParams?.shortPeriod,
      shortExitParams?.longPeriod,
      shortExitParams?.period,
      shortExitParams?.breakoutPeriod,
      shortExitParams?.signalPeriod,
      shortExitParams?.percentage,
    ]);
  }
  const validPeriods = allPeriods.filter(
    (p) => typeof p === "number" && p > 0 && isFinite(p),
  );
  const longestLookback =
    validPeriods.length > 0 ? Math.max(...validPeriods) : 0;
  const kdNeedLong =
    entryStrategy === "k_d_cross" || exitStrategy === "k_d_cross_exit"
      ? entryParams?.period || exitParams?.period || 9
      : 0;
  const kdNeedShort =
    enableShorting &&
    (shortEntryStrategy === "short_k_d_cross" ||
      shortExitStrategy === "cover_k_d_cross")
      ? shortEntryParams?.period || shortExitParams?.period || 9
      : 0;
  const macdNeedLong =
    entryStrategy === "macd_cross" || exitStrategy === "macd_cross_exit"
      ? (entryParams?.longPeriod || exitParams?.longPeriod || 26) +
        (entryParams?.signalPeriod || exitParams?.signalPeriod || 9) -
        1
      : 0;
  const macdNeedShort =
    enableShorting &&
    (shortEntryStrategy === "short_macd_cross" ||
      shortExitStrategy === "cover_macd_cross")
      ? (shortEntryParams?.longPeriod || shortExitParams?.longPeriod || 26) +
        (shortEntryParams?.signalPeriod || shortExitParams?.signalPeriod || 9) -
        1
      : 0;
  let startIdx =
    Math.max(
      1,
      longestLookback,
      kdNeedLong,
      kdNeedShort,
      macdNeedLong,
      macdNeedShort,
    ) + 1;
  startIdx = Math.min(startIdx, n - 1);
  startIdx = Math.max(1, startIdx);

  const portfolioVal = Array(n).fill(initialCapital);
  const strategyReturns = Array(n).fill(0);
  let peakCap = initialCapital;
  let maxDD = 0;
  let allTrades = [];
  let allCompletedTrades = [];
  let totalWinTrades = 0;
  let curCL = 0;
  let maxCL = 0;
  let longCap = initialCapital;
  let longPos = 0;
  let longShares = 0;
  let lastBuyP = 0;
  let curPeakP = 0;
  let longTrades = [];
  let longCompletedTrades = [];
  const buySigs = [];
  const sellSigs = [];
  const longPl = Array(n).fill(0);
  let shortCap = enableShorting ? initialCapital : 0;
  let shortPos = 0;
  let shortShares = 0;
  let lastShortP = 0;
  let currentLowSinceShort = Infinity;
  let shortTrades = [];
  let shortCompletedTrades = [];
  const shortSigs = [];
  const coverSigs = [];
  const shortPl = Array(n).fill(0);

  if (startIdx >= n || n < 2) {
    return {
      stockNo: params.stockNo,
      initialCapital: initialCapital,
      finalValue: initialCapital,
      totalProfit: 0,
      returnRate: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      winTrades: 0,
      tradesCount: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxConsecutiveLosses: 0,
      trades: [],
      completedTrades: [],
      buyHoldReturns: Array(n).fill(0),
      strategyReturns: Array(n).fill(0),
      dates: dates,
      chartBuySignals: [],
      chartSellSignals: [],
      chartShortSignals: [],
      chartCoverSignals: [],
      entryStrategy: params.entryStrategy,
      exitStrategy: params.exitStrategy,
      entryParams: params.entryParams,
      exitParams: params.exitParams,
      enableShorting: params.enableShorting,
      shortEntryStrategy: params.shortEntryStrategy,
      shortExitStrategy: params.shortExitStrategy,
      shortEntryParams: params.shortEntryParams,
      shortExitParams: params.shortExitParams,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      tradeTiming: params.tradeTiming,
      buyFee: params.buyFee,
      sellFee: params.sellFee,
      positionBasis: params.positionBasis,
      rawData: data,
      buyHoldAnnualizedReturn: 0,
      subPeriodResults: {},
      annReturnHalf1: null,
      sharpeHalf1: null,
      annReturnHalf2: null,
      sharpeHalf2: null,
    };
  }

  console.log(
    `[Worker] Starting simulation loop from index ${startIdx} to ${n - 1}`,
  );
  for (let i = startIdx; i < n; i++) {
    const curC = closes[i];
    const curH = highs[i];
    const curL = lows[i];
    const curV = volumes[i];
    const curO = opens[i];
    const prevC = i > 0 ? closes[i - 1] : null;
    const nextO = i + 1 < n ? opens[i + 1] : null;
    longPl[i] = longPl[i - 1] ?? 0;
    shortPl[i] = shortPl[i - 1] ?? 0;
    if (!check(curC) || curC <= 0) {
      portfolioVal[i] = portfolioVal[i - 1] ?? initialCapital;
      strategyReturns[i] = strategyReturns[i - 1] ?? 0;
      continue;
    }
    let tradePrice = null;
    let tradeDate = dates[i];
    let canTradeOpen = tradeTiming === "open" && i + 1 < n && check(nextO);

    // 修正：處理前一日的隔日開盤價交易執行
    if (i > startIdx && tradeTiming === "open") {
      // 檢查是否有前一日的隔日交易需要執行
      const pendingTrade = pendingNextDayTrade;
      if (pendingTrade && pendingTrade.executeOnDate === dates[i]) {
        const actualTradePrice = curO;

        if (pendingTrade.type === "buy") {
          // 執行隔日買入
          const actualAdjustedPrice = actualTradePrice * (1 + buyFee / 100);
          const actualShares = Math.floor(
            pendingTrade.investmentLimit / actualAdjustedPrice,
          );
          const actualCost = actualShares * actualAdjustedPrice;

          if (actualShares > 0 && longCap >= actualCost) {
            longCap -= actualCost;
            longPos = 1;
            lastBuyP = actualTradePrice;
            curPeakP = actualTradePrice;
            longShares = actualShares;

            const tradeData = {
              type: "buy",
              date: dates[i],
              price: actualTradePrice,
              shares: actualShares,
              cost: actualCost,
              capital_after: longCap,
              triggeringStrategy: pendingTrade.strategy,
              simType: "long",
            };
            longTrades.push(tradeData);
            buySigs.push({ date: dates[i], index: i });
          }
        } else if (pendingTrade.type === "short") {
          // 執行隔日做空
          const actualAdjustedPrice = actualTradePrice * (1 + buyFee / 100);
          const actualShares = Math.floor(
            pendingTrade.investmentLimit / actualAdjustedPrice,
          );

          if (actualShares > 0) {
            const shortValue = actualShares * actualTradePrice;
            const shortProceeds = shortValue * (1 - sellFee / 100);
            shortPos = 1;
            lastShortP = actualTradePrice;
            currentLowSinceShort = actualTradePrice;
            shortShares = actualShares;

            const tradeData = {
              type: "short",
              date: dates[i],
              price: actualTradePrice,
              shares: actualShares,
              cost: shortValue,
              capital_after: shortCap,
              triggeringStrategy: pendingTrade.strategy,
              simType: "short",
            };

            // 添加指標值資訊
            if (pendingTrade.kdValues)
              tradeData.kdValues = pendingTrade.kdValues;
            if (pendingTrade.macdValues)
              tradeData.macdValues = pendingTrade.macdValues;
            if (pendingTrade.indicatorValues)
              tradeData.indicatorValues = pendingTrade.indicatorValues;

            shortTrades.push(tradeData);
            shortSigs.push({ date: dates[i], index: i });
            console.log(
              `[Worker SHORT] Delayed Short Executed: ${shortShares}@${actualTradePrice} on ${dates[i]}, Cap Before Cover: ${shortCap.toFixed(0)}`,
            );
          }
        }
        pendingNextDayTrade = null;
      }
    }

    if (longPos === 1) {
      try {
        let sellSignal = false;
        let slTrig = false;
        let tpTrig = false;
        let exitKDValues = null,
          exitMACDValues = null,
          exitIndicatorValues = null;
        switch (exitStrategy) {
          case "ma_cross":
          case "ema_cross":
            sellSignal =
              check(indicators.maShortExit[i]) &&
              check(indicators.maLongExit[i]) &&
              check(indicators.maShortExit[i - 1]) &&
              check(indicators.maLongExit[i - 1]) &&
              indicators.maShortExit[i] < indicators.maLongExit[i] &&
              indicators.maShortExit[i - 1] >= indicators.maLongExit[i - 1];
            if (sellSignal)
              exitIndicatorValues = {
                短SMA: [
                  indicators.maShortExit[i - 1],
                  indicators.maShortExit[i],
                  indicators.maShortExit[i + 1] ?? null,
                ],
                長SMA: [
                  indicators.maLongExit[i - 1],
                  indicators.maLongExit[i],
                  indicators.maLongExit[i + 1] ?? null,
                ],
              };
            break;
          case "ma_below":
            sellSignal =
              check(indicators.maExit[i]) &&
              check(prevC) &&
              check(indicators.maExit[i - 1]) &&
              curC < indicators.maExit[i] &&
              prevC >= indicators.maExit[i - 1];
            if (sellSignal)
              exitIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                SMA: [
                  indicators.maExit[i - 1],
                  indicators.maExit[i],
                  indicators.maExit[i + 1] ?? null,
                ],
              };
            break;
          case "rsi_overbought":
            const rX = indicators.rsiExit[i],
              rPX = indicators.rsiExit[i - 1],
              rThX = exitParams.threshold || 70;
            sellSignal = check(rX) && check(rPX) && rX < rThX && rPX >= rThX;
            if (sellSignal)
              exitIndicatorValues = {
                RSI: [rPX, rX, indicators.rsiExit[i + 1] ?? null],
              };
            break;
          case "macd_cross":
            const difX = indicators.macdExit[i],
              deaX = indicators.macdSignalExit[i],
              difPX = indicators.macdExit[i - 1],
              deaPX = indicators.macdSignalExit[i - 1];
            sellSignal =
              check(difX) &&
              check(deaX) &&
              check(difPX) &&
              check(deaPX) &&
              difX < deaX &&
              difPX >= deaPX;
            if (sellSignal)
              exitMACDValues = {
                difPrev: difPX,
                deaPrev: deaPX,
                difNow: difX,
                deaNow: deaX,
                difNext: indicators.macdExit[i + 1] ?? null,
                deaNext: indicators.macdSignalExit[i + 1] ?? null,
              };
            break;
          case "bollinger_reversal":
            const midX = indicators.bollingerMiddleExit[i];
            const midPX = indicators.bollingerMiddleExit[i - 1];
            sellSignal =
              check(midX) &&
              check(prevC) &&
              check(midPX) &&
              curC < midX &&
              prevC >= midPX;
            if (sellSignal)
              exitIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                中軌: [
                  midPX,
                  midX,
                  indicators.bollingerMiddleExit[i + 1] ?? null,
                ],
              };
            break;
          case "k_d_cross":
            const kX = indicators.kExit[i],
              dX = indicators.dExit[i],
              kPX = indicators.kExit[i - 1],
              dPX = indicators.dExit[i - 1],
              thY = exitParams.thresholdY || 70;
            sellSignal =
              check(kX) &&
              check(dX) &&
              check(kPX) &&
              check(dPX) &&
              kX < dX &&
              kPX >= dPX &&
              dX > thY;
            if (sellSignal)
              exitKDValues = {
                kPrev: kPX,
                dPrev: dPX,
                kNow: kX,
                dNow: dX,
                kNext: indicators.kExit[i + 1] ?? null,
                dNext: indicators.dExit[i + 1] ?? null,
              };
            break;
          case "trailing_stop":
            const trailP = exitParams.percentage || 5;
            if (check(curH) && lastBuyP > 0) {
              curPeakP = Math.max(curPeakP, curH);
              sellSignal = curC < curPeakP * (1 - trailP / 100);
            }
            if (sellSignal)
              exitIndicatorValues = {
                收盤價: [null, curC, null],
                觸發價: [
                  null,
                  (curPeakP * (1 - trailP / 100)).toFixed(2),
                  null,
                ],
              };
            break;
          case "price_breakdown":
            const bpX = exitParams.period || 20;
            if (i >= bpX) {
              const lsX = lows.slice(i - bpX, i).filter((l) => check(l));
              if (lsX.length > 0) {
                const periodLow = Math.min(...lsX);
                sellSignal = check(curC) && curC < periodLow;
              }
              if (sellSignal)
                exitIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  前低: [
                    null,
                    Math.min(...lows.slice(i - bpX, i).filter(check)),
                    null,
                  ],
                };
            }
            break;
          case "williams_overbought":
            const wrX = indicators.williamsExit[i],
              wrPX = indicators.williamsExit[i - 1],
              wrThX = exitParams.threshold || -20;
            sellSignal =
              check(wrX) && check(wrPX) && wrX < wrThX && wrPX >= wrThX;
            if (sellSignal)
              exitIndicatorValues = {
                "%R": [wrPX, wrX, indicators.williamsExit[i + 1] ?? null],
              };
            break;
          case "turtle_stop_loss":
            const slP = exitParams.stopLossPeriod || 10;
            if (i >= slP) {
              const lowsT = lows.slice(i - slP, i).filter((l) => check(l));
              if (lowsT.length > 0) {
                const periodLowT = Math.min(...lowsT);
                sellSignal = check(curC) && curC < periodLowT;
              }
            }
            if (sellSignal)
              exitIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                N日低: [
                  null,
                  Math.min(...lows.slice(i - slP, i).filter(check)),
                  null,
                ],
              };
            break;
          case "fixed_stop_loss":
            sellSignal = false;
            break;
        }
        if (!sellSignal && globalSL > 0 && lastBuyP > 0) {
          if (curC <= lastBuyP * (1 - globalSL / 100)) slTrig = true;
        }
        if (!sellSignal && !slTrig && globalTP > 0 && lastBuyP > 0) {
          if (curC >= lastBuyP * (1 + globalTP / 100)) tpTrig = true;
        }
        if (sellSignal || slTrig || tpTrig) {
          tradePrice = null;
          tradeDate = dates[i];
          if (tradeTiming === "close") tradePrice = curC;
          else if (canTradeOpen) {
            tradePrice = nextO;
            tradeDate = dates[i + 1];
          } else if (tradeTiming === "open" && i === n - 1) {
            tradePrice = curC;
            tradeDate = dates[i];
          }
          if (check(tradePrice) && tradePrice > 0 && longShares > 0) {
            const rev = longShares * tradePrice * (1 - sellFee / 100);
            const costB = longShares * lastBuyP;
            const entryCostWithFee = costB * (1 + buyFee / 100);
            const prof = rev - entryCostWithFee;
            const profP =
              entryCostWithFee > 0 ? (prof / entryCostWithFee) * 100 : 0;
            longCap += rev;
            const tradeData = {
              type: "sell",
              date: tradeDate,
              price: tradePrice,
              shares: longShares,
              revenue: rev,
              profit: prof,
              profitPercent: profP,
              capital_after: longCap,
              triggeredByStopLoss: slTrig,
              triggeredByTakeProfit: tpTrig,
              triggeringStrategy: exitStrategy,
              simType: "long",
            };
            if (exitKDValues) tradeData.kdValues = exitKDValues;
            if (exitMACDValues) tradeData.macdValues = exitMACDValues;
            if (exitIndicatorValues)
              tradeData.indicatorValues = exitIndicatorValues;
            longTrades.push(tradeData);
            // 修正：隔日開盤價交易時，訊號應顯示在實際交易日
            if (tradeTiming === "close" || !canTradeOpen) {
              sellSigs.push({ date: dates[i], index: i });
            } else if (canTradeOpen) {
              sellSigs.push({ date: dates[i + 1], index: i + 1 });
            }
            const lastBuyIdx = longTrades.map((t) => t.type).lastIndexOf("buy");
            if (
              lastBuyIdx !== -1 &&
              longTrades[lastBuyIdx].shares === longShares
            ) {
              longCompletedTrades.push({
                entry: longTrades[lastBuyIdx],
                exit: tradeData,
                profit: prof,
                profitPercent: profP,
              });
            } else {
              console.warn(
                `[Worker LONG] Sell @ ${tradeDate} could not find matching buy trade.`,
              );
            }
            console.log(
              `[Worker LONG] Sell Executed: ${longShares}@${tradePrice} on ${tradeDate}, Profit: ${prof.toFixed(0)}, Cap After: ${longCap.toFixed(0)}`,
            );
            longPos = 0;
            longShares = 0;
            lastBuyP = 0;
            curPeakP = 0;
          } else {
            console.warn(
              `[Worker LONG] Invalid trade price (${tradePrice}) or zero shares for Sell Signal on ${dates[i]}`,
            );
          }
        }
      } catch (exitError) {
        console.error(
          `[Worker LONG EXIT] Error at index ${i} (${dates[i]}):`,
          exitError,
        );
      }
    }
    if (enableShorting && shortPos === 1) {
      try {
        let coverSignal = false;
        let shortSlTrig = false;
        let shortTpTrig = false;
        let coverKDValues = null,
          coverMACDValues = null,
          coverIndicatorValues = null;
        switch (shortExitStrategy) {
          case "cover_ma_cross":
          case "cover_ema_cross":
            coverSignal =
              check(indicators.maShortCover[i]) &&
              check(indicators.maLongCover[i]) &&
              check(indicators.maShortCover[i - 1]) &&
              check(indicators.maLongCover[i - 1]) &&
              indicators.maShortCover[i] > indicators.maLongCover[i] &&
              indicators.maShortCover[i - 1] <= indicators.maLongCover[i - 1];
            if (coverSignal)
              coverIndicatorValues = {
                短SMA: [
                  indicators.maShortCover[i - 1],
                  indicators.maShortCover[i],
                  indicators.maShortCover[i + 1] ?? null,
                ],
                長SMA: [
                  indicators.maLongCover[i - 1],
                  indicators.maLongCover[i],
                  indicators.maLongCover[i + 1] ?? null,
                ],
              };
            break;
          case "cover_ma_above":
            coverSignal =
              check(indicators.maExit[i]) &&
              check(prevC) &&
              check(indicators.maExit[i - 1]) &&
              curC > indicators.maExit[i] &&
              prevC <= indicators.maExit[i - 1];
            if (coverSignal)
              coverIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                SMA: [
                  indicators.maExit[i - 1],
                  indicators.maExit[i],
                  indicators.maExit[i + 1] ?? null,
                ],
              };
            break;
          case "cover_rsi_oversold":
            const rC = indicators.rsiCover[i],
              rPC = indicators.rsiCover[i - 1],
              rThC = shortExitParams.threshold || 30;
            coverSignal = check(rC) && check(rPC) && rC > rThC && rPC <= rThC;
            if (coverSignal)
              coverIndicatorValues = {
                RSI: [rPC, rC, indicators.rsiCover[i + 1] ?? null],
              };
            break;
          case "cover_macd_cross":
            const difC = indicators.macdCover[i],
              deaC = indicators.macdSignalCover[i],
              difPC = indicators.macdCover[i - 1],
              deaPC = indicators.macdSignalCover[i - 1];
            coverSignal =
              check(difC) &&
              check(deaC) &&
              check(difPC) &&
              check(deaPC) &&
              difC > deaC &&
              difPC <= deaPC;
            if (coverSignal)
              coverMACDValues = {
                difPrev: difPC,
                deaPrev: deaPC,
                difNow: difC,
                deaNow: deaC,
                difNext: indicators.macdCover[i + 1] ?? null,
                deaNext: indicators.macdSignalCover[i + 1] ?? null,
              };
            break;
          case "cover_bollinger_breakout":
            const upperC = indicators.bollingerUpperCover[i];
            const upperPC = indicators.bollingerUpperCover[i - 1];
            coverSignal =
              check(upperC) &&
              check(prevC) &&
              check(upperPC) &&
              curC > upperC &&
              prevC <= upperPC;
            if (coverSignal)
              coverIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                上軌: [
                  upperPC,
                  upperC,
                  indicators.bollingerUpperCover[i + 1] ?? null,
                ],
              };
            break;
          case "cover_k_d_cross":
            const kC = indicators.kCover[i],
              dC = indicators.dCover[i],
              kPC = indicators.kCover[i - 1],
              dPC = indicators.dCover[i - 1],
              thXC = shortExitParams.thresholdX || 30;
            coverSignal =
              check(kC) &&
              check(dC) &&
              check(kPC) &&
              check(dPC) &&
              kC > dC &&
              kPC <= dPC &&
              dC < thXC;
            if (coverSignal)
              coverKDValues = {
                kPrev: kPC,
                dPrev: dPC,
                kNow: kC,
                dNow: dC,
                kNext: indicators.kCover[i + 1] ?? null,
                dNext: indicators.dCover[i + 1] ?? null,
              };
            break;
          case "cover_price_breakout":
            const bpC = shortExitParams.period || 20;
            if (i >= bpC) {
              const hsC = highs.slice(i - bpC, i).filter((h) => check(h));
              if (hsC.length > 0) {
                const periodHighC = Math.max(...hsC);
                coverSignal = check(curC) && curC > periodHighC;
              }
              if (coverSignal)
                coverIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  前高: [
                    null,
                    Math.max(...highs.slice(i - bpC, i).filter(check)),
                    null,
                  ],
                };
            }
            break;
          case "cover_williams_oversold":
            const wrC = indicators.williamsCover[i],
              wrPC = indicators.williamsCover[i - 1],
              wrThC = shortExitParams.threshold || -80;
            coverSignal =
              check(wrC) && check(wrPC) && wrC > wrThC && wrPC <= wrThC;
            if (coverSignal)
              coverIndicatorValues = {
                "%R": [wrPC, wrC, indicators.williamsCover[i + 1] ?? null],
              };
            break;
          case "cover_turtle_breakout":
            const tpC = shortExitParams.breakoutPeriod || 20;
            if (i >= tpC) {
              const hsCT = highs.slice(i - tpC, i).filter((h) => check(h));
              if (hsCT.length > 0) {
                const periodHighCT = Math.max(...hsCT);
                coverSignal = check(curC) && curC > periodHighCT;
              }
              if (coverSignal)
                coverIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  N日高: [
                    null,
                    Math.max(...highs.slice(i - tpC, i).filter(check)),
                    null,
                  ],
                };
            }
            break;
          case "cover_trailing_stop":
            const shortTrailP = shortExitParams.percentage || 5;
            if (check(curL) && lastShortP > 0) {
              currentLowSinceShort = Math.min(currentLowSinceShort, curL);
              coverSignal =
                curC > currentLowSinceShort * (1 + shortTrailP / 100);
            }
            if (coverSignal)
              coverIndicatorValues = {
                收盤價: [null, curC, null],
                觸發價: [
                  null,
                  (currentLowSinceShort * (1 + shortTrailP / 100)).toFixed(2),
                  null,
                ],
              };
            break;
          case "cover_fixed_stop_loss":
            coverSignal = false;
            break;
        }
        if (!coverSignal && globalSL > 0 && lastShortP > 0) {
          if (curC >= lastShortP * (1 + globalSL / 100)) shortSlTrig = true;
        }
        if (!coverSignal && !shortSlTrig && globalTP > 0 && lastShortP > 0) {
          if (curC <= lastShortP * (1 - globalTP / 100)) shortTpTrig = true;
        }
        if (coverSignal || shortSlTrig || shortTpTrig) {
          tradePrice = null;
          tradeDate = dates[i];
          if (tradeTiming === "close") tradePrice = curC;
          else if (canTradeOpen) {
            tradePrice = nextO;
            tradeDate = dates[i + 1];
          } else if (tradeTiming === "open" && i === n - 1) {
            tradePrice = curC;
            tradeDate = dates[i];
          }
          if (check(tradePrice) && tradePrice > 0 && shortShares > 0) {
            const shortProceeds =
              shortShares * lastShortP * (1 - sellFee / 100);
            const coverCostWithFee =
              shortShares * tradePrice * (1 + buyFee / 100);
            const prof = shortProceeds - coverCostWithFee;
            shortCap += prof;
            const tradeData = {
              type: "cover",
              date: tradeDate,
              price: tradePrice,
              shares: shortShares,
              revenue: coverCostWithFee,
              profit: prof,
              profitPercent:
                shortProceeds > 0 ? (prof / shortProceeds) * 100 : 0,
              capital_after: shortCap,
              triggeredByStopLoss: shortSlTrig,
              triggeredByTakeProfit: shortTpTrig,
              triggeringStrategy: shortExitStrategy,
              simType: "short",
            };
            if (coverKDValues) tradeData.kdValues = coverKDValues;
            if (coverMACDValues) tradeData.macdValues = coverMACDValues;
            if (coverIndicatorValues)
              tradeData.indicatorValues = coverIndicatorValues;
            shortTrades.push(tradeData);
            // 修正：隔日開盤價交易時，訊號應顯示在實際交易日
            if (tradeTiming === "close" || !canTradeOpen) {
              coverSigs.push({ date: dates[i], index: i });
            } else if (canTradeOpen) {
              coverSigs.push({ date: dates[i + 1], index: i + 1 });
            }
            const lastShortIdx = shortTrades
              .map((t) => t.type)
              .lastIndexOf("short");
            if (
              lastShortIdx !== -1 &&
              shortTrades[lastShortIdx].shares === shortShares
            ) {
              shortCompletedTrades.push({
                entry: shortTrades[lastShortIdx],
                exit: tradeData,
                profit: prof,
                profitPercent: tradeData.profitPercent,
              });
            } else {
              console.warn(
                `[Worker SHORT] Cover @ ${tradeDate} could not find matching short trade.`,
              );
            }
            console.log(
              `[Worker SHORT] Cover Executed: ${shortShares}@${tradePrice} on ${tradeDate}, Profit: ${prof.toFixed(0)}, Cap After: ${shortCap.toFixed(0)}`,
            );
            shortPos = 0;
            shortShares = 0;
            lastShortP = 0;
            currentLowSinceShort = Infinity;
          } else {
            console.warn(
              `[Worker SHORT] Invalid trade price (${tradePrice}) or zero shares for Cover Signal on ${dates[i]}`,
            );
          }
        }
      } catch (coverError) {
        console.error(
          `[Worker SHORT EXIT] Error at index ${i} (${dates[i]}):`,
          coverError,
        );
      }
    }
    if (longPos === 0 && shortPos === 0) {
      let buySignal = false;
      let entryKDValues = null,
        entryMACDValues = null,
        entryIndicatorValues = null;
      switch (entryStrategy) {
        case "ma_cross":
        case "ema_cross":
          buySignal =
            check(indicators.maShort[i]) &&
            check(indicators.maLong[i]) &&
            check(indicators.maShort[i - 1]) &&
            check(indicators.maLong[i - 1]) &&
            indicators.maShort[i] > indicators.maLong[i] &&
            indicators.maShort[i - 1] <= indicators.maLong[i - 1];
          if (buySignal)
            entryIndicatorValues = {
              短SMA: [
                indicators.maShort[i - 1],
                indicators.maShort[i],
                indicators.maShort[i + 1] ?? null,
              ],
              長SMA: [
                indicators.maLong[i - 1],
                indicators.maLong[i],
                indicators.maLong[i + 1] ?? null,
              ],
            };
          break;
        case "ma_above":
          buySignal =
            check(indicators.maExit[i]) &&
            check(prevC) &&
            check(indicators.maExit[i - 1]) &&
            curC > indicators.maExit[i] &&
            prevC <= indicators.maExit[i - 1];
          if (buySignal)
            entryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              SMA: [
                indicators.maExit[i - 1],
                indicators.maExit[i],
                indicators.maExit[i + 1] ?? null,
              ],
            };
          break;
        case "rsi_oversold":
          const rE = indicators.rsiEntry[i],
            rPE = indicators.rsiEntry[i - 1],
            rThE = entryParams.threshold || 30;
          buySignal = check(rE) && check(rPE) && rE > rThE && rPE <= rThE;
          if (buySignal)
            entryIndicatorValues = {
              RSI: [rPE, rE, indicators.rsiEntry[i + 1] ?? null],
            };
          break;
        case "macd_cross":
          const difE = indicators.macdEntry[i],
            deaE = indicators.macdSignalEntry[i],
            difPE = indicators.macdEntry[i - 1],
            deaPE = indicators.macdSignalEntry[i - 1];
          buySignal =
            check(difE) &&
            check(deaE) &&
            check(difPE) &&
            check(deaPE) &&
            difE > deaE &&
            difPE <= deaPE;
          if (buySignal)
            entryMACDValues = {
              difPrev: difPE,
              deaPrev: deaPE,
              difNow: difE,
              deaNow: deaE,
              difNext: indicators.macdEntry[i + 1] ?? null,
              deaNext: indicators.macdSignalEntry[i + 1] ?? null,
            };
          break;
        case "bollinger_breakout":
          buySignal =
            check(indicators.bollingerUpperEntry[i]) &&
            check(prevC) &&
            check(indicators.bollingerUpperEntry[i - 1]) &&
            curC > indicators.bollingerUpperEntry[i] &&
            prevC <= indicators.bollingerUpperEntry[i - 1];
          if (buySignal)
            entryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              上軌: [
                indicators.bollingerUpperEntry[i - 1],
                indicators.bollingerUpperEntry[i],
                indicators.bollingerUpperEntry[i + 1] ?? null,
              ],
            };
          break;
        case "k_d_cross":
          const kE = indicators.kEntry[i],
            dE = indicators.dEntry[i],
            kPE = indicators.kEntry[i - 1],
            dPE = indicators.dEntry[i - 1],
            thX = entryParams.thresholdX || 30;
          buySignal =
            check(kE) &&
            check(dE) &&
            check(kPE) &&
            check(dPE) &&
            kE > dE &&
            kPE <= dPE &&
            dE < thX;
          if (buySignal)
            entryKDValues = {
              kPrev: kPE,
              dPrev: dPE,
              kNow: kE,
              dNow: dE,
              kNext: indicators.kEntry[i + 1] ?? null,
              dNext: indicators.dEntry[i + 1] ?? null,
            };
          break;
        case "volume_spike":
          const vAE = indicators.volumeAvgEntry[i],
            vME = entryParams.multiplier || 2;
          buySignal = check(vAE) && check(curV) && curV > vAE * vME;
          if (buySignal)
            entryIndicatorValues = {
              成交量: [volumes[i - 1] ?? null, curV, volumes[i + 1] ?? null],
              均量: [
                indicators.volumeAvgEntry[i - 1] ?? null,
                vAE,
                indicators.volumeAvgEntry[i + 1] ?? null,
              ],
            };
          break;
        case "price_breakout":
          const bpE = entryParams.period || 20;
          if (i >= bpE) {
            const hsE = highs.slice(i - bpE, i).filter((h) => check(h));
            if (hsE.length > 0) {
              const periodHigh = Math.max(...hsE);
              buySignal = check(curC) && curC > periodHigh;
              if (buySignal)
                entryIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  前高: [null, periodHigh, null],
                };
            }
          }
          break;
        case "williams_oversold":
          const wrE = indicators.williamsEntry[i],
            wrPE = indicators.williamsEntry[i - 1],
            wrThE = entryParams.threshold || -80;
          buySignal = check(wrE) && check(wrPE) && wrE > wrThE && wrPE <= wrThE;
          if (buySignal)
            entryIndicatorValues = {
              "%R": [wrPE, wrE, indicators.williamsEntry[i + 1] ?? null],
            };
          break;
        case "turtle_breakout":
          const tpE = entryParams.breakoutPeriod || 20;
          if (i >= tpE) {
            const hsT = highs.slice(i - tpE, i).filter((h) => check(h));
            if (hsT.length > 0) {
              const periodHighT = Math.max(...hsT);
              buySignal = check(curC) && curC > periodHighT;
            }
            if (buySignal)
              entryIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                N日高: [
                  null,
                  Math.max(...highs.slice(i - tpE, i).filter(check)),
                  null,
                ],
              };
          }
          break;
      }
      if (buySignal) {
        tradePrice = null;
        tradeDate = dates[i];
        if (tradeTiming === "close") {
          tradePrice = curC;
          // 立即執行收盤價交易
          if (check(tradePrice) && tradePrice > 0 && longCap > 0) {
            let baseCapitalForSizing = initialCapital;
            if (positionBasis === "totalCapital") {
              baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
            }
            const maxInvestmentAllowed =
              baseCapitalForSizing * (positionSize / 100);
            const actualInvestmentLimit = Math.min(
              longCap,
              maxInvestmentAllowed,
            );
            const adjustedTradePrice = tradePrice * (1 + buyFee / 100);
            if (adjustedTradePrice <= 0) {
              longShares = 0;
            } else {
              longShares = Math.floor(
                actualInvestmentLimit / adjustedTradePrice,
              );
            }
            if (longShares > 0) {
              const cost = longShares * adjustedTradePrice;
              if (longCap >= cost) {
                longCap -= cost;
                longPos = 1;
                lastBuyP = tradePrice;
                curPeakP = tradePrice;
                const tradeData = {
                  type: "buy",
                  date: tradeDate,
                  price: tradePrice,
                  shares: longShares,
                  cost: cost,
                  capital_after: longCap,
                  triggeringStrategy: entryStrategy,
                  simType: "long",
                };
                if (entryKDValues) tradeData.kdValues = entryKDValues;
                if (entryMACDValues) tradeData.macdValues = entryMACDValues;
                if (entryIndicatorValues)
                  tradeData.indicatorValues = entryIndicatorValues;
                longTrades.push(tradeData);
                buySigs.push({ date: dates[i], index: i });
              }
            }
          }
        } else if (canTradeOpen) {
          // 修正：隔日開盤價交易 - 只記錄交易意圖，不立即執行
          let baseCapitalForSizing = initialCapital;
          if (positionBasis === "totalCapital") {
            baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
          }
          const maxInvestmentAllowed =
            baseCapitalForSizing * (positionSize / 100);
          const actualInvestmentLimit = Math.min(longCap, maxInvestmentAllowed);

          // 記錄隔日交易意圖，不進行實際交易
          pendingNextDayTrade = {
            type: "buy",
            executeOnDate: dates[i + 1],
            investmentLimit: actualInvestmentLimit,
            strategy: entryStrategy,
            triggerIndex: i,
          };
        }
      }
    }
    if (enableShorting && shortPos === 0 && longPos === 0) {
      let shortSignal = false;
      let shortEntryKDValues = null,
        shortEntryMACDValues = null,
        shortEntryIndicatorValues = null;
      switch (shortEntryStrategy) {
        case "short_ma_cross":
        case "short_ema_cross":
          shortSignal =
            check(indicators.maShortShortEntry[i]) &&
            check(indicators.maLongShortEntry[i]) &&
            check(indicators.maShortShortEntry[i - 1]) &&
            check(indicators.maLongShortEntry[i - 1]) &&
            indicators.maShortShortEntry[i] < indicators.maLongShortEntry[i] &&
            indicators.maShortShortEntry[i - 1] >=
              indicators.maLongShortEntry[i - 1];
          if (shortSignal)
            shortEntryIndicatorValues = {
              短SMA: [
                indicators.maShortShortEntry[i - 1],
                indicators.maShortShortEntry[i],
                indicators.maShortShortEntry[i + 1] ?? null,
              ],
              長SMA: [
                indicators.maLongShortEntry[i - 1],
                indicators.maLongShortEntry[i],
                indicators.maLongShortEntry[i + 1] ?? null,
              ],
            };
          break;
        case "short_ma_below":
          shortSignal =
            check(indicators.maExit[i]) &&
            check(prevC) &&
            check(indicators.maExit[i - 1]) &&
            curC < indicators.maExit[i] &&
            prevC >= indicators.maExit[i - 1];
          if (shortSignal)
            shortEntryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              SMA: [
                indicators.maExit[i - 1],
                indicators.maExit[i],
                indicators.maExit[i + 1] ?? null,
              ],
            };
          break;
        case "short_rsi_overbought":
          const rSE = indicators.rsiShortEntry[i],
            rPSE = indicators.rsiShortEntry[i - 1],
            rThSE = shortEntryParams.threshold || 70;
          shortSignal =
            check(rSE) && check(rPSE) && rSE < rThSE && rPSE >= rThSE;
          if (shortSignal)
            shortEntryIndicatorValues = {
              RSI: [rPSE, rSE, indicators.rsiShortEntry[i + 1] ?? null],
            };
          break;
        case "short_macd_cross":
          const difSE = indicators.macdShortEntry[i],
            deaSE = indicators.macdSignalShortEntry[i],
            difPSE = indicators.macdShortEntry[i - 1],
            deaPSE = indicators.macdSignalShortEntry[i - 1];
          shortSignal =
            check(difSE) &&
            check(deaSE) &&
            check(difPSE) &&
            check(deaPSE) &&
            difSE < deaSE &&
            difPSE >= deaSE;
          if (shortSignal)
            shortEntryMACDValues = {
              difPrev: difPSE,
              deaPrev: deaPSE,
              difNow: difSE,
              deaNow: deaSE,
              difNext: indicators.macdShortEntry[i + 1] ?? null,
              deaNext: indicators.macdSignalShortEntry[i + 1] ?? null,
            };
          break;
        case "short_bollinger_reversal":
          const midSE = indicators.bollingerMiddleShortEntry[i];
          const midPSE = indicators.bollingerMiddleShortEntry[i - 1];
          shortSignal =
            check(midSE) &&
            check(prevC) &&
            check(midPSE) &&
            curC < midSE &&
            prevC >= midPSE;
          if (shortSignal)
            shortEntryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              中軌: [
                midPSE,
                midSE,
                indicators.bollingerMiddleShortEntry[i + 1] ?? null,
              ],
            };
          break;
        case "short_k_d_cross":
          const kSE = indicators.kShortEntry[i],
            dSE = indicators.dShortEntry[i],
            kPSE = indicators.kShortEntry[i - 1],
            dPSE = indicators.dShortEntry[i - 1],
            thY = shortEntryParams.thresholdY || 70;
          shortSignal =
            check(kSE) &&
            check(dSE) &&
            check(kPSE) &&
            check(dPSE) &&
            kSE < dSE &&
            kPSE >= dPSE &&
            dSE > thY;
          if (shortSignal)
            shortEntryKDValues = {
              kPrev: kPSE,
              dPrev: dPSE,
              kNow: kSE,
              dNow: dSE,
              kNext: indicators.kShortEntry[i + 1] ?? null,
              dNext: indicators.dShortEntry[i + 1] ?? null,
            };
          break;
        case "short_price_breakdown":
          const bpSE = shortEntryParams.period || 20;
          if (i >= bpSE) {
            const lsSE = lows.slice(i - bpSE, i).filter((l) => check(l));
            if (lsSE.length > 0) {
              const periodLowS = Math.min(...lsSE);
              shortSignal = check(curC) && curC < periodLowS;
            }
            if (shortSignal)
              shortEntryIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                前低: [
                  null,
                  Math.min(...lows.slice(i - bpSE, i).filter(check)),
                  null,
                ],
              };
          }
          break;
        case "short_williams_overbought":
          const wrSE = indicators.williamsShortEntry[i],
            wrPSE = indicators.williamsShortEntry[i - 1],
            wrThSE = shortEntryParams.threshold || -20;
          shortSignal =
            check(wrSE) && check(wrPSE) && wrSE < wrThSE && wrPSE >= wrThSE;
          if (shortSignal)
            shortEntryIndicatorValues = {
              "%R": [wrPSE, wrSE, indicators.williamsShortEntry[i + 1] ?? null],
            };
          break;
        case "short_turtle_stop_loss":
          const slPSE = shortEntryParams.stopLossPeriod || 10;
          if (i >= slPSE) {
            const lowsT = lows.slice(i - slPSE, i).filter((l) => check(l));
            if (lowsT.length > 0) {
              const periodLowST = Math.min(...lowsT);
              shortSignal = check(curC) && curC < periodLowST;
            }
          }
          if (shortSignal)
            shortEntryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              N日低: [
                null,
                Math.min(...lows.slice(i - slPSE, i).filter(check)),
                null,
              ],
            };
          break;
      }
      if (shortSignal) {
        if (tradeTiming === "close") {
          tradePrice = curC;
          tradeDate = dates[i];
        } else if (canTradeOpen) {
          // 隔日開盤價交易：記錄交易意圖，延遲執行
          let baseCapitalForSizing = initialCapital;
          if (positionBasis === "totalCapital") {
            baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
          }
          const maxInvestmentAllowed =
            baseCapitalForSizing * (positionSize / 100);
          const actualInvestmentLimit = Math.min(
            shortCap,
            maxInvestmentAllowed,
          );

          // 記錄隔日做空交易意圖
          pendingNextDayTrade = {
            type: "short",
            executeOnDate: dates[i + 1],
            investmentLimit: actualInvestmentLimit,
            strategy: shortEntryStrategy,
            triggerIndex: i,
            kdValues: shortEntryKDValues,
            macdValues: shortEntryMACDValues,
            indicatorValues: shortEntryIndicatorValues,
          };
          tradePrice = null; // 不立即執行
          tradeDate = null;
        }

        if (check(tradePrice) && tradePrice > 0 && shortCap > 0) {
          let baseCapitalForSizing = initialCapital;
          if (positionBasis === "totalCapital") {
            baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
          }
          const maxInvestmentAllowed =
            baseCapitalForSizing * (positionSize / 100);
          const actualInvestmentLimit = Math.min(
            shortCap,
            maxInvestmentAllowed,
          );
          const adjustedTradePrice = tradePrice * (1 + buyFee / 100);
          if (adjustedTradePrice <= 0) {
            shortShares = 0;
          } else {
            shortShares = Math.floor(
              actualInvestmentLimit / adjustedTradePrice,
            );
          }
          if (shortShares > 0) {
            const shortValue = shortShares * tradePrice;
            const shortProceeds = shortValue * (1 - sellFee / 100);
            shortPos = 1;
            lastShortP = tradePrice;
            currentLowSinceShort = tradePrice;
            const tradeData = {
              type: "short",
              date: tradeDate,
              price: tradePrice,
              shares: shortShares,
              cost: shortValue,
              capital_after: shortCap,
              triggeringStrategy: shortEntryStrategy,
              simType: "short",
            };
            if (shortEntryKDValues) tradeData.kdValues = shortEntryKDValues;
            if (shortEntryMACDValues)
              tradeData.macdValues = shortEntryMACDValues;
            if (shortEntryIndicatorValues)
              tradeData.indicatorValues = shortEntryIndicatorValues;
            shortTrades.push(tradeData);
            // 修正：隔日開盤價交易時，訊號應顯示在實際交易日
            if (tradeTiming === "close" || !canTradeOpen) {
              shortSigs.push({ date: dates[i], index: i });
            } else if (canTradeOpen) {
              shortSigs.push({ date: dates[i + 1], index: i + 1 });
            }
            console.log(
              `[Worker SHORT] Short Executed: ${shortShares}@${tradePrice} on ${tradeDate}, Cap Before Cover: ${shortCap.toFixed(0)}`,
            );
          } else {
            console.log(
              `[Worker SHORT] Calculated 0 shares for Short on ${tradeDate} (Price: ${tradePrice}, Investment: ${investment.toFixed(0)})`,
            );
            shortShares = 0;
          }

        } else {
          console.warn(
            `[Worker SHORT] Invalid trade price (${tradePrice}) for Short Signal on ${dates[i]}`,
          );
        }
      }
    }

    // --- STEP 3: Update Daily P/L AFTER all potential trades ---
    longPl[i] =
      longCap + (longPos === 1 ? longShares * curC : 0) - initialCapital;
    let unrealizedShortPl = 0;
    if (shortPos === 1 && lastShortP > 0) {
      unrealizedShortPl = (lastShortP - curC) * shortShares;
    }
    if (enableShorting) {
      shortPl[i] = shortCap - initialCapital + unrealizedShortPl;
    } else {
      shortPl[i] = 0;
    }
    portfolioVal[i] = initialCapital + longPl[i] + shortPl[i];
    strategyReturns[i] =
      initialCapital > 0
        ? ((portfolioVal[i] - initialCapital) / initialCapital) * 100
        : 0;
    peakCap = Math.max(peakCap, portfolioVal[i]);
    const drawdown =
      peakCap > 0 ? ((peakCap - portfolioVal[i]) / peakCap) * 100 : 0;
    maxDD = Math.max(maxDD, drawdown);
    if (
      i > startIdx &&
      n > startIdx &&
      i % Math.floor((n - startIdx) / 20 || 1) === 0
    ) {
      const p = 70 + Math.floor(((i - startIdx) / (n - startIdx)) * 25);
      self.postMessage({ type: "progress", progress: Math.min(95, p) });
    }
  } // --- End Loop ---

  // --- Final Cleanup & Calculation ---
  try {
    const lastIdx = n - 1;
    const finalP =
      lastIdx >= 0 && check(closes[lastIdx]) ? closes[lastIdx] : null;
    if (longPos === 1 && finalP !== null && longShares > 0) {
      const rev = longShares * finalP * (1 - sellFee / 100);
      const costB = longShares * lastBuyP * (1 + buyFee / 100);
      const prof = rev - costB;
      longCap += rev;
      const finalTradeData = {
        type: "sell",
        date: dates[lastIdx],
        price: finalP,
        shares: longShares,
        revenue: rev,
        profit: prof,
        profitPercent: costB > 0 ? (prof / costB) * 100 : 0,
        capital_after: longCap,
        triggeredByStopLoss: false,
        triggeredByTakeProfit: false,
        triggeringStrategy: "EndOfPeriod",
        simType: "long",
      };
      longTrades.push(finalTradeData);
      if (!sellSigs.some((s) => s.index === lastIdx))
        sellSigs.push({ date: dates[lastIdx], index: lastIdx });
      const lastBuyI = longTrades.map((t) => t.type).lastIndexOf("buy");
      if (lastBuyI !== -1 && longTrades[lastBuyI].shares === longShares) {
        longCompletedTrades.push({
          entry: longTrades[lastBuyI],
          exit: finalTradeData,
          profit: prof,
          profitPercent: finalTradeData.profitPercent,
        });
      }
      longPl[lastIdx] = longCap - initialCapital;
      longPos = 0;
      longShares = 0;
      console.log(
        `[Worker LONG] Final Sell Executed: ${finalTradeData.shares}@${finalP} on ${dates[lastIdx]}`,
      );
    } else if (longPos === 1) {
      longPl[lastIdx] = longPl[lastIdx > 0 ? lastIdx - 1 : 0] ?? 0;
    }
    if (shortPos === 1 && finalP !== null && shortShares > 0) {
      const shortProceeds = shortShares * lastShortP * (1 - sellFee / 100);
      const coverCostWithFee = shortShares * finalP * (1 + buyFee / 100);
      const prof = shortProceeds - coverCostWithFee;
      shortCap += prof;
      const finalTradeData = {
        type: "cover",
        date: dates[lastIdx],
        price: finalP,
        shares: shortShares,
        revenue: coverCostWithFee,
        profit: prof,
        profitPercent: shortProceeds > 0 ? (prof / shortProceeds) * 100 : 0,
        capital_after: shortCap,
        triggeredByStopLoss: false,
        triggeredByTakeProfit: false,
        triggeringStrategy: "EndOfPeriod",
        simType: "short",
      };
      shortTrades.push(finalTradeData);
      if (!coverSigs.some((s) => s.index === lastIdx))
        coverSigs.push({ date: dates[lastIdx], index: lastIdx });
      const lastShortI = shortTrades.map((t) => t.type).lastIndexOf("short");
      if (lastShortI !== -1 && shortTrades[lastShortI].shares === shortShares) {
        shortCompletedTrades.push({
          entry: shortTrades[lastShortI],
          exit: finalTradeData,
          profit: prof,
          profitPercent: finalTradeData.profitPercent,
        });
      }
      shortPl[lastIdx] = shortCap - initialCapital;
      shortPos = 0;
      shortShares = 0;
      console.log(
        `[Worker SHORT] Final Cover Executed: ${finalTradeData.shares}@${finalP} on ${dates[lastIdx]}`,
      );
    } else if (shortPos === 1) {
      shortPl[lastIdx] = shortPl[lastIdx > 0 ? lastIdx - 1 : 0] ?? 0;
    }
    self.postMessage({
      type: "progress",
      progress: 95,
      message: "計算最終結果...",
    });
    portfolioVal[lastIdx] =
      initialCapital + (longPl[lastIdx] ?? 0) + (shortPl[lastIdx] ?? 0);
    strategyReturns[lastIdx] =
      initialCapital > 0
        ? ((portfolioVal[lastIdx] - initialCapital) / initialCapital) * 100
        : 0;
    const finalV = portfolioVal[lastIdx];
    const totalP = finalV - initialCapital;
    const returnR = initialCapital > 0 ? (totalP / initialCapital) * 100 : 0;
    allCompletedTrades = [...longCompletedTrades, ...shortCompletedTrades].sort(
      (a, b) => new Date(a.exit.date) - new Date(b.exit.date),
    );
    allTrades = [...longTrades, ...shortTrades].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    totalWinTrades = allCompletedTrades.filter(
      (t) => (t.profit || 0) > 0,
    ).length;
    const tradesC = allCompletedTrades.length;
    const winR = tradesC > 0 ? (totalWinTrades / tradesC) * 100 : 0;
    curCL = 0;
    maxCL = 0;
    for (const trade of allCompletedTrades) {
      if ((trade.profit || 0) < 0) {
        curCL++;
        maxCL = Math.max(maxCL, curCL);
      } else {
        curCL = 0;
      }
    }

    let annualR = 0;
    let buyHoldAnnualizedReturn = 0;
    // 使用使用者設定的日期範圍來計算年化報酬
    const firstDateStr = params.startDate;
    const lastDateStr = params.endDate;
    if (firstDateStr && lastDateStr) {
      const firstD = new Date(firstDateStr);
      const lastD = new Date(lastDateStr);
      const years =
        (lastD.getTime() - firstD.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      console.log(
        `[Worker] Strategy date range: ${firstDateStr} to ${lastDateStr} (startIdx: ${startIdx}, lastIdx: ${lastIdx})`,
      );
      console.log(
        `[Worker] Annualization Years (Strategy): ${years.toFixed(4)} (from ${firstDateStr} to ${lastDateStr})`,
      );
      if (years > 1 / (365.25 * 2)) {
        if (initialCapital > 0 && check(finalV) && finalV > 0) {
          try {
            annualR = (Math.pow(finalV / initialCapital, 1 / years) - 1) * 100;
          } catch {
            annualR = 0;
          }
        } else if (finalV <= 0 && initialCapital > 0) {
          annualR = -100;
        }
      } else if (initialCapital > 0) {
        annualR = returnR;
        console.warn(
          `[Worker] Backtest duration (${years.toFixed(4)} years) too short for meaningful annualization. Using total return rate.`,
        );
      }

      // 使用設定的日期範圍找出對應的價格
      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);
      const firstValidPriceIdxBH = closes.findIndex(
        (p, i) => check(p) && p > 0 && new Date(dates[i]) >= startDate,
      );
      const lastValidPriceIdxBH = closes
        .map((p, i) => check(p) && p > 0 && new Date(dates[i]) <= endDate)
        .lastIndexOf(true);
      if (
        firstValidPriceIdxBH !== -1 &&
        lastValidPriceIdxBH !== -1 &&
        lastValidPriceIdxBH >= firstValidPriceIdxBH
      ) {
        const firstValidPriceBH = closes[firstValidPriceIdxBH];
        const lastValidPriceBH = closes[lastValidPriceIdxBH];
        const firstValidDateBH = new Date(dates[firstValidPriceIdxBH]);
        const lastValidDateBH = new Date(dates[lastValidPriceIdxBH]);
        const bhYears =
          (lastValidDateBH.getTime() - firstValidDateBH.getTime()) /
          (1000 * 60 * 60 * 24 * 365.25);
        console.log(
          `[Worker] B&H date range: ${dates[firstValidPriceIdxBH]} to ${dates[lastValidPriceIdxBH]} (firstValidPriceIdxBH: ${firstValidPriceIdxBH}, lastValidPriceIdxBH: ${lastValidPriceIdxBH})`,
        );
        console.log(
          `[Worker] Annualization Years (B&H): ${bhYears.toFixed(4)} (from ${dates[firstValidPriceIdxBH]} to ${dates[lastValidPriceIdxBH]})`,
        );
        const bhTotalReturn =
          firstValidPriceBH !== 0
            ? ((lastValidPriceBH - firstValidPriceBH) / firstValidPriceBH) * 100
            : 0;
        if (bhYears > 1 / (365.25 * 2) && firstValidPriceBH > 0) {
          try {
            buyHoldAnnualizedReturn =
              (Math.pow(lastValidPriceBH / firstValidPriceBH, 1 / bhYears) -
                1) *
              100;
          } catch {
            buyHoldAnnualizedReturn = bhTotalReturn;
          }
        } else {
          buyHoldAnnualizedReturn = bhTotalReturn;
          console.warn(
            `[Worker] B&H duration (${bhYears.toFixed(4)} years) too short for meaningful annualization. Using total B&H return rate.`,
          );
        }
      }
    }
    const validPortfolioSlice = portfolioVal
      .slice(startIdx)
      .filter((v) => check(v));
    const dailyR = calculateDailyReturns(
      validPortfolioSlice,
      dates.slice(startIdx),
    );
    const sharpeR = calculateSharpeRatio(dailyR, annualR);
    const sortinoR = calculateSortinoRatio(dailyR, annualR);

    let annReturnHalf1 = null,
      sharpeHalf1 = null,
      annReturnHalf2 = null,
      sharpeHalf2 = null;
    const validDataLength = validPortfolioSlice.length;
    if (validDataLength >= 4) {
      const midPoint = Math.floor(validDataLength / 2);
      const firstHalfPortfolio = validPortfolioSlice.slice(0, midPoint);
      const secondHalfPortfolio = validPortfolioSlice.slice(midPoint);
      const firstHalfDates = dates.slice(startIdx, startIdx + midPoint);
      const secondHalfDates = dates.slice(
        startIdx + midPoint,
        startIdx + validDataLength,
      );
      if (firstHalfPortfolio.length > 1) {
        const firstHalfDailyReturns = calculateDailyReturns(
          firstHalfPortfolio,
          firstHalfDates,
        );
        const firstHalfStartVal = firstHalfPortfolio[0];
        const firstHalfEndVal =
          firstHalfPortfolio[firstHalfPortfolio.length - 1];
        const totalReturnHalf1 =
          firstHalfStartVal !== 0
            ? (firstHalfEndVal / firstHalfStartVal - 1) * 100
            : 0;
        annReturnHalf1 = totalReturnHalf1;
        const avgDailyReturn1 =
          firstHalfDailyReturns.reduce((s, r) => s + r, 0) /
          firstHalfDailyReturns.length;
        const variance1 =
          firstHalfDailyReturns.reduce(
            (s, r) => s + Math.pow(r - avgDailyReturn1, 2),
            0,
          ) / firstHalfDailyReturns.length;
        const stdDev1 = Math.sqrt(variance1);
        const annStdDev1 = stdDev1 * Math.sqrt(252);
        const approxAnnReturn1 =
          firstHalfDailyReturns.length > 0 ? avgDailyReturn1 * 252 * 100 : 0;
        const annExcessReturn1 = approxAnnReturn1 / 100 - 0.01;
        sharpeHalf1 = annStdDev1 !== 0 ? annExcessReturn1 / annStdDev1 : 0;
      }
      if (secondHalfPortfolio.length > 1) {
        const secondHalfDailyReturns = calculateDailyReturns(
          secondHalfPortfolio,
          secondHalfDates,
        );
        const secondHalfStartVal = secondHalfPortfolio[0];
        const secondHalfEndVal =
          secondHalfPortfolio[secondHalfPortfolio.length - 1];
        const totalReturnHalf2 =
          secondHalfStartVal !== 0
            ? (secondHalfEndVal / secondHalfStartVal - 1) * 100
            : 0;
        annReturnHalf2 = totalReturnHalf2;
        const avgDailyReturn2 =
          secondHalfDailyReturns.reduce((s, r) => s + r, 0) /
          secondHalfDailyReturns.length;
        const variance2 =
          secondHalfDailyReturns.reduce(
            (s, r) => s + Math.pow(r - avgDailyReturn2, 2),
            0,
          ) / secondHalfDailyReturns.length;
        const stdDev2 = Math.sqrt(variance2);
        const annStdDev2 = stdDev2 * Math.sqrt(252);
        const approxAnnReturn2 =
          secondHalfDailyReturns.length > 0 ? avgDailyReturn2 * 252 * 100 : 0;
        const annExcessReturn2 = approxAnnReturn2 / 100 - 0.01;
        sharpeHalf2 = annStdDev2 !== 0 ? annExcessReturn2 / annStdDev2 : 0;
      }
    }
    const subPeriodResults = {};
    const overallEndDate = new Date(lastDateStr || params.endDate);
    const overallStartDate = new Date(firstDateStr || params.startDate);
    const totalDurationMillis = overallEndDate - overallStartDate;
    const totalYears = totalDurationMillis / (1000 * 60 * 60 * 24 * 365.25);
    const totalDaysApprox = Math.max(
      1,
      totalDurationMillis / (1000 * 60 * 60 * 24),
    );
    const periodsToCalculate = {};
    if (totalDaysApprox >= 30) periodsToCalculate["1M"] = 1;
    if (totalDaysApprox >= 180) periodsToCalculate["6M"] = 6;
    if (totalYears >= 1) {
      for (let y = 1; y <= Math.floor(totalYears); y++) {
        periodsToCalculate[`${y}Y`] = y * 12;
      }
    }
    const floorTotalYears = Math.floor(totalYears);
    if (floorTotalYears >= 1 && !periodsToCalculate[`${floorTotalYears}Y`]) {
      periodsToCalculate[`${floorTotalYears}Y`] = floorTotalYears * 12;
    }
    const initP_bh_full = closes.find((p0) => check(p0) && p0 > 0) || 1;
    let bhReturnsFull = Array(n).fill(null);
    if (check(initP_bh_full)) {
      bhReturnsFull = closes.map((p, i) =>
        check(p) && p > 0
          ? ((p - initP_bh_full) / initP_bh_full) * 100
          : i > 0 && bhReturnsFull[i - 1] !== null
            ? bhReturnsFull[i - 1]
            : 0,
      );
    }
    for (const [label, months] of Object.entries(periodsToCalculate)) {
      const subStartDate = new Date(overallEndDate);
      subStartDate.setMonth(subStartDate.getMonth() - months);
      subStartDate.setDate(subStartDate.getDate() + 1);
      const subStartDateStr = subStartDate.toISOString().split("T")[0];
      let subStartIdx = dates.findIndex((d) => d >= subStartDateStr);
      if (subStartIdx === -1 || subStartIdx < startIdx) {
        subStartIdx = startIdx;
      }
      if (subStartIdx <= lastIdx) {
        const subEndIdx = lastIdx;
        const subPortfolioVals = portfolioVal
          .slice(subStartIdx, subEndIdx + 1)
          .filter((v) => check(v));
        const subBHRawPrices = closes
          .slice(subStartIdx, subEndIdx + 1)
          .filter((v) => check(v));
        const subDates = dates.slice(subStartIdx, subEndIdx + 1);
        if (
          subPortfolioVals.length > 1 &&
          subDates.length > 1 &&
          subBHRawPrices.length > 1
        ) {
          const subStartVal = subPortfolioVals[0];
          const subEndVal = subPortfolioVals[subPortfolioVals.length - 1];
          const subTotalReturn =
            subStartVal !== 0
              ? ((subEndVal - subStartVal) / subStartVal) * 100
              : 0;
          const subStartBHPrice = subBHRawPrices[0];
          const subEndBHPrice = subBHRawPrices[subBHRawPrices.length - 1];
          const subBHTotalReturn =
            subStartBHPrice !== 0
              ? ((subEndBHPrice - subStartBHPrice) / subStartBHPrice) * 100
              : 0;
          const subDailyReturns = calculateDailyReturns(
            subPortfolioVals,
            subDates,
          );
          const subAnnualizedReturn = 0;
          const subSharpe = calculateSharpeRatio(
            subDailyReturns,
            subAnnualizedReturn,
          );
          const subSortino = calculateSortinoRatio(
            subDailyReturns,
            subAnnualizedReturn,
          );
          const subMaxDD = calculateMaxDrawdown(subPortfolioVals);
          subPeriodResults[label] = {
            totalReturn: subTotalReturn,
            totalBuyHoldReturn: subBHTotalReturn,
            sharpeRatio: subSharpe,
            sortinoRatio: subSortino,
            maxDrawdown: subMaxDD,
          };
        } else {
          subPeriodResults[label] = null;
        }
      } else {
        subPeriodResults[label] = null;
      }
    }

    self.postMessage({ type: "progress", progress: 100, message: "完成" });
    return {
      stockNo: params.stockNo,
      initialCapital: initialCapital,
      finalValue: finalV,
      totalProfit: totalP,
      returnRate: returnR,
      annualizedReturn: annualR,
      maxDrawdown: maxDD,
      winRate: winR,
      winTrades: totalWinTrades,
      tradesCount: tradesC,
      sharpeRatio: sharpeR,
      sortinoRatio: sortinoR,
      maxConsecutiveLosses: maxCL,
      trades: allTrades,
      completedTrades: allCompletedTrades,
      buyHoldReturns: bhReturnsFull,
      strategyReturns: strategyReturns,
      dates: dates,
      chartBuySignals: buySigs,
      chartSellSignals: sellSigs,
      chartShortSignals: shortSigs,
      chartCoverSignals: coverSigs,
      entryStrategy: params.entryStrategy,
      exitStrategy: params.exitStrategy,
      entryParams: params.entryParams,
      exitParams: params.exitParams,
      enableShorting: params.enableShorting,
      shortEntryStrategy: params.shortEntryStrategy,
      shortExitStrategy: params.shortExitStrategy,
      shortEntryParams: params.shortEntryParams,
      shortExitParams: params.shortExitParams,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      tradeTiming: params.tradeTiming,
      buyFee: params.buyFee,
      sellFee: params.sellFee,
      positionBasis: params.positionBasis,
      rawData: data,
      buyHoldAnnualizedReturn: buyHoldAnnualizedReturn,
      annReturnHalf1: annReturnHalf1,
      sharpeHalf1: sharpeHalf1,
      annReturnHalf2: annReturnHalf2,
      sharpeHalf2: sharpeHalf2,
      subPeriodResults: subPeriodResults,
    };
  } catch (finalError) {
    console.error("Final calculation error:", finalError);
    throw new Error(`計算最終結果錯誤: ${finalError.message}`);
  }
}

// --- 參數優化邏輯 ---
async function runOptimization(
  baseParams,
  optimizeTargetStrategy,
  optParamName,
  optRange,
  useCache,
  cachedData,
) {
  const targetLblMap = {
    entry: "進場",
    exit: "出場",
    shortEntry: "做空進場",
    shortExit: "回補出場",
    risk: "風險控制",
  };
  const targetLbl =
    targetLblMap[optimizeTargetStrategy] || optimizeTargetStrategy;
  self.postMessage({
    type: "progress",
    progress: 0,
    message: `開始優化 ${targetLbl}策略 ${optParamName}...`,
  });
  const results = [];
  let stockData = null;
  let dataFetched = false;

  // Data acquisition policy:
  // - If useCache === true: only use provided cachedData or現有的 worker 快取；禁止再抓遠端。
  // - If useCache === false: 使用提供或既有快取，否則才呼叫 fetchStockData。
  if (useCache) {
    if (Array.isArray(cachedData) && cachedData.length > 0) {
      stockData = cachedData;
    } else if (
      Array.isArray(workerLastDataset) &&
      workerLastDataset.length > 0
    ) {
      stockData = workerLastDataset;
      console.log("[Worker Opt] Using worker's cached data.");
    } else {
      throw new Error(
        "優化失敗: 未提供快取數據；批量優化在快取模式下禁止從遠端抓取資料，請先於主畫面執行回測以建立快取。",
      );
    }
  } else {
    if (Array.isArray(cachedData) && cachedData.length > 0) {
      stockData = cachedData;
    } else if (
      Array.isArray(workerLastDataset) &&
      workerLastDataset.length > 0
    ) {
      stockData = workerLastDataset;
      console.log("[Worker Opt] Using worker's cached data.");
    } else {
      const fetched = await fetchStockData(
        baseParams.stockNo,
        baseParams.startDate,
        baseParams.endDate,
        baseParams.marketType || baseParams.market || "TWSE",
        { adjusted: baseParams.adjustedPrice },
      );
      stockData = fetched?.data || [];
      dataFetched = true;
      if (!Array.isArray(stockData) || stockData.length === 0)
        throw new Error(`優化失敗: 無法獲取 ${baseParams.stockNo} 數據`);
      self.postMessage({
        type: "progress",
        progress: 50,
        message: "數據獲取完成，開始優化...",
      });
    }
  }

  if (!stockData) {
    throw new Error("優化失敗：無可用數據");
  }

  const range = optRange || { from: 1, to: 20, step: 1 };
  const totalSteps = Math.max(
    1,
    Math.floor((range.to - range.from) / range.step) + 1,
  );
  let curStep = 0;
  for (let val = range.from; val <= range.to; val += range.step) {
    const curVal = parseFloat(val.toFixed(4));
    if (curVal > range.to && Math.abs(curVal - range.to) > 1e-9) break;
    curStep++;
    const prog = 50 + Math.floor((curStep / totalSteps) * 50);
    self.postMessage({
      type: "progress",
      progress: Math.min(100, prog),
      message: `測試 ${optParamName}=${curVal}`,
    });
    const testParams = JSON.parse(JSON.stringify(baseParams));
    if (optimizeTargetStrategy === "risk") {
      if (optParamName === "stopLoss" || optParamName === "takeProfit") {
        testParams[optParamName] = curVal;
      } else {
        console.warn(
          `[Worker Opt] Unknown risk parameter name: ${optParamName}, skipping value ${curVal}`,
        );
        continue;
      }
    } else {
      let targetObjKey = null;
      if (optimizeTargetStrategy === "entry") targetObjKey = "entryParams";
      else if (optimizeTargetStrategy === "exit") targetObjKey = "exitParams";
      else if (optimizeTargetStrategy === "shortEntry")
        targetObjKey = "shortEntryParams";
      else if (optimizeTargetStrategy === "shortExit")
        targetObjKey = "shortExitParams";
      else {
        console.warn(
          `[Worker Opt] Unknown strategy optimization type: ${optimizeTargetStrategy}`,
        );
        continue;
      }
      if (!testParams[targetObjKey]) testParams[targetObjKey] = {};
      if (
        testParams[targetObjKey].hasOwnProperty(optParamName) ||
        typeof testParams[targetObjKey][optParamName] === "undefined"
      ) {
        testParams[targetObjKey][optParamName] = curVal;
      } else {
        console.warn(
          `[Worker Opt] Could not find param ${optParamName} in ${targetObjKey}, skipping value ${curVal}`,
        );
        continue;
      }
      if (
        optimizeTargetStrategy === "shortEntry" ||
        optimizeTargetStrategy === "shortExit"
      ) {
        testParams.enableShorting = true;
      } else {
        testParams.enableShorting = false;
      }
    }
    try {
      const result = runStrategy(stockData, testParams);
      if (result) {
        results.push({
          paramValue: curVal,
          annualizedReturn: result.annualizedReturn,
          returnRate: result.returnRate,
          maxDrawdown: result.maxDrawdown,
          winRate: result.winRate,
          tradesCount: result.tradesCount,
          sharpeRatio: result.sharpeRatio,
          sortinoRatio: result.sortinoRatio,
        });
      }
    } catch (err) {
      console.error(
        `[Worker Opt] Error optimizing ${optParamName}=${curVal} for ${optimizeTargetStrategy}:`,
        err,
      );
    }
  }
  results.sort((a, b) => {
    const rA =
      a?.annualizedReturn !== null && isFinite(a.annualizedReturn)
        ? a.annualizedReturn
        : -Infinity;
    const rB =
      b?.annualizedReturn !== null && isFinite(b.annualizedReturn)
        ? b.annualizedReturn
        : -Infinity;
    if (rB !== rA) return rB - rA;
    const dda = a?.maxDrawdown ?? Infinity;
    const ddb = b?.maxDrawdown ?? Infinity;
    if (dda !== ddb) return dda - ddb;
    const sA = isFinite(a?.sortinoRatio) ? a.sortinoRatio : -Infinity;
    const sB = isFinite(b?.sortinoRatio) ? b.sortinoRatio : -Infinity;
    return sB - sA;
  });
  self.postMessage({ type: "progress", progress: 100, message: "優化完成" });
  return { results: results, rawDataUsed: dataFetched ? stockData : null };
}

// --- 執行策略建議模擬 (修正建議邏輯) ---
function runSuggestionSimulation(params, recentData) {
  console.log("[Worker Suggestion] Starting simulation for suggestion...");
  const n = recentData.length;
  if (!recentData || n === 0) {
    console.error("[Worker Suggestion] No recent data provided.");
    return "數據不足無法產生建議";
  }
  const {
    entryStrategy,
    exitStrategy,
    entryParams,
    exitParams,
    enableShorting,
    shortEntryStrategy,
    shortExitStrategy,
    shortEntryParams,
    shortExitParams,
    stopLoss: globalSL,
    takeProfit: globalTP,
  } = params; // tradeTiming not needed for signal check
  const dates = recentData.map((d) => d.date);
  const opens = recentData.map((d) => d.open);
  const highs = recentData.map((d) => d.high);
  const lows = recentData.map((d) => d.low);
  const closes = recentData.map((d) => d.close);
  const volumes = recentData.map((d) => d.volume);
  let indicators;
  try {
    indicators = calculateAllIndicators(recentData, params);
  } catch (e) {
    console.error("[Worker Suggestion] Error calculating indicators:", e);
    return `指標計算錯誤: ${e.message}`;
  }
  const check = (v) => v !== null && !isNaN(v) && isFinite(v);

  let minLookbackSuggestion = 1;
  const checkParamLookback = (pObj) => {
    Object.values(pObj || {}).forEach((v) => {
      if (typeof v === "number" && !isNaN(v) && v > minLookbackSuggestion)
        minLookbackSuggestion = v;
    });
  };
  checkParamLookback(entryParams);
  checkParamLookback(exitParams);
  if (enableShorting) {
    checkParamLookback(shortEntryParams);
    checkParamLookback(shortExitParams);
  }
  if (
    entryStrategy.includes("macd") ||
    exitStrategy.includes("macd") ||
    (enableShorting &&
      (shortEntryStrategy.includes("macd") ||
        shortExitStrategy.includes("macd")))
  )
    minLookbackSuggestion = Math.max(
      minLookbackSuggestion,
      (entryParams?.longPeriod || 26) + (entryParams?.signalPeriod || 9),
    );
  if (
    entryStrategy.includes("k_d") ||
    exitStrategy.includes("k_d") ||
    (enableShorting &&
      (shortEntryStrategy.includes("k_d") || shortExitStrategy.includes("k_d")))
  )
    minLookbackSuggestion = Math.max(
      minLookbackSuggestion,
      entryParams?.period || 9,
    );
  if (
    entryStrategy.includes("turtle") ||
    exitStrategy.includes("turtle") ||
    (enableShorting &&
      (shortEntryStrategy.includes("turtle") ||
        shortExitStrategy.includes("turtle")))
  )
    minLookbackSuggestion = Math.max(
      minLookbackSuggestion,
      entryParams?.breakoutPeriod || 20,
      exitParams?.stopLossPeriod || 10,
    );

  if (n <= minLookbackSuggestion) {
    console.warn(
      `[Worker Suggestion] Data length ${n} <= minLookback ${minLookbackSuggestion}`,
    );
    return "近期數據不足";
  }

  let longPos = 0;
  let shortPos = 0;
  let lastBuyP = 0;
  let lastShortP = 0;
  let curPeakP = 0;
  let currentLowSinceShort = Infinity;

  const i = n - 1;
  const curC = closes[i];
  const curH = highs[i];
  const curL = lows[i];
  const prevC = i > 0 ? closes[i - 1] : null;

  let buySignal = false,
    sellSignal = false,
    shortSignal = false,
    coverSignal = false;
  let slTrig = false,
    tpTrig = false,
    shortSlTrig = false,
    shortTpTrig = false;

  switch (entryStrategy) {
    case "ma_cross":
    case "ema_cross":
      buySignal =
        check(indicators.maShort[i]) &&
        check(indicators.maLong[i]) &&
        check(indicators.maShort[i - 1]) &&
        check(indicators.maLong[i - 1]) &&
        indicators.maShort[i] > indicators.maLong[i] &&
        indicators.maShort[i - 1] <= indicators.maLong[i - 1];
      break;
    case "ma_above":
      buySignal =
        check(indicators.maExit[i]) &&
        check(prevC) &&
        check(indicators.maExit[i - 1]) &&
        curC > indicators.maExit[i] &&
        prevC <= indicators.maExit[i - 1];
      break;
    case "rsi_oversold":
      const rE = indicators.rsiEntry[i],
        rPE = indicators.rsiEntry[i - 1],
        rThE = entryParams.threshold || 30;
      buySignal = check(rE) && check(rPE) && rE > rThE && rPE <= rThE;
      break;
    case "macd_cross":
      const difE = indicators.macdEntry[i],
        deaE = indicators.macdSignalEntry[i],
        difPE = indicators.macdEntry[i - 1],
        deaPE = indicators.macdSignalEntry[i - 1];
      buySignal =
        check(difE) &&
        check(deaE) &&
        check(difPE) &&
        check(deaPE) &&
        difE > deaE &&
        difPE <= deaPE;
      break;
    case "bollinger_breakout":
      buySignal =
        check(indicators.bollingerUpperEntry[i]) &&
        check(prevC) &&
        check(indicators.bollingerUpperEntry[i - 1]) &&
        curC > indicators.bollingerUpperEntry[i] &&
        prevC <= indicators.bollingerUpperEntry[i - 1];
      break;
    case "k_d_cross":
      const kE = indicators.kEntry[i],
        dE = indicators.dEntry[i],
        kPE = indicators.kEntry[i - 1],
        dPE = indicators.dEntry[i - 1],
        thX = entryParams.thresholdX || 30;
      buySignal =
        check(kE) &&
        check(dE) &&
        check(kPE) &&
        check(dPE) &&
        kE > dE &&
        kPE <= dPE &&
        dE < thX;
      break;
    case "volume_spike":
      const vAE = indicators.volumeAvgEntry[i],
        vME = entryParams.multiplier || 2;
      buySignal = check(vAE) && check(volumes[i]) && volumes[i] > vAE * vME;
      break;
    case "price_breakout":
      const bpE = entryParams.period || 20;
      if (i >= bpE) {
        const hsE = highs.slice(i - bpE, i).filter((h) => check(h));
        if (hsE.length > 0) {
          const periodHigh = Math.max(...hsE);
          buySignal = check(curC) && curC > periodHigh;
        }
      }
      break;
    case "williams_oversold":
      const wrE = indicators.williamsEntry[i],
        wrPE = indicators.williamsEntry[i - 1],
        wrThE = entryParams.threshold || -80;
      buySignal = check(wrE) && check(wrPE) && wrE > wrThE && wrPE <= wrThE;
      break;
    case "turtle_breakout":
      const tpE = entryParams.breakoutPeriod || 20;
      if (i >= tpE) {
        const hsT = highs.slice(i - tpE, i).filter((h) => check(h));
        if (hsT.length > 0) {
          const periodHighT = Math.max(...hsT);
          buySignal = check(curC) && curC > periodHighT;
        }
      }
      break;
  }
  if (enableShorting) {
    switch (shortEntryStrategy) {
      case "short_ma_cross":
      case "short_ema_cross":
        shortSignal =
          check(indicators.maShortShortEntry[i]) &&
          check(indicators.maLongShortEntry[i]) &&
          check(indicators.maShortShortEntry[i - 1]) &&
          check(indicators.maLongShortEntry[i - 1]) &&
          indicators.maShortShortEntry[i] < indicators.maLongShortEntry[i] &&
          indicators.maShortShortEntry[i - 1] >=
            indicators.maLongShortEntry[i - 1];
        break;
      case "short_ma_below":
        shortSignal =
          check(indicators.maExit[i]) &&
          check(prevC) &&
          check(indicators.maExit[i - 1]) &&
          curC < indicators.maExit[i] &&
          prevC >= indicators.maExit[i - 1];
        break;
      case "short_rsi_overbought":
        const rSE = indicators.rsiShortEntry[i],
          rPSE = indicators.rsiShortEntry[i - 1],
          rThSE = shortEntryParams.threshold || 70;
        shortSignal = check(rSE) && check(rPSE) && rSE < rThSE && rPSE >= rThSE;
        break;
      case "short_macd_cross":
        const difSE = indicators.macdShortEntry[i],
          deaSE = indicators.macdSignalShortEntry[i],
          difPSE = indicators.macdShortEntry[i - 1],
          deaPSE = indicators.macdSignalShortEntry[i - 1];
        shortSignal =
          check(difSE) &&
          check(deaSE) &&
          check(difPSE) &&
          check(deaPSE) &&
          difSE < deaSE &&
          difPSE >= deaSE;
        break;
      case "short_bollinger_reversal":
        const midSE = indicators.bollingerMiddleShortEntry[i];
        const midPSE = indicators.bollingerMiddleShortEntry[i - 1];
        shortSignal =
          check(midSE) &&
          check(prevC) &&
          check(midPSE) &&
          curC < midSE &&
          prevC >= midPSE;
        break;
      case "short_k_d_cross":
        const kSE = indicators.kShortEntry[i],
          dSE = indicators.dShortEntry[i],
          kPSE = indicators.kShortEntry[i - 1],
          dPSE = indicators.dShortEntry[i - 1],
          thY = shortEntryParams.thresholdY || 70;
        shortSignal =
          check(kSE) &&
          check(dSE) &&
          check(kPSE) &&
          check(dPSE) &&
          kSE < dSE &&
          kPSE >= dPSE &&
          dSE > thY;
        break;
      case "short_price_breakdown":
        const bpSE = shortEntryParams.period || 20;
        if (i >= bpSE) {
          const lsSE = lows.slice(i - bpSE, i).filter((l) => check(l));
          if (lsSE.length > 0) {
            const periodLowS = Math.min(...lsSE);
            shortSignal = check(curC) && curC < periodLowS;
          }
        }
        break;
      case "short_williams_overbought":
        const wrSE = indicators.williamsShortEntry[i],
          wrPSE = indicators.williamsShortEntry[i - 1],
          wrThSE = shortEntryParams.threshold || -20;
        shortSignal =
          check(wrSE) && check(wrPSE) && wrSE < wrThSE && wrPSE >= wrThSE;
        break;
      case "short_turtle_stop_loss":
        const slPSE = shortEntryParams.stopLossPeriod || 10;
        if (i >= slPSE) {
          const lowsT = lows.slice(i - slPSE, i).filter((l) => check(l));
          if (lowsT.length > 0) {
            const periodLowST = Math.min(...lowsT);
            shortSignal = check(curC) && curC < periodLowST;
          }
        }
        break;
    }
  }

  switch (exitStrategy) {
    case "ma_cross":
    case "ema_cross":
      sellSignal =
        check(indicators.maShortExit[i]) &&
        check(indicators.maLongExit[i]) &&
        check(indicators.maShortExit[i - 1]) &&
        check(indicators.maLongExit[i - 1]) &&
        indicators.maShortExit[i] < indicators.maLongExit[i] &&
        indicators.maShortExit[i - 1] >= indicators.maLongExit[i - 1];
      break;
    case "ma_below":
      sellSignal =
        check(indicators.maExit[i]) &&
        check(prevC) &&
        check(indicators.maExit[i - 1]) &&
        curC < indicators.maExit[i] &&
        prevC >= indicators.maExit[i - 1];
      break;
    case "rsi_overbought":
      const rX = indicators.rsiExit[i],
        rPX = indicators.rsiExit[i - 1],
        rThX = exitParams.threshold || 70;
      sellSignal = check(rX) && check(rPX) && rX < rThX && rPX >= rThX;
      break;
    case "macd_cross":
      const difX = indicators.macdExit[i],
        deaX = indicators.macdSignalExit[i],
        difPX = indicators.macdExit[i - 1],
        deaPX = indicators.macdSignalExit[i - 1];
      sellSignal =
        check(difX) &&
        check(deaX) &&
        check(difPX) &&
        check(deaPX) &&
        difX < deaX &&
        difPX >= deaPX;
      break;
    case "bollinger_reversal":
      const midX = indicators.bollingerMiddleExit[i];
      const midPX = indicators.bollingerMiddleExit[i - 1];
      sellSignal =
        check(midX) &&
        check(prevC) &&
        check(midPX) &&
        curC < midX &&
        prevC >= midPX;
      break;
    case "k_d_cross":
      const kX = indicators.kExit[i],
        dX = indicators.dExit[i],
        kPX = indicators.kExit[i - 1],
        dPX = indicators.dExit[i - 1],
        thY = exitParams.thresholdY || 70;
      sellSignal =
        check(kX) &&
        check(dX) &&
        check(kPX) &&
        check(dPX) &&
        kX < dX &&
        kPX >= dPX &&
        dX > thY;
      break;
    case "trailing_stop":
      sellSignal = false;
      break;
    case "price_breakdown":
      const bpX = exitParams.period || 20;
      if (i >= bpX) {
        const lsX = lows.slice(i - bpX, i).filter((l) => check(l));
        if (lsX.length > 0) {
          const periodLow = Math.min(...lsX);
          sellSignal = check(curC) && curC < periodLow;
        }
      }
      break;
    case "williams_overbought":
      const wrX = indicators.williamsExit[i],
        wrPX = indicators.williamsExit[i - 1],
        wrThX = exitParams.threshold || -20;
      sellSignal = check(wrX) && check(wrPX) && wrX < wrThX && wrPX >= wrThX;
      break;
    case "turtle_stop_loss":
      const slP = exitParams.stopLossPeriod || 10;
      if (i >= slP) {
        const lowsT = lows.slice(i - slP, i).filter((l) => check(l));
        if (lowsT.length > 0) {
          const periodLowT = Math.min(...lowsT);
          sellSignal = check(curC) && curC < periodLowT;
        }
      }
      break;
    case "fixed_stop_loss":
      sellSignal = false;
      break;
  }
  if (enableShorting) {
    switch (shortExitStrategy) {
      case "cover_ma_cross":
      case "cover_ema_cross":
        coverSignal =
          check(indicators.maShortCover[i]) &&
          check(indicators.maLongCover[i]) &&
          check(indicators.maShortCover[i - 1]) &&
          check(indicators.maLongCover[i - 1]) &&
          indicators.maShortCover[i] > indicators.maLongCover[i] &&
          indicators.maShortCover[i - 1] <= indicators.maLongCover[i - 1];
        break;
      case "cover_ma_above":
        coverSignal =
          check(indicators.maExit[i]) &&
          check(prevC) &&
          check(indicators.maExit[i - 1]) &&
          curC > indicators.maExit[i] &&
          prevC <= indicators.maExit[i - 1];
        break;
      case "cover_rsi_oversold":
        const rC = indicators.rsiCover[i],
          rPC = indicators.rsiCover[i - 1],
          rThC = shortExitParams.threshold || 30;
        coverSignal = check(rC) && check(rPC) && rC > rThC && rPC <= rThC;
        break;
      case "cover_macd_cross":
        const difC = indicators.macdCover[i],
          deaC = indicators.macdSignalCover[i],
          difPC = indicators.macdCover[i - 1],
          deaPC = indicators.macdSignalCover[i - 1];
        coverSignal =
          check(difC) &&
          check(deaC) &&
          check(difPC) &&
          check(deaPC) &&
          difC > deaC &&
          difPC <= deaPC;
        break;
      case "cover_bollinger_breakout":
        const upperC = indicators.bollingerUpperCover[i];
        const upperPC = indicators.bollingerUpperCover[i - 1];
        coverSignal =
          check(upperC) &&
          check(prevC) &&
          check(upperPC) &&
          curC > upperC &&
          prevC <= upperPC;
        break;
      case "cover_k_d_cross":
        const kC = indicators.kCover[i],
          dC = indicators.dCover[i],
          kPC = indicators.kCover[i - 1],
          dPC = indicators.dCover[i - 1],
          thXC = shortExitParams.thresholdX || 30;
        coverSignal =
          check(kC) &&
          check(dC) &&
          check(kPC) &&
          check(dPC) &&
          kC > dC &&
          kPC <= dPC &&
          dC < thXC;
        break;
      case "cover_price_breakout":
        const bpC = shortExitParams.period || 20;
        if (i >= bpC) {
          const hsC = highs.slice(i - bpC, i).filter((h) => check(h));
          if (hsC.length > 0) {
            const periodHighC = Math.max(...hsC);
            coverSignal = check(curC) && curC > periodHighC;
          }
        }
        break;
      case "cover_williams_oversold":
        const wrC = indicators.williamsCover[i],
          wrPC = indicators.williamsCover[i - 1],
          wrThC = shortExitParams.threshold || -80;
        coverSignal = check(wrC) && check(wrPC) && wrC > wrThC && wrPC <= wrThC;
        break;
      case "cover_turtle_breakout":
        const tpC = shortExitParams.breakoutPeriod || 20;
        if (i >= tpC) {
          const hsCT = highs.slice(i - tpC, i).filter((h) => check(h));
          if (hsCT.length > 0) {
            const periodHighCT = Math.max(...hsCT);
            coverSignal = check(curC) && curC > periodHighCT;
          }
        }
        break;
      case "cover_trailing_stop":
        coverSignal = false;
        break;
      case "cover_fixed_stop_loss":
        coverSignal = false;
        break;
    }
  }

  let suggestion = "等待";
  if (buySignal) {
    suggestion = "做多買入";
  } else if (shortSignal) {
    suggestion = "做空賣出";
  } else if (sellSignal) {
    suggestion = "做多賣出";
  } else if (coverSignal) {
    suggestion = "做空回補";
  }

  console.log(
    `[Worker Suggestion] Last Point Analysis: buy=${buySignal}, sell=${sellSignal}, short=${shortSignal}, cover=${coverSignal}. Suggestion: ${suggestion}`,
  );
  return suggestion;
}

// --- Worker 消息處理 ---
self.onmessage = async function (e) {
  const {
    type,
    params,
    useCachedData,
    cachedData,
    optimizeTargetStrategy,
    optimizeParamName,
    optimizeRange,
    lookbackDays,
  } = e.data;
  try {
    if (type === "runBacktest") {
      let dataToUse = null;
      let fetched = false;
      let outcome = null;
      const marketKey = getMarketKey(
        params.marketType || params.market || "TWSE",
      );
      const cacheKey = buildCacheKey(
        params.stockNo,
        params.startDate,
        params.endDate,
        params.adjustedPrice,
      );
      if (useCachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log("[Worker] Using cached data for backtest.");
        dataToUse = cachedData;
        const existingEntry = getWorkerCacheEntry(marketKey, cacheKey);
        if (!existingEntry) {
          setWorkerCacheEntry(marketKey, cacheKey, {
            data: cachedData,
            stockName: params.stockNo,
            dataSource: "主執行緒快取",
            timestamp: Date.now(),
            meta: {
              stockNo: params.stockNo,
              startDate: params.startDate,
              endDate: params.endDate,
              priceMode: getPriceModeKey(params.adjustedPrice),
            },
            priceMode: getPriceModeKey(params.adjustedPrice),
          });
        }
      } else {
        console.log("[Worker] Fetching new data for backtest.");
        outcome = await fetchStockData(
          params.stockNo,
          params.startDate,
          params.endDate,
          params.marketType,
          { adjusted: params.adjustedPrice },
        );
        dataToUse = outcome.data;
        fetched = true;
      }
      if (!Array.isArray(dataToUse) || dataToUse.length === 0) {
        // 回傳友善的 no_data 訊息給主執行緒，讓 UI 顯示查無資料而不是把 Worker 異常化
        const msg = `指定範圍 (${params.startDate} ~ ${params.endDate}) 無 ${params.stockNo} 交易數據`;
        console.warn(`[Worker] ${msg}`);
        self.postMessage({
          type: "no_data",
          data: {
            stockNo: params.stockNo,
            start: params.startDate,
            end: params.endDate,
            message: msg,
          },
        });
        return;
      }

      // 關鍵修正：
      // 我們需要傳遞的是 K 線資料，而不是整個包裹
      const backtestResult = runStrategy(dataToUse, params);
      if (useCachedData || !fetched) {
        backtestResult.rawData = null;
      } // Don't send back data if it wasn't fetched by this worker call

      // 將結果與資料來源一起回傳
      const metaInfo = outcome ||
        workerLastMeta || {
          stockName: params.stockNo,
          dataSource: fetched
            ? params.marketType || params.market || "未知"
            : "快取",
        };
      self.postMessage({
        type: "result",
        data: backtestResult,
        stockName: metaInfo?.stockName || "",
        dataSource: metaInfo?.dataSource || "未知",
      });
    } else if (type === "runOptimization") {
      if (!optimizeTargetStrategy || !optimizeParamName || !optimizeRange)
        throw new Error("優化目標、參數名或範圍未指定");
      // Enforce cache-only when requested: do not allow worker to fetch remote data in this mode.
      if (useCachedData) {
        const hasProvidedCache =
          Array.isArray(cachedData) && cachedData.length > 0;
        const hasWorkerCache =
          Array.isArray(workerLastDataset) && workerLastDataset.length > 0;
        if (!hasProvidedCache && !hasWorkerCache) {
          throw new Error(
            "優化失敗: 未提供快取數據；批量優化在快取模式下禁止從遠端抓取資料，請先於主畫面執行回測以建立快取。",
          );
        }
      }
      const optOutcome = await runOptimization(
        params,
        optimizeTargetStrategy,
        optimizeParamName,
        optimizeRange,
        useCachedData,
        cachedData || workerLastDataset,
      );
      self.postMessage({ type: "result", data: optOutcome });
    } else if (type === "getSuggestion") {
      console.log("[Worker] Received getSuggestion request.");
      if (!workerLastDataset) {
        throw new Error("Worker 中無可用快取數據，請先執行回測。");
      }
      if (workerLastDataset.length < lookbackDays) {
        throw new Error(
          `Worker 快取數據不足 (${workerLastDataset.length})，無法回看 ${lookbackDays} 天。`,
        );
      }

      const recentData = workerLastDataset.slice(-lookbackDays);
      const suggestionTextResult = runSuggestionSimulation(params, recentData);
      self.postMessage({
        type: "suggestionResult",
        data: { suggestion: suggestionTextResult },
      });
    }
  } catch (error) {
    console.error(`Worker 執行 ${type} 期間錯誤:`, error);
    if (type === "getSuggestion") {
      self.postMessage({
        type: "suggestionError",
        data: { message: `計算建議時發生錯誤: ${error.message || "未知錯誤"}` },
      });
    } else {
      self.postMessage({
        type: "error",
        data: {
          message: `Worker ${type} 錯誤: ${error.message || "未知錯誤"}`,
        },
      });
    }
  }
};
// --- Web Worker End ---
