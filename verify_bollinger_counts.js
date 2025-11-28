const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'v0 design code', 'lib', 'data', 'seo-text-bank-v3.ts');
const reportLines = [];

function log(msg) {
    console.log(msg);
    reportLines.push(msg);
}

log(`Reading file from: ${filePath}`);
const content = fs.readFileSync(filePath, 'utf8');

// Extract Bollinger block
const bollingerMatch = content.match(/Bollinger:\s*{([\s\S]*?)\n\s*},\s*\/\/\s*={10,}/);
if (!bollingerMatch) {
    log('Bollinger block not found');
    const bollingerStart = content.indexOf('Bollinger:');
    if (bollingerStart !== -1) {
        log(`Found "Bollinger:" at index ${bollingerStart}`);
        log(`Next 500 chars: ${content.substring(bollingerStart, bollingerStart + 500)}`);
    }
    fs.writeFileSync('verify_report.txt', reportLines.join('\n'), 'utf8');
    process.exit(1);
}

const bollingerBlock = bollingerMatch[1];
log(`Bollinger block extracted. Length: ${bollingerBlock.length}`);

const layers = [
    'layer1_theory',
    'layer2_adaptability',
    'layer3_blindspot',
    'layer4_data',
    'layer5_pain'
];

const categories = ['poor', 'average', 'good', 'excellent'];

log('Bollinger Strategy Sentence Counts:');
log('----------------------------------------');

let hasError = false;

layers.forEach(layer => {
    log(`\n${layer}:`);

    try {
        const layerRegex = new RegExp(`${layer}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`, 'm');
        const layerMatch = bollingerBlock.match(layerRegex);

        if (!layerMatch) {
            log(`  MISSING LAYER! ❌ (Regex failed to match ${layer})`);
            hasError = true;
            return;
        }

        const layerContent = layerMatch[1];

        categories.forEach(category => {
            const categoryRegex = new RegExp(`${category}:\\s*\\[([\\s\\S]*?)\\]`, 'm');
            const categoryMatch = layerContent.match(categoryRegex);

            if (!categoryMatch) {
                log(`  ${category.padEnd(10)}: MISSING! ❌`);
                hasError = true;
                return;
            }

            const sentences = categoryMatch[1]
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('"') || line.startsWith("'") || line.startsWith('`'));

            const count = sentences.length;
            const status = count >= 20 ? '✅' : `❌ (${count}/20)`;

            if (count < 20) hasError = true;

            log(`  ${category.padEnd(10)}: ${count} ${status}`);
        });
    } catch (e) {
        log(`  Error processing layer ${layer}: ${e.message}`);
        hasError = true;
    }
});

if (hasError) {
    log('\nVerification FAILED. Some layers/categories are missing or incomplete.');
    fs.writeFileSync('verify_report.txt', reportLines.join('\n'), 'utf8');
    process.exit(1);
} else {
    log('\nVerification PASSED. All layers/categories have 20+ sentences.');
    fs.writeFileSync('verify_report.txt', reportLines.join('\n'), 'utf8');
    process.exit(0);
}
