'use client'
// Version: LB-FOOTER-NAV-20250819A
import Link from "next/link"

const supportLinks = [
  { href: "/guide", label: "使用教學" },
  { href: "/faq", label: "常見問題" },
  { href: "/contact", label: "寄信給我" },
  { href: "/community", label: "社群討論" },
]

const policyLinks = [
  { href: "/privacy", label: "隱私政策" },
  { href: "/disclaimer", label: "免責聲明" },
]

const moreLinks = [
  { href: "/stock-records", label: "股票紀錄", internal: true },
  { href: "/app/index.html", label: "股票回測", internal: false },
]

export function SiteFooter() {
  return (
    <footer className="bg-slate-950 text-slate-100 py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100/10 flex items-center justify-center shadow-sm">
                <svg
                  width="28"
                  height="20"
                  viewBox="0 0 28 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <rect width="28" height="20" rx="4" fill="#0EA5A4" />
                  <path d="M6 14L10 9L13 12L16 7L22 14" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold">LazyBacktest</p>
                <p className="text-xs text-slate-300/80">懶人股票回測工具</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-300/90">
              先恭喜您，投資賺錢！如果這個網站幫助您投資順利，或者想支持韭菜胖叔叔，歡迎斗內讓我們持續優化
              LazyBacktest。用奶粉發電，不再用愛發電。
            </p>
            <div>
              <h4 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">Donate (斗內 / 贊助)</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-300/90">
                <li>
                  <a
                    href="https://payment.opay.tw/Broadcaster/Donate/C0EB7741A027F28BA11ED9BDBEAD263A"
                    target="_blank"
                    rel="noopener"
                    className="hover:text-primary transition-colors"
                  >
                    歐付寶
                  </a>
                </li>
                <li>
                  <a
                    href="https://p.ecpay.com.tw/8AB5D6F"
                    target="_blank"
                    rel="noopener"
                    className="hover:text-primary transition-colors"
                  >
                    綠界
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.paypal.com/ncp/payment/79RNTHL69MAPE"
                    target="_blank"
                    rel="noopener"
                    className="hover:text-primary transition-colors"
                  >
                    PayPal
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="text-base font-semibold text-slate-100 mb-4">支援與幫助</h4>
            <ul className="space-y-2 text-sm text-slate-300/90">
              {supportLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-base font-semibold text-slate-100 mb-4">更多功能</h4>
            <ul className="space-y-2 text-sm text-slate-300/90">
              {moreLinks.map((item) => (
                <li key={item.href}>
                  {item.internal ? (
                    <Link href={item.href} className="hover:text-primary transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className="hover:text-primary transition-colors">
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400/80">
              「股票回測」會直接帶您進入目前使用中的快速回測頁面，與首頁按下「立即開始回測」相同。
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-slate-100 mb-4">政策與聲明</h4>
            <ul className="space-y-2 text-sm text-slate-300/90">
              {policyLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-6 text-center text-sm text-slate-400">
          <p>
            建議事項與 Bug，請聯絡：
            <a href="mailto:smallwei0301@gmail.com" className="underline hover:text-primary transition-colors">
              smallwei0301@gmail.com
            </a>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            © {new Date().getFullYear()} LazyBacktest. 僅供教育與研究用途，不構成投資建議。
          </p>
        </div>
      </div>
    </footer>
  )
}
