import { registerPlugin } from "@capacitor/core"

/**
 * Resultado de abrir la pantalla nativa de ajustes.
 *  - `app-open-by-default`: cayó directo en el toggle de App Links (Android 12+).
 *  - `app-details`: cayó en la info general de la app (Android < 12 o el OEM
 *    bloqueó la intent específica).
 */
export type OpenAppLinksResult = {
  opened: boolean
  openedTarget: "app-open-by-default" | "app-details"
}

export interface AppLinksSettingsPlugin {
  openAppOpenByDefaultSettings(): Promise<OpenAppLinksResult>
}

export const AppLinksSettings = registerPlugin<AppLinksSettingsPlugin>("AppLinksSettings")
