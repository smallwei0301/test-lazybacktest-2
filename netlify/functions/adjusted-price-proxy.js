// netlify/functions/adjusted-price-proxy.js (v1.0 - Unified adjusted price orchestrator)
// Patch Tag: LB-ADJ-ENDPOINT-20241013A
import fetch from 'node-fetch';
import twseProxy from './twse-proxy.js';
import tpexProxy from './tpex-proxy.js';

const FUNCTION_VERSION = 'LB-ADJ-ENDPOINT-20241013A';

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

async function fetchDividendSeries(stockNo, endISO) {
  const url = new URL('https://api.finmindtrade.com/api/v4/data');
  url.searchParams.set('dataset', 'TaiwanStockDividend');
  url.searchParams.set('data_id', stockNo);
  url.searchParams.set('start_date', '1980-01-01');
  url.searchParams.set('end_date', endISO);
  const token = process.env.FINMIND_TOKEN;
  if (token) {
    url.searchParams.set('token', token);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`FinMind Dividend HTTP ${response.status}: ${body?.slice(0, 200)}`);
  }
  const json = await response.json();
  if (json?.status !== 200 || !Array.isArray(json?.data)) {
    throw new Error(`FinMind Dividend 回應錯誤: ${json?.msg || 'unknown error'}`);
  }
  return json.data;
}

async function fetchRawSeries(stockNo, startISO, endISO, market) {
  const params = new URLSearchParams({ stockNo, start: startISO, end: endISO });
  const path = market === 'tpex' ? 'tpex-proxy' : 'twse-proxy';
  const handler = market === 'tpex' ? tpexProxy : twseProxy;
  const url = `https://internal/${path}?${params.toString()}`;
  const response = await handler({ url });
  if (!response || typeof response.json !== 'function') {
    throw new Error('無法呼叫原始資料服務');
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`原始資料服務錯誤 ${response.status}: ${text?.slice(0, 200)}`);
  }
  const json = await response.json();
  if (json?.error) {
    throw new Error(json.error);
  }
  return json;
}

export const handler = async (event) => {
  try {
    const params = event?.queryStringParameters || {};
    const stockNo = params.stockNo?.trim();
    const marketType = (params.marketType || params.market || 'twse').toLowerCase();
    const startISO = toISODate(params.startDate || params.start);
    const endISO = toISODate(params.endDate || params.end);

    if (!stockNo) {
      return new Response(JSON.stringify({ error: '缺少股票代碼' }), { status: 400 });
    }
    if (!startISO || !endISO) {
      return new Response(JSON.stringify({ error: '日期格式無效' }), { status: 400 });
    }
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return new Response(JSON.stringify({ error: '日期範圍不正確' }), { status: 400 });
    }

    const normalizedMarket = marketType === 'tpex' ? 'tpex' : 'twse';

    const [rawPayload, dividendRecords] = await Promise.all([
      fetchRawSeries(stockNo, startISO, endISO, normalizedMarket),
      fetchDividendSeries(stockNo, endISO),
    ]);

    const priceRows = normalisePriceRows(rawPayload?.aaData || rawPayload?.data);
    const dividendMap = buildDividendMap(dividendRecords);
    const { rows: adjustedRows, adjustments } = applyAdjustments(priceRows, dividendMap);
    const aaData = buildAdjustedAaData(adjustedRows);

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

    return new Response(JSON.stringify(responseBody), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[adjusted-price-proxy] 執行錯誤:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'adjusted-price-proxy failed',
        version: FUNCTION_VERSION,
      }),
      { status: 500 },
    );
  }
};

export default handler;
