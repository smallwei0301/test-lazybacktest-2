;(() => {
  // 等待DOM載入完成
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBacktest)
  } else {
    initBacktest()
  }

  async function initBacktest() {
    try {
      // 動態載入模組
      const [{ initializeBacktestApp }, { strategyConfigs }] = await Promise.all([
        import("./lib/main-logic.js"),
        import("./lib/strategy-config.js"),
      ])

      // 初始化應用
      initializeBacktestApp()

      console.log("[v0] Backtest application initialized successfully")
    } catch (error) {
      console.error("[v0] Failed to initialize backtest application:", error)
    }
  }
})()
