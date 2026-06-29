import { z } from "zod"

// ============ CREATE ============

export const CreateReservationSchema = z.object({
  tableId: z.number().int().positive("Elegí una mesa"),
  customerName: z
    .string()
    .trim()
    .min(1, "El nombre de la reserva es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  // ISO datetime (el cliente envía el resultado de Date.toISOString()).
  startsAt: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha y hora inválida"),
  durationMinutes: z
    .number()
    .int()
    .min(15, "La duración mínima es 15 minutos")
    .max(720, "La duración máxima es 720 minutos")
    .optional()
    .nullable(),
  customerPhone: z.string().trim().max(20, "Máximo 20 caracteres").optional().nullable(),
  partySize: z
    .number()
    .int()
    .min(1, "Mínimo 1 persona")
    .max(100, "Máximo 100 personas")
    .optional()
    .nullable(),
  notes: z.string().trim().max(300, "Máximo 300 caracteres").optional().nullable(),
})

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>

// ============ CANCEL ============

export const CancelReservationSchema = z.object({
  reservationId: z.number().int().positive(),
})

export type CancelReservationInput = z.infer<typeof CancelReservationSchema>
