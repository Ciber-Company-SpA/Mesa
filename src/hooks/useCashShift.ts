"use client"

import { useCallback, useEffect, useState } from "react"
import { getCurrentShift, type CurrentShift } from "@/services/cash-shift-service"

export function useCashShift() {
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCurrentShift()
      setShift(res.ok ? res.data : null)
    } catch {
      setShift(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { shift, loading, reload }
}
