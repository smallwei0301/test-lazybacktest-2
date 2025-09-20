// netlify/functions/adjusted-price-proxy.js (v1.4 - Adjusted price fallback orchestrator)
// Patch Tag: LB-ADJ-ENDPOINT-20241102A
import fetch from 'node-fetch';
import twseProxy from './twse-proxy.js';
import tpexProxy from './tpex-proxy.js';

const FUNCTION_VERSION = 'LB-ADJ-ENDPOINT-20241102A';
const DEBUG_NAMESPACE = '[AdjustedPriceProxy v1.4]';
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

function normaliseStockRatio(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 10) {
    return value / 10;
  }
  return value;
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

function aggregateDividendEvents(dividendMap) {
  const events = [];
  if (!dividendMap || typeof dividendMap.forEach !== 'function') {
    return events;
  }

  dividendMap.forEach((records, date) => {
    if (!Array.isArray(records) || records.length === 0) {
      return;
    }
    let cash = 0;
    let stock = 0;
    let referencePrice = null;
    records.forEach((record) => {
      const cashDividend = Number.isFinite(record?.cashDividend)
        ? Math.max(0, record.cashDividend)
        : 0;
      const stockDividend = Number.isFinite(record?.stockDividend)
        ? Math.max(0, record.stockDividend)
        : 0;
      cash += cashDividend;
      stock += stockDividend;
      if (!Number.isFinite(referencePrice) && Number.isFinite(record?.referencePrice)) {
        if (record.referencePrice > 0) {
          referencePrice = record.referencePrice;
        }
      }
    });
    if (cash > 0 || stock > 0) {
      events.push({
        date,
        cashDividend: cash,
        stockDividend: stock,
        referencePrice: Number.isFinite(referencePrice) ? referencePrice : null,
      });
    }
  });

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

function computeEventFactor(previousRow, exRow, event) {
  if (!previousRow || !event) {
    return {
      factor: 1,
      previousClose: null,
      referencePrice: null,
      cashFactor: 1,
      stockFactor: 1,
      stockRatio: 0,
    };
  }

  const previousCloseCandidate = Number.isFinite(previousRow?.close)
    ? previousRow.close
    : Number.isFinite(previousRow?.open)
      ? previousRow.open
      : null;
  const previousClose = Number.isFinite(previousCloseCandidate) && previousCloseCandidate > 0
    ? previousCloseCandidate
    : null;
  if (!Number.isFinite(previousClose) || previousClose <= 0) {
    return {
      factor: 1,
      previousClose: null,
      referencePrice: null,
      cashFactor: 1,
      stockFactor: 1,
      stockRatio: 0,
    };
  }

  const candidateReference = Number.isFinite(event?.referencePrice) && event.referencePrice > 0
    ? event.referencePrice
    : null;
  const exOpen = Number.isFinite(exRow?.open) && exRow.open > 0 ? exRow.open : null;
  const exClose = Number.isFinite(exRow?.close) && exRow.close > 0 ? exRow.close : null;
  let referencePrice = Number.isFinite(candidateReference) && candidateReference > 0
    ? candidateReference
    : exOpen || exClose || null;

  const cashDividend = Number.isFinite(event?.cashDividend) && event.cashDividend > 0
    ? event.cashDividend
    : 0;
  const stockRatio = normaliseStockRatio(event?.stockDividend || 0);

  if ((!Number.isFinite(referencePrice) || referencePrice <= 0) && cashDividend > 0) {
    referencePrice = previousClose - cashDividend;
  }

  if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
    referencePrice = previousClose;
  }

  let cashFactor = 1;
  if (Number.isFinite(referencePrice) && referencePrice > 0 && Number.isFinite(previousClose)) {
    cashFactor = referencePrice / previousClose;
  }

  let stockFactor = 1;
  if (stockRatio > 0) {
    const denominator = 1 + stockRatio;
    if (Number.isFinite(denominator) && denominator > 0) {
      stockFactor = 1 / denominator;
    }
  }

  const factor = cashFactor * stockFactor;
  if (!Number.isFinite(factor) || factor <= 0) {
    return {
      factor: 1,
      previousClose,
      referencePrice,
      cashFactor: 1,
      stockFactor: 1,
      stockRatio,
    };
  }

  const delta = Math.abs(1 - factor);
  if (delta < 0.00001) {
    return {
      factor: 1,
      previousClose,
      referencePrice,
      cashFactor,
      stockFactor,
      stockRatio,
    };
  }

  return {
    factor,
    previousClose,
    referencePrice,
    cashFactor,
    stockFactor,
    stockRatio,
  };
}

function applyAdjustments(priceRows, dividendMap) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return { rows: [], adjustments: [] };
  }

  const sorted = [...priceRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const multipliers = new Array(sorted.length).fill(1);
  const adjustments = [];
  const events = aggregateDividendEvents(dividendMap);

  events.forEach((event) => {
    const exIndex = sorted.findIndex((row) => row.date >= event.date);
    if (exIndex <= 0) {
      return;
    }
    const baseRow = sorted[exIndex];
    const previousRow = sorted[exIndex - 1];

    const factorInfo = computeEventFactor(previousRow, baseRow, event);
    if (!Number.isFinite(factorInfo.factor) || factorInfo.factor <= 0 || factorInfo.factor === 1) {
      return;
    }

    for (let i = 0; i < exIndex; i += 1) {
      multipliers[i] *= factorInfo.factor;
    }

    adjustments.push({
      date: event.date,
      factor: safeRound(factorInfo.factor),
      cashDividend: safeRound(event.cashDividend),
      stockDividend: safeRound(event.stockDividend),
      referencePrice: safeRound(factorInfo.referencePrice),
      previousClose: safeRound(factorInfo.previousClose),
      cashFactor: safeRound(factorInfo.cashFactor),
      stockFactor: safeRound(factorInfo.stockFactor),
      stockRatio: safeRound(factorInfo.stockRatio),
    });
  });

  const adjusted = sorted.map((row, index) => {
    const factor = multipliers[index];
    const effectiveFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const adjustedOpen = applyFactor(row.open, effectiveFactor);
    const adjustedHigh = applyFactor(row.high, effectiveFactor);
    const adjustedLow = applyFactor(row.low, effectiveFactor);
    const adjustedClose = applyFactor(row.close, effectiveFactor);

    return {
      ...row,
      open: adjustedOpen,
      high: adjustedHigh,
      low: adjustedLow,
      close: adjustedClose,
      factor: effectiveFactor,
    };
  });

  let previousClose = null;
  adjusted.forEach((row) => {
    if (Number.isFinite(row.close)) {
      row.change = Number.isFinite(previousClose)
        ? safeRound(row.close - previousClose)
        : 0;
      previousClose = row.close;
    } else {
      row.change = 0;
    }
  });

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
