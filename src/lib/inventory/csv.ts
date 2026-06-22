import { toBaseAmount, DISPLAY_UNIT_OPTIONS, type DisplayUnit } from "@/lib/inventory/units"
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
  precio: number // costo por unidad base (0 = sin precio)
  valid: boolean
  error?: string
}

// Índices (basados en 0) de cada campo dentro de las columnas del CSV.
// -1 = columna ausente.
export type ColumnMap = {
  name: number
  unit: number
  stock: number
  min: number
  price: number
}

export type ParseResult = {
  headerError?: string
  rows: ParsedIngredientRow[]
  table: string[][] // tabla cruda (incluye encabezados) para re-mapear
  headers: string[] // encabezados crudos (sin normalizar), para mostrar/IA
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
const HEADER_ALIASES: Record<"name" | "unit" | "stock" | "min" | "price", string[]> = {
  name: ["nombre", "insumo", "producto", "item", "articulo"],
  unit: ["unidad", "medida", "unidad de medida", "um"],
  stock: ["stock", "cantidad", "existencia", "stock inicial", "inicial"],
  min: ["minimo", "min", "stock minimo", "alerta", "minimo de alerta"],
  price: ["precio", "costo", "coste", "price", "valor", "$"],
}

function findColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h))
}

// Detecta las columnas por alias de encabezado (case/acento-insensible).
export function detectInventoryColumns(normalizedHeaders: string[]): ColumnMap {
  return {
    name: findColumn(normalizedHeaders, HEADER_ALIASES.name),
    unit: findColumn(normalizedHeaders, HEADER_ALIASES.unit),
    stock: findColumn(normalizedHeaders, HEADER_ALIASES.stock),
    min: findColumn(normalizedHeaders, HEADER_ALIASES.min),
    price: findColumn(normalizedHeaders, HEADER_ALIASES.price),
  }
}

function buildRow(cols: string[], map: ColumnMap): ParsedIngredientRow {
  const name = (cols[map.name] ?? "").trim()
  const rawUnit = (cols[map.unit] ?? "").trim()
  const stockStr = map.stock >= 0 ? (cols[map.stock] ?? "").trim() : ""
  const minStr = map.min >= 0 ? (cols[map.min] ?? "").trim() : ""
  const priceStr = map.price >= 0 ? (cols[map.price] ?? "").trim() : ""

  const displayUnit = parseUnit(rawUnit)
  const stock = stockStr === "" ? 0 : parseNumber(stockStr)
  const min = minStr === "" ? 0 : parseNumber(minStr)
  const priceVal = priceStr === "" ? 0 : parseNumber(priceStr)

  let error: string | undefined
  if (!name) error = "Falta el nombre"
  else if (!displayUnit) error = `Unidad no reconocida: "${rawUnit}"`
  else if (Number.isNaN(stock) || stock < 0) error = "Stock inválido"
  else if (Number.isNaN(min) || min < 0) error = "Mínimo inválido"

  if (error || !displayUnit) {
    return {
      name, rawUnit, displayUnit, base: null,
      baseStock: 0, baseMin: 0, precio: 0, valid: false, error,
    }
  }

  const { base, amount: baseStock } = toBaseAmount(stock, displayUnit)
  const { amount: baseMin } = toBaseAmount(min, displayUnit)
  // El precio del CSV es por la medida de la columna Unidad; lo pasamos a /base.
  const factor = DISPLAY_UNIT_OPTIONS.find((o) => o.value === displayUnit)?.factor ?? 1
  const precio = !Number.isNaN(priceVal) && priceVal > 0 ? priceVal / factor : 0

  return { name, rawUnit, displayUnit, base, baseStock, baseMin, precio, valid: true }
}

// Construye las filas a partir de la tabla cruda y un mapeo de columnas
// (sirve tanto para el mapeo por alias como para el que devuelve la IA).
export function buildInventoryRows(table: string[][], map: ColumnMap): ParsedIngredientRow[] {
  return table.slice(1).map((cols) => buildRow(cols, map))
}

export function parseInventoryCsv(text: string): ParseResult {
  const table = parseCsv(text)
  const headers = table[0] ?? []

  if (table.length < 2) {
    return { headerError: "El archivo no tiene filas de datos.", rows: [], table, headers }
  }

  const cols = detectInventoryColumns(headers.map(normalizeHeader))

  if (cols.name < 0 || cols.unit < 0) {
    return {
      headerError:
        "No reconocimos las columnas 'Nombre' y 'Unidad' en la primera fila.",
      rows: [],
      table,
      headers,
    }
  }

  return { rows: buildInventoryRows(table, cols), table, headers }
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
      precio: r.precio,
    }))
}

// ---------------------------------------------------------------------------
// Plantilla descargable
// ---------------------------------------------------------------------------
export const INVENTORY_TEMPLATE_CSV = [
  "Nombre,Unidad,Stock,Minimo,Precio",
  "Pan de hamburguesa,unidad,100,20,150",
  "Carne de vacuno,kg,15,3,8000",
  "Bebida lata,unidad,48,12,600",
  "Aceite,L,10,2,3500",
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
