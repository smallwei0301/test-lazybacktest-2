const https = require('https');
const url = require('url');

// Helper to fetch with redirects
const fetchWithRedirect = (requestUrl, options, retries = 3) => {
    return new Promise((resolve, reject) => {
        const request = https.get(requestUrl, options, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (retries > 0) {
                    console.log(`Redirecting to: ${response.headers.location}`);
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
    const { path, queryStringParameters } = event;
    const apiPath = path.replace('/api', ''); // e.g., /tpex/st43_result.php

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
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'API path not found' })
        };
    }

    console.log(`Proxying to: ${targetUrl}`);

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

        return {
            statusCode: response.statusCode,
            headers: {
                'Content-Type': response.headers['content-type'] || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: response.body
        };
    } catch (error) {
        console.error('Proxy Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Proxy error', message: error.message })
        };
    }
};