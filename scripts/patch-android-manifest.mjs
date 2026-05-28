#!/usr/bin/env node
/**
 * Parchea android/app/src/main/AndroidManifest.xml insertando el intent-filter
 * de App Links que abre la app cuando se escanea un QR de /r/<code>.
 *
 * Como `/android` está en .gitignore, cualquier regeneración con
 * `npx cap add android` o `npx cap sync android` puede sobrescribir el
 * manifest. Ejecutá este script (o `npm run cap:patch`) después de cada sync.
 *
 * Es idempotente: si la marca ya está presente, no hace nada.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const MANIFEST = resolve("android/app/src/main/AndroidManifest.xml")
const MARKER = "android:host=\"mesa-production-f46d.up.railway.app\""

const INTENT_FILTER = `
            <!-- Deep link: abre la app cuando se escanea un QR /r/<code> en el host verificado. -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https"
                      android:host="mesa-production-f46d.up.railway.app"
                      android:pathPrefix="/r/" />
            </intent-filter>
`

let manifest
try {
  manifest = readFileSync(MANIFEST, "utf8")
} catch (err) {
  console.error(`[patch-android-manifest] no se encontró ${MANIFEST}.`)
  console.error("[patch-android-manifest] corré `npx cap add android` primero.")
  process.exit(1)
}

if (manifest.includes(MARKER)) {
  console.log("[patch-android-manifest] intent-filter ya presente, no se modifica.")
  process.exit(0)
}

// Insertar el intent-filter justo después del <intent-filter> con MAIN/LAUNCHER.
const launcherFilterEnd = /(<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"[\s\S]*?<\/intent-filter>)/
if (!launcherFilterEnd.test(manifest)) {
  console.error("[patch-android-manifest] no se encontró el intent-filter LAUNCHER esperado.")
  process.exit(1)
}

const patched = manifest.replace(launcherFilterEnd, `$1${INTENT_FILTER}`)
writeFileSync(MANIFEST, patched, "utf8")
console.log("[patch-android-manifest] intent-filter insertado correctamente.")
