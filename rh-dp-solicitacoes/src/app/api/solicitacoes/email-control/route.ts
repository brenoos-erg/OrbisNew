import { NextRequest, NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { prisma } from '@/lib/prisma'
import { readWorkflowRows } from '@/lib/solicitationWorkflowsStore'
import { appendSolicitationEmailLog, readSolicitationEmailLogs } from '@/lib/solicitationEmailLogStore'
import { sendMail } from '@/lib/mailer'

type DateRange = {
  from?: string | null
  to?: string | null
}

async function hasEmailControlAccess(action: Action) {
  const appUser = await requireActiveUser()
  const isSuperAdminEmail = appUser.email?.toLowerCase() === 'superadmin@ergengenharia.com.br'
  const hasFeature = await canFeature(
    appUser.id,
    MODULE_KEYS.SOLICITACOES,
    FEATURE_KEYS.SOLICITACOES.FLUXOS,
    action,
  )

  return hasFeature && isSuperAdminEmail
}

function isInsideRange(value: string, range: DateRange) {
  const date = new Date(value).getTime()
  const from = range.from ? new Date(range.from).getTime() : null
  const to = range.to ? new Date(range.to).getTime() : null

  if (Number.isNaN(date)) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export async function GET(req: NextRequest) {
  if (!(await hasEmailControlAccess('VIEW'))) {
    return NextResponse.json({ error: 'Sem permissão para visualizar o painel de e-mails.' }, { status: 403 })
  }

  const params = req.nextUrl.searchParams
  const typeId = params.get('typeId')?.trim() || ''
  const event = params.get('event')?.trim() || ''
  const statusFilter = params.get('status')?.trim() || ''
  const resultFilter = params.get('result')?.trim() || ''
  const periodFrom = params.get('from')?.trim() || null
  const periodTo = params.get('to')?.trim() || null

  const [types, rows, logs, departments] = await Promise.all([
    prisma.tipoSolicitacao.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    readWorkflowRows(),
    readSolicitationEmailLogs(),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ])

  const selectedTypeId = typeId || types[0]?.id || ''
  const workflow = rows.find((row) => row.tipoId === selectedTypeId)
  const deptById = new Map(departments.map((department) => [department.id, department.name]))

  const rules = (workflow?.steps ?? []).map((step, index) => {
    const isApprover = step.kind === 'APROVACAO'
    const template = isApprover ? step.approvalTemplate : step.notificationTemplate

    return {
      id: step.stepKey,
      order: step.order || index + 1,
      event: isApprover ? 'notificacao_aprovador' : `etapa_${index + 1}`,
      eventLabel: isApprover ? 'Notificação para aprovador' : `Mudança para etapa ${index + 1}`,
      stepKind: step.kind,
      stepLabel: step.defaultDepartmentId ? deptById.get(step.defaultDepartmentId) ?? step.label : step.label,
      requestTypeId: selectedTypeId,
      requestTypeName: types.find((tipo) => tipo.id === selectedTypeId)?.nome ?? '-',
      departmentId: step.defaultDepartmentId ?? null,
      departmentName: step.defaultDepartmentId ? deptById.get(step.defaultDepartmentId) ?? '-' : '-',
      enabled: step.enabled ?? true,
      recipients: {
        fixed: step.notificationEmails ?? [],
        fromDepartment: step.kind === 'DEPARTAMENTO',
        fromRequester: step.notificationChannels?.notifyRequester ?? false,
        fromApprover: step.notificationChannels?.notifyApprover ?? step.kind === 'APROVACAO',
        adminEmails: step.notificationAdminEmails ?? [],
      },
      channels: {
        notifyRequester: step.notificationChannels?.notifyRequester ?? false,
        notifyDepartment: step.notificationChannels?.notifyDepartment ?? true,
        notifyApprover: step.notificationChannels?.notifyApprover ?? step.kind === 'APROVACAO',
        notifyAdmins: step.notificationChannels?.notifyAdmins ?? false,
      },
      template: {
        subject: template?.subject ?? '',
        body: template?.body ?? '',
      },
    }
  })

  const filteredRules = rules.filter((rule) => {
    if (event && !rule.eventLabel.toLowerCase().includes(event.toLowerCase())) return false
    if (statusFilter === 'active' && !rule.enabled) return false
    if (statusFilter === 'inactive' && rule.enabled) return false
    return true
  })

  const range = { from: periodFrom, to: periodTo }

  const filteredLogs = logs.filter((log) => {
    if (!isInsideRange(log.createdAt, range)) return false
    if (selectedTypeId && log.typeId && log.typeId !== selectedTypeId) return false
    if (event && !log.event.toLowerCase().includes(event.toLowerCase())) return false
    if (resultFilter === 'success' && log.status !== 'SUCCESS' && log.status !== 'TEST') return false
    if (resultFilter === 'failed' && log.status !== 'FAILED') return false
    return true
  })

  const todayIso = new Date().toISOString().slice(0, 10)
  const logsToday = logs.filter((log) => log.createdAt.startsWith(todayIso))
  const lastError = logs.find((log) => log.status === 'FAILED')

  return NextResponse.json({
    types: types.map((tipo) => ({ id: tipo.id, name: tipo.nome })),
    selectedTypeId,
    metrics: {
      activeRules: rules.filter((rule) => rule.enabled).length,
      inactiveRules: rules.filter((rule) => !rule.enabled).length,
      sentToday: logsToday.filter((log) => log.status === 'SUCCESS' || log.status === 'TEST').length,
      failedToday: logsToday.filter((log) => log.status === 'FAILED').length,
      lastError: lastError
        ? {
            at: lastError.createdAt,
            event: lastError.event,
            error: lastError.error,
          }
        : null,
    },
    rules: filteredRules,
    history: filteredLogs.slice(0, 120),
  })
}

export async function POST(req: NextRequest) {
  if (!(await hasEmailControlAccess('UPDATE'))) {
    return NextResponse.json({ error: 'Sem permissão para testar e-mails.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        typeId?: string
        event?: string
        recipients?: string[]
        subject?: string
        message?: string
      }
    | null

  const recipients = Array.from(new Set((body?.recipients ?? []).map((item) => item.trim()).filter(Boolean)))
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos um destinatário para o teste.' }, { status: 400 })
  }

  const subject = body?.subject?.trim() || '[Teste] Painel de e-mails das solicitações'
  const message =
    body?.message?.trim() ||
    'Este é um envio de teste do painel administrativo de e-mails das solicitações.'

  const result = await sendMail(
    {
      to: recipients,
      subject,
      text: `${message}\n\nGerado em: ${new Date().toLocaleString('pt-BR')}`,
    },
    'NOTIFICATIONS',
  )

  await appendSolicitationEmailLog({
    typeId: body?.typeId ?? null,
    event: body?.event?.trim() || 'teste_manual',
    recipients,
    status: result.sent ? 'TEST' : 'FAILED',
    subject,
    error: result.sent ? null : result.error ?? 'Falha no envio de teste.',
    metadata: {
      provider: result.provider ?? null,
      source: 'email-control-panel',
    },
  })

  if (!result.sent) {
    return NextResponse.json({ ok: false, error: result.error ?? 'Falha no envio.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, provider: result.provider })
}