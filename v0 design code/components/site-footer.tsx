// Component Version: LB-FE-20250304A
import Link from "next/link"
import { cn } from "@/lib/utils"

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

const learningLinks = [
  { label: "了解 LazyBacktest", href: "/" },
  { label: "回到首頁", href: "/#top" },
  { label: "開始回測", href: "/app/index.html" },
]

type SiteFooterProps = {
  theme?: "dark" | "light"
  showDonate?: boolean
  className?: string
}

export function SiteFooter({ theme = "light", showDonate = true, className }: SiteFooterProps) {
  const isDark = theme === "dark"
  const backgroundClass = isDark ? "bg-foreground text-background" : "bg-muted/30 border-t"
  const textMutedClass = isDark ? "text-background/80" : "text-muted-foreground"
  const headingClass = isDark ? "text-background" : "text-foreground"
  const borderClass = isDark ? "border-muted/20" : "border-border"

  return (
    <footer className={cn(backgroundClass, className)}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm",
                  isDark ? "bg-background" : "bg-primary"
                )}
              >
                <svg
                  width="28"
                  height="20"
                  viewBox="0 0 28 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <rect
                    width="28"
                    height="20"
                    rx="4"
                    className={cn(isDark ? "fill-[#0EA5A4]" : "fill-white/90")}
                  />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold">LazyBacktest</span>
                <div className={cn("text-xs", textMutedClass)}>懶人股票回測</div>
              </div>
            </div>
            <p className={cn("text-sm leading-relaxed", textMutedClass)}>
              專為台灣用戶打造的雲端回測服務，讓每天忙碌的你也能以數據驗證策略。
              如果覺得內容實用，別忘了分享給身邊同樣想穩定投資的朋友。
            </p>
            <p className={cn("text-sm", textMutedClass)}>
              需要協助嗎？寫信給我們的<a
                href="mailto:smallwei0301@gmail.com"
                className={cn(
                  "ml-1 underline transition-colors",
                  isDark ? "hover:text-accent" : "hover:text-primary"
                )}
              >客服信箱</a>
              ，或到<Link
                href="/community"
                className={cn(
                  "ml-1 underline transition-colors",
                  isDark ? "hover:text-accent" : "hover:text-primary"
                )}
              >社群討論區</Link>
              與其他投資人交流。
            </p>
          </div>

          {showDonate && (
            <div>
              <h4 className={cn("font-semibold mb-4", headingClass)}>Donate (斗內/贊助)</h4>
              <ul className={cn("space-y-2 text-sm", textMutedClass)}>
                <li>
                  <a
                    href="https://payment.opay.tw/Broadcaster/Donate/C0EB7741A027F28BA11ED9BDBEAD263A"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-primary"
                  >
                    歐付寶
                  </a>
                </li>
                <li>
                  <a
                    href="https://p.ecpay.com.tw/8AB5D6F"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-primary"
                  >
                    綠界
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.paypal.com/ncp/payment/79RNTHL69MAPE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-primary"
                  >
                    PayPal
                  </a>
                </li>
              </ul>
            </div>
          )}

          <div>
            <h4 className={cn("font-semibold mb-4", headingClass)}>支援與幫助</h4>
            <ul className={cn("space-y-2 text-sm", textMutedClass)}>
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={cn("font-semibold mb-4", headingClass)}>更多功能</h4>
            <ul className={cn("space-y-2 text-sm", textMutedClass)}>
              {moreFeatureLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={cn("font-semibold mb-4", headingClass)}>其他說明</h4>
            <ul className={cn("space-y-2 text-sm", textMutedClass)}>
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
              {learningLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={cn("mt-8 border-t pt-8 text-center text-sm", borderClass, textMutedClass)}>
          <p>
            鄉民內部測試版：建議事項與 Bug，請寄信至
            <a
              href="mailto:smallwei0301@gmail.com"
              className={cn(
                "ml-1 underline transition-colors",
                isDark ? "hover:text-accent" : "hover:text-primary"
              )}
            >smallwei0301@gmail.com</a>
          </p>
          <p className="mt-2 text-xs">
            © {new Date().getFullYear()} LazyBacktest. 僅供教育與研究用途，不構成投資建議。
          </p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
