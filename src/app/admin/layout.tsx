import type { Metadata } from "next"
import { AdminGuard } from "./AdminGuard"

export const metadata: Metadata = {
  title: "Admin",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>
}