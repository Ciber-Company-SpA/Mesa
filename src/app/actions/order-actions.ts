"use server"

import {
  createOrder as createOrderService,
  listActiveOrdersForRestaurant as listActiveOrdersService,
  advanceOrderStatus as advanceOrderStatusService,
  markOrderAsPaid as markOrderAsPaidService,
  markTableOrdersAsPaid as markTableOrdersAsPaidService,
  type CreatedOrder,
  type WaiterOrder,
} from "@/services/order-service"
import type { CreateOrderInput } from "@/lib/validation/order"
import { fail, type Result } from "@/services/result"
import { checkPublicOrderLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function createOrderAction(
  input: CreateOrderInput
): Promise<Result<CreatedOrder>> {

  try {
    const result = await checkPublicOrderLimit(input.tableId)
    // eslint-disable-next-line no-console -- diagnóstico temporal
    console.log("[ratelimit]", {
      tableId: input.tableId,
      success: result.success,
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
    })
    if (!result.success) {
      return fail("Estás haciendo pedidos demasiado rápido. Espera un momento e intenta de nuevo.")
    }
  } catch (err) {
    // eslint-disable-next-line no-console -- diagnóstico temporal
    console.error("[ratelimit] FALLÓ Upstash:", err)
    logger.error("Rate limit no disponible (Upstash)", err)
  }

  return createOrderService(input)
}

export async function listActiveOrdersAction(
  restaurantId: number
): Promise<Result<WaiterOrder[]>> {
  return listActiveOrdersService(restaurantId)
}

export async function advanceOrderStatusAction(
  orderId: number
): Promise<Result<{ id: number; statusId: number }>> {
  return advanceOrderStatusService(orderId)
}

export async function markOrderAsPaidAction(
  orderId: number
): Promise<Result<{ id: number; statusId: number; tableReleased: boolean }>> {
  return markOrderAsPaidService(orderId)
}

export async function markTableOrdersAsPaidAction(
  tableId: number
): Promise<Result<{ tableId: number; paidIds: number[]; tableReleased: boolean }>> {
  return markTableOrdersAsPaidService(tableId)
}