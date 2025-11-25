const { SEO_TEXT_BANK } = require('../lib/data/seo-text-bank-v3.ts');

// Test MACD strategy content
console.log('=== MACD Strategy Check ===');
console.log('MACD exists?', !!SEO_TEXT_BANK.strategies.MACD);

if (SEO_TEXT_BANK.strategies.MACD) {
    const firstText = SEO_TEXT_BANK.strategies.MACD.layer1_theory.poor[0];
    console.log('First MACD text (first 150 chars):', firstText.substring(0, 150));

    // Check if it contains MACD keywords
    console.log('Contains "MACD"?', firstText.includes('MACD'));
    console.log('Contains "DIF"?', firstText.includes('DIF'));
    console.log('Contains "均線" (should be NO)?', firstText.includes('均線'));
    console.log('Contains "移動平均線" (should be NO)?', firstText.includes('移動平均線'));
} else {
    console.log('❌ MACD strategy NOT found!');
}

console.log('\n=== MovingAverage Strategy Check ===');
if (SEO_TEXT_BANK.strategies.MovingAverage) {
    const firstMAText = SEO_TEXT_BANK.strategies.MovingAverage.layer1_theory.poor[0];
    console.log('First MA text (first 150 chars):', firstMAText.substring(0, 150));
    console.log('Contains "均線"?', firstMAText.includes('均線'));
    console.log('Contains "移動平均線"?', firstMAText.includes('移動平均線'));
}
