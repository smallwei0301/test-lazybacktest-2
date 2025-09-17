const https = require('https');
const url = require('url');

// This is a more general proxy that handles both daily and monthly TPEX requests to the st43_result.php endpoint.

const makeRequest = (requestUrl, options, retries = 3) => {
    return new Promise((resolve, reject) => {
        const request = https.get(requestUrl, options, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (retries > 0) {
                    console.log(`[Proxy] Redirecting to: ${response.headers.location}`);
                    makeRequest(response.headers.location, options, retries - 1).then(resolve).catch(reject);
                } else {
                    reject(new Error('Too many redirects'));
                }
                return;
            }
            let body = '';
            response.on('data', (chunk) => (body += chunk));
            response.on('end', () => {
                resolve({ statusCode: response.statusCode, headers: response.headers, body: body });
            });
        });
        request.on('error', (err) => reject(err));
        request.setTimeout(30000, () => { request.destroy(); reject(new Error('Request timed out')); });
        request.end();
    });
};

exports.handler = async function(event, context) {
    const { path, queryStringParameters } = event;
    const apiPath = path.replace('/api', '');
    const params = new url.URLSearchParams(queryStringParameters).toString();
    let targetUrl;

    if (apiPath.startsWith('/tpex/')) {
        const tpexEndpoint = apiPath.replace('/tpex/', '');
        // This handles both daily and monthly queries to the same endpoint
        if (tpexEndpoint === 'st43_result.php') {
            targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?${params}`;
        }
    } else if (apiPath.startsWith('/twse/')) {
        const twseEndpoint = apiPath.replace('/twse/', '');
        targetUrl = `https://www.twse.com.tw/exchangeReport/${twseEndpoint}?${params}`;
    }

    if (!targetUrl) {
        return { statusCode: 404, body: JSON.stringify({ error: 'API path not found or invalid' }) };
    }

    console.log(`[Proxy Handler] Forwarding to: ${targetUrl}`);

    try {
        const response = await makeRequest(targetUrl, {
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.tpex.org.tw/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
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
        console.error('[Proxy Handler] Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Proxy error', message: error.message }) };
    }
};
