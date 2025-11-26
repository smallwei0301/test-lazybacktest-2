'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Strategy Page Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
      <h2 className="text-2xl font-bold text-red-600">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <div className="p-4 bg-muted rounded-md font-mono text-sm overflow-auto max-w-full">
        {error.stack}
      </div>
      <Button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </Button>
    </div>
  )
}
