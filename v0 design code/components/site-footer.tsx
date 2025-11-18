'use client'
// Version: LB-FOOTER-NAV-20250819A
import Link from "next/link"
import Image from "next/image"

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
    <footer className="py-12 mt-16" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
      <div className="container mx-auto px-4">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                <Image
                  src="/logo/logo.png"
                  alt="LazyBacktest Logo"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color: '#0f172a' }}>LazyBacktest</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>懶人股票回測工具</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
              先恭喜您，投資賺錢！如果這個網站幫助您投資順利，或者想支持韭菜胖叔叔，歡迎斗內讓我們持續優化
              LazyBacktest。用奶粉發電，不再用愛發電。
            </p>
            <div>
              <h4 className="text-sm font-semibold tracking-wide uppercase" style={{ color: '#374151' }}>Donate (斗內 / 贊助) 連結</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href="https://portaly.cc/lazybacktest/support"
                    target="_blank"
                    rel="noopener"
                    className="transition-colors"
                    style={{ color: '#6b7280' }}
                  >
                    支持我們
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="text-base font-semibold mb-4" style={{ color: '#374151' }}>支援與幫助</h4>
            <ul className="space-y-2 text-sm">
              {supportLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors" style={{ color: '#6b7280' }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-base font-semibold mb-4" style={{ color: '#374151' }}>更多功能</h4>
            <ul className="space-y-2 text-sm">
              {moreLinks.map((item) => (
                <li key={item.href}>
                  {item.internal ? (
                    <Link href={item.href} className="transition-colors" style={{ color: '#6b7280' }}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className="transition-colors" style={{ color: '#6b7280' }}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-base font-semibold mb-4" style={{ color: '#374151' }}>政策與聲明</h4>
            <ul className="space-y-2 text-sm">
              {policyLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors" style={{ color: '#6b7280' }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm" style={{ borderColor: 'rgba(0,0,0,0.06)', color: '#6b7280' }}>
          <p style={{ color: '#6b7280' }}>
            建議事項與 Bug，請聯絡：
            <a href="mailto:smallwei0301@gmail.com" className="underline" style={{ color: '#374151' }}>
              smallwei0301@gmail.com
            </a>
          </p>
          <p className="mt-2 text-xs" style={{ color: '#9ca3af' }}>
            © {new Date().getFullYear()} LazyBacktest. 僅供教育與研究用途，不構成投資建議。
          </p>
        </div>
      </div>
    </footer>
  )
}
