const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'v0 design code', 'lib', 'data', 'seo-text-bank-v3.ts');

try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract the KD strategy block
    // Looking for KD: { ... }
    // We need to be careful with nested braces. 
    // Since the file structure is consistent, we can try to find the start of KD and the start of the next strategy (Bollinger) or end of file.

    const kdStartRegex = /KD:\s*{/;
    const bollingerStartRegex = /Bollinger:\s*{/;

    const matchStart = content.match(kdStartRegex);
    if (!matchStart) {
        console.error('Could not find KD strategy start.');
        process.exit(1);
    }

    const startIndex = matchStart.index;
    let endIndex = content.length;

    const matchEnd = content.match(bollingerStartRegex);
    if (matchEnd) {
        endIndex = matchEnd.index;
    }

    const kdBlock = content.substring(startIndex, endIndex);

    // Function to count sentences in a category array
    function countSentences(layerName, categoryName) {
        // Regex to find the array for a specific layer and category
        // layer1_theory: { ... poor: [ ... ] ... }

        // First find the layer block
        const layerRegex = new RegExp(`${layerName}:\\s*{[^}]*`, 's');
        // This simple regex might fail if nested objects are complex, but here structure is:
        // layerX: {
        //   poor: [...],
        //   average: [...],
        //   ...
        // }
        // So we can extract the layer block first.

        // Let's try a more robust approach by extracting the specific array content directly
        // Look for: layerName followed by categoryName followed by [ ... ]

        // We will assume the order is poor, average, good, excellent within the layer, 
        // but regex should find the specific key.

        // Find layer start
        const layerStartMatch = kdBlock.match(new RegExp(`${layerName}:\\s*{`));
        if (!layerStartMatch) return 0;

        const layerRest = kdBlock.substring(layerStartMatch.index);

        // Find category start within layer
        const categoryMatch = layerRest.match(new RegExp(`${categoryName}:\\s*\\[`));
        if (!categoryMatch) return 0;

        // Extract the array content
        let arrayContent = '';
        let openBrackets = 0;
        let foundStart = false;

        for (let i = categoryMatch.index; i < layerRest.length; i++) {
            const char = layerRest[i];
            if (char === '[') {
                openBrackets++;
                foundStart = true;
            } else if (char === ']') {
                openBrackets--;
            }

            if (foundStart) {
                arrayContent += char;
                if (openBrackets === 0) break;
            }
        }

        // Count strings in the array
        // Matches "..." or '...' or `...`
        // We assume double quotes are used based on previous edits
        const sentences = arrayContent.match(/"[^"]*"/g) || [];
        return sentences.length;
    }

    const layers = [
        'layer1_theory',
        'layer2_adaptability',
        'layer3_blindspot',
        'layer4_data',
        'layer5_pain'
    ];

    const categories = ['poor', 'average', 'good', 'excellent'];

    console.log('KD Strategy Sentence Counts:');
    console.log('----------------------------------------');

    let totalVariations = 0;
    let pass = true;

    layers.forEach(layer => {
        console.log(`\n${layer}:`);
        categories.forEach(category => {
            const count = countSentences(layer, category);
            totalVariations += count;
            const status = count >= 20 ? '✅' : '❌';
            console.log(`  ${category.padEnd(10)}: ${count} ${status}`);
            if (count < 20) pass = false;
        });
    });

    console.log('\n----------------------------------------');
    console.log(`Total Variations: ${totalVariations}`);

    if (pass) {
        console.log('\n✅ VERIFICATION PASSED: All categories have 20+ sentences.');
    } else {
        console.log('\n❌ VERIFICATION FAILED: Some categories have fewer than 20 sentences.');
        process.exit(1);
    }

} catch (err) {
    console.error('Error reading file:', err);
    process.exit(1);
}
