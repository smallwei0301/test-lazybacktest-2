// Test importing and checking MACD strategy text directly
import { SEO_TEXT_BANK } from '../lib/data/seo-text-bank-v3.ts';

const macdPoorText = SEO_TEXT_BANK.strategies.MACD.layer1_theory.poor[0];

console.log('MACD Poor First Text:');
console.log(macdPoorText);
console.log('\n---');
console.log('Contains MACD?', macdPoorText.includes('MACD'));
console.log('Contains DIF?', macdPoorText.includes('DIF'));
console.log('Contains 均線? (should be NO)', macdPoorText.includes('均線'));
console.log('Contains 移動平均線? (should be NO)', macdPoorText.includes('移動平均線'));
