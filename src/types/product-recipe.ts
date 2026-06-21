// Línea de receta (BOM): liga un PRODUCTO o una VARIANTE (exactamente uno) con
// un insumo y la cantidad que consume por unidad vendida.
export type ProductRecipeRow = {
  id: number
  restaurant_id: number
  product_id: number | null
  variant_id: number | null
  ingredient_id: number
  cantidad: number
  created_at: string
}

// Una línea de receta tal como la maneja la UI (sin metadatos de fila).
export type RecipeItem = {
  ingredientId: number
  cantidad: number
}

// Insumo sugerido por la IA para la receta de un producto. existingId apunta a
// un insumo ya existente que matchea por nombre; si es null, es uno nuevo que se
// creará en inventario con stock 0 al guardar la receta.
export type SuggestedRecipeItem = {
  name: string
  unit: "unidad" | "g" | "ml"
  cantidad: number
  existingId: number | null
}

// Producto mínimo para listar los que no tienen receta.
export type ProductLite = { id: number; name: string }

// Una entrada del generador masivo: producto + insumos sugeridos por la IA.
export type BulkRecipeEntry = { productId: number; items: SuggestedRecipeItem[] }

// Resultado del generador masivo de recetas.
export type BulkRecipeSummary = {
  productsProcessed: number
  ingredientsCreated: number
  recipesSaved: number
}

// Datos que necesita la pestaña "Receta" del producto: insumos disponibles,
// las variantes del producto y la receta actual por destino.
export type ProductRecipeData = {
  productId: number
  hasVariants: boolean
  variants: Array<{ id: number; name: string }>
  // receta a nivel producto (cuando no hay variantes)
  productRecipe: RecipeItem[]
  // receta por variante, indexada por variant_id
  variantRecipes: Record<number, RecipeItem[]>
}
