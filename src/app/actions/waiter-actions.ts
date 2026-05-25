"use server"

import {
  createWaiter as createWaiterService,
  listWaiters as listWaitersService,
  deleteWaiter as deleteWaiterService,
  type CreatedWaiter,
  type WaiterListItem,
} from "@/services/waiter-service"
import type { CreateWaiterInput } from "@/lib/validation/waiter"
import type { Result } from "@/services/result"

export async function createWaiterAction(
  input: CreateWaiterInput
): Promise<Result<CreatedWaiter>> {
  return createWaiterService(input)
}

export async function listWaitersAction(): Promise<Result<WaiterListItem[]>> {
  return listWaitersService()
}

export async function deleteWaiterAction(
  waiterId: number
): Promise<Result<{ id: number }>> {
  return deleteWaiterService(waiterId)
}
