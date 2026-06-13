// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://293bedbe4f0ac8be8b887f690e140f2f@o4511374846459904.ingest.us.sentry.io/4511374868611072",

  // Muestreo de trazas: 10% en prod, todo en desarrollo.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enviar logs a Sentry.
  enableLogs: true,

  // NO enviar PII automáticamente (IPs, emails, datos de usuario).
  sendDefaultPii: false,
});
