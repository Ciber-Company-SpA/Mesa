import { NextResponse } from "next/server"
import { APP_DOWNLOADS } from "@/lib/app-version"

/**
 * Manifiesto público de versiones de los instalables. Lo consulta la app
 * nativa del mesero (Capacitor) al abrir para detectar si hay un APK más
 * nuevo publicado, y cualquier cliente que necesite las URLs de descarga.
 * Es un constante del bundle: cambia con cada deploy (no toca la BD).
 */
export const dynamic = "force-static"

export async function GET() {
  return NextResponse.json(APP_DOWNLOADS, {
    headers: {
      // Corto: el manifiesto debe reflejar el deploy vigente sin quedar pegado
      // en caches intermedios cuando publicamos una versión nueva.
      "Cache-Control": "public, max-age=300",
    },
  })
}
