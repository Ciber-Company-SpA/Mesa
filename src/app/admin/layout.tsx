import type { Metadata } from "next"
import { AdminGuard } from "./AdminGuard"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { OnboardingModal } from "@/components/admin/OnboardingModal"

export const metadata: Metadata = {
  title: "Administración",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-stone-50 text-stone-950">
        <AdminSidebar />
        <main
          style={{ marginLeft: "var(--sidebar-w, 15rem)" }}
          className="min-h-screen px-4 py-6 transition-[margin-left] duration-200 sm:px-6 lg:px-8"
        >
          {children}
        </main>
        <OnboardingModal />
      </div>
    </AdminGuard>
  )
}