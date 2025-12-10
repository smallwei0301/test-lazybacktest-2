"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { RefreshCw, Home, AlertTriangle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 記錄錯誤到後台以便除錯
    console.error("[Lazybacktest Error]", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader activePath="" />
      
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto">
            <Card className="text-center border-2 border-destructive/20 shadow-xl">
              <CardHeader className="pb-4">
                {/* 500 大數字 */}
                <div className="text-8xl font-bold text-destructive/20 mb-4">500</div>
                
                {/* 警告圖示 */}
                <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                
                <CardTitle className="text-2xl lg:text-3xl text-foreground">
                  系統發生了一點小問題
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-muted-foreground leading-relaxed space-y-3">
                  <p>
                    哎呀，我們的伺服器好像打了個盹 💤
                  </p>
                  <p className="text-sm">
                    別擔心，這不是你的錯！我們的工程師正在努力修復中（可能在收拾打翻的泡麵）。
                  </p>
                  <p className="text-sm">
                    通常重新整理一下就會好了，如果還是不行，稍後再試試看吧！
                  </p>
                </div>
                
                {/* 錯誤代碼 */}
                {error.digest && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">錯誤代碼（除錯用）</p>
                    <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
                      {error.digest}
                    </code>
                  </div>
                )}
                
                {/* 按鈕區 */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button 
                    onClick={reset} 
                    size="lg" 
                    className="gap-2"
                  >
                    <RefreshCw className="h-5 w-5" />
                    再試一次
                  </Button>
                  
                  <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link href="/">
                      <Home className="h-5 w-5" />
                      回到首頁
                    </Link>
                  </Button>
                </div>
                
                {/* 小提示 */}
                <p className="text-xs text-muted-foreground pt-4">
                  🔧 如果問題持續發生，請
                  <Link href="/contact" className="text-primary hover:underline mx-1">
                    聯繫我們
                  </Link>
                  並附上上方的錯誤代碼，我們會盡快處理！
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <SiteFooter />
    </div>
  )
}
