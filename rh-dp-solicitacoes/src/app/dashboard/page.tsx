import Link from 'next/link'

export default function DashboardHome() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Bem-vindo 👋</h1>
      <p className="text-slate-600 mb-6">Use o menu ao lado para acessar as solicitações.</p>
      <Link
        href="/dashboard/solicitacoes"
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
      >
        Ir para Solicitações
      </Link>
    </div>
  )
}