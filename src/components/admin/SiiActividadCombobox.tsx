"use client"

import { useEffect, useMemo, useRef, useState } from "react"

export type SiiActividad = {
  codigo: string
  glosa: string
  categoria?: number
  afecto_iva?: boolean
}

/**
 * Carga diferida del catálogo oficial de actividades económicas del SII
 * (CIIU4.CL). El JSON solo se descarga cuando se monta la página de pagos,
 * así no infla el resto de la app. El módulo queda cacheado por el bundler,
 * de modo que dos comboboxes comparten una sola descarga.
 */
export function useSiiActividades() {
  const [items, setItems] = useState<SiiActividad[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    import("@/data/sii-actividades-economicas.json")
      .then((mod) => {
        if (!active) return
        setItems(((mod.default ?? []) as SiiActividad[]))
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { items, loading }
}

function normalize(value: string): string {
  // NFD + quitar marcas diacríticas combinantes (U+0300–U+036F) para que
  // "cafe" encuentre "café" y viceversa.
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

const MAX_RESULTS = 60

const INPUT_CLASS =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"

/**
 * Buscador (combobox) sobre el catálogo del SII. No acepta texto libre: el
 * valor final siempre proviene de un ítem del listado, para no arriesgar un
 * código o glosa inválidos en un dato tributario. Al perder el foco, el input
 * vuelve a mostrar exactamente el valor guardado.
 */
export function SiiActividadCombobox({
  items,
  loading,
  value,
  placeholder,
  disabled,
  onSelect,
}: {
  items: SiiActividad[]
  loading: boolean
  value: string
  placeholder?: string
  disabled?: boolean
  onSelect: (item: SiiActividad) => void
}) {
  const [query, setQuery] = useState(value ?? "")
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // El input refleja el valor guardado salvo mientras se está buscando.
  useEffect(() => {
    setQuery(value ?? "")
  }, [value])

  const results = useMemo(() => {
    if (!open) return []
    const q = normalize(query)
    const out: SiiActividad[] = []
    if (!q) {
      for (const it of items) {
        out.push(it)
        if (out.length >= MAX_RESULTS) break
      }
      return out
    }
    // Prioriza coincidencias por código y por comienzo de glosa.
    const starts: SiiActividad[] = []
    const contains: SiiActividad[] = []
    for (const it of items) {
      const g = normalize(it.glosa)
      if (it.codigo.startsWith(q) || g.startsWith(q)) starts.push(it)
      else if (g.includes(q)) contains.push(it)
      if (starts.length >= MAX_RESULTS) break
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS)
  }, [items, query, open])

  function choose(item: SiiActividad) {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    onSelect(item)
    setQuery(`${item.codigo} - ${item.glosa}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder={loading ? "Cargando catálogo del SII…" : placeholder}
        disabled={disabled || loading}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          setOpen(true)
          setQuery("")
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            setOpen(false)
            setQuery(value ?? "")
          }, 120)
        }}
        className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
      />

      {open ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs font-medium text-stone-500">
              {normalize(query)
                ? "Sin resultados. Probá con otro código o palabra."
                : `Escribí un código o nombre para buscar entre ${items.length.toLocaleString("es-CL")} actividades.`}
            </p>
          ) : (
            <ul className="py-1">
              {results.map((it) => (
                <li key={it.codigo}>
                  <button
                    type="button"
                    // onMouseDown corre antes del onBlur del input, evitando que
                    // el dropdown se cierre antes de registrar la selección.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      choose(it)
                    }}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left transition hover:bg-orange-50"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-orange-600 tabular-nums">
                      {it.codigo}
                    </span>
                    <span className="text-xs font-medium leading-5 text-stone-700">
                      {it.glosa}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
