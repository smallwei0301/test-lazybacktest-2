"use client"

// Component Version: LB-FE-20250304A

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, CheckCircle } from "lucide-react"

type CopyEmailButtonProps = {
  email: string
}

export function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [isCopied, setIsCopied] = useState(false)

  async function handleCopy() {
    try {
      if (!navigator?.clipboard) {
        console.warn("Clipboard API not available")
        return
      }
      await navigator.clipboard.writeText(email)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
    } catch (error) {
      console.error("Copy email failed", error)
    }
  }

  return (
    <Button variant="outline" size="lg" onClick={handleCopy} className="flex items-center gap-2">
      {isCopied ? <CheckCircle className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-primary" />}
      {isCopied ? "已複製信箱" : "複製信箱"}
    </Button>
  )
}

export default CopyEmailButton
