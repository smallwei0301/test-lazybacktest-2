// netlify/functions/lib/goodinfo.js
// Patch Tag: LB-GOODINFO-ADJ-20241025A

import { TextDecoder } from 'util';

const GOODINFO_VERSION = 'LB-GOODINFO-ADJ-20241025A';

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
    'Accept-Encoding': 'gzip, deflate, br',
};

const GOODINFO_MARKERS = ['還原權值股價', '還原股價', '還原收盤'];

function unescapeJsStringLiteral(value) {
    if (!value) return '';
    return value.replace(/\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-7]{1,3})|(.))/g, (match, uni, hex, oct, other) => {
        if (uni) {
            const code = parseInt(uni, 16);
            return Number.isFinite(code) ? String.fromCharCode(code) : '';
        }
        if (hex) {
            const code = parseInt(hex, 16);
            return Number.isFinite(code) ? String.fromCharCode(code) : '';
        }
        if (oct) {
            const code = parseInt(oct, 8);
            return Number.isFinite(code) ? String.fromCharCode(code) : '';
        }
        switch (other) {
            case 'n':
                return '\n';
            case 'r':
                return '\r';
            case 't':
                return '\t';
            case 'f':
                return '\f';
            case 'b':
                return '\b';
            case 'v':
                return '\v';
            case '\\':
                return '\\';
            case '\'':
                return "'";
            case '"':
                return '"';
            case '/':
                return '/';
            default:
                return other;
        }
    });
}

function decodePercentEncodedString(value) {
    if (!value) return '';
    const normalised = value
        .replace(/\+/g, ' ')
        .replace(/%u([0-9a-fA-F]{4})/g, (match, hex) => {
            const code = parseInt(hex, 16);
            return Number.isFinite(code) ? String.fromCharCode(code) : '';
        });
    try {
        return decodeURIComponent(normalised);
    } catch (error) {
        return normalised.replace(/%([0-9a-fA-F]{2})/g, (match, hex) => {
            const code = parseInt(hex, 16);
            return Number.isFinite(code) ? String.fromCharCode(code) : match;
        });
    }
}

function decodeBase64String(value) {
    if (!value) return '';
    try {
        return Buffer.from(value, 'base64').toString('utf-8');
    } catch (error) {
        return '';
    }
}

function extractStringLiterals(expression) {
    const literals = [];
    if (!expression) return literals;
    let quote = null;
    let buffer = '';
    let escape = false;
    for (const char of expression) {
        if (quote) {
            if (escape) {
                buffer += char;
                escape = false;
                continue;
            }
            if (char === '\\') {
                buffer += '\\';
                escape = true;
                continue;
            }
            if (char === quote) {
                literals.push(buffer);
                quote = null;
                buffer = '';
                continue;
            }
            buffer += char;
        } else if (char === '"' || char === "'") {
            quote = char;
            buffer = '';
            escape = false;
        }
    }
    return literals;
}

function decodeLiteralExpression(expression, depth = 0) {
    if (!expression || depth > 5) return '';
    const trimmed = expression.trim();
    if (!trimmed) return '';
    const wrappers = [
        {
            pattern: /^(?:window\.)?(?:unescape|decodeURIComponent)\((.*)\)$/i,
            decoder: decodePercentEncodedString,
        },
        {
            pattern: /^(?:window\.)?atob\((.*)\)$/i,
            decoder: decodeBase64String,
        },
    ];
    for (const { pattern, decoder } of wrappers) {
        const match = trimmed.match(pattern);
        if (match && match[1]) {
            const inner = decodeLiteralExpression(match[1], depth + 1);
            if (inner) {
                return decoder(inner);
            }
        }
    }
    const literals = extractStringLiterals(trimmed);
    if (literals.length === 0) {
        return '';
    }
    const remainder = trimmed
        .replace(/(['"])(?:\\.|(?!\1).)*?\1/g, '')
        .replace(/[+\s]/g, '');
    if (remainder.length > 0) {
        return '';
    }
    return literals.map((literal) => unescapeJsStringLiteral(literal)).join('');
}

function splitExpressionParts(expression) {
    const parts = [];
    if (!expression) return parts;
    let current = '';
    let quote = null;
    let escape = false;
    let depth = 0;
    for (const char of expression) {
        if (quote) {
            current += char;
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }
        if (char === '(' || char === '[' || char === '{') {
            depth += 1;
            current += char;
            continue;
        }
        if (char === ')' || char === ']' || char === '}') {
            if (depth > 0) depth -= 1;
            current += char;
            continue;
        }
        if (char === '+' && depth === 0) {
            if (current.trim().length > 0) {
                parts.push(current.trim());
            }
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim().length > 0) {
        parts.push(current.trim());
    }
    return parts;
}

function resolveScriptExpression(expression, context, depth = 0) {
    if (!expression || depth > 10) return '';
    const trimmed = expression.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        const inner = resolveScriptExpression(trimmed.slice(1, -1), context, depth + 1);
        if (inner) return inner;
    }

    const literal = decodeLiteralExpression(trimmed);
    if (literal) {
        return literal;
    }

    const wrapperMatch = trimmed.match(/^(?:window\.)?(unescape|decodeURIComponent|atob)\((.*)\)$/i);
    if (wrapperMatch && wrapperMatch[2]) {
        const inner = resolveScriptExpression(wrapperMatch[2], context, depth + 1);
        if (inner) {
            const method = wrapperMatch[1].toLowerCase();
            if (method === 'atob') {
                return decodeBase64String(inner);
            }
            return decodePercentEncodedString(inner);
        }
    }

    if (trimmed.includes('+')) {
        const parts = splitExpressionParts(trimmed);
        if (parts.length > 1) {
            const resolvedParts = parts.map((part) => resolveScriptExpression(part, context, depth + 1));
            if (resolvedParts.some((value) => value)) {
                return resolvedParts.join('');
            }
        }
    }

    const varMatch = trimmed.match(/^(?:window\.)?([A-Za-z_$][\w$]*)$/);
    if (varMatch && varMatch[1]) {
        const key = varMatch[1];
        if (context instanceof Map) {
            if (context.has(key)) {
                return context.get(key);
            }
        } else if (context && typeof context === 'object' && key in context) {
            return context[key];
        }
        return '';
    }

    return '';
}

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

function buildScriptStringMap(html, diagnostics) {
    const assignments = new Map();
    if (!html) return assignments;
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    let candidateCount = 0;
    let resolvedCount = 0;
    while ((scriptMatch = scriptRegex.exec(html))) {
        const scriptContent = scriptMatch[1];
        const declRegex = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?![=])([^;]+);/g;
        let assignmentMatch;
        while ((assignmentMatch = declRegex.exec(scriptContent))) {
            candidateCount += 1;
            const name = assignmentMatch[1];
            const expr = assignmentMatch[2];
            const value = resolveScriptExpression(expr, assignments);
            if (value) {
                assignments.set(name, value);
                resolvedCount += 1;
            }
        }
        const windowRegex = /window\.([A-Za-z_$][\w$]*)\s*=\s*(?![=])([^;]+);/g;
        while ((assignmentMatch = windowRegex.exec(scriptContent))) {
            candidateCount += 1;
            const name = assignmentMatch[1];
            const expr = assignmentMatch[2];
            const value = resolveScriptExpression(expr, assignments);
            if (value) {
                assignments.set(name, value);
                resolvedCount += 1;
            }
        }
        const simpleRegex = /(?<![\w$])([A-Za-z_$][\w$]*)\s*=\s*(?![=])([^;]+);/g;
        while ((assignmentMatch = simpleRegex.exec(scriptContent))) {
            const snippet = scriptContent.slice(Math.max(0, assignmentMatch.index - 6), assignmentMatch.index).trimEnd();
            if (/^(?:var|let|const|window\.)$/i.test(snippet)) {
                continue;
            }
            candidateCount += 1;
            const name = assignmentMatch[1];
            const expr = assignmentMatch[2];
            const value = resolveScriptExpression(expr, assignments);
            if (value) {
                assignments.set(name, value);
                resolvedCount += 1;
            }
        }
    }
    if (diagnostics) {
        diagnostics.scriptAssignmentCandidates = (diagnostics.scriptAssignmentCandidates || 0) + candidateCount;
        diagnostics.scriptAssignments = assignments.size;
        diagnostics.scriptResolved = (diagnostics.scriptResolved || 0) + resolvedCount;
    }
    return assignments;
}

function collectDocumentWriteTables(html, context, diagnostics) {
    const tables = [];
    if (!html) return tables;
    const docWritePattern = /document\.write(?:ln)?\(([^;]*?)\);/gi;
    let match;
    let attempts = 0;
    let hits = 0;
    const missSamples = [];
    while ((match = docWritePattern.exec(html))) {
        attempts += 1;
        const decoded = resolveScriptExpression(match[1], context);
        if (!decoded) {
            if (missSamples.length < 3) {
                missSamples.push(match[1].slice(0, 120).trim());
            }
            continue;
        }
        const snippet = decodeEntities(decoded);
        const innerTables = snippet.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
        if (innerTables) {
            hits += innerTables.length;
            tables.push(...innerTables.map((item) => decodeEntities(item)));
        }
    }
    if (diagnostics) {
        diagnostics.documentWriteExpressions = (diagnostics.documentWriteExpressions || 0) + attempts;
        diagnostics.documentWriteHits = (diagnostics.documentWriteHits || 0) + hits;
        if (missSamples.length > 0 && !diagnostics.documentWriteSamples) {
            diagnostics.documentWriteSamples = missSamples;
        }
    }
    return tables;
}

function locateAdjustedTable(html, diagnostics = {}) {
    if (!html) return null;

    const context = buildScriptStringMap(html, diagnostics);
    const candidates = [];
    const seen = new Set();

    const addCandidate = (table, origin) => {
        if (!table) return;
        const decoded = decodeEntities(table);
        if (!decoded) return;
        if (seen.has(decoded)) return;
        seen.add(decoded);
        candidates.push({ html: decoded, origin });
    };

    const pools = [html, decodeEntities(html)];
    for (const pool of pools) {
        if (!pool) continue;
        const directTables = pool.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
        if (directTables) {
            diagnostics.directTables = (diagnostics.directTables || 0) + directTables.length;
            directTables.forEach((table) => addCandidate(table, 'markup'));
        }
        const docTables = collectDocumentWriteTables(pool, context, diagnostics);
        if (docTables && docTables.length > 0) {
            docTables.forEach((table) => addCandidate(table, 'document.write'));
        }
    }

    if (context.size > 0) {
        let assignmentCount = 0;
        for (const value of context.values()) {
            if (value && /<table/i.test(value)) {
                assignmentCount += 1;
                addCandidate(value, 'assignment');
            }
        }
        diagnostics.assignmentTables = (diagnostics.assignmentTables || 0) + assignmentCount;
    }

    diagnostics.candidateCount = candidates.length;
    const markerRegexes = GOODINFO_MARKERS.map((marker) => new RegExp(marker));
    let markerHits = 0;

    for (const candidate of candidates) {
        const table = candidate.html;
        if (!table) continue;
        if (markerRegexes.some((regex) => regex.test(table))) {
            markerHits += 1;
            diagnostics.markerHits = markerHits;
            diagnostics.matchedBy = `${candidate.origin}-marker`;
            return table;
        }
        const headerMatches = table.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi);
        if (!headerMatches) continue;
        const hasAdjustedColumn = headerMatches.some((cell) => {
            const text = normaliseText(cell);
            return /還原/.test(text) && (/收盤/.test(text) || /權值/.test(text));
        });
        if (hasAdjustedColumn) {
            diagnostics.markerHits = markerHits;
            diagnostics.matchedBy = `${candidate.origin}-header`;
            return table;
        }
    }

    diagnostics.markerHits = markerHits;
    diagnostics.matchedBy = diagnostics.matchedBy || null;
    return null;
}

function parseAdjustedRows(tableHtml, diagnostics = {}) {
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
    if (!headers) {
        if (diagnostics) diagnostics.headers = [];
        return [];
    }
    if (diagnostics) {
        diagnostics.headers = headers;
    }
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
    if (diagnostics) {
        diagnostics.rowCount = parsed.length;
        diagnostics.firstDate = parsed[0]?.date || null;
        diagnostics.lastDate = parsed[parsed.length - 1]?.date || null;
    }
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

function extractCharsetFromContentType(contentType) {
    if (!contentType) return null;
    const match = contentType.match(/charset\s*=\s*([^;]+)/i);
    if (!match || !match[1]) return null;
    return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function extractCharsetFromHtml(buffer) {
    if (!buffer || buffer.length === 0) return null;
    const asciiSnippet = buffer.slice(0, 1024).toString('latin1');
    const metaMatch = asciiSnippet.match(/charset\s*=\s*(["']?)([\w\-]+)\1/i);
    if (metaMatch && metaMatch[2]) {
        return metaMatch[2].trim();
    }
    return null;
}

function normaliseEncodingName(name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    if (['big5', 'big-5', 'big5-hkscs', 'big5hkscs', 'x-windows-950', 'windows-950', 'ms950', 'cp950'].includes(lower)) {
        return 'big5';
    }
    if (['utf8', 'utf-8'].includes(lower)) {
        return 'utf-8';
    }
    if (['utf16le', 'utf-16le'].includes(lower)) {
        return 'utf-16le';
    }
    if (['latin1', 'iso-8859-1'].includes(lower)) {
        return 'latin1';
    }
    return lower;
}

function decodeBuffer(buffer, encodingHint) {
    let encoding = normaliseEncodingName(encodingHint) || 'utf-8';
    try {
        const decoder = new TextDecoder(encoding, { fatal: false });
        return decoder.decode(buffer);
    } catch (error) {
        if (encoding !== 'utf-8') {
            const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
            return fallbackDecoder.decode(buffer);
        }
        throw error;
    }
}

async function fetchHtml(fetchImpl, url) {
    const response = await fetchImpl(url, { headers: GOODINFO_HEADERS });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const headerCharset = extractCharsetFromContentType(response.headers.get('content-type'));
    const charset = headerCharset || extractCharsetFromHtml(buffer) || 'utf-8';
    return decodeBuffer(buffer, charset);
}

async function tryFetchAdjusted(fetchImpl, stockNo, endpointBuilder, attemptLog = {}) {
    const url = endpointBuilder(stockNo);
    attemptLog.url = url;
    console.log(`[Goodinfo ${GOODINFO_VERSION}] 嘗試抓取 ${url}`);
    let html;
    try {
        html = await fetchHtml(fetchImpl, url);
    } catch (error) {
        attemptLog.status = 'http-error';
        attemptLog.error = error.message;
        throw error;
    }
    attemptLog.contentLength = html ? html.length : 0;
    const diagnostics = {};
    const tableHtml = locateAdjustedTable(html, diagnostics);
    if (!tableHtml) {
        attemptLog.status = 'no-table';
        attemptLog.diagnostics = { ...diagnostics };
        throw new Error('找不到還原權值股價表格');
    }
    const rows = parseAdjustedRows(tableHtml, diagnostics);
    if (!rows || rows.length === 0) {
        attemptLog.status = 'parse-error';
        attemptLog.diagnostics = { ...diagnostics };
        throw new Error('解析還原權值股價表格失敗');
    }
    const stockName = extractStockName(html, stockNo);
    console.log(`[Goodinfo ${GOODINFO_VERSION}] 成功解析 ${rows.length} 筆資料 (${url})`);
    attemptLog.status = 'success';
    attemptLog.stockName = stockName;
    attemptLog.rowCount = rows.length;
    attemptLog.firstDate = diagnostics.firstDate || (rows[0]?.date ?? null);
    attemptLog.lastDate = diagnostics.lastDate || (rows[rows.length - 1]?.date ?? null);
    attemptLog.matchedBy = diagnostics.matchedBy || null;
    attemptLog.diagnostics = { ...diagnostics };
    return { stockName, rows, diagnostics: attemptLog.diagnostics };
}

export async function fetchGoodinfoAdjustedSeries(fetchImpl, stockNo, options = {}) {
    if (!fetchImpl) {
        throw new Error('缺少 fetch 實例');
    }
    if (!stockNo) {
        throw new Error('缺少股票代號');
    }
    const builders = [
        (id) => `https://goodinfo.tw/tw/index.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/StockInfo/index.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/tw/StockDividendSchedule.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/StockInfo/StockDividendSchedule.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/StockInfo/StockDetail.asp?STOCK_ID=${encodeURIComponent(id)}`,
        (id) => `https://goodinfo.tw/StockInfo/StockPriceHistory.asp?STOCK_ID=${encodeURIComponent(id)}`,
    ];
    const errors = [];
    const attemptRecords = [];
    const normaliseAttempt = (log) => {
        if (!log) return null;
        const record = {
            url: log.url,
            status: log.status || 'error',
        };
        if (log.error) record.error = log.error;
        if (typeof log.contentLength === 'number') record.contentLength = log.contentLength;
        if (typeof log.rowCount === 'number') record.rowCount = log.rowCount;
        if (log.firstDate) record.firstDate = log.firstDate;
        if (log.lastDate) record.lastDate = log.lastDate;
        if (log.matchedBy) record.matchedBy = log.matchedBy;
        if (log.stockName) record.stockName = log.stockName;
        if (log.diagnostics) record.diagnostics = log.diagnostics;
        return record;
    };
    for (const builder of builders) {
        const attemptLog = {};
        try {
            const result = await tryFetchAdjusted(fetchImpl, stockNo, builder, attemptLog);
            attemptRecords.push(normaliseAttempt(attemptLog));
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
            return { ...result, version: GOODINFO_VERSION, debug: { attempts: attemptRecords.filter(Boolean) } };
        } catch (error) {
            if (!attemptLog.url) {
                attemptLog.url = builder(stockNo);
            }
            attemptLog.status = attemptLog.status || 'error';
            attemptLog.error = attemptLog.error || error.message;
            attemptLog.diagnostics = attemptLog.diagnostics || null;
            attemptRecords.push(normaliseAttempt(attemptLog));
            console.warn(`[Goodinfo ${GOODINFO_VERSION}] ${attemptLog.url} 失敗: ${error.message}`);
            errors.push(`${attemptLog.url} => ${error.message}`);
        }
    }
    const err = new Error(`無法自 Goodinfo 取得還原股價 (${errors.join('; ')})`);
    err.version = GOODINFO_VERSION;
    err.attempts = attemptRecords.filter(Boolean);
    err.debug = { attempts: err.attempts };
    throw err;
}

export { GOODINFO_VERSION };
