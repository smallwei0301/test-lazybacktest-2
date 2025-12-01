const { ProxyClient } = require('../v0 design code/public/app/js/layers/api/proxy-client.js');

// Mock Cache API
const mockCacheStorage = new Map();
global.caches = {
    open: async (name) => ({
        match: async (key) => {
            console.log(`[Cache] Match: ${key}`);
            if (mockCacheStorage.has(key)) {
                return {
                    json: async () => mockCacheStorage.get(key)
                };
            }
            return null;
        },
        put: async (key, response) => {
            console.log(`[Cache] Put: ${key}`);
            const data = await response.json(); // Mock response.json()
            mockCacheStorage.set(key, data);
        }
    })
};

// Mock Response for Cache Put
global.Response = class {
    constructor(body) {
        this.body = body;
    }
    async json() {
        return JSON.parse(this.body);
    }
};

// Mock Fetch
global.fetch = async (url) => {
    console.log(`[Fetch] URL: ${url}`);
    const urlObj = new URL(url, 'http://localhost');
    const start = urlObj.searchParams.get('start');
    const end = urlObj.searchParams.get('end');

    // Generate dummy data
    const data = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        // Random price
        data.push([dateStr, "100", "101", "99", "100", "1000"]);
    }

    return {
        ok: true,
        text: async () => JSON.stringify({ data: data })
    };
};

async function runTest() {
    const client = new ProxyClient();

    console.log('--- Test 1: Cold Start (2020-2022) ---');
    // Request 2020-01-01 to 2022-12-31
    // Current year is 2025, so all are historical and should be cached.
    const params1 = {
        market: 'TWSE',
        stockNo: '2330',
        startDate: '2020-01-01',
        endDate: '2022-12-31'
    };

    const result1 = await client.getStockData(params1);
    console.log(`Result 1 Data Points: ${result1.data.length}`);

    // Verify Cache
    const key2020 = client.buildYearCacheKey(params1, 2020);
    const key2021 = client.buildYearCacheKey(params1, 2021);
    const key2022 = client.buildYearCacheKey(params1, 2022);

    console.log(`Cache 2020 exists: ${mockCacheStorage.has(key2020)}`);
    console.log(`Cache 2021 exists: ${mockCacheStorage.has(key2021)}`);
    console.log(`Cache 2022 exists: ${mockCacheStorage.has(key2022)}`);

    console.log('\n--- Test 2: Partial Hit (2020-2023) ---');
    // 2020-2022 are cached. 2023 is missing.
    // Should fetch ONLY 2023.
    const params2 = {
        market: 'TWSE',
        stockNo: '2330',
        startDate: '2020-01-01',
        endDate: '2023-12-31'
    };

    const result2 = await client.getStockData(params2);
    console.log(`Result 2 Data Points: ${result2.data.length}`);

    const key2023 = client.buildYearCacheKey(params2, 2023);
    console.log(`Cache 2023 exists: ${mockCacheStorage.has(key2023)}`);

    console.log('\n--- Test 3: Gap Merging (Clear 2021, Request 2020-2022) ---');
    // Clear 2021
    mockCacheStorage.delete(key2021);

    // Request 2020-2022
    // 2020 Cached, 2021 Missing, 2022 Cached.
    // Should fetch 2021.
    const result3 = await client.getStockData(params1);
    console.log(`Result 3 Data Points: ${result3.data.length}`);
    console.log(`Cache 2021 restored: ${mockCacheStorage.has(key2021)}`);
}

runTest().catch(console.error);
