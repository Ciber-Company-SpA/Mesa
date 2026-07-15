"use server"

import {
  requestBill as requestBillService,
  requestServiceCall as requestServiceCallService,
  type RequestBillResult,
  type RequestServiceCallResult,
  type ServiceCallType,
} from "@/services/service-call-service"
import type { Result } from "@/services/result"

export async function requestBillAction(
  qrToken: string,
  dinerToken: string | null
): Promise<Result<RequestBillResult>> {
  return requestBillService(qrToken, dinerToken)
}

export async function requestServiceCallAction(
  qrToken: string,
  dinerToken: string | null,
  callType: ServiceCallType,
  tip: number
): Promise<Result<RequestServiceCallResult>> {
  return requestServiceCallService(qrToken, dinerToken, callType, tip)
}
