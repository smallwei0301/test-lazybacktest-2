import { getStore } from '@netlify/blobs';

export default async (req, context) => {
    // 要清除的 Blob Store 列表
    const storeNames = ['tpex_cache_store_v2', 'twse_cache_store_v2'];
    const results = {};

    console.log("開始執行 Blob 快取清除作業...");

    for (const storeName of storeNames) {
        try {
            const store = getStore(storeName);
            const { blobs } = await store.list();

            if (blobs.length === 0) {
                console.log(`Store '${storeName}' 中沒有需要清除的快取。`);
                results[storeName] = { status: 'success', deletedCount: 0, message: 'No keys to delete.' };
                continue;
            }

            console.log(`在 '${storeName}' 中找到 ${blobs.length} 個快取，準備刪除...`);

            const deletePromises = blobs.map(blob => store.delete(blob.key));
            await Promise.all(deletePromises);

            console.log(`成功刪除 '${storeName}' 中的 ${blobs.length} 個快取。`);
            results[storeName] = { status: 'success', deletedCount: blobs.length };

        } catch (error) {
            console.error(`清除 Store '${storeName}' 時發生錯誤:`, error);
            results[storeName] = { status: 'error', message: error.message };
        }
    }

    console.log("Blob 快取清除作業完成。");
    return new Response(JSON.stringify({
        message: "Blob cache clearing process completed.",
        results: results
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
};