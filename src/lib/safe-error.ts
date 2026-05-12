export function getSafeErrorMessage(
  error: unknown,
  fallback: string,
  allowedMessages: string[] = []
) {
  if (error instanceof Error && allowedMessages.includes(error.message)) {
    return error.message
  }

  return fallback
}
