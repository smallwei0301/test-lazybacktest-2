// --- AI 預測頁面控制器 (v1.0) ---
// Patch Tag: LB-AI-PREDICT-20251118A

(function () {
  const PAGE_VERSION = 'LB-AI-PREDICT-20251118A';
  const WORKER_SCRIPT = 'js/worker.js';
  const requestMap = new Map();
  let workerInstance = null;
  let activeRequestId = null;
  let timerHandle = null;
  let timerStart = null;

  const numberFormatter = new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const currencyFormatter = new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const percentFormatter = new Intl.NumberFormat('zh-TW', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function formatDateInput(date) {
    if (!(date instanceof Date)) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function setStatus(message, tone = 'info') {
    const statusEl = document.getElementById('ai-predict-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'text-xs';
    statusEl.classList.add(
      tone === 'error' ? 'text-rose-400' : tone === 'success' ? 'text-cyan-300' : 'text-slate-400',
    );
  }

  function startTimer() {
    const timerEl = document.getElementById('ai-predict-timer');
    if (!timerEl) return;
    timerStart = performance.now();
    timerEl.classList.remove('hidden');
    timerEl.textContent = '計算中… 0.0s';
    if (timerHandle) {
      clearInterval(timerHandle);
    }
    timerHandle = setInterval(() => {
      const elapsed = (performance.now() - timerStart) / 1000;
      timerEl.textContent = `計算中… ${elapsed.toFixed(1)}s`;
    }, 150);
  }

  function stopTimer() {
    const timerEl = document.getElementById('ai-predict-timer');
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
    if (timerEl) {
      timerEl.classList.add('hidden');
    }
  }

  function ensureWorker() {
    if (workerInstance) {
      return workerInstance;
    }
    workerInstance = new Worker(WORKER_SCRIPT);
    workerInstance.onmessage = (event) => {
      const { type, requestId, payload, error, progress, message } = event.data || {};
      if (type === 'progress') {
        if (requestId && requestId !== activeRequestId) return;
        if (typeof message === 'string') {
          setStatus(`資料擷取：${message}`);
        }
        return;
      }
      if (!requestId) return;
      const pending = requestMap.get(requestId);
      if (!pending) return;
      if (type === 'fetchPriceSeriesResult') {
        requestMap.delete(requestId);
        if (requestId === activeRequestId) {
          stopTimer();
          setStatus('資料擷取完成，開始訓練模型…', 'success');
        }
        pending.resolve(payload);
      } else if (type === 'fetchPriceSeriesError') {
        requestMap.delete(requestId);
        if (requestId === activeRequestId) {
          stopTimer();
          setStatus(error || '資料擷取失敗', 'error');
        }
        pending.reject(new Error(error || '資料擷取失敗'));
      }
    };
    workerInstance.onerror = (evt) => {
      const errorMessage = evt?.message || 'Worker 發生未預期錯誤';
      setStatus(errorMessage, 'error');
      if (activeRequestId) {
        const pending = requestMap.get(activeRequestId);
        if (pending) {
          pending.reject(new Error(errorMessage));
          requestMap.delete(activeRequestId);
        }
      }
    };
    return workerInstance;
  }

  async function fetchPriceSeries(params) {
    const worker = ensureWorker();
    const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestId = requestId;
    return new Promise((resolve, reject) => {
      requestMap.set(requestId, { resolve, reject });
      worker.postMessage({
        type: 'fetchPriceSeries',
        params,
        requestId,
      });
    });
  }

  function normaliseWindow(values) {
    const base = values[0] || 1;
    if (!Number.isFinite(base) || base === 0) {
      return values.map(() => 0);
    }
    return values.map((val) => (Number(val) / base) - 1);
  }

  function computeKellyFraction(prob, avgWin, avgLoss) {
    if (!(prob > 0) || !(avgWin > 0) || !(avgLoss > 0)) return 0;
    const b = avgWin / avgLoss;
    if (!(b > 0)) return 0;
    const fraction = (prob * (b + 1) - 1) / b;
    if (!Number.isFinite(fraction) || fraction <= 0) return 0;
    return Math.min(fraction, 1);
  }

  function summariseReturns(returns) {
    const wins = returns.filter((r) => r > 0);
    const losses = returns.filter((r) => r < 0);
    const avgWin = wins.length ? wins.reduce((acc, cur) => acc + cur, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((acc, cur) => acc + cur, 0) / losses.length) : 0;
    return { avgWin, avgLoss };
  }

  function renderSummary({
    trainAccuracy,
    testAccuracy,
    trainingSamples,
    testingSamples,
    windowSize,
    pricePoints,
    trainingRange,
    testingRange,
    avgWin,
    avgLoss,
    kellyEnabled,
  }) {
    const container = document.getElementById('ai-predict-summary-content');
    if (!container) return;
    const kellyText = kellyEnabled
      ? `<li><span class="font-medium text-slate-200">凱利公式參考盈虧比：</span>平均盈虧比 ${avgWin > 0 && avgLoss > 0 ? (avgWin / avgLoss).toFixed(3) : '—'}，平均獲利 ${percentFormatter.format(avgWin)}，平均虧損 ${percentFormatter.format(-avgLoss)}</li>`
      : '<li><span class="font-medium text-slate-200">凱利公式：</span>未啟用，改採固定部位比率。</li>';
    container.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-cyan-300 mb-2">${PAGE_VERSION}</p>
        <ul class="space-y-2 text-sm leading-6">
          <li><span class="font-medium text-slate-200">資料筆數：</span>${numberFormatter.format(pricePoints)} 日收盤價，視窗 ${windowSize} 日。</li>
          <li><span class="font-medium text-slate-200">訓練區間：</span>${trainingRange.start} 至 ${trainingRange.end}（${trainingSamples} 筆樣本，勝率 ${percentFormatter.format(trainAccuracy)}）。</li>
          <li><span class="font-medium text-slate-200">測試區間：</span>${testingRange.start} 至 ${testingRange.end}（${testingSamples} 筆樣本，預測準確率 ${percentFormatter.format(testAccuracy)}）。</li>
          ${kellyText}
        </ul>
      </div>
    `;
  }

  function renderTradeMetrics({
    trades,
    capital,
    initialCapital,
    useKelly,
    avgFraction,
    testAccuracy,
  }) {
    const container = document.getElementById('ai-predict-trade-content');
    if (!container) return;
    if (!trades.length) {
      container.innerHTML = '<p>測試期間未觸發符合條件的交易。您可以嘗試延長資料區間或調整視窗長度。</p>';
      return;
    }
    const totalProfit = trades.reduce((acc, trade) => acc + trade.profit, 0);
    const avgProfit = totalProfit / trades.length;
    const avgReturn = trades.reduce((acc, trade) => acc + trade.returnPct, 0) / trades.length;
    const wins = trades.filter((trade) => trade.returnPct > 0).length;
    const winRate = wins / trades.length;
    const finalReturn = (capital - initialCapital) / initialCapital;
    container.innerHTML = `
      <div class="grid gap-4 sm:grid-cols-2 text-sm leading-6">
        <div class="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p class="text-xs text-slate-500">策略成果</p>
          <p class="mt-2 text-lg font-semibold text-white">總報酬：${percentFormatter.format(finalReturn)}</p>
          <p class="text-slate-300">平均單筆報酬 ${percentFormatter.format(avgReturn)}，平均盈虧 ${currencyFormatter.format(Math.round(avgProfit))} 元。</p>
        </div>
        <div class="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p class="text-xs text-slate-500">交易統計</p>
          <p class="mt-2 text-lg font-semibold text-white">${wins}/${trades.length} 筆獲利，勝率 ${percentFormatter.format(winRate)}</p>
          <p class="text-slate-300">${useKelly ? `凱利公式平均部位 ${percentFormatter.format(avgFraction)}` : `固定部位比率 ${percentFormatter.format(avgFraction)}`}，預測準確率 ${percentFormatter.format(testAccuracy)}。</p>
        </div>
      </div>
    `;
  }

  function renderTradeTable(trades) {
    const tableBody = document.getElementById('trade-table-body');
    const tradeCount = document.getElementById('trade-count');
    if (tradeCount) {
      tradeCount.textContent = `${trades.length} 筆交易`;
    }
    if (!tableBody) return;
    if (!trades.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="px-3 py-6 text-center text-slate-500">尚未執行交易模擬。</td></tr>';
      return;
    }
    tableBody.innerHTML = trades
      .map((trade) => {
        return `
          <tr class="hover:bg-slate-900/40">
            <td class="px-3 py-2">${trade.buyDate}</td>
            <td class="px-3 py-2">${trade.sellDate}</td>
            <td class="px-3 py-2 text-right">${trade.buyPrice.toFixed(2)}</td>
            <td class="px-3 py-2 text-right">${trade.sellPrice.toFixed(2)}</td>
            <td class="px-3 py-2 text-right">${percentFormatter.format(trade.prob)}</td>
            <td class="px-3 py-2 text-right">${currencyFormatter.format(Math.round(trade.amount))}</td>
            <td class="px-3 py-2 text-right ${trade.profit >= 0 ? 'text-cyan-300' : 'text-rose-300'}">${currencyFormatter.format(Math.round(trade.profit))}</td>
            <td class="px-3 py-2 text-right ${trade.returnPct >= 0 ? 'text-cyan-300' : 'text-rose-300'}">${percentFormatter.format(trade.returnPct)}</td>
          </tr>
        `;
      })
      .join('');
  }

  async function ensureTensorFlowReady() {
    if (!window.tf) {
      throw new Error('TensorFlow.js 尚未載入完成');
    }
    if (typeof tf.ready === 'function') {
      await tf.ready();
    }
  }

  async function trainAndBacktest({
    priceSeries,
    windowSize,
    epochs,
    initialCapital,
    enableKelly,
    fixedFraction,
  }) {
    await ensureTensorFlowReady();
    const closes = priceSeries.map((row) => Number(row.close));
    const dates = priceSeries.map((row) => row.date);
    const sequences = [];
    const labels = [];
    const tradeMeta = [];
    for (let i = windowSize; i < closes.length; i += 1) {
      const windowSlice = closes.slice(i - windowSize, i);
      const normalised = normaliseWindow(windowSlice);
      const label = closes[i] > closes[i - 1] ? 1 : 0;
      sequences.push(normalised);
      labels.push(label);
      tradeMeta.push({
        buyDate: dates[i - 1],
        sellDate: dates[i],
        buyPrice: closes[i - 1],
        sellPrice: closes[i],
      });
    }
    if (sequences.length < 6) {
      throw new Error('有效樣本數不足，請延長日期區間或縮短視窗長度。');
    }
    const trainSamples = Math.max(1, Math.floor(sequences.length * (2 / 3)));
    const testSamples = sequences.length - trainSamples;
    if (testSamples < 1) {
      throw new Error('測試樣本不足，請延長資料區間。');
    }

    const xTrainTensor = tf.tensor(sequences.slice(0, trainSamples)).reshape([trainSamples, windowSize, 1]);
    const yTrainTensor = tf.tensor(labels.slice(0, trainSamples)).reshape([trainSamples, 1]);
    const xTestTensor = tf.tensor(sequences.slice(trainSamples)).reshape([testSamples, windowSize, 1]);
    const yTestTensor = tf.tensor(labels.slice(trainSamples)).reshape([testSamples, 1]);

    const model = tf.sequential({ layers: [] });
    model.add(tf.layers.lstm({ units: 32, inputShape: [windowSize, 1], returnSequences: false }));
    model.add(tf.layers.dropout({ rate: 0.25 }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy', metrics: ['accuracy'] });

    await model.fit(xTrainTensor, yTrainTensor, {
      epochs,
      batchSize: Math.min(32, trainSamples),
      shuffle: false,
      callbacks: {
        onEpochEnd: (_, logs) => {
          if (logs && typeof logs.loss === 'number') {
            setStatus(`訓練中：Epoch 損失 ${logs.loss.toFixed(4)}，準確率 ${(logs.acc ?? logs.accuracy ?? 0).toFixed(4)}`);
          }
        },
      },
    });

    const trainPredTensor = model.predict(xTrainTensor);
    const testPredTensor = model.predict(xTestTensor);

    const trainPred = Array.from(trainPredTensor.dataSync());
    const testPred = Array.from(testPredTensor.dataSync());
    const trainLabels = Array.from(yTrainTensor.dataSync());
    const testLabels = Array.from(yTestTensor.dataSync());

    const trainCorrect = trainPred.reduce((acc, prob, idx) => {
      const predicted = prob >= 0.5 ? 1 : 0;
      return acc + (predicted === trainLabels[idx] ? 1 : 0);
    }, 0);
    const testCorrect = testPred.reduce((acc, prob, idx) => {
      const predicted = prob >= 0.5 ? 1 : 0;
      return acc + (predicted === testLabels[idx] ? 1 : 0);
    }, 0);

    const trainReturns = tradeMeta.slice(0, trainSamples).map((meta) => (meta.sellPrice - meta.buyPrice) / meta.buyPrice);
    const { avgWin, avgLoss } = summariseReturns(trainReturns);

    const trades = [];
    let capital = initialCapital;
    let fractionSum = 0;
    let executedTrades = 0;
    const testMetas = tradeMeta.slice(trainSamples);
    testMetas.forEach((meta, idx) => {
      const prob = testPred[idx];
      const predictedUp = prob >= 0.5;
      if (!predictedUp) {
        return;
      }
      const tradeReturn = (meta.sellPrice - meta.buyPrice) / meta.buyPrice;
      const fraction = enableKelly ? computeKellyFraction(prob, avgWin, avgLoss) : fixedFraction;
      if (!(fraction > 0)) {
        return;
      }
      const amount = capital * Math.min(1, Math.max(0, fraction));
      const profit = amount * tradeReturn;
      capital += profit;
      fractionSum += Math.min(1, Math.max(0, fraction));
      executedTrades += 1;
      trades.push({
        buyDate: meta.buyDate,
        sellDate: meta.sellDate,
        buyPrice: meta.buyPrice,
        sellPrice: meta.sellPrice,
        prob,
        amount,
        profit,
        returnPct: tradeReturn,
      });
    });

    const avgFraction = executedTrades > 0 ? fractionSum / executedTrades : enableKelly ? 0 : fixedFraction;

    xTrainTensor.dispose();
    yTrainTensor.dispose();
    xTestTensor.dispose();
    yTestTensor.dispose();
    trainPredTensor.dispose();
    testPredTensor.dispose();
    model.dispose();

    return {
      trades,
      capital,
      initialCapital,
      trainAccuracy: trainCorrect / trainSamples,
      testAccuracy: testCorrect / testSamples,
      trainingSamples: trainSamples,
      testingSamples: testSamples,
      trainingRange: {
        start: tradeMeta[0]?.buyDate ?? priceSeries[0]?.date,
        end: tradeMeta[trainSamples - 1]?.sellDate ?? priceSeries[trainSamples]?.date,
      },
      testingRange: {
        start: testMetas[0]?.buyDate ?? priceSeries[trainSamples]?.date,
        end: testMetas[testMetas.length - 1]?.sellDate ?? priceSeries[priceSeries.length - 1]?.date,
      },
      avgWin,
      avgLoss,
      avgFraction,
    };
  }

  function validateParams(params) {
    if (!params.stockNo) {
      throw new Error('請輸入股票代號');
    }
    if (!params.startDate || !params.endDate) {
      throw new Error('請輸入完整的日期區間');
    }
    if (new Date(params.startDate) >= new Date(params.endDate)) {
      throw new Error('開始日期需早於結束日期');
    }
    if (!(params.windowSize >= 5 && params.windowSize <= 180)) {
      throw new Error('視窗長度需介於 5 到 180 日');
    }
    if (!(params.epochs >= 10 && params.epochs <= 400)) {
      throw new Error('訓練週期建議介於 10 到 400');
    }
    if (!(params.initialCapital > 0)) {
      throw new Error('初始資金需大於零');
    }
    if (!params.enableKelly && !(params.fixedFraction >= 0 && params.fixedFraction <= 1)) {
      throw new Error('固定部位比率需介於 0 與 1 之間');
    }
  }

  function initDefaultDates() {
    const endInput = document.getElementById('end-date');
    const startInput = document.getElementById('start-date');
    const today = new Date();
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 5);
    if (endInput) endInput.value = formatDateInput(today);
    if (startInput) startInput.value = formatDateInput(start);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const params = {
      stockNo: String(formData.get('stockNo') || '').trim(),
      marketType: String(formData.get('marketType') || 'TWSE'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      windowSize: Number(formData.get('windowSize') || 20),
      epochs: Number(formData.get('epochs') || 60),
      initialCapital: Number(formData.get('initialCapital') || 100000),
      enableKelly: formData.get('enableKelly') !== null,
      fixedFraction: Number(formData.get('fixedFraction') || 0.5),
    };
    try {
      validateParams(params);
    } catch (err) {
      setStatus(err.message || '參數驗證失敗', 'error');
      return;
    }

    try {
      setStatus('準備擷取資料…');
      startTimer();
      const pricePayload = await fetchPriceSeries({
        stockNo: params.stockNo,
        marketType: params.marketType,
        startDate: params.startDate,
        endDate: params.endDate,
        adjustedPrice: false,
        splitAdjustment: false,
        effectiveStartDate: params.startDate,
      });
      const priceSeries = Array.isArray(pricePayload?.priceSeries) ? pricePayload.priceSeries : [];
      if (!priceSeries.length) {
        throw new Error('查無有效的收盤價資料，請確認代號或日期區間。');
      }
      setStatus('資料擷取完成，開始建立 LSTM 模型…');
      const results = await trainAndBacktest({
        priceSeries,
        windowSize: params.windowSize,
        epochs: params.epochs,
        initialCapital: params.initialCapital,
        enableKelly: params.enableKelly,
        fixedFraction: params.enableKelly ? 0 : params.fixedFraction,
      });
      stopTimer();
      setStatus('分析完成。', 'success');
      renderSummary({
        trainAccuracy: results.trainAccuracy,
        testAccuracy: results.testAccuracy,
        trainingSamples: results.trainingSamples,
        testingSamples: results.testingSamples,
        windowSize: params.windowSize,
        pricePoints: priceSeries.length,
        trainingRange: results.trainingRange,
        testingRange: results.testingRange,
        avgWin: results.avgWin,
        avgLoss: results.avgLoss,
        kellyEnabled: params.enableKelly,
      });
      renderTradeMetrics({
        trades: results.trades,
        capital: results.capital,
        initialCapital: params.initialCapital,
        useKelly: params.enableKelly,
        avgFraction: results.avgFraction,
        testAccuracy: results.testAccuracy,
      });
      renderTradeTable(results.trades);
    } catch (err) {
      console.error('[AI Predict] 執行失敗', err);
      stopTimer();
      setStatus(err?.message || '執行失敗', 'error');
      renderSummary({
        trainAccuracy: 0,
        testAccuracy: 0,
        trainingSamples: 0,
        testingSamples: 0,
        windowSize: params.windowSize,
        pricePoints: 0,
        trainingRange: { start: '—', end: '—' },
        testingRange: { start: '—', end: '—' },
        avgWin: 0,
        avgLoss: 0,
        kellyEnabled: params.enableKelly,
      });
      renderTradeMetrics({
        trades: [],
        capital: params.initialCapital,
        initialCapital: params.initialCapital,
        useKelly: params.enableKelly,
        avgFraction: params.enableKelly ? 0 : params.fixedFraction,
        testAccuracy: 0,
      });
      renderTradeTable([]);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDefaultDates();
    const form = document.getElementById('ai-predict-form');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
    setStatus('準備就緒，請輸入參數後執行。');
  });

  window.addEventListener('beforeunload', () => {
    if (workerInstance) {
      workerInstance.terminate();
      workerInstance = null;
    }
  });
})();
