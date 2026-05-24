"use server"

import {
  createOrder as createOrderService,
  type CreatedOrder,
} from "@/services/order-service"
import type { CreateOrderInput } from "@/lib/validation/order"
import type { Result } from "@/services/result"

export async function createOrderAction(
  input: CreateOrderInput
): Promise<Result<CreatedOrder>> {
  return createOrderService(input)
}