"use client"

import { useEffect, useMemo, useState } from "react"
import type { ProductOptionForm } from "@/lib/validation/product"

type ProductOptionsEditorProps = {
  options: ProductOptionForm[]
  disabled?: boolean
  onAddOption: () => void
  onRemoveOption: (localId: string) => void
  onOptionNameChange: (localId: string, value: string) => void
  onOptionPriceChange: (localId: string, value: string) => void
  onOptionImageChange: (localId: string, file: File | null) => void
}

function OptionImageInput({
  option,
  disabled,
  inputId,
  onImageChange,
}: {
  option: ProductOptionForm
  disabled?: boolean
  inputId: string
  onImageChange: (file: File | null) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const previewUrl = useMemo(
    () => option.imageFile ? URL.createObjectURL(option.imageFile) : "",
    [option.imageFile]
  )

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const imageToShow = previewUrl || option.imageUrl

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onImageChange(event.target.files?.[0] ?? null)
          setMenuOpen(false)
        }}
      />

      {imageToShow ? (
        <div
          className="group relative aspect-video overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-contain bg-center bg-no-repeat shadow-xl"
          style={{ backgroundImage: `url("${imageToShow}")` }}
          onMouseLeave={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

          <button
            type="button"
            disabled={disabled}
            onClick={() => setMenuOpen((open) => !open)}
            className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-sm font-bold leading-none text-white shadow-lg backdrop-blur transition group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 ${
              menuOpen ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Opciones de imagen"
          >
            ...
          </button>

          {menuOpen && (
            <label
              htmlFor={inputId}
              className="absolute right-3 top-14 cursor-pointer rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black"
            >
              Cambiar imagen
            </label>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-800 px-4 py-10 text-center transition hover:border-orange-500 hover:bg-zinc-800/80"
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-2xl">
            +
          </div>
          <span className="text-sm font-semibold text-white">
            Seleccionar imagen
          </span>
          <span className="mt-1 text-xs text-zinc-400">
            PNG, JPG o WEBP
          </span>
        </label>
      )}
    </div>
  )
}

export function ProductOptionsEditor({
  options,
  disabled,
  onAddOption,
  onRemoveOption,
  onOptionNameChange,
  onOptionPriceChange,
  onOptionImageChange,
}: ProductOptionsEditorProps) {
  const isSingleOption = options.length === 1

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Opciones</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isSingleOption ? "Producto simple" : "Variantes del producto"}
          </p>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onAddOption}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-2xl font-bold leading-none text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Agregar opcion"
        >
          +
        </button>
      </div>

      {isSingleOption ? (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Precio
            </label>
            <input
              type="number"
              placeholder="8990"
              value={options[0]?.price ?? ""}
              onChange={(event) => onOptionPriceChange(options[0].localId, event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Imagen del producto
            </label>
            <OptionImageInput
              option={options[0]}
              disabled={disabled}
              inputId={`product-option-image-${options[0].localId}`}
              onImageChange={(file) => onOptionImageChange(options[0].localId, file)}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {options.map((option, index) => (
            <article
              key={option.localId}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-bold text-white">Opcion {index + 1}</h3>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemoveOption(option.localId)}
                  className="rounded-full border border-red-500/30 px-3 py-1 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-[0.95fr_1fr]">
                <OptionImageInput
                  option={option}
                  disabled={disabled}
                  inputId={`product-option-image-${option.localId}`}
                  onImageChange={(file) => onOptionImageChange(option.localId, file)}
                />

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">
                      Nombre de opcion
                    </label>
                    <input
                      type="text"
                      placeholder="Mediana"
                      value={option.name}
                      onChange={(event) => onOptionNameChange(option.localId, event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">
                      Precio
                    </label>
                    <input
                      type="number"
                      placeholder="8990"
                      value={option.price}
                      onChange={(event) => onOptionPriceChange(option.localId, event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
