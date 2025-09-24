// netlify/functions/cache-warmer.js
// Patch Tag: LB-CACHE-TIER-20250720A
import fetch from 'node-fetch';

const POPULAR_TWSE_STOCKS = [
  '2330', // 台積電
  '2317', // 鴻海
  '2454', // 聯發科
  '2412', // 中華電
  '1303', // 南亞
  '1301', // 台塑
  '2002', // 中鋼
  '2882', // 國泰金
  '2881', // 富邦金
  '0050', // 元大台灣50 ETF
];

const YEARS_TO_WARM = 5;

function buildRange(year) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

async function warmYear({ baseUrl, stockNo, marketType, year }) {
  const range = buildRange(year);
  const url = new URL('/.netlify/functions/stock-range', baseUrl);
  url.searchParams.set('stockNo', stockNo);
  url.searchParams.set('startDate', range.startDate);
  url.searchParams.set('endDate', range.endDate);
  url.searchParams.set('marketType', marketType);

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    // Keep raw text for logging
  }
  if (!response.ok) {
    const error = payload?.error || `HTTP ${response.status}`;
    throw new Error(error);
  }
  return {
    stockNo,
    marketType,
    year,
    rows: Array.isArray(payload?.aaData) ? payload.aaData.length : 0,
    meta: payload?.meta || null,
  };
}

function resolveBaseUrl() {
  const deployUrl = process.env.URL || process.env.DEPLOY_URL || process.env.DEPLOY_PRIME_URL;
  if (deployUrl) return deployUrl;
  const siteUrl = process.env.SITE_URL || process.env.NETLIFY_URL;
  if (siteUrl) return siteUrl;
  throw new Error('Unable to resolve Netlify site URL for cache warmer');
}

async function runWarmer() {
  const baseUrl = resolveBaseUrl();
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: YEARS_TO_WARM }, (_, idx) => currentYear - idx);
  const results = [];
  const errors = [];

  for (const stockNo of POPULAR_TWSE_STOCKS) {
    for (const year of years) {
      try {
        const result = await warmYear({ baseUrl, stockNo, marketType: 'TWSE', year });
        results.push(result);
      } catch (error) {
        errors.push({ stockNo, year, message: error.message || String(error) });
      }
    }
  }

  return { baseUrl, years, results, errors };
}

export const config = {
  schedule: '0 18 * * *', // 每日台灣凌晨 (UTC+8 => 02:00)
};

export default async () => {
  try {
    const summary = await runWarmer();
    return new Response(JSON.stringify({
      ok: true,
      warmed: summary.results.length,
      failed: summary.errors.length,
      years: summary.years,
      baseUrl: summary.baseUrl,
      errors: summary.errors,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[Cache Warmer] unexpected error', error);
    return new Response(JSON.stringify({ ok: false, error: error.message || 'warm-up failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
