# Instalables de MESA — guía de versiones y releases

El proyecto se instala de **cuatro** formas. Tres cargan el sitio **en vivo**
(`tumesaqr.com`), así que su **contenido se actualiza solo** con cada deploy —
el binario solo se reconstruye cuando cambian ícono, versión, plugins o config
nativa.

| Instalable | Rol | Qué carga | Contenido | Binario |
|---|---|---|---|---|
| **PWA** (navegador) | Mesero | `/waiter/` (caché offline vía `sw.js`) | automático (deploy) | n/a |
| **App Android** (Capacitor) | Mesero | `tumesaqr.com/waiter/control` | automático | aviso in-app → descarga APK |
| **App Escritorio** (Electron) | Admin restaurante | `tumesaqr.com/admin` | automático | **auto-update** (electron-updater) |
| **Portal operadores** (PWA) | Operador plataforma | administracion.tumesaqr.com | automático (deploy) | n/a |

## Arquitectura de distribución y actualización

- **Fuente única de versión**: `package.json → version`. De ahí salen el
  instalador de Windows (electron-builder), el `versionName`/`versionCode` del
  APK (`scripts/patch-android-manifest.mjs`) y el manifiesto
  `src/lib/app-version.ts` (URLs de descarga + `/api/app-version`).
- **Canal de distribución**: **GitHub Releases** del repo (público), tag
  `v<version>`, assets con nombre sin espacios. Los links de `/admin/instalar`
  apuntan ahí.
- **Detección de actualizaciones**:
  - *Contenido (mesero)*: cada deploy sube `CACHE_VERSION` en `public/sw.js`;
    `src/components/UpdateNotifier.tsx` escucha `controllerchange` (+ chequeo
    cada 30 min y al volver a foco) y ofrece **Recargar**. Aplica a la PWA y al
    WebView del APK.
  - *Binario APK*: `UpdateNotifier` (solo en Capacitor) compara
    `App.getInfo().version` contra `/api/app-version`; si hay APK más nuevo
    muestra el aviso con link de descarga (posponible 24 h).
  - *Binario .exe*: `electron/main.js` usa **electron-updater** contra el
    último GitHub Release (repo público, sin token): descarga en segundo plano,
    ofrece reiniciar y si no, instala al cerrar. Chequea al abrir y cada 4 h.
  - *Panel admin web*: `admin-sw.js` no cachea → siempre fresco, sin aviso.

## Publicar una versión nueva (proceso completo)

```bash
# 0) Bump de versión (fuente única)
#    package.json → "version": "1.1.0"

# 1) APK release firmado (requiere el keystore, ver abajo)
bash scripts/build-android-release.sh
#    → dist-android/MESA-Mesero-1.1.0.apk

# 2) Instalador Windows (wine en Linux, o nativo en Windows)
npx electron-builder --win --publish never
#    → dist/MESA-Admin-Setup-1.1.0.exe + latest.yml + .blockmap

# 3) Release en GitHub (los 4 assets; latest.yml es el que lee electron-updater)
gh release create v1.1.0 \
  "dist/MESA-Admin-Setup-1.1.0.exe" \
  "dist/MESA-Admin-Setup-1.1.0.exe.blockmap" \
  dist/latest.yml \
  "dist-android/MESA-Mesero-1.1.0.apk" \
  --title "MESA v1.1.0" --notes "…"

# 4) Commit + push del bump → el deploy actualiza /admin/instalar y /api/app-version
```

> **IMPORTANTE — releases**: electron-updater lee `latest.yml` del **último
> release** del repo. Todo release nuevo debe incluir `latest.yml` + el `.exe`
> + su `.blockmap` (paso 3); no crear releases "solo de código".

## Firma del APK (keystore) — CRÍTICO

El APK release se firma con un keystore **persistente** en
`~/.mesa-android/` (`mesa-release.keystore` + `keystore.properties`), fuera del
repo porque el repo es público. Android **solo instala una actualización sobre
la app existente si la firma coincide**:

- **Respaldar** `~/.mesa-android/` en un lugar seguro. Si se pierde, la
  próxima versión obligará a desinstalar/reinstalar la app en cada teléfono.
- No commitear jamás el keystore ni sus contraseñas.
- Ubicación alternativa: exportar `MESA_KEYSTORE_DIR` antes de correr el script.

## Requisitos del contenedor de build

- **JDK 21** (`/usr/lib/jvm/java-21-openjdk-amd64`) — Capacitor 8 lo exige.
- **Android SDK** en `/opt/android-sdk` (platform-tools, platforms;android-35,
  build-tools;35.0.0).
- **wine** (para el `.exe` NSIS desde Linux).
- `android/` regenerable: `npx cap add android && npm run cap:sync` (el patch
  reaplica intent-filter de deep links, permisos de cámara, Java nativo y la
  versión desde package.json).

Ícono de marca: `node scripts/gen-icons.mjs` (SVG → PNG con sharp). Produce los
íconos de la PWA (`public/icons/…`), el maestro de Electron (`build/icon.png`)
y los de Capacitor (`assets/`). Tras cambiarlo: `npx capacitor-assets generate
--android` para los mipmaps.

## PWA del mesero (sin reconstrucción)

`public/manifest.webmanifest` (scope `/waiter/`) + `public/sw.js`. Se instala
desde el navegador (botón en `/waiter/login`). Al cambiar assets del front,
subir `CACHE_VERSION` en `public/sw.js` — además de limpiar cachés, ese bump es
lo que dispara el aviso "Actualización disponible" en las apps abiertas.

## Push del APK (pendiente)

Falta `android/app/google-services.json`: registrar la app
`com.mesa.meseros` en el proyecto Firebase cuyo service account está en el
secreto Supabase `FCM_SERVICE_ACCOUNT`, aplicar el plugin
`com.google.gms.google-services` en los build.gradle y recompilar. Sin eso la
app funciona completa (panel en vivo + escáner QR) pero sin push en segundo
plano.
