import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Home, MessageCircle, Search } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader activePath="" />
      
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto">
            <Card className="text-center border-2 border-primary/20 shadow-xl">
              <CardHeader className="pb-4">
                {/* 404 大數字 */}
                <div className="text-8xl font-bold text-primary/20 mb-4">404</div>
                
                {/* 搜尋圖示 */}
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="h-10 w-10 text-primary" />
                </div>
                
                <CardTitle className="text-2xl lg:text-3xl text-foreground">
                  哎呀！找不到這個頁面
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-muted-foreground leading-relaxed space-y-3">
                  <p>
                    看起來這個頁面跑去度假了 🏖️
                  </p>
                  <p className="text-sm">
                    可能是網址打錯了、頁面已經搬家，或者它真的決定離職了（誰知道呢）。
                  </p>
                  <p className="text-sm">
                    別擔心，我們的回測功能還是正常運作的！
                  </p>
                </div>
                
                {/* 按鈕區 */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button asChild size="lg" className="gap-2">
                    <Link href="/">
                      <Home className="h-5 w-5" />
                      回到首頁
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link href="/contact">
                      <MessageCircle className="h-5 w-5" />
                      回報問題
                    </Link>
                  </Button>
                </div>
                
                {/* 小提示 */}
                <p className="text-xs text-muted-foreground pt-4">
                  💡 提示：試試看從首頁重新開始，或直接
                  <Link href="/app/index.html" className="text-primary hover:underline mx-1">
                    進入回測 App
                  </Link>
                  繼續你的策略研究！
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
