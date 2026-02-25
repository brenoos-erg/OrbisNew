'use client'
import { useRouter } from 'next/navigation'

export default function Header() {
  const router = useRouter()

  async function handleSignOut() {
    // limpa cookie no servidor
    try { await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' }) } catch {}

    // navegação “à prova de cache”
    router.replace('/login?logout=1')
    router.refresh()
    // 4) fallback bruto (se algo cachear mesmo assim)
    setTimeout(() => { window.location.href = '/login?logout=1' }, 150)
  }

  return (
    <header className="flex items-center justify-between bg-slate-900 px-6 py-3 text-white">
      <h1 className="text-lg font-semibold">SGI — Sistema de Gestão Integrada</h1>
      <button
        onClick={handleSignOut}
        className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium hover:bg-orange-600"
      >
        Sair
      </button>
    </header>
  )
}
