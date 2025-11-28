const readline = require('readline');

// Use native fetch if available (Node 18+), otherwise try require
const fetch = global.fetch || require('node-fetch');

const defaultUrl = 'http://localhost:8888/.netlify/functions/';

async function runTests(baseUrl) {
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    console.log(`\nTesting against: ${baseUrl}`);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const lastYear = currentYear - 1;

    const testCases = [
        // TWSE
        {
            name: 'TWSE Historical (2330)',
            url: `${baseUrl}twse-proxy?stockNo=2330&month=${lastYear}01`,
            expectedTTL: 31536000,
            immutable: true
        },
        {
            name: 'TWSE Current (2330)',
            url: `${baseUrl}twse-proxy?stockNo=2330&month=${currentYear}${currentMonth}`,
            expectedTTL: 3600
        },
        // TPEX
        {
            name: 'TPEX Historical (8069)',
            url: `${baseUrl}tpex-proxy?stockNo=8069&month=${lastYear}01`,
            expectedTTL: 31536000,
            immutable: true
        },
        {
            name: 'TPEX Current (8069)',
            url: `${baseUrl}tpex-proxy?stockNo=8069&month=${currentYear}${currentMonth}`,
            expectedTTL: 3600
        },
        // Index Proxy
        {
            name: 'Index Info Mode',
            url: `${baseUrl}index-proxy?mode=info`,
            expectedTTL: 86400
        },
        {
            name: 'Index Price Historical',
            url: `${baseUrl}index-proxy?mode=price&symbol=^TWII&start=${lastYear}-01-01&end=${lastYear}-01-31`,
            expectedTTL: 31536000,
            immutable: true
        },
        {
            name: 'Index Price Current',
            url: `${baseUrl}index-proxy?mode=price&symbol=^TWII&start=${currentYear}-${currentMonth}-01`,
            expectedTTL: 3600
        },
        // US Proxy
        {
            name: 'US Info Mode',
            url: `${baseUrl}us-proxy?mode=info&symbol=AAPL`,
            expectedTTL: 604800
        },
        {
            name: 'US Price Historical',
            url: `${baseUrl}us-proxy?mode=price&symbol=AAPL&start=${lastYear}-01-01&end=${lastYear}-01-31`,
            expectedTTL: 31536000,
            immutable: true
        },
        {
            name: 'US Price Current',
            url: `${baseUrl}us-proxy?mode=price&symbol=AAPL&start=${currentYear}-${currentMonth}-01`,
            expectedTTL: 3600
        }
    ];

    let allPassed = true;

    for (const test of testCases) {
        try {
            const res = await fetch(test.url);
            const cacheControl = res.headers.get('cache-control');
            const cdnCacheControl = res.headers.get('netlify-cdn-cache-control');

            console.log(`\nTest: ${test.name}`);
            console.log(`URL: ${test.url}`);
            console.log(`Cache-Control: ${cacheControl}`);
            // console.log(`Netlify-CDN-Cache-Control: ${cdnCacheControl}`);

            if (cacheControl && cacheControl.includes(`max-age=${test.expectedTTL}`)) {
                if (test.immutable && !cacheControl.includes('immutable')) {
                    console.error('❌ FAIL (Missing "immutable" for historical data)');
                    allPassed = false;
                } else {
                    console.log('✅ PASS');
                }
            } else {
                console.error(`❌ FAIL (Expected max-age=${test.expectedTTL})`);
                allPassed = false;
            }
        } catch (err) {
            console.error(`❌ Error fetching ${test.url}:`, err.message);
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log('\n✅ All Live Checks Passed');
    } else {
        console.log('\n❌ Some Live Checks Failed');
    }
}

const argUrl = process.argv[2];
if (argUrl) {
    runTests(argUrl);
} else {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(`Enter base URL (default: ${defaultUrl}): `, (inputUrl) => {
        const baseUrl = inputUrl.trim() || defaultUrl;
        rl.close();
        runTests(baseUrl);
    });
}
