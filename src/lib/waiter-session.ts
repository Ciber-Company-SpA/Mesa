export interface Staff {
  id: string
  name: string
  role: "admin" | "manager" | "waiter" | "kitchen" | "cashier"
  pin_hash: string
  avatar_color: string
}

export interface StaffSession {
  staff: Staff
  loginTime: number
}

export const STAFF_SESSION_KEY = "mesa_staff_session"
export const STAFF_TIMEOUT_KEY = "mesa_staff_timeout_setting"
export const STAFF_SESSION_MAX_AGE = 8 * 60 * 60 * 1000
export const DEFAULT_STAFF_TIMEOUT = 300

export const MOCK_STAFF: Staff[] = [
  {
    id: "1",
    name: "Carlos",
    role: "waiter",
    pin_hash: "a388f562e286fdf28986f9253579f4d096446e01dd0c771996a51ff11b390fa2",
    avatar_color: "from-orange-500 to-amber-500",
  },
  {
    id: "2",
    name: "Ana",
    role: "waiter",
    pin_hash: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
    avatar_color: "from-emerald-500 to-teal-500",
  },
  {
    id: "3",
    name: "Miguel",
    role: "kitchen",
    pin_hash: "16740bf13991fe083fbe5820cc8da08a5d88e5a48f44a3cfcc283c27b2797ba7",
    avatar_color: "from-indigo-500 to-blue-500",
  },
]

export function getStaffRoleLabel(role: Staff["role"]) {
  if (role === "waiter") return "Mesero"
  if (role === "kitchen") return "Cocina"
  if (role === "cashier") return "Caja"
  if (role === "manager") return "Encargado"
  return "Admin"
}

export function getStaffTimeoutSetting() {
  if (typeof window === "undefined") return DEFAULT_STAFF_TIMEOUT

  const savedTimeoutSetting = window.localStorage.getItem(STAFF_TIMEOUT_KEY)
  return savedTimeoutSetting ? Number(savedTimeoutSetting) : DEFAULT_STAFF_TIMEOUT
}

export function setStaffTimeoutSetting(value: number) {
  window.localStorage.setItem(STAFF_TIMEOUT_KEY, String(value))
}

export function saveStaffSession(staff: Staff) {
  const session: StaffSession = {
    staff,
    loginTime: Date.now(),
  }

  window.localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session))
}

export function clearStaffSession() {
  window.localStorage.removeItem(STAFF_SESSION_KEY)
}

export function getStoredStaffSession() {
  if (typeof window === "undefined") return null

  const savedSession = window.localStorage.getItem(STAFF_SESSION_KEY)
  if (!savedSession) return null

  try {
    const session = JSON.parse(savedSession) as StaffSession
    const age = Date.now() - session.loginTime

    if (age >= STAFF_SESSION_MAX_AGE) {
      clearStaffSession()
      return null
    }

    return session
  } catch (error) {
    console.error("Error parsing saved staff session", error)
    clearStaffSession()
    return null
  }
}

export async function hashStaffPin(pin: string) {
  const msgBuffer = new TextEncoder().encode(pin)
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
