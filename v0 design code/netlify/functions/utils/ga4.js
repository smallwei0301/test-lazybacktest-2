// netlify/functions/utils/ga4.js
// Patch Tag: LB-GA4-PROXY-TRACKING-20251210B
import fetch from 'node-fetch';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/**
 * 發送事件至 GA4 Measurement Protocol
 * @param {string} eventName - 事件名稱
 * @param {object} params - 事件參數
 * @returns {Promise<boolean>} - 發送是否成功
 */
export async function sendToGA4(eventName, params = {}) {
    const measurementId = process.env.GA_MEASUREMENT_ID;
    const apiSecret = process.env.GA_API_SECRET;

    if (!measurementId || !apiSecret) {
        console.warn('[GA4] Missing GA_MEASUREMENT_ID or GA_API_SECRET');
        return false;
    }

    // 隨機化 client_id 避免高併發衝突
    const clientId = `serverless_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const url = `${GA_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const payload = {
        client_id: clientId,
        events: [{
            name: eventName,
            params: {
                ...params,
                engagement_time_msec: 1,
            }
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error('[GA4] Send failed:', error.message);
        return false;
    }
}
