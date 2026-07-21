"use client"

import { useId } from "react"

/**
 * Rostro de MANUEL, el asistente de MESA: carita amistosa con gorro de chef
 * sobre el degradado naranja de la marca. SVG inline para que escale nítido
 * en el botón flotante, el header del chat y los mensajes (sin assets).
 */
export function ManuelAvatar({ size = 40, className }: { size?: number; className?: string }) {
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
      <circle cx="64" cy="64" r="62" fill={`url(#${gid})`} />
      {/* gorro de chef: copa esponjosa */}
      <g fill="#FFF8F0">
        <circle cx="43" cy="35" r="12" />
        <circle cx="64" cy="29" r="15" />
        <circle cx="85" cy="35" r="12" />
        <rect x="35" y="32" width="58" height="12" rx="4" />
      </g>
      {/* pliegue entre copa y banda */}
      <rect x="37" y="44" width="54" height="2.5" fill="#F97316" opacity="0.55" />
      {/* banda del gorro */}
      <rect x="37" y="46" width="54" height="9" rx="3.5" fill="#FFF8F0" />
      {/* ojos */}
      <g fill="#451A03">
        <rect x="45" y="63" width="9" height="17" rx="4.5" />
        <rect x="74" y="63" width="9" height="17" rx="4.5" />
      </g>
      {/* mejillas */}
      <g fill="#FFFFFF" opacity="0.22">
        <circle cx="38" cy="83" r="6" />
        <circle cx="90" cy="83" r="6" />
      </g>
      {/* sonrisa */}
      <path
        d="M 49 89 Q 64 101 79 89"
        fill="none"
        stroke="#451A03"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  )
}
