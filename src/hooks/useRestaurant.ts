import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import type { Restaurant } from "@/types/restaurant" 


export function useRestaurant() {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (loadingId || restaurantId === null) return

    async function load() {
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id, restaurant_name, restaurant_logo")
          .eq("id", restaurantId)
          .single()

        if (error) throw error
        setRestaurant(data)
      } catch (err: unknown) {
        setError("No se pudo obtener el restaurante")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [restaurantId, loadingId])

  return { restaurant, loading, error }
}