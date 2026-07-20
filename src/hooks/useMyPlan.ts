"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type MyPlan = {
  restaurant_id: number
  plan_id: string | null
  plan_name: string | null
  max_tables: number | null
  one_time_price: number | null
  support_monthly_price: number | null
  account_status: string
  trial_ends_at: string | null
  tables_count: number
  has_reports_advanced: boolean
  has_full_waiter_mgmt: boolean
  has_multi_branch: boolean
  // true si el usuario es el DUEÑO de su restaurante activo (no un admin de
  // local delegado). Gatea el módulo Sucursales y el selector de local.
  is_owner: boolean
}

/**
 * Plan comercial del restaurante del usuario (límites y flags de features).
 * Lee la RPC get_my_restaurant_plan. Un restaurante sin plan asignado obtiene
 * acceso completo (los flags vienen en true), así que el gating solo recorta
 * cuando hay un plan que lo exige (Plan 15).
 */
export function useMyPlan() {
  const [plan, setPlan] = useState<MyPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.rpc("get_my_restaurant_plan").then(({ data }) => {
      if (!active) return
      setPlan((data ?? null) as MyPlan | null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return { plan, loading }
}
