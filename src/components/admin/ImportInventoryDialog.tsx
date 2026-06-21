"use client"

import { useEffect, useRef, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { importIngredientsAction, mapInventoryHeadersAction } from "@/app/actions/inventory-actions"
import {
  parseInventoryCsv,
  buildInventoryRows,
  toImportPayload,
  downloadInventoryTemplate,
  type ParsedIngredientRow,
} from "@/lib/inventory/csv"
import { formatStock } from "@/lib/inventory/units"
import type { ImportIngredientsSummary } from "@/types/ingredient"

type Props = {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function ImportInventoryDialog({ open, onClose, onImported }: Props) {
  const [mode, setMode] = useState<"catalogo" | "compra">("catalogo")
  const [rows, setRows] = useState<ParsedIngredientRow[]>([])
  const [headerError, setHeaderError] = useState("")
  const [fileName, setFileName] = useState("")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ImportIngredientsSummary | null>(null)
  const [table, setTable] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [aiMapping, setAiMapping] = useState(false)
  const [aiMapped, setAiMapped] = useState<
    { name: string; unit: string; stock: string | null; min: string | null } | null
  >(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const isCompra = mode === "compra"

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al abrir el modal
    setMode("catalogo")
    setRows([])
    setHeaderError("")
    setFileName("")
    setImporting(false)
    setError("")
    setSummary(null)
    setTable([])
    setHeaders([])
    setAiMapping(false)
    setAiMapped(null)
  }, [open])

  async function runAiMapping(tbl: string[][], hdrs: string[]) {
    setAiMapping(true)
    setHeaderError("")
    const res = await mapInventoryHeadersAction(hdrs, tbl.slice(1, 4))
    setAiMapping(false)
    if (!res.ok) {
      setHeaderError(res.error)
      return
    }
    const map = res.data
    setRows(buildInventoryRows(tbl, map))
    setAiMapped({
      name: hdrs[map.name] ?? "?",
      unit: hdrs[map.unit] ?? "?",
      stock: map.stock >= 0 ? hdrs[map.stock] ?? null : null,
      min: map.min >= 0 ? hdrs[map.min] ?? null : null,
    })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError("")
    setSummary(null)
    setAiMapped(null)
    try {
      const text = await file.text()
      const result = parseInventoryCsv(text)
      setTable(result.table)
      setHeaders(result.headers)
      if (result.headerError) {
        setRows([])
        // Si hay data pero no reconocimos las columnas, intentamos con IA.
        if (result.table.length >= 2) {
          await runAiMapping(result.table, result.headers)
        } else {
          setHeaderError(result.headerError)
        }
      } else {
        setHeaderError("")
        setRows(result.rows)
      }
    } catch {
      setHeaderError("No se pudo leer el archivo.")
      setRows([])
    }
  }

  async function handleImport() {
    const payload = toImportPayload(rows)
    if (payload.length === 0 || importing) return
    setImporting(true)
    setError("")
    const res = await importIngredientsAction(payload, mode)
    setImporting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSummary(res.data)
    onImported()
  }

  const validCount = rows.filter((r) => r.valid).length
  const invalidCount = rows.length - validCount

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={importing}
      size="xl"
      title="Importar inventario (CSV)"
      description="Sube un archivo CSV con tus insumos. Los que ya existan se actualizan; los nuevos se crean."
    >
      {summary ? (
        // -------- RESUMEN --------
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Creados</p>
              <p className="mt-0.5 text-2xl font-extrabold text-emerald-700">{summary.created}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Actualizados</p>
              <p className="mt-0.5 text-2xl font-extrabold text-sky-700">{summary.updated}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Omitidos</p>
              <p className="mt-0.5 text-2xl font-extrabold text-stone-700">{summary.skipped.length}</p>
            </div>
          </div>

          {summary.skipped.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1 text-xs font-bold text-amber-800">Filas omitidas</p>
              <ul className="space-y-0.5 text-xs text-amber-700">
                {summary.skipped.map((s, i) => (
                  <li key={i}>
                    <span className="font-semibold">{s.name || "(sin nombre)"}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600"
            >
              Listo
            </button>
          </div>
        </div>
      ) : (
        // -------- CARGA + PREVIEW --------
        <div className="space-y-4">
          {/* MODO */}
          <div>
            <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
              {(["catalogo", "compra"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={importing}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                    mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {m === "catalogo" ? "Definir inventario" : "Registrar compra"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-stone-500">
              {isCompra
                ? "Suma la cantidad comprada a los insumos existentes (sin tocar los mínimos). Los que no existan, se crean."
                : "Crea o actualiza insumos: fija el stock y el mínimo de alerta."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-xs text-stone-600">
              Columnas:{" "}
              <span className="font-semibold">
                {isCompra ? "Nombre, Unidad, Cantidad" : "Nombre, Unidad, Stock, Mínimo"}
              </span>
              . Unidad: unidad, g, kg, ml, L.
            </p>
            <button
              type="button"
              onClick={downloadInventoryTemplate}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-stone-700 transition hover:bg-stone-50"
            >
              Descargar plantilla
            </button>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={handleFile}
              className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-orange-600"
            />
            {fileName && <p className="mt-1.5 text-[11px] text-stone-500">{fileName}</p>}
          </div>

          {aiMapping && (
            <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
              ✨ Mapeando columnas con IA…
            </p>
          )}

          {aiMapped && !headerError && (
            <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
              ✨ Columnas detectadas con IA — <b>Nombre</b>: “{aiMapped.name}” · <b>Unidad</b>: “
              {aiMapped.unit}”
              {aiMapped.stock ? ` · Stock: “${aiMapped.stock}”` : ""}
              {aiMapped.min ? ` · Mínimo: “${aiMapped.min}”` : ""}
            </p>
          )}

          {headerError && !aiMapping && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {headerError}
              {table.length >= 2 && (
                <button
                  type="button"
                  onClick={() => runAiMapping(table, headers)}
                  className="ml-2 font-bold underline"
                >
                  Reintentar con IA
                </button>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-emerald-700">{validCount} válidas</span>
                {invalidCount > 0 && (
                  <span className="font-bold text-red-600">{invalidCount} con error</span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                    <tr>
                      <th className="px-3 py-2 font-bold">Insumo</th>
                      <th className="px-3 py-2 font-bold">{isCompra ? "Cantidad" : "Stock"}</th>
                      {!isCompra && <th className="px-3 py-2 font-bold">Mínimo</th>}
                      <th className="px-3 py-2 font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.valid ? "" : "bg-red-50/50"}>
                        <td className="px-3 py-1.5 text-stone-800">{r.name || "—"}</td>
                        <td className="px-3 py-1.5 tabular-nums text-stone-700">
                          {r.valid && r.base ? formatStock(r.baseStock, r.base) : "—"}
                        </td>
                        {!isCompra && (
                          <td className="px-3 py-1.5 tabular-nums text-stone-700">
                            {r.valid && r.base ? formatStock(r.baseMin, r.base) : "—"}
                          </td>
                        )}
                        <td className="px-3 py-1.5">
                          {r.valid ? (
                            <span className="text-emerald-700">Listo</span>
                          ) : (
                            <span className="text-red-600">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importando..." : `Importar ${validCount} insumo${validCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
