"use client"

// Patch Tag: LB-WEB-20250210A
import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SiteFooter } from "@/components/site-footer"
import { Mail, Copy, Check, MessageSquare, Send, Sparkles } from "lucide-react"

const CONTACT_EMAIL = "smallwei0301@gmail.com"

export default function ContactPage() {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle")

  const mailtoLink = useMemo(() => {
    const finalSubject = subject.trim() || "LazyBacktest 使用者詢問"
    const finalBody =
      message.trim() ||
      "您好，我在 LazyBacktest 上遇到以下情況：\n\n1. 問題描述：\n2. 預期結果：\n3. 重新操作步驟：\n\n謝謝您！"
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalBody)}`
  }, [subject, message])

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(CONTACT_EMAIL)
        setCopyState("success")
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = CONTACT_EMAIL
        textarea.setAttribute("readonly", "")
        textarea.style.position = "absolute"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        setCopyState("success")
      }
    } catch (error) {
      setCopyState("error")
    } finally {
      setTimeout(() => setCopyState("idle"), 2000)
    }
  }

  const handleSendMail = () => {
    window.location.href = mailtoLink
  }

  return (
    <div className="bg-background text-foreground">
      <header className="bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl space-y-6">
            <Badge variant="secondary">聯絡工程師</Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              寄信給我：把你的問題、靈感或合作提案一次說清楚
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              我們每天都會檢查信箱，歡迎附上螢幕截圖、參數設定或錯誤訊息。提供越完整的資訊，就能越快幫你排除問題。
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Mail className="h-6 w-6 text-primary" />
                填寫信件內容
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="contact-email" className="text-sm font-medium text-muted-foreground">
                  收件信箱
                </label>
                <div className="flex flex-wrap gap-3 items-center">
                  <code className="text-base font-semibold bg-muted px-3 py-2 rounded-lg">{CONTACT_EMAIL}</code>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-2">
                    {copyState === "success" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copyState === "success" ? "已複製" : "複製信箱"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium text-muted-foreground">
                  信件主旨
                </label>
                <Input
                  id="subject"
                  placeholder="例如：回測結果無法下載報表"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-muted-foreground">
                  信件內容
                </label>
                <Textarea
                  id="message"
                  placeholder={"請描述遇到的情況、操作步驟與螢幕截圖網址。"}
                  rows={8}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  建議附上股票代號、日期區間與操作步驟，能加速工程師定位問題。
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button type="button" onClick={handleSendMail} className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  開啟信件
                </Button>
                <Button asChild variant="outline">
                  <Link href="/community" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    先到社群提問
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border border-primary/30 bg-primary/5">
              <CardContent className="p-6 space-y-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  寄信前三個小提醒
                </h2>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                  <li>已經跑過一次回測？記得附上報告編號，方便直接調出資料。</li>
                  <li>若是功能建議，歡迎先到 <Link href="/community" className="underline underline-offset-4">社群討論</Link> 集思廣益。</li>
                  <li>
                    第一次使用平台，可先閱讀
                    <Link href="/tutorial" className="underline underline-offset-4 mx-1">使用教學</Link>
                    與
                    <Link href="/faq" className="underline underline-offset-4 ml-1">常見問題</Link>
                    ，也許就能立即解決疑惑。
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-6 text-sm text-muted-foreground leading-relaxed space-y-3">
                <p>
                  為了保護你的資訊安全，我們僅使用上述信箱作為官方聯絡管道。若收到可疑訊息，請回信前先到
                  <Link href="/disclaimer" className="underline underline-offset-4 mx-1">免責聲明</Link>
                  查閱防詐提醒。
                </p>
                <p>
                  信件會於 1-2 個工作天內回覆。若是急件，請在主旨加註「[急件]」，我們會儘快安排處理。
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
