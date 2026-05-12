import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export function useRestaurantId() {
  const [restaurantId, setRestaurantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Usuario no autenticado")

        const { data: profile, error } = await supabase
          .from("users")
          .select("restaurant_id")
          .eq("auth_user_id", user.id)
          .single()

        if (error) throw error

        setRestaurantId(profile.restaurant_id)
      } catch (err: unknown) {
        logger.error("Error obteniendo restaurante", err)
        setError("No se pudo obtener el restaurante")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return { restaurantId, loading, error }
}
