import { NextResponse } from "next/server"

/**
 * Android App Links verification file.
 *
 * Android lee este JSON desde https://<host>/.well-known/assetlinks.json para
 * verificar que la app com.mesa.meseros puede manejar deep links de este
 * dominio. Si el JSON no llega con `Content-Type: application/json`, la
 * verificación falla y los QR siguen abriendo el navegador.
 *
 * Para soportar múltiples builds (ej. debug + release) agregá cada SHA256 al
 * array sha256_cert_fingerprints. Sacá el fingerprint con:
 *   keytool -list -v -keystore <ruta.jks> -alias <alias>
 */
export const dynamic = "force-static"

const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.mesa.meseros",
      sha256_cert_fingerprints: [
        "3D:DE:EC:BB:28:D8:D0:26:86:0F:39:D3:69:03:EF:DD:4E:43:2D:D1:85:69:90:16:A3:CA:E3:15:0D:6B:12:04",
      ],
    },
  },
]

export function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  })
}
