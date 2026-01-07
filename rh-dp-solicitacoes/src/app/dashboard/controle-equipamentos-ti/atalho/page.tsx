'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function AtalhoTiPage() {
  const [shortcutOpen, setShortcutOpen] = useState(false)

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <button
        type="button"
        onClick={() => setShortcutOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Abrir atalho
      </button>

      {shortcutOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-6xl rounded-2xl bg-slate-50 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-800">
                  Atalho de controle TI
                </h1>
                <p className="text-sm text-slate-500">
                  Atalho rápido para buscar equipamentos pelo patrimônio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShortcutOpen(false)}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>

            <div className="mt-4">
              <TiEquipmentsPanel
                initialCategory="ALL"
                lockCategory
                enableScanShortcut
                shortcutMode
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}