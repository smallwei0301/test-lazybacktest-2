"use client"

// Patch Tag: LB-CONTACT-20250409A

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { MessageSquare, FileText, ExternalLink, Mail } from "lucide-react"

const CONTACT_EMAIL = "smallwei0301@gmail.com"

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { name, email, subject, message } = formData
    const emailSubject = encodeURIComponent(subject || `LazyBacktest 使用者來信 - ${name || "未填寫名稱"}`)
    const emailBody = encodeURIComponent(
      `姓名：${name || "未填寫"}\nEmail：${email || "未填寫"}\n\n內容：\n${message || "(請補充您的需求與問題描述)"}`,
    )
    if (typeof window !== "undefined") {
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${emailSubject}&body=${emailBody}`
      setHasSubmitted(true)
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2 border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-card-foreground">快速寄信表單</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" name="name" placeholder="輸入您的暱稱或真實姓名" value={formData.name} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">聯絡信箱</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="方便回覆的電子郵件"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">主旨</Label>
              <Input
                id="subject"
                name="subject"
                placeholder="例如：想回報 XX 股票的除權息資料有誤"
                value={formData.subject}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">內容</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="請說明遇到的問題、想詢問的功能或希望改善的使用體驗。"
                className="min-h-[160px]"
                value={formData.message}
                onChange={handleChange}
              />
              <p className="text-xs text-muted-foreground">
                小提醒：若附上錯誤訊息截圖、股票代號與操作時間點，能幫助我們更快找出原因。
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">寄出後會自動開啟您的郵件程式，請確認郵件內容後再按送出。</p>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                寄信給 LazyBacktest
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border shadow-sm">
          <CardHeader className="space-y-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-card-foreground">寫信前先檢查</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>建議先瀏覽以下頁面，很多問題都能立即找到解答：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <Link href="/tutorial" className="text-primary hover:underline">
                  使用教學：逐步帶你完成第一次回測
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-primary hover:underline">
                  常見問題：整理社群與客服最常被問到的議題
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="space-y-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-card-foreground">聯絡資訊</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              主要聯絡信箱：
              {" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p>回覆時間：工作日 10:00 - 18:00，平均 1-2 個工作天內回覆。</p>
            <Alert className="bg-muted">
              <ExternalLink className="h-4 w-4" />
              <AlertTitle>需要更即時的支援？</AlertTitle>
              <AlertDescription>
                在
                {" "}
                <Link href="/community" className="underline decoration-dotted underline-offset-4 hover:text-primary transition-colors">
                  社群討論
                </Link>
                {" "}
                張貼問題，通常會有熱心使用者協助，也能讓其他人受惠。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {hasSubmitted && (
          <Alert className="border-primary bg-primary/5">
            <Mail className="h-4 w-4" />
            <AlertTitle>已為您開啟郵件程式</AlertTitle>
            <AlertDescription>若未自動跳出視窗，請確認瀏覽器是否允許開啟郵件應用程式，或直接複製信箱手動寄送。</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
