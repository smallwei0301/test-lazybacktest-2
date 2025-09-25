// --- Web Worker (backtest-worker.js) - v3.4.2 ---
// 變更:
// - getSuggestion: 修正建議邏輯，確保正確反映賣出/回補/等待狀態
// - runStrategy: 驗證年化報酬率計算
// - 確保 workerCachedStockData 正確傳遞和使用
// - Patch LB-TODAY-ACTION-20250727B: 備援建議流程輸出統一結構與說明

// 全局變數 (Worker 範圍)
let workerCachedStockData = null; // 在 Worker 中快取數據

// --- 輔助函數 (指標計算 & 風險指標 - 同 v3.3.x) ---
function calculateMA(prices, period) { /* ... (程式碼與 Part 1/2 相同) ... */ if (!Array.isArray(prices) || period <= 0 || prices.length < period) { return new Array(prices.length).fill(null); } const ma = new Array(prices.length).fill(null); let sum = 0; let iCount = 0; for (let i = 0; i < period; i++) { if (prices[i] !== null && !isNaN(prices[i])) { sum += prices[i]; iCount++; } } if(iCount < period && prices.length >= period) { let firstValidWindowFound = false; for(let start = 0; start <= prices.length - period; start++) { sum = 0; iCount = 0; let windowIsValid = true; for(let k=0; k<period; k++) { if (prices[start+k] !== null && !isNaN(prices[start+k])) { sum += prices[start+k]; iCount++; } else { windowIsValid = false; break; } } if (windowIsValid && iCount === period) { ma[start + period - 1] = sum / period; firstValidWindowFound = true; for (let i = start + period; i < prices.length; i++) { if (prices[i] === null || isNaN(prices[i]) || prices[i-period] === null || isNaN(prices[i-period])) { ma[i] = null; sum = NaN; continue; } if (isNaN(sum)) { let recoverySum = 0; let recoveryCount = 0; for (let j = 0; j < period; j++) { const priceIndex = i - period + 1 + j; if (priceIndex >= 0 && prices[priceIndex] !== null && !isNaN(prices[priceIndex])) { recoverySum += prices[priceIndex]; recoveryCount++; } else { recoveryCount = 0; break; } } if (recoveryCount === period) { sum = recoverySum; ma[i] = sum / period; } else { ma[i] = null; } } else { try { sum = sum - prices[i - period] + prices[i]; ma[i] = sum / period; } catch(e) { ma[i] = null; sum = NaN; } } } return ma; } } if (!firstValidWindowFound) { /* console.warn(`[Worker MA] No valid window of size ${period} found.`); */ return new Array(prices.length).fill(null); } } else if (prices.length < period) { /* console.warn(`[Worker MA] prices length ${prices.length} < period ${period}`); */ return new Array(prices.length).fill(null); } if (iCount === period) { ma[period - 1] = sum / period; } else { return new Array(prices.length).fill(null); } for (let i = period; i < prices.length; i++) { if (prices[i] === null || isNaN(prices[i]) || prices[i-period] === null || isNaN(prices[i-period])) { ma[i] = null; sum = NaN; continue; } if (isNaN(sum)) { let recoverySum = 0; let recoveryCount = 0; for (let j = 0; j < period; j++) { const priceIndex = i - period + 1 + j; if (priceIndex >= 0 && prices[priceIndex] !== null && !isNaN(prices[priceIndex])) { recoverySum += prices[priceIndex]; recoveryCount++; } else { recoveryCount = 0; break; } } if (recoveryCount === period) { sum = recoverySum; ma[i] = sum / period; } else { ma[i] = null; } } else { try { sum = sum - prices[i - period] + prices[i]; ma[i] = sum / period; } catch(e) { /* console.error(`[Worker MA] Error at index ${i}:`, e); */ ma[i] = null; sum = NaN; } } } return ma; }
function calculateEMA(prices, period) { /* ... (程式碼與 Part 1/2 相同) ... */ if (!Array.isArray(prices) || period <= 0 || prices.length < period) { return new Array(prices.length).fill(null); } const ema = new Array(prices.length).fill(null); const multiplier = 2 / (period + 1); let emaPrev = null; let sum = 0; let validCount = 0; for(let i=0; i<period; i++){ if(prices[i] !== null && !isNaN(prices[i])){ sum += prices[i]; validCount++; } } if(validCount < period) return new Array(prices.length).fill(null); emaPrev = sum / period; ema[period - 1] = emaPrev; for (let i = period; i < prices.length; i++) { if (prices[i] === null || isNaN(prices[i]) || emaPrev === null) { ema[i] = null; emaPrev = null; continue; } try { const emaCurrent = (prices[i] - emaPrev) * multiplier + emaPrev; ema[i] = emaCurrent; emaPrev = emaCurrent; } catch(e) { ema[i] = null; emaPrev = null; } } return ema; }
function calculateRSI(prices, period = 14) { /* ... (程式碼與 Part 1/2 相同) ... */ if (!Array.isArray(prices) || period <= 0 || prices.length <= period) { return new Array(prices.length).fill(null); } const rsi = new Array(prices.length).fill(null); const changes = []; let firstValidIdx = -1; for (let i = 1; i < prices.length; i++) { if(prices[i] !== null && !isNaN(prices[i]) && prices[i-1] !== null && !isNaN(prices[i-1])) { changes.push(prices[i] - prices[i - 1]); if (firstValidIdx === -1) firstValidIdx = i - 1; } else { changes.push(null); } } if(firstValidIdx === -1 || firstValidIdx > prices.length - period - 1) { return new Array(prices.length).fill(null); } let gains = 0; let losses = 0; let validCount = 0; const startIdx = firstValidIdx; if (startIdx + period > changes.length) return new Array(prices.length).fill(null); for (let i = startIdx; i < startIdx + period; i++) { if (changes[i] === null) return new Array(prices.length).fill(null); if (changes[i] > 0) gains += changes[i]; else losses -= changes[i]; validCount++; } if(validCount < period) return new Array(prices.length).fill(null); let avgGain = gains / period; let avgLoss = losses / period; const firstRsiIdx = startIdx + period; if(firstRsiIdx >= prices.length) return new Array(prices.length).fill(null); try { if (avgLoss === 0) { rsi[firstRsiIdx] = 100; } else { const rs = avgGain / avgLoss; rsi[firstRsiIdx] = 100 - (100 / (1 + rs)); } } catch(e) { rsi[firstRsiIdx] = null; } for (let i = startIdx + period; i < changes.length; i++) { const currentChange = changes[i]; const targetIdx = i + 1; if(targetIdx >= prices.length) break; if (currentChange === null || avgGain === null || avgLoss === null) { avgGain = null; avgLoss = null; rsi[targetIdx] = null; continue; } try { const currentGain = currentChange > 0 ? currentChange : 0; const currentLoss = currentChange < 0 ? -currentChange : 0; avgGain = (avgGain * (period - 1) + currentGain) / period; avgLoss = (avgLoss * (period - 1) + currentLoss) / period; if (avgLoss === 0) { rsi[targetIdx] = 100; } else { const rs = avgGain / avgLoss; rsi[targetIdx] = 100 - (100 / (1 + rs)); } } catch(e) { rsi[targetIdx] = null; }} return rsi; }
function calculateDIEMA(diValues, period) { /* ... (程式碼與 Part 1/2 相同) ... */ if (!Array.isArray(diValues) || period <= 0 || diValues.length < period) { return new Array(diValues.length).fill(null); } const ema = new Array(diValues.length).fill(null); let emaPrev = null; let firstEmaIdx = -1; let sum = 0; let count = 0; for (let i = 0; i < period; i++) { if (diValues[i] !== null && !isNaN(diValues[i])) { sum += diValues[i]; count++; } } if (count === period) { ema[period - 1] = sum / period; emaPrev = ema[period - 1]; firstEmaIdx = period - 1; } else { return ema; } for (let i = period; i < diValues.length; i++) { if (diValues[i] === null || isNaN(diValues[i]) || emaPrev === null) { ema[i] = null; emaPrev = null; continue; } try { ema[i] = (emaPrev * (period - 1) + diValues[i] * 2) / (period + 1); emaPrev = ema[i]; } catch (e) { ema[i] = null; emaPrev = null; } } return ema; }
function calculateMACD(highs, lows, closes, shortP=12, longP=26, signalP=9) { /* ... (程式碼與上次 Part 3 相同) ... */ const n = highs.length; if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes) || highs.length !== n || lows.length !== n || closes.length !== n || shortP <= 0 || longP <= shortP || signalP <= 0 || n < longP) { return { macd: Array(n).fill(null), signal: Array(n).fill(null), histogram: Array(n).fill(null) }; } const diValues = Array(n).fill(null); for (let i = 0; i < n; i++) { if (highs[i] !== null && !isNaN(highs[i]) && lows[i] !== null && !isNaN(lows[i]) && closes[i] !== null && !isNaN(closes[i])) { try { diValues[i] = (highs[i] + lows[i] + 2 * closes[i]) / 4; } catch (e) { diValues[i] = null; } } } const emaN = calculateDIEMA(diValues, shortP); const emaM = calculateDIEMA(diValues, longP); const difLine = Array(n).fill(null); const validDifValues = []; let firstDifIdx = -1; for (let i = longP - 1; i < n; i++) { if (emaN[i] !== null && emaM[i] !== null) { try { difLine[i] = emaN[i] - emaM[i]; if (firstDifIdx === -1) firstDifIdx = i; validDifValues.push({ index: i, value: difLine[i] }); } catch (e) { difLine[i] = null; } } } const signalLine = Array(n).fill(null); if (validDifValues.length >= signalP) { let signalPrev = null; for (let i = 0; i < validDifValues.length; i++) { const currentDifData = validDifValues[i]; const targetIdx = currentDifData.index; if (i === signalP - 1) { let sum = 0; let count = 0; for (let j = 0; j < signalP; j++) { if (validDifValues[j].value !== null && !isNaN(validDifValues[j].value)) { sum += validDifValues[j].value; count++; } } if (count === signalP) { signalLine[targetIdx] = sum / signalP; signalPrev = signalLine[targetIdx]; } else { signalLine[targetIdx] = null; signalPrev = null; } } else if (i >= signalP) { if (signalPrev !== null && currentDifData.value !== null && !isNaN(currentDifData.value)) { try { signalLine[targetIdx] = (signalPrev * (signalP - 1) + currentDifData.value * 2) / (signalP + 1); signalPrev = signalLine[targetIdx]; } catch (e) { signalLine[targetIdx] = null; signalPrev = null; } } else { signalLine[targetIdx] = null; signalPrev = null; } } else { signalLine[targetIdx] = null; } } } const hist = Array(n).fill(null); for (let i = 0; i < n; i++) { if (difLine[i] !== null && signalLine[i] !== null) { try { hist[i] = difLine[i] - signalLine[i]; } catch (e) { hist[i] = null; } } } return { macd: difLine, signal: signalLine, histogram: hist }; }
function calculateBollingerBands(prices, period=20, deviations=2) { /* ... (程式碼與上次 Part 3 相同) ... */ if (!Array.isArray(prices) || period <= 0 || deviations <= 0 || prices.length < period) { return { upper: Array(prices.length).fill(null), middle: Array(prices.length).fill(null), lower: Array(prices.length).fill(null) }; } const middle = calculateMA(prices, period); const upper = Array(prices.length).fill(null); const lower = Array(prices.length).fill(null); for (let i = period - 1; i < prices.length; i++) { if (middle[i] === null) { upper[i] = null; lower[i] = null; continue; } let vSum = 0; let count = 0; for (let j = i - period + 1; j <= i; j++) { if(prices[j] === null || isNaN(prices[j])) { vSum = NaN; break; } try { vSum += Math.pow(prices[j] - middle[i], 2); count++; } catch(e) { vSum = NaN; break; } } if (isNaN(vSum) || count < period) { upper[i] = null; lower[i] = null; continue; } try { const stdDev = Math.sqrt(vSum / period); upper[i] = middle[i] + deviations * stdDev; lower[i] = middle[i] - deviations * stdDev; } catch(e) { upper[i] = null; lower[i] = null; } } return { upper, middle, lower }; }
function calculateKD(highs, lows, closes, period = 9) { /* ... (程式碼與上次 Part 3 相同) ... */ const n = closes.length; if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes) || highs.length !== n || lows.length !== n || period <= 0 || n < period) { /* console.warn("[Worker KD] Invalid input data or period."); */ return { k: Array(n).fill(null), d: Array(n).fill(null) }; } const rsvArr = Array(n).fill(null); const kLine = Array(n).fill(null); const dLine = Array(n).fill(null); for (let i = period - 1; i < n; i++) { let hh = -Infinity; let ll = Infinity; let validPeriod = true; for (let j = i - period + 1; j <= i; j++) { if (j < 0 || highs[j] === null || isNaN(highs[j]) || lows[j] === null || isNaN(lows[j])) { validPeriod = false; break; } hh = Math.max(hh, highs[j]); ll = Math.min(ll, lows[j]); } if (!validPeriod || closes[i] === null || isNaN(closes[i])) { rsvArr[i] = null; continue; } try { if (hh === ll) { rsvArr[i] = (i > 0 && rsvArr[i-1] !== null) ? rsvArr[i-1] : 50; } else { rsvArr[i] = ((closes[i] - ll) / (hh - ll)) * 100; } } catch(e) { /* console.error(`[Worker KD] RSV Error at ${i}:`, e); */ rsvArr[i] = null; } } let kPrev = null; let dPrev = null; for(let i = 0; i < n; i++) { const currentRsv = rsvArr[i]; if (currentRsv === null) { kLine[i] = null; dLine[i] = null; kPrev = null; dPrev = null; continue; } const yesterdayK = (kPrev !== null) ? kPrev : 50.0; const yesterdayD = (dPrev !== null) ? dPrev : 50.0; let kNow = null; let dNow = null; try { kNow = (1/3) * currentRsv + (2/3) * yesterdayK; dNow = (1/3) * kNow + (2/3) * yesterdayD; kLine[i] = Math.max(0, Math.min(100, kNow)); dLine[i] = Math.max(0, Math.min(100, dNow)); } catch (e) { /* console.error(`[Worker KD] K/D Error at ${i}:`, e); */ kLine[i] = null; dLine[i] = null; } kPrev = kLine[i]; dPrev = dLine[i]; } return { k: kLine, d: dLine }; }
function calculateWilliams(highs, lows, closes, period=14) { /* ... (程式碼與上次 Part 3 相同) ... */ if (!Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(closes) || highs.length !== lows.length || highs.length !== closes.length || period <= 0 || closes.length < period) { return Array(closes.length).fill(null); } const williams = Array(closes.length).fill(null); for (let i = period - 1; i < closes.length; i++) { let hh = -Infinity; let ll = Infinity; let validP = true; for (let j = i - period + 1; j <= i; j++) { if (highs[j] === null || isNaN(highs[j]) || lows[j] === null || isNaN(lows[j])) { validP = false; break; } hh = Math.max(hh, highs[j]); ll = Math.min(ll, lows[j]); } if (!validP || closes[i] === null || isNaN(closes[i])) { williams[i] = null; continue; } try { if (hh === ll) { williams[i] = (i > 0 && williams[i-1] !== null) ? williams[i-1] : -50; } else { williams[i] = ((hh - closes[i]) / (hh - ll)) * -100; } } catch(e) { williams[i] = null; } } return williams; }
function calculateDailyReturns(portfolioVals, dates) { /* ... (程式碼與上次 Part 3 相同) ... */ if (!portfolioVals || portfolioVals.length < 2) return []; const returns = []; for (let i = 1; i < portfolioVals.length; i++) { if (portfolioVals[i] !== null && !isNaN(portfolioVals[i]) && portfolioVals[i - 1] !== null && !isNaN(portfolioVals[i - 1]) && portfolioVals[i - 1] !== 0) { returns.push((portfolioVals[i] / portfolioVals[i - 1]) - 1); } else { returns.push(0); } } return returns; }
function calculateSharpeRatio(dailyReturns, annualReturn) { /* ... (程式碼與上次 Part 3 相同) ... */ const rfAnnual = 0.01; if (!dailyReturns || dailyReturns.length === 0) return 0; const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length; const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length; const stdDev = Math.sqrt(variance); if (stdDev === 0) return 0; const annStdDev = stdDev * Math.sqrt(252); const annExcessReturn = (annualReturn / 100) - rfAnnual; return annStdDev !== 0 ? annExcessReturn / annStdDev : 0; }
function calculateSortinoRatio(dailyReturns, annualReturn) { /* ... (程式碼與上次 Part 3 相同) ... */ const targetAnn = 0.01; const targetDay = Math.pow(1 + targetAnn, 1 / 252) - 1; if (!dailyReturns || dailyReturns.length === 0) return 0; const downsideDiffs = dailyReturns.map(r => Math.min(0, r - targetDay)); const downsideVar = downsideDiffs.reduce((s, d) => s + Math.pow(d, 2), 0) / dailyReturns.length; const downsideDev = Math.sqrt(downsideVar); if (downsideDev === 0) return Infinity; const annDownsideDev = downsideDev * Math.sqrt(252); const annExcessReturn = (annualReturn / 100) - targetAnn; return annDownsideDev !== 0 ? annExcessReturn / annDownsideDev : Infinity; }
function calculateMaxDrawdown(portfolioValues) { /* ... (程式碼與上次 Part 3 相同) ... */ let peak = -Infinity; let maxDD = 0; for (const value of portfolioValues) { if (value === null || isNaN(value)) continue; peak = Math.max(peak, value); const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0; maxDD = Math.max(maxDD, drawdown); } return maxDD; }

// --- 數據獲取 ---
function formatTWDateWorker(twDate) { /* ... (程式碼與上次 Part 3 相同) ... */ try { if (!twDate || typeof twDate !== 'string') return null; const parts = twDate.split('/'); if (parts.length !== 3) return null; const [y, m, d] = parts; const yInt = parseInt(y); if (isNaN(yInt) || parseInt(m) < 1 || parseInt(m) > 12 || parseInt(d) < 1 || parseInt(d) > 31) return null; return `${1911 + yInt}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; } catch (e) { console.warn(`Worker Date Error: ${twDate}`, e); return null; } }
async function fetchStockData(stockNo, start, end) { /* ... (程式碼與上次 Part 3 相同) ... */ const startDate = new Date(start); const endDate = new Date(end); if (isNaN(startDate) || isNaN(endDate)) throw new Error("Invalid date range"); const allData = []; const months = []; let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1); self.postMessage({ type: 'progress', progress: 5, message: '準備獲取數據...' }); while (current <= endDate) { const y = current.getFullYear(); const m = String(current.getMonth() + 1).padStart(2, '0'); months.push(`${y}${m}01`); current.setMonth(current.getMonth() + 1); } if (months.length === 0 && startDate <= endDate) { const y = startDate.getFullYear(); const m = String(startDate.getMonth() + 1).padStart(2, '0'); months.push(`${y}${m}01`); } for (let i = 0; i < months.length; i++) { const month = months[i]; const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${stockNo}&date=${month}&_=${Date.now()}`; try { const response = await fetch(url); if (!response.ok) { console.warn(`Workspace ${stockNo} (${month.substring(0,6)}) failed: ${response.status}`); continue; } const data = await response.json(); if (data.stat === "OK" && Array.isArray(data.data)) { const filtered = data.data.map(item => { const dateStr = formatTWDateWorker(item[0]); if (!dateStr) return null; const itemDate = new Date(dateStr); if (!isNaN(itemDate) && itemDate >= startDate && itemDate <= endDate) { const o=parseFloat(item[3].replace(/,/g,'')); const h=parseFloat(item[4].replace(/,/g,'')); const l=parseFloat(item[5].replace(/,/g,'')); const c=parseFloat(item[6].replace(/,/g,'')); const v=parseFloat(item[1].replace(/,/g,'')); if([o,h,l,c,v].some(isNaN)) { return null; } return { date:dateStr, open:o, high:h, low:l, close:c, volume:v/1000 }; } return null; }).filter(item => item !== null); allData.push(...filtered); } else if (data.stat !== "OK") { /* console.warn(`API status not OK (${stockNo}, ${month.substring(0,6)}): ${data.stat}`); */ } } catch (e) { console.error(`Workspace ${stockNo} (${month.substring(0,6)}) error:`, e); continue; } const progress = 5 + Math.floor(((i + 1) / months.length) * 45); self.postMessage({ type: 'progress', progress: progress, message: `已獲取 ${month.substring(0,6)} 數據...` }); await new Promise(r => setTimeout(r, 300 + Math.random() * 200)); } const uniqueData = Array.from(new Map(allData.map(item => [item.date, item])).values()); const sortedData = uniqueData.sort((a, b) => new Date(a.date) - new Date(b.date)); self.postMessage({ type: 'progress', progress: 50, message: '數據處理完成...' }); if (sortedData.length === 0) throw new Error(`指定範圍 (${start} ~ ${end}) 無 ${stockNo} 交易數據`); return sortedData; }

// --- 計算所有指標 ---
function calculateAllIndicators(data, params) { /* ... (程式碼與上次 Part 3 相同) ... */ self.postMessage({ type: 'progress', progress: 55, message: '計算指標...' }); const closes=data.map(d=>d.close); const highs=data.map(d=>d.high); const lows=data.map(d=>d.low); const volumes=data.map(d=>d.volume); const indic={}; const { entryParams: ep, exitParams: xp, enableShorting, shortEntryParams: sep, shortExitParams: sxp } = params; try { const maCalculator = calculateMA; const shortMAPeriod = ep?.shortPeriod || 5; const longMAPeriod = ep?.longPeriod || 20; const exitMAPeriod = xp?.period || ep?.period || longMAPeriod; indic.maShort = maCalculator(closes, shortMAPeriod); indic.maLong = maCalculator(closes, longMAPeriod); indic.maExit = maCalculator(closes, exitMAPeriod); const getParam = (longParam, shortParam, defaultVal) => { const p1 = longParam; const p2 = enableShorting ? shortParam : undefined; if (p1 !== undefined && p2 !== undefined && p1 !== p2) { return { long: p1 ?? defaultVal, short: p2 ?? defaultVal }; } if (p1 !== undefined) return p1 ?? defaultVal; if (p2 !== undefined) return p2 ?? defaultVal; return defaultVal; }; const rsiEntryPeriod = getParam(ep?.period, sxp?.period, 14); const rsiExitPeriod = getParam(xp?.period, sep?.period, 14); indic.rsiEntry = calculateRSI(closes, typeof rsiEntryPeriod === 'object' ? rsiEntryPeriod.long : rsiEntryPeriod); indic.rsiExit = calculateRSI(closes, typeof rsiExitPeriod === 'object' ? rsiExitPeriod.long : rsiExitPeriod); if (enableShorting) { indic.rsiCover = calculateRSI(closes, typeof rsiEntryPeriod === 'object' ? rsiEntryPeriod.short : rsiEntryPeriod); indic.rsiShortEntry = calculateRSI(closes, typeof rsiExitPeriod === 'object' ? rsiExitPeriod.short : rsiExitPeriod); } const macdEntryShort = ep?.shortPeriod || 12; const macdEntryLong = ep?.longPeriod || 26; const macdEntrySignal = ep?.signalPeriod || 9; const macdCoverShort = enableShorting ? (sxp?.shortPeriod ?? macdEntryShort) : macdEntryShort; const macdCoverLong = enableShorting ? (sxp?.longPeriod ?? macdEntryLong) : macdEntryLong; const macdCoverSignal = enableShorting ? (sxp?.signalPeriod ?? macdEntrySignal) : macdEntrySignal; if (!enableShorting || (macdEntryShort === macdCoverShort && macdEntryLong === macdCoverLong && macdEntrySignal === macdCoverSignal)) { const macdResult = calculateMACD(highs, lows, closes, macdEntryShort, macdEntryLong, macdEntrySignal); indic.macdEntry = macdResult.macd; indic.macdSignalEntry = macdResult.signal; indic.macdHistEntry = macdResult.histogram; if (enableShorting) { indic.macdCover = indic.macdEntry; indic.macdSignalCover = indic.macdSignalEntry; indic.macdHistCover = indic.macdHistEntry; } } else { const macdEntryResult = calculateMACD(highs, lows, closes, macdEntryShort, macdEntryLong, macdEntrySignal); indic.macdEntry = macdEntryResult.macd; indic.macdSignalEntry = macdEntryResult.signal; indic.macdHistEntry = macdEntryResult.histogram; const macdCoverResult = calculateMACD(highs, lows, closes, macdCoverShort, macdCoverLong, macdCoverSignal); indic.macdCover = macdCoverResult.macd; indic.macdSignalCover = macdCoverResult.signal; indic.macdHistCover = macdCoverResult.histogram; } const macdExitShort = xp?.shortPeriod || 12; const macdExitLong = xp?.longPeriod || 26; const macdExitSignal = xp?.signalPeriod || 9; const macdShortEntryShort = enableShorting ? (sep?.shortPeriod ?? macdExitShort) : macdExitShort; const macdShortEntryLong = enableShorting ? (sep?.longPeriod ?? macdExitLong) : macdExitLong; const macdShortEntrySignal = enableShorting ? (sep?.signalPeriod ?? macdExitSignal) : macdExitSignal; if (!enableShorting || (macdExitShort === macdShortEntryShort && macdExitLong === macdShortEntryLong && macdExitSignal === macdShortEntrySignal)) { const macdResult = calculateMACD(highs, lows, closes, macdExitShort, macdExitLong, macdExitSignal); indic.macdExit = macdResult.macd; indic.macdSignalExit = macdResult.signal; indic.macdHistExit = macdResult.histogram; if (enableShorting) { indic.macdShortEntry = indic.macdExit; indic.macdSignalShortEntry = indic.macdSignalExit; indic.macdHistShortEntry = indic.macdHistExit; } } else { const macdExitResult = calculateMACD(highs, lows, closes, macdExitShort, macdExitLong, macdExitSignal); indic.macdExit = macdExitResult.macd; indic.macdSignalExit = macdExitResult.signal; indic.macdHistExit = macdExitResult.histogram; const macdShortEntryResult = calculateMACD(highs, lows, closes, macdShortEntryShort, macdShortEntryLong, macdShortEntrySignal); indic.macdShortEntry = macdShortEntryResult.macd; indic.macdSignalShortEntry = macdShortEntryResult.signal; indic.macdHistShortEntry = macdShortEntryResult.histogram; } const bbEntryPeriod = ep?.period || 20; const bbEntryDev = ep?.deviations || 2; const bbCoverPeriod = enableShorting ? (sxp?.period ?? bbEntryPeriod) : bbEntryPeriod; const bbCoverDev = enableShorting ? (sxp?.deviations ?? bbEntryDev) : bbEntryDev; if (!enableShorting || (bbEntryPeriod === bbCoverPeriod && bbEntryDev === bbCoverDev)) { const bbResult = calculateBollingerBands(closes, bbEntryPeriod, bbEntryDev); indic.bollingerUpperEntry = bbResult.upper; indic.bollingerMiddleEntry = bbResult.middle; indic.bollingerLowerEntry = bbResult.lower; if (enableShorting) { indic.bollingerUpperCover = indic.bollingerUpperEntry; indic.bollingerMiddleCover = indic.bollingerMiddleEntry; indic.bollingerLowerCover = indic.bollingerLowerEntry; } } else { const bbEntryResult = calculateBollingerBands(closes, bbEntryPeriod, bbEntryDev); indic.bollingerUpperEntry = bbEntryResult.upper; indic.bollingerMiddleEntry = bbEntryResult.middle; indic.bollingerLowerEntry = bbEntryResult.lower; const bbCoverResult = calculateBollingerBands(closes, bbCoverPeriod, bbCoverDev); indic.bollingerUpperCover = bbCoverResult.upper; indic.bollingerMiddleCover = bbCoverResult.middle; indic.bollingerLowerCover = bbCoverResult.lower; } const bbExitPeriod = xp?.period || 20; const bbExitDev = xp?.deviations || 2; const bbShortEntryPeriod = enableShorting ? (sep?.period ?? bbExitPeriod) : bbExitPeriod; const bbShortEntryDev = enableShorting ? (sep?.deviations ?? bbExitDev) : bbExitDev; if (!enableShorting || (bbExitPeriod === bbShortEntryPeriod && bbExitDev === bbShortEntryDev)) { const bbResult = calculateBollingerBands(closes, bbExitPeriod, bbExitDev); indic.bollingerUpperExit = bbResult.upper; indic.bollingerMiddleExit = bbResult.middle; indic.bollingerLowerExit = bbResult.lower; if (enableShorting) { indic.bollingerUpperShortEntry = indic.bollingerUpperExit; indic.bollingerMiddleShortEntry = indic.bollingerMiddleExit; indic.bollingerLowerShortEntry = indic.bollingerLowerExit; } } else { const bbExitResult = calculateBollingerBands(closes, bbExitPeriod, bbExitDev); indic.bollingerUpperExit = bbExitResult.upper; indic.bollingerMiddleExit = bbExitResult.middle; indic.bollingerLowerExit = bbExitResult.lower; const bbShortEntryResult = calculateBollingerBands(closes, sep?.period || 20, sep?.deviations || 2); indic.bollingerUpperShortEntry = bbShortEntryResult.upper; indic.bollingerMiddleShortEntry = bbShortEntryResult.middle; indic.bollingerLowerShortEntry = bbShortEntryResult.lower; } const kdEntryPeriod = ep?.period || 9; const kdCoverPeriod = enableShorting ? (sxp?.period ?? kdEntryPeriod) : kdEntryPeriod; if (!enableShorting || kdEntryPeriod === kdCoverPeriod) { const kdResult = calculateKD(highs, lows, closes, kdEntryPeriod); indic.kEntry = kdResult.k; indic.dEntry = kdResult.d; if (enableShorting) { indic.kCover = indic.kEntry; indic.dCover = indic.dEntry; } } else { const kdEntryResult = calculateKD(highs, lows, closes, kdEntryPeriod); indic.kEntry = kdEntryResult.k; indic.dEntry = kdEntryResult.d; const kdCoverResult = calculateKD(highs, lows, closes, kdCoverPeriod); indic.kCover = kdCoverResult.k; indic.dCover = kdCoverResult.d; } const kdExitPeriod = xp?.period || 9; const kdShortEntryPeriod = enableShorting ? (sep?.period ?? kdExitPeriod) : kdExitPeriod; if (!enableShorting || kdExitPeriod === kdShortEntryPeriod) { const kdResult = calculateKD(highs, lows, closes, kdExitPeriod); indic.kExit = kdResult.k; indic.dExit = kdResult.d; if (enableShorting) { indic.kShortEntry = indic.kExit; indic.dShortEntry = indic.dExit; } } else { const kdExitResult = calculateKD(highs, lows, closes, kdExitPeriod); indic.kExit = kdExitResult.k; indic.dExit = kdExitResult.d; const kdShortEntryResult = calculateKD(highs, lows, closes, kdShortEntryPeriod); indic.kShortEntry = kdShortEntryResult.k; indic.dShortEntry = kdShortEntryResult.d; } indic.volumeAvgEntry = maCalculator(volumes, ep?.period || 20); const wrEntryPeriod = ep?.period || 14; const wrCoverPeriod = enableShorting ? (sxp?.period ?? wrEntryPeriod) : wrEntryPeriod; if (!enableShorting || wrEntryPeriod === wrCoverPeriod) { indic.williamsEntry = calculateWilliams(highs,lows,closes, wrEntryPeriod); if (enableShorting) indic.williamsCover = indic.williamsEntry; } else { indic.williamsEntry = calculateWilliams(highs,lows,closes, wrEntryPeriod); indic.williamsCover = calculateWilliams(highs,lows,closes, wrCoverPeriod); } const wrExitPeriod = xp?.period || 14; const wrShortEntryPeriod = enableShorting ? (sep?.period ?? wrExitPeriod) : wrExitPeriod; if (!enableShorting || wrExitPeriod === wrShortEntryPeriod) { indic.williamsExit = calculateWilliams(highs,lows,closes, wrExitPeriod); if (enableShorting) indic.williamsShortEntry = indic.williamsExit; } else { indic.williamsExit = calculateWilliams(highs,lows,closes, wrExitPeriod); indic.williamsShortEntry = calculateWilliams(highs,lows,closes, wrShortEntryPeriod); } } catch (calcError) { console.error("[Worker] Indicator calculation error:", calcError); throw new Error(`計算技術指標時發生錯誤: ${calcError.message}`); } self.postMessage({ type: 'progress', progress: 65, message: '指標計算完成...' }); return indic; }

// --- 運行策略回測 (修正年化報酬率計算) ---
function runStrategy(params, data) {
    self.postMessage({ type: 'progress', progress: 70, message: '回測模擬中...' });
    const n = data.length;
        const { initialCapital, positionSize, stopLoss: globalSL, takeProfit: globalTP, 
            entryStrategy, exitStrategy, entryParams, exitParams,
            enableShorting, shortEntryStrategy, shortExitStrategy, shortEntryParams, shortExitParams,
            tradeTiming, buyFee, sellFee, positionBasis } = params;

    if (!data || n === 0) throw new Error("回測數據無效");
    const dates=data.map(d=>d.date); const opens=data.map(d=>d.open); const highs=data.map(d=>d.high); const lows=data.map(d=>d.low); const closes=data.map(d=>d.close); const volumes=data.map(d=>d.volume);
    let indicators; try{ indicators = calculateAllIndicators(data, params); } catch(e) { throw e; }

    const check=(v)=>v!==null&&!isNaN(v)&&isFinite(v);
    let allPeriods = [ entryParams?.shortPeriod, entryParams?.longPeriod, entryParams?.period, entryParams?.breakoutPeriod, entryParams?.signalPeriod, exitParams?.period, exitParams?.stopLossPeriod, exitParams?.signalPeriod, exitParams?.percentage, 9, 14, 20, 26 ]; if (enableShorting) { allPeriods = allPeriods.concat([ shortEntryParams?.period, shortEntryParams?.stopLossPeriod, shortEntryParams?.signalPeriod, shortExitParams?.period, shortExitParams?.breakoutPeriod, shortExitParams?.signalPeriod, shortExitParams?.percentage ]); } const validPeriods = allPeriods.filter(p => typeof p === 'number' && p > 0 && isFinite(p)); const longestLookback = validPeriods.length > 0 ? Math.max(...validPeriods) : 0; const kdNeedLong = (entryStrategy === 'k_d_cross' || exitStrategy === 'k_d_cross_exit') ? (entryParams?.period || exitParams?.period || 9) : 0; const kdNeedShort = enableShorting && (shortEntryStrategy === 'short_k_d_cross' || shortExitStrategy === 'cover_k_d_cross') ? (shortEntryParams?.period || shortExitParams?.period || 9) : 0; const macdNeedLong = (entryStrategy === 'macd_cross' || exitStrategy === 'macd_cross_exit') ? ((entryParams?.longPeriod || exitParams?.longPeriod || 26) + (entryParams?.signalPeriod || exitParams?.signalPeriod || 9) - 1) : 0; const macdNeedShort = enableShorting && (shortEntryStrategy === 'short_macd_cross' || shortExitStrategy === 'cover_macd_cross') ? ((shortEntryParams?.longPeriod || shortExitParams?.longPeriod || 26) + (shortEntryParams?.signalPeriod || shortExitParams?.signalPeriod || 9) - 1) : 0; let startIdx = Math.max(1, longestLookback, kdNeedLong, kdNeedShort, macdNeedLong, macdNeedShort) + 1; startIdx = Math.min(startIdx, n - 1); startIdx = Math.max(1, startIdx);

    const portfolioVal = Array(n).fill(initialCapital); const strategyReturns = Array(n).fill(0); let peakCap = initialCapital; let maxDD = 0; let allTrades = []; let allCompletedTrades = []; let totalWinTrades = 0; let curCL = 0; let maxCL = 0;
    
    // 修正資金分配：不論是否開啟做空，都共享同一筆資金
    let totalCash = initialCapital; // 總現金，在多頭和空頭間共享
    let longPos = 0; let longShares = 0; let lastBuyP = 0; let curPeakP = 0; let longTrades = []; let longCompletedTrades = []; const buySigs = []; const sellSigs = []; const longPl = Array(n).fill(0);
    let shortPos = 0; let shortShares = 0; let lastShortP = 0; let currentLowSinceShort = Infinity; let shortTrades = []; let shortCompletedTrades = []; const shortSigs = []; const coverSigs = []; const shortPl = Array(n).fill(0);

    if (startIdx >= n || n < 2) { return { stockNo: params.stockNo, initialCapital: initialCapital, finalValue: initialCapital, totalProfit: 0, returnRate: 0, annualizedReturn: 0, maxDrawdown: 0, winRate: 0, winTrades: 0, tradesCount: 0, sharpeRatio: 0, sortinoRatio: 0, maxConsecutiveLosses: 0, trades: [], completedTrades: [], buyHoldReturns: Array(n).fill(0), strategyReturns: Array(n).fill(0), dates: dates, chartBuySignals: [], chartSellSignals: [], chartShortSignals: [], chartCoverSignals: [], entryStrategy: params.entryStrategy, exitStrategy: params.exitStrategy, entryParams: params.entryParams, exitParams: params.exitParams, enableShorting: params.enableShorting, shortEntryStrategy: params.shortEntryStrategy, shortExitStrategy: params.shortExitStrategy, shortEntryParams: params.shortEntryParams, shortExitParams: params.shortExitParams, stopLoss: params.stopLoss, takeProfit: params.takeProfit, tradeTiming: params.tradeTiming, buyFee: params.buyFee, sellFee: params.sellFee, positionBasis: params.positionBasis, rawData: data, buyHoldAnnualizedReturn: 0, subPeriodResults: {}, annReturnHalf1: null, sharpeHalf1: null, annReturnHalf2: null, sharpeHalf2: null }; }

    console.log(`[Worker] Starting simulation loop from index ${startIdx} to ${n-1}`);
    for (let i = startIdx; i < n; i++) { const curC=closes[i]; const curH=highs[i]; const curL=lows[i]; const curV=volumes[i]; const curO=opens[i]; const prevC = i > 0 ? closes[i-1] : null; const nextO = (i + 1 < n) ? opens[i+1] : null; longPl[i] = longPl[i-1] ?? 0; shortPl[i] = shortPl[i-1] ?? 0; if(!check(curC) || curC <= 0) { portfolioVal[i] = portfolioVal[i-1] ?? initialCapital; strategyReturns[i] = strategyReturns[i-1] ?? 0; continue; } let tradePrice = null; let tradeDate = dates[i]; let canTradeOpen = (tradeTiming === 'open') && (i + 1 < n) && check(nextO); if (longPos === 1) { try { let sellSignal=false; let slTrig=false; let tpTrig=false; let exitKDValues=null, exitMACDValues=null, exitIndicatorValues=null; switch (exitStrategy) { case 'ma_cross': case 'ema_cross': sellSignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]<indicators.maLong[i]&&indicators.maShort[i-1]>=indicators.maLong[i-1]; if(sellSignal) exitIndicatorValues={'短SMA':[indicators.maShort[i-1], indicators.maShort[i], indicators.maShort[i+1]??null], '長SMA':[indicators.maLong[i-1], indicators.maLong[i], indicators.maLong[i+1]??null]}; break; case 'ma_below': sellSignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC<indicators.maExit[i]&&prevC>=indicators.maExit[i-1]; if(sellSignal) exitIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'SMA':[indicators.maExit[i-1], indicators.maExit[i], indicators.maExit[i+1]??null]}; break; case 'rsi_overbought': const rX=indicators.rsiExit[i],rPX=indicators.rsiExit[i-1],rThX=exitParams.threshold||70; sellSignal=check(rX)&&check(rPX)&&rX<rThX&&rPX>=rThX; if(sellSignal) exitIndicatorValues={'RSI':[rPX, rX, indicators.rsiExit[i+1]??null]}; break; case 'macd_cross': const difX=indicators.macdExit[i],deaX=indicators.macdSignalExit[i],difPX=indicators.macdExit[i-1],deaPX=indicators.macdSignalExit[i-1]; sellSignal=check(difX)&&check(deaX)&&check(difPX)&&check(deaPX)&&difX<deaX&&difPX>=deaPX; if(sellSignal) exitMACDValues={difPrev:difPX,deaPrev:deaPX,difNow:difX,deaNow:deaX,difNext:indicators.macdExit[i+1]??null,deaNext:indicators.macdSignalExit[i+1]??null}; break; case 'bollinger_reversal': const midX = indicators.bollingerMiddleExit[i]; const midPX = indicators.bollingerMiddleExit[i-1]; sellSignal=check(midX)&&check(prevC)&&check(midPX)&&curC<midX&&prevC>=midPX; if(sellSignal) exitIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '中軌':[midPX, midX, indicators.bollingerMiddleExit[i+1]??null]}; break; case 'k_d_cross': const kX=indicators.kExit[i],dX=indicators.dExit[i],kPX=indicators.kExit[i-1],dPX=indicators.dExit[i-1],thY=exitParams.thresholdY||70; sellSignal=check(kX)&&check(dX)&&check(kPX)&&check(dPX)&&kX<dX&&kPX>=dPX&&dX>thY; if(sellSignal) exitKDValues={kPrev:kPX,dPrev:dPX,kNow:kX,dNow:dX,kNext:indicators.kExit[i+1]??null,dNext:indicators.dExit[i+1]??null}; break; case 'trailing_stop': const trailP=exitParams.percentage||5; if(check(curH) && lastBuyP > 0){ curPeakP=Math.max(curPeakP, curH); sellSignal=curC<curPeakP*(1-trailP/100);} if(sellSignal) exitIndicatorValues={'收盤價':[null, curC, null], '觸發價':[null, (curPeakP*(1-trailP/100)).toFixed(2), null]}; break; case 'price_breakdown': const bpX=exitParams.period||20; if(i>=bpX){const lsX=lows.slice(i-bpX,i).filter(l=>check(l)); if(lsX.length>0){const periodLow = Math.min(...lsX); sellSignal=check(curC) && curC<periodLow;} if(sellSignal) exitIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '前低':[null, Math.min(...lows.slice(i-bpX,i).filter(check)), null]};} break; case 'williams_overbought': const wrX=indicators.williamsExit[i],wrPX=indicators.williamsExit[i-1],wrThX=exitParams.threshold||-20; sellSignal=check(wrX)&&check(wrPX)&&wrX<wrThX&&wrPX>=wrThX; if(sellSignal) exitIndicatorValues={'%R':[wrPX, wrX, indicators.williamsExit[i+1]??null]}; break; case 'turtle_stop_loss': const slP=exitParams.stopLossPeriod||10; if(i>=slP){const lowsT=lows.slice(i-slP,i).filter(l=>check(l)); if(lowsT.length>0){ const periodLowT = Math.min(...lowsT); sellSignal = check(curC) && curC < periodLowT;}} if(sellSignal) exitIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'N日低':[null, Math.min(...lows.slice(i-slP,i).filter(check)), null]}; break; case 'fixed_stop_loss': sellSignal=false; break; } if (!sellSignal && globalSL > 0 && lastBuyP > 0) { if (curC <= lastBuyP * (1 - globalSL / 100)) slTrig = true; } if (!sellSignal && !slTrig && globalTP > 0 && lastBuyP > 0) { if (curC >= lastBuyP * (1 + globalTP / 100)) tpTrig = true; } if (sellSignal || slTrig || tpTrig) { tradePrice = null; tradeDate = dates[i]; if (tradeTiming === 'close') tradePrice = curC; else if (canTradeOpen) { tradePrice = nextO; tradeDate = dates[i+1]; } else if (tradeTiming === 'open' && i === n - 1) { tradePrice = curC; tradeDate = dates[i]; } if (check(tradePrice) && tradePrice > 0 && longShares > 0) { const rev = longShares * tradePrice * (1 - sellFee / 100); const costB = longShares * lastBuyP; const entryCostWithFee = costB * (1 + buyFee / 100); const prof = rev - entryCostWithFee; const profP = entryCostWithFee > 0 ? (prof / entryCostWithFee) * 100 : 0; longCap += rev; const tradeData = { type:'sell', date:tradeDate, price:tradePrice, shares:longShares, revenue:rev, profit:prof, profitPercent:profP, capital_after:longCap, triggeredByStopLoss:slTrig, triggeredByTakeProfit:tpTrig, triggeringStrategy: exitStrategy, simType: 'long' }; if (exitKDValues) tradeData.kdValues = exitKDValues; if (exitMACDValues) tradeData.macdValues = exitMACDValues; if (exitIndicatorValues) tradeData.indicatorValues = exitIndicatorValues; longTrades.push(tradeData); sellSigs.push({date:dates[i], index:i}); const lastBuyIdx = longTrades.map(t => t.type).lastIndexOf('buy'); if(lastBuyIdx !== -1 && longTrades[lastBuyIdx].shares === longShares){ longCompletedTrades.push({ entry: longTrades[lastBuyIdx], exit: tradeData, profit: prof, profitPercent: profP }); } else { console.warn(`[Worker LONG] Sell @ ${tradeDate} could not find matching buy trade.`); } console.log(`[Worker LONG] Sell Executed: ${longShares}@${tradePrice} on ${tradeDate}, Profit: ${prof.toFixed(0)}, Cap After: ${longCap.toFixed(0)}`); longPos = 0; longShares = 0; lastBuyP = 0; curPeakP = 0; } else { console.warn(`[Worker LONG] Invalid trade price (${tradePrice}) or zero shares for Sell Signal on ${dates[i]}`); } } } catch (exitError) { console.error(`[Worker LONG EXIT] Error at index ${i} (${dates[i]}):`, exitError); } } if (enableShorting && shortPos === 1) { try{ let coverSignal=false; let shortSlTrig=false; let shortTpTrig=false; let coverKDValues=null, coverMACDValues=null, coverIndicatorValues=null; switch (shortExitStrategy) { case 'cover_ma_cross': case 'cover_ema_cross': coverSignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]>indicators.maLong[i]&&indicators.maShort[i-1]<=indicators.maLong[i-1]; if(coverSignal) coverIndicatorValues={'短SMA':[indicators.maShort[i-1], indicators.maShort[i], indicators.maShort[i+1]??null], '長SMA':[indicators.maLong[i-1], indicators.maLong[i], indicators.maLong[i+1]??null]}; break; case 'cover_ma_above': coverSignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC>indicators.maExit[i]&&prevC<=indicators.maExit[i-1]; if(coverSignal) coverIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'SMA':[indicators.maExit[i-1], indicators.maExit[i], indicators.maExit[i+1]??null]}; break; case 'cover_rsi_oversold': const rC=indicators.rsiCover[i],rPC=indicators.rsiCover[i-1],rThC=shortExitParams.threshold||30; coverSignal=check(rC)&&check(rPC)&&rC>rThC&&rPC<=rThC; if(coverSignal) coverIndicatorValues={'RSI':[rPC, rC, indicators.rsiCover[i+1]??null]}; break; case 'cover_macd_cross': const difC=indicators.macdCover[i],deaC=indicators.macdSignalCover[i],difPC=indicators.macdCover[i-1],deaPC=indicators.macdSignalCover[i-1]; coverSignal=check(difC)&&check(deaC)&&check(difPC)&&check(deaPC)&&difC>deaC&&difPC<=deaPC; if(coverSignal) coverMACDValues={difPrev:difPC,deaPrev:deaPC,difNow:difC,deaNow:deaC,difNext:indicators.macdCover[i+1]??null,deaNext:indicators.macdSignalCover[i+1]??null}; break; case 'cover_bollinger_breakout': const upperC = indicators.bollingerUpperCover[i]; const upperPC = indicators.bollingerUpperCover[i-1]; coverSignal=check(upperC)&&check(prevC)&&check(upperPC)&&curC>upperC&&prevC<=upperPC; if(coverSignal) coverIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '上軌':[upperPC, upperC, indicators.bollingerUpperCover[i+1]??null]}; break; case 'cover_k_d_cross': const kC=indicators.kCover[i],dC=indicators.dCover[i],kPC=indicators.kCover[i-1],dPC=indicators.dCover[i-1],thXC=shortExitParams.thresholdX||30; coverSignal=check(kC)&&check(dC)&&check(kPC)&&check(dPC)&&kC>dC&&kPC<=dPC&&dC<thXC; if(coverSignal) coverKDValues={kPrev:kPC,dPrev:dPC,kNow:kC,dNow:dC,kNext:indicators.kCover[i+1]??null,dNext:indicators.dCover[i+1]??null}; break; case 'cover_price_breakout': const bpC=shortExitParams.period||20; if(i>=bpC){const hsC=highs.slice(i-bpC,i).filter(h=>check(h)); if(hsC.length>0){const periodHighC = Math.max(...hsC); coverSignal=check(curC) && curC>periodHighC; } if(coverSignal) coverIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '前高':[null, Math.max(...highs.slice(i-bpC,i).filter(check)), null]};} break; case 'cover_williams_oversold': const wrC=indicators.williamsCover[i],wrPC=indicators.williamsCover[i-1],wrThC=shortExitParams.threshold||-80; coverSignal=check(wrC)&&check(wrPC)&&wrC>wrThC&&wrPC<=wrThC; if(coverSignal) coverIndicatorValues={'%R':[wrPC, wrC, indicators.williamsCover[i+1]??null]}; break; case 'cover_turtle_breakout': const tpC=shortExitParams.breakoutPeriod||20; if(i>=tpC){const hsCT=highs.slice(i-tpC,i).filter(h=>check(h)); if(hsCT.length>0){const periodHighCT = Math.max(...hsCT); coverSignal=check(curC) && curC>periodHighCT;} if(coverSignal) coverIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'N日高':[null, Math.max(...highs.slice(i-tpC,i).filter(check)), null]};} break; case 'cover_trailing_stop': const shortTrailP = shortExitParams.percentage || 5; if(check(curL) && lastShortP > 0) { currentLowSinceShort = Math.min(currentLowSinceShort, curL); coverSignal = curC > currentLowSinceShort * (1 + shortTrailP / 100); } if(coverSignal) coverIndicatorValues={'收盤價':[null, curC, null], '觸發價':[null, (currentLowSinceShort * (1 + shortTrailP / 100)).toFixed(2), null]}; break; case 'cover_fixed_stop_loss': coverSignal=false; break; } if (!coverSignal && globalSL > 0 && lastShortP > 0) { if (curC >= lastShortP * (1 + globalSL / 100)) shortSlTrig = true; } if (!coverSignal && !shortSlTrig && globalTP > 0 && lastShortP > 0) { if (curC <= lastShortP * (1 - globalTP / 100)) shortTpTrig = true; } if (coverSignal || shortSlTrig || shortTpTrig) { tradePrice = null; tradeDate = dates[i]; if (tradeTiming === 'close') tradePrice = curC; else if (canTradeOpen) { tradePrice = nextO; tradeDate = dates[i+1]; } else if (tradeTiming === 'open' && i === n - 1) { tradePrice = curC; tradeDate = dates[i]; } if (check(tradePrice) && tradePrice > 0 && shortShares > 0) { const shortProceeds = shortShares * lastShortP * (1 - sellFee / 100); const coverCostWithFee = shortShares * tradePrice * (1 + buyFee / 100); const prof = shortProceeds - coverCostWithFee; shortCap += prof; const tradeData = { type:'cover', date:tradeDate, price:tradePrice, shares:shortShares, revenue:coverCostWithFee, profit:prof, profitPercent:(shortProceeds > 0 ? (prof / shortProceeds) * 100 : 0), capital_after:shortCap, triggeredByStopLoss:shortSlTrig, triggeredByTakeProfit:shortTpTrig, triggeringStrategy: shortExitStrategy, simType: 'short' }; if (coverKDValues) tradeData.kdValues = coverKDValues; if (coverMACDValues) tradeData.macdValues = coverMACDValues; if (coverIndicatorValues) tradeData.indicatorValues = coverIndicatorValues; shortTrades.push(tradeData); coverSigs.push({date:dates[i], index:i}); const lastShortIdx = shortTrades.map(t => t.type).lastIndexOf('short'); if(lastShortIdx !== -1 && shortTrades[lastShortIdx].shares === shortShares){ shortCompletedTrades.push({ entry: shortTrades[lastShortIdx], exit: tradeData, profit: prof, profitPercent: tradeData.profitPercent }); } else { console.warn(`[Worker SHORT] Cover @ ${tradeDate} could not find matching short trade.`); } console.log(`[Worker SHORT] Cover Executed: ${shortShares}@${tradePrice} on ${tradeDate}, Profit: ${prof.toFixed(0)}, Cap After: ${shortCap.toFixed(0)}`); shortPos = 0; shortShares = 0; lastShortP = 0; currentLowSinceShort = Infinity; } else { console.warn(`[Worker SHORT] Invalid trade price (${tradePrice}) or zero shares for Cover Signal on ${dates[i]}`); } } } catch(coverError){ console.error(`[Worker SHORT EXIT] Error at index ${i} (${dates[i]}):`, coverError); } } if (longPos === 0 && shortPos === 0) { let buySignal=false; let entryKDValues=null, entryMACDValues=null, entryIndicatorValues=null; switch (entryStrategy) { case 'ma_cross': case 'ema_cross': buySignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]>indicators.maLong[i]&&indicators.maShort[i-1]<=indicators.maLong[i-1]; if(buySignal) entryIndicatorValues={'短SMA':[indicators.maShort[i-1], indicators.maShort[i], indicators.maShort[i+1]??null], '長SMA':[indicators.maLong[i-1], indicators.maLong[i], indicators.maLong[i+1]??null]}; break; case 'ma_above': buySignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC>indicators.maExit[i]&&prevC<=indicators.maExit[i-1]; if(buySignal) entryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'SMA':[indicators.maExit[i-1], indicators.maExit[i], indicators.maExit[i+1]??null]}; break; case 'rsi_oversold': const rE=indicators.rsiEntry[i],rPE=indicators.rsiEntry[i-1],rThE=entryParams.threshold||30; buySignal=check(rE)&&check(rPE)&&rE>rThE&&rPE<=rThE; if(buySignal) entryIndicatorValues={'RSI':[rPE, rE, indicators.rsiEntry[i+1]??null]}; break; case 'macd_cross': const difE=indicators.macdEntry[i],deaE=indicators.macdSignalEntry[i],difPE=indicators.macdEntry[i-1],deaPE=indicators.macdSignalEntry[i-1]; buySignal=check(difE)&&check(deaE)&&check(difPE)&&check(deaPE)&&difE>deaE&&difPE<=deaPE; if(buySignal) entryMACDValues={difPrev:difPE,deaPrev:deaPE,difNow:difE,deaNow:deaE,difNext:indicators.macdEntry[i+1]??null,deaNext:indicators.macdSignalEntry[i+1]??null}; break; case 'bollinger_breakout': buySignal=check(indicators.bollingerUpperEntry[i])&&check(prevC)&&check(indicators.bollingerUpperEntry[i-1])&&curC>indicators.bollingerUpperEntry[i]&&prevC<=indicators.bollingerUpperEntry[i-1]; if(buySignal) entryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '上軌':[indicators.bollingerUpperEntry[i-1], indicators.bollingerUpperEntry[i], indicators.bollingerUpperEntry[i+1]??null]}; break; case 'k_d_cross': const kE=indicators.kEntry[i],dE=indicators.dEntry[i],kPE=indicators.kEntry[i-1],dPE=indicators.dEntry[i-1],thX=entryParams.thresholdX||30; buySignal=check(kE)&&check(dE)&&check(kPE)&&check(dPE)&&kE>dE&&kPE<=dPE&&dE<thX; if(buySignal) entryKDValues={kPrev:kPE,dPrev:dPE,kNow:kE,dNow:dE,kNext:indicators.kEntry[i+1]??null,dNext:indicators.dEntry[i+1]??null}; break; case 'volume_spike': const vAE=indicators.volumeAvgEntry[i],vME=entryParams.multiplier||2; buySignal=check(vAE)&&check(curV)&&curV>vAE*vME; if(buySignal) entryIndicatorValues={'成交量':[volumes[i-1]??null, curV, volumes[i+1]??null], '均量':[indicators.volumeAvgEntry[i-1]??null, vAE, indicators.volumeAvgEntry[i+1]??null]}; break; case 'price_breakout': const bpE=entryParams.period||20; if(i>=bpE){const hsE=highs.slice(i-bpE,i).filter(h=>check(h)); if(hsE.length>0){const periodHigh = Math.max(...hsE); buySignal=check(curC) && curC>periodHigh; if(buySignal) entryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '前高':[null, periodHigh, null]};}} break; case 'williams_oversold': const wrE=indicators.williamsEntry[i],wrPE=indicators.williamsEntry[i-1],wrThE=entryParams.threshold||-80; buySignal=check(wrE)&&check(wrPE)&&wrE>wrThE&&wrPE<=wrThE; if(buySignal) entryIndicatorValues={'%R':[wrPE, wrE, indicators.williamsEntry[i+1]??null]}; break; case 'turtle_breakout': const tpE=entryParams.breakoutPeriod||20; if(i>=tpE){const hsT=highs.slice(i-tpE,i).filter(h=>check(h)); if(hsT.length>0){ const periodHighT = Math.max(...hsT); buySignal=check(curC) && curC>periodHighT;} if(buySignal) entryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'N日高':[null, Math.max(...highs.slice(i-tpE,i).filter(check)), null]}; } break; } if(buySignal){ tradePrice = null; tradeDate = dates[i]; if (tradeTiming === 'close') tradePrice = curC; else if (canTradeOpen) { tradePrice = nextO; tradeDate = dates[i+1]; } if(check(tradePrice) && tradePrice > 0 && longCap > 0) { let baseCapitalForSizing = initialCapital; if (positionBasis === 'totalCapital') { baseCapitalForSizing = portfolioVal[i-1] ?? initialCapital; } const maxInvestmentAllowed = baseCapitalForSizing * (positionSize / 100); const actualInvestmentLimit = Math.min(longCap, maxInvestmentAllowed); const adjustedTradePrice = tradePrice * (1 + buyFee / 100); if (adjustedTradePrice <= 0) { longShares = 0; } else { longShares = Math.floor(actualInvestmentLimit / adjustedTradePrice); } if(longShares > 0){ const cost = longShares * adjustedTradePrice; if(longCap >= cost){ longCap -= cost; longPos = 1; lastBuyP = tradePrice; curPeakP = tradePrice; const tradeData = { type:'buy', date:tradeDate, price:tradePrice, shares:longShares, cost:cost, capital_after:longCap, triggeringStrategy: entryStrategy, simType: 'long' }; if (entryKDValues) tradeData.kdValues = entryKDValues; if (entryMACDValues) tradeData.macdValues = entryMACDValues; if (entryIndicatorValues) tradeData.indicatorValues = entryIndicatorValues; longTrades.push(tradeData); if(tradeDate === dates[i]) buySigs.push({date:dates[i], index:i}); else if (i+1 < n && tradeDate === dates[i+1]) buySigs.push({date:dates[i], index:i}); console.log(`[Worker LONG Buy Adjusted] Shares: ${longShares}@${tradePrice} on ${tradeDate}, Cost(+fee): ${cost.toFixed(0)}, Cap After: ${longCap.toFixed(0)}`); } else { console.warn(`[Worker LONG] Insufficient capital (${longCap.toFixed(0)}) for Buy Cost (${cost.toFixed(0)}) on ${tradeDate} - Check Logic!`); longShares = 0; longPos = 0; } } else { console.log(`[Worker LONG] Calculated 0 shares for Buy on ${tradeDate} (Price: ${tradePrice}, Investment Limit: ${actualInvestmentLimit.toFixed(0)}, Adjusted Price: ${adjustedTradePrice.toFixed(2)})`); longShares = 0; } } else { console.warn(`[Worker LONG] Invalid trade price (${tradePrice}) or zero capital for Buy Signal on ${dates[i]}`); } } } if (enableShorting && shortPos === 0 && longPos === 0) { let shortSignal=false; let shortEntryKDValues=null, shortEntryMACDValues=null, shortEntryIndicatorValues=null; switch (shortEntryStrategy) { case 'short_ma_cross': case 'short_ema_cross': shortSignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]<indicators.maLong[i]&&indicators.maShort[i-1]>=indicators.maLong[i-1]; if(shortSignal) shortEntryIndicatorValues={'短SMA':[indicators.maShort[i-1], indicators.maShort[i], indicators.maShort[i+1]??null], '長SMA':[indicators.maLong[i-1], indicators.maLong[i], indicators.maLong[i+1]??null]}; break; case 'short_ma_below': shortSignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC<indicators.maExit[i]&&prevC>=indicators.maExit[i-1]; if(shortSignal) shortEntryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'SMA':[indicators.maExit[i-1], indicators.maExit[i], indicators.maExit[i+1]??null]}; break; case 'short_rsi_overbought': const rSE=indicators.rsiShortEntry[i],rPSE=indicators.rsiShortEntry[i-1],rThSE=shortEntryParams.threshold||70; shortSignal=check(rSE)&&check(rPSE)&&rSE<rThSE&&rPSE>=rThSE; if(shortSignal) shortEntryIndicatorValues={'RSI':[rPSE, rSE, indicators.rsiShortEntry[i+1]??null]}; break; case 'short_macd_cross': const difSE=indicators.macdShortEntry[i],deaSE=indicators.macdSignalShortEntry[i],difPSE=indicators.macdShortEntry[i-1],deaPSE=indicators.macdSignalShortEntry[i-1]; shortSignal=check(difSE)&&check(deaSE)&&check(difPSE)&&check(deaPSE)&&difSE<deaSE&&difPSE>=deaSE; if(shortSignal) shortEntryMACDValues={difPrev:difPSE,deaPrev:deaPSE,difNow:difSE,deaNow:deaSE,difNext:indicators.macdShortEntry[i+1]??null,deaNext:indicators.macdSignalShortEntry[i+1]??null}; break; case 'short_bollinger_reversal': const midSE = indicators.bollingerMiddleShortEntry[i]; const midPSE = indicators.bollingerMiddleShortEntry[i-1]; shortSignal=check(midSE)&&check(prevC)&&check(midPSE)&&curC<midSE&&prevC>=midPSE; if(shortSignal) shortEntryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '中軌':[midPSE, midSE, indicators.bollingerMiddleShortEntry[i+1]??null]}; break; case 'short_k_d_cross': const kSE=indicators.kShortEntry[i],dSE=indicators.dShortEntry[i],kPSE=indicators.kShortEntry[i-1],dPSE=indicators.dShortEntry[i-1],thY=shortEntryParams.thresholdY||70; shortSignal=check(kSE)&&check(dSE)&&check(kPSE)&&check(dPSE)&&kSE<dSE&&kPSE>=dPSE&&dSE>thY; if(shortSignal) shortEntryKDValues={kPrev:kPSE,dPrev:dPSE,kNow:kSE,dNow:dSE,kNext:indicators.kShortEntry[i+1]??null,dNext:indicators.dShortEntry[i+1]??null}; break; case 'short_price_breakdown': const bpSE=shortEntryParams.period||20; if(i>=bpSE){const lsSE=lows.slice(i-bpSE,i).filter(l=>check(l)); if(lsSE.length>0){const periodLowS = Math.min(...lsSE); shortSignal=check(curC) && curC<periodLowS; } if(shortSignal) shortEntryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], '前低':[null, Math.min(...lows.slice(i-bpSE,i).filter(check)), null]};} break; case 'short_williams_overbought': const wrSE=indicators.williamsShortEntry[i],wrPSE=indicators.williamsShortEntry[i-1],wrThSE=shortEntryParams.threshold||-20; shortSignal=check(wrSE)&&check(wrPSE)&&wrSE<wrThSE&&wrPSE>=wrThSE; if(shortSignal) shortEntryIndicatorValues={'%R':[wrPSE, wrSE, indicators.williamsShortEntry[i+1]??null]}; break; case 'short_turtle_stop_loss': const slPSE=shortEntryParams.stopLossPeriod||10; if(i>=slPSE){const lowsT=lows.slice(i-slPSE,i).filter(l=>check(l)); if(lowsT.length>0){ const periodLowST = Math.min(...lowsT); shortSignal = check(curC) && curC < periodLowST;}} if(shortSignal) shortEntryIndicatorValues={'收盤價':[prevC, curC, closes[i+1]??null], 'N日低':[null, Math.min(...lows.slice(i-slPSE,i).filter(check)), null]}; break; } if(shortSignal){ tradePrice = null; tradeDate = dates[i]; if (tradeTiming === 'close') tradePrice = curC; else if (canTradeOpen) { tradePrice = nextO; tradeDate = dates[i+1]; } if(check(tradePrice) && tradePrice > 0 && shortCap > 0) { let baseCapitalForSizing = initialCapital; if (positionBasis === 'totalCapital') { baseCapitalForSizing = portfolioVal[i-1] ?? initialCapital; } const maxInvestmentAllowed = baseCapitalForSizing * (positionSize / 100); const actualInvestmentLimit = Math.min(shortCap, maxInvestmentAllowed); const adjustedTradePrice = tradePrice * (1 + buyFee / 100); if(adjustedTradePrice <= 0) { shortShares = 0; } else { shortShares = Math.floor(actualInvestmentLimit / adjustedTradePrice); } if(shortShares > 0) { const shortValue = shortShares * tradePrice; const shortProceeds = shortValue * (1 - sellFee / 100); shortPos = 1; lastShortP = tradePrice; currentLowSinceShort = tradePrice; const tradeData = { type:'short', date:tradeDate, price:tradePrice, shares:shortShares, cost:shortValue, capital_after:shortCap, triggeringStrategy: shortEntryStrategy, simType: 'short' }; if (shortEntryKDValues) tradeData.kdValues = shortEntryKDValues; if (shortEntryMACDValues) tradeData.macdValues = shortEntryMACDValues; if (shortEntryIndicatorValues) tradeData.indicatorValues = shortEntryIndicatorValues; shortTrades.push(tradeData); if(tradeDate === dates[i]) shortSigs.push({date:dates[i], index:i}); else if (i+1 < n && tradeDate === dates[i+1]) shortSigs.push({date:dates[i], index:i}); console.log(`[Worker SHORT] Short Executed: ${shortShares}@${tradePrice} on ${tradeDate}, Cap Before Cover: ${shortCap.toFixed(0)}`); } else { console.log(`[Worker SHORT] Calculated 0 shares for Short on ${tradeDate} (Price: ${tradePrice}, Investment: ${investment.toFixed(0)})`); shortShares = 0; } } else { console.warn(`[Worker SHORT] Invalid trade price (${tradePrice}) for Short Signal on ${dates[i]}`); } } }

                 // --- STEP 3: Update Daily P/L AFTER all potential trades ---
                 // 修正收益率計算邏輯：正確計算總資產價值
                 if (longPos === 1) {
                     // 有多頭持股時：現金 + 股票市值
                     longPl[i] = totalCash + longShares * curC - initialCapital;
                 } else {
                     // 沒有多頭持股時：僅基於現金變化
                     longPl[i] = totalCash - initialCapital;
                 }
                 
                 let unrealizedShortPl = 0; 
                 if (shortPos === 1 && lastShortP > 0) { 
                     unrealizedShortPl = (lastShortP - curC) * shortShares; 
                 }
                 if(enableShorting){ 
                     shortPl[i] = unrealizedShortPl; // 空頭部分只計算未實現損益
                 } else { 
                     shortPl[i] = 0; 
                 }
                 portfolioVal[i] = initialCapital + longPl[i] + shortPl[i];
                 strategyReturns[i] = initialCapital > 0 ? ((portfolioVal[i] - initialCapital) / initialCapital) * 100 : 0;
                 peakCap = Math.max(peakCap, portfolioVal[i]); const drawdown = peakCap > 0 ? ((peakCap - portfolioVal[i]) / peakCap) * 100 : 0; maxDD = Math.max(maxDD, drawdown);
                 if (i > startIdx && n > startIdx && i % Math.floor((n-startIdx)/20||1)===0){ const p=70+Math.floor(((i-startIdx)/(n-startIdx))*25); self.postMessage({type:'progress',progress:Math.min(95,p)});}
    } // --- End Loop ---

    // --- Final Cleanup & Calculation ---
     try {
         const lastIdx = n - 1; const finalP = (lastIdx >= 0 && check(closes[lastIdx])) ? closes[lastIdx] : null; if(longPos === 1 && finalP !== null && longShares > 0) { const rev = longShares * finalP * (1 - sellFee / 100); const costB = longShares * lastBuyP * (1 + buyFee / 100); const prof = rev - costB; longCap += rev; const finalTradeData = {type:'sell', date:dates[lastIdx], price:finalP, shares:longShares, revenue:rev, profit:prof, profitPercent:(costB > 0 ? (prof / costB) * 100 : 0), capital_after:longCap, triggeredByStopLoss:false, triggeredByTakeProfit:false, triggeringStrategy: 'EndOfPeriod', simType: 'long'}; longTrades.push(finalTradeData); if(!sellSigs.some(s=>s.index===lastIdx)) sellSigs.push({date:dates[lastIdx], index:lastIdx}); const lastBuyI=longTrades.map(t=>t.type).lastIndexOf('buy'); if(lastBuyI!==-1 && longTrades[lastBuyI].shares === longShares){ longCompletedTrades.push({entry:longTrades[lastBuyI], exit: finalTradeData, profit:prof, profitPercent:finalTradeData.profitPercent}); } longPl[lastIdx] = longCap - initialCapital; longPos = 0; longShares = 0; console.log(`[Worker LONG] Final Sell Executed: ${finalTradeData.shares}@${finalP} on ${dates[lastIdx]}`); } else if (longPos === 1) { longPl[lastIdx] = longPl[lastIdx > 0 ? lastIdx - 1 : 0] ?? 0; } if(shortPos === 1 && finalP !== null && shortShares > 0) { const shortProceeds = shortShares * lastShortP * (1 - sellFee / 100); const coverCostWithFee = shortShares * finalP * (1 + buyFee / 100); const prof = shortProceeds - coverCostWithFee; shortCap += prof; const finalTradeData = {type:'cover', date:dates[lastIdx], price:finalP, shares:shortShares, revenue:coverCostWithFee, profit:prof, profitPercent:(shortProceeds > 0 ? (prof / shortProceeds) * 100 : 0), capital_after:shortCap, triggeredByStopLoss:false, triggeredByTakeProfit:false, triggeringStrategy: 'EndOfPeriod', simType: 'short'}; shortTrades.push(finalTradeData); if(!coverSigs.some(s=>s.index===lastIdx)) coverSigs.push({date:dates[lastIdx], index:lastIdx}); const lastShortI=shortTrades.map(t=>t.type).lastIndexOf('short'); if(lastShortI!==-1 && shortTrades[lastShortI].shares === shortShares){ shortCompletedTrades.push({entry:shortTrades[lastShortI], exit: finalTradeData, profit:prof, profitPercent:finalTradeData.profitPercent}); } shortPl[lastIdx] = shortCap - initialCapital; shortPos = 0; shortShares = 0; console.log(`[Worker SHORT] Final Cover Executed: ${finalTradeData.shares}@${finalP} on ${dates[lastIdx]}`); } else if (shortPos === 1) { shortPl[lastIdx] = shortPl[lastIdx > 0 ? lastIdx - 1 : 0] ?? 0; }
         self.postMessage({ type:'progress', progress:95, message:'計算最終結果...'});
         portfolioVal[lastIdx] = initialCapital + (longPl[lastIdx] ?? 0) + (shortPl[lastIdx] ?? 0);
         strategyReturns[lastIdx] = initialCapital > 0 ? ((portfolioVal[lastIdx] - initialCapital) / initialCapital) * 100 : 0;
         const finalV = portfolioVal[lastIdx]; const totalP = finalV - initialCapital; const returnR = initialCapital > 0 ? (totalP / initialCapital) * 100 : 0;
         allCompletedTrades = [...longCompletedTrades, ...shortCompletedTrades].sort((a, b) => new Date(a.exit.date) - new Date(b.exit.date)); allTrades = [...longTrades, ...shortTrades].sort((a, b) => new Date(a.date) - new Date(b.date));
         totalWinTrades = allCompletedTrades.filter(t => (t.profit || 0) > 0).length; const tradesC = allCompletedTrades.length; const winR = tradesC > 0 ? (totalWinTrades / tradesC * 100) : 0;
         curCL = 0; maxCL = 0; for (const trade of allCompletedTrades) { if ((trade.profit || 0) < 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else { curCL = 0; } }

         let annualR = 0; let buyHoldAnnualizedReturn = 0;
         // 使用使用者設定的日期範圍來計算年化報酬
         const firstDateStr = params.startDate;
         const lastDateStr = params.endDate;
         if(firstDateStr && lastDateStr){
             const firstD = new Date(firstDateStr);
             const lastD = new Date(lastDateStr);
             const years = (lastD.getTime() - firstD.getTime()) / (1000 * 60 * 60 * 24 * 365.25); 
             console.log(`[Worker] Strategy date range: ${firstDateStr} to ${lastDateStr} (startIdx: ${startIdx}, lastIdx: ${lastIdx})`);
             console.log(`[Worker] Annualization Years (Strategy): ${years.toFixed(4)} (from ${firstDateStr} to ${lastDateStr})`);
             if(years > 1/(365.25 * 2)) { 
                 if(initialCapital > 0 && check(finalV) && finalV > 0){
                     try { annualR = (Math.pow(finalV / initialCapital, 1 / years) - 1) * 100; } catch { annualR = 0; }
                 } else if (finalV <= 0 && initialCapital > 0) { 
                     annualR = -100; 
                 }
             } else if(initialCapital > 0){
                 annualR = returnR; 
                 console.warn(`[Worker] Backtest duration (${years.toFixed(4)} years) too short for meaningful annualization. Using total return rate.`);
             }

             // 使用設定的日期範圍找出對應的價格
             const startDate = new Date(params.startDate);
             const endDate = new Date(params.endDate);
             const firstValidPriceIdxBH = closes.findIndex((p, i) => check(p) && p > 0 && new Date(dates[i]) >= startDate);
             const lastValidPriceIdxBH = closes.map((p, i) => check(p) && p > 0 && new Date(dates[i]) <= endDate).lastIndexOf(true);
             if (firstValidPriceIdxBH !== -1 && lastValidPriceIdxBH !== -1 && lastValidPriceIdxBH >= firstValidPriceIdxBH) {
                 const firstValidPriceBH = closes[firstValidPriceIdxBH];
                 const lastValidPriceBH = closes[lastValidPriceIdxBH];
                 const firstValidDateBH = new Date(dates[firstValidPriceIdxBH]);
                 const lastValidDateBH = new Date(dates[lastValidPriceIdxBH]);   
                 const bhYears = (lastValidDateBH.getTime() - firstValidDateBH.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                 console.log(`[Worker] B&H date range: ${dates[firstValidPriceIdxBH]} to ${dates[lastValidPriceIdxBH]} (firstValidPriceIdxBH: ${firstValidPriceIdxBH}, lastValidPriceIdxBH: ${lastValidPriceIdxBH})`);
                 console.log(`[Worker] Annualization Years (B&H): ${bhYears.toFixed(4)} (from ${dates[firstValidPriceIdxBH]} to ${dates[lastValidPriceIdxBH]})`);
                 const bhTotalReturn = firstValidPriceBH !== 0 ? ((lastValidPriceBH - firstValidPriceBH) / firstValidPriceBH) * 100 : 0;
                 if (bhYears > 1/(365.25*2) && firstValidPriceBH > 0) {
                     try { buyHoldAnnualizedReturn = (Math.pow(lastValidPriceBH / firstValidPriceBH, 1 / bhYears) - 1) * 100; } catch { buyHoldAnnualizedReturn = bhTotalReturn; }
                 } else {
                     buyHoldAnnualizedReturn = bhTotalReturn; 
                      console.warn(`[Worker] B&H duration (${bhYears.toFixed(4)} years) too short for meaningful annualization. Using total B&H return rate.`);
                 }
             }
         }
         const validPortfolioSlice = portfolioVal.slice(startIdx).filter(v => check(v));
         const dailyR = calculateDailyReturns(validPortfolioSlice, dates.slice(startIdx));
         const sharpeR = calculateSharpeRatio(dailyR, annualR); 
         const sortinoR = calculateSortinoRatio(dailyR, annualR); 

         let annReturnHalf1 = null, sharpeHalf1 = null, annReturnHalf2 = null, sharpeHalf2 = null;
         const validDataLength = validPortfolioSlice.length;
         if (validDataLength >= 4) {
             const midPoint = Math.floor(validDataLength / 2);
             const firstHalfPortfolio = validPortfolioSlice.slice(0, midPoint);
             const secondHalfPortfolio = validPortfolioSlice.slice(midPoint);
             const firstHalfDates = dates.slice(startIdx, startIdx + midPoint);
             const secondHalfDates = dates.slice(startIdx + midPoint, startIdx + validDataLength);
              if(firstHalfPortfolio.length > 1){
                  const firstHalfDailyReturns = calculateDailyReturns(firstHalfPortfolio, firstHalfDates);
                  const firstHalfStartVal = firstHalfPortfolio[0]; const firstHalfEndVal = firstHalfPortfolio[firstHalfPortfolio.length - 1];
                  const totalReturnHalf1 = firstHalfStartVal !== 0 ? ((firstHalfEndVal / firstHalfStartVal) - 1) * 100 : 0; annReturnHalf1 = totalReturnHalf1;
                  const avgDailyReturn1 = firstHalfDailyReturns.reduce((s,r)=>s+r,0) / firstHalfDailyReturns.length; const variance1 = firstHalfDailyReturns.reduce((s,r)=>s+Math.pow(r-avgDailyReturn1,2),0) / firstHalfDailyReturns.length; const stdDev1 = Math.sqrt(variance1); const annStdDev1 = stdDev1 * Math.sqrt(252); const approxAnnReturn1 = firstHalfDailyReturns.length > 0 ? avgDailyReturn1 * 252 * 100 : 0; const annExcessReturn1 = (approxAnnReturn1 / 100) - 0.01; sharpeHalf1 = annStdDev1 !== 0 ? annExcessReturn1 / annStdDev1 : 0;
              }
               if(secondHalfPortfolio.length > 1){
                   const secondHalfDailyReturns = calculateDailyReturns(secondHalfPortfolio, secondHalfDates);
                   const secondHalfStartVal = secondHalfPortfolio[0]; const secondHalfEndVal = secondHalfPortfolio[secondHalfPortfolio.length - 1];
                   const totalReturnHalf2 = secondHalfStartVal !== 0 ? ((secondHalfEndVal / secondHalfStartVal) - 1) * 100 : 0; annReturnHalf2 = totalReturnHalf2;
                   const avgDailyReturn2 = secondHalfDailyReturns.reduce((s,r)=>s+r,0) / secondHalfDailyReturns.length; const variance2 = secondHalfDailyReturns.reduce((s,r)=>s+Math.pow(r-avgDailyReturn2,2),0) / secondHalfDailyReturns.length; const stdDev2 = Math.sqrt(variance2); const annStdDev2 = stdDev2 * Math.sqrt(252); const approxAnnReturn2 = secondHalfDailyReturns.length > 0 ? avgDailyReturn2 * 252 * 100 : 0; const annExcessReturn2 = (approxAnnReturn2 / 100) - 0.01; sharpeHalf2 = annStdDev2 !== 0 ? annExcessReturn2 / annStdDev2 : 0;
               }
         }
         const subPeriodResults = {}; const overallEndDate = new Date(lastDateStr || params.endDate); const overallStartDate = new Date(firstDateStr || params.startDate); const totalDurationMillis = overallEndDate - overallStartDate; const totalYears = totalDurationMillis / (1000 * 60 * 60 * 24 * 365.25); const totalDaysApprox = Math.max(1, totalDurationMillis / (1000 * 60 * 60 * 24)); const periodsToCalculate = {}; if (totalDaysApprox >= 30) periodsToCalculate['1M'] = 1; if (totalDaysApprox >= 180) periodsToCalculate['6M'] = 6; if (totalYears >= 1) { for (let y = 1; y <= Math.floor(totalYears); y++) { periodsToCalculate[`${y}Y`] = y * 12; } } const floorTotalYears = Math.floor(totalYears); if (floorTotalYears >= 1 && !periodsToCalculate[`${floorTotalYears}Y`]) { periodsToCalculate[`${floorTotalYears}Y`] = floorTotalYears * 12; } const initP_bh_full = closes.find(p0 => check(p0) && p0 > 0) || 1; let bhReturnsFull = Array(n).fill(null); if (check(initP_bh_full)) { bhReturnsFull = closes.map((p, i) => check(p) && p > 0 ? ((p - initP_bh_full) / initP_bh_full * 100) : (i > 0 && bhReturnsFull[i-1] !== null ? bhReturnsFull[i-1] : 0)); } for (const [label, months] of Object.entries(periodsToCalculate)) { const subStartDate = new Date(overallEndDate); subStartDate.setMonth(subStartDate.getMonth() - months); subStartDate.setDate(subStartDate.getDate() + 1); const subStartDateStr = subStartDate.toISOString().split('T')[0]; let subStartIdx = dates.findIndex(d => d >= subStartDateStr); if (subStartIdx === -1 || subStartIdx < startIdx) { subStartIdx = startIdx; } if (subStartIdx <= lastIdx) { const subEndIdx = lastIdx; const subPortfolioVals = portfolioVal.slice(subStartIdx, subEndIdx + 1).filter(v => check(v)); const subBHRawPrices = closes.slice(subStartIdx, subEndIdx + 1).filter(v => check(v)); const subDates = dates.slice(subStartIdx, subEndIdx + 1); if (subPortfolioVals.length > 1 && subDates.length > 1 && subBHRawPrices.length > 1) { const subStartVal = subPortfolioVals[0]; const subEndVal = subPortfolioVals[subPortfolioVals.length - 1]; const subTotalReturn = subStartVal !== 0 ? ((subEndVal - subStartVal) / subStartVal) * 100 : 0; const subStartBHPrice = subBHRawPrices[0]; const subEndBHPrice = subBHRawPrices[subBHRawPrices.length - 1]; const subBHTotalReturn = subStartBHPrice !== 0 ? ((subEndBHPrice - subStartBHPrice) / subStartBHPrice) * 100 : 0; const subDailyReturns = calculateDailyReturns(subPortfolioVals, subDates); const subAnnualizedReturn = 0; const subSharpe = calculateSharpeRatio(subDailyReturns, subAnnualizedReturn); const subSortino = calculateSortinoRatio(subDailyReturns, subAnnualizedReturn); const subMaxDD = calculateMaxDrawdown(subPortfolioVals); subPeriodResults[label] = { totalReturn: subTotalReturn, totalBuyHoldReturn: subBHTotalReturn, sharpeRatio: subSharpe, sortinoRatio: subSortino, maxDrawdown: subMaxDD }; } else { subPeriodResults[label] = null; } } else { subPeriodResults[label] = null; } }

         self.postMessage({type:'progress', progress:100, message:'完成'});
         return { stockNo:params.stockNo, initialCapital:initialCapital, finalValue:finalV, totalProfit:totalP, returnRate:returnR, annualizedReturn:annualR, maxDrawdown:maxDD, winRate:winR, winTrades: totalWinTrades, tradesCount:tradesC, sharpeRatio:sharpeR, sortinoRatio:sortinoR, maxConsecutiveLosses:maxCL, trades: allTrades, completedTrades: allCompletedTrades, buyHoldReturns: bhReturnsFull, strategyReturns: strategyReturns, dates:dates, chartBuySignals:buySigs, chartSellSignals:sellSigs, chartShortSignals:shortSigs, chartCoverSignals:coverSigs, entryStrategy:params.entryStrategy, exitStrategy:params.exitStrategy, entryParams:params.entryParams, exitParams:params.exitParams, enableShorting:params.enableShorting, shortEntryStrategy:params.shortEntryStrategy, shortExitStrategy:params.shortExitStrategy, shortEntryParams:params.shortEntryParams, shortExitParams:params.shortExitParams, stopLoss:params.stopLoss, takeProfit:params.takeProfit, tradeTiming: params.tradeTiming, buyFee: params.buyFee, sellFee: params.sellFee, positionBasis: params.positionBasis, rawData: data, buyHoldAnnualizedReturn: buyHoldAnnualizedReturn, annReturnHalf1: annReturnHalf1, sharpeHalf1: sharpeHalf1, annReturnHalf2: annReturnHalf2, sharpeHalf2: sharpeHalf2, subPeriodResults: subPeriodResults };
     } catch (finalError) { console.error("Final calculation error:", finalError); throw new Error(`計算最終結果錯誤: ${finalError.message}`); }
}

// --- 參數優化邏輯 ---
async function runOptimization(baseParams, optimizeTargetStrategy, optParamName, optRange, useCache, cachedData) {
    const targetLblMap = {'entry': '進場', 'exit': '出場', 'shortEntry': '做空進場', 'shortExit': '回補出場', 'risk': '風險控制'};
    const targetLbl = targetLblMap[optimizeTargetStrategy] || optimizeTargetStrategy;
    self.postMessage({ type: 'progress', progress: 0, message: `開始優化 ${targetLbl}策略 ${optParamName}...` });
    const results = [];
    let stockData = null;
    let dataFetched = false;

    // Data acquisition policy:
    // - If useCache === true: only use provided cachedData or workerCachedStockData; NEVER fetch from TWSE.
    // - If useCache === false: use cached data when available, otherwise fetch from TWSE.
    if (useCache) {
        if (Array.isArray(cachedData) && cachedData.length > 0) {
            stockData = cachedData;
        } else if (Array.isArray(workerCachedStockData) && workerCachedStockData.length > 0) {
            stockData = workerCachedStockData;
            console.log("[Worker Opt] Using worker's cached data.");
        } else {
            throw new Error('優化失敗: 未提供快取數據；批量優化在快取模式下禁止從遠端抓取資料，請先於主畫面執行回測以建立快取。');
        }
    } else {
        if (Array.isArray(cachedData) && cachedData.length > 0) {
            stockData = cachedData;
        } else if (Array.isArray(workerCachedStockData) && workerCachedStockData.length > 0) {
            stockData = workerCachedStockData;
            console.log("[Worker Opt] Using worker's cached data.");
        } else {
            stockData = await fetchStockData(baseParams.stockNo, baseParams.startDate, baseParams.endDate);
            workerCachedStockData = stockData;
            dataFetched = true;
            if (!stockData || stockData.length === 0) throw new Error(`優化失敗: 無法獲取 ${baseParams.stockNo} 數據`);
            self.postMessage({ type: 'progress', progress: 50, message: '數據獲取完成，開始優化...' });
        }
    }

    if (!stockData) { throw new Error('優化失敗：無可用數據'); }

    const range = optRange || { from: 1, to: 20, step: 1 };
    const totalSteps = Math.max(1, Math.floor((range.to - range.from) / range.step) + 1);
    let curStep = 0;
    for (let val = range.from; val <= range.to; val += range.step) {
        const curVal = parseFloat(val.toFixed(4));
        if (curVal > range.to && Math.abs(curVal - range.to) > 1e-9) break;
        curStep++;
        const prog = 50 + Math.floor((curStep / totalSteps) * 50);
        self.postMessage({ type: 'progress', progress: Math.min(100, prog), message: `測試 ${optParamName}=${curVal}` });
        const testParams = JSON.parse(JSON.stringify(baseParams));
        if (optimizeTargetStrategy === 'risk') {
            if (optParamName === 'stopLoss' || optParamName === 'takeProfit') {
                testParams[optParamName] = curVal;
            } else {
                console.warn(`[Worker Opt] Unknown risk parameter name: ${optParamName}, skipping value ${curVal}`);
                continue;
            }
        } else {
            let targetObjKey = null;
            if (optimizeTargetStrategy === 'entry') targetObjKey = 'entryParams';
            else if (optimizeTargetStrategy === 'exit') targetObjKey = 'exitParams';
            else if (optimizeTargetStrategy === 'shortEntry') targetObjKey = 'shortEntryParams';
            else if (optimizeTargetStrategy === 'shortExit') targetObjKey = 'shortExitParams';
            else { console.warn(`[Worker Opt] Unknown strategy optimization type: ${optimizeTargetStrategy}`); continue; }
            if (!testParams[targetObjKey]) testParams[targetObjKey] = {};
            if (testParams[targetObjKey].hasOwnProperty(optParamName) || typeof testParams[targetObjKey][optParamName] === 'undefined') {
                testParams[targetObjKey][optParamName] = curVal;
            } else {
                console.warn(`[Worker Opt] Could not find param ${optParamName} in ${targetObjKey}, skipping value ${curVal}`);
                continue;
            }
            if (optimizeTargetStrategy === 'shortEntry' || optimizeTargetStrategy === 'shortExit') {
                testParams.enableShorting = true;
            } else {
                testParams.enableShorting = false;
            }
        }
        try {
            const result = runStrategy(testParams, stockData);
            if (result) {
                results.push({ paramValue: curVal, annualizedReturn: result.annualizedReturn, returnRate: result.returnRate, maxDrawdown: result.maxDrawdown, winRate: result.winRate, tradesCount: result.tradesCount, sharpeRatio: result.sharpeRatio, sortinoRatio: result.sortinoRatio });
            }
        } catch (err) {
            console.error(`[Worker Opt] Error optimizing ${optParamName}=${curVal} for ${optimizeTargetStrategy}:`, err);
        }
    }
    results.sort((a, b) => {
        const rA = (a?.annualizedReturn !== null && isFinite(a.annualizedReturn)) ? a.annualizedReturn : -Infinity;
        const rB = (b?.annualizedReturn !== null && isFinite(b.annualizedReturn)) ? b.annualizedReturn : -Infinity;
        if (rB !== rA) return rB - rA;
        const dda = a?.maxDrawdown ?? Infinity;
        const ddb = b?.maxDrawdown ?? Infinity;
        if (dda !== ddb) return dda - ddb;
        const sA = isFinite(a?.sortinoRatio) ? a.sortinoRatio : -Infinity;
        const sB = isFinite(b?.sortinoRatio) ? b.sortinoRatio : -Infinity;
        return sB - sA;
    });
    self.postMessage({ type: 'progress', progress: 100, message: '優化完成' });
    return { results: results, rawDataUsed: dataFetched ? stockData : null };
}

// --- 執行策略建議模擬 (修正建議邏輯) ---
function getTodayISODateFallback() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function diffIsoDaysFallback(a, b) {
    if (!a || !b) return null;
    const start = new Date(a);
    const end = new Date(b);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function buildSuggestionPayloadFallback({
    status = 'ok',
    action = 'stay_flat',
    label = '維持空手',
    tone = 'neutral',
    latestDate = null,
    priceValue = null,
    notes = [],
    todayISO = getTodayISODateFallback(),
    params = {},
    evaluation = {},
    dataLagDays = null,
    details = [],
    actionTag = null,
}) {
    const price = Number.isFinite(priceValue)
        ? { value: priceValue, type: 'close' }
        : { text: priceValue === null ? '無法取得收盤價' : String(priceValue) };
    return {
        status,
        action,
        label,
        tone,
        actionTag: actionTag || { text: label, tone, action },
        latestDate,
        price,
        longPosition: { state: '空手', shares: null, averagePrice: null, marketValue: null },
        shortPosition: { state: '空手', shares: null, averagePrice: null, marketValue: null },
        positionSummary: '空手',
        evaluation: {
            date: latestDate,
            close: Number.isFinite(priceValue) ? priceValue : null,
            ...evaluation,
        },
        notes: Array.isArray(notes) ? notes.filter(Boolean) : [],
        details: Array.isArray(details) ? details.filter(Boolean) : [],
        dataLagDays,
        todayISO,
        requestedEndDate: params?.endDate || null,
        appliedEndDate: todayISO,
        startDateUsed: params?.startDate || null,
        dataStartDateUsed: params?.startDate || null,
    };
}

function buildSuggestionDetailsFallback({
    action,
    label,
    evaluation,
    priceValue,
    latestDate,
    requestedEndDate,
    dataLagDays,
}) {
    const details = [];
    if (label) {
        details.push({ type: 'action', action, label });
    }
    if (evaluation?.executedBuy) {
        details.push({
            type: 'execution',
            side: 'long',
            event: 'enter',
            price: Number.isFinite(priceValue) ? priceValue : null,
            priceType: Number.isFinite(priceValue) ? 'close' : null,
        });
    }
    if (evaluation?.executedSell) {
        details.push({
            type: 'execution',
            side: 'long',
            event: 'exit',
            price: Number.isFinite(priceValue) ? priceValue : null,
            priceType: Number.isFinite(priceValue) ? 'close' : null,
        });
    }
    if (evaluation?.executedShort) {
        details.push({
            type: 'execution',
            side: 'short',
            event: 'enter',
            price: Number.isFinite(priceValue) ? priceValue : null,
            priceType: Number.isFinite(priceValue) ? 'close' : null,
        });
    }
    if (evaluation?.executedCover) {
        details.push({
            type: 'execution',
            side: 'short',
            event: 'cover',
            price: Number.isFinite(priceValue) ? priceValue : null,
            priceType: Number.isFinite(priceValue) ? 'close' : null,
        });
    }
    if (typeof dataLagDays === 'number' && dataLagDays > 0 && latestDate) {
        details.push({ type: 'dataLag', latestDate, days: dataLagDays });
    }
    if (requestedEndDate && latestDate) {
        if (requestedEndDate < latestDate) {
            details.push({ type: 'rangeExtension', requestedEndDate, appliedEndDate: latestDate });
        } else if (requestedEndDate > latestDate) {
            details.push({ type: 'rangeShorter', requestedEndDate, appliedEndDate: latestDate });
        }
    }
    return details;
}

function runSuggestionSimulation(params, recentData) {
    console.log("[Worker Suggestion] Starting simulation for suggestion...");
    const todayISO = getTodayISODateFallback();
    const n = recentData.length;
    if (!recentData || n === 0) {
        console.error("[Worker Suggestion] No recent data provided.");
        return buildSuggestionPayloadFallback({
            status: 'no_data',
            label: '無法判斷今日操作',
            notes: ['回測資料不足以推導今日建議。'],
            todayISO,
            params,
            details: [],
            actionTag: { text: '資料不足', tone: 'warning', action: 'no_data' },
        });
    }
    const { entryStrategy, exitStrategy, entryParams, exitParams, enableShorting, shortEntryStrategy, shortExitStrategy, shortEntryParams, shortExitParams, stopLoss: globalSL, takeProfit: globalTP } = params; // tradeTiming not needed for signal check
    const dates = recentData.map(d=>d.date); const opens = recentData.map(d=>d.open); const highs = recentData.map(d=>d.high); const lows = recentData.map(d=>d.low); const closes = recentData.map(d=>d.close); const volumes = recentData.map(d=>d.volume);
    let indicators;
    try {
        indicators = calculateAllIndicators(recentData, params);
    } catch(e) {
        console.error("[Worker Suggestion] Error calculating indicators:", e);
        return buildSuggestionPayloadFallback({
            status: 'error',
            label: '計算失敗',
            notes: [`指標計算錯誤: ${e.message}`],
            todayISO,
            params,
            details: [],
            actionTag: { text: '計算失敗', tone: 'error', action: 'error' },
        });
    }
    const check=(v)=>v!==null&&!isNaN(v)&&isFinite(v);

     let minLookbackSuggestion = 1; 
     const checkParamLookback = (pObj) => { Object.values(pObj || {}).forEach(v => { if (typeof v === 'number' && !isNaN(v) && v > minLookbackSuggestion) minLookbackSuggestion = v; }); };
     checkParamLookback(entryParams); checkParamLookback(exitParams);
     if(enableShorting) { checkParamLookback(shortEntryParams); checkParamLookback(shortExitParams); }
     if (entryStrategy.includes('macd') || exitStrategy.includes('macd') || (enableShorting && (shortEntryStrategy.includes('macd') || shortExitStrategy.includes('macd')))) minLookbackSuggestion = Math.max(minLookbackSuggestion, (entryParams?.longPeriod || 26) + (entryParams?.signalPeriod || 9)); 
     if (entryStrategy.includes('k_d') || exitStrategy.includes('k_d') || (enableShorting && (shortEntryStrategy.includes('k_d') || shortExitStrategy.includes('k_d')))) minLookbackSuggestion = Math.max(minLookbackSuggestion, (entryParams?.period || 9));
     if (entryStrategy.includes('turtle') || exitStrategy.includes('turtle') || (enableShorting && (shortEntryStrategy.includes('turtle') || shortExitStrategy.includes('turtle')))) minLookbackSuggestion = Math.max(minLookbackSuggestion, (entryParams?.breakoutPeriod || 20), (exitParams?.stopLossPeriod || 10));

    if(n <= minLookbackSuggestion){
        console.warn(`[Worker Suggestion] Data length ${n} <= minLookback ${minLookbackSuggestion}`);
        return buildSuggestionPayloadFallback({
            status: 'no_data',
            label: '資料不足',
            notes: [`資料筆數僅 ${n}，不足以推導今日建議。`],
            todayISO,
            params,
            details: [],
            actionTag: { text: '資料不足', tone: 'warning', action: 'no_data' },
        });
    }

    let longPos = 0; 
    let shortPos = 0;
    let lastBuyP = 0;
    let lastShortP = 0;
    let curPeakP = 0;
    let currentLowSinceShort = Infinity;

    const i = n - 1; 
    const curC=closes[i]; const curH=highs[i]; const curL=lows[i]; const prevC = i > 0 ? closes[i-1] : null;

    let buySignal=false, sellSignal=false, shortSignal=false, coverSignal=false;
    let slTrig = false, tpTrig = false, shortSlTrig = false, shortTpTrig = false;

     switch (entryStrategy) { case 'ma_cross': case 'ema_cross': buySignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]>indicators.maLong[i]&&indicators.maShort[i-1]<=indicators.maLong[i-1]; break; case 'ma_above': buySignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC>indicators.maExit[i]&&prevC<=indicators.maExit[i-1]; break; case 'rsi_oversold': const rE=indicators.rsiEntry[i],rPE=indicators.rsiEntry[i-1],rThE=entryParams.threshold||30; buySignal=check(rE)&&check(rPE)&&rE>rThE&&rPE<=rThE; break; case 'macd_cross': const difE=indicators.macdEntry[i],deaE=indicators.macdSignalEntry[i],difPE=indicators.macdEntry[i-1],deaPE=indicators.macdSignalEntry[i-1]; buySignal=check(difE)&&check(deaE)&&check(difPE)&&check(deaPE)&&difE>deaE&&difPE<=deaPE; break; case 'bollinger_breakout': buySignal=check(indicators.bollingerUpperEntry[i])&&check(prevC)&&check(indicators.bollingerUpperEntry[i-1])&&curC>indicators.bollingerUpperEntry[i]&&prevC<=indicators.bollingerUpperEntry[i-1]; break; case 'k_d_cross': const kE=indicators.kEntry[i],dE=indicators.dEntry[i],kPE=indicators.kEntry[i-1],dPE=indicators.dEntry[i-1],thX=entryParams.thresholdX||30; buySignal=check(kE)&&check(dE)&&check(kPE)&&check(dPE)&&kE>dE&&kPE<=dPE&&dE<thX; break; case 'volume_spike': const vAE=indicators.volumeAvgEntry[i],vME=entryParams.multiplier||2; buySignal=check(vAE)&&check(volumes[i])&&volumes[i]>vAE*vME; break; case 'price_breakout': const bpE=entryParams.period||20; if(i>=bpE){const hsE=highs.slice(i-bpE,i).filter(h=>check(h)); if(hsE.length>0){const periodHigh = Math.max(...hsE); buySignal=check(curC) && curC>periodHigh; }} break; case 'williams_oversold': const wrE=indicators.williamsEntry[i],wrPE=indicators.williamsEntry[i-1],wrThE=entryParams.threshold||-80; buySignal=check(wrE)&&check(wrPE)&&wrE>wrThE&&wrPE<=wrThE; break; case 'turtle_breakout': const tpE=entryParams.breakoutPeriod||20; if(i>=tpE){const hsT=highs.slice(i-tpE,i).filter(h=>check(h)); if(hsT.length>0){ const periodHighT = Math.max(...hsT); buySignal=check(curC) && curC>periodHighT;}} break; }
     if (enableShorting) {
         switch (shortEntryStrategy) { case 'short_ma_cross': case 'short_ema_cross': shortSignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]<indicators.maLong[i]&&indicators.maShort[i-1]>=indicators.maLong[i-1]; break; case 'short_ma_below': shortSignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC<indicators.maExit[i]&&prevC>=indicators.maExit[i-1]; break; case 'short_rsi_overbought': const rSE=indicators.rsiShortEntry[i],rPSE=indicators.rsiShortEntry[i-1],rThSE=shortEntryParams.threshold||70; shortSignal=check(rSE)&&check(rPSE)&&rSE<rThSE&&rPSE>=rThSE; break; case 'short_macd_cross': const difSE=indicators.macdShortEntry[i],deaSE=indicators.macdSignalShortEntry[i],difPSE=indicators.macdShortEntry[i-1],deaPSE=indicators.macdSignalShortEntry[i-1]; shortSignal=check(difSE)&&check(deaSE)&&check(difPSE)&&check(deaPSE)&&difSE<deaSE&&difPSE>=deaSE; break; case 'short_bollinger_reversal': const midSE = indicators.bollingerMiddleShortEntry[i]; const midPSE = indicators.bollingerMiddleShortEntry[i-1]; shortSignal=check(midSE)&&check(prevC)&&check(midPSE)&&curC<midSE&&prevC>=midPSE; break; case 'short_k_d_cross': const kSE=indicators.kShortEntry[i],dSE=indicators.dShortEntry[i],kPSE=indicators.kShortEntry[i-1],dPSE=indicators.dShortEntry[i-1],thY=shortEntryParams.thresholdY||70; shortSignal=check(kSE)&&check(dSE)&&check(kPSE)&&check(dPSE)&&kSE<dSE&&kPSE>=dPSE&&dSE>thY; break; case 'short_price_breakdown': const bpSE=shortEntryParams.period||20; if(i>=bpSE){const lsSE=lows.slice(i-bpSE,i).filter(l=>check(l)); if(lsSE.length>0){const periodLowS = Math.min(...lsSE); shortSignal=check(curC) && curC<periodLowS; }} break; case 'short_williams_overbought': const wrSE=indicators.williamsShortEntry[i],wrPSE=indicators.williamsShortEntry[i-1],wrThSE=shortEntryParams.threshold||-20; shortSignal=check(wrSE)&&check(wrPSE)&&wrSE<wrThSE&&wrPSE>=wrThSE; break; case 'short_turtle_stop_loss': const slPSE=shortEntryParams.stopLossPeriod||10; if(i>=slPSE){const lowsT=lows.slice(i-slPSE,i).filter(l=>check(l)); if(lowsT.length>0){ const periodLowST = Math.min(...lowsT); shortSignal = check(curC) && curC < periodLowST;}} break; }
     }

     switch (exitStrategy) { case 'ma_cross': case 'ema_cross': sellSignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]<indicators.maLong[i]&&indicators.maShort[i-1]>=indicators.maLong[i-1]; break; case 'ma_below': sellSignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC<indicators.maExit[i]&&prevC>=indicators.maExit[i-1]; break; case 'rsi_overbought': const rX=indicators.rsiExit[i],rPX=indicators.rsiExit[i-1],rThX=exitParams.threshold||70; sellSignal=check(rX)&&check(rPX)&&rX<rThX&&rPX>=rThX; break; case 'macd_cross': const difX=indicators.macdExit[i],deaX=indicators.macdSignalExit[i],difPX=indicators.macdExit[i-1],deaPX=indicators.macdSignalExit[i-1]; sellSignal=check(difX)&&check(deaX)&&check(difPX)&&check(deaPX)&&difX<deaX&&difPX>=deaPX; break; case 'bollinger_reversal': const midX = indicators.bollingerMiddleExit[i]; const midPX = indicators.bollingerMiddleExit[i-1]; sellSignal=check(midX)&&check(prevC)&&check(midPX)&&curC<midX&&prevC>=midPX; break; case 'k_d_cross': const kX=indicators.kExit[i],dX=indicators.dExit[i],kPX=indicators.kExit[i-1],dPX=indicators.dExit[i-1],thY=exitParams.thresholdY||70; sellSignal=check(kX)&&check(dX)&&check(kPX)&&check(dPX)&&kX<dX&&kPX>=dPX&&dX>thY; break; case 'trailing_stop': sellSignal = false; break; case 'price_breakdown': const bpX=exitParams.period||20; if(i>=bpX){const lsX=lows.slice(i-bpX,i).filter(l=>check(l)); if(lsX.length>0){const periodLow = Math.min(...lsX); sellSignal=check(curC) && curC<periodLow;}} break; case 'williams_overbought': const wrX=indicators.williamsExit[i],wrPX=indicators.williamsExit[i-1],wrThX=exitParams.threshold||-20; sellSignal=check(wrX)&&check(wrPX)&&wrX<wrThX&&wrPX>=wrThX; break; case 'turtle_stop_loss': const slP=exitParams.stopLossPeriod||10; if(i>=slP){const lowsT=lows.slice(i-slP,i).filter(l=>check(l)); if(lowsT.length>0){ const periodLowT = Math.min(...lowsT); sellSignal = check(curC) && curC < periodLowT;}} break; case 'fixed_stop_loss': sellSignal=false; break; }
     if (enableShorting) {
         switch (shortExitStrategy) { case 'cover_ma_cross': case 'cover_ema_cross': coverSignal=check(indicators.maShort[i])&&check(indicators.maLong[i])&&check(indicators.maShort[i-1])&&check(indicators.maLong[i-1])&&indicators.maShort[i]>indicators.maLong[i]&&indicators.maShort[i-1]<=indicators.maLong[i-1]; break; case 'cover_ma_above': coverSignal=check(indicators.maExit[i])&&check(prevC)&&check(indicators.maExit[i-1])&&curC>indicators.maExit[i]&&prevC<=indicators.maExit[i-1]; break; case 'cover_rsi_oversold': const rC=indicators.rsiCover[i],rPC=indicators.rsiCover[i-1],rThC=shortExitParams.threshold||30; coverSignal=check(rC)&&check(rPC)&&rC>rThC&&rPC<=rThC; break; case 'cover_macd_cross': const difC=indicators.macdCover[i],deaC=indicators.macdSignalCover[i],difPC=indicators.macdCover[i-1],deaPC=indicators.macdSignalCover[i-1]; coverSignal=check(difC)&&check(deaC)&&check(difPC)&&check(deaPC)&&difC>deaC&&difPC<=deaPC; break; case 'cover_bollinger_breakout': const upperC = indicators.bollingerUpperCover[i]; const upperPC = indicators.bollingerUpperCover[i-1]; coverSignal=check(upperC)&&check(prevC)&&check(upperPC)&&curC>upperC&&prevC<=upperPC; break; case 'cover_k_d_cross': const kC=indicators.kCover[i],dC=indicators.dCover[i],kPC=indicators.kCover[i-1],dPC=indicators.dCover[i-1],thXC=shortExitParams.thresholdX||30; coverSignal=check(kC)&&check(dC)&&check(kPC)&&check(dPC)&&kC>dC&&kPC<=dPC&&dC<thXC; break; case 'cover_price_breakout': const bpC=shortExitParams.period||20; if(i>=bpC){const hsC=highs.slice(i-bpC,i).filter(h=>check(h)); if(hsC.length>0){const periodHighC = Math.max(...hsC); coverSignal=check(curC) && curC>periodHighC; }} break; case 'cover_williams_oversold': const wrC=indicators.williamsCover[i],wrPC=indicators.williamsCover[i-1],wrThC=shortExitParams.threshold||-80; coverSignal=check(wrC)&&check(wrPC)&&wrC>wrThC&&wrPC<=wrThC; break; case 'cover_turtle_breakout': const tpC=shortExitParams.breakoutPeriod||20; if(i>=tpC){const hsCT=highs.slice(i-tpC,i).filter(h=>check(h)); if(hsCT.length>0){const periodHighCT = Math.max(...hsCT); coverSignal=check(curC) && curC>periodHighCT;}} break; case 'cover_trailing_stop': coverSignal = false; break; case 'cover_fixed_stop_loss': coverSignal=false; break; }
     }

    const latestDate = recentData[n - 1]?.date || params?.endDate || todayISO;
    const priceValue = Number.isFinite(curC) ? curC : null;
    const evaluation = {
        executedBuy: buySignal,
        executedSell: sellSignal,
        executedShort: shortSignal,
        executedCover: coverSignal,
        longPos: 0,
        shortPos: 0,
    };
    let action = 'stay_flat';
    let label = '維持空手';
    let tone = 'neutral';
    const notes = [];
    if (buySignal) {
        action = 'enter_long';
        label = '做多買入';
        tone = 'bullish';
        notes.push('今日訊號觸發多單進場，請依策略執行下單流程。');
    } else if (shortSignal) {
        action = 'enter_short';
        label = '做空賣出';
        tone = 'bearish';
        notes.push('今日訊號觸發空單建立，請注意券源與風險控管。');
    } else if (sellSignal) {
        action = 'exit_long';
        label = '做多賣出';
        tone = 'exit';
        notes.push('策略建議平倉多單，留意成交價差與手續費。');
    } else if (coverSignal) {
        action = 'cover_short';
        label = '做空回補';
        tone = 'exit';
        notes.push('策略建議回補空單，請同步檢查借券成本。');
    } else {
        notes.push('策略目前維持空手，暫無倉位需要調整。');
    }
    const dataLagDays = diffIsoDaysFallback(latestDate, todayISO);
    if (typeof dataLagDays === 'number' && dataLagDays > 0) {
        notes.push(`最新資料為 ${latestDate}，距今日 ${dataLagDays} 日。`);
    }
    const details = buildSuggestionDetailsFallback({
        action,
        label,
        evaluation,
        priceValue,
        latestDate,
        requestedEndDate: params?.endDate || null,
        dataLagDays,
    });
    console.log(`[Worker Suggestion] Last Point Analysis: buy=${buySignal}, sell=${sellSignal}, short=${shortSignal}, cover=${coverSignal}. Action: ${action}`);
    return buildSuggestionPayloadFallback({
        status: 'ok',
        action,
        label,
        tone,
        latestDate,
        priceValue,
        notes,
        todayISO,
        params,
        details,
        actionTag: { text: label, tone, action },
        evaluation,
        dataLagDays,
    });
}

// --- Worker 消息處理 ---
self.onmessage = async function(e) {
     const { type, params, useCachedData, cachedData, optimizeTargetStrategy, optimizeParamName, optimizeRange, lookbackDays } = e.data;
     try {
         if (type === 'runBacktest') {
             let dataToUse = null; let fetched = false;
             if (useCachedData && cachedData) {
                 console.log("[Worker] Using cached data for backtest.");
                 dataToUse = cachedData;
                 self.workerCachedStockData = dataToUse; 
             } else {
                 console.log("[Worker] Fetching new data for backtest.");
                 dataToUse = await fetchStockData(params.stockNo, params.startDate, params.endDate);
                 fetched = true;
                 self.workerCachedStockData = dataToUse; 
             }
             if(!dataToUse || dataToUse.length === 0) throw new Error("無法獲取或使用股票數據");

             const result = runStrategy(params, dataToUse);
             if (useCachedData || !fetched) { result.rawData = null; } // Don't send back data if it wasn't fetched by this worker call
             self.postMessage({ type: 'result', data: result });

        } else if (type === 'runOptimization') {
            if (!optimizeTargetStrategy || !optimizeParamName || !optimizeRange) throw new Error("優化目標、參數名或範圍未指定");
            // Enforce cache-only when requested: do not allow worker to fetch remote data in this mode.
            if (useCachedData) {
                const hasProvidedCache = Array.isArray(cachedData) && cachedData.length > 0;
                const hasWorkerCache = Array.isArray(self.workerCachedStockData) && self.workerCachedStockData.length > 0;
                if (!hasProvidedCache && !hasWorkerCache) {
                    throw new Error('優化失敗: 未提供快取數據；批量優化在快取模式下禁止從遠端抓取資料，請先於主畫面執行回測以建立快取。');
                }
            }
            const optOutcome = await runOptimization(params, optimizeTargetStrategy, optimizeParamName, optimizeRange, useCachedData, cachedData || self.workerCachedStockData); 
            self.postMessage({ type: 'result', data: optOutcome });

         } else if (type === 'getSuggestion') {
              console.log("[Worker] Received getSuggestion request.");
              if (!self.workerCachedStockData) { throw new Error("Worker 中無可用快取數據，請先執行回測。"); }
              if (self.workerCachedStockData.length < lookbackDays) { throw new Error(`Worker 快取數據不足 (${self.workerCachedStockData.length})，無法回看 ${lookbackDays} 天。`); }

              const recentData = self.workerCachedStockData.slice(-lookbackDays);
              const suggestionResult = runSuggestionSimulation(params, recentData);
              self.postMessage({ type: 'suggestionResult', data: suggestionResult });
         }
     } catch (error) {
          console.error(`Worker 執行 ${type} 期間錯誤:`, error);
          if (type === 'getSuggestion') {
              self.postMessage({ type: 'suggestionError', data: { message: `計算建議時發生錯誤: ${error.message || '未知錯誤'}` } });
          } else {
              self.postMessage({ type: 'error', data: { message: `Worker ${type} 錯誤: ${error.message || '未知錯誤'}` } });
          }
     }
};
// --- Web Worker End ---