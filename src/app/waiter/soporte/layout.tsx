import { ModuleGate } from "@/components/ModuleGate"

export default function WaiterSoporteLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate area="waiter">{children}</ModuleGate>
}
