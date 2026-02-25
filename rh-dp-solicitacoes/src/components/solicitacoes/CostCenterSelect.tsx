'use client'

import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

type CostCenterOption = {
  id: string
  code?: string | null
  description: string
  externalCode?: string | null
}

type CostCenterSelectProps = {
  value: string
  options: CostCenterOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  name?: string
}

export function formatCostCenterOption(cc: CostCenterOption) {
  return [cc.code, cc.description].filter(Boolean).join(' - ')
}

export default function CostCenterSelect({
  value,
  options,
  onValueChange,
  placeholder = 'Selecione...',
  required,
  disabled,
  name,
}: CostCenterSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-orange-500/70">
        <span className="min-w-0 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
          <Select.Value placeholder={placeholder} />
        </span>
        <Select.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-20 min-w-[320px] max-w-[700px] rounded-md border border-slate-200 bg-white shadow-xl"
        >
          <Select.Viewport className="max-h-64 overflow-y-auto p-1 text-sm">
            {options.map((cc) => {
              const optionLabel = formatCostCenterOption(cc)
              return (
                <Select.Item
                  key={cc.id}
                  value={cc.id}
                  className="relative flex cursor-pointer select-none items-center whitespace-nowrap rounded-sm py-2 pl-9 pr-8 text-slate-900 outline-none data-[highlighted]:bg-orange-100 data-[highlighted]:text-orange-900"
                >
                  <Select.ItemText>
                    <span className="block whitespace-nowrap overflow-hidden text-ellipsis" title={optionLabel}>
                      {optionLabel}
                    </span>
                  </Select.ItemText>
                  <Select.ItemIndicator className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-700">
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              )
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
      <input
        type="hidden"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        readOnly
      />
    </Select.Root>
  )
}