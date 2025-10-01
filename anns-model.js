// Patch Tag: LB-AI-ANNS-20251117A
// anns-model.js  —  ANN + 技術指標（與論文一致）
// 依據：輸入指標 = MA, WMA, EMA, Momentum, %K, %D, RSI, MACD, CCI, Williams %R
// 目標 = 預測「隔日」收盤方向 rise/fall（二元分類）
// 訓練/測試 = 80/20 split（論文與文獻建議）
// 損失 = MSE；學習 = 反向傳播 + 梯度下降（對齊論文描述）

/* ========= 工具 ========= */
function sma(values, n) {
  const out = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

function wma(values, n) {
  const out = Array(values.length).fill(null);
  const denom = (n * (n + 1)) / 2;
  for (let i = n - 1; i < values.length; i++) {
    let num = 0;
    for (let k = 0; k < n; k++) {
      num += (n - k) * values[i - k];
    }
    out[i] = num / denom;
  }
  return out;
}

function ema(values, n) {
  const out = Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) { out[i] = prev; continue; }
    if (prev == null) out[i] = v;
    else out[i] = prev + k * (v - prev);
    prev = out[i];
  }
  return out;
}

function momentum(values, n) {
  return values.map((v, i) => (i >= n ? v - values[i - n] : null));
}

function highest(values, n) {
  const out = Array(values.length).fill(null);
  let dq = [];
  for (let i = 0; i < values.length; i++) {
    while (dq.length && dq[0] <= i - n) dq.shift();
    while (dq.length && values[dq[dq.length - 1]] <= values[i]) dq.pop();
    dq.push(i);
    if (i >= n - 1) out[i] = values[dq[0]];
  }
  return out;
}
function lowest(values, n) {
  const out = Array(values.length).fill(null);
  let dq = [];
  for (let i = 0; i < values.length; i++) {
    while (dq.length && dq[0] <= i - n) dq.shift();
    while (dq.length && values[dq[dq.length - 1]] >= values[i]) dq.pop();
    dq.push(i);
    if (i >= n - 1) out[i] = values[dq[0]];
  }
  return out;
}

// Stochastic %K, %D
function stochasticKD(high, low, close, nK = 14, nD = 3) {
  const hh = highest(high, nK), ll = lowest(low, nK);
  const K = close.map((c, i) => {
    if (i < nK - 1) return null;
    const denom = (hh[i] - ll[i]);
    if (!Number.isFinite(denom) || denom === 0) return null;
    return ((c - ll[i]) / denom) * 100;
  });
  // %D = SMA(%K, nD)
  const D = sma(K.map(v => v ?? 0), nD).map((v, i) => (i >= nK - 1 ? v : null));
  return { K, D };
}

// RSI（Wilders）
function rsi(close, n = 14) {
  const out = Array(close.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < close.length; i++) {
    const change = close[i] - close[i - 1];
    const up = Math.max(change, 0), dn = Math.max(-change, 0);
    if (i <= n) { gain += up; loss += dn; if (i === n) out[i] = 100 - (100 / (1 + (gain / n) / ((loss / n) || 1e-12))); }
    else {
      gain = (gain * (n - 1) + up) / n;
      loss = (loss * (n - 1) + dn) / n;
      const rs = gain / (loss || 1e-12);
      out[i] = 100 - (100 / (1 + rs));
    }
  }
  return out;
}

// MACD（12/26 EMA，signal=9 EMA，輸入用 DIFF = EMA12-EMA26）
function macd(close, fast = 12, slow = 26, sig = 9) {
  const emaFast = ema(close, fast);
  const emaSlow = ema(close, slow);
  const diff = close.map((_, i) => (emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null));
  const signal = ema(diff.map(v => v ?? 0), sig);
  const hist = diff.map((v, i) => (v == null || signal[i] == null ? null : v - signal[i]));
  return { diff, signal, hist };
}

// CCI
function cci(high, low, close, n = 20) {
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const smaTp = sma(tp, n);
  const out = Array(close.length).fill(null);
  for (let i = n - 1; i < close.length; i++) {
    let md = 0;
    for (let k = 0; k < n; k++) md += Math.abs(tp[i - k] - smaTp[i]);
    md /= n;
    out[i] = (tp[i] - smaTp[i]) / (0.015 * md || 1e-12);
  }
  return out;
}

// Williams %R
function williamsR(high, low, close, n = 14) {
  const hh = highest(high, n), ll = lowest(low, n);
  return close.map((c, i) => {
    if (i < n - 1 || hh[i] == null || ll[i] == null) return null;
    const denom = (hh[i] - ll[i] || 1e-12);
    return ((hh[i] - c) / denom) * 100;
  });
}

/* ========= 特徵建構（對齊論文所列技術指標） ========= */
function buildFeaturesFromOHLC(rows) {
  // rows: [{date, open, high, low, close, volume}, ...]  —  你現有的 cachedStockData 結構
  const close = rows.map(r => r.close);
  const high  = rows.map(r => r.high ?? r.close);
  const low   = rows.map(r => r.low  ?? r.close);

  const MA   = sma(close, 30);          // 論文表格的 MA 計法以 Ct…Ct-30 表示（等權平均）
  const WMA  = wma(close, 15);          // 表格示例到 t-14，權重遞減
  const EMA  = ema(close, 12);          // 表格有 EMA(k) 公式
  const MOM  = momentum(close, 10);     // Momentum = Ct − Ct−n
  const { K, D } = stochasticKD(high, low, close, 14, 3); // %K/%D
  const RSIv = rsi(close, 14);          // RSI
  const mac  = macd(close, 12, 26, 9);  // MACD（使用 DIFF/Signal/Hist；輸入採 DIFF）
  const CCIv = cci(high, low, close, 20); // CCI
  const WR   = williamsR(high, low, close, 14); // Williams %R

  // 將所有指標對齊成矩陣 X，並在 t 時刻預測 t+1 是否上漲（rise=1）
  const X = [];
  const y = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const feats = [MA[i], WMA[i], EMA[i], MOM[i], K[i], D[i], RSIv[i], mac.diff[i], CCIv[i], WR[i]];
    if (feats.every(v => Number.isFinite(v))) {
      X.push(feats.map(v => Number(v)));
      const rise = rows[i + 1].close > rows[i].close ? 1 : 0; // 隔日方向（rise/fall）
      y.push(rise);
    }
  }
  return { X, y };
}

/* ========= 訓練 / 評估 ========= */
function standardize(X) {
  const n = X.length, p = X[0].length;
  const mean = Array(p).fill(0), std = Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    for (let r = 0; r < n; r++) mean[i] += X[r][i];
    mean[i] /= n;
    for (let r = 0; r < n; r++) std[i] += (X[r][i] - mean[i]) ** 2;
    std[i] = Math.sqrt(std[i] / Math.max(1, n - 1)) || 1;
  }
  const Z = X.map(row => row.map((v, i) => (v - mean[i]) / std[i]));
  return { Z, mean, std };
}

function splitTrainTest(Z, y, ratio = 0.8) { // 80/20（論文與文獻建議）
  const n = Z.length;
  const m = Math.floor(n * ratio);
  return {
    Xtr: Z.slice(0, m), ytr: y.slice(0, m),
    Xte: Z.slice(m),   yte: y.slice(m),
  };
}

function buildAnn(inputDim) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [inputDim] }));
  model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // 單輸出節點（二元分類）
  // 使用 MSE + SGD 對齊論文的敘述（誤差平方和、梯度下降、反向傳播）
  model.compile({ optimizer: tf.train.sgd(0.01), loss: 'meanSquaredError', metrics: ['accuracy'] });
  return model;
}

async function trainAndEval(Xtr, ytr, Xte, yte, epochs = 60, batchSize = 32) {
  const tx = tf.tensor2d(Xtr), ty = tf.tensor2d(ytr, [ytr.length, 1]);
  const vx = tf.tensor2d(Xte), vy = tf.tensor2d(yte, [yte.length, 1]);

  const model = buildAnn(Xtr[0].length);
  await model.fit(tx, ty, { epochs, batchSize, verbose: 0 });
  const preds = model.predict(vx);
  const p = Array.from((await preds.data())).map(v => (v >= 0.5 ? 1 : 0));

  const acc = p.filter((v, i) => v === yte[i]).length / yte.length;
  // 混淆矩陣
  let TP=0, TN=0, FP=0, FN=0;
  for (let i = 0; i < p.length; i++) {
    if (yte[i] === 1 && p[i] === 1) TP++;
    else if (yte[i] === 0 && p[i] === 0) TN++;
    else if (yte[i] === 0 && p[i] === 1) FP++;
    else if (yte[i] === 1 && p[i] === 0) FN++;
  }
  tx.dispose(); ty.dispose(); vx.dispose(); vy.dispose(); preds.dispose();

  return { model, acc, confusion: { TP, TN, FP, FN } };
}

/* ========= 對外主流程（給頁面呼叫） ========= */
async function runANNPredictionWithCached(rows) {
  if (!Array.isArray(rows) || rows.length < 60) throw new Error('資料不足');
  const { X, y } = buildFeaturesFromOHLC(rows);
  if (X.length < 60) throw new Error('有效樣本不足');

  const { Z } = standardize(X);
  const { Xtr, ytr, Xte, yte } = splitTrainTest(Z, y, 0.8); // 80/20

  const { model, acc, confusion } = await trainAndEval(Xtr, ytr, Xte, yte);

  // 凱利比例（以測試集平均漲跌幅近似 p/b）：這裡只示範方向命中率 → p
  const p = acc;                         // 命中率 ≈ p
  const b = 1;                           // 假設賠率 1:1（可改為你平台實測平均漲跌幅比）
  const q = 1 - p;
  const kelly = Math.max(0, (b * p - q) / b);

  return { acc, confusion, kelly, modelSummary: model.summary ? model.summary() : null };
}

window.LB_ANN = { runANNPredictionWithCached };
