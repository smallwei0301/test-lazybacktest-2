import test from 'node:test';
import assert from 'node:assert/strict';

test('Adjusted price proxy returns degraded payload when FinMind fetch fails', async (t) => {
  t.after(() => {
    delete globalThis.__ADJUSTED_PRICE_PROXY_TEST_CONFIG__;
  });

  const rawRows = [
    ['2024-01-05', '1,500', '--', '--', '510', '500', '505', '5'],
    ['2024-01-04', '1,200', '--', '--', '500', '490', '495', '-3'],
  ];

  const mockResponsePayload = {
    stockName: '測試股',
    aaData: rawRows,
  };

  const mockTwseProxyHandler = async (request) => {
    assert.ok(request && request.url, '應該收到內部 proxy 的請求 URL');
    assert.match(String(request.url), /stockNo=2330/);
    return {
      ok: true,
      status: 200,
      async json() {
        return mockResponsePayload;
      },
      async text() {
        return JSON.stringify(mockResponsePayload);
      },
    };
  };

  const mockTwseProxy = { handler: mockTwseProxyHandler };

  const mockFetch = async () => {
    const error = new Error('FinMind timeout');
    error.code = 'ETIMEDOUT';
    throw error;
  };

  globalThis.__ADJUSTED_PRICE_PROXY_TEST_CONFIG__ = {
    fetch: mockFetch,
    twseProxy: mockTwseProxy,
    tpexProxy: mockTwseProxy,
    delay: async () => {},
  };

  const moduleUrl = new URL('../netlify/functions/adjusted-price-proxy.js', import.meta.url);
  const mod = await import(`${moduleUrl}?degraded=${Date.now()}`);

  const response = await mod.handler({
    queryStringParameters: {
      stockNo: '2330',
      marketType: 'twse',
      startDate: '2024-01-01',
      endDate: '2024-01-06',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json');

  const body = JSON.parse(response.body);
  assert.equal(body.stockNo, '2330');
  assert.equal(body.dataSource, 'TWSE + FinMind (Adjusted - Dividend Degraded)');
  assert.equal(body.diagnostics.dividendStatus, 'degraded');
  assert.equal(body.diagnostics.dividendRecords, 0);
  assert.equal(body.diagnostics.dividendMessage, 'FinMind timeout');
  assert.ok(Array.isArray(body.warnings));
  assert.equal(body.warnings.length, 1);
  assert.equal(
    body.warnings[0],
    'FinMind 股利資料暫時無法取得：FinMind timeout',
  );
  assert.equal(body.aaData.length, rawRows.length);
  assert.equal(body.adjustments.length, 0);
  assert.equal(body.version, 'LB-ADJ-ENDPOINT-20241110A');
});
