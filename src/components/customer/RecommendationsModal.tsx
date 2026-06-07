"use client"

import { useRef } from "react"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import { getTemplateDesign } from "@/lib/menu/templates"
import type { Product } from "@/types/product"
import type { RecommendedProduct } from "@/services/recommendation-service"

type Props = {
  isOpen: boolean
  onClose: () => void
  recommendations: RecommendedProduct[]
  products: Product[]
  design: ReturnType<typeof getTemplateDesign>
  onAdd: (productId: number, variantId: number | null, price: number) => void
  canAdd: boolean
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

export function RecommendationsModal({
  isOpen,
  onClose,
  recommendations,
  products,
  design,
  onAdd,
  canAdd,
}: Props) {
  if (!isOpen || recommendations.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 px-4 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <section
        className={`relative w-full max-w-md overflow-hidden rounded-t-[2.25rem] sm:rounded-[2.25rem] shadow-2xl shadow-black/40 ${design.card}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5">
          <div className="min-w-0">
            <p className={`text-[0.65rem] font-black uppercase tracking-[0.18em] ${design.mesaText}`}>
              Recomendados de hoy
            </p>
            <h2 className={`mt-1 text-2xl font-black tracking-tight ${design.cardName}`}>
              Lo más pedido 🔥
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 transition hover:opacity-80 ${design.pillInactive}`}
            aria-label="Cerrar recomendaciones"
          >
            ✕
          </button>
        </div>

        <ul className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {recommendations.map((reco, idx) => {
            const product = products.find((p) => p.id === reco.id)
            const firstVariant = product?.product_variants?.[0] ?? null
            return (
              <RecommendedRow
                key={reco.id}
                rank={idx + 1}
                reco={reco}
                defaultVariantId={firstVariant?.id ?? null}
                defaultVariantPrice={firstVariant?.variant_price ?? reco.productPrice}
                defaultVariantName={firstVariant?.variant_name ?? null}
                design={design}
                canAdd={canAdd}
                onAdd={onAdd}
              />
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function RecommendedRow({
  rank,
  reco,
  defaultVariantId,
  defaultVariantPrice,
  defaultVariantName,
  design,
  canAdd,
  onAdd,
}: {
  rank: number
  reco: RecommendedProduct
  defaultVariantId: number | null
  defaultVariantPrice: number
  defaultVariantName: string | null
  design: ReturnType<typeof getTemplateDesign>
  canAdd: boolean
  onAdd: (productId: number, variantId: number | null, price: number) => void
}) {
  const imgRef = useRef<HTMLImageElement | null>(null)

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!canAdd) return
    flyToCart(imgRef.current)
    onAdd(reco.id, defaultVariantId, defaultVariantPrice)
  }

  return (
    <li className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ring-white/10 ${design.cardImageBg}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ring-1 ${design.pillActive}`}>
        {rank}
      </span>

      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-black/20">
        {reco.productImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={reco.productImage}
            alt={reco.productName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-stone-400">
            +
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`line-clamp-1 text-sm font-black ${design.cardName}`}>
          {reco.productName}
          {defaultVariantName ? (
            <span className={`ml-1 text-xs font-bold ${design.cardDesc}`}>· {defaultVariantName}</span>
          ) : null}
        </p>
        <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${design.mesaText}`}>
          {reco.unitsSold} vendido{reco.unitsSold === 1 ? "" : "s"} hoy
        </p>
        <p className={`mt-1 text-sm font-black ${design.cardPrice}`}>
          {formatPrice(defaultVariantPrice)}
        </p>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black transition disabled:opacity-50 ${design.pillActive}`}
      >
        + Agregar
      </button>
    </li>
  )
}
