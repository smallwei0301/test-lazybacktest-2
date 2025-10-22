// Patch Tag: LB-PLUGIN-ATOMS-20250710A — KD cross threshold plugin.
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const contract = globalScope.StrategyPluginContract;
  const registry = globalScope.StrategyPluginRegistry;
  if (!contract || !registry) {
    console.warn('[KDCrossPlugin] 缺少 StrategyPluginContract 或 Registry，略過註冊。');
    return;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  const meta = {
    id: 'kd-cross-v1',
    label: 'KD 指標交叉',
    paramsSchema: {
      type: 'object',
      properties: {
        kIndicatorKey: { type: 'string', description: 'K 值指標鍵值' },
        dIndicatorKey: { type: 'string', description: 'D 值指標鍵值' },
        cross: {
          type: 'string',
          enum: ['kAboveD', 'kBelowD'],
          default: 'kAboveD',
          description: 'K 與 D 的交叉方向',
        },
        thresholdValue: {
          anyOf: [
            {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
            { type: 'null' },
          ],
          default: null,
          description: 'KD 額外門檻數值 (0-100)',
        },
        thresholdDirection: {
          type: 'string',
          enum: ['lt', 'gt', 'none'],
          default: 'none',
          description: 'D 值與門檻的比較方向',
        },
      },
      required: ['kIndicatorKey', 'dIndicatorKey'],
      additionalProperties: true,
    },
  };

  const plugin = contract.createLegacyStrategyPlugin(meta, (context, params) => {
    const kKey = typeof params?.kIndicatorKey === 'string' ? params.kIndicatorKey : '';
    const dKey = typeof params?.dIndicatorKey === 'string' ? params.dIndicatorKey : '';
    const cross = params?.cross === 'kBelowD' ? 'kBelowD' : 'kAboveD';
    const thresholdValueRaw = Number(params?.thresholdValue);
    const thresholdValue = Number.isFinite(thresholdValueRaw) ? thresholdValueRaw : null;
    const thresholdDirection =
      params?.thresholdDirection === 'gt'
        ? 'gt'
        : params?.thresholdDirection === 'lt'
        ? 'lt'
        : 'none';

    const kSeries = context.helpers.getIndicator(kKey) || [];
    const dSeries = context.helpers.getIndicator(dKey) || [];
    const idx = context.index;
    const kNow = Array.isArray(kSeries) ? kSeries[idx] : null;
    const dNow = Array.isArray(dSeries) ? dSeries[idx] : null;
    const kPrev = idx > 0 && Array.isArray(kSeries) ? kSeries[idx - 1] : null;
    const dPrev = idx > 0 && Array.isArray(dSeries) ? dSeries[idx - 1] : null;

    const validKNow = isFiniteNumber(kNow);
    const validDNow = isFiniteNumber(dNow);
    const validKPrev = isFiniteNumber(kPrev);
    const validDPrev = isFiniteNumber(dPrev);

    let crossed = false;
    if (cross === 'kAboveD') {
      crossed =
        validKNow &&
        validDNow &&
        validKPrev &&
        validDPrev &&
        kNow > dNow &&
        kPrev <= dPrev;
    } else {
      crossed =
        validKNow &&
        validDNow &&
        validKPrev &&
        validDPrev &&
        kNow < dNow &&
        kPrev >= dPrev;
    }

    let thresholdPassed = true;
    if (thresholdDirection === 'lt' && thresholdValue !== null) {
      thresholdPassed = validDNow && dNow < thresholdValue;
    } else if (thresholdDirection === 'gt' && thresholdValue !== null) {
      thresholdPassed = validDNow && dNow > thresholdValue;
    }

    const signal = crossed && thresholdPassed;

    const base = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      meta: {
        kIndicatorKey: kKey,
        dIndicatorKey: dKey,
        cross,
        thresholdDirection,
        thresholdValue,
        currentK: validKNow ? kNow : null,
        currentD: validDNow ? dNow : null,
        previousK: validKPrev ? kPrev : null,
        previousD: validDPrev ? dPrev : null,
      },
    };

    switch (context.role) {
      case 'longEntry':
        base.enter = signal;
        break;
      case 'longExit':
        base.exit = signal;
        break;
      case 'shortEntry':
        base.short = signal;
        break;
      case 'shortExit':
        base.cover = signal;
        break;
      default:
        break;
    }

    return base;
  });

  registry.register(plugin);

  const { registerAlias } = registry;

  registerAlias('k_d_cross', {
    pluginId: plugin.meta.id,
    roles: ['longEntry', 'longExit'],
    mapParams(userParams, contextInfo) {
      const role = contextInfo?.role;
      if (role === 'longExit') {
        const threshold = Number(userParams?.thresholdY);
        return {
          kIndicatorKey: 'kExit',
          dIndicatorKey: 'dExit',
          cross: 'kBelowD',
          thresholdValue: Number.isFinite(threshold) ? threshold : 70,
          thresholdDirection: 'gt',
        };
      }
      const threshold = Number(userParams?.thresholdX);
      return {
        kIndicatorKey: 'kEntry',
        dIndicatorKey: 'dEntry',
        cross: 'kAboveD',
        thresholdValue: Number.isFinite(threshold) ? threshold : 30,
        thresholdDirection: 'lt',
      };
    },
  });

  registerAlias('short_k_d_cross', {
    pluginId: plugin.meta.id,
    roles: ['shortEntry'],
    mapParams(userParams) {
      const threshold = Number(userParams?.thresholdY);
      return {
        kIndicatorKey: 'kShortEntry',
        dIndicatorKey: 'dShortEntry',
        cross: 'kBelowD',
        thresholdValue: Number.isFinite(threshold) ? threshold : 70,
        thresholdDirection: 'gt',
      };
    },
  });

  registerAlias('cover_k_d_cross', {
    pluginId: plugin.meta.id,
    roles: ['shortExit'],
    mapParams(userParams) {
      const threshold = Number(userParams?.thresholdX);
      return {
        kIndicatorKey: 'kCover',
        dIndicatorKey: 'dCover',
        cross: 'kAboveD',
        thresholdValue: Number.isFinite(threshold) ? threshold : 30,
        thresholdDirection: 'lt',
      };
    },
  });
})(typeof self !== 'undefined' ? self : this);
