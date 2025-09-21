// netlify/functions/calculateAdjustedPrice.js (v13.4 - FinMind adjusted-series fallback diagnostics)
// Patch Tag: LB-ADJ-COMPOSER-20240525A
// Patch Tag: LB-ADJ-COMPOSER-20241020A
// Patch Tag: LB-ADJ-COMPOSER-20241022A
// Patch Tag: LB-ADJ-COMPOSER-20241024A
// Patch Tag: LB-ADJ-COMPOSER-20241027A
// Patch Tag: LB-ADJ-COMPOSER-20241030A
// Patch Tag: LB-ADJ-COMPOSER-20241105A
// Patch Tag: LB-ADJ-COMPOSER-20241112A
// Patch Tag: LB-ADJ-COMPOSER-20241119A
// Patch Tag: LB-ADJ-COMPOSER-20241123A
// Patch Tag: LB-ADJ-COMPOSER-20241126A
// Patch Tag: LB-ADJ-COMPOSER-20241209A
// Patch Tag: LB-ADJ-COMPOSER-20241216A
// Patch Tag: LB-ADJ-COMPOSER-20250220A
// Patch Tag: LB-ADJ-COMPOSER-20250320A
// Patch Tag: LB-ADJ-COMPOSER-20250328A
// Patch Tag: LB-ADJ-COMPOSER-20250331A
// Patch Tag: LB-ADJ-COMPOSER-20250402A
import fetch from 'node-fetch';

const FUNCTION_VERSION = 'LB-ADJ-COMPOSER-20250402A';

const CASH_DIVIDEND_ALIAS_KEYS = [
  'cash_dividend_total',
  'cash_dividend_total_amount',
  'cash_dividend_profit',
  'cash_dividend_surplus',
  'cash_dividend_carry',
  'cash_dividend_regular',
  'cash_dividend_special',
  'cash_dividend_extra',
  'cash_dividend_ordinary',
  'cash_dividend_amount',
  'cash_dividend_per_share',
  'cash_dividend_cash',
  'cash_distribution',
  'cash_distribution_total',
  'cash_distribution_amount',
  'cash_dividend_from_earnings',
  'cash_dividend_from_retain_earnings',
  'cash_dividend_from_retained_earnings',
  'cash_dividend_from_capital_reserve',
  'cash_dividend_from_capital_surplus',
  'cash_dividend_from_capital',
];

const CASH_DIVIDEND_ALIAS_PATTERNS = [
  /現金(股利|股息|配息|紅利|配發)/i,
  /(盈餘|現金).*(配息|股息|股利|紅利)/i,
  /(配息|股利)金額/i,
  /現金盈餘/i,
];

const STOCK_DIVIDEND_ALIAS_KEYS = [
  'stock_dividend_total',
  'stock_dividend_total_amount',
  'stock_dividend_total_ratio',
  'stock_dividend_profit',
  'stock_dividend_surplus',
  'stock_dividend_carry',
  'stock_dividend_special',
  'stock_dividend_extra',
  'stock_dividend_ordinary',
  'stock_dividend_from_earnings',
  'stock_dividend_from_retain_earnings',
  'stock_dividend_from_retained_earnings',
  'stock_dividend_from_capital_reserve',
  'stock_dividend_from_capital_surplus',
  'stock_dividend_from_capital',
  'employee_stock_dividend',
];

const STOCK_DIVIDEND_ALIAS_PATTERNS = [
  /股票(股利|股息|配股|紅利)/i,
  /(盈餘|公積).*(配股)/i,
  /配股股數/i,
  /股票紅利/i,
];

const CASH_INCREASE_ALIAS_KEYS = [
  'cash_capital_increase_ratio',
  'cash_capital_increase_total',
  'cash_capital_increase_total_ratio',
  'cash_capital_increase_subscription_ratio',
  'cash_capital_increase_subscribe_ratio',
  'cash_capital_increase_subscription_rate',
  'cash_capital_increase_ratio_total',
  'cash_capital_increase_ratio_percent',
  'cash_capital_increase_percent',
  'cash_capital_increase_percentage',
  'cash_capital_increase_per_share',
  'cash_capital_increase_share_ratio',
  'cash_capital_increase_shares_ratio',
  'cash_increase_ratio',
  'cash_increase_total_ratio',
  'cash_increase_percent',
  'cash_increase_percentage',
  'cash_subscription_ratio',
  'subscription_ratio',
  'subscription_rate',
  'subscription_percent',
  'subscription_percentage',
  'rights_issue_ratio',
  'rights_issue_percent',
  'rights_issue_percentage',
];

const CASH_INCREASE_ALIAS_PATTERNS = [
  /現金增資/i,
  /現增/i,
  /(認購|申購).*(比率|比例)/i,
  /配售.*(比率|比例)/i,
];

const STOCK_INCREASE_ALIAS_KEYS = [
  'stock_capital_increase_ratio',
  'stock_capital_increase_total',
  'stock_capital_increase_total_ratio',
  'stock_capital_increase_percent',
  'stock_capital_increase_percentage',
  'stock_capital_increase_per_share',
  'stock_capital_increase_share_ratio',
  'stock_capital_increase_shares_ratio',
  'stock_dividend_capital_increase',
  'stock_dividend_capital_increase_ratio',
  'stock_dividend_capital_increase_total',
  'stock_dividend_capital_increase_total_ratio',
];

const STOCK_INCREASE_ALIAS_PATTERNS = [
  /(盈餘|公積).*(轉增資|配股)/i,
  /轉增資.*(比率|比例)/i,
  /股票增資/i,
];

const SUBSCRIPTION_PRICE_ALIAS_KEYS = [
  'cash_capital_increase_subscription_price',
  'cash_capital_increase_subscribe_price',
  'cash_capital_increase_subscription_price_per_share',
  'cash_capital_increase_subscription_price_cash',
  'cash_capital_increase_price',
  'cash_capital_increase_price_cash',
  'cash_capital_increase_issue_price',
  'cash_capital_increase_offer_price',
  'cash_capital_increase_cash_price',
  'cash_increase_price',
  'cash_increase_issue_price',
  'cash_subscription_price',
  'subscription_price',
  'subscription_price_cash',
  'subscription_price_per_share',
];

const SUBSCRIPTION_PRICE_ALIAS_PATTERNS = [
  /(認購|申購|承銷).*(價格|價)/i,
  /(增資|配售|現增).*(價格|價)/i,
  /(發行|訂價).*(價格|價)/i,
  /配股價格/i,
];

const CASH_DIVIDEND_PRIMARY_KEY = 'cash_dividend';
const CASH_DIVIDEND_PART_KEYS = [
  'cash_dividend_from_earnings',
  'cash_dividend_from_retain_earnings',
  'cash_dividend_from_retained_earnings',
  'cash_dividend_from_capital_reserve',
  'cash_dividend_from_capital_surplus',
  'cash_dividend_from_capital',
  'cash_dividend_total',
  'cash_dividend_total_amount',
];

const STOCK_DIVIDEND_PRIMARY_KEY = 'stock_dividend';
const STOCK_DIVIDEND_PART_KEYS = [
  'stock_dividend_from_earnings',
  'stock_dividend_from_retain_earnings',
  'stock_dividend_from_retained_earnings',
  'stock_dividend_from_capital_reserve',
  'stock_dividend_from_capital_surplus',
  'stock_dividend_from_capital',
  'stock_dividend_total',
  'stock_dividend_total_amount',
];

const CASH_INCREASE_PRIMARY_KEY = 'cash_capital_increase';
const CASH_INCREASE_PART_KEYS = [
  'cash_capital_increase_ratio',
  'cash_capital_increase_total',
  'cash_capital_increase_total_ratio',
  'cash_capital_increase_subscription_ratio',
  'cash_capital_increase_subscribe_ratio',
  'cash_capital_increase_subscription_rate',
  'cash_capital_increase_ratio_total',
  'cash_capital_increase_ratio_percent',
  'cash_capital_increase_percent',
  'cash_capital_increase_percentage',
  'cash_capital_increase_per_share',
  'cash_capital_increase_share_ratio',
  'cash_capital_increase_shares_ratio',
  'cash_increase_ratio',
  'cash_increase_total_ratio',
  'cash_increase_percent',
  'cash_increase_percentage',
  'cash_subscription_ratio',
  'subscription_ratio',
  'subscription_rate',
  'subscription_percent',
  'subscription_percentage',
  'rights_issue_ratio',
  'rights_issue_percent',
  'rights_issue_percentage',
];

const STOCK_INCREASE_PRIMARY_KEY = 'stock_capital_increase';
const STOCK_INCREASE_PART_KEYS = [
  'stock_capital_increase_ratio',
  'stock_capital_increase_total',
  'stock_capital_increase_total_ratio',
  'stock_capital_increase_percent',
  'stock_capital_increase_percentage',
  'stock_capital_increase_per_share',
  'stock_capital_increase_share_ratio',
  'stock_capital_increase_shares_ratio',
  'stock_dividend_capital_increase',
  'stock_dividend_capital_increase_ratio',
  'stock_dividend_capital_increase_total',
  'stock_dividend_capital_increase_total_ratio',
];

const ZERO_AMOUNT_SAMPLE_LIMIT = 4;

const DEFAULT_EXCLUDE_NORMALISED_TOKENS = [
  'date',
  'year',
  'announcement',
  'announce',
  'declare',
  'description',
  'type',
  'notes',
  'note',
  'remark',
  'name',
  'code',
  'stock_id',
  'stockcode',
  'stock',
  'company',
  'industry',
  'sector',
  'board',
  'market',
  'symbol',
  'category',
  'status',
  'summary',
  'info',
  'information',
  'message',
  'url',
  'link',
  'source',
  'provider',
  'update',
  'fetch',
  'record',
  'book',
  'payment',
  'payable',
  'deadline',
  'stop',
  'suspend',
  'resume',
  'listing',
  'delisting',
  'meeting',
  'shareholder',
  'director',
];

const DEFAULT_EXCLUDE_ORIGINAL_PATTERNS = [
  /date/i,
  /time/i,
  /day/i,
  /年/, // year
  /月/, // month
  /日/, // day
  /日期/,
  /公告/,
  /說明/,
  /備註/,
  /備考/,
  /描述/,
  /摘要/,
  /紀錄/,
  /記錄/,
  /登記/,
  /股東會/,
  /董事會/,
  /決議/,
  /支付/,
  /派發/,
  /派息/,
  /發放/,
  /除權/,
  /除息/,
  /交易/,
  /Traning/i,
  /Trading/i,
  /Record/i,
  /Book/i,
  /Payment/i,
  /Payable/i,
  /Announcement/i,
  /Declare/i,
];

const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_MAX_SPAN_DAYS = 120;
const FINMIND_MIN_PRICE_SPAN_DAYS = 30;
const FINMIND_DIVIDEND_SPAN_DAYS = 365;
const FINMIND_DIVIDEND_LOOKBACK_DAYS = 540;
const FINMIND_MIN_DIVIDEND_SPAN_DAYS = 30;
const FINMIND_RETRY_ATTEMPTS = 3;
const FINMIND_RETRY_BASE_DELAY_MS = 350;
const FINMIND_SEGMENT_COOLDOWN_MS = 160;
const FINMIND_SPLITTABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 520, 522, 524, 598]);
const FINMIND_ADJUSTED_LABEL = 'FinMind 還原序列';
const ADJUSTED_SERIES_RATIO_EPSILON = 1e-5;

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

function normaliseNumericText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim();
  if (!text) return '';

  text = text.replace(/\u3000/g, ' ');

  text = text.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) {
      return String.fromCharCode(code - 0xff10 + 0x30);
    }
    if (code >= 0xff21 && code <= 0xff3a) {
      return String.fromCharCode(code - 0xff21 + 0x41);
    }
    if (code >= 0xff41 && code <= 0xff5a) {
      return String.fromCharCode(code - 0xff41 + 0x61);
    }
    return char;
  });

  const replacementRules = [
    { pattern: /[．｡。﹒]/g, value: '.' },
    { pattern: /[，﹐､﹑、]/g, value: ',' },
    { pattern: /[：﹕︰꞉]/g, value: ':' },
    { pattern: /[／∕⁄]/g, value: '/' },
    { pattern: /[％﹪]/g, value: '%' },
    { pattern: /[＋﹢]/g, value: '+' },
    { pattern: /[－﹣﹘–—‒]/g, value: '-' },
  ];

  for (const rule of replacementRules) {
    text = text.replace(rule.pattern, rule.value);
  }

  return text.trim();
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

  let text = normaliseNumericText(value);
  if (!text) return null;

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
  const hyphenKey = key.replace(/_/g, '-');
  if (Object.prototype.hasOwnProperty.call(raw, hyphenKey)) return raw[hyphenKey];
  const upperHyphenKey = hyphenKey.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(raw, upperHyphenKey)) return raw[upperHyphenKey];
  return undefined;
}

function normaliseKeyName(key) {
  if (!key && key !== 0) return '';
  return String(key)
    .replace(/([A-Z])/g, '_$1')
    .replace(/__+/g, '_')
    .replace(/[^a-z0-9_]/gi, '_')
    .toLowerCase();
}

function matchesPattern(value, pattern) {
  if (!value && value !== 0) return false;
  const text = String(value);
  if (pattern instanceof RegExp) {
    return pattern.test(text);
  }
  if (!pattern && pattern !== 0) return false;
  return text.toLowerCase().includes(String(pattern).toLowerCase());
}

function matchesAnyPattern(value, patterns = []) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  return patterns.some((pattern) => matchesPattern(value, pattern));
}

function shouldSkipByPatterns(value, patterns = []) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  return patterns.some((pattern) => matchesPattern(value, pattern));
}

function shouldSkipNormalisedKey(normalisedKey, tokens = []) {
  if (!normalisedKey) return false;
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  return tokens.some((token) => token && normalisedKey.includes(token));
}

function gatherDividendFieldHints(raw, options = {}) {
  if (!raw || typeof raw !== 'object') return [];
  const {
    keys = [],
    aliasPatterns = [],
    prefixTokens = [],
    parseOptions = {},
    limit = 4,
  } = options;

  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? limit : 4;
  const activeKeys = Array.isArray(keys) ? keys : [];
  const activePatterns = Array.isArray(aliasPatterns) ? aliasPatterns : [];
  const activePrefixes = Array.isArray(prefixTokens) ? prefixTokens : [];
  if (activeKeys.length === 0 && activePatterns.length === 0 && activePrefixes.length === 0) {
    return [];
  }

  const hints = [];
  const seen = new Set();
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    const normalisedKey = normaliseKeyName(rawKey);
    if (seen.has(normalisedKey)) continue;

    const matchesKeyList = activeKeys.some((key) => normaliseKeyName(key) === normalisedKey);
    const matchesAlias = matchesAnyPattern(rawKey, activePatterns);
    const matchesPrefix = activePrefixes.some((token) => token && normalisedKey.includes(token));
    if (!matchesKeyList && !matchesAlias && !matchesPrefix) continue;

    const hint = {
      key: rawKey,
      raw: typeof rawValue === 'string' ? rawValue : String(rawValue),
    };
    const numeric = parseNumber(rawValue, parseOptions);
    if (Number.isFinite(numeric)) {
      hint.numeric = Number(numeric);
    }
    hints.push(hint);
    seen.add(normalisedKey);

    if (hints.length >= resolvedLimit) {
      break;
    }
  }

  return hints;
}

function collectZeroAmountSample(diagnostics, raw, context = {}) {
  if (!diagnostics || !raw || typeof raw !== 'object') return;
  if (!Array.isArray(diagnostics.zeroAmountSamples)) {
    diagnostics.zeroAmountSamples = [];
  }

  const limit = Number.isFinite(context.limit) && context.limit > 0 ? context.limit : ZERO_AMOUNT_SAMPLE_LIMIT;
  if (diagnostics.zeroAmountSamples.length >= limit) return;

  const exInfo = context.exDateInfo || resolveExDate(raw);

  const buildPrefixes = (keys = [], fallback) => {
    const tokens = new Set();
    if (fallback) {
      const fallbackToken = normaliseKeyName(fallback);
      if (fallbackToken) tokens.add(fallbackToken);
    }
    if (Array.isArray(keys)) {
      for (const key of keys) {
        const token = normaliseKeyName(key);
        if (token) tokens.add(token);
      }
    }
    return Array.from(tokens);
  };

  const sample = {
    date: exInfo?.iso || null,
  };
  if (exInfo?.sourceKey) {
    sample.dateSource = {
      key: exInfo.sourceKey,
      value: exInfo.rawValue ?? null,
    };
  }

  const cashFields = gatherDividendFieldHints(raw, {
    keys: context.cashKeys || [],
    aliasPatterns: context.cashAliasPatterns || [],
    prefixTokens: buildPrefixes(context.cashKeys, context.cashFallback),
    parseOptions: { treatAsRatio: false },
  });
  if (cashFields.length > 0) {
    sample.cashDividendFields = cashFields;
  }

  const stockFields = gatherDividendFieldHints(raw, {
    keys: context.stockKeys || [],
    aliasPatterns: context.stockAliasPatterns || [],
    prefixTokens: buildPrefixes(context.stockKeys, context.stockFallback),
    parseOptions: { treatAsRatio: true },
  });
  if (stockFields.length > 0) {
    sample.stockDividendFields = stockFields;
  }

  const cashIncreaseFields = gatherDividendFieldHints(raw, {
    keys: context.cashIncreaseKeys || [],
    aliasPatterns: context.cashIncreaseAliasPatterns || [],
    prefixTokens: buildPrefixes(context.cashIncreaseKeys, context.cashIncreaseFallback),
    parseOptions: { treatAsRatio: true },
  });
  if (cashIncreaseFields.length > 0) {
    sample.cashIncreaseFields = cashIncreaseFields;
  }

  const stockIncreaseFields = gatherDividendFieldHints(raw, {
    keys: context.stockIncreaseKeys || [],
    aliasPatterns: context.stockIncreaseAliasPatterns || [],
    prefixTokens: buildPrefixes(context.stockIncreaseKeys, context.stockIncreaseFallback),
    parseOptions: { treatAsRatio: true },
  });
  if (stockIncreaseFields.length > 0) {
    sample.stockIncreaseFields = stockIncreaseFields;
  }

  if (
    (!sample.cashDividendFields || sample.cashDividendFields.length === 0) &&
    (!sample.stockDividendFields || sample.stockDividendFields.length === 0) &&
    (!sample.cashIncreaseFields || sample.cashIncreaseFields.length === 0) &&
    (!sample.stockIncreaseFields || sample.stockIncreaseFields.length === 0)
  ) {
    return;
  }

  diagnostics.zeroAmountSamples.push(sample);
}

function resolveDividendAmount(raw, primaryKey, partKeys = [], options = {}) {
  const parseOptions = options.treatAsRatio ? { treatAsRatio: true } : {};
  const aliasKeys = Array.isArray(options.aliasKeys) ? options.aliasKeys : [];
  const aliasPatterns = Array.isArray(options.aliasPatterns) ? options.aliasPatterns : [];
  const excludeNormalisedTokens = [
    ...DEFAULT_EXCLUDE_NORMALISED_TOKENS,
    ...(Array.isArray(options.excludeNormalizedTokens)
      ? options.excludeNormalizedTokens
      : []),
  ];
  const excludeOriginalPatterns = [
    ...DEFAULT_EXCLUDE_ORIGINAL_PATTERNS,
    ...(Array.isArray(options.excludeOriginalPatterns)
      ? options.excludeOriginalPatterns
      : []),
  ];

  const visited = new Set();
  const prefixes = new Set();
  const baseKeys = new Set();
  const registerBaseKey = (key) => {
    if (!key && key !== 0) return;
    const normalised = normaliseKeyName(key);
    if (normalised) {
      baseKeys.add(normalised);
      visited.add(normalised);
      prefixes.add(normalised);
    }
  };
  registerBaseKey(primaryKey);
  for (const key of partKeys) {
    registerBaseKey(key);
  }

  let total = 0;

  for (const key of aliasKeys) {
    if (!key && key !== 0) continue;
    const normalised = normaliseKeyName(key);
    if (!normalised) continue;
    prefixes.add(normalised);
    if (baseKeys.has(normalised)) {
      visited.add(normalised);
      continue;
    }
    const aliasValue = parseNumber(readField(raw, key), parseOptions);
    if (Number.isFinite(aliasValue) && aliasValue > 0) {
      total += aliasValue;
      visited.add(normalised);
    }
  }
  const primaryValue = parseNumber(readField(raw, primaryKey), parseOptions);
  if (Number.isFinite(primaryValue) && primaryValue > 0) {
    total += primaryValue;
  }

  for (const partKey of partKeys) {
    const partValue = parseNumber(readField(raw, partKey), parseOptions);
    if (Number.isFinite(partValue) && partValue > 0) {
      total += partValue;
    }
  }

  if (total > 0) {
    return total;
  }

  if (options.allowFuzzy !== false && raw && typeof raw === 'object') {
    const fallbackPrefix = normaliseKeyName(options.fallbackPrefix || primaryKey);
    if (fallbackPrefix) {
      prefixes.add(fallbackPrefix);
    }
    for (const [rawKey, rawValue] of Object.entries(raw)) {
      if (!rawKey && rawKey !== 0) continue;
      const normalisedKey = normaliseKeyName(rawKey);
      if (visited.has(normalisedKey)) continue;
      if (shouldSkipNormalisedKey(normalisedKey, excludeNormalisedTokens)) continue;
      if (shouldSkipByPatterns(rawKey, excludeOriginalPatterns)) continue;
      const matchesKnownPrefix = Array.from(prefixes).some(
        (token) => token && normalisedKey.includes(token),
      );
      const matchesAliasPattern = matchesAnyPattern(rawKey, aliasPatterns);
      if (!matchesKnownPrefix && !matchesAliasPattern) continue;
      const candidate = parseNumber(rawValue, parseOptions);
      if (Number.isFinite(candidate) && candidate > 0) {
        total += candidate;
        visited.add(normalisedKey);
      }
    }
  }

  return total > 0 ? total : 0;
}

function resolveSubscriptionPrice(raw) {
  let best = null;
  for (const key of SUBSCRIPTION_PRICE_ALIAS_KEYS) {
    const value = parseNumber(readField(raw, key));
    if (Number.isFinite(value) && value > 0) {
      if (!Number.isFinite(best) || value < best) {
        best = value;
      }
    }
  }

  if (Number.isFinite(best) && best > 0) {
    return best;
  }

  if (!raw || typeof raw !== 'object') {
    return 0;
  }

  const prefixes = new Set(
    SUBSCRIPTION_PRICE_ALIAS_KEYS.map((key) => normaliseKeyName(key)).filter(Boolean),
  );
  prefixes.add('subscription_price');
  prefixes.add('cash_capital_increase_price');

  const excludeNormalisedTokens = [
    ...DEFAULT_EXCLUDE_NORMALISED_TOKENS,
    'ratio',
    'rate',
    'percent',
    'percentage',
    'yield',
    'ratio_percent',
    'ratio_percentage',
  ];
  const excludeOriginalPatterns = [
    ...DEFAULT_EXCLUDE_ORIGINAL_PATTERNS,
    /比率/,
    /比例/,
    /率/,
    /百分/,
    /殖利率/,
  ];

  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (!rawKey && rawKey !== 0) continue;
    const normalisedKey = normaliseKeyName(rawKey);
    if (shouldSkipNormalisedKey(normalisedKey, excludeNormalisedTokens)) continue;
    if (shouldSkipByPatterns(rawKey, excludeOriginalPatterns)) continue;
    const matchesPrefix = Array.from(prefixes).some(
      (prefix) => prefix && normalisedKey.includes(prefix),
    );
    const matchesAliasPattern = matchesAnyPattern(rawKey, SUBSCRIPTION_PRICE_ALIAS_PATTERNS);
    if (!matchesPrefix && !matchesAliasPattern) continue;
    const numeric = parseNumber(rawValue);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    if (!Number.isFinite(best) || numeric < best) {
      best = numeric;
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

function normaliseDividendRecord(raw, context = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const exDateInfo = resolveExDate(raw);
  if (!exDateInfo?.iso) return null;

  const collectKeys = (...groups) => {
    const seen = new Set();
    const result = [];
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const key of group) {
        const token = key || key === 0 ? String(key) : null;
        if (!token || seen.has(token)) continue;
        seen.add(token);
        result.push(key);
      }
    }
    return result;
  };

  const cashDividend = resolveDividendAmount(
    raw,
    CASH_DIVIDEND_PRIMARY_KEY,
    CASH_DIVIDEND_PART_KEYS,
    {
      aliasKeys: CASH_DIVIDEND_ALIAS_KEYS,
      aliasPatterns: CASH_DIVIDEND_ALIAS_PATTERNS,
      excludeNormalizedTokens: ['ratio', 'rate', 'percent', 'percentage', 'yield', 'payout'],
      excludeOriginalPatterns: [/比率/, /比例/, /率/, /百分/, /殖利率/, /配息率/, /收益率/],
    },
  );
  const stockDividend = resolveDividendAmount(
    raw,
    STOCK_DIVIDEND_PRIMARY_KEY,
    STOCK_DIVIDEND_PART_KEYS,
    {
      treatAsRatio: true,
      aliasKeys: STOCK_DIVIDEND_ALIAS_KEYS,
      aliasPatterns: STOCK_DIVIDEND_ALIAS_PATTERNS,
      excludeNormalizedTokens: ['yield'],
      excludeOriginalPatterns: [/殖利率/, /轉增資/, /增資/],
    },
  );
  const cashCapitalIncrease = resolveDividendAmount(
    raw,
    CASH_INCREASE_PRIMARY_KEY,
    CASH_INCREASE_PART_KEYS,
    {
      treatAsRatio: true,
      aliasKeys: CASH_INCREASE_ALIAS_KEYS,
      aliasPatterns: CASH_INCREASE_ALIAS_PATTERNS,
      excludeNormalizedTokens: ['price', 'amount', 'value', 'cash_dividend'],
      excludeOriginalPatterns: [/價格/, /價/, /金額/, /每股/, /股利/],
    },
  );
  const stockCapitalIncrease = resolveDividendAmount(
    raw,
    STOCK_INCREASE_PRIMARY_KEY,
    STOCK_INCREASE_PART_KEYS,
    {
      treatAsRatio: true,
      aliasKeys: STOCK_INCREASE_ALIAS_KEYS,
      aliasPatterns: STOCK_INCREASE_ALIAS_PATTERNS,
      excludeNormalizedTokens: ['price', 'amount', 'value'],
      excludeOriginalPatterns: [/價格/, /價/, /金額/, /股利/],
    },
  );
  const subscriptionPrice = resolveSubscriptionPrice(raw);

  const hasComponent = [
    cashDividend,
    stockDividend,
    cashCapitalIncrease,
    stockCapitalIncrease,
  ].some((value) => Number.isFinite(value) && value > 0);

  if (!hasComponent) {
    collectZeroAmountSample(context?.diagnostics, raw, {
      exDateInfo,
      cashKeys: collectKeys([CASH_DIVIDEND_PRIMARY_KEY], CASH_DIVIDEND_PART_KEYS, CASH_DIVIDEND_ALIAS_KEYS),
      cashAliasPatterns: CASH_DIVIDEND_ALIAS_PATTERNS,
      cashFallback: CASH_DIVIDEND_PRIMARY_KEY,
      stockKeys: collectKeys([STOCK_DIVIDEND_PRIMARY_KEY], STOCK_DIVIDEND_PART_KEYS, STOCK_DIVIDEND_ALIAS_KEYS),
      stockAliasPatterns: STOCK_DIVIDEND_ALIAS_PATTERNS,
      stockFallback: STOCK_DIVIDEND_PRIMARY_KEY,
      cashIncreaseKeys: collectKeys([CASH_INCREASE_PRIMARY_KEY], CASH_INCREASE_PART_KEYS, CASH_INCREASE_ALIAS_KEYS),
      cashIncreaseAliasPatterns: CASH_INCREASE_ALIAS_PATTERNS,
      cashIncreaseFallback: CASH_INCREASE_PRIMARY_KEY,
      stockIncreaseKeys: collectKeys([STOCK_INCREASE_PRIMARY_KEY], STOCK_INCREASE_PART_KEYS, STOCK_INCREASE_ALIAS_KEYS),
      stockIncreaseAliasPatterns: STOCK_INCREASE_ALIAS_PATTERNS,
      stockIncreaseFallback: STOCK_INCREASE_PRIMARY_KEY,
    });
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

  const cashDividend = Math.max(0, record.cashDividend || 0);
  const stockDividend = Math.max(0, record.stockDividend || 0);
  const stockCapitalIncrease = Math.max(0, record.stockCapitalIncrease || 0);
  const cashCapitalIncrease = Math.max(0, record.cashCapitalIncrease || 0);
  const subscriptionPrice =
    Number.isFinite(record.subscriptionPrice) && record.subscriptionPrice > 0
      ? record.subscriptionPrice
      : 0;

  const totalStockComponent = stockDividend + stockCapitalIncrease + cashCapitalIncrease;
  const denominator =
    baseClose * (1 + totalStockComponent) + cashDividend - cashCapitalIncrease * subscriptionPrice;

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 1;
  }

  const ratio = baseClose / denominator;
  if (!Number.isFinite(ratio) || ratio <= 0) {
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

function incrementDiagnosticCounter(diagnostics, key) {
  if (!diagnostics || !key) return;
  const current = Number.isFinite(diagnostics[key]) ? diagnostics[key] : Number(diagnostics[key]);
  if (Number.isFinite(current)) {
    diagnostics[key] = current + 1;
  } else {
    diagnostics[key] = 1;
  }
}

function prepareDividendEvents(dividendRecords, context = {}) {
  const diagnostics = context?.diagnostics;
  const eventMap = new Map();
  for (const rawRecord of dividendRecords || []) {
    incrementDiagnosticCounter(diagnostics, 'totalRecords');
    const exInfo = resolveExDate(rawRecord);
    if (!exInfo?.iso) {
      incrementDiagnosticCounter(diagnostics, 'missingExDate');
      continue;
    }
    const normalised = normaliseDividendRecord(rawRecord, { diagnostics });
    if (!normalised) {
      incrementDiagnosticCounter(diagnostics, 'zeroAmountRecords');
      continue;
    }
    incrementDiagnosticCounter(diagnostics, 'normalisedRecords');
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

  if (diagnostics) {
    diagnostics.aggregatedEvents = events.length;
  }

  return events;
}

function applyBackwardAdjustments(priceRows, dividendRecords, options = {}) {
  const preparedEvents = Array.isArray(options.preparedEvents)
    ? options.preparedEvents
    : null;
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return {
      rows: [],
      adjustments: [],
      events: preparedEvents || [],
    };
  }

  const sortedRows = [...priceRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const multipliers = new Array(sortedRows.length).fill(1);
  const adjustments = [];

  const events = preparedEvents || prepareDividendEvents(dividendRecords);

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

  return { rows: adjustedRows, adjustments, events };
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

function resolveAdjustedCloseValue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidateKeys = [
    'adj_close',
    'adjClose',
    'Adj_Close',
    'close_adjusted',
    'close_adj',
    'close',
    'Close',
    'closing_price',
  ];
  for (const key of candidateKeys) {
    const value = parseNumber(readField(raw, key));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function buildAdjustedRowsFromFactorMap(priceRows, factorMap, options = {}) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return { rows: [], adjustments: [], matchedCount: 0 };
  }

  const label = options.label || FINMIND_ADJUSTED_LABEL;
  const sortedRows = [...priceRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const adjustedRows = [];
  const derivedAdjustments = [];
  let matchedCount = 0;
  let previousFactor = null;

  const scaleValue = (value, factor) => {
    if (value === null || value === undefined) return value;
    if (!Number.isFinite(value)) return value;
    return safeRound(value * factor) ?? value;
  };

  sortedRows.forEach((row) => {
    const iso = row.date;
    const mappedFactor = factorMap instanceof Map ? factorMap.get(iso) : null;
    let factor = mappedFactor;
    if (Number.isFinite(mappedFactor) && mappedFactor > 0) {
      matchedCount += 1;
    } else if (Number.isFinite(previousFactor) && previousFactor > 0) {
      factor = previousFactor;
    } else {
      factor = 1;
    }

    if (!Number.isFinite(factor) || factor <= 0) {
      factor = 1;
    }

    const adjustedRow = {
      ...row,
      open: scaleValue(row.open, factor),
      high: scaleValue(row.high, factor),
      low: scaleValue(row.low, factor),
      close: scaleValue(row.close, factor),
      adjustedFactor: factor,
    };
    adjustedRows.push(adjustedRow);

    if (
      Number.isFinite(previousFactor) &&
      previousFactor > 0 &&
      Number.isFinite(factor) &&
      factor > 0
    ) {
      const maxFactor = Math.max(previousFactor, factor);
      const minFactor = Math.min(previousFactor, factor);
      const ratio = minFactor / maxFactor;
      if (
        Number.isFinite(ratio) &&
        ratio > 0 &&
        ratio < 1 &&
        Math.abs(1 - ratio) > ADJUSTED_SERIES_RATIO_EPSILON
      ) {
        const roundedRatio = Number(Math.round(ratio * 1e6) / 1e6);
        const factorBefore = Number.isFinite(previousFactor)
          ? Number(Math.round(previousFactor * 1e6) / 1e6)
          : null;
        const factorAfter = Number.isFinite(factor)
          ? Number(Math.round(factor * 1e6) / 1e6)
          : null;
        const factorDelta =
          Number.isFinite(factorBefore) && Number.isFinite(factorAfter)
            ? Number(Math.round((factorAfter - factorBefore) * 1e6) / 1e6)
            : null;
        let factorDirection = null;
        if (Number.isFinite(factorDelta)) {
          if (factorDelta > 0) {
            factorDirection = 'up';
          } else if (factorDelta < 0) {
            factorDirection = 'down';
          } else {
            factorDirection = 'flat';
          }
        }

        derivedAdjustments.push({
          date: iso,
          appliedDate: iso,
          ratio: roundedRatio,
          baseClose: adjustedRow.close ?? null,
          source: label,
          derivedFrom: 'finmindAdjustedSeries',
          factorBefore,
          factorAfter,
          factorDelta,
          factorDirection,
        });
      }
    }

    previousFactor = factor;
  });

  for (let i = 0; i < adjustedRows.length; i += 1) {
    const current = adjustedRows[i];
    if (!Number.isFinite(current?.close)) {
      current.change = 0;
      continue;
    }
    const prevClose = i > 0 ? adjustedRows[i - 1]?.close : null;
    current.change = Number.isFinite(prevClose) ? safeRound(current.close - prevClose) ?? 0 : 0;
  }

  return { rows: adjustedRows, adjustments: derivedAdjustments, matchedCount };
}

async function fetchFinMindAdjustedPriceSeries(stockNo, startISO, endISO) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  const spans = enumerateDateSpans(startDate, endDate, FINMIND_MAX_SPAN_DAYS);
  if (spans.length === 0) {
    return { rows: [], matched: 0 };
  }

  const rowsMap = new Map();
  const queue = [...spans];
  while (queue.length > 0) {
    const span = queue.shift();
    const spanDays = countSpanDays(span);
    const params = {
      dataset: 'TaiwanStockPriceAdj',
      data_id: stockNo,
      start_date: span.startISO,
      end_date: span.endISO,
      token,
    };
    let json;
    try {
      json = await executeFinMindQuery(params);
    } catch (error) {
      if (shouldSplitSpan(error, spanDays, FINMIND_MIN_PRICE_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 還原序列拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              error.message || error
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      const enriched = new Error(
        `[FinMind 還原序列錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
      );
      enriched.original = error;
      enriched.statusCode = extractStatusCode(error);
      throw enriched;
    }
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const payloadError = new Error(`FinMind 還原序列回應錯誤: ${json?.msg || 'unknown error'}`);
      payloadError.statusCode = json?.status;
      if (shouldSplitSpan(payloadError, spanDays, FINMIND_MIN_PRICE_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 還原序列拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
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

    for (const rawRow of json.data) {
      const iso = toISODate(readField(rawRow, 'date'));
      if (!iso) continue;
      const adjustedClose = resolveAdjustedCloseValue(rawRow);
      if (!Number.isFinite(adjustedClose) || adjustedClose <= 0) continue;
      rowsMap.set(iso, { date: iso, close: adjustedClose });
    }

    if (queue.length > 0) {
      await delay(FINMIND_SEGMENT_COOLDOWN_MS);
    }
  }

  const rows = Array.from(rowsMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return { rows, matched: rows.length };
}

async function deriveAdjustedSeriesFallback({ stockNo, startISO, endISO, priceRows }) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return null;
  }

  let adjustedSeries;
  try {
    adjustedSeries = await fetchFinMindAdjustedPriceSeries(stockNo, startISO, endISO);
  } catch (error) {
    return {
      applied: false,
      error: error.message || error,
      rows: priceRows,
      adjustments: [],
      info: {
        applied: false,
        status: 'error',
        detail: error.message || 'FinMind 還原序列失敗',
        label: FINMIND_ADJUSTED_LABEL,
      },
    };
  }

  if (!adjustedSeries || adjustedSeries.rows.length === 0) {
    return {
      applied: false,
      rows: priceRows,
      adjustments: [],
      info: {
        applied: false,
        status: 'warning',
        detail: 'FinMind 還原序列無資料',
        label: FINMIND_ADJUSTED_LABEL,
      },
    };
  }

  const priceMap = new Map();
  priceRows.forEach((row) => {
    if (row?.date) {
      priceMap.set(row.date, row);
    }
  });

  const factorMap = new Map();
  let ratioSamples = 0;
  for (const adjustedRow of adjustedSeries.rows) {
    const rawRow = priceMap.get(adjustedRow.date);
    if (!rawRow || !Number.isFinite(rawRow.close) || rawRow.close <= 0) continue;
    if (!Number.isFinite(adjustedRow.close) || adjustedRow.close <= 0) continue;
    const factor = adjustedRow.close / rawRow.close;
    if (!Number.isFinite(factor) || factor <= 0) continue;
    factorMap.set(adjustedRow.date, factor);
    ratioSamples += 1;
  }

  if (factorMap.size === 0) {
    return {
      applied: false,
      rows: priceRows,
      adjustments: [],
      info: {
        applied: false,
        status: 'warning',
        detail: 'FinMind 還原序列與原始價無重疊日期',
        label: FINMIND_ADJUSTED_LABEL,
      },
    };
  }

  const { rows: adjustedRows, adjustments, matchedCount } = buildAdjustedRowsFromFactorMap(
    priceRows,
    factorMap,
    { label: FINMIND_ADJUSTED_LABEL },
  );

  const applied = matchedCount > 0;

  const detailParts = [`對齊 ${matchedCount} 筆`, `產生 ${adjustments.length} 件`];
  if (Number.isFinite(ratioSamples) && ratioSamples !== matchedCount) {
    detailParts.push(`係數樣本 ${ratioSamples}`);
  }

  return {
    applied,
    rows: adjustedRows,
    adjustments,
    info: {
      applied,
      status: applied ? 'success' : 'warning',
      detail: detailParts.join(' ・ '),
      label: FINMIND_ADJUSTED_LABEL,
      matchedCount,
      adjustmentCount: adjustments.length,
      ratioSamples,
    },
  };
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

function summariseAdjustmentSkipReasons(adjustments = []) {
  if (!Array.isArray(adjustments) || adjustments.length === 0) return null;
  const counts = adjustments.reduce((acc, event) => {
    if (!event?.skipped) return acc;
    const key = event.reason ? String(event.reason) : 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(counts).length > 0 ? counts : null;
}

function buildDebugSteps({
  priceData,
  priceSourceLabel,
  dividendSeries,
  filteredDividendSeries,
  preparedEvents,
  adjustments,
  fallbackInfo,
}) {
  const priceRows = Array.isArray(priceData?.rows) ? priceData.rows.length : 0;
  const totalDividendRows = Array.isArray(dividendSeries) ? dividendSeries.length : 0;
  const filteredDividendRows = Array.isArray(filteredDividendSeries)
    ? filteredDividendSeries.length
    : 0;
  const normalisedEvents = Array.isArray(preparedEvents) ? preparedEvents.length : 0;
  const appliedAdjustments = Array.isArray(adjustments)
    ? adjustments.filter((event) => !event?.skipped).length
    : 0;
  const skippedAdjustments = Array.isArray(adjustments)
    ? adjustments.filter((event) => event?.skipped).length
    : 0;
  const skipReasons = summariseAdjustmentSkipReasons(adjustments);

  const steps = [
    {
      key: 'priceFetch',
      label: '價格資料',
      status: priceRows > 0 ? 'success' : 'error',
      detail: `${priceRows} 筆 ・ ${priceSourceLabel || priceData?.priceSource || ''}`.trim(),
    },
    {
      key: 'dividendFetch',
      label: '股利抓取',
      status: totalDividendRows > 0 ? 'success' : 'warning',
      detail: `原始 ${totalDividendRows} 筆 ・ 區間 ${filteredDividendRows} 筆`,
    },
    {
      key: 'eventNormalisation',
      label: '事件整理',
      status: normalisedEvents > 0 ? 'success' : 'warning',
      detail: `${normalisedEvents} 件`,
    },
    {
      key: 'adjustmentApply',
      label: '還原套用',
      status: appliedAdjustments > 0 ? 'success' : 'warning',
      detail: `成功 ${appliedAdjustments} 件 ・ 略過 ${skippedAdjustments} 件`,
      skipReasons,
    },
  ];

  if (fallbackInfo) {
    steps.push({
      key: 'adjustedSeriesFallback',
      label: fallbackInfo.label || FINMIND_ADJUSTED_LABEL,
      status: fallbackInfo.status || (fallbackInfo.applied ? 'success' : 'warning'),
      detail: fallbackInfo.detail || '',
    });
  }

  return steps;
}

function buildSummary(
  priceData,
  adjustments,
  market,
  priceSourceLabel,
  dividendStats = {},
  fallbackInfo = null,
) {
  const basePriceSource =
    priceSourceLabel || priceData.priceSource || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)');
  const uniqueSources = new Set([basePriceSource, 'FinMind (除權息還原)']);
  if (fallbackInfo?.applied) {
    uniqueSources.add(fallbackInfo.label || FINMIND_ADJUSTED_LABEL);
  }
  const {
    filteredCount,
    totalCount,
    normalizedCount,
    lookbackWindowDays,
    fetchStartISO,
    fetchEndISO,
  } = dividendStats || {};
  const appliedEvents = Array.isArray(adjustments)
    ? adjustments.filter((event) => !event?.skipped)
    : [];
  const skippedEvents = Array.isArray(adjustments)
    ? adjustments.filter((event) => event?.skipped)
    : [];
  const skipReasons = summariseAdjustmentSkipReasons(adjustments);

  return {
    priceRows: Array.isArray(priceData.rows) ? priceData.rows.length : 0,
    dividendRows: Number.isFinite(filteredCount) ? filteredCount : undefined,
    dividendRowsTotal: Number.isFinite(totalCount) ? totalCount : undefined,
    dividendEvents: Number.isFinite(normalizedCount) ? normalizedCount : undefined,
    dividendFetchStart: fetchStartISO || undefined,
    dividendFetchEnd: fetchEndISO || undefined,
    dividendLookbackDays: Number.isFinite(lookbackWindowDays) ? lookbackWindowDays : undefined,
    adjustmentEvents: appliedEvents.length,
    skippedEvents: skippedEvents.length,
    adjustmentSkipReasons:
      skipReasons && Object.keys(skipReasons).length > 0 ? skipReasons : undefined,
    priceSource: basePriceSource,
    dividendSource: 'FinMind (TaiwanStockDividend)',
    sources: Array.from(uniqueSources),
  };
}

export const __TESTING__ = {
  resolveDividendAmount,
  normaliseDividendRecord,
  prepareDividendEvents,
  parseNumber,
  normaliseNumericText,
  resolveSubscriptionPrice,
  filterDividendRecordsByPriceRange,
  computeAdjustmentRatio,
  buildAdjustedRowsFromFactorMap,
};

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

    const dividendDiagnostics = {
      totalRecords: 0,
      missingExDate: 0,
      zeroAmountRecords: 0,
      normalisedRecords: 0,
      aggregatedEvents: 0,
      zeroAmountSamples: [],
    };

    const preparedDividendEvents = prepareDividendEvents(filteredDividendSeries, {
      diagnostics: dividendDiagnostics,
    });

    const { rows: adjustedRows, adjustments, events } = applyBackwardAdjustments(
      priceRows,
      filteredDividendSeries,
      { preparedEvents: preparedDividendEvents },
    );

    const appliedAdjustments = adjustments.filter((event) => !event?.skipped);
    let fallbackInfo = null;
    let effectiveRows = adjustedRows;
    let effectiveAdjustments = adjustments;

    if (appliedAdjustments.length === 0 && priceRows.length > 0) {
      const fallbackResult = await deriveAdjustedSeriesFallback({
        stockNo,
        startISO,
        endISO,
        priceRows,
      });
      if (fallbackResult) {
        fallbackInfo = fallbackResult.info || null;
        if (Array.isArray(fallbackResult.rows) && fallbackResult.rows.length > 0) {
          effectiveRows = fallbackResult.rows;
        }
        if (Array.isArray(fallbackResult.adjustments) && fallbackResult.adjustments.length > 0) {
          effectiveAdjustments = [...adjustments, ...fallbackResult.adjustments];
        }
      }
    }

    const debugSteps = buildDebugSteps({
      priceData,
      priceSourceLabel,
      dividendSeries,
      filteredDividendSeries,
      preparedEvents: preparedDividendEvents,
      adjustments: effectiveAdjustments,
      fallbackInfo,
    });

    const baseSourceLabel =
      priceSourceLabel || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)')
    ;
    const combinedSourceParts = [baseSourceLabel, 'FinMind (除權息還原)'];
    if (fallbackInfo?.applied) {
      combinedSourceParts.push(FINMIND_ADJUSTED_LABEL);
    }
    const combinedSourceLabel = combinedSourceParts.join(' + ');

    const responseBody = {
      version: FUNCTION_VERSION,
      stockNo,
      market,
      stockName: priceData.stockName || stockNo,
      dataSource: combinedSourceLabel,
      priceSource: priceSourceLabel,
      summary: buildSummary(
        priceData,
        effectiveAdjustments,
        market,
        priceSourceLabel,
        {
          filteredCount: filteredDividendSeries.length,
          totalCount: dividendSeries.length,
          normalizedCount: preparedDividendEvents.length,
          lookbackWindowDays: FINMIND_DIVIDEND_LOOKBACK_DAYS,
          fetchStartISO: dividendPayload?.fetchStartISO || null,
          fetchEndISO: dividendPayload?.fetchEndISO || null,
        },
        fallbackInfo,
      ),
      data: effectiveRows,
      adjustments: effectiveAdjustments,
      dividendEvents: events,
      dividendDiagnostics,
      debugSteps,
      adjustmentFallback: fallbackInfo || null,
      adjustmentFallbackApplied: Boolean(fallbackInfo?.applied),
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
