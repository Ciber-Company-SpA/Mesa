import * as Sentry from "@sentry/nextjs"

function normalizeError(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err
  }

  if (typeof err === "string") {
    return new Error(err)
  }

  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message

    if (typeof message === "string" && message) {
      return new Error(message)
    }
  }

  return new Error(fallback)
}

export const logger = {
  error: (message: string, err?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, err)
    }

    Sentry.captureException(normalizeError(err, message), {
      extra: {
        message,
        originalError: err
      }
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
