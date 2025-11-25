const { SEO_TEXT_BANK } = require('../lib/data/seo-text-bank-v3.ts');

// Get full first text for MACD
console.log('=== FULL MACD First Text ===');
const macdFirstText = SEO_TEXT_BANK.strategies.MACD.layer1_theory.poor[0];
console.log(macdFirstText);
console.log('\n=== Length:', macdFirstText.length);
