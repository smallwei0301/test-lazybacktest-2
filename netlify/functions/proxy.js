const https = require('https');
const url = require('url');

const fetchWithRedirect = (requestUrl, options, retries = 3) => {
    return new Promise((resolve, reject) => {
        console.log(`[Proxy Fetch] Attempting to fetch: ${requestUrl}`);
        const request = https.get(requestUrl, options, (response) => {
            console.log(`[Proxy Fetch] Status: ${response.statusCode} for ${requestUrl}`);
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (retries > 0) {
                    console.log(`[Proxy Fetch] Redirecting to: ${response.headers.location}`);
                    fetchWithRedirect(response.headers.location, options, retries - 1)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error('Too many redirects'));
                }
            } else {
                let body = '';
                response.on('data', (chunk) => (body += chunk));
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: body
                    });
                });
            }
        });
        request.on('error', (err) => reject(err));
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error('Request timed out'));
        });
        request.end();
    });
};

exports.handler = async function(event, context) {
    console.log('[Proxy Handler] Received request');
    console.log(`[Proxy Handler] Event Path: ${event.path}`);
    console.log(`[Proxy Handler] Query Params: ${JSON.stringify(event.queryStringParameters)}`);

    const { path, queryStringParameters } = event;
    const apiPath = path.replace('/api', '');

    let targetUrl;
    const params = new url.URLSearchParams(queryStringParameters).toString();

    if (apiPath.startsWith('/tpex/')) {
        const tpexEndpoint = apiPath.replace('/tpex/', '');
        if (tpexEndpoint === 'st43_result.php') {
            targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?${params}`;
        } else if (tpexEndpoint === 'stk_quote_result.php') {
            targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?${params}`;
        }
    } else if (apiPath.startsWith('/twse/')) {
        const twseEndpoint = apiPath.replace('/twse/', '');
        targetUrl = `https://www.twse.com.tw/exchangeReport/${twseEndpoint}?${params}`;
    }

    if (!targetUrl) {
        console.error(`[Proxy Handler] API path not found for: ${apiPath}`);
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'API path not found' })
        };
    }

    console.log(`[Proxy Handler] Target URL: ${targetUrl}`);

    try {
        const response = await fetchWithRedirect(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.tpex.org.tw/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        console.log(`[Proxy Handler] Response Status: ${response.statusCode}`);
        console.log(`[Proxy Handler] Response Headers: ${JSON.stringify(response.headers)}`);

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
            console.warn(`[Proxy Handler] Warning: Response content-type is not JSON: ${contentType}`);
            console.warn(`[Proxy Handler] Response Body (first 300 chars): ${response.body.substring(0, 300)}`);
        }

        return {
            statusCode: response.statusCode,
            headers: {
                'Content-Type': contentType || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: response.body
        };
    } catch (error) {
        console.error('[Proxy Handler] CATCH Block Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Proxy error', message: error.message })
        };
    }
};
