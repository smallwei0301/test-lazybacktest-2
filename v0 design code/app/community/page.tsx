import type { Metadata } from "next"
import SiteFooter, { FOOTER_BUILD_ID } from "@/components/site-footer"
import { CommunityBoard } from "./community-board"

const PAGE_URL = "https://lazybacktest.com/community"

export const metadata: Metadata = {
  title: "LazyBacktest 社群討論｜策略分享、問題回報、功能建議",
  description:
    "加入 LazyBacktest 社群討論：分享策略成果、回報使用問題、提出功能建議。留言會保存在瀏覽器中，符合 Google Ads 社群內容政策。",
  keywords: [
    "LazyBacktest 社群",
    "LazyBacktest 討論區",
    "LazyBacktest 策略分享",
    "LazyBacktest 問題回報",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    url: PAGE_URL,
    title: "LazyBacktest 社群討論",
    description: "和 6,000 位使用者一起交流回測心得、回報問題與提交建議。",
    locale: "zh_TW",
    siteName: "LazyBacktest",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "LazyBacktest 社群討論",
    description: "分享你的回測成果，或是提出建議與問題。",
  },
  other: {
    "geo.region": "TW",
    "geo.placename": "Taipei",
    "geo.position": "25.0330;121.5654",
    ICBM: "25.0330, 121.5654",
    "lazybacktest:build": FOOTER_BUILD_ID,
  },
}

const communityJsonLd = {
  "@context": "https://schema.org",
  "@type": "DiscussionForumPosting",
  url: PAGE_URL,
  headline: "LazyBacktest 社群討論",
  description:
    "LazyBacktest 使用者分享策略與問題的互助論壇，留言會保存在使用者瀏覽器中，適用於教育討論與回饋。",
  inLanguage: "zh-TW",
  publisher: {
    "@type": "Organization",
    name: "LazyBacktest",
    url: "https://lazybacktest.com",
  },
}

export default function CommunityPage() {
  return (
    <div className="bg-background text-foreground">
      <CommunityBoard />
      <SiteFooter tone="light" />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(communityJsonLd) }}
      />
    </div>
  )
}
