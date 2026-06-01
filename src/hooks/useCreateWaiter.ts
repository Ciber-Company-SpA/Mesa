import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { createWaiterAction } from "@/app/actions/waiter-actions"
import { invalidateWaiterCaches } from "@/lib/cache-invalidation"
import { CreateWaiterSchema, type CreateWaiterInput } from "@/lib/validation/waiter"

type CreatedWaiterSummary = {
  name: string
  email: string
  password: string
  emailSent: boolean
}

export function useCreateWaiter() {
  const { restaurantId, loading: loadingId } = useRestaurantId()
  const pendingPayloadRef = useRef<CreateWaiterInput | null>(null)
  const createdRef = useRef<CreatedWaiterSummary | null>(null)

  const [waiterName, setWaiterName] = useState("")
  const [waiterEmail, setWaiterEmail] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<CreatedWaiterSummary | null>(null)

  const { run: createWaiterWithRetry, isPending } = useOfflineRetry(async () => {
    const payload = pendingPayloadRef.current
    if (!payload) return

    const result = await createWaiterAction(payload)

    if (!result.ok) {
      throw new Error(result.error)
    }

    invalidateWaiterCaches()
    createdRef.current = result.data
  })

  async function createWaiter(): Promise<CreatedWaiterSummary | null> {
    if (loading || loadingId) return null

    createdRef.current = null

    try {
      setLoading(true)
      setError("")
      setCreated(null)

      if (!restaurantId) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          throw { isNetworkError: true, message: "Sin conexión" }
        }
        throw new Error("No se encontró el restaurante")
      }

      const validation = CreateWaiterSchema.safeParse({
        name: waiterName.trim(),
        email: waiterEmail.trim(),
        restaurantId,
      })

      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "Datos inválidos")
      }

      pendingPayloadRef.current = validation.data
      await createWaiterWithRetry()

      const summary = createdRef.current
      if (!summary) return null

      setCreated(summary)
      setWaiterName("")
      setWaiterEmail("")
      return summary
    } catch (err: unknown) {
      handleMutationError(err, {
        logTag: "Error creando mesero",
        fallback: "Error al crear mesero",
        setError,
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  function resetCreated() {
    setCreated(null)
    setError("")
  }

  return {
    waiterName,
    setWaiterName,
    waiterEmail,
    setWaiterEmail,
    loading: loading || isPending,
    error,
    created,
    createWaiter,
    resetCreated,
  }
}
