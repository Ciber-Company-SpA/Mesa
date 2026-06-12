"use server"

import {
  claimDinerSlot as claimDinerSlotService,
  payDinerOrders as payDinerOrdersService,
  type DinerSlot,
} from "@/services/diner-service"
import type { Result } from "@/services/result"

export async function claimDinerSlotAction(
  qrToken: string,
  token: string
): Promise<Result<DinerSlot>> {
  return claimDinerSlotService(qrToken, token)
}

export async function payDinerOrdersAction(
  tableId: number,
  dinerSlot: number
): Promise<Result<{ paidIds: number[]; dinersCleared: boolean; tableReleased: boolean }>> {
  return payDinerOrdersService(tableId, dinerSlot)
}
