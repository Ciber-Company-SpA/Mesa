#!/usr/bin/env node
/**
 * Parches sobre la carpeta /android (que está en .gitignore y se regenera
 * con `npx cap add android`):
 *
 *  1. AndroidManifest.xml: inserta el intent-filter de App Links para que el
 *     QR `/r/<code>` abra la app cuando esté instalada.
 *  2. native/android/java/*.java: copia los archivos fuente que mantenemos
 *     como source-of-truth fuera de /android (plugin nativo
 *     AppLinksSettingsPlugin + MainActivity con su registro).
 *
 * Todo es idempotente: si ya está aplicado, no hace nada.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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
} else {
  // Insertar el intent-filter justo después del <intent-filter> con MAIN/LAUNCHER.
  const launcherFilterEnd = /(<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"[\s\S]*?<\/intent-filter>)/
  if (!launcherFilterEnd.test(manifest)) {
    console.error("[patch-android-manifest] no se encontró el intent-filter LAUNCHER esperado.")
    process.exit(1)
  }

  const patched = manifest.replace(launcherFilterEnd, `$1${INTENT_FILTER}`)
  writeFileSync(MANIFEST, patched, "utf8")
  console.log("[patch-android-manifest] intent-filter insertado correctamente.")
}

// ============================================================================
// 2. Copia archivos Java del source-of-truth (native/android/java/*.java) a
//    android/app/src/main/java/com/mesa/meseros/. Sobrescribe siempre, así si
//    se actualizan en native/ los cambios se aplican al recompilar la APK.
// ============================================================================

const JAVA_DEST = resolve("android/app/src/main/java/com/mesa/meseros")
const JAVA_FILES = [
  ["native/android/java/AppLinksSettingsPlugin.java", "AppLinksSettingsPlugin.java"],
  ["native/android/java/MainActivity.java", "MainActivity.java"],
]

mkdirSync(JAVA_DEST, { recursive: true })

for (const [from, name] of JAVA_FILES) {
  try {
    copyFileSync(resolve(from), resolve(JAVA_DEST, name))
    console.log(`[patch-android-manifest] copiado ${name}`)
  } catch (err) {
    console.error(`[patch-android-manifest] error copiando ${name}: ${err.message}`)
  }
}
