// Motivo de un movimiento del libro mayor de stock.
//   inicial    -> carga inicial al crear el insumo
//   venta      -> consumo automático por un pedido
//   reposicion -> ingreso por compra/reposición
//   ajuste     -> corrección manual
//   conteo     -> ajuste por conteo físico de inventario
//   merma      -> pérdida (vencimiento, rotura, robo)
export type StockMotivo =
  | "inicial"
  | "venta"
  | "reposicion"
  | "ajuste"
  | "conteo"
  | "merma"

export type StockMovement = {
  id: number
  restaurant_id: number
  ingredient_id: number
  delta: number // negativo = consumo, positivo = ingreso
  motivo: StockMotivo
  order_id: number | null
  user_id: number | null
  nota: string | null
  created_at: string
}

// Movimiento con el nombre del insumo resuelto, para mostrar en el historial.
export type StockMovementWithIngredient = StockMovement & {
  ingredient_name: string | null
}
