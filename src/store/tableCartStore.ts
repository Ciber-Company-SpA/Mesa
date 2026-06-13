import { create } from "zustand"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { getGuestId } from "@/lib/guest-id"
import type { CartItem } from "@/types/cart-item"
import type { TableCartStore } from "@/types/cart-store"

type ProductJoin = { product_name: string; product_image: string | null } | null
type VariantJoin = { variant_name: string; variant_image: string | null } | null

type CartRow = {
  id: string
  product_id: number
  variant_id: number | null
  quantity: number
  unit_price: number
  notes: string | null
  added_by: string | null
  products: ProductJoin | ProductJoin[]
  product_variants: VariantJoin | VariantJoin[]
}

function pickOne<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapRowToItem(row: CartRow): CartItem {
  const product = pickOne(row.products)
  const variant = pickOne(row.product_variants)
  const productName = product?.product_name ?? "Producto"
  const name = variant?.variant_name ? `${productName} · ${variant.variant_name}` : productName
  const image = variant?.variant_image ?? product?.product_image ?? undefined

  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    name,
    price: row.unit_price,
    quantity: row.quantity,
    image: image ?? undefined,
    notes: row.notes,
    addedBy: row.added_by,
  }
}

// Todo el acceso al carrito (lectura y escritura) pasa por RPC SECURITY DEFINER
// que reciben el qr_token: anon ya NO puede leer/escribir table_cart_items
// directamente ni con un table_id inventado.
export const useTableCartStore = create<TableCartStore>()((set, get) => ({
  items: [],
  tableId: null,
  restaurantId: null,
  qrCode: null,
  isLoading: false,

  setTable: (tableId, restaurantId, qrCode) => set({ tableId, restaurantId, qrCode }),

  fetchItems: async () => {
    const { qrCode } = get()
    if (!qrCode) {
      set({ items: [] })
      return
    }

    set({ isLoading: true })
    try {
      const { data, error } = await supabase.rpc("get_cart_qr", { p_qr_token: qrCode })
      if (error) throw error
      const rows = (data ?? []) as unknown as CartRow[]
      set({ items: rows.map(mapRowToItem) })
    } catch (err) {
      logger.error("Error cargando carrito de mesa", err)
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (input) => {
    const { qrCode } = get()
    if (!qrCode) return

    const { error } = await supabase.rpc("cart_add_item_qr", {
      p_qr_token: qrCode,
      p_product_id: input.productId,
      p_variant_id: input.variantId ?? null,
      p_quantity: input.quantity ?? 1,
      p_notes: input.notes ?? null,
      p_added_by: getGuestId(),
    })

    if (error) {
      logger.error("Error agregando item al carrito", error)
      return
    }

    await get().fetchItems()
  },

  updateQuantity: async (rowId, quantity) => {
    if (quantity <= 0) {
      await get().removeItem(rowId)
      return
    }

    const { qrCode } = get()
    if (!qrCode) return

    const { error } = await supabase.rpc("cart_update_quantity_qr", {
      p_qr_token: qrCode,
      p_row_id: rowId,
      p_quantity: quantity,
    })

    if (error) {
      logger.error("Error actualizando cantidad del carrito", error)
      return
    }

    await get().fetchItems()
  },

  removeItem: async (rowId) => {
    const { qrCode } = get()
    if (!qrCode) return

    const { error } = await supabase.rpc("cart_remove_item_qr", {
      p_qr_token: qrCode,
      p_row_id: rowId,
    })

    if (error) {
      logger.error("Error eliminando item del carrito", error)
      return
    }

    await get().fetchItems()
  },

  clear: async () => {
    const { qrCode } = get()
    if (!qrCode) return

    const { error } = await supabase.rpc("cart_clear_qr", { p_qr_token: qrCode })

    if (error) {
      logger.error("Error vaciando carrito", error)
      return
    }

    await get().fetchItems()
  },
}))

export const useTableCartTotal = () =>
  useTableCartStore((state) =>
    state.items.reduce((acc, i) => acc + i.price * i.quantity, 0)
  )

// Sincronización del carrito compartido de la mesa por POLLING.
// Antes era Realtime (postgres_changes), pero eso entregaba las filas a
// cualquier anon suscrito → fuga de datos. El polling refresca vía get_cart_qr
// (con el token), seguro. Un solo timer compartido entre todos los consumidores.
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollSubscribers = 0

export function startCartPolling() {
  pollSubscribers += 1
  if (pollTimer) return

  pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return
    useTableCartStore.getState().fetchItems()
  }, 4000)
}

export function stopCartPolling() {
  pollSubscribers = Math.max(0, pollSubscribers - 1)
  if (pollSubscribers === 0 && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
