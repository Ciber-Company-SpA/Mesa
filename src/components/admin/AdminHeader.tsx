"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useRestaurant } from "@/hooks/useRestaurant"
import { useTableList } from "@/hooks/useTableList"
import { useOrderList } from "@/hooks/useOrderList"
import { useOrderStats } from "@/hooks/useOrderStats"
import { useAdminProfile } from "@/hooks/useAdminProfile"
import { useProductList } from "@/hooks/useProductList"
import { useCategoryList } from "@/hooks/useCategoryList"
import { INITIAL_WAITERS } from "@/lib/mock-waiters"

export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { restaurant, loading: loadingRestaurant } = useRestaurant()
  const { profile, loading: loadingProfile } = useAdminProfile()
  const { totalTables, loading: loadingTables } = useTableList()
  const { totalProducts, loading: loadingProducts } = useProductList()
  const { totalCategories, loading: loadingCategories } = useCategoryList()
  const { activeOrdersCount, loading: loadingOrders } = useOrderList({ limit: 50 })
  const { dailySales, loading: loadingStats } = useOrderStats()

  const formatBadge = (loading: boolean, value: number) => {
    if (loading) return "..."
    return String(value)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const tabs = [
    {
      label: "Resumen",
      href: "/admin",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      label: "Pedidos",
      href: "/admin/orders",
      badge: formatBadge(loadingOrders, activeOrdersCount),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      label: "Mesas",
      href: "/admin/tables",
      badge: formatBadge(loadingTables, totalTables),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Productos",
      href: "/admin/products",
      badge: formatBadge(loadingProducts, totalProducts),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      label: "Categorias",
      href: "/admin/categories",
      badge: formatBadge(loadingCategories, totalCategories),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Meseros",
      href: "/admin/waiters",
      badge: String(INITIAL_WAITERS.length),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  const isDeepRoute = pathname !== "/admin" &&
                     pathname !== "/admin/orders" &&
                     pathname !== "/admin/tables" &&
                     pathname !== "/admin/products" &&
                     pathname !== "/admin/categories" &&
                     pathname !== "/admin/waiters"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200 bg-stone-50/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all duration-300">
      {/* Sutil gradiente premium de fondo */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-orange-500/0 via-orange-500/[0.007] to-stone-500/0 pointer-events-none" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* FILA SUPERIOR: Info local y Acciones rapidas */}
        <div className="flex h-16 items-center justify-between gap-4 border-b border-stone-100 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-100 text-xl font-bold shadow-inner">
              M
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
                  {loadingRestaurant ? (
                    <span className="inline-block h-5 w-24 animate-pulse rounded bg-stone-200" />
                  ) : (
                    restaurant?.restaurant_name ?? "Mi Restaurante"
                  )}
                </h1>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
              </div>
              <p className="hidden text-xs font-medium text-stone-500 sm:block">
                Control de pedidos, mesas y cocina - Panel en tiempo real
              </p>
              <p className="block text-[10px] font-medium text-stone-500 sm:hidden">
                Panel operativo en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Abierto
            </span>
            <div className="h-7 w-[1px] bg-stone-200" />
            <div className="relative group -mb-2 pb-2">
              <button className="flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
                <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                  {loadingProfile ? "..." : profile?.initials ?? "A"}
                </span>
                <span className="hidden sm:inline">
                  {loadingProfile ? "Perfil" : profile?.name ?? "Perfil"}
                </span>
              </button>

              <div className="absolute right-0 top-full z-50 hidden w-64 pt-2 group-hover:block">
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10">
                  <div className="border-b border-stone-100 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-sm font-bold text-stone-700">
                        {loadingProfile ? "..." : profile?.initials ?? "A"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-stone-900">
                          {loadingProfile ? "Cargando perfil..." : profile?.name ?? "Admin"}
                        </p>
                        <p className="truncate text-xs font-medium text-stone-500">
                          {profile?.email || "Sesion administrador"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 p-3 text-xs">
                    <button
                      onClick={handleSignOut}
                      className="w-full rounded-xl px-3 py-2 text-left font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FILA INFERIOR: Navegacion de pestanas e indicadores */}
        <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <nav className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none sm:pb-0">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || (!isDeepRoute && tab.href === "/admin" && pathname === "/admin")
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition duration-150 ease-in-out shrink-0 ${
                    isActive
                      ? "bg-stone-900 text-white shadow-sm"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      isActive ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Metricas Minimalistas en el Header */}
          <div className="flex items-center justify-between border-t border-stone-100 pt-2 sm:justify-end sm:border-0 sm:pt-0 gap-4">
            <div className="flex items-center gap-4 text-[11px] font-bold text-stone-500">
              <div className="flex items-center gap-1">
                <span className="text-stone-400">Pedidos:</span>
                <span className="rounded-md bg-orange-50 px-1.5 py-0.5 font-bold text-orange-700 tabular-nums ring-1 ring-orange-200/50">
                  {loadingOrders ? "..." : activeOrdersCount}
                </span>
              </div>
              <div className="h-3.5 w-[1px] bg-stone-200" />
              <div className="flex items-center gap-1">
                <span className="text-stone-400">Mesas:</span>
                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-bold text-stone-850 tabular-nums ring-1 ring-stone-300/40">
                  {loadingTables ? "..." : totalTables}
                </span>
              </div>
              <div className="h-3.5 w-[1px] bg-stone-200" />
              <div className="flex items-center gap-1">
                <span className="text-stone-400">Ventas:</span>
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 tabular-nums ring-1 ring-emerald-200/50">
                  {loadingStats ? "..." : `$${dailySales.toLocaleString("es-CL")}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

