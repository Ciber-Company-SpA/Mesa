import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { getSessionClaims } from "@/lib/supabase/claims"
import { logger } from "@/lib/logger"
import { useCache } from "@/hooks/useCache"

type RestaurantIdCache = {
  restaurantId: number
}

export function useRestaurantId() {
  const fetchRestaurantId = useCallback(async (): Promise<RestaurantIdCache> => {
    const claims = await getSessionClaims(supabase)

    if (!claims) throw new Error("Usuario no autenticado")

    const { data: profile, error } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", claims.userId)
      .single()

    if (error) throw error

    return { restaurantId: profile.restaurant_id }
  }, [])

  const { data, isLoading, isPendingRetry, error } = useCache<RestaurantIdCache>(
    "restaurant-id",
    fetchRestaurantId
  )

  if (error) {
    logger.error("Error obteniendo restaurante", error)
  }

  return {
    restaurantId: data?.restaurantId ?? null,
    loading: isLoading || isPendingRetry,
    error: error ? "No se pudo obtener el restaurante" : ""
  }
}
