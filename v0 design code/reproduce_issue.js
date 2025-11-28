
// Mock dependencies
const DEFAULT_THRESHOLDS = {
    annualizedReturn: 10,
    sharpeRatio: 1,
    sortinoRatio: 1.2,
    maxDrawdown: 20,
    winRate: 45,
};

const QUALITY_WEIGHTS = {
    annualizedReturn: 0.35,
    sharpeRatio: 0.25,
    sortinoRatio: 0.20,
    maxDrawdown: 0.10,
    winRate: 0.10,
};

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

function scoreAgainstThreshold(value, threshold) {
    if (!Number.isFinite(value) || !Number.isFinite(threshold)) return null;
    if (Math.abs(threshold) < 1e-6) {
        return value >= threshold ? 1 : 0;
    }
    const ratio = 1 + (value - threshold) / Math.abs(threshold);
    return clamp01(ratio);
}

function scoreAgainstUpperBound(value, threshold) {
    if (!Number.isFinite(value) || !Number.isFinite(threshold)) return null;
    if (value <= threshold) return 1;
    const scale = Math.max(Math.abs(threshold), 1);
    const ratio = 1 - (value - threshold) / scale;
    return clamp01(ratio);
}

function computeOosQualityScore(metrics, thresholds) {
    const components = {};
    let weightedSum = 0;
    let weightTotal = 0;

    const accumulate = (key, score, weight) => {
        const normalized = Number.isFinite(score) ? clamp01(score) : 0;
        components[key] = normalized;
        weightedSum += weight * normalized;
        weightTotal += weight;
    };

    const annScore = scoreAgainstThreshold(metrics.annualizedReturn, thresholds.annualizedReturn);
    accumulate('annualizedReturn', annScore, QUALITY_WEIGHTS.annualizedReturn);

    const sharpeScore = scoreAgainstThreshold(metrics.sharpeRatio, thresholds.sharpeRatio);
    accumulate('sharpeRatio', sharpeScore, QUALITY_WEIGHTS.sharpeRatio);

    const sortinoScore = scoreAgainstThreshold(metrics.sortinoRatio, thresholds.sortinoRatio);
    accumulate('sortinoRatio', sortinoScore, QUALITY_WEIGHTS.sortinoRatio);

    const drawdownScore = scoreAgainstUpperBound(metrics.maxDrawdown, thresholds.maxDrawdown);
    accumulate('maxDrawdown', drawdownScore, QUALITY_WEIGHTS.maxDrawdown);

    const winRateScore = scoreAgainstThreshold(metrics.winRate, thresholds.winRate);
    accumulate('winRate', winRateScore, QUALITY_WEIGHTS.winRate);

    const rawValue = weightTotal > 0 ? weightedSum / weightTotal : null;
    const value = Number.isFinite(rawValue) ? clamp01(rawValue) : null;
    return { value };
}

function evaluateWindow(metrics, thresholds) {
    const checks = [];
    if (Number.isFinite(metrics.annualizedReturn)) checks.push(metrics.annualizedReturn >= thresholds.annualizedReturn);
    if (Number.isFinite(metrics.sharpeRatio)) checks.push(metrics.sharpeRatio >= thresholds.sharpeRatio);
    if (Number.isFinite(metrics.sortinoRatio)) checks.push(metrics.sortinoRatio >= thresholds.sortinoRatio);
    if (Number.isFinite(metrics.maxDrawdown)) checks.push(metrics.maxDrawdown <= thresholds.maxDrawdown);
    if (Number.isFinite(metrics.winRate)) checks.push(metrics.winRate >= thresholds.winRate);
    return { pass: checks.length > 0 && checks.every(Boolean) };
}

function median(values) {
    const filtered = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (filtered.length === 0) return null;
    const mid = Math.floor(filtered.length / 2);
    if (filtered.length % 2 === 0) {
        return (filtered[mid - 1] + filtered[mid]) / 2;
    }
    return filtered[mid];
}

// Simulation
const thresholds = { ...DEFAULT_THRESHOLDS };

// Create 10 windows that FAIL but have HIGH scores
// Failure: MaxDD = 21 (Threshold 20) -> Score 0.95
// Success: Return = 50 (Threshold 10) -> Score 1.0
// Success: Sharpe = 2 (Threshold 1) -> Score 1.0
// Success: Sortino = 2 (Threshold 1.2) -> Score 1.0
// Success: WinRate = 60 (Threshold 45) -> Score 1.0
const metrics = {
    annualizedReturn: 50,
    sharpeRatio: 2,
    sortinoRatio: 2,
    maxDrawdown: 21, // FAILS (21 > 20)
    winRate: 60,
};

const entries = Array(10).fill(0).map((_, i) => ({
    testing: metrics,
    index: i
}));

console.log('--- Current Logic (After Fix) ---');
const evaluations = entries.map(entry => {
    const evaluation = evaluateWindow(entry.testing, thresholds);
    const quality = computeOosQualityScore(entry.testing, thresholds);
    // Assume high credibility for this test
    const statWeight = 1.0;
    let windowScore = quality.value * statWeight;

    // PENALTY APPLIED
    if (!evaluation.pass) {
        windowScore *= 0.5; // Apply 50% penalty
    }

    return {
        evaluation,
        windowScore
    };
});

const passCount = evaluations.filter(e => e.evaluation.pass).length;
const passRate = (passCount / evaluations.length) * 100;
const windowScores = evaluations.map(e => e.windowScore);
const medianWindowScore = median(windowScores);
const totalScore = medianWindowScore * 1.0; // Assume WFE adjustment = 1

console.log(`Pass Rate: ${passRate}%`);
console.log(`Median Window Score: ${medianWindowScore.toFixed(4)}`);
console.log(`Total Score: ${(totalScore * 100).toFixed(2)}`);
