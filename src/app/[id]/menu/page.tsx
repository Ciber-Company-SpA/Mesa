"use client"

const categories = ["Todo", "Entradas", "Platos", "Bebidas", "Postres"]

const featuredItems = [
  {
    name: "Risotto de setas",
    category: "Platos",
    description: "Arroz cremoso, champiñones salteados, parmesano y aceite de trufa.",
    price: "$12.900",
    accent: "from-amber-200 to-orange-300",
  },
  {
    name: "Tartar de salmón",
    category: "Entradas",
    description: "Salmón fresco, palta, sésamo tostado y salsa cítrica de la casa.",
    price: "$9.800",
    accent: "from-rose-200 to-orange-200",
  },
  {
    name: "Limonada albahaca",
    category: "Bebidas",
    description: "Limón natural, albahaca fresca y hielo frappé.",
    price: "$3.900",
    accent: "from-lime-200 to-emerald-200",
  },
]

const menuItems = [
  {
    name: "Hamburguesa Mesa",
    category: "Platos",
    description: "Carne smash, cheddar, cebolla caramelizada, pepinillos y salsa ahumada.",
    price: "$10.900",
    tag: "Popular",
    color: "bg-orange-100",
  },
  {
    name: "Ensalada burrata",
    category: "Entradas",
    description: "Tomates asados, burrata cremosa, rúcula, pesto y focaccia crocante.",
    price: "$8.700",
    tag: "Nuevo",
    color: "bg-emerald-100",
  },
  {
    name: "Ñoquis gratinados",
    category: "Platos",
    description: "Ñoquis de papa, salsa pomodoro, albahaca y mozzarella gratinada.",
    price: "$11.400",
    tag: "Chef",
    color: "bg-stone-200",
  },
  {
    name: "Cheesecake frutos rojos",
    category: "Postres",
    description: "Base de galleta, crema suave de queso y coulis de berries.",
    price: "$5.900",
    tag: "Dulce",
    color: "bg-pink-100",
  },
]

export default function CustomerPage() {
  return (
    <main className="min-h-screen bg-stone-50 pb-28 text-stone-950">
      <section className="bg-stone-950 px-4 pb-8 pt-5 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-orange-200">Mesa 04</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Café Aurora</h1>
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
                {featuredItems.map((item) => (
                  <div
                    key={item.name}
                    className={`min-h-28 rounded-3xl bg-gradient-to-br ${item.accent} p-3`}
                  >
                    <p className="text-xs font-bold text-stone-700">{item.category}</p>
                    <p className="mt-8 text-sm font-bold leading-tight">{item.price}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category, index) => (
            <button
              key={category}
              className={`shrink-0 rounded-full px-5 py-3 text-sm font-bold shadow-sm transition ${
                index === 0
                  ? "bg-orange-500 text-white"
                  : "border border-stone-200 bg-white text-stone-700"
              }`}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {featuredItems.map((item) => (
            <article
              key={item.name}
              className="cursor-pointer overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`h-36 bg-gradient-to-br ${item.accent}`} />
              <div className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                      {item.category}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{item.name}</h3>
                  </div>
                  <p className="font-bold text-stone-950">{item.price}</p>
                </div>
                <p className="text-sm leading-6 text-stone-600">{item.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-stone-500">Carta completa</p>
            <h2 className="text-2xl font-bold tracking-tight">Elige tu próximo plato</h2>
          </div>
          <p className="hidden text-sm font-semibold text-stone-500 sm:block">4 productos</p>
        </div>

        <div className="mt-4 grid gap-3">
          {menuItems.map((item) => (
            <article
              key={item.name}
              className="flex cursor-pointer gap-4 rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl ${item.color}`}>
                <span className="text-xs font-bold text-stone-700">{item.category}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                      {item.tag}
                    </span>
                    <h3 className="mt-2 font-bold">{item.name}</h3>
                  </div>
                  <p className="shrink-0 font-bold">{item.price}</p>
                </div>
                <p className="mt-2 text-sm leading-5 text-stone-600">{item.description}</p>
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
          3
        </span>
        <span className="text-sm font-bold">Carrito</span>
        <span className="text-sm font-bold">$26.600</span>
      </button>
    </main>
  )
}
