const https = require('https');
const url = require('url');

// Function to make a request and handle redirects, now also returns cookies
const makeRequest = (requestUrl, options, cookie = null, retries = 3) => {
    return new Promise((resolve, reject) => {
        if (cookie) {
            options.headers = { ...options.headers, 'Cookie': cookie };
        }

        console.log(`[Request] Fetching: ${requestUrl}`);
        console.log(`[Request] With Headers: ${JSON.stringify(options.headers)}`);

        const request = https.get(requestUrl, options, (response) => {
            console.log(`[Request] Status: ${response.statusCode} for ${requestUrl}`);

            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                if (retries > 0) {
                    console.log(`[Request] Redirecting to: ${response.headers.location}`);
                    // Pass existing cookies during redirect
                    makeRequest(response.headers.location, options, cookie, retries - 1)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error('Too many redirects'));
                }
                return;
            }

            let body = '';
            response.on('data', (chunk) => (body += chunk));
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: body,
                    cookies: response.headers['set-cookie']
                });
            });
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
    const { path, queryStringParameters } = event;
    const apiPath = path.replace('/api', '');
    const params = new url.URLSearchParams(queryStringParameters).toString();

    let targetUrl;
    let isTpex = false;

    if (apiPath.startsWith('/tpex/')) {
        isTpex = true;
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
        return { statusCode: 404, body: JSON.stringify({ error: 'API path not found' }) };
    }

    console.log(`[Proxy Handler] Target URL: ${targetUrl}`);

    try {
        let initialCookie = null;
        
        // For TPEX requests, first get cookies from a landing page
        if (isTpex) {
            console.log('[Proxy Handler] TPEX request detected. Fetching initial cookie.');
            const landingPageUrl = 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43.php';
            const initialResponse = await makeRequest(landingPageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (initialResponse.cookies) {
                initialCookie = initialResponse.cookies.map(c => c.split(';')[0]).join('; ');
                console.log(`[Proxy Handler] Got initial cookie: ${initialCookie}`);
            } else {
                console.warn('[Proxy Handler] Did not receive cookies from landing page.');
            }
        }

        // Now make the actual API request, with cookies if we have them
        const response = await makeRequest(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                'Referer': isTpex ? 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43.php' : 'https://www.twse.com.tw/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        }, initialCookie);

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
            console.warn(`[Proxy Handler] Final response is not JSON. Content-Type: ${contentType}`);
            console.warn(`[Proxy Handler] Final Response Body (first 300 chars): ${response.body.substring(0, 300)}`);
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