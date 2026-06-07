import { notFound } from "next/navigation"
import { getMenuData } from "@/lib/menu/get-menu-data"
import { getTemplateDesign } from "@/lib/menu/templates"
import { ClearDinerTokenOnMount } from "./clear-token"

export const revalidate = 300

export default async function GraciasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let menu
  try {
    menu = await getMenuData(id)
  } catch {
    notFound()
  }

  const design = getTemplateDesign(menu.restaurant?.menu_template)
  const name = menu.restaurant?.restaurant_name ?? "el restaurante"

  return (
    <main className={`relative min-h-screen overflow-hidden ${design.mainClass}`}>
      <div className={`pointer-events-none fixed inset-0 ${design.overlayClass}`} />

      <ClearDinerTokenOnMount tableId={menu.tableId ?? null} />

      <section className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center md:max-w-2xl">
        <div className={`flex h-24 w-24 items-center justify-center rounded-full text-5xl shadow-2xl shadow-black/30 ${design.abiertoBadge}`}>
          ✨
        </div>

        <h1 className={`mt-8 text-4xl font-black tracking-tight ${design.titleClass}`}>
          ¡Gracias por venir!
        </h1>

        <p className={`mt-4 max-w-md text-base leading-relaxed ${design.cardDesc}`}>
          Esperamos que hayas disfrutado tu visita a <strong className={design.titleClass}>{name}</strong>.
          Vuelve pronto.
        </p>

      </section>
    </main>
  )
}
