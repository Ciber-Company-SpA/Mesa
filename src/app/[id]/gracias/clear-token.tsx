"use client"

import { useEffect } from "react"
import { clearDinerToken } from "@/lib/diner-token"

export function ClearDinerTokenOnMount({ tableId }: { tableId: number | null }) {
  useEffect(() => {
    if (tableId) clearDinerToken(tableId)
  }, [tableId])
  return null
}
