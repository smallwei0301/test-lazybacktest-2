// netlify/functions/calculateAdjustedPrice.js (v12.2 - TWSE/FinMind dividend composer)
// Patch Tag: LB-ADJ-COMPOSER-20240525A
// Patch Tag: LB-ADJ-COMPOSER-20241020A
// Patch Tag: LB-ADJ-COMPOSER-20241022A
// Patch Tag: LB-ADJ-COMPOSER-20241024A
import fetch from 'node-fetch';

const FUNCTION_VERSION = 'LB-ADJ-COMPOSER-20241024A';

const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_MAX_SPAN_DAYS = 120;
const FINMIND_DIVIDEND_SPAN_DAYS = 365;
const FINMIND_RETRY_ATTEMPTS = 3;
const FINMIND_RETRY_BASE_DELAY_MS = 350;
const FINMIND_SEGMENT_COOLDOWN_MS = 160;

function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function delay(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatISODateFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

function enumerateDateSpans(startDate, endDate, maxSpanDays) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return [];
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return [];
  if (startDate > endDate) return [];
  const spanDays = Math.max(1, Math.floor(maxSpanDays));
  const spans = [];
  const cursor = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  ));
  const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  while (cursor <= last) {
    const spanStart = new Date(cursor.getTime());
    const spanEnd = new Date(cursor.getTime());
    spanEnd.setUTCDate(spanEnd.getUTCDate() + spanDays - 1);
    if (spanEnd > last) {
      spanEnd.setTime(last.getTime());
    }
    spans.push({
      startISO: formatISODateFromDate(spanStart),
      endISO: formatISODateFromDate(spanEnd),
    });
    cursor.setTime(spanEnd.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return spans;
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
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeRound(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Math.round(value * 10000) / 10000);
}

function enumerateMonths(startDate, endDate) {
  const months = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  while (cursor <= last) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    months.push({
      label: `${year}-${pad2(month)}`,
      query: `${year}${pad2(month)}`,
      roc: `${year - 1911}/${pad2(month)}`,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function normaliseDividendRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dateCandidate =
    raw.cash_dividend_ex_date ||
    raw.stock_dividend_ex_date ||
    raw.ex_dividend_date ||
    raw.ex_rights_date ||
    raw.date;
  const isoDate = toISODate(dateCandidate);
  if (!isoDate) return null;

  const cashDividend = Math.max(0, parseNumber(raw.cash_dividend) ?? 0);
  const stockDividend = Math.max(0, parseNumber(raw.stock_dividend) ?? 0);
  const cashCapitalIncrease = Math.max(0, parseNumber(raw.cash_capital_increase) ?? 0);
  const stockCapitalIncrease = Math.max(0, parseNumber(raw.stock_capital_increase) ?? 0);
  const subscriptionPrice = Math.max(0, parseNumber(raw.cash_capital_increase_subscription_price) ?? 0);

  if (
    cashDividend === 0 &&
    stockDividend === 0 &&
    cashCapitalIncrease === 0 &&
    stockCapitalIncrease === 0
  ) {
    return null;
  }

  return {
    date: isoDate,
    cashDividend,
    stockDividend,
    cashCapitalIncrease,
    stockCapitalIncrease,
    subscriptionPrice,
    raw,
  };
}

function computeAdjustmentRatio(baseClose, record) {
  if (!Number.isFinite(baseClose) || baseClose <= 0) return 1;
  const cashComponent = Math.max(0, record.cashDividend || 0);
  const stockComponent = Math.max(0, (record.stockDividend || 0) + (record.stockCapitalIncrease || 0));

  let ratio = 1;
  const denominator = baseClose * (1 + stockComponent) + cashComponent;
  if (Number.isFinite(denominator) && denominator > 0) {
    ratio = baseClose / denominator;
  }

  if (record.cashCapitalIncrease && record.subscriptionPrice) {
    const rightsRatio = record.cashCapitalIncrease;
    const subscriptionPrice = record.subscriptionPrice;
    const theoreticalDenominator = baseClose * (1 + rightsRatio) - rightsRatio * subscriptionPrice;
    if (Number.isFinite(theoreticalDenominator) && theoreticalDenominator > 0) {
      const rightsFactor = baseClose / theoreticalDenominator;
      if (Number.isFinite(rightsFactor) && rightsFactor > 0) {
        ratio *= rightsFactor;
      }
    }
  }

  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
    return 1;
  }
  return ratio;
}

function applyBackwardAdjustments(priceRows, dividendRecords) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return { rows: [], adjustments: [] };
  }

  const sortedRows = [...priceRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const multipliers = new Array(sortedRows.length).fill(1);
  const adjustments = [];

  const events = (dividendRecords || [])
    .map((record) => normaliseDividendRecord(record))
    .filter(Boolean)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const event of events) {
    const exIndex = sortedRows.findIndex((row) => row.date >= event.date);
    if (exIndex <= 0) {
      continue;
    }
    const baseClose = sortedRows[exIndex]?.close;
    if (!Number.isFinite(baseClose) || baseClose <= 0) {
      continue;
    }
    const ratio = computeAdjustmentRatio(baseClose, event);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
      adjustments.push({ ...event, ratio: 1, skipped: true });
      continue;
    }
    for (let i = 0; i < exIndex; i += 1) {
      multipliers[i] *= ratio;
    }
    adjustments.push({ ...event, ratio });
  }

  const adjustedRows = sortedRows.map((row, index) => {
    const factor = multipliers[index];
    const finalFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const open = row.open !== null ? safeRound(row.open * finalFactor) : null;
    const high = row.high !== null ? safeRound(row.high * finalFactor) : null;
    const low = row.low !== null ? safeRound(row.low * finalFactor) : null;
    const close = row.close !== null ? safeRound(row.close * finalFactor) : null;
    const change = 0;
    return {
      ...row,
      open,
      high,
      low,
      close,
      change,
      adjustedFactor: finalFactor,
    };
  });

  for (let i = 0; i < adjustedRows.length; i += 1) {
    const current = adjustedRows[i];
    if (!Number.isFinite(current.close)) {
      current.change = 0;
      continue;
    }
    const prevClose = i > 0 ? adjustedRows[i - 1].close : null;
    if (!Number.isFinite(prevClose)) {
      current.change = 0;
    } else {
      current.change = safeRound(current.close - prevClose) ?? 0;
    }
  }

  return { rows: adjustedRows, adjustments };
}

async function fetchTwseMonth(stockNo, monthQuery) {
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${monthQuery}01&stockNo=${stockNo}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) {
    throw new Error(`TWSE HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json?.stat !== 'OK' || !Array.isArray(json?.data)) {
    throw new Error(`TWSE 回應異常: ${json?.stat || 'Unknown error'}`);
  }
  const stockName = json?.title?.split(' ')?.[2] || stockNo;
  const rows = [];
  for (const rawRow of json.data) {
    const isoDate = rocToISO(rawRow?.[0]);
    if (!isoDate) continue;
    rows.push({
      date: isoDate,
      open: parseNumber(rawRow?.[3]),
      high: parseNumber(rawRow?.[4]),
      low: parseNumber(rawRow?.[5]),
      close: parseNumber(rawRow?.[6]),
      change: parseNumber(rawRow?.[8]) ?? 0,
      volume: parseNumber(rawRow?.[1]) ?? 0,
      stockName,
    });
  }
  return { stockName, rows };
}

async function fetchTwseRange(stockNo, startDate, endDate) {
  const months = enumerateMonths(startDate, endDate);
  const combined = [];
  const monthQueue = [...months];
  const chunkSize = 5;
  let stockName = stockNo;

  while (monthQueue.length > 0) {
    const chunk = monthQueue.splice(0, chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (month) => {
        try {
          return await fetchTwseMonth(stockNo, month.query);
        } catch (error) {
          const enriched = new Error(
            `[TWSE 月資料失敗] ${stockNo} ${month.label}: ${error.message || error}`,
          );
          enriched.original = error;
          throw enriched;
        }
      }),
    );

    for (const monthResult of chunkResults) {
      if (monthResult?.stockName) {
        stockName = monthResult.stockName;
      }
      const monthRows = Array.isArray(monthResult?.rows) ? monthResult.rows : [];
      for (const row of monthRows) {
        const date = new Date(row.date);
        if (Number.isNaN(date.getTime())) continue;
        if (date < startDate || date > endDate) continue;
        combined.push({ ...row, stockName });
      }
    }
  }

  combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { stockName, rows: combined, priceSource: 'TWSE (原始)' };
}

async function executeFinMindQuery(params, options = {}) {
  const attempts = Math.max(1, Number(options.attempts ?? FINMIND_RETRY_ATTEMPTS));
  const baseDelay = Math.max(0, Number(options.baseDelayMs ?? FINMIND_RETRY_BASE_DELAY_MS));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const url = new URL(FINMIND_BASE_URL);
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
      const response = await fetch(url.toString());
      if (!response.ok) {
        const error = new Error(`FinMind HTTP ${response.status}`);
        error.statusCode = response.status;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
      const waitMs = Math.min(1800, baseDelay * (attempt + 1) + Math.random() * 400);
      await delay(waitMs);
    }
  }
  throw lastError || new Error('FinMind 查詢失敗');
}

async function fetchFinMindPrice(stockNo, startISO, endISO, { label } = {}) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  const spans = enumerateDateSpans(startDate, endDate, FINMIND_MAX_SPAN_DAYS);
  if (spans.length === 0) {
    return { stockName: stockNo, rows: [], priceSource: label || 'FinMind (原始)' };
  }
  const rowsMap = new Map();
  let stockName = stockNo;
  for (const [index, span] of spans.entries()) {
    const urlParams = {
      dataset: 'TaiwanStockPrice',
      data_id: stockNo,
      start_date: span.startISO,
      end_date: span.endISO,
      token,
    };
    let json;
    try {
      json = await executeFinMindQuery(urlParams);
    } catch (error) {
      const enriched = new Error(
        `[FinMind 價格段錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
      );
      enriched.original = error;
      throw enriched;
    }
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      throw new Error(`FinMind 回應錯誤: ${json?.msg || 'unknown error'}`);
    }
    for (const item of json.data) {
      const isoDate = toISODate(item.date);
      if (!isoDate) continue;
      if (item.stock_name && stockName === stockNo) {
        stockName = item.stock_name;
      }
      rowsMap.set(isoDate, {
        date: isoDate,
        open: parseNumber(item.open ?? item.Open ?? item.Opening),
        high: parseNumber(item.max ?? item.high ?? item.High),
        low: parseNumber(item.min ?? item.low ?? item.Low),
        close: parseNumber(item.close ?? item.Close),
        change: parseNumber(item.spread ?? item.change ?? item.Change) ?? 0,
        volume: parseNumber(item.Trading_Volume ?? item.volume ?? item.Volume) ?? 0,
      });
    }
    if (spans.length > 1 && index < spans.length - 1) {
      await delay(FINMIND_SEGMENT_COOLDOWN_MS);
    }
  }
  const finalStockName = stockName || stockNo;
  const rows = Array.from(rowsMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((row) => ({ ...row, stockName: finalStockName }));
  const priceSource = label || 'FinMind (原始)';
  return { stockName: finalStockName, rows, priceSource };
}

async function fetchDividendSeries(stockNo, startISO, endISO) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  const spans = enumerateDateSpans(startDate, endDate, FINMIND_DIVIDEND_SPAN_DAYS);
  if (spans.length === 0) {
    return [];
  }
  const combined = [];
  for (const [index, span] of spans.entries()) {
    const urlParams = {
      dataset: 'TaiwanStockDividend',
      data_id: stockNo,
      start_date: span.startISO,
      end_date: span.endISO,
      token,
    };
    let json;
    try {
      json = await executeFinMindQuery(urlParams);
    } catch (error) {
      const enriched = new Error(
        `[FinMind 股利段錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
      );
      enriched.original = error;
      throw enriched;
    }
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      throw new Error(`FinMind Dividend 回應錯誤: ${json?.msg || 'unknown error'}`);
    }
    combined.push(...json.data);
    if (spans.length > 1 && index < spans.length - 1) {
      await delay(FINMIND_SEGMENT_COOLDOWN_MS);
    }
  }
  return combined;
}

function buildSummary(priceData, adjustments, market, priceSourceLabel, dividendCount) {
  const basePriceSource =
    priceSourceLabel || priceData.priceSource || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)');
  const uniqueSources = new Set([basePriceSource, 'FinMind (除權息)']);
  return {
    priceRows: Array.isArray(priceData.rows) ? priceData.rows.length : 0,
    dividendRows: Number.isFinite(dividendCount) ? dividendCount : undefined,
    adjustmentEvents: adjustments.filter((event) => !event.skipped).length,
    skippedEvents: adjustments.filter((event) => event.skipped).length,
    priceSource: basePriceSource,
    dividendSource: 'FinMind (TaiwanStockDividend)',
    sources: Array.from(uniqueSources),
  };
}

export const handler = async (event) => {
  try {
    const params = event?.queryStringParameters || {};
    const stockNo = params.stockNo?.trim();
    const startISO = toISODate(params.startDate || params.start);
    const endISO = toISODate(params.endDate || params.end);
    const marketParam = params.market || params.marketType || 'TWSE';
    const market = marketParam.toUpperCase() === 'TPEX' ? 'TPEX' : 'TWSE';

    if (!stockNo) {
      return jsonResponse(400, { error: '缺少股票代號' });
    }
    if (!startISO || !endISO) {
      return jsonResponse(400, { error: '日期格式無效' });
    }
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return jsonResponse(400, { error: '日期範圍不正確' });
    }

    let priceData;
    let priceSourceLabel = '';
    if (market === 'TPEX') {
      priceData = await fetchFinMindPrice(stockNo, startISO, endISO);
      priceSourceLabel = priceData.priceSource;
    } else {
      try {
        priceData = await fetchTwseRange(stockNo, startDate, endDate);
        priceSourceLabel = priceData.priceSource;
      } catch (primaryError) {
        console.warn(
          '[calculateAdjustedPrice] TWSE 原始資料取得失敗，改用 FinMind 備援來源。',
          primaryError,
        );
        const fallback = await fetchFinMindPrice(stockNo, startISO, endISO, {
          label: 'FinMind (原始備援)',
        });
        priceData = fallback;
        priceSourceLabel = fallback.priceSource;
      }
    }

    const dividendSeries = await fetchDividendSeries(stockNo, startISO, endISO);

    const { rows: adjustedRows, adjustments } = applyBackwardAdjustments(
      priceData.rows,
      dividendSeries,
    );

    const combinedSourceLabel = `${
      priceSourceLabel || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)')
    } + FinMind (除權息還原)`;

    const responseBody = {
      version: FUNCTION_VERSION,
      stockNo,
      market,
      stockName: priceData.stockName || stockNo,
      dataSource: combinedSourceLabel,
      priceSource: priceSourceLabel,
      summary: buildSummary(
        priceData,
        adjustments,
        market,
        priceSourceLabel,
        Array.isArray(dividendSeries) ? dividendSeries.length : undefined,
      ),
      data: adjustedRows,
      adjustments,
    };

    return jsonResponse(200, responseBody);
  } catch (error) {
    console.error('[calculateAdjustedPrice] 執行錯誤:', error);
    const statusCode = error?.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500;
    return jsonResponse(statusCode, {
      error: error?.message || 'calculateAdjustedPrice failed',
      version: FUNCTION_VERSION,
    });
  }
};

export default handler;
