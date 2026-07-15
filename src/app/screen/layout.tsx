import { ModuleGate } from "@/components/ModuleGate"

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate area="admin">{children}</ModuleGate>
}
