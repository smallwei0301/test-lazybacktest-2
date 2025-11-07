import Link from "next/link"
import type { HTMLAttributes } from "react"
import clsx from "clsx"

export const FOOTER_BUILD_ID = "LB-FOOTER-PAGES-20240519A"

const donationLinks = [
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

const supportLinks = [
  { label: "使用教學", href: "/usage-guide" },
  { label: "常見問題", href: "/faq" },
  { label: "寄信給我", href: "/app/contact.html" },
  { label: "社群討論", href: "/community" },
]

const toolLinks = [
  { label: "股票回測", href: "/app/index.html" },
  { label: "股票紀錄", href: "/stock-records" },
  { label: "批量優化教學", href: "/usage-guide#batch-optimization" },
]

const policyLinks = [
  { label: "隱私政策", href: "/privacy" },
  { label: "免責聲明", href: "/disclaimer" },
  { label: "資料安全承諾", href: "/privacy#data-security" },
]

const toneStyles = {
  dark: "bg-foreground text-background",
  muted: "bg-muted/30 border-t border-border text-foreground",
  light: "bg-background border-t border-border text-foreground",
}

type SiteFooterProps = HTMLAttributes<HTMLElement> & {
  tone?: keyof typeof toneStyles
}

export function SiteFooter({ tone = "dark", className, ...props }: SiteFooterProps) {
  const footerClassName = clsx("py-12", toneStyles[tone], className)

  const dividerClassName = tone === "dark" ? "border-white/20" : "border-border"

  return (
    <footer data-build-id={FOOTER_BUILD_ID} className={footerClassName} {...props}>
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <rect width="28" height="20" rx="4" fill="#0EA5A4" />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold">LazyBacktest</span>
                <div className="text-xs opacity-80">懶人股票回測</div>
              </div>
            </div>
            <p className="text-sm opacity-80">
              先恭喜您，投資賺錢！<br />如果這個網站幫助您投資順利，或者單純想支持一下韭菜胖叔叔，歡迎斗內讓我可以上車繼續更新。
              <br />用奶粉發電，不再用愛發電。
            </p>
            <p className="mt-4 text-xs opacity-70">
              LazyBacktest 專注於提供教育性投資工具，所有內容符合 Google Ads 友善內容政策，不含任何違規或煽動性語句。
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Donate (斗內/贊助)</h4>
            <ul className="space-y-2 text-sm opacity-80">
              {donationLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener" className="transition-colors hover:text-primary">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">支援與工具</h4>
            <ul className="space-y-2 text-sm opacity-80">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2 text-xs font-medium uppercase tracking-wide opacity-60">快速入口</li>
              {toolLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">政策與聯絡</h4>
            <ul className="space-y-2 text-sm opacity-80">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="mailto:smallwei0301@gmail.com" className="transition-colors hover:text-primary">
                  smallwei0301@gmail.com
                </a>
              </li>
              <li className="text-xs leading-relaxed opacity-70">
                服務時間：週一至週五 10:00-18:00 (GMT+8)<br />所在地：台灣 台北市
              </li>
            </ul>
          </div>
        </div>

        <div className={clsx("mt-8 border-t pt-8 text-center text-sm opacity-80", dividerClassName)}>
          <p>
            鄉民內部測試版: 建議事項與 Bug，請聯絡信箱：
            <a href="mailto:smallwei0301@gmail.com" className="underline-offset-2 transition-colors hover:text-primary">
              smallwei0301@gmail.com
            </a>
          </p>
          <p className="mt-2 text-xs opacity-70">
            © {new Date().getFullYear()} LazyBacktest. 僅供教育與研究用途，不構成投資建議。投資有風險，請謹慎評估。
          </p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
