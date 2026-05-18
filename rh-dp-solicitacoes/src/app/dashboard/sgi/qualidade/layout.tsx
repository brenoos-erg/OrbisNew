import type { ReactNode } from 'react'

export default function SgiQualidadeLayout({ children }: { children: ReactNode }) {
  return <div data-enter-as-tab="true">{children}</div>
}
