import { toBaseAmount, type DisplayUnit } from "@/lib/inventory/units"
import type { IngredientUnit } from "@/types/ingredient"

// ---------------------------------------------------------------------------
// Parser CSV mínimo pero robusto: comillas, comas dentro de comillas, CRLF, BOM.
// ---------------------------------------------------------------------------
function detectDelimiter(text: string): string {
  const nl = text.indexOf("\n")
  const firstLine = nl >= 0 ? text.slice(0, nl) : text
  const commas = (firstLine.match(/,/g) ?? []).length
  const semis = (firstLine.match(/;/g) ?? []).length
  return semis > commas ? ";" : ","
}

export function parseCsv(input: string, delimiter?: string): string[][] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // quitar BOM
  const delim = delimiter ?? detectDelimiter(text)

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === delim) {
      row.push(field)
      field = ""
      i++
      continue
    }
    if (c === "\r") {
      i++
      continue
    }
    if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i++
      continue
    }
    field += c
    i++
  }
  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // descartar filas totalmente vacías
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

// ---------------------------------------------------------------------------
// Mapeo a insumos
// ---------------------------------------------------------------------------
export type ParsedIngredientRow = {
  name: string
  rawUnit: string
  displayUnit: DisplayUnit | null
  base: IngredientUnit | null
  baseStock: number
  baseMin: number
  valid: boolean
  error?: string
}

export type ParseResult = {
  headerError?: string
  rows: ParsedIngredientRow[]
}

function normalizeHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function parseUnit(raw: string): DisplayUnit | null {
  const u = normalizeHeader(raw)
  if (["unidad", "unidades", "u", "un", "pieza", "piezas", "pza"].includes(u)) return "unidad"
  if (["g", "gr", "gramo", "gramos"].includes(u)) return "g"
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(u)) return "kg"
  if (["ml", "mililitro", "mililitros", "cc"].includes(u)) return "ml"
  if (["l", "lt", "litro", "litros"].includes(u)) return "l"
  return null
}

function parseNumber(raw: string): number {
  const n = Number(raw.trim().replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

// Encabezados aceptados por columna (normalizados, sin acentos).
const HEADER_ALIASES: Record<"name" | "unit" | "stock" | "min", string[]> = {
  name: ["nombre", "insumo", "producto", "item", "articulo"],
  unit: ["unidad", "medida", "unidad de medida", "um"],
  stock: ["stock", "cantidad", "existencia", "stock inicial", "inicial"],
  min: ["minimo", "min", "stock minimo", "alerta", "minimo de alerta"],
}

function findColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h))
}

export function parseInventoryCsv(text: string): ParseResult {
  const table = parseCsv(text)
  if (table.length < 2) {
    return { headerError: "El archivo no tiene filas de datos.", rows: [] }
  }

  const headers = table[0].map(normalizeHeader)
  const iName = findColumn(headers, HEADER_ALIASES.name)
  const iUnit = findColumn(headers, HEADER_ALIASES.unit)
  const iStock = findColumn(headers, HEADER_ALIASES.stock)
  const iMin = findColumn(headers, HEADER_ALIASES.min)

  if (iName < 0 || iUnit < 0) {
    return {
      headerError:
        "Faltan columnas obligatorias. La primera fila debe incluir al menos 'Nombre' y 'Unidad'.",
      rows: [],
    }
  }

  const rows: ParsedIngredientRow[] = table.slice(1).map((cols) => {
    const name = (cols[iName] ?? "").trim()
    const rawUnit = (cols[iUnit] ?? "").trim()
    const stockStr = iStock >= 0 ? (cols[iStock] ?? "").trim() : ""
    const minStr = iMin >= 0 ? (cols[iMin] ?? "").trim() : ""

    const displayUnit = parseUnit(rawUnit)
    const stock = stockStr === "" ? 0 : parseNumber(stockStr)
    const min = minStr === "" ? 0 : parseNumber(minStr)

    let error: string | undefined
    if (!name) error = "Falta el nombre"
    else if (!displayUnit) error = `Unidad no reconocida: "${rawUnit}"`
    else if (Number.isNaN(stock) || stock < 0) error = "Stock inválido"
    else if (Number.isNaN(min) || min < 0) error = "Mínimo inválido"

    if (error || !displayUnit) {
      return { name, rawUnit, displayUnit, base: null, baseStock: 0, baseMin: 0, valid: false, error }
    }

    const { base, amount: baseStock } = toBaseAmount(stock, displayUnit)
    const { amount: baseMin } = toBaseAmount(min, displayUnit)
    return { name, rawUnit, displayUnit, base, baseStock, baseMin, valid: true }
  })

  return { rows }
}

// Filas válidas en el formato que espera el servidor (unidad base).
export function toImportPayload(rows: ParsedIngredientRow[]) {
  return rows
    .filter((r) => r.valid && r.base)
    .map((r) => ({
      name: r.name,
      unit: r.base as IngredientUnit,
      stockInicial: r.baseStock,
      stockMinimo: r.baseMin,
    }))
}

// ---------------------------------------------------------------------------
// Plantilla descargable
// ---------------------------------------------------------------------------
export const INVENTORY_TEMPLATE_CSV = [
  "Nombre,Unidad,Stock,Minimo",
  "Pan de hamburguesa,unidad,100,20",
  "Carne de vacuno,kg,15,3",
  "Bebida lata,unidad,48,12",
  "Aceite,L,10,2",
].join("\n")

export function downloadInventoryTemplate() {
  const blob = new Blob(["﻿" + INVENTORY_TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "plantilla-inventario.csv"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
