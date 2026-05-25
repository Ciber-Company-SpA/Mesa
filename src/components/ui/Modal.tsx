"use client"

import { useEffect } from "react"
import type { ReactNode } from "react"

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Ancho máximo del modal. Default: max-w-md. */
  size?: "sm" | "md" | "lg" | "xl"
  /** Si está en true, el modal no se cierra al click en backdrop o Escape. */
  locked?: boolean
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-3xl",
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  locked = false,
}: ModalProps) {
  useEffect(() => {
    if (!open || locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, locked, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
      onClick={() => { if (!locked) onClose() }}
    >
      <div
        className={`w-full ${SIZE_CLASS[size]} max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="modal-title" className="text-lg font-bold text-stone-900">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-xs text-stone-600">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
