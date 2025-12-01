const { ProxyClient } = require('../../v0 design code/public/app/js/layers/api/proxy-client');

// Mock globals
global.fetch = jest.fn();
const mockCache = {
    match: jest.fn(),
    put: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn().mockResolvedValue([])
};
global.caches = {
    open: jest.fn().mockResolvedValue(mockCache),
    match: jest.fn()
};
global.Response = class Response {
    constructor(body, init) {
        this.body = body;
        this.init = init;
        this.ok = true;
        this.status = 200;
        this.statusText = 'OK';
    }
    json() {
        return Promise.resolve(JSON.parse(this.body));
    }
    text() {
        return Promise.resolve(this.body);
    }
};

describe('ProxyClient Smart Caching', () => {
    let client;

    beforeEach(() => {
        client = new ProxyClient();
        jest.clearAllMocks();
    });

    test('calculateChunks splits years correctly', () => {
        const chunks = client.calculateChunks({
            startDate: '2020-05-01',
            endDate: '2022-03-01'
        });

        // Expect 2020, 2021, 2022
        expect(chunks.length).toBe(3);
        expect(chunks[0].year).toBe(2020);
        expect(chunks[0].startDate).toBe('2020-01-01');
        expect(chunks[0].endDate).toBe('2020-12-31');
        expect(chunks[0].isHistorical).toBe(true);

        expect(chunks[1].year).toBe(2021);
        expect(chunks[1].isHistorical).toBe(true);

        // Check 2022
        const currentYear = new Date().getFullYear();
        if (2022 < currentYear) {
            expect(chunks[2].isHistorical).toBe(true);
        } else {
            expect(chunks[2].isHistorical).toBe(false);
        }
    });

    test('mergeGaps merges consecutive missing chunks', () => {
        const chunks = [
            { year: 2020, startDate: '2020-01-01', endDate: '2020-12-31', cached: false },
            { year: 2021, startDate: '2021-01-01', endDate: '2021-12-31', cached: false },
            { year: 2022, startDate: '2022-01-01', endDate: '2022-12-31', cached: true },
            { year: 2023, startDate: '2023-01-01', endDate: '2023-12-31', cached: false }
        ];

        const requests = client.mergeGaps(chunks);

        expect(requests.length).toBe(2);
        expect(requests[0].startDate).toBe('2020-01-01');
        expect(requests[0].endDate).toBe('2021-12-31');
        expect(requests[0].years).toEqual([2020, 2021]);

        expect(requests[1].startDate).toBe('2023-01-01');
        expect(requests[1].endDate).toBe('2023-12-31');
    });

    test('checkCache probes cache for historical years', async () => {
        const chunks = [
            { year: 2020, isHistorical: true, cached: false },
            { year: 2021, isHistorical: false, cached: false } // Current year
        ];

        mockCache.match.mockImplementation((key) => {
            if (key.includes('2020')) {
                return Promise.resolve(new Response(JSON.stringify({ data: [{ date: '2020-01-01' }] })));
            }
            return Promise.resolve(undefined);
        });

        await client.checkCache(chunks, { stockNo: '2330' });

        expect(global.caches.open).toHaveBeenCalledWith('lazybacktest-stock-v1');
        expect(mockCache.match).toHaveBeenCalledTimes(1); // Only for 2020
        expect(chunks[0].cached).toBe(true);
        expect(chunks[1].cached).toBe(false);
    });

    test('fetchAndProcess fetches merged ranges and slices back to cache', async () => {
        const chunks = [
            { year: 2020, startDate: '2020-01-01', endDate: '2020-12-31', isHistorical: true, cached: false },
            { year: 2021, startDate: '2021-01-01', endDate: '2021-12-31', isHistorical: true, cached: false }
        ];
        const requests = [{ startDate: '2020-01-01', endDate: '2021-12-31', years: [2020, 2021] }];

        // Mock fetch response
        global.fetch.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { date: '2020-05-01', close: 100 },
                { date: '2021-06-01', close: 200 }
            ]
        })));

        const result = await client.fetchAndProcess(requests, chunks, { stockNo: '2330', startDate: '2020-05-01', endDate: '2021-06-01' });

        // Verify fetch called with merged range
        // We check for start and end separately to avoid order issues
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('start=2020-01-01'),
            expect.any(Object)
        );
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('end=2021-12-31'),
            expect.any(Object)
        );

        // Verify cache put called for each year
        expect(mockCache.put).toHaveBeenCalledTimes(2);

        // Verify result filtered
        expect(result.length).toBe(2);
        expect(result[0].date).toBe('2020-05-01');
        expect(result[1].date).toBe('2021-06-01');
    });
});
