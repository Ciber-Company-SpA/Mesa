const KEY = "guest_id"

export function getGuestId(): string {
  if (typeof window === "undefined") return ""

  let id = window.localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(KEY, id)
  }
  return id
}
