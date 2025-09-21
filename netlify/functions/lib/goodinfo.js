// netlify/functions/lib/goodinfo.js
// Patch Tag: LB-GOODINFO-ADJ-20241015A

const GOODINFO_VERSION = 'LB-GOODINFO-ADJ-20241015A';

const GOODINFO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.6,en;q=0.3',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://goodinfo.tw/tw/index.asp',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Dest': 'document',
    'Upgrade-Insecure-Requests': '1',
};

function stripTags(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
}

function decodeEntities(text) {
    if (!text) return '';
    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#x2f;/gi, '/')
        .replace(/&#47;/gi, '/')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&minus;/gi, '-')
        .replace(/&#8722;/gi, '-')
        .replace(/&ensp;/gi, ' ')
        .replace(/&emsp;/gi, ' ')
        .replace(/&hellip;/gi, '...');
}

function normaliseText(text) {
    return decodeEntities(stripTags(text)).replace(/\s+/g, ' ').trim();
}

function parseNumber(text) {
    if (text === undefined || text === null) return null;
    const trimmed = String(text).replace(/,/g, '').replace(/\s+/g, '').replace(/％/g, '');
    if (!trimmed || trimmed === '-' || trimmed === '－' || trimmed === '--' || trimmed === '---') {
        return null;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
}

function toISODate(text) {
    if (!text) return null;
    const trimmed = text.replace(/\s+/g, '');
    const parts = trimmed.split('/');
    if (parts.length !== 3) return null;
    let [yearStr, monthStr, dayStr] = parts;
    if (!yearStr || !monthStr || !dayStr) return null;
    let year = Number(yearStr);
    if (!Number.isFinite(year)) return null;
    if (yearStr.length <= 3) {
        year += 1911;
    }
    const month = String(Number(monthStr)).padStart(2, '0');
    const day = String(Number(dayStr)).padStart(2, '0');
    if (!Number.isFinite(Number(month)) || !Number.isFinite(Number(day))) return null;
    const iso = `${year}-${month}-${day}`;
    const check = new Date(iso);
    return Number.isNaN(check.getTime()) ? null : iso;
}

function extractStockName(html, fallback) {
    if (!html) return fallback;
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        const cleanTitle = normaliseText(titleMatch[1]);
        const nameMatch = cleanTitle.match(/\s([\u4e00-\u9fa5A-Za-z0-9\-]+)(?:\s|-|\||$)/);
        if (nameMatch && nameMatch[1]) {
            return nameMatch[1];
        }
    }
    const headerMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (headerMatch) {
        const cleanHeader = normaliseText(headerMatch[1]);
        const parts = cleanHeader.split(/\s+/);
        if (parts.length >= 2) {
            return parts[1];
        }
    }
    return fallback;
}

function locateAdjustedTable(html) {
    if (!html) return null;
    const marker = html.indexOf('還原權值股價');
    if (marker === -1) return null;
    const sliced = html.slice(marker);
    const match = sliced.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    return match ? match[0] : null;
}

function parseAdjustedRows(tableHtml) {
    const rows = [];
    const rowMatches = tableHtml ? tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) : null;
    if (!rowMatches || rowMatches.length === 0) return rows;
    let headers = null;
    for (const rowHtml of rowMatches) {
        const cellMatches = rowHtml.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi);
        if (!cellMatches || cellMatches.length === 0) continue;
        const cells = cellMatches.map(normaliseText);
        if (!headers) {
            if (cells.some((cell) => cell.includes('日期'))) {
                headers = cells.map((cell) => cell.replace(/\s+/g, ''));
            }
            continue;
        }
        if (cells.some((cell) => /合計|平均|備註/.test(cell))) {
            continue;
        }
        if (cells.length < headers.length) {
            continue;
        }
        rows.push(cells);
    }
    if (!headers) return [];
    const indexOfHeader = (predicate) => {
        return headers.findIndex((header) => predicate(header));
    };
    const idxDate = indexOfHeader((header) => header.includes('日期'));
    const idxAdjClose = indexOfHeader((header) => header.includes('還原收盤'));
    const idxAdjOpen = indexOfHeader((header) => header.includes('還原開盤'));
    const idxAdjHigh = indexOfHeader((header) => header.includes('還原最高'));
    const idxAdjLow = indexOfHeader((header) => header.includes('還原最低'));
    const idxVolume = indexOfHeader((header) => /量/.test(header));
    const idxRawClose = indexOfHeader((header) => header.includes('收盤') && !header.includes('還原'));
    const idxRawOpen = indexOfHeader((header) => header.includes('開盤') && !header.includes('還原'));
    const idxRawHigh = indexOfHeader((header) => header.includes('最高') && !header.includes('還原'));
    const idxRawLow = indexOfHeader((header) => header.includes('最低') && !header.includes('還原'));
    const parsed = [];
    for (const cells of rows) {
        const dateText = idxDate >= 0 ? cells[idxDate] : null;
        const isoDate = toISODate(dateText);
        if (!isoDate) continue;
        const adjClose = idxAdjClose >= 0 ? parseNumber(cells[idxAdjClose]) : null;
        const adjOpen = idxAdjOpen >= 0 ? parseNumber(cells[idxAdjOpen]) : null;
        const adjHigh = idxAdjHigh >= 0 ? parseNumber(cells[idxAdjHigh]) : null;
        const adjLow = idxAdjLow >= 0 ? parseNumber(cells[idxAdjLow]) : null;
        const rawClose = idxRawClose >= 0 ? parseNumber(cells[idxRawClose]) : null;
        const rawOpen = idxRawOpen >= 0 ? parseNumber(cells[idxRawOpen]) : null;
        const rawHigh = idxRawHigh >= 0 ? parseNumber(cells[idxRawHigh]) : null;
        const rawLow = idxRawLow >= 0 ? parseNumber(cells[idxRawLow]) : null;
        const volume = idxVolume >= 0 ? parseNumber(cells[idxVolume]) : null;
        if (!adjClose && !adjOpen && !adjHigh && !adjLow) {
            continue;
        }
        parsed.push({
            date: isoDate,
            adjOpen,
            adjHigh,
            adjLow,
            adjClose,
            rawOpen,
            rawHigh,
            rawLow,
            rawClose,
            volume,
        });
    }
    parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let prevAdjClose = null;
    for (const item of parsed) {
        if (item.adjClose !== null && item.adjClose !== undefined) {
            if (prevAdjClose !== null && prevAdjClose !== undefined) {
                item.change = Number.isFinite(item.adjClose - prevAdjClose)
                    ? item.adjClose - prevAdjClose
                    : 0;
            } else {
                item.change = 0;
            }
            prevAdjClose = item.adjClose;
        } else {
            item.change = 0;
        }
    }
    return parsed;
}

async function fetchHtml(fetchImpl, url) {
    const response = await fetchImpl(url, { headers: GOODINFO_HEADERS });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('utf8');
}

async function tryFetchAdjusted(fetchImpl, stockNo, endpointBuilder) {
    const url = endpointBuilder(stockNo);
    const html = await fetchHtml(fetchImpl, url);
    const tableHtml = locateAdjustedTable(html);
    if (!tableHtml) {
        throw new Error('找不到還原權值股價表格');
    }
    const rows = parseAdjustedRows(tableHtml);
    if (!rows || rows.length === 0) {
        throw new Error('解析還原權值股價表格失敗');
    }
    const stockName = extractStockName(html, stockNo);
    return { stockName, rows };
}

export async function fetchGoodinfoAdjustedSeries(fetchImpl, stockNo, options = {}) {
    if (!fetchImpl) {
        throw new Error('缺少 fetch 實例');
    }
    if (!stockNo) {
        throw new Error('缺少股票代號');
    }
    const builders = [
        (id) => `https://goodinfo.tw/tw/StockDividendSchedule.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/StockInfo/StockDividendSchedule.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/tw/StockPriceHistory.asp?STOCK_ID=${encodeURIComponent(id)}`,
    ];
    const errors = [];
    for (const builder of builders) {
        try {
            const result = await tryFetchAdjusted(fetchImpl, stockNo, builder);
            const { startISO, endISO } = options;
            if (startISO || endISO) {
                const start = startISO ? new Date(startISO) : null;
                const end = endISO ? new Date(endISO) : null;
                result.rows = result.rows.filter((row) => {
                    const date = new Date(row.date);
                    if (Number.isNaN(date.getTime())) return false;
                    if (start && date < start) return false;
                    if (end && date > end) return false;
                    return true;
                });
            }
            return { ...result, version: GOODINFO_VERSION };
        } catch (error) {
            errors.push(`${builder(stockNo)} => ${error.message}`);
        }
    }
    const err = new Error(`無法自 Goodinfo 取得還原股價 (${errors.join('; ')})`);
    err.version = GOODINFO_VERSION;
    throw err;
}

export { GOODINFO_VERSION };
