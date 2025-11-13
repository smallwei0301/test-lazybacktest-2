# 回測資料診斷工具：檢查 Netlify Blob 與 Proxy（TWSE）

說明
- 這份檔案包含可直接複製並貼到瀏覽器 DevTools Console 的診斷程式碼。
- 程式會：
  - 呼叫 `/.netlify/functions/stock-range`（Netlify Blob 範圍 API），列印 payload 與最後幾筆資料；
  - 呼叫 `/api/twse/` Proxy 月分 API 檢查指定日期資料；
  - 在 page global scope 掃描可能的 worker 診斷變數（例如 `workerLastMeta`、`fetchDiagnostics`），並印出相關內容以供分析。

使用步驟
1. 開啟你的應用頁面並打開瀏覽器 DevTools（F12）。
2. 切到 Console。
3. 將下方整段程式碼完整貼上並執行（一次貼入整段，避免分行造成解析錯誤）。
4. 執行後會跳出三個 prompt：請輸入 `stockNo`、`start date`、`end date`（範例：2330, 2025-11-01, 2025-11-13）。
5. 執行完畢後，把 Console 中的 `rangeFetch.patch.attempts`、Blob payload（最後幾列）、Proxy payload（最後幾列）與 `workerLastMeta` 或 `fetchDiagnostics` 的輸出內容貼回來，我會協助進一步分析。

注意
- 貼入時請確保整段程式碼一次貼上，避免出現 "Invalid regular expression flags" 的解析錯誤。
- 若網站對 `/.netlify/functions/stock-range` 或 `/api/twse/` 有跨域或身份檢查，請先在相同 domain 下執行（即在應用頁面 Console 執行）。

---

如果你想要在 Console 中看到單行可複製的輸出，貼上並執行下方這段：它會只印出 `DIAG_COPY:{...}` 並把 JSON 存到 `window.__diag_copy_single`。

**超簡短版（只輸出一行 DIAG_COPY）**

```js
// 超簡短：直接在 Console 印出一行 DIAG_COPY
void (async function(){
  const stockNo = prompt('Stock 編號 (例如 2330):', '2330');
  const defaultEnd = new Date().toISOString().slice(0,10);
  const endDate = prompt('End date (YYYY-MM-DD):', defaultEnd);
  const startDate = prompt('Start date (YYYY-MM-DD):', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const monthKey = (d => { const dt=new Date(d); return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}01`; })(endDate);

  try {
    const blobUrl = `/.netlify/functions/stock-range?stockNo=${encodeURIComponent(stockNo)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const blob = await fetch(blobUrl, {headers:{Accept:'application/json'}}).then(r=>r.json()).catch(()=>null);
    const proxyUrl = `/api/twse/?stockNo=${encodeURIComponent(stockNo)}&month=${monthKey}&start=${encodeURIComponent(endDate)}&end=${encodeURIComponent(endDate)}`;
    const proxy = await fetch(proxyUrl, {headers:{Accept:'application/json'}}).then(r=>r.json()).catch(()=>null);

    const out = {
      inputs:{stockNo,startDate,endDate,monthKey},
      blobPresent:!!blob, blob_iTotalRecords: blob && blob.iTotalRecords!=null?blob.iTotalRecords:null,
      blob_last: blob && Array.isArray(blob.aaData)?blob.aaData.slice(-5):null,
      proxyPresent:!!proxy, proxy_iTotalRecords: proxy && proxy.iTotalRecords!=null?proxy.iTotalRecords:null,
      proxy_last: proxy && Array.isArray(proxy.aaData)?proxy.aaData.slice(-5):(proxy && Array.isArray(proxy.data)?proxy.data.slice(-5):null)
    };

    const single = JSON.stringify(out);
    console.log('DIAG_COPY:' + single);
    try{ window.__diag_copy_single = single; }catch(e){}
  } catch (e) { console.error('診斷失敗：', e); }
})();
```

說明：在 DevTools 中執行 async IIFE 時，Console 的最後一行通常會顯示該表達式的 evaluation（通常為 `undefined` 或一個 Promise）；這不會影響 `console.log` 的輸出。請直接複製 `DIAG_COPY:` 那一行或執行 `copy(window.__diag_copy_single)`（在支援的 DevTools 中）來複製結果。
```js
// 更保險的 IIFE 版本：用 `void` 前綴避免 Console 將裸斜線視為正則 literal
void (async function () {
  const stockNo = prompt("Stock 編號 (例如 2330):", "2330");
  const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const startDate = prompt("Start date (YYYY-MM-DD):", defaultStart);
  const endDate = prompt("End date (YYYY-MM-DD):", defaultEnd);
  console.log("Inputs:", { stockNo, startDate, endDate });

  const collect = {};

  // 使用 RegExp 建構子來避免 literal 被誤解析
  try {
    const pattern = new RegExp('worker|Worker|fetchDiag|fetchDiagnostics|workerLastMeta|lastMeta|rangeFetch|patch', 'i');
    const candidateKeys = Object.keys(window).filter(k => pattern.test(k));
    console.log("可能的全域診斷變數:", candidateKeys);
    for (const k of candidateKeys) {
      try { console.log(k, window[k]); collect[k] = window[k]; } catch (e) { console.warn("讀取失敗:", k, e); }
    }
    if (window.workerLastMeta) console.log("window.workerLastMeta:", window.workerLastMeta);
    if (window.fetchDiagnostics) console.log("window.fetchDiagnostics:", window.fetchDiagnostics);
  } catch (e) {
    console.warn("掃描全域變數失敗:", e);
  }

  // 檢查 Netlify Blob range 函數
  try {
    const blobUrl = `/.netlify/functions/stock-range?stockNo=${encodeURIComponent(stockNo)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    console.log("Fetch Netlify Blob:", blobUrl);
    const r = await fetch(blobUrl, { headers: { Accept: "application/json" } });
    const payload = await r.json().catch(e => {
      console.error("解析 Blob 回應 JSON 失敗:", e);
      return null;
    });
    console.log("Blob HTTP status:", r.status);
    console.log("Blob payload keys:", payload ? Object.keys(payload) : null);
    if (payload && Array.isArray(payload.aaData)) {
      console.log("Blob aaData length:", payload.aaData.length);
      console.log("Blob aaData 最後 5 筆 (raw):", payload.aaData.slice(-5));
    } else {
      console.log("Blob payload (非 aaData):", payload);
    }
    collect.blob = payload;
  } catch (err) {
    console.error("Fetch Blob error:", err);
  }

  // 計算 monthKey 並呼叫 proxy 檢查當日資料
  function monthKeyFromIso(iso) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}${m}01`;
  }
  const monthKey = monthKeyFromIso(endDate);

  try {
    const proxyUrl = `/api/twse/?stockNo=${encodeURIComponent(stockNo)}&month=${monthKey}&start=${encodeURIComponent(endDate)}&end=${encodeURIComponent(endDate)}`;
    console.log("Fetch Proxy (TWSE) 月分 API:", proxyUrl);
    const r2 = await fetch(proxyUrl, { headers: { Accept: "application/json" } });
    const p2 = await r2.json().catch(e => {
      console.error("解析 proxy 回應 JSON 失敗:", e);
      return null;
    });
    console.log("Proxy HTTP status:", r2.status);
    console.log("Proxy payload keys:", p2 ? Object.keys(p2) : null);
    if (p2 && Array.isArray(p2.aaData)) {
      console.log("proxy aaData length:", p2.aaData.length);
      console.log("proxy aaData 最後 5 筆 (raw):", p2.aaData.slice(-5));
    } else if (p2 && Array.isArray(p2.data)) {
      console.log("proxy data length:", p2.data.length);
      console.log("proxy data 最後 5 筆:", p2.data.slice(-5));
    } else {
      console.log("proxy payload (raw):", p2);
    }
    collect.proxy = p2;
  } catch (e) {
    console.error("Proxy fetch error:", e);
  }

  // 如果 Blob payload 有 aaData，嘗試摘出最後日期（raw），以便比對
  try {
    if (collect.blob && Array.isArray(collect.blob.aaData) && collect.blob.aaData.length > 0) {
      const lastRow = collect.blob.aaData[collect.blob.aaData.length - 1];
      console.log("Blob 最後一列 raw 日期欄位 (通常 index 0):", lastRow[0], "完整 row:", lastRow);
    }
  } catch (e) { /* ignore */ }

  // 如果有 fetchDiagnostics 或 workerLastMeta，顯示 rangeFetch 與 patch attempts
  try {
    const fd = window.fetchDiagnostics || (window.workerLastMeta && window.workerLastMeta.diagnostics) || null;
    if (fd) {
      console.log("找到 fetchDiagnostics / workerLastMeta.diagnostics:", fd);
      if (fd.rangeFetch) {
        console.log("rangeFetch:", fd.rangeFetch);
        if (fd.rangeFetch.patch) {
          console.log("rangeFetch.patch (diagnostics):", fd.rangeFetch.patch);
        }
      }
    } else {
      console.log("未在全域找到 fetchDiagnostics / workerLastMeta，若 UI 有提供請在 UI 中貼出該物件內容。");
    }
  } catch (e) {
    console.warn("讀取 fetchDiagnostics 失敗:", e);
  }

  // 最後總結
  console.log("DIAGNOSTICS SUMMARY:", {
    inputs: { stockNo, startDate, endDate, monthKey },
    blobPresent: !!collect.blob,
    blob_aa_len: collect.blob && Array.isArray(collect.blob.aaData) ? collect.blob.aaData.length : null,
    proxyPresent: !!collect.proxy,
    proxy_aa_len: collect.proxy && Array.isArray(collect.proxy.aaData) ? collect.proxy.aaData.length : null,
    globalsScanned: Object.keys(collect).filter(k => k !== "blob" && k !== "proxy"),
    workerLastMeta: window.workerLastMeta || null,
  });

  console.log("請把上面重要段落（rangeFetch.patch.attempts / blob payload / proxy payload / workerLastMeta）貼回給我，我會協助分析下一步。");
  // 嘗試把 collect 保存到剪貼簿（更健壯的 fallback 流程），並設成全域變數，方便貼回給我們
  try {
    const txt = JSON.stringify(collect, null, 2);
    let copied = false;

    // 1) 優先：若文件有焦點且支援 clipboard API，嘗試寫入
    if (document.hasFocus() && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(txt);
        console.log('已複製診斷資料到剪貼簿（navigator.clipboard.writeText）。');
        copied = true;
      } catch (e) {
        console.warn('clipboard.writeText 失敗：', e);
      }
    }

    // 2) 備援：使用隱藏 textarea 並用 execCommand('copy') 嘗試複製（部分瀏覽器可用）
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          console.log('已使用備援方式複製到剪貼簿（execCommand）。');
          copied = true;
        } else {
          console.warn('execCommand(copy) 回傳 false。');
        }
      } catch (e) {
        console.warn('execCommand copy 失敗：', e);
      }
    }

    // 3) 若仍未複製，寫入 localStorage 並嘗試在新分頁顯示內容供手動複製
    if (!copied) {
      try {
        localStorage.setItem('diagnose_collect', txt);
        console.log('已儲存診斷資料到 localStorage key `diagnose_collect`。');
      } catch (e) {
        console.warn('寫入 localStorage 失敗：', e);
      }

      try {
        const w = window.open('', '_blank');
        if (w) {
          const safe = txt.slice(0, 100000).replace(/</g, '&lt;');
          w.document.write('<!doctype html><meta charset="utf-8"><title>診斷資料（請手動複製）</title><pre style="white-space:pre-wrap;word-wrap:break-word;">' + safe + '</pre>');
          w.document.close();
          console.log('已在新分頁打開診斷資料（若彈窗被攔截請允許或查看 localStorage key `diagnose_collect`）。');
        } else {
          console.warn('無法開啟新分頁（可能被彈窗攔截），請檢查 localStorage key `diagnose_collect`。');
        }
      } catch (e) {
        console.warn('開新分頁顯示診斷資料失敗：', e);
      }
    }
  } catch (e) {
    console.warn('複製/儲存診斷資料失敗：', e);
  }

  // 若有缺值，印出更明確的提示，避免只看到 Console evaluation 的 `undefined`
  if (!collect.blob) console.warn('注意：collect.blob 為 null/undefined（Blob API 可能回傳錯誤或無資料）');
  if (!collect.proxy) console.warn('注意：collect.proxy 為 null/undefined（Proxy API 可能回傳錯誤或無資料）');

  // 設到全域供手動檢視 / 複製
  try { window.__diagnose_collect = collect; console.log('window.__diagnose_collect 已設置，可於 Console 使用此變數檢視完整物件。'); } catch (e) { /* ignore */ }

})();
```

---

**快速純文字輸出版（可直接在 Console 執行並複製輸出）**

此版本只會印出一行前綴為 `DIAG_COPY:` 的 JSON 字串（單行），方便直接在 Console 中選取或使用 `copy(...)` 複製。

```js
// 執行後會在 Console 輸出一行文字：DIAG_COPY:{...}
void (async function () {
  const stockNo = prompt('Stock 編號 (例如 2330):', '2330');
  const defaultStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const startDate = prompt('Start date (YYYY-MM-DD):', defaultStart);
  const endDate = prompt('End date (YYYY-MM-DD):', defaultEnd);

  function monthKeyFromIso(iso) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}${m}01`;
  }
  const monthKey = monthKeyFromIso(endDate);

  try {
    const blobUrl = `/.netlify/functions/stock-range?stockNo=${encodeURIComponent(stockNo)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const r = await fetch(blobUrl, { headers: { Accept: 'application/json' } });
    const blob = await r.json().catch(() => null);

    const proxyUrl = `/api/twse/?stockNo=${encodeURIComponent(stockNo)}&month=${monthKey}&start=${encodeURIComponent(endDate)}&end=${encodeURIComponent(endDate)}`;
    const r2 = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
    const proxy = await r2.json().catch(() => null);

    const fd = window.fetchDiagnostics || (window.workerLastMeta && window.workerLastMeta.diagnostics) || null;

    const blob_last = (blob && Array.isArray(blob.aaData)) ? blob.aaData.slice(-5) : null;
    const proxy_last = (proxy && Array.isArray(proxy.aaData)) ? proxy.aaData.slice(-5) : (proxy && Array.isArray(proxy.data) ? proxy.data.slice(-5) : null);

    const out = {
      inputs: { stockNo, startDate, endDate, monthKey },
      blobPresent: !!blob,
      blob_iTotalRecords: blob && blob.iTotalRecords != null ? blob.iTotalRecords : null,
      blob_last,
      proxyPresent: !!proxy,
      proxy_iTotalRecords: proxy && proxy.iTotalRecords != null ? proxy.iTotalRecords : null,
      proxy_last,
      fetchDiagnostics: fd && fd.rangeFetch ? fd.rangeFetch : fd || null
    };

    // 單行 JSON，前綴 DIAG_COPY:，方便複製
    const single = JSON.stringify(out);
    // 更顯眼且易複製的輸出：標記開始/結束、再輸出純 JSON，並存到全域變數
    console.log('--- DIAG_COPY START ---');
    console.log('DIAG_COPY:' + single);
    console.log(single);
    console.log('--- DIAG_COPY END ---');
    try { window.__diag_copy_single = single; } catch (e) { /* ignore */ }
  } catch (e) {
    console.error('診斷失敗：', e);
  }
})();
```

---

如果你要我把這個檔案放到不同路徑或增加其他檢查（例如直接呼叫 `/api/tpex/` 或紀錄到 localStorage），告訴我你想要的變更。