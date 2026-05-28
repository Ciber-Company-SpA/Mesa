const STORAGE_KEY = "product-remove-bg-preference"

export function readRemoveBgPreference(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeRemoveBgPreference(value: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {
    // localStorage puede estar lleno o bloqueado; la preferencia es best-effort.
  }
}
