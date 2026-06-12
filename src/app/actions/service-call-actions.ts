"use server"

import {
  requestBill as requestBillService,
  type RequestBillResult,
} from "@/services/service-call-service"
import type { Result } from "@/services/result"

export async function requestBillAction(
  qrToken: string,
  dinerToken: string | null
): Promise<Result<RequestBillResult>> {
  return requestBillService(qrToken, dinerToken)
}
