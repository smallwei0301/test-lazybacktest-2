// netlify/functions/adjusted-price-proxy.js (v1.2 - Adjusted price fallback orchestrator)
// Patch Tag: LB-ADJ-ENDPOINT-20241025B
import fetch from 'node-fetch';
import twseProxy from './twse-proxy.js';
import tpexProxy from './tpex-proxy.js';

const FUNCTION_VERSION = 'LB-ADJ-ENDPOINT-20241025B';
const DEBUG_NAMESPACE = '[AdjustedPriceProxy v1.2]';
const FINMIND_SEGMENT_YEARS = 5;
const FINMIND_TIMEOUT_MS = 9000;

function logDebug(message, context = {}) {
  try {
    if (context && Object.keys(context).length > 0) {
      console.info(`${DEBUG_NAMESPACE} ${message}`, context);
    } else {
      console.info(`${DEBUG_NAMESPACE} ${message}`);
    }
  } catch (error) {
    console.info(`${DEBUG_NAMESPACE} ${message}`);
  }
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoToUTCDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split('-').map((part) => Number(part));
  if (![year, month, day].every((num) => Number.isFinite(num))) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(utc.getTime()) ? null : utc;
}

function utcDateToISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function toISODate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const isoCandidate = new Date(trimmed);
    return Number.isNaN(isoCandidate.getTime()) ? null : trimmed;
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('/').map((part) => Number(part));
    if (!y || !m || !d) return null;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  if (/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    const [rocYear, month, day] = trimmed.split('/').map((part) => Number(part));
    if (!rocYear || !month || !day) return null;
    const year = rocYear + 1911;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (/^\d{8}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6));
    if (!year || !month || !day) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  return null;
}

function rocToISO(rocDate) {
  if (!rocDate) return null;
  const parts = String(rocDate).trim().split('/');
  if (parts.length !== 3) return null;
  const [rocYear, month, day] = parts.map((part) => Number(part));
  if (!rocYear || !month || !day) return null;
  const year = rocYear + 1911;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/,/g, '').replace(/▲|▼/g, '');
  if (!cleaned || cleaned === '--') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeRound(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Math.round(value * 10000) / 10000);
}

function createProxyRequest(url) {
  try {
    if (typeof Request === 'function') {
      return new Request(url, { headers: { 'User-Agent': 'AdjustedPriceProxy/1.2' } });
    }
  } catch (error) {
    // ignore and fallback to plain object
  }
  return { url };
}

function applyFactor(value, factor) {
  if (!Number.isFinite(value) || !Number.isFinite(factor)) return null;
  return safeRound(value * factor);
}

function formatPrice(value) {
  const rounded = safeRound(value);
  if (!Number.isFinite(rounded)) return '--';
  return rounded.toFixed(2);
}

function formatChange(value) {
  const rounded = safeRound(value);
  if (!Number.isFinite(rounded)) return '--';
  return rounded.toFixed(2);
}

function normaliseDividendRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const exDateCandidate =
    raw.cash_dividend_ex_date ||
    raw.stock_dividend_ex_date ||
    raw.ex_dividend_date ||
    raw.ex_rights_date ||
    raw.dividend_date ||
    raw.date;
  const isoDate = toISODate(exDateCandidate);
  if (!isoDate) return null;

  const cashDividend =
    Math.max(
      0,
      parseNumber(
        raw.cash_dividend ??
          raw.CashDividend ??
          raw.cash_dividend_from_earnings ??
          raw.cash_dividend_from_recapitalization,
      ) ?? 0,
    );

  const stockDividendParts = [
    parseNumber(raw.stock_dividend ?? raw.StockDividend),
    parseNumber(raw.stock_dividend_from_earnings ?? raw.stock_dividend_from_earning),
    parseNumber(
      raw.stock_dividend_from_recapitalization ?? raw.stock_dividend_from_capital_reserve,
    ),
    parseNumber(raw.stock_dividend_surplus ?? raw.stock_bonus_from_retained_earnings),
  ];
  const stockDividend = stockDividendParts
    .filter((val) => Number.isFinite(val) && val > 0)
    .reduce((sum, val) => sum + val, 0);

  const referencePrice = parseNumber(
    raw.cash_dividend_reference_price ??
      raw.CashDividendReferencePrice ??
      raw.reference_price ??
      raw.referencePrice,
  );

  if (cashDividend <= 0 && stockDividend <= 0) {
    return null;
  }

  return {
    date: isoDate,
    cashDividend,
    stockDividend,
    referencePrice: Number.isFinite(referencePrice) ? referencePrice : null,
  };
}

function buildDividendMap(records) {
  const map = new Map();
  (records || [])
    .map((record) => normaliseDividendRecord(record))
    .filter(Boolean)
    .forEach((record) => {
      if (!map.has(record.date)) {
        map.set(record.date, []);
      }
      map.get(record.date).push(record);
    });
  return map;
}

function normalisePriceRows(rawRows) {
  if (!Array.isArray(rawRows)) return [];
  const result = [];
  rawRows.forEach((row) => {
    if (!Array.isArray(row) || row.length < 7) return;
    const isoDate = rocToISO(row[0]) || toISODate(row[0]);
    if (!isoDate) return;
    const open = parseNumber(row[3]);
    const high = parseNumber(row[4]);
    const low = parseNumber(row[5]);
    const close = parseNumber(row[6]);
    const volume = parseNumber(row[1]) ?? 0;
    result.push({
      date: isoDate,
      open,
      high,
      low,
      close,
      volume,
      rawRow: row,
    });
  });
  return result;
}

function applyAdjustments(priceRows, dividendMap) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return { rows: [], adjustments: [] };
  }
  const sorted = [...priceRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const adjusted = new Array(sorted.length);
  let cumulativeFactor = 1;
  const adjustments = [];

  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const current = sorted[i];
    const nextDate = i < sorted.length - 1 ? sorted[i + 1].date : null;
    if (nextDate && dividendMap.has(nextDate)) {
      const events = dividendMap.get(nextDate);
      let singleFactor = 1;
      events.forEach((event) => {
        let eventFactor = 1;
        const prevClose = Number.isFinite(current.close) ? current.close : null;
        if (event.cashDividend > 0 && Number.isFinite(prevClose) && prevClose > 0) {
          let referencePrice = event.referencePrice;
          if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
            referencePrice = prevClose - event.cashDividend;
          }
          if (Number.isFinite(referencePrice) && referencePrice > 0) {
            const cashFactor = referencePrice / prevClose;
            if (Number.isFinite(cashFactor) && cashFactor > 0) {
              eventFactor *= cashFactor;
            }
          }
        }
        if (event.stockDividend > 0) {
          const stockFactor = 1 / (1 + event.stockDividend / 10);
          if (Number.isFinite(stockFactor) && stockFactor > 0) {
            eventFactor *= stockFactor;
          }
        }
        if (Number.isFinite(eventFactor) && eventFactor > 0) {
          singleFactor *= eventFactor;
        }
      });
      if (Number.isFinite(singleFactor) && singleFactor > 0) {
        const normalizedFactor = singleFactor > 1 ? 1 : singleFactor;
        if (normalizedFactor > 0 && normalizedFactor < 1) {
          cumulativeFactor *= normalizedFactor;
          adjustments.push({
            date: nextDate,
            factor: safeRound(normalizedFactor),
            events: events.length,
          });
        }
      }
    }

    const adjustedOpen = applyFactor(current.open, cumulativeFactor);
    const adjustedHigh = applyFactor(current.high, cumulativeFactor);
    const adjustedLow = applyFactor(current.low, cumulativeFactor);
    const adjustedClose = applyFactor(current.close, cumulativeFactor);

    adjusted[i] = {
      ...current,
      open: adjustedOpen,
      high: adjustedHigh,
      low: adjustedLow,
      close: adjustedClose,
      factor: cumulativeFactor,
    };
  }

  let previousClose = null;
  for (let i = 0; i < adjusted.length; i += 1) {
    const row = adjusted[i];
    if (Number.isFinite(row.close)) {
      row.change = Number.isFinite(previousClose)
        ? safeRound(row.close - previousClose)
        : 0;
      previousClose = row.close;
    } else {
      row.change = 0;
    }
  }

  return { rows: adjusted, adjustments };
}

function buildAdjustedAaData(adjustedRows) {
  return adjustedRows.map((row) => {
    const baseRow = Array.isArray(row.rawRow) ? [...row.rawRow] : [];
    if (baseRow.length >= 7) {
      baseRow[3] = formatPrice(row.open);
      baseRow[4] = formatPrice(row.high);
      baseRow[5] = formatPrice(row.low);
      baseRow[6] = formatPrice(row.close);
      if (baseRow.length > 7) {
        baseRow[7] = formatChange(row.change);
      }
    }
    return baseRow;
  });
}

function buildDividendSegments(startISO, endISO) {
  const startDate = isoToUTCDate(startISO);
  const endDate = isoToUTCDate(endISO);
  if (!startDate || !endDate || endDate < startDate) {
    return [
      {
        start: startISO,
        end: endISO,
      },
    ];
  }

  const segments = [];
  let cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    const segStart = new Date(cursor.getTime());
    const segEnd = new Date(cursor.getTime());
    segEnd.setUTCFullYear(segEnd.getUTCFullYear() + FINMIND_SEGMENT_YEARS);
    segEnd.setUTCDate(segEnd.getUTCDate() - 1);
    if (segEnd > endDate) {
      segEnd.setTime(endDate.getTime());
    }

    const startLabel = utcDateToISO(segStart) || startISO;
    const endLabel = utcDateToISO(segEnd) || endISO;
    segments.push({ start: startLabel, end: endLabel });

    segEnd.setUTCDate(segEnd.getUTCDate() + 1);
    cursor = new Date(segEnd.getTime());
  }

  return segments;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FINMIND_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('FinMind Dividend 來源逾時，請稍後再試');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDividendSeries(stockNo, startISO, endISO) {
  const normalizedStart = toISODate(startISO) || '1980-01-01';
  const normalizedEnd = toISODate(endISO) || normalizedStart;
  const segments = buildDividendSegments(normalizedStart, normalizedEnd);
  logDebug('fetchDividendSeries.start', {
    stockNo,
    startISO: normalizedStart,
    endISO: normalizedEnd,
    segments: segments.length,
  });
  const token = process.env.FINMIND_TOKEN;
  const aggregated = [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const url = new URL('https://api.finmindtrade.com/api/v4/data');
    url.searchParams.set('dataset', 'TaiwanStockDividend');
    url.searchParams.set('data_id', stockNo);
    url.searchParams.set('start_date', segment.start);
    url.searchParams.set('end_date', segment.end);
    if (token) {
      url.searchParams.set('token', token);
    }
    logDebug('fetchDividendSegment.request', {
      stockNo,
      segmentIndex: i + 1,
      segments: segments.length,
      start: segment.start,
      end: segment.end,
    });
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `FinMind Dividend HTTP ${response.status}: ${body?.slice(0, 200)}`,
      );
      logDebug('fetchDividendSeries.error', { stockNo, error: error.message });
      throw error;
    }
    const json = await response.json();
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const error = new Error(`FinMind Dividend 回應錯誤: ${json?.msg || 'unknown error'}`);
      logDebug('fetchDividendSeries.error', { stockNo, error: error.message });
      throw error;
    }
    aggregated.push(...json.data);
  }

  logDebug('fetchDividendSeries.success', {
    stockNo,
    startISO: normalizedStart,
    endISO: normalizedEnd,
    segments: segments.length,
    records: aggregated.length,
  });
  return aggregated;
}

async function fetchRawSeries(stockNo, startISO, endISO, market) {
  logDebug('fetchRawSeries.start', { stockNo, startISO, endISO, market });
  const params = new URLSearchParams({ stockNo, start: startISO, end: endISO });
  const path = market === 'tpex' ? 'tpex-proxy' : 'twse-proxy';
  const handler = market === 'tpex' ? tpexProxy : twseProxy;
  const url = `https://internal/${path}?${params.toString()}`;
  const response = await handler(createProxyRequest(url));
  if (!response || typeof response.json !== 'function') {
    throw new Error('無法呼叫原始資料服務');
  }
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`原始資料服務錯誤 ${response.status}: ${text?.slice(0, 200)}`);
    logDebug('fetchRawSeries.error', { stockNo, market, error: error.message });
    throw error;
  }
  const json = await response.json();
  if (json?.error) {
    const error = new Error(json.error);
    logDebug('fetchRawSeries.error', { stockNo, market, error: error.message });
    throw error;
  }
  const records = Array.isArray(json?.aaData) ? json.aaData.length : 0;
  logDebug('fetchRawSeries.success', { stockNo, market, records });
  return json;
}

export const handler = async (event) => {
  try {
    const params = event?.queryStringParameters || {};
    const stockNo = params.stockNo?.trim();
    const marketType = (params.marketType || params.market || 'twse').toLowerCase();
    const startISO = toISODate(params.startDate || params.start);
    const endISO = toISODate(params.endDate || params.end);

    logDebug('handler.start', {
      stockNo,
      marketType,
      startISO,
      endISO,
    });

    if (!stockNo) {
      return jsonResponse(400, { error: '缺少股票代碼' });
    }
    if (!startISO || !endISO) {
      return jsonResponse(400, { error: '日期格式無效' });
    }
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return jsonResponse(400, { error: '日期範圍不正確' });
    }

    const normalizedMarket = marketType === 'tpex' ? 'tpex' : 'twse';

    const [rawPayload, dividendRecords] = await Promise.all([
      fetchRawSeries(stockNo, startISO, endISO, normalizedMarket),
      fetchDividendSeries(stockNo, startISO, endISO),
    ]);

    logDebug('handler.payload.ready', {
      stockNo,
      rawRecords: Array.isArray(rawPayload?.aaData)
        ? rawPayload.aaData.length
        : Array.isArray(rawPayload?.data)
          ? rawPayload.data.length
          : 0,
      dividendRecords: dividendRecords.length,
    });

    const priceRows = normalisePriceRows(rawPayload?.aaData || rawPayload?.data);
    const dividendMap = buildDividendMap(dividendRecords);
    const { rows: adjustedRows, adjustments } = applyAdjustments(priceRows, dividendMap);
    const aaData = buildAdjustedAaData(adjustedRows);

    logDebug('handler.adjustments.complete', {
      stockNo,
      adjustedRows: adjustedRows.length,
      adjustments: adjustments.length,
    });

    const responseBody = {
      version: FUNCTION_VERSION,
      stockNo,
      market: normalizedMarket.toUpperCase(),
      stockName: rawPayload?.stockName || stockNo,
      iTotalRecords: aaData.length,
      aaData,
      dataSource: `${normalizedMarket.toUpperCase()} + FinMind (Adjusted)`,
      adjustments,
    };

    return jsonResponse(200, responseBody);
  } catch (error) {
    console.error(`${DEBUG_NAMESPACE} 執行錯誤:`, error);
    return jsonResponse(500, {
      error: error?.message || 'adjusted-price-proxy failed',
      version: FUNCTION_VERSION,
    });
  }
};

export default handler;
