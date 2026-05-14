import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useCartStore } from "@/store/cartStore"

async function syncCartForRestaurant(restaurantId: number) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, status_id")
      .eq("restaurant_id", restaurantId)

    if (error) throw error

    const products = data ?? []
    const { items: currentItems, removeItem } = useCartStore.getState()
    const availableIds = new Set(products.filter((p) => p.status_id === 1).map((p) => p.id))

    currentItems.forEach((item) => {
      const productId = item.productId ?? item.id

      if (!availableIds.has(productId)) {
        removeItem(item.id)
      }
    })
  } catch (err: unknown) {
    logger.error("Error sincronizando carrito", err)
  }
}

export function useCartSync(restaurantId: number | null) {
  const items = useCartStore((state) => state.items)

  useEffect(() => {
    if (!restaurantId) return

    syncCartForRestaurant(restaurantId)
  }, [restaurantId, items])

  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`cart-sync-products-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          syncCartForRestaurant(restaurantId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  return {
    syncCart: () => restaurantId ? syncCartForRestaurant(restaurantId) : Promise.resolve(),
  }
}