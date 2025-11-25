const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '..', 'v0 design code', 'data');
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
    { id: 'ma_crossover', name: '均線穿越策略', type: 'Trend' },
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
    const today = new Date();

    return STOCKS.map(stock => {
        const stockStrategies = STRATEGIES.map(strategy => {
            // Generate realistic looking performance data
            const winRate = parseFloat(random(45, 75).toFixed(1));
            const roi = parseFloat(random(10, 150).toFixed(1));
            const tradeCount = randomInt(15, 50);

            // Generate recent trades
            const trades = [];
            let currentDate = new Date(today);

            for (let i = 0; i < 5; i++) {
                // Go back random days
                currentDate.setDate(currentDate.getDate() - randomInt(2, 10));

                const isWin = Math.random() < (winRate / 100);
                const returnPct = isWin ? random(2, 8) : random(-5, -1);

                trades.push({
                    date: formatDate(currentDate),
                    type: Math.random() > 0.5 ? 'BUY' : 'SELL',
                    price: randomInt(100, 1000),
                    return: parseFloat(returnPct.toFixed(1)),
                    status: i === 0 ? 'OPEN' : 'CLOSED' // Latest trade might be open
                });
            }

            // Determine last signal
            const lastSignal = Math.random() > 0.5 ? 'BUY' : 'SELL';

            return {
                id: strategy.id,
                name: strategy.name,
                type: strategy.type,
                winRate,
                roi,
                tradeCount,
                lastSignal,
                lastSignalDate: formatDate(today), // Dynamic date as requested
                trades: trades
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
    console.log(`Last signal date set to: ${data[0].strategies[0].lastSignalDate}`);
} catch (error) {
    console.error('Error generating data:', error);
    process.exit(1);
}
