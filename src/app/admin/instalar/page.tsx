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
          Descargá los instaladores de MESA para tus equipos. Las apps se
          mantienen al día solas y te avisan cuando hay una versión nueva.
        </p>
      </section>
      <InstallAppSection />
    </div>
  )
}
