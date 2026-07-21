"use client"

import { useId } from "react"

/**
 * Rostro de MANUEL, el asistente de MESA: carita de piel clara con gorro de
 * chef sobre el anillo naranja de la marca. SVG inline para que escale nítido
 * en el botón flotante, el header del chat y los mensajes (sin assets).
 *
 * `animated`: parpadea cada ~4,6 s (clase manuel-blink en globals.css, respeta
 * prefers-reduced-motion). Se activa en el botón flotante y el chat abierto;
 * los mini-avatares de los mensajes van estáticos para no distraer.
 */
export function ManuelAvatar({
  size = 40,
  className,
  animated = false,
}: {
  size?: number
  className?: string
  animated?: boolean
}) {
  // id único por instancia: el avatar se renderiza varias veces en el chat y
  // los <linearGradient> no deben colisionar entre sí.
  const gid = useId()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label="Manuel, asistente de MESA"
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      {/* anillo de marca */}
      <circle cx="64" cy="64" r="62" fill={`url(#${gid})`} />
      {/* rostro: piel clara */}
      <circle cx="64" cy="72" r="43" fill="#FFE3C7" />
      {/* gorro de chef: copa esponjosa */}
      <g fill="#FFF8F0">
        <circle cx="43" cy="30" r="12" />
        <circle cx="64" cy="24" r="15" />
        <circle cx="85" cy="30" r="12" />
        <rect x="35" y="27" width="58" height="12" rx="4" />
      </g>
      {/* pliegue entre copa y banda */}
      <rect x="37" y="39" width="54" height="2.5" fill="#F0C9A0" opacity="0.8" />
      {/* banda del gorro */}
      <rect x="37" y="41" width="54" height="9" rx="3.5" fill="#FFF8F0" />
      {/* ojos (parpadean si animated) */}
      <g fill="#451A03" className={animated ? "manuel-eyes" : undefined}>
        <rect x="46" y="60" width="9" height="16" rx="4.5" />
        <rect x="73" y="60" width="9" height="16" rx="4.5" />
      </g>
      {/* mejillas rosadas */}
      <g fill="#FCA96F" opacity="0.55">
        <circle cx="40" cy="80" r="6.5" />
        <circle cx="88" cy="80" r="6.5" />
      </g>
      {/* sonrisa */}
      <path
        d="M 50 84 Q 64 96 78 84"
        fill="none"
        stroke="#451A03"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  )
}
