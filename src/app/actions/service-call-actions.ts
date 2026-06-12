"use server"

import {
  requestBill as requestBillService,
  type RequestBillResult,
} from "@/services/service-call-service"
import type { Result } from "@/services/result"

export async function requestBillAction(
  tableId: number,
  dinerToken: string | null
): Promise<Result<RequestBillResult>> {
  return requestBillService(tableId, dinerToken)
}
