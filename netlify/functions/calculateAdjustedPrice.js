// netlify/functions/calculateAdjustedPrice.js (v13.7 - Split ratio diagnostics)
// Patch Tag: LB-ADJ-COMPOSER-20240525A
// Patch Tag: LB-ADJ-COMPOSER-20250523A
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
// Patch Tag: LB-ADJ-COMPOSER-20250410A
// Patch Tag: LB-ADJ-COMPOSER-20250414A
// Patch Tag: LB-ADJ-COMPOSER-20250421A
// Patch Tag: LB-ADJ-COMPOSER-20250426A
// Patch Tag: LB-ADJ-COMPOSER-20250509A
// Patch Tag: LB-ADJ-COMPOSER-20250518A
// Patch Tag: LB-ADJ-COMPOSER-20250522A
// Patch Tag: LB-ADJ-COMPOSER-20250527A
// Patch Tag: LB-ADJ-COMPOSER-20250704A
import fetch from 'node-fetch';

const FUNCTION_VERSION = 'LB-ADJ-COMPOSER-20250704A';

let fetchImpl = fetch;

const DIVIDEND_RESULT_PREVIEW_LIMIT = 3;

function setFetchImplementation(fn) {
  if (typeof fn === 'function') {
    fetchImpl = fn;
    return;
  }
  fetchImpl = fetch;
}

function resetFetchImplementation() {
  fetchImpl = fetch;
}

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

const SPLIT_DATE_KEYS = [
  'date',
  'split_date',
  'splitday',
  'split_day',
  'ex_date',
  'ex_right_date',
  'announcement_date',
  'announce_date',
];

const SPLIT_BEFORE_PRICE_KEYS = [
  'before_price',
  'before_split_price',
  'before_reference_price',
  'before_price_reference',
  'before',
  'before_close',
  'close_before',
  'price_before',
  'before_adjust_price',
  'price_before_split',
];

const SPLIT_AFTER_PRICE_KEYS = [
  'after_price',
  'after_split_price',
  'after_reference_price',
  'after_price_reference',
  'after',
  'after_close',
  'close_after',
  'price_after',
  'price_after_split',
];

const SPLIT_RATIO_KEYS = [
  'split_ratio',
  'ratio',
  'split_rate',
  'splitratio',
  'splitrate',
  'ratio_split',
];

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

// Patch Tag: LB-ADJ-COMPOSER-SPLIT-20250518A
const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_MAX_SPAN_DAYS = 120;
const FINMIND_MIN_PRICE_SPAN_DAYS = 30;
const FINMIND_DIVIDEND_SPAN_DAYS = 365;
const FINMIND_DIVIDEND_LOOKBACK_DAYS = 540;
const FINMIND_MIN_DIVIDEND_SPAN_DAYS = 30;
const FINMIND_SPLIT_SPAN_DAYS = 365;
const FINMIND_SPLIT_LOOKBACK_DAYS = 900;
const FINMIND_MIN_SPLIT_SPAN_DAYS = 30;
const FINMIND_RETRY_ATTEMPTS = 3;
const FINMIND_RETRY_BASE_DELAY_MS = 350;
const FINMIND_SEGMENT_COOLDOWN_MS = 160;
const FINMIND_SPLITTABLE_STATUS = new Set([400, 408, 429, 500, 502, 503, 504, 520, 522, 524, 598]);
const FINMIND_ADJUSTED_LABEL = 'FinMind 還原序列';
const FINMIND_DIVIDEND_RESULT_DATASET = 'TaiwanStockDividendResult';
const FINMIND_DIVIDEND_RESULT_LABEL = 'FinMind (TaiwanStockDividendResult)';
const FINMIND_SPLIT_DATASET = 'TaiwanStockSplitPrice';
const FINMIND_SPLIT_LABEL = 'FinMind 股票拆分';
const FINMIND_DIVIDEND_LABEL = 'FinMind (除權息還原)';
const ADJUSTED_SERIES_RATIO_EPSILON = 1e-5;
const DAY_SECONDS = 24 * 60 * 60;
const YAHOO_PRICE_SOURCE_LABEL = 'Yahoo Finance (還原)';
const YAHOO_BACKUP_SOURCE_LABEL = 'FinMind (備援: 配息/拆分)';
const YAHOO_TWSE_SUFFIX = '.TW';
const YAHOO_TPEX_SUFFIX = '.TWO';
const DEFAULT_USER_AGENT = 'Mozilla/5.0';

const FINMIND_PERMISSION_PATTERNS = [
  /your level is/i,
  /subscribe/i,
  /purchase plan/i,
  /permission/i,
  /upgrade/i,
];

const FINMIND_TOKEN_PATTERNS = [
  /token/i,
  /api key/i,
  /unauthorized/i,
];

const FINMIND_PARAMETER_PATTERNS = [
  /parameter/i,
  /format/i,
  /start_date/i,
  /end_date/i,
  /data_id/i,
  /stock_id/i,
  /frequency/i,
  /dataset/i,
];

const FINMIND_NO_DATA_PATTERNS = [
  /no data/i,
  /not found/i,
  /empty/i,
  /無資料/,
];

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

function normaliseFinMindMessage(message) {
  if (message === null || message === undefined) return '';
  return String(message).trim();
}

function resolveFinMindDatasetLabel(dataset) {
  if (!dataset) return 'FinMind 資料';
  const token = String(dataset);
  if (token === FINMIND_DIVIDEND_RESULT_DATASET) {
    return 'TaiwanStockDividendResult';
  }
  if (token === FINMIND_SPLIT_DATASET) {
    return 'TaiwanStockSplitPrice';
  }
  if (token === 'TaiwanStockPriceAdj') {
    return 'TaiwanStockPriceAdj';
  }
  if (token === 'TaiwanStockPrice') {
    return 'TaiwanStockPrice';
  }
  return token;
}

function classifyFinMindOutcome({
  tokenPresent,
  dataset,
  statusCode,
  message,
  rawMessage,
  dataCount,
  spanStart,
  spanEnd,
  error,
} = {}) {
  const resolvedStatus = Number.isFinite(statusCode) ? Number(statusCode) : undefined;
  const resolvedMessage = normaliseFinMindMessage(message || rawMessage || error?.message || '');
  const lowerMessage = resolvedMessage.toLowerCase();
  const finalSpanStart = spanStart || null;
  const finalSpanEnd = spanEnd || null;

  const buildResult = (status, label, hint) => ({
    status,
    label,
    hint,
    statusCode: resolvedStatus ?? null,
    message: resolvedMessage || null,
    dataset: dataset || null,
    spanStart: finalSpanStart,
    spanEnd: finalSpanEnd,
  });

  if (tokenPresent === false || /未設定 finmind token/i.test(resolvedMessage)) {
    return buildResult('missingToken', '缺少 API Token', '請於 Netlify / 環境變數設定 FINMIND_TOKEN 後重試。');
  }

  const datasetLabel = resolveFinMindDatasetLabel(dataset);

  if (resolvedStatus === 401 || resolvedStatus === 403) {
    return buildResult(
      'permissionDenied',
      'API 權限不足',
      `請確認方案等級是否允許下載 ${datasetLabel} 資料。`,
    );
  }

  if (resolvedMessage) {
    if (FINMIND_PERMISSION_PATTERNS.some((pattern) => pattern.test(lowerMessage))) {
      return buildResult('permissionDenied', 'API 權限不足', '請升級 FinMind 方案或確認 API Key 權限設定。');
    }
    if (FINMIND_TOKEN_PATTERNS.some((pattern) => pattern.test(lowerMessage))) {
      return buildResult('tokenInvalid', 'Token 設定錯誤', '請確認 FINMIND_TOKEN 是否正確，或重新生成後更新環境變數。');
    }
    if (FINMIND_PARAMETER_PATTERNS.some((pattern) => pattern.test(lowerMessage))) {
      return buildResult('parameterError', '參數設定異常', '請檢查查詢的股票代碼、日期區間與 dataset 參數。');
    }
    if (FINMIND_NO_DATA_PATTERNS.some((pattern) => pattern.test(lowerMessage))) {
      return buildResult('noData', '查無股利資料', '請確認該股票於查詢期間是否有公告除權息或延長查詢區間。');
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('network')) {
      return buildResult('networkError', 'FinMind 連線失敗', '可能遭遇暫時性網路問題，請稍後再試。');
    }
    if (lowerMessage.includes('server error') || lowerMessage.includes('502') || lowerMessage.includes('504')) {
      return buildResult('serverError', 'FinMind 伺服器錯誤', 'FinMind 服務暫時無法回應，請稍後重試。');
    }
  }

  if (resolvedStatus && resolvedStatus >= 500) {
    return buildResult('serverError', 'FinMind 伺服器錯誤', 'FinMind 服務暫時無法回應，請稍後重試。');
  }

  if (Number.isFinite(dataCount) && dataCount <= 0) {
    return buildResult('noData', '查無股利資料', '請確認股票是否於查詢期間公告股利，或延長查詢區間。');
  }

  return buildResult('success', 'API 呼叫成功', null);
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

function resolveNumericByKeys(raw, keys, options = {}) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  for (let i = 0; i < keys.length; i += 1) {
    const value = parseNumber(readField(raw, keys[i]), options);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return null;
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
    const iso = toISODate(readField(record, 'date'));
    if (!iso) return false;
    if (startISO && iso < startISO) return false;
    if (endISO && iso > endISO) return false;
    return true;
  });
}

function normaliseDividendResultRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const isoDate = toISODate(readField(raw, 'date'));
  if (!isoDate) return null;

  const beforePrice = parseNumber(
    readField(raw, 'before_price') ?? readField(raw, 'beforePrice') ?? readField(raw, 'reference_price_before'),
  );
  if (!Number.isFinite(beforePrice) || beforePrice <= 0) {
    return null;
  }

  const afterPrice = parseNumber(
    readField(raw, 'after_price') ?? readField(raw, 'afterPrice') ?? readField(raw, 'reference_price'),
  );
  const dividendTotal = parseNumber(
    readField(raw, 'stock_and_cache_dividend') ??
      readField(raw, 'stock_and_cash_dividend') ??
      readField(raw, 'dividend_total'),
  );

  if (!Number.isFinite(afterPrice) || afterPrice <= 0) {
    return null;
  }

  let ratio = afterPrice / beforePrice;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return null;
  }

  if (ratio >= 1) {
    // 若結果無需調整則忽略，避免被視為有效事件
    return null;
  }

  const roundedRatio = Number(Math.round(ratio * 1e8) / 1e8);

  return {
    date: isoDate,
    ratio: roundedRatio,
    beforePrice: safeRound(beforePrice) ?? beforePrice,
    afterPrice: safeRound(afterPrice) ?? afterPrice,
    dividendTotal: Number.isFinite(dividendTotal) ? safeRound(dividendTotal) ?? dividendTotal : null,
    raw,
  };
}

function buildDividendResultEvents(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }
  const eventMap = new Map();
  for (const raw of records) {
    const normalised = normaliseDividendResultRecord(raw);
    if (!normalised) continue;
    const existing = eventMap.get(normalised.date);
    if (existing) {
      if (normalised.ratio < existing.manualRatio) {
        existing.manualRatio = normalised.ratio;
      }
      if (Number.isFinite(normalised.beforePrice) && normalised.beforePrice > 0) {
        existing.beforePrice = normalised.beforePrice;
      }
      if (Number.isFinite(normalised.afterPrice) && normalised.afterPrice > 0) {
        existing.afterPrice = normalised.afterPrice;
      }
      if (Number.isFinite(normalised.dividendTotal) && normalised.dividendTotal > 0) {
        existing.dividendTotal = normalised.dividendTotal;
      }
      if (!existing.rawRecords) {
        existing.rawRecords = [];
      }
      existing.rawRecords.push(normalised.raw);
    } else {
      eventMap.set(normalised.date, {
        date: normalised.date,
        manualRatio: normalised.ratio,
        manualRatioSource: FINMIND_DIVIDEND_RESULT_DATASET,
        ratioSource: 'FinMindDividendResult',
        label: FINMIND_DIVIDEND_RESULT_LABEL,
        source: FINMIND_DIVIDEND_RESULT_LABEL,
        dataset: FINMIND_DIVIDEND_RESULT_DATASET,
        beforePrice: normalised.beforePrice,
        afterPrice: normalised.afterPrice,
        dividendTotal: normalised.dividendTotal,
        stockAndCashDividend: normalised.dividendTotal,
        cashDividend: 0,
        stockDividend: 0,
        cashCapitalIncrease: 0,
        stockCapitalIncrease: 0,
        rawRecords: [normalised.raw],
      });
    }
  }

  return Array.from(eventMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

function parseSplitRatioToken(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const direct = parseNumber(rawValue, { treatAsRatio: true });

  let explicit = null;
  if (typeof rawValue === 'string' || rawValue instanceof String) {
    const cleaned = normaliseNumericText(rawValue);
    if (cleaned.includes(':')) {
      const [lhsRaw, rhsRaw] = cleaned.split(':');
      const lhs = Number(lhsRaw);
      const rhs = Number(rhsRaw);
      if (Number.isFinite(lhs) && Number.isFinite(rhs) && lhs > 0 && rhs > 0) {
        explicit = rhs / lhs;
      }
    } else if (cleaned.includes('/')) {
      const [lhsRaw, rhsRaw] = cleaned.split('/');
      const lhs = Number(lhsRaw);
      const rhs = Number(rhsRaw);
      if (Number.isFinite(lhs) && Number.isFinite(rhs) && lhs > 0 && rhs > 0) {
        explicit = lhs / rhs;
      }
    }
  }

  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  return null;
}

function normaliseSplitRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let dateToken = null;
  for (let i = 0; i < SPLIT_DATE_KEYS.length; i += 1) {
    const value = readField(raw, SPLIT_DATE_KEYS[i]);
    if (value) {
      dateToken = value;
      break;
    }
  }

  const isoDate = toISODate(dateToken);
  if (!isoDate) return null;

  const beforePrice = resolveNumericByKeys(raw, SPLIT_BEFORE_PRICE_KEYS);
  const afterPrice = resolveNumericByKeys(raw, SPLIT_AFTER_PRICE_KEYS);

  const ratioTokens = [];
  let ratio = null;
  for (let i = 0; i < SPLIT_RATIO_KEYS.length; i += 1) {
    const key = SPLIT_RATIO_KEYS[i];
    const rawValue = readField(raw, key);
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    ratioTokens.push(rawValue);
    const numeric = parseNumber(rawValue, { treatAsRatio: true });
    if (Number.isFinite(numeric) && numeric > 0) {
      ratio = numeric;
      if (Math.abs(numeric - 1) > 1e-8) {
        break;
      }
    }
  }

  if (ratioTokens.length > 0) {
    for (let i = 0; i < ratioTokens.length; i += 1) {
      const parsed = parseSplitRatioToken(ratioTokens[i]);
      if (!Number.isFinite(parsed) || parsed <= 0) continue;
      if (!Number.isFinite(ratio) || ratio <= 0) {
        ratio = parsed;
      }
      if (Math.abs(parsed - 1) > 1e-8 && Math.abs(parsed - ratio) > 1e-8) {
        ratio = parsed;
      }
      if (Math.abs(ratio - 1) > 1e-8) {
        break;
      }
    }
  }

  if (
    Number.isFinite(beforePrice) &&
    beforePrice > 0 &&
    Number.isFinite(afterPrice) &&
    afterPrice > 0
  ) {
    const inferred = afterPrice / beforePrice;
    if (
      Number.isFinite(inferred) &&
      inferred > 0 &&
      (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(inferred - ratio) > 1e-6)
    ) {
      ratio = inferred;
    }
  }

  if (Number.isFinite(ratio) && ratio > 0) {
    if (ratio >= 100 && ratio <= 200) {
      ratio /= 100;
    }
    if (ratio > 100) {
      ratio = null;
    }
  } else {
    ratio = null;
  }

  const resolvedBefore =
    Number.isFinite(beforePrice) && beforePrice > 0 ? beforePrice : null;
  const resolvedAfter =
    Number.isFinite(afterPrice) && afterPrice > 0 ? afterPrice : null;
  const resolvedRatio =
    Number.isFinite(ratio) && ratio > 0
      ? Number(Math.round(ratio * 1e8) / 1e8)
      : null;

  return {
    date: isoDate,
    beforePrice: resolvedBefore,
    afterPrice: resolvedAfter,
    ratio: resolvedRatio,
    raw,
  };
}

function buildSplitEvents(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  const eventMap = new Map();
  for (let i = 0; i < records.length; i += 1) {
    const normalised = normaliseSplitRecord(records[i]);
    if (!normalised) continue;

    const existing = eventMap.get(normalised.date);
    if (existing) {
      if (Number.isFinite(normalised.ratio) && normalised.ratio > 0) {
        if (Number.isFinite(existing.manualRatio) && existing.manualRatio > 0) {
          const ratioDelta = Math.abs(normalised.ratio - existing.manualRatio);
          if (ratioDelta <= 1e-6) {
            existing.manualRatio = normalised.ratio;
          } else {
            existing.manualRatio *= normalised.ratio;
          }
        } else {
          existing.manualRatio = normalised.ratio;
        }
      }
      if (
        Number.isFinite(normalised.beforePrice) &&
        normalised.beforePrice > 0
      ) {
        existing.beforePrice = normalised.beforePrice;
      }
      if (
        Number.isFinite(normalised.afterPrice) &&
        normalised.afterPrice > 0
      ) {
        existing.afterPrice = normalised.afterPrice;
      }
      if (!Array.isArray(existing.rawRecords)) {
        existing.rawRecords = [];
      }
      existing.rawRecords.push(normalised.raw);
    } else {
      eventMap.set(normalised.date, {
        date: normalised.date,
        manualRatio: Number.isFinite(normalised.ratio) ? normalised.ratio : null,
        manualRatioSource: FINMIND_SPLIT_DATASET,
        ratioSource: 'FinMindSplitPrice',
        label: FINMIND_SPLIT_LABEL,
        source: FINMIND_SPLIT_LABEL,
        dataset: FINMIND_SPLIT_DATASET,
        beforePrice: normalised.beforePrice,
        afterPrice: normalised.afterPrice,
        cashDividend: 0,
        stockDividend: 0,
        cashCapitalIncrease: 0,
        stockCapitalIncrease: 0,
        rawRecords: [normalised.raw],
      });
    }
  }

  return Array.from(eventMap.values())
    .map((event) => {
      if (Number.isFinite(event.manualRatio) && event.manualRatio > 0) {
        event.manualRatio = Number(Math.round(event.manualRatio * 1e8) / 1e8);
      }
      return event;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function applyBackwardAdjustments(priceRows, _dividendRecords, options = {}) {
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

  const events = preparedEvents || [];

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
    let ratioSource = 'formula';
    let ratio = null;
    if (
      Number.isFinite(event.manualRatio) &&
      event.manualRatio > 0 &&
      event.manualRatio < 10
    ) {
      ratio = Number(Math.round(event.manualRatio * 1e8) / 1e8);
      ratioSource = event.ratioSource || event.manualRatioSource || 'manual';
    } else {
      ratio = computeAdjustmentRatio(baseClose, event);
    }
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 10) {
      adjustments.push({
        ...event,
        ratio: 1,
        skipped: true,
        reason: 'ratioOutOfRange',
        ratioSource: event.ratioSource || ratioSource,
      });
      continue;
    }
    const firstAffectedIndex = baseIndex > 0 ? baseIndex - 1 : -1;
    const firstAffectedRow =
      firstAffectedIndex >= 0 && firstAffectedIndex < sortedRows.length
        ? sortedRows[firstAffectedIndex]
        : null;
    const factorBeforeValue =
      firstAffectedIndex >= 0 && Number.isFinite(multipliers[firstAffectedIndex])
        ? multipliers[firstAffectedIndex]
        : null;
    const rawCloseBeforeValue = (() => {
      if (!firstAffectedRow || typeof firstAffectedRow !== 'object') return null;
      const rawCandidate =
        Number(firstAffectedRow.rawClose ?? firstAffectedRow.raw_close ?? null);
      if (Number.isFinite(rawCandidate) && rawCandidate > 0) {
        return rawCandidate;
      }
      const closeCandidate = Number(firstAffectedRow.close ?? null);
      return Number.isFinite(closeCandidate) && closeCandidate > 0
        ? closeCandidate
        : null;
    })();

    for (let i = 0; i < baseIndex; i += 1) {
      multipliers[i] *= ratio;
    }

    const factorAfterValue =
      firstAffectedIndex >= 0 && Number.isFinite(multipliers[firstAffectedIndex])
        ? multipliers[firstAffectedIndex]
        : null;
    const expectedFactorValue = Number.isFinite(factorBeforeValue)
      ? factorBeforeValue * ratio
      : ratio;
    const expectedAdjustedCloseValue =
      Number.isFinite(rawCloseBeforeValue) && Number.isFinite(factorAfterValue)
        ? safeRound(rawCloseBeforeValue * factorAfterValue)
        : null;
    adjustments.push({
      ...event,
      ratio,
      appliedDate: sortedRows[baseIndex]?.date || event.date,
      baseClose,
      baseRowIndex: baseIndex,
      ratioSource: event.ratioSource || ratioSource,
      firstAffectedDate: firstAffectedRow?.date || null,
      firstAffectedIndex,
      factorBefore: Number.isFinite(factorBeforeValue) ? factorBeforeValue : null,
      factorAfter: Number.isFinite(factorAfterValue) ? factorAfterValue : null,
      targetFactor: Number.isFinite(expectedFactorValue) ? expectedFactorValue : null,
      rawCloseBefore:
        Number.isFinite(rawCloseBeforeValue) && rawCloseBeforeValue > 0
          ? rawCloseBeforeValue
          : null,
      expectedAdjustedClose: expectedAdjustedCloseValue,
    });
  }

  const resolveBaseValue = (row, key) => {
    if (!row || typeof row !== 'object') return null;
    const camelKey = `raw${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const snakeKey = `raw_${key}`;
    const directRaw = row[camelKey];
    const direct = Number(directRaw);
    if (directRaw !== null && directRaw !== undefined && Number.isFinite(direct)) {
      return direct;
    }
    const snakeRaw = row[snakeKey];
    const snake = Number(snakeRaw);
    if (snakeRaw !== null && snakeRaw !== undefined && Number.isFinite(snake)) {
      return snake;
    }
    const baseRaw = row[key];
    const base = Number(baseRaw);
    if (baseRaw !== null && baseRaw !== undefined && Number.isFinite(base)) {
      return base;
    }
    return null;
  };

  const adjustedRows = sortedRows.map((row, index) => {
    const factor = multipliers[index];
    const finalFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const baseOpen = resolveBaseValue(row, 'open');
    const baseHigh = resolveBaseValue(row, 'high');
    const baseLow = resolveBaseValue(row, 'low');
    const baseClose = resolveBaseValue(row, 'close');
    const scaleValue = (value) =>
      Number.isFinite(value) ? safeRound(value * finalFactor) : value ?? null;
    const open = scaleValue(baseOpen);
    const high = scaleValue(baseHigh);
    const low = scaleValue(baseLow);
    const close = scaleValue(baseClose);
    const change = 0;
    return {
      ...row,
      open,
      high,
      low,
      close,
      change,
      rawOpen: Number.isFinite(baseOpen) ? baseOpen : row.rawOpen ?? null,
      rawHigh: Number.isFinite(baseHigh) ? baseHigh : row.rawHigh ?? null,
      rawLow: Number.isFinite(baseLow) ? baseLow : row.rawLow ?? null,
      rawClose: Number.isFinite(baseClose) ? baseClose : row.rawClose ?? null,
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
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
        combined.push({ ...row, stockName, priceSource: 'TWSE (原始)' });
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
      const response = await fetchImpl(url.toString());
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
    .map((row) => ({ ...row, stockName: finalStockName, priceSource: label || 'FinMind (原始)' }));
  const priceSource = label || 'FinMind (原始)';
  return { stockName: finalStockName, rows, priceSource };
}

function resolveYahooSymbol(stockNo, market) {
  if (!stockNo) return null;
  const trimmed = String(stockNo).trim();
  if (!trimmed) return null;
  const suffix = market === 'TPEX' ? YAHOO_TPEX_SUFFIX : YAHOO_TWSE_SUFFIX;
  return `${trimmed}${suffix}`;
}

function buildYahooPeriodRange(startDate, endDate) {
  const now = new Date();
  const from = new Date(startDate.getTime());
  const to = new Date(endDate.getTime());

  from.setUTCMonth(from.getUTCMonth() - 2);
  to.setUTCMonth(to.getUTCMonth() + 2);

  if (to > now) {
    to.setTime(now.getTime());
  }
  if (to <= from) {
    to.setTime(from.getTime() + DAY_SECONDS * 1000);
  }

  const period1 = Math.max(0, Math.floor(from.getTime() / 1000));
  const period2 = Math.max(period1 + DAY_SECONDS, Math.floor(to.getTime() / 1000) + DAY_SECONDS);
  return { period1, period2 };
}

function normaliseYahooDailySeries(stockNo, market, yahooData, options = {}) {
  const label = options.label || YAHOO_PRICE_SOURCE_LABEL;
  if (!yahooData || typeof yahooData !== 'object') {
    return { stockName: stockNo, rows: [], priceSource: label, dataSource: label };
  }
  const { stockName: resolvedNameRaw, quote = {}, adjclose = [], timestamps = [] } = yahooData;
  const resolvedName = resolvedNameRaw || stockNo;
  const rows = [];
  let previousAdjClose = null;

  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = Number(Array.isArray(timestamps) ? timestamps[i] : null);
    if (!Number.isFinite(ts)) continue;
    const date = new Date(ts * 1000);
    if (Number.isNaN(date.getTime())) continue;
    const isoDate = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

    const baseOpen = parseNumber(quote.open?.[i]);
    const baseHigh = parseNumber(quote.high?.[i]);
    const baseLow = parseNumber(quote.low?.[i]);
    const baseClose = parseNumber(quote.close?.[i]);
    const adjCloseValue = Array.isArray(adjclose) ? parseNumber(adjclose[i]) : null;
    const volumeValue = parseNumber(quote.volume?.[i]);

    const referenceClose = Number.isFinite(baseClose)
      ? baseClose
      : Number.isFinite(adjCloseValue)
        ? adjCloseValue
        : Number.isFinite(baseOpen)
          ? baseOpen
          : null;
    const finalAdjClose = Number.isFinite(adjCloseValue) ? adjCloseValue : referenceClose;
    if (!Number.isFinite(finalAdjClose)) continue;

    const scalingBase = Number.isFinite(referenceClose) && Math.abs(referenceClose) > 1e-12 ? referenceClose : null;
    const scale = Number.isFinite(scalingBase) ? finalAdjClose / scalingBase : 1;

    const adjustedOpen = Number.isFinite(baseOpen)
      ? safeRound(baseOpen * scale)
      : safeRound(finalAdjClose);
    const adjustedHigh = Number.isFinite(baseHigh)
      ? safeRound(baseHigh * scale)
      : safeRound(Math.max(finalAdjClose, adjustedOpen ?? finalAdjClose));
    const adjustedLow = Number.isFinite(baseLow)
      ? safeRound(baseLow * scale)
      : safeRound(Math.min(finalAdjClose, adjustedOpen ?? finalAdjClose));
    const adjustedClose = safeRound(finalAdjClose);

    if (
      adjustedOpen === null ||
      adjustedHigh === null ||
      adjustedLow === null ||
      adjustedClose === null
    ) {
      continue;
    }

    const resolvedVolume = Number.isFinite(volumeValue) ? Math.round(volumeValue) : 0;
    const previous = Number.isFinite(previousAdjClose) ? previousAdjClose : null;
    const change = previous !== null ? safeRound(adjustedClose - previous) ?? 0 : 0;

    rows.push({
      date: isoDate,
      open: adjustedOpen,
      high: adjustedHigh,
      low: adjustedLow,
      close: adjustedClose,
      change,
      volume: resolvedVolume,
      stockName: resolvedName,
      priceSource: label,
      rawOpen: Number.isFinite(baseOpen) ? safeRound(baseOpen) : null,
      rawHigh: Number.isFinite(baseHigh) ? safeRound(baseHigh) : null,
      rawLow: Number.isFinite(baseLow) ? safeRound(baseLow) : null,
      rawClose: Number.isFinite(referenceClose) ? safeRound(referenceClose) : null,
    });

    previousAdjClose = adjustedClose;
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { stockName: resolvedName, rows, priceSource: label, dataSource: label };
}

async function fetchYahooAdjustedSeries(stockNo, startDate, endDate, market) {
  const symbol = resolveYahooSymbol(stockNo, market);
  if (!symbol) {
    throw new Error('Yahoo Finance 代號無效');
  }

  console.log(`[calculateAdjustedPrice] 嘗試 Yahoo Finance 調整價: ${symbol}`);
  const { period1, period2 } = buildYahooPeriodRange(startDate, endDate);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('includeAdjustedClose', 'true');
  if (Number.isFinite(period1)) {
    url.searchParams.set('period1', String(period1));
  }
  if (Number.isFinite(period2)) {
    url.searchParams.set('period2', String(period2));
  }

  const response = await fetchImpl(url.toString(), { headers: { 'User-Agent': DEFAULT_USER_AGENT } });
  if (!response.ok) {
    const error = new Error(`Yahoo HTTP ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const json = await response.json();
  if (json?.chart?.error) {
    const yahooError = new Error(json.chart.error.description || json.chart.error.code || 'Yahoo Finance 查詢失敗');
    yahooError.statusCode = json.chart.error.code ? Number(json.chart.error.code) : undefined;
    throw yahooError;
  }

  const result = json?.chart?.result?.[0];
  if (!result || !Array.isArray(result.timestamp)) {
    throw new Error('Yahoo Finance 回傳資料格式異常');
  }

  return normaliseYahooDailySeries(stockNo, market, {
    stockName: result.meta?.shortName || stockNo,
    quote: Array.isArray(result.indicators?.quote) ? result.indicators.quote[0] || {} : {},
    adjclose: Array.isArray(result.indicators?.adjclose)
      ? result.indicators.adjclose[0]?.adjclose || []
      : [],
    timestamps: result.timestamp,
  });
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

  const resolveBaseValue = (row, key) => {
    if (!row || typeof row !== 'object') return null;
    const camelKey = `raw${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const snakeKey = `raw_${key}`;
    const directRaw = row[camelKey];
    const direct = Number(directRaw);
    if (directRaw !== null && directRaw !== undefined && Number.isFinite(direct)) {
      return direct;
    }
    const snakeRaw = row[snakeKey];
    const snake = Number(snakeRaw);
    if (snakeRaw !== null && snakeRaw !== undefined && Number.isFinite(snake)) {
      return snake;
    }
    const baseRaw = row[key];
    const base = Number(baseRaw);
    if (baseRaw !== null && baseRaw !== undefined && Number.isFinite(base)) {
      return base;
    }
    return null;
  };

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

    const baseOpen = resolveBaseValue(row, 'open');
    const baseHigh = resolveBaseValue(row, 'high');
    const baseLow = resolveBaseValue(row, 'low');
    const baseClose = resolveBaseValue(row, 'close');
    const adjustedRow = {
      ...row,
      open: scaleValue(baseOpen, factor),
      high: scaleValue(baseHigh, factor),
      low: scaleValue(baseLow, factor),
      close: scaleValue(baseClose, factor),
      rawOpen: Number.isFinite(baseOpen) ? baseOpen : row.rawOpen ?? null,
      rawHigh: Number.isFinite(baseHigh) ? baseHigh : row.rawHigh ?? null,
      rawLow: Number.isFinite(baseLow) ? baseLow : row.rawLow ?? null,
      rawClose: Number.isFinite(baseClose) ? baseClose : row.rawClose ?? null,
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
    return { rows: [], matched: 0, responseLog: [] };
  }

  const rowsMap = new Map();
  const responseLog = [];
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
      responseLog.push({
        spanStart: span.startISO,
        spanEnd: span.endISO,
        status: extractStatusCode(error) ?? null,
        message: error?.message || '',
        rowCount: null,
      });
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
      enriched.responseLog = responseLog.slice();
      throw enriched;
    }
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const payloadError = new Error(`FinMind 還原序列回應錯誤: ${json?.msg || 'unknown error'}`);
      payloadError.statusCode = json?.status;
      responseLog.push({
        spanStart: span.startISO,
        spanEnd: span.endISO,
        status: json?.status ?? null,
        message: json?.msg || payloadError.message || '',
        rowCount: Array.isArray(json?.data) ? json.data.length : 0,
      });
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
      payloadError.responseLog = responseLog.slice();
      throw payloadError;
    }

    const rowCount = Array.isArray(json?.data) ? json.data.length : 0;
    responseLog.push({
      spanStart: span.startISO,
      spanEnd: span.endISO,
      status: json?.status ?? null,
      message: json?.msg || '',
      rowCount,
    });

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
  return { rows, matched: rows.length, responseLog };
}


async function deriveAdjustedSeriesFallback({ stockNo, startISO, endISO, priceRows }) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return null;
  }

  let adjustedSeries;
  try {
    adjustedSeries = await fetchFinMindAdjustedPriceSeries(stockNo, startISO, endISO);
  } catch (error) {
    const responseLog = Array.isArray(error?.responseLog) ? error.responseLog : undefined;
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
        responseLog,
      },
    };
  }

  const responseLog = Array.isArray(adjustedSeries?.responseLog)
    ? adjustedSeries.responseLog
    : [];

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
        responseLog: responseLog.length > 0 ? responseLog : undefined,
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
        responseLog: responseLog.length > 0 ? responseLog : undefined,
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
      responseLog: responseLog.length > 0 ? responseLog : undefined,
    },
  };
}

async function deriveAdjustedSeriesFromDividendResult({
  stockNo,
  startISO,
  endISO,
  priceRows,
  priceRangeStartISO,
  priceRangeEndISO,
}) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return null;
  }

  let payload;
  let fetchError = null;
  try {
    payload = await fetchDividendResultSeries(stockNo, startISO, endISO);
  } catch (error) {
    fetchError = error;
  }

  if (fetchError) {
    const responses = Array.isArray(fetchError?.finmindMeta?.responses)
      ? fetchError.finmindMeta.responses.slice(0, 10)
      : [];
    const info = {
      applied: false,
      status: 'error',
      label: FINMIND_DIVIDEND_RESULT_LABEL,
      detail: fetchError.message || 'FinMind 配息結果失敗',
      responseLog: responses,
    };
    return {
      applied: false,
      rows: priceRows,
      adjustments: [],
      events: [],
      info,
      diagnostics: {
        totalRecords: 0,
        filteredRecords: 0,
        eventCount: 0,
        appliedAdjustments: 0,
        responseLog: responses,
      },
      statusMeta: {
        statusCode:
          fetchError?.finmindMeta?.statusCode ??
          fetchError?.statusCode ??
          extractStatusCode(fetchError) ??
          null,
        message: fetchError?.finmindMeta?.message || fetchError.message || null,
        spanStart: fetchError?.finmindMeta?.spanStart || null,
        spanEnd: fetchError?.finmindMeta?.spanEnd || null,
        dataCount: 0,
      },
      error: fetchError,
    };
  }

  const allRows = Array.isArray(payload?.rows) ? payload.rows : [];
  const filteredRows = filterDividendRecordsByPriceRange(
    allRows,
    priceRangeStartISO || startISO,
    priceRangeEndISO || endISO,
  );
  const events = buildDividendResultEvents(filteredRows);

  const { rows: adjustedRows, adjustments } = applyBackwardAdjustments(priceRows, [], {
    preparedEvents: events,
  });
  const applicationChecks = buildAdjustmentApplicationChecks(adjustments, adjustedRows);
  const debugLogEntries = buildAdjustmentDebugEntries(applicationChecks, {
    label: FINMIND_DIVIDEND_RESULT_LABEL,
    prefix: 'dividend',
  });

  const appliedAdjustments = adjustments.filter((item) => !item?.skipped);
  const applied = appliedAdjustments.length > 0;

  const infoDetailParts = [
    `原始 ${allRows.length} 筆`,
    `區間 ${filteredRows.length} 筆`,
    `事件 ${events.length} 件`,
    `成功 ${appliedAdjustments.length} 件`,
  ];

  const diagnostics = {
    totalRecords: allRows.length,
    filteredRecords: filteredRows.length,
    eventCount: events.length,
    appliedAdjustments: appliedAdjustments.length,
    responseLog: Array.isArray(payload?.responseLog)
      ? payload.responseLog.slice(0, 10)
      : [],
  };

  const info = {
    applied,
    status: applied ? 'success' : 'warning',
    label: FINMIND_DIVIDEND_RESULT_LABEL,
    detail: infoDetailParts.join(' ・ '),
    responseLog: diagnostics.responseLog,
  };

  const statusMeta = {
    statusCode: payload?.lastStatus ?? null,
    message: payload?.lastMessage || null,
    spanStart: payload?.fetchStartISO || null,
    spanEnd: payload?.fetchEndISO || null,
    dataCount: filteredRows.length,
  };

  return {
    applied,
    rows: applied ? adjustedRows : priceRows,
    adjustments,
    events,
    info,
    diagnostics,
    statusMeta,
    payload,
    applicationChecks,
    debugLog: debugLogEntries,
  };
}

async function deriveAdjustedSeriesFromSplitPrice({
  stockNo,
  startISO,
  endISO,
  priceRows,
  priceRangeStartISO,
  priceRangeEndISO,
}) {
  if (!Array.isArray(priceRows) || priceRows.length === 0) {
    return null;
  }

  let payload;
  let fetchError = null;
  try {
    payload = await fetchStockSplitSeries(stockNo, startISO, endISO);
  } catch (error) {
    fetchError = error;
  }

  if (fetchError) {
    const responses = Array.isArray(fetchError?.finmindMeta?.responses)
      ? fetchError.finmindMeta.responses.slice(0, 10)
      : [];
    const info = {
      applied: false,
      status: 'error',
      label: FINMIND_SPLIT_LABEL,
      detail: fetchError.message || 'FinMind 股票拆分失敗',
      responseLog: responses,
    };
    return {
      applied: false,
      rows: priceRows,
      adjustments: [],
      events: [],
      info,
      diagnostics: {
        totalRecords: 0,
        filteredRecords: 0,
        eventCount: 0,
        appliedAdjustments: 0,
        responseLog: responses,
      },
      statusMeta: {
        statusCode:
          fetchError?.finmindMeta?.statusCode ??
          fetchError?.statusCode ??
          extractStatusCode(fetchError) ??
          null,
        message: fetchError?.finmindMeta?.message || fetchError.message || null,
        spanStart: fetchError?.finmindMeta?.spanStart || null,
        spanEnd: fetchError?.finmindMeta?.spanEnd || null,
        dataCount: 0,
      },
      error: fetchError,
    };
  }

  const allRows = Array.isArray(payload?.rows) ? payload.rows : [];
  const filteredRows = filterDividendRecordsByPriceRange(
    allRows,
    priceRangeStartISO || startISO,
    priceRangeEndISO || endISO,
  );
  const events = buildSplitEvents(filteredRows);

  const { rows: adjustedRows, adjustments } = applyBackwardAdjustments(
    priceRows,
    [],
    {
      preparedEvents: events,
    },
  );
  const applicationChecks = buildAdjustmentApplicationChecks(adjustments, adjustedRows);
  const debugLogEntries = buildAdjustmentDebugEntries(applicationChecks, {
    label: FINMIND_SPLIT_LABEL,
    prefix: 'split',
  });

  const appliedAdjustments = adjustments.filter((item) => !item?.skipped);
  const applied = appliedAdjustments.length > 0;

  const infoDetailParts = [
    `原始 ${allRows.length} 筆`,
    `區間 ${filteredRows.length} 筆`,
    `事件 ${events.length} 件`,
    `成功 ${appliedAdjustments.length} 件`,
  ];

  const diagnostics = {
    totalRecords: allRows.length,
    filteredRecords: filteredRows.length,
    eventCount: events.length,
    appliedAdjustments: appliedAdjustments.length,
    responseLog: Array.isArray(payload?.responseLog)
      ? payload.responseLog.slice(0, 10)
      : [],
  };

  const info = {
    applied,
    status: applied ? 'success' : 'warning',
    label: FINMIND_SPLIT_LABEL,
    detail: infoDetailParts.join(' ・ '),
    responseLog: diagnostics.responseLog,
  };

  const statusMeta = {
    statusCode: payload?.lastStatus ?? null,
    message: payload?.lastMessage || null,
    spanStart: payload?.fetchStartISO || null,
    spanEnd: payload?.fetchEndISO || null,
    dataCount: filteredRows.length,
  };

  return {
    applied,
    rows: applied ? adjustedRows : priceRows,
    adjustments,
    events,
    info,
    diagnostics,
    statusMeta,
    payload,
    applicationChecks,
    debugLog: debugLogEntries,
  };
}

async function fetchDividendResultSeries(stockNo, startISO, endISO) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }
  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      rows: [],
      fetchStartISO: null,
      fetchEndISO: null,
      responseLog: [],
      lastStatus: null,
      lastMessage: null,
    };
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
      responseLog: [],
      lastStatus: null,
      lastMessage: null,
    };
  }

  const combined = [];
  const queue = [...spans];
  const responseLog = [];

  while (queue.length > 0) {
    const span = queue.shift();
    const spanDays = countSpanDays(span);
    const urlParams = {
      dataset: FINMIND_DIVIDEND_RESULT_DATASET,
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
            `[FinMind 配息結果段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              error.message || error
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      const enriched = new Error(
        `[FinMind 配息結果段錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
      );
      enriched.original = error;
      enriched.statusCode = extractStatusCode(error);
      enriched.finmindMeta = {
        dataset: FINMIND_DIVIDEND_RESULT_DATASET,
        spanStart: span.startISO,
        spanEnd: span.endISO,
        statusCode: enriched.statusCode,
        message: error?.message || '',
        responses: responseLog.slice(),
        type: 'network',
      };
      throw enriched;
    }

    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const payloadError = new Error(`FinMind 配息結果回應錯誤: ${json?.msg || 'unknown error'}`);
      payloadError.statusCode = json?.status;
      if (shouldSplitSpan(payloadError, spanDays, FINMIND_MIN_DIVIDEND_SPAN_DAYS)) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 配息結果段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              payloadError.message || payloadError
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      payloadError.finmindMeta = {
        dataset: FINMIND_DIVIDEND_RESULT_DATASET,
        spanStart: span.startISO,
        spanEnd: span.endISO,
        statusCode: payloadError.statusCode,
        message: json?.msg || payloadError.message,
        responses: [
          ...responseLog,
          {
            spanStart: span.startISO,
            spanEnd: span.endISO,
            status: json?.status ?? null,
            message: json?.msg || '',
            rowCount: Array.isArray(json?.data) ? json.data.length : 0,
          },
        ],
        type: 'payload',
      };
      throw payloadError;
    }

    const rowCount = Array.isArray(json?.data) ? json.data.length : 0;
    responseLog.push({
      spanStart: span.startISO,
      spanEnd: span.endISO,
      status: json?.status ?? null,
      message: json?.msg || '',
      rowCount,
    });
    combined.push(...json.data);
    if (queue.length > 0) {
      await delay(FINMIND_SEGMENT_COOLDOWN_MS);
    }
  }

  const lastEntry = responseLog.length > 0 ? responseLog[responseLog.length - 1] : null;

  return {
    rows: combined,
    fetchStartISO: formatISODateFromDate(fetchStart),
    fetchEndISO: formatISODateFromDate(endDate),
    responseLog,
    lastStatus: lastEntry?.status ?? null,
    lastMessage: lastEntry?.message || null,
  };
}

async function fetchStockSplitSeries(stockNo, startISO, endISO) {
  const token = process.env.FINMIND_TOKEN;
  if (!token) {
    throw new Error('未設定 FinMind Token');
  }

  const startDate = new Date(startISO);
  const endDate = new Date(endISO);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      rows: [],
      fetchStartISO: null,
      fetchEndISO: null,
      responseLog: [],
      lastStatus: null,
      lastMessage: null,
    };
  }

  const fetchStart = new Date(startDate.getTime());
  if (
    Number.isFinite(FINMIND_SPLIT_LOOKBACK_DAYS) &&
    FINMIND_SPLIT_LOOKBACK_DAYS > 0
  ) {
    fetchStart.setUTCDate(
      fetchStart.getUTCDate() - FINMIND_SPLIT_LOOKBACK_DAYS,
    );
  }
  if (fetchStart > endDate) {
    fetchStart.setTime(endDate.getTime());
  }

  const spans = enumerateDateSpans(fetchStart, endDate, FINMIND_SPLIT_SPAN_DAYS);
  if (spans.length === 0) {
    return {
      rows: [],
      fetchStartISO: formatISODateFromDate(fetchStart),
      fetchEndISO: formatISODateFromDate(endDate),
      responseLog: [],
      lastStatus: null,
      lastMessage: null,
    };
  }

  const combined = [];
  const queue = [...spans];
  const responseLog = [];

  while (queue.length > 0) {
    const span = queue.shift();
    const spanDays = countSpanDays(span);
    const urlParams = {
      dataset: FINMIND_SPLIT_DATASET,
      data_id: stockNo,
      start_date: span.startISO,
      end_date: span.endISO,
      token,
    };

    let json;
    try {
      json = await executeFinMindQuery(urlParams);
    } catch (error) {
      if (
        shouldSplitSpan(error, spanDays, FINMIND_MIN_SPLIT_SPAN_DAYS)
      ) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 股票拆分段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              error.message || error
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      const enriched = new Error(
        `[FinMind 股票拆分段錯誤] ${stockNo} ${span.startISO}~${span.endISO}: ${
          error.message || error
        }`,
      );
      enriched.original = error;
      enriched.statusCode = extractStatusCode(error);
      enriched.finmindMeta = {
        dataset: FINMIND_SPLIT_DATASET,
        spanStart: span.startISO,
        spanEnd: span.endISO,
        statusCode: enriched.statusCode,
        message: error?.message || '',
        responses: responseLog.slice(),
        type: 'network',
      };
      throw enriched;
    }

    if (json?.status !== 200 || !Array.isArray(json?.data)) {
      const payloadError = new Error(
        `FinMind 股票拆分回應錯誤: ${json?.msg || 'unknown error'}`,
      );
      payloadError.statusCode = json?.status;
      if (
        shouldSplitSpan(
          payloadError,
          spanDays,
          FINMIND_MIN_SPLIT_SPAN_DAYS,
        )
      ) {
        const split = splitSpan(span);
        if (split && split.length === 2) {
          console.warn(
            `[FinMind 股票拆分段拆分] ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d) -> ${split[0].startISO}~${split[0].endISO} + ${split[1].startISO}~${split[1].endISO}; 原因: ${
              payloadError.message || payloadError
            }`,
          );
          await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
          queue.unshift(...split);
          continue;
        }
      }
      payloadError.finmindMeta = {
        dataset: FINMIND_SPLIT_DATASET,
        spanStart: span.startISO,
        spanEnd: span.endISO,
        statusCode: payloadError.statusCode,
        message: json?.msg || payloadError.message,
        responses: [
          ...responseLog,
          {
            spanStart: span.startISO,
            spanEnd: span.endISO,
            status: json?.status ?? null,
            message: json?.msg || '',
            rowCount: Array.isArray(json?.data) ? json.data.length : 0,
          },
        ],
        type: 'payload',
      };
      throw payloadError;
    }

    const rowCount = Array.isArray(json?.data) ? json.data.length : 0;
    responseLog.push({
      spanStart: span.startISO,
      spanEnd: span.endISO,
      status: json?.status ?? null,
      message: json?.msg || '',
      rowCount,
    });
    combined.push(...json.data);
    if (queue.length > 0) {
      await delay(FINMIND_SEGMENT_COOLDOWN_MS);
    }
  }

  const lastEntry =
    responseLog.length > 0 ? responseLog[responseLog.length - 1] : null;

  return {
    rows: combined,
    fetchStartISO: formatISODateFromDate(fetchStart),
    fetchEndISO: formatISODateFromDate(endDate),
    responseLog,
    lastStatus: lastEntry?.status ?? null,
    lastMessage: lastEntry?.message || null,
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

function formatNumberForLog(value, digits = 6) {
  if (!Number.isFinite(value)) return '—';
  const fixed = Number(value).toFixed(digits);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
}

function formatPercentForLog(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  const scaled = value * 100;
  return `${formatNumberForLog(scaled, digits)}%`;
}

function buildAdjustmentApplicationChecks(adjustments = [], adjustedRows = []) {
  if (!Array.isArray(adjustments) || adjustments.length === 0) {
    return [];
  }
  const rows = Array.isArray(adjustedRows) ? adjustedRows : [];
  return adjustments.map((adjustment, index) => {
    const firstAffectedIndex = Number.isFinite(adjustment?.firstAffectedIndex)
      ? adjustment.firstAffectedIndex
      : Number.isFinite(adjustment?.baseRowIndex)
        ? adjustment.baseRowIndex - 1
        : -1;
    const firstRow =
      firstAffectedIndex >= 0 && firstAffectedIndex < rows.length
        ? rows[firstAffectedIndex]
        : null;
    const observedFactorRaw = Number(firstRow?.adjustedFactor ?? null);
    let expectedFactorRaw = Number(
      Number.isFinite(adjustment?.manualRatio)
        ? adjustment.manualRatio
        : null,
    );
    if (!Number.isFinite(expectedFactorRaw) || expectedFactorRaw <= 0) {
      expectedFactorRaw = Number(
        Number.isFinite(adjustment?.factorAfter)
          ? adjustment.factorAfter
          : Number.isFinite(adjustment?.targetFactor)
            ? adjustment.targetFactor
            : null,
      );
    }
    const downstreamMultiplier = Number(
      Number.isFinite(observedFactorRaw) &&
        Number.isFinite(expectedFactorRaw) &&
        expectedFactorRaw !== 0
        ? observedFactorRaw / expectedFactorRaw
        : null,
    );
    const normalisedObservedFactor = Number(
      Number.isFinite(downstreamMultiplier) &&
        downstreamMultiplier !== 0
        ? observedFactorRaw / downstreamMultiplier
        : observedFactorRaw,
    );
    const expectedFactor = Number.isFinite(expectedFactorRaw)
      ? expectedFactorRaw
      : null;
    const rawClose = Number(
      firstRow?.rawClose ??
        firstRow?.raw_close ??
        adjustment?.rawCloseBefore ??
        null,
    );
    const adjustedClose = Number(firstRow?.close ?? null);
    const expectedAdjustedClose = Number(
      Number.isFinite(adjustment?.expectedAdjustedClose)
        ? adjustment.expectedAdjustedClose
        : Number.isFinite(rawClose) && Number.isFinite(expectedFactor)
          ? safeRound(rawClose * expectedFactor)
          : null,
    );
    const factorDiff = Number(
      Number.isFinite(normalisedObservedFactor) && Number.isFinite(expectedFactor)
        ? normalisedObservedFactor - expectedFactor
        : null,
    );
    const relativeDiff = Number(
      Number.isFinite(factorDiff) && Number.isFinite(expectedFactor) && expectedFactor !== 0
        ? Math.abs(factorDiff) / Math.abs(expectedFactor)
        : null,
    );
    let status = 'info';
    if (adjustment?.skipped) {
      status = 'skipped';
    } else if (Number.isFinite(relativeDiff)) {
      status = relativeDiff <= 1e-4 ? 'success' : 'warning';
    } else if (Number.isFinite(normalisedObservedFactor) && Number.isFinite(expectedFactor)) {
      status = 'success';
    }
    return {
      index,
      status,
      skipped: Boolean(adjustment?.skipped),
      source: adjustment?.source || adjustment?.label || adjustment?.dataset || '還原事件',
      dataset: adjustment?.dataset || null,
      date: adjustment?.date || null,
      appliedDate: adjustment?.appliedDate || null,
      firstAffectedDate: firstRow?.date || adjustment?.firstAffectedDate || null,
      firstAffectedIndex,
      ratio: Number(adjustment?.ratio ?? null),
      manualRatio: Number(adjustment?.manualRatio ?? null),
      beforePrice: Number(adjustment?.beforePrice ?? null),
      afterPrice: Number(adjustment?.afterPrice ?? null),
      baseClose: Number(adjustment?.baseClose ?? null),
      rawClose,
      adjustedClose: Number.isFinite(adjustedClose) ? adjustedClose : null,
      expectedAdjustedClose: Number.isFinite(expectedAdjustedClose)
        ? expectedAdjustedClose
        : null,
      observedFactor: Number.isFinite(observedFactorRaw) ? observedFactorRaw : null,
      normalisedObservedFactor: Number.isFinite(normalisedObservedFactor)
        ? normalisedObservedFactor
        : null,
      expectedFactor: Number.isFinite(expectedFactor) ? expectedFactor : null,
      factorDiff: Number.isFinite(factorDiff) ? factorDiff : null,
      relativeDiff: Number.isFinite(relativeDiff) ? relativeDiff : null,
      downstreamMultiplier:
        Number.isFinite(downstreamMultiplier) && downstreamMultiplier !== 0
          ? downstreamMultiplier
          : null,
      ratioSource: adjustment?.ratioSource || null,
      reason: adjustment?.reason || null,
    };
  });
}

function buildAdjustmentDebugEntries(checks = [], options = {}) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return [];
  }
  const label = options.label || '還原檢查';
  const prefix = options.prefix || 'combined';
  return checks.map((check) => {
    const sourceLabel = check?.source || label;
    const dateLabel = check?.date || check?.appliedDate || '未知日期';
    const ratioValue = Number.isFinite(check?.manualRatio)
      ? check.manualRatio
      : Number.isFinite(check?.ratio)
        ? check.ratio
        : null;
    const ratioText = Number.isFinite(ratioValue)
      ? formatPercentForLog(ratioValue, 4)
      : '—';
    const lines = [];
    if (Number.isFinite(check?.beforePrice) && Number.isFinite(check?.afterPrice)) {
      lines.push(
        `資料來源：${sourceLabel} ・ 計算方式：after_price ÷ before_price = 手動還原係數`,
      );
      lines.push(`拆分基準日：${check?.date || '—'}`);
      lines.push(`手動還原比率：${ratioText}`);
      lines.push(
        `前收盤：${formatNumberForLog(check.beforePrice, 3)} ・ 後參考：${formatNumberForLog(check.afterPrice, 3)}`,
      );
      if (Number.isFinite(check.afterPrice) && Number.isFinite(check.beforePrice) && check.beforePrice !== 0) {
        lines.push(
          `計算：${formatNumberForLog(check.afterPrice, 3)} ÷ ${formatNumberForLog(check.beforePrice, 3)} ≈ ${formatNumberForLog(
            check.afterPrice / check.beforePrice,
            6,
          )}`,
        );
      }
    } else {
      lines.push(`資料來源：${sourceLabel}`);
      lines.push(`事件日期：${dateLabel}`);
      if (ratioText !== '—') {
        lines.push(`手動還原比率：${ratioText}`);
      }
    }

    if (Number.isFinite(check?.rawClose) && Number.isFinite(check?.observedFactor)) {
      const adjustedClose = Number.isFinite(check?.adjustedClose)
        ? check.adjustedClose
        : Number.isFinite(check?.rawClose) && Number.isFinite(check?.observedFactor)
          ? safeRound(check.rawClose * check.observedFactor)
          : null;
      const factorForComparison = Number.isFinite(check?.normalisedObservedFactor)
        ? check.normalisedObservedFactor
        : check.observedFactor;
      lines.push(
        `套用檢查：${check?.firstAffectedDate || '—'} 因子 ${formatNumberForLog(
          factorForComparison,
          6,
        )} ・ 預期 ${formatNumberForLog(check?.expectedFactor, 6)} ・ 差異 ${
          Number.isFinite(check?.relativeDiff)
            ? formatPercentForLog(check.relativeDiff, 3)
            : '—'
        }`,
      );
      if (
        Number.isFinite(check?.downstreamMultiplier) &&
        Number.isFinite(check?.observedFactor) &&
        Math.abs(check.downstreamMultiplier - 1) > 1e-6
      ) {
        lines.push(
          `最終係數：${formatNumberForLog(check.observedFactor, 6)}（含後續事件）`,
        );
      }
      if (Number.isFinite(adjustedClose)) {
        lines.push(
          `價格檢查：${formatNumberForLog(check.rawClose, 3)} × ${formatNumberForLog(
            check.observedFactor,
            6,
          )} ≈ ${formatNumberForLog(adjustedClose, 3)}`,
        );
      }
    } else if (check?.status === 'skipped') {
      lines.push(
        `套用檢查：事件被略過，原因 ${check?.reason || '未知'}`,
      );
    } else {
      lines.push('套用檢查：缺少前一交易日資料，無法驗證');
    }

    if (check?.ratioSource) {
      lines.push(`還原來源：${check.ratioSource}`);
    }

    return {
      key: `${prefix}-${check?.index ?? 0}`,
      title: `${sourceLabel} @ ${dateLabel}`,
      status: check?.status || 'info',
      lines,
      source: sourceLabel,
      date: dateLabel,
    };
  });
}

function buildDebugSteps({
  priceData,
  priceSourceLabel,
  dividendResultStats,
  splitStats,
  resultEvents,
  adjustments,
  fallbackInfo,
  priceDiagnostics = null,
}) {
  const priceRows = Array.isArray(priceData?.rows) ? priceData.rows.length : 0;
  const totalDividendRows = Number.isFinite(dividendResultStats?.totalRecords)
    ? dividendResultStats.totalRecords
    : Array.isArray(dividendResultStats?.rawRecords)
      ? dividendResultStats.rawRecords.length
      : 0;
  const filteredDividendRows = Number.isFinite(dividendResultStats?.filteredRecords)
    ? dividendResultStats.filteredRecords
    : 0;
  const normalisedEvents = Array.isArray(resultEvents) ? resultEvents.length : 0;
  const appliedAdjustments = Array.isArray(adjustments)
    ? adjustments.filter((event) => !event?.skipped).length
    : 0;
  const skippedAdjustments = Array.isArray(adjustments)
    ? adjustments.filter((event) => event?.skipped).length
    : 0;
  const skipReasons = summariseAdjustmentSkipReasons(adjustments);

  const statusLabelMap = {
    success: '成功',
    error: '失敗',
    warning: '警示',
    fallback: '備援',
    info: '資訊',
  };

  const basePriceDetailRaw = `${priceRows} 筆 ・ ${priceSourceLabel || priceData?.priceSource || ''}`;
  const basePriceDetail = basePriceDetailRaw.trim();
  let attemptsDetail = '';
  if (Array.isArray(priceDiagnostics?.attempts) && priceDiagnostics.attempts.length > 0) {
    attemptsDetail = priceDiagnostics.attempts
      .map((attempt) => {
        if (!attempt || typeof attempt !== 'object') return null;
        const source = attempt.source || '來源';
        const statusToken = statusLabelMap[attempt.status] || attempt.status || '資訊';
        const fragments = [];
        if (Number.isFinite(attempt.statusCode)) {
          fragments.push(`狀態 ${attempt.statusCode}`);
        }
        if (attempt.reason) {
          fragments.push(String(attempt.reason));
        }
        if (attempt.detail) {
          fragments.push(String(attempt.detail));
        }
        const suffix = fragments.length > 0 ? `（${fragments.join('；')}）` : '';
        return `${source}：${statusToken}${suffix}`;
      })
      .filter(Boolean)
      .join(' → ');
  }
  const priceDetailParts = [];
  if (basePriceDetail) {
    priceDetailParts.push(basePriceDetail);
  }
  if (attemptsDetail) {
    priceDetailParts.push(attemptsDetail);
  }
  const priceDetail = priceDetailParts.join('｜') || `${priceRows} 筆`;

  const steps = [
    {
      key: 'priceFetch',
      label: '價格資料',
      status: priceRows > 0 ? 'success' : 'error',
      detail: priceDetail,
    },
    {
      key: 'dividendResultFetch',
      label: '配息結果',
      status: totalDividendRows > 0 ? 'success' : 'warning',
      detail: `原始 ${totalDividendRows} 筆 ・ 區間 ${filteredDividendRows} 筆`,
    },
  ];

  if (splitStats) {
    const totalSplitRows = Number.isFinite(splitStats.totalRecords)
      ? splitStats.totalRecords
      : Array.isArray(splitStats.rawRecords)
        ? splitStats.rawRecords.length
        : 0;
    const filteredSplitRows = Number.isFinite(splitStats.filteredRecords)
      ? splitStats.filteredRecords
      : 0;
    steps.push({
      key: 'splitFetch',
      label: '股票拆分',
      status: totalSplitRows > 0 ? 'success' : 'warning',
      detail: `原始 ${totalSplitRows} 筆 ・ 區間 ${filteredSplitRows} 筆`,
    });
  }

  steps.push(
    {
      key: 'dividendResultEvents',
      label: '還原事件',
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
  );

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
  splitStats = null,
) {
  const basePriceSource =
    priceSourceLabel || priceData.priceSource || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)');
  const {
    resultFilteredCount,
    resultTotalCount,
    eventCount,
    lookbackWindowDays,
    fetchStartISO,
    fetchEndISO,
    dividendSourceLabel,
    backupOnly,
  } = dividendStats || {};

  const splitEventCount = Number.isFinite(splitStats?.eventCount)
    ? splitStats.eventCount
    : undefined;
  const splitFilteredCount = Number.isFinite(splitStats?.filteredRecords)
    ? splitStats.filteredRecords
    : undefined;
  const splitTotalCount = Number.isFinite(splitStats?.totalRecords)
    ? splitStats.totalRecords
    : undefined;
  const splitFetchStart = splitStats?.fetchStartISO || undefined;
  const splitFetchEnd = splitStats?.fetchEndISO || undefined;

  const appliedEvents = Array.isArray(adjustments)
    ? adjustments.filter((event) => !event?.skipped)
    : [];
  const skippedEvents = Array.isArray(adjustments)
    ? adjustments.filter((event) => event?.skipped)
    : [];
  const skipReasons = summariseAdjustmentSkipReasons(adjustments);
  const hasDividendAdjustments = appliedEvents.length > 0;

  const uniqueSources = new Set([basePriceSource]);
  if (hasDividendAdjustments) {
    uniqueSources.add(FINMIND_DIVIDEND_LABEL);
  } else if (backupOnly) {
    uniqueSources.add(YAHOO_BACKUP_SOURCE_LABEL);
  }
  if (
    splitStats &&
    Number.isFinite(splitStats.eventCount) &&
    splitStats.eventCount > 0
  ) {
    uniqueSources.add(`${FINMIND_SPLIT_LABEL}`);
  }
  if (fallbackInfo?.applied) {
    uniqueSources.add(fallbackInfo.label || FINMIND_ADJUSTED_LABEL);
  }

  return {
    priceRows: Array.isArray(priceData.rows) ? priceData.rows.length : 0,
    dividendRows: Number.isFinite(resultFilteredCount) ? resultFilteredCount : undefined,
    dividendRowsTotal: Number.isFinite(resultTotalCount) ? resultTotalCount : undefined,
    dividendEvents: Number.isFinite(eventCount) ? eventCount : undefined,
    dividendFetchStart: fetchStartISO || undefined,
    dividendFetchEnd: fetchEndISO || undefined,
    dividendLookbackDays: Number.isFinite(lookbackWindowDays) ? lookbackWindowDays : undefined,
    adjustmentEvents: appliedEvents.length,
    skippedEvents: skippedEvents.length,
    adjustmentSkipReasons:
      skipReasons && Object.keys(skipReasons).length > 0 ? skipReasons : undefined,
    priceSource: basePriceSource,
    dividendSource: dividendSourceLabel || FINMIND_DIVIDEND_RESULT_LABEL,
    sources: Array.from(uniqueSources),
    splitEvents: splitEventCount,
    splitRows: splitFilteredCount,
    splitRowsTotal: splitTotalCount,
    splitFetchStart,
    splitFetchEnd,
  };
}

export const __TESTING__ = {
  parseNumber,
  normaliseNumericText,
  resolveSubscriptionPrice,
  filterDividendRecordsByPriceRange,
  computeAdjustmentRatio,
  buildAdjustedRowsFromFactorMap,
  classifyFinMindOutcome,
  applyBackwardAdjustments,
  normaliseDividendResultRecord,
  buildDividendResultEvents,
  normaliseSplitRecord,
  buildSplitEvents,
  resolveYahooSymbol,
  buildYahooPeriodRange,
  normaliseYahooDailySeries,
  fetchYahooAdjustedSeries,
  setFetchImplementation,
  resetFetchImplementation,
};

export const handler = async (event) => {
  const finmindStatus = {
    tokenPresent: Boolean(process.env.FINMIND_TOKEN),
    dividendResult: null,
    splitPrice: null,
    price: null,
  };
  try {
    const params = event?.queryStringParameters || {};
    const stockNo = params.stockNo?.trim();
    const startISO = toISODate(params.startDate || params.start);
    const endISO = toISODate(params.endDate || params.end);
    const marketParam = params.market || params.marketType || 'TWSE';
    const market = marketParam.toUpperCase() === 'TPEX' ? 'TPEX' : 'TWSE';
    const splitParam =
      params.split ??
      params.splitAdjustment ??
      params.splitAdjusted ??
      params.enableSplit ??
      params.enableSplitAdjustment;
    const enableSplitAdjustment = (() => {
      if (typeof splitParam === 'undefined') return false;
      const token = String(splitParam).toLowerCase();
      return token === '1' || token === 'true' || token === 'on' || token === 'yes';
    })();

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
    const priceDiagnostics = { attempts: [] };
    const recordPriceAttempt = (attempt = {}) => {
      if (!attempt || typeof attempt !== 'object') return;
      const entry = {
        source: attempt.source || null,
        status: attempt.status || 'info',
        timestamp: new Date().toISOString(),
      };
      if (attempt.reason) {
        entry.reason = String(attempt.reason);
      }
      if (attempt.detail) {
        entry.detail = String(attempt.detail);
      }
      if (Number.isFinite(attempt.statusCode)) {
        entry.statusCode = Number(attempt.statusCode);
      }
      priceDiagnostics.attempts.push(entry);
    };

    const preferYahooAdjusted = !enableSplitAdjustment;
    let usingYahooPrimary = false;
    let yahooFailure = null;

    if (preferYahooAdjusted) {
      try {
        const yahooResult = await fetchYahooAdjustedSeries(stockNo, startDate, endDate, market);
        priceData = yahooResult;
        priceSourceLabel = yahooResult.priceSource;
        usingYahooPrimary = true;
        recordPriceAttempt({ source: yahooResult.priceSource, status: 'success' });
      } catch (error) {
        yahooFailure = error;
        recordPriceAttempt({
          source: YAHOO_PRICE_SOURCE_LABEL,
          status: 'error',
          reason: error?.message || String(error),
          statusCode: Number.isFinite(error?.statusCode) ? Number(error.statusCode) : undefined,
        });
        console.warn('[calculateAdjustedPrice] Yahoo 調整價取得失敗，改用本地備援來源。', {
          stockNo,
          market,
          error: error?.message || error,
        });
      }
    }

    if (!priceData) {
      if (market === 'TPEX') {
        priceData = await fetchFinMindPrice(stockNo, startISO, endISO);
        priceSourceLabel = priceData.priceSource;
        const reason = yahooFailure?.message
          ? `Yahoo 失敗: ${yahooFailure.message}`
          : undefined;
        recordPriceAttempt({
          source: priceData.priceSource,
          status: 'success',
          reason,
          detail: 'TPEX 主要來源',
        });
      } else {
        try {
          const twseResult = await fetchTwseRange(stockNo, startDate, endDate);
          priceData = twseResult;
          priceSourceLabel = twseResult.priceSource;
          const reason = yahooFailure?.message
            ? `Yahoo 失敗: ${yahooFailure.message}`
            : undefined;
          recordPriceAttempt({
            source: twseResult.priceSource || 'TWSE (原始)',
            status: 'success',
            reason,
          });
        } catch (primaryError) {
          recordPriceAttempt({
            source: 'TWSE (原始)',
            status: 'error',
            reason: primaryError?.message || String(primaryError),
            statusCode: Number.isFinite(primaryError?.statusCode)
              ? Number(primaryError.statusCode)
              : undefined,
          });
          console.warn(
            '[calculateAdjustedPrice] TWSE 原始資料取得失敗，改用 FinMind 備援來源。',
            primaryError,
          );
          const fallback = await fetchFinMindPrice(stockNo, startISO, endISO, {
            label: 'FinMind (原始備援)',
          });
          priceData = fallback;
          priceSourceLabel = fallback.priceSource;
          const fallbackReasons = [];
          if (primaryError?.message) {
            fallbackReasons.push(`TWSE 失敗: ${primaryError.message}`);
          }
          if (yahooFailure?.message) {
            fallbackReasons.push(`Yahoo 失敗: ${yahooFailure.message}`);
          }
          recordPriceAttempt({
            source: fallback.priceSource,
            status: 'success',
            reason: fallbackReasons.length > 0 ? fallbackReasons.join('；') : undefined,
            detail: 'FinMind 備援',
          });
        }
      }
    }

    priceDiagnostics.primarySource = priceSourceLabel || null;
    priceDiagnostics.preferYahoo = preferYahooAdjusted;
    priceDiagnostics.usingYahoo = usingYahooPrimary;
    if (yahooFailure) {
      priceDiagnostics.yahooFailure = {
        message: yahooFailure?.message || String(yahooFailure),
        statusCode: Number.isFinite(yahooFailure?.statusCode)
          ? Number(yahooFailure.statusCode)
          : null,
      };
    }

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

    priceDiagnostics.rowCount = priceRows.length;
    priceDiagnostics.rangeStart = priceRangeStartISO;
    priceDiagnostics.rangeEnd = priceRangeEndISO;

    const allowDividendAdjustments = enableSplitAdjustment || !usingYahooPrimary;

    const dividendDiagnostics = {
      dividendResult: null,
      responseLog: [],
      eventPreview: [],
      eventPreviewTotal: 0,
      eventPreviewMore: 0,
      eventPreviewLimit: DIVIDEND_RESULT_PREVIEW_LIMIT,
    };
    if (!allowDividendAdjustments) {
      dividendDiagnostics.dividendResult = {
        totalRecords: 0,
        filteredRecords: 0,
        eventCount: 0,
        appliedAdjustments: 0,
        skipped: true,
        skipReason: 'Yahoo Finance 已含還原收盤，未呼叫 FinMind 還原結果',
      };
      dividendDiagnostics.skipReason = 'Yahoo Finance 已含還原收盤';
      if (!finmindStatus.dividendResult) {
        finmindStatus.dividendResult = {
          status: 'skipped',
          label: 'Yahoo 調整價',
          hint: 'Yahoo Finance 已含還原收盤，未呼叫 FinMind',
          statusCode: null,
          message: null,
          dataset: FINMIND_DIVIDEND_RESULT_DATASET,
          spanStart: startISO,
          spanEnd: endISO,
        };
      }
    }
    const splitDiagnostics = {
      splitResult: null,
      responseLog: [],
      eventPreview: [],
      eventPreviewTotal: 0,
      eventPreviewMore: 0,
      eventPreviewLimit: DIVIDEND_RESULT_PREVIEW_LIMIT,
    };
    let fallbackInfo = null;
    let effectiveRows = priceRows;
    let effectiveAdjustments = [];
    let effectiveEvents = [];
    const fallbackHistory = [];

    const appendFallbackHistory = (info, extras = {}) => {
      if (!info) return;
      const payload = { ...info, ...extras };
      delete payload.history;
      fallbackHistory.push(payload);
    };

    const recomputeAppliedFlag = (collection) =>
      Array.isArray(collection) && collection.some((item) => !item?.skipped);

    const dividendResultOutcome = allowDividendAdjustments && priceRows.length
      ? await deriveAdjustedSeriesFromDividendResult({
          stockNo,
          startISO,
          endISO,
          priceRows,
          priceRangeStartISO,
          priceRangeEndISO,
        })
      : null;
    const splitResultOutcome =
      enableSplitAdjustment && priceRows.length
        ? await deriveAdjustedSeriesFromSplitPrice({
            stockNo,
            startISO,
            endISO,
            priceRows,
            priceRangeStartISO,
            priceRangeEndISO,
          })
        : null;

    if (dividendResultOutcome) {
      const diag = dividendResultOutcome.diagnostics || null;
      if (diag) {
        dividendDiagnostics.dividendResult = diag;
        if (Array.isArray(diag.responseLog)) {
          dividendDiagnostics.responseLog = diag.responseLog.slice(0, 10);
        }
      }
      if (dividendDiagnostics.responseLog.length === 0) {
        const fallbackLog = Array.isArray(dividendResultOutcome.payload?.responseLog)
          ? dividendResultOutcome.payload.responseLog.slice(0, 10)
          : [];
        dividendDiagnostics.responseLog = fallbackLog;
      }
      dividendDiagnostics.resultInfo = dividendResultOutcome.info || null;
      if (Array.isArray(dividendResultOutcome.debugLog)) {
        dividendDiagnostics.debugLog = dividendResultOutcome.debugLog;
      }
      if (Array.isArray(dividendResultOutcome.applicationChecks)) {
        dividendDiagnostics.applicationChecks = dividendResultOutcome.applicationChecks;
      }

      effectiveAdjustments = Array.isArray(dividendResultOutcome.adjustments)
        ? dividendResultOutcome.adjustments
        : [];
      effectiveEvents = Array.isArray(dividendResultOutcome.events)
        ? dividendResultOutcome.events
        : [];
      if (
        dividendResultOutcome.applied &&
        Array.isArray(dividendResultOutcome.rows) &&
        dividendResultOutcome.rows.length > 0
      ) {
        effectiveRows = dividendResultOutcome.rows;
      }

      const classificationResult = classifyFinMindOutcome({
        tokenPresent: finmindStatus.tokenPresent,
        dataset: FINMIND_DIVIDEND_RESULT_DATASET,
        statusCode: dividendResultOutcome.statusMeta?.statusCode,
        message: dividendResultOutcome.statusMeta?.message || null,
        rawMessage: dividendResultOutcome.error?.message || null,
        dataCount:
          dividendResultOutcome.statusMeta?.dataCount ??
          dividendResultOutcome.diagnostics?.eventCount ??
          effectiveEvents.length,
        spanStart:
          dividendResultOutcome.statusMeta?.spanStart ??
          dividendResultOutcome.payload?.fetchStartISO ??
          priceRangeStartISO ??
          startISO,
        spanEnd:
          dividendResultOutcome.statusMeta?.spanEnd ??
          dividendResultOutcome.payload?.fetchEndISO ??
          priceRangeEndISO ??
          endISO,
        error: dividendResultOutcome.error || null,
      });
      finmindStatus.dividendResult = classificationResult;
    }

    if (!Array.isArray(dividendDiagnostics.responseLog)) {
      dividendDiagnostics.responseLog = [];
    }

    if (splitResultOutcome) {
      const splitDiag = splitResultOutcome.diagnostics || null;
      const derivedSplit = {
        totalRecords: splitDiag?.totalRecords ?? 0,
        filteredRecords: splitDiag?.filteredRecords ?? 0,
        eventCount: splitDiag?.eventCount ?? 0,
        appliedAdjustments: splitDiag?.appliedAdjustments ?? 0,
        responseLog: Array.isArray(splitDiag?.responseLog)
          ? splitDiag.responseLog.slice(0, 10)
          : [],
        fetchStartISO: splitResultOutcome?.payload?.fetchStartISO || null,
        fetchEndISO: splitResultOutcome?.payload?.fetchEndISO || null,
        resultInfo: splitResultOutcome.info || null,
        debugLog: Array.isArray(splitResultOutcome?.debugLog)
          ? splitResultOutcome.debugLog
          : [],
        applicationChecks: Array.isArray(splitResultOutcome?.applicationChecks)
          ? splitResultOutcome.applicationChecks
          : [],
      };
      splitDiagnostics.splitResult = derivedSplit;
      dividendDiagnostics.splitResult = derivedSplit;
      splitDiagnostics.responseLog = derivedSplit.responseLog;
      if (!Array.isArray(splitDiagnostics.debugLog)) {
        splitDiagnostics.debugLog = [];
      }
      if (Array.isArray(splitResultOutcome?.debugLog)) {
        splitDiagnostics.debugLog = splitResultOutcome.debugLog;
      }
      if (Array.isArray(splitResultOutcome?.applicationChecks)) {
        splitDiagnostics.applicationChecks = splitResultOutcome.applicationChecks;
      }

      if (
        Array.isArray(splitResultOutcome.events) &&
        splitResultOutcome.events.length > 0
      ) {
        const previewItems = splitResultOutcome.events
          .slice(0, DIVIDEND_RESULT_PREVIEW_LIMIT)
          .map((event) => ({
            date: event.date || null,
            manualRatio: Number.isFinite(event.manualRatio)
              ? event.manualRatio
              : null,
            beforePrice: Number.isFinite(event.beforePrice)
              ? event.beforePrice
              : null,
            afterPrice: Number.isFinite(event.afterPrice)
              ? event.afterPrice
              : null,
          }));
        splitDiagnostics.eventPreview = previewItems;
        splitDiagnostics.eventPreviewTotal = splitResultOutcome.events.length;
        splitDiagnostics.eventPreviewMore = Math.max(
          0,
          splitResultOutcome.events.length - previewItems.length,
        );
      }

      const splitClassification = classifyFinMindOutcome({
        tokenPresent: finmindStatus.tokenPresent,
        dataset: FINMIND_SPLIT_DATASET,
        statusCode: splitResultOutcome.statusMeta?.statusCode,
        message: splitResultOutcome.statusMeta?.message || null,
        rawMessage: splitResultOutcome.error?.message || null,
        dataCount:
          splitResultOutcome.statusMeta?.dataCount ??
          splitResultOutcome.diagnostics?.eventCount ??
          (Array.isArray(splitResultOutcome.events)
            ? splitResultOutcome.events.length
            : 0),
        spanStart:
          splitResultOutcome.statusMeta?.spanStart ??
          splitResultOutcome.payload?.fetchStartISO ??
          priceRangeStartISO ??
          startISO,
        spanEnd:
          splitResultOutcome.statusMeta?.spanEnd ??
          splitResultOutcome.payload?.fetchEndISO ??
          priceRangeEndISO ??
          endISO,
        error: splitResultOutcome.error || null,
      });
      finmindStatus.splitPrice = splitClassification;
    }

    const appliedAdjustments = effectiveAdjustments.filter((event) => !event?.skipped);
    let hasAppliedAdjustments = appliedAdjustments.length > 0;
    const combinedApplicationChecks = buildAdjustmentApplicationChecks(
      effectiveAdjustments,
      effectiveRows,
    );
    const combinedDebugLog = buildAdjustmentDebugEntries(combinedApplicationChecks, {
      label: '整合還原流程',
      prefix: 'combined',
    });
    combinedApplicationChecks.forEach((check) => {
      const logPayload = {
        source: check.source,
        date: check.date,
        ratio: check.manualRatio ?? check.ratio ?? null,
        expectedFactor: check.expectedFactor,
        observedFactor: check.observedFactor,
        relativeDiff: check.relativeDiff,
        status: check.status,
      };
      if (check.status === 'warning') {
        console.warn('[calculateAdjustedPrice] 還原係數檢查異常', logPayload);
      } else if (check.status === 'skipped') {
        console.info('[calculateAdjustedPrice] 還原事件被略過', {
          ...logPayload,
          reason: check.reason || null,
        });
      } else {
        console.debug('[calculateAdjustedPrice] 還原係數檢查', logPayload);
      }
    });

    if (splitResultOutcome && Array.isArray(splitResultOutcome.events)) {
      const splitEvents = splitResultOutcome.events;
      if (splitEvents.length > 0) {
        const combinedEvents = [...effectiveEvents, ...splitEvents].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        const combinedResult = applyBackwardAdjustments(priceRows, [], {
          preparedEvents: combinedEvents,
        });
        effectiveEvents = combinedEvents;
        effectiveAdjustments = combinedResult.adjustments;
        if (Array.isArray(combinedResult.rows) && combinedResult.rows.length > 0) {
          effectiveRows = combinedResult.rows;
        }
        hasAppliedAdjustments = recomputeAppliedFlag(effectiveAdjustments);
        const recalculatedChecks = buildAdjustmentApplicationChecks(
          effectiveAdjustments,
          effectiveRows,
        );
        combinedApplicationChecks.splice(0, combinedApplicationChecks.length, ...recalculatedChecks);
        const updatedDebug = buildAdjustmentDebugEntries(recalculatedChecks, {
          label: '整合還原流程',
          prefix: 'combined',
        });
        combinedDebugLog.splice(0, combinedDebugLog.length, ...updatedDebug);
      }
    }

    if (effectiveEvents.length > 0) {
      const previewItems = effectiveEvents
        .slice(0, DIVIDEND_RESULT_PREVIEW_LIMIT)
        .map((event) => ({
          date: event.date || null,
          manualRatio: Number.isFinite(event.manualRatio) ? event.manualRatio : null,
          beforePrice: Number.isFinite(event.beforePrice) ? event.beforePrice : null,
          afterPrice: Number.isFinite(event.afterPrice) ? event.afterPrice : null,
          dividendTotal: Number.isFinite(event.dividendTotal) ? event.dividendTotal : null,
        }));
      dividendDiagnostics.eventPreview = previewItems;
      dividendDiagnostics.eventPreviewTotal = effectiveEvents.length;
      dividendDiagnostics.eventPreviewMore = Math.max(
        0,
        effectiveEvents.length - previewItems.length,
      );
    }
    if (dividendDiagnostics.dividendResult) {
      dividendDiagnostics.dividendResult.appliedAdjustments = appliedAdjustments.length;
      if (!Number.isFinite(dividendDiagnostics.dividendResult.eventCount)) {
        dividendDiagnostics.dividendResult.eventCount = effectiveEvents.length;
      }
    } else {
      dividendDiagnostics.dividendResult = {
        totalRecords: 0,
        filteredRecords: 0,
        eventCount: effectiveEvents.length,
        appliedAdjustments: appliedAdjustments.length,
      };
    }

    if (allowDividendAdjustments && !hasAppliedAdjustments && priceRows.length > 0) {
      const fallbackResult = await deriveAdjustedSeriesFallback({
        stockNo,
        startISO,
        endISO,
        priceRows,
      });
      if (fallbackResult) {
        appendFallbackHistory(fallbackResult.info, { attempt: 'finmindAdjustedSeries' });
        if (Array.isArray(fallbackResult.rows) && fallbackResult.rows.length > 0) {
          effectiveRows = fallbackResult.rows;
        }
        if (Array.isArray(fallbackResult.adjustments) && fallbackResult.adjustments.length > 0) {
          effectiveAdjustments = [...effectiveAdjustments, ...fallbackResult.adjustments];
        }
        hasAppliedAdjustments = recomputeAppliedFlag(effectiveAdjustments);
        const fallbackChecks = buildAdjustmentApplicationChecks(
          effectiveAdjustments,
          effectiveRows,
        );
        combinedApplicationChecks.splice(0, combinedApplicationChecks.length, ...fallbackChecks);
        const fallbackDebugEntries = buildAdjustmentDebugEntries(fallbackChecks, {
          label: fallbackResult.info?.label || 'FinMind 還原序列',
          prefix: 'fallback',
        });
        combinedDebugLog.splice(0, combinedDebugLog.length, ...fallbackDebugEntries);
      }
    }

    if (fallbackHistory.length > 0) {
      const latest = fallbackHistory[fallbackHistory.length - 1];
      fallbackInfo = { ...latest, history: fallbackHistory };
    }

    dividendDiagnostics.combinedDebugLog = combinedDebugLog;
    dividendDiagnostics.combinedChecks = combinedApplicationChecks;

    const debugSteps = buildDebugSteps({
      priceData,
      priceSourceLabel,
      dividendResultStats: dividendDiagnostics.dividendResult,
      splitStats: splitDiagnostics.splitResult,
      resultEvents: effectiveEvents,
      adjustments: effectiveAdjustments,
      fallbackInfo,
      priceDiagnostics,
    });

    const baseSourceLabel =
      priceSourceLabel || (market === 'TPEX' ? 'FinMind (原始)' : 'TWSE (原始)')
    ;
    const combinedSourceParts = [baseSourceLabel];
    if (hasAppliedAdjustments) {
      combinedSourceParts.push(FINMIND_DIVIDEND_LABEL);
    } else if (!allowDividendAdjustments) {
      combinedSourceParts.push(YAHOO_BACKUP_SOURCE_LABEL);
    }
    if (
      splitResultOutcome &&
      Array.isArray(splitResultOutcome.events) &&
      splitResultOutcome.events.length > 0
    ) {
      combinedSourceParts.push(FINMIND_SPLIT_LABEL);
    }
    if (fallbackInfo?.applied) {
      combinedSourceParts.push(fallbackInfo.label || FINMIND_ADJUSTED_LABEL);
    }
    const combinedSourceLabel = combinedSourceParts.join(' + ');

    const dividendSourceLabelForSummary = !allowDividendAdjustments
      ? YAHOO_PRICE_SOURCE_LABEL
      : fallbackInfo?.applied && fallbackInfo?.label
        ? fallbackInfo.label
        : FINMIND_DIVIDEND_RESULT_LABEL;

    const dividendSummaryStats = {
      resultFilteredCount: Number.isFinite(dividendDiagnostics.dividendResult?.filteredRecords)
        ? dividendDiagnostics.dividendResult.filteredRecords
        : undefined,
      resultTotalCount: Number.isFinite(dividendDiagnostics.dividendResult?.totalRecords)
        ? dividendDiagnostics.dividendResult.totalRecords
        : undefined,
      eventCount: Number.isFinite(dividendDiagnostics.dividendResult?.eventCount)
        ? dividendDiagnostics.dividendResult.eventCount
        : effectiveEvents.length,
      lookbackWindowDays: allowDividendAdjustments ? FINMIND_DIVIDEND_LOOKBACK_DAYS : undefined,
      fetchStartISO: allowDividendAdjustments
        ? dividendResultOutcome?.payload?.fetchStartISO || null
        : null,
      fetchEndISO: allowDividendAdjustments
        ? dividendResultOutcome?.payload?.fetchEndISO || null
        : null,
      dividendSourceLabel: dividendSourceLabelForSummary,
      backupOnly: !allowDividendAdjustments,
    };

    const splitSummaryStats = splitResultOutcome
      ? {
          resultFilteredCount: Number.isFinite(splitDiagnostics?.splitResult?.filteredRecords)
            ? splitDiagnostics.splitResult.filteredRecords
            : undefined,
          resultTotalCount: Number.isFinite(splitDiagnostics?.splitResult?.totalRecords)
            ? splitDiagnostics.splitResult.totalRecords
            : undefined,
          eventCount: Number.isFinite(splitDiagnostics?.splitResult?.eventCount)
            ? splitDiagnostics.splitResult.eventCount
            : Array.isArray(splitResultOutcome.events)
              ? splitResultOutcome.events.length
              : 0,
          fetchStartISO: splitResultOutcome?.payload?.fetchStartISO || null,
          fetchEndISO: splitResultOutcome?.payload?.fetchEndISO || null,
        }
      : null;

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
        dividendSummaryStats,
        fallbackInfo,
        splitSummaryStats,
      ),
      data: effectiveRows,
      adjustments: effectiveAdjustments,
      dividendEvents: effectiveEvents,
      priceDiagnostics,
      dividendDiagnostics,
      splitDiagnostics,
      debugSteps,
      adjustmentDebugLog: combinedDebugLog,
      adjustmentChecks: combinedApplicationChecks,
      adjustmentFallback: fallbackInfo || null,
      adjustmentFallbackApplied: Boolean(fallbackInfo?.applied),
      finmindStatus,
    };

    return jsonResponse(200, responseBody);
  } catch (error) {
    console.error('[calculateAdjustedPrice] 執行錯誤:', error);
    const statusCode = error?.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500;
    if (
      !finmindStatus.dividendResult &&
      error?.finmindMeta?.dataset === FINMIND_DIVIDEND_RESULT_DATASET
    ) {
      finmindStatus.dividendResult = classifyFinMindOutcome({
        tokenPresent: finmindStatus.tokenPresent,
        dataset: FINMIND_DIVIDEND_RESULT_DATASET,
        statusCode: Number.isFinite(error.statusCode)
          ? error.statusCode
          : error?.finmindMeta?.statusCode,
        message: error?.finmindMeta?.message || null,
        rawMessage: error?.message || null,
        dataCount: 0,
        spanStart: error?.finmindMeta?.spanStart || null,
        spanEnd: error?.finmindMeta?.spanEnd || null,
        error,
      });
    }
    if (
      !finmindStatus.splitPrice &&
      error?.finmindMeta?.dataset === FINMIND_SPLIT_DATASET
    ) {
      finmindStatus.splitPrice = classifyFinMindOutcome({
        tokenPresent: finmindStatus.tokenPresent,
        dataset: FINMIND_SPLIT_DATASET,
        statusCode: Number.isFinite(error.statusCode)
          ? error.statusCode
          : error?.finmindMeta?.statusCode,
        message: error?.finmindMeta?.message || null,
        rawMessage: error?.message || null,
        dataCount: 0,
        spanStart: error?.finmindMeta?.spanStart || null,
        spanEnd: error?.finmindMeta?.spanEnd || null,
        error,
      });
    }
    return jsonResponse(statusCode, {
      error: error?.message || 'calculateAdjustedPrice failed',
      version: FUNCTION_VERSION,
      finmindStatus,
    });
  }
};

export default handler;
