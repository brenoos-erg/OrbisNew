// Define layout base para todas as páginas
import './globals.css' // importa estilos globais (Tailwind)
import type { Metadata } from 'next' // tipagem de metadados para SEO


export const metadata: Metadata = { // metadados simples
title: 'RH ↔ DP — Solicitações',
description: 'MVP de solicitações entre RH e DP',
}


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}