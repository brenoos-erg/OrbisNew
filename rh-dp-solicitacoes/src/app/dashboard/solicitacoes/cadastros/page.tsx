import { Action } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { EmailControlPanel } from '@/components/solicitacoes/EmailControlPanel'

export default async function SolicitacoesCadastrosPage() {
  const { appUser } = await getCurrentAppUser()

  const canViewFluxos = appUser
    ? await canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.FLUXOS, Action.VIEW)
    : false

  const canEditFluxos = appUser
    ? await canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.FLUXOS, Action.UPDATE)
    : false

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Central de Notificações de Solicitações</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Configure quem será notificado em cada etapa do fluxo e acompanhe falhas de envio.
      </p>

      {canViewFluxos ? (
        <EmailControlPanel canEdit={canEditFluxos} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Você não possui permissão para visualizar esta central.
        </div>
      )}
    </div>
  )
}
