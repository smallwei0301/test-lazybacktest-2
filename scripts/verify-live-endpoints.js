const fetch = require('node-fetch');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const defaultUrl = 'http://localhost:8888/.netlify/functions/';

rl.question(`Enter base URL (default: ${defaultUrl}): `, async (inputUrl) => {
    const baseUrl = inputUrl.trim() || defaultUrl;
    rl.close();

    console.log(`\nTesting against: ${baseUrl}`);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const lastYear = currentYear - 1;

    const testCases = [
        {
            name: 'Historical Data (TWSE)',
            url: `${baseUrl}twse-proxy?stockNo=2330&month=${lastYear}01`,
            expectedTTL: 31536000
        },
        {
            name: 'Current Data (TWSE)',
            url: `${baseUrl}twse-proxy?stockNo=2330&month=${currentYear}${currentMonth}`,
            expectedTTL: 3600
        },
        {
            name: 'Historical Data (TPEX)',
            url: `${baseUrl}tpex-proxy?stockNo=8069&month=${lastYear}01`,
            expectedTTL: 31536000
        },
        {
            name: 'Current Data (TPEX)',
            url: `${baseUrl}tpex-proxy?stockNo=8069&month=${currentYear}${currentMonth}`,
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
            console.log(`Netlify-CDN-Cache-Control: ${cdnCacheControl}`);

            if (cacheControl && cacheControl.includes(`max-age=${test.expectedTTL}`)) {
                if (test.expectedTTL === 31536000 && !cacheControl.includes('immutable')) {
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
            console.warn('⚠️ Make sure the local server is running (netlify dev) or provide a valid live URL.');
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log('\n✅ All Live Checks Passed');
    } else {
        console.log('\n❌ Some Live Checks Failed');
    }
});
