"use client"

import { use, useState } from "react"
import { useMenuData } from "@/hooks/useMenuData"

const accents = [
  "from-amber-200 to-orange-300",
  "from-rose-200 to-orange-200",
  "from-lime-200 to-emerald-200",
]

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { restaurant, categories, products, tableNumber, loading, error } = useMenuData(id)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products

  const featuredProducts = products.slice(0, 3)

  if (loading) return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <p className="text-sm text-stone-500">Cargando menú...</p>
    </main>
  )

  if (error) return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <p className="text-sm text-red-500">{error}</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-stone-50 pb-28 text-stone-950">
      <section className="bg-stone-950 px-4 pb-8 pt-5 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-orange-200">Mesa {tableNumber}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{restaurant?.restaurant_name}</h1>
            </div>
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15">
              Abierto
            </div>
          </header>

          <div className="mt-7 rounded-[2rem] bg-white p-5 text-stone-950 shadow-xl shadow-black/20">
            <p className="text-sm font-semibold text-orange-600">Recomendado hoy</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Sabores de temporada listos para pedir.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
                  Explora la carta, agrega tus favoritos al carrito y confirma tu pedido desde la mesa.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {featuredProducts.map((item, index) => (
                  <div
                    key={item.id}
                    className={`min-h-28 rounded-3xl bg-gradient-to-br ${accents[index]} p-3`}
                  >
                    <p className="text-xs font-bold text-stone-700">{item.categories?.category_name}</p>
                    <p className="mt-8 text-sm font-bold leading-tight">
                      ${item.product_price.toLocaleString("es-CL")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {/* Filtros por categoría */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold shadow-sm transition ${
              selectedCategory === null
                ? "bg-orange-500 text-white"
                : "border border-stone-200 bg-white text-stone-700"
            }`}
          >
            Todo
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold shadow-sm transition ${
                selectedCategory === cat.id
                  ? "bg-orange-500 text-white"
                  : "border border-stone-200 bg-white text-stone-700"
              }`}
            >
              {cat.category_name}
            </button>
          ))}
        </div>

        {/* Cards destacadas */}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {featuredProducts.map((item, index) => (
            <article
              key={item.id}
              className="cursor-pointer overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${accents[index]}`}>
                {item.product_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product_image}
                    alt={item.product_name}
                    className="h-full w-full object-contain p-3"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                      {item.categories?.category_name}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{item.product_name}</h3>
                  </div>
                  <p className="font-bold text-stone-950">
                    ${item.product_price.toLocaleString("es-CL")}
                  </p>
                </div>
                <p className="text-sm leading-6 text-stone-600">{item.product_description}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Lista completa */}
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-stone-500">Carta completa</p>
            <h2 className="text-2xl font-bold tracking-tight">Elige tu próximo plato</h2>
          </div>
          <p className="hidden text-sm font-semibold text-stone-500 sm:block">
            {filteredProducts.length} productos
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {filteredProducts.map((item) => (
            <article
              key={item.id}
              className="flex cursor-pointer gap-4 rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex aspect-square h-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-stone-100 sm:h-32">
                {item.product_image
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product_image}
                      alt={item.product_name}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  )
                  : <span className="text-xs font-bold text-stone-400">Sin imagen</span>
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                      {item.categories?.category_name}
                    </span>
                    <h3 className="mt-2 font-bold">{item.product_name}</h3>
                  </div>
                  <p className="shrink-0 font-bold">
                    ${item.product_price.toLocaleString("es-CL")}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-5 text-stone-600">{item.product_description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <button
        className="fixed bottom-5 right-5 flex items-center gap-3 rounded-full bg-orange-500 px-5 py-4 text-white shadow-2xl shadow-orange-500/30 transition hover:bg-orange-600"
        type="button"
        aria-label="Abrir carrito"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-orange-600">
          0
        </span>
        <span className="text-sm font-bold">Carrito</span>
        <span className="text-sm font-bold">$0</span>
      </button>
    </main>
  )
}
