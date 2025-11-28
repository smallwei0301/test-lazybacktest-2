
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, 'v0 design code', 'lib', 'data', 'seo-text-bank-v3.ts');
const content = fs.readFileSync(filePath, 'utf-8');

const strategy = 'MACD';
const layers = ['layer1_theory', 'layer2_adaptability', 'layer3_blindspot', 'layer4_data', 'layer5_pain'];
const categories = ['poor', 'average', 'good', 'excellent'];

console.log(`--- ${strategy} Sentence Counts (Regex Method) ---`);
let total = 0;

// Extract the strategy block
const strategyRegex = new RegExp(`${strategy}:\\s*{([\\s\\S]*?)},\\s*\\/\\/ =`, 'm');
const strategyMatch = content.match(strategyRegex);

if (!strategyMatch) {
    console.error(`Could not find strategy block for ${strategy}`);
    process.exit(1);
}

const strategyBlock = strategyMatch[1];

layers.forEach(layer => {
  console.log(`\n[${layer}]`);
  
  // Extract layer block
  const layerRegex = new RegExp(`${layer}:\\s*{([\\s\\S]*?)},`, 'm');
  const layerMatch = strategyBlock.match(layerRegex);
  
  if (!layerMatch) {
      console.log(`  WARNING: Layer ${layer} not found!`);
      return;
  }
  
  const layerBlock = layerMatch[1];

  categories.forEach(category => {
    // Extract category block
    const categoryRegex = new RegExp(`${category}:\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const categoryMatch = layerBlock.match(categoryRegex);
    
    if (!categoryMatch) {
        console.log(`  ${category}: 0 (Category not found)`);
        return;
    }
    
    const categoryBlock = categoryMatch[1];
    // Count strings (lines starting with " or ')
    const sentences = categoryBlock.match(/["'].*["']/g);
    const count = sentences ? sentences.length : 0;
    
    console.log(`  ${category}: ${count}`);
    total += count;
    
    if (count < 20) {
        console.warn(`  WARNING: ${category} has less than 20 sentences!`);
    }
  });
});

console.log(`\nTotal Sentences for ${strategy}: ${total}`);
