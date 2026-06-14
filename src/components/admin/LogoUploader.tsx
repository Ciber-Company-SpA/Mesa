"use client"

import { useRef } from "react"
import { useUploadImage } from "@/hooks/useUploadImage"

type LogoUploaderProps = {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}

export function LogoUploader({ value, onChange, disabled }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { uploadImage, uploading, error } = useUploadImage()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // permite re-subir el mismo archivo
    if (!file) return

    const uploaded = await uploadImage(
      file,
      process.env.NEXT_PUBLIC_CLOUDINARY_PRODUCTS_PRESET!
    )
    if (uploaded) onChange(uploaded.secure_url)
  }

  const busy = uploading || disabled

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Logo del restaurante"
            className="h-16 w-16 rounded-2xl border border-stone-200 object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-2xl font-black text-stone-300">
            M
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : value ? "Cambiar logo" : "Subir logo"}
          </button>
          {value && !uploading && (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
        <p className="text-[11px] leading-4 text-stone-500">
          PNG o JPG, idealmente cuadrado. Opcional.
        </p>
        {error && (
          <p className="text-[11px] font-medium text-red-600">{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
