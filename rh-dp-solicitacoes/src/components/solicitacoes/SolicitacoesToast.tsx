'use client'

import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  message: string
  type: ToastType
}

const toneMap: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-slate-700',
}

export function useSolicitacoesToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const pushToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, message, type }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 2600)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return useMemo(() => ({ toasts, pushToast, removeToast }), [toasts, pushToast, removeToast])
}

export function SolicitacoesToastViewport({
  toasts,
  onClose,
}: {
  toasts: ToastItem[]
  onClose: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm ${toneMap[toast.type]}`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : <CircleAlert size={16} className="mt-0.5" />}
          <p className="flex-1">{toast.message}</p>
          <button type="button" onClick={() => onClose(toast.id)} className="text-current/70 hover:text-current">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}