import * as Sentry from "@sentry/nextjs"

export const logger = {
  error: (message: string, err?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, err)
    }

    Sentry.captureException(err, {
      extra: { message }
    })
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, context)
    }

    Sentry.captureMessage(message, {
      level: "warning",
      extra: context
    })
  }
}
