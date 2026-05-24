import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  CreateTableSchema,
  UpdateTableSchema,
  DeleteTableSchema,
  type CreateTableInput,
  type UpdateTableInput,
  type DeleteTableInput,
} from "@/lib/validation/table"
import { ok, fail, type Result } from "@/services/result"
import { createTableQR, deleteTableQR } from "@/services/qr-service"

export type CreatedTable = {
  id: number
}

export type TableForEdit = {
  id: number
  tableNumber: number
  qrCodeId: number
}

export async function getTableForEdit(tableId: number): Promise<Result<TableForEdit>> {
  if (!tableId || tableId <= 0) {
    return fail("Mesa no encontrada")
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("tables")
    .select("id, table_number, qr_code_id")
    .eq("id", tableId)
    .maybeSingle()

  if (error) return fail("Error al cargar mesa")
  if (!data) return fail("Mesa no encontrada")

  return ok({
    id: data.id,
    tableNumber: data.table_number,
    qrCodeId: data.qr_code_id,
  })
}

export async function createTable(input: CreateTableInput): Promise<Result<CreatedTable>> {
  const validation = CreateTableSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { tableNumber, restaurantId } = validation.data

  const qrResult = await createTableQR()

  if (!qrResult.ok) {
    return fail(qrResult.error)
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("tables")
    .insert({
      table_number: tableNumber,
      restaurant_id: restaurantId,
      qr_code_id: qrResult.data.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    await deleteTableQR(qrResult.data.id)
    return fail("Error al crear la mesa")
  }

  return ok({ id: data.id })
}

export async function updateTable(input: UpdateTableInput): Promise<Result<{ id: number }>> {
  const validation = UpdateTableSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { tableId, tableNumber } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("tables")
    .update({ table_number: tableNumber })
    .eq("id", tableId)

  if (error) {
    return fail("Error al actualizar la mesa")
  }

  return ok({ id: tableId })
}

export async function deleteTable(input: DeleteTableInput): Promise<Result<{ id: number }>> {
  const validation = DeleteTableSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { tableId, qrCodeId } = validation.data

  const supabase = await createSupabaseServerClient()

  const { error: tableError } = await supabase
    .from("tables")
    .delete()
    .eq("id", tableId)

  if (tableError) {
    return fail("Error al eliminar la mesa")
  }

  const qrResult = await deleteTableQR(qrCodeId)

  if (!qrResult.ok) {
    return ok({ id: tableId })
  }

  return ok({ id: tableId })
}