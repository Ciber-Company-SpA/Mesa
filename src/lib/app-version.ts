import pkg from "../../package.json"

/**
 * Fuente única de verdad de la versión de los instalables. Sale de
 * package.json (la misma que usa electron-builder para el .exe y
 * patch-android-manifest.mjs para el versionName/versionCode del APK).
 *
 * Los binarios se publican como GitHub Releases del repo (público) con el tag
 * v<version> y nombres de asset SIN espacios, así las URLs son predecibles.
 * Al publicar una versión nueva: bump de package.json + build de ambos
 * binarios + `gh release create v<version> <assets>` + deploy (este archivo
 * actualiza solo la página de descargas y /api/app-version).
 */
export const APP_VERSION: string = pkg.version

const RELEASE_BASE = `https://github.com/Ciber-Company-SpA/Mesa/releases/download/v${APP_VERSION}`

export const APP_DOWNLOADS = {
  version: APP_VERSION,
  windows: {
    label: "MESA para Windows",
    fileName: `MESA-Admin-Setup-${APP_VERSION}.exe`,
    url: `${RELEASE_BASE}/MESA-Admin-Setup-${APP_VERSION}.exe`,
  },
  android: {
    label: "MESA Mesero para Android",
    fileName: `MESA-Mesero-${APP_VERSION}.apk`,
    url: `${RELEASE_BASE}/MESA-Mesero-${APP_VERSION}.apk`,
  },
} as const

/**
 * Compara versiones semver simples ("1.2.3"). Devuelve >0 si a > b, 0 si
 * iguales, <0 si a < b. Tolerante a sufijos no numéricos (los ignora).
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0)
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
