/* Service worker MÍNIMO del PANEL ADMIN (scope "/admin").
 *
 * Propósito ÚNICO: habilitar la instalación de la PWA del admin. El navegador
 * solo dispara `beforeinstallprompt` (el botón "Instalar app") si la página
 * está controlada por un service worker con un handler `fetch`.
 *
 * NO cachea NADA: cada navegación va SIEMPRE a la red. Esto es deliberado —
 * el admin (a diferencia del mesero) no debe quedar atrapado con HTML/JS
 * viejos, porque su contenido se actualiza en vivo con cada deploy. Por eso
 * este SW no implementa offline: solo existe para la instalabilidad.
 *
 * El SW de Firebase Cloud Messaging (push del admin) vive en su scope propio
 * de FCM ("/firebase-cloud-messaging-push-scope"), así que no colisiona con
 * este. Ver src/hooks/useAdminPushRegistration.ts.
 */

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  // Solo las navegaciones (carga/recarga de página), siempre desde la red.
  // Los assets (JS/CSS con hash de Next) no se interceptan → red normal.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request))
  }
})
