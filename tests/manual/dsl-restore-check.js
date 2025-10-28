#!/usr/bin/env node
// Manual Verification Script - LB-STRATEGY-UI-20260926B
// This helper describes how to verify DSL persistence across reloads.

const steps = [
  '開啟 LazyBacktest 頁面，確認策略表單已載入。',
  '調整做多/做空策略與參數，於 DSL 編輯區新增至少一個額外規則並勾選 NOT 或切換 AND/OR。',
  '點擊右上角的「儲存目前」按鈕，或確保策略已手動儲存。',
  '在開發者區域的手動驗證工具中，按下「DSL 還原檢查」。',
  '重新整理頁面後，再次展開策略表單，確認設定自動還原且 DSL 結構與按鈕狀態一致。',
  '若檢查結果為警告或失敗，請打開 console 取得詳細訊息並檢查 localStorage 中的 `lazybacktest.strategy-form.v20260926A`。',
];

console.log('\n[Manual Check] DSL 還原驗證流程 (LB-STRATEGY-UI-20260926B)\n');
steps.forEach((step, index) => {
  console.log(`${index + 1}. ${step}`);
});
console.log('\n執行完成後，請記錄結果並於 PR 說明是否驗證成功。');
