import type { Metadata } from "next"
import FaqClient from "@/components/faq-client"

export const metadata: Metadata = {
  title: "LazyBacktest 常見問題｜操作、資料與支援",
  description: "整理 懶人回測Lazybacktest 使用時最常被問到的 9 個問題，包含費用、資料來源、匯出方式、股票紀錄與社群留言板說明。",
}

export default function FaqPage() {
  return <FaqClient />
}
