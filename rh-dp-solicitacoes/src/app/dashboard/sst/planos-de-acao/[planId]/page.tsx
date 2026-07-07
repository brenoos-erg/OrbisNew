import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createLegacyPlanForAction } from '@/app/api/sst/planos-de-acao/helpers'
import PlanoAvulsoDetailClient from './PlanoAvulsoDetailClient'

export default async function Page({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.qualityActionPlan.findUnique({ where: { id: planId }, select: { id: true } })

  if (!plan) {
    const action = await prisma.nonConformityActionItem.findUnique({
      where: { id: planId },
      select: { id: true, nonConformityId: true, qualityActionPlanId: true },
    })

    if (action && !action.nonConformityId) {
      const targetPlanId = action.qualityActionPlanId || await createLegacyPlanForAction(action.id)
      if (targetPlanId) redirect(`/dashboard/sgi/qualidade/planos-de-acao/${targetPlanId}`)
    }
  }

  return <PlanoAvulsoDetailClient planId={planId} />
}
