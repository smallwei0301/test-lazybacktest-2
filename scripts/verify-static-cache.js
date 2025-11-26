const fs = require('fs');
const path = require('path');

const files = [
    'netlify/functions/twse-proxy.js',
    'netlify/functions/tpex-proxy.js',
    'netlify/functions/index-proxy.js',
    'netlify/functions/us-proxy.js'
];

const requiredStrings = [
    'const cacheTTL = isHistorical ? 31536000 : 3600;',
    "'Netlify-CDN-Cache-Control':"
];

let allPassed = true;

console.log('Starting Static Cache Verification...\n');

files.forEach(file => {
    // Adjust path to point to "v0 design code" where the functions are located
    const filePath = path.join(__dirname, '..', 'v0 design code', file);
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            allPassed = false;
            return;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        let filePassed = true;
        requiredStrings.forEach(str => {
            if (!content.includes(str)) {
                console.error(`❌ ${file} missing: "${str}"`);
                filePassed = false;
            }
        });
        if (filePassed) {
            console.log(`✅ ${file} passed static check.`);
        } else {
            allPassed = false;
        }
    } catch (err) {
        console.error(`❌ Error reading ${file}:`, err.message);
        allPassed = false;
    }
});

if (allPassed) {
    console.log('\n✅ Static Check Passed');
    process.exit(0);
} else {
    console.error('\n❌ Static Check Failed');
    process.exit(1);
}
