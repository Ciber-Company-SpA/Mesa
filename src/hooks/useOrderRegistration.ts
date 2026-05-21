import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useCartStore } from "@/store/cartStore"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

type OrderStatusRelation = { status_name: string | null } | { status_name: string | null }[] | null

function getOrderStatusName(orderStatus: OrderStatusRelation) {
  if (Array.isArray(orderStatus)) return orderStatus[0]?.status_name ?? null
  return orderStatus?.status_name ?? null
}

type UseOrderRegistrationProps = {
  qrCode: string
  tableId: number
  restaurantId: number
  total: number
  onOrderCompleted?: () => void
}

export function useOrderRegistration({ qrCode, onOrderCompleted }: UseOrderRegistrationProps) {
  const clearCart = useCartStore((state) => state.clear)
  const setLastOrder = useCartStore((state) => state.setLastOrder)
  const clearLastOrder = useCartStore((state) => state.clearLastOrder)

  const [isRegistered, setIsRegistered] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [qrCodeId, setQrCodeId] = useState<number | null>(null)

  const checkRegisteredOrder = useCallback(async () => {
    const { data: qrData, error: qrError } = await supabase
      .from("order_qr_codes")
      .select("id")
      .eq("qr_code", qrCode)
      .maybeSingle()

    if (qrError) throw qrError
    if (!qrData) return

    setQrCodeId(qrData.id)

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, status_id, created_at, qr_code_id, table_id, restaurant_id, total, order_status(status_name)")
      .eq("qr_code_id", qrData.id)
      .maybeSingle()

    if (orderError) throw orderError

    if (orderData) {
      if (orderData.status_id === 3) {
        setIsRegistered(false)
        setIsOffline(false)
        clearLastOrder()
        onOrderCompleted?.()
        return
      }

      setIsRegistered(true)
      setIsOffline(false)
      setLastOrder({
        id: orderData.id,
        qrCode,
        qrCodeId: qrData.id,
        statusId: orderData.status_id,
        statusName: getOrderStatusName(orderData.order_status),
        createdAt: orderData.created_at,
        tableId: orderData.table_id,
        restaurantId: orderData.restaurant_id,
        total: orderData.total,
      })
      clearCart()
    }
  }, [qrCode, clearCart, setLastOrder, clearLastOrder, onOrderCompleted])

  const { run: checkRegisteredOrderWithRetry, isPending } = useOfflineRetry(checkRegisteredOrder)

  // Check inicial al montar
  useEffect(() => {
    let isMounted = true

    async function initialCheck() {
      try {
        await checkRegisteredOrderWithRetry()
        if (isMounted) setIsOffline(false)
      } catch (err) {
        if (isMounted && isNetworkError(err)) setIsOffline(true)
      }
    }

    initialCheck()

    function handleOnline() {
      setIsOffline(false)
      initialCheck()
    }

    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      isMounted = false
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [checkRegisteredOrderWithRetry])

  // Suscripción Realtime: escucha INSERT/UPDATE en orders filtrados por qr_code_id
  useEffect(() => {
    if (!qrCodeId) return

    const channel = supabase
      .channel(`order-qr-${qrCodeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `qr_code_id=eq.${qrCodeId}`,
        },
        () => {
          checkRegisteredOrder().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qrCodeId, checkRegisteredOrder])

  return { isRegistered, isOffline: isOffline || isPending }
}