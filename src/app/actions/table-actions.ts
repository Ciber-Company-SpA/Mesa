"use server"

import { revalidateTag } from "next/cache"
import {
  createTable as createTableService,
  updateTable as updateTableService,
  deleteTable as deleteTableService,
  getTableForEdit as getTableForEditService,
  type CreatedTable,
  type TableForEdit,
} from "@/services/table-service"
import type {
  CreateTableInput,
  UpdateTableInput,
  DeleteTableInput,
} from "@/lib/validation/table"
import type { Result } from "@/services/result"

export async function createTableAction(
  input: CreateTableInput
): Promise<Result<CreatedTable>> {
  return createTableService(input)
}

export async function updateTableAction(
  input: UpdateTableInput
): Promise<Result<{ id: number }>> {
  return updateTableService(input)
}

export async function deleteTableAction(
  input: DeleteTableInput
): Promise<Result<{ id: number }>> {
  return deleteTableService(input)
}

export async function getTableForEditAction(
  tableId: number
): Promise<Result<TableForEdit>> {
  return getTableForEditService(tableId)
}