"use server"

import { updateTag } from "next/cache"
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
  const result = await createTableService(input)

  if (result.ok) {
    updateTag("menu")
  }

  return result
}

export async function updateTableAction(
  input: UpdateTableInput
): Promise<Result<{ id: number }>> {
  const result = await updateTableService(input)

  if (result.ok) {
    updateTag("menu")
  }

  return result
}

export async function deleteTableAction(
  input: DeleteTableInput
): Promise<Result<{ id: number }>> {
  const result = await deleteTableService(input)

  if (result.ok) {
    updateTag("menu")
  }

  return result
}

export async function getTableForEditAction(
  tableId: number
): Promise<Result<TableForEdit>> {
  return getTableForEditService(tableId)
}