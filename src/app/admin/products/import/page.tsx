"use client"

import Link from "next/link"
import { useState } from "react"
import {
  parseMenuImage,
  bulkImportMenu,
  type ParsedMenu,
  type ImportSummary,
} from "@/services/menu-import-service"
import { invalidateCategoryCaches, invalidateProductCaches } from "@/lib/cache-invalidation"

type UploadedImage = { file: File; mimeType: string; base64: string; previewUrl: string }

function formatPrice(n: number) {
  return `$${n.toLocaleString("es-CL")}`
}

// Reduce la imagen a un JPEG de máximo 1600px de ancho y devuelve el base64 + mimeType.
// Esto es crítico para que el body del Server Action no exceda el límite y para que
// Gemini procese más rápido (menos tokens de imagen).
async function fileToCompressedBase64(
  file: File
): Promise<{ base64: string; mimeType: string }> {
  const MAX_WIDTH = 1600
  const JPEG_QUALITY = 0.82

  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, MAX_WIDTH / bitmap.width)
  const width = Math.round(bitmap.width * ratio)
  const height = Math.round(bitmap.height * ratio)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas no disponible")
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob falló"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  })

  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return { base64: btoa(binary), mimeType: "image/jpeg" }
}

export default function ImportMenuPage() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedMenu | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    setError(null)
    const incoming: UploadedImage[] = []
    for (const file of Array.from(fileList).slice(0, 6 - images.length)) {
      if (!file.type.startsWith("image/")) continue
      try {
        const { base64, mimeType } = await fileToCompressedBase64(file)
        incoming.push({
          file,
          mimeType,
          base64,
          previewUrl: URL.createObjectURL(file),
        })
      } catch (err) {
        setError(`No se pudo procesar ${file.name}: ${err instanceof Error ? err.message : "error desconocido"}`)
      }
    }
    setImages((prev) => [...prev, ...incoming].slice(0, 6))
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return next
    })
  }

  async function handleParse() {
    if (parsing || images.length === 0) return
    setParsing(true)
    setError(null)
    setParsed(null)
    setSummary(null)
    try {
      const result = await parseMenuImage({
        images: images.map((i) => ({ mimeType: i.mimeType, base64: i.base64 })),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setParsed(result.data)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Error inesperado: ${err.message}`
          : "Error inesperado procesando la imagen"
      )
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!parsed || importing) return
    setImporting(true)
    setError(null)
    try {
      const result = await bulkImportMenu(parsed)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSummary(result.data)
      invalidateCategoryCaches()
      invalidateProductCaches()
    } catch (err) {
      setError(
        err instanceof Error ? `Error inesperado: ${err.message}` : "Error inesperado importando"
      )
    } finally {
      setImporting(false)
    }
  }

  function updateProductName(idx: number, name: string) {
    if (!parsed) return
    const next = { ...parsed, products: [...parsed.products] }
    next.products[idx] = { ...next.products[idx], name }
    setParsed(next)
  }

  function updateProductPrice(idx: number, price: number) {
    if (!parsed) return
    const next = { ...parsed, products: [...parsed.products] }
    next.products[idx] = { ...next.products[idx], price }
    setParsed(next)
  }

  function updateProductCategory(idx: number, category_name: string) {
    if (!parsed) return
    const next = { ...parsed, products: [...parsed.products] }
    next.products[idx] = { ...next.products[idx], category_name }
    setParsed(next)
  }

  function removeProduct(idx: number) {
    if (!parsed) return
    const next = { ...parsed, products: [...parsed.products] }
    next.products.splice(idx, 1)
    setParsed(next)
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/admin/products"
            className="text-xs font-semibold text-stone-500 hover:text-stone-900"
          >
            ← Volver a Productos
          </Link>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900">
            Importar carta
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Subí una o más fotos de tu carta. La IA va a extraer categorías, productos y variantes.
            Revisalas antes de confirmar — siempre podés editar después en el panel.
          </p>
        </div>
      </section>

      {/* UPLOAD */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-900">1. Subí las fotos de la carta</h3>
        <p className="mt-1 text-xs font-medium text-stone-500">
          Hasta 6 imágenes. PNG / JPG. Mejor si están bien iluminadas y derechas.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {images.map((img, idx) => (
            <div key={idx} className="relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt={`Carta ${idx + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/70 text-white transition hover:bg-stone-900"
                aria-label="Quitar imagen"
              >
                ×
              </button>
            </div>
          ))}
          {images.length < 6 && (
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 transition hover:border-orange-300 hover:text-orange-500">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <span className="text-3xl">+</span>
            </label>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || images.length === 0}
            className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {parsing ? "Procesando con IA..." : "Procesar carta"}
          </button>
          {images.length === 0 && (
            <span className="text-xs font-medium text-stone-400">Subí al menos una imagen.</span>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </section>

      {/* PREVIEW */}
      {parsed && !summary && (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-stone-900">2. Revisá lo extraído</h3>
              <p className="mt-1 text-xs font-medium text-stone-500">
                {parsed.products.length} productos en {parsed.categories.length} categorías. Editá lo que necesites.
              </p>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || parsed.products.length === 0}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importando..." : "Importar todo"}
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {parsed.products.map((p, idx) => (
              <div
                key={`${p.name}-${idx}`}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_140px_180px_40px]">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateProductName(idx, e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  <input
                    type="number"
                    value={p.price}
                    onChange={(e) => updateProductPrice(idx, parseInt(e.target.value || "0", 10))}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  <input
                    type="text"
                    value={p.category_name}
                    onChange={(e) => updateProductCategory(idx, e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeProduct(idx)}
                    className="rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-red-300 hover:text-red-500"
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                </div>

                {p.description && (
                  <p className="mt-2 text-xs leading-5 text-stone-500">{p.description}</p>
                )}

                {p.variants.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.variants.map((v, vi) => (
                      <span
                        key={`${v.name}-${vi}`}
                        className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700"
                      >
                        {v.name} · {formatPrice(v.price)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RESULT */}
      {summary && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-emerald-900">¡Importado!</h3>
          <ul className="mt-3 space-y-1 text-sm font-semibold text-emerald-800">
            <li>Categorías nuevas: {summary.categoriesCreated}</li>
            <li>Categorías reusadas: {summary.categoriesReused}</li>
            <li>Productos creados: {summary.productsCreated}</li>
            <li>Variantes creadas: {summary.variantsCreated}</li>
            <li>Imágenes encontradas: {summary.imagesFound}</li>
          </ul>
          {summary.skipped.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                {summary.skipped.length} items omitidos:
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
                {summary.skipped.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5">
            <Link
              href="/admin/products"
              className="inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-stone-800"
            >
              Ver productos
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
