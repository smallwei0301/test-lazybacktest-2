(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.LazyStrategyParamPresentation = exported;
  }
})(typeof self !== 'undefined' ? self : this, function createPresentationFactory() {
  function baseIdSuffix(paramName) {
    if (typeof paramName !== 'string' || !paramName) {
      return 'Param';
    }
    return paramName.charAt(0).toUpperCase() + paramName.slice(1);
  }

  function deriveLabel(strategyId, paramName) {
    if (!paramName) return { label: paramName || '', idSuffix: baseIdSuffix(paramName) };
    let label = paramName;
    let idSuffix = baseIdSuffix(paramName);

    const normalised = typeof strategyId === 'string' ? strategyId : '';

    if (normalised === 'k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdX') {
        label = 'D值上限(X)';
        idSuffix = 'KdThresholdX';
      }
    } else if (normalised === 'k_d_cross_exit') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdY') {
        label = 'D值下限(Y)';
        idSuffix = 'KdThresholdY';
      }
    } else if (normalised === 'turtle_stop_loss') {
      if (paramName === 'stopLossPeriod') {
        label = '停損週期';
        idSuffix = 'StopLossPeriod';
      }
    } else if (normalised === 'short_k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdY') {
        label = 'D值下限(Y)';
        idSuffix = 'ShortKdThresholdY';
      }
    } else if (normalised === 'cover_k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdX') {
        label = 'D值上限(X)';
        idSuffix = 'CoverKdThresholdX';
      }
    } else if (normalised === 'short_macd_cross') {
      if (paramName === 'shortPeriod') {
        label = 'DI短EMA(n)';
      } else if (paramName === 'longPeriod') {
        label = 'DI長EMA(m)';
      } else if (paramName === 'signalPeriod') {
        label = 'DEA週期(x)';
        idSuffix = 'ShortSignalPeriod';
      }
    } else if (normalised === 'cover_macd_cross') {
      if (paramName === 'shortPeriod') {
        label = 'DI短EMA(n)';
      } else if (paramName === 'longPeriod') {
        label = 'DI長EMA(m)';
      } else if (paramName === 'signalPeriod') {
        label = 'DEA週期(x)';
        idSuffix = 'CoverSignalPeriod';
      }
    } else if (normalised === 'short_turtle_stop_loss') {
      if (paramName === 'stopLossPeriod') {
        label = '觀察週期';
        idSuffix = 'ShortStopLossPeriod';
      }
    } else if (normalised === 'cover_turtle_breakout') {
      if (paramName === 'breakoutPeriod') {
        label = '突破週期';
        idSuffix = 'CoverBreakoutPeriod';
      }
    } else if (normalised === 'cover_trailing_stop') {
      if (paramName === 'percentage') {
        label = '百分比(%)';
        idSuffix = 'CoverTrailingStopPercentage';
      }
    } else if (normalised === 'short_ma_cross') {
      if (paramName === 'shortPeriod') {
        label = '短期SMA';
      } else if (paramName === 'longPeriod') {
        label = '長期SMA';
      }
    }

    if (label === paramName) {
      const baseKey = normalised
        .replace(/^short_/, '')
        .replace(/^cover_/, '')
        .replace(/_exit$/, '');

      if (baseKey === 'ma_cross' || baseKey === 'ema_cross') {
        if (paramName === 'shortPeriod') {
          label = '短期SMA';
        } else if (paramName === 'longPeriod') {
          label = '長期SMA';
        }
      } else if (baseKey === 'ma_above' || baseKey === 'ma_below') {
        if (paramName === 'period') {
          label = 'SMA週期';
        }
      } else if (paramName === 'period') {
        label = '週期';
      } else if (paramName === 'threshold') {
        label = '閾值';
      } else if (paramName === 'signalPeriod') {
        label = '信號週期';
      } else if (paramName === 'deviations') {
        label = '標準差';
      } else if (paramName === 'multiplier') {
        label = '倍數';
      } else if (paramName === 'percentage') {
        label = '百分比(%)';
      } else if (paramName === 'breakoutPeriod') {
        label = '突破週期';
      } else if (paramName === 'stopLossPeriod') {
        label = '停損週期';
      }
    }

    return { label, idSuffix };
  }

  function resolve(role, strategyId, paramName) {
    const { label, idSuffix } = deriveLabel(strategyId, paramName);
    const roleKey = typeof role === 'string' && role ? role : 'entry';
    return {
      label,
      inputId: `${roleKey}${idSuffix}`,
    };
  }

  return {
    resolve,
  };
});
