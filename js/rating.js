(function (root) {
  const globalScope = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const namespace = globalScope.lazybacktestDiagnostics = globalScope.lazybacktestDiagnostics || {};
  const RATING_VERSION = "LB-OVERFIT-RATING-20251120A";

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function computeOverfitVerdict(metrics = {}) {
    const pbo = Number.isFinite(metrics.pbo) ? clamp(metrics.pbo, 0, 1) : null;
    const overfitScore = Number.isFinite(metrics.overfitScore) ? clamp(metrics.overfitScore, 0, 100) : null;

    if (overfitScore === null) {
      return {
        version: RATING_VERSION,
        level: "unknown",
        icon: "❔",
        label: "需更多資料",
      };
    }

    if (pbo === null) {
      if (overfitScore >= 80) {
        return {
          version: RATING_VERSION,
          level: "robust",
          icon: "👍",
          label: "穩健",
        };
      }
      if (overfitScore >= 60) {
        return {
          version: RATING_VERSION,
          level: "good",
          icon: "✅",
          label: "良好",
        };
      }
      if (overfitScore >= 40) {
        return {
          version: RATING_VERSION,
          level: "watch",
          icon: "⚠️",
          label: "需留意",
        };
      }
      return {
        version: RATING_VERSION,
        level: "high",
        icon: "🚫",
        label: "高風險",
      };
    }

    if (pbo > 0.5 || overfitScore < 30) {
      return {
        version: RATING_VERSION,
        level: "high",
        icon: "🚫",
        label: "高風險",
      };
    }

    if (pbo > 0.35 || overfitScore < 50) {
      return {
        version: RATING_VERSION,
        level: "watch",
        icon: "⚠️",
        label: "需留意",
      };
    }

    if (pbo > 0.15 || overfitScore < 75) {
      return {
        version: RATING_VERSION,
        level: "good",
        icon: "✅",
        label: "良好",
      };
    }

    return {
      version: RATING_VERSION,
      level: "robust",
      icon: "👍",
      label: "穩健",
    };
  }

  namespace.computeOverfitVerdict = computeOverfitVerdict;
  namespace.overfitRatingVersion = RATING_VERSION;
})(typeof self !== "undefined" ? self : this);
