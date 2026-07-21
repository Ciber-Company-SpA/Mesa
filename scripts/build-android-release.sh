#!/usr/bin/env bash
# ============================================================================
# Compila el APK RELEASE del mesero, firmado con el keystore persistente.
#
# La firma con el MISMO keystore entre versiones es lo que permite que Android
# instale una actualización SOBRE la app existente (sin desinstalar). El
# keystore vive FUERA del repo (repo público): ~/.mesa-android/ por defecto,
# configurable con MESA_KEYSTORE_DIR. ¡Respaldarlo! Si se pierde, los
# dispositivos deberán desinstalar/reinstalar la app en la próxima versión.
#
# Prerrequisitos (ya montados en el contenedor de build; ver docs/instalables.md):
#   JDK 21, Android SDK en $ANDROID_HOME (default /opt/android-sdk), android/
#   generado (npx cap add android).
#
# Uso:  bash scripts/build-android-release.sh
# Salida: dist-android/MESA-Mesero-<version>.apk
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
KEYDIR="${MESA_KEYSTORE_DIR:-$HOME/.mesa-android}"
PROPS="$KEYDIR/keystore.properties"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"

if [ ! -f "$PROPS" ]; then
  echo "ERROR: falta $PROPS (keystore de firma). Ver docs/instalables.md." >&2
  exit 1
fi
if [ ! -d android ]; then
  echo "ERROR: falta android/. Corré: npx cap add android && npm run cap:sync" >&2
  exit 1
fi

# shellcheck disable=SC1090
source <(sed 's/^/export /' "$PROPS")

echo "==> Sync Capacitor + parches (intent-filter, permisos, versión $VERSION)"
npm run cap:sync

echo "==> Gradle assembleRelease"
( cd android && ./gradlew assembleRelease --no-daemon -q )

UNSIGNED=android/app/build/outputs/apk/release/app-release-unsigned.apk
if [ ! -f "$UNSIGNED" ]; then
  # Algunas plantillas ya lo emiten firmado con debug; usar el que exista.
  UNSIGNED=android/app/build/outputs/apk/release/app-release.apk
fi

BUILD_TOOLS=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
mkdir -p dist-android
OUT="dist-android/MESA-Mesero-$VERSION.apk"

echo "==> zipalign + apksigner ($BUILD_TOOLS)"
"$BUILD_TOOLS/zipalign" -f 4 "$UNSIGNED" "$OUT.aligned"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$storeFile" --ks-pass "pass:$storePassword" \
  --ks-key-alias "$keyAlias" --key-pass "pass:$keyPassword" \
  --out "$OUT" "$OUT.aligned"
rm -f "$OUT.aligned" "$OUT.idsig"

"$BUILD_TOOLS/apksigner" verify --print-certs "$OUT" | head -3
echo "==> APK listo: $OUT ($(du -h "$OUT" | cut -f1))"
