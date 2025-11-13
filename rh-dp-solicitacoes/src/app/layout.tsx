// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

export const metadata: Metadata = {
  title: 'RH ↔ DP — Solicitações',
  description: 'MVP de solicitações entre RH e DP',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
