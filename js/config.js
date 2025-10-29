// --- 設定檔 ---

const SAVED_STRATEGIES_KEY = 'stockBacktestStrategies_v3.4';

// 策略說明資料 (包含優化目標與範圍)
const strategyDescriptions = {
    'ma_cross': { name: '均線黃金交叉', desc: '短期SMA向上穿越長期SMA。\n參數: 短期SMA, 長期SMA', defaultParams: { shortPeriod: 5, longPeriod: 20 }, optimizeTargets: [{ name: 'shortPeriod', label: '短期SMA', range: { from: 3, to: 50, step: 1 } }, { name: 'longPeriod', label: '長期SMA', range: { from: 10, to: 100, step: 2 } }] },
    'ma_above': { name: '價格突破均線', desc: '收盤價從下方突破SMA。\n參數: SMA週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: 'SMA週期', range: { from: 5, to: 100, step: 2 } }] },
    'rsi_oversold': { name: 'RSI超賣', desc: 'RSI 從超賣區向上反轉。\n參數: RSI週期, 閾值', defaultParams: { period: 14, threshold: 30 }, optimizeTargets: [{ name: 'period', label: 'RSI週期', range: { from: 6, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: 10, to: 45, step: 1 } }] },
    'macd_cross': { name: 'MACD黃金交叉 (DI版)', desc: 'DI版: DIF(基於DI的EMA差)向上穿越DEA。\n參數: 短EMA(n), 長EMA(m), DEA週期(x)', defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 }, optimizeTargets: [{ name: 'shortPeriod', label: 'DI短EMA(n)', range: { from: 5, to: 20, step: 1 } }, { name: 'longPeriod', label: 'DI長EMA(m)', range: { from: 20, to: 50, step: 2 } }, { name: 'signalPeriod', label: 'DEA週期(x)', range: { from: 5, to: 20, step: 1 } }] },
    'bollinger_breakout': { name: '布林通道突破', desc: '價格向上突破布林上軌。\n參數: 週期, 標準差', defaultParams: { period: 20, deviations: 2 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 10, to: 50, step: 2 } }, { name: 'deviations', label: '標準差', range: { from: 1, to: 3.5, step: 0.1 } }] },
    'k_d_cross': { name: 'KD黃金交叉 (D<X)', desc: 'K>D 且 D<X。\n參數: KD週期, D值上限(X)', defaultParams: { period: 9, thresholdX: 30 }, optimizeTargets: [{ name: 'period', label: 'KD週期', range: { from: 5, to: 21, step: 1 } }, { name: 'thresholdX', label: 'D值上限(X)', range: { from: 10, to: 50, step: 2 } }] },
    'volume_spike': { name: '成交量暴增', desc: '成交量 > N日均量 * 倍數。\n參數: 倍數, 平均週期', defaultParams: { multiplier: 2, period: 20 }, optimizeTargets: [{ name: 'period', label: '平均週期', range: { from: 5, to: 60, step: 2 } }, { name: 'multiplier', label: '倍數', range: { from: 1.2, to: 6, step: 0.2 } }] },
    'volume_spike_exit': { name: '成交量暴增 (出場)', desc: '成交量 > N日均量 * 倍數 (出場版)。\n參數: 倍數, 平均週期', defaultParams: { multiplier: 2, period: 20 }, optimizeTargets: [{ name: 'period', label: '平均週期', range: { from: 5, to: 60, step: 2 } }, { name: 'multiplier', label: '倍數', range: { from: 1.2, to: 6, step: 0.2 } }] },
    'short_volume_spike': { name: '成交量暴增 (做空)', desc: '成交量 > N日均量 * 倍數 (做空版)。\n參數: 倍數, 平均週期', defaultParams: { multiplier: 2, period: 20 }, optimizeTargets: [{ name: 'period', label: '平均週期', range: { from: 5, to: 60, step: 2 } }, { name: 'multiplier', label: '倍數', range: { from: 1.2, to: 6, step: 0.2 } }] },
    'cover_volume_spike': { name: '成交量暴增 (回補)', desc: '成交量 > N日均量 * 倍數 (回補版)。\n參數: 倍數, 平均週期', defaultParams: { multiplier: 2, period: 20 }, optimizeTargets: [{ name: 'period', label: '平均週期', range: { from: 5, to: 60, step: 2 } }, { name: 'multiplier', label: '倍數', range: { from: 1.2, to: 6, step: 0.2 } }] },
    'price_breakout': { name: '價格突破前高', desc: '價格突破前 N 日最高。\n參數: 觀察週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: '觀察週期', range: { from: 5, to: 100, step: 2 } }] },
    'williams_oversold': { name: '威廉指標超賣', desc: 'WR 從超賣區向上反轉。\n參數: 週期, 閾值', defaultParams: { period: 14, threshold: -80 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 7, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: -95, to: -50, step: 2 } }] },
    'turtle_breakout': { name: '海龜突破 (僅進場)', desc: '價格突破過去 N 日最高。\n參數: 突破週期', defaultParams: { breakoutPeriod: 20 }, optimizeTargets: [{ name: 'breakoutPeriod', label: '突破週期', range: { from: 10, to: 100, step: 2 } }] },
    'ma_cross_exit': { name: '均線死亡交叉', desc: '短期SMA向下穿越長期SMA。\n參數: 短期SMA, 長期SMA', defaultParams: { shortPeriod: 5, longPeriod: 20 }, optimizeTargets: [{ name: 'shortPeriod', label: '短期SMA', range: { from: 3, to: 50, step: 1 } }, { name: 'longPeriod', label: '長期SMA', range: { from: 10, to: 100, step: 2 } }] },
    'ma_below': { name: '價格跌破均線', desc: '收盤價從上方跌破SMA。\n參數: SMA週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: 'SMA週期', range: { from: 5, to: 100, step: 2 } }] },
    'rsi_overbought': { name: 'RSI超買', desc: 'RSI 從超買區向下反轉。\n參數: RSI週期, 閾值', defaultParams: { period: 14, threshold: 70 }, optimizeTargets: [{ name: 'period', label: 'RSI週期', range: { from: 6, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: 55, to: 90, step: 1 } }] },
    'macd_cross_exit': { name: 'MACD死亡交叉 (DI版)', desc: 'DI版: DIF(基於DI的EMA差)向下穿越DEA。\n參數: 短EMA(n), 長EMA(m), DEA週期(x)', defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 }, optimizeTargets: [{ name: 'shortPeriod', label: 'DI短EMA(n)', range: { from: 5, to: 20, step: 1 } }, { name: 'longPeriod', label: 'DI長EMA(m)', range: { from: 20, to: 50, step: 2 } }, { name: 'signalPeriod', label: 'DEA週期(x)', range: { from: 5, to: 20, step: 1 } }] },
    'bollinger_reversal': { name: '布林通道反轉', desc: '價格從上方跌破布林中軌。\n參數: 週期, 標準差', defaultParams: { period: 20, deviations: 2 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 10, to: 50, step: 2 } }, { name: 'deviations', label: '標準差', range: { from: 1, to: 3.5, step: 0.1 } }] },
    'k_d_cross_exit': { name: 'KD死亡交叉 (D>Y)', desc: 'K<D 且 D>Y。\n參數: KD週期, D值下限(Y)', defaultParams: { period: 9, thresholdY: 70 }, optimizeTargets: [{ name: 'period', label: 'KD週期', range: { from: 5, to: 21, step: 1 } }, { name: 'thresholdY', label: 'D值下限(Y)', range: { from: 50, to: 90, step: 2 } }] },
    'trailing_stop': { name: '移動停損 (%)', desc: '價格從高點回跌 N%。\n參數: 停損百分比', defaultParams: { percentage: 5 }, optimizeTargets: [{ name: 'percentage', label: '停損百分比', range: { from: 1, to: 30, step: 0.5 } }] },
    'price_breakdown': { name: '價格跌破前低', desc: '價格跌破前 N 日最低。\n參數: 觀察週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: '觀察週期', range: { from: 5, to: 100, step: 2 } }] },
    'williams_overbought': { name: '威廉指標超買', desc: 'WR 從超買區向下反轉。\n參數: 週期, 閾值', defaultParams: { period: 14, threshold: -20 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 7, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: -50, to: -5, step: 2 } }] },
    'turtle_stop_loss': { name: '海龜停損 (N日低)', desc: '價格跌破過去 N 日最低。\n參數: 停損週期', defaultParams: { stopLossPeriod: 10 }, optimizeTargets: [{ name: 'stopLossPeriod', label: '停損週期', range: { from: 5, to: 50, step: 1 } }] },
    'fixed_stop_loss': { name: '(由風險管理控制)', desc: '全局停損設定優先。', defaultParams: {}, optimizeTargets: [] },
    'short_ma_cross': { name: '均線死亡交叉 (做空)', desc: '短期SMA向下穿越長期SMA。\n參數: 短期SMA, 長期SMA', defaultParams: { shortPeriod: 5, longPeriod: 20 }, optimizeTargets: [{ name: 'shortPeriod', label: '短期SMA', range: { from: 3, to: 50, step: 1 } }, { name: 'longPeriod', label: '長期SMA', range: { from: 10, to: 100, step: 2 } }] },
    'short_ma_below': { name: '價格跌破均線 (做空)', desc: '收盤價從上方跌破SMA。\n參數: SMA週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: 'SMA週期', range: { from: 5, to: 100, step: 2 } }] },
    'short_rsi_overbought': { name: 'RSI超買 (做空)', desc: 'RSI 從超買區向下反轉。\n參數: RSI週期, 閾值', defaultParams: { period: 14, threshold: 70 }, optimizeTargets: [{ name: 'period', label: 'RSI週期', range: { from: 6, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: 55, to: 90, step: 1 } }] },
    'short_macd_cross': { name: 'MACD死亡交叉 (DI版) (做空)', desc: 'DI版: DIF 向下穿越 DEA。\n參數: 短EMA(n), 長EMA(m), DEA週期(x)', defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 }, optimizeTargets: [{ name: 'shortPeriod', label: 'DI短EMA(n)', range: { from: 5, to: 20, step: 1 } }, { name: 'longPeriod', label: 'DI長EMA(m)', range: { from: 20, to: 50, step: 2 } }, { name: 'signalPeriod', label: 'DEA週期(x)', range: { from: 5, to: 20, step: 1 } }] },
    'short_bollinger_reversal': { name: '布林通道反轉 (做空)', desc: '價格從上方跌破布林中軌。\n參數: 週期, 標準差', defaultParams: { period: 20, deviations: 2 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 10, to: 50, step: 2 } }, { name: 'deviations', label: '標準差', range: { from: 1, to: 3.5, step: 0.1 } }] },
    'short_k_d_cross': { name: 'KD死亡交叉 (D>Y) (做空)', desc: 'K<D 且 D>Y。\n參數: KD週期, D值下限(Y)', defaultParams: { period: 9, thresholdY: 70 }, optimizeTargets: [{ name: 'period', label: 'KD週期', range: { from: 5, to: 21, step: 1 } }, { name: 'thresholdY', label: 'D值下限(Y)', range: { from: 50, to: 90, step: 2 } }] },
    'short_price_breakdown': { name: '價格跌破前低 (做空)', desc: '價格跌破前 N 日最低。\n參數: 觀察週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: '觀察週期', range: { from: 5, to: 100, step: 2 } }] },
    'short_williams_overbought': { name: '威廉指標超買 (做空)', desc: 'WR 從超買區向下反轉。\n參數: 週期, 閾值', defaultParams: { period: 14, threshold: -20 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 7, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: -50, to: -5, step: 2 } }] },
    'short_turtle_stop_loss': { name: '海龜N日低 (做空)', desc: '價格跌破過去 N 日最低。\n參數: 觀察週期', defaultParams: { stopLossPeriod: 10 }, optimizeTargets: [{ name: 'stopLossPeriod', label: '觀察週期', range: { from: 5, to: 50, step: 1 } }] },
    'cover_ma_cross': { name: '均線黃金交叉 (回補)', desc: '短期SMA向上穿越長期SMA。\n參數: 短期SMA, 長期SMA', defaultParams: { shortPeriod: 5, longPeriod: 20 }, optimizeTargets: [{ name: 'shortPeriod', label: '短期SMA', range: { from: 3, to: 50, step: 1 } }, { name: 'longPeriod', label: '長期SMA', range: { from: 10, to: 100, step: 2 } }] },
    'cover_ma_above': { name: '價格突破均線 (回補)', desc: '收盤價從下方突破SMA。\n參數: SMA週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: 'SMA週期', range: { from: 5, to: 100, step: 2 } }] },
    'cover_rsi_oversold': { name: 'RSI超賣 (回補)', desc: 'RSI 從超賣區向上反轉。\n參數: RSI週期, 閾值', defaultParams: { period: 14, threshold: 30 }, optimizeTargets: [{ name: 'period', label: 'RSI週期', range: { from: 6, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: 10, to: 45, step: 1 } }] },
    'cover_macd_cross': { name: 'MACD黃金交叉 (DI版) (回補)', desc: 'DI版: DIF 向上穿越 DEA。\n參數: 短EMA(n), 長EMA(m), DEA週期(x)', defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 }, optimizeTargets: [{ name: 'shortPeriod', label: 'DI短EMA(n)', range: { from: 5, to: 20, step: 1 } }, { name: 'longPeriod', label: 'DI長EMA(m)', range: { from: 20, to: 50, step: 2 } }, { name: 'signalPeriod', label: 'DEA週期(x)', range: { from: 5, to: 20, step: 1 } }] },
    'cover_bollinger_breakout': { name: '布林通道突破 (回補)', desc: '價格向上突破布林上軌。\n參數: 週期, 標準差', defaultParams: { period: 20, deviations: 2 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 10, to: 50, step: 2 } }, { name: 'deviations', label: '標準差', range: { from: 1, to: 3.5, step: 0.1 } }] },
    'cover_k_d_cross': { name: 'KD黃金交叉 (D<X) (回補)', desc: 'K>D 且 D<X。\n參數: KD週期, D值上限(X)', defaultParams: { period: 9, thresholdX: 30 }, optimizeTargets: [{ name: 'period', label: 'KD週期', range: { from: 5, to: 21, step: 1 } }, { name: 'thresholdX', label: 'D值上限(X)', range: { from: 10, to: 50, step: 2 } }] },
    'cover_price_breakout': { name: '價格突破前高 (回補)', desc: '價格突破前 N 日最高。\n參數: 觀察週期', defaultParams: { period: 20 }, optimizeTargets: [{ name: 'period', label: '觀察週期', range: { from: 5, to: 100, step: 2 } }] },
    'cover_williams_oversold': { name: '威廉指標超賣 (回補)', desc: 'WR 從超賣區向上反轉。\n參數: 週期, 閾值', defaultParams: { period: 14, threshold: -80 }, optimizeTargets: [{ name: 'period', label: '週期', range: { from: 7, to: 30, step: 1 } }, { name: 'threshold', label: '閾值', range: { from: -95, to: -50, step: 2 } }] },
    'cover_turtle_breakout': { name: '海龜N日高 (回補)', desc: '價格突破過去 N 日最高。\n參數: 突破週期', defaultParams: { breakoutPeriod: 20 }, optimizeTargets: [{ name: 'breakoutPeriod', label: '突破週期', range: { from: 10, to: 100, step: 2 } }] },
    'cover_trailing_stop': { name: '移動停損 (%) (空單停損)', desc: '價格從(空單進場後的)低點反彈 N%。\n參數: 停損百分比', defaultParams: { percentage: 5 }, optimizeTargets: [{ name: 'percentage', label: '停損百分比', range: { from: 1, to: 30, step: 0.5 } }] },
    'cover_fixed_stop_loss': { name: '(由風險管理控制)', desc: '全局停損/停利設定優先。', defaultParams: {}, optimizeTargets: [] },
};

const STRATEGY_ID_ROLE_MIGRATIONS = Object.freeze({
    exit: {
        ma_cross: 'ma_cross_exit',
        macd_cross: 'macd_cross_exit',
        k_d_cross: 'k_d_cross_exit',
        volume_spike: 'volume_spike_exit',
    },
    shortEntry: {
        ma_cross: 'short_ma_cross',
        ma_below: 'short_ma_below',
        rsi_overbought: 'short_rsi_overbought',
        macd_cross: 'short_macd_cross',
        bollinger_reversal: 'short_bollinger_reversal',
        k_d_cross: 'short_k_d_cross',
        price_breakdown: 'short_price_breakdown',
        williams_overbought: 'short_williams_overbought',
        turtle_stop_loss: 'short_turtle_stop_loss',
        volume_spike: 'short_volume_spike',
    },
    shortExit: {
        ma_cross: 'cover_ma_cross',
        ma_above: 'cover_ma_above',
        rsi_oversold: 'cover_rsi_oversold',
        macd_cross: 'cover_macd_cross',
        bollinger_breakout: 'cover_bollinger_breakout',
        k_d_cross: 'cover_k_d_cross',
        price_breakout: 'cover_price_breakout',
        williams_oversold: 'cover_williams_oversold',
        turtle_breakout: 'cover_turtle_breakout',
        trailing_stop: 'cover_trailing_stop',
        fixed_stop_loss: 'cover_fixed_stop_loss',
        volume_spike: 'cover_volume_spike',
    },
});

const LazyStrategyId = (typeof window !== 'undefined' && window.LazyStrategyId)
    ? { ...window.LazyStrategyId }
    : {};

LazyStrategyId.map = { ...(LazyStrategyId.map || {}), ...STRATEGY_ID_ROLE_MIGRATIONS };

LazyStrategyId.normalise = function normaliseStrategyId(role, strategyId) {
    if (!strategyId) return strategyId;
    const roleKey = role && typeof role === 'string' ? role : null;
    if (roleKey && LazyStrategyId.map?.[roleKey]?.[strategyId]) {
        return LazyStrategyId.map[roleKey][strategyId];
    }
    if (roleKey === 'exit' && ['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(strategyId)) {
        return `${strategyId}_exit`;
    }
    if (roleKey === 'shortEntry' && !strategyId.startsWith('short_')) {
        return `short_${strategyId}`;
    }
    if (roleKey === 'shortExit' && !strategyId.startsWith('cover_')) {
        return `cover_${strategyId}`;
    }
    return strategyId;
};

LazyStrategyId.normaliseAny = function normaliseStrategyIdAny(strategyId) {
    if (!strategyId) return strategyId;
    const roles = Array.isArray(Object.keys(STRATEGY_ID_ROLE_MIGRATIONS))
        ? Object.keys(STRATEGY_ID_ROLE_MIGRATIONS)
        : ['exit', 'shortEntry', 'shortExit'];
    for (const role of roles) {
        const migrated = LazyStrategyId.normalise(role, strategyId);
        if (migrated !== strategyId) {
            return migrated;
        }
    }
    return strategyId;
};

if (typeof window !== 'undefined') {
    window.LazyStrategyId = LazyStrategyId;
}

const longEntryToCoverMap = {
    'ma_cross': 'cover_ma_cross', 'ma_above': 'cover_ma_above', 'rsi_oversold': 'cover_rsi_oversold',
    'macd_cross': 'cover_macd_cross', 'bollinger_breakout': 'cover_bollinger_breakout',
    'k_d_cross': 'cover_k_d_cross', 'price_breakout': 'cover_price_breakout',
    'williams_oversold': 'cover_williams_oversold',
    'turtle_breakout': 'cover_turtle_breakout', 'volume_spike': null
};

const longExitToShortMap = {
    'ma_cross': 'short_ma_cross', 'ma_below': 'short_ma_below', 'rsi_overbought': 'short_rsi_overbought',
    'macd_cross': 'short_macd_cross', 'bollinger_reversal': 'short_bollinger_reversal',
    'k_d_cross': 'short_k_d_cross', 'price_breakdown': 'short_price_breakdown',
    'williams_overbought': 'short_williams_overbought',
    'turtle_stop_loss': 'short_turtle_stop_loss', 'trailing_stop': null, 'fixed_stop_loss': null,
    'volume_spike': null, 'volume_spike_exit': null
};

const globalOptimizeTargets = {
    stopLoss: { label: '停損 (%)', range: { from: 1, to: 30, step: 0.5 } },
    takeProfit: { label: '停利 (%)', range: { from: 5, to: 100, step: 1 } }
};