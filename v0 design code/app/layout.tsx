import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "懶人回測 LazyBacktest - 專為台灣上班族設計的股票回測系統",
  description: "告別盯盤焦慮，下班後再從容佈局。免安裝、全中文、永久免費的股票回測平台，讓您用歷史數據驗證交易策略。",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const shouldIncludeAnalytics = process.env.VERCEL === "1"

  return (
    <html lang="zh-TW">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        {shouldIncludeAnalytics && <Analytics />}
      </body>
    </html>
  )
}
