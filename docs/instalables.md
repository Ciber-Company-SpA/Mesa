# Instalables de MESA — guía de actualización/reconstrucción

El proyecto se instala de **cuatro** formas. Tres cargan el sitio **en vivo**
(`tumesaqr.com`), así que su **contenido se actualiza solo** con cada deploy —
solo hay que reconstruir el binario cuando cambian ícono, versión, plugins o
config nativa.

| Instalable | Rol | Qué carga | Se reconstruye… |
|---|---|---|---|
| **PWA** (navegador) | Mesero | `/waiter/` (con caché offline vía `sw.js`) | automático (deploy) |
| **App Android** (Capacitor) | Mesero | `https://tumesaqr.com/waiter/control` | solo por ícono/versión/plugins |
| **App Escritorio** (Electron) | Admin restaurante | `https://tumesaqr.com/admin` | solo por ícono/versión |
| **Portal operadores** (PWA) | Operador plataforma | administracion.tumesaqr.com | automático (deploy) |

Ícono de marca: se genera con `node scripts/gen-icons.mjs` (SVG → PNG con
`sharp`). Produce los íconos de la PWA (`public/icons/…`), el maestro de
Electron (`build/icon.png`) y el de Capacitor (`assets/icon-only.png`,
`assets/logo.png`). Reejecutar tras cambiar la marca.

---

## App Android (Capacitor) — "Meseros-App"

`appId com.mesa.meseros`. El proyecto nativo `android/` **no está versionado**
(regenerable). Requiere JDK 17 + Android SDK (Android Studio).

```bash
# 1) Íconos de marca (si cambiaron)
node scripts/gen-icons.mjs

# 2) Generar los recursos nativos (íconos/splash) desde assets/
npm i -D @capacitor/assets
npx capacitor-assets generate --android

# 3) Crear el proyecto android/ si no existe, y sincronizar la config web
npx cap add android        # solo la primera vez
npm run cap:sync           # cap sync android + patch del AndroidManifest

# 4) Compilar el APK/AAB (en la carpeta android/)
cd android
./gradlew assembleRelease  # APK  → android/app/build/outputs/apk/release/
./gradlew bundleRelease    # AAB  → para Google Play
```

> Firma: para publicar en Play Store hay que firmar el AAB con un keystore
> (`android/keystore.jks`, ya contemplado en `.gitignore`). Ver docs oficiales
> de Capacitor Android para el `signingConfig`.

Para subir la versión: editar `versionCode`/`versionName` en
`android/app/build.gradle` (se regeneran si borrás `android/`; conviene fijarlos
en un script de patch o mantener `android/` una vez estable).

---

## App de Escritorio (Electron) — "Mesa"

`appId com.mesa.app`. Carga `/admin`. Empaqueta con electron-builder. El ícono
maestro es `build/icon.png` (1024×1024); electron-builder deriva `.ico`/`.icns`.

```bash
node scripts/gen-icons.mjs      # refresca build/icon.png si cambió la marca
npm run electron                # probar en local (carga tumesaqr.com/admin)
npm run electron:build          # empaquetar para la plataforma actual
```

- **Windows** (`.exe` NSIS): correr `electron:build` en Windows (o Linux con
  wine). Salida en `dist/`.
- **macOS** (`.dmg`): correr `electron:build` en macOS (la firma/notarización
  requiere cuenta de Apple Developer).
- Subir versión: cambiar `version` en `package.json`.

> Para íconos pixel-perfect por plataforma se pueden colocar `build/icon.ico`
> (Windows) y `build/icon.icns` (macOS); si existen, electron-builder los usa en
> vez de derivarlos del PNG. Ambos ya están permitidos en `.gitignore`.

---

## PWA del mesero (sin reconstrucción)

`public/manifest.webmanifest` (scope `/waiter/`) + `public/sw.js`. Se instala
desde el navegador (botón en `/waiter/login`). Al cambiar assets del front,
subir `CACHE_VERSION` en `public/sw.js`. Los íconos viven en `public/icons/`.
