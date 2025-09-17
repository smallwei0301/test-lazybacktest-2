const https = require('https');
const url = require('url');

const makeRequest = (requestUrl, options, cookie = null, retries = 3) => {
    return new Promise((resolve, reject) => {
        if (cookie) {
            options.headers = { ...options.headers, 'Cookie': cookie };
        }
        const request = https.get(requestUrl, options, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (retries > 0) {
                    makeRequest(response.headers.location, options, cookie, retries - 1).then(resolve).catch(reject);
                } else {
                    reject(new Error('Too many redirects'));
                }
                return;
            }
            let body = '';
            response.on('data', (chunk) => (body += chunk));
            response.on('end', () => {
                resolve({ statusCode: response.statusCode, headers: response.headers, body: body, cookies: response.headers['set-cookie'] });
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
    
    let targetUrl;
    let isTpexCsv = false;

    if (apiPath.startsWith('/tpex/')) {
        // New CSV API endpoint for TPEX
        const query = new url.URLSearchParams(queryStringParameters);
        const stockNo = query.get('stkno');
        const date = query.get('d');
        if (stockNo && date) {
            isTpexCsv = true;
            // Map old params to new params
            const newParams = new url.URLSearchParams({
                l: 'zh-tw',
                o: 'csv', // Request CSV format
                d: date,
                s: stockNo
            }).toString();
            targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?${newParams}`;
        }
    } else if (apiPath.startsWith('/twse/')) {
        const params = new url.URLSearchParams(queryStringParameters).toString();
        const twseEndpoint = apiPath.replace('/twse/', '');
        targetUrl = `https://www.twse.com.tw/exchangeReport/${twseEndpoint}?${params}`;
    }

    if (!targetUrl) {
        return { statusCode: 404, body: JSON.stringify({ error: 'API path not found or invalid params' }) };
    }

    console.log(`[Proxy Handler] Final Target URL: ${targetUrl}`);

    try {
        const response = await makeRequest(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-pricing.html'
            }
        });

        const contentType = isTpexCsv ? 'text/csv' : (response.headers['content-type'] || 'application/json');

        return {
            statusCode: response.statusCode,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: response.body
        };

    } catch (error) {
        console.error('[Proxy Handler] CATCH Block Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Proxy error', message: error.message }) };
    }
};
