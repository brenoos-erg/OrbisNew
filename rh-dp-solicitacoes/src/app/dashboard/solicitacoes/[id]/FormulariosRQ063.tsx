'use client'

import { useEffect, useState } from 'react'
// importe aqui o resto que você já usa (ex: useRouter, seus componentes, etc)

// ⬇️ tipo que representa um cargo vindo da tabela Position
type Position = {
  id: string
  name: string
  sectorProject?: string | null
  workplace?: string | null
  workSchedule?: string | null
  mainActivities?: string | null
  complementaryActivities?: string | null
  schooling?: string | null
  course?: string | null
  schoolingCompleted?: string | null
  courseInProgress?: string | null
  periodModule?: string | null
  requiredKnowledge?: string | null
  behavioralCompetencies?: string | null
  enxoval?: string | null
  uniform?: string | null
  others?: string | null
  workPoint?: string | null
  site?: string | null
}
