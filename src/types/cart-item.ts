// Selección cruda de una línea de promo "build" (una opción elegida por el
// comensal). Se reenvía tal cual al crear el pedido.
export type CartPromoSelection = {
  groupId: number
  productId: number
  variantId: number | null
}

export type CartItem = {
  id: string
  // productId es null cuando la línea es una promoción (combo).
  productId: number | null
  variantId: number | null
  // promotionId no es null cuando la línea es una promoción.
  promotionId?: number | null
  // Solo en promos "build": elecciones crudas (para el pedido) y etiquetas ya
  // resueltas (para mostrar el detalle en el carrito).
  selections?: CartPromoSelection[] | null
  selectionLabels?: string[] | null
  name: string
  price: number
  quantity: number
  image?: string
  notes?: string | null
  addedBy?: string | null
}
