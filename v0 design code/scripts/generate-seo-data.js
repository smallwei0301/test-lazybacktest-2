const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'seo_mock_data.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to generate random number between min and max
const random = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(random(min, max));

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

// Strategy definitions
const STRATEGIES = [
    { id: 'rsi', name: 'RSI 反轉策略', type: 'Reversal' },
    { id: 'macd', name: 'MACD 趨勢策略', type: 'Trend' },
    { id: 'kd', name: 'KD 黃金交叉', type: 'Momentum' },
    { id: 'bollinger', name: '布林通道突破', type: 'Volatility' },
    { id: 'ma', name: '均線穿越策略', type: 'Trend' },
];

// Stock definitions
const STOCKS = [
    { symbol: '2330', name: '台積電' },
    { symbol: '2603', name: '長榮' },
    { symbol: '2454', name: '聯發科' },
    { symbol: '2317', name: '鴻海' },
    { symbol: '0050', name: '元大台灣50' },
    { symbol: '2303', name: '聯電' },
    { symbol: '2881', name: '富邦金' },
    { symbol: '1301', name: '台塑' },
];

// Generate mock data
const generateData = () => {
    return STOCKS.map(stock => {
        // 1. Pick a random Champion Strategy for this stock
        const championIndex = randomInt(0, STRATEGIES.length);
        const championStrategyDef = STRATEGIES[championIndex];

        const stockStrategies = STRATEGIES.map((strategy, index) => {
            const isChampion = index === championIndex;

            // Generate trades
            const trades = [];
            const currentDate = new Date();
            const tradeCount = randomInt(5, 20);

            // Win rate and ROI logic
            // Champion gets better stats
            const baseWinRate = isChampion ? 70 : 40;
            const winRate = parseFloat(random(baseWinRate, baseWinRate + 20).toFixed(1));

            const baseRoi = isChampion ? 20 : -10;
            const roi = parseFloat(random(baseRoi, baseRoi + 40).toFixed(1));

            for (let i = 0; i < tradeCount; i++) {
                // Go back random days
                currentDate.setDate(currentDate.getDate() - randomInt(2, 10));

                const isWin = Math.random() < (winRate / 100);
                const returnPct = isWin ? random(2, 8) : random(-5, -1);

                trades.push({
                    date: formatDate(new Date(currentDate)),
                    type: Math.random() > 0.5 ? 'BUY' : 'SELL',
                    price: randomInt(100, 1000),
                    return: parseFloat(returnPct.toFixed(1)),
                    status: i === 0 ? 'OPEN' : 'CLOSED' // Latest trade might be open
                });
            }

            // Determine last signal
            const lastSignal = Math.random() > 0.5 ? 'BUY' : 'SELL';
            const lastSignalDate = formatDate(new Date()); // Always today

            return {
                id: strategy.id,
                name: strategy.name,
                type: strategy.type,
                winRate,
                roi,
                tradeCount,
                lastSignal,
                lastSignalDate,
                trades: trades,
                // Add Champion Data for comparison
                champion: {
                    name: championStrategyDef.name,
                    winRate: parseFloat(random(68, 78).toFixed(1)), // Consistent with champion logic
                    roi: parseFloat(random(30, 60).toFixed(1))
                }
            };
        });

        return {
            symbol: stock.symbol,
            name: stock.name,
            strategies: stockStrategies
        };
    });
};

try {
    const data = generateData();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully generated SEO mock data at: ${OUTPUT_FILE}`);
    console.log(`Total stocks: ${data.length}`);
    console.log(`Strategies per stock: ${data[0].strategies.length}`);
    console.log(`Sample Champion for 2330: ${data[0].strategies[0].champion.name} (Win Rate: ${data[0].strategies[0].champion.winRate}%)`);
} catch (error) {
    console.error('Error generating data:', error);
    process.exit(1);
}
