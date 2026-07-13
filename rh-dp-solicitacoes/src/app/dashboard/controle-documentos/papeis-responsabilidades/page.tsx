import { redirect } from 'next/navigation'
import DocumentControlTabs from '@/components/documents/DocumentControlTabs'
import { getCurrentAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageDocumentRoles, hasDocumentPermission } from '@/lib/documents/documentRoleAccess'
import DocumentRolesClient from './DocumentRolesClient'

export default async function DocumentRolesPage() {
  const { appUser } = await getCurrentAppUser()
  if (!appUser) redirect('/login')
  const canManage = await canManageDocumentRoles(appUser.id, appUser.role)
  if (!canManage) redirect('/dashboard/controle-documentos/publicados')

  const [initialItems, initialTotal, metrics, canAccessApprovalDocuments, canAccessQualityReviewDocuments] = await Promise.all([
    prisma.documentRoleAssignment.findMany({
      include: { user: { select: { id: true, fullName: true, email: true, department: true, costCenter: true, moduleAccesses: { where: { module: { key: 'controle-documentos' } }, select: { level: true } } } }, department: true, costCenter: true, documentType: true, document: { select: { id: true, code: true, title: true } }, approverGroup: true, createdBy: { select: { id: true, fullName: true } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    }),
    prisma.documentRoleAssignment.count(),
    loadMetrics(),
    hasDocumentPermission(appUser.id, 'CAN_APPROVE_TECHNICAL'),
    hasDocumentPermission(appUser.id, 'CAN_APPROVE_QUALITY'),
  ])

  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6"><DocumentControlTabs isAdmin={appUser.role === 'ADMIN'} canAccessApprovalDocuments={canAccessApprovalDocuments} canAccessQualityReviewDocuments={canAccessQualityReviewDocuments} /><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Controle de Documentos SGI</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Papéis e Responsabilidades</h1><p className="mt-2 text-slate-600">Controle quem pode elaborar, aprovar, publicar e administrar documentos no SGI.</p></section><DocumentRolesClient initialItems={initialItems} initialTotal={initialTotal} initialMetrics={metrics} /></main>
}

async function loadMetrics() {
  const now = new Date(); const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  const [usersWithRoles, managers, quality, technical, publishers, inactive, temporary, expiring] = await Promise.all([
    prisma.documentRoleAssignment.findMany({ where: { active: true }, select: { userId: true }, distinct: ['userId'] }),
    prisma.documentRoleAssignment.count({ where: { active: true, role: 'DOCUMENT_MANAGER' } }),
    prisma.documentRoleAssignment.count({ where: { active: true, role: 'QUALITY_REVIEWER' } }),
    prisma.documentRoleAssignment.count({ where: { active: true, role: 'TECHNICAL_APPROVER' } }),
    prisma.documentRoleAssignment.count({ where: { active: true, role: 'DOCUMENT_PUBLISHER' } }),
    prisma.documentRoleAssignment.count({ where: { active: false } }),
    prisma.documentRoleAssignment.count({ where: { active: true, substituteForUserId: { not: null } } }),
    prisma.documentRoleAssignment.count({ where: { active: true, validUntil: { gte: now, lte: soon } } }),
  ])
  return { usersWithRoles: usersWithRoles.length, managers, quality, technical, publishers, inactive, temporary, expiring }
}
