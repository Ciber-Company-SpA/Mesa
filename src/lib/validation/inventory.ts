import { z } from "zod"

const NAME_MAX = 120
const NOTE_MAX = 250
const STOCK_MAX = 10_000_000
const RECIPE_ITEMS_MAX = 50

export const IngredientUnitSchema = z.enum(["unidad", "g", "ml"])

// Cantidades de stock: no negativas. Para 'unidad' lo natural son enteros, pero
// permitimos decimales (la UI redondea según la unidad).
const StockAmountSchema = z
  .number()
  .nonnegative("El stock no puede ser negativo")
  .max(STOCK_MAX, "El valor es demasiado alto")

const PositiveAmountSchema = z
  .number()
  .positive("La cantidad debe ser mayor a 0")
  .max(STOCK_MAX, "El valor es demasiado alto")

const NoteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX, "La nota es demasiado larga")
  .optional()
  .nullable()

const NameSchema = z
  .string()
  .trim()
  .min(1, "El nombre del insumo es obligatorio")
  .max(NAME_MAX, "El nombre es demasiado largo")

const IdSchema = z.number().int().positive("Identificador inválido")

export const CreateIngredientSchema = z.object({
  name: NameSchema,
  unit: IngredientUnitSchema,
  stockInicial: StockAmountSchema.default(0),
  stockMinimo: StockAmountSchema.default(0),
})

export const UpdateIngredientSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  unit: IngredientUnitSchema,
  stockMinimo: StockAmountSchema,
})

export const DeleteIngredientSchema = z.object({
  id: IdSchema,
})

export const RestockIngredientSchema = z.object({
  id: IdSchema,
  cantidad: PositiveAmountSchema,
  nota: NoteSchema,
})

export const SetIngredientStockSchema = z.object({
  id: IdSchema,
  nuevoStock: StockAmountSchema,
  motivo: z.enum(["ajuste", "conteo", "merma"]).default("ajuste"),
  nota: NoteSchema,
})

const RecipeItemSchema = z.object({
  ingredientId: IdSchema,
  cantidad: PositiveAmountSchema,
})

export const SetProductRecipeSchema = z
  .object({
    productId: IdSchema.nullable().default(null),
    variantId: IdSchema.nullable().default(null),
    items: z.array(RecipeItemSchema).max(RECIPE_ITEMS_MAX, "Demasiados insumos en la receta"),
  })
  .refine(
    (v) => (v.productId !== null) !== (v.variantId !== null),
    { message: "Debe indicar producto o variante (exactamente uno)" }
  )
  .refine(
    (v) => new Set(v.items.map((i) => i.ingredientId)).size === v.items.length,
    { message: "No repitas el mismo insumo en la receta" }
  )

export const ImportIngredientRowSchema = z.object({
  name: NameSchema,
  unit: IngredientUnitSchema,
  stockInicial: StockAmountSchema.default(0),
  stockMinimo: StockAmountSchema.default(0),
})

export const ImportIngredientsSchema = z
  .array(ImportIngredientRowSchema)
  .min(1, "No hay filas válidas para importar")
  .max(1000, "Demasiadas filas (máx 1000)")

export type ImportIngredientRowInput = z.infer<typeof ImportIngredientRowSchema>

export type CreateIngredientInput = z.infer<typeof CreateIngredientSchema>
export type UpdateIngredientInput = z.infer<typeof UpdateIngredientSchema>
export type DeleteIngredientInput = z.infer<typeof DeleteIngredientSchema>
export type RestockIngredientInput = z.infer<typeof RestockIngredientSchema>
export type SetIngredientStockInput = z.infer<typeof SetIngredientStockSchema>
export type SetProductRecipeInput = z.infer<typeof SetProductRecipeSchema>
