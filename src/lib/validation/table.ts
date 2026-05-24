import { z } from "zod"

// ============ CREATE ============

export const CreateTableSchema = z.object({
  tableNumber: z.number().int().positive("El número de mesa debe ser mayor a 0"),
  restaurantId: z.number().int().positive(),
})

export type CreateTableInput = z.infer<typeof CreateTableSchema>

// ============ UPDATE ============

export const UpdateTableSchema = z.object({
  tableId: z.number().int().positive(),
  tableNumber: z.number().int().positive("El número de mesa debe ser mayor a 0"),
})

export type UpdateTableInput = z.infer<typeof UpdateTableSchema>

// ============ DELETE ============

export const DeleteTableSchema = z.object({
  tableId: z.number().int().positive(),
  qrCodeId: z.number().int().positive(),
})

export type DeleteTableInput = z.infer<typeof DeleteTableSchema>