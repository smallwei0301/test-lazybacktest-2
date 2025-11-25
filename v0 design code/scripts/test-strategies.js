const { SEO_TEXT_BANK } = require('../lib/data/seo-text-bank-v3.ts');

console.log('Available strategy keys:', Object.keys(SEO_TEXT_BANK.strategies)); console.log('');
console.log('MovingAverage exists?', !!SEO_TEXT_BANK.strategies.MovingAverage);
console.log('MA exists?', !!SEO_TEXT_BANK.strategies.MA);
console.log('');

if (SEO_TEXT_BANK.strategies.MovingAverage) {
    console.log('✅ MovingAverage strategy found!');
    console.log('First text:', SEO_TEXT_BANK.strategies.MovingAverage.layer1_theory.poor[0].substring(0, 100) + '...');
} else {
    console.log('❌ MovingAverage strategy NOT found');
}
