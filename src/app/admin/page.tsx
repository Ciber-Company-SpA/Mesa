import Link from "next/link"

const orders = [
  {
    id: 101,
    table: "Mesa 04",
    total: "$25.990",
    status: "Nuevo",
    badgeClass: "bg-orange-100 text-orange-700",
  },
  {
    id: 102,
    table: "Mesa 02",
    total: "$18.990",
    status: "Preparación",
    badgeClass: "bg-stone-950 text-white",
  },
  {
    id: 103,
    table: "Mesa 07",
    total: "$32.990",
    status: "Listo",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
]

const quickLinks = [
  { label: "Categorías", href: "/admin/categories" },
  { label: "Productos", href: "/admin/products" },
  { label: "Mesas", href: "/admin/tables" },
  { label: "Pedidos", href: "/admin/orders" },
]

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-4 py-5 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-stone-600">Panel admin</p>
            <h1 className="text-3xl font-bold tracking-tight">Café Aurora</h1>
          </div>

          <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm">
            Abierto
          </span>
        </header>

        <nav className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-600 hover:shadow-md"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-stone-600">Ventas del día</p>
              <p className="text-4xl font-bold tracking-tight">$428k</p>
            </div>

            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-right">
              <p className="text-sm font-bold text-orange-700">24 completados</p>
              <p className="text-sm text-stone-600">pedidos cerrados</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="h-2 rounded-full bg-stone-100">
              <div className="h-2 w-4/5 rounded-full bg-orange-500" />
            </div>

            <div className="flex justify-between text-sm text-stone-600">
              <span>Calculado desde pedidos completados</span>
              <span>Hoy</span>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/orders"
            className="rounded-[2rem] bg-orange-500 p-5 text-white shadow-xl shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600"
          >
            <p className="text-sm font-medium text-orange-50">Pedidos activos</p>
            <p className="mt-3 text-4xl font-bold tracking-tight">18</p>
          </Link>

          <Link
            href="/admin/tables"
            className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm text-stone-600">Mesas</p>
            <p className="mt-3 text-4xl font-bold tracking-tight">16</p>
          </Link>
        </section>

        <section className="mt-4 space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href="/admin/orders"
              className="block rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold">{order.table}</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    Pedido #{order.id} · {order.total}
                  </p>
                </div>

                <span className={`rounded-full px-4 py-2 text-sm font-bold ${order.badgeClass}`}>
                  {order.status}
                </span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
