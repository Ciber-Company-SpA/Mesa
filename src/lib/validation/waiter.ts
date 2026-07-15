import { z } from "zod"

export const CreateWaiterSchema = z.object({
  name: z.string().trim().min(1, "El nombre del mesero es obligatorio"),
  email: z.string().trim().email("Correo inválido"),
  restaurantId: z.number().int().positive(),
  role: z.enum(["waiter", "kitchen", "cashier"]).default("waiter"),
})

export type CreateWaiterInput = z.infer<typeof CreateWaiterSchema>
