// Netlify Function: tpex proxy
// Node 18+ handler using global fetch

// Helper to detect HTML error pages
function looksLikeHtml(text) {
  const trimmed = (text || '').trim();
  return /^<!doctype\s+html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

exports.handler = async function(event, context) {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  try {
    const q = event.queryStringParameters || {};
    const path = (q.path || '').replace(/^\//, '');

    // Rebuild query string excluding 'path'
    const params = Object.assign({}, q);
    delete params.path;
    const qs = new URLSearchParams(params).toString();

    const targetBase = 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/';
    const targetUrl = path ? (qs ? `${targetBase}${path}?${qs}` : `${targetBase}${path}`) : (qs ? `${targetBase}?${qs}` : targetBase);

    console.log('[tpex function] fetching:', targetUrl);
    // Use global fetch (Node 18+ in Netlify). If not present, this will throw.
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'netlify-function-proxy/1.0',
        'Accept': '*/*'
      }
    });

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    console.log('[tpex function] fetched', { status: res.status, contentType, length: (text || '').length });

    // If remote returned non-ok or HTML error page, standardize as no_data
    if (!res.ok || looksLikeHtml(text) || /errors?/i.test(text)) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'no_data' })
      };
    }

    // Try JSON
    try {
      const json = JSON.parse(text);
      return {
        statusCode: 200,
        headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
        body: JSON.stringify(json)
      };
    } catch (e) {
      // Not JSON but not HTML -> pass through raw text
      return {
        statusCode: 200,
        headers: Object.assign({ 'Content-Type': 'text/plain' }, CORS_HEADERS),
        body: text
      };
    }
  } catch (err) {
    console.error('[tpex function] error', err && err.stack ? err.stack : err);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'proxy_error', message: String(err && err.message ? err.message : err) })
    };
  }
};
