// Patch Tag: LB-WEB-20250210A
import Link from "next/link"
import type { ReactNode } from "react"

interface SiteFooterProps {
  variant?: "light" | "dark"
  intro?: ReactNode
  donationLinks?: { label: string; href: string }[]
  donationTitle?: string
  bottomLines?: ReactNode[]
}

const productFeatures = ["股票回測", "策略優化", "風險評估", "績效分析"]
const supportLinks = [
  { label: "使用教學", href: "/tutorial" },
  { label: "常見問題", href: "/faq" },
  { label: "寄信給我", href: "/contact" },
  { label: "社群討論", href: "/community" },
]
const moreFeatureLinks = [
  { label: "股票紀錄", href: "/stock-records" },
  { label: "股票回測", href: "/backtest" },
]
const policyLinks = [
  { label: "隱私政策", href: "/privacy" },
  { label: "免責聲明", href: "/disclaimer" },
]

export function SiteFooter({
  variant = "light",
  intro = (
    <p className="text-sm text-muted-foreground">
      專為忙碌上班族設計的股票回測平台，讓您在下班後也能做出明智的投資決策。
    </p>
  ),
  donationLinks,
  donationTitle = "Donate (斗內/贊助)",
  bottomLines,
}: SiteFooterProps) {
  const isDark = variant === "dark"
  const textMutedClass = isDark ? "text-background/80" : "text-muted-foreground"
  const headingClass = isDark ? "text-background" : "text-foreground"
  const linkHoverClass = isDark ? "hover:text-accent" : "hover:text-primary"
  const backgroundClass = isDark ? "bg-foreground text-background" : "bg-muted/30 border-t"
  const borderClass = isDark ? "border-background/20" : "border-border"
  const paragraphClass = isDark ? "text-background/80" : "text-muted-foreground"

  const finalBottomLines =
    bottomLines ?? [
      <p key="copyright" className={`text-sm ${paragraphClass}`}>
        © 2025 LazyBacktest. 僅供教育與研究用途，不構成投資建議。
      </p>,
    ]

  return (
    <footer className={`${backgroundClass}`}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div
                className={`rounded-lg flex items-center justify-center ${
                  isDark ? "bg-background" : "bg-primary"
                } w-10 h-10`}
              >
                <div className="flex items-center gap-0.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isDark ? "bg-foreground" : "bg-primary-foreground"
                    }`}
                  ></div>
                  <div className="flex flex-col gap-0.5">
                    <div
                      className={`w-1 h-3 rounded-sm ${isDark ? "bg-foreground" : "bg-primary-foreground"}`}
                    ></div>
                    <div
                      className={`w-1 h-2 rounded-sm ${isDark ? "bg-foreground" : "bg-primary-foreground"}`}
                    ></div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div
                      className={`w-1 h-4 rounded-sm ${isDark ? "bg-foreground" : "bg-primary-foreground"}`}
                    ></div>
                    <div
                      className={`w-1 h-1.5 rounded-sm ${isDark ? "bg-foreground" : "bg-primary-foreground"}`}
                    ></div>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-lg font-bold">LazyBacktest</span>
                <div className={`text-xs ${textMutedClass}`}>懶人股票回測</div>
              </div>
            </div>
            <div className={isDark ? "text-background/80 text-sm space-y-2" : "text-muted-foreground text-sm space-y-2"}>
              {intro}
            </div>
          </div>

          {donationLinks && donationLinks.length > 0 && (
            <div>
              <h4 className={`font-semibold mb-4 ${headingClass}`}>{donationTitle}</h4>
              <ul className={`space-y-2 text-sm ${textMutedClass}`}>
                {donationLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener"
                      className={`transition-colors ${linkHoverClass}`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className={`font-semibold mb-4 ${headingClass}`}>產品功能</h4>
            <ul className={`space-y-2 text-sm ${textMutedClass}`}>
              {productFeatures.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={`font-semibold mb-4 ${headingClass}`}>支援與幫助</h4>
            <ul className={`space-y-2 text-sm ${textMutedClass}`}>
              {supportLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`transition-colors ${linkHoverClass}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={`font-semibold mb-4 ${headingClass}`}>更多功能</h4>
            <ul className={`space-y-2 text-sm ${textMutedClass}`}>
              {moreFeatureLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`transition-colors ${linkHoverClass}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={`font-semibold mb-4 ${headingClass}`}>政策與條款</h4>
            <ul className={`space-y-2 text-sm ${textMutedClass}`}>
              {policyLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={`transition-colors ${linkHoverClass}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`mt-10 pt-8 text-center border-t ${borderClass}`}>
          <div className={`space-y-2 ${paragraphClass}`}>
            {finalBottomLines.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
