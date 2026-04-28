'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Eye, History, Mail, RefreshCcw, Save, Send, Settings2 } from 'lucide-react'
import { DOCUMENT_NOTIFICATION_PLACEHOLDERS } from '@/lib/documents/documentNotificationTypes'

type Rule = any

type Props = { canEdit: boolean }

const EVENT_TRANSLATIONS: Record<string, string> = {
  DOCUMENT_SUBMITTED_FOR_APPROVAL: 'Aguardando aprovação',
  DOCUMENT_QUALITY_REVIEW: 'Revisão da qualidade',
}
const ORIGIN_LABELS: Record<string, string> = {
  author: 'Elaborador',
  approverGroup: 'Grupo aprovador',
  qualityReviewers: 'Revisão da qualidade',
  ownerDepartment: 'Departamento responsável',
  ownerCostCenter: 'Centro de custo responsável',
  distributionTargets: 'Distribuição',
  fixedEmails: 'E-mails fixos',
}

const TAB_OPTIONS = [
  { key: 'destinatarios', label: 'Destinatários', icon: Settings2 },
  { key: 'template', label: 'Template', icon: Mail },
  { key: 'previa', label: 'Prévia', icon: Eye },
  { key: 'historico', label: 'Histórico', icon: History },
] as const

export default function DocumentNotificationsPanel({ canEdit }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<any>(null)
  const [filters, setFilters] = useState({ documentTypeId: '', event: '', status: '' })
  const [editing, setEditing] = useState<Rule | null>(null)
  const [previewResult, setPreviewResult] = useState<any>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<(typeof TAB_OPTIONS)[number]['key']>('destinatarios')
  const [previewDocumentId, setPreviewDocumentId] = useState('')

  const refresh = async () => {
    setLoading(true)
    const query = new URLSearchParams(filters)
    const response = await fetch(`/api/documents/notifications?${query.toString()}`, { cache: 'no-store' })
    const payload = await response.json()
    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.documentTypeId, filters.event, filters.status])

  const onSave = async () => {
    if (!editing) return
    setSaving(true)
    await fetch('/api/documents/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(editing),
    })
    setSaving(false)
    setEditing(null)
    refresh()
  }

  const eventLabel = (event: string) => EVENT_TRANSLATIONS[event] ?? data?.events?.find((item: any) => item.value === event)?.label ?? event

  const flowMap = useMemo(() => {
    const byType = new Map<string, any[]>()
    ;(data?.flowMap ?? []).forEach((item: any) => {
      const key = item.documentTypeId
      byType.set(key, [...(byType.get(key) ?? []), item])
    })
    return byType
  }, [data])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Central de Notificações de Documentos</h2>
            <p className="text-sm text-slate-500">Configure quem recebe e-mails, por qual motivo e em qual etapa documental.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={refresh} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><RefreshCcw size={14} />Atualizar</button>
            <button disabled={!canEdit || saving || !editing} onClick={onSave} className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"><Save size={14} />Salvar alterações</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric title="Regras ativas" value={data?.summary?.activeRules} />
        <Metric title="Eventos configurados" value={data?.summary?.configuredEvents} />
        <Metric title="Regras com alerta" value={data?.summary?.rulesWithAlerts} />
        <Metric title="Envios hoje" value={data?.summary?.sentToday} />
        <Metric title="Falhas hoje" value={data?.summary?.failedToday} />
        <div className="rounded-xl border bg-white p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">Último erro</p><p className="text-xs">{data?.summary?.lastError?.error ?? 'Sem erros recentes'}</p></div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="grid gap-2 md:grid-cols-5">
          <select value={filters.documentTypeId} onChange={(e) => setFilters((prev) => ({ ...prev, documentTypeId: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            <option value="">Tipo documental</option>
            {(data?.types ?? []).map((type: any) => <option key={type.id} value={type.id}>{type.description}</option>)}
          </select>
          <select value={filters.event} onChange={(e) => setFilters((prev) => ({ ...prev, event: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            <option value="">Evento</option>
            {(data?.events ?? []).map((event: any) => <option key={event.value} value={event.value}>{event.label}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            <option value="">Status da regra</option>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </select>
        </div>
      </div>

      {filters.documentTypeId && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold">Mapa do fluxo por tipo documental</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {(flowMap.get(filters.documentTypeId) ?? []).map((step: any) => (
              <div key={step.id} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">Etapa {step.order}</p>
                <p>Grupo aprovador: {step.approverGroupName}</p>
                <p className="text-slate-500">Tipo: {step.stepType}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-3 text-base font-semibold">Regras por evento/etapa</h3>
        <div className="space-y-2">
          {(data?.rules ?? []).map((rule: any) => (
            <div key={rule.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{eventLabel(rule.event)}</p>
                  <p className="text-xs text-slate-500">{rule.documentType?.description ?? 'Todos os tipos'} · {rule.flowItem ? `Etapa ${rule.flowItem.order}` : 'Todas as etapas'}</p>
                </div>
                <button className="rounded border px-2 py-1 text-xs" onClick={() => setEditing({ ...rule })}>Configurar</button>
              </div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-4">
                <Badge enabled={rule.notifyAuthor} label="Elaborador" />
                <Badge enabled={rule.notifyApproverGroup} label="Grupo aprovador" />
                <Badge enabled={rule.notifyQualityReviewers} label="Revisão da qualidade" />
                <Badge enabled={rule.notifyOwnerDepartment} label="Departamento responsável" />
                <Badge enabled={rule.notifyOwnerCostCenter} label="Centro de custo" />
                <Badge enabled={rule.notifyDistributionTargets} label="Distribuição" />
                <Badge enabled={Array.isArray(rule.fixedEmailsJson) && rule.fixedEmailsJson.length > 0} label="E-mails fixos" />
                <Badge enabled={Array.isArray(rule.ccEmailsJson) && rule.ccEmailsJson.length > 0} label="Cópias (CC)" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-3 text-base font-semibold">Alertas de configuração</h3>
        <div className="space-y-2 text-sm">
          {(data?.rules ?? [])
            .filter(
              (rule: any) =>
                !rule.notifyAuthor &&
                !rule.notifyApproverGroup &&
                !rule.notifyQualityReviewers &&
                !rule.notifyOwnerDepartment &&
                !rule.notifyOwnerCostCenter &&
                !rule.notifyDistributionTargets &&
                (!Array.isArray(rule.fixedEmailsJson) || rule.fixedEmailsJson.length === 0),
            )
            .map((rule: any) => (
              <div key={`alert-${rule.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Regra sem destinatários ativos: {eventLabel(rule.event)} · {rule.documentType?.description ?? 'Todos os tipos'} ·{' '}
                {rule.flowItem ? `Etapa ${rule.flowItem.order}` : 'Todas as etapas'}
              </div>
            ))}
          {!data?.rules?.some(
            (rule: any) =>
              !rule.notifyAuthor &&
              !rule.notifyApproverGroup &&
              !rule.notifyQualityReviewers &&
              !rule.notifyOwnerDepartment &&
              !rule.notifyOwnerCostCenter &&
              !rule.notifyDistributionTargets &&
              (!Array.isArray(rule.fixedEmailsJson) || rule.fixedEmailsJson.length === 0),
          ) && <p className="text-xs text-emerald-700">Sem alertas de configuração no momento.</p>}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="mb-3 text-base font-semibold">Histórico geral</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th>Data/Hora</th><th>Documento</th><th>Evento</th><th>Destinatário</th><th>Origem</th><th>Status</th><th>Erro</th></tr></thead>
            <tbody>
              {(data?.history ?? []).map((item: any) => (
                <tr key={item.id} className="border-b align-top text-xs">
                  <td className="py-2">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                  <td>{item.document} ({item.revision})</td><td>{item.eventLabel}</td><td>{item.recipientEmail}</td><td>{item.recipientSource}</td><td>{item.status}</td><td className="text-red-600">{item.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-4 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Configurar regra</h3><button className="rounded border px-2 py-1" onClick={() => setEditing(null)}>Fechar</button></div>

            <div className="mb-3 flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => (
                <button key={tab.key} onClick={() => setModalTab(tab.key)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${modalTab === tab.key ? 'bg-slate-900 text-white' : ''}`}>
                  <tab.icon className="h-3 w-3" /> {tab.label}
                </button>
              ))}
            </div>

            {modalTab === 'destinatarios' && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle label="Elaborador" checked={editing.notifyAuthor} onChange={(value) => setEditing((prev: any) => ({ ...prev, notifyAuthor: value }))} />
                  <Toggle label="Grupo aprovador" checked={editing.notifyApproverGroup} onChange={(value) => setEditing((prev: any) => ({ ...prev, notifyApproverGroup: value }))} />
                  <Toggle label="Revisão da qualidade" checked={editing.notifyQualityReviewers} onChange={(value) => setEditing((prev: any) => ({ ...prev, notifyQualityReviewers: value }))} />
                  <Toggle label="Departamento responsável" checked={editing.notifyOwnerDepartment} onChange={(value) => setEditing((prev: any) => ({ ...prev, notifyOwnerDepartment: value }))} />
                  <Toggle label="Centro de custo responsável" checked={editing.notifyOwnerCostCenter} onChange={(value) => setEditing((prev: any) => ({ ...prev, notifyOwnerCostCenter: value }))} />
                  <Toggle label="Distribuição" checked={editing.notifyDistributionTargets} onChange={(value) => setEditing((prev: any) => ({ ...prev, notifyDistributionTargets: value }))} />
                </div>
                <label className="mt-3 block text-sm">E-mails fixos (separados por vírgula)</label>
                <input className="w-full rounded border px-3 py-2" value={(editing.fixedEmailsJson ?? []).join(', ')} onChange={(e) => setEditing((prev: any) => ({ ...prev, fixedEmailsJson: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} />
                <label className="mt-3 block text-sm">Cópias (CC)</label>
                <input className="w-full rounded border px-3 py-2" value={(editing.ccEmailsJson ?? []).join(', ')} onChange={(e) => setEditing((prev: any) => ({ ...prev, ccEmailsJson: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} />
              </>
            )}

            {modalTab === 'template' && (
              <>
                <label className="mt-3 block text-sm">Assunto</label>
                <input className="w-full rounded border px-3 py-2" value={editing.subjectTemplate ?? ''} onChange={(e) => setEditing((prev: any) => ({ ...prev, subjectTemplate: e.target.value }))} />
                <label className="mt-3 block text-sm">Corpo</label>
                <textarea className="h-32 w-full rounded border px-3 py-2" value={editing.bodyTemplate ?? ''} onChange={(e) => setEditing((prev: any) => ({ ...prev, bodyTemplate: e.target.value }))} />
                <div className="mt-3 rounded border bg-slate-50 p-2 text-xs dark:bg-slate-800">
                  <p className="mb-1 font-semibold">Placeholders disponíveis</p>
                  <p>{DOCUMENT_NOTIFICATION_PLACEHOLDERS.join(', ')}</p>
                </div>
              </>
            )}

            {modalTab === 'previa' && (
              <>
                <div className="mb-2 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs">ID do documento (para prévia/teste)</label>
                    <input className="rounded border px-3 py-2 text-sm" value={previewDocumentId} onChange={(e) => setPreviewDocumentId(e.target.value)} placeholder="UUID do documento" />
                  </div>
                  <button
                    className="rounded border px-3 py-2 text-sm"
                    onClick={async () => {
                      const response = await fetch('/api/documents/notifications', {
                        method: 'POST', headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ mode: 'preview', event: editing.event, documentId: previewDocumentId, flowItemId: editing.flowItemId, ruleId: editing.id }),
                      })
                      const payload = await response.json()
                      setPreviewResult(payload)
                    }}
                  >Prévia</button>
                  <button className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm" onClick={async () => {
                    const response = await fetch('/api/documents/notifications', {
                      method: 'POST', headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ mode: 'test', event: editing.event, documentId: previewDocumentId, flowItemId: editing.flowItemId, ruleId: editing.id }),
                    })
                    const payload = await response.json()
                    setTestResult(payload.ok ? 'Envio de teste realizado.' : `Falha: ${payload.error ?? 'erro no envio'}`)
                    refresh()
                  }}><Send className="h-3 w-3" />Enviar teste</button>
                </div>
                {testResult && <p className="mb-2 text-xs">{testResult}</p>}
                {previewResult && (
                  <div className="rounded border p-3 text-xs">
                    <p className="font-semibold">Prévia</p>
                    <p><strong>Assunto:</strong> {previewResult.subject ?? '-'}</p>
                    <p className="mt-1 whitespace-pre-wrap"><strong>Corpo:</strong> {previewResult.body ?? '-'}</p>
                    <p className="mt-1"><strong>Destinatários:</strong> {(previewResult?.recipients?.recipients ?? []).map((item: any) => item.email).join(', ') || '-'}</p>
                    <div className="mt-2 grid gap-1">
                      {Object.entries(previewResult?.recipients?.byOrigin ?? {}).map(([origin, recipients]: [string, any]) => (
                        <p key={origin}>
                          <strong>{ORIGIN_LABELS[origin] ?? origin}:</strong>{' '}
                          {(recipients ?? []).map((item: any) => item.email).join(', ') || '-'}
                        </p>
                      ))}
                    </div>
                    <p className="mt-1"><strong>Alertas:</strong> {(previewResult?.recipients?.warnings ?? []).join(' | ') || 'Sem alertas'}</p>
                  </div>
                )}
              </>
            )}

            {modalTab === 'historico' && (
              <div className="rounded border bg-slate-50 p-3 text-xs dark:bg-slate-800">
                <p>O histórico completo fica na seção "Histórico geral" desta central. Use filtros por evento/status para diagnosticar ausências de destinatário e falhas de envio.</p>
              </div>
            )}

            <div className="mt-3"><button disabled={!canEdit || saving} onClick={onSave} className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white"><Save size={14} />Salvar</button></div>
          </div>
        </div>
      )}

      {loading && <div className="rounded border bg-slate-50 p-3 text-sm">Carregando dados...</div>}
      {!data?.rules?.length && !loading && <div className="rounded border bg-amber-50 p-3 text-sm"><AlertTriangle className="mr-1 inline h-4 w-4" />Nenhuma regra configurada ainda.</div>}
    </div>
  )
}

function Metric({ title, value }: { title: string; value: number | string }) {
  return <div className="rounded-xl border bg-white p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">{title}</p><p className="text-2xl font-semibold">{value ?? 0}</p></div>
}

function Badge({ enabled, label }: { enabled: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Mail className="h-3 w-3" />{label}</span>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded border px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>
}
