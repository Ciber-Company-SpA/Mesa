import { z } from "zod"

export const CreateWaiterSchema = z.object({
  name: z.string().trim().min(1, "El nombre del mesero es obligatorio"),
  email: z.string().trim().email("Correo inválido"),
  restaurantId: z.number().int().positive(),
})

export type CreateWaiterInput = z.infer<typeof CreateWaiterSchema>
