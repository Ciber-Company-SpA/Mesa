/**
 * Tipo + helpers de display del staff logueado.
 *
 * La autenticación se hace vía Supabase Auth (cookies). Este archivo NO
 * almacena nada en localStorage — solo formatea datos para la UI y guarda la
 * preferencia local del timeout de inactividad.
 */

export interface Staff {
  id: number
  name: string
  role: "admin" | "manager" | "waiter" | "kitchen" | "cashier"
  restaurantId: number
  avatar_color: string
}

const STAFF_TIMEOUT_KEY = "mesa_staff_timeout_setting"
const DEFAULT_STAFF_TIMEOUT = 300

const AVATAR_GRADIENTS = [
  "from-orange-500 to-amber-500",
  "from-emerald-500 to-teal-500",
  "from-indigo-500 to-blue-500",
  "from-rose-500 to-pink-500",
  "from-purple-500 to-fuchsia-500",
  "from-yellow-500 to-orange-500",
]

export function getAvatarGradient(id: number) {
  return AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length]
}

export function roleIdToRole(roleId: number): Staff["role"] {
  if (roleId === 1) return "waiter"
  if (roleId === 2) return "admin"
  if (roleId === 3) return "kitchen"
  if (roleId === 4) return "cashier"
  if (roleId === 5) return "manager"
  return "waiter"
}

export function getStaffRoleLabel(role: Staff["role"]) {
  if (role === "waiter") return "Mesero"
  if (role === "kitchen") return "Cocina"
  if (role === "cashier") return "Caja"
  if (role === "manager") return "Encargado"
  return "Admin"
}

export function getStaffTimeoutSetting() {
  if (typeof window === "undefined") return DEFAULT_STAFF_TIMEOUT

  const saved = window.localStorage.getItem(STAFF_TIMEOUT_KEY)
  return saved ? Number(saved) : DEFAULT_STAFF_TIMEOUT
}

export function setStaffTimeoutSetting(value: number) {
  window.localStorage.setItem(STAFF_TIMEOUT_KEY, String(value))
}
