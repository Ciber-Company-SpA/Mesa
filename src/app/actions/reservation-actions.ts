"use server"

import {
  createReservation as createReservationService,
  cancelReservation as cancelReservationService,
  type CreatedReservation,
} from "@/services/reservation-service"
import type {
  CreateReservationInput,
  CancelReservationInput,
} from "@/lib/validation/reservation"
import type { Result } from "@/services/result"

export async function createReservationAction(
  input: CreateReservationInput
): Promise<Result<CreatedReservation>> {
  return createReservationService(input)
}

export async function cancelReservationAction(
  input: CancelReservationInput
): Promise<Result<{ id: number }>> {
  return cancelReservationService(input)
}
