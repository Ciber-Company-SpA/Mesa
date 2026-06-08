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

const SELECT_COLUMNS =
  "id, product_id, variant_id, quantity, unit_price, notes, added_by, created_at, " +
  "products(product_name, product_image), product_variants(variant_name, variant_image)"

export const useTableCartStore = create<TableCartStore>()((set, get) => ({
  items: [],
  tableId: null,
  restaurantId: null,
  qrCode: null,
  isLoading: false,

setTable: (tableId, restaurantId, qrCode) => set({ tableId, restaurantId, qrCode }),
  // LECTURA: sin cambios. Se mantiene directa (RLS permite leer mesas activas).
  fetchItems: async () => {
    const { tableId } = get()
    if (!tableId) {
      set({ items: [] })
      return
    }

    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from("table_cart_items")
        .select(SELECT_COLUMNS)
        .eq("table_id", tableId)
        .order("created_at", { ascending: true })

      if (error) throw error
      const rows = (data ?? []) as unknown as CartRow[]
      set({ items: rows.map(mapRowToItem) })
    } catch (err) {
      logger.error("Error cargando carrito de mesa", err)
    } finally {
      set({ isLoading: false })
    }
  },

  // ESCRITURA: ahora por RPC. La RPC valida mesa/QR activo, recalcula precio
  // desde la BD y maneja el "sumar si ya existe" internamente.
  addItem: async (input) => {
    const { tableId } = get()
    if (!tableId) return

    const { error } = await supabase.rpc("cart_add_item", {
      p_table_id: tableId,
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

    const { error } = await supabase.rpc("cart_update_quantity", {
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
    const { error } = await supabase.rpc("cart_remove_item", {
      p_row_id: rowId,
    })

    if (error) {
      logger.error("Error eliminando item del carrito", error)
      return
    }

    await get().fetchItems()
  },

  clear: async () => {
    const { tableId } = get()
    if (!tableId) return

    const { error } = await supabase.rpc("cart_clear", {
      p_table_id: tableId,
    })

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

let activeChannel: ReturnType<typeof supabase.channel> | null = null
let activeTableId: number | null = null
let subscriberCount = 0

export function subscribeToTableCart(tableId: number) {
  subscriberCount += 1

  if (activeTableId === tableId && activeChannel) return

  if (activeChannel) {
    supabase.removeChannel(activeChannel)
    activeChannel = null
  }

  activeTableId = tableId
  activeChannel = supabase
    .channel(`table-cart-${tableId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "table_cart_items",
        filter: `table_id=eq.${tableId}`,
      },
      () => {
        useTableCartStore.getState().fetchItems()
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "table_cart_items",
        filter: `table_id=eq.${tableId}`,
      },
      () => {
        useTableCartStore.getState().fetchItems()
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "table_cart_items",
      },
      () => {
        // Deleted rows do not reliably include table_id for realtime filtering.
        useTableCartStore.getState().fetchItems()
      }
    )
    .subscribe()
}

export function unsubscribeFromTableCart() {
  subscriberCount = Math.max(0, subscriberCount - 1)
  if (subscriberCount === 0 && activeChannel) {
    supabase.removeChannel(activeChannel)
    activeChannel = null
    activeTableId = null
  }
}