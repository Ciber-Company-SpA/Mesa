"use client"

import { useAdminPushRegistration } from "@/hooks/useAdminPushRegistration"

/**
 * Monta el registro de Web Push del panel admin. Es un no-op mientras no haya
 * config de Firebase en el entorno (credential-ready). No renderiza nada.
 */
export function AdminPushRegister() {
  useAdminPushRegistration(true)
  return null
}
