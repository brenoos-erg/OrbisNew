'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/components/theme/ThemeProvider'

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tema</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-700 bg-slate-900/70 p-1">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] transition ${
                active ? 'bg-slate-700 text-slate-100' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
              aria-pressed={active}
            >
              <Icon size={12} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
