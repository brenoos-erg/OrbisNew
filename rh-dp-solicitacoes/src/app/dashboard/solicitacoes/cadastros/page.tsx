import Link from 'next/link'
import { Action } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'

export default async function SolicitacoesCadastrosPage() {
  const { appUser } = await getCurrentAppUser()

  const canViewFluxos = appUser
    ? await canFeature(
        appUser.id,
        MODULE_KEYS.SOLICITACOES,
        FEATURE_KEYS.SOLICITACOES.FLUXOS,
        Action.VIEW,
      )
    : false

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Cadastros de Solicitações</h1>
      <p className="text-sm text-slate-600">Escolha um cadastro para configurar.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/solicitacoes/cadastros/formulario" className="rounded-lg border p-4 hover:bg-slate-50">
          <h2 className="font-medium">Formulário</h2>
          <p className="text-sm text-slate-600">Monte os campos por tipo de solicitação.</p>
        </Link>

        <Link href="/dashboard/solicitacoes/cadastros/categorias" className="rounded-lg border p-4 hover:bg-slate-50">
          <h2 className="font-medium">Categorias</h2>
          <p className="text-sm text-slate-600">Gerencie as categorias de solicitações.</p>
        </Link>

        {canViewFluxos && (
          <Link href="/dashboard/solicitacoes/cadastros/fluxos" className="rounded-lg border p-4 hover:bg-slate-50">
            <h2 className="font-medium">Fluxo de Solicitações</h2>
            <p className="text-sm text-slate-600">Defina etapas, aprovadores e transições do processo.</p>
          </Link>
        )}
      </div>
    </div>
  )
}
