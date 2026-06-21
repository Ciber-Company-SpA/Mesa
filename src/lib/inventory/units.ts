import type { IngredientUnit } from "@/types/ingredient"

// El stock se guarda en unidad base: 'unidad', 'g' o 'ml'. En el formulario el
// usuario puede elegir kg/L por comodidad; se convierten a g/ml al guardar.
export type DisplayUnit = "unidad" | "g" | "kg" | "ml" | "l"

export const DISPLAY_UNIT_OPTIONS: Array<{
  value: DisplayUnit
  label: string
  base: IngredientUnit
  factor: number
}> = [
  { value: "unidad", label: "Unidad", base: "unidad", factor: 1 },
  { value: "g", label: "Gramos (g)", base: "g", factor: 1 },
  { value: "kg", label: "Kilos (kg)", base: "g", factor: 1000 },
  { value: "ml", label: "Mililitros (ml)", base: "ml", factor: 1 },
  { value: "l", label: "Litros (L)", base: "ml", factor: 1000 },
]

// Convierte una cantidad expresada en una unidad de UI a la unidad base + valor.
export function toBaseAmount(amount: number, display: DisplayUnit): { base: IngredientUnit; amount: number } {
  const opt = DISPLAY_UNIT_OPTIONS.find((o) => o.value === display) ?? DISPLAY_UNIT_OPTIONS[0]
  return { base: opt.base, amount: amount * opt.factor }
}

// Etiqueta corta de la unidad base (para inputs de receta, etc.).
export function baseUnitLabel(unit: IngredientUnit): string {
  return unit === "unidad" ? "u" : unit
}

function fmt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

// Formatea una cantidad en unidad base a texto legible, subiendo a kg/L cuando
// el valor es grande (1500 g -> "1,5 kg", 1500 ml -> "1,5 L").
export function formatStock(amount: number, unit: IngredientUnit): string {
  const n = Number(amount)
  if (unit === "g") {
    return Math.abs(n) >= 1000 ? `${fmt(n / 1000)} kg` : `${fmt(n)} g`
  }
  if (unit === "ml") {
    return Math.abs(n) >= 1000 ? `${fmt(n / 1000)} L` : `${fmt(n)} ml`
  }
  return `${fmt(n)} u`
}
