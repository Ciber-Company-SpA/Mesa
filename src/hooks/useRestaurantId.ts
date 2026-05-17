import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

export function useRestaurantId() {
  const [restaurantId, setRestaurantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { run: loadWithRetry, isPending } = useOfflineRetry(async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) throw userError
    if (!user) throw new Error("Usuario no autenticado")

    const { data: profile, error } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single()

    if (error) throw error

    setRestaurantId(profile.restaurant_id)
    setError("")
  })

  useEffect(() => {
    async function load() {
      try {
        await loadWithRetry()
      } catch (err: unknown) {
        if (isNetworkError(err)) return
        logger.error("Error obteniendo restaurante", err)
        setError("No se pudo obtener el restaurante")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [loadWithRetry])

  return { restaurantId, loading: loading || isPending, error }
}
