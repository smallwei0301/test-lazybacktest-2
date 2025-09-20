// netlify/functions/calculateAdjustedPrice.js (v12.5 - TWSE/FinMind dividend composer)
// Patch Tag: LB-ADJ-COMPOSER-20240525A
// Patch Tag: LB-ADJ-COMPOSER-20241020A
// Patch Tag: LB-ADJ-COMPOSER-20241022A
// Patch Tag: LB-ADJ-COMPOSER-20241024A
// Patch Tag: LB-ADJ-COMPOSER-20241027A
// Patch Tag: LB-ADJ-COMPOSER-20241030A
// Patch Tag: LB-ADJ-COMPOSER-20241105A
// Patch Tag: LB-ADJ-COMPOSER-20241112A
// Patch Tag: LB-ADJ-COMPOSER-20241119A
import fetch from 'node-fetch';

const FUNCTION_VERSION = 'LB-ADJ-COMPOSER-20241119A';

const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_MAX_SPAN_DAYS = 120;
const FINMIND_MIN_PRICE_SPAN_DAYS = 30;
const FINMIND_DIVIDEND_SPAN_DAYS = 365;
const FINMIND_DIVIDEND_LOOKBACK_DAYS = 540;
const FINMIND_MIN_DIVIDEND_SPAN_DAYS = 120;
const FINMIND_RETRY_ATTEMPTS = 3;
const FINMIND_RETRY_BASE_DELAY_MS = 350;
const FINMIND_SEGMENT_COOLDOWN_MS = 160;
const FINMIND_SPLITTABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 520, 522, 524, 598]);

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

function countSpanDays(span) {
  if (!span?.startISO || !span?.endISO) return 0;
  const start = new Date(`${span.startISO}T00:00:00Z`);
  const end = new Date(`${span.endISO}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 0;
  }
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function splitSpan(span) {
  const totalDays = countSpanDays(span);
  if (totalDays <= 1) return null;
  const start = new Date(`${span.startISO}T00:00:00Z`);
  const midOffset = Math.floor(totalDays / 2);
  if (midOffset <= 0) return null;
  const firstEnd = new Date(start.getTime());
  firstEnd.setUTCDate(firstEnd.getUTCDate() + midOffset - 1);
  const secondStart = new Date(firstEnd.getTime());
  secondStart.setUTCDate(secondStart.getUTCDate() + 1);
  const end = new Date(`${span.endISO}T00:00:00Z`);
  if (secondStart > end) return null;
  return [
    {
      startISO: formatISODateFromDate(start),
      endISO: formatISODateFromDate(firstEnd),
    },
    {
      startISO: formatISODateFromDate(secondStart),
      endISO: formatISODateFromDate(end),
    },
  ];
}

function extractStatusCode(error) {
  if (!error) return undefined;
  const statusLike = error.statusCode ?? error.status ?? error.code;
  if (statusLike !== undefined && statusLike !== null) {
    const numeric = Number(statusLike);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  if (error.original) {
    const originalStatus = extractStatusCode(error.original);
    if (Number.isFinite(originalStatus)) {
      return originalStatus;
    }
  }
  return undefined;
}

function shouldSplitSpan(error, spanDays, minSpanDays) {
  if (!Number.isFinite(spanDays) || spanDays <= minSpanDays) return false;
  const statusCode = extractStatusCode(error);
  if (statusCode && FINMIND_SPLITTABLE_STATUS.has(statusCode)) {
    return true;
  }
  const message = String(error?.message || '').toLowerCase();
  if (!statusCode && message) {
    if (message.includes('timeout') || message.includes('timed out')) return true;
    if (message.includes('network') || message.includes('fetch failed')) return true;
    if (message.includes('socket hang up') || message.includes('aborted')) return true;
  }
  return false;
}

function toISODate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const [datePartRaw] = trimmed.replace('T', ' ').split(/\s+/);
  if (!datePartRaw) return null;
  const datePart = datePartRaw.replace(/\./g, '-');

  const exactIsoMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactIsoMatch) {
    const isoCandidate = new Date(`${exactIsoMatch[1]}-${exactIsoMatch[2]}-${exactIsoMatch[3]}`);
    return Number.isNaN(isoCandidate.getTime()) ? null : `${exactIsoMatch[1]}-${exactIsoMatch[2]}-${exactIsoMatch[3]}`;
  }

  const isoMatch = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!year || !month || !day) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('/').map((part) => Number(part));
    if (!y || !m || !d) return null;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  if (/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(datePart)) {
    const [rocYear, month, day] = datePart.split('/').map((part) => Number(part));
    if (!rocYear || !month || !day) return null;
    const year = rocYear + 1911;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  if (/^\d{8}$/.test(datePart)) {
    const year = Number(datePart.slice(0, 4));
    const month = Number(datePart.slice(4, 6));
    const day = Number(datePart.slice(6));
    if (!year || !month || !day) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const parsed = new Date(datePart);
  if (!Number.isNaN(parsed.getTime())) {
    return formatISODateFromDate(parsed);
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

function parseNumber(value, options = {}) {
  const { treatAsRatio = false } = options;
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const numeric = Number(value);
    if (treatAsRatio && numeric >= 10 && numeric <= 200) {
      const scaled = numeric / 100;
      return scaled > 0 ? scaled : numeric;
    }
    return numeric;
  }

  let text = String(value).trim();
  if (!text) return null;

  text = text.replace(/[＋﹢]/g, '+').replace(/[－﹣﹘]/g, '-');

  const colonMatch = text.match(/(-?[0-9,，]+(?:\.[0-9]+)?)\s*:\s*(-?[0-9,，]+(?:\.[0-9]+)?)/);
  if (colonMatch) {
    const [segment, leftRaw, rightRaw] = colonMatch;
    const left = Number(leftRaw.replace(/[,，]/g, ''));
    const right = Number(rightRaw.replace(/[,，]/g, ''));
    if (Number.isFinite(left) && Number.isFinite(right) && left !== 0) {
      let ratio = right / left;
      const percentInSegment = /[%％]/.test(segment);
      if (percentInSegment) {
        ratio /= 100;
      }
      if (treatAsRatio && ratio >= 10 && ratio <= 200 && !percentInSegment) {
        ratio /= 100;
      }
      return ratio;
    }
  }

  let match = text.match(/(-?(?:\d+[，,]?)*\d(?:\.\d+)?)\s*([%％]?)/);
  if (!match) {
    match = text.match(/(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    match[2] = '';
  }

  const numericPart = match[1] ? match[1].replace(/[,，]/g, '') : '';
  if (!numericPart) return null;

  let numeric = Number(numericPart);
  if (!Number.isFinite(numeric)) return null;

  const hasPercent = Boolean(match[2] && /[%％]/.test(match[2]));
  if (hasPercent) {
    numeric /= 100;
  }
  if (treatAsRatio && numeric >= 10 && numeric <= 200 && !hasPercent) {
    numeric /= 100;
  }
  return numeric;
}

function safeRound(value) {
  if (!Number.isFinite(value)) return null;
  return Number(Math.round(value * 10000) / 10000);
}

function readField(raw, key) {
  if (!raw || typeof raw !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(raw, key)) return raw[key];
  const camelKey = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
  if (Object.prototype.hasOwnProperty.call(raw, camelKey)) return raw[camelKey];
  const pascalKey = camelKey.charAt(0).toUpperCase() + camelKey.slice(1);
  if (Object.prototype.hasOwnProperty.call(raw, pascalKey)) return raw[pascalKey];
  const upperKey = key.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(raw, upperKey)) return raw[upperKey];
  return undefined;
}

function resolveDividendAmount(raw, primaryKey, partKeys = [], options = {}) {
  const parseOptions = options.treatAsRatio ? { treatAsRatio: true } : {};
  const primaryValue = parseNumber(readField(raw, primaryKey), parseOptions);
  if (Number.isFinite(primaryValue) && primaryValue > 0) {
    return primaryValue;
  }
  let total = 0;
  for (const partKey of partKeys) {
    const partValue = parseNumber(readField(raw, partKey), parseOptions);
    if (Number.isFinite(partValue) && partValue > 0) {
      total += partValue;
    }
  }
  return total > 0 ? total : 0;
}

function resolveSubscriptionPrice(raw) {
  const candidateKeys = [
    'cash_capital_increase_subscription_price',
    'cash_capital_increase_subscribe_price',
    'cash_capital_increase_subscription_price_per_share',
    'cash_capital_increase_subscription_price_cash',
    'subscription_price',
  ];
  let best = null;
  for (const key of candidateKeys) {
    const value = parseNumber(readField(raw, key));
    if (Number.isFinite(value) && value > 0) {
      if (!Number.isFinite(best) || value < best) {
        best = value;
      }
    }
  }
  return Number.isFinite(best) && best > 0 ? best : 0;
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

function resolveExDate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidateKeys = [
    'cash_dividend_ex_rights_trading_date',
    'cash_dividend_ex_dividend_trading_date',
    'cash_dividend_ex_dividend_date',
    'cash_dividend_ex_rights_date',
    'cash_dividend_trading_date',
    'cash_dividend_record_date',
    'stock_dividend_ex_rights_trading_date',
    'stock_dividend_ex_dividend_trading_date',
    'stock_dividend_ex_date',
    'stock_dividend_trading_date',
    'stock_dividend_record_date',
    'dividend_ex_rights_trading_date',
    'dividend_ex_dividend_trading_date',
    'dividend_ex_date',
    'ex_dividend_trading_date',
    'ex_dividend_record_date',
    'ex_rights_trading_date',
    'ex_rights_record_date',
    'ex_dividend_rights_trading_date',
    'ex_dividend_rights_record_date',
    'cash_dividend_ex_date',
    'stock_dividend_ex_date',
    'ex_dividend_date',
    'ex_rights_date',
    'ex_date',
    'date',
  ];
  for (const key of candidateKeys) {
    const candidate = readField(raw, key);
    const iso = toISODate(candidate);
    if (iso) {
      return { iso, sourceKey: key, rawValue: candidate };
    }
  }
  return null;
}

function normaliseDividendRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const exDateInfo = resolveExDate(raw);
  if (!exDateInfo?.iso) return null;

  const cashDividend = resolveDividendAmount(raw, 'cash_dividend', [
    'cash_dividend_from_earnings',
    'cash_dividend_from_retain_earnings',
    'cash_dividend_from_retained_earnings',
    'cash_dividend_from_capital_reserve',
    'cash_dividend_from_capital_surplus',
    'cash_dividend_from_capital',
    'cash_dividend_total',
    'cash_dividend_total_amount',
  ]);
  const stockDividend = resolveDividendAmount(
    raw,
    'stock_dividend',
    [
      'stock_dividend_from_earnings',
      'stock_dividend_from_retain_earnings',
      'stock_dividend_from_retained_earnings',
      'stock_dividend_from_capital_reserve',
      'stock_dividend_from_capital_surplus',
      'stock_dividend_from_capital',
      'stock_dividend_total',
      'stock_dividend_total_amount',
    ],
    { treatAsRatio: true },
  );
  const cashCapitalIncrease = resolveDividendAmount(
    raw,
    'cash_capital_increase',
    [
      'cash_capital_increase_ratio',
      'cash_capital_increase_total',
      'cash_capital_increase_total_ratio',
    ],
    { treatAsRatio: true },
  );
  const stockCapitalIncrease = resolveDividendAmount(
    raw,
    'stock_capital_increase',
    [
      'stock_capital_increase_ratio',
      'stock_capital_increase_total',
      'stock_capital_increase_total_ratio',
    ],
    { treatAsRatio: true },
  );
  const subscriptionPrice = resolveSubscriptionPrice(raw);

  if (
    cashDividend === 0 &&
    stockDividend === 0 &&
    cashCapitalIncrease === 0 &&
    stockCapitalIncrease === 0
  ) {
    return null;
  }

  return {
    date: exDateInfo.iso,
    cashDividend,
    stockDividend,
    cashCapitalIncrease,
    stockCapitalIncrease,
    subscriptionPrice,
    raw,
    dateSource: exDateInfo.sourceKey || null,
    dateValue: exDateInfo.rawValue ?? null,
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

function filterDividendRecordsByPriceRange(dividendRecords, rangeStartISO, rangeEndISO) {
  if (!Array.isArray(dividendRecords) || dividendRecords.length === 0) {
    return [];
  }
  const startISO = rangeStartISO ? toISODate(rangeStartISO) : null;
  const endISO = rangeEndISO ? toISODate(rangeEndISO) : null;
  return dividendRecords.filter((record) => {
    const exInfo = resolveExDate(record);
    if (!exInfo?.iso) {
      return false;
    }
    if (startISO && exInfo.iso < startISO) {
      return false;
    }
    if (endISO && exInfo.iso > endISO) {
      return false;
    }
    return true;
  });
}

function prepareDividendEvents(dividendRecords) {
  const eventMap = new Map();
  for (const rawRecord of dividendRecords || []) {
    const normalised = normaliseDividendRecord(rawRecord);
    if (!normalised) continue;
    const key = normalised.date;
    const signature = normalised.raw ? JSON.stringify(normalised.raw) : null;
    const existing = eventMap.get(key);
    if (existing) {
      if (signature && existing.signatures.has(signature)) {
        continue;
      }
      if (signature) existing.signatures.add(signature);
      existing.cashDividend += normalised.cashDividend;
      existing.stockDividend += normalised.stockDividend;
      existing.cashCapitalIncrease += normalised.cashCapitalIncrease;
      existing.stockCapitalIncrease += normalised.stockCapitalIncrease;
      if (normalised.dateSource) {
        if (!existing.dateSource) {
          existing.dateSource = normalised.dateSource;
          existing.dateValue = normalised.dateValue ?? existing.dateValue ?? null;
        }
        if (!Array.isArray(existing.dateSources)) {
          existing.dateSources = [];
        }
        const duplicateSource = existing.dateSources.find(
          (item) => item.key === normalised.dateSource && item.value === (normalised.dateValue ?? null),
        );
        if (!duplicateSource) {
          existing.dateSources.push({
            key: normalised.dateSource,
            value: normalised.dateValue ?? null,
          });
        }
      }
      if (
        Number.isFinite(normalised.subscriptionPrice) &&
        normalised.subscriptionPrice > 0 &&
        (!Number.isFinite(existing.subscriptionPrice) ||
          existing.subscriptionPrice <= 0 ||
          normalised.subscriptionPrice < existing.subscriptionPrice)
      ) {
        existing.subscriptionPrice = normalised.subscriptionPrice;
      }
      if (normalised.raw) {
        existing.rawRecords.push(normalised.raw);
      }
    } else {
      const payload = {
        date: normalised.date,
        cashDividend: normalised.cashDividend,
        stockDividend: normalised.stockDividend,
        cashCapitalIncrease: normalised.cashCapitalIncrease,
        stockCapitalIncrease: normalised.stockCapitalIncrease,
        subscriptionPrice: normalised.subscriptionPrice,
        rawRecords: normalised.raw ? [normalised.raw] : [],
        dateSource: normalised.dateSource || null,
        dateValue: normalised.dateValue ?? null,
        dateSources: normalised.dateSource
          ? [
              {
                key: normalised.dateSource,
                value: normalised.dateValue ?? null,
              },
            ]
          : [],
        signatures: new Set(),
      };
      if (signature) {
        payload.signatures.add(signature);
      }
      eventMap.set(key, payload);
    }
  }

  const events = Array.from(eventMap.values())
    .map((event) => {
      event.cashDividend = Math.max(0, safeRound(event.cashDividend) ?? 0);
      event.stockDividend = Math.max(0, safeRound(event.stockDividend) ?? 0);
      event.cashCapitalIncrease = Math.max(0, safeRound(event.cashCapitalIncrease) ?? 0);
      event.stockCapitalIncrease = Math.max(0, safeRound(event.stockCapitalIncrease) ?? 0);
      if (!Number.isFinite(event.subscriptionPrice) || event.subscriptionPrice <= 0) {
        event.subscriptionPrice = null;
      } else {
        event.subscriptionPrice = safeRound(event.subscriptionPrice) ?? event.subscriptionPrice;
      }
      event.raw = event.rawRecords.length > 0 ? event.rawRecords[0] : null;
      delete event.signatures;
      if (!event.dateSources || event.dateSources.length === 0) {
        delete event.dateSources;
      }
      return event;
    })
    .filter(
      (event) =>
        event.cashDividend > 0 ||
        event.stockDividend > 0 ||
        event.cashCapitalIncrease > 0 ||
        event.stockCapitalIncrease > 0,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return events;
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

  const events = prepareDividendEvents(dividendRecords);

  for (const event of events) {
    const exIndex = sortedRows.findIndex((row) => row.date >= event.date);
    if (exIndex === -1) {
      adjustments.push({ ...event, ratio: 1, skipped: true, reason: 'missingPriceRow' });
      continue;
    }
    let baseIndex = exIndex;
    let baseClose = null;
    while (baseIndex < sortedRows.length) {
      const candidate = sortedRows[baseIndex]?.close;
      if (Number.isFinite(candidate) && candidate > 0) {
        baseClose = candidate;
        break;
      }
      baseIndex += 1;
    }
    if (!Number.isFinite(baseClose) || baseIndex <= 0) {
      adjustments.push({ ...event, ratio: 1, skipped: true, reason: 'invalidBaseClose' });
      continue;
    }
    const ratio = computeAdjustmentRatio(baseClose, event);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
      adjustments.push({ ...event, ratio: 1, skipped: true, reason: 'ratioOutOfRange' });
      continue;
    }
    for (let i = 0; i < baseIndex; i += 1) {
      multipliers[i] *= ratio;
    }
    adjustments.push({
      ...event,
      ratio,
      appliedDate: sortedRows[baseIndex]?.date || event.date,
      baseClose,
      baseRowIndex: baseIndex,
    });
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
  const queue = [...spans];
  while (queue.length > 0) {
    const span = queue.shift();
    const spanDays = countSpanDays(span);
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
      if (shouldSplitSpan(error, spanDays, FINMIND_MIN_PRICE_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 價格段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              error.message || error
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      const enriched = new Error(
        `[FinMind 價格段錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
      );
      enriched.original = error;
      enriched.statusCode = extractStatusCode(error);
      throw enriched;
    }
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const payloadError = new Error(`FinMind 回應錯誤: ${json?.msg || 'unknown error'}`);
      payloadError.statusCode = json?.status;
      if (shouldSplitSpan(payloadError, spanDays, FINMIND_MIN_PRICE_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 價格段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              payloadError.message || payloadError
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      throw payloadError;
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
    if (queue.length > 0) {
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
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { rows: [], fetchStartISO: null, fetchEndISO: null };
  }
  const fetchStart = new Date(startDate.getTime());
  if (Number.isFinite(FINMIND_DIVIDEND_LOOKBACK_DAYS) && FINMIND_DIVIDEND_LOOKBACK_DAYS > 0) {
    fetchStart.setUTCDate(fetchStart.getUTCDate() - FINMIND_DIVIDEND_LOOKBACK_DAYS);
  }
  if (fetchStart > endDate) {
    fetchStart.setTime(endDate.getTime());
  }
  const spans = enumerateDateSpans(fetchStart, endDate, FINMIND_DIVIDEND_SPAN_DAYS);
  if (spans.length === 0) {
    return {
      rows: [],
      fetchStartISO: formatISODateFromDate(fetchStart),
      fetchEndISO: formatISODateFromDate(endDate),
    };
  }
  const combined = [];
  const queue = [...spans];
  while (queue.length > 0) {
    const span = queue.shift();
    const spanDays = countSpanDays(span);
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
      if (shouldSplitSpan(error, spanDays, FINMIND_MIN_DIVIDEND_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 股利段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              error.message || error
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      const enriched = new Error(
        `[FinMind 股利段錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
      );
      enriched.original = error;
      enriched.statusCode = extractStatusCode(error);
      throw enriched;
    }
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const payloadError = new Error(`FinMind Dividend 回應錯誤: ${json?.msg || 'unknown error'}`);
      payloadError.statusCode = json?.status;
      if (shouldSplitSpan(payloadError, spanDays, FINMIND_MIN_DIVIDEND_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 股利段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              payloadError.message || payloadError
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      throw payloadError;
    }
    combined.push(...json.data);
    if (queue.length > 0) {
      await delay(FINMIND_SEGMENT_COOLDOWN_MS);
    }
  }
  return {
    rows: combined,
    fetchStartISO: formatISODateFromDate(fetchStart),
    fetchEndISO: formatISODateFromDate(endDate),
  };
}

function buildSummary(priceData, adjustments, market, priceSourceLabel, dividendStats = {}) {
  const basePriceSource =
    priceSourceLabel || priceData.priceSource || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)');
  const uniqueSources = new Set([basePriceSource, 'FinMind (除權息)']);
  const {
    filteredCount,
    totalCount,
    lookbackWindowDays,
    fetchStartISO,
    fetchEndISO,
  } = dividendStats || {};
  return {
    priceRows: Array.isArray(priceData.rows) ? priceData.rows.length : 0,
    dividendRows: Number.isFinite(filteredCount) ? filteredCount : undefined,
    dividendRowsTotal: Number.isFinite(totalCount) ? totalCount : undefined,
    dividendFetchStart: fetchStartISO || undefined,
    dividendFetchEnd: fetchEndISO || undefined,
    dividendLookbackDays: Number.isFinite(lookbackWindowDays) ? lookbackWindowDays : undefined,
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

    const dividendPayload = await fetchDividendSeries(stockNo, startISO, endISO);
    const dividendSeries = Array.isArray(dividendPayload?.rows) ? dividendPayload.rows : [];

    const priceRows = Array.isArray(priceData.rows) ? priceData.rows : [];
    let priceRangeStartISO = null;
    let priceRangeEndISO = null;
    if (priceRows.length > 0) {
      const sortedForRange = [...priceRows].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      priceRangeStartISO = sortedForRange[0]?.date || null;
      priceRangeEndISO = sortedForRange[sortedForRange.length - 1]?.date || null;
    }

    const filteredDividendSeries = filterDividendRecordsByPriceRange(
      dividendSeries,
      priceRangeStartISO || startISO,
      priceRangeEndISO || endISO,
    );

    const { rows: adjustedRows, adjustments } = applyBackwardAdjustments(
      priceRows,
      filteredDividendSeries,
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
        {
          filteredCount: filteredDividendSeries.length,
          totalCount: dividendSeries.length,
          lookbackWindowDays: FINMIND_DIVIDEND_LOOKBACK_DAYS,
          fetchStartISO: dividendPayload?.fetchStartISO || null,
          fetchEndISO: dividendPayload?.fetchEndISO || null,
        },
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
