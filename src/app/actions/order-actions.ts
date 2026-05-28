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
import type { Result } from "@/services/result"

export async function createOrderAction(
  input: CreateOrderInput
): Promise<Result<CreatedOrder>> {
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