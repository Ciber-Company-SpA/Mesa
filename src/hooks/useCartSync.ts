import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useTableCartStore } from "@/store/tableCartStore"

// Revalida el carrito contra la disponibilidad real de productos: si un
// producto quedó agotado (status_id <> 1), lo quita del carrito local.
//
// NOTA: esto es solo una mejora de UX. La validación REAL ocurre en el servidor
// al crear el pedido: create_public_order_qr rechaza cualquier producto no
// disponible. Por eso esta sincronización no necesita correr en bucle: basta
// hacerla al montar (y cuando el carrito se rehidrata con una mesa nueva).
async function syncCartForRestaurant(restaurantId: number) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, status_id")
      .eq("restaurant_id", restaurantId)
    if (error) throw error
    const products = data ?? []
    const availableIds = new Set(
      products.filter((p) => p.status_id === 1).map((p) => p.id)
    )
    const { items, removeItem } = useTableCartStore.getState()
    for (const item of items) {
      if (!availableIds.has(item.productId)) {
        await removeItem(item.id)
      }
    }
  } catch (err: unknown) {
    logger.error("Error sincronizando carrito", err)
  }
}

export function useCartSync(restaurantId: number | null) {
  // Sincroniza UNA vez al montar / cambiar de restaurante.
  useEffect(() => {
    if (!restaurantId) return
    syncCartForRestaurant(restaurantId)
  }, [restaurantId])

  return {
    syncCart: () => (restaurantId ? syncCartForRestaurant(restaurantId) : Promise.resolve()),
  }
}
