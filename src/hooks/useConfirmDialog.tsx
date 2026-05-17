import React, { useCallback, useRef, useState } from "react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Options {
  title?: string
  description?: string
  confirmLabel?: string
  onConfirm: () => boolean | void | Promise<boolean | void>
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Options | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  const confirm = useCallback((opts: Options) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  const handleConfirm = async () => {
    if (!options || isConfirming) return

    try {
      setIsConfirming(true)
      const result = await options.onConfirm()
      setOpen(false)
      resolveRef.current?.(result !== false)
      resolveRef.current = null
      setOptions(null)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancel = () => {
    if (isConfirming) return

    setOpen(false)
    resolveRef.current?.(false)
    resolveRef.current = null
    setOptions(null)
  }

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        open={open}
        title={options?.title}
        description={options?.description ?? "Esta acción no se puede deshacer."}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmLabel={isConfirming ? "Borrando..." : options?.confirmLabel ?? "Sí, borrar"}
      />
    ),
  }
}
