// Netlify Function: tpex proxy
// Node 18+ handler
import fetch from 'node-fetch';

// Helper to detect HTML error pages
function looksLikeHtml(text) {
  const trimmed = (text || '').trim();
  return /^<!doctype\s+html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

export async function handler(event) {
  try {
    const query = event.rawQuery || event.queryStringParameters || {};
    // build target URL from path param or full query
    const path = (query.path || '').replace(/^\//, '');
    const targetBase = 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/';
    const targetUrl = path ? `${targetBase}${path}` : targetBase;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'netlify-function-proxy/1.0',
        Accept: '*/*',
      },
    });

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    // If content looks like HTML error page, return standardized no-data response
    if (!res.ok || looksLikeHtml(text)) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'no_data' }),
      };
    }

    // Try to parse JSON; if fails, return text as is
    try {
      const json = JSON.parse(text);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify(json),
      };
    } catch (err) {
      // non-JSON but not HTML -> return raw text
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: text,
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ error: 'proxy_error', message: err.message }),
    };
  }
}
