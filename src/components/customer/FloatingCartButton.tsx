type FloatingCartButtonProps = {
  itemCount?: number
  totalLabel?: string
}

export function FloatingCartButton({
  itemCount = 0,
  totalLabel = "$0",
}: FloatingCartButtonProps) {
  return (
    <button
      className="fixed bottom-5 right-5 z-10 flex items-center gap-3 rounded-full bg-orange-500 px-5 py-4 text-stone-950 shadow-2xl shadow-orange-500/30 ring-1 ring-orange-200/50 transition hover:bg-orange-400"
      type="button"
      aria-label="Abrir carrito"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-950 text-sm font-black text-orange-200">
        {itemCount}
      </span>
      <span className="text-sm font-black">Carrito</span>
      <span className="text-sm font-black">{totalLabel}</span>
    </button>
  )
}
