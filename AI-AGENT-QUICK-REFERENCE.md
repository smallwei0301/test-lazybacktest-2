# 🤖 AI Agent 快速參考卡

**使用方式**: 每次開始工作前先讀取本文件

---

## ⚡ 30 秒快速檢查

在開始任何工作前，問自己：

```
我要生成什麼類型的檔案？
    ↓
[對照下表找到對應位置]
    ↓
在該位置創建檔案
    ↓
完成後運行 git status 確認
```

---

## 📂 一行對應規則

```
檔案類型              應放在                            被 Git 追蹤
─────────────────────────────────────────────────────────────────
.tsx 頁面/組件        v0 design code/app/              ✅ 是
.ts 類型定義          v0 design code/types/            ✅ 是
.ts 工具函數          v0 design code/lib/              ✅ 是
.md 部署文檔          ./（根目錄）                     ✅ 是
.md 項目說明          archived/docs/                   ❌ 否
.html/.css/.js 舊文件 archived/backups/ 或 js/css/   ❌ 否
.jpg/.png 圖片        archived/assets/                 ❌ 否
.log 日誌             archived/logs/                   ❌ 否
API 函數              v0 design code/netlify/functions/ ✅ 是
```

---

## 🚫 禁止行為速查

```
❌ 根目錄 .md（除了 README、NETLIFY、PROJECT-RULES）
❌ 根目錄臨時檔案
❌ 修改根目錄 netlify.toml
❌ 創建未定義的新目錄
❌ 在 archived/ 以外存放備份
```

---

## ✅ 完成檢查清單

```
完成後運行：
  [ ] git status（檢查檔案位置是否正確）
  [ ] git diff --name-only（確認改動範圍）
  [ ] npm run build（在 v0 design code/ 中，確認編譯）
```

---

## 📍 三大關鍵區域

### 1. 根目錄（只有 6 個允許的 .md）
- README.md ✅
- NETLIFY-DEPLOYMENT.md ✅
- PROJECT-RULES.md ✅
- 其他都要移出 ❌

### 2. v0 design code/（新功能都這裡）
- app/ → 頁面和組件
- lib/ → 工具函數
- types/ → TypeScript 定義
- netlify/functions/ → API

### 3. archived/（舊版本和文檔）
- docs/ → 文檔
- backups/ → 舊文件
- assets/ → 圖片
- logs/ → 日誌

---

## 🎯 常見情景速查

**情景**: 我要添加一個新的 Next.js 頁面
```
位置: v0 design code/app/[page-name]/page.tsx
類型: 代碼文件
被追蹤: ✅ 是
動作: npm run build 確認編譯 → git add → git commit
```

**情景**: 我要寫一個部署指南
```
位置: ./FILENAME.md（或 archived/docs/FILENAME.md）
類型: 文檔文件
被追蹤: ✅ 是（如果在根目錄）❌ 否（如果在 archived）
動作: git add → git commit
```

**情景**: 我要保存一個舊版本
```
位置: archived/backups/
類型: 備份文件
被追蹤: ❌ 否
動作: 移動檔案 → git add（記錄移動）→ git commit
```

**情景**: 我要添加一個 API 函數
```
位置: v0 design code/netlify/functions/
類型: 代碼文件
被追蹤: ✅ 是
動作: npm run build → git add → git commit
```

---

## 📞 一句話答案

- Q: 新增功能要放哪？ → A: v0 design code/
- Q: 文檔要放哪？ → A: 部署相關放根目錄，其他放 archived/docs/
- Q: 舊文件要放哪？ → A: archived/backups/
- Q: 圖片要放哪？ → A: archived/assets/
- Q: 日誌要放哪？ → A: archived/logs/
- Q: 根目錄能放什麼？ → A: 只有 6 個 .md 和配置文件

---

**使用此卡確保每次操作都遵循規則**
**如有疑問，查看完整的 PROJECT-RULES.md**
