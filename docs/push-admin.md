# Web Push del panel admin (alertas de inventario) — guía de activación

El aviso al móvil del admin cuando un insumo queda **sin stock** o **bajo el
mínimo** ya está construido de punta a punta y **dormido** (credential-ready).
Se activa solo al cargar las credenciales de Firebase Web + ampliar el CSP.

## Qué ya está hecho (no requiere acción)

- **Edge Function `send-stock-alert-push`** (FCM v1): resuelve los usuarios
  admin (`role_id = 2`) del restaurante y envía el push a sus `device_tokens`.
  Es inofensiva sin tokens (responde `skip 200`).
- **Trigger `trg_stock_alert_push`** en `ingredients`: dispara la función solo
  cuando el stock **cruza** a un nivel de alerta (evita spam). Usa el patrón
  Vault (`supabase_url` + `service_role_key`), igual que los push de pedidos.
- **Registro de token del admin** (`useAdminPushRegistration` + SW
  `public/firebase-messaging-sw.js`): no-op mientras no exista la config.

## Pasos para activar

### 1. Consola de Firebase (el proyecto ya existe — el del `FCM_SERVICE_ACCOUNT`)

1. Project settings → **General** → *Your apps* → agregar una **app Web** (o usar
   una existente). Copiar el objeto `firebaseConfig` (apiKey, authDomain,
   projectId, messagingSenderId, appId). Son valores **públicos**.
2. Project settings → **Cloud Messaging** → *Web configuration* → **Web Push
   certificates** → generar/copiar la **VAPID key** (par de claves público).

### 2. Variables de entorno (Railway → servicio `Mesa`)

Son `NEXT_PUBLIC_*` (se incrustan en el bundle en build → hay que **redeploy**):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...           # p.ej. <projectId>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...             # Web Push certificate
```

### 3. Ampliar el CSP (`next.config`)

El SDK compat se carga desde `gstatic.com` y FCM habla con Google. Agregar:

- `script-src`: `https://www.gstatic.com`
- `connect-src`: `https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://firebaseinstallations.googleapis.com`

(Solo hace falta al activar; sin las env, el SDK nunca se carga.)

### 4. Verificar

1. Redeploy de `Mesa`. Entrar a `/admin` en el móvil (o navegador con
   notificaciones), aceptar el permiso → se registra un `device_tokens` con
   `platform = 'web'` para el usuario admin.
2. Bajar un insumo a 0 (o bajo el mínimo) → llega el push. En segundo plano lo
   maneja `firebase-messaging-sw.js`; al tocarlo abre `/admin/inventory`.

## Notas

- El token web usa las mismas Edge Functions FCM v1 (`message.token`) que la app
  del mesero; no hay backend nuevo que mantener.
- iOS solo entrega Web Push si el sitio está **instalado como PWA** (iOS 16.4+).
- El SW de FCM vive en scope `/admin/` y no interfiere con `public/sw.js` (offline).
