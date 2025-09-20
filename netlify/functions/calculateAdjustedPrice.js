// netlify/functions/calculateAdjustedPrice.js (v11.0 - TWSE/FinMind adjusted fallback)
// Patch Tag: LB-ADJ-COMPOSER-20240525A
import fetch from 'node-fetch';

const FUNCTION_VERSION = 'LB-ADJ-COMPOSER-20240525A';

function pad2(value) {
  return String(value).padStart(2, '0');
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
  let stockName = stockNo;
  for (const month of months) {
    const { stockName: monthName, rows } = await fetchTwseMonth(stockNo, month.query);
    if (monthName) stockName = monthName;
    for (const row of rows) {
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) continue;
      if (date < startDate || date > endDate) continue;
      combined.push({ ...row, stockName });
    }
  }
  combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { stockName, rows: combined };
}

async function fetchFinMindPrice(stockNo, startISO, endISO) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', 'TaiwanStockPrice');
  url.searchParams.set('data_id', stockNo);
  url.searchParams.set('start_date', startISO);
  url.searchParams.set('end_date', endISO);
  url.searchParams.set('token', token);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`FinMind HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json?.status !== 200 || !Array.isArray(json?.data)) {
    throw new Error(`FinMind 回應錯誤: ${json?.msg || 'unknown error'}`);
  }
  const rows = [];
  let stockName = stockNo;
  for (const item of json.data) {
    const isoDate = toISODate(item.date);
    if (!isoDate) continue;
    if (item.stock_name && stockName === stockNo) {
      stockName = item.stock_name;
    }
    rows.push({
      date: isoDate,
      open: parseNumber(item.open ?? item.Open ?? item.Opening),
      high: parseNumber(item.max ?? item.high ?? item.High),
      low: parseNumber(item.min ?? item.low ?? item.Low),
      close: parseNumber(item.close ?? item.Close),
      change: parseNumber(item.spread ?? item.change ?? item.Change) ?? 0,
      volume: parseNumber(item.Trading_Volume ?? item.volume ?? item.Volume) ?? 0,
      stockName,
    });
  }
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { stockName, rows };
}

async function fetchDividendSeries(stockNo, startISO, endISO) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', 'TaiwanStockDividend');
  url.searchParams.set('data_id', stockNo);
  url.searchParams.set('start_date', startISO);
  url.searchParams.set('end_date', endISO);
  url.searchParams.set('token', token);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`FinMind Dividend HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json?.status !== 200 || !Array.isArray(json?.data)) {
    throw new Error(`FinMind Dividend 回應錯誤: ${json?.msg || 'unknown error'}`);
  }
  return json.data;
}

function buildSummary(priceData, adjustments, market) {
  const uniqueSources = new Set([
    market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)',
    'FinMind (除權息)',
  ]);
  return {
    priceRows: priceData.rows.length,
    adjustmentEvents: adjustments.filter((event) => !event.skipped).length,
    skippedEvents: adjustments.filter((event) => event.skipped).length,
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
      return new Response(JSON.stringify({ error: '缺少股票代號' }), { status: 400 });
    }
    if (!startISO || !endISO) {
      return new Response(JSON.stringify({ error: '日期格式無效' }), { status: 400 });
    }
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return new Response(JSON.stringify({ error: '日期範圍不正確' }), { status: 400 });
    }

    const [priceData, dividendSeries] = await Promise.all([
      market === 'TPEX'
        ? fetchFinMindPrice(stockNo, startISO, endISO)
        : fetchTwseRange(stockNo, startDate, endDate),
      fetchDividendSeries(stockNo, startISO, endISO),
    ]);

    const { rows: adjustedRows, adjustments } = applyBackwardAdjustments(
      priceData.rows,
      dividendSeries,
    );

    const responseBody = {
      version: FUNCTION_VERSION,
      stockNo,
      market,
      stockName: priceData.stockName || stockNo,
      dataSource: 'TWSE + FinMind (向後還原)',
      summary: buildSummary(priceData, adjustments, market),
      data: adjustedRows,
      adjustments,
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[calculateAdjustedPrice] 執行錯誤:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'calculateAdjustedPrice failed',
        version: FUNCTION_VERSION,
      }),
      { status: 500 },
    );
  }
};

export default handler;
