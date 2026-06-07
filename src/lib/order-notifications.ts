// Notificaciones del sistema para el mesero. Funcionan incluso si la tab
// está en background (a diferencia del beep, que requiere foco/audio).
//
// La Web Notifications API requiere permiso explícito: pedimos en el primer
// uso. Si el usuario rechaza, fallamos en silencio — el sonido sigue siendo
// el canal principal de alerta.

type Permission = "default" | "granted" | "denied" | "unsupported"

export function getNotificationPermission(): Permission {
  if (typeof window === "undefined") return "unsupported"
  if (!("Notification" in window)) return "unsupported"
  return Notification.permission as Permission
}

export async function requestNotificationPermission(): Promise<Permission> {
  if (typeof window === "undefined") return "unsupported"
  if (!("Notification" in window)) return "unsupported"
  if (Notification.permission === "granted") return "granted"
  if (Notification.permission === "denied") return "denied"
  try {
    const result = await Notification.requestPermission()
    return result as Permission
  } catch {
    return "denied"
  }
}

export function showOrderNotification(opts: {
  title: string
  body: string
  tag?: string
}) {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission !== "granted") return
  try {
    const notif = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      silent: false,
    })
    // Auto-cierra a los 8s para no acumular.
    setTimeout(() => notif.close(), 8000)
    notif.onclick = () => {
      window.focus()
      notif.close()
    }
  } catch {
    // ignore
  }
}
