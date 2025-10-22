
// Patch Tag: LB-AI-ANNS-REPRO-20251224B — Deterministic trade pricing & metadata expansion.
// Patch Tag: LB-AI-TRADE-RULE-20251229A — Added close-entry metadata for ANN trades.
// Patch Tag: LB-AI-TRADE-VOLATILITY-20251230A — Multiclass volatility tiers & shared metadata.
// Patch Tag: LB-AI-LSTM-CLASS-20251230A — LSTM binary/multiclass toggle & probability normalisation.
// Patch Tag: LB-AI-VOL-QUARTILE-20251231A — Train-set quartile thresholds for volatility tiers.
// Patch Tag: LB-AI-VOL-QUARTILE-20260105A — Positive/negative quartile separation for volatility tiers.
// Patch Tag: LB-AI-VOL-QUARTILE-20260110A — Volatility quartile diagnostics for reproducibility.
// Patch Tag: LB-AI-VOL-QUARTILE-20260111A — Quartile fallback indicators and share diagnostics for AI volatility tiers.
// Patch Tag: LB-AI-PRECISION-20260118A — Multiclass precision metrics & diagnostics parity.
// Patch Tag: LB-AI-THRESHOLD-20260122A — Multiclass threshold defaults for deterministic gating.
// Patch Tag: LB-AI-THRESHOLD-20260124A — Binary default win threshold tuned to 50%.
// Patch Tag: LB-AI-VOL-QUARTILE-20260128A — Align ANN class分佈與波動門檻紀錄並回傳實際閾值。
// Patch Tag: LB-AI-VOL-QUARTILE-20260202A — 傳回類別平均報酬並以預估漲跌幅顯示交易判斷。
// Patch Tag: LB-AI-SWING-20260210A — 預估漲跌幅移除門檻 fallback，僅保留類別平均值。
// Patch Tag: LB-AI-TF-LAZYLOAD-20250704A — TensorFlow.js 延後載入，僅在 AI 任務啟動時初始化。
// Patch Tag: LB-PLUGIN-CONTRACT-20250705A — 引入策略插件契約與 RuleResult 型別驗證。
importScripts('shared-lookback.js');
importScripts('strategy-plugin-contract.js');
importScripts('strategy-plugin-registry.js');
importScripts('strategy-plugins/ma-cross.js');
importScripts('strategy-plugins/rsi.js');
importScripts('strategy-plugins/kd.js');
importScripts('strategy-plugins/bollinger.js');
importScripts('strategy-plugins/atr-stop.js');
importScripts('config.js');

const TFJS_VERSION = '4.20.0';
const TF_BACKEND_TARGET = 'wasm';
const ANN_DEFAULT_SEED = 1337;
const ANN_MODEL_STORAGE_KEY = 'anns_v1_model';
const ANN_META_MESSAGE = 'ANN_META';
const ANN_REPRO_VERSION = 'anns_v1';
const ANN_REPRO_PATCH = 'LB-AI-ANNS-REPRO-20260210A';
const ANN_DIAGNOSTIC_VERSION = 'LB-AI-ANN-DIAG-20260210A';
const LSTM_DEFAULT_SEED = 7331;
const LSTM_MODEL_STORAGE_KEY = 'lstm_v1_model';
const LSTM_META_MESSAGE = 'LSTM_META';
const LSTM_REPRO_VERSION = 'lstm_v1';
const LSTM_REPRO_PATCH = 'LB-AI-LSTM-REPRO-20260118A';
const LSTM_THRESHOLD = 0.5;
const DEFAULT_VOLATILITY_THRESHOLDS = { surge: 0.03, drop: 0.03 };
const CLASSIFICATION_MODES = {
  BINARY: 'binary',
  MULTICLASS: 'multiclass',
};

const legacyRuleResultNormaliser =
  typeof self !== 'undefined' &&
  self.LegacyStrategyPluginShim &&
  typeof self.LegacyStrategyPluginShim.normaliseResult === 'function'
    ? self.LegacyStrategyPluginShim.normaliseResult.bind(self.LegacyStrategyPluginShim)
    : null;

function normaliseRuleResultFromLegacy(pluginId, role, candidate, index) {
  if (legacyRuleResultNormaliser) {
    return legacyRuleResultNormaliser(pluginId, role, candidate, { index });
  }
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[StrategyPluginContract] 未載入 LegacyStrategyPluginShim，使用退化布林判斷 (${pluginId || '未知策略'})`,
    );
  }
  if (candidate && typeof candidate === 'object') {
    const record = /** @type {Record<string, unknown>} */ (candidate);
    return {
      enter: role === 'longEntry' ? record.enter === true : false,
      exit: role === 'longExit' ? record.exit === true : false,
      short: role === 'shortEntry' ? record.short === true : false,
      cover: role === 'shortExit' ? record.cover === true : false,
      stopLossPercent:
        typeof record.stopLossPercent === 'number' && Number.isFinite(record.stopLossPercent)
          ? record.stopLossPercent
          : null,
      takeProfitPercent:
        typeof record.takeProfitPercent === 'number' && Number.isFinite(record.takeProfitPercent)
          ? record.takeProfitPercent
          : null,
      meta: {},
    };
  }
  const value = candidate === true;
  return {
    enter: role === 'longEntry' ? value : false,
    exit: role === 'longExit' ? value : false,
    short: role === 'shortEntry' ? value : false,
    cover: role === 'shortExit' ? value : false,
    stopLossPercent: null,
    takeProfitPercent: null,
    meta: {},
  };
}

const ANN_FEATURE_NAMES = [
  'SMA30',
  'WMA15',
  'EMA12',
  'Momentum10',
  'StochK14',
  'StochD3',
  'RSI14',
  'MACDdiff',
  'MACDsignal',
  'MACDhist',
  'CCI20',
  'WilliamsR14',
];

function normalizeClassificationMode(mode) {
  return mode === CLASSIFICATION_MODES.BINARY ? CLASSIFICATION_MODES.BINARY : CLASSIFICATION_MODES.MULTICLASS;
}

function getDefaultThresholdForMode(mode) {
  return normalizeClassificationMode(mode) === CLASSIFICATION_MODES.MULTICLASS ? 0 : 0.5;
}

function sanitizeVolatilityThresholds(input = {}) {
  const fallbackSurge = DEFAULT_VOLATILITY_THRESHOLDS.surge;
  const fallbackDrop = DEFAULT_VOLATILITY_THRESHOLDS.drop;
  const rawSurge = Number(input?.surge);
  const rawDrop = Number(input?.drop);
  const rawLower = Number(input?.lowerQuantile);
  const rawUpper = Number(input?.upperQuantile);

  let surge = Number.isFinite(rawSurge) && Math.abs(rawSurge) > 0 ? Math.abs(rawSurge) : NaN;
  let drop = Number.isFinite(rawDrop) && Math.abs(rawDrop) > 0 ? Math.abs(rawDrop) : NaN;

  if (!(surge > 0) && Number.isFinite(rawUpper) && Math.abs(rawUpper) > 0) {
    surge = Math.abs(rawUpper);
  }
  if (!(drop > 0) && Number.isFinite(rawLower) && Math.abs(rawLower) > 0) {
    drop = Math.abs(rawLower);
  }

  if (!(surge > 0)) {
    surge = fallbackSurge;
  }
  if (!(drop > 0)) {
    drop = fallbackDrop;
  }

  surge = Math.min(Math.max(surge, 0.0001), 0.5);
  drop = Math.min(Math.max(drop, 0.0001), 0.5);

  let lowerQuantile;
  if (Number.isFinite(rawLower) && Math.abs(rawLower) > 0) {
    lowerQuantile = rawLower > 0 ? -Math.abs(rawLower) : Math.max(rawLower, -0.5);
  } else {
    lowerQuantile = -drop;
  }

  let upperQuantile;
  if (Number.isFinite(rawUpper) && Math.abs(rawUpper) > 0) {
    upperQuantile = rawUpper < 0 ? Math.abs(rawUpper) : Math.min(rawUpper, 0.5);
  } else {
    upperQuantile = surge;
  }

  upperQuantile = Math.min(Math.max(upperQuantile, 0.0001), 0.5);
  lowerQuantile = Math.max(Math.min(lowerQuantile, -0.0001), -0.5);

  return {
    surge,
    drop,
    lowerQuantile,
    upperQuantile,
  };
}

function computeQuantileValue(sortedValues, percentile) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return NaN;
  const clampedPercentile = Math.min(Math.max(percentile, 0), 1);
  if (sortedValues.length === 1 || clampedPercentile === 0) {
    return sortedValues[0];
  }
  if (clampedPercentile === 1) {
    return sortedValues[sortedValues.length - 1];
  }
  const position = (sortedValues.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(lowerIndex + 1, sortedValues.length - 1);
  const weight = position - lowerIndex;
  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];
  if (!Number.isFinite(lowerValue)) return upperValue;
  if (!Number.isFinite(upperValue)) return lowerValue;
  return lowerValue + ((upperValue - lowerValue) * weight);
}

function deriveVolatilityThresholdsFromReturns(values, fallback = DEFAULT_VOLATILITY_THRESHOLDS, diagnosticsRef = null) {
  const fallbackSanitized = sanitizeVolatilityThresholds(fallback);
  if (!Array.isArray(values) || values.length === 0) {
    return fallbackSanitized;
  }
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return fallbackSanitized;
  }

  const sorted = filtered.slice().sort((a, b) => a - b);
  const positives = sorted.filter((value) => value > 0);
  const negatives = sorted.filter((value) => value < 0);
  const zeroCount = filtered.length - positives.length - negatives.length;

  const combinedUpperQuartile = computeQuantileValue(sorted, 0.75);
  const combinedLowerQuartile = computeQuantileValue(sorted, 0.25);
  const positiveOnlyQuartile = positives.length > 0 ? computeQuantileValue(positives, 0.75) : NaN;
  const negativeOnlyQuartile = negatives.length > 0 ? computeQuantileValue(negatives, 0.25) : NaN;

  let positiveSource = 'combined';
  let negativeSource = 'combined';

  let upperCandidate = Number.isFinite(combinedUpperQuartile) ? combinedUpperQuartile : NaN;
  if (!(upperCandidate > 0)) {
    if (Number.isFinite(positiveOnlyQuartile) && positiveOnlyQuartile > 0) {
      upperCandidate = positiveOnlyQuartile;
      positiveSource = 'positive-only';
    } else {
      const fallbackUpper = Number.isFinite(fallbackSanitized.upperQuantile) && fallbackSanitized.upperQuantile > 0
        ? fallbackSanitized.upperQuantile
        : (fallbackSanitized.surge > 0 ? fallbackSanitized.surge : NaN);
      upperCandidate = Number.isFinite(fallbackUpper) ? fallbackUpper : NaN;
      positiveSource = 'default';
    }
  }

  let lowerCandidate = Number.isFinite(combinedLowerQuartile) ? combinedLowerQuartile : NaN;
  if (!(lowerCandidate < 0)) {
    if (Number.isFinite(negativeOnlyQuartile) && negativeOnlyQuartile < 0) {
      lowerCandidate = negativeOnlyQuartile;
      negativeSource = 'negative-only';
    } else {
      const fallbackLower = Number.isFinite(fallbackSanitized.lowerQuantile) && fallbackSanitized.lowerQuantile < 0
        ? fallbackSanitized.lowerQuantile
        : (fallbackSanitized.drop > 0 ? -fallbackSanitized.drop : NaN);
      lowerCandidate = Number.isFinite(fallbackLower) ? fallbackLower : NaN;
      negativeSource = 'default';
    }
  }

  const sanitized = sanitizeVolatilityThresholds({
    surge: upperCandidate,
    drop: Math.abs(lowerCandidate),
    lowerQuantile: lowerCandidate,
    upperQuantile: upperCandidate,
  });

  if (diagnosticsRef && typeof diagnosticsRef === 'object') {
    const positiveThreshold = Number.isFinite(sanitized.upperQuantile)
      ? sanitized.upperQuantile
      : (Number.isFinite(sanitized.surge) ? sanitized.surge : NaN);
    const negativeThreshold = Number.isFinite(sanitized.lowerQuantile)
      ? sanitized.lowerQuantile
      : (Number.isFinite(sanitized.drop) ? -sanitized.drop : NaN);

    let positiveExceedCount = 0;
    let negativeExceedCount = 0;
    if (Number.isFinite(positiveThreshold) || Number.isFinite(negativeThreshold)) {
      for (let i = 0; i < filtered.length; i += 1) {
        const value = filtered[i];
        if (Number.isFinite(positiveThreshold) && value >= positiveThreshold) {
          positiveExceedCount += 1;
        } else if (Number.isFinite(negativeThreshold) && value <= negativeThreshold) {
          negativeExceedCount += 1;
        }
      }
    }

    let midbandCount = filtered.length - positiveExceedCount - negativeExceedCount;
    if (!Number.isFinite(midbandCount) || midbandCount < 0) {
      midbandCount = Math.max(filtered.length - positiveExceedCount - negativeExceedCount, 0);
    }

    diagnosticsRef.totalSamples = filtered.length;
    if (!Number.isFinite(diagnosticsRef.expectedTrainSamples)) {
      diagnosticsRef.expectedTrainSamples = filtered.length;
    }
    diagnosticsRef.positiveSamples = positives.length;
    diagnosticsRef.negativeSamples = negatives.length;
    diagnosticsRef.zeroSamples = zeroCount;
    diagnosticsRef.upperQuartile = Number.isFinite(combinedUpperQuartile) ? combinedUpperQuartile : null;
    diagnosticsRef.lowerQuartile = Number.isFinite(combinedLowerQuartile) ? combinedLowerQuartile : null;
    diagnosticsRef.combinedUpperQuartile = diagnosticsRef.upperQuartile;
    diagnosticsRef.combinedLowerQuartile = diagnosticsRef.lowerQuartile;
    diagnosticsRef.positiveQuartile = diagnosticsRef.upperQuartile;
    diagnosticsRef.negativeQuartile = diagnosticsRef.lowerQuartile;
    diagnosticsRef.positiveOnlyQuartile = Number.isFinite(positiveOnlyQuartile) ? positiveOnlyQuartile : null;
    diagnosticsRef.negativeOnlyQuartile = Number.isFinite(negativeOnlyQuartile) ? negativeOnlyQuartile : null;
    diagnosticsRef.positiveThreshold = Number.isFinite(positiveThreshold) ? positiveThreshold : null;
    diagnosticsRef.negativeThreshold = Number.isFinite(negativeThreshold) ? negativeThreshold : null;
    diagnosticsRef.positiveExceedCount = positiveExceedCount;
    diagnosticsRef.negativeExceedCount = negativeExceedCount;
    const positiveExceedShare = positives.length > 0 ? (positiveExceedCount / positives.length) : NaN;
    const negativeExceedShare = negatives.length > 0 ? (negativeExceedCount / negatives.length) : NaN;
    const totalPositiveShare = filtered.length > 0 ? (positiveExceedCount / filtered.length) : NaN;
    const totalNegativeShare = filtered.length > 0 ? (negativeExceedCount / filtered.length) : NaN;
    const zeroShare = filtered.length > 0 ? (zeroCount / filtered.length) : NaN;
    const midbandShare = filtered.length > 0 ? (midbandCount / filtered.length) : NaN;
    diagnosticsRef.positiveExceedShare = Number.isFinite(positiveExceedShare) ? positiveExceedShare : null;
    diagnosticsRef.negativeExceedShare = Number.isFinite(negativeExceedShare) ? negativeExceedShare : null;
    diagnosticsRef.totalPositiveShare = Number.isFinite(totalPositiveShare) ? totalPositiveShare : null;
    diagnosticsRef.totalNegativeShare = Number.isFinite(totalNegativeShare) ? totalNegativeShare : null;
    diagnosticsRef.zeroShare = Number.isFinite(zeroShare) ? zeroShare : null;
    diagnosticsRef.midbandCount = midbandCount;
    diagnosticsRef.midbandShare = Number.isFinite(midbandShare) ? midbandShare : null;
    diagnosticsRef.usedPositiveFallback = positiveSource !== 'combined';
    diagnosticsRef.usedNegativeFallback = negativeSource !== 'combined';
    diagnosticsRef.positiveSource = positiveSource;
    diagnosticsRef.negativeSource = negativeSource;
    diagnosticsRef.fallbackUpperQuartile = null;
    diagnosticsRef.fallbackLowerQuartile = null;
  }

  return sanitized;
}

function classifySwingReturn(swingValue, thresholds) {
  if (!Number.isFinite(swingValue)) {
    return 1;
  }
  const upper = Number.isFinite(thresholds?.upperQuantile) ? thresholds.upperQuantile : thresholds?.surge;
  const lower = Number.isFinite(thresholds?.lowerQuantile)
    ? thresholds.lowerQuantile
    : (Number.isFinite(thresholds?.drop) ? -thresholds.drop : -DEFAULT_VOLATILITY_THRESHOLDS.drop);
  if (Number.isFinite(upper) && swingValue >= upper) {
    return 2;
  }
  if (Number.isFinite(lower) && swingValue <= lower) {
    return 0;
  }
  const fallbackSurge = Number.isFinite(thresholds?.surge) ? thresholds.surge : DEFAULT_VOLATILITY_THRESHOLDS.surge;
  const fallbackDrop = Number.isFinite(thresholds?.drop) ? thresholds.drop : DEFAULT_VOLATILITY_THRESHOLDS.drop;
  if (Number.isFinite(fallbackSurge) && swingValue >= fallbackSurge) {
    return 2;
  }
  if (Number.isFinite(fallbackDrop) && swingValue <= -fallbackDrop) {
    return 0;
  }
  return 1;
}

function computeExpectedSwing(probabilities, mode, averages) {
  if (!Array.isArray(probabilities) || probabilities.length === 0) return NaN;
  const normalizedMode = normalizeClassificationMode(mode);
  const sums = probabilities.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
  const normalised = probabilities.map((value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    if (sums > 0) {
      return num / sums;
    }
    return 0;
  });
  const stats = averages && typeof averages === 'object' ? averages : {};
  const train = stats.train && typeof stats.train === 'object' ? stats.train : {};
  const overall = stats.overall && typeof stats.overall === 'object' ? stats.overall : {};
  const pickAverage = (key, fallbackValue = NaN) => {
    const trainValue = Number(train[key]);
    if (Number.isFinite(trainValue)) return trainValue;
    const overallValue = Number(overall[key]);
    if (Number.isFinite(overallValue)) return overallValue;
    return Number.isFinite(fallbackValue) ? fallbackValue : NaN;
  };
  if (normalizedMode === CLASSIFICATION_MODES.MULTICLASS) {
    const dropMean = pickAverage('drop');
    const flatMean = pickAverage('flat', 0);
    const surgeMean = pickAverage('surge');
    const dropProb = normalised[0] ?? 0;
    const flatProb = normalised[1] ?? 0;
    const surgeProb = normalised[2] ?? 0;
    if (!Number.isFinite(dropMean) && !Number.isFinite(flatMean) && !Number.isFinite(surgeMean)) {
      return NaN;
    }
    return (dropProb * dropMean) + (flatProb * flatMean) + (surgeProb * surgeMean);
  }
  const downMean = pickAverage('down');
  const upMean = pickAverage('up');
  const downProb = normalised[0] ?? 0;
  const upProb = normalised[2] ?? (normalised[1] ?? 0);
  if (!Number.isFinite(downMean) && !Number.isFinite(upMean)) {
    return NaN;
  }
  return (downProb * downMean) + (upProb * upMean);
}

function clampProbability(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

let tfBackendReadyPromise = null;

async function ensureTF() {
  if (tfBackendReadyPromise) {
    return tfBackendReadyPromise;
  }
  tfBackendReadyPromise = (async () => {
    try {
      if (typeof tf === 'undefined') {
        importScripts(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${TFJS_VERSION}/dist/tf.min.js`);
      }
      if (typeof tf !== 'undefined' && typeof tf?.setBackend === 'function') {
        try {
          importScripts(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${TFJS_VERSION}/dist/tf-backend-wasm.min.js`);
        } catch (wasmError) {
          console.warn('[Worker][AI] 無法載入 TFJS WASM 後端：', wasmError);
        }
        if (tf?.wasm?.setWasmPaths) {
          tf.wasm.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${TFJS_VERSION}/dist/`);
        }
        if (typeof tf?.util?.seedrandom === 'function') {
          tf.util.seedrandom(ANN_DEFAULT_SEED);
        }
        try {
          if (tf.getBackend() !== TF_BACKEND_TARGET) {
            await tf.setBackend(TF_BACKEND_TARGET);
          }
        } catch (backendError) {
          console.warn(`[Worker][AI] 無法設定 ${TF_BACKEND_TARGET} 後端，退回 CPU：`, backendError);
          try {
            await tf.setBackend('cpu');
          } catch (cpuError) {
            console.warn('[Worker][AI] 無法切換至 CPU 後端：', cpuError);
          }
        }
        await tf.ready();
        return tf.getBackend();
      }
    } catch (error) {
      console.warn('[Worker][AI] 無法初始化 TensorFlow.js：', error);
    }
    return undefined;
  })();
  return tfBackendReadyPromise;
}

// --- Worker Data Acquisition & Cache (v11.7 - Netlify blob range fast path) ---
// Patch Tag: LB-DATAPIPE-20241007A
// Patch Tag: LB-ADJ-PIPE-20241020A
// Patch Tag: LB-ADJ-PIPE-20250220A
// Patch Tag: LB-ADJ-PIPE-20250305A
// Patch Tag: LB-ADJ-PIPE-20250312A
// Patch Tag: LB-ADJ-PIPE-20250320A
// Patch Tag: LB-ADJ-PIPE-20250410A
// Patch Tag: LB-ADJ-PIPE-20250527A
// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-US-YAHOO-20250613A
// Patch Tag: LB-COVERAGE-STREAM-20250705A
// Patch Tag: LB-BLOB-RANGE-20250708A
// Patch Tag: LB-TODAY-SUGGESTION-DIAG-20250909A
// Patch Tag: LB-TODAY-SUGGESTION-FINALSTATE-RECOVER-20250911A
// Patch Tag: LB-PROGRESS-PIPELINE-20251116A
// Patch Tag: LB-PROGRESS-PIPELINE-20251116B

// Patch Tag: LB-SENSITIVITY-GRID-20250715A
// Patch Tag: LB-SENSITIVITY-METRIC-20250729A
// Patch Tag: LB-BLOB-CURRENT-20250730A
// Patch Tag: LB-BLOB-CURRENT-20250802B
// Patch Tag: LB-AI-LSTM-20250929B
// Patch Tag: LB-AI-ANNS-20251212A

const MODEL_TYPES = {
  LSTM: 'lstm',
  ANNS: 'anns',
};

const WORKER_DATA_VERSION = "v11.7";
const workerCachedStockData = new Map(); // Map<marketKey, Map<cacheKey, CacheEntry>>
const workerMonthlyCache = new Map(); // Map<marketKey, Map<stockKey, Map<monthKey, MonthCacheEntry>>>
const workerYearSupersetCache = new Map(); // Map<marketKey, Map<stockKey, Map<year, YearSupersetEntry>>>
let workerLastDataset = null;
let workerLastMeta = null;
let pendingNextDayTrade = null; // 隔日交易追蹤變數

const DAY_MS = 24 * 60 * 60 * 1000;
const COVERAGE_GAP_TOLERANCE_DAYS = 6;
const CRITICAL_START_GAP_TOLERANCE_DAYS = 7;
const SENSITIVITY_GRID_VERSION = "LB-SENSITIVITY-GRID-20250715A";
const SENSITIVITY_SCORE_VERSION = "LB-SENSITIVITY-METRIC-20250729A";
const SENSITIVITY_RELATIVE_STEPS = [0.05, 0.1, 0.2];
const SENSITIVITY_ABSOLUTE_MULTIPLIERS = [1, 2];
const SENSITIVITY_MAX_SCENARIOS_PER_PARAM = 8;
const NETLIFY_BLOB_RANGE_TIMEOUT_MS = 2500;

function aiPostProgress(id, message) {
  if (!id) return;
  self.postMessage({ type: 'ai-train-lstm-progress', id, message });
}

function aiPostError(id, error) {
  if (!id) return;
  const message = error instanceof Error ? error.message : String(error || 'AI Worker 發生未知錯誤');
  self.postMessage({ type: 'ai-train-lstm-error', id, error: { message } });
}

function aiPostResult(id, data) {
  if (!id) return;
  self.postMessage({ type: 'ai-train-lstm-result', id, data });
}

function aiComputeNormalisation(sequences, trainSize) {
  if (!Array.isArray(sequences) || sequences.length === 0 || trainSize <= 0) {
    return { mean: 0, std: 1 };
  }
  const trainSlice = sequences.slice(0, trainSize);
  const values = trainSlice.flat();
  if (values.length === 0) {
    return { mean: 0, std: 1 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  return { mean, std };
}

function aiNormaliseSequences(sequences, normaliser) {
  const { mean, std } = normaliser;
  if (!Array.isArray(sequences) || sequences.length === 0) return [];
  const divisor = std || 1;
  return sequences.map((seq) => seq.map((value) => (value - mean) / divisor));
}

function aiCreateModel(lookback, learningRate, seed = LSTM_DEFAULT_SEED, classificationMode = CLASSIFICATION_MODES.BINARY) {
  const baseSeed = Number.isFinite(seed) ? Math.max(1, Math.round(seed)) : LSTM_DEFAULT_SEED;
  const buildKernelInitializer = (offset = 0) =>
    tf.initializers.glorotUniform({ seed: baseSeed + offset });
  const buildRecurrentInitializer = (offset = 0) =>
    tf.initializers.orthogonal({ seed: baseSeed + 100 + offset });
  const biasInitializer = tf.initializers.zeros();
  const normalizedMode = normalizeClassificationMode(classificationMode);
  const isBinary = normalizedMode === CLASSIFICATION_MODES.BINARY;

  const model = tf.sequential();
  model.add(
    tf.layers.lstm({
      units: 32,
      returnSequences: true,
      inputShape: [lookback, 1],
      kernelInitializer: buildKernelInitializer(1),
      recurrentInitializer: buildRecurrentInitializer(1),
      biasInitializer,
    }),
  );
  model.add(
    tf.layers.lstm({
      units: 16,
      kernelInitializer: buildKernelInitializer(2),
      recurrentInitializer: buildRecurrentInitializer(2),
      biasInitializer,
    }),
  );
  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelInitializer: buildKernelInitializer(3),
      biasInitializer,
    }),
  );
  model.add(
    tf.layers.dense({
      units: isBinary ? 1 : 3,
      activation: isBinary ? 'sigmoid' : 'softmax',
      kernelInitializer: buildKernelInitializer(4),
      biasInitializer,
    }),
  );
  const optimizer = tf.train.adam(learningRate);
  const loss = isBinary ? 'binaryCrossentropy' : 'categoricalCrossentropy';
  model.compile({ optimizer, loss, metrics: ['accuracy'] });
  return model;
}

function aiComputeTrainingOdds(returns, trainSize) {
  if (!Array.isArray(returns) || returns.length === 0 || trainSize <= 0) {
    return 1;
  }
  const trainReturns = returns.slice(0, trainSize);
  const wins = trainReturns.filter((value) => value > 0);
  const losses = trainReturns.filter((value) => value < 0).map((value) => Math.abs(value));
  const avgWin = wins.length > 0 ? wins.reduce((sum, value) => sum + value, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((sum, value) => sum + value, 0) / losses.length : 0;
  if (!Number.isFinite(avgWin) || avgWin <= 0 || !Number.isFinite(avgLoss) || avgLoss <= 0) {
    return 1;
  }
  return Math.max(avgWin / avgLoss, 0.25);
}

async function handleAITrainLSTMMessage(message) {
  const id = message?.id;
  if (!id) {
    return;
  }
  const payload = message?.payload || {};
  const overrides = payload.overrides || {};
  const hyper = payload.hyperparameters || {};
  const overrideSeed = Number.isFinite(overrides?.seed)
    ? Math.max(1, Math.round(overrides.seed))
    : null;
  const hyperSeed = Number.isFinite(hyper?.seed)
    ? Math.max(1, Math.round(hyper.seed))
    : null;
  const seedToUse = overrideSeed || hyperSeed || LSTM_DEFAULT_SEED;

  try {
    await ensureTF();
    if (typeof tf === 'undefined' || typeof tf.tensor !== 'function') {
      throw new Error('TensorFlow.js 尚未在背景執行緒載入，請重新整理頁面。');
    }
    if (typeof tf?.util?.seedrandom === 'function') {
      tf.util.seedrandom(seedToUse);
    }

    const dataset = payload.dataset || {};
    if (!Array.isArray(dataset.sequences) || dataset.sequences.length === 0) {
      throw new Error('缺少有效的訓練樣本。');
    }

    const volatilityThresholds = sanitizeVolatilityThresholds(dataset.volatilityThresholds);
    let volatilityDiagnostics = dataset.volatilityDiagnostics
      && typeof dataset.volatilityDiagnostics === 'object'
        ? { ...dataset.volatilityDiagnostics }
        : null;
    const classificationMode = normalizeClassificationMode(hyper.classificationMode || dataset.classificationMode);
    const isBinary = classificationMode === CLASSIFICATION_MODES.BINARY;
    const gatingThreshold = getDefaultThresholdForMode(classificationMode);

    const inferredLookback = Array.isArray(dataset.sequences[0])
      ? dataset.sequences[0].length
      : 20;
    const lookback = Math.max(
      5,
      Math.round(Number.isFinite(hyper.lookback) ? hyper.lookback : inferredLookback),
    );
    const totalSamples = Number.isFinite(hyper.totalSamples)
      ? hyper.totalSamples
      : dataset.sequences.length;
    const rawRatio = Number.isFinite(hyper.trainRatio) ? hyper.trainRatio : 0.8;
    const trainRatio = Math.min(Math.max(rawRatio, 0.6), 0.95);
    const fallbackTrainSize = Math.max(Math.floor(totalSamples * trainRatio), lookback);
    const rawTrainSize = Number.isFinite(hyper.trainSize) ? hyper.trainSize : fallbackTrainSize;
    const boundedTrainSize = Math.min(Math.max(Math.round(rawTrainSize), 1), totalSamples - 1);
    const testSize = totalSamples - boundedTrainSize;
    if (boundedTrainSize <= 0 || testSize <= 0) {
      throw new Error('訓練/測試樣本不足，請延長回測期間。');
    }

    const epochs = Math.max(1, Math.round(Number.isFinite(hyper.epochs) ? hyper.epochs : 80));
    const learningRate = Number.isFinite(hyper.learningRate) ? hyper.learningRate : 0.005;
    const rawBatchSize = Math.max(
      1,
      Math.round(Number.isFinite(hyper.batchSize) ? hyper.batchSize : 32),
    );
    const batchSize = Math.min(rawBatchSize, boundedTrainSize);

    const sequences = Array.isArray(dataset.sequences) ? dataset.sequences : [];
    const labels = Array.isArray(dataset.labels) ? dataset.labels : [];
    const labelIndices = labels.map((label) => {
      if (isBinary) {
        return label > 0 ? 1 : 0;
      }
      return Number.isInteger(label) ? Math.max(0, Math.min(2, label)) : 0;
    });
    if (labels.length !== sequences.length) {
      throw new Error('樣本與標籤數量不一致，無法訓練模型。');
    }

    const normaliser = aiComputeNormalisation(sequences, boundedTrainSize);
    const normalizedSequences = aiNormaliseSequences(sequences, normaliser);
    const tensorInput = normalizedSequences.map((seq) => seq.map((value) => [value]));
    const xAll = tf.tensor(tensorInput);
    const yAll = isBinary
      ? tf.tensor2d(labelIndices.map((value) => [value]), [labelIndices.length, 1])
      : tf.tensor2d(labelIndices.map((index) => {
        const arr = [0, 0, 0];
        arr[index] = 1;
        return arr;
      }));

    const tensorsToDispose = [xAll, yAll];
    let model = null;
    let xTrain = null;
    let yTrain = null;
    let xTest = null;
    let yTest = null;

    try {
      xTrain = xAll.slice([0, 0, 0], [boundedTrainSize, lookback, 1]);
      xTest = xAll.slice([boundedTrainSize, 0, 0], [testSize, lookback, 1]);
      if (isBinary) {
        yTrain = yAll.slice([0, 0], [boundedTrainSize, 1]);
        yTest = yAll.slice([boundedTrainSize, 0], [testSize, 1]);
      } else {
        yTrain = yAll.slice([0, 0], [boundedTrainSize, 3]);
        yTest = yAll.slice([boundedTrainSize, 0], [testSize, 3]);
      }
      tensorsToDispose.push(xTrain, yTrain, xTest, yTest);

      model = aiCreateModel(lookback, learningRate, seedToUse, classificationMode);

      aiPostProgress(id, `訓練中（共 ${epochs} 輪）...`);
      const history = await model.fit(xTrain, yTrain, {
        epochs,
        batchSize,
        shuffle: false,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const lossText = Number.isFinite(logs.loss) ? logs.loss.toFixed(4) : '—';
            const accValue = logs.acc ?? logs.accuracy;
            const accPercent = Number.isFinite(accValue)
              ? `${(accValue * 100).toFixed(2)}%`
              : '—';
            aiPostProgress(id, `訓練中（${epoch + 1}/${epochs}）Loss ${lossText} / Acc ${accPercent}`);
          },
        },
      });

      const accuracyKey = history.history.acc
        ? 'acc'
        : history.history.accuracy
          ? 'accuracy'
          : null;
      const finalTrainAccuracy = accuracyKey
        ? history.history[accuracyKey][history.history[accuracyKey].length - 1]
        : NaN;
      const finalTrainLoss = history.history.loss?.[history.history.loss.length - 1] ?? NaN;

      const evalOutput = model.evaluate(xTest, yTest);
      const evalArray = Array.isArray(evalOutput) ? evalOutput : [evalOutput];
      const evalValues = [];
      for (let i = 0; i < evalArray.length; i += 1) {
        const tensor = evalArray[i];
        const data = await tensor.data();
        evalValues.push(data[0]);
        tensor.dispose();
      }
      const testLoss = evalValues[0] ?? NaN;
      const testAccuracy = evalValues[1] ?? NaN;

      const predictionsTensor = model.predict(xTest);
      const rawPredictions = await predictionsTensor.array();
      predictionsTensor.dispose();

      const predictionArray = rawPredictions.map((row) => {
        if (isBinary) {
          const rawValue = Array.isArray(row) ? row[0] : row;
          const probUp = clampProbability(Number(rawValue));
          const probDown = clampProbability(1 - probUp);
          return [probDown, 0, probUp];
        }
        const source = Array.isArray(row) ? row : [Number(row) || 0];
        const pDown = clampProbability(source[0]);
        const pFlat = clampProbability(source[1]);
        const pUp = clampProbability(source[2]);
        const sum = pDown + pFlat + pUp;
        if (sum > 0) {
          return [pDown / sum, pFlat / sum, pUp / sum];
        }
        return [0, 0, 0];
      });

      const testLabels = labelIndices.slice(boundedTrainSize, boundedTrainSize + predictionArray.length);
      let TP = 0;
      let TN = 0;
      let FP = 0;
      let FN = 0;
      let correctPredictions = 0;
      let positivePredictions = 0;
      let positiveHits = 0;
      let positiveActuals = 0;
      const threshold = LSTM_THRESHOLD;
      const predictedLabels = predictionArray.map((row) => {
        if (!Array.isArray(row) || row.length === 0) return isBinary ? 0 : 0;
        if (isBinary) {
          return row[2] >= threshold ? 1 : 0;
        }
        let maxIndex = 0;
        let maxValue = row[0];
        for (let idx = 1; idx < row.length; idx += 1) {
          if (row[idx] > maxValue) {
            maxValue = row[idx];
            maxIndex = idx;
          }
        }
        return maxIndex;
      });
      for (let i = 0; i < predictedLabels.length; i += 1) {
        const predictedLabel = predictedLabels[i];
        const actual = isBinary ? (testLabels[i] > 0 ? 1 : 0) : testLabels[i];
        if (predictedLabel === (isBinary ? actual : actual)) {
          correctPredictions += 1;
        }
        if (isBinary) {
          if (actual === 1) positiveActuals += 1;
          if (predictedLabel === 1) {
            positivePredictions += 1;
            if (actual === 1) positiveHits += 1;
          }
          if (actual === 1 && predictedLabel === 1) TP += 1;
          else if (actual === 0 && predictedLabel === 0) TN += 1;
          else if (actual === 0 && predictedLabel === 1) FP += 1;
          else if (actual === 1 && predictedLabel === 0) FN += 1;
        } else {
          if (actual === 2) positiveActuals += 1;
          if (predictedLabel === 2) {
            positivePredictions += 1;
            if (actual === 2) positiveHits += 1;
          }
          if (actual === 2 && predictedLabel === 2) TP += 1;
          else if (actual !== 2 && predictedLabel !== 2) TN += 1;
          else if (actual !== 2 && predictedLabel === 2) FP += 1;
          else if (actual === 2 && predictedLabel !== 2) FN += 1;
        }
      }
      const positivePrecision = positivePredictions > 0 ? positiveHits / positivePredictions : NaN;
      const positiveRecall = positiveActuals > 0 ? positiveHits / positiveActuals : NaN;
      const positiveF1 = (Number.isFinite(positivePrecision)
        && Number.isFinite(positiveRecall)
        && (positivePrecision + positiveRecall) > 0)
        ? (2 * positivePrecision * positiveRecall) / (positivePrecision + positiveRecall)
        : NaN;
      const deterministicTestAccuracy = isBinary
        ? (predictedLabels.length > 0 ? correctPredictions / predictedLabels.length : NaN)
        : positivePrecision;
      const resolvedTestAccuracy = (isBinary && Number.isFinite(testAccuracy))
        ? testAccuracy
        : deterministicTestAccuracy;
      const confusion = { TP, TN, FP, FN };

      const trainingOdds = aiComputeTrainingOdds(dataset.returns, boundedTrainSize);
      const testMeta = Array.isArray(dataset.meta) ? dataset.meta.slice(boundedTrainSize) : [];
      const testReturns = Array.isArray(dataset.returns)
        ? dataset.returns.slice(boundedTrainSize)
        : [];

      let nextDayForecast = null;
      if (Array.isArray(dataset.returns) && dataset.returns.length >= lookback) {
        const tailWindow = dataset.returns.slice(dataset.returns.length - lookback);
        if (tailWindow.length === lookback) {
          const normalizedTail = tailWindow.map(
            (value) => (value - normaliser.mean) / (normaliser.std || 1),
          );
          const forecastInput = tf.tensor([normalizedTail.map((value) => [value])]);
          const forecastTensor = model.predict(forecastInput);
          const forecastArray = await forecastTensor.array();
          let forecastRow = Array.isArray(forecastArray?.[0]) ? forecastArray[0] : forecastArray?.[0];
          let forecastProbs;
          if (isBinary) {
            const rawValue = Array.isArray(forecastRow) ? forecastRow[0] : forecastRow;
            const probUp = clampProbability(Number(rawValue));
            const probDown = clampProbability(1 - probUp);
            forecastProbs = [probDown, 0, probUp];
          } else {
            const pDown = clampProbability(Array.isArray(forecastRow) ? forecastRow[0] : Number(forecastRow) || 0);
            const pFlat = clampProbability(Array.isArray(forecastRow) ? forecastRow[1] : 0);
            const pUp = clampProbability(Array.isArray(forecastRow) ? forecastRow[2] : 0);
            const sum = pDown + pFlat + pUp;
            forecastProbs = sum > 0 ? [pDown / sum, pFlat / sum, pUp / sum] : [0, 0, 0];
          }
          let forecastClass = 0;
          let forecastProb = forecastProbs[2] ?? 0;
          let maxValue = forecastProbs[0];
          for (let idx = 1; idx < forecastProbs.length; idx += 1) {
            if (forecastProbs[idx] > maxValue) {
              maxValue = forecastProbs[idx];
              forecastClass = idx;
            }
          }
          if (isBinary) {
            forecastClass = forecastProb >= LSTM_THRESHOLD ? 2 : 0;
          }
          nextDayForecast = {
            probability: forecastProb,
            referenceDate: Array.isArray(dataset.baseRows) && dataset.baseRows.length > 0
              ? dataset.baseRows[dataset.baseRows.length - 1]?.date || null
              : null,
            probabilities: forecastProbs,
            predictedClass: forecastClass,
            classificationMode,
          };
          const lastClose = Array.isArray(dataset.baseRows) && dataset.baseRows.length > 0
            ? Number(dataset.baseRows[dataset.baseRows.length - 1]?.close)
            : null;
          if (Number.isFinite(lastClose)) {
            nextDayForecast.buyPrice = lastClose;
          }
          forecastTensor.dispose();
          forecastInput.dispose();
        }
      }

      const trainRatioUsed = boundedTrainSize / totalSamples;
      const trainingMetrics = {
        trainAccuracy: finalTrainAccuracy,
        trainLoss: finalTrainLoss,
        testAccuracy: resolvedTestAccuracy,
        testLoss,
        totalPredictions: predictedLabels.length,
      };

      if (volatilityDiagnostics && typeof volatilityDiagnostics === 'object') {
        volatilityDiagnostics.expectedTrainSamples = boundedTrainSize;
      }

      const predictionsPayload = {
        predictions: predictionArray,
        meta: testMeta,
        returns: testReturns,
        trainingOdds,
        forecast: nextDayForecast,
        datasetLastDate: Array.isArray(dataset.baseRows) && dataset.baseRows.length > 0
          ? dataset.baseRows[dataset.baseRows.length - 1]?.date || null
          : null,
        lastClose: Array.isArray(dataset.baseRows) && dataset.baseRows.length > 0
          ? Number(dataset.baseRows[dataset.baseRows.length - 1]?.close) || null
          : null,
        hyperparameters: {
          lookback,
          epochs,
          batchSize,
          learningRate,
          trainRatio: trainRatioUsed,
          splitIndex: boundedTrainSize,
          threshold: gatingThreshold,
          volatility: volatilityThresholds,
          seed: seedToUse,
          classificationMode,
        },
        predictedLabels,
        volatilityThresholds,
        classificationMode,
        volatilityDiagnostics: volatilityDiagnostics ? { ...volatilityDiagnostics } : null,
      };

      const backendInUse = typeof tf.getBackend === 'function' ? tf.getBackend() : null;
      const runMeta = {
        version: LSTM_REPRO_VERSION,
        patch: LSTM_REPRO_PATCH,
        seed: seedToUse,
        backend: backendInUse,
        tfjs: TFJS_VERSION,
        lookback,
        epochs,
        batchSize,
        trainRatio: trainRatioUsed,
        splitIndex: boundedTrainSize,
        threshold: gatingThreshold,
        mean: normaliser.mean,
        std: normaliser.std,
        totalSamples,
        trainSamples: boundedTrainSize,
        testSamples: testSize,
        volatility: volatilityThresholds,
        classificationMode,
        volatilityDiagnostics: volatilityDiagnostics ? { ...volatilityDiagnostics } : null,
      };
      workerLastMeta = runMeta;

      try {
        self.postMessage({ type: LSTM_META_MESSAGE, payload: runMeta });
      } catch (metaError) {
        console.warn('[Worker][AI] 回傳 LSTM 執行資訊失敗：', metaError);
      }

      try {
        await model.save(`indexeddb://${LSTM_MODEL_STORAGE_KEY}`);
      } catch (saveError) {
        console.warn('[Worker][AI] 無法保存 LSTM 模型：', saveError);
      }

      const accuracyLabel = isBinary ? '測試正確率' : '大漲命中率';
      const accuracyText = Number.isFinite(resolvedTestAccuracy)
        ? (resolvedTestAccuracy * 100).toFixed(2)
        : '—';
      let finalMessage = `完成：${accuracyLabel} ${accuracyText}%，TP/TN/FP/FN = ${TP}/${TN}/${FP}/${FN}。`;
      if (!isBinary) {
        const precisionText = Number.isFinite(positivePrecision) ? (positivePrecision * 100).toFixed(2) : '—';
        const recallText = Number.isFinite(positiveRecall) ? (positiveRecall * 100).toFixed(2) : '—';
        const f1Text = Number.isFinite(positiveF1) ? (positiveF1 * 100).toFixed(2) : '—';
        finalMessage += `｜Precision ${precisionText}%｜Recall ${recallText}%｜F1 ${f1Text}%`;
      }

      const hyperparametersUsed = {
        lookback,
        epochs,
        batchSize,
        learningRate,
        trainRatio: trainRatioUsed,
        splitIndex: boundedTrainSize,
        threshold: gatingThreshold,
        volatility: volatilityThresholds,
        seed: seedToUse,
        modelType: MODEL_TYPES.LSTM,
        classificationMode,
      };

      aiPostResult(id, {
        trainingMetrics,
        predictionsPayload,
        confusion,
        hyperparametersUsed,
        finalMessage,
      });
    } finally {
      tensorsToDispose.forEach((tensor) => {
        if (tensor && typeof tensor.dispose === 'function') {
          tensor.dispose();
        }
      });
      if (model && typeof model.dispose === 'function') {
        model.dispose();
      }
    }
  } catch (error) {
    aiPostError(id, error);
  }
}

const ANN_TRAIN_RATIO_DEFAULT = 0.8;

function annPostProgress(id, message) {
  if (!id) return;
  self.postMessage({ type: 'ai-train-ann-progress', id, message });
}

function annPostError(id, error) {
  if (!id) return;
  const message = error instanceof Error ? error.message : String(error || 'AI Worker 發生未知錯誤');
  self.postMessage({ type: 'ai-train-ann-error', id, error: { message } });
}

function annPostResult(id, data) {
  if (!id) return;
  self.postMessage({ type: 'ai-train-ann-result', id, data });
}

function annClampTrainRatio(value) {
  if (!Number.isFinite(value)) return ANN_TRAIN_RATIO_DEFAULT;
  return Math.min(Math.max(value, 0.6), 0.95);
}

function annResolveClose(row) {
  const candidates = [
    row?.close,
    row?.adjustedClose,
    row?.adjClose,
    row?.rawClose,
    row?.baseClose,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = Number(candidates[i]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return NaN;
}

function annResolveOpen(row, fallback) {
  const candidates = [
    row?.open,
    row?.adjustedOpen,
    row?.adjOpen,
    row?.rawOpen,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = Number(candidates[i]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return Number.isFinite(fallback) && fallback > 0 ? fallback : NaN;
}

function annResolveHigh(row, fallback) {
  const value = Number(row?.high);
  if (Number.isFinite(value) && value > 0) return value;
  return fallback;
}

function annResolveLow(row, fallback) {
  const value = Number(row?.low);
  if (Number.isFinite(value) && value > 0) return value;
  return fallback;
}

function annSma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      sum = 0;
      continue;
    }
    sum += value;
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

function annWma(values, period) {
  const out = new Array(values.length).fill(null);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i += 1) {
    let numerator = 0;
    let valid = true;
    for (let k = 0; k < period; k += 1) {
      const value = values[i - k];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      numerator += (period - k) * value;
    }
    if (valid) {
      out[i] = numerator / denom;
    }
  }
  return out;
}

function annEma(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      out[i] = prev;
      continue;
    }
    if (prev == null) {
      out[i] = value;
    } else {
      out[i] = prev + k * (value - prev);
    }
    prev = out[i];
  }
  return out;
}

function annMomentum(values, period) {
  return values.map((value, index) => {
    if (index < period || !Number.isFinite(value) || !Number.isFinite(values[index - period])) {
      return null;
    }
    return value - values[index - period];
  });
}

function annHighest(values, period) {
  const out = new Array(values.length).fill(null);
  const deque = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    while (deque.length && deque[0] <= i - period) {
      deque.shift();
    }
    while (deque.length && values[deque[deque.length - 1]] <= value) {
      deque.pop();
    }
    if (Number.isFinite(value)) {
      deque.push(i);
    }
    if (i >= period - 1 && deque.length) {
      out[i] = values[deque[0]];
    }
  }
  return out;
}

function annLowest(values, period) {
  const out = new Array(values.length).fill(null);
  const deque = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    while (deque.length && deque[0] <= i - period) {
      deque.shift();
    }
    while (deque.length && values[deque[deque.length - 1]] >= value) {
      deque.pop();
    }
    if (Number.isFinite(value)) {
      deque.push(i);
    }
    if (i >= period - 1 && deque.length) {
      out[i] = values[deque[0]];
    }
  }
  return out;
}

function annStochasticKD(high, low, close, kPeriod = 14, dPeriod = 3) {
  const highestValues = annHighest(high, kPeriod);
  const lowestValues = annLowest(low, kPeriod);
  const k = close.map((value, index) => {
    if (index < kPeriod - 1) return null;
    const highValue = highestValues[index];
    const lowValue = lowestValues[index];
    if (!Number.isFinite(highValue) || !Number.isFinite(lowValue) || highValue === lowValue) return null;
    return ((value - lowValue) / (highValue - lowValue)) * 100;
  });
  const kSanitised = k.map((value) => (Number.isFinite(value) ? value : 0));
  const d = annSma(kSanitised, dPeriod).map((value, index) => (index >= kPeriod - 1 ? value : null));
  return { k, d };
}

function annRsi(close, period = 14) {
  const out = new Array(close.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < close.length; i += 1) {
    if (!Number.isFinite(close[i]) || !Number.isFinite(close[i - 1])) continue;
    const change = close[i] - close[i - 1];
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (i <= period) {
      gain += up;
      loss += down;
      if (i === period) {
        const avgGain = gain / period;
        const avgLoss = loss / period || 1e-12;
        const rs = avgGain / avgLoss;
        out[i] = 100 - (100 / (1 + rs));
      }
    } else {
      gain = ((gain * (period - 1)) + up) / period;
      loss = ((loss * (period - 1)) + down) / period;
      const rs = gain / (loss || 1e-12);
      out[i] = 100 - (100 / (1 + rs));
    }
  }
  return out;
}

function annMacd(close, fast = 12, slow = 26, signal = 9) {
  const fastEma = annEma(close, fast);
  const slowEma = annEma(close, slow);
  const diff = close.map((_, index) => {
    if (!Number.isFinite(fastEma[index]) || !Number.isFinite(slowEma[index])) return null;
    return fastEma[index] - slowEma[index];
  });
  const diffSanitised = diff.map((value) => (Number.isFinite(value) ? value : 0));
  const signalLine = annEma(diffSanitised, signal);
  const hist = diff.map((value, index) => {
    if (!Number.isFinite(value) || !Number.isFinite(signalLine[index])) return null;
    return value - signalLine[index];
  });
  return { diff, signal: signalLine, hist };
}

function annCci(high, low, close, period = 20) {
  const tp = close.map((value, index) => {
    if (!Number.isFinite(value) || !Number.isFinite(high[index]) || !Number.isFinite(low[index])) return null;
    return (high[index] + low[index] + value) / 3;
  });
  const smaTp = annSma(tp.map((value) => (Number.isFinite(value) ? value : 0)), period);
  const out = new Array(close.length).fill(null);
  for (let i = period - 1; i < close.length; i += 1) {
    if (!Number.isFinite(tp[i]) || !Number.isFinite(smaTp[i])) continue;
    let meanDeviation = 0;
    let validCount = 0;
    for (let k = 0; k < period; k += 1) {
      const idx = i - k;
      if (!Number.isFinite(tp[idx]) || !Number.isFinite(smaTp[i])) continue;
      meanDeviation += Math.abs(tp[idx] - smaTp[i]);
      validCount += 1;
    }
    const divisor = validCount > 0 ? validCount : 1;
    meanDeviation = meanDeviation / divisor;
    out[i] = (tp[i] - smaTp[i]) / (0.015 * (meanDeviation || 1e-12));
  }
  return out;
}

function annWilliamsR(high, low, close, period = 14) {
  const highestValues = annHighest(high, period);
  const lowestValues = annLowest(low, period);
  return close.map((value, index) => {
    if (index < period - 1 || !Number.isFinite(value)) return null;
    const highValue = highestValues[index];
    const lowValue = lowestValues[index];
    if (!Number.isFinite(highValue) || !Number.isFinite(lowValue) || highValue === lowValue) return null;
    return ((highValue - value) / (highValue - lowValue)) * 100;
  });
}

function annPrepareDataset(rows, volatilityOverrides = DEFAULT_VOLATILITY_THRESHOLDS, classificationOverride = CLASSIFICATION_MODES.MULTICLASS) {
  const classificationMode = normalizeClassificationMode(classificationOverride);
  const parsed = Array.isArray(rows)
    ? rows
        .filter((row) => row && typeof row.date === 'string')
        .map((row) => {
          const close = annResolveClose(row);
          return {
            date: row.date,
            close,
            open: annResolveOpen(row, close),
            high: annResolveHigh(row, close),
            low: annResolveLow(row, close),
          };
        })
        .filter((row) => Number.isFinite(row.close) && row.close > 0 && Number.isFinite(row.high) && Number.isFinite(row.low))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const close = parsed.map((row) => row.close);
  const high = parsed.map((row) => row.high);
  const low = parsed.map((row) => row.low);

  const indicatorStats = ANN_FEATURE_NAMES.map((name) => ({
    name,
    totalSamples: 0,
    finiteSamples: 0,
    min: Infinity,
    max: -Infinity,
  }));
  const classDistribution = classificationMode === CLASSIFICATION_MODES.BINARY
    ? { up: 0, down: 0 }
    : { surge: 0, flat: 0, drop: 0 };

  const ma = annSma(close, 30);
  const wma = annWma(close, 15);
  const ema = annEma(close, 12);
  const mom = annMomentum(close, 10);
  const kd = annStochasticKD(high, low, close, 14, 3);
  const rsi = annRsi(close, 14);
  const mac = annMacd(close, 12, 26, 9);
  const cci = annCci(high, low, close, 20);
  const wr = annWilliamsR(high, low, close, 14);

  const volatilityThresholds = sanitizeVolatilityThresholds(volatilityOverrides);

  const X = [];
  const y = [];
  const meta = [];
  const returns = [];
  let forecastFeature = null;
  let forecastDate = null;

  for (let i = 0; i < parsed.length; i += 1) {
    const features = [
      ma[i],
      wma[i],
      ema[i],
      mom[i],
      kd.k[i],
      kd.d[i],
      rsi[i],
      mac.diff[i],
      mac.signal[i],
      mac.hist[i],
      cci[i],
      wr[i],
    ];
    for (let f = 0; f < features.length; f += 1) {
      const stat = indicatorStats[f];
      if (!stat) continue;
      stat.totalSamples += 1;
      const value = Number(features[f]);
      if (Number.isFinite(value)) {
        stat.finiteSamples += 1;
        if (value < stat.min) stat.min = value;
        if (value > stat.max) stat.max = value;
      }
    }
    if (features.every((value) => Number.isFinite(value))) {
      forecastFeature = features.map(Number);
      forecastDate = parsed[i].date;
    }
    if (i >= parsed.length - 1) {
      continue;
    }
    if (!features.every((value) => Number.isFinite(value))) {
      continue;
    }
    const current = parsed[i];
    const next = parsed[i + 1];
    const entryTrigger = current.close;
    const nextLow = Number.isFinite(next.low) ? next.low : entryTrigger;
    const nextOpen = Number.isFinite(next.open) ? next.open : entryTrigger;
    const entryEligible = Number.isFinite(nextLow) && nextLow < entryTrigger;
    const closeEntryBuyPrice = entryEligible
      ? (Number.isFinite(nextOpen) && nextOpen < entryTrigger ? nextOpen : entryTrigger)
      : entryTrigger;
    const sellPrice = next.close;
    const closeEntryReturn = entryEligible && Number.isFinite(closeEntryBuyPrice) && closeEntryBuyPrice > 0
      ? (sellPrice - closeEntryBuyPrice) / closeEntryBuyPrice
      : 0;
    const swingReturn = Number.isFinite(next.close) && Number.isFinite(current.close) && current.close > 0
      ? (next.close - current.close) / current.close
      : NaN;
    let classLabel;
    if (classificationMode === CLASSIFICATION_MODES.BINARY) {
      classLabel = Number(closeEntryReturn > 0);
      if (classLabel === 1) classDistribution.up += 1;
      else classDistribution.down += 1;
    } else if (Number.isFinite(swingReturn)) {
      if (swingReturn >= volatilityThresholds.surge) {
        classLabel = 2;
        classDistribution.surge += 1;
      } else if (swingReturn <= -volatilityThresholds.drop) {
        classLabel = 0;
        classDistribution.drop += 1;
      } else {
        classLabel = 1;
        classDistribution.flat += 1;
      }
    } else {
      classLabel = 1;
      classDistribution.flat += 1;
    }
    const closeSameDayBuyPrice = Number.isFinite(current.close) && current.close > 0 ? current.close : NaN;
    const closeSameDayEligible = Number.isFinite(closeSameDayBuyPrice) && closeSameDayBuyPrice > 0
      && Number.isFinite(sellPrice) && sellPrice > 0;
    const closeSameDayReturn = closeSameDayEligible
      ? (sellPrice - closeSameDayBuyPrice) / closeSameDayBuyPrice
      : 0;
    const openEntryBuyPrice = Number.isFinite(nextOpen) && nextOpen > 0 ? nextOpen : entryTrigger;
    const openEntryEligible = Number.isFinite(openEntryBuyPrice) && openEntryBuyPrice > 0 && Number.isFinite(sellPrice);
    const openEntryReturn = openEntryEligible
      ? (sellPrice - openEntryBuyPrice) / openEntryBuyPrice
      : 0;
    const actualReturn = closeEntryReturn;
    X.push(features.map(Number));
    y.push(classLabel);
    meta.push({
      buyDate: current.date,
      sellDate: next.date,
      tradeDate: next.date,
      buyClose: current.close,
      sellClose: next.close,
      buyPrice: closeEntryBuyPrice,
      sellPrice,
      nextOpen,
      nextLow,
      entryEligible,
      closeEntryEligible: entryEligible,
      closeEntryBuyPrice,
      closeEntryReturn,
      openEntryEligible,
      openEntryBuyPrice,
      openEntrySellPrice: sellPrice,
      openEntryReturn,
      actualReturn,
      buyTrigger: entryTrigger,
      closeSameDayEligible,
      closeSameDayBuyPrice,
      closeSameDaySellPrice: sellPrice,
      closeSameDayReturn,
      swingReturn,
      classLabel,
    });
    returns.push(actualReturn);
  }

  const indicatorDiagnostics = indicatorStats.map((stat) => ({
    name: stat.name,
    totalSamples: stat.totalSamples,
    finiteSamples: stat.finiteSamples,
    missingSamples: Math.max(stat.totalSamples - stat.finiteSamples, 0),
    min: stat.finiteSamples > 0 ? stat.min : null,
    max: stat.finiteSamples > 0 ? stat.max : null,
    coverage: stat.totalSamples > 0 ? stat.finiteSamples / stat.totalSamples : 0,
  }));

  return {
    X,
    y,
    meta,
    returns,
    forecastFeature,
    forecastDate,
    datasetLastDate: parsed.length > 0 ? parsed[parsed.length - 1].date : null,
    datasetLastClose: parsed.length > 0 ? parsed[parsed.length - 1].close : null,
    volatilityThresholds,
    classificationMode,
    indicatorDiagnostics,
    classDistribution,
    totalParsedRows: parsed.length,
  };
}

function annStandardize(X) {
  if (!Array.isArray(X) || X.length === 0) return { Z: [], mean: [], std: [] };
  const rows = X.length;
  const cols = X[0].length;
  const mean = new Array(cols).fill(0);
  const std = new Array(cols).fill(0);
  for (let c = 0; c < cols; c += 1) {
    let sum = 0;
    for (let r = 0; r < rows; r += 1) {
      sum += X[r][c];
    }
    mean[c] = sum / rows;
  }
  for (let c = 0; c < cols; c += 1) {
    let variance = 0;
    for (let r = 0; r < rows; r += 1) {
      variance += ((X[r][c] - mean[c]) ** 2);
    }
    std[c] = Math.sqrt(variance / Math.max(1, rows - 1)) || 1;
  }
  const Z = X.map((row) => row.map((value, index) => (value - mean[index]) / (std[index] || 1)));
  return { Z, mean, std };
}

function annStandardizeVector(vector, mean, std) {
  if (!Array.isArray(vector) || !Array.isArray(mean) || !Array.isArray(std)) return null;
  return vector.map((value, index) => (value - mean[index]) / (std[index] || 1));
}

function annSplitTrainTest(Z, y, meta, returns, ratio, forcedTrainCount = null) {
  const total = Z.length;
  const computedTrainCount = Math.min(Math.max(Math.floor(total * ratio), 1), total - 1);
  const trainCount = Number.isFinite(forcedTrainCount)
    ? Math.min(Math.max(Math.round(forcedTrainCount), 1), total - 1)
    : computedTrainCount;
  return {
    Xtr: Z.slice(0, trainCount),
    ytr: y.slice(0, trainCount),
    Xte: Z.slice(trainCount),
    yte: y.slice(trainCount),
    metaTe: meta.slice(trainCount),
    returnsTe: returns.slice(trainCount),
    trainCount,
  };
}

function annOneHot(labels, numClasses = 3) {
  return labels.map((label) => {
    const index = Number.isInteger(label) ? Math.max(0, Math.min(numClasses - 1, label)) : 0;
    const arr = new Array(numClasses).fill(0);
    arr[index] = 1;
    return arr;
  });
}

// Patch Tag: LB-AI-ANNS-REPRO-20251223A — Seeded initialisers & deterministic ANN stack.
function annBuildModel(inputDim, learningRate = 0.01, seed = ANN_DEFAULT_SEED, classificationMode = CLASSIFICATION_MODES.MULTICLASS) {
  const model = tf.sequential();
  const initializerSeed = Number.isFinite(seed) ? seed : ANN_DEFAULT_SEED;
  const kernelInitializer = tf.initializers.glorotUniform({ seed: initializerSeed });
  const biasInitializer = tf.initializers.zeros();
  const normalizedMode = normalizeClassificationMode(classificationMode);
  const isBinary = normalizedMode === CLASSIFICATION_MODES.BINARY;
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    inputShape: [inputDim],
    kernelInitializer,
    biasInitializer,
  }));
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
    kernelInitializer,
    biasInitializer,
  }));
  model.add(tf.layers.dense({
    units: isBinary ? 1 : 3,
    activation: isBinary ? 'sigmoid' : 'softmax',
    kernelInitializer,
    biasInitializer,
  }));
  const optimizer = tf.train.sgd(learningRate);
  const loss = isBinary ? 'binaryCrossentropy' : 'categoricalCrossentropy';
  model.compile({ optimizer, loss, metrics: ['accuracy'] });
  return model;
}

async function annCollectLayerDiagnostics(model) {
  if (!model || !Array.isArray(model.layers)) {
    return [];
  }
  const diagnostics = [];
  for (let index = 0; index < model.layers.length; index += 1) {
    const layer = model.layers[index];
    if (!layer) continue;
    let className = null;
    try {
      className = typeof layer.getClassName === 'function' ? layer.getClassName() : null;
    } catch (error) {
      className = layer.constructor?.name || null;
    }
    let config = {};
    try {
      config = typeof layer.getConfig === 'function' ? layer.getConfig() : {};
    } catch (error) {
      config = {};
    }
    const entry = {
      index,
      name: layer.name || `layer_${index}`,
      className,
      activation: config.activation || layer.activation?.name || null,
      units: Number.isFinite(layer.units) ? layer.units : (Number.isFinite(config.units) ? config.units : null),
      outputShape: Array.isArray(layer.outputShape) ? layer.outputShape : (layer.outputShape || null),
      weightSummaries: [],
      hasNaN: false,
    };
    const weights = typeof layer.getWeights === 'function' ? layer.getWeights() : [];
    for (let w = 0; w < weights.length; w += 1) {
      const tensor = weights[w];
      if (!tensor || typeof tensor.data !== 'function') continue;
      let data;
      try {
        data = await tensor.data();
      } catch (error) {
        data = [];
      }
      let finiteCount = 0;
      let nanCount = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < data.length; i += 1) {
        const value = data[i];
        if (!Number.isFinite(value)) {
          nanCount += 1;
          continue;
        }
        finiteCount += 1;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      if (nanCount > 0) {
        entry.hasNaN = true;
      }
      entry.weightSummaries.push({
        index: w,
        size: data.length,
        finiteCount,
        nanCount,
        min: finiteCount > 0 ? min : null,
        max: finiteCount > 0 ? max : null,
      });
      if (tensor && typeof tensor.dispose === 'function') {
        tensor.dispose();
      }
    }
    diagnostics.push(entry);
  }
  return diagnostics;
}

async function handleAITrainANNMessage(message) {
  const id = message?.id;
  if (!id) {
    return;
  }
  const payload = message?.payload || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const options = payload.options || {};
  const overrides = payload.overrides || {};
  const overrideSeedRaw = Number.isFinite(overrides?.seed) ? overrides.seed : null;
  const overrideSeed = Number.isFinite(overrideSeedRaw) ? Math.max(1, Math.round(overrideSeedRaw)) : null;
  const seedToUse = Number.isFinite(overrideSeed) ? overrideSeed : ANN_DEFAULT_SEED;

  try {
    await ensureTF();
    if (typeof tf === 'undefined' || typeof tf.tensor !== 'function') {
      throw new Error('TensorFlow.js 尚未在背景執行緒載入，請重新整理頁面。');
    }
    if (typeof tf?.util?.seedrandom === 'function') {
      tf.util.seedrandom(seedToUse);
    }
    if (!Array.isArray(rows) || rows.length < 60) {
      throw new Error('資料不足（至少 60 根 K 線）');
    }

    const prepared = annPrepareDataset(rows, options.volatility, options.classificationMode);
    const classificationMode = normalizeClassificationMode(options.classificationMode || prepared.classificationMode);
    const isBinary = classificationMode === CLASSIFICATION_MODES.BINARY;
    if (!Array.isArray(prepared.X) || prepared.X.length < 40) {
      throw new Error('有效樣本不足，請延長資料範圍。');
    }

    const totalSamples = prepared.X.length;
    const trainRatio = annClampTrainRatio(options.trainRatio);
    const rawTrainCount = Math.min(Math.max(Math.floor(totalSamples * trainRatio), 1), totalSamples - 1);
    let volatilityThresholds = sanitizeVolatilityThresholds(prepared.volatilityThresholds);
    let volatilityDiagnostics = prepared.volatilityDiagnostics
      && typeof prepared.volatilityDiagnostics === 'object'
        ? { ...prepared.volatilityDiagnostics }
        : null;
    const labels = new Array(totalSamples);
    const classReturnSumsTrain = isBinary ? [0, 0] : [0, 0, 0];
    const classReturnCountsTrain = isBinary ? [0, 0] : [0, 0, 0];
    const classReturnSumsAll = isBinary ? [0, 0] : [0, 0, 0];
    const classReturnCountsAll = isBinary ? [0, 0] : [0, 0, 0];
    if (isBinary) {
      for (let i = 0; i < totalSamples; i += 1) {
        const metaItem = prepared.meta[i] || {};
        const positive = Number(metaItem?.closeEntryReturn ?? prepared.returns[i]) > 0;
        const label = positive ? 1 : 0;
        labels[i] = label;
        if (metaItem) {
          metaItem.classLabel = label;
        }
        let swingValue = Number(metaItem?.closeEntryReturn);
        if (!Number.isFinite(swingValue)) {
          swingValue = Number(prepared.returns[i]);
        }
        if (!Number.isFinite(swingValue)) {
          swingValue = Number(metaItem?.actualReturn);
        }
        if (Number.isFinite(swingValue)) {
          classReturnSumsAll[label] += swingValue;
          classReturnCountsAll[label] += 1;
          if (i < rawTrainCount) {
            classReturnSumsTrain[label] += swingValue;
            classReturnCountsTrain[label] += 1;
          }
        }
      }
    } else {
      const trainingSwings = prepared.meta
        .slice(0, rawTrainCount)
        .map((item) => Number(item?.swingReturn))
        .filter((value) => Number.isFinite(value));
      const diagnosticsPayload = {};
      volatilityThresholds = deriveVolatilityThresholdsFromReturns(trainingSwings, volatilityThresholds, diagnosticsPayload);
      diagnosticsPayload.expectedTrainSamples = trainingSwings.length;
      volatilityDiagnostics = diagnosticsPayload;
      for (let i = 0; i < totalSamples; i += 1) {
        const metaItem = prepared.meta[i] || {};
        const swingValue = Number(metaItem?.swingReturn);
        const label = classifySwingReturn(swingValue, volatilityThresholds);
        labels[i] = label;
        if (metaItem) {
          metaItem.classLabel = label;
        }
        if (Number.isFinite(swingValue)) {
          classReturnSumsAll[label] += swingValue;
          classReturnCountsAll[label] += 1;
          if (i < rawTrainCount) {
            classReturnSumsTrain[label] += swingValue;
            classReturnCountsTrain[label] += 1;
          }
        }
      }
    }
    prepared.y = labels;
    prepared.volatilityThresholds = volatilityThresholds;
    prepared.volatilityDiagnostics = volatilityDiagnostics;

    const computeClassMean = (sums, counts, index) => (counts[index] > 0 ? sums[index] / counts[index] : null);
    let classReturnAverages = null;
    if (isBinary) {
      classReturnAverages = {
        train: {
          down: computeClassMean(classReturnSumsTrain, classReturnCountsTrain, 0),
          up: computeClassMean(classReturnSumsTrain, classReturnCountsTrain, 1),
        },
        overall: {
          down: computeClassMean(classReturnSumsAll, classReturnCountsAll, 0),
          up: computeClassMean(classReturnSumsAll, classReturnCountsAll, 1),
        },
        trainCounts: { down: classReturnCountsTrain[0], up: classReturnCountsTrain[1] },
        overallCounts: { down: classReturnCountsAll[0], up: classReturnCountsAll[1] },
      };
    } else {
      classReturnAverages = {
        train: {
          drop: computeClassMean(classReturnSumsTrain, classReturnCountsTrain, 0),
          flat: computeClassMean(classReturnSumsTrain, classReturnCountsTrain, 1),
          surge: computeClassMean(classReturnSumsTrain, classReturnCountsTrain, 2),
        },
        overall: {
          drop: computeClassMean(classReturnSumsAll, classReturnCountsAll, 0),
          flat: computeClassMean(classReturnSumsAll, classReturnCountsAll, 1),
          surge: computeClassMean(classReturnSumsAll, classReturnCountsAll, 2),
        },
        trainCounts: {
          drop: classReturnCountsTrain[0],
          flat: classReturnCountsTrain[1],
          surge: classReturnCountsTrain[2],
        },
        overallCounts: {
          drop: classReturnCountsAll[0],
          flat: classReturnCountsAll[1],
          surge: classReturnCountsAll[2],
        },
      };
    }
    prepared.classReturnAverages = classReturnAverages;

    if (isBinary) {
      const updatedDistribution = { up: 0, down: 0 };
      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i] > 0 ? 1 : 0;
        if (label === 1) {
          updatedDistribution.up += 1;
        } else {
          updatedDistribution.down += 1;
        }
      }
      prepared.classDistribution = updatedDistribution;
      if (volatilityDiagnostics && typeof volatilityDiagnostics === 'object') {
        volatilityDiagnostics.datasetTotalSamples = labels.length;
        volatilityDiagnostics.datasetPositiveSamples = updatedDistribution.up;
        volatilityDiagnostics.datasetNegativeSamples = updatedDistribution.down;
        volatilityDiagnostics.classReturnAverages = classReturnAverages;
      }
    } else {
      const updatedDistribution = { surge: 0, flat: 0, drop: 0 };
      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i];
        if (label === 2) {
          updatedDistribution.surge += 1;
        } else if (label === 0) {
          updatedDistribution.drop += 1;
        } else {
          updatedDistribution.flat += 1;
        }
      }
      prepared.classDistribution = updatedDistribution;
      if (volatilityDiagnostics && typeof volatilityDiagnostics === 'object') {
        volatilityDiagnostics.datasetTotalSamples = labels.length;
        volatilityDiagnostics.datasetSurgeSamples = updatedDistribution.surge;
        volatilityDiagnostics.datasetFlatSamples = updatedDistribution.flat;
        volatilityDiagnostics.datasetDropSamples = updatedDistribution.drop;
        volatilityDiagnostics.classReturnAverages = classReturnAverages;
      }
    }

    const { Z, mean, std } = annStandardize(prepared.X);
    const split = annSplitTrainTest(Z, labels, prepared.meta, prepared.returns, trainRatio, rawTrainCount);
    if (split.Xte.length === 0) {
      throw new Error('訓練/測試樣本不足，請延長資料範圍。');
    }

    const epochs = Math.max(1, Math.round(Number.isFinite(options.epochs) ? options.epochs : 200));
    const learningRate = Number.isFinite(options.learningRate) ? options.learningRate : 0.01;
    const batchSize = split.trainCount;
    const defaultThreshold = getDefaultThresholdForMode(classificationMode);
    const threshold = Number.isFinite(options.threshold) ? options.threshold : defaultThreshold;

    const model = annBuildModel(split.Xtr[0].length, learningRate, seedToUse, classificationMode);
    const xTrain = tf.tensor2d(split.Xtr);
    let yTrain;
    let xTest;
    let yTest;
    if (isBinary) {
      const yTrainValues = split.ytr.map((label) => (label > 0 ? 1 : 0));
      const yTestValues = split.yte.map((label) => (label > 0 ? 1 : 0));
      yTrain = tf.tensor2d(yTrainValues.map((value) => [value]), [yTrainValues.length, 1]);
      xTest = tf.tensor2d(split.Xte);
      yTest = tf.tensor2d(yTestValues.map((value) => [value]), [yTestValues.length, 1]);
    } else {
      const yTrainArray = annOneHot(split.ytr, 3);
      const yTestArray = annOneHot(split.yte, 3);
      yTrain = tf.tensor2d(yTrainArray, [yTrainArray.length, 3]);
      xTest = tf.tensor2d(split.Xte);
      yTest = tf.tensor2d(yTestArray, [yTestArray.length, 3]);
    }

    const tensorsToDispose = [xTrain, yTrain, xTest, yTest];
    try {
      annPostProgress(id, `訓練中（共 ${epochs} 輪）...`);
      const history = await model.fit(xTrain, yTrain, {
        epochs,
        batchSize,
        shuffle: false,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            const lossText = Number.isFinite(logs.loss) ? logs.loss.toFixed(4) : '—';
            const accValue = logs.acc ?? logs.accuracy;
            const accPercent = Number.isFinite(accValue) ? `${(accValue * 100).toFixed(2)}%` : '—';
            annPostProgress(id, `訓練中（${epoch + 1}/${epochs}）Loss ${lossText} / Acc ${accPercent}`);
          },
        },
      });

      const accuracyKey = history.history.acc ? 'acc' : (history.history.accuracy ? 'accuracy' : null);
      const finalTrainAccuracy = accuracyKey
        ? history.history[accuracyKey][history.history[accuracyKey].length - 1]
        : NaN;
      const finalTrainLoss = history.history.loss?.[history.history.loss.length - 1] ?? NaN;

      const evalOutput = model.evaluate(xTest, yTest);
      const evalArray = Array.isArray(evalOutput) ? evalOutput : [evalOutput];
      const evalValues = [];
      for (let i = 0; i < evalArray.length; i += 1) {
        const tensor = evalArray[i];
        const data = await tensor.data();
        evalValues.push(data[0]);
        tensor.dispose();
      }
      const testLoss = evalValues[0] ?? NaN;

      const predictionsTensor = model.predict(xTest);
      const rawPredictions = await predictionsTensor.array();
      predictionsTensor.dispose();

      const predictionArray = isBinary
        ? rawPredictions.map((row) => {
          const rawValue = Array.isArray(row) ? row[0] : row;
          const probUp = Math.min(Math.max(Number(rawValue) || 0, 0), 1);
          const probDown = 1 - probUp;
          return [probDown, 0, probUp];
        })
        : rawPredictions.map((row) => (Array.isArray(row) ? row : [Number(row) || 0]));

      const predictedLabels = predictionArray.map((row) => {
        if (!Array.isArray(row) || row.length === 0) return isBinary ? 0 : 0;
        if (isBinary) {
          return row[2] >= threshold ? 1 : 0;
        }
        let maxIndex = 0;
        let maxValue = row[0];
        for (let idx = 1; idx < row.length; idx += 1) {
          if (row[idx] > maxValue) {
            maxValue = row[idx];
            maxIndex = idx;
          }
        }
        return maxIndex;
      });
      const actualLabels = split.yte.map((label) => (isBinary ? (label > 0 ? 1 : 0) : label));
      let TP = 0;
      let TN = 0;
      let FP = 0;
      let FN = 0;
      let correct = 0;
      let positivePredictions = 0;
      let positiveHits = 0;
      let positiveActuals = 0;
      for (let i = 0; i < predictedLabels.length; i += 1) {
        const predicted = predictedLabels[i];
        const actual = actualLabels[i];
        if (predicted === actual) {
          correct += 1;
        }
        if (isBinary) {
          if (actual === 1) positiveActuals += 1;
          if (predicted === 1) {
            positivePredictions += 1;
            if (actual === 1) positiveHits += 1;
          }
          if (actual === 1 && predicted === 1) TP += 1;
          else if (actual === 0 && predicted === 0) TN += 1;
          else if (actual === 0 && predicted === 1) FP += 1;
          else if (actual === 1 && predicted === 0) FN += 1;
        } else {
          if (actual === 2) positiveActuals += 1;
          if (predicted === 2) {
            positivePredictions += 1;
            if (actual === 2) positiveHits += 1;
          }
          if (actual === 2 && predicted === 2) TP += 1;
          else if (actual !== 2 && predicted !== 2) TN += 1;
          else if (actual !== 2 && predicted === 2) FP += 1;
          else if (actual === 2 && predicted !== 2) FN += 1;
        }
      }
      const deterministicTestAccuracy = isBinary
        ? (actualLabels.length > 0 ? correct / actualLabels.length : NaN)
        : (positivePredictions > 0 ? positiveHits / positivePredictions : NaN);
      const positivePrecision = positivePredictions > 0 ? positiveHits / positivePredictions : NaN;
      const positiveRecall = positiveActuals > 0 ? positiveHits / positiveActuals : NaN;
      const positiveF1 = (Number.isFinite(positivePrecision)
        && Number.isFinite(positiveRecall)
        && (positivePrecision + positiveRecall) > 0)
        ? (2 * positivePrecision * positiveRecall) / (positivePrecision + positiveRecall)
        : NaN;
      const confusion = { TP, TN, FP, FN };

      const trainingOdds = aiComputeTrainingOdds(prepared.returns, split.trainCount);
      const datasetDiagnostics = {
        totalParsedRows: Number.isFinite(prepared.totalParsedRows) ? prepared.totalParsedRows : rows.length,
        usableSamples: totalSamples,
        trainSamples: split.trainCount,
        testSamples: split.Xte.length,
        classificationMode,
        classDistribution: prepared.classDistribution ? { ...prepared.classDistribution } : null,
        indicatorDiagnostics: Array.isArray(prepared.indicatorDiagnostics)
          ? prepared.indicatorDiagnostics.map((entry) => ({ ...entry }))
          : [],
      };
      const performanceDiagnostics = {
        totalPredictions: actualLabels.length,
        positivePredictions,
        positiveHits,
        positiveActuals,
        positivePrecision,
        positiveRecall,
        positiveF1,
        confusion: { ...confusion },
        accuracyLabel: isBinary ? '測試正確率' : '大漲命中率',
      };
      const accuracyLabel = performanceDiagnostics.accuracyLabel;

      let forecast = null;
      if (Array.isArray(prepared.forecastFeature)) {
        const standardisedForecast = annStandardizeVector(prepared.forecastFeature, mean, std);
        if (Array.isArray(standardisedForecast)) {
          const forecastTensor = tf.tensor2d([standardisedForecast]);
          const forecastOutput = model.predict(forecastTensor);
          const forecastArray = await forecastOutput.array();
          const baseForecast = Array.isArray(forecastArray?.[0]) ? forecastArray[0] : [];
          let forecastProbs;
          if (isBinary) {
            const rawValue = Array.isArray(baseForecast) ? baseForecast[0] : baseForecast;
            const probUp = Math.min(Math.max(Number(rawValue) || 0, 0), 1);
            const probDown = 1 - probUp;
            forecastProbs = [probDown, 0, probUp];
          } else {
            forecastProbs = baseForecast;
          }
          let forecastClass = 0;
          let forecastProb = isBinary ? forecastProbs[2] : 0;
          if (forecastProbs.length > 0 && !isBinary) {
            let maxValue = forecastProbs[0];
            forecastClass = 0;
            for (let idx = 1; idx < forecastProbs.length; idx += 1) {
              if (forecastProbs[idx] > maxValue) {
                maxValue = forecastProbs[idx];
                forecastClass = idx;
              }
            }
            forecastProb = forecastProbs[2] ?? 0;
          } else if (isBinary) {
            forecastClass = forecastProbs[2] >= threshold ? 2 : 0;
          }
          forecast = {
            probability: forecastProb,
            referenceDate: prepared.forecastDate || prepared.datasetLastDate || null,
            probabilities: forecastProbs,
            predictedClass: forecastClass,
          };
          const forecastSwing = computeExpectedSwing(forecastProbs, classificationMode, classReturnAverages);
          if (Number.isFinite(forecastSwing)) {
            forecast.predictedSwing = forecastSwing;
          }
          if (Number.isFinite(prepared.datasetLastClose)) {
            forecast.buyPrice = prepared.datasetLastClose;
          }
          forecastOutput.dispose();
          forecastTensor.dispose();
        }
      }

      const trainingMetrics = {
        trainAccuracy: finalTrainAccuracy,
        trainLoss: finalTrainLoss,
        testAccuracy: deterministicTestAccuracy,
        testLoss,
        totalPredictions: performanceDiagnostics.totalPredictions,
      };

      const predictionsPayload = {
        predictions: predictionArray,
        meta: split.metaTe,
        returns: split.returnsTe,
        trainingOdds,
        forecast,
        datasetLastDate: prepared.datasetLastDate,
        lastClose: Number.isFinite(prepared.datasetLastClose) ? prepared.datasetLastClose : null,
        hyperparameters: {
          lookback: Number.isFinite(options.lookback) ? options.lookback : null,
          epochs,
          batchSize,
          learningRate,
          trainRatio,
          modelType: MODEL_TYPES.ANNS,
          splitIndex: split.trainCount,
          threshold,
          volatility: volatilityThresholds,
          seed: seedToUse,
          classificationMode,
        },
        predictedLabels,
        volatilityThresholds,
        classificationMode,
        volatilityDiagnostics: volatilityDiagnostics ? { ...volatilityDiagnostics } : null,
        classReturnAverages: classReturnAverages ? { ...classReturnAverages } : null,
        datasetDiagnostics,
      };

      const backendInUse = typeof tf.getBackend === 'function' ? tf.getBackend() : null;
      const layerDiagnostics = await annCollectLayerDiagnostics(model);
      const diagnostics = {
        version: ANN_DIAGNOSTIC_VERSION,
        timestamp: Date.now(),
        dataset: datasetDiagnostics,
        indicatorDiagnostics: datasetDiagnostics.indicatorDiagnostics,
        layerDiagnostics,
        performance: {
          ...performanceDiagnostics,
          trainAccuracy: finalTrainAccuracy,
          trainLoss: finalTrainLoss,
          testAccuracy: deterministicTestAccuracy,
          testLoss,
        },
        volatilityDiagnostics: volatilityDiagnostics ? { ...volatilityDiagnostics } : null,
        classReturnAverages: classReturnAverages ? { ...classReturnAverages } : null,
      };
      const runMeta = {
        version: ANN_REPRO_VERSION,
        patch: ANN_REPRO_PATCH,
        seed: seedToUse,
        backend: backendInUse,
        tfjs: TFJS_VERSION,
        trainRatio,
        epochs,
        batchSize,
        splitIndex: split.trainCount,
        threshold,
        volatility: volatilityThresholds,
        lookback: Number.isFinite(options.lookback) ? options.lookback : null,
        mean,
        std,
        featureOrder: ['SMA30', 'WMA15', 'EMA12', 'Momentum10', 'StochK14', 'StochD3', 'RSI14', 'MACDdiff', 'MACDsignal', 'MACDhist', 'CCI20', 'WilliamsR14'],
        totalSamples,
        trainSamples: split.trainCount,
        testSamples: split.Xte.length,
        classificationMode,
        volatilityDiagnostics: volatilityDiagnostics ? { ...volatilityDiagnostics } : null,
        datasetDiagnostics,
        diagnosticsVersion: ANN_DIAGNOSTIC_VERSION,
        classReturnAverages: classReturnAverages ? { ...classReturnAverages } : null,
      };
      workerLastMeta = runMeta;
      try {
        self.postMessage({ type: ANN_META_MESSAGE, payload: runMeta });
      } catch (metaError) {
        console.warn('[Worker][AI] 回傳 ANN 執行資訊失敗：', metaError);
      }

      try {
        await model.save(`indexeddb://${ANN_MODEL_STORAGE_KEY}`);
      } catch (saveError) {
        console.warn('[Worker][AI] 無法保存 ANN 模型：', saveError);
      }

      const finalMessage = `完成：${accuracyLabel} ${(Number.isFinite(deterministicTestAccuracy) ? (deterministicTestAccuracy * 100).toFixed(2) : '—')}%，TP/TN/FP/FN = ${TP}/${TN}/${FP}/${FN}。`;

      const hyperparametersUsed = {
        epochs,
        batchSize,
        learningRate,
        trainRatio,
        splitIndex: split.trainCount,
        threshold,
        volatility: volatilityThresholds,
        modelType: MODEL_TYPES.ANNS,
        lookback: Number.isFinite(options.lookback) ? options.lookback : null,
        seed: seedToUse,
        classificationMode,
      };

      annPostResult(id, { trainingMetrics, predictionsPayload, confusion, hyperparametersUsed, finalMessage, diagnostics });
      model.dispose();
    } finally {
      tensorsToDispose.forEach((tensor) => {
        if (tensor && typeof tensor.dispose === 'function') {
          tensor.dispose();
        }
      });
    }
  } catch (error) {
    annPostError(id, error);
  }
}

function differenceInDays(laterDate, earlierDate) {
  if (!(laterDate instanceof Date) || Number.isNaN(laterDate.getTime())) return null;
  if (!(earlierDate instanceof Date) || Number.isNaN(earlierDate.getTime())) return null;
  const diff = laterDate.getTime() - earlierDate.getTime();
  return Math.floor(diff / DAY_MS);
}

function isIndexSymbol(stockNo) {
  if (!stockNo) return false;
  return stockNo.startsWith('^') && stockNo.length > 1;
}

function getPrimaryForceSource(marketKey, adjusted) {
  if (marketKey === "INDEX") return "yahoo";
  if (adjusted) {
    if (marketKey === "US") return null;
    return "yahoo";
  }
  if (marketKey === "TPEX" || marketKey === "US") return "finmind";
  if (marketKey === "TWSE") return "twse";
  return null;
}

function getFallbackForceSource(marketKey, adjusted) {
  if (marketKey === "INDEX") return null;
  if (adjusted) return null;
  if (marketKey === "TPEX" || marketKey === "US") return null;
  return "finmind";
}

function getMarketKey(marketType) {
  const normalized = (marketType || "TWSE").toUpperCase();
  if (normalized === "NASDAQ" || normalized === "NYSE") return "US";
  return normalized;
}

function getPriceModeKey(adjusted) {
  return adjusted ? "ADJ" : "RAW";
}

function buildCacheKey(
  stockNo,
  startDate,
  endDate,
  adjusted = false,
  split = false,
  effectiveStartDate = null,
  marketKey = "",
) {
  const splitFlag = split ? "SPLIT" : "NOSPLIT";
  const priceModeKey = getPriceModeKey(adjusted);
  const marketPrefix = marketKey ? `${marketKey}__` : "";
  const dataKey = startDate || "START-";
  const endKey = endDate || "END-";
  const effectiveKey = effectiveStartDate || "E-";
  return `${marketPrefix}${stockNo}__${dataKey}__${endKey}__${priceModeKey}__${splitFlag}__${effectiveKey}`;
}

function filterDatasetForWindow(data, warmupStartIso, endIso) {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }
  return data.filter((row) => {
    if (!row || !row.date) {
      return false;
    }
    if (warmupStartIso && row.date < warmupStartIso) {
      return false;
    }
    if (endIso && row.date > endIso) {
      return false;
    }
    return true;
  });
}

function ensureMarketCache(marketKey) {
  if (!workerCachedStockData.has(marketKey)) {
    workerCachedStockData.set(marketKey, new Map());
  }
  return workerCachedStockData.get(marketKey);
}

function ensureMonthlyMarketCache(marketKey) {
  if (!workerMonthlyCache.has(marketKey)) {
    workerMonthlyCache.set(marketKey, new Map());
  }
  return workerMonthlyCache.get(marketKey);
}

function getMonthlyStockKey(stockNo, adjusted = false, split = false) {
  const splitFlag = split ? "SPLIT" : "NOSPLIT";
  return `${stockNo}__${getPriceModeKey(adjusted)}__${splitFlag}`;
}

function ensureMonthlyStockCache(marketKey, stockNo, adjusted = false, split = false) {
  const marketCache = ensureMonthlyMarketCache(marketKey);
  const stockKey = getMonthlyStockKey(stockNo, adjusted, split);
  if (!marketCache.has(stockKey)) {
    marketCache.set(stockKey, new Map());
  }
  return marketCache.get(stockKey);
}

function ensureYearSupersetMarketCache(marketKey) {
  if (!workerYearSupersetCache.has(marketKey)) {
    workerYearSupersetCache.set(marketKey, new Map());
  }
  return workerYearSupersetCache.get(marketKey);
}

function getYearSupersetStockKey(stockNo, priceModeKey, split = false) {
  const stockKey = (stockNo || "").toUpperCase();
  const splitFlag = split ? "SPLIT" : "NOSPLIT";
  return `${stockKey}__${priceModeKey || "RAW"}__${splitFlag}`;
}

function ensureYearSupersetStockCache(
  marketKey,
  stockNo,
  priceModeKey,
  split = false,
) {
  const marketCache = ensureYearSupersetMarketCache(marketKey);
  const stockKey = getYearSupersetStockKey(stockNo, priceModeKey, split);
  if (!marketCache.has(stockKey)) {
    marketCache.set(stockKey, new Map());
  }
  return marketCache.get(stockKey);
}

function getYearSupersetEntry(marketKey, stockNo, priceModeKey, year, split = false) {
  const stockCache = ensureYearSupersetStockCache(
    marketKey,
    stockNo,
    priceModeKey,
    split,
  );
  if (!stockCache.has(year)) {
    return null;
  }
  const entry = stockCache.get(year);
  if (!entry) return null;
  if (!Array.isArray(entry.data)) {
    entry.data = [];
  }
  if (!Array.isArray(entry.coverage)) {
    entry.coverage = [];
  }
  return entry;
}

function setYearSupersetEntry(
  marketKey,
  stockNo,
  priceModeKey,
  year,
  entry,
  split = false,
) {
  if (!entry) return;
  const stockCache = ensureYearSupersetStockCache(
    marketKey,
    stockNo,
    priceModeKey,
    split,
  );
  stockCache.set(year, entry);
}

function mergeYearSupersetRows(existingEntry, rows) {
  if (!existingEntry) return;
  if (!Array.isArray(existingEntry.data)) {
    existingEntry.data = [];
  }
  const map = new Map(existingEntry.data.map((row) => [row.date, row]));
  rows.forEach((row) => {
    if (row && row.date) {
      map.set(row.date, row);
    }
  });
  existingEntry.data = Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  rebuildCoverageFromData(existingEntry);
  existingEntry.lastUpdated = Date.now();
}

function recordYearSupersetSlices({
  marketKey,
  stockNo,
  priceModeKey,
  split = false,
  rows,
}) {
  if (!marketKey || !stockNo || !Array.isArray(rows) || rows.length === 0) {
    return;
  }
  const grouped = new Map();
  rows.forEach((row) => {
    if (!row || typeof row.date !== "string") return;
    const year = parseInt(row.date.slice(0, 4), 10);
    if (!Number.isFinite(year)) return;
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year).push(row);
  });
  grouped.forEach((yearRows, year) => {
    const entry =
      getYearSupersetEntry(marketKey, stockNo, priceModeKey, year, split) ||
      {
        data: [],
        coverage: [],
        lastUpdated: 0,
      };
    mergeYearSupersetRows(entry, yearRows);
    setYearSupersetEntry(
      marketKey,
      stockNo,
      priceModeKey,
      year,
      entry,
      split,
    );
  });
}

function rebuildCoverageFromData(entry) {
  if (!entry) return;
  const rows = Array.isArray(entry.data) ? entry.data : [];
  if (rows.length === 0) {
    entry.coverage = [];
    return;
  }
  const sortedUtc = rows
    .map((row) => (row && row.date ? isoToUTC(row.date) : NaN))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (sortedUtc.length === 0) {
    entry.coverage = [];
    return;
  }
  const segments = [];
  const MAX_GAP = DAY_MS * 6;
  let segStart = sortedUtc[0];
  let segEnd = segStart + DAY_MS;
  for (let i = 1; i < sortedUtc.length; i += 1) {
    const current = sortedUtc[i];
    if (!Number.isFinite(current)) continue;
    if (current <= segEnd + MAX_GAP) {
      if (current + DAY_MS > segEnd) {
        segEnd = current + DAY_MS;
      }
    } else {
      segments.push({ start: segStart, end: segEnd });
      segStart = current;
      segEnd = current + DAY_MS;
    }
  }
  segments.push({ start: segStart, end: segEnd });
  entry.coverage = mergeRangeBounds(segments);
}

function getMonthlyCacheEntry(marketKey, stockNo, monthKey, adjusted = false, split = false) {
  const marketCache = workerMonthlyCache.get(marketKey);
  if (!marketCache) return null;
  const stockCache = marketCache.get(getMonthlyStockKey(stockNo, adjusted, split));
  if (!stockCache) return null;
  const entry = stockCache.get(monthKey);
  if (!entry) return null;
  if (!(entry.sources instanceof Set)) {
    entry.sources = new Set(entry.sources || []);
  }
  if (!Array.isArray(entry.coverage)) {
    entry.coverage = [];
  }
  if (!Array.isArray(entry.data)) {
    entry.data = [];
  }
  rebuildCoverageFromData(entry);
  return entry;
}

function setMonthlyCacheEntry(marketKey, stockNo, monthKey, entry, adjusted = false, split = false) {
  const stockCache = ensureMonthlyStockCache(marketKey, stockNo, adjusted, split);
  if (!(entry.sources instanceof Set)) {
    entry.sources = new Set(entry.sources || []);
  }
  if (!Array.isArray(entry.coverage)) {
    entry.coverage = [];
  }
  if (!Array.isArray(entry.data)) {
    entry.data = [];
  }
  stockCache.set(monthKey, entry);
}

function isoToUTC(iso) {
  if (!iso) return NaN;
  const [y, m, d] = iso.split("-").map((val) => parseInt(val, 10));
  if ([y, m, d].some((num) => Number.isNaN(num))) return NaN;
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function utcToISO(ms) {
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function mergeRangeBounds(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function subtractRangeBounds(baseRanges, subtractRanges) {
  if (!Array.isArray(baseRanges) || baseRanges.length === 0) return [];
  if (!Array.isArray(subtractRanges) || subtractRanges.length === 0) {
    return baseRanges.map((range) => ({ ...range }));
  }
  const normalizedBase = mergeRangeBounds(
    baseRanges.map((range) => ({ ...range })),
  );
  const normalizedSubtract = mergeRangeBounds(
    subtractRanges.map((range) => ({ ...range })),
  );
  const result = [];
  normalizedBase.forEach((base) => {
    let segments = [{ ...base }];
    normalizedSubtract.forEach((sub) => {
      const nextSegments = [];
      segments.forEach((segment) => {
        if (sub.end <= segment.start || sub.start >= segment.end) {
          nextSegments.push(segment);
          return;
        }
        if (sub.start > segment.start) {
          nextSegments.push({ start: segment.start, end: Math.min(sub.start, segment.end) });
        }
        if (sub.end < segment.end) {
          nextSegments.push({ start: Math.max(sub.end, segment.start), end: segment.end });
        }
      });
      segments = nextSegments;
    });
    segments.forEach((segment) => {
      if (segment.end > segment.start) {
        result.push(segment);
      }
    });
  });
  return result;
}

function detectCoverageGapsForMonth(entry, rangeStartISO, rangeEndISO, options = {}) {
  if (!entry || !Array.isArray(entry.data)) return [];
  const toleranceDays = Number.isFinite(options.toleranceDays)
    ? Math.max(0, Math.floor(options.toleranceDays))
    : COVERAGE_GAP_TOLERANCE_DAYS;
  const startUTC = isoToUTC(rangeStartISO);
  const endUTCExclusive = isoToUTC(rangeEndISO) + DAY_MS;
  if (!Number.isFinite(startUTC) || !Number.isFinite(endUTCExclusive) || endUTCExclusive <= startUTC) {
    return [];
  }
  const rowsInRange = entry.data
    .filter(
      (row) =>
        row &&
        typeof row.date === "string" &&
        row.date >= rangeStartISO &&
        row.date <= rangeEndISO,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rowsInRange.length === 0) {
    return [{ start: startUTC, end: endUTCExclusive }];
  }
  const validRows = rowsInRange.filter((row) => Number.isFinite(row.close));
  if (validRows.length === 0) {
    return [{ start: startUTC, end: endUTCExclusive }];
  }
  const gapToleranceMs = toleranceDays * DAY_MS;
  const forcedRanges = [];

  const firstValidUTC = isoToUTC(validRows[0].date);
  if (
    Number.isFinite(firstValidUTC) &&
    firstValidUTC > startUTC &&
    firstValidUTC - startUTC > gapToleranceMs
  ) {
    forcedRanges.push({ start: startUTC, end: Math.min(firstValidUTC, endUTCExclusive) });
  }

  for (let i = 1; i < validRows.length; i += 1) {
    const prevUTCExclusive = isoToUTC(validRows[i - 1].date) + DAY_MS;
    const currentUTC = isoToUTC(validRows[i].date);
    if (
      Number.isFinite(prevUTCExclusive) &&
      Number.isFinite(currentUTC) &&
      currentUTC - prevUTCExclusive > gapToleranceMs
    ) {
      forcedRanges.push({
        start: Math.max(prevUTCExclusive, startUTC),
        end: Math.min(currentUTC, endUTCExclusive),
      });
    }
  }

  const lastValidUTCExclusive = isoToUTC(validRows[validRows.length - 1].date) + DAY_MS;
  if (
    Number.isFinite(lastValidUTCExclusive) &&
    endUTCExclusive > lastValidUTCExclusive &&
    endUTCExclusive - lastValidUTCExclusive > gapToleranceMs
  ) {
    forcedRanges.push({
      start: Math.max(lastValidUTCExclusive, startUTC),
      end: endUTCExclusive,
    });
  }

  return mergeRangeBounds(forcedRanges);
}

function addCoverage(entry, startISO, endISO) {
  if (!entry) return;
  const start = isoToUTC(startISO);
  const end = isoToUTC(endISO);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
  const newRange = { start, end: end + DAY_MS };
  const normalized = Array.isArray(entry.coverage)
    ? entry.coverage.map((range) => ({ ...range }))
    : [];
  normalized.push(newRange);
  entry.coverage = mergeRangeBounds(normalized);
}

function ensureRangeFingerprints(entry) {
  if (!entry) return [];
  if (!Array.isArray(entry.rangeFingerprints)) {
    entry.rangeFingerprints = [];
  }
  entry.rangeFingerprints = entry.rangeFingerprints
    .map((fp) => {
      if (!fp || typeof fp !== "object") return null;
      if (!fp.start || !fp.end) return null;
      return {
        start: fp.start,
        end: fp.end,
        createdAt: Number.isFinite(fp.createdAt) ? fp.createdAt : Date.now(),
      };
    })
    .filter(Boolean);
  return entry.rangeFingerprints;
}

function pruneFingerprintsForRanges(entry, ranges) {
  if (!entry || !Array.isArray(ranges) || ranges.length === 0) return;
  const list = ensureRangeFingerprints(entry);
  if (list.length === 0) return;
  const isoRanges = ranges
    .map((range) => {
      if (!range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
        return null;
      }
      const { startISO, endISO } = rangeBoundsToISO(range);
      return { startISO, endISO };
    })
    .filter(Boolean);
  if (isoRanges.length === 0) return;
  entry.rangeFingerprints = list.filter((fp) =>
    !isoRanges.some(
      (isoRange) =>
        fp.start <= isoRange.endISO && fp.end >= isoRange.startISO,
    ),
  );
}

function findFingerprintSuperset(entry, startISO, endISO) {
  const list = ensureRangeFingerprints(entry);
  return list.find((fp) => fp.start <= startISO && fp.end >= endISO) || null;
}

function addRangeFingerprint(entry, startISO, endISO) {
  if (!entry || !startISO || !endISO) return;
  const list = ensureRangeFingerprints(entry);
  if (list.some((fp) => fp.start <= startISO && fp.end >= endISO)) {
    return;
  }
  const now = Date.now();
  const updated = list.filter(
    (fp) => !(fp.start >= startISO && fp.end <= endISO),
  );
  updated.push({ start: startISO, end: endISO, createdAt: now });
  updated.sort((a, b) => {
    if (a.start === b.start) return a.end.localeCompare(b.end);
    return a.start.localeCompare(b.start);
  });
  const MAX_FINGERPRINTS = 24;
  while (updated.length > MAX_FINGERPRINTS) {
    updated.shift();
  }
  entry.rangeFingerprints = updated;
}

function computeMissingRanges(existingCoverage, targetStartISO, targetEndISO) {
  const targetStart = isoToUTC(targetStartISO);
  const targetEnd = isoToUTC(targetEndISO);
  if (
    !Number.isFinite(targetStart) ||
    !Number.isFinite(targetEnd) ||
    targetEnd < targetStart
  ) {
    return [];
  }
  const coverage = mergeRangeBounds(
    (existingCoverage || []).map((range) => ({ ...range })),
  );
  const targetEndExclusive = targetEnd + DAY_MS;
  const missing = [];
  let cursor = targetStart;
  for (let i = 0; i < coverage.length; i += 1) {
    const range = coverage[i];
    if (range.end <= cursor) continue;
    if (range.start >= targetEndExclusive) break;
    if (range.start > cursor) {
      missing.push({ start: cursor, end: Math.min(range.start, targetEndExclusive) });
    }
    cursor = Math.max(cursor, range.end);
    if (cursor >= targetEndExclusive) break;
  }
  if (cursor < targetEndExclusive) {
    missing.push({ start: cursor, end: targetEndExclusive });
  }
  return missing.filter((range) => range.end - range.start > 0);
}

function getCoveredLength(existingCoverage, targetStartISO, targetEndISO) {
  const targetStart = isoToUTC(targetStartISO);
  const targetEndExclusive = isoToUTC(targetEndISO) + DAY_MS;
  if (
    !Number.isFinite(targetStart) ||
    !Number.isFinite(targetEndExclusive) ||
    targetEndExclusive <= targetStart
  ) {
    return 0;
  }
  const coverage = mergeRangeBounds(
    (existingCoverage || []).map((range) => ({ ...range })),
  );
  let total = 0;
  for (let i = 0; i < coverage.length; i += 1) {
    const seg = coverage[i];
    const start = Math.max(seg.start, targetStart);
    const end = Math.min(seg.end, targetEndExclusive);
    if (end > start) total += end - start;
  }
  return total;
}

function rangeBoundsToISO(range) {
  const startISO = utcToISO(range.start);
  const endISO = utcToISO(range.end - DAY_MS);
  return { startISO, endISO };
}

function diffIsoDays(startISO, endISO) {
  if (!startISO || !endISO) return null;
  const startTs = Date.parse(startISO);
  const endTs = Date.parse(endISO);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return null;
  return Math.round((endTs - startTs) / DAY_MS);
}

function formatReasonCountMap(reasonCounts) {
  if (!reasonCounts || typeof reasonCounts !== "object") return "無";
  const entries = Object.entries(reasonCounts)
    .map(([reason, count]) => [reason, Number(count)])
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "無";
  return entries.map(([reason, count]) => `${reason}×${count}`).join("、");
}

function summariseDatasetRows(rows, context = {}) {
  const summary = {
    totalRows: Array.isArray(rows) ? rows.length : 0,
    firstDate: null,
    lastDate: null,
    requestedStart: context.requestedStart || null,
    effectiveStartDate: context.effectiveStartDate || null,
    warmupStartDate: context.warmupStartDate || context.dataStartDate || null,
    dataStartDate: context.dataStartDate || context.warmupStartDate || null,
    endDate: context.endDate || null,
    warmupRows: 0,
    rowsWithinRange: 0,
    firstRowOnOrAfterRequestedStart: null,
    firstRowOnOrAfterEffectiveStart: null,
    firstRowOnOrAfterWarmupStart: null,
    firstValidCloseOnOrAfterRequestedStart: null,
    firstValidCloseOnOrAfterEffectiveStart: null,
    firstValidCloseOnOrAfterWarmupStart: null,
    firstValidVolumeOnOrAfterRequestedStart: null,
    firstValidVolumeOnOrAfterWarmupStart: null,
    firstInvalidRowOnOrAfterEffectiveStart: null,
    invalidRowsInRange: { count: 0, samples: [], reasons: {} },
    firstValidCloseGapFromRequested: null,
    firstValidCloseGapFromEffective: null,
    firstValidCloseGapFromWarmup: null,
    firstValidVolumeGapFromWarmup: null,
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return summary;
  }

  summary.firstDate = rows[0]?.date || null;
  summary.lastDate = rows[rows.length - 1]?.date || null;

  const sampleLimit = 5;
  const requestedStartISO = summary.requestedStart;
  const effectiveStartISO = summary.effectiveStartDate || requestedStartISO;
  const warmupStartISO = summary.warmupStartDate || summary.dataStartDate || null;
  const warmupCutoffISO = requestedStartISO || effectiveStartISO;
  const endISO = summary.endDate || null;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || typeof row.date !== "string") continue;
    const date = row.date;
    const open = Number.isFinite(row.open) ? row.open : null;
    const high = Number.isFinite(row.high) ? row.high : null;
    const low = Number.isFinite(row.low) ? row.low : null;
    const close = Number.isFinite(row.close) ? row.close : null;
    const volume = Number.isFinite(row.volume) ? row.volume : null;
    const validClose = close !== null && close > 0;
    const validVolume = volume !== null && volume > 0;

    if (
      warmupStartISO &&
      !summary.firstRowOnOrAfterWarmupStart &&
      date >= warmupStartISO
    ) {
      summary.firstRowOnOrAfterWarmupStart = {
        date,
        index: i,
        close,
        volume,
      };
    }

    if (
      requestedStartISO &&
      !summary.firstRowOnOrAfterRequestedStart &&
      date >= requestedStartISO
    ) {
      summary.firstRowOnOrAfterRequestedStart = {
        date,
        index: i,
        close,
        volume,
      };
    }

    if (
      effectiveStartISO &&
      !summary.firstRowOnOrAfterEffectiveStart &&
      date >= effectiveStartISO
    ) {
      summary.firstRowOnOrAfterEffectiveStart = {
        date,
        index: i,
        close,
        volume,
      };
    }

    if (
      warmupStartISO &&
      !summary.firstValidCloseOnOrAfterWarmupStart &&
      date >= warmupStartISO &&
      validClose
    ) {
      summary.firstValidCloseOnOrAfterWarmupStart = {
        date,
        index: i,
        close,
      };
    }

    if (
      requestedStartISO &&
      !summary.firstValidCloseOnOrAfterRequestedStart &&
      date >= requestedStartISO &&
      validClose
    ) {
      summary.firstValidCloseOnOrAfterRequestedStart = {
        date,
        index: i,
        close,
      };
    }

    if (
      effectiveStartISO &&
      !summary.firstValidCloseOnOrAfterEffectiveStart &&
      date >= effectiveStartISO &&
      validClose
    ) {
      summary.firstValidCloseOnOrAfterEffectiveStart = {
        date,
        index: i,
        close,
      };
    }

    if (
      warmupStartISO &&
      !summary.firstValidVolumeOnOrAfterWarmupStart &&
      date >= warmupStartISO &&
      validVolume
    ) {
      summary.firstValidVolumeOnOrAfterWarmupStart = {
        date,
        index: i,
        volume,
      };
    }

    if (
      requestedStartISO &&
      !summary.firstValidVolumeOnOrAfterRequestedStart &&
      date >= requestedStartISO &&
      validVolume
    ) {
      summary.firstValidVolumeOnOrAfterRequestedStart = {
        date,
        index: i,
        volume,
      };
    }

    if (warmupCutoffISO && date < warmupCutoffISO) {
      summary.warmupRows += 1;
    }

    const withinRange =
      (!requestedStartISO || date >= requestedStartISO) &&
      (!endISO || date <= endISO);
    if (withinRange) {
      summary.rowsWithinRange += 1;
      const invalidReasons = [];
      if (!validClose) invalidReasons.push("close");
      if (open === null || open <= 0) invalidReasons.push("open");
      if (high === null || high <= 0) invalidReasons.push("high");
      if (low === null || low <= 0) invalidReasons.push("low");
      if (!validVolume) invalidReasons.push("volume");
      if (invalidReasons.length > 0) {
        summary.invalidRowsInRange.count += 1;
        invalidReasons.forEach((reason) => {
          if (!reason) return;
          const current = summary.invalidRowsInRange.reasons[reason] || 0;
          summary.invalidRowsInRange.reasons[reason] = current + 1;
        });
        if (summary.invalidRowsInRange.samples.length < sampleLimit) {
          summary.invalidRowsInRange.samples.push({
            date,
            index: i,
            reasons: invalidReasons,
            open,
            high,
            low,
            close,
            volume,
          });
        }
        if (
          effectiveStartISO &&
          !summary.firstInvalidRowOnOrAfterEffectiveStart &&
          date >= effectiveStartISO
        ) {
          summary.firstInvalidRowOnOrAfterEffectiveStart = {
            date,
            index: i,
            close,
            volume,
            reasons: invalidReasons.slice(0, 5),
          };
        }
      }
    }
  }

  if (
    requestedStartISO &&
    summary.firstValidCloseOnOrAfterRequestedStart?.date
  ) {
    summary.firstValidCloseGapFromRequested = diffIsoDays(
      requestedStartISO,
      summary.firstValidCloseOnOrAfterRequestedStart.date,
    );
  }

  if (
    effectiveStartISO &&
    summary.firstValidCloseOnOrAfterEffectiveStart?.date
  ) {
    summary.firstValidCloseGapFromEffective = diffIsoDays(
      effectiveStartISO,
      summary.firstValidCloseOnOrAfterEffectiveStart.date,
    );
  }

  if (
    warmupStartISO &&
    summary.firstValidCloseOnOrAfterWarmupStart?.date
  ) {
    summary.firstValidCloseGapFromWarmup = diffIsoDays(
      warmupStartISO,
      summary.firstValidCloseOnOrAfterWarmupStart.date,
    );
  }

  if (
    warmupStartISO &&
    summary.firstValidVolumeOnOrAfterWarmupStart?.date
  ) {
    summary.firstValidVolumeGapFromWarmup = diffIsoDays(
      warmupStartISO,
      summary.firstValidVolumeOnOrAfterWarmupStart.date,
    );
  }

  return summary;
}

function mergeMonthlyData(entry, newRows) {
  if (!entry || !Array.isArray(newRows)) return;
  const map = new Map(
    (entry.data || []).map((row) => [row.date, row]),
  );
  newRows.forEach((row) => {
    if (row && row.date) {
      map.set(row.date, row);
    }
  });
  entry.data = Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

}

function getWorkerCacheEntry(marketKey, cacheKey) {
  const marketCache = workerCachedStockData.get(marketKey);
  if (!marketCache) return null;
  const entry = marketCache.get(cacheKey);
  if (entry && Array.isArray(entry.data)) {
    workerLastDataset = entry.data;
    workerLastMeta = {
      ...entry.meta,
      marketKey,
      dataSource: entry.dataSource,
      stockName: entry.stockName,
    };
    return entry;
  }
  return null;
}

function setWorkerCacheEntry(marketKey, cacheKey, entry) {
  const marketCache = ensureMarketCache(marketKey);
  marketCache.set(cacheKey, entry);
  workerLastDataset = entry.data;
  workerLastMeta = {
    ...entry.meta,
    marketKey,
    dataSource: entry.dataSource,
    stockName: entry.stockName,
  };
}

function cloneCoverageRanges(ranges) {
  if (!Array.isArray(ranges)) return undefined;
  return ranges
    .map((range) => {
      if (!range || typeof range !== "object") return null;
      return {
        start: range.start || null,
        end: range.end || null,
      };
    })
    .filter((range) => range !== null);
}

function computeCoverageFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const sorted = rows
    .map((row) => (row && row.date ? isoToUTC(row.date) : NaN))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const tolerance = DAY_MS * 6;
  const segments = [];
  let segStart = sorted[0];
  let segEnd = segStart + DAY_MS;
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (!Number.isFinite(current)) continue;
    if (current <= segEnd + tolerance) {
      if (current + DAY_MS > segEnd) {
        segEnd = current + DAY_MS;
      }
    } else {
      segments.push({ start: utcToISO(segStart), end: utcToISO(segEnd - DAY_MS) });
      segStart = current;
      segEnd = current + DAY_MS;
    }
  }
  segments.push({ start: utcToISO(segStart), end: utcToISO(segEnd - DAY_MS) });
  return segments;
}

function computeCoverageFingerprint(coverage) {
  if (!Array.isArray(coverage) || coverage.length === 0) return null;
  const parts = coverage
    .map((range) => {
      if (!range || (!range.start && !range.end)) return null;
      const start = range.start || "";
      const end = range.end || "";
      return `${start}~${end}`;
    })
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join("|");
}

function hydrateWorkerCacheFromMainThread(options = {}) {
  const {
    stockNo,
    marketKey,
    dataStartDate,
    endDate,
    adjusted,
    splitAdjustment,
    effectiveStartDate,
    lookbackDays,
    cachedData,
    cachedMeta,
  } = options;
  if (!stockNo || !marketKey || !Array.isArray(cachedData) || cachedData.length === 0) {
    return;
  }
  const cacheKey = buildCacheKey(
    stockNo,
    dataStartDate,
    endDate,
    adjusted,
    splitAdjustment,
    effectiveStartDate,
    marketKey,
  );
  const coverage = computeCoverageFromRows(cachedData);
  const cacheEntry = {
    data: cachedData,
    stockName: cachedMeta?.stockName || stockNo,
    dataSource: cachedMeta?.dataSource || "主執行緒快取",
    timestamp: Date.now(),
    coverage,
    coverageFingerprint: computeCoverageFingerprint(coverage),
    meta: {
      stockNo,
      startDate: dataStartDate,
      dataStartDate,
      effectiveStartDate,
      endDate,
      priceMode: getPriceModeKey(adjusted),
      splitAdjustment: Boolean(splitAdjustment),
      lookbackDays,
      summary: cachedMeta?.summary || null,
      adjustments: Array.isArray(cachedMeta?.adjustments)
        ? cachedMeta.adjustments
        : [],
      priceSource: cachedMeta?.priceSource || null,
      adjustmentFallbackApplied: Boolean(cachedMeta?.adjustmentFallbackApplied),
      adjustmentFallbackInfo:
        cachedMeta?.adjustmentFallbackInfo &&
        typeof cachedMeta.adjustmentFallbackInfo === "object"
          ? cachedMeta.adjustmentFallbackInfo
          : null,
      debugSteps: Array.isArray(cachedMeta?.debugSteps) ? cachedMeta.debugSteps : [],
      diagnostics: cachedMeta?.diagnostics || null,
      finmindStatus:
        cachedMeta?.finmindStatus && typeof cachedMeta.finmindStatus === "object"
          ? cachedMeta.finmindStatus
          : null,
      splitDiagnostics:
        cachedMeta?.splitDiagnostics && typeof cachedMeta.splitDiagnostics === "object"
          ? cachedMeta.splitDiagnostics
          : null,
      coverage,
    },
  };
  setWorkerCacheEntry(marketKey, cacheKey, cacheEntry);
}

function getTodayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deriveTodayAction(evaluation) {
  if (!evaluation) {
    return { action: "no_data", label: "無法取得建議", tone: "neutral" };
  }
  if (evaluation.executedSell) {
    return { action: "exit_long", label: "做多賣出", tone: "exit" };
  }
  if (evaluation.executedCover) {
    return { action: "cover_short", label: "做空回補", tone: "exit" };
  }
  if (evaluation.executedBuy) {
    return { action: "enter_long", label: "做多買入", tone: "bullish" };
  }
  if (evaluation.executedShort) {
    return { action: "enter_short", label: "做空賣出", tone: "bearish" };
  }
  if (evaluation.longPos === 1) {
    return { action: "hold_long", label: "繼續持有多單", tone: "bullish" };
  }
  if (evaluation.shortPos === 1) {
    return { action: "hold_short", label: "繼續持有空單", tone: "bearish" };
  }
  return { action: "stay_flat", label: "維持空手", tone: "neutral" };
}

function summarisePositionFromEvaluation(evaluation, side) {
  if (!evaluation) {
    return { state: "空手", shares: 0, averagePrice: null, marketValue: null };
  }
  if (side === "long") {
    const state = evaluation.longState || (evaluation.longPos === 1 ? "持有" : "空手");
    const shares = Number.isFinite(evaluation.longShares) ? evaluation.longShares : 0;
    const averagePrice = Number.isFinite(evaluation.longAverageEntryPrice)
      ? evaluation.longAverageEntryPrice
      : null;
    const marketValue =
      Number.isFinite(evaluation.close) && shares > 0
        ? evaluation.close * shares
        : null;
    return { state, shares, averagePrice, marketValue };
  }
  const state = evaluation.shortState || (evaluation.shortPos === 1 ? "持有" : "空手");
  const shares = Number.isFinite(evaluation.shortShares) ? evaluation.shortShares : 0;
  const averagePrice = Number.isFinite(evaluation.lastShortPrice)
    ? evaluation.lastShortPrice
    : null;
  const marketValue =
    Number.isFinite(evaluation.close) && shares > 0
      ? evaluation.close * shares
      : null;
  return { state, shares, averagePrice, marketValue };
}

function prepareDiagnosticsForCacheReplay(diagnostics, options = {}) {
  const base = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  const requested = options.requestedRange || base.requested || null;
  const sourceLabel = options.source || base.replaySource || base.source || "cache-replay";
  const sanitized = {
    ...base,
    source: sourceLabel,
    replaySource: sourceLabel,
    cacheReplay: true,
    usedCache: true,
    replayedAt: Date.now(),
  };
  sanitized.requested = {
    start: requested?.start || null,
    end: requested?.end || null,
  };
  const coverage = options.coverage || base.coverage || null;
  if (coverage) {
    sanitized.coverage = cloneCoverageRanges(coverage);
  }
  if (sanitized.rangeFetch && typeof sanitized.rangeFetch === "object") {
    const rangeFetch = { ...sanitized.rangeFetch };
    rangeFetch.cacheReplay = true;
    rangeFetch.readOps = 0;
    rangeFetch.writeOps = 0;
    if (Array.isArray(rangeFetch.operations)) {
      rangeFetch.operations = [];
    }
    if (typeof rangeFetch.status === "string" && !/cache/i.test(rangeFetch.status)) {
      rangeFetch.status = `${rangeFetch.status}-cache`;
    }
    sanitized.rangeFetch = rangeFetch;
  }
  const blobInfo = base.blob && typeof base.blob === "object" ? { ...base.blob } : {};
  blobInfo.operations = [];
  blobInfo.readOps = 0;
  blobInfo.writeOps = 0;
  blobInfo.cacheReplay = true;
  if (!blobInfo.provider && sourceLabel) {
    blobInfo.provider = sourceLabel;
  }
  sanitized.blob = blobInfo;
  if (Array.isArray(base.months)) {
    sanitized.months = base.months.map((month) => ({
      ...(typeof month === "object" ? month : {}),
      operations: [],
      cacheReplay: true,
      readOps: 0,
      writeOps: 0,
    }));
  }
  if (Array.isArray(sanitized.operations)) {
    sanitized.operations = [];
  }
  return sanitized;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatTWDateWorker(twDate) {
  try {
    if (!twDate || typeof twDate !== "string") return null;
    const parts = twDate.split("/");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const yInt = parseInt(y, 10);
    const mInt = parseInt(m, 10);
    const dInt = parseInt(d, 10);
    if (Number.isNaN(yInt) || mInt < 1 || mInt > 12 || dInt < 1 || dInt > 31)
      return null;
    return `${1911 + yInt}-${pad2(mInt)}-${pad2(dInt)}`;
  } catch (e) {
    console.warn(`Worker Date Error: ${twDate}`, e);
    return null;
  }
}

function enumerateMonths(startDate, endDate) {
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= last) {
    const monthKey = `${cursor.getFullYear()}${pad2(cursor.getMonth() + 1)}`;
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const rangeStart =
      startDate > monthStart ? new Date(startDate) : monthStart;
    const rangeEnd = endDate < monthEnd ? new Date(endDate) : monthEnd;
    months.push({
      monthKey,
      label: `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`,
      rangeStart,
      rangeEnd,
      rangeStartISO: rangeStart.toISOString().split("T")[0],
      rangeEndISO: rangeEnd.toISOString().split("T")[0],
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function buildMonthSegments(months, warmupCutoffISO, options = {}) {
  if (!Array.isArray(months) || months.length === 0) {
    return [];
  }
  const warmupGroupSize = Number.isFinite(options.warmupGroupSize)
    ? Math.max(1, Math.floor(options.warmupGroupSize))
    : 3;
  const activeConcurrency = Number.isFinite(options.activeConcurrency)
    ? Math.max(1, Math.floor(options.activeConcurrency))
    : 1;
  const warmupCutoffUTC = warmupCutoffISO ? isoToUTC(warmupCutoffISO) : NaN;
  const segments = [];
  let warmupBucket = [];

  function flushWarmupBucket() {
    if (warmupBucket.length === 0) return;
    const firstLabel = warmupBucket[0]?.label || '';
    const lastLabel = warmupBucket[warmupBucket.length - 1]?.label || firstLabel;
    const segmentLabel = warmupBucket.length === 1 ? firstLabel : `${firstLabel}~${lastLabel}`;
    segments.push({
      type: 'warmup',
      label: segmentLabel,
      months: warmupBucket,
      concurrency: 1,
    });
    warmupBucket = [];
  }

  months.forEach((monthInfo) => {
    if (!monthInfo) return;
    const monthStartUTC = isoToUTC(monthInfo.rangeStartISO);
    const monthEndUTCExclusive = isoToUTC(monthInfo.rangeEndISO) + DAY_MS;
    const clonedInfo = { ...monthInfo };
    const isWarmup =
      Number.isFinite(warmupCutoffUTC) && Number.isFinite(monthStartUTC)
        ? monthStartUTC < warmupCutoffUTC
        : false;
    if (isWarmup) {
      clonedInfo.phase = 'warmup';
      warmupBucket.push(clonedInfo);
      if (
        warmupBucket.length >= warmupGroupSize ||
        (Number.isFinite(monthEndUTCExclusive) && monthEndUTCExclusive >= warmupCutoffUTC)
      ) {
        flushWarmupBucket();
      }
    } else {
      flushWarmupBucket();
      clonedInfo.phase = 'active';
      segments.push({
        type: 'active',
        label: clonedInfo.label,
        months: [clonedInfo],
        concurrency: activeConcurrency,
      });
    }
  });
  flushWarmupBucket();
  return segments;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithAdaptiveRetry(url, options = {}, attempt = 1) {
  const response = await fetch(url, options);
  if (!response.ok) {
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const backoff = Math.min(1500, 250 * Math.pow(2, attempt - 1));
      await delay(backoff);
      return fetchWithAdaptiveRetry(url, options, attempt + 1);
    }
    const bodyText = await response.text();
    throw new Error(`HTTP ${response.status}: ${bodyText?.slice(0, 120)}`);
  }
  return response.json();
}

function roundTo(value, decimals = 4) {
  if (!Number.isFinite(value)) return value;
  const power = 10 ** decimals;
  return Math.round(value * power) / power;
}

function readEventNumber(event, candidates = []) {
  if (!event || typeof event !== "object") return null;
  for (const key of candidates) {
    if (key === null || key === undefined) continue;
    if (Object.prototype.hasOwnProperty.call(event, key)) {
      const raw = event[key];
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
    const snakeKey = String(key)
      .replace(/([A-Z])/g, "_$1")
      .replace(/__+/g, "_")
      .toLowerCase();
    if (Object.prototype.hasOwnProperty.call(event, snakeKey)) {
      const raw = event[snakeKey];
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
  }
  return null;
}

function computeFallbackRatio(baseClose, components) {
  if (!Number.isFinite(baseClose) || baseClose <= 0) return 1;

  const cashDividend = Math.max(0, components.cashDividend || 0);
  const stockDividend = Math.max(0, components.stockDividend || 0);
  const stockCapitalIncrease = Math.max(0, components.stockCapitalIncrease || 0);
  const cashCapitalIncrease = Math.max(0, components.cashCapitalIncrease || 0);
  const subscriptionPrice =
    Number.isFinite(components.subscriptionPrice) && components.subscriptionPrice > 0
      ? components.subscriptionPrice
      : 0;

  const totalStockComponent = stockDividend + stockCapitalIncrease + cashCapitalIncrease;
  const denominator =
    baseClose * (1 + totalStockComponent) + cashDividend - cashCapitalIncrease * subscriptionPrice;

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 1;
  }

  const ratio = baseClose / denominator;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 1;
  }

  return ratio;
}

function findPreviousValidCloseIndex(rows, startIndex) {
  for (let i = startIndex - 1; i >= 0; i -= 1) {
    const candidate = rows[i]?.close;
    if (Number.isFinite(candidate) && candidate > 0) {
      return i;
    }
  }
  return -1;
}

function normaliseAdjustmentEvent(event) {
  if (!event || event.skipped) return null;
  const date = event.appliedDate || event.date || event.exDate || event.ex_date || null;
  if (!date) return null;
  const ratio = Number(event.ratio);
  const cashDividend = readEventNumber(event, ["cashDividend", "cash_dividend"]);
  const stockDividend = readEventNumber(event, ["stockDividend", "stock_dividend"]);
  const cashCapitalIncrease = readEventNumber(event, ["cashCapitalIncrease", "cash_capital_increase"]);
  const stockCapitalIncrease = readEventNumber(event, ["stockCapitalIncrease", "stock_capital_increase"]);
  const subscriptionPrice = readEventNumber(event, ["subscriptionPrice", "subscription_price"]);
  const hasComponent = [
    cashDividend,
    stockDividend,
    cashCapitalIncrease,
    stockCapitalIncrease,
  ].some((value) => Number.isFinite(value) && value > 0);
  if (!hasComponent && (!Number.isFinite(ratio) || ratio >= 0.999999)) {
    return null;
  }
  return {
    date,
    ratio: Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : null,
    cashDividend: Math.max(0, cashDividend || 0),
    stockDividend: Math.max(0, stockDividend || 0),
    cashCapitalIncrease: Math.max(0, cashCapitalIncrease || 0),
    stockCapitalIncrease: Math.max(0, stockCapitalIncrease || 0),
    subscriptionPrice:
      Number.isFinite(subscriptionPrice) && subscriptionPrice > 0 ? subscriptionPrice : null,
    baseClose: Number(event.baseClose ?? event.base_close),
  };
}

// Patch Tag: LB-ADJ-PIPE-20250305A
// 調整判斷邏輯：若前一交易日缺少有效的 adjustedFactor（或近似 1），
// 但事件比例顯示應存在除權息調整，則直接啟用備援縮放，
// 同時保留與原始 raw 價格的 1% 內差異判斷以避免重複調整。
function shouldUseFallbackAdjustments(rows, events) {
  for (const event of events) {
    let baseIndex = rows.findIndex((row) => row?.date >= event.date);
    if (baseIndex < 0) continue;
    let cursor = baseIndex;
    let baseClose = Number(event.baseClose);
    if (!Number.isFinite(baseClose) || baseClose <= 0) {
      while (cursor < rows.length) {
        const candidate = rows[cursor]?.close;
        if (Number.isFinite(candidate) && candidate > 0) {
          baseClose = candidate;
          break;
        }
        cursor += 1;
      }
    }
    if (!Number.isFinite(baseClose) || baseClose <= 0 || cursor <= 0) continue;
    const prevIndex = findPreviousValidCloseIndex(rows, cursor);
    if (prevIndex < 0) continue;
    const prevRow = rows[prevIndex];
    const prevClose = prevRow?.close;
    if (!Number.isFinite(prevClose) || prevClose <= 0) continue;

    let ratio = event.ratio;
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 0.999999) {
      ratio = computeFallbackRatio(baseClose, event);
    }
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 0.999999) continue;

    const factor = Number(prevRow?.adjustedFactor);
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) <= 0.001) {
      return true;
    }

    const expectedRawPrev = baseClose / ratio;
    if (!Number.isFinite(expectedRawPrev) || expectedRawPrev <= 0) {
      continue;
    }
    const approxRawPrev = prevClose / factor;
    const relativeDiff = Math.abs(approxRawPrev - expectedRawPrev) / Math.max(expectedRawPrev, 1);
    if (relativeDiff >= 0.01) {
      return true;
    }
  }
  return false;
}

function applyFallbackAdjustments(rows, events) {
  const factors = rows.map(() => 1);
  let applied = false;

  const resolveBaseValue = (row, key) => {
    if (!row || typeof row !== "object") return null;
    const camelKey = `raw${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const snakeKey = `raw_${key}`;
    const directRaw = row[camelKey];
    const direct = Number(directRaw);
    if (directRaw !== null && directRaw !== undefined && Number.isFinite(direct)) {
      return direct;
    }
    const snakeRaw = row[snakeKey];
    const snake = Number(snakeRaw);
    if (snakeRaw !== null && snakeRaw !== undefined && Number.isFinite(snake)) {
      return snake;
    }
    const baseRaw = row[key];
    const base = Number(baseRaw);
    if (baseRaw !== null && baseRaw !== undefined && Number.isFinite(base)) {
      return base;
    }
    return null;
  };

  events.forEach((event) => {
    let baseIndex = rows.findIndex((row) => row?.date >= event.date);
    if (baseIndex < 0) return;
    let cursor = baseIndex;
    let baseClose = Number(event.baseClose);
    if (!Number.isFinite(baseClose) || baseClose <= 0) {
      while (cursor < rows.length) {
        const candidate = rows[cursor]?.close;
        if (Number.isFinite(candidate) && candidate > 0) {
          baseClose = candidate;
          break;
        }
        cursor += 1;
      }
    }
    if (!Number.isFinite(baseClose) || baseClose <= 0 || cursor <= 0) return;

    let ratio = event.ratio;
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 0.999999) {
      ratio = computeFallbackRatio(baseClose, event);
    }
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 0.999999) {
      return;
    }

    for (let i = 0; i < cursor; i += 1) {
      if (!Number.isFinite(factors[i]) || factors[i] <= 0) {
        factors[i] = ratio;
      } else {
        factors[i] *= ratio;
      }
    }
    applied = true;
  });

  if (!applied) {
    return { rows, mutated: false };
  }

  const adjustedRows = rows.map((row, index) => {
    const factor = factors[index];
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) {
      const preservedFactor = Number.isFinite(row?.adjustedFactor)
        ? row.adjustedFactor
        : Number.isFinite(factor)
          ? factor
          : 1;
      return {
        ...row,
        rawOpen: resolveBaseValue(row, "open"),
        rawHigh: resolveBaseValue(row, "high"),
        rawLow: resolveBaseValue(row, "low"),
        rawClose: resolveBaseValue(row, "close"),
        adjustedFactor: preservedFactor,
      };
    }
    const baseOpen = resolveBaseValue(row, "open");
    const baseHigh = resolveBaseValue(row, "high");
    const baseLow = resolveBaseValue(row, "low");
    const baseClose = resolveBaseValue(row, "close");
    const scale = (value) =>
      value === null || value === undefined || !Number.isFinite(value) ? value : roundTo(value * factor, 4);
    return {
      ...row,
      open: scale(baseOpen),
      high: scale(baseHigh),
      low: scale(baseLow),
      close: scale(baseClose),
      rawOpen: Number.isFinite(baseOpen) ? baseOpen : row.rawOpen ?? null,
      rawHigh: Number.isFinite(baseHigh) ? baseHigh : row.rawHigh ?? null,
      rawLow: Number.isFinite(baseLow) ? baseLow : row.rawLow ?? null,
      rawClose: Number.isFinite(baseClose) ? baseClose : row.rawClose ?? null,
      adjustedFactor: factor,
    };
  });

  const mutated = adjustedRows.some((row, index) => {
    const original = rows[index];
    if (!original) return true;
    const compare = (prop) => {
      const a = row[prop];
      const b = original[prop];
      if (!Number.isFinite(a) && !Number.isFinite(b)) return false;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
      return Math.abs(a - b) > 1e-6;
    };
    return compare("open") || compare("high") || compare("low") || compare("close");
  });

  return { rows: mutated ? adjustedRows : rows, mutated };
}

// Patch Tag: LB-ADJ-PIPE-20250305A
function normaliseDividendEvent(event) {
  if (!event) return null;
  const date = event.date || event.exDate || event.ex_date || null;
  if (!date) return null;
  const cashDividend = readEventNumber(event, [
    "cashDividend",
    "cash_dividend",
  ]);
  const stockDividend = readEventNumber(event, [
    "stockDividend",
    "stock_dividend",
  ]);
  const cashCapitalIncrease = readEventNumber(event, [
    "cashCapitalIncrease",
    "cash_capital_increase",
  ]);
  const stockCapitalIncrease = readEventNumber(event, [
    "stockCapitalIncrease",
    "stock_capital_increase",
  ]);
  const subscriptionPrice = readEventNumber(event, [
    "subscriptionPrice",
    "subscription_price",
  ]);
  const hasComponent = [
    cashDividend,
    stockDividend,
    cashCapitalIncrease,
    stockCapitalIncrease,
  ].some((value) => Number.isFinite(value) && value > 0);
  if (!hasComponent) {
    return null;
  }
  return {
    date,
    ratio: null,
    cashDividend: Math.max(0, cashDividend || 0),
    stockDividend: Math.max(0, stockDividend || 0),
    cashCapitalIncrease: Math.max(0, cashCapitalIncrease || 0),
    stockCapitalIncrease: Math.max(0, stockCapitalIncrease || 0),
    subscriptionPrice:
      Number.isFinite(subscriptionPrice) && subscriptionPrice > 0
        ? subscriptionPrice
        : null,
    baseClose: Number(event.baseClose ?? event.base_close ?? null),
  };
}

function maybeApplyAdjustments(rows, adjustments, dividendEvents) {
  const result = { rows, fallbackApplied: false };
  if (!Array.isArray(rows) || rows.length === 0) return result;

  const preparedEvents = [];
  if (Array.isArray(adjustments)) {
    adjustments
      .map(normaliseAdjustmentEvent)
      .filter((event) => event && event.date)
      .forEach((event) => {
        preparedEvents.push(event);
      });
  }

  if (preparedEvents.length === 0 && Array.isArray(dividendEvents)) {
    dividendEvents
      .map(normaliseDividendEvent)
      .filter((event) => event && event.date)
      .forEach((event) => {
        preparedEvents.push(event);
      });
  }

  preparedEvents.sort((a, b) => a.date.localeCompare(b.date));

  if (preparedEvents.length === 0) {
    return result;
  }

  const fallbackNeeded = shouldUseFallbackAdjustments(rows, preparedEvents);
  if (!fallbackNeeded) {
    return result;
  }

  const { rows: adjustedRows, mutated } = applyFallbackAdjustments(rows, preparedEvents);
  if (!mutated) {
    return result;
  }

  return { rows: adjustedRows, fallbackApplied: true };
}

async function fetchAdjustedPriceRange(
  stockNo,
  startDate,
  endDate,
  marketKey,
  options = {},
) {
  const params = new URLSearchParams({
    stockNo,
    startDate,
    endDate,
    market: marketKey,
  });
  const splitEnabled = Boolean(options && options.splitAdjustment);
  if (splitEnabled) {
    params.set("split", "1");
  }
  const response = await fetch(`/api/adjusted-price/?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const rawText = await response.text();
  let payload = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    throw new Error("還原股價服務回傳格式錯誤");
  }
  if (!response.ok || payload?.error) {
    const message = payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const normalizedRows = [];
  const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  rows.forEach((row) => {
    if (!row) return;
    const isoDate = row.date || row.Date || null;
    if (!isoDate) return;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime()) || d < startDateObj || d > endDateObj) return;
    const open = toNumber(row.open ?? row.Open ?? row.Opening);
    const high = toNumber(row.high ?? row.High ?? row.max);
    const low = toNumber(row.low ?? row.Low ?? row.min);
    const close = toNumber(row.close ?? row.Close);
    const volumeRaw = toNumber(row.volume ?? row.Volume ?? row.Trading_Volume ?? 0) || 0;
    const factor = toNumber(row.adjustedFactor ?? row.adjust_factor ?? row.factor);
    const rawOpen = toNumber(
      row.rawOpen ?? row.raw_open ?? row.baseOpen ?? row.base_open ?? row.referenceOpen,
    );
    const rawHigh = toNumber(
      row.rawHigh ?? row.raw_high ?? row.baseHigh ?? row.base_high ?? row.referenceHigh,
    );
    const rawLow = toNumber(
      row.rawLow ?? row.raw_low ?? row.baseLow ?? row.base_low ?? row.referenceLow,
    );
    const rawClose = toNumber(
      row.rawClose ?? row.raw_close ?? row.baseClose ?? row.base_close ?? row.referenceClose,
    );

    const fallbackOpen = close ?? open ?? rawOpen ?? 0;
    const normalizedOpen = open ?? fallbackOpen;
    const normalizedClose = close ?? normalizedOpen;
    const normalizedHigh =
      high ?? Math.max(normalizedOpen ?? normalizedClose, normalizedClose ?? normalizedOpen);
    const normalizedLow =
      low ?? Math.min(normalizedOpen ?? normalizedClose, normalizedClose ?? normalizedOpen);

    const resolvedRawOpen = Number.isFinite(rawOpen) ? rawOpen : normalizedOpen;
    const resolvedRawHigh = Number.isFinite(rawHigh) ? rawHigh : normalizedHigh;
    const resolvedRawLow = Number.isFinite(rawLow) ? rawLow : normalizedLow;
    const resolvedRawClose = Number.isFinite(rawClose) ? rawClose : normalizedClose;
    const rowPriceSource =
      typeof row.priceSource === "string" && row.priceSource.trim().length > 0
        ? row.priceSource
        : typeof row.price_source === "string" && row.price_source.trim().length > 0
          ? row.price_source
          : null;

    normalizedRows.push({
      date: isoDate,
      open: normalizedOpen,
      high: normalizedHigh,
      low: normalizedLow,
      close: normalizedClose,
      volume: Math.round(volumeRaw / 1000),
      adjustedFactor: Number.isFinite(factor) ? factor : undefined,
      rawOpen: resolvedRawOpen,
      rawHigh: resolvedRawHigh,
      rawLow: resolvedRawLow,
      rawClose: resolvedRawClose,
      priceSource: rowPriceSource || payload?.priceSource || undefined,
    });
  });

  normalizedRows.sort((a, b) => new Date(a.date) - new Date(b.date));

  const summary = payload?.summary || null;
  const adjustments = Array.isArray(payload?.adjustments) ? payload.adjustments : [];
  const priceSource = payload?.priceSource || null;
  const debugSteps = Array.isArray(payload?.debugSteps) ? payload.debugSteps : [];
  const sourceLabel =
    payload?.dataSource ||
    (summary && Array.isArray(summary.sources) && summary.sources.length > 0
      ? summary.sources.join(" + ")
      : "Netlify 還原管線");

  const serverFallbackInfo =
    payload?.adjustmentFallback && typeof payload.adjustmentFallback === "object"
      ? payload.adjustmentFallback
      : null;
  const serverFallbackApplied = Boolean(payload?.adjustmentFallbackApplied);

  const dividendEvents = Array.isArray(payload?.dividendEvents)
    ? payload.dividendEvents
    : [];
  const dividendDiagnostics =
    payload?.dividendDiagnostics && typeof payload.dividendDiagnostics === "object"
      ? payload.dividendDiagnostics
      : null;
  const splitDiagnostics =
    payload?.splitDiagnostics && typeof payload.splitDiagnostics === "object"
      ? payload.splitDiagnostics
      : null;
  const finmindStatus =
    payload?.finmindStatus && typeof payload.finmindStatus === "object"
      ? payload.finmindStatus
      : null;
  const adjustmentDebugLog = Array.isArray(payload?.adjustmentDebugLog)
    ? payload.adjustmentDebugLog
    : [];
  const adjustmentChecks = Array.isArray(payload?.adjustmentChecks)
    ? payload.adjustmentChecks
    : [];

  const { rows: adjustedRows, fallbackApplied } = maybeApplyAdjustments(
    normalizedRows,
    adjustments,
    dividendEvents,
  );

  const finalFallbackApplied = serverFallbackApplied || fallbackApplied;

  return {
    data: adjustedRows,
    dataSource: sourceLabel,
    stockName: payload?.stockName || stockNo,
    summary,
    adjustments,
    priceSource,
    adjustmentFallbackApplied: finalFallbackApplied,
    adjustmentFallbackInfo: serverFallbackInfo,
    debugSteps,
    dividendEvents,
    dividendDiagnostics,
    splitDiagnostics,
    finmindStatus,
    adjustmentDebugLog,
    adjustmentChecks,
  };
}

function normalizeProxyRow(item, isTpex, startDateObj, endDateObj) {
  try {
    let dateStr = null;
    let open = null,
      high = null,
      low = null,
      close = null,
      volume = 0;
    if (Array.isArray(item)) {
      dateStr = item[0];
      const parseNumber = (val) => {
        if (val === null || val === undefined) return null;
        const num = Number(String(val).replace(/,/g, ""));
        return Number.isFinite(num) ? num : null;
      };
      if (isTpex) {
        volume = parseNumber(item[1]) || 0;
        open = parseNumber(item[3]);
        high = parseNumber(item[4]);
        low = parseNumber(item[5]);
        close = parseNumber(item[6]);
      } else {
        volume = parseNumber(item[1]) || 0;
        open = parseNumber(item[3]);
        high = parseNumber(item[4]);
        low = parseNumber(item[5]);
        close = parseNumber(item[6]);
      }
    } else if (item && typeof item === "object") {
      dateStr = item.date || item.Date || item.tradeDate || null;
      open = Number(item.open ?? item.Open ?? item.Opening ?? null);
      high = Number(item.high ?? item.High ?? item.max ?? null);
      low = Number(item.low ?? item.Low ?? item.min ?? null);
      close = Number(item.close ?? item.Close ?? null);
      volume = Number(item.volume ?? item.Volume ?? item.Trading_Volume ?? 0);
    } else {
      return null;
    }
    if (!dateStr) return null;
    let isoDate = null;
    const trimmed = String(dateStr).trim();
    if (/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      isoDate = formatTWDateWorker(trimmed);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      isoDate = trimmed;
    } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("/");
      isoDate = `${y}-${pad2(parseInt(m, 10))}-${pad2(parseInt(d, 10))}`;
    }
    if (!isoDate) return null;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime()) || d < startDateObj || d > endDateObj)
      return null;
    if ((open === null || open === 0) && close !== null) open = close;
    if ((high === null || high === 0) && close !== null)
      high = Math.max(open ?? close, close);
    if ((low === null || low === 0) && close !== null)
      low = Math.min(open ?? close, close);
    const clean = (val) => (val === null || Number.isNaN(val) ? null : val);
    const volNumber = Number(String(volume).replace(/,/g, "")) || 0;
    return {
      date: isoDate,
      open: clean(open),
      high: clean(high),
      low: clean(low),
      close: clean(close),
      volume: Math.round(volNumber / 1000),
    };
  } catch (error) {
    return null;
  }
}

function dedupeAndSortData(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row && row.date) map.set(row.date, row);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
}

function parseSourceLabelDescriptor(label) {
  const original = (label || '').toString().trim();
  if (!original) return null;
  let base = original;
  let extra = null;
  const match = original.match(/\(([^)]+)\)\s*$/);
  if (match) {
    extra = match[1].trim();
    base = original.slice(0, match.index).trim() || base;
  }
  const normalizedAll = original.toLowerCase();
  const typeOrder = [
    { pattern: /(瀏覽器|browser|session|local|記憶體|memory)/, type: '本地快取' },
    { pattern: /(netlify|blob)/, type: 'Blob 快取' },
    { pattern: /(proxy)/, type: 'Proxy 快取' },
    { pattern: /(cache|快取)/, type: 'Proxy 快取' },
  ];
  let resolvedType = null;
  for (let i = 0; i < typeOrder.length && !resolvedType; i += 1) {
    if (typeOrder[i].pattern.test(normalizedAll)) {
      resolvedType = typeOrder[i].type;
    }
  }
  if (!resolvedType && extra && /(cache|快取)/i.test(extra)) {
    resolvedType = 'Proxy 快取';
  }
  return {
    base: base || original,
    extra,
    type: resolvedType,
    original,
  };
}

function decorateSourceBase(descriptor) {
  if (!descriptor) return '';
  const base = descriptor.base || descriptor.original || '';
  if (!base) return '';
  if (descriptor.extra && !/^(?:cache|快取)$/i.test(descriptor.extra)) {
    return `${base}｜${descriptor.extra}`;
  }
  return base;
}

function summariseSourceDescriptors(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) return '';
  const baseOrder = [];
  const baseSeen = new Set();
  parsed.forEach((item) => {
    const decorated = decorateSourceBase(item);
    if (decorated && !baseSeen.has(decorated)) {
      baseSeen.add(decorated);
      baseOrder.push(decorated);
    }
  });

  const remoteOrder = [];
  const remoteSeen = new Set();
  parsed.forEach((item) => {
    const decorated = decorateSourceBase(item);
    if (!decorated || remoteSeen.has(decorated)) return;
    const normalizedBase = (item.base || '').toLowerCase();
    const isLocal = /(瀏覽器|browser|session|local|記憶體|memory)/.test(normalizedBase);
    const isBlob = /(netlify|blob)/.test(normalizedBase);
    const isProxy = item.type === 'Proxy 快取';
    if (!isLocal && (!item.type || isProxy) && !isBlob) {
      remoteSeen.add(decorated);
      remoteOrder.push(decorated);
    }
  });

  const suffixMap = new Map();
  parsed.forEach((item) => {
    if (!item.type) return;
    let descriptor = item.type;
    if (item.extra && !/^(?:cache|快取)$/i.test(item.extra)) {
      descriptor = `${descriptor}｜${item.extra}`;
    }
    if (!suffixMap.has(descriptor)) {
      suffixMap.set(descriptor, true);
    }
  });

  const primaryOrder = remoteOrder.length > 0 ? remoteOrder : baseOrder;
  if (primaryOrder.length === 0) return '';
  const suffixes = Array.from(suffixMap.keys());
  if (suffixes.length === 0) {
    return primaryOrder.join(' + ');
  }
  return `${primaryOrder.join(' + ')}（${suffixes.join('、')}）`;
}

function summariseDataSourceFlags(flags, defaultLabel, options = {}) {
  const entries =
    flags instanceof Set ? Array.from(flags) : Array.isArray(flags) ? flags : [];
  const parsed = entries
    .map((label) => parseSourceLabelDescriptor(label))
    .filter((item) => item && (item.base || item.original));

  const hasRemote = parsed.some((item) => {
    const normalizedBase = (item.base || '').toLowerCase();
    const isLocal = /(瀏覽器|browser|session|local|記憶體|memory)/.test(normalizedBase);
    const isBlob = /(netlify|blob)/.test(normalizedBase);
    const isProxy = item.type === 'Proxy 快取';
    return !isLocal && (!item.type || isProxy) && !isBlob;
  });

  const fallbackLabel =
    options.fallbackRemote ||
    (options.adjusted
      ? 'Yahoo Finance (還原)'
      : options.market === 'TPEX'
        ? 'FinMind (主來源)'
        : options.market === 'US'
          ? 'FinMind (主來源)'
          : defaultLabel || 'TWSE (主來源)');

  const fallbackDescriptor = parseSourceLabelDescriptor(fallbackLabel);
  const combined = parsed.slice();
  if (!hasRemote && fallbackDescriptor) {
    combined.push(fallbackDescriptor);
  }
  const summary = summariseSourceDescriptors(combined);
  return summary || (fallbackDescriptor ? summariseSourceDescriptors([fallbackDescriptor]) : '');
}

async function runWithConcurrency(items, limit, workerFn) {
  const results = new Array(items.length);
  let index = 0;
  async function runner() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await workerFn(items[currentIndex], currentIndex);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    runner(),
  );
  await Promise.all(workers);
  return results;
}

function tryResolveRangeFromYearSuperset({
  stockNo,
  startDate,
  endDate,
  marketKey,
  split = false,
  fetchDiagnostics,
  cacheKey,
  optionEffectiveStart,
  optionLookbackDays,
}) {
  if (split) return null;
  if (marketKey !== "TWSE" && marketKey !== "TPEX") return null;
  const priceModeKey = getPriceModeKey(false);
  const stockCache = ensureYearSupersetStockCache(
    marketKey,
    stockNo,
    priceModeKey,
    split,
  );
  if (!stockCache || stockCache.size === 0) return null;
  const startYear = parseInt(startDate.slice(0, 4), 10);
  const endYear = parseInt(endDate.slice(0, 4), 10);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  const combinedRows = [];
  const years = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const entry = getYearSupersetEntry(
      marketKey,
      stockNo,
      priceModeKey,
      year,
      split,
    );
    if (!entry || !Array.isArray(entry.data) || entry.data.length === 0) {
      return null;
    }
    const segmentStartISO =
      year === startYear ? startDate : `${year}-01-01`;
    const segmentEndISO =
      year === endYear ? endDate : `${year}-12-31`;
    const missing = computeMissingRanges(
      entry.coverage,
      segmentStartISO,
      segmentEndISO,
    );
    if (missing.length > 0) {
      return null;
    }
    entry.data
      .filter(
        (row) =>
          row &&
          row.date >= segmentStartISO &&
          row.date <= segmentEndISO,
      )
      .forEach((row) => combinedRows.push(row));
    years.push(year);
  }
  if (combinedRows.length === 0) return null;
  const deduped = dedupeAndSortData(combinedRows);
  if (deduped.length === 0) return null;

  const rangeFetchInfo = {
    provider: "worker-year-superset",
    market: marketKey,
    status: "hit",
    cacheHit: true,
    years,
    yearKeys: years.map(
      (year) => `${marketKey}|${stockNo.toUpperCase()}|${year}`,
    ),
    readOps: 0,
    writeOps: 0,
    rowCount: deduped.length,
  };
  fetchDiagnostics.rangeFetch = rangeFetchInfo;
  fetchDiagnostics.usedCache = true;

  const overview = summariseDatasetRows(deduped, {
    requestedStart: optionEffectiveStart || startDate,
    effectiveStartDate: optionEffectiveStart || startDate,
    warmupStartDate: startDate,
    dataStartDate: startDate,
    endDate,
  });
  fetchDiagnostics.overview = overview;
  fetchDiagnostics.gapToleranceDays = CRITICAL_START_GAP_TOLERANCE_DAYS;

  const dataSourceFlags = new Set([
    "Netlify 年度快取 (Worker Superset)",
  ]);
  const defaultRemoteLabel =
    marketKey === "TPEX" ? "FinMind (主來源)" : "TWSE (主來源)";
  const dataSourceLabel = summariseDataSourceFlags(
    dataSourceFlags,
    defaultRemoteLabel,
    { market: marketKey, adjusted: false },
  );

  fetchDiagnostics.blob = {
    provider: "worker-year-cache",
    years,
    yearKeys: rangeFetchInfo.yearKeys,
    cacheHits: years.length,
    cacheMisses: 0,
    readOps: 0,
    writeOps: 0,
    operations: [],
    cacheReplay: true,
  };

  const cacheDiagnostics = prepareDiagnosticsForCacheReplay(fetchDiagnostics, {
    source: "worker-year-superset",
    requestedRange: { start: startDate, end: endDate },
    coverage: null,
  });

  const cacheEntry = {
    data: deduped,
    stockName: stockNo,
    dataSource: dataSourceLabel,
    timestamp: Date.now(),
    meta: {
      stockNo,
      startDate,
      dataStartDate: startDate,
      effectiveStartDate: optionEffectiveStart,
      endDate,
      priceMode: priceModeKey,
      splitAdjustment: split,
      lookbackDays: optionLookbackDays,
      fetchRange: { start: startDate, end: endDate },
      diagnostics: cacheDiagnostics,
      rangeCache: {
        provider: "worker-year-superset",
        years,
      },
    },
    priceMode: priceModeKey,
  };
  setWorkerCacheEntry(marketKey, cacheKey, cacheEntry);

  return {
    data: deduped,
    dataSource: dataSourceLabel,
    stockName: stockNo,
    fetchRange: { start: startDate, end: endDate },
    dataStartDate: startDate,
    effectiveStartDate: optionEffectiveStart,
    lookbackDays: optionLookbackDays,
    diagnostics: fetchDiagnostics,
  };
}

function addDaysIso(isoDate, days) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const base = new Date(isoDate);
  if (Number.isNaN(base.getTime())) return null;
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().split("T")[0];
}

async function fetchCurrentMonthGapPatch({
  stockNo,
  marketKey,
  gapStartISO,
  gapEndISO,
  startDateObj,
  endDateObj,
  primaryForceSource,
  fallbackForceSource,
}) {
  const patchInfo = {
    status: "skipped",
    start: gapStartISO,
    end: gapEndISO,
    months: [],
    sources: [],
    attempts: [],
    rows: 0,
  };
  if (!gapStartISO || !gapEndISO) {
    patchInfo.status = "invalid-range";
    return { diagnostics: patchInfo, rows: [] };
  }

  const startObj = new Date(gapStartISO);
  const endObj = new Date(gapEndISO);
  if (
    Number.isNaN(startObj.getTime()) ||
    Number.isNaN(endObj.getTime()) ||
    startObj > endObj
  ) {
    patchInfo.status = "invalid-range";
    return { diagnostics: patchInfo, rows: [] };
  }

  const months = enumerateMonths(startObj, endObj);
  if (!Array.isArray(months) || months.length === 0) {
    patchInfo.status = "no-month";
    return { diagnostics: patchInfo, rows: [] };
  }

  let proxyPath = "/api/twse/";
  if (marketKey === "TPEX") proxyPath = "/api/tpex/";
  else if (marketKey === "INDEX") proxyPath = "/api/index/";
  const isTpex = marketKey === "TPEX";
  const aggregatedRows = [];
  const aggregatedSources = new Set();
  patchInfo.status = "pending";
  const startedAt = Date.now();

  for (let m = 0; m < months.length; m += 1) {
    const monthInfo = months[m];
    const monthStartISO = monthInfo.rangeStartISO > gapStartISO
      ? monthInfo.rangeStartISO
      : gapStartISO;
    const monthEndISO = monthInfo.rangeEndISO < gapEndISO
      ? monthInfo.rangeEndISO
      : gapEndISO;
    patchInfo.months.push({
      month: monthInfo.monthKey,
      start: monthStartISO,
      end: monthEndISO,
    });

    const candidateSources = [null];
    if (primaryForceSource) candidateSources.push(primaryForceSource);
    if (
      fallbackForceSource &&
      fallbackForceSource !== primaryForceSource
    ) {
      candidateSources.push(fallbackForceSource);
    }

    let payload = null;
    let lastError = null;
    for (let c = 0; c < candidateSources.length; c += 1) {
      const forceSource = candidateSources[c];
      const params = new URLSearchParams({
        stockNo,
        month: monthInfo.monthKey,
        start: monthStartISO,
        end: monthEndISO,
      });
      if (forceSource) {
        params.set("forceSource", forceSource);
        params.set(
          "cacheBust",
          `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        );
      }
      const attempt = {
        month: monthInfo.monthKey,
        source: forceSource || "auto",
        url: `${proxyPath}?${params.toString()}`,
        success: false,
        error: null,
      };
      try {
        const responsePayload = await fetchWithAdaptiveRetry(attempt.url, {
          headers: { Accept: "application/json" },
        });
        if (responsePayload?.error) {
          throw new Error(responsePayload.error);
        }
        payload = responsePayload;
        attempt.success = true;
        if (forceSource) {
          aggregatedSources.add(`force:${forceSource}`);
        }
        break;
      } catch (error) {
        lastError = error;
        attempt.error = error?.message || String(error);
        payload = null;
      } finally {
        patchInfo.attempts.push(attempt);
      }
    }

    if (!payload) {
      if (lastError) {
        console.warn(
          `[Worker] ${stockNo} ${monthInfo.monthKey} ${monthStartISO}~${monthEndISO} 當月缺口補抓失敗：`,
          lastError,
        );
      }
      // 若該月份缺口抓取失敗，進入下一個月份
      continue;
    }

    if (payload?.stockName) {
      aggregatedSources.add(`name:${payload.stockName}`);
    }
    const rows = Array.isArray(payload?.aaData)
      ? payload.aaData
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    rows.forEach((row) => {
      const normalized = normalizeProxyRow(
        row,
        isTpex,
        startDateObj,
        endDateObj,
      );
      if (
        normalized &&
        normalized.date &&
        normalized.date >= gapStartISO &&
        normalized.date <= gapEndISO
      ) {
        aggregatedRows.push(normalized);
      }
    });
    if (typeof payload?.dataSource === "string" && payload.dataSource) {
      aggregatedSources.add(payload.dataSource);
    }
  }

  const dedupedRows = dedupeAndSortData(aggregatedRows);
  patchInfo.rows = dedupedRows.length;
  patchInfo.sources = Array.from(aggregatedSources);
  patchInfo.durationMs = Date.now() - startedAt;
  patchInfo.status = dedupedRows.length > 0 ? "success" : "no-data";

  return { diagnostics: patchInfo, rows: dedupedRows };
}

async function tryFetchRangeFromBlob({
  stockNo,
  startDate,
  endDate,
  marketKey,
  startDateObj,
  endDateObj,
  optionEffectiveStart,
  optionLookbackDays,
  primaryForceSource,
  fallbackForceSource,
  fetchDiagnostics,
  cacheKey,
  split,
}) {
  if (marketKey !== "TWSE" && marketKey !== "TPEX") {
    return null;
  }

  const rangeFetchInfo = {
    provider: "netlify-blob-range",
    market: marketKey,
    status: "pending",
    cacheHit: false,
    years: [],
    yearKeys: [],
    readOps: 0,
    writeOps: 0,
  };
  fetchDiagnostics.rangeFetch = rangeFetchInfo;

  const params = new URLSearchParams({
    stockNo,
    startDate,
    endDate,
    marketType: marketKey,
  });
  const requestUrl = `/.netlify/functions/stock-range?${params.toString()}`;
  const startedAt = Date.now();
  rangeFetchInfo.timeoutMs = NETLIFY_BLOB_RANGE_TIMEOUT_MS;
  let response;
  let abortTimer = null;
  let controller = null;
  if (typeof AbortController === "function") {
    controller = new AbortController();
    abortTimer = setTimeout(() => {
      try {
        controller.abort();
      } catch (abortError) {
        console.warn(
          `[Worker] Netlify Blob 範圍逾時控制失敗 (${stockNo})：`,
          abortError,
        );
      }
    }, NETLIFY_BLOB_RANGE_TIMEOUT_MS);
  }
  try {
    const fetchOptions = { headers: { Accept: "application/json" } };
    if (controller && abortTimer) {
      fetchOptions.signal = controller.signal;
    }
    response = await fetch(requestUrl, fetchOptions);
  } catch (error) {
    if (abortTimer) clearTimeout(abortTimer);
    if (controller && error?.name === "AbortError") {
      rangeFetchInfo.status = "timeout";
      rangeFetchInfo.error = "timeout";
      rangeFetchInfo.durationMs = Date.now() - startedAt;
      console.warn(
        `[Worker] Netlify Blob 範圍請求逾時 (${stockNo})，改用 Proxy 逐月補抓。`,
      );
      return null;
    }
    rangeFetchInfo.status = "network-error";
    rangeFetchInfo.error = error?.message || String(error);
    rangeFetchInfo.durationMs = Date.now() - startedAt;
    console.warn(
      `[Worker] Netlify Blob 範圍請求失敗 (${stockNo})：`,
      error,
    );
    return null;
  }
  if (abortTimer) clearTimeout(abortTimer);

  rangeFetchInfo.httpStatus = response.status;
  if (!response.ok) {
    rangeFetchInfo.status = "http-error";
    rangeFetchInfo.error = `HTTP ${response.status}`;
    rangeFetchInfo.durationMs = Date.now() - startedAt;
    console.warn(
      `[Worker] Netlify Blob 範圍 HTTP ${response.status} (${stockNo})，改用 Proxy 逐月補抓。`,
    );
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    rangeFetchInfo.status = "parse-error";
    rangeFetchInfo.error = error?.message || String(error);
    rangeFetchInfo.durationMs = Date.now() - startedAt;
    console.warn(
      `[Worker] Netlify Blob 範圍回應解析失敗 (${stockNo})：`,
      error,
    );
    return null;
  }

  if (!payload || !Array.isArray(payload.aaData)) {
    rangeFetchInfo.status = "invalid-payload";
    rangeFetchInfo.error = "Missing aaData";
    rangeFetchInfo.durationMs = Date.now() - startedAt;
    console.warn(
      `[Worker] Netlify Blob 範圍回應缺少 aaData (${stockNo})，改用 Proxy 逐月補抓。`,
    );
    return null;
  }

  const normalizedRows = payload.aaData
    .map((row) =>
      normalizeProxyRow(row, marketKey === "TPEX", startDateObj, endDateObj),
    )
    .filter(Boolean);
  if (normalizedRows.length === 0) {
    rangeFetchInfo.status = "empty";
    rangeFetchInfo.durationMs = Date.now() - startedAt;
    console.warn(
      `[Worker] Netlify Blob 範圍回應為空 (${stockNo})，改用 Proxy 逐月補抓。`,
    );
    return null;
  }

  let deduped = dedupeAndSortData(normalizedRows);
  if (deduped.length === 0) {
    rangeFetchInfo.status = "empty";
    rangeFetchInfo.durationMs = Date.now() - startedAt;
    console.warn(
      `[Worker] Netlify Blob 範圍排序後仍無資料 (${stockNo})，改用 Proxy 逐月補抓。`,
    );
    return null;
  }

  let firstDate = deduped[0]?.date || null;
  let lastDate = deduped[deduped.length - 1]?.date || null;
  let firstDateObj = firstDate ? new Date(firstDate) : null;
  let lastDateObj = lastDate ? new Date(lastDate) : null;
  let startGapRaw = firstDateObj
    ? differenceInDays(firstDateObj, startDateObj)
    : null;
  let endGapRaw = lastDateObj ? differenceInDays(endDateObj, lastDateObj) : null;
  let startGap = Number.isFinite(startGapRaw) ? Math.max(0, startGapRaw) : null;
  let endGap = Number.isFinite(endGapRaw) ? Math.max(0, endGapRaw) : null;

  const blobMeta = payload?.meta || {};
  rangeFetchInfo.years = Array.isArray(blobMeta.years) ? blobMeta.years : [];
  rangeFetchInfo.yearKeys = Array.isArray(blobMeta.yearKeys) ? blobMeta.yearKeys : [];
  rangeFetchInfo.readOps = Number(blobMeta.readOps) || 0;
  rangeFetchInfo.writeOps = Number(blobMeta.writeOps) || 0;
  rangeFetchInfo.cacheHit = Number(blobMeta.cacheMisses || 0) === 0;
  rangeFetchInfo.rowCount = deduped.length;
  rangeFetchInfo.startGapDays = Number.isFinite(startGap) ? startGap : null;
  rangeFetchInfo.endGapDays = Number.isFinite(endGap) ? endGap : null;
  rangeFetchInfo.durationMs = Date.now() - startedAt;
  rangeFetchInfo.dataSource = payload?.dataSource || null;
  rangeFetchInfo.firstDate = firstDate;
  rangeFetchInfo.lastDate = lastDate;

  const now = new Date();
  const todayUtcYear = now.getUTCFullYear();
  const todayUtcMonth = now.getUTCMonth();
  const todayUtcDate = now.getUTCDate();
  const todayUtcMs = Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDate);
  const endUtcYear = endDateObj.getUTCFullYear();
  const endUtcMonth = endDateObj.getUTCMonth();
  const isCurrentMonthRequest =
    endUtcYear === todayUtcYear && endUtcMonth === todayUtcMonth;
  let targetLatestISO = null;
  let currentMonthGapDays = null;
  if (isCurrentMonthRequest) {
    const targetLatestMs = Math.min(endDateObj.getTime(), todayUtcMs);
    const targetLatestDate = new Date(targetLatestMs);
    targetLatestISO = targetLatestDate.toISOString().split("T")[0];
    if (lastDate) {
      if (lastDate < targetLatestISO) {
        const targetLatestObj = new Date(targetLatestISO);
        const lastDateObjForGap = new Date(lastDate);
        const gapDays = differenceInDays(targetLatestObj, lastDateObjForGap);
        currentMonthGapDays = Number.isFinite(gapDays) ? Math.max(0, gapDays) : null;
      } else {
        currentMonthGapDays = 0;
      }
    }
  }
  let normalizedCurrentMonthGap = Number.isFinite(currentMonthGapDays)
    ? currentMonthGapDays
    : null;
  rangeFetchInfo.currentMonthGuard = isCurrentMonthRequest;
  rangeFetchInfo.targetLatestDate = targetLatestISO;
  rangeFetchInfo.currentMonthGapDays = normalizedCurrentMonthGap;

  if (
    isCurrentMonthRequest &&
    Number.isFinite(normalizedCurrentMonthGap) &&
    normalizedCurrentMonthGap > 0
  ) {
    const patchStartISO = lastDate ? addDaysIso(lastDate, 1) : targetLatestISO;
    const patchResult = await fetchCurrentMonthGapPatch({
      stockNo,
      marketKey,
      gapStartISO: patchStartISO,
      gapEndISO: targetLatestISO,
      startDateObj,
      endDateObj,
      primaryForceSource,
      fallbackForceSource,
    });
    rangeFetchInfo.patch = patchResult.diagnostics || {
      status: "unknown",
      start: patchStartISO,
      end: targetLatestISO,
    };
    fetchDiagnostics.patch = rangeFetchInfo.patch;
    if (Array.isArray(patchResult.rows) && patchResult.rows.length > 0) {
      deduped = dedupeAndSortData(deduped.concat(patchResult.rows));
      firstDate = deduped[0]?.date || null;
      lastDate = deduped[deduped.length - 1]?.date || null;
      firstDateObj = firstDate ? new Date(firstDate) : null;
      lastDateObj = lastDate ? new Date(lastDate) : null;
      startGapRaw = firstDateObj
        ? differenceInDays(firstDateObj, startDateObj)
        : null;
      endGapRaw = lastDateObj ? differenceInDays(endDateObj, lastDateObj) : null;
      startGap = Number.isFinite(startGapRaw) ? Math.max(0, startGapRaw) : null;
      endGap = Number.isFinite(endGapRaw) ? Math.max(0, endGapRaw) : null;
      if (targetLatestISO && lastDate) {
        if (lastDate < targetLatestISO) {
          const targetLatestObj = new Date(targetLatestISO);
          const lastDateObjForGap = new Date(lastDate);
          const gapDays = differenceInDays(targetLatestObj, lastDateObjForGap);
          currentMonthGapDays = Number.isFinite(gapDays)
            ? Math.max(0, gapDays)
            : null;
        } else {
          currentMonthGapDays = 0;
        }
      }
      normalizedCurrentMonthGap = Number.isFinite(currentMonthGapDays)
        ? currentMonthGapDays
        : null;
      rangeFetchInfo.rowCount = deduped.length;
      rangeFetchInfo.firstDate = firstDate;
      rangeFetchInfo.lastDate = lastDate;
      rangeFetchInfo.startGapDays = Number.isFinite(startGap) ? startGap : null;
      rangeFetchInfo.endGapDays = Number.isFinite(endGap) ? endGap : null;
    }
  } else {
    rangeFetchInfo.patch = { status: "not-required" };
    fetchDiagnostics.patch = rangeFetchInfo.patch;
  }

  rangeFetchInfo.currentMonthGapDays = normalizedCurrentMonthGap;
  rangeFetchInfo.durationMs = Date.now() - startedAt;

  const startGapExceeded =
    Number.isFinite(startGap) && startGap > CRITICAL_START_GAP_TOLERANCE_DAYS;
  const endGapExceeded =
    Number.isFinite(endGap) && endGap > COVERAGE_GAP_TOLERANCE_DAYS;

  if (startGapExceeded || endGapExceeded) {
    rangeFetchInfo.status = "insufficient";
    rangeFetchInfo.reason = startGapExceeded ? "start-gap" : "end-gap";
    console.warn(
      `[Worker] ${stockNo} Netlify Blob 範圍資料覆蓋不足 (startGap=${
        startGap ?? "N/A"
      }, endGap=${endGap ?? "N/A"})，改用 Proxy 逐月補抓。`,
    );
    return null;
  }

  if (
    isCurrentMonthRequest &&
    Number.isFinite(normalizedCurrentMonthGap) &&
    normalizedCurrentMonthGap > 0
  ) {
    rangeFetchInfo.status = "current-month-stale";
    rangeFetchInfo.reason = "current-month-gap";
    console.warn(
      `[Worker] ${stockNo} Netlify Blob 範圍資料仍缺少當月最新 ${normalizedCurrentMonthGap} 天 (last=${
        lastDate || "N/A"
      } < expected=${targetLatestISO})，等待當日補齊。`,
    );
  } else {
    rangeFetchInfo.status = "success";
    delete rangeFetchInfo.reason;
  }

  const dataStartDate = firstDate || startDate;
  const dataSourceFlags = new Set();
  if (typeof payload.dataSource === "string" && payload.dataSource.trim() !== "") {
    dataSourceFlags.add(payload.dataSource);
  }
  const blobSourceLabel = rangeFetchInfo.cacheHit
    ? "Netlify 年度快取 (Blob 命中)"
    : "Netlify 年度快取 (Blob 補抓)";
  dataSourceFlags.add(blobSourceLabel);

  const defaultRemoteLabel =
    marketKey === "TPEX" ? "FinMind (主來源)" : "TWSE (主來源)";

  const dataSourceLabel = summariseDataSourceFlags(dataSourceFlags, defaultRemoteLabel, {
    market: marketKey,
    adjusted: false,
  });

  const overview = summariseDatasetRows(deduped, {
    requestedStart: optionEffectiveStart || startDate,
    effectiveStartDate: optionEffectiveStart || startDate,
    warmupStartDate: startDate,
    dataStartDate,
    endDate,
  });

  fetchDiagnostics.overview = overview;
  fetchDiagnostics.gapToleranceDays = CRITICAL_START_GAP_TOLERANCE_DAYS;
  if (Number.isFinite(overview?.firstValidCloseGapFromRequested)) {
    fetchDiagnostics.firstValidCloseGapFromRequested =
      overview.firstValidCloseGapFromRequested;
  }
  if (Number.isFinite(overview?.firstValidCloseGapFromEffective)) {
    fetchDiagnostics.firstValidCloseGapFromEffective =
      overview.firstValidCloseGapFromEffective;
  }
  const blobOperations = [];
  const readMap = new Map();
  if (Array.isArray(rangeFetchInfo.yearKeys)) {
    rangeFetchInfo.yearKeys.forEach((yearKey) => {
      readMap.set(yearKey, {
        action: "read",
        key: yearKey,
        stockNo,
        market: marketKey,
        cacheHit: true,
        count: 1,
        source: "netlify-year-cache",
      });
    });
  }
  if (Array.isArray(blobMeta.hitYearKeys)) {
    blobMeta.hitYearKeys.forEach((key) => {
      if (readMap.has(key)) {
        readMap.get(key).cacheHit = true;
      }
    });
  }
  if (Array.isArray(blobMeta.missYearKeys)) {
    blobMeta.missYearKeys.forEach((key) => {
      if (readMap.has(key)) {
        readMap.get(key).cacheHit = false;
      } else {
        readMap.set(key, {
          action: "read",
          key,
          stockNo,
          market: marketKey,
          cacheHit: false,
          count: 1,
          source: "netlify-year-cache",
        });
      }
    });
  }
  blobOperations.push(...readMap.values());
  if (Array.isArray(blobMeta.primedYearKeys)) {
    blobMeta.primedYearKeys.forEach((key) => {
      blobOperations.push({
        action: "write",
        key,
        stockNo,
        market: marketKey,
        cacheHit: false,
        count: 1,
        source: "netlify-year-cache",
      });
    });
  }

  fetchDiagnostics.usedCache = rangeFetchInfo.cacheHit;
  fetchDiagnostics.blob = {
    provider: "netlify-year-cache",
    years: rangeFetchInfo.years,
    yearKeys: rangeFetchInfo.yearKeys,
    cacheHits: Number(blobMeta.cacheHits) || 0,
    cacheMisses: Number(blobMeta.cacheMisses) || 0,
    readOps: rangeFetchInfo.readOps,
    writeOps: rangeFetchInfo.writeOps,
    operations: blobOperations,
  };

  const cacheDiagnostics = prepareDiagnosticsForCacheReplay(fetchDiagnostics, {
    source: "netlify-blob-range",
    requestedRange: { start: startDate, end: endDate },
  });
  recordYearSupersetSlices({
    marketKey,
    stockNo,
    priceModeKey: getPriceModeKey(false),
    split,
    rows: deduped,
  });
  const cacheEntry = {
    data: deduped,
    stockName: payload.stockName || stockNo,
    dataSource: dataSourceLabel,
    timestamp: Date.now(),
    meta: {
      stockNo,
      startDate,
      dataStartDate,
      effectiveStartDate: optionEffectiveStart,
      endDate,
      priceMode: getPriceModeKey(false),
      splitAdjustment: split,
      lookbackDays: optionLookbackDays,
      fetchRange: { start: startDate, end: endDate },
      diagnostics: cacheDiagnostics,
      rangeCache: blobMeta || null,
    },
    priceMode: getPriceModeKey(false),
  };
  setWorkerCacheEntry(marketKey, cacheKey, cacheEntry);

  self.postMessage({
    type: "progress",
    progress: 38,
    message: "Netlify Blob 範圍快取整理中...",
  });

  return {
    data: deduped,
    dataSource: dataSourceLabel,
    stockName: payload.stockName || stockNo,
    fetchRange: { start: startDate, end: endDate },
    dataStartDate,
    effectiveStartDate: optionEffectiveStart,
    lookbackDays: optionLookbackDays,
    diagnostics: fetchDiagnostics,
  };
}

async function fetchStockData(
  stockNo,
  startDate,
  endDate,
  marketType,
  options = {},
) {
  if (!marketType) {
    throw new Error(
      "fetchStockData 缺少 marketType 參數! 無法判斷上市或上櫃。",
    );
  }
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const indexSymbol = isIndexSymbol(stockNo);
  const adjusted = indexSymbol
    ? false
    : Boolean(options.adjusted || options.adjustedPrice);
  const split = indexSymbol ? false : Boolean(options.splitAdjustment);
  const optionEffectiveStart = options.effectiveStartDate || startDate;
  const optionLookbackDays = Number.isFinite(options.lookbackDays)
    ? Number(options.lookbackDays)
    : null;
  if (
    Number.isNaN(startDateObj.getTime()) ||
    Number.isNaN(endDateObj.getTime())
  ) {
    throw new Error("日期格式無效");
  }
  if (startDateObj > endDateObj) {
    throw new Error("開始日期需早於結束日期");
  }
  const marketKey = indexSymbol ? "INDEX" : getMarketKey(marketType);
  const primaryForceSource = getPrimaryForceSource(marketKey, adjusted);
  const fallbackForceSource = getFallbackForceSource(marketKey, adjusted);
  const cacheKey = buildCacheKey(
    stockNo,
    startDate,
    endDate,
    adjusted,
    split,
    optionEffectiveStart,
    marketKey,
  );
  const cachedEntry = getWorkerCacheEntry(marketKey, cacheKey);
  const fetchDiagnostics = {
    stockNo,
    marketKey,
    indexSymbol,
    adjusted,
    split,
    requested: { start: startDate, end: endDate },
    effectiveStartDate: optionEffectiveStart || null,
    lookbackDays: optionLookbackDays,
    dataStartDate: startDate,
    months: [],
    usedCache: Boolean(cachedEntry),
  };
  if (cachedEntry) {
    const cacheDiagnostics = prepareDiagnosticsForCacheReplay(
      cachedEntry?.meta?.diagnostics || null,
      {
        source: "worker-cache",
        requestedRange: { start: startDate, end: endDate },
        coverage: cachedEntry?.meta?.coverage || cachedEntry.coverage,
      },
    );
    if (workerLastMeta && typeof workerLastMeta === "object") {
      workerLastMeta = { ...workerLastMeta, diagnostics: cacheDiagnostics };
    }
    self.postMessage({
      type: "progress",
      progress: 15,
      message: "命中背景快取...",
    });
    return {
      data: cachedEntry.data,
      dataSource: `${cachedEntry.dataSource || marketKey} (Worker快取)`,
      stockName: cachedEntry.stockName || stockNo,
      adjustmentFallbackApplied: Boolean(
        cachedEntry?.meta?.adjustmentFallbackApplied,
      ),
      adjustmentFallbackInfo: cachedEntry?.meta?.adjustmentFallbackInfo || null,
      summary:
        cachedEntry?.meta?.summary &&
        typeof cachedEntry.meta.summary === "object"
          ? cachedEntry.meta.summary
          : null,
      adjustments: Array.isArray(cachedEntry?.meta?.adjustments)
        ? cachedEntry.meta.adjustments
        : [],
      priceSource: cachedEntry?.meta?.priceSource || null,
      debugSteps: Array.isArray(cachedEntry?.meta?.debugSteps)
        ? cachedEntry.meta.debugSteps
        : [],
      dividendDiagnostics:
        cachedEntry?.meta?.dividendDiagnostics &&
        typeof cachedEntry.meta.dividendDiagnostics === "object"
          ? cachedEntry.meta.dividendDiagnostics
          : null,
      dividendEvents: Array.isArray(cachedEntry?.meta?.dividendEvents)
        ? cachedEntry.meta.dividendEvents
        : [],
      splitDiagnostics:
        cachedEntry?.meta?.splitDiagnostics &&
        typeof cachedEntry.meta.splitDiagnostics === "object"
          ? cachedEntry.meta.splitDiagnostics
          : null,
      finmindStatus:
        cachedEntry?.meta?.finmindStatus &&
        typeof cachedEntry.meta.finmindStatus === "object"
          ? cachedEntry.meta.finmindStatus
          : null,
      adjustmentDebugLog: Array.isArray(cachedEntry?.meta?.adjustmentDebugLog)
        ? cachedEntry.meta.adjustmentDebugLog
        : [],
      adjustmentChecks: Array.isArray(cachedEntry?.meta?.adjustmentChecks)
        ? cachedEntry.meta.adjustmentChecks
        : [],
      fetchRange:
        cachedEntry?.meta?.fetchRange ||
        { start: startDate, end: endDate },
      dataStartDate:
        cachedEntry?.meta?.dataStartDate ||
        cachedEntry?.meta?.startDate ||
        startDate,
      effectiveStartDate: cachedEntry?.meta?.effectiveStartDate || null,
      lookbackDays: cachedEntry?.meta?.lookbackDays || null,
      diagnostics: cacheDiagnostics,
    };
  }

  if (!adjusted && !split && (marketKey === "TWSE" || marketKey === "TPEX")) {
    const supersetResult = tryResolveRangeFromYearSuperset({
      stockNo,
      startDate,
      endDate,
      marketKey,
      split,
      fetchDiagnostics,
      cacheKey,
      optionEffectiveStart,
      optionLookbackDays,
    });
    if (supersetResult) {
      self.postMessage({
        type: "progress",
        progress: 6,
        message: "命中年度 Superset 快取...",
      });
      return supersetResult;
    }
  }

  let blobRangeAttempted = false;
  if (!adjusted && !split && (marketKey === "TWSE" || marketKey === "TPEX")) {
    blobRangeAttempted = true;
    self.postMessage({
      type: "progress",
      progress: 8,
      message: "檢查 Netlify Blob 範圍快取...",
    });
    const blobRangeResult = await tryFetchRangeFromBlob({
      stockNo,
      startDate,
      endDate,
      marketKey,
      startDateObj,
      endDateObj,
      optionEffectiveStart,
      optionLookbackDays,
      primaryForceSource,
      fallbackForceSource,
      fetchDiagnostics,
      cacheKey,
      split,
    });
    if (blobRangeResult) {
      return blobRangeResult;
    }
    const fallbackStatus = fetchDiagnostics?.rangeFetch?.status;
    const fallbackMessage =
      fallbackStatus === "timeout"
        ? "Netlify Blob 範圍回應逾時，改用 Proxy 逐月補抓..."
        : "Netlify Blob 範圍快取未命中，改用 Proxy 逐月補抓...";
    const fallbackProgress = fallbackStatus === "timeout" ? 9 : 10;
    self.postMessage({
      type: "progress",
      progress: fallbackProgress,
      message: fallbackMessage,
    });
  }

  if (adjusted) {
    self.postMessage({
      type: "progress",
      progress: 8,
      message: "準備抓取還原股價...",
    });
    self.postMessage({
      type: "progress",
      progress: 18,
      message: "呼叫還原股價服務...",
    });
    const adjustedResult = await fetchAdjustedPriceRange(
      stockNo,
      startDate,
      endDate,
      marketKey,
      { splitAdjustment: split },
    );
    const adjustedRows = Array.isArray(adjustedResult?.data)
      ? adjustedResult.data
      : [];
    const adjustedOverview = summariseDatasetRows(adjustedRows, {
      requestedStart: optionEffectiveStart || startDate,
      effectiveStartDate: optionEffectiveStart || startDate,
      warmupStartDate: startDate,
      dataStartDate: startDate,
      endDate,
    });
    const adjustedDiagnostics = {
      ...fetchDiagnostics,
      months: [],
      overview: adjustedOverview,
      usedCache: false,
    };
    const cacheDiagnostics = prepareDiagnosticsForCacheReplay(adjustedDiagnostics, {
      source: "worker-adjusted-cache",
      requestedRange: { start: startDate, end: endDate },
    });
    const adjustedEntry = {
      data: adjustedResult.data,
      stockName: adjustedResult.stockName || stockNo,
      dataSource: adjustedResult.dataSource,
      timestamp: Date.now(),
      splitAdjustment: split,
      meta: {
        stockNo,
        startDate,
        dataStartDate: startDate,
        effectiveStartDate: optionEffectiveStart,
        endDate,
        priceMode: getPriceModeKey(adjusted),
        splitAdjustment: split,
        lookbackDays: optionLookbackDays,
        fetchRange: { start: startDate, end: endDate },
        summary: adjustedResult.summary || null,
        adjustments: adjustedResult.adjustments || [],
        priceSource: adjustedResult.priceSource || null,
        adjustmentFallbackApplied:
          Boolean(adjustedResult.adjustmentFallbackApplied),
        adjustmentFallbackInfo:
          adjustedResult.adjustmentFallbackInfo &&
          typeof adjustedResult.adjustmentFallbackInfo === "object"
            ? adjustedResult.adjustmentFallbackInfo
            : null,
        debugSteps: Array.isArray(adjustedResult.debugSteps)
          ? adjustedResult.debugSteps
          : [],
        dividendDiagnostics:
          adjustedResult.dividendDiagnostics &&
          typeof adjustedResult.dividendDiagnostics === "object"
            ? adjustedResult.dividendDiagnostics
            : null,
        dividendEvents: Array.isArray(adjustedResult.dividendEvents)
          ? adjustedResult.dividendEvents
          : [],
        splitDiagnostics:
          adjustedResult.splitDiagnostics &&
          typeof adjustedResult.splitDiagnostics === "object"
            ? adjustedResult.splitDiagnostics
            : null,
        finmindStatus:
          adjustedResult.finmindStatus &&
          typeof adjustedResult.finmindStatus === "object"
            ? adjustedResult.finmindStatus
            : null,
        adjustmentDebugLog: Array.isArray(adjustedResult.adjustmentDebugLog)
          ? adjustedResult.adjustmentDebugLog
          : [],
        adjustmentChecks: Array.isArray(adjustedResult.adjustmentChecks)
          ? adjustedResult.adjustmentChecks
          : [],
        diagnostics: cacheDiagnostics,
      },
      priceMode: getPriceModeKey(adjusted),
    };
    setWorkerCacheEntry(marketKey, cacheKey, adjustedEntry);
    return {
      data: adjustedResult.data,
      dataSource: adjustedResult.dataSource,
      stockName: adjustedResult.stockName || stockNo,
      summary: adjustedResult.summary || null,
      adjustments: adjustedResult.adjustments || [],
      priceSource: adjustedResult.priceSource || null,
      adjustmentFallbackApplied: Boolean(
        adjustedResult.adjustmentFallbackApplied,
      ),
      adjustmentFallbackInfo:
        adjustedResult.adjustmentFallbackInfo &&
        typeof adjustedResult.adjustmentFallbackInfo === "object"
          ? adjustedResult.adjustmentFallbackInfo
          : null,
      dividendDiagnostics:
        adjustedResult.dividendDiagnostics &&
        typeof adjustedResult.dividendDiagnostics === "object"
          ? adjustedResult.dividendDiagnostics
          : null,
      dividendEvents: Array.isArray(adjustedResult.dividendEvents)
        ? adjustedResult.dividendEvents
        : [],
      splitDiagnostics:
        adjustedResult.splitDiagnostics &&
        typeof adjustedResult.splitDiagnostics === "object"
          ? adjustedResult.splitDiagnostics
          : null,
      finmindStatus:
        adjustedResult.finmindStatus &&
        typeof adjustedResult.finmindStatus === "object"
          ? adjustedResult.finmindStatus
          : null,
      adjustmentDebugLog: Array.isArray(adjustedResult.adjustmentDebugLog)
        ? adjustedResult.adjustmentDebugLog
        : [],
      adjustmentChecks: Array.isArray(adjustedResult.adjustmentChecks)
        ? adjustedResult.adjustmentChecks
        : [],
      fetchRange: { start: startDate, end: endDate },
      dataStartDate: startDate,
      effectiveStartDate: optionEffectiveStart,
      lookbackDays: optionLookbackDays,
      diagnostics: adjustedDiagnostics,
    };
  }

  self.postMessage({
    type: "progress",
    progress: blobRangeAttempted ? 12 : 5,
    message: "準備抓取原始數據...",
  });

  const months = enumerateMonths(startDateObj, endDateObj);
  if (months.length === 0) {
    fetchDiagnostics.usedCache = false;
    fetchDiagnostics.overview = summariseDatasetRows([], {
      requestedStart: optionEffectiveStart || startDate,
      effectiveStartDate: optionEffectiveStart || startDate,
      warmupStartDate: startDate,
      dataStartDate: startDate,
      endDate,
    });
    const cacheDiagnostics = prepareDiagnosticsForCacheReplay(fetchDiagnostics, {
      source: "worker-empty-cache",
      requestedRange: { start: startDate, end: endDate },
    });
    const entry = {
      data: [],
      stockName: stockNo,
      dataSource: marketKey,
      timestamp: Date.now(),
      meta: {
        stockNo,
        startDate,
        dataStartDate: startDate,
        effectiveStartDate: optionEffectiveStart,
        endDate,
        priceMode: getPriceModeKey(adjusted),
        lookbackDays: optionLookbackDays,
        fetchRange: { start: startDate, end: endDate },
        diagnostics: cacheDiagnostics,
      },
      priceMode: getPriceModeKey(adjusted),
    };
    setWorkerCacheEntry(marketKey, cacheKey, entry);
    return {
      data: [],
      dataSource: marketKey,
      stockName,
      fetchRange: { start: startDate, end: endDate },
      dataStartDate: startDate,
      effectiveStartDate: optionEffectiveStart,
      lookbackDays: optionLookbackDays,
      diagnostics: fetchDiagnostics,
    };
  }
  let proxyPath = "/api/twse/";
  if (marketKey === "TPEX") proxyPath = "/api/tpex/";
  else if (marketKey === "US") proxyPath = "/api/us/";
  else if (marketKey === "INDEX") proxyPath = "/api/index/";
  const isTpex = marketKey === "TPEX";
  const isUs = marketKey === "US";
  const concurrencyLimit = isTpex ? 3 : 4;
  const segments = buildMonthSegments(months, optionEffectiveStart, {
    warmupGroupSize: isUs ? 2 : 3,
    activeConcurrency: concurrencyLimit,
  });
  if (segments.length === 0) {
    segments.push({
      type: "active",
      label: months[0]?.label || "",
      months: months.map((info) => ({ ...info, phase: "active" })),
      concurrency: concurrencyLimit,
    });
  }
  fetchDiagnostics.queuePlan = segments.map((segment) => ({
    type: segment.type,
    label: segment.label,
    months: segment.months.map((month) => month.monthKey),
    size: segment.months.length,
  }));
  const totalMonths = months.length;
  let completedMonths = 0;

  async function processMonth(monthInfo) {
    try {
      let monthEntry = getMonthlyCacheEntry(
        marketKey,
        stockNo,
        monthInfo.monthKey,
        adjusted,
        split,
      );
      if (!monthEntry) {
        monthEntry = {
          data: [],
          coverage: [],
          sources: new Set(),
          stockName: "",
          lastUpdated: 0,
        };
        setMonthlyCacheEntry(
          marketKey,
          stockNo,
          monthInfo.monthKey,
          monthEntry,
          adjusted,
          split,
        );
      }

      ensureRangeFingerprints(monthEntry);
      const existingCoverage = Array.isArray(monthEntry.coverage)
        ? monthEntry.coverage.map((range) => ({ ...range }))
        : [];
      const forcedRepairRanges = detectCoverageGapsForMonth(
        monthEntry,
        monthInfo.rangeStartISO,
        monthInfo.rangeEndISO,
        { toleranceDays: COVERAGE_GAP_TOLERANCE_DAYS },
      );
      let coverageForComputation = existingCoverage;
      if (forcedRepairRanges.length > 0) {
        coverageForComputation = subtractRangeBounds(
          existingCoverage,
          forcedRepairRanges,
        );
        monthEntry.coverage = subtractRangeBounds(
          monthEntry.coverage || [],
          forcedRepairRanges,
        );
        console.warn(
          `[Worker] 檢測到 ${stockNo} ${monthInfo.monthKey} 的月度快取缺口，強制重新抓取 ${forcedRepairRanges.length} 段資料。`,
        );
      }
      pruneFingerprintsForRanges(monthEntry, forcedRepairRanges);
      const fingerprintSuperset = findFingerprintSuperset(
        monthEntry,
        monthInfo.rangeStartISO,
        monthInfo.rangeEndISO,
      );
      let missingRanges;
      let coveredLengthBefore;
      if (fingerprintSuperset) {
        missingRanges = [];
        const targetStartUtc = isoToUTC(monthInfo.rangeStartISO);
        const targetEndUtcExclusive = isoToUTC(monthInfo.rangeEndISO) + DAY_MS;
        coveredLengthBefore =
          Number.isFinite(targetStartUtc) && Number.isFinite(targetEndUtcExclusive)
            ? Math.max(0, targetEndUtcExclusive - targetStartUtc)
            : 0;
      } else {
        missingRanges = computeMissingRanges(
          coverageForComputation,
          monthInfo.rangeStartISO,
          monthInfo.rangeEndISO,
        );
        coveredLengthBefore = getCoveredLength(
          coverageForComputation,
          monthInfo.rangeStartISO,
          monthInfo.rangeEndISO,
        );
      }
      const forcedRangeKeys = new Set(
        forcedRepairRanges.map((range) => `${range.start}-${range.end}`),
      );
      const monthSourceFlags = new Set(
        monthEntry.sources instanceof Set
          ? Array.from(monthEntry.sources)
          : monthEntry.sources || [],
      );
      const monthCacheFlags = new Set();
      const forcedSourceUsage = new Set();
      let monthStockName = monthEntry.stockName || "";
      let forcedReloadCompleted = false;

      if (missingRanges.length > 0) {
        for (let i = 0; i < missingRanges.length; i += 1) {
          const missingRange = missingRanges[i];
          const { startISO, endISO } = rangeBoundsToISO(missingRange);
          const rangeKey = `${missingRange.start}-${missingRange.end}`;
          const shouldForceRange =
            forcedRangeKeys.size > 0 && forcedRangeKeys.has(rangeKey);
          const candidateSources = [];
          if (shouldForceRange) {
            if (primaryForceSource) candidateSources.push(primaryForceSource);
            if (
              fallbackForceSource &&
              fallbackForceSource !== primaryForceSource
            ) {
              candidateSources.push(fallbackForceSource);
            }
          }
          candidateSources.push(null);

          let payload = null;
          let lastError = null;
          for (let c = 0; c < candidateSources.length; c += 1) {
            const forceSource = candidateSources[c];
            const params = new URLSearchParams({
              stockNo,
              month: monthInfo.monthKey,
              start: startISO,
              end: endISO,
            });
            if (adjusted) params.set("adjusted", "1");
            if (forceSource) params.set("forceSource", forceSource);
            if (shouldForceRange) {
              params.set(
                "cacheBust",
                `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              );
            }
            const url = `${proxyPath}?${params.toString()}`;
            try {
              const responsePayload = await fetchWithAdaptiveRetry(url, {
                headers: { Accept: "application/json" },
              });
              if (responsePayload?.error) {
                throw new Error(responsePayload.error);
              }
              payload = responsePayload;
              if (forceSource) {
                forcedSourceUsage.add(forceSource);
                console.warn(
                  `[Worker] ${stockNo} ${monthInfo.monthKey} ${startISO}~${endISO} 以 ${forceSource} 強制補抓 ${Array.isArray(
                    responsePayload?.aaData,
                  )
                    ? responsePayload.aaData.length
                    : Array.isArray(responsePayload?.data)
                      ? responsePayload.data.length
                      : 0} 筆資料。`,
                );
              }
              break;
            } catch (error) {
              lastError = error;
              console.error(`[Worker] 抓取 ${url} 失敗:`, error);
              payload = null;
            }
          }

          if (!payload) {
            if (lastError) {
              console.error(
                `[Worker] ${stockNo} ${monthInfo.monthKey} ${startISO}~${endISO} 補抓失敗，後續指標可能缺少暖身資料。`,
              );
            }
            continue;
          }

          if (payload?.source === "blob") {
            const cacheLabel = isTpex
              ? "TPEX (快取)"
              : isUs
                ? "US (快取)"
                : "TWSE (快取)";
            monthCacheFlags.add(cacheLabel);
            monthEntry.sources.add(cacheLabel);
          } else if (payload?.source === "memory") {
            const cacheLabel = isTpex
              ? "TPEX (記憶體快取)"
              : isUs
                ? "US (記憶體快取)"
                : "TWSE (記憶體快取)";
            monthCacheFlags.add(cacheLabel);
            monthEntry.sources.add(cacheLabel);
          }
          const rows = Array.isArray(payload?.aaData)
            ? payload.aaData
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
          const normalized = [];
          rows.forEach((row) => {
            const normalizedRow = normalizeProxyRow(
              row,
              isTpex,
              startDateObj,
              endDateObj,
            );
            if (normalizedRow) normalized.push(normalizedRow);
          });
          if (payload?.stockName) {
            monthStockName = payload.stockName;
          }
          const sourceLabel =
            payload?.dataSource || (isTpex ? "TPEX" : "TWSE");
          if (sourceLabel) {
            monthSourceFlags.add(sourceLabel);
            monthEntry.sources.add(sourceLabel);
          }
          if (Array.isArray(payload?.dataSources)) {
            payload.dataSources
              .filter((label) => typeof label === "string" && label.trim() !== "")
              .forEach((label) => {
                monthSourceFlags.add(label);
                monthEntry.sources.add(label);
              });
          }
          if (normalized.length > 0) {
            mergeMonthlyData(monthEntry, normalized);
            const sortedNormalized = normalized
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date));
            const coverageStart = sortedNormalized[0]?.date || null;
            const coverageEnd =
              sortedNormalized[sortedNormalized.length - 1]?.date || null;
            if (coverageStart && coverageEnd) {
              addCoverage(monthEntry, coverageStart, coverageEnd);
            }
            rebuildCoverageFromData(monthEntry);
            if (shouldForceRange) {
              forcedReloadCompleted = true;
            }
          }
          monthEntry.lastUpdated = Date.now();
          if (!monthEntry.stockName && monthStockName) {
            monthEntry.stockName = monthStockName;
          }
        }
      }

      const rowsForRange = (monthEntry.data || []).filter(
        (row) =>
          row &&
          row.date >= monthInfo.rangeStartISO &&
          row.date <= monthInfo.rangeEndISO,
      );

      const postMissing = computeMissingRanges(
        monthEntry.coverage,
        monthInfo.rangeStartISO,
        monthInfo.rangeEndISO,
      );
      if (postMissing.length === 0) {
        addRangeFingerprint(
          monthEntry,
          monthInfo.rangeStartISO,
          monthInfo.rangeEndISO,
        );
      }

      monthCacheFlags.forEach((label) => {
        monthSourceFlags.add(label);
      });

      if (forcedRepairRanges.length > 0 && forcedReloadCompleted) {
        monthEntry.lastForcedReloadAt = Date.now();
      }

      const usedCache =
        missingRanges.length === 0 || coveredLengthBefore > 0;

      const monthDiagnostics = {
        monthKey: monthInfo.monthKey,
        label: monthInfo.label,
        requestedStart: monthInfo.rangeStartISO,
        requestedEnd: monthInfo.rangeEndISO,
        missingSegments: missingRanges.length,
        forcedRepairs: forcedRepairRanges.length,
        forcedRepairSamples: forcedRepairRanges
          .slice(0, 3)
          .map((range) => rangeBoundsToISO(range)),
        cacheCoverageDaysBefore: Math.round(
          coveredLengthBefore / DAY_MS,
        ),
        usedCache,
        rowsReturned: rowsForRange.length,
        firstRowDate: rowsForRange[0]?.date || null,
        lastRowDate:
          rowsForRange[rowsForRange.length - 1]?.date || null,
        cacheSources: Array.from(monthSourceFlags),
        forcedSources: Array.from(forcedSourceUsage),
        queuePhase: monthInfo.phase || "active",
      };
      return {
        rows: rowsForRange,
        sourceFlags: Array.from(monthSourceFlags),
        stockName: monthStockName,
        usedCache,
        diagnostics: monthDiagnostics,
      };
    } finally {
      completedMonths += 1;
      const progress = 10 + Math.round((completedMonths / totalMonths) * 35);
      const phaseLabel =
        monthInfo?.phase === "warmup" ? "暖身佇列" : "回測區間";
      self.postMessage({
        type: "progress",
        progress,
        message: `處理 ${phaseLabel} ${monthInfo.label} 數據...`,
      });
    }
  }

  const monthResults = [];
  for (const segment of segments) {
    const results = await runWithConcurrency(
      segment.months,
      segment.concurrency || 1,
      processMonth,
    );
    monthResults.push(...results);
  }

  const normalizedRows = [];
  const sourceFlags = new Set();
  let stockName = "";
  const fetchForcedSources = new Set();
  monthResults.forEach((res) => {
    if (!res) return;
    if (res.stockName && !stockName) stockName = res.stockName;
    if (Array.isArray(res.sourceFlags)) {
      res.sourceFlags.forEach((flag) => {
        if (flag) sourceFlags.add(flag);
      });
    }
    if (res.usedCache) {
      sourceFlags.add("Worker月度快取");
    }
    if (res.diagnostics) {
      fetchDiagnostics.months.push(res.diagnostics);
      if (Array.isArray(res.diagnostics.forcedSources)) {
        res.diagnostics.forcedSources.forEach((src) => {
          if (src) fetchForcedSources.add(src);
        });
      }
    }
    (res.rows || []).forEach((row) => {
      const normalized = normalizeProxyRow(
        row,
        isTpex,
        startDateObj,
        endDateObj,
      );
      if (normalized) normalizedRows.push(normalized);
    });
  });
  if (fetchForcedSources.size > 0) {
    fetchDiagnostics.forcedSources = Array.from(fetchForcedSources);
  }

  self.postMessage({ type: "progress", progress: 55, message: "整理數據..." });
  const deduped = dedupeAndSortData(normalizedRows);
  const defaultRemoteLabel = isTpex
    ? adjusted
      ? "Yahoo Finance (還原)"
      : "FinMind (主來源)"
    : isUs
      ? adjusted
        ? "Yahoo Finance (還原)"
        : "FinMind (主來源)"
      : adjusted
        ? "Yahoo Finance (還原)"
        : "TWSE (主來源)";
  const dataSourceLabel = summariseDataSourceFlags(
    sourceFlags,
    defaultRemoteLabel,
    { market: isTpex ? "TPEX" : isUs ? "US" : "TWSE", adjusted },
  );

  const overview = summariseDatasetRows(deduped, {
    requestedStart: optionEffectiveStart || startDate,
    effectiveStartDate: optionEffectiveStart || startDate,
    warmupStartDate: startDate,
    dataStartDate: startDate,
    endDate,
  });
  fetchDiagnostics.overview = overview;
  fetchDiagnostics.usedCache = false;
  fetchDiagnostics.gapToleranceDays = CRITICAL_START_GAP_TOLERANCE_DAYS;
  if (
    Number.isFinite(overview?.firstValidCloseGapFromRequested)
  ) {
    fetchDiagnostics.firstValidCloseGapFromRequested =
      overview.firstValidCloseGapFromRequested;
  }
  if (
    Number.isFinite(overview?.firstValidCloseGapFromEffective) &&
    overview.firstValidCloseGapFromEffective > 1
  ) {
    console.warn(
      `[Worker] ${stockNo} 第一筆有效收盤價落後暖身起點 ${overview.firstValidCloseGapFromEffective} 天，請檢查快取或資料源是否缺漏。`,
    );
  }
  if (overview?.invalidRowsInRange?.count > 0) {
    const reasonText = formatReasonCountMap(overview.invalidRowsInRange.reasons);
    console.warn(
      `[Worker] ${stockNo} 遠端回應共有 ${overview.invalidRowsInRange.count} 筆無效資料。原因統計: ${reasonText}`,
    );
    if (
      Array.isArray(overview.invalidRowsInRange.samples) &&
      overview.invalidRowsInRange.samples.length > 0 &&
      typeof console.table === "function"
    ) {
      const invalidTable = overview.invalidRowsInRange.samples.map((sample) => ({
        index: sample.index,
        date: sample.date,
        reasons: Array.isArray(sample.reasons)
          ? sample.reasons.join(", ")
          : sample.reasons,
        close: sample.close,
        volume: sample.volume,
      }));
      console.table(invalidTable);
    }
  }

  const cacheDiagnostics = prepareDiagnosticsForCacheReplay(fetchDiagnostics, {
    source: "worker-proxy-cache",
    requestedRange: { start: startDate, end: endDate },
  });
  recordYearSupersetSlices({
    marketKey,
    stockNo,
    priceModeKey: getPriceModeKey(adjusted),
    split,
    rows: deduped,
  });
  setWorkerCacheEntry(marketKey, cacheKey, {
    data: deduped,
    stockName: stockName || stockNo,
    dataSource: dataSourceLabel,
    timestamp: Date.now(),
    meta: {
      stockNo,
      startDate,
      dataStartDate: startDate,
      effectiveStartDate: optionEffectiveStart,
      endDate,
      priceMode: getPriceModeKey(adjusted),
      splitAdjustment: split,
      lookbackDays: optionLookbackDays,
      fetchRange: { start: startDate, end: endDate },
      diagnostics: cacheDiagnostics,
    },
    priceMode: getPriceModeKey(adjusted),
  });

  if (deduped.length === 0) {
    console.warn(
      `[Worker] 指定範圍 (${startDate} ~ ${endDate}) 無 ${stockNo} 交易數據`,
    );
  }

  return {
    data: deduped,
    dataSource: dataSourceLabel,
    stockName: stockName || stockNo,
    fetchRange: { start: startDate, end: endDate },
    dataStartDate: startDate,
    effectiveStartDate: optionEffectiveStart,
    lookbackDays: optionLookbackDays,
    diagnostics: fetchDiagnostics,
  };
}

// --- TAIEX 數據獲取 ---
async function fetchTAIEXData(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const allData = [];

  // 獲取每日指數數據（簡化實現）
  let current = new Date(startDate);
  const dates = [];

  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    dates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }

  // 注意：這裡需要實際的 TAIEX API，暫時使用模擬數據結構
  // 在實際實現中，應該調用適當的台灣加權指數 API

  self.postMessage({
    type: "progress",
    progress: 25,
    message: "獲取加權指數數據...",
  });

  // 實際實現時應該替換為真實的 TAIEX API 調用
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    // 這裡應該調用實際的 TAIEX API
    // 暫時跳過，返回空數據表示需要實現
  }

  // 如果沒有找到 TAIEX 數據，拋出錯誤提示用戶使用具體股票代碼
  throw new Error("TAIEX 指數數據功能開發中，請使用具體的股票代碼進行回測");
}

// --- 技術指標計算工具 ---
function calculateMA(prices, period) {
  if (!Array.isArray(prices) || period <= 0) {
    return new Array(prices?.length || 0).fill(null);
  }
  const result = new Array(prices.length).fill(null);
  const window = new Array(period).fill(null);
  let sum = 0;
  let validCount = 0;
  let head = 0;

  for (let i = 0; i < prices.length; i++) {
    const incoming = Number.isFinite(prices[i]) ? prices[i] : null;
    const outgoing = window[head];
    if (outgoing !== null) {
      sum -= outgoing;
      validCount -= 1;
    }
    window[head] = incoming;
    head = (head + 1) % period;
    if (incoming !== null) {
      sum += incoming;
      validCount += 1;
    }
    if (i >= period - 1 && validCount === period) {
      result[i] = sum / period;
    }

  }

  return result;
}

function calculateEMA(prices, period) {
  if (!Array.isArray(prices) || period <= 0) {
    return new Array(prices?.length || 0).fill(null);
  }
  const result = new Array(prices.length).fill(null);
  const multiplier = 2 / (period + 1);
  let ema = null;
  let count = 0;
  let sum = 0;

  for (let i = 0; i < prices.length; i++) {
    const value = Number.isFinite(prices[i]) ? prices[i] : null;
    if (value === null) {
      ema = null;
      sum = 0;
      count = 0;
      continue;
    }

    if (ema === null) {
      sum += value;
      count += 1;
      if (count === period) {
        ema = sum / period;
        result[i] = ema;
      }
    } else {
      ema = (value - ema) * multiplier + ema;
      result[i] = ema;
    }
  }

  return result;
}

function calculateDIEMA(diValues, period) {
  if (!Array.isArray(diValues) || period <= 0) {
    return new Array(diValues?.length || 0).fill(null);
  }
  const result = new Array(diValues.length).fill(null);
  const multiplier = 2 / (period + 1);
  let ema = null;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < diValues.length; i++) {
    const value = Number.isFinite(diValues[i]) ? diValues[i] : null;
    if (value === null) {
      ema = null;
      sum = 0;
      count = 0;
      continue;
    }

    if (ema === null) {
      sum += value;
      count += 1;
      if (count === period) {
        ema = sum / period;
        result[i] = ema;
      }
    } else {
      ema = (value - ema) * multiplier + ema;
      result[i] = ema;
    }
  }

  return result;
}

function calculateRSI(prices, period = 14) {
  if (!Array.isArray(prices) || period <= 0 || prices.length <= period) {
    return new Array(prices.length || 0).fill(null);
  }
  const result = new Array(prices.length).fill(null);
  let gainSum = 0;
  let lossSum = 0;
  let initialized = false;
  let prevPrice = null;
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < prices.length; i++) {
    const current = Number.isFinite(prices[i]) ? prices[i] : null;
    if (current === null) {
      prevPrice = null;
      initialized = false;
      gainSum = 0;
      lossSum = 0;
      continue;
    }

    if (prevPrice === null) {
      prevPrice = current;
      continue;
    }

    const change = current - prevPrice;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    prevPrice = current;

    if (!initialized) {
      gainSum += gain;
      lossSum += loss;
      if (i >= period) {
        avgGain = gainSum / period;
        avgLoss = lossSum / period;
        initialized = true;
        result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

function calculateMACD(
  highs,
  lows,
  closes,
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9,
) {
  const length = closes.length;
  const empty = {
    macd: new Array(length).fill(null),
    signal: new Array(length).fill(null),
    histogram: new Array(length).fill(null),
  };
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length !== length ||
    lows.length !== length ||
    shortPeriod <= 0 ||
    longPeriod <= shortPeriod ||
    signalPeriod <= 0
  ) {
    return empty;
  }

  const diValues = new Array(length).fill(null);
  for (let i = 0; i < length; i++) {
    const h = Number.isFinite(highs[i]) ? highs[i] : null;
    const l = Number.isFinite(lows[i]) ? lows[i] : null;
    const c = Number.isFinite(closes[i]) ? closes[i] : null;
    if (h !== null && l !== null && c !== null) {
      diValues[i] = (h + l + 2 * c) / 4;
    }
  }

  const shortEma = calculateDIEMA(diValues, shortPeriod);
  const longEma = calculateDIEMA(diValues, longPeriod);
  const macd = new Array(length).fill(null);
  const validMacdValues = [];

  for (let i = 0; i < length; i++) {
    const emaShort = Number.isFinite(shortEma[i]) ? shortEma[i] : null;
    const emaLong = Number.isFinite(longEma[i]) ? longEma[i] : null;
    if (emaShort !== null && emaLong !== null) {
      const value = emaShort - emaLong;
      macd[i] = value;
      validMacdValues.push({ index: i, value });
    }
  }

  const signal = new Array(length).fill(null);
  if (validMacdValues.length >= signalPeriod) {
    let ema = null;
    const multiplier = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = 0; i < validMacdValues.length; i++) {
      const { index, value } = validMacdValues[i];
      if (ema === null) {
        sum += value;
        if (i + 1 === signalPeriod) {
          ema = sum / signalPeriod;
          signal[index] = ema;
        }
      } else {
        ema = (value - ema) * multiplier + ema;
        signal[index] = ema;
      }
    }
  }

  const histogram = new Array(length).fill(null);
  for (let i = 0; i < length; i++) {
    if (macd[i] !== null && signal[i] !== null) {
      histogram[i] = macd[i] - signal[i];
    }
  }


  return { macd, signal, histogram };
}

function calculateBollingerBands(prices, period = 20, deviations = 2) {
  if (!Array.isArray(prices) || period <= 0 || prices.length < period) {
    return {
      upper: new Array(prices.length || 0).fill(null),
      middle: new Array(prices.length || 0).fill(null),
      lower: new Array(prices.length || 0).fill(null),
    };
  }

  const middle = calculateMA(prices, period);
  const upper = new Array(prices.length).fill(null);
  const lower = new Array(prices.length).fill(null);

  for (let i = period - 1; i < prices.length; i++) {
    if (!Number.isFinite(middle[i])) continue;
    let varianceSum = 0;
    let count = 0;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const value = Number.isFinite(prices[j]) ? prices[j] : null;
      if (value === null) {
        valid = false;
        break;
      }
      const diff = value - middle[i];
      varianceSum += diff * diff;
      count += 1;
    }
    if (!valid || count !== period) continue;
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = middle[i] + deviations * stdDev;
    lower[i] = middle[i] - deviations * stdDev;
  }

  return { upper, middle, lower };
}

function calculateKD(highs, lows, closes, period = 9) {
  const length = closes.length;
  const empty = {
    k: new Array(length).fill(null),
    d: new Array(length).fill(null),
  };
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length !== length ||
    lows.length !== length ||
    period <= 0
  ) {
    return empty;
  }

  const rsv = new Array(length).fill(null);
  for (let i = period - 1; i < length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const h = Number.isFinite(highs[j]) ? highs[j] : null;
      const l = Number.isFinite(lows[j]) ? lows[j] : null;
      if (h === null || l === null) {
        valid = false;
        break;
      }
      highest = Math.max(highest, h);
      lowest = Math.min(lowest, l);
    }
    const close = Number.isFinite(closes[i]) ? closes[i] : null;
    if (!valid || close === null) continue;
    if (highest === lowest) {
      rsv[i] = i > 0 && rsv[i - 1] !== null ? rsv[i - 1] : 50;
    } else {
      rsv[i] = ((close - lowest) / (highest - lowest)) * 100;
    }
  }

  const kLine = new Array(length).fill(null);
  const dLine = new Array(length).fill(null);
  let kPrev = 50;
  let dPrev = 50;

  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(rsv[i])) {
      kPrev = 50;
      dPrev = 50;
      continue;
    }
    kPrev = (rsv[i] + 2 * kPrev) / 3;
    dPrev = (kPrev + 2 * dPrev) / 3;
    kLine[i] = Math.min(100, Math.max(0, kPrev));
    dLine[i] = Math.min(100, Math.max(0, dPrev));
  }

  return { k: kLine, d: dLine };
}

function calculateWilliams(highs, lows, closes, period = 14) {
  if (
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length !== lows.length ||
    highs.length !== closes.length ||
    period <= 0
  ) {
    return new Array(closes.length || 0).fill(null);
  }
  const result = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    let valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      const h = Number.isFinite(highs[j]) ? highs[j] : null;
      const l = Number.isFinite(lows[j]) ? lows[j] : null;
      if (h === null || l === null) {
        valid = false;
        break;
      }
      highest = Math.max(highest, h);
      lowest = Math.min(lowest, l);
    }
    const close = Number.isFinite(closes[i]) ? closes[i] : null;
    if (!valid || close === null) continue;
    if (highest === lowest) {
      result[i] = i > 0 && result[i - 1] !== null ? result[i - 1] : -50;
    } else {
      result[i] = ((highest - close) / (highest - lowest)) * -100;
    }
  }
  return result;
}

function calculateDailyReturns(portfolioValues) {
  if (!Array.isArray(portfolioValues) || portfolioValues.length < 2) {
    return [];
  }
  const returns = [];
  for (let i = 1; i < portfolioValues.length; i++) {
    const today = Number.isFinite(portfolioValues[i])
      ? portfolioValues[i]
      : null;
    const yesterday = Number.isFinite(portfolioValues[i - 1])
      ? portfolioValues[i - 1]
      : null;
    if (today !== null && yesterday !== null && yesterday !== 0) {
      returns.push(today / yesterday - 1);
    } else {
      returns.push(0);
    }
  }
  return returns;
}

function computeReturnMomentSums(returns) {
  if (!Array.isArray(returns) || returns.length === 0) {
    return {
      sampleCount: 0,
      sum1: 0,
      sum2: 0,
      sum3: 0,
      sum4: 0,
      mean: null,
      variance: null,
      stdDev: null,
      skewness: null,
      kurtosis: null,
    };
  }

  let sampleCount = 0;
  let sum1 = 0;
  let sum2 = 0;
  let sum3 = 0;
  let sum4 = 0;

  for (let i = 0; i < returns.length; i += 1) {
    const value = returns[i];
    if (!Number.isFinite(value)) {
      prevDiff = null;
      continue;
    }
    sampleCount += 1;
    sum1 += value;
    const squared = value * value;
    sum2 += squared;
    sum3 += squared * value;
    sum4 += squared * squared;
  }

  if (sampleCount === 0) {
    return {
      sampleCount: 0,
      sum1: 0,
      sum2: 0,
      sum3: 0,
      sum4: 0,
      mean: null,
      variance: null,
      stdDev: null,
      skewness: null,
      kurtosis: null,
    };
  }

  const mean = sum1 / sampleCount;
  let diff2Sum = 0;
  let diff3Sum = 0;
  let diff4Sum = 0;
  let autocovLag1 = 0;
  let prevDiff = null;

  for (let i = 0; i < returns.length; i += 1) {
    const value = returns[i];
    if (!Number.isFinite(value)) continue;
    const diff = value - mean;
    const diff2 = diff * diff;
    diff2Sum += diff2;
    diff3Sum += diff2 * diff;
    diff4Sum += diff2 * diff2;
    if (prevDiff !== null) {
      autocovLag1 += prevDiff * diff;
    }
    prevDiff = diff;
  }

  const variance = sampleCount > 1 ? diff2Sum / (sampleCount - 1) : 0;
  const stdDev = variance > 0 ? Math.sqrt(variance) : 0;

  let autocorrLag1 = null;
  if (sampleCount > 1 && diff2Sum > 0) {
    const denom = diff2Sum;
    const normalised = autocovLag1 / denom;
    if (Number.isFinite(normalised)) {
      const clamped = Math.max(-0.99, Math.min(0.99, normalised));
      autocorrLag1 = clamped;
    }
  }

  let skewness = null;
  if (sampleCount > 2 && diff2Sum > 0) {
    const numerator = Math.sqrt(sampleCount * (sampleCount - 1)) * diff3Sum;
    const denominator = (sampleCount - 2) * Math.pow(diff2Sum, 1.5);
    skewness = denominator !== 0 ? numerator / denominator : null;
  }

  let kurtosis = null;
  if (sampleCount > 3 && stdDev > 0) {
    const denominator =
      (sampleCount - 1) * (sampleCount - 2) * (sampleCount - 3) * Math.pow(stdDev, 4);
    const correction =
      (3 * (sampleCount - 1) * (sampleCount - 1)) /
      ((sampleCount - 2) * (sampleCount - 3));
    const numerator = sampleCount * (sampleCount + 1) * diff4Sum;
    const excess = denominator !== 0 ? numerator / denominator - correction : null;
    kurtosis = excess !== null ? excess + 3 : null;
  }

  return {
    sampleCount,
    sum1,
    sum2,
    sum3,
    sum4,
    mean,
    variance,
    stdDev,
    lag1Autocorr: autocorrLag1,
    skewness,
    kurtosis,
  };
}

function calculateSharpeRatio(dailyReturns, annualReturnPct) {
  if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) return 0;
  const riskFreeRate = 0.01;
  const avg = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - avg) * (r - avg), 0) /
    dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  const annualStdDev = stdDev * Math.sqrt(252);
  const annualExcess = annualReturnPct / 100 - riskFreeRate;
  return annualStdDev !== 0 ? annualExcess / annualStdDev : 0;
}

function calculateSortinoRatio(dailyReturns, annualReturnPct) {
  if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) return 0;
  const targetAnnual = 0.01;
  const targetDaily = Math.pow(1 + targetAnnual, 1 / 252) - 1;
  const downsideDiffs = dailyReturns.map((r) => Math.min(0, r - targetDaily));
  const downsideVariance =
    downsideDiffs.reduce((sum, r) => sum + r * r, 0) / dailyReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return Infinity;
  const annualDownsideDev = downsideDev * Math.sqrt(252);
  const annualExcess = annualReturnPct / 100 - targetAnnual;
  return annualDownsideDev !== 0 ? annualExcess / annualDownsideDev : Infinity;
}

function calculateMaxDrawdown(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    peak = Math.max(peak, value);
    if (peak > 0) {
      const drawdown = ((peak - value) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  return maxDrawdown;
}

// --- 計算所有指標 ---
function calculateAllIndicators(data, params) {
  /* ... (程式碼與上次 Part 3 相同) ... */ self.postMessage({
    type: "progress",
    progress: 55,
    message: "計算指標...",
  });
  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);
  const indic = {};
  const {
    entryParams: ep,
    exitParams: xp,
    enableShorting,
    shortEntryParams: sep,
    shortExitParams: sxp,
  } = params;
  try {
    const maCalculator = calculateMA;

    // === 入場策略 MA 指標 ===
    const entryShortMAPeriod = ep?.shortPeriod || 5;
    const entryLongMAPeriod = ep?.longPeriod || 20;
    indic.maShort = maCalculator(closes, entryShortMAPeriod);
    indic.maLong = maCalculator(closes, entryLongMAPeriod);

    // === 出場策略 MA 指標 (獨立參數) ===
    const exitShortMAPeriod = xp?.shortPeriod || 5;
    const exitLongMAPeriod = xp?.longPeriod || 20;
    const exitMAPeriod = xp?.period || exitLongMAPeriod;
    indic.maShortExit = maCalculator(closes, exitShortMAPeriod);
    indic.maLongExit = maCalculator(closes, exitLongMAPeriod);
    indic.maExit = maCalculator(closes, exitMAPeriod);

    // === 做空策略 MA 指標 (獨立參數) ===
    if (enableShorting) {
      const shortEntryShortMAPeriod = sep?.shortPeriod || 5;
      const shortEntryLongMAPeriod = sep?.longPeriod || 20;
      const shortExitShortMAPeriod = sxp?.shortPeriod || 5;
      const shortExitLongMAPeriod = sxp?.longPeriod || 20;

      indic.maShortShortEntry = maCalculator(closes, shortEntryShortMAPeriod);
      indic.maLongShortEntry = maCalculator(closes, shortEntryLongMAPeriod);
      indic.maShortCover = maCalculator(closes, shortExitShortMAPeriod);
      indic.maLongCover = maCalculator(closes, shortExitLongMAPeriod);
    }
    const getParam = (longParam, shortParam, defaultVal) => {
      const p1 = longParam;
      const p2 = enableShorting ? shortParam : undefined;
      if (p1 !== undefined && p2 !== undefined && p1 !== p2) {
        return { long: p1 ?? defaultVal, short: p2 ?? defaultVal };
      }
      if (p1 !== undefined) return p1 ?? defaultVal;
      if (p2 !== undefined) return p2 ?? defaultVal;
      return defaultVal;
    };
    const rsiEntryPeriod = getParam(ep?.period, sxp?.period, 14);
    const rsiExitPeriod = getParam(xp?.period, sep?.period, 14);
    indic.rsiEntry = calculateRSI(
      closes,
      typeof rsiEntryPeriod === "object" ? rsiEntryPeriod.long : rsiEntryPeriod,
    );
    indic.rsiExit = calculateRSI(
      closes,
      typeof rsiExitPeriod === "object" ? rsiExitPeriod.long : rsiExitPeriod,
    );
    if (enableShorting) {
      indic.rsiCover = calculateRSI(
        closes,
        typeof rsiEntryPeriod === "object"
          ? rsiEntryPeriod.short
          : rsiEntryPeriod,
      );
      indic.rsiShortEntry = calculateRSI(
        closes,
        typeof rsiExitPeriod === "object" ? rsiExitPeriod.short : rsiExitPeriod,
      );
    }
    const macdEntryShort = ep?.shortPeriod || 12;
    const macdEntryLong = ep?.longPeriod || 26;
    const macdEntrySignal = ep?.signalPeriod || 9;
    const macdCoverShort = enableShorting
      ? (sxp?.shortPeriod ?? macdEntryShort)
      : macdEntryShort;
    const macdCoverLong = enableShorting
      ? (sxp?.longPeriod ?? macdEntryLong)
      : macdEntryLong;
    const macdCoverSignal = enableShorting
      ? (sxp?.signalPeriod ?? macdEntrySignal)
      : macdEntrySignal;
    if (
      !enableShorting ||
      (macdEntryShort === macdCoverShort &&
        macdEntryLong === macdCoverLong &&
        macdEntrySignal === macdCoverSignal)
    ) {
      const macdResult = calculateMACD(
        highs,
        lows,
        closes,
        macdEntryShort,
        macdEntryLong,
        macdEntrySignal,
      );
      indic.macdEntry = macdResult.macd;
      indic.macdSignalEntry = macdResult.signal;
      indic.macdHistEntry = macdResult.histogram;
      if (enableShorting) {
        indic.macdCover = indic.macdEntry;
        indic.macdSignalCover = indic.macdSignalEntry;
        indic.macdHistCover = indic.macdHistEntry;
      }
    } else {
      const macdEntryResult = calculateMACD(
        highs,
        lows,
        closes,
        macdEntryShort,
        macdEntryLong,
        macdEntrySignal,
      );
      indic.macdEntry = macdEntryResult.macd;
      indic.macdSignalEntry = macdEntryResult.signal;
      indic.macdHistEntry = macdEntryResult.histogram;
      const macdCoverResult = calculateMACD(
        highs,
        lows,
        closes,
        macdCoverShort,
        macdCoverLong,
        macdCoverSignal,
      );
      indic.macdCover = macdCoverResult.macd;
      indic.macdSignalCover = macdCoverResult.signal;
      indic.macdHistCover = macdCoverResult.histogram;
    }
    const macdExitShort = xp?.shortPeriod || 12;
    const macdExitLong = xp?.longPeriod || 26;
    const macdExitSignal = xp?.signalPeriod || 9;
    const macdShortEntryShort = enableShorting
      ? (sep?.shortPeriod ?? macdExitShort)
      : macdExitShort;
    const macdShortEntryLong = enableShorting
      ? (sep?.longPeriod ?? macdExitLong)
      : macdExitLong;
    const macdShortEntrySignal = enableShorting
      ? (sep?.signalPeriod ?? macdExitSignal)
      : macdExitSignal;
    if (
      !enableShorting ||
      (macdExitShort === macdShortEntryShort &&
        macdExitLong === macdShortEntryLong &&
        macdExitSignal === macdShortEntrySignal)
    ) {
      const macdResult = calculateMACD(
        highs,
        lows,
        closes,
        macdExitShort,
        macdExitLong,
        macdExitSignal,
      );
      indic.macdExit = macdResult.macd;
      indic.macdSignalExit = macdResult.signal;
      indic.macdHistExit = macdResult.histogram;
      if (enableShorting) {
        indic.macdShortEntry = indic.macdExit;
        indic.macdSignalShortEntry = indic.macdSignalExit;
        indic.macdHistShortEntry = indic.macdHistExit;
      }
    } else {
      const macdExitResult = calculateMACD(
        highs,
        lows,
        closes,
        macdExitShort,
        macdExitLong,
        macdExitSignal,
      );
      indic.macdExit = macdExitResult.macd;
      indic.macdSignalExit = macdExitResult.signal;
      indic.macdHistExit = macdExitResult.histogram;
      const macdShortEntryResult = calculateMACD(
        highs,
        lows,
        closes,
        macdShortEntryShort,
        macdShortEntryLong,
        macdShortEntrySignal,
      );
      indic.macdShortEntry = macdShortEntryResult.macd;
      indic.macdSignalShortEntry = macdShortEntryResult.signal;
      indic.macdHistShortEntry = macdShortEntryResult.histogram;
    }
    const bbEntryPeriod = ep?.period || 20;
    const bbEntryDev = ep?.deviations || 2;
    const bbCoverPeriod = enableShorting
      ? (sxp?.period ?? bbEntryPeriod)
      : bbEntryPeriod;
    const bbCoverDev = enableShorting
      ? (sxp?.deviations ?? bbEntryDev)
      : bbEntryDev;
    if (
      !enableShorting ||
      (bbEntryPeriod === bbCoverPeriod && bbEntryDev === bbCoverDev)
    ) {
      const bbResult = calculateBollingerBands(
        closes,
        bbEntryPeriod,
        bbEntryDev,
      );
      indic.bollingerUpperEntry = bbResult.upper;
      indic.bollingerMiddleEntry = bbResult.middle;
      indic.bollingerLowerEntry = bbResult.lower;
      if (enableShorting) {
        indic.bollingerUpperCover = indic.bollingerUpperEntry;
        indic.bollingerMiddleCover = indic.bollingerMiddleEntry;
        indic.bollingerLowerCover = indic.bollingerLowerEntry;
      }
    } else {
      const bbEntryResult = calculateBollingerBands(
        closes,
        bbEntryPeriod,
        bbEntryDev,
      );
      indic.bollingerUpperEntry = bbEntryResult.upper;
      indic.bollingerMiddleEntry = bbEntryResult.middle;
      indic.bollingerLowerEntry = bbEntryResult.lower;
      const bbCoverResult = calculateBollingerBands(
        closes,
        bbCoverPeriod,
        bbCoverDev,
      );
      indic.bollingerUpperCover = bbCoverResult.upper;
      indic.bollingerMiddleCover = bbCoverResult.middle;
      indic.bollingerLowerCover = bbCoverResult.lower;
    }
    const bbExitPeriod = xp?.period || 20;
    const bbExitDev = xp?.deviations || 2;
    const bbShortEntryPeriod = enableShorting
      ? (sep?.period ?? bbExitPeriod)
      : bbExitPeriod;
    const bbShortEntryDev = enableShorting
      ? (sep?.deviations ?? bbExitDev)
      : bbExitDev;
    if (
      !enableShorting ||
      (bbExitPeriod === bbShortEntryPeriod && bbExitDev === bbShortEntryDev)
    ) {
      const bbResult = calculateBollingerBands(closes, bbExitPeriod, bbExitDev);
      indic.bollingerUpperExit = bbResult.upper;
      indic.bollingerMiddleExit = bbResult.middle;
      indic.bollingerLowerExit = bbResult.lower;
      if (enableShorting) {
        indic.bollingerUpperShortEntry = indic.bollingerUpperExit;
        indic.bollingerMiddleShortEntry = indic.bollingerMiddleExit;
        indic.bollingerLowerShortEntry = indic.bollingerLowerExit;
      }
    } else {
      const bbExitResult = calculateBollingerBands(
        closes,
        bbExitPeriod,
        bbExitDev,
      );
      indic.bollingerUpperExit = bbExitResult.upper;
      indic.bollingerMiddleExit = bbExitResult.middle;
      indic.bollingerLowerExit = bbExitResult.lower;
      const bbShortEntryResult = calculateBollingerBands(
        closes,
        sep?.period || 20,
        sep?.deviations || 2,
      );
      indic.bollingerUpperShortEntry = bbShortEntryResult.upper;
      indic.bollingerMiddleShortEntry = bbShortEntryResult.middle;
      indic.bollingerLowerShortEntry = bbShortEntryResult.lower;
    }
    const kdEntryPeriod = ep?.period || 9;
    const kdCoverPeriod = enableShorting
      ? (sxp?.period ?? kdEntryPeriod)
      : kdEntryPeriod;
    if (!enableShorting || kdEntryPeriod === kdCoverPeriod) {
      const kdResult = calculateKD(highs, lows, closes, kdEntryPeriod);
      indic.kEntry = kdResult.k;
      indic.dEntry = kdResult.d;
      if (enableShorting) {
        indic.kCover = indic.kEntry;
        indic.dCover = indic.dEntry;
      }
    } else {
      const kdEntryResult = calculateKD(highs, lows, closes, kdEntryPeriod);
      indic.kEntry = kdEntryResult.k;
      indic.dEntry = kdEntryResult.d;
      const kdCoverResult = calculateKD(highs, lows, closes, kdCoverPeriod);
      indic.kCover = kdCoverResult.k;
      indic.dCover = kdCoverResult.d;
    }
    const kdExitPeriod = xp?.period || 9;
    const kdShortEntryPeriod = enableShorting
      ? (sep?.period ?? kdExitPeriod)
      : kdExitPeriod;
    if (!enableShorting || kdExitPeriod === kdShortEntryPeriod) {
      const kdResult = calculateKD(highs, lows, closes, kdExitPeriod);
      indic.kExit = kdResult.k;
      indic.dExit = kdResult.d;
      if (enableShorting) {
        indic.kShortEntry = indic.kExit;
        indic.dShortEntry = indic.dExit;
      }
    } else {
      const kdExitResult = calculateKD(highs, lows, closes, kdExitPeriod);
      indic.kExit = kdExitResult.k;
      indic.dExit = kdExitResult.d;
      const kdShortEntryResult = calculateKD(
        highs,
        lows,
        closes,
        kdShortEntryPeriod,
      );
      indic.kShortEntry = kdShortEntryResult.k;
      indic.dShortEntry = kdShortEntryResult.d;
    }
    indic.volumeAvgEntry = maCalculator(volumes, ep?.period || 20);
    const wrEntryPeriod = ep?.period || 14;
    const wrCoverPeriod = enableShorting
      ? (sxp?.period ?? wrEntryPeriod)
      : wrEntryPeriod;
    if (!enableShorting || wrEntryPeriod === wrCoverPeriod) {
      indic.williamsEntry = calculateWilliams(
        highs,
        lows,
        closes,
        wrEntryPeriod,
      );
      if (enableShorting) indic.williamsCover = indic.williamsEntry;
    } else {
      indic.williamsEntry = calculateWilliams(
        highs,
        lows,
        closes,
        wrEntryPeriod,
      );
      indic.williamsCover = calculateWilliams(
        highs,
        lows,
        closes,
        wrCoverPeriod,
      );
    }
    const wrExitPeriod = xp?.period || 14;
    const wrShortEntryPeriod = enableShorting
      ? (sep?.period ?? wrExitPeriod)
      : wrExitPeriod;
    if (!enableShorting || wrExitPeriod === wrShortEntryPeriod) {
      indic.williamsExit = calculateWilliams(highs, lows, closes, wrExitPeriod);
      if (enableShorting) indic.williamsShortEntry = indic.williamsExit;
    } else {
      indic.williamsExit = calculateWilliams(highs, lows, closes, wrExitPeriod);
      indic.williamsShortEntry = calculateWilliams(
        highs,
        lows,
        closes,
        wrShortEntryPeriod,
      );
    }
  } catch (calcError) {
    console.error("[Worker] Indicator calculation error:", calcError);
    throw new Error(`計算技術指標時發生錯誤: ${calcError.message}`);
  }
  self.postMessage({
    type: "progress",
    progress: 65,
    message: "指標計算完成...",
  });
  return indic;
}

function computeRollingExtrema(values, period, type) {
  const length = Array.isArray(values) ? values.length : 0;
  const result = new Array(length).fill(null);
  if (!Number.isFinite(period) || period <= 0) return result;
  const window = [];
  for (let i = 0; i < length; i += 1) {
    const numeric = Number(values[i]);
    const incoming = Number.isFinite(numeric) ? numeric : null;
    window.push(incoming);
    if (window.length > period) {
      window.shift();
    }
    if (window.length === period) {
      let valid = true;
      let extremum = type === "min" ? Infinity : -Infinity;
      for (let j = 0; j < window.length; j += 1) {
        const val = window[j];
        if (!Number.isFinite(val)) {
          valid = false;
          break;
        }
        extremum =
          type === "min" ? Math.min(extremum, val) : Math.max(extremum, val);
      }
      result[i] = valid ? extremum : null;
    }
  }
  return result;
}

function makeIndicatorColumn(label, values, options = {}) {
  return {
    label,
    values: Array.isArray(values) ? values : [],
    format: options.format,
    decimals: options.decimals,
  };
}

function getIndicatorArray(ctx, key) {
  const source = ctx.indicators && ctx.indicators[key];
  if (Array.isArray(source) && source.length === ctx.length) {
    return source;
  }
  if (Array.isArray(source)) {
    const copy = new Array(ctx.length).fill(null);
    for (let i = 0; i < ctx.length && i < source.length; i += 1) {
      copy[i] = source[i];
    }
    return copy;
  }
  return new Array(ctx.length).fill(null);
}

function createIndicatorContext(baseContext, indicators) {
  const data = Array.isArray(baseContext?.data) ? baseContext.data : [];
  const length = data.length;
  const highs =
    Array.isArray(baseContext?.highs) && baseContext.highs.length === length
      ? baseContext.highs
      : data.map((d) => (Number.isFinite(d.high) ? Number(d.high) : null));
  const lows =
    Array.isArray(baseContext?.lows) && baseContext.lows.length === length
      ? baseContext.lows
      : data.map((d) => (Number.isFinite(d.low) ? Number(d.low) : null));
  const closes =
    Array.isArray(baseContext?.closes) && baseContext.closes.length === length
      ? baseContext.closes
      : data.map((d) => (Number.isFinite(d.close) ? Number(d.close) : null));
  const volumes =
    Array.isArray(baseContext?.volumes) && baseContext.volumes.length === length
      ? baseContext.volumes
      : data.map((d) => (Number.isFinite(d.volume) ? Number(d.volume) : null));
  const rollingHighCache = new Map();
  const rollingLowCache = new Map();

  return {
    length,
    indicators,
    highs,
    lows,
    closes,
    volumes,
    longTrailingStops:
      Array.isArray(baseContext?.longTrailingStops) &&
      baseContext.longTrailingStops.length === length
        ? baseContext.longTrailingStops
        : new Array(length).fill(null),
    shortTrailingStops:
      Array.isArray(baseContext?.shortTrailingStops) &&
      baseContext.shortTrailingStops.length === length
        ? baseContext.shortTrailingStops
        : new Array(length).fill(null),
    getRollingHigh(period) {
      const key = Number(period) || 0;
      if (!Number.isFinite(key) || key <= 0) {
        return new Array(length).fill(null);
      }
      if (!rollingHighCache.has(key)) {
        rollingHighCache.set(key, computeRollingExtrema(highs, key, "max"));
      }
      return rollingHighCache.get(key);
    },
    getRollingLow(period) {
      const key = Number(period) || 0;
      if (!Number.isFinite(key) || key <= 0) {
        return new Array(length).fill(null);
      }
      if (!rollingLowCache.has(key)) {
        rollingLowCache.set(key, computeRollingExtrema(lows, key, "min"));
      }
      return rollingLowCache.get(key);
    },
    getVolumeRatio(avgArray) {
      const ratio = new Array(length).fill(null);
      if (!Array.isArray(avgArray)) return ratio;
      for (let i = 0; i < length; i += 1) {
        const avg = avgArray[i];
        const vol = volumes[i];
        if (Number.isFinite(avg) && Number.isFinite(vol) && avg !== 0) {
          ratio[i] = vol / avg;
        } else {
          ratio[i] = null;
        }
      }
      return ratio;
    },
  };
}

const entryIndicatorBuilders = {
  ma_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 5;
    const longPeriod = Number(params?.longPeriod) || 20;
    return [
      makeIndicatorColumn(
        `短SMA(${shortPeriod})`,
        getIndicatorArray(ctx, "maShort"),
      ),
      makeIndicatorColumn(
        `長SMA(${longPeriod})`,
        getIndicatorArray(ctx, "maLong"),
      ),
    ];
  },
  ma_above(params, ctx) {
    const period =
      Number(params?.period) ||
      Number(params?.longPeriod) ||
      Number(params?.shortPeriod) ||
      20;
    return [
      makeIndicatorColumn(
        `SMA(${period})`,
        getIndicatorArray(ctx, "maExit"),
      ),
    ];
  },
  rsi_oversold(params, ctx) {
    return [
      makeIndicatorColumn(
        `RSI(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "rsiEntry"),
        { decimals: 2 },
      ),
    ];
  },
  macd_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 12;
    const longPeriod = Number(params?.longPeriod) || 26;
    const signalPeriod = Number(params?.signalPeriod) || 9;
    return [
      makeIndicatorColumn(
        `DIF(${shortPeriod}/${longPeriod})`,
        getIndicatorArray(ctx, "macdEntry"),
        { decimals: 4 },
      ),
      makeIndicatorColumn(
        `DEA(${signalPeriod})`,
        getIndicatorArray(ctx, "macdSignalEntry"),
        { decimals: 4 },
      ),
    ];
  },
  bollinger_breakout(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `上軌(${period})`,
        getIndicatorArray(ctx, "bollingerUpperEntry"),
        { decimals: 2 },
      ),
      makeIndicatorColumn(
        "中軌",
        getIndicatorArray(ctx, "bollingerMiddleEntry"),
        { decimals: 2 },
      ),
    ];
  },
  k_d_cross(params, ctx) {
    const period = Number(params?.period) || 9;
    return [
      makeIndicatorColumn(
        `K(${period})`,
        getIndicatorArray(ctx, "kEntry"),
        { decimals: 2 },
      ),
      makeIndicatorColumn(
        `D(${period})`,
        getIndicatorArray(ctx, "dEntry"),
        { decimals: 2 },
      ),
    ];
  },
  volume_spike(params, ctx) {
    const period = Number(params?.period) || 20;
    const avg = getIndicatorArray(ctx, "volumeAvgEntry");
    return [
      makeIndicatorColumn(`均量(${period})`, avg, { format: "integer" }),
      makeIndicatorColumn("量比", ctx.getVolumeRatio(avg), { decimals: 2 }),
    ];
  },
  price_breakout(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `${period}日高`,
        ctx.getRollingHigh(period),
        { decimals: 2 },
      ),
    ];
  },
  williams_oversold(params, ctx) {
    return [
      makeIndicatorColumn(
        `%R(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "williamsEntry"),
        { decimals: 2 },
      ),
    ];
  },
  turtle_breakout(params, ctx) {
    const period = Number(params?.breakoutPeriod) || 20;
    return [
      makeIndicatorColumn(
        `${period}日高`,
        ctx.getRollingHigh(period),
        { decimals: 2 },
      ),
    ];
  },
};
entryIndicatorBuilders.ema_cross = entryIndicatorBuilders.ma_cross;

const exitIndicatorBuilders = {
  ma_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 5;
    const longPeriod = Number(params?.longPeriod) || 20;
    return [
      makeIndicatorColumn(
        `短SMA(${shortPeriod})`,
        getIndicatorArray(ctx, "maShortExit"),
      ),
      makeIndicatorColumn(
        `長SMA(${longPeriod})`,
        getIndicatorArray(ctx, "maLongExit"),
      ),
    ];
  },
  ma_below(params, ctx) {
    const period =
      Number(params?.period) ||
      Number(params?.longPeriod) ||
      Number(params?.shortPeriod) ||
      20;
    return [
      makeIndicatorColumn(
        `SMA(${period})`,
        getIndicatorArray(ctx, "maExit"),
      ),
    ];
  },
  rsi_overbought(params, ctx) {
    return [
      makeIndicatorColumn(
        `RSI(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "rsiExit"),
        { decimals: 2 },
      ),
    ];
  },
  macd_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 12;
    const longPeriod = Number(params?.longPeriod) || 26;
    const signalPeriod = Number(params?.signalPeriod) || 9;
    return [
      makeIndicatorColumn(
        `DIF(${shortPeriod}/${longPeriod})`,
        getIndicatorArray(ctx, "macdExit"),
        { decimals: 4 },
      ),
      makeIndicatorColumn(
        `DEA(${signalPeriod})`,
        getIndicatorArray(ctx, "macdSignalExit"),
        { decimals: 4 },
      ),
    ];
  },
  bollinger_reversal(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `中軌(${period})`,
        getIndicatorArray(ctx, "bollingerMiddleExit"),
        { decimals: 2 },
      ),
    ];
  },
  k_d_cross(params, ctx) {
    const period = Number(params?.period) || 9;
    return [
      makeIndicatorColumn(
        `K(${period})`,
        getIndicatorArray(ctx, "kExit"),
        { decimals: 2 },
      ),
      makeIndicatorColumn(
        `D(${period})`,
        getIndicatorArray(ctx, "dExit"),
        { decimals: 2 },
      ),
    ];
  },
  trailing_stop(params, ctx) {
    const pct = Number(params?.percentage) || 5;
    return [
      makeIndicatorColumn(
        `移動停損價(${pct}%)`,
        ctx.longTrailingStops,
        { decimals: 2 },
      ),
    ];
  },
  price_breakdown(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `${period}日低`,
        ctx.getRollingLow(period),
        { decimals: 2 },
      ),
    ];
  },
  williams_overbought(params, ctx) {
    return [
      makeIndicatorColumn(
        `%R(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "williamsExit"),
        { decimals: 2 },
      ),
    ];
  },
  turtle_stop_loss(params, ctx) {
    const period = Number(params?.stopLossPeriod) || 10;
    return [
      makeIndicatorColumn(
        `${period}日低`,
        ctx.getRollingLow(period),
        { decimals: 2 },
      ),
    ];
  },
  fixed_stop_loss() {
    return [];
  },
};
exitIndicatorBuilders.ma_cross_exit = exitIndicatorBuilders.ma_cross;
exitIndicatorBuilders.macd_cross_exit = exitIndicatorBuilders.macd_cross;

const shortEntryIndicatorBuilders = {
  short_ma_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 5;
    const longPeriod = Number(params?.longPeriod) || 20;
    return [
      makeIndicatorColumn(
        `短SMA(${shortPeriod})`,
        getIndicatorArray(ctx, "maShortShortEntry"),
      ),
      makeIndicatorColumn(
        `長SMA(${longPeriod})`,
        getIndicatorArray(ctx, "maLongShortEntry"),
      ),
    ];
  },
  short_ma_below(params, ctx) {
    const period =
      Number(params?.period) ||
      Number(params?.longPeriod) ||
      Number(params?.shortPeriod) ||
      20;
    return [
      makeIndicatorColumn(
        `SMA(${period})`,
        getIndicatorArray(ctx, "maExit"),
      ),
    ];
  },
  short_rsi_overbought(params, ctx) {
    return [
      makeIndicatorColumn(
        `RSI(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "rsiShortEntry"),
        { decimals: 2 },
      ),
    ];
  },
  short_macd_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 12;
    const longPeriod = Number(params?.longPeriod) || 26;
    const signalPeriod = Number(params?.signalPeriod) || 9;
    return [
      makeIndicatorColumn(
        `DIF(${shortPeriod}/${longPeriod})`,
        getIndicatorArray(ctx, "macdShortEntry"),
        { decimals: 4 },
      ),
      makeIndicatorColumn(
        `DEA(${signalPeriod})`,
        getIndicatorArray(ctx, "macdSignalShortEntry"),
        { decimals: 4 },
      ),
    ];
  },
  short_bollinger_reversal(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `中軌(${period})`,
        getIndicatorArray(ctx, "bollingerMiddleShortEntry"),
        { decimals: 2 },
      ),
    ];
  },
  short_k_d_cross(params, ctx) {
    const period = Number(params?.period) || 9;
    return [
      makeIndicatorColumn(
        `K(${period})`,
        getIndicatorArray(ctx, "kShortEntry"),
        { decimals: 2 },
      ),
      makeIndicatorColumn(
        `D(${period})`,
        getIndicatorArray(ctx, "dShortEntry"),
        { decimals: 2 },
      ),
    ];
  },
  short_price_breakdown(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `${period}日低`,
        ctx.getRollingLow(period),
        { decimals: 2 },
      ),
    ];
  },
  short_williams_overbought(params, ctx) {
    return [
      makeIndicatorColumn(
        `%R(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "williamsShortEntry"),
        { decimals: 2 },
      ),
    ];
  },
  short_turtle_stop_loss(params, ctx) {
    const period = Number(params?.stopLossPeriod) || 10;
    return [
      makeIndicatorColumn(
        `${period}日低`,
        ctx.getRollingLow(period),
        { decimals: 2 },
      ),
    ];
  },
};
shortEntryIndicatorBuilders.short_ema_cross =
  shortEntryIndicatorBuilders.short_ma_cross;

const shortExitIndicatorBuilders = {
  cover_ma_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 5;
    const longPeriod = Number(params?.longPeriod) || 20;
    return [
      makeIndicatorColumn(
        `短SMA(${shortPeriod})`,
        getIndicatorArray(ctx, "maShortCover"),
      ),
      makeIndicatorColumn(
        `長SMA(${longPeriod})`,
        getIndicatorArray(ctx, "maLongCover"),
      ),
    ];
  },
  cover_ma_above(params, ctx) {
    const period =
      Number(params?.period) ||
      Number(params?.longPeriod) ||
      Number(params?.shortPeriod) ||
      20;
    return [
      makeIndicatorColumn(
        `SMA(${period})`,
        getIndicatorArray(ctx, "maExit"),
      ),
    ];
  },
  cover_rsi_oversold(params, ctx) {
    return [
      makeIndicatorColumn(
        `RSI(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "rsiCover"),
        { decimals: 2 },
      ),
    ];
  },
  cover_macd_cross(params, ctx) {
    const shortPeriod = Number(params?.shortPeriod) || 12;
    const longPeriod = Number(params?.longPeriod) || 26;
    const signalPeriod = Number(params?.signalPeriod) || 9;
    return [
      makeIndicatorColumn(
        `DIF(${shortPeriod}/${longPeriod})`,
        getIndicatorArray(ctx, "macdCover"),
        { decimals: 4 },
      ),
      makeIndicatorColumn(
        `DEA(${signalPeriod})`,
        getIndicatorArray(ctx, "macdSignalCover"),
        { decimals: 4 },
      ),
    ];
  },
  cover_bollinger_breakout(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `上軌(${period})`,
        getIndicatorArray(ctx, "bollingerUpperCover"),
        { decimals: 2 },
      ),
    ];
  },
  cover_k_d_cross(params, ctx) {
    const period = Number(params?.period) || 9;
    return [
      makeIndicatorColumn(
        `K(${period})`,
        getIndicatorArray(ctx, "kCover"),
        { decimals: 2 },
      ),
      makeIndicatorColumn(
        `D(${period})`,
        getIndicatorArray(ctx, "dCover"),
        { decimals: 2 },
      ),
    ];
  },
  cover_price_breakout(params, ctx) {
    const period = Number(params?.period) || 20;
    return [
      makeIndicatorColumn(
        `${period}日高`,
        ctx.getRollingHigh(period),
        { decimals: 2 },
      ),
    ];
  },
  cover_williams_oversold(params, ctx) {
    return [
      makeIndicatorColumn(
        `%R(${Number(params?.period) || 14})`,
        getIndicatorArray(ctx, "williamsCover"),
        { decimals: 2 },
      ),
    ];
  },
  cover_turtle_breakout(params, ctx) {
    const period = Number(params?.breakoutPeriod) || 20;
    return [
      makeIndicatorColumn(
        `${period}日高`,
        ctx.getRollingHigh(period),
        { decimals: 2 },
      ),
    ];
  },
  cover_trailing_stop(params, ctx) {
    const pct = Number(params?.percentage) || 5;
    return [
      makeIndicatorColumn(
        `移動停損價(${pct}%)`,
        ctx.shortTrailingStops,
        { decimals: 2 },
      ),
    ];
  },
  cover_fixed_stop_loss() {
    return [];
  },
};
shortExitIndicatorBuilders.cover_ema_cross =
  shortExitIndicatorBuilders.cover_ma_cross;

const INDICATOR_BUILDERS = {
  entry: entryIndicatorBuilders,
  exit: exitIndicatorBuilders,
  shortEntry: shortEntryIndicatorBuilders,
  shortExit: shortExitIndicatorBuilders,
};

function buildIndicatorDisplay(params, indicators, baseContext) {
  const ctx = createIndicatorContext(baseContext, indicators);
  const result = {};

  const buildForRole = (slotKey, role, strategyKey, strategyParams) => {
    if (!strategyKey) return;
    const builders = INDICATOR_BUILDERS[role];
    if (!builders) return;
    let builder = builders[strategyKey];
    if (!builder && strategyKey.endsWith("_exit")) {
      builder = builders[strategyKey.replace(/_exit$/, "")];
    }
    if (!builder) return;
    const columns = builder(strategyParams || {}, ctx, params);
    if (Array.isArray(columns) && columns.length > 0) {
      result[slotKey] = {
        strategy: strategyKey,
        columns: columns.map((col) => ({
          label: col.label,
          values: Array.isArray(col.values)
            ? col.values
            : new Array(ctx.length).fill(null),
          format: col.format,
          decimals: col.decimals,
        })),
      };
    }
  };

  buildForRole("longEntry", "entry", params.entryStrategy, params.entryParams);
  buildForRole("longExit", "exit", params.exitStrategy, params.exitParams);
  if (params.enableShorting) {
    buildForRole(
      "shortEntry",
      "shortEntry",
      params.shortEntryStrategy,
      params.shortEntryParams,
    );
    buildForRole(
      "shortExit",
      "shortExit",
      params.shortExitStrategy,
      params.shortExitParams,
    );
  }

  return result;
}

function sliceIndicatorDisplay(series, startIndex) {
  if (!series || typeof series !== "object") return {};
  const keys = ["longEntry", "longExit", "shortEntry", "shortExit"];
  const result = {};
  keys.forEach((key) => {
    const entry = series[key];
    if (entry && Array.isArray(entry.columns)) {
      result[key] = {
        strategy: entry.strategy,
        columns: entry.columns.map((col) => ({
          label: col.label,
          format: col.format,
          decimals: col.decimals,
          values: Array.isArray(col.values)
            ? col.values.slice(startIndex)
            : [],
        })),
      };
    }
  });
  return result;
}

function computeTrailingStopLevels(
  longStates,
  shortStates,
  highs,
  lows,
  options,
) {
  const length = Array.isArray(longStates) ? longStates.length : 0;
  const longLevels = new Array(length).fill(null);
  const shortLevels = new Array(length).fill(null);
  const longPctRaw =
    options?.exitStrategy === "trailing_stop"
      ? Number(options?.exitParams?.percentage ?? 5)
      : null;
  if (Number.isFinite(longPctRaw)) {
    let peak = null;
    for (let i = 0; i < length; i += 1) {
      const state = longStates[i];
      const active =
        state === "持有" || state === "進場" || state === "出場";
      if (active && Number.isFinite(highs?.[i])) {
        peak = peak !== null ? Math.max(peak, highs[i]) : highs[i];
      }
      if (active && Number.isFinite(peak)) {
        longLevels[i] = peak * (1 - longPctRaw / 100);
      }
      if (state === "出場" || state === "空手") {
        peak = null;
      }
    }
  }

  const shortPctRaw =
    options?.enableShorting &&
    options?.shortExitStrategy === "cover_trailing_stop"
      ? Number(options?.shortExitParams?.percentage ?? 5)
      : null;
  if (Number.isFinite(shortPctRaw)) {
    let trough = null;
    for (let i = 0; i < length; i += 1) {
      const state = shortStates[i];
      const active =
        state === "持有" || state === "進場" || state === "出場";
      if (active && Number.isFinite(lows?.[i])) {
        trough = trough !== null ? Math.min(trough, lows[i]) : lows[i];
      }
      if (active && Number.isFinite(trough)) {
        shortLevels[i] = trough * (1 + shortPctRaw / 100);
      }
      if (state === "出場" || state === "空手") {
        trough = null;
      }
    }
  }

  return { longLevels, shortLevels };
}

function combinePositionLabel(longState, shortState) {
  const parts = [];
  if (longState && longState !== "空手") {
    parts.push(`多單${longState}`);
  }
  if (shortState && shortState !== "空手") {
    parts.push(`空單${shortState}`);
  }
  if (parts.length === 0) return "空手";
  return parts.join("｜");
}

// --- 運行策略回測 (修正年化報酬率計算) ---
function runStrategy(data, params, options = {}) {
  // --- 新增的保護機制 ---
  if (!Array.isArray(data)) {
    // 如果傳進來的不是陣列，就拋出一個更明確的錯誤
    console.error("傳遞給 runStrategy 的資料格式錯誤，收到了:", data);
    throw new TypeError("傳遞給 runStrategy 的資料格式錯誤，必須是陣列。");
  }
  const { suppressProgress = false, skipSensitivity = false } =
    typeof options === "object" && options !== null ? options : {};
  // --- 保護機制結束 ---

  if (!suppressProgress) {
    self.postMessage({
      type: "progress",
      progress: 70,
      message: "回測模擬中...",
    });
  }
  const n = data.length;
  const { forceFinalLiquidation = true, captureFinalState = false } =
    typeof options === "object" && options ? options : {};
  let finalEvaluation = null;
  let finalEvaluationIndex = null;
  let lastValidEvaluation = null;
  let lastValidEvaluationIndex = null;
  let finalEvaluationFallbackReason = null;
  let finalEvaluationFallbackMeta = null;
  let finalStateReason = null;
  let finalStateFallback = null;
  const lastIdx = n - 1;
  // 初始化隔日交易追蹤
  pendingNextDayTrade = null;
    const {
      initialCapital,
      positionSize,
      stopLoss: globalSL,
      takeProfit: globalTP,
      entryStrategy,
      exitStrategy,
      entryParams,
      entryStages,
      entryStagingMode,
      exitParams,
      exitStages,
      exitStagingMode,
      enableShorting,
      shortEntryStrategy,
      shortExitStrategy,
      shortEntryParams,
      shortExitParams,
      tradeTiming,
      buyFee,
      sellFee,
      positionBasis,
    } = params;

    const entryStagePercentsRaw = Array.isArray(entryStages)
      ? entryStages.map((value) => Number(value))
      : [];
    const entryStagePercents = entryStagePercentsRaw.filter(
      (value) => Number.isFinite(value) && value > 0,
    );
    if (entryStagePercents.length === 0) {
      entryStagePercents.push(positionSize);
    }
    const entryStageMode =
      typeof entryStagingMode === "string" ? entryStagingMode : "signal_repeat";

    const exitStagePercentsRaw = Array.isArray(exitStages)
      ? exitStages.map((value) => Number(value))
      : [];
    const exitStagePercents = exitStagePercentsRaw.filter(
      (value) => Number.isFinite(value) && value > 0,
    );
    if (exitStagePercents.length === 0) {
      exitStagePercents.push(100);
    }
    const exitStageMode =
      typeof exitStagingMode === "string" ? exitStagingMode : "signal_repeat";

  if (!data || n === 0) throw new Error("回測數據無效");
  const dates = data.map((d) => d.date);
  const opens = data.map((d) => d.open);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const closes = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume);
  const userStartISO = params.originalStartDate || params.startDate || null;
  const effectiveStartISO = params.effectiveStartDate || params.startDate || null;
  const datasetSummary = summariseDatasetRows(data, {
    requestedStart: userStartISO,
    effectiveStartDate: effectiveStartISO,
    warmupStartDate: params.dataStartDate || null,
    dataStartDate: params.dataStartDate || null,
    endDate: params.endDate || null,
  });
  if (
    Number.isFinite(datasetSummary?.firstValidCloseGapFromEffective) &&
    datasetSummary.firstValidCloseGapFromEffective > 1
  ) {
    console.warn(
      `[Worker] ${params.stockNo} 於暖身後首個有效收盤價落後 ${datasetSummary.firstValidCloseGapFromEffective} 天。`,
    );
  }
  if (datasetSummary?.invalidRowsInRange?.count > 0) {
    const reasonText = formatReasonCountMap(
      datasetSummary.invalidRowsInRange.reasons,
    );
    console.warn(
      `[Worker] ${params.stockNo} 區間內偵測到 ${datasetSummary.invalidRowsInRange.count} 筆無效資料。原因統計: ${reasonText}`,
    );
    if (
      Array.isArray(datasetSummary.invalidRowsInRange.samples) &&
      datasetSummary.invalidRowsInRange.samples.length > 0 &&
      typeof console.table === "function"
    ) {
      const invalidTable = datasetSummary.invalidRowsInRange.samples.map(
        (sample) => ({
          index: sample.index,
          date: sample.date,
          reasons: Array.isArray(sample.reasons)
            ? sample.reasons.join(", ")
            : sample.reasons,
          close: sample.close,
          volume: sample.volume,
        }),
      );
      console.table(invalidTable);
    }
  }
  let effectiveStartIdx = 0;
  if (effectiveStartISO) {
    const foundIndex = dates.findIndex(
      (date) => typeof date === "string" && date >= effectiveStartISO,
    );
    effectiveStartIdx = foundIndex >= 0 ? foundIndex : 0;
  }
  const previewRows = [];
  if (Number.isFinite(datasetSummary?.firstRowOnOrAfterEffectiveStart?.index)) {
    const previewStart = Math.max(
      0,
      datasetSummary.firstRowOnOrAfterEffectiveStart.index - 2,
    );
    const previewEnd = Math.min(n, previewStart + 6);
    for (let idx = previewStart; idx < previewEnd; idx += 1) {
      const row = data[idx];
      if (!row) continue;
      previewRows.push({
        index: idx,
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      });
    }
    if (previewRows.length > 0 && typeof console.table === "function") {
      console.table(
        previewRows,
        ["index", "date", "open", "high", "low", "close", "volume"],
      );
    }
  }
  const positionStatesFull = new Array(n).fill("空手");
  const longStateSeries = new Array(n).fill("空手");
  const shortStateSeries = new Array(n).fill("空手");
  let indicatorDisplayFull = {};
  let indicators;
  try {
    indicators = calculateAllIndicators(data, params);
  } catch (e) {
    throw e;
  }

  const pluginRegistry =
    typeof self !== 'undefined' && self.StrategyPluginRegistry
      ? self.StrategyPluginRegistry
      : null;
  const pluginCacheStore = new Map();
  const pluginRuntimeInfo = {
    warmupStartIndex: Number.isFinite(
      datasetSummary?.firstRowOnOrAfterWarmupStart?.index,
    )
      ? datasetSummary.firstRowOnOrAfterWarmupStart.index
      : 0,
    effectiveStartIndex: effectiveStartIdx,
    length: n,
  };
  const pluginSeries = {
    close: closes,
    open: opens,
    high: highs,
    low: lows,
    date: dates,
  };

  function callStrategyPlugin(strategyId, role, index, baseParams, extras) {
    if (
      !pluginRegistry ||
      typeof pluginRegistry.get !== 'function' ||
      typeof StrategyPluginContract === 'undefined' ||
      typeof StrategyPluginContract.ensureRuleResult !== 'function'
    ) {
      return null;
    }
    const plugin = pluginRegistry.get(strategyId);
    if (!plugin || typeof plugin.run !== 'function') {
      return null;
    }
    let cache = pluginCacheStore.get(strategyId);
    if (!cache) {
      cache = new Map();
      pluginCacheStore.set(strategyId, cache);
    }
    const helpers = {
      getIndicator(key) {
        const source = indicators?.[key];
        return Array.isArray(source) ? source : undefined;
      },
      log(message, details) {
        if (typeof console !== 'undefined' && typeof console.debug === 'function') {
          if (details) console.debug(`[StrategyPlugin:${strategyId}] ${message}`, details);
          else console.debug(`[StrategyPlugin:${strategyId}] ${message}`);
        }
      },
      setCache(key, value) {
        cache.set(key, value);
      },
      getCache(key) {
        return cache.get(key);
      },
    };
    const pluginParams =
      extras && typeof extras === 'object'
        ? { ...(baseParams || {}), __runtime: extras }
        : { ...(baseParams || {}) };
    try {
      const rawResult = plugin.run(
        {
          role,
          index,
          series: pluginSeries,
          helpers,
          runtime: pluginRuntimeInfo,
        },
        pluginParams,
      );
      return StrategyPluginContract.ensureRuleResult(rawResult, {
        pluginId: strategyId,
        role,
        index,
      });
    } catch (pluginError) {
      console.error(`[StrategyPlugin:${strategyId}] 執行失敗`, pluginError);
      return null;
    }
  }

  const check = (v) => v !== null && !isNaN(v) && isFinite(v);
  const warmupSummary = {
    requestedStart: userStartISO,
    effectiveStartDate: effectiveStartISO,
    dataStartDate: params.dataStartDate || null,
    warmupStartDate: params.dataStartDate || null,
    lookbackDays: params.lookbackDays || null,
    longestLookback: 0,
    kdNeedLong: 0,
    kdNeedShort: 0,
    macdNeedLong: 0,
    macdNeedShort: 0,
    computedStartIndex: null,
    effectiveStartIndex: effectiveStartIdx,
    barsBeforeFirstTrade: null,
    totalBars: n,
    previewRows: [],
  };
  let allPeriods = [
    entryParams?.shortPeriod,
    entryParams?.longPeriod,
    entryParams?.period,
    entryParams?.breakoutPeriod,
    entryParams?.signalPeriod,
    exitParams?.shortPeriod,
    exitParams?.longPeriod,
    exitParams?.period,
    exitParams?.stopLossPeriod,
    exitParams?.signalPeriod,
    exitParams?.percentage,
    9,
    14,
    20,
    26,
  ];
  if (enableShorting) {
    allPeriods = allPeriods.concat([
      shortEntryParams?.shortPeriod,
      shortEntryParams?.longPeriod,
      shortEntryParams?.period,
      shortEntryParams?.stopLossPeriod,
      shortEntryParams?.signalPeriod,
      shortExitParams?.shortPeriod,
      shortExitParams?.longPeriod,
      shortExitParams?.period,
      shortExitParams?.breakoutPeriod,
      shortExitParams?.signalPeriod,
      shortExitParams?.percentage,
    ]);
  }
  const validPeriods = allPeriods.filter(
    (p) => typeof p === "number" && p > 0 && isFinite(p),
  );
  const longestLookback =
    validPeriods.length > 0 ? Math.max(...validPeriods) : 0;
  warmupSummary.longestLookback = longestLookback;
  const kdNeedLong =
    entryStrategy === "k_d_cross" || exitStrategy === "k_d_cross_exit"
      ? entryParams?.period || exitParams?.period || 9
      : 0;
  warmupSummary.kdNeedLong = kdNeedLong;
  const kdNeedShort =
    enableShorting &&
    (shortEntryStrategy === "short_k_d_cross" ||
      shortExitStrategy === "cover_k_d_cross")
      ? shortEntryParams?.period || shortExitParams?.period || 9
      : 0;
  warmupSummary.kdNeedShort = kdNeedShort;
  const macdNeedLong =
    entryStrategy === "macd_cross" || exitStrategy === "macd_cross_exit"
      ? (entryParams?.longPeriod || exitParams?.longPeriod || 26) +
        (entryParams?.signalPeriod || exitParams?.signalPeriod || 9) -
        1
      : 0;
  warmupSummary.macdNeedLong = macdNeedLong;
  const macdNeedShort =
    enableShorting &&
    (shortEntryStrategy === "short_macd_cross" ||
      shortExitStrategy === "cover_macd_cross")
      ? (shortEntryParams?.longPeriod || shortExitParams?.longPeriod || 26) +
        (shortEntryParams?.signalPeriod || shortExitParams?.signalPeriod || 9) -
        1
      : 0;
  warmupSummary.macdNeedShort = macdNeedShort;
  let startIdx = Math.max(
    1,
    longestLookback,
    kdNeedLong,
    kdNeedShort,
    macdNeedLong,
    macdNeedShort,
  );
  startIdx = Math.min(startIdx, n - 1);
  startIdx = Math.max(startIdx, effectiveStartIdx);
  startIdx = Math.min(startIdx, n - 1);
  startIdx = Math.max(1, startIdx);
  warmupSummary.computedStartIndex = startIdx;
  warmupSummary.effectiveStartIndex = effectiveStartIdx;
  warmupSummary.barsBeforeFirstTrade = Math.max(
    0,
    startIdx - effectiveStartIdx,
  );
  warmupSummary.previewRows = previewRows.slice(0, 6);
  warmupSummary.firstValidCloseGapFromWarmup =
    datasetSummary.firstValidCloseGapFromWarmup;
  warmupSummary.firstValidVolumeGapFromWarmup =
    datasetSummary.firstValidVolumeGapFromWarmup;

  const portfolioVal = Array(n).fill(initialCapital);
  const strategyReturns = Array(n).fill(0);
  let peakCap = initialCapital;
  let maxDD = 0;
  let allTrades = [];
  let allCompletedTrades = [];
  let totalWinTrades = 0;
  let curCL = 0;
  let maxCL = 0;
  let longCap = initialCapital;
  let longPos = 0;
  let longShares = 0;
  let lastBuyP = 0;
  let curPeakP = 0;
    let longTrades = [];
    let longCompletedTrades = [];
    let currentLongEntryBreakdown = [];
    let longPositionCostWithFee = 0;
    let longPositionCostWithoutFee = 0;
    let longAverageEntryPrice = 0;
    let filledEntryStages = 0;
    let currentLongPositionId = null;
    let nextLongPositionId = 1;
    let filledExitStages = 0;
    let lastLongStagePrice = null;
    let lastEntryStageTrigger = null;
    let lastLongExitStagePrice = null;
    let lastExitStageTrigger = null;
    let currentLongExitPlan = null;
    let resetExitPlanAfterCapture = false;
    const longEntryStageStates = new Array(n).fill(null);
    const longExitStageStates = new Array(n).fill(null);
  const buySigs = [];
  const sellSigs = [];
  const longPl = Array(n).fill(0);
  let shortCap = enableShorting ? initialCapital : 0;
  let shortPos = 0;
  let shortShares = 0;
  let lastShortP = 0;
  let currentLowSinceShort = Infinity;
  let shortTrades = [];
  let shortCompletedTrades = [];
  const shortSigs = [];
  const coverSigs = [];
  const shortPl = Array(n).fill(0);

  if (startIdx >= n || n < 2) {
    return {
      stockNo: params.stockNo,
      initialCapital: initialCapital,
      finalValue: initialCapital,
      totalProfit: 0,
      returnRate: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      winTrades: 0,
      tradesCount: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxConsecutiveLosses: 0,
      trades: [],
      completedTrades: [],
      buyHoldReturns: Array(n).fill(0),
      strategyReturns: Array(n).fill(0),
      dates: dates,
        chartBuySignals: [],
        chartSellSignals: [],
        chartShortSignals: [],
        chartCoverSignals: [],
        entryStrategy: params.entryStrategy,
        exitStrategy: params.exitStrategy,
        entryParams: params.entryParams,
        entryStages: entryStagePercents.slice(),
        exitParams: params.exitParams,
      enableShorting: params.enableShorting,
      shortEntryStrategy: params.shortEntryStrategy,
      shortExitStrategy: params.shortExitStrategy,
      shortEntryParams: params.shortEntryParams,
      shortExitParams: params.shortExitParams,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      tradeTiming: params.tradeTiming,
      buyFee: params.buyFee,
      sellFee: params.sellFee,
      positionBasis: params.positionBasis,
      rawData: data,
      buyHoldAnnualizedReturn: 0,
      subPeriodResults: {},
      annReturnHalf1: null,
      sharpeHalf1: null,
      annReturnHalf2: null,
      sharpeHalf2: null,
    };
  }

    console.log(
      `[Worker] Starting simulation loop from index ${startIdx} to ${n - 1}`,
    );

    const executeLongStage = ({
      tradePrice,
      tradeDate,
      stageIndex,
      baseCapitalForSizing,
      investmentLimitOverride,
      strategyKey,
      signalIndex,
      kdValues,
      macdValues,
      indicatorValues,
      trigger,
    }) => {
      if (!Number.isFinite(tradePrice) || tradePrice <= 0) {
        return { executed: false };
      }

      const adjustedTradePrice = tradePrice * (1 + buyFee / 100);
      if (!Number.isFinite(adjustedTradePrice) || adjustedTradePrice <= 0) {
        return { executed: false };
      }

      const resolvedStageIndex = Number.isInteger(stageIndex) && stageIndex >= 0
        ? Math.min(stageIndex, entryStagePercents.length - 1)
        : Math.min(filledEntryStages, entryStagePercents.length - 1);
      const stagePercent = entryStagePercents[resolvedStageIndex];
      if (!Number.isFinite(stagePercent) || stagePercent <= 0) {
        return { executed: false };
      }

      let spendingLimit = Number.isFinite(investmentLimitOverride)
        ? Math.min(longCap, investmentLimitOverride)
        : null;
      if (!Number.isFinite(spendingLimit) || spendingLimit <= 0) {
        const base = Number.isFinite(baseCapitalForSizing) && baseCapitalForSizing > 0
          ? baseCapitalForSizing
          : initialCapital;
        spendingLimit = Math.min(longCap, base * (stagePercent / 100));
      }
      if (!Number.isFinite(spendingLimit) || spendingLimit <= 0) {
        return { executed: false };
      }

      const stageShares = Math.floor(spendingLimit / adjustedTradePrice);
      if (!Number.isFinite(stageShares) || stageShares <= 0) {
        return { executed: false };
      }

      const stageCostWithFee = stageShares * adjustedTradePrice;
      if (!Number.isFinite(stageCostWithFee) || stageCostWithFee <= 0) {
        return { executed: false };
      }
      if (longCap + 1e-9 < stageCostWithFee) {
        return { executed: false };
      }

      const stageCostWithoutFee = stageShares * tradePrice;
      longCap -= stageCostWithFee;
      longPositionCostWithFee += stageCostWithFee;
      longPositionCostWithoutFee += stageCostWithoutFee;
      longShares += stageShares;
      longPos = 1;
      if (!currentLongPositionId) {
        currentLongPositionId = nextLongPositionId;
        nextLongPositionId += 1;
      }
      filledEntryStages = Math.min(filledEntryStages + 1, entryStagePercents.length);
      longAverageEntryPrice =
        longShares > 0 ? longPositionCostWithoutFee / longShares : 0;
      lastBuyP = longAverageEntryPrice;
      curPeakP = Math.max(curPeakP || 0, tradePrice);

      const cumulativePercent = currentLongEntryBreakdown.reduce(
        (sum, info) => sum + (info.allocationPercent || 0),
        0,
      ) + stagePercent;

      const stageTrigger =
        typeof trigger === "string" ? trigger : "signal";

      const stageSnapshot = {
        type: "buy",
        date: tradeDate,
        price: tradePrice,
        shares: stageShares,
        cost: stageCostWithFee,
        costWithoutFee: stageCostWithoutFee,
        allocationPercent: stagePercent,
        cumulativeStagePercent: cumulativePercent,
        capital_after: longCap,
        triggeringStrategy: strategyKey,
        simType: "long",
        positionId: currentLongPositionId,
        stageTrigger,
        originalShares: stageShares,
        originalCost: stageCostWithFee,
        originalCostWithoutFee: stageCostWithoutFee,
        remainingShares: stageShares,
        remainingCost: stageCostWithFee,
        remainingCostWithoutFee: stageCostWithoutFee,
        stageIndex: resolvedStageIndex,
      };
      if (kdValues) stageSnapshot.kdValues = kdValues;
      if (macdValues) stageSnapshot.macdValues = macdValues;
      if (indicatorValues) stageSnapshot.indicatorValues = indicatorValues;

      currentLongEntryBreakdown.push({ ...stageSnapshot });
      longTrades.push({ ...stageSnapshot });
      if (Number.isInteger(signalIndex) && signalIndex >= 0) {
        buySigs.push({ date: tradeDate, index: signalIndex });
      }

      console.log(
        `[Worker LONG] Stage ${resolvedStageIndex + 1}/${entryStagePercents.length} Buy Executed: ${stageShares}@${tradePrice} on ${tradeDate}, Cap After: ${longCap.toFixed(0)}`,
      );

      lastLongStagePrice = tradePrice;
      lastEntryStageTrigger = stageTrigger;
      filledExitStages = 0;
      currentLongExitPlan = null;
      lastLongExitStagePrice = null;
      lastExitStageTrigger = null;

      return { executed: true, shares: stageShares, tradeData: stageSnapshot };
    };

    const buildAggregatedLongEntry = () => {
      if (currentLongEntryBreakdown.length === 0) return null;
      const totalShares = currentLongEntryBreakdown.reduce(
        (sum, info) => sum + (info.originalShares || info.shares || 0),
        0,
      );
      const totalPercent = currentLongEntryBreakdown.reduce(
        (sum, info) => sum + (info.allocationPercent || 0),
        0,
      );
      const totalCostWithFee = currentLongEntryBreakdown.reduce(
        (sum, info) =>
          sum + (info.originalCost ?? info.cost ?? info.remainingCost ?? 0),
        0,
      );
      const totalCostWithoutFee = currentLongEntryBreakdown.reduce(
        (sum, info) =>
          sum +
          (info.originalCostWithoutFee ??
            info.costWithoutFee ??
            info.remainingCostWithoutFee ??
            0),
        0,
      );
      const averageEntryPrice =
        totalShares > 0 ? totalCostWithoutFee / totalShares : 0;
      return {
        type: "buy",
        date: currentLongEntryBreakdown[0]?.date || null,
        price: averageEntryPrice,
        shares: totalShares,
        cost: totalCostWithFee,
        costWithoutFee: totalCostWithoutFee,
        averageEntryPrice,
        stageCount: currentLongEntryBreakdown.length,
        cumulativeStagePercent: totalPercent,
        stages: currentLongEntryBreakdown.map((info) => ({ ...info })),
        positionId: currentLongPositionId,
      };
    };

    const computeExitStagePlan = (totalShares) => {
      if (!Number.isFinite(totalShares) || totalShares <= 0) return null;
      const plan = [];
      let allocated = 0;
      for (let idx = 0; idx < exitStagePercents.length; idx += 1) {
        if (idx === exitStagePercents.length - 1) {
          plan.push(Math.max(totalShares - allocated, 0));
          break;
        }
        let stageShare = Math.floor((totalShares * exitStagePercents[idx]) / 100);
        const remainingStages = exitStagePercents.length - idx;
        const remainingShares = totalShares - allocated;
        if (stageShare <= 0 && remainingShares > remainingStages) {
          stageShare = 1;
        }
        plan.push(stageShare);
        allocated += stageShare;
      }
      if (plan.length < exitStagePercents.length) {
        const lastShare = Math.max(totalShares - plan.reduce((sum, val) => sum + val, 0), 0);
        plan.push(lastShare);
      }
      const sumShares = plan.reduce((sum, val) => sum + val, 0);
      if (sumShares !== totalShares && plan.length > 0) {
        plan[plan.length - 1] += totalShares - sumShares;
      }
      return plan;
    };

    const consumeEntryForShares = (sharesToConsume) => {
      if (!Number.isFinite(sharesToConsume) || sharesToConsume <= 0) return null;
      let remaining = sharesToConsume;
      let totalCostWithFee = 0;
      let totalCostWithoutFee = 0;
      const stages = [];
      for (const stage of currentLongEntryBreakdown) {
        const availableShares = stage.remainingShares ?? stage.shares ?? 0;
        if (!Number.isFinite(availableShares) || availableShares <= 0) continue;
        const take = Math.min(availableShares, remaining);
        if (take <= 0) continue;
        const availableCost = stage.remainingCost ?? stage.cost ?? 0;
        const availableCostWithoutFee = stage.remainingCostWithoutFee ?? stage.costWithoutFee ?? 0;
        const costPerShareWithFee = availableShares > 0 ? availableCost / availableShares : 0;
        const costPerShareWithoutFee = availableShares > 0 ? availableCostWithoutFee / availableShares : 0;
        const consumedCostWithFee = costPerShareWithFee * take;
        const consumedCostWithoutFee = costPerShareWithoutFee * take;
        stage.remainingShares = availableShares - take;
        stage.remainingCost = availableCost - consumedCostWithFee;
        stage.remainingCostWithoutFee = availableCostWithoutFee - consumedCostWithoutFee;
        totalCostWithFee += consumedCostWithFee;
        totalCostWithoutFee += consumedCostWithoutFee;
        stages.push({
          date: stage.date,
          price: stage.price,
          shares: take,
          cost: consumedCostWithFee,
          costWithoutFee: consumedCostWithoutFee,
          allocationPercent: stage.allocationPercent,
          stageTrigger: stage.stageTrigger,
          stageIndex: stage.stageIndex,
        });
        remaining -= take;
        if (remaining <= 0) break;
      }
      const consumedShares = sharesToConsume - remaining;
      return {
        shares: consumedShares,
        cost: totalCostWithFee,
        costWithoutFee: totalCostWithoutFee,
        averageEntryPrice:
          consumedShares > 0 ? totalCostWithoutFee / consumedShares : 0,
        stages,
      };
    };

    const captureEntryStageState = () => ({
      totalStages: entryStagePercents.length,
      filledStages: filledEntryStages,
      sharesHeld: longShares,
      averageEntryPrice: longShares > 0 ? longAverageEntryPrice : null,
      lastStagePrice: Number.isFinite(lastLongStagePrice)
        ? lastLongStagePrice
        : null,
      lastTrigger: lastEntryStageTrigger || null,
      mode: entryStageMode,
      nextTriggerPrice:
        entryStageMode === "price_pullback" &&
        filledEntryStages < entryStagePercents.length &&
        Number.isFinite(lastLongStagePrice)
          ? lastLongStagePrice
          : null,
    });

    const captureExitStageState = () => ({
      totalStages: exitStagePercents.length,
      executedStages: filledExitStages,
      remainingShares: longShares,
      lastStagePrice: Number.isFinite(lastLongExitStagePrice)
        ? lastLongExitStagePrice
        : null,
      lastTrigger: lastExitStageTrigger || null,
      mode: exitStageMode,
      nextTriggerPrice:
        exitStageMode === "price_rally" &&
        filledExitStages < exitStagePercents.length &&
        Number.isFinite(lastLongExitStagePrice)
          ? lastLongExitStagePrice
          : null,
    });
  for (let i = startIdx; i < n; i++) {
    const curC = closes[i];
    const curH = highs[i];
    const curL = lows[i];
    const curV = volumes[i];
    const curO = opens[i];
    const prevC = i > 0 ? closes[i - 1] : null;
    const nextO = i + 1 < n ? opens[i + 1] : null;
    let executedBuy = false;
    let executedSell = false;
    let executedShort = false;
    let executedCover = false;
    let longState = longPos === 1 ? "持有" : "空手";
    let shortState = shortPos === 1 ? "持有" : "空手";
    longPl[i] = longPl[i - 1] ?? 0;
    shortPl[i] = shortPl[i - 1] ?? 0;
    if (!check(curC) || curC <= 0) {
      longStateSeries[i] = longState;
      shortStateSeries[i] = shortState;
      positionStatesFull[i] = combinePositionLabel(longState, shortState);
      longEntryStageStates[i] = captureEntryStageState();
      longExitStageStates[i] = captureExitStageState();
      portfolioVal[i] = portfolioVal[i - 1] ?? initialCapital;
      strategyReturns[i] = strategyReturns[i - 1] ?? 0;
      continue;
    }
    let tradePrice = null;
    let tradeDate = dates[i];
    let canTradeOpen = tradeTiming === "open" && i + 1 < n && check(nextO);

    // 修正：處理前一日的隔日開盤價交易執行
    if (i > startIdx && tradeTiming === "open") {
      // 檢查是否有前一日的隔日交易需要執行
      const pendingTrade = pendingNextDayTrade;
      if (pendingTrade && pendingTrade.executeOnDate === dates[i]) {
        const actualTradePrice = curO;

          if (pendingTrade.type === "buy") {
            const stageIndex =
              Number.isInteger(pendingTrade.stageIndex) && pendingTrade.stageIndex >= 0
                ? pendingTrade.stageIndex
                : filledEntryStages;
            const result = executeLongStage({
              tradePrice: actualTradePrice,
              tradeDate: dates[i],
              stageIndex,
              investmentLimitOverride: pendingTrade.investmentLimit,
              strategyKey: pendingTrade.strategy,
              signalIndex: i,
              kdValues: pendingTrade.kdValues,
              macdValues: pendingTrade.macdValues,
              indicatorValues: pendingTrade.indicatorValues,
              trigger: pendingTrade.stageTrigger,
            });
            if (result.executed) {
              executedBuy = true;
            }
          } else if (pendingTrade.type === "short") {
          // 執行隔日做空
          const actualAdjustedPrice = actualTradePrice * (1 + buyFee / 100);
          const actualShares = Math.floor(
            pendingTrade.investmentLimit / actualAdjustedPrice,
          );

          if (actualShares > 0) {
            const shortValue = actualShares * actualTradePrice;
            const shortProceeds = shortValue * (1 - sellFee / 100);
            shortPos = 1;
            lastShortP = actualTradePrice;
            currentLowSinceShort = actualTradePrice;
            shortShares = actualShares;

            const tradeData = {
              type: "short",
              date: dates[i],
              price: actualTradePrice,
              shares: actualShares,
              cost: shortValue,
              capital_after: shortCap,
              triggeringStrategy: pendingTrade.strategy,
              simType: "short",
            };

            // 添加指標值資訊
            if (pendingTrade.kdValues)
              tradeData.kdValues = pendingTrade.kdValues;
            if (pendingTrade.macdValues)
              tradeData.macdValues = pendingTrade.macdValues;
            if (pendingTrade.indicatorValues)
              tradeData.indicatorValues = pendingTrade.indicatorValues;

            shortTrades.push(tradeData);
            shortSigs.push({ date: dates[i], index: i });
            console.log(
              `[Worker SHORT] Delayed Short Executed: ${shortShares}@${actualTradePrice} on ${dates[i]}, Cap Before Cover: ${shortCap.toFixed(0)}`,
            );
            executedShort = true;
          }
        }
        pendingNextDayTrade = null;
      }
    }

    if (longPos === 1) {
      try {
        let sellSignal = false;
        let slTrig = false;
        let tpTrig = false;
        let exitKDValues = null,
          exitMACDValues = null,
          exitIndicatorValues = null;
        let exitRuleResult = null;
        switch (exitStrategy) {
          case "ma_cross":
          case "ema_cross":
            {
              const pluginResult = callStrategyPlugin(
                exitStrategy,
                'longExit',
                i,
                exitParams,
              );
              if (pluginResult) {
                sellSignal = pluginResult.exit === true;
                exitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!exitIndicatorValues && meta.indicatorValues)
                  exitIndicatorValues = meta.indicatorValues;
                break;
              }
              sellSignal =
                check(indicators.maShortExit[i]) &&
                check(indicators.maLongExit[i]) &&
                check(indicators.maShortExit[i - 1]) &&
                check(indicators.maLongExit[i - 1]) &&
                indicators.maShortExit[i] < indicators.maLongExit[i] &&
                indicators.maShortExit[i - 1] >= indicators.maLongExit[i - 1];
              if (sellSignal)
                exitIndicatorValues = {
                  短SMA: [
                    indicators.maShortExit[i - 1],
                    indicators.maShortExit[i],
                    indicators.maShortExit[i + 1] ?? null,
                  ],
                  長SMA: [
                    indicators.maLongExit[i - 1],
                    indicators.maLongExit[i],
                    indicators.maLongExit[i + 1] ?? null,
                  ],
                };
              break;
            }
          case "ma_below":
            sellSignal =
              check(indicators.maExit[i]) &&
              check(prevC) &&
              check(indicators.maExit[i - 1]) &&
              curC < indicators.maExit[i] &&
              prevC >= indicators.maExit[i - 1];
            if (sellSignal)
              exitIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                SMA: [
                  indicators.maExit[i - 1],
                  indicators.maExit[i],
                  indicators.maExit[i + 1] ?? null,
                ],
              };
            break;
          case "rsi_overbought":
            {
              const pluginResult = callStrategyPlugin(
                'rsi_overbought',
                'longExit',
                i,
                exitParams,
              );
              if (pluginResult) {
                sellSignal = pluginResult.exit === true;
                exitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!exitIndicatorValues && meta.indicatorValues)
                  exitIndicatorValues = meta.indicatorValues;
                break;
              }
              const rX = indicators.rsiExit[i],
                rPX = indicators.rsiExit[i - 1],
                rThX = exitParams.threshold || 70;
              sellSignal = check(rX) && check(rPX) && rX < rThX && rPX >= rThX;
              if (sellSignal)
                exitIndicatorValues = {
                  RSI: [rPX, rX, indicators.rsiExit[i + 1] ?? null],
                };
              break;
            }
          case "macd_cross":
            const difX = indicators.macdExit[i],
              deaX = indicators.macdSignalExit[i],
              difPX = indicators.macdExit[i - 1],
              deaPX = indicators.macdSignalExit[i - 1];
            sellSignal =
              check(difX) &&
              check(deaX) &&
              check(difPX) &&
              check(deaPX) &&
              difX < deaX &&
              difPX >= deaPX;
            if (sellSignal)
              exitMACDValues = {
                difPrev: difPX,
                deaPrev: deaPX,
                difNow: difX,
                deaNow: deaX,
                difNext: indicators.macdExit[i + 1] ?? null,
                deaNext: indicators.macdSignalExit[i + 1] ?? null,
              };
            break;
          case "bollinger_reversal":
            {
              const pluginResult = callStrategyPlugin(
                'bollinger_reversal',
                'longExit',
                i,
                exitParams,
              );
              if (pluginResult) {
                sellSignal = pluginResult.exit === true;
                exitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!exitIndicatorValues && meta.indicatorValues)
                  exitIndicatorValues = meta.indicatorValues;
                break;
              }
              const midX = indicators.bollingerMiddleExit[i];
              const midPX = indicators.bollingerMiddleExit[i - 1];
              sellSignal =
                check(midX) &&
                check(prevC) &&
                check(midPX) &&
                curC < midX &&
                prevC >= midPX;
              if (sellSignal)
                exitIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  中軌: [
                    midPX,
                    midX,
                    indicators.bollingerMiddleExit[i + 1] ?? null,
                  ],
                };
              break;
            }
          case "k_d_cross":
            {
              const pluginResult = callStrategyPlugin(
                'k_d_cross_exit',
                'longExit',
                i,
                exitParams,
              );
              if (pluginResult) {
                sellSignal = pluginResult.exit === true;
                exitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!exitKDValues && meta.kdValues) exitKDValues = meta.kdValues;
                if (!exitIndicatorValues && meta.indicatorValues)
                  exitIndicatorValues = meta.indicatorValues;
                break;
              }
              const kX = indicators.kExit[i],
                dX = indicators.dExit[i],
                kPX = indicators.kExit[i - 1],
                dPX = indicators.dExit[i - 1],
                thY = exitParams.thresholdY || 70;
              sellSignal =
                check(kX) &&
                check(dX) &&
                check(kPX) &&
                check(dPX) &&
                kX < dX &&
                kPX >= dPX &&
                dX > thY;
              if (sellSignal)
                exitKDValues = {
                  kPrev: kPX,
                  dPrev: dPX,
                  kNow: kX,
                  dNow: dX,
                  kNext: indicators.kExit[i + 1] ?? null,
                  dNext: indicators.dExit[i + 1] ?? null,
                };
              break;
            }
          case "trailing_stop":
            {
              if (check(curH) && lastBuyP > 0) {
                curPeakP = Math.max(curPeakP, curH);
              }
              const pluginResult = callStrategyPlugin(
                'trailing_stop',
                'longExit',
                i,
                exitParams,
                { currentPrice: curC, referencePrice: curPeakP },
              );
              if (pluginResult) {
                sellSignal = pluginResult.exit === true;
                exitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!exitIndicatorValues && meta.indicatorValues)
                  exitIndicatorValues = meta.indicatorValues;
                break;
              }
              const trailP = exitParams.percentage || 5;
              if (check(curH) && lastBuyP > 0) {
                curPeakP = Math.max(curPeakP, curH);
                sellSignal = curC < curPeakP * (1 - trailP / 100);
              }
              if (sellSignal)
                exitIndicatorValues = {
                  收盤價: [null, curC, null],
                  觸發價: [
                    null,
                    (curPeakP * (1 - trailP / 100)).toFixed(2),
                    null,
                  ],
                };
              break;
            }
          case "price_breakdown":
            const bpX = exitParams.period || 20;
            if (i >= bpX) {
              const lsX = lows.slice(i - bpX, i).filter((l) => check(l));
              if (lsX.length > 0) {
                const periodLow = Math.min(...lsX);
                sellSignal = check(curC) && curC < periodLow;
              }
              if (sellSignal)
                exitIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  前低: [
                    null,
                    Math.min(...lows.slice(i - bpX, i).filter(check)),
                    null,
                  ],
                };
            }
            break;
          case "williams_overbought":
            const wrX = indicators.williamsExit[i],
              wrPX = indicators.williamsExit[i - 1],
              wrThX = exitParams.threshold || -20;
            sellSignal =
              check(wrX) && check(wrPX) && wrX < wrThX && wrPX >= wrThX;
            if (sellSignal)
              exitIndicatorValues = {
                "%R": [wrPX, wrX, indicators.williamsExit[i + 1] ?? null],
              };
            break;
          case "turtle_stop_loss":
            const slP = exitParams.stopLossPeriod || 10;
            if (i >= slP) {
              const lowsT = lows.slice(i - slP, i).filter((l) => check(l));
              if (lowsT.length > 0) {
                const periodLowT = Math.min(...lowsT);
                sellSignal = check(curC) && curC < periodLowT;
              }
            }
            if (sellSignal)
              exitIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                N日低: [
                  null,
                  Math.min(...lows.slice(i - slP, i).filter(check)),
                  null,
                ],
              };
            break;
          case "fixed_stop_loss":
            sellSignal = false;
            break;
        }
        const finalExitRule =
          exitRuleResult ||
          normaliseRuleResultFromLegacy(exitStrategy, 'longExit', { exit: sellSignal }, i);
        sellSignal = finalExitRule.exit === true;
        const exitMeta = finalExitRule.meta;
        if (!exitIndicatorValues && exitMeta && exitMeta.indicatorValues)
          exitIndicatorValues = exitMeta.indicatorValues;
        if (!exitKDValues && exitMeta && exitMeta.kdValues)
          exitKDValues = exitMeta.kdValues;
        if (!exitMACDValues && exitMeta && exitMeta.macdValues)
          exitMACDValues = exitMeta.macdValues;

        if (!sellSignal && globalSL > 0 && lastBuyP > 0) {
          if (curC <= lastBuyP * (1 - globalSL / 100)) slTrig = true;
        }
        if (!sellSignal && !slTrig && globalTP > 0 && lastBuyP > 0) {
          if (curC >= lastBuyP * (1 + globalTP / 100)) tpTrig = true;
        }
        const candidateExitPrice =
          tradeTiming === "open" && canTradeOpen && check(nextO)
            ? nextO
            : curC;
        let priceRallyTrigger = false;
        if (
          exitStageMode === "price_rally" &&
          filledExitStages > 0 &&
          filledExitStages < exitStagePercents.length &&
          longPos === 1 &&
          Number.isFinite(lastLongExitStagePrice) &&
          check(candidateExitPrice) &&
          candidateExitPrice > lastLongExitStagePrice
        ) {
          priceRallyTrigger = true;
        }

        if (sellSignal || slTrig || tpTrig || priceRallyTrigger) {
          tradePrice = null;
          tradeDate = dates[i];
          if (tradeTiming === "close") {
            tradePrice = curC;
          } else if (canTradeOpen) {
            tradePrice = nextO;
            tradeDate = dates[i + 1];
          } else if (tradeTiming === "open" && i === n - 1) {
            tradePrice = curC;
            tradeDate = dates[i];
          }

          if (check(tradePrice) && tradePrice > 0 && longShares > 0) {
            let riskExit = false;
            let exitTriggerLabel = null;
            let sharesToSell = 0;
            let stageIndexForPlan = Math.min(
              filledExitStages,
              exitStagePercents.length - 1,
            );

            if (slTrig || tpTrig) {
              riskExit = true;
              sharesToSell = longShares;
              exitTriggerLabel = slTrig ? "stop_loss" : "take_profit";
            } else {
              if (
                !Array.isArray(currentLongExitPlan) ||
                currentLongExitPlan.length === 0 ||
                filledExitStages === 0
              ) {
                currentLongExitPlan = computeExitStagePlan(longShares);
              }
              const plan = Array.isArray(currentLongExitPlan)
                ? currentLongExitPlan
                : null;
              if (plan && plan.length > 0) {
                stageIndexForPlan = Math.min(
                  filledExitStages,
                  plan.length - 1,
                );
                sharesToSell = plan[stageIndexForPlan];
              }
              if (!Number.isFinite(sharesToSell) || sharesToSell <= 0) {
                sharesToSell = longShares;
              }
              sharesToSell = Math.min(Math.max(sharesToSell, 0), longShares);
              exitTriggerLabel =
                priceRallyTrigger && !sellSignal ? "price_rally" : "signal";
            }

            const consumption = consumeEntryForShares(sharesToSell);
            const executedShares =
              consumption && Number.isFinite(consumption.shares)
                ? consumption.shares
                : 0;
            if (executedShares > 0) {
              const revenue =
                executedShares * tradePrice * (1 - sellFee / 100);
              const entryCostWithFee = Number.isFinite(consumption.cost)
                ? consumption.cost
                : 0;
              const entryCostWithoutFee = Number.isFinite(
                consumption.costWithoutFee,
              )
                ? consumption.costWithoutFee
                : 0;
              const stageAverageEntryPrice =
                executedShares > 0
                  ? entryCostWithoutFee / executedShares
                  : 0;
              const profit = revenue - entryCostWithFee;
              const profitPercent =
                entryCostWithFee > 0 ? (profit / entryCostWithFee) * 100 : 0;

              longCap += revenue;
              longPositionCostWithFee = Math.max(
                0,
                longPositionCostWithFee - entryCostWithFee,
              );
              longPositionCostWithoutFee = Math.max(
                0,
                longPositionCostWithoutFee - entryCostWithoutFee,
              );
              longShares -= executedShares;
              if (longShares < 0) longShares = 0;

              if (longShares > 0 && longPositionCostWithoutFee > 0) {
                longAverageEntryPrice = longPositionCostWithoutFee / longShares;
                longPos = 1;
                lastBuyP = longAverageEntryPrice;
              } else {
                longAverageEntryPrice = 0;
              }

              const stagePercent =
                exitStagePercents[
                  Math.min(
                    stageIndexForPlan,
                    exitStagePercents.length - 1,
                  )
                ] || 0;
              const cumulativePercent = exitStagePercents
                .slice(0, stageIndexForPlan + 1)
                .reduce(
                  (sum, value) =>
                    sum + (Number.isFinite(value) ? value : 0),
                  0,
                );

              const tradeData = {
                type: "sell",
                date: tradeDate,
                price: tradePrice,
                shares: executedShares,
                revenue,
                profit,
                profitPercent,
                capital_after: longCap,
                triggeredByStopLoss: slTrig,
                triggeredByTakeProfit: tpTrig,
                triggeringStrategy: exitStrategy,
                simType: "long",
                entryCost: entryCostWithFee,
                entryAveragePrice: stageAverageEntryPrice,
                stageCount: currentLongEntryBreakdown.length,
                positionId: currentLongPositionId,
                stageTrigger: exitTriggerLabel,
                stageIndex: stageIndexForPlan,
                allocationPercent: stagePercent,
                cumulativeStagePercent: cumulativePercent,
                plannedShares:
                  Array.isArray(currentLongExitPlan) &&
                  stageIndexForPlan < currentLongExitPlan.length
                    ? currentLongExitPlan[stageIndexForPlan]
                    : executedShares,
                consumedEntryStages: Array.isArray(consumption?.stages)
                  ? consumption.stages
                  : [],
              };
              if (exitKDValues) tradeData.kdValues = exitKDValues;
              if (exitMACDValues) tradeData.macdValues = exitMACDValues;
              if (exitIndicatorValues)
                tradeData.indicatorValues = exitIndicatorValues;
              longTrades.push(tradeData);
              if (tradeTiming === "close" || !canTradeOpen) {
                sellSigs.push({ date: dates[i], index: i });
              } else if (canTradeOpen) {
                sellSigs.push({ date: dates[i + 1], index: i + 1 });
              }
              executedSell = true;
              lastLongExitStagePrice = tradePrice;
              lastExitStageTrigger = exitTriggerLabel;
              if (!riskExit) {
                filledExitStages = Math.min(
                  filledExitStages + 1,
                  exitStagePercents.length,
                );
              } else {
                filledExitStages = exitStagePercents.length;
                currentLongExitPlan = null;
              }

              let aggregatedEntry = null;
              if (longShares === 0) {
                aggregatedEntry = buildAggregatedLongEntry();
              }
              if (aggregatedEntry && longShares === 0) {
                longCompletedTrades.push({
                  entry: aggregatedEntry,
                  exit: tradeData,
                  profit,
                  profitPercent,
                });
              } else if (longShares === 0 && !aggregatedEntry) {
                console.warn(
                  `[Worker LONG] Sell @ ${tradeDate} could not rebuild aggregated entry.`,
                );
              }

              if (longShares === 0) {
                longPos = 0;
                lastBuyP = 0;
                curPeakP = 0;
                longPositionCostWithFee = 0;
                longPositionCostWithoutFee = 0;
                currentLongEntryBreakdown = [];
                currentLongPositionId = null;
                currentLongExitPlan = null;
                filledEntryStages = 0;
                lastLongStagePrice = null;
                lastEntryStageTrigger = null;
                resetExitPlanAfterCapture = true;
                filledExitStages = exitStagePercents.length;
              }

              console.log(
                `[Worker LONG] Stage Sell Executed: ${executedShares}@${tradePrice} on ${tradeDate}, Profit: ${profit.toFixed(0)}, Cap After: ${longCap.toFixed(0)}`,
              );
            } else {
              console.warn(
                `[Worker LONG] Exit stage computed 0 shares on ${dates[i]} (requested ${sharesToSell}).`,
              );
            }
          } else {
            console.warn(
              `[Worker LONG] Invalid trade price (${tradePrice}) or zero shares for Sell Signal on ${dates[i]}`,
            );
          }
        }
      } catch (exitError) {
        console.error(
          `[Worker LONG EXIT] Error at index ${i} (${dates[i]}):`,
          exitError,
        );
      }
    }
    if (enableShorting && shortPos === 1) {
      try {
        let coverSignal = false;
        let shortSlTrig = false;
        let shortTpTrig = false;
        let coverKDValues = null,
          coverMACDValues = null,
          coverIndicatorValues = null;
        let shortExitRuleResult = null;
        switch (shortExitStrategy) {
          case "cover_ma_cross":
          case "cover_ema_cross":
            {
              const pluginResult = callStrategyPlugin(
                shortExitStrategy,
                'shortExit',
                i,
                shortExitParams,
              );
              if (pluginResult) {
                coverSignal = pluginResult.cover === true;
                shortExitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!coverIndicatorValues && meta.indicatorValues)
                  coverIndicatorValues = meta.indicatorValues;
                break;
              }
              coverSignal =
                check(indicators.maShortCover[i]) &&
                check(indicators.maLongCover[i]) &&
                check(indicators.maShortCover[i - 1]) &&
                check(indicators.maLongCover[i - 1]) &&
                indicators.maShortCover[i] > indicators.maLongCover[i] &&
                indicators.maShortCover[i - 1] <= indicators.maLongCover[i - 1];
              if (coverSignal)
                coverIndicatorValues = {
                  短SMA: [
                    indicators.maShortCover[i - 1],
                    indicators.maShortCover[i],
                    indicators.maShortCover[i + 1] ?? null,
                  ],
                  長SMA: [
                    indicators.maLongCover[i - 1],
                    indicators.maLongCover[i],
                    indicators.maLongCover[i + 1] ?? null,
                  ],
                };
              break;
            }
          case "cover_ma_above":
            coverSignal =
              check(indicators.maExit[i]) &&
              check(prevC) &&
              check(indicators.maExit[i - 1]) &&
              curC > indicators.maExit[i] &&
              prevC <= indicators.maExit[i - 1];
            if (coverSignal)
              coverIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                SMA: [
                  indicators.maExit[i - 1],
                  indicators.maExit[i],
                  indicators.maExit[i + 1] ?? null,
                ],
              };
            break;
          case "cover_rsi_oversold":
            {
              const pluginResult = callStrategyPlugin(
                'cover_rsi_oversold',
                'shortExit',
                i,
                shortExitParams,
              );
              if (pluginResult) {
                coverSignal = pluginResult.cover === true;
                shortExitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!coverIndicatorValues && meta.indicatorValues)
                  coverIndicatorValues = meta.indicatorValues;
                break;
              }
              const rC = indicators.rsiCover[i],
                rPC = indicators.rsiCover[i - 1],
                rThC = shortExitParams.threshold || 30;
              coverSignal = check(rC) && check(rPC) && rC > rThC && rPC <= rThC;
              if (coverSignal)
                coverIndicatorValues = {
                  RSI: [rPC, rC, indicators.rsiCover[i + 1] ?? null],
                };
              break;
            }
          case "cover_macd_cross":
            const difC = indicators.macdCover[i],
              deaC = indicators.macdSignalCover[i],
              difPC = indicators.macdCover[i - 1],
              deaPC = indicators.macdSignalCover[i - 1];
            coverSignal =
              check(difC) &&
              check(deaC) &&
              check(difPC) &&
              check(deaPC) &&
              difC > deaC &&
              difPC <= deaPC;
            if (coverSignal)
              coverMACDValues = {
                difPrev: difPC,
                deaPrev: deaPC,
                difNow: difC,
                deaNow: deaC,
                difNext: indicators.macdCover[i + 1] ?? null,
                deaNext: indicators.macdSignalCover[i + 1] ?? null,
              };
            break;
          case "cover_bollinger_breakout":
            {
              const pluginResult = callStrategyPlugin(
                'cover_bollinger_breakout',
                'shortExit',
                i,
                shortExitParams,
              );
              if (pluginResult) {
                coverSignal = pluginResult.cover === true;
                shortExitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!coverIndicatorValues && meta.indicatorValues)
                  coverIndicatorValues = meta.indicatorValues;
                break;
              }
              const upperC = indicators.bollingerUpperCover[i];
              const upperPC = indicators.bollingerUpperCover[i - 1];
              coverSignal =
                check(upperC) &&
                check(prevC) &&
                check(upperPC) &&
                curC > upperC &&
                prevC <= upperPC;
              if (coverSignal)
                coverIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  上軌: [
                    upperPC,
                    upperC,
                    indicators.bollingerUpperCover[i + 1] ?? null,
                  ],
                };
              break;
            }
          case "cover_k_d_cross":
            {
              const pluginResult = callStrategyPlugin(
                'cover_k_d_cross',
                'shortExit',
                i,
                shortExitParams,
              );
              if (pluginResult) {
                coverSignal = pluginResult.cover === true;
                shortExitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!coverKDValues && meta.kdValues) coverKDValues = meta.kdValues;
                if (!coverIndicatorValues && meta.indicatorValues)
                  coverIndicatorValues = meta.indicatorValues;
                break;
              }
              const kC = indicators.kCover[i],
                dC = indicators.dCover[i],
                kPC = indicators.kCover[i - 1],
                dPC = indicators.dCover[i - 1],
                thXC = shortExitParams.thresholdX || 30;
              coverSignal =
                check(kC) &&
                check(dC) &&
                check(kPC) &&
                check(dPC) &&
                kC > dC &&
                kPC <= dPC &&
                dC < thXC;
              if (coverSignal)
                coverKDValues = {
                  kPrev: kPC,
                  dPrev: dPC,
                  kNow: kC,
                  dNow: dC,
                  kNext: indicators.kCover[i + 1] ?? null,
                  dNext: indicators.dCover[i + 1] ?? null,
                };
              break;
            }
          case "cover_price_breakout":
            const bpC = shortExitParams.period || 20;
            if (i >= bpC) {
              const hsC = highs.slice(i - bpC, i).filter((h) => check(h));
              if (hsC.length > 0) {
                const periodHighC = Math.max(...hsC);
                coverSignal = check(curC) && curC > periodHighC;
              }
              if (coverSignal)
                coverIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  前高: [
                    null,
                    Math.max(...highs.slice(i - bpC, i).filter(check)),
                    null,
                  ],
                };
            }
            break;
          case "cover_williams_oversold":
            const wrC = indicators.williamsCover[i],
              wrPC = indicators.williamsCover[i - 1],
              wrThC = shortExitParams.threshold || -80;
            coverSignal =
              check(wrC) && check(wrPC) && wrC > wrThC && wrPC <= wrThC;
            if (coverSignal)
              coverIndicatorValues = {
                "%R": [wrPC, wrC, indicators.williamsCover[i + 1] ?? null],
              };
            break;
          case "cover_turtle_breakout":
            const tpC = shortExitParams.breakoutPeriod || 20;
            if (i >= tpC) {
              const hsCT = highs.slice(i - tpC, i).filter((h) => check(h));
              if (hsCT.length > 0) {
                const periodHighCT = Math.max(...hsCT);
                coverSignal = check(curC) && curC > periodHighCT;
              }
              if (coverSignal)
                coverIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  N日高: [
                    null,
                    Math.max(...highs.slice(i - tpC, i).filter(check)),
                    null,
                  ],
                };
            }
            break;
          case "cover_trailing_stop":
            {
              if (check(curL) && lastShortP > 0) {
                currentLowSinceShort = Math.min(currentLowSinceShort, curL);
              }
              const pluginResult = callStrategyPlugin(
                'cover_trailing_stop',
                'shortExit',
                i,
                shortExitParams,
                { currentPrice: curC, referencePrice: currentLowSinceShort },
              );
              if (pluginResult) {
                coverSignal = pluginResult.cover === true;
                shortExitRuleResult = pluginResult;
                const meta = pluginResult.meta || {};
                if (!coverIndicatorValues && meta.indicatorValues)
                  coverIndicatorValues = meta.indicatorValues;
                break;
              }
              const shortTrailP = shortExitParams.percentage || 5;
              if (check(curL) && lastShortP > 0) {
                currentLowSinceShort = Math.min(currentLowSinceShort, curL);
                coverSignal =
                  curC > currentLowSinceShort * (1 + shortTrailP / 100);
              }
              if (coverSignal)
                coverIndicatorValues = {
                  收盤價: [null, curC, null],
                  觸發價: [
                    null,
                    (currentLowSinceShort * (1 + shortTrailP / 100)).toFixed(2),
                    null,
                  ],
                };
              break;
            }
          case "cover_fixed_stop_loss":
            coverSignal = false;
            break;
        }
        const finalShortExitRule =
          shortExitRuleResult ||
          normaliseRuleResultFromLegacy(
            shortExitStrategy,
            'shortExit',
            { cover: coverSignal },
            i,
          );
        coverSignal = finalShortExitRule.cover === true;
        const shortExitMeta = finalShortExitRule.meta;
        if (!coverIndicatorValues && shortExitMeta && shortExitMeta.indicatorValues)
          coverIndicatorValues = shortExitMeta.indicatorValues;
        if (!coverKDValues && shortExitMeta && shortExitMeta.kdValues)
          coverKDValues = shortExitMeta.kdValues;
        if (!coverMACDValues && shortExitMeta && shortExitMeta.macdValues)
          coverMACDValues = shortExitMeta.macdValues;

        if (!coverSignal && globalSL > 0 && lastShortP > 0) {
          if (curC >= lastShortP * (1 + globalSL / 100)) shortSlTrig = true;
        }
        if (!coverSignal && !shortSlTrig && globalTP > 0 && lastShortP > 0) {
          if (curC <= lastShortP * (1 - globalTP / 100)) shortTpTrig = true;
        }
        if (coverSignal || shortSlTrig || shortTpTrig) {
          tradePrice = null;
          tradeDate = dates[i];
          if (tradeTiming === "close") tradePrice = curC;
          else if (canTradeOpen) {
            tradePrice = nextO;
            tradeDate = dates[i + 1];
          } else if (tradeTiming === "open" && i === n - 1) {
            tradePrice = curC;
            tradeDate = dates[i];
          }
          if (check(tradePrice) && tradePrice > 0 && shortShares > 0) {
            const shortProceeds =
              shortShares * lastShortP * (1 - sellFee / 100);
            const coverCostWithFee =
              shortShares * tradePrice * (1 + buyFee / 100);
            const prof = shortProceeds - coverCostWithFee;
            shortCap += prof;
            const tradeData = {
              type: "cover",
              date: tradeDate,
              price: tradePrice,
              shares: shortShares,
              revenue: coverCostWithFee,
              profit: prof,
              profitPercent:
                shortProceeds > 0 ? (prof / shortProceeds) * 100 : 0,
              capital_after: shortCap,
              triggeredByStopLoss: shortSlTrig,
              triggeredByTakeProfit: shortTpTrig,
              triggeringStrategy: shortExitStrategy,
              simType: "short",
            };
            if (coverKDValues) tradeData.kdValues = coverKDValues;
            if (coverMACDValues) tradeData.macdValues = coverMACDValues;
            if (coverIndicatorValues)
              tradeData.indicatorValues = coverIndicatorValues;
            shortTrades.push(tradeData);
            // 修正：隔日開盤價交易時，訊號應顯示在實際交易日
            if (tradeTiming === "close" || !canTradeOpen) {
              coverSigs.push({ date: dates[i], index: i });
            } else if (canTradeOpen) {
              coverSigs.push({ date: dates[i + 1], index: i + 1 });
            }
            executedCover = true;
            const lastShortIdx = shortTrades
              .map((t) => t.type)
              .lastIndexOf("short");
            if (
              lastShortIdx !== -1 &&
              shortTrades[lastShortIdx].shares === shortShares
            ) {
              shortCompletedTrades.push({
                entry: shortTrades[lastShortIdx],
                exit: tradeData,
                profit: prof,
                profitPercent: tradeData.profitPercent,
              });
            } else {
              console.warn(
                `[Worker SHORT] Cover @ ${tradeDate} could not find matching short trade.`,
              );
            }
            console.log(
              `[Worker SHORT] Cover Executed: ${shortShares}@${tradePrice} on ${tradeDate}, Profit: ${prof.toFixed(0)}, Cap After: ${shortCap.toFixed(0)}`,
            );
            shortPos = 0;
            shortShares = 0;
            lastShortP = 0;
            currentLowSinceShort = Infinity;
          } else {
            console.warn(
              `[Worker SHORT] Invalid trade price (${tradePrice}) or zero shares for Cover Signal on ${dates[i]}`,
            );
          }
        }
      } catch (coverError) {
        console.error(
          `[Worker SHORT EXIT] Error at index ${i} (${dates[i]}):`,
          coverError,
        );
      }
    }
    if (shortPos === 0 && filledEntryStages < entryStagePercents.length) {
      let buySignal = false;
      let entryKDValues = null,
        entryMACDValues = null,
        entryIndicatorValues = null;
      let entryRuleResult = null;
      switch (entryStrategy) {
        case "ma_cross":
        case "ema_cross": {
          const pluginResult = callStrategyPlugin(
            entryStrategy,
            'longEntry',
            i,
            entryParams,
          );
          if (pluginResult) {
            buySignal = pluginResult.enter === true;
            entryRuleResult = pluginResult;
            const meta = pluginResult.meta || {};
            if (!entryIndicatorValues && meta.indicatorValues)
              entryIndicatorValues = meta.indicatorValues;
            break;
          }
          buySignal =
            check(indicators.maShort[i]) &&
            check(indicators.maLong[i]) &&
            check(indicators.maShort[i - 1]) &&
            check(indicators.maLong[i - 1]) &&
            indicators.maShort[i] > indicators.maLong[i] &&
            indicators.maShort[i - 1] <= indicators.maLong[i - 1];
          if (buySignal)
            entryIndicatorValues = {
              短SMA: [
                indicators.maShort[i - 1],
                indicators.maShort[i],
                indicators.maShort[i + 1] ?? null,
              ],
              長SMA: [
                indicators.maLong[i - 1],
                indicators.maLong[i],
                indicators.maLong[i + 1] ?? null,
              ],
            };
          break;
        }
        case "ma_above":
          buySignal =
            check(indicators.maExit[i]) &&
            check(prevC) &&
            check(indicators.maExit[i - 1]) &&
            curC > indicators.maExit[i] &&
            prevC <= indicators.maExit[i - 1];
          if (buySignal)
            entryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              SMA: [
                indicators.maExit[i - 1],
                indicators.maExit[i],
                indicators.maExit[i + 1] ?? null,
              ],
            };
          break;
        case "rsi_oversold":
          {
            const pluginResult = callStrategyPlugin(
              'rsi_oversold',
              'longEntry',
              i,
              entryParams,
            );
            if (pluginResult) {
              buySignal = pluginResult.enter === true;
              entryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!entryIndicatorValues && meta.indicatorValues)
                entryIndicatorValues = meta.indicatorValues;
              break;
            }
            const rE = indicators.rsiEntry[i],
              rPE = indicators.rsiEntry[i - 1],
              rThE = entryParams.threshold || 30;
            buySignal = check(rE) && check(rPE) && rE > rThE && rPE <= rThE;
            if (buySignal)
              entryIndicatorValues = {
                RSI: [rPE, rE, indicators.rsiEntry[i + 1] ?? null],
              };
            break;
          }
        case "macd_cross":
          const difE = indicators.macdEntry[i],
            deaE = indicators.macdSignalEntry[i],
            difPE = indicators.macdEntry[i - 1],
            deaPE = indicators.macdSignalEntry[i - 1];
          buySignal =
            check(difE) &&
            check(deaE) &&
            check(difPE) &&
            check(deaPE) &&
            difE > deaE &&
            difPE <= deaPE;
          if (buySignal)
            entryMACDValues = {
              difPrev: difPE,
              deaPrev: deaPE,
              difNow: difE,
              deaNow: deaE,
              difNext: indicators.macdEntry[i + 1] ?? null,
              deaNext: indicators.macdSignalEntry[i + 1] ?? null,
            };
          break;
        case "bollinger_breakout":
          {
            const pluginResult = callStrategyPlugin(
              'bollinger_breakout',
              'longEntry',
              i,
              entryParams,
            );
            if (pluginResult) {
              buySignal = pluginResult.enter === true;
              entryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!entryIndicatorValues && meta.indicatorValues)
                entryIndicatorValues = meta.indicatorValues;
              break;
            }
            buySignal =
              check(indicators.bollingerUpperEntry[i]) &&
              check(prevC) &&
              check(indicators.bollingerUpperEntry[i - 1]) &&
              curC > indicators.bollingerUpperEntry[i] &&
              prevC <= indicators.bollingerUpperEntry[i - 1];
            if (buySignal)
              entryIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                上軌: [
                  indicators.bollingerUpperEntry[i - 1],
                  indicators.bollingerUpperEntry[i],
                  indicators.bollingerUpperEntry[i + 1] ?? null,
                ],
              };
            break;
          }
        case "k_d_cross":
          {
            const pluginResult = callStrategyPlugin(
              'k_d_cross',
              'longEntry',
              i,
              entryParams,
            );
            if (pluginResult) {
              buySignal = pluginResult.enter === true;
              entryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!entryKDValues && meta.kdValues) entryKDValues = meta.kdValues;
              if (!entryIndicatorValues && meta.indicatorValues)
                entryIndicatorValues = meta.indicatorValues;
              break;
            }
            const kE = indicators.kEntry[i],
              dE = indicators.dEntry[i],
              kPE = indicators.kEntry[i - 1],
              dPE = indicators.dEntry[i - 1],
              thX = entryParams.thresholdX || 30;
            buySignal =
              check(kE) &&
              check(dE) &&
              check(kPE) &&
              check(dPE) &&
              kE > dE &&
              kPE <= dPE &&
              dE < thX;
            if (buySignal)
              entryKDValues = {
                kPrev: kPE,
                dPrev: dPE,
                kNow: kE,
                dNow: dE,
                kNext: indicators.kEntry[i + 1] ?? null,
                dNext: indicators.dEntry[i + 1] ?? null,
              };
            break;
          }
        case "volume_spike":
          const vAE = indicators.volumeAvgEntry[i],
            vME = entryParams.multiplier || 2;
          buySignal = check(vAE) && check(curV) && curV > vAE * vME;
          if (buySignal)
            entryIndicatorValues = {
              成交量: [volumes[i - 1] ?? null, curV, volumes[i + 1] ?? null],
              均量: [
                indicators.volumeAvgEntry[i - 1] ?? null,
                vAE,
                indicators.volumeAvgEntry[i + 1] ?? null,
              ],
            };
          break;
        case "price_breakout":
          const bpE = entryParams.period || 20;
          if (i >= bpE) {
            const hsE = highs.slice(i - bpE, i).filter((h) => check(h));
            if (hsE.length > 0) {
              const periodHigh = Math.max(...hsE);
              buySignal = check(curC) && curC > periodHigh;
              if (buySignal)
                entryIndicatorValues = {
                  收盤價: [prevC, curC, closes[i + 1] ?? null],
                  前高: [null, periodHigh, null],
                };
            }
          }
          break;
        case "williams_oversold":
          const wrE = indicators.williamsEntry[i],
            wrPE = indicators.williamsEntry[i - 1],
            wrThE = entryParams.threshold || -80;
          buySignal = check(wrE) && check(wrPE) && wrE > wrThE && wrPE <= wrThE;
          if (buySignal)
            entryIndicatorValues = {
              "%R": [wrPE, wrE, indicators.williamsEntry[i + 1] ?? null],
            };
          break;
        case "turtle_breakout":
          const tpE = entryParams.breakoutPeriod || 20;
          if (i >= tpE) {
            const hsT = highs.slice(i - tpE, i).filter((h) => check(h));
            if (hsT.length > 0) {
              const periodHighT = Math.max(...hsT);
              buySignal = check(curC) && curC > periodHighT;
            }
            if (buySignal)
              entryIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                N日高: [
                  null,
                  Math.max(...highs.slice(i - tpE, i).filter(check)),
                  null,
                ],
              };
          }
          break;
      }
      const finalEntryRule =
        entryRuleResult ||
        normaliseRuleResultFromLegacy(entryStrategy, 'longEntry', { enter: buySignal }, i);
      buySignal = finalEntryRule.enter === true;
      const entryMeta = finalEntryRule.meta;
      if (!entryIndicatorValues && entryMeta && entryMeta.indicatorValues)
        entryIndicatorValues = entryMeta.indicatorValues;
      if (!entryKDValues && entryMeta && entryMeta.kdValues)
        entryKDValues = entryMeta.kdValues;
      if (!entryMACDValues && entryMeta && entryMeta.macdValues)
        entryMACDValues = entryMeta.macdValues;
      let shouldEnterStage = false;
        let stageTriggerType = null;
        if (buySignal) {
          shouldEnterStage = true;
          stageTriggerType = "signal";
        }
        if (
          !shouldEnterStage &&
          entryStageMode === "price_pullback" &&
          filledEntryStages > 0 &&
          filledEntryStages < entryStagePercents.length &&
          longPos === 1 &&
          Number.isFinite(lastLongStagePrice) &&
          check(curC)
        ) {
          if (tradeTiming === "close" && curC < lastLongStagePrice) {
            shouldEnterStage = true;
            stageTriggerType = "price_pullback";
          } else if (canTradeOpen && curC < lastLongStagePrice) {
            shouldEnterStage = true;
            stageTriggerType = "price_pullback";
          }
        }
        if (shouldEnterStage) {
          tradePrice = null;
          tradeDate = dates[i];
          const stageIndex = filledEntryStages;
          const triggerLabel = stageTriggerType || "signal";
          if (tradeTiming === "close") {
            tradePrice = curC;
            if (check(tradePrice) && tradePrice > 0 && longCap > 0) {
              let baseCapitalForSizing = initialCapital;
              if (positionBasis === "totalCapital") {
                baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
              }
              const result = executeLongStage({
                tradePrice,
                tradeDate,
                stageIndex,
                baseCapitalForSizing,
                strategyKey: entryStrategy,
                signalIndex: i,
                kdValues: entryKDValues,
                macdValues: entryMACDValues,
                indicatorValues: entryIndicatorValues,
                trigger: triggerLabel,
              });
              if (result.executed) {
                executedBuy = true;
              }
            }
          } else if (canTradeOpen) {
            let baseCapitalForSizing = initialCapital;
            if (positionBasis === "totalCapital") {
              baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
            }
            const maxInvestmentAllowed =
              baseCapitalForSizing *
              (entryStagePercents[Math.min(stageIndex, entryStagePercents.length - 1)] / 100);
            const actualInvestmentLimit = Math.min(
              longCap,
              maxInvestmentAllowed,
            );

            if (actualInvestmentLimit > 0) {
              pendingNextDayTrade = {
                type: "buy",
                executeOnDate: dates[i + 1],
                investmentLimit: actualInvestmentLimit,
                strategy: entryStrategy,
                triggerIndex: i,
                stageIndex,
                kdValues: entryKDValues,
                macdValues: entryMACDValues,
                indicatorValues: entryIndicatorValues,
                stageTrigger: triggerLabel,
              };
            } else {
              console.warn(
                `[Worker LONG] Stage ${stageIndex + 1} pending entry skipped due to zero investment limit on ${dates[i]}.`,
              );
            }
          }
        }
    }
    if (enableShorting && shortPos === 0 && longPos === 0) {
      let shortSignal = false;
      let shortEntryKDValues = null,
        shortEntryMACDValues = null,
        shortEntryIndicatorValues = null;
      let shortEntryRuleResult = null;
      switch (shortEntryStrategy) {
        case "short_ma_cross":
        case "short_ema_cross":
          {
            const pluginResult = callStrategyPlugin(
              shortEntryStrategy,
              'shortEntry',
              i,
              shortEntryParams,
            );
            if (pluginResult) {
              shortSignal = pluginResult.short === true;
              shortEntryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!shortEntryIndicatorValues && meta.indicatorValues)
                shortEntryIndicatorValues = meta.indicatorValues;
              break;
            }
            shortSignal =
              check(indicators.maShortShortEntry[i]) &&
              check(indicators.maLongShortEntry[i]) &&
              check(indicators.maShortShortEntry[i - 1]) &&
              check(indicators.maLongShortEntry[i - 1]) &&
              indicators.maShortShortEntry[i] < indicators.maLongShortEntry[i] &&
              indicators.maShortShortEntry[i - 1] >=
                indicators.maLongShortEntry[i - 1];
            if (shortSignal)
              shortEntryIndicatorValues = {
                短SMA: [
                  indicators.maShortShortEntry[i - 1],
                  indicators.maShortShortEntry[i],
                  indicators.maShortShortEntry[i + 1] ?? null,
                ],
                長SMA: [
                  indicators.maLongShortEntry[i - 1],
                  indicators.maLongShortEntry[i],
                  indicators.maLongShortEntry[i + 1] ?? null,
                ],
              };
            break;
          }
        case "short_ma_below":
          shortSignal =
            check(indicators.maExit[i]) &&
            check(prevC) &&
            check(indicators.maExit[i - 1]) &&
            curC < indicators.maExit[i] &&
            prevC >= indicators.maExit[i - 1];
          if (shortSignal)
            shortEntryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              SMA: [
                indicators.maExit[i - 1],
                indicators.maExit[i],
                indicators.maExit[i + 1] ?? null,
              ],
            };
          break;
        case "short_rsi_overbought":
          {
            const pluginResult = callStrategyPlugin(
              'short_rsi_overbought',
              'shortEntry',
              i,
              shortEntryParams,
            );
            if (pluginResult) {
              shortSignal = pluginResult.short === true;
              shortEntryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!shortEntryIndicatorValues && meta.indicatorValues)
                shortEntryIndicatorValues = meta.indicatorValues;
              break;
            }
            const rSE = indicators.rsiShortEntry[i],
              rPSE = indicators.rsiShortEntry[i - 1],
              rThSE = shortEntryParams.threshold || 70;
            shortSignal =
              check(rSE) && check(rPSE) && rSE < rThSE && rPSE >= rThSE;
            if (shortSignal)
              shortEntryIndicatorValues = {
                RSI: [rPSE, rSE, indicators.rsiShortEntry[i + 1] ?? null],
              };
            break;
          }
        case "short_macd_cross":
          const difSE = indicators.macdShortEntry[i],
            deaSE = indicators.macdSignalShortEntry[i],
            difPSE = indicators.macdShortEntry[i - 1],
            deaPSE = indicators.macdSignalShortEntry[i - 1];
          shortSignal =
            check(difSE) &&
            check(deaSE) &&
            check(difPSE) &&
            check(deaPSE) &&
            difSE < deaSE &&
            difPSE >= deaSE;
          if (shortSignal)
            shortEntryMACDValues = {
              difPrev: difPSE,
              deaPrev: deaPSE,
              difNow: difSE,
              deaNow: deaSE,
              difNext: indicators.macdShortEntry[i + 1] ?? null,
              deaNext: indicators.macdSignalShortEntry[i + 1] ?? null,
            };
          break;
        case "short_bollinger_reversal":
          {
            const pluginResult = callStrategyPlugin(
              'short_bollinger_reversal',
              'shortEntry',
              i,
              shortEntryParams,
            );
            if (pluginResult) {
              shortSignal = pluginResult.short === true;
              shortEntryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!shortEntryIndicatorValues && meta.indicatorValues)
                shortEntryIndicatorValues = meta.indicatorValues;
              break;
            }
            const midSE = indicators.bollingerMiddleShortEntry[i];
            const midPSE = indicators.bollingerMiddleShortEntry[i - 1];
            shortSignal =
              check(midSE) &&
              check(prevC) &&
              check(midPSE) &&
              curC < midSE &&
              prevC >= midPSE;
            if (shortSignal)
              shortEntryIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                中軌: [
                  midPSE,
                  midSE,
                  indicators.bollingerMiddleShortEntry[i + 1] ?? null,
                ],
              };
            break;
          }
        case "short_k_d_cross":
          {
            const pluginResult = callStrategyPlugin(
              'short_k_d_cross',
              'shortEntry',
              i,
              shortEntryParams,
            );
            if (pluginResult) {
              shortSignal = pluginResult.short === true;
              shortEntryRuleResult = pluginResult;
              const meta = pluginResult.meta || {};
              if (!shortEntryKDValues && meta.kdValues)
                shortEntryKDValues = meta.kdValues;
              if (!shortEntryIndicatorValues && meta.indicatorValues)
                shortEntryIndicatorValues = meta.indicatorValues;
              break;
            }
            const kSE = indicators.kShortEntry[i],
              dSE = indicators.dShortEntry[i],
              kPSE = indicators.kShortEntry[i - 1],
              dPSE = indicators.dShortEntry[i - 1],
              thY = shortEntryParams.thresholdY || 70;
            shortSignal =
              check(kSE) &&
              check(dSE) &&
              check(kPSE) &&
              check(dPSE) &&
              kSE < dSE &&
              kPSE >= dPSE &&
              dSE > thY;
            if (shortSignal)
              shortEntryKDValues = {
                kPrev: kPSE,
                dPrev: dPSE,
                kNow: kSE,
                dNow: dSE,
                kNext: indicators.kShortEntry[i + 1] ?? null,
                dNext: indicators.dShortEntry[i + 1] ?? null,
              };
            break;
          }
        case "short_price_breakdown":
          const bpSE = shortEntryParams.period || 20;
          if (i >= bpSE) {
            const lsSE = lows.slice(i - bpSE, i).filter((l) => check(l));
            if (lsSE.length > 0) {
              const periodLowS = Math.min(...lsSE);
              shortSignal = check(curC) && curC < periodLowS;
            }
            if (shortSignal)
              shortEntryIndicatorValues = {
                收盤價: [prevC, curC, closes[i + 1] ?? null],
                前低: [
                  null,
                  Math.min(...lows.slice(i - bpSE, i).filter(check)),
                  null,
                ],
              };
          }
          break;
        case "short_williams_overbought":
          const wrSE = indicators.williamsShortEntry[i],
            wrPSE = indicators.williamsShortEntry[i - 1],
            wrThSE = shortEntryParams.threshold || -20;
          shortSignal =
            check(wrSE) && check(wrPSE) && wrSE < wrThSE && wrPSE >= wrThSE;
          if (shortSignal)
            shortEntryIndicatorValues = {
              "%R": [wrPSE, wrSE, indicators.williamsShortEntry[i + 1] ?? null],
            };
          break;
        case "short_turtle_stop_loss":
          const slPSE = shortEntryParams.stopLossPeriod || 10;
          if (i >= slPSE) {
            const lowsT = lows.slice(i - slPSE, i).filter((l) => check(l));
            if (lowsT.length > 0) {
              const periodLowST = Math.min(...lowsT);
              shortSignal = check(curC) && curC < periodLowST;
            }
          }
          if (shortSignal)
            shortEntryIndicatorValues = {
              收盤價: [prevC, curC, closes[i + 1] ?? null],
              N日低: [
                null,
                Math.min(...lows.slice(i - slPSE, i).filter(check)),
                null,
              ],
            };
          break;
      }
      const finalShortEntryRule =
        shortEntryRuleResult ||
        normaliseRuleResultFromLegacy(
          shortEntryStrategy,
          'shortEntry',
          { short: shortSignal },
          i,
        );
      shortSignal = finalShortEntryRule.short === true;
      const shortEntryMeta = finalShortEntryRule.meta;
      if (!shortEntryIndicatorValues && shortEntryMeta && shortEntryMeta.indicatorValues)
        shortEntryIndicatorValues = shortEntryMeta.indicatorValues;
      if (!shortEntryKDValues && shortEntryMeta && shortEntryMeta.kdValues)
        shortEntryKDValues = shortEntryMeta.kdValues;
      if (!shortEntryMACDValues && shortEntryMeta && shortEntryMeta.macdValues)
        shortEntryMACDValues = shortEntryMeta.macdValues;
      if (shortSignal) {
        if (tradeTiming === "close") {
          tradePrice = curC;
          tradeDate = dates[i];
        } else if (canTradeOpen) {
          // 隔日開盤價交易：記錄交易意圖，延遲執行
          let baseCapitalForSizing = initialCapital;
          if (positionBasis === "totalCapital") {
            baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
          }
          const maxInvestmentAllowed =
            baseCapitalForSizing * (positionSize / 100);
          const actualInvestmentLimit = Math.min(
            shortCap,
            maxInvestmentAllowed,
          );

          // 記錄隔日做空交易意圖
          pendingNextDayTrade = {
            type: "short",
            executeOnDate: dates[i + 1],
            investmentLimit: actualInvestmentLimit,
            strategy: shortEntryStrategy,
            triggerIndex: i,
            kdValues: shortEntryKDValues,
            macdValues: shortEntryMACDValues,
            indicatorValues: shortEntryIndicatorValues,
          };
          tradePrice = null; // 不立即執行
          tradeDate = null;
        }

        if (check(tradePrice) && tradePrice > 0 && shortCap > 0) {
          let baseCapitalForSizing = initialCapital;
          if (positionBasis === "totalCapital") {
            baseCapitalForSizing = portfolioVal[i - 1] ?? initialCapital;
          }
          const maxInvestmentAllowed =
            baseCapitalForSizing * (positionSize / 100);
          const actualInvestmentLimit = Math.min(
            shortCap,
            maxInvestmentAllowed,
          );
          const adjustedTradePrice = tradePrice * (1 + buyFee / 100);
          if (adjustedTradePrice <= 0) {
            shortShares = 0;
          } else {
            shortShares = Math.floor(
              actualInvestmentLimit / adjustedTradePrice,
            );
          }
          if (shortShares > 0) {
            const shortValue = shortShares * tradePrice;
            const shortProceeds = shortValue * (1 - sellFee / 100);
            shortPos = 1;
            lastShortP = tradePrice;
            currentLowSinceShort = tradePrice;
            const tradeData = {
              type: "short",
              date: tradeDate,
              price: tradePrice,
              shares: shortShares,
              cost: shortValue,
              capital_after: shortCap,
              triggeringStrategy: shortEntryStrategy,
              simType: "short",
            };
            if (shortEntryKDValues) tradeData.kdValues = shortEntryKDValues;
            if (shortEntryMACDValues)
              tradeData.macdValues = shortEntryMACDValues;
            if (shortEntryIndicatorValues)
              tradeData.indicatorValues = shortEntryIndicatorValues;
            shortTrades.push(tradeData);
            // 修正：隔日開盤價交易時，訊號應顯示在實際交易日
            if (tradeTiming === "close" || !canTradeOpen) {
              shortSigs.push({ date: dates[i], index: i });
            } else if (canTradeOpen) {
              shortSigs.push({ date: dates[i + 1], index: i + 1 });
            }
            executedShort = true;
            console.log(
              `[Worker SHORT] Short Executed: ${shortShares}@${tradePrice} on ${tradeDate}, Cap Before Cover: ${shortCap.toFixed(0)}`,
            );
          } else {
            console.log(
              `[Worker SHORT] Calculated 0 shares for Short on ${tradeDate} (Price: ${tradePrice}, Investment: ${investment.toFixed(0)})`,
            );
            shortShares = 0;
          }

        } else {
          console.warn(
            `[Worker SHORT] Invalid trade price (${tradePrice}) for Short Signal on ${dates[i]}`,
          );
        }
      }
    }

    if (executedSell) {
      longState = "出場";
    } else if (executedBuy) {
      longState = "進場";
    } else if (longPos === 1) {
      longState = "持有";
    } else {
      longState = "空手";
    }
    if (executedCover) {
      shortState = "出場";
    } else if (executedShort) {
      shortState = "進場";
    } else if (shortPos === 1) {
      shortState = "持有";
    } else {
      shortState = "空手";
    }
    longStateSeries[i] = longState;
    shortStateSeries[i] = shortState;
    positionStatesFull[i] = combinePositionLabel(longState, shortState);

    longEntryStageStates[i] = captureEntryStageState();
    longExitStageStates[i] = captureExitStageState();
    if (resetExitPlanAfterCapture) {
      filledExitStages = 0;
      lastLongExitStagePrice = null;
      lastExitStageTrigger = null;
      resetExitPlanAfterCapture = false;
    }

    // --- STEP 3: Update Daily P/L AFTER all potential trades ---
    longPl[i] =
      longCap + (longPos === 1 ? longShares * curC : 0) - initialCapital;
    let unrealizedShortPl = 0;
    if (shortPos === 1 && lastShortP > 0) {
      unrealizedShortPl = (lastShortP - curC) * shortShares;
    }
    if (enableShorting) {
      shortPl[i] = shortCap - initialCapital + unrealizedShortPl;
    } else {
      shortPl[i] = 0;
    }
    portfolioVal[i] = initialCapital + longPl[i] + shortPl[i];
    strategyReturns[i] =
      initialCapital > 0
        ? ((portfolioVal[i] - initialCapital) / initialCapital) * 100
        : 0;
    if (captureFinalState) {
      const evaluationSnapshot = {
        date: dates[i],
        open: curO,
        high: curH,
        low: curL,
        close: curC,
        longState,
        shortState,
        executedBuy,
        executedSell,
        executedShort,
        executedCover,
        longPos,
        shortPos,
        longShares,
        shortShares,
        longAverageEntryPrice,
        lastBuyPrice: lastBuyP,
        lastShortPrice: lastShortP,
        longCapital: longCap,
        shortCapital: shortCap,
        longProfit: longPl[i],
        shortProfit: shortPl[i],
        portfolioValue: portfolioVal[i],
        strategyReturn: strategyReturns[i],
        longEntryState: longEntryStageStates[i],
        longExitState: longExitStageStates[i],
      };
      lastValidEvaluation = evaluationSnapshot;
      lastValidEvaluationIndex = i;
      if (i === lastIdx) {
        finalEvaluation = evaluationSnapshot;
        finalEvaluationIndex = i;
      }
    }
    peakCap = Math.max(peakCap, portfolioVal[i]);
    const drawdown =
      peakCap > 0 ? ((peakCap - portfolioVal[i]) / peakCap) * 100 : 0;
    maxDD = Math.max(maxDD, drawdown);
    if (
      i > startIdx &&
      n > startIdx &&
      i % Math.floor((n - startIdx) / 20 || 1) === 0
    ) {
      const p = 70 + Math.floor(((i - startIdx) / (n - startIdx)) * 25);
      self.postMessage({ type: "progress", progress: Math.min(95, p) });
    }
  } // --- End Loop ---

  // --- Final Cleanup & Calculation ---
  try {
    const finalP =
      lastIdx >= 0 && check(closes[lastIdx]) ? closes[lastIdx] : null;
    if (forceFinalLiquidation && longPos === 1 && finalP !== null && longShares > 0) {
        const rev = longShares * finalP * (1 - sellFee / 100);
        const entryCostWithFee = longPositionCostWithFee;
        const prof = rev - entryCostWithFee;
        const profitPercent =
          entryCostWithFee > 0 ? (prof / entryCostWithFee) * 100 : 0;
        longCap += rev;
        const finalTradeData = {
          type: "sell",
          date: dates[lastIdx],
          price: finalP,
          shares: longShares,
          revenue: rev,
          profit: prof,
          profitPercent,
          capital_after: longCap,
          triggeredByStopLoss: false,
          triggeredByTakeProfit: false,
          triggeringStrategy: "EndOfPeriod",
          simType: "long",
          entryCost: entryCostWithFee,
          entryAveragePrice: longAverageEntryPrice,
          stageCount: currentLongEntryBreakdown.length,
          positionId: currentLongPositionId,
        };
        longTrades.push(finalTradeData);
        if (!sellSigs.some((s) => s.index === lastIdx))
          sellSigs.push({ date: dates[lastIdx], index: lastIdx });
        longStateSeries[lastIdx] = "出場";
        positionStatesFull[lastIdx] = combinePositionLabel(
          longStateSeries[lastIdx],
          shortStateSeries[lastIdx],
        );
        const aggregatedEntry = buildAggregatedLongEntry();
        if (aggregatedEntry) {
          longCompletedTrades.push({
            entry: aggregatedEntry,
            exit: finalTradeData,
            profit: prof,
            profitPercent,
          });
        }
        longPl[lastIdx] = longCap - initialCapital;
        longPos = 0;
        longShares = 0;
        lastBuyP = 0;
        longAverageEntryPrice = 0;
        longPositionCostWithFee = 0;
        longPositionCostWithoutFee = 0;
        currentLongEntryBreakdown = [];
        filledEntryStages = 0;
        currentLongExitPlan = null;
        filledExitStages = exitStagePercents.length;
        lastLongExitStagePrice = finalP;
        lastExitStageTrigger = "final_day";
        lastLongStagePrice = null;
        lastEntryStageTrigger = null;
        longEntryStageStates[lastIdx] = captureEntryStageState();
        longExitStageStates[lastIdx] = captureExitStageState();
        filledExitStages = 0;
        lastLongExitStagePrice = null;
        lastExitStageTrigger = null;
        currentLongPositionId = null;
        console.log(
          `[Worker LONG] Final Sell Executed: ${finalTradeData.shares}@${finalP} on ${dates[lastIdx]}`,
        );
    } else if (longPos === 1) {
      longPl[lastIdx] = longPl[lastIdx > 0 ? lastIdx - 1 : 0] ?? 0;
    }
    if (forceFinalLiquidation && shortPos === 1 && finalP !== null && shortShares > 0) {
      const shortProceeds = shortShares * lastShortP * (1 - sellFee / 100);
      const coverCostWithFee = shortShares * finalP * (1 + buyFee / 100);
      const prof = shortProceeds - coverCostWithFee;
      shortCap += prof;
      const finalTradeData = {
        type: "cover",
        date: dates[lastIdx],
        price: finalP,
        shares: shortShares,
        revenue: coverCostWithFee,
        profit: prof,
        profitPercent: shortProceeds > 0 ? (prof / shortProceeds) * 100 : 0,
        capital_after: shortCap,
        triggeredByStopLoss: false,
        triggeredByTakeProfit: false,
        triggeringStrategy: "EndOfPeriod",
        simType: "short",
      };
      shortTrades.push(finalTradeData);
      if (!coverSigs.some((s) => s.index === lastIdx))
        coverSigs.push({ date: dates[lastIdx], index: lastIdx });
      shortStateSeries[lastIdx] = "出場";
      positionStatesFull[lastIdx] = combinePositionLabel(
        longStateSeries[lastIdx],
        shortStateSeries[lastIdx],
      );
      const lastShortI = shortTrades.map((t) => t.type).lastIndexOf("short");
      if (lastShortI !== -1 && shortTrades[lastShortI].shares === shortShares) {
        shortCompletedTrades.push({
          entry: shortTrades[lastShortI],
          exit: finalTradeData,
          profit: prof,
          profitPercent: finalTradeData.profitPercent,
        });
      }
      shortPl[lastIdx] = shortCap - initialCapital;
      shortPos = 0;
      shortShares = 0;
      console.log(
        `[Worker SHORT] Final Cover Executed: ${finalTradeData.shares}@${finalP} on ${dates[lastIdx]}`,
      );
    } else if (shortPos === 1) {
      shortPl[lastIdx] = shortPl[lastIdx > 0 ? lastIdx - 1 : 0] ?? 0;
    }
    const trailingLevels = computeTrailingStopLevels(
      longStateSeries,
      shortStateSeries,
      highs,
      lows,
      {
        exitStrategy,
        exitParams,
        enableShorting,
        shortExitStrategy,
        shortExitParams,
      },
    );
    indicatorDisplayFull = buildIndicatorDisplay(params, indicators, {
      data,
      highs,
      lows,
      closes,
      volumes,
      longTrailingStops: trailingLevels.longLevels,
      shortTrailingStops: trailingLevels.shortLevels,
    });
    self.postMessage({
      type: "progress",
      progress: 95,
      message: "計算最終結果...",
    });
    portfolioVal[lastIdx] =
      initialCapital + (longPl[lastIdx] ?? 0) + (shortPl[lastIdx] ?? 0);
    strategyReturns[lastIdx] =
      initialCapital > 0
        ? ((portfolioVal[lastIdx] - initialCapital) / initialCapital) * 100
        : 0;
    const finalV = portfolioVal[lastIdx];
    const totalP = finalV - initialCapital;
    const returnR = initialCapital > 0 ? (totalP / initialCapital) * 100 : 0;
    allCompletedTrades = [...longCompletedTrades, ...shortCompletedTrades].sort(
      (a, b) => new Date(a.exit.date) - new Date(b.exit.date),
    );
    allTrades = [...longTrades, ...shortTrades].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    totalWinTrades = allCompletedTrades.filter(
      (t) => (t.profit || 0) > 0,
    ).length;
    const tradesC = allCompletedTrades.length;
    const winR = tradesC > 0 ? (totalWinTrades / tradesC) * 100 : 0;
    curCL = 0;
    maxCL = 0;
    for (const trade of allCompletedTrades) {
      if ((trade.profit || 0) < 0) {
        curCL++;
        maxCL = Math.max(maxCL, curCL);
      } else {
        curCL = 0;
      }
    }

    if (captureFinalState && !finalEvaluation && lastValidEvaluation) {
      const requestedLastDate = dates[lastIdx] || null;
      const fallbackFromDate =
        lastValidEvaluation?.date ||
        (lastValidEvaluationIndex !== null && lastValidEvaluationIndex >= 0
          ? dates[lastValidEvaluationIndex] || null
          : null);
      const fallbackLagBars =
        lastValidEvaluationIndex !== null && lastValidEvaluationIndex >= 0
          ? lastIdx - lastValidEvaluationIndex
          : null;
      const fallbackLagDays =
        fallbackFromDate && requestedLastDate
          ? diffIsoDays(fallbackFromDate, requestedLastDate)
          : null;
      const missingFinalClose =
        lastIdx >= 0 && (!check(closes[lastIdx]) || closes[lastIdx] <= 0);
      finalEvaluationFallbackReason = "final_evaluation_degraded_missing_price";
      finalEvaluationFallbackMeta = {
        fallback: true,
        fallbackReason: finalEvaluationFallbackReason,
        fallbackFromIndex: lastValidEvaluationIndex,
        fallbackFromDate,
        requestedLastIndex: lastIdx,
        requestedLastDate,
        fallbackLagBars,
        fallbackLagDays,
        missingFinalClose,
      };
      const fallbackEvaluation = { ...lastValidEvaluation };
      fallbackEvaluation.meta = {
        ...(lastValidEvaluation?.meta || {}),
        ...finalEvaluationFallbackMeta,
      };
      finalEvaluation = fallbackEvaluation;
      finalEvaluationIndex = lastValidEvaluationIndex;
    }
    if (!finalEvaluation && captureFinalState) {
      finalStateReason = "final_evaluation_missing";
    }
    if (finalEvaluationFallbackMeta) {
      finalStateReason = finalEvaluationFallbackReason;
      finalStateFallback = finalEvaluationFallbackMeta;
    }

  let annualR = 0;
  let buyHoldAnnualizedReturn = 0;
  let firstValidPriceIdxBH = -1;
  let lastValidPriceIdxBH = -1;
  const buyHoldSummary = {
    firstValidPriceIdx: null,
    firstValidPriceDate: null,
    firstValidPriceGapFromEffective: null,
    firstValidPriceGapFromRequested: null,
    invalidBarsBeforeFirstValid: { count: 0, samples: [] },
    gapToleranceDays: CRITICAL_START_GAP_TOLERANCE_DAYS,
    exceedsGapTolerance: false,
  };
  // 使用使用者設定的日期範圍來計算年化報酬
  const firstDateStr = params.startDate;
  const lastDateStr = params.endDate;
    if (firstDateStr && lastDateStr) {
      const firstD = new Date(firstDateStr);
      const lastD = new Date(lastDateStr);
      const years =
        (lastD.getTime() - firstD.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      console.log(
        `[Worker] Strategy date range: ${firstDateStr} to ${lastDateStr} (startIdx: ${startIdx}, lastIdx: ${lastIdx})`,
      );
      console.log(
        `[Worker] Annualization Years (Strategy): ${years.toFixed(4)} (from ${firstDateStr} to ${lastDateStr})`,
      );
      if (years > 1 / (365.25 * 2)) {
        if (initialCapital > 0 && check(finalV) && finalV > 0) {
          try {
            annualR = (Math.pow(finalV / initialCapital, 1 / years) - 1) * 100;
          } catch {
            annualR = 0;
          }
        } else if (finalV <= 0 && initialCapital > 0) {
          annualR = -100;
        }
      } else if (initialCapital > 0) {
        annualR = returnR;
        console.warn(
          `[Worker] Backtest duration (${years.toFixed(4)} years) too short for meaningful annualization. Using total return rate.`,
        );
      }

      // 使用設定的日期範圍找出對應的價格
      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);
      firstValidPriceIdxBH = closes.findIndex(
        (p, i) => check(p) && p > 0 && new Date(dates[i]) >= startDate,
      );
      lastValidPriceIdxBH = closes
        .map((p, i) => check(p) && p > 0 && new Date(dates[i]) <= endDate)
        .lastIndexOf(true);
      if (
        firstValidPriceIdxBH !== -1 &&
        lastValidPriceIdxBH !== -1 &&
        lastValidPriceIdxBH >= firstValidPriceIdxBH
      ) {
        const firstValidPriceBH = closes[firstValidPriceIdxBH];
        const lastValidPriceBH = closes[lastValidPriceIdxBH];
        const firstValidDateBH = new Date(dates[firstValidPriceIdxBH]);
        const lastValidDateBH = new Date(dates[lastValidPriceIdxBH]);
        buyHoldSummary.firstValidPriceIdx = firstValidPriceIdxBH;
        buyHoldSummary.firstValidPriceDate = dates[firstValidPriceIdxBH] || null;
        buyHoldSummary.firstValidPriceGapFromEffective = diffIsoDays(
          effectiveStartISO,
          dates[firstValidPriceIdxBH],
        );
        buyHoldSummary.firstValidPriceGapFromRequested = diffIsoDays(
          userStartISO,
          dates[firstValidPriceIdxBH],
        );
        let invalidBeforeCount = 0;
        const invalidBeforeSamples = [];
        if (firstValidPriceIdxBH > effectiveStartIdx) {
          for (let i = effectiveStartIdx; i < firstValidPriceIdxBH; i += 1) {
            if (!check(closes[i]) || closes[i] <= 0) {
              invalidBeforeCount += 1;
              if (invalidBeforeSamples.length < 5) {
                invalidBeforeSamples.push({
                  index: i,
                  date: dates[i],
                  close: closes[i],
                  volume: volumes[i],
                });
              }
            }
          }
        }
        buyHoldSummary.invalidBarsBeforeFirstValid = {
          count: invalidBeforeCount,
          samples: invalidBeforeSamples,
        };
        if (
          Number.isFinite(
            buyHoldSummary.firstValidPriceGapFromEffective,
          ) &&
          buyHoldSummary.firstValidPriceGapFromEffective > 1
        ) {
          console.warn(
            `[Worker] ${params.stockNo} 買入持有首筆有效收盤價落後暖身起點 ${buyHoldSummary.firstValidPriceGapFromEffective} 天。`,
          );
        }
        if (
          Number.isFinite(
            buyHoldSummary.firstValidPriceGapFromRequested,
          ) &&
          buyHoldSummary.firstValidPriceGapFromRequested >
            CRITICAL_START_GAP_TOLERANCE_DAYS
        ) {
          buyHoldSummary.exceedsGapTolerance = true;
          console.warn(
            `[Worker] ${params.stockNo} 買入持有首筆有效收盤價落後使用者起點 ${buyHoldSummary.firstValidPriceGapFromRequested} 天，超過容許的 ${CRITICAL_START_GAP_TOLERANCE_DAYS} 天暖身寬限。`,
          );
        }
        if (invalidBeforeCount > 0) {
          const invalidPreview = invalidBeforeSamples.map((sample) =>
            `${sample.date || sample.index}: close=${sample.close}, volume=${sample.volume}`,
          );
          console.warn(
            `[Worker] ${params.stockNo} 暖身期內共有 ${invalidBeforeCount} 筆收盤價無效資料，樣本：${invalidPreview
              .slice(0, 3)
              .join("；")}`,
          );
        }
        const bhYears =
          (lastValidDateBH.getTime() - firstValidDateBH.getTime()) /
          (1000 * 60 * 60 * 24 * 365.25);
        console.log(
          `[Worker] B&H date range: ${dates[firstValidPriceIdxBH]} to ${dates[lastValidPriceIdxBH]} (firstValidPriceIdxBH: ${firstValidPriceIdxBH}, lastValidPriceIdxBH: ${lastValidPriceIdxBH})`,
        );
        console.log(
          `[Worker] Annualization Years (B&H): ${bhYears.toFixed(4)} (from ${dates[firstValidPriceIdxBH]} to ${dates[lastValidPriceIdxBH]})`,
        );
        let bhTotalReturn =
          firstValidPriceBH !== 0
            ? ((lastValidPriceBH - firstValidPriceBH) / firstValidPriceBH) * 100
            : 0;
        if (buyHoldSummary.exceedsGapTolerance) {
          bhTotalReturn = 0;
        }
        if (bhYears > 1 / (365.25 * 2) && firstValidPriceBH > 0) {
          try {
            buyHoldAnnualizedReturn =
              (Math.pow(lastValidPriceBH / firstValidPriceBH, 1 / bhYears) -
                1) *
              100;
          } catch {
            buyHoldAnnualizedReturn = bhTotalReturn;
          }
        } else {
          buyHoldAnnualizedReturn = bhTotalReturn;
          console.warn(
            `[Worker] B&H duration (${bhYears.toFixed(4)} years) too short for meaningful annualization. Using total B&H return rate.`,
          );
        }
        if (buyHoldSummary.exceedsGapTolerance) {
          buyHoldAnnualizedReturn = 0;
        }
      }
    }
    const validPortfolioSlice = portfolioVal
      .slice(startIdx)
      .filter((v) => check(v));
    const dailyR = calculateDailyReturns(
      validPortfolioSlice,
      dates.slice(startIdx),
    );
    const sharpeR = calculateSharpeRatio(dailyR, annualR);
    const sortinoR = calculateSortinoRatio(dailyR, annualR);
    const oosMomentSums = computeReturnMomentSums(dailyR);

    let annReturnHalf1 = null,
      sharpeHalf1 = null,
      annReturnHalf2 = null,
      sharpeHalf2 = null;
    const validDataLength = validPortfolioSlice.length;
    if (validDataLength >= 4) {
      const midPoint = Math.floor(validDataLength / 2);
      const firstHalfPortfolio = validPortfolioSlice.slice(0, midPoint);
      const secondHalfPortfolio = validPortfolioSlice.slice(midPoint);
      const firstHalfDates = dates.slice(startIdx, startIdx + midPoint);
      const secondHalfDates = dates.slice(
        startIdx + midPoint,
        startIdx + validDataLength,
      );
      if (firstHalfPortfolio.length > 1) {
        const firstHalfDailyReturns = calculateDailyReturns(
          firstHalfPortfolio,
          firstHalfDates,
        );
        const firstHalfStartVal = firstHalfPortfolio[0];
        const firstHalfEndVal =
          firstHalfPortfolio[firstHalfPortfolio.length - 1];
        const totalReturnHalf1 =
          firstHalfStartVal !== 0
            ? (firstHalfEndVal / firstHalfStartVal - 1) * 100
            : 0;
        annReturnHalf1 = totalReturnHalf1;
        const avgDailyReturn1 =
          firstHalfDailyReturns.reduce((s, r) => s + r, 0) /
          firstHalfDailyReturns.length;
        const variance1 =
          firstHalfDailyReturns.reduce(
            (s, r) => s + Math.pow(r - avgDailyReturn1, 2),
            0,
          ) / firstHalfDailyReturns.length;
        const stdDev1 = Math.sqrt(variance1);
        const annStdDev1 = stdDev1 * Math.sqrt(252);
        const approxAnnReturn1 =
          firstHalfDailyReturns.length > 0 ? avgDailyReturn1 * 252 * 100 : 0;
        const annExcessReturn1 = approxAnnReturn1 / 100 - 0.01;
        sharpeHalf1 = annStdDev1 !== 0 ? annExcessReturn1 / annStdDev1 : 0;
      }
      if (secondHalfPortfolio.length > 1) {
        const secondHalfDailyReturns = calculateDailyReturns(
          secondHalfPortfolio,
          secondHalfDates,
        );
        const secondHalfStartVal = secondHalfPortfolio[0];
        const secondHalfEndVal =
          secondHalfPortfolio[secondHalfPortfolio.length - 1];
        const totalReturnHalf2 =
          secondHalfStartVal !== 0
            ? (secondHalfEndVal / secondHalfStartVal - 1) * 100
            : 0;
        annReturnHalf2 = totalReturnHalf2;
        const avgDailyReturn2 =
          secondHalfDailyReturns.reduce((s, r) => s + r, 0) /
          secondHalfDailyReturns.length;
        const variance2 =
          secondHalfDailyReturns.reduce(
            (s, r) => s + Math.pow(r - avgDailyReturn2, 2),
            0,
          ) / secondHalfDailyReturns.length;
        const stdDev2 = Math.sqrt(variance2);
        const annStdDev2 = stdDev2 * Math.sqrt(252);
        const approxAnnReturn2 =
          secondHalfDailyReturns.length > 0 ? avgDailyReturn2 * 252 * 100 : 0;
        const annExcessReturn2 = approxAnnReturn2 / 100 - 0.01;
        sharpeHalf2 = annStdDev2 !== 0 ? annExcessReturn2 / annStdDev2 : 0;
      }
    }
    const subPeriodResults = {};
    const overallEndDate = new Date(lastDateStr || params.endDate);
    const overallStartDate = new Date(firstDateStr || params.startDate);
    const totalDurationMillis = overallEndDate - overallStartDate;
    const totalYears = totalDurationMillis / (1000 * 60 * 60 * 24 * 365.25);
    const totalDaysApprox = Math.max(
      1,
      totalDurationMillis / (1000 * 60 * 60 * 24),
    );
    const periodsToCalculate = {};
    if (totalDaysApprox >= 30) periodsToCalculate["1M"] = 1;
    if (totalDaysApprox >= 180) periodsToCalculate["6M"] = 6;
    if (totalYears >= 1) {
      for (let y = 1; y <= Math.floor(totalYears); y++) {
        periodsToCalculate[`${y}Y`] = y * 12;
      }
    }
    const floorTotalYears = Math.floor(totalYears);
    if (floorTotalYears >= 1 && !periodsToCalculate[`${floorTotalYears}Y`]) {
      periodsToCalculate[`${floorTotalYears}Y`] = floorTotalYears * 12;
    }
    let bhReturnsFull = Array(n).fill(null);
    const bhBaselineIdx = firstValidPriceIdxBH;
    if (
      bhBaselineIdx !== -1 &&
      bhBaselineIdx < n &&
      check(closes[bhBaselineIdx]) &&
      closes[bhBaselineIdx] > 0
    ) {
      const baselinePrice = closes[bhBaselineIdx];
      for (let i = bhBaselineIdx; i < n; i += 1) {
        if (check(closes[i]) && closes[i] > 0) {
          bhReturnsFull[i] = ((closes[i] - baselinePrice) / baselinePrice) * 100;
        } else if (i > bhBaselineIdx && bhReturnsFull[i - 1] !== null) {
          bhReturnsFull[i] = bhReturnsFull[i - 1];
        } else if (i === bhBaselineIdx) {
          bhReturnsFull[i] = 0;
        } else {
          bhReturnsFull[i] = 0;
        }
      }
      if (bhBaselineIdx > 0 && effectiveStartIdx < n) {
        const fillStart = Math.max(0, effectiveStartIdx);
        for (let i = bhBaselineIdx - 1; i >= fillStart; i -= 1) {
          if (bhReturnsFull[i] === null) {
            bhReturnsFull[i] = 0;
          }
        }
      }
    } else {
      bhReturnsFull = Array(n).fill(0);
    }
    if (buyHoldSummary.exceedsGapTolerance) {
      bhReturnsFull = Array(n).fill(0);
    }
    for (const [label, months] of Object.entries(periodsToCalculate)) {
      const subStartDate = new Date(overallEndDate);
      subStartDate.setMonth(subStartDate.getMonth() - months);
      subStartDate.setDate(subStartDate.getDate() + 1);
      const subStartDateStr = subStartDate.toISOString().split("T")[0];
      let subStartIdx = dates.findIndex((d) => d >= subStartDateStr);
      if (subStartIdx === -1 || subStartIdx < startIdx) {
        subStartIdx = startIdx;
      }
      if (subStartIdx <= lastIdx) {
        const subEndIdx = lastIdx;
        const subPortfolioVals = portfolioVal
          .slice(subStartIdx, subEndIdx + 1)
          .filter((v) => check(v));
        const subBHRawPrices = closes
          .slice(subStartIdx, subEndIdx + 1)
          .filter((v) => check(v));
        const subDates = dates.slice(subStartIdx, subEndIdx + 1);
        if (
          subPortfolioVals.length > 1 &&
          subDates.length > 1 &&
          subBHRawPrices.length > 1
        ) {
          const subStartVal = subPortfolioVals[0];
          const subEndVal = subPortfolioVals[subPortfolioVals.length - 1];
          const subTotalReturn =
            subStartVal !== 0
              ? ((subEndVal - subStartVal) / subStartVal) * 100
              : 0;
          const subStartBHPrice = subBHRawPrices[0];
          const subEndBHPrice = subBHRawPrices[subBHRawPrices.length - 1];
          const subBHTotalReturn =
            subStartBHPrice !== 0
              ? ((subEndBHPrice - subStartBHPrice) / subStartBHPrice) * 100
              : 0;
          const subDailyReturns = calculateDailyReturns(
            subPortfolioVals,
            subDates,
          );
          const subAnnualizedReturn = 0;
          const subSharpe = calculateSharpeRatio(
            subDailyReturns,
            subAnnualizedReturn,
          );
          const subSortino = calculateSortinoRatio(
            subDailyReturns,
            subAnnualizedReturn,
          );
          const subMaxDD = calculateMaxDrawdown(subPortfolioVals);
          subPeriodResults[label] = {
            totalReturn: subTotalReturn,
            totalBuyHoldReturn: subBHTotalReturn,
            sharpeRatio: subSharpe,
            sortinoRatio: subSortino,
            maxDrawdown: subMaxDD,
          };
        } else {
          subPeriodResults[label] = null;
        }
      } else {
        subPeriodResults[label] = null;
      }
    }

    if (!suppressProgress) {
      self.postMessage({ type: "progress", progress: 100, message: "完成" });
    }
    const visibleStartIdx = Math.max(0, effectiveStartIdx);
    const sliceArray = (arr) =>
      Array.isArray(arr) ? arr.slice(visibleStartIdx) : [];
    const adjustSignals = (signals) =>
      Array.isArray(signals)
        ? signals
            .filter(
              (s) => typeof s.index === "number" && s.index >= visibleStartIdx,
            )
            .map((s) => ({ ...s, index: s.index - visibleStartIdx }))
        : [];
    const trimmedIndicatorDisplay = sliceIndicatorDisplay(
      indicatorDisplayFull,
      visibleStartIdx,
    );
    const trimmedPositionStates = positionStatesFull.slice(visibleStartIdx);
    const trimmedEntryStageStates = sliceArray(longEntryStageStates);
    const trimmedExitStageStates = sliceArray(longExitStageStates);
    const datasetLastDate = dates[lastIdx] || null;
    let finalStateSnapshot = null;
    if (n > 0 && lastIdx >= 0) {
      finalStateSnapshot = {
        date: dates[lastIdx] || null,
        close: Number.isFinite(closes[lastIdx]) ? closes[lastIdx] : null,
        longState: longStateSeries[lastIdx] || null,
        shortState: shortStateSeries[lastIdx] || null,
        longPos: Number.isFinite(longPos) ? longPos : null,
        shortPos: Number.isFinite(shortPos) ? shortPos : null,
        longShares: Number.isFinite(longShares) ? longShares : null,
        shortShares: Number.isFinite(shortShares) ? shortShares : null,
        longCapital: Number.isFinite(longCap) ? longCap : null,
        shortCapital: Number.isFinite(shortCap) ? shortCap : null,
        portfolioValue: Number.isFinite(portfolioVal[lastIdx])
          ? portfolioVal[lastIdx]
          : null,
        strategyReturn: Number.isFinite(strategyReturns[lastIdx])
          ? strategyReturns[lastIdx]
          : null,
      };
    }
    if (finalStateSnapshot && finalEvaluationFallbackMeta) {
      finalStateSnapshot.latestValidDate =
        finalEvaluationFallbackMeta.fallbackFromDate || finalStateSnapshot.date;
      finalStateSnapshot.requestedLastDate =
        finalEvaluationFallbackMeta.requestedLastDate || finalStateSnapshot.date;
      if (Number.isFinite(finalEvaluationFallbackMeta.fallbackLagDays)) {
        finalStateSnapshot.fallbackLagDays =
          finalEvaluationFallbackMeta.fallbackLagDays;
      }
      if (Number.isFinite(finalEvaluationFallbackMeta.fallbackLagBars)) {
        finalStateSnapshot.fallbackLagBars =
          finalEvaluationFallbackMeta.fallbackLagBars;
      }
      if (typeof finalEvaluationFallbackMeta.missingFinalClose === "boolean") {
        finalStateSnapshot.missingFinalClose =
          finalEvaluationFallbackMeta.missingFinalClose;
      }
    }
    const pendingTradeSnapshot = pendingNextDayTrade
      ? {
          type: pendingNextDayTrade.type || pendingNextDayTrade.kind || null,
          action: pendingNextDayTrade.action || null,
          strategy: pendingNextDayTrade.strategy || null,
          reason: pendingNextDayTrade.reason || null,
          triggeredAt: pendingNextDayTrade.triggeredAt || null,
          plannedDate:
            pendingNextDayTrade.date || pendingNextDayTrade.nextDate || null,
        }
      : null;

    const runtimeDiagnostics = {
      dataset: datasetSummary,
      warmup: warmupSummary,
      buyHold: buyHoldSummary,
      finalState: {
        captured: Boolean(finalEvaluation),
        snapshot: finalStateSnapshot,
        pendingNextDayTrade: pendingTradeSnapshot,
        reason: finalStateReason,
        fallback: finalStateFallback,
        evaluationIndex: finalEvaluationIndex,
        datasetLastDate,
        lastValidEvaluationDate:
          lastValidEvaluation?.date ||
          (lastValidEvaluationIndex !== null && lastValidEvaluationIndex >= 0
            ? dates[lastValidEvaluationIndex] || null
            : null),
      },
    };
    if (typeof console.groupCollapsed === "function") {
      console.groupCollapsed(
        `[Worker] Runtime dataset diagnostics for ${params.stockNo}`,
      );
      console.log("[Worker] Dataset summary", datasetSummary);
      console.log("[Worker] Warmup summary", warmupSummary);
      console.log("[Worker] BuyHold summary", buyHoldSummary);
      console.groupEnd();
    } else {
      console.log("[Worker] Dataset summary", datasetSummary);
      console.log("[Worker] Warmup summary", warmupSummary);
      console.log("[Worker] BuyHold summary", buyHoldSummary);
    }

    const shouldSkipSensitivity =
      skipSensitivity || (params && params.__skipSensitivity);
    let sensitivityAnalysis = null;
    const baselineMetrics = {
      returnRate: returnR,
      annualizedReturn: annualR,
      sharpeRatio: sharpeR,
      sortinoRatio: sortinoR,
    };
    if (!shouldSkipSensitivity) {
      try {
        sensitivityAnalysis = computeParameterSensitivity({
          data,
          baseParams: params,
          baselineMetrics,
        });
      } catch (sensitivityError) {
        console.warn(
          "[Worker] Failed to compute sensitivity grid:",
          sensitivityError,
        );
      }
    }
    const result = {

      stockNo: params.stockNo,
      initialCapital: initialCapital,
      finalValue: finalV,
      totalProfit: totalP,
      returnRate: returnR,
      annualizedReturn: annualR,
      maxDrawdown: maxDD,
      winRate: winR,
      winTrades: totalWinTrades,
      tradesCount: tradesC,
      sharpeRatio: sharpeR,
      sortinoRatio: sortinoR,
      maxConsecutiveLosses: maxCL,
      trades: allTrades,
      completedTrades: allCompletedTrades,
      buyHoldReturns: sliceArray(bhReturnsFull),
      strategyReturns: sliceArray(strategyReturns),
      dates: sliceArray(dates),
      chartBuySignals: adjustSignals(buySigs),
        chartSellSignals: adjustSignals(sellSigs),
        chartShortSignals: adjustSignals(shortSigs),
        chartCoverSignals: adjustSignals(coverSigs),
        entryStrategy: params.entryStrategy,
        exitStrategy: params.exitStrategy,
        entryParams: params.entryParams,
        entryStages: entryStagePercents.slice(),
        entryStagingMode: entryStageMode,
        exitParams: params.exitParams,
        exitStages: exitStagePercents.slice(),
        exitStagingMode: exitStageMode,
      enableShorting: params.enableShorting,
      shortEntryStrategy: params.shortEntryStrategy,
      shortExitStrategy: params.shortExitStrategy,
      shortEntryParams: params.shortEntryParams,
      shortExitParams: params.shortExitParams,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      tradeTiming: params.tradeTiming,
      buyFee: params.buyFee,
      sellFee: params.sellFee,
      positionBasis: params.positionBasis,
      rawData: data,
      buyHoldAnnualizedReturn: buyHoldAnnualizedReturn,
      annReturnHalf1: annReturnHalf1,
      sharpeHalf1: sharpeHalf1,
      annReturnHalf2: annReturnHalf2,
      sharpeHalf2: sharpeHalf2,
      subPeriodResults: subPeriodResults,
      priceIndicatorSeries: trimmedIndicatorDisplay,
      positionStates: trimmedPositionStates,
      longEntryStageStates: trimmedEntryStageStates,
      longExitStageStates: trimmedExitStageStates,
      diagnostics: runtimeDiagnostics,
      parameterSensitivity: sensitivityAnalysis,
      sensitivityAnalysis,
      oosDailyStats: oosMomentSums,
    };
    if (captureFinalState) {
      result.finalEvaluation = finalEvaluation;
    }
    return result;
  } catch (finalError) {
    console.error("Final calculation error:", finalError);
    throw new Error(`計算最終結果錯誤: ${finalError.message}`);
  }
}

function evaluateSensitivityStability(averageDrift, averageSharpeDrop) {
  if (!Number.isFinite(averageDrift) && !Number.isFinite(averageSharpeDrop)) {
    return {
      score: null,
      driftPenalty: null,
      sharpePenalty: null,
    };
  }
  const driftPenalty = Number.isFinite(averageDrift)
    ? Math.max(0, averageDrift)
    : 0;
  const sharpePenaltyRaw = Number.isFinite(averageSharpeDrop)
    ? Math.max(0, averageSharpeDrop) * 100
    : 0;
  const sharpePenalty = Math.min(40, sharpePenaltyRaw);
  const baseScore = 100 - driftPenalty - sharpePenalty;
  const score = Math.max(0, Math.min(100, baseScore));
  return {
    score,
    driftPenalty,
    sharpePenalty,
  };
}

function computeParameterSensitivity({ data, baseParams, baselineMetrics }) {
  if (!Array.isArray(data) || data.length === 0 || !baseParams) {
    return null;
  }
  const contexts = buildSensitivityContexts(baseParams);
  if (!Array.isArray(contexts) || contexts.length === 0) {
    return null;
  }

  const baselineReturn = Number.isFinite(baselineMetrics?.returnRate)
    ? baselineMetrics.returnRate
    : 0;
  const baselineSharpe = Number.isFinite(baselineMetrics?.sharpeRatio)
    ? baselineMetrics.sharpeRatio
    : null;

  const summaryAccumulator = {
    driftValues: [],
    positive: [],
    negative: [],
    sharpeDrops: [],
    sharpeGains: [],
    scenarioCount: 0,
  };

  const groups = contexts
    .map((ctx) =>
      buildSensitivityGroup({
        context: ctx,
        data,
        baseParams,
        baselineReturn,
        baselineSharpe,
        summaryAccumulator,
      }),
    )
    .filter(Boolean);

  if (groups.length === 0) {
    return null;
  }

  const summaryAverage =
    summaryAccumulator.driftValues.length > 0
      ? summaryAccumulator.driftValues.reduce((sum, val) => sum + val, 0) /
        summaryAccumulator.driftValues.length
      : null;
  const summaryMax =
    summaryAccumulator.driftValues.length > 0
      ? Math.max(...summaryAccumulator.driftValues)
      : null;
  const summaryPositive =
    summaryAccumulator.positive.length > 0
      ? summaryAccumulator.positive.reduce((sum, val) => sum + val, 0) /
        summaryAccumulator.positive.length
      : null;
  const summaryNegative =
    summaryAccumulator.negative.length > 0
      ? summaryAccumulator.negative.reduce((sum, val) => sum + val, 0) /
        summaryAccumulator.negative.length
      : null;
  const summarySharpeDrop =
    summaryAccumulator.sharpeDrops.length > 0
      ? summaryAccumulator.sharpeDrops.reduce((sum, val) => sum + val, 0) /
        summaryAccumulator.sharpeDrops.length
      : null;
  const summarySharpeGain =
    summaryAccumulator.sharpeGains.length > 0
      ? summaryAccumulator.sharpeGains.reduce((sum, val) => sum + val, 0) /
        summaryAccumulator.sharpeGains.length
      : null;

  const stabilityComponents = evaluateSensitivityStability(
    summaryAverage,
    summarySharpeDrop,
  );
  const stabilityScore = stabilityComponents.score;

  return {
    version: SENSITIVITY_GRID_VERSION,
    gridConfig: {
      relativeSteps: SENSITIVITY_RELATIVE_STEPS.map((step) =>
        Number((step * 100).toFixed(1)),
      ),
      absoluteMultipliers: SENSITIVITY_ABSOLUTE_MULTIPLIERS.slice(),
    },
    summary: {
      averageDriftPercent: summaryAverage,
      maxDriftPercent: summaryMax,
      stabilityScore,
      stabilityComponents: {
        version: SENSITIVITY_SCORE_VERSION,
        driftPenalty: stabilityComponents.driftPenalty,
        sharpePenalty: stabilityComponents.sharpePenalty,
      },
      positiveDriftPercent: summaryPositive,
      negativeDriftPercent: summaryNegative,
      averageSharpeDrop: summarySharpeDrop,
      averageSharpeGain: summarySharpeGain,
      scenarioCount: summaryAccumulator.scenarioCount,
    },
    baseline: {
      returnRate: baselineReturn,
      annualizedReturn: Number.isFinite(baselineMetrics?.annualizedReturn)
        ? baselineMetrics.annualizedReturn
        : null,
      sharpeRatio: baselineSharpe,
    },
    groups,
  };
}

function buildSensitivityGroup({
  context,
  data,
  baseParams,
  baselineReturn,
  baselineSharpe,
  summaryAccumulator,
}) {
  const paramEntries = Object.entries(context.params || {})
    .filter(([_, value]) => Number.isFinite(value))
    .map(([key, value]) => ({ key, value }));
  if (paramEntries.length === 0) {
    return null;
  }

  const parameters = paramEntries
    .map((entry) =>
      evaluateSensitivityParameter({
        context,
        paramName: entry.key,
        baseValue: entry.value,
        data,
        baseParams,
        baselineReturn,
        baselineSharpe,
        summaryAccumulator,
      }),
    )
    .filter(Boolean);

  if (parameters.length === 0) {
    return null;
  }

  const validAvg = parameters
    .map((p) => (Number.isFinite(p.averageDriftPercent) ? p.averageDriftPercent : null))
    .filter((value) => value !== null);
  const groupAverage =
    validAvg.length > 0
      ? validAvg.reduce((sum, val) => sum + val, 0) / validAvg.length
      : null;
  const validMax = parameters
    .map((p) => (Number.isFinite(p.maxDriftPercent) ? p.maxDriftPercent : null))
    .filter((value) => value !== null);
  const groupMax =
    validMax.length > 0 ? Math.max(...validMax) : null;
  const validPositive = parameters
    .map((p) =>
      Number.isFinite(p.positiveDriftPercent) ? p.positiveDriftPercent : null,
    )
    .filter((value) => value !== null);
  const groupPositive =
    validPositive.length > 0
      ? validPositive.reduce((sum, val) => sum + val, 0) / validPositive.length
      : null;
  const validNegative = parameters
    .map((p) =>
      Number.isFinite(p.negativeDriftPercent) ? p.negativeDriftPercent : null,
    )
    .filter((value) => value !== null);
  const groupNegative =
    validNegative.length > 0
      ? validNegative.reduce((sum, val) => sum + val, 0) / validNegative.length
      : null;
  const validSharpeDrop = parameters
    .map((p) =>
      Number.isFinite(p.averageSharpeDrop) ? p.averageSharpeDrop : null,
    )
    .filter((value) => value !== null);
  const groupSharpeDrop =
    validSharpeDrop.length > 0
      ? validSharpeDrop.reduce((sum, val) => sum + val, 0) / validSharpeDrop.length
      : null;
  const validSharpeGain = parameters
    .map((p) =>
      Number.isFinite(p.averageSharpeGain) ? p.averageSharpeGain : null,
    )
    .filter((value) => value !== null);
  const groupSharpeGain =
    validSharpeGain.length > 0
      ? validSharpeGain.reduce((sum, val) => sum + val, 0) /
        validSharpeGain.length
      : null;
  const groupStabilityComponents = evaluateSensitivityStability(
    groupAverage,
    groupSharpeDrop,
  );
  const groupScore = groupStabilityComponents.score;

  return {
    key: context.key,
    label: context.label,
    strategy: context.strategy,
    scenarioCount: parameters.reduce(
      (sum, param) => sum + (param.scenarioCount || 0),
      0,
    ),
    averageDriftPercent: groupAverage,
    stabilityScore: groupScore,
    maxDriftPercent: groupMax,
    positiveDriftPercent: groupPositive,
    negativeDriftPercent: groupNegative,
    averageSharpeDrop: groupSharpeDrop,
    averageSharpeGain: groupSharpeGain,
    stabilityComponents: {
      version: SENSITIVITY_SCORE_VERSION,
      driftPenalty: groupStabilityComponents.driftPenalty,
      sharpePenalty: groupStabilityComponents.sharpePenalty,
    },
    parameters,
  };
}

function evaluateSensitivityParameter({
  context,
  paramName,
  baseValue,
  data,
  baseParams,
  baselineReturn,
  baselineSharpe,
  summaryAccumulator,
}) {
  if (!Number.isFinite(baseValue)) {
    return null;
  }
  const meta = context.metaMap.get(paramName) || null;
  const adjustments = generateSensitivityAdjustments(baseValue, meta);
  if (adjustments.length === 0) {
    return null;
  }

  const absoluteDrifts = [];
  const positiveDeltas = [];
  const negativeDeltas = [];
  const sharpeDrops = [];
  const sharpeGains = [];
  const scenarios = [];

  adjustments.forEach((adjustment) => {
    const scenarioParams = cloneParamsForSensitivity(baseParams);
    applyParamValueForContext(scenarioParams, context, paramName, adjustment.value);
    let scenarioResult = null;
    try {
      scenarioResult = runStrategy(data, scenarioParams, {
        suppressProgress: true,
        skipSensitivity: true,
      });
    } catch (scenarioError) {
      console.warn(
        `[Worker Sensitivity] ${context.key}.${paramName} ${adjustment.label} 失敗:`,
        scenarioError,
      );
    }

    if (scenarioResult && typeof scenarioResult === "object") {
      const scenarioReturn = Number.isFinite(scenarioResult.returnRate)
        ? scenarioResult.returnRate
        : null;
      const deltaReturn =
        Number.isFinite(scenarioReturn) && Number.isFinite(baselineReturn)
          ? scenarioReturn - baselineReturn
          : null;
      const driftPercent =
        Number.isFinite(deltaReturn) ? Math.abs(deltaReturn) : null;
      const scenarioSharpe = Number.isFinite(scenarioResult.sharpeRatio)
        ? scenarioResult.sharpeRatio
        : null;
      let deltaSharpe = null;
      if (Number.isFinite(scenarioSharpe) && Number.isFinite(baselineSharpe)) {
        deltaSharpe = scenarioSharpe - baselineSharpe;
      } else if (Number.isFinite(scenarioSharpe) && baselineSharpe === null) {
        deltaSharpe = scenarioSharpe;
      } else if (
        scenarioSharpe === null &&
        Number.isFinite(baselineSharpe)
      ) {
        deltaSharpe = -baselineSharpe;
      }

      if (Number.isFinite(driftPercent)) {
        absoluteDrifts.push(driftPercent);
        summaryAccumulator.driftValues.push(driftPercent);
        summaryAccumulator.scenarioCount += 1;
      }
      if (Number.isFinite(deltaReturn)) {
        if (deltaReturn >= 0) {
          positiveDeltas.push(deltaReturn);
          summaryAccumulator.positive.push(deltaReturn);
        } else {
          negativeDeltas.push(deltaReturn);
          summaryAccumulator.negative.push(deltaReturn);
        }
      }
      if (Number.isFinite(deltaSharpe)) {
        if (deltaSharpe >= 0) {
          sharpeGains.push(deltaSharpe);
          summaryAccumulator.sharpeGains.push(deltaSharpe);
        } else {
          const sharpeDrop = Math.abs(deltaSharpe);
          sharpeDrops.push(sharpeDrop);
          summaryAccumulator.sharpeDrops.push(sharpeDrop);
        }
      }

      scenarios.push({
        label: adjustment.label,
        type: adjustment.type,
        direction: adjustment.direction,
        value: adjustment.value,
        deltaReturn,
        driftPercent,
        deltaSharpe,
        run: {
          returnRate: scenarioReturn,
          annualizedReturn: Number.isFinite(
            scenarioResult.annualizedReturn
          )
            ? scenarioResult.annualizedReturn
            : null,
          sharpeRatio: scenarioSharpe,
        },
      });
    } else {
      scenarios.push({
        label: adjustment.label,
        type: adjustment.type,
        direction: adjustment.direction,
        value: adjustment.value,
        deltaReturn: null,
        driftPercent: null,
        deltaSharpe: null,
        run: null,
        error: true,
      });
    }
  });

  if (scenarios.length === 0) {
    return null;
  }

  const avgDrift =
    absoluteDrifts.length > 0
      ? absoluteDrifts.reduce((sum, val) => sum + val, 0) /
        absoluteDrifts.length
      : null;
  const maxDrift =
    absoluteDrifts.length > 0 ? Math.max(...absoluteDrifts) : null;
  const positiveBias =
    positiveDeltas.length > 0
      ? positiveDeltas.reduce((sum, val) => sum + val, 0) /
        positiveDeltas.length
      : null;
  const negativeBias =
    negativeDeltas.length > 0
      ? negativeDeltas.reduce((sum, val) => sum + val, 0) /
        negativeDeltas.length
      : null;
  const avgSharpeDrop =
    sharpeDrops.length > 0
      ? sharpeDrops.reduce((sum, val) => sum + val, 0) / sharpeDrops.length
      : null;
  const avgSharpeGain =
    sharpeGains.length > 0
      ? sharpeGains.reduce((sum, val) => sum + val, 0) / sharpeGains.length
      : null;
  const stabilityComponents = evaluateSensitivityStability(
    avgDrift,
    avgSharpeDrop,
  );
  const stabilityScore = stabilityComponents.score;

  return {
    key: paramName,
    name: resolveParamLabel(paramName, meta, context),
    baseValue,
    scenarios,
    scenarioCount: scenarios.filter((s) => s && s.run).length,
    averageDriftPercent: avgDrift,
    maxDriftPercent: maxDrift,
    positiveDriftPercent: positiveBias,
    negativeDriftPercent: negativeBias,
    averageSharpeDrop: avgSharpeDrop,
    averageSharpeGain: avgSharpeGain,
    stabilityScore,
    stabilityComponents: {
      version: SENSITIVITY_SCORE_VERSION,
      driftPenalty: stabilityComponents.driftPenalty,
      sharpePenalty: stabilityComponents.sharpePenalty,
    },
  };
}

function buildSensitivityContexts(baseParams) {
  const contexts = [];
  if (
    baseParams.entryStrategy &&
    baseParams.entryParams &&
    typeof baseParams.entryParams === "object"
  ) {
    contexts.push({
      key: "entry",
      type: "entry",
      label: `進場｜${resolveStrategyName(baseParams.entryStrategy)}`,
      strategy: baseParams.entryStrategy,
      params: baseParams.entryParams,
      metaMap: buildParamMetaMap(baseParams.entryStrategy),
    });
  }
  if (
    baseParams.exitStrategy &&
    baseParams.exitParams &&
    typeof baseParams.exitParams === "object"
  ) {
    contexts.push({
      key: "exit",
      type: "exit",
      label: `出場｜${resolveStrategyName(baseParams.exitStrategy)}`,
      strategy: baseParams.exitStrategy,
      params: baseParams.exitParams,
      metaMap: buildParamMetaMap(baseParams.exitStrategy),
    });
  }
  if (
    baseParams.enableShorting &&
    baseParams.shortEntryStrategy &&
    baseParams.shortEntryParams &&
    typeof baseParams.shortEntryParams === "object"
  ) {
    contexts.push({
      key: "shortEntry",
      type: "shortEntry",
      label: `做空進場｜${resolveStrategyName(baseParams.shortEntryStrategy)}`,
      strategy: baseParams.shortEntryStrategy,
      params: baseParams.shortEntryParams,
      metaMap: buildParamMetaMap(baseParams.shortEntryStrategy),
    });
  }
  if (
    baseParams.enableShorting &&
    baseParams.shortExitStrategy &&
    baseParams.shortExitParams &&
    typeof baseParams.shortExitParams === "object"
  ) {
    contexts.push({
      key: "shortExit",
      type: "shortExit",
      label: `回補出場｜${resolveStrategyName(baseParams.shortExitStrategy)}`,
      strategy: baseParams.shortExitStrategy,
      params: baseParams.shortExitParams,
      metaMap: buildParamMetaMap(baseParams.shortExitStrategy),
    });
  }

  const riskParams = {};
  if (Number.isFinite(baseParams.stopLoss)) {
    riskParams.stopLoss = baseParams.stopLoss;
  }
  if (Number.isFinite(baseParams.takeProfit)) {
    riskParams.takeProfit = baseParams.takeProfit;
  }
  if (Object.keys(riskParams).length > 0) {
    contexts.push({
      key: "risk",
      type: "risk",
      label: "風險管理",
      strategy: "global_risk",
      params: riskParams,
      metaMap: buildRiskMetaMap(),
    });
  }

  return contexts;
}

function resolveStrategyName(strategyKey) {
  if (!strategyKey) return "未設定";
  if (typeof strategyDescriptions === "object" && strategyDescriptions) {
    const desc = strategyDescriptions[strategyKey];
    if (desc && typeof desc.name === "string") {
      return desc.name;
    }
  }
  return strategyKey;
}

function resolveParamLabel(paramName, meta, context) {
  if (meta && typeof meta.label === "string") {
    return meta.label;
  }
  if (
    context &&
    context.metaMap &&
    typeof context.metaMap.get === "function" &&
    context.metaMap.get(paramName)
  ) {
    const metaEntry = context.metaMap.get(paramName);
    if (metaEntry && typeof metaEntry.label === "string") {
      return metaEntry.label;
    }
  }
  return paramName;
}

function buildParamMetaMap(strategyKey) {
  const map = new Map();
  if (
    typeof strategyDescriptions === "object" &&
    strategyDescriptions &&
    strategyDescriptions[strategyKey] &&
    Array.isArray(strategyDescriptions[strategyKey].optimizeTargets)
  ) {
    strategyDescriptions[strategyKey].optimizeTargets.forEach((target) => {
      if (target && target.name) {
        map.set(target.name, target);
      }
    });
  }
  return map;
}

function buildRiskMetaMap() {
  const map = new Map();
  if (
    typeof globalOptimizeTargets === "object" &&
    globalOptimizeTargets !== null
  ) {
    Object.entries(globalOptimizeTargets).forEach(([key, target]) => {
      if (target && target.label) {
        map.set(key, target);
      }
    });
  }
  return map;
}

function cloneParamsForSensitivity(baseParams) {
  const clone = {
    ...baseParams,
    entryParams: {
      ...(baseParams.entryParams && typeof baseParams.entryParams === "object"
        ? baseParams.entryParams
        : {}),
    },
    exitParams: {
      ...(baseParams.exitParams && typeof baseParams.exitParams === "object"
        ? baseParams.exitParams
        : {}),
    },
    shortEntryParams: {
      ...(baseParams.shortEntryParams &&
      typeof baseParams.shortEntryParams === "object"
        ? baseParams.shortEntryParams
        : {}),
    },
    shortExitParams: {
      ...(baseParams.shortExitParams &&
      typeof baseParams.shortExitParams === "object"
        ? baseParams.shortExitParams
        : {}),
    },
  };
  if (Array.isArray(baseParams.entryStages)) {
    clone.entryStages = baseParams.entryStages.slice();
  }
  if (Array.isArray(baseParams.exitStages)) {
    clone.exitStages = baseParams.exitStages.slice();
  }
  clone.__skipSensitivity = true;
  return clone;
}

function applyParamValueForContext(targetParams, context, paramName, value) {
  if (!context || !paramName) return;
  switch (context.type) {
    case "entry":
      targetParams.entryParams = {
        ...(targetParams.entryParams || {}),
        [paramName]: value,
      };
      break;
    case "exit":
      targetParams.exitParams = {
        ...(targetParams.exitParams || {}),
        [paramName]: value,
      };
      break;
    case "shortEntry":
      targetParams.shortEntryParams = {
        ...(targetParams.shortEntryParams || {}),
        [paramName]: value,
      };
      break;
    case "shortExit":
      targetParams.shortExitParams = {
        ...(targetParams.shortExitParams || {}),
        [paramName]: value,
      };
      break;
    case "risk":
      targetParams[paramName] = value;
      break;
    default:
      targetParams[paramName] = value;
      break;
  }
}

function generateSensitivityAdjustments(baseValue, meta) {
  const candidates = new Map();
  const range = meta && typeof meta.range === "object" ? meta.range : null;
  const stepCandidate =
    range && Number.isFinite(range.step) && range.step > 0 ? range.step : null;

  const addCandidate = (label, value, type, direction) => {
    if (!Number.isFinite(value)) return;
    if (baseValue > 0 && value <= 0) return;
    const normalised = normaliseCandidateValue(
      value,
      range,
      baseValue,
      stepCandidate,
    );
    if (!Number.isFinite(normalised)) return;
    const key = normalised.toFixed(6);
    if (candidates.has(key)) return;
    candidates.set(key, {
      label,
      value: normalised,
      type,
      direction,
    });
  };

  SENSITIVITY_RELATIVE_STEPS.forEach((ratio) => {
    const positiveValue = baseValue * (1 + ratio);
    const negativeValue = baseValue * (1 - ratio);
    addCandidate(`+${Math.round(ratio * 100)}%`, positiveValue, "relative", "increase");
    addCandidate(`-${Math.round(ratio * 100)}%`, negativeValue, "relative", "decrease");
  });

  let stepValue = stepCandidate;
  if (!Number.isFinite(stepValue) || stepValue <= 0) {
    stepValue = Number.isInteger(baseValue) ? 1 : 0;
  }
  if (Number.isFinite(stepValue) && stepValue > 0) {
    SENSITIVITY_ABSOLUTE_MULTIPLIERS.forEach((multiplier) => {
      const delta = stepValue * multiplier;
      const labelValue = formatAbsoluteLabel(delta);
      addCandidate(`+${labelValue}`, baseValue + delta, "absolute", "increase");
      addCandidate(`-${labelValue}`, baseValue - delta, "absolute", "decrease");
    });
  }

  const ordered = Array.from(candidates.values());
  return ordered.slice(0, SENSITIVITY_MAX_SCENARIOS_PER_PARAM);
}

function normaliseCandidateValue(value, range, baseValue, stepCandidate) {
  let candidate = value;
  if (Number.isFinite(stepCandidate) && stepCandidate > 0) {
    candidate = Math.round(candidate / stepCandidate) * stepCandidate;
  }
  if (
    Number.isInteger(baseValue) &&
    (!Number.isFinite(stepCandidate) || Number.isInteger(stepCandidate))
  ) {
    candidate = Math.round(candidate);
  }
  candidate = Number(candidate.toFixed(6));
  if (!Number.isFinite(candidate)) return NaN;
  if (range) {
    if (Number.isFinite(range.from) && candidate < range.from) {
      return NaN;
    }
    if (Number.isFinite(range.to) && candidate > range.to) {
      return NaN;
    }
  }
  if (Math.abs(candidate - baseValue) < 1e-6) {
    return NaN;
  }
  return candidate;
}

function formatAbsoluteLabel(value) {
  if (!Number.isFinite(value)) return value;
  if (Math.abs(value) >= 1) {
    return Number(value.toFixed(0)).toString();
  }
  return Number(value.toFixed(2)).toString();
}

// --- 參數優化邏輯 ---
const SINGLE_PARAMETER_OPTIMIZER_VERSION = "LB-SINGLE-OPT-20251115A";

function buildOptimizationValueSweep(range) {
  const safeRange = range && typeof range === "object" ? range : {};
  const rawFrom = Number.isFinite(Number(safeRange.from))
    ? Number(safeRange.from)
    : 1;
  const rawTo = Number.isFinite(Number(safeRange.to))
    ? Number(safeRange.to)
    : rawFrom;
  let rawStep = Number.isFinite(Number(safeRange.step))
    ? Math.abs(Number(safeRange.step))
    : 1;
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    rawStep = 1;
  }
  if (!Number.isFinite(rawFrom) || !Number.isFinite(rawTo)) {
    return [];
  }
  const ascending = rawTo >= rawFrom;
  const start = ascending ? rawFrom : rawTo;
  const end = ascending ? rawTo : rawFrom;
  const span = end - start;
  if (span < 0) return [];
  const approxSteps = Math.max(0, Math.floor(span / rawStep + 1e-9));
  const values = [];
  for (let idx = 0; idx <= approxSteps; idx++) {
    const value = start + idx * rawStep;
    if (value > end + rawStep * 1e-6) break;
    values.push(parseFloat(value.toFixed(4)));
  }
  const finalValue = parseFloat(end.toFixed(4));
  if (
    values.length === 0 ||
    Math.abs(values[values.length - 1] - finalValue) > 1e-6
  ) {
    values.push(finalValue);
  }
  if (!ascending) {
    values.reverse();
  }
  const deduped = [];
  const seen = new Set();
  values.forEach((val) => {
    const key = val.toFixed(4);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(val);
    }
  });
  return deduped;
}

function createOptimizationParamTemplate(baseParams = {}) {
  const template = {
    base: {},
    entryParams: null,
    exitParams: null,
    shortEntryParams: null,
    shortExitParams: null,
    entryStages: null,
    exitStages: null,
  };
  if (baseParams && typeof baseParams === "object") {
    Object.keys(baseParams).forEach((key) => {
      if (
        key === "entryParams" ||
        key === "exitParams" ||
        key === "shortEntryParams" ||
        key === "shortExitParams" ||
        key === "entryStages" ||
        key === "exitStages"
      ) {
        return;
      }
      template.base[key] = baseParams[key];
    });
    template.entryParams =
      baseParams.entryParams && typeof baseParams.entryParams === "object"
        ? { ...baseParams.entryParams }
        : null;
    template.exitParams =
      baseParams.exitParams && typeof baseParams.exitParams === "object"
        ? { ...baseParams.exitParams }
        : null;
    template.shortEntryParams =
      baseParams.shortEntryParams &&
      typeof baseParams.shortEntryParams === "object"
        ? { ...baseParams.shortEntryParams }
        : null;
    template.shortExitParams =
      baseParams.shortExitParams &&
      typeof baseParams.shortExitParams === "object"
        ? { ...baseParams.shortExitParams }
        : null;
    template.entryStages = Array.isArray(baseParams.entryStages)
      ? baseParams.entryStages.map((stage) =>
          stage && typeof stage === "object" ? { ...stage } : stage,
        )
      : null;
    template.exitStages = Array.isArray(baseParams.exitStages)
      ? baseParams.exitStages.map((stage) =>
          stage && typeof stage === "object" ? { ...stage } : stage,
        )
      : null;
  }
  template.base.__skipSensitivity = true;
  template.base.__optimizationMode = SINGLE_PARAMETER_OPTIMIZER_VERSION;
  return template;
}

function instantiateOptimizationParams(template) {
  const params = { ...template.base };
  if (template.entryParams) {
    params.entryParams = { ...template.entryParams };
  }
  if (template.exitParams) {
    params.exitParams = { ...template.exitParams };
  }
  if (template.shortEntryParams) {
    params.shortEntryParams = { ...template.shortEntryParams };
  }
  if (template.shortExitParams) {
    params.shortExitParams = { ...template.shortExitParams };
  }
  if (template.entryStages) {
    params.entryStages = template.entryStages.map((stage) =>
      stage && typeof stage === "object" ? { ...stage } : stage,
    );
  }
  if (template.exitStages) {
    params.exitStages = template.exitStages.map((stage) =>
      stage && typeof stage === "object" ? { ...stage } : stage,
    );
  }
  return params;
}

async function runOptimization(
  baseParams,
  optimizeTargetStrategy,
  optParamName,
  optRange,
  useCache,
  cachedData,
) {
  const targetLblMap = {
    entry: "進場",
    exit: "出場",
    shortEntry: "做空進場",
    shortExit: "回補出場",
    risk: "風險控制",
  };
  const targetLbl =
    targetLblMap[optimizeTargetStrategy] || optimizeTargetStrategy;
  self.postMessage({
    type: "progress",
    progress: 0,
    message: `開始優化 ${targetLbl}策略 ${optParamName}...`,
  });
  const results = [];
  let stockData = null;
  let dataFetched = false;

  // Data acquisition policy:
  // - If useCache === true: only use provided cachedData or現有的 worker 快取；禁止再抓遠端。
  // - If useCache === false: 使用提供或既有快取，否則才呼叫 fetchStockData。
  if (useCache) {
    if (Array.isArray(cachedData) && cachedData.length > 0) {
      stockData = cachedData;
    } else if (
      Array.isArray(workerLastDataset) &&
      workerLastDataset.length > 0
    ) {
      stockData = workerLastDataset;
      console.log("[Worker Opt] Using worker's cached data.");
    } else {
      throw new Error(
        "優化失敗: 未提供快取數據；批量優化在快取模式下禁止從遠端抓取資料，請先於主畫面執行回測以建立快取。",
      );
    }
  } else {
    if (Array.isArray(cachedData) && cachedData.length > 0) {
      stockData = cachedData;
    } else if (
      Array.isArray(workerLastDataset) &&
      workerLastDataset.length > 0
    ) {
      stockData = workerLastDataset;
      console.log("[Worker Opt] Using worker's cached data.");
    } else {
      const optDataStart =
        baseParams.dataStartDate || baseParams.startDate;
      const optEffectiveStart =
        baseParams.effectiveStartDate || baseParams.startDate;
      const optLookback = Number.isFinite(baseParams.lookbackDays)
        ? baseParams.lookbackDays
        : null;
      const fetched = await fetchStockData(
        baseParams.stockNo,
        optDataStart,
        baseParams.endDate,
        baseParams.marketType || baseParams.market || "TWSE",
        {
          adjusted: baseParams.adjustedPrice,
          splitAdjustment: baseParams.splitAdjustment,
          effectiveStartDate: optEffectiveStart,
          lookbackDays: optLookback,
        },
      );
      stockData = fetched?.data || [];
      dataFetched = true;
      if (!Array.isArray(stockData) || stockData.length === 0)
        throw new Error(`優化失敗: 無法獲取 ${baseParams.stockNo} 數據`);
      self.postMessage({
        type: "progress",
        progress: 50,
        message: "數據獲取完成，開始優化...",
      });
    }
  }

  if (!stockData) {
    throw new Error("優化失敗：無可用數據");
  }

  const sweepValues = buildOptimizationValueSweep(optRange);
  if (sweepValues.length === 0) {
    console.warn(
      `[Worker Opt] Empty sweep detected for ${optParamName}, range:`,
      optRange,
    );
    return { results: [], rawDataUsed: dataFetched ? stockData : null };
  }
  const template = createOptimizationParamTemplate(baseParams || {});
  const totalSteps = sweepValues.length;
  let curStep = 0;
  const progressOffset = dataFetched ? 50 : 5;
  const progressSpan = dataFetched ? 50 : 95;
  const runOptions = { suppressProgress: true, skipSensitivity: true };
  const contextRequiresShorting =
    optimizeTargetStrategy === "shortEntry" ||
    optimizeTargetStrategy === "shortExit";
  for (const curVal of sweepValues) {
    curStep++;
    const progress = Math.min(
      100,
      progressOffset + Math.floor((curStep / totalSteps) * progressSpan),
    );
    self.postMessage({
      type: "progress",
      progress,
      message: `測試 ${optParamName}=${curVal}`,
    });
    const testParams = instantiateOptimizationParams(template);
    const baseEffectiveStart =
      baseParams?.effectiveStartDate || baseParams?.startDate || null;
    const baseDataStart =
      baseParams?.dataStartDate || baseEffectiveStart || baseParams?.startDate || null;
    const baseLookback =
      Number.isFinite(baseParams?.lookbackDays) && baseParams.lookbackDays > 0
        ? baseParams.lookbackDays
        : null;
    if (baseParams?.startDate && !testParams.originalStartDate) {
      testParams.originalStartDate = baseParams.startDate;
    }
    if (baseEffectiveStart) {
      testParams.startDate = baseEffectiveStart;
      testParams.effectiveStartDate = baseEffectiveStart;
    } else if (testParams.effectiveStartDate) {
      testParams.startDate = testParams.effectiveStartDate;
    }
    if (baseDataStart) {
      testParams.dataStartDate = baseDataStart;
    } else if (!testParams.dataStartDate && testParams.startDate) {
      testParams.dataStartDate = testParams.startDate;
    }
    if (baseLookback !== null) {
      testParams.lookbackDays = baseLookback;
    }
    testParams.__optimizationParam = optParamName;
    testParams.__optimizationValue = curVal;
    if (optimizeTargetStrategy === "risk") {
      if (optParamName === "stopLoss" || optParamName === "takeProfit") {
        testParams[optParamName] = curVal;
      } else {
        console.warn(
          `[Worker Opt] Unknown risk parameter name: ${optParamName}, skipping value ${curVal}`,
        );
        continue;
      }
    } else {
      let targetObjKey = null;
      if (optimizeTargetStrategy === "entry") targetObjKey = "entryParams";
      else if (optimizeTargetStrategy === "exit") targetObjKey = "exitParams";
      else if (optimizeTargetStrategy === "shortEntry")
        targetObjKey = "shortEntryParams";
      else if (optimizeTargetStrategy === "shortExit")
        targetObjKey = "shortExitParams";
      else {
        console.warn(
          `[Worker Opt] Unknown strategy optimization type: ${optimizeTargetStrategy}`,
        );
        continue;
      }
      if (!testParams[targetObjKey] || typeof testParams[targetObjKey] !== "object") {
        testParams[targetObjKey] = {};
      }
      testParams[targetObjKey][optParamName] = curVal;
      testParams.enableShorting = contextRequiresShorting;
    }
    try {
      const result = runStrategy(stockData, testParams, runOptions);
      if (result) {
        results.push({
          paramValue: curVal,
          annualizedReturn: result.annualizedReturn,
          returnRate: result.returnRate,
          maxDrawdown: result.maxDrawdown,
          winRate: result.winRate,
          tradesCount: result.tradesCount,
          sharpeRatio: result.sharpeRatio,
          sortinoRatio: result.sortinoRatio,
        });
      }
    } catch (err) {
      console.error(
        `[Worker Opt] Error optimizing ${optParamName}=${curVal} for ${optimizeTargetStrategy}:`,
        err,
      );
    }
  }
  results.sort((a, b) => {
    const rA =
      a?.annualizedReturn !== null && isFinite(a.annualizedReturn)
        ? a.annualizedReturn
        : -Infinity;
    const rB =
      b?.annualizedReturn !== null && isFinite(b.annualizedReturn)
        ? b.annualizedReturn
        : -Infinity;
    if (rB !== rA) return rB - rA;
    const dda = a?.maxDrawdown ?? Infinity;
    const ddb = b?.maxDrawdown ?? Infinity;
    if (dda !== ddb) return dda - ddb;
    const sA = isFinite(a?.sortinoRatio) ? a.sortinoRatio : -Infinity;
    const sB = isFinite(b?.sortinoRatio) ? b.sortinoRatio : -Infinity;
    return sB - sA;
  });
  self.postMessage({ type: "progress", progress: 100, message: "優化完成" });
  return { results: results, rawDataUsed: dataFetched ? stockData : null };
}

// --- Worker 消息處理 ---
self.onmessage = async function (e) {
  const { type } = e.data || {};
  if (type === 'ai-train-ann') {
    await handleAITrainANNMessage(e.data);
    return;
  }
  if (type === 'ai-train-lstm') {
    await handleAITrainLSTMMessage(e.data);
    return;
  }
  const {
    params,
    useCachedData,
    cachedData,
    cachedMeta,
    optimizeTargetStrategy,
    optimizeParamName,
    optimizeRange,
  } = e.data;
  const sharedUtils =
    typeof lazybacktestShared === "object" && lazybacktestShared
      ? lazybacktestShared
      : null;
  const windowOptions = {
    minBars: 90,
    multiplier: 2,
    marginTradingDays: 12,
    extraCalendarDays: 7,
    minDate: sharedUtils?.MIN_DATA_DATE,
    defaultStartDate: params?.startDate,
  };
  let windowDecision = null;
  if (sharedUtils && typeof sharedUtils.resolveDataWindow === "function") {
    windowDecision = sharedUtils.resolveDataWindow(params || {}, windowOptions);
  }
  const incomingLookback = Number.isFinite(e.data?.lookbackDays)
    ? e.data.lookbackDays
    : Number.isFinite(params?.lookbackDays)
      ? params.lookbackDays
      : null;
  const inferredMax =
    sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === "function"
      ? sharedUtils.getMaxIndicatorPeriod(params || {})
      : 0;
  let lookbackDays = Number.isFinite(incomingLookback) && incomingLookback > 0
    ? incomingLookback
    : null;
  if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && Number.isFinite(windowDecision?.lookbackDays)) {
    lookbackDays = windowDecision.lookbackDays;
  }
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    if (sharedUtils && typeof sharedUtils.resolveLookbackDays === "function") {
      const fallbackDecision = sharedUtils.resolveLookbackDays(params || {}, windowOptions);
      if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
        lookbackDays = fallbackDecision.lookbackDays;
        if (!windowDecision) {
          windowDecision = fallbackDecision;
        }
      }
    }
  }
  if ((!Number.isFinite(lookbackDays) || lookbackDays <= 0) && sharedUtils && typeof sharedUtils.estimateLookbackBars === "function") {
    lookbackDays = sharedUtils.estimateLookbackBars(inferredMax, {
      minBars: 90,
      multiplier: 2,
    });
  }
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    lookbackDays = Math.max(90, inferredMax * 2);
  }
  const effectiveStartDate =
    e.data?.effectiveStartDate ||
    windowDecision?.effectiveStartDate ||
    params?.effectiveStartDate ||
    params?.startDate ||
    windowDecision?.minDataDate ||
    null;
  const dataStartDate =
    e.data?.dataStartDate ||
    windowDecision?.dataStartDate ||
    params?.dataStartDate ||
    effectiveStartDate ||
    params?.startDate ||
    null;
  const resolvedEffectiveStart =
    effectiveStartDate ||
    params?.effectiveStartDate ||
    params?.startDate ||
    null;
  const resolvedDataStart =
    dataStartDate ||
    params?.dataStartDate ||
    resolvedEffectiveStart ||
    params?.startDate ||
    null;
  const resolvedLookback =
    Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : null;
  if (params && typeof params === "object") {
    if (resolvedLookback !== null) {
      params.lookbackDays = resolvedLookback;
    }
    if (resolvedEffectiveStart) {
      params.effectiveStartDate = resolvedEffectiveStart;
    }
    if (resolvedDataStart) {
      params.dataStartDate = resolvedDataStart;
    }
  }
  if (resolvedLookback !== null) {
    e.data.lookbackDays = resolvedLookback;
  }
  if (resolvedEffectiveStart) {
    e.data.effectiveStartDate = resolvedEffectiveStart;
  }
  if (resolvedDataStart) {
    e.data.dataStartDate = resolvedDataStart;
  }
  try {
    if (type === "runBacktest") {
      let dataToUse = null;
      let fetched = false;
      let outcome = null;
      const marketKey = getMarketKey(
        params.marketType || params.market || "TWSE",
      );
      const cacheKey = buildCacheKey(
        params.stockNo,
        dataStartDate || params.startDate,
        params.endDate,
        params.adjustedPrice,
        params.splitAdjustment,
        effectiveStartDate,
        marketKey,
      );
      if (useCachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log("[Worker] Using cached data for backtest.");
        dataToUse = cachedData;
        workerLastDataset = cachedData;
        const existingEntry = getWorkerCacheEntry(marketKey, cacheKey);
        if (!existingEntry) {
          const cacheDiagnostics = prepareDiagnosticsForCacheReplay(
            cachedMeta?.diagnostics || null,
            {
              source: "main-thread-cache",
              requestedRange: {
                start: dataStartDate || params.startDate,
                end: params.endDate,
              },
              coverage: cachedMeta?.coverage,
            },
          );
          setWorkerCacheEntry(marketKey, cacheKey, {
            data: cachedData,
            stockName: params.stockNo,
            dataSource: "主執行緒快取",
            timestamp: Date.now(),
            meta: {
              stockNo: params.stockNo,
              startDate: dataStartDate || params.startDate,
              effectiveStartDate: effectiveStartDate || params.startDate,
              endDate: params.endDate,
              priceMode: getPriceModeKey(params.adjustedPrice),
              lookbackDays,
              summary: cachedMeta?.summary || null,
              adjustments: Array.isArray(cachedMeta?.adjustments)
                ? cachedMeta.adjustments
                : [],
              priceSource: cachedMeta?.priceSource || null,
              adjustmentFallbackApplied: Boolean(
                cachedMeta?.adjustmentFallbackApplied,
              ),
              adjustmentFallbackInfo:
                cachedMeta?.adjustmentFallbackInfo &&
                typeof cachedMeta.adjustmentFallbackInfo === "object"
                  ? cachedMeta.adjustmentFallbackInfo
                  : null,
              debugSteps: Array.isArray(cachedMeta?.debugSteps)
                ? cachedMeta.debugSteps
                : [],
              fetchRange:
                cachedMeta?.fetchRange ||
                (dataStartDate
                  ? { start: dataStartDate, end: params.endDate }
                  : null),
              diagnostics: cacheDiagnostics,
            },
            priceMode: getPriceModeKey(params.adjustedPrice),
          });
        }
        if (cachedMeta) {
          const replayDiagnostics = prepareDiagnosticsForCacheReplay(
            cachedMeta.diagnostics || workerLastMeta?.diagnostics || null,
            {
              source: "main-thread-cache",
              requestedRange: {
                start: dataStartDate || params.startDate,
                end: params.endDate,
              },
              coverage: cachedMeta?.coverage,
            },
          );
          workerLastMeta = {
            ...(workerLastMeta || {}),
            stockNo: params.stockNo,
            startDate: dataStartDate || params.startDate,
            effectiveStartDate: effectiveStartDate || params.startDate,
            endDate: params.endDate,
            priceMode: getPriceModeKey(params.adjustedPrice),
            summary: cachedMeta.summary || null,
            adjustments: Array.isArray(cachedMeta.adjustments)
              ? cachedMeta.adjustments
              : [],
            priceSource: cachedMeta.priceSource || null,
            adjustmentFallbackApplied: Boolean(cachedMeta.adjustmentFallbackApplied),
            adjustmentFallbackInfo:
              cachedMeta?.adjustmentFallbackInfo &&
              typeof cachedMeta.adjustmentFallbackInfo === "object"
                ? cachedMeta.adjustmentFallbackInfo
                : null,
            debugSteps: Array.isArray(cachedMeta.debugSteps)
              ? cachedMeta.debugSteps
              : [],
            marketKey,
            dataSource: "主執行緒快取",
            stockName: params.stockNo,
            splitDiagnostics:
              cachedMeta.splitDiagnostics && typeof cachedMeta.splitDiagnostics === "object"
                ? cachedMeta.splitDiagnostics
                : null,
            finmindStatus:
              cachedMeta.finmindStatus && typeof cachedMeta.finmindStatus === "object"
                ? cachedMeta.finmindStatus
                : null,
            adjustmentDebugLog: Array.isArray(cachedMeta.adjustmentDebugLog)
              ? cachedMeta.adjustmentDebugLog
              : [],
            adjustmentChecks: Array.isArray(cachedMeta.adjustmentChecks)
              ? cachedMeta.adjustmentChecks
              : [],
            fetchRange:
              cachedMeta.fetchRange ||
              (dataStartDate
                ? { start: dataStartDate, end: params.endDate }
                : null),
            lookbackDays,
            diagnostics: replayDiagnostics,
          };
        }
      } else {
        console.log("[Worker] Fetching new data for backtest.");
        outcome = await fetchStockData(
          params.stockNo,
          dataStartDate || params.startDate,
          params.endDate,
          params.marketType,
          {
            adjusted: params.adjustedPrice,
            splitAdjustment: params.splitAdjustment,
            effectiveStartDate: effectiveStartDate || params.startDate,
            lookbackDays,
          },
        );
        dataToUse = outcome.data;
        workerLastDataset = Array.isArray(outcome?.data)
          ? outcome.data
          : Array.isArray(dataToUse)
            ? dataToUse
            : null;
        fetched = true;
      }
      if (!Array.isArray(dataToUse) || dataToUse.length === 0) {
        // 回傳友善的 no_data 訊息給主執行緒，讓 UI 顯示查無資料而不是把 Worker 異常化
        const msg = `指定範圍 (${params.startDate} ~ ${params.endDate}) 無 ${params.stockNo} 交易數據`;
        console.warn(`[Worker] ${msg}`);
        self.postMessage({
          type: "no_data",
          data: {
            stockNo: params.stockNo,
            start: params.startDate,
            end: params.endDate,
            message: msg,
          },
        });
        return;
      }

      const warmupStartISO = dataStartDate || params.startDate || null;
      const strategyData = Array.isArray(dataToUse)
        ? filterDatasetForWindow(dataToUse, warmupStartISO, params.endDate || null)
        : [];
      const startISO = effectiveStartDate || params.startDate || null;
      const endISO = params.endDate || null;
      const visibleStrategyData = Array.isArray(strategyData)
        ? strategyData.filter((row) => {
            if (!row || !row.date) return false;
            if (startISO && row.date < startISO) return false;
            if (endISO && row.date > endISO) return false;
            return true;
          })
        : [];

      if (visibleStrategyData.length === 0) {
        const msg = `指定範圍 (${params.startDate} ~ ${params.endDate}) 無 ${params.stockNo} 有效交易數據`;
        console.warn(`[Worker] ${msg}（暖身資料僅供指標計算）`);
        self.postMessage({
          type: "no_data",
          data: {
            stockNo: params.stockNo,
            start: params.startDate,
            end: params.endDate,
            message: msg,
          },
        });
        return;
      }

      // 關鍵修正：
      // 我們需要傳遞的是 K 線資料，而不是整個包裹
      const strategyParams = {
        ...params,
        originalStartDate: params.startDate,
        startDate: effectiveStartDate || params.startDate,
        dataStartDate: dataStartDate || params.startDate,
        effectiveStartDate: effectiveStartDate || params.startDate,
        lookbackDays,
      };
      const backtestResult = runStrategy(strategyData, strategyParams);
      backtestResult.rawDataUsed = visibleStrategyData;
      if (useCachedData || !fetched) {
        backtestResult.rawData = null;
      } // Don't send back data if it wasn't fetched by this worker call
      if (!useCachedData && fetched) {
        backtestResult.rawData = dataToUse;
      }
      backtestResult.adjustmentFallbackApplied = Boolean(
        outcome?.adjustmentFallbackApplied || workerLastMeta?.adjustmentFallbackApplied,
      );
      const fetchDiagnostics =
        outcome?.diagnostics || workerLastMeta?.diagnostics || null;
      backtestResult.datasetDiagnostics = {
        runtime: backtestResult.diagnostics || null,
        fetch: fetchDiagnostics,
      };

      const debugSteps = Array.isArray(outcome?.debugSteps)
        ? outcome.debugSteps
        : Array.isArray(workerLastMeta?.debugSteps)
          ? workerLastMeta.debugSteps
          : [];

      backtestResult.dataDebug = {
        summary: outcome?.summary || workerLastMeta?.summary || null,
        adjustments: Array.isArray(outcome?.adjustments)
          ? outcome.adjustments
          : Array.isArray(workerLastMeta?.adjustments)
            ? workerLastMeta.adjustments
            : [],
        debugSteps,
        priceSource: outcome?.priceSource || workerLastMeta?.priceSource || null,
        dataSource: outcome?.dataSource || workerLastMeta?.dataSource || null,
        adjustmentFallbackApplied: backtestResult.adjustmentFallbackApplied,
        adjustmentFallbackInfo:
          outcome?.adjustmentFallbackInfo || workerLastMeta?.adjustmentFallbackInfo || null,
        dividendDiagnostics:
          outcome?.dividendDiagnostics || workerLastMeta?.dividendDiagnostics || null,
        dividendEvents: Array.isArray(outcome?.dividendEvents)
          ? outcome.dividendEvents
          : Array.isArray(workerLastMeta?.dividendEvents)
            ? workerLastMeta.dividendEvents
            : [],
        splitDiagnostics:
          outcome?.splitDiagnostics || workerLastMeta?.splitDiagnostics || null,
        finmindStatus:
          outcome?.finmindStatus || workerLastMeta?.finmindStatus || null,
        adjustmentDebugLog: Array.isArray(outcome?.adjustmentDebugLog)
          ? outcome.adjustmentDebugLog
          : Array.isArray(workerLastMeta?.adjustmentDebugLog)
            ? workerLastMeta.adjustmentDebugLog
            : [],
        adjustmentChecks: Array.isArray(outcome?.adjustmentChecks)
          ? outcome.adjustmentChecks
          : Array.isArray(workerLastMeta?.adjustmentChecks)
            ? workerLastMeta.adjustmentChecks
            : [],
        fetchRange:
          outcome?.fetchRange ||
          workerLastMeta?.fetchRange ||
          (dataStartDate ? { start: dataStartDate, end: params.endDate } : null),
        effectiveStartDate: effectiveStartDate || workerLastMeta?.effectiveStartDate || params.startDate,
        lookbackDays,
      };

      if (!useCachedData && fetched) {
        backtestResult.rawMeta = {
          summary: outcome?.summary || null,
          adjustments: Array.isArray(outcome?.adjustments) ? outcome.adjustments : [],
          debugSteps: Array.isArray(outcome?.debugSteps) ? outcome.debugSteps : [],
          priceSource: outcome?.priceSource || null,
          dataSource: outcome?.dataSource || null,
          adjustmentFallbackApplied: backtestResult.adjustmentFallbackApplied,
          adjustmentFallbackInfo: outcome?.adjustmentFallbackInfo || null,
          dividendDiagnostics: outcome?.dividendDiagnostics || null,
          dividendEvents: Array.isArray(outcome?.dividendEvents)
            ? outcome.dividendEvents
            : [],
          splitDiagnostics:
            outcome?.splitDiagnostics && typeof outcome.splitDiagnostics === "object"
              ? outcome.splitDiagnostics
              : null,
          finmindStatus:
            outcome?.finmindStatus && typeof outcome.finmindStatus === "object"
              ? outcome.finmindStatus
              : null,
          adjustmentDebugLog: Array.isArray(outcome?.adjustmentDebugLog)
            ? outcome.adjustmentDebugLog
            : [],
          adjustmentChecks: Array.isArray(outcome?.adjustmentChecks)
            ? outcome.adjustmentChecks
            : [],
          fetchRange:
            outcome?.fetchRange ||
            (dataStartDate ? { start: dataStartDate, end: params.endDate } : null),
          effectiveStartDate: effectiveStartDate || params.startDate,
          lookbackDays,
        };
      }

      // 將結果與資料來源一起回傳
      const metaInfo = outcome ||
        workerLastMeta || {
          stockName: params.stockNo,
          dataSource: fetched
            ? params.marketType || params.market || "未知"
            : "快取",
        };
      self.postMessage({
        type: "result",
        data: backtestResult,
        stockName: metaInfo?.stockName || "",
        dataSource: metaInfo?.dataSource || "未知",
        adjustmentFallbackApplied: backtestResult.adjustmentFallbackApplied,
        adjustmentFallbackInfo:
          outcome?.adjustmentFallbackInfo || workerLastMeta?.adjustmentFallbackInfo || null,
      });
    } else if (type === "runOptimization") {
      if (!optimizeTargetStrategy || !optimizeParamName || !optimizeRange)
        throw new Error("優化目標、參數名或範圍未指定");
      // Enforce cache-only when requested: do not allow worker to fetch remote data in this mode.
      if (useCachedData) {
        const hasProvidedCache =
          Array.isArray(cachedData) && cachedData.length > 0;
        const hasWorkerCache =
          Array.isArray(workerLastDataset) && workerLastDataset.length > 0;
        if (!hasProvidedCache && !hasWorkerCache) {
          throw new Error(
            "優化失敗: 未提供快取數據；批量優化在快取模式下禁止從遠端抓取資料，請先於主畫面執行回測以建立快取。",
          );
        }
      }
      const optOutcome = await runOptimization(
        params,
        optimizeTargetStrategy,
        optimizeParamName,
        optimizeRange,
        useCachedData,
        cachedData || workerLastDataset,
      );
      self.postMessage({ type: "result", data: optOutcome });
    } else if (type === "getSuggestion") {
      console.log("[Worker] Received getSuggestion request.");
      const todayISO = e.data?.todayISO || getTodayISODate();
      const marketKey = getMarketKey(params.marketType || params.market || "TWSE");
      const adjusted = Boolean(params.adjustedPrice);
      const split = Boolean(params.splitAdjustment);
      const effectiveStartDate =
        e.data?.effectiveStartDate ||
        params.effectiveStartDate ||
        params.startDate;
      const dataStartDate =
        e.data?.dataStartDate ||
        params.dataStartDate ||
        effectiveStartDate ||
        params.startDate;
      const resolvedLookback = Number.isFinite(e.data?.lookbackDays)
        ? e.data.lookbackDays
        : lookbackDays;

      if (!effectiveStartDate) {
        throw new Error("缺少有效的起始日期，無法計算今日建議。");
      }

      if (effectiveStartDate > todayISO) {
        const message = `策略設定的起始日為 ${effectiveStartDate}，今日 (${todayISO}) 尚無需操作。`;
        self.postMessage({
          type: "suggestionResult",
          data: {
            status: "future_start",
            label: "策略尚未開始",
            latestDate: todayISO,
            price: { text: message },
            notes: [message],
          },
        });
        return;
      }

      if (Array.isArray(e.data?.cachedData) && e.data.cachedData.length > 0) {
        hydrateWorkerCacheFromMainThread({
          stockNo: params.stockNo,
          marketKey,
          dataStartDate,
          endDate: params.endDate || todayISO,
          adjusted,
          splitAdjustment: params.splitAdjustment,
          effectiveStartDate,
          lookbackDays: resolvedLookback,
          cachedData: e.data.cachedData,
          cachedMeta: e.data.cachedMeta || {},
        });
      }

      const suggestionOutcome = await fetchStockData(
        params.stockNo,
        dataStartDate,
        todayISO,
        params.marketType || params.market || "TWSE",
        {
          adjusted: params.adjustedPrice,
          splitAdjustment: params.splitAdjustment,
          effectiveStartDate,
          lookbackDays: resolvedLookback,
        },
      );

      const suggestionData = Array.isArray(suggestionOutcome?.data)
        ? suggestionOutcome.data
        : [];
      if (suggestionData.length === 0) {
        const message = `${params.stockNo} 在 ${dataStartDate} 至 ${todayISO} 無交易資料。`;
        self.postMessage({
          type: "suggestionResult",
          data: {
            status: "no_data",
            label: "查無今日資料",
            latestDate: todayISO,
            price: { text: message },
            notes: [message],
          },
        });
        return;
      }

      workerLastDataset = suggestionData;
      workerLastMeta = suggestionOutcome || workerLastMeta;

      const strategyParams = {
        ...params,
        originalStartDate: params.startDate,
        startDate: effectiveStartDate,
        dataStartDate,
        effectiveStartDate,
        endDate: todayISO,
        lookbackDays: resolvedLookback,
      };
      const todayResult = runStrategy(suggestionData, strategyParams, {
        forceFinalLiquidation: false,
        captureFinalState: true,
      });
      let evaluation = todayResult?.finalEvaluation || null;
      const latestDate = suggestionData[suggestionData.length - 1]?.date || null;
      const strategyDiagnostics = todayResult?.diagnostics || null;
      const datasetSummary =
        strategyDiagnostics?.dataset ||
        summariseDatasetRows(suggestionData, {
          requestedStart: params.startDate || null,
          effectiveStartDate,
          warmupStartDate: dataStartDate,
          dataStartDate,
          endDate: todayISO,
        });
      const warmupSummary = strategyDiagnostics?.warmup || null;
      const buyHoldSummary = strategyDiagnostics?.buyHold || null;
      const finalStateDiagnostics = strategyDiagnostics?.finalState || null;
      const coverage = computeCoverageFromRows(suggestionData);
      const coverageFingerprint = computeCoverageFingerprint(coverage);
      const priceModeKey =
        suggestionOutcome?.priceMode ||
        getPriceModeKey(Boolean(params.adjustedPrice));
      const dataSource = suggestionOutcome?.dataSource || null;
      const priceSource = suggestionOutcome?.priceSource || null;
      const fetchRange =
        suggestionOutcome?.fetchRange ||
        {
          start: dataStartDate,
          end: todayISO,
        };
      const diagnosticsMeta =
        suggestionOutcome?.diagnostics &&
        typeof suggestionOutcome.diagnostics === "object"
          ? suggestionOutcome.diagnostics
          : null;
      let evaluationRecoveredFromFinalState = false;
      let evaluationRecoveryNotes = [];
      if (!evaluation && finalStateDiagnostics?.snapshot) {
        const snapshot = finalStateDiagnostics.snapshot;
        const candidateDates = [];
        if (snapshot.latestValidDate) candidateDates.push(snapshot.latestValidDate);
        if (snapshot.date) candidateDates.push(snapshot.date);
        if (latestDate) candidateDates.push(latestDate);
        const uniqueCandidates = Array.from(
          new Set(candidateDates.filter((value) => typeof value === "string" && value)),
        );
        let fallbackRow = null;
        let fallbackDate = null;
        for (const candidate of uniqueCandidates) {
          const found = suggestionData.find((row) => row?.date === candidate);
          if (found) {
            fallbackRow = found;
            fallbackDate = candidate;
            break;
          }
        }
        if (!fallbackRow && suggestionData.length > 0) {
          fallbackRow = suggestionData[suggestionData.length - 1];
          fallbackDate = fallbackRow?.date || null;
        }
        const derivedDate = fallbackDate || snapshot.date || todayISO;
        const fallbackClose = Number.isFinite(fallbackRow?.close)
          ? fallbackRow.close
          : Number.isFinite(snapshot.close)
            ? snapshot.close
            : null;
        const finalStateReasonCode =
          finalStateDiagnostics?.reason || "final_evaluation_missing";
        const fallbackReason =
          finalStateReasonCode === "final_evaluation_missing"
            ? "final_evaluation_recovered_from_snapshot"
            : finalStateReasonCode;
        const fallbackMeta = {
          fallback: true,
          fallbackReason,
          derivedFrom: "final_state_snapshot",
          derivedAt: todayISO,
          finalStateReason: finalStateReasonCode,
        };
        if (snapshot.latestValidDate) {
          fallbackMeta.fallbackFromDate = snapshot.latestValidDate;
        } else if (derivedDate) {
          fallbackMeta.fallbackFromDate = derivedDate;
        }
        if (snapshot.requestedLastDate) {
          fallbackMeta.requestedLastDate = snapshot.requestedLastDate;
        } else if (latestDate) {
          fallbackMeta.requestedLastDate = latestDate;
        }
        if (Number.isFinite(snapshot.fallbackLagDays)) {
          fallbackMeta.fallbackLagDays = snapshot.fallbackLagDays;
        } else if (
          derivedDate &&
          latestDate &&
          derivedDate !== latestDate &&
          typeof derivedDate === "string" &&
          typeof latestDate === "string"
        ) {
          fallbackMeta.fallbackLagDays = diffIsoDays(derivedDate, latestDate);
        }
        if (Number.isFinite(snapshot.fallbackLagBars)) {
          fallbackMeta.fallbackLagBars = snapshot.fallbackLagBars;
        }
        if (typeof snapshot.missingFinalClose === "boolean") {
          fallbackMeta.missingFinalClose = snapshot.missingFinalClose;
        }
        const derivedLongPos = Number.isFinite(snapshot.longPos)
          ? snapshot.longPos
          : Number.isFinite(snapshot.longShares) && snapshot.longShares > 0
            ? 1
            : 0;
        const derivedShortPos = Number.isFinite(snapshot.shortPos)
          ? snapshot.shortPos
          : Number.isFinite(snapshot.shortShares) && snapshot.shortShares > 0
            ? 1
            : 0;
        evaluation = {
          date: derivedDate,
          open: Number.isFinite(fallbackRow?.open) ? fallbackRow.open : null,
          high: Number.isFinite(fallbackRow?.high) ? fallbackRow.high : null,
          low: Number.isFinite(fallbackRow?.low) ? fallbackRow.low : null,
          close: fallbackClose,
          longState:
            snapshot.longState ||
            (derivedLongPos === 1 ? "持有" : "空手"),
          shortState:
            snapshot.shortState ||
            (derivedShortPos === 1 ? "持有" : "空手"),
          executedBuy: false,
          executedSell: false,
          executedShort: false,
          executedCover: false,
          longPos: derivedLongPos,
          shortPos: derivedShortPos,
          longShares: Number.isFinite(snapshot.longShares) ? snapshot.longShares : 0,
          shortShares: Number.isFinite(snapshot.shortShares) ? snapshot.shortShares : 0,
          longAverageEntryPrice: null,
          lastBuyPrice: null,
          lastShortPrice: null,
          longCapital: Number.isFinite(snapshot.longCapital) ? snapshot.longCapital : null,
          shortCapital: Number.isFinite(snapshot.shortCapital)
            ? snapshot.shortCapital
            : null,
          longProfit: null,
          shortProfit: null,
          portfolioValue: Number.isFinite(snapshot.portfolioValue)
            ? snapshot.portfolioValue
            : null,
          strategyReturn: Number.isFinite(snapshot.strategyReturn)
            ? snapshot.strategyReturn
            : null,
          longEntryState: null,
          longExitState: null,
          meta: fallbackMeta,
        };
        evaluationRecoveredFromFinalState = true;
        evaluationRecoveryNotes = [
          `finalEvaluation 由 finalState 快照重建：${
            fallbackMeta.fallbackFromDate || derivedDate || "未知日期"
          } → ${fallbackMeta.requestedLastDate || latestDate || "未知日期"}`,
        ];
        todayResult.finalEvaluation = evaluation;
      }
      if (!evaluation || !latestDate) {
        const message = "回測資料不足以推導今日建議。";
        const notes = [message];
        const developerNotes = [];
        const rangeStart =
          datasetSummary?.firstDate ||
          datasetSummary?.firstRowOnOrAfterEffectiveStart?.date ||
          null;
        const rangeEnd = datasetSummary?.lastDate || latestDate || todayISO;
        if (rangeStart || rangeEnd) {
          const rangeText =
            rangeStart && rangeEnd && rangeStart !== rangeEnd
              ? `${rangeStart} ~ ${rangeEnd}`
              : rangeStart || rangeEnd;
          notes.push(`當前資料區間：${rangeText}。`);
          developerNotes.push(`資料區間：${rangeText}`);
        }
        if (Number.isFinite(datasetSummary?.totalRows)) {
          const priceLabel = priceModeKey === "ADJ" ? "調整後價格" : "原始收盤價";
          notes.push(
            `共有 ${datasetSummary.totalRows} 筆 ${priceLabel}，仍缺乏可推導的最終狀態。`,
          );
          developerNotes.push(
            `總筆數 ${datasetSummary.totalRows}（${priceLabel}）`,
          );
        }
        if (
          datasetSummary?.firstValidCloseOnOrAfterEffectiveStart?.date &&
          Number.isFinite(datasetSummary?.firstValidCloseGapFromEffective)
        ) {
          const gapDays = datasetSummary.firstValidCloseGapFromEffective;
          const firstValidDate =
            datasetSummary.firstValidCloseOnOrAfterEffectiveStart.date;
          developerNotes.push(
            `暖身後第一筆有效收盤價：${firstValidDate}（落後 ${gapDays} 日）`,
          );
          if (gapDays > 0) {
            notes.push(
              `暖身結束後第 ${gapDays} 日（${firstValidDate}）才出現有效收盤價。`,
            );
          }
        } else if (
          !datasetSummary?.firstValidCloseOnOrAfterEffectiveStart?.date
        ) {
          notes.push("暖身後仍找不到有效收盤價，請確認資料是否完整。");
          developerNotes.push("暖身後未找到有效收盤價");
        }
        if (Number.isFinite(datasetSummary?.rowsWithinRange)) {
          developerNotes.push(
            `使用者區間筆數 ${datasetSummary.rowsWithinRange}`,
          );
        }
        if (Number.isFinite(datasetSummary?.warmupRows)) {
          developerNotes.push(`暖身筆數 ${datasetSummary.warmupRows}`);
        }
        if (Array.isArray(coverage) && coverage.length > 0) {
          developerNotes.push(
            `覆蓋區段 ${coverage.length} 段，fingerprint ${
              coverageFingerprint || "N/A"
            }`,
          );
        }
        if (finalStateDiagnostics?.snapshot?.date) {
          const snapshot = finalStateDiagnostics.snapshot;
          const stateParts = [];
          if (snapshot.longState) {
            stateParts.push(`多單 ${snapshot.longState}`);
          }
          if (snapshot.shortState) {
            stateParts.push(`空單 ${snapshot.shortState}`);
          }
          const stateLabel = stateParts.length > 0 ? stateParts.join("，") : "無法取得";
          developerNotes.push(
            `模擬最終狀態：${stateLabel}（${snapshot.date}）`,
          );
          if (Number.isFinite(snapshot.portfolioValue)) {
            developerNotes.push(
              `模擬最終市值 ${snapshot.portfolioValue.toFixed(2)}`,
            );
          }
          if (Number.isFinite(snapshot.strategyReturn)) {
            developerNotes.push(
              `模擬報酬率 ${snapshot.strategyReturn.toFixed(2)}%`,
            );
          }
        } else if (!finalStateDiagnostics?.snapshot) {
          developerNotes.push("finalState 快照未生成");
        }
        if (finalStateDiagnostics?.pendingNextDayTrade) {
          const pending = finalStateDiagnostics.pendingNextDayTrade;
          const pendingParts = [];
          if (pending.type || pending.action) {
            pendingParts.push(pending.type || pending.action);
          }
          if (pending.strategy) {
            pendingParts.push(pending.strategy);
          }
          if (pending.reason) {
            pendingParts.push(pending.reason);
          }
          developerNotes.push(
            `待執行交易：${pendingParts.join("｜") || "資訊不足"}`,
          );
        }
        if (finalStateDiagnostics && finalStateDiagnostics.captured === false) {
          developerNotes.push("runStrategy 未產生 finalEvaluation（final_evaluation_missing）");
        }
        if (finalStateDiagnostics?.reason) {
          developerNotes.push(`finalState 診斷：${finalStateDiagnostics.reason}`);
        }
        self.postMessage({
          type: "suggestionResult",
          data: {
            status: "no_data",
            label: "無法判斷今日操作",
            latestDate: latestDate || todayISO,
            price: { text: message },
            notes,
            developerNotes,
            issueCode: !evaluation ? "final_evaluation_missing" : "latest_date_missing",
            dataset: datasetSummary,
            warmup: warmupSummary,
            buyHold: buyHoldSummary,
            rowCount: suggestionData.length,
            coverage,
            coverageFingerprint,
            priceMode: priceModeKey,
            dataSource,
            priceSource,
            fetchRange,
            diagnostics: diagnosticsMeta,
            strategyDiagnostics,
            todayISO,
            requestedEndDate: params.endDate,
            appliedEndDate: todayISO,
            startDateUsed: strategyParams.startDate,
            dataStartDateUsed: dataStartDate,
            lookbackDaysUsed: resolvedLookback,
          },
        });
        return;
      }

      const actionInfo = deriveTodayAction(evaluation);
      const longPosition = summarisePositionFromEvaluation(evaluation, "long");
      const shortPosition = summarisePositionFromEvaluation(evaluation, "short");
      const positionSummary = combinePositionLabel(
        evaluation.longState || (evaluation.longPos === 1 ? "持有" : "空手"),
        evaluation.shortState || (evaluation.shortPos === 1 ? "持有" : "空手"),
      );
      const datasetLastDate = latestDate;
      const evaluationMeta =
        evaluation && typeof evaluation.meta === "object"
          ? evaluation.meta
          : {};
      const evaluationDate = evaluation?.date || null;
      const displayLatestDate = evaluationDate || datasetLastDate;
      const dataLagDays =
        displayLatestDate && todayISO
          ? diffIsoDays(displayLatestDate, todayISO)
          : null;
      const developerNotes = [];
      let issueCode = null;
      const notes = [];
      if (evaluationRecoveredFromFinalState) {
        notes.push("最新交易日缺少完整評估，已套用前一有效快照推導操作建議。");
        developerNotes.push(...evaluationRecoveryNotes);
      }
      switch (actionInfo.action) {
        case "enter_long":
          notes.push("今日訊號觸發多單進場，請依策略執行下單流程。");
          break;
        case "enter_short":
          notes.push("今日訊號觸發空單建立，請注意券源與風險控管。");
          break;
        case "exit_long":
          notes.push("策略建議平倉多單，留意成交價差與手續費。");
          break;
        case "cover_short":
          notes.push("策略建議回補空單，請同步檢查借券成本。");
          break;
        case "hold_long":
          notes.push("今日未觸發出場訊號，請持續來本站追蹤。");
          break;
        case "hold_short":
          notes.push("今日未觸發回補訊號，請注意市場波動與保證金需求。");
          break;
        default:
          notes.push("策略目前維持空手，暫無倉位需要調整。");
          break;
      }
      if (typeof dataLagDays === "number" && dataLagDays > 0) {
        developerNotes.push(`最新資料為 ${displayLatestDate}，距今日 ${dataLagDays} 日。`);
      }
      if (
        params.endDate &&
        datasetLastDate &&
        datasetLastDate > params.endDate
      ) {
        notes.push(
          `已延伸資料至 ${datasetLastDate}，超過原設定結束日 ${params.endDate}。`,
        );
      }
      if (evaluationMeta && evaluationMeta.fallback) {
        issueCode = evaluationMeta.fallbackReason || "final_evaluation_degraded";
        const fallbackFromDate =
          evaluationMeta.fallbackFromDate || evaluationDate || datasetLastDate;
        const requestedLastDate =
          evaluationMeta.requestedLastDate || datasetLastDate;
        const fallbackReasonLabel =
          evaluationMeta.fallbackReason ===
          "final_evaluation_degraded_missing_price"
            ? "最新交易日缺少有效收盤價"
            : evaluationMeta.fallbackReason ===
              "final_evaluation_recovered_from_snapshot"
              ? "最新評估來自前一有效快照"
              : "最終評估已回退至前一有效資料";
        notes.push(
          `${fallbackReasonLabel}，已改以 ${fallbackFromDate || "前一交易日"} 的資料推導今日建議。`,
        );
        developerNotes.push(
          `finalEvaluation fallback：${fallbackFromDate || "N/A"} ← ${
            requestedLastDate || "N/A"
          }`,
        );
        if (
          Number.isFinite(evaluationMeta.fallbackLagDays) &&
          evaluationMeta.fallbackLagDays > 0
        ) {
          notes.push(
            `最新有效資料落後資料最後日期 ${evaluationMeta.fallbackLagDays} 日。`,
          );
          developerNotes.push(
            `fallback 落後 ${evaluationMeta.fallbackLagDays} 日（bars=${
              Number.isFinite(evaluationMeta.fallbackLagBars)
                ? evaluationMeta.fallbackLagBars
                : "N/A"
            }）。`,
          );
        }
        if (evaluationMeta.missingFinalClose) {
          developerNotes.push("最新資料列缺少有效收盤價");
        }
      }
      if (evaluationRecoveredFromFinalState) {
        issueCode = "final_evaluation_recovered_from_snapshot";
      }

      const suggestionPayload = {
        status: "ok",
        action: actionInfo.action,
        label: actionInfo.label,
        tone: actionInfo.tone,
        latestDate: displayLatestDate,
        price: {
          value: Number.isFinite(evaluation.close) ? evaluation.close : null,
          type: "close",
        },
        longPosition,
        shortPosition,
        positionSummary,
        evaluation,
        notes,
        dataLagDays,
        todayISO,
        requestedEndDate: params.endDate,
        appliedEndDate: todayISO,
        startDateUsed: strategyParams.startDate,
        dataStartDateUsed: dataStartDate,
        lookbackDaysUsed: resolvedLookback,
        datasetLastDate,
        evaluationDate,
        dataset: datasetSummary,
        warmup: warmupSummary,
        buyHold: buyHoldSummary,
        rowCount: suggestionData.length,
        coverage,
        coverageFingerprint,
        priceMode: priceModeKey,
        dataSource,
        priceSource,
        fetchRange,
        diagnostics: diagnosticsMeta,
        strategyDiagnostics,
        developerNotes,
        issueCode,
        evaluationLagFromDatasetDays:
          Number.isFinite(evaluationMeta?.fallbackLagDays)
            ? evaluationMeta.fallbackLagDays
            : evaluationDate &&
              datasetLastDate &&
              evaluationDate !== datasetLastDate
              ? diffIsoDays(evaluationDate, datasetLastDate)
              : null,
      };

      self.postMessage({
        type: "suggestionResult",
        data: suggestionPayload,
      });
    }
  } catch (error) {
    console.error(`Worker 執行 ${type} 期間錯誤:`, error);
    if (type === "getSuggestion") {
      self.postMessage({
        type: "suggestionError",
        data: { message: `計算建議時發生錯誤: ${error.message || "未知錯誤"}` },
      });
    } else {
      self.postMessage({
        type: "error",
        data: {
          message: `Worker ${type} 錯誤: ${error.message || "未知錯誤"}`,
        },
      });
    }
  }
};
// --- Web Worker End ---
