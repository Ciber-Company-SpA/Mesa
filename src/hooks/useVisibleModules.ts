"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type VisibleModules = {
  admin: string[]
  waiter: string[]
}

/**
 * Módulos habilitados por el operador de la plataforma (get_visible_modules).
 * FAIL-OPEN: mientras carga o si la RPC falla, todo se considera visible —
 * un problema de red o de base nunca debe dejar al cliente sin navegación.
 */
export function useVisibleModules() {
  const [modules, setModules] = useState<VisibleModules | null>(null)

  useEffect(() => {
    let active = true
    supabase.rpc("get_visible_modules").then(({ data, error }) => {
      if (!active || error || !data) return
      setModules(data as VisibleModules)
    })
    return () => {
      active = false
    }
  }, [])

  function isVisible(area: keyof VisibleModules, key: string): boolean {
    if (!modules) return true
    return modules[area]?.includes(key) ?? true
  }

  return { modules, isVisible }
}
