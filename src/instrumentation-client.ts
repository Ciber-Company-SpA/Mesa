// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://293bedbe4f0ac8be8b887f690e140f2f@o4511374846459904.ingest.us.sentry.io/4511374868611072",

  // Session Replay con enmascarado: NO graba texto ni inputs en claro
  // (evita capturar notas de pedidos u otros datos de clientes).
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],

  // Muestreo de trazas: 10% en prod, todo en desarrollo.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enviar logs a Sentry.
  enableLogs: true,

  // Replay de sesiones normales: 10% (igual que antes).
  replaysSessionSampleRate: 0.1,

  // Replay cuando ocurre un error: 20% en prod (antes 100%, que quemaba cuota
  // y capturaba demasiado). En desarrollo se captura todo.
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // NO enviar PII automáticamente (IPs, emails, datos de usuario).
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
