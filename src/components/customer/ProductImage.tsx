"use client"

import { useImageHasBackground } from "@/hooks/useImageHasBackground"

type ProductImageProps = {
  src: string | null
  alt: string
  className?: string
  imgRef?: React.RefObject<HTMLImageElement | null>
  /**
   * Dirección del degradado de fundido hacia el contenedor. Solo se aplica a
   * imágenes CON fondo; los recortes transparentes se muestran limpios.
   */
  fade?: "right" | "bottom"
}

/**
 * Imagen de producto con tratamiento adaptativo:
 * - CON fondo (foto): backdrop borroso + cover + degradado de fundido.
 * - SIN fondo (recorte transparente): contain, sin blur ni degradado.
 * La detección la hace useImageHasBackground (muestreo de alfa del borde).
 */
export function ProductImage({ src, alt, className = "", imgRef, fade }: ProductImageProps) {
  const hasBackground = useImageHasBackground(src)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {src ? (
        hasBackground ? (
          <>
            {/* Backdrop borroso para rellenar el marco. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center blur-2xl brightness-[0.55]"
              style={{ backgroundImage: `url("${src}")` }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              loading="lazy"
              className="absolute inset-0 z-[1] h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
            />
            {fade === "right" ? (
              <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(90deg,transparent_45%,#161618_100%)]" />
            ) : null}
            {fade === "bottom" ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-28 bg-gradient-to-t from-[#0f0f10] to-transparent" />
            ) : null}
          </>
        ) : (
          // Recorte transparente: imagen limpia, sin blur ni degradado.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 z-[1] h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.04]"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-600">
          <svg className="h-6 w-6 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
          </svg>
        </div>
      )}
    </div>
  )
}
