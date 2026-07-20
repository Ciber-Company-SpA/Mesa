/* Service worker de Firebase Cloud Messaging (Web Push) para el PANEL ADMIN.
 *
 * Es INERTE hasta que `useAdminPushRegistration` lo registre con la config de
 * Firebase en el query string (?apiKey=...&projectId=...&...). Se registra con
 * scope "/admin/" para NO pisar al service worker offline principal (public/sw.js,
 * scope "/").
 *
 * Activación (cuando haya credenciales):
 *   - Definir NEXT_PUBLIC_FIREBASE_* + NEXT_PUBLIC_FIREBASE_VAPID_KEY (ver
 *     docs/push-admin.md).
 *   - Ampliar el CSP (connect-src / script-src) a los hosts de Google FCM.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js")

const params = new URLSearchParams(self.location.search)
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
}

if (config.apiKey && config.projectId) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()
  // Notificación en segundo plano (pestaña cerrada / en background).
  messaging.onBackgroundMessage((payload) => {
    const n = (payload && payload.notification) || {}
    self.registration.showNotification(n.title || "MESA", {
      body: n.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: payload && payload.data ? payload.data : {},
    })
  })
}

// Al tocar la notificación, abrir/enfocar el inventario del panel admin.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = "/admin/inventory"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes("/admin") && "focus" in w) return w.focus()
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined
    })
  )
})
