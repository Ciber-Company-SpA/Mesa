"use client"

import { useState } from "react"
import type { MenuPromotion } from "@/types/menu"

function formatPrice(price: number) {
  return `$${Math.round(price).toLocaleString("es-CL")}`
}

function discountPct(original: number, promo: number) {
  if (!original || original <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - promo / original) * 100)))
}

function PromoCard({
  promo,
  onAdd,
}: {
  promo: MenuPromotion
  onAdd: (id: number) => void | Promise<void>
}) {
  const [added, setAdded] = useState(false)
  const pct = discountPct(promo.original_total, promo.promo_price)

  async function handleAdd() {
    await onAdd(promo.id)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const includes = promo.items
    .map((it) => `${it.quantity}× ${it.product_name}${it.variant_name ? ` (${it.variant_name})` : ""}`)
    .join(" · ")

  return (
    <div className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#27272a] bg-[#18181b]">
      <div className="relative h-28 w-full bg-gradient-to-br from-[#fb923c]/25 to-[#7c2d12]/20">
        {promo.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.image_url} alt={promo.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🏷️</div>
        )}
        {pct > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-[#fb923c] px-2 py-0.5 text-[11px] font-black text-[#1a1a1a]">
            {pct}% OFF
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-[15px] font-extrabold text-[#fafafa]">{promo.name}</h3>
        <p className="line-clamp-2 min-h-[2rem] text-[12px] leading-4 text-[#a1a1aa]">
          {promo.description || includes}
        </p>

        <div className="mt-1 flex items-end gap-2">
          {pct > 0 && (
            <span className="text-[12px] text-[#71717a] line-through">
              {formatPrice(promo.original_total)}
            </span>
          )}
          <span className="text-[18px] font-black text-[#fb923c]">{formatPrice(promo.promo_price)}</span>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className={`mt-2 flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-extrabold transition active:scale-[0.98] ${
            added ? "bg-emerald-500 text-[#052e16]" : "bg-[#fb923c] text-[#1a1a1a]"
          }`}
        >
          {added ? "Agregado ✓" : "Agregar promo"}
        </button>
      </div>
    </div>
  )
}

export function PromotionsSection({
  promotions,
  onAdd,
}: {
  promotions: MenuPromotion[]
  onAdd: (id: number) => void | Promise<void>
}) {
  if (!promotions || promotions.length === 0) return null

  return (
    <section className="px-4 pt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[16px]">🔥</span>
        <h2 className="text-[16px] font-black tracking-tight text-[#fafafa]">Promociones</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {promotions.map((promo) => (
          <PromoCard key={promo.id} promo={promo} onAdd={onAdd} />
        ))}
      </div>
    </section>
  )
}
