"use client"

import { useEffect, useState } from "react"
import { claimDinerSlotAction } from "@/app/actions/diner-actions"
import { getOrCreateDinerToken } from "@/lib/diner-token"

export type DinerSlotInfo = {
  slot: number
  label: string
  token: string
}

export function useDinerSlot(tableId: number | null) {
  const [info, setInfo] = useState<DinerSlotInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tableId) {
      setInfo(null)
      return
    }
    let cancelled = false
    const token = getOrCreateDinerToken(tableId)
    if (!token) return

    setLoading(true)
    setError(null)
    claimDinerSlotAction(tableId, token)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setInfo({ slot: res.data.slot, label: res.data.label, token })
        } else {
          setError(res.error)
        }
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo asignar comensal")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tableId])

  return { info, loading, error }
}
