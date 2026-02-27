import { Action } from '@prisma/client'
import { getCurrentAppUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { EmailControlPanel } from '@/components/solicitacoes/EmailControlPanel'

export default async function SolicitacoesCadastrosPage() {
  const { appUser } = await getCurrentAppUser()
  const isSuperAdminEmail = appUser?.email?.toLowerCase() === 'superadmin@ergengenharia.com.br'

  const canViewFluxos = appUser
    ? await canFeature(
        appUser.id,
        MODULE_KEYS.SOLICITACOES,
        FEATURE_KEYS.SOLICITACOES.FLUXOS,
        Action.VIEW,
      )
    : false

  const canEditFluxos = appUser
    ? await canFeature(
        appUser.id,
        MODULE_KEYS.SOLICITACOES,
        FEATURE_KEYS.SOLICITACOES.FLUXOS,
        Action.UPDATE,
      )
    : false


  const canAccessEmailControl = canViewFluxos && isSuperAdminEmail

  return (
    <div className="space-y-4">
     <h1 className="text-xl font-semibold">Controle de Emails</h1>
      <p className="text-sm text-slate-600">
        Configure as mensagens enviadas para departamentos e aprovadores em cada etapa/ação.
      </p>

      {canAccessEmailControl ? (
        <EmailControlPanel canEdit={canEditFluxos} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Esta área é restrita ao administrador principal (<strong>superadmin@ergengenharia.com.br</strong>).
        </div>
      )}
    </div>
  )
}