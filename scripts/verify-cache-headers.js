const fs = require('fs');
const path = require('path');

const targetFiles = [
    'v0 design code/netlify/functions/twse-proxy.js',
    'v0 design code/netlify/functions/tpex-proxy.js',
    'v0 design code/netlify/functions/index-proxy.js',
    'v0 design code/netlify/functions/us-proxy.js'
];

const checks = [
    {
        name: 'Cache-Control',
        pattern: /'Cache-Control':\s*'public, max-age=3600, s-maxage=3600'/
    },
    {
        name: 'Netlify-CDN-Cache-Control',
        pattern: /'Netlify-CDN-Cache-Control':\s*'public, s-maxage=3600'/
    }
];

let hasError = false;

console.log('Starting Cache Headers Verification...\n');

targetFiles.forEach(filePath => {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ FAIL: File not found - ${filePath}`);
        hasError = true;
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    let filePass = true;
    const missingChecks = [];

    checks.forEach(check => {
        if (!check.pattern.test(content)) {
            filePass = false;
            missingChecks.push(check.name);
        }
    });

    if (filePass) {
        console.log(`✅ PASS: ${filePath}`);
    } else {
        console.error(`❌ FAIL: ${filePath}`);
        console.error(`   Missing headers: ${missingChecks.join(', ')}`);
        hasError = true;
    }
});

console.log('\nVerification Complete.');

if (hasError) {
    console.error('Some files failed verification.');
    process.exit(1);
} else {
    console.log('All files passed verification.');
    process.exit(0);
}
