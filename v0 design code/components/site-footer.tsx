// Patch Tag: LB-FOOTER-PAGES-20250409A
import Link from "next/link"
import { cn } from "@/lib/utils"

const DONATION_LINKS = [
  {
    label: "歐付寶",
    href: "https://payment.opay.tw/Broadcaster/Donate/C0EB7741A027F28BA11ED9BDBEAD263A",
  },
  {
    label: "綠界",
    href: "https://p.ecpay.com.tw/8AB5D6F",
  },
  {
    label: "PayPal",
    href: "https://www.paypal.com/ncp/payment/79RNTHL69MAPE",
  },
]

const SUPPORT_LINKS = [
  { label: "使用教學", href: "/tutorial" },
  { label: "常見問題", href: "/faq" },
  { label: "寄信給我", href: "/contact" },
  { label: "社群討論", href: "/community" },
]

const INFO_LINKS = [
  { label: "隱私政策", href: "/privacy" },
  { label: "免責聲明", href: "/disclaimer" },
]

const EXTRA_LINKS = [
  { label: "股票紀錄", href: "/stock-records" },
  { label: "股票回測", href: "/backtest" },
]

interface SiteFooterProps {
  variant?: "dark" | "light"
}

export function SiteFooter({ variant = "light" }: SiteFooterProps) {
  const isDark = variant === "dark"

  const footerClassName = cn(
    "py-12",
    isDark ? "bg-foreground text-background" : "bg-muted/30 border-t"
  )

  const linkClassName = cn(
    "text-sm transition-colors",
    isDark ? "text-background/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-primary"
  )

  const paragraphClassName = cn(
    "text-sm",
    isDark ? "text-background/80" : "text-muted-foreground"
  )

  const headingClassName = cn(
    "font-semibold mb-4",
    isDark ? "text-background" : "text-foreground"
  )

  const brandTextClassName = cn(
    "text-lg font-bold",
    isDark ? "text-background" : "text-foreground"
  )

  const brandSubTextClassName = cn(
    "text-xs",
    isDark ? "text-background/70" : "text-muted-foreground"
  )

  const borderClassName = isDark ? "border-muted/20" : "border-border"
  const bottomTextClassName = cn(
    "text-sm",
    isDark ? "text-background/70" : "text-muted-foreground"
  )
  const bottomCopyClassName = cn(
    "text-xs mt-2",
    isDark ? "text-background/60" : "text-muted-foreground/80"
  )

  return (
    <footer className={footerClassName}>
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shadow-sm",
                  isDark ? "bg-background" : "bg-primary/10"
                )}
                aria-hidden
              >
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="28" height="20" rx="4" fill="#0EA5A4" />
                </svg>
              </div>
              <div>
                <span className={brandTextClassName}>LazyBacktest</span>
                <div className={brandSubTextClassName}>懶人股票回測</div>
              </div>
            </div>
            <p className={paragraphClassName}>
              先恭喜您，投資賺錢！如果這個網站幫助您投資順利，或者單純想支持韭菜胖叔叔，歡迎斗內讓我們持續優化體驗。
            </p>
          </div>

          <div>
            <h4 className={headingClassName}>Donate (斗內/贊助)</h4>
            <ul className="space-y-2">
              {DONATION_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener" className={linkClassName}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={headingClassName}>支援與幫助</h4>
            <ul className="space-y-2">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={headingClassName}>更多功能</h4>
            <ul className="space-y-2">
              {EXTRA_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={headingClassName}>其他說明</h4>
            <ul className="space-y-2">
              {INFO_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={cn("border-t mt-8 pt-8 text-center", borderClassName)}>
          <p className={bottomTextClassName}>
            鄉民內部測試版: 建議事項與 Bug，請寄信至
            {" "}
            <a href="mailto:smallwei0301@gmail.com" className={cn(linkClassName, "inline-block")}>smallwei0301@gmail.com</a>
          </p>
          <p className={bottomCopyClassName}>© 2025 LazyBacktest. 僅供教育與研究用途，不構成投資建議。</p>
        </div>
      </div>
    </footer>
  )
}
