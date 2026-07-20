import type { Metadata } from "next"
import { InstallAppSection } from "@/components/admin/InstallAppSection"

export const metadata: Metadata = {
  title: "Instalar app",
}

export default function InstallPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">
          Instalar app
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Instalá MESA como una app en tus dispositivos. Siempre se mantiene al
          día con la última versión, sin que tengas que actualizar nada.
        </p>
      </section>
      <InstallAppSection />
    </div>
  )
}
