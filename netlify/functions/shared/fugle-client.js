// shared Fugle client (LB-FUGLE-PRIMARY-20250705A)
import fetch from 'node-fetch';

const FUGLE_CANDLES_ENDPOINT = 'https://api.fugle.tw/marketdata/v1.0/stock/candles';

function resolveFugleToken() {
    return (
        process.env.FUGLE_API_TOKEN ||
        process.env.FUGLE_APIKEY ||
        process.env.FUGLE_API_KEY ||
        process.env.FUGLE_TOKEN ||
        null
    );
}

function normaliseDateInput(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{8}$/.test(trimmed)) {
        return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6)}`;
    }
    return null;
}

export async function requestFugleDailyCandles(stockNo, options = {}) {
    if (!stockNo) {
        throw new Error('缺少 Fugle 查詢代號');
    }
    const token = resolveFugleToken();
    if (!token) {
        throw new Error('未設定 Fugle API Token');
    }

    const startISO = normaliseDateInput(options.startDate || options.startISO || options.from);
    const endISO = normaliseDateInput(options.endDate || options.endISO || options.to);

    const url = new URL(FUGLE_CANDLES_ENDPOINT);
    url.searchParams.set('symbolId', stockNo);
    url.searchParams.set('apiToken', token);
    url.searchParams.set('klineType', 'day');
    if (startISO) url.searchParams.set('from', startISO);
    if (endISO) url.searchParams.set('to', endISO);

    const requestInit = {
        headers: { Accept: 'application/json' },
        timeout: options.timeoutMs || 15000,
    };

    const response = await fetch(url.toString(), requestInit);
    const rawText = await response.text();
    let payload = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
        throw new Error('Fugle 回傳非 JSON 內容');
    }

    if (!response.ok || payload?.error) {
        const message =
            payload?.error || payload?.message || payload?.msg || `Fugle HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    const dataBlock = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const candles = Array.isArray(dataBlock?.candles)
        ? dataBlock.candles
        : Array.isArray(payload?.data)
            ? payload.data
            : [];
    const infoBlock = dataBlock?.info || dataBlock?.meta || dataBlock || {};
    const stockName =
        infoBlock?.name ||
        infoBlock?.symbolName ||
        infoBlock?.symbolNameZh ||
        infoBlock?.symbolNameEn ||
        infoBlock?.securityName ||
        payload?.data?.stockName ||
        stockNo;

    return {
        stockName,
        candles,
        raw: payload,
    };
}

export function extractFugleCandleDate(candle) {
    if (!candle || typeof candle !== 'object') return null;
    const dateField =
        candle.date ||
        candle.Date ||
        candle.time ||
        candle.timestamp ||
        candle.tradeDate ||
        null;
    if (!dateField) return null;
    if (typeof dateField === 'number' && Number.isFinite(dateField)) {
        const date = new Date(dateField * (dateField > 1e12 ? 1 : 1000));
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    }
    const text = String(dateField).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if (/^\d{8}$/.test(text)) {
        return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
        return text.replace(/\//g, '-');
    }
    return null;
}

export function normaliseFugleCandle(candle) {
    if (!candle || typeof candle !== 'object') return null;
    const open = Number(candle.open ?? candle.Open ?? candle.openPrice ?? candle.open_price);
    const high = Number(candle.high ?? candle.High ?? candle.highPrice ?? candle.high_price);
    const low = Number(candle.low ?? candle.Low ?? candle.lowPrice ?? candle.low_price);
    const close = Number(candle.close ?? candle.Close ?? candle.closePrice ?? candle.close_price);
    const volume = Number(
        candle.volume ??
        candle.Volume ??
        candle.tradeVolume ??
        candle.TradeVolume ??
        candle.volumeK ??
        candle.accTradeVolume ??
        0,
    );
    return {
        open: Number.isFinite(open) ? open : null,
        high: Number.isFinite(high) ? high : null,
        low: Number.isFinite(low) ? low : null,
        close: Number.isFinite(close) ? close : null,
        volume: Number.isFinite(volume) ? volume : 0,
    };
}
