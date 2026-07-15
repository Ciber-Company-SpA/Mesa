"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useVisibleModules } from "@/hooks/useVisibleModules"
import { resolveModuleKey } from "@/lib/module-visibility"

/**
 * Bloqueo duro por URL: si el módulo que corresponde a la ruta actual está
 * desactivado en el portal Plataforma, se reemplaza la página por un aviso.
 * Fail-open: mientras carga la visibilidad (o si la RPC falla) se muestra el
 * contenido — un incidente nunca debe dejar la app inoperativa; los datos
 * siguen protegidos por RLS igualmente.
 */
export function ModuleGate({
  area,
  children,
}: {
  area: "admin" | "waiter"
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { modules, isVisible } = useVisibleModules()

  const moduleKey = resolveModuleKey(area, pathname)
  const blocked = modules != null && moduleKey != null && !isVisible(area, moduleKey)

  if (!blocked) return <>{children}</>

  const backHref = area === "admin" ? "/admin" : "/waiter/control"

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md rounded-3xl bg-white p-10 text-center ring-1 ring-stone-200 shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-2xl">
          🔒
        </span>
        <h2 className="mt-4 text-lg font-bold tracking-tight text-stone-900">
          Módulo no disponible
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Esta sección fue desactivada por el operador de la plataforma MESA.
          Si creés que es un error, contactá a soporte.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-block rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
