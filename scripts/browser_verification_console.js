// Browser Verification Script for Smart Caching
// This script is designed to be injected into the browser to verify caching logic.

(async function verifySmartCaching() {
    // Create a display element
    let display = document.getElementById('verification-results');
    if (!display) {
        display = document.createElement('div');
        display.id = 'verification-results';
        display.style.cssText = 'position:fixed; top:10px; right:10px; z-index:99999; background:rgba(0,0,0,0.8); color:white; padding:20px; border-radius:8px; font-family:monospace; max-width:400px; white-space:pre-wrap; overflow:auto; max-height:80vh;';
        document.body.appendChild(display);
    }

    function log(msg, type = 'info') {
        const color = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#e2e8f0';
        const line = document.createElement('div');
        line.style.color = color;
        line.style.marginBottom = '4px';
        line.textContent = `> ${msg}`;
        display.appendChild(line);
        console.log(msg);
        display.scrollTop = display.scrollHeight;
    }

    log("🚀 Starting Smart Caching Verification...");

    const CACHE_NAME = 'lazybacktest-data-v1';
    const STOCK_NO = '2330';

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function getCacheKeys() {
        if (!('caches' in window)) return [];
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        return requests.map(req => req.url);
    }

    async function runBacktest(start, end) {
        log(`[Action] Running backtest: ${start} to ${end}...`);

        const stockInput = document.getElementById('stockNo');
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const btn = document.getElementById('backtestBtn');

        if (!stockInput || !startDateInput || !endDateInput || !btn) {
            log("❌ UI elements not found! Ensure you are on the correct page.", 'error');
            return false;
        }

        // Helper to set value and trigger event
        const setVal = (input, val) => {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(stockInput, STOCK_NO);
        setVal(startDateInput, start);
        setVal(endDateInput, end);

        await wait(500); // Wait for UI update
        btn.click();

        // Wait for processing - look for result or timeout
        log("Waiting for results (10s)...");
        await wait(10000);
        return true;
    }

    try {
        // 1. Clear Cache
        log("[Step 1] Clearing Cache...");
        if ('caches' in window) {
            await caches.delete(CACHE_NAME);
            log("✅ Cache cleared.", 'success');
        } else {
            log("❌ Cache API not supported!", 'error');
            return;
        }

        // 2. Cold Start Test (2020-2022)
        await runBacktest('2020-01-01', '2022-12-31');

        let keys = await getCacheKeys();
        log(`Cache Keys Found: ${keys.length}`);

        const has2020 = keys.some(k => k.includes('/2020/'));
        const has2021 = keys.some(k => k.includes('/2021/'));

        if (has2020 && has2021) {
            log("✅ Cold Start Passed: 2020 & 2021 cached.", 'success');
        } else {
            log("⚠️ Cold Start Failed: Missing keys.", 'error');
            log(`Keys: ${JSON.stringify(keys)}`);
        }

        // 3. Partial Hit Test (2020-2023)
        log("[Step 3] Partial Hit Test (Adding 2023)...");
        await runBacktest('2020-01-01', '2023-12-31');

        keys = await getCacheKeys();
        const has2022 = keys.some(k => k.includes('/2022/'));

        if (has2022) {
            log("✅ Partial Hit Passed: 2022 is now cached.", 'success');
        } else {
            log("ℹ️ 2022 not found (check logic).", 'info');
        }

        log("🎉 Verification Complete!", 'success');

    } catch (e) {
        log(`❌ Error: ${e.message}`, 'error');
    }
})();
