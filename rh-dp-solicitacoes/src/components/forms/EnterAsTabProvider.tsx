'use client'

import { useEffect } from 'react'
import { handleEnterAsTab } from '@/lib/forms/useEnterAsTab'

export function EnterAsTabProvider() {
  useEffect(() => {
    document.addEventListener('keydown', handleEnterAsTab, true)

    return () => {
      document.removeEventListener('keydown', handleEnterAsTab, true)
    }
  }, [])

  return null
}
