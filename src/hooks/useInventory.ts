"use client"

import { useCallback, useEffect, useState } from "react"
import {
  listIngredientsAction,
  createIngredientAction,
  updateIngredientAction,
  deleteIngredientAction,
  restockIngredientAction,
  setIngredientStockAction,
} from "@/app/actions/inventory-actions"
import type { IngredientWithFlag } from "@/types/ingredient"
import type {
  CreateIngredientInput,
  UpdateIngredientInput,
  RestockIngredientInput,
  SetIngredientStockInput,
} from "@/lib/validation/inventory"

type MutationResult = { ok: boolean; error?: string }

export function useInventory() {
  const [ingredients, setIngredients] = useState<IngredientWithFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    const res = await listIngredientsAction()
    if (res.ok) setIngredients(res.data)
    else setError(res.error)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const res = await listIngredientsAction()
      if (cancelled) return
      if (res.ok) setIngredients(res.data)
      else setError(res.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const createIngredient = useCallback(
    async (input: CreateIngredientInput): Promise<MutationResult> => {
      const res = await createIngredientAction(input)
      if (res.ok) await refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    [refresh]
  )

  const updateIngredient = useCallback(
    async (input: UpdateIngredientInput): Promise<MutationResult> => {
      const res = await updateIngredientAction(input)
      if (res.ok) await refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    [refresh]
  )

  const deleteIngredient = useCallback(
    async (id: number): Promise<MutationResult> => {
      const res = await deleteIngredientAction({ id })
      if (res.ok) await refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    [refresh]
  )

  const restockIngredient = useCallback(
    async (input: RestockIngredientInput): Promise<MutationResult> => {
      const res = await restockIngredientAction(input)
      if (res.ok) await refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    [refresh]
  )

  const setStock = useCallback(
    async (input: SetIngredientStockInput): Promise<MutationResult> => {
      const res = await setIngredientStockAction(input)
      if (res.ok) await refresh()
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    },
    [refresh]
  )

  const lowStockCount = ingredients.filter((i) => i.low).length

  return {
    ingredients,
    loading,
    error,
    lowStockCount,
    refresh,
    createIngredient,
    updateIngredient,
    deleteIngredient,
    restockIngredient,
    setStock,
  }
}
