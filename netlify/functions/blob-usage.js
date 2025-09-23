// netlify/functions/blob-usage.js
// Blob traffic dashboard endpoint consolidating usage summaries and recent events.
// Patch Tag: LB-BLOB-MONITOR-20250624A
import { BLOB_MONITOR_VERSION, loadBlobUsageSnapshot } from '../lib/blob-monitor.js';

function parseLimit(value, fallback) {
    const numeric = Number.parseInt(value, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
        return Math.min(numeric, 200);
    }
    return fallback;
}

export const handler = async (event) => {
    const method = event.httpMethod || 'GET';
    if (method.toUpperCase() !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                status: 'error',
                message: 'Method Not Allowed',
            }),
        };
    }

    const params = event.queryStringParameters || {};
    const date = params.date || params.day || null;
    const limit = parseLimit(params.limit, undefined);

    const snapshot = await loadBlobUsageSnapshot({ date, limit });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            status: 'ok',
            monitorVersion: BLOB_MONITOR_VERSION,
            generatedAt: new Date().toISOString(),
            request: {
                date: snapshot.date,
                limit: limit ?? null,
            },
            snapshot,
        }),
    };
};
