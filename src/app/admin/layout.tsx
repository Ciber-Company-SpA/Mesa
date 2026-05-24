import type { Metadata } from "next"
import { AdminGuard } from "./AdminGuard"
import { AdminHeader } from "@/components/admin/AdminHeader"

export const metadata: Metadata = {
  title: "Administración",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-stone-50 text-stone-950 flex flex-col">
        <AdminHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 flex-1">
          {children}
        </main>
      </div>
    </AdminGuard>
  )
}