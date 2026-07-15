"use server"

import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

// ============ TYPES ============

export type ApiKeyRow = {
  id: number
  name: string | null
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  revoked: boolean
}

// ============ CREATE (admin) ============

export async function createApiKey(name: string): Promise<Result<{ token: string }>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("create_api_key", { p_name: name })

  if (error) return fail(error.message)

  return ok({ token: data as string })
}

// ============ LIST (admin) ============

export async function listApiKeys(): Promise<Result<ApiKeyRow[]>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("list_api_keys")

  if (error) return fail(error.message)

  type Row = {
    id: number
    name: string | null
    key_prefix: string
    created_at: string
    last_used_at: string | null
    revoked: boolean
  }

  return ok(
    ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      revoked: row.revoked,
    }))
  )
}

// ============ REVOKE (admin) ============

export async function revokeApiKey(id: number): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { error } = await supabase.rpc("revoke_api_key", { p_id: id })

  if (error) return fail(error.message)

  return ok(null)
}
