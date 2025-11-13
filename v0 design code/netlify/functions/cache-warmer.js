// netlify/functions/cache-warmer.js
// Patch Tag: LB-CACHE-TIER-20250720A
// Patch Tag: LB-CACHE-WARMER-TAIWAN-20251029A
import fetch from 'node-fetch';

const POPULAR_TWSE_STOCKS = [
  '2330', // 台積電
  '2887', // 台新新光金
  '2891', // 中信金
  '2883', // 凱基金
  '2884', // 玉山金
  '2317', // 鴻海
  '2890', // 永豐金
  '2886', // 兆豐金
  '2303', // 聯電
  '2002', // 中鋼
  '2885', // 元大金
  '2892', // 第一金
  '5880', // 合庫金
  '2882', // 國泰金
  '2880', // 華南金
  '2881', // 富邦金
  '1303', // 南亞
  '1216', // 統一
  '1301', // 台塑
  '2412', // 中華電
  '5876', // 上海商銀
  '3711', // 日月光投控
  '3231', // 緯創
  '2382', // 廣達
  '2301', // 光寶科
  '4938', // 和碩
  '2308', // 台達電
  '4904', // 遠傳
  '2609', // 陽明
  '2327', // 國巨*
  '5871', // 中租-KY
  '2454', // 聯發科
  '3045', // 台灣大
  '2615', // 萬海
  '6505', // 台塑化
  '2603', // 長榮
  '6919', // 康霈*
  '2357', // 華碩
  '3034', // 聯詠
  '2912', // 統一超
  '2345', // 智邦
  '2379', // 瑞昱
  '2395', // 研華
  '3017', // 奇鋐
  '2383', // 台光電
  '2207', // 和泰車
  '6669', // 緯穎
  '3008', // 大立光
  '3661', // 世芯-KY
  '2059', // 川湖
  '0050', // 元大台灣50
  '00631L', // 元大台灣50正2（兩倍槓桿 ETF）
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
  schedule: '0 6 * * *', // 每日台灣時間 14:00 執行（UTC 06:00）
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
