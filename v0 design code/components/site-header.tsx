'use client'
// Version: LB-FOOTER-NAV-20250819A
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "首頁" },
  { href: "/stocks", label: "個股策略庫" },
  { href: "/guide", label: "使用教學" },
  { href: "/faq", label: "常見問題" },
  { href: "/community", label: "社群討論" },
  { href: "/contact", label: "寄信給我" },
  { href: "/stock-records", label: "股票紀錄" },
]

interface SiteHeaderProps {
  activePath?: string
  backLink?: { href: string; label?: string }
}

export function SiteHeader({ activePath = "", backLink }: SiteHeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {backLink ? (
            <Link
              href={backLink.href}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{backLink.label ?? "返回"}</span>
            </Link>
          ) : null}

          <Link href="/" className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Image
                src="/logo/logo-white.png"
                alt="LazyBacktest Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
            </div>
            <div>
              <span className="text-lg font-semibold text-foreground">LazyBacktest</span>
              <p className="text-xs text-muted-foreground">懶人股票回測</p>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                activePath === item.href && "text-primary"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="outline" asChild>
            <a href="/app/index.html" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              立即開始回測
            </a>
          </Button>
        </div>

        <details className="md:hidden">
          <summary className="flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-foreground">
            <Menu className="h-5 w-5" />
            <span className="ml-2">選單</span>
          </summary>
          <div className="absolute left-0 right-0 mt-2 border border-border bg-background shadow-lg">
            <div className="flex flex-col divide-y divide-border">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activePath === item.href && "text-primary"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href="/app/index.html"
                className="px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted hover:text-primary"
              >
                立即開始回測
              </a>
            </div>
          </div>
        </details>
      </div>
    </header>
  )
}
