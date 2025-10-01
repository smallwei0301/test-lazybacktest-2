// anns-model.js — ANN + 技術指標模型
// Patch Tag: LB-ANN-TECH-20251208A
/* global tf */

(function () {
  'use strict';

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
      if (v == null) {
        out[i] = prev;
        continue;
      }
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
    const dq = [];
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
    const dq = [];
    for (let i = 0; i < values.length; i++) {
      while (dq.length && dq[0] <= i - n) dq.shift();
      while (dq.length && values[dq[dq.length - 1]] >= values[i]) dq.pop();
      dq.push(i);
      if (i >= n - 1) out[i] = values[dq[0]];
    }
    return out;
  }

  function stochasticKD(high, low, close, nK = 14, nD = 3) {
    const hh = highest(high, nK);
    const ll = lowest(low, nK);
    const K = close.map((c, i) => {
      if (i < nK - 1) return null;
      const denom = hh[i] - ll[i];
      if (!Number.isFinite(denom) || denom === 0) return null;
      return ((c - ll[i]) / denom) * 100;
    });
    const D = sma(
      K.map((v) => (v == null ? 0 : v)),
      nD
    ).map((v, i) => (i >= nK - 1 ? v : null));
    return { K, D };
  }

  function rsi(close, n = 14) {
    const out = Array(close.length).fill(null);
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < close.length; i++) {
      const change = close[i] - close[i - 1];
      const up = Math.max(change, 0);
      const dn = Math.max(-change, 0);
      if (i <= n) {
        gain += up;
        loss += dn;
        if (i === n) {
          out[i] = 100 - 100 / (1 + (gain / n) / ((loss / n) || 1e-12));
        }
      } else {
        gain = (gain * (n - 1) + up) / n;
        loss = (loss * (n - 1) + dn) / n;
        const rs = gain / (loss || 1e-12);
        out[i] = 100 - 100 / (1 + rs);
      }
    }
    return out;
  }

  function macd(close, fast = 12, slow = 26, sig = 9) {
    const emaFast = ema(close, fast);
    const emaSlow = ema(close, slow);
    const diff = close.map((_, i) =>
      emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
    );
    const signal = ema(diff.map((v) => (v == null ? 0 : v)), sig);
    const hist = diff.map((v, i) =>
      v == null || signal[i] == null ? null : v - signal[i]
    );
    return { diff, signal, hist };
  }

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

  function williamsR(high, low, close, n = 14) {
    const hh = highest(high, n);
    const ll = lowest(low, n);
    return close.map((c, i) => {
      if (i < n - 1 || hh[i] == null || ll[i] == null) return null;
      const denom = hh[i] - ll[i] || 1e-12;
      return ((hh[i] - c) / denom) * 100;
    });
  }

  /* ========= 特徵建構 ========= */
  function buildFeaturesFromOHLC(rows) {
    const close = rows.map((r) => r.close);
    const high = rows.map((r) => (r.high == null ? r.close : r.high));
    const low = rows.map((r) => (r.low == null ? r.close : r.low));

    const MA = sma(close, 30);
    const WMA = wma(close, 15);
    const EMA = ema(close, 12);
    const MOM = momentum(close, 10);
    const { K, D } = stochasticKD(high, low, close, 14, 3);
    const RSIv = rsi(close, 14);
    const mac = macd(close, 12, 26, 9);
    const CCIv = cci(high, low, close, 20);
    const WR = williamsR(high, low, close, 14);

    const X = [];
    const y = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const feats = [
        MA[i],
        WMA[i],
        EMA[i],
        MOM[i],
        K[i],
        D[i],
        RSIv[i],
        mac.diff[i],
        CCIv[i],
        WR[i],
      ];
      if (feats.every((v) => Number.isFinite(v))) {
        X.push(feats.map((v) => Number(v)));
        const rise = rows[i + 1].close > rows[i].close ? 1 : 0;
        y.push(rise);
      }
    }
    return { X, y };
  }

  /* ========= 訓練 / 評估 ========= */
  function standardize(X) {
    const n = X.length;
    const p = X[0].length;
    const mean = Array(p).fill(0);
    const std = Array(p).fill(0);

    for (let i = 0; i < p; i++) {
      for (let r = 0; r < n; r++) mean[i] += X[r][i];
      mean[i] /= n;
      for (let r = 0; r < n; r++) std[i] += (X[r][i] - mean[i]) ** 2;
      std[i] = Math.sqrt(std[i] / Math.max(1, n - 1)) || 1;
    }

    const Z = X.map((row) => row.map((v, i) => (v - mean[i]) / std[i]));
    return { Z, mean, std };
  }

  function splitTrainTest(Z, y, ratio = 0.8) {
    const n = Z.length;
    const m = Math.floor(n * ratio);
    return {
      Xtr: Z.slice(0, m),
      ytr: y.slice(0, m),
      Xte: Z.slice(m),
      yte: y.slice(m),
    };
  }

  function buildAnn(inputDim) {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({ units: 32, activation: 'relu', inputShape: [inputDim] })
    );
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
    model.compile({
      optimizer: tf.train.sgd(0.01),
      loss: 'meanSquaredError',
      metrics: ['accuracy'],
    });
    return model;
  }

  async function trainAndEval(
    Xtr,
    ytr,
    Xte,
    yte,
    epochs = 60,
    batchSize = 32
  ) {
    const tx = tf.tensor2d(Xtr);
    const ty = tf.tensor2d(ytr, [ytr.length, 1]);
    const vx = tf.tensor2d(Xte);
    const vy = tf.tensor2d(yte, [yte.length, 1]);

    const model = buildAnn(Xtr[0].length);
    await model.fit(tx, ty, { epochs, batchSize, verbose: 0 });
    const preds = model.predict(vx);
    const p = Array.from(await preds.data()).map((v) => (v >= 0.5 ? 1 : 0));

    const acc = p.filter((v, i) => v === yte[i]).length / yte.length;
    let TP = 0;
    let TN = 0;
    let FP = 0;
    let FN = 0;
    for (let i = 0; i < p.length; i++) {
      if (yte[i] === 1 && p[i] === 1) TP += 1;
      else if (yte[i] === 0 && p[i] === 0) TN += 1;
      else if (yte[i] === 0 && p[i] === 1) FP += 1;
      else if (yte[i] === 1 && p[i] === 0) FN += 1;
    }

    tx.dispose();
    ty.dispose();
    vx.dispose();
    vy.dispose();
    preds.dispose();

    return { model, acc, confusion: { TP, TN, FP, FN } };
  }

  async function runANNPredictionWithCached(rows) {
    if (!Array.isArray(rows) || rows.length < 60) {
      throw new Error('資料不足');
    }
    const { X, y } = buildFeaturesFromOHLC(rows);
    if (X.length < 60) {
      throw new Error('有效樣本不足');
    }

    const { Z } = standardize(X);
    const { Xtr, ytr, Xte, yte } = splitTrainTest(Z, y, 0.8);

    const { model, acc, confusion } = await trainAndEval(Xtr, ytr, Xte, yte);

    const p = acc;
    const b = 1;
    const q = 1 - p;
    const kelly = Math.max(0, (b * p - q) / b);

    return {
      acc,
      confusion,
      kelly,
      modelSummary: typeof model.summary === 'function' ? model.summary() : null,
    };
  }

  window.LB_ANN = { runANNPredictionWithCached };
})();
