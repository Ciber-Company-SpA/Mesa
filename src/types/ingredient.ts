// Insumo de inventario. El stock se cuenta en unidad base:
//   'unidad' (piezas), 'g' (peso) o 'ml' (volumen).
// kg/L se convierten a g/ml en la capa de UI antes de guardar.
export type IngredientUnit = "unidad" | "g" | "ml"

export type Ingredient = {
  id: number
  restaurant_id: number
  name: string
  unit: IngredientUnit
  stock_actual: number
  stock_minimo: number
  // Costo por unidad base (por g, por ml o por unidad). La UI lo muestra por
  // medida natural ($/kg, $/L). 0 = sin precio.
  precio: number
  created_at: string
}

// Insumo con el flag de quiebre derivado (stock_actual <= stock_minimo).
export type IngredientWithFlag = Ingredient & {
  low: boolean
}

// Resumen de una importación masiva de insumos desde CSV.
export type ImportIngredientsSummary = {
  created: number
  updated: number
  skipped: { name: string; reason: string }[]
}

// ---------------------------------------------------------------------------
// Alertas de inventario (stock bajo / sin stock) para el panel admin.
// Nivel:
//   'sin_stock' → stock_actual <= 0 (agotado)
//   'bajo'      → 0 < stock_actual <= stock_minimo (bajo el mínimo)
// ---------------------------------------------------------------------------
export type InventoryAlertLevel = "sin_stock" | "bajo"

export type InventoryAlertItem = {
  id: number
  name: string
  unit: IngredientUnit
  stock_actual: number
  stock_minimo: number
  level: InventoryAlertLevel
}

export type InventoryAlerts = {
  out_count: number
  low_count: number
  items: InventoryAlertItem[]
}
