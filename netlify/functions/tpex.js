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

    // Prepare browser-like headers to reduce bot-blocking
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.tpex.org.tw/',
      'Connection': 'keep-alive',
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'navigate'
    };

    // Simple timeout helper for fetch
    const fetchWithTimeout = (url, opts = {}, timeout = 8000) => {
      return Promise.race([
        fetch(url, opts),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout))
      ]);
    };

    // Retry logic
    let lastErr = null;
    let lastResText = null;
    let lastStatus = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetchWithTimeout(targetUrl, { method: 'GET', headers }, 8000 + attempt * 2000);
        lastStatus = res.status;
        const text = await res.text();
        lastResText = text && text.slice ? text.slice(0, 2000) : String(text);

        if (!res.ok || looksLikeHtml(text) || /errors?/i.test(text)) {
          lastErr = new Error(`remote returned non-ok or html (status ${res.status})`);
          // try again a few times
          await new Promise(r => setTimeout(r, attempt * 300));
          continue;
        }

        // Try JSON parse
        try {
          const json = JSON.parse(text);
          return {
            statusCode: 200,
            headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
            body: JSON.stringify(json)
          };
        } catch (e) {
          // Not JSON; return as plain text
          return {
            statusCode: 200,
            headers: Object.assign({ 'Content-Type': 'text/plain' }, CORS_HEADERS),
            body: text
          };
        }
      } catch (err) {
        lastErr = err;
        // small backoff
        await new Promise(r => setTimeout(r, attempt * 300));
        continue;
      }
    }

    // If all attempts failed, return diagnostics for easier debugging
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'no_data', diagnostics: { lastStatus, lastErr: String(lastErr), snippet: lastResText } })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'proxy_error', message: String(err && err.message ? err.message : err) })
    };
  }
};
