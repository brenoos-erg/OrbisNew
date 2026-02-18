'use client'

import Link from 'next/link'
import { NonConformityActionStatus } from '@prisma/client'
import { DragEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import GutRadarCard from '@/components/sst/GutRadarCard'
import { GUT_OPTIONS } from '@/lib/sst/gut'
import { actionStatusLabel, nonConformityTypeLabel } from '@/lib/sst/serializers'

type ActionItem = {
  id: string
  descricao: string
  responsavelNome?: string | null
  prazo?: string | null
  status: NonConformityActionStatus
  evidencias?: string | null
}

type Detail = {
  id: string
  numeroRnc: string
  descricao: string
  evidenciaObjetiva: string
  empresa: string
  referenciaSig?: string | null
  tipoNc: keyof typeof nonConformityTypeLabel
  acoesImediatas?: string | null
  prazoAtendimento: string
  gravidade?: number | null
  urgencia?: number | null
  tendencia?: number | null
  causaRaiz?: string | null
  estudoCausa?: Array<{ pergunta: string; resposta: string }>
  verificacaoEficaciaTexto?: string | null
  status: string
  aprovadoQualidadeStatus: string
  anexos?: any[]
  comentarios?: any[]
  timeline?: any[]
  planoDeAcao?: ActionItem[]
  centroQueDetectou?: { description: string }
  centroQueOriginou?: { description: string }
}

type SectionKey = 'naoConformidade' | 'evidencias' | 'estudoCausa' | 'planoDeAcao' | 'verificacao' | 'comentarios' | 'timeline'

const ACTION_STATUS_OPTIONS = Object.values(NonConformityActionStatus)

export default function NaoConformidadeDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [analiseQualidade, setAnaliseQualidade] = useState('')
  const [causaRaiz, setCausaRaiz] = useState('')
  const [uploading, setUploading] = useState(false)
  const [gutSaving, setGutSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionKey>('naoConformidade')
  const [gut, setGut] = useState({ gravidade: 1, urgencia: 1, tendencia: 1 })
  const [porques, setPorques] = useState<Array<{ pergunta: string; resposta: string }>>(
    Array.from({ length: 5 }).map((_, i) => ({ pergunta: `Por quê ${i + 1}?`, resposta: '' })),
  )
   const [actionDraft, setActionDraft] = useState<{ descricao: string; responsavelNome: string; prazo: string; status: NonConformityActionStatus; evidencias: string }>({ descricao: '', responsavelNome: '', prazo: '', status: NonConformityActionStatus.PENDENTE, evidencias: '' })
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSaving, setActionSaving] = useState(false)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)

  const aprovado = item?.aprovadoQualidadeStatus === 'APROVADO'
  const bloqueado = !aprovado

  async function load() {
    try {
      setLoading(true)
      const res = await fetch(`/api/sst/nao-conformidades/${id}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar')
      setItem(data.item)
      setGut({
        gravidade: Number(data.item.gravidade) || 1,
        urgencia: Number(data.item.urgencia) || 1,
        tendencia: Number(data.item.tendencia) || 1,
      })
      setAnaliseQualidade(data.item.verificacaoEficaciaTexto || '')
      setCausaRaiz(data.item.causaRaiz || '')
      if (Array.isArray(data.item.estudoCausa) && data.item.estudoCausa.length) {
        setPorques(data.item.estudoCausa.map((x: any) => ({ pergunta: x.pergunta, resposta: x.resposta || '' })))
      }
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (bloqueado && activeSection !== 'evidencias') {
      setActiveSection('evidencias')
    }
  }, [activeSection, bloqueado])

  async function sendComment(e: FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    const res = await fetch(`/api/sst/nao-conformidades/${id}/comentarios`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: comment }),
    })
    if (res.ok) {
      setComment('')
      load()
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    const form = new FormData()
    Array.from(files).forEach((f) => form.append('files', f))
    setUploading(true)
    await fetch(`/api/sst/nao-conformidades/${id}/anexos`, { method: 'POST', body: form })
    setUploading(false)
    load()
  }

  async function removeAttachment(attachmentId: string) {
    await fetch(`/api/sst/nao-conformidades/${id}/anexos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [attachmentId] }),
    })
    load()
  }

  async function aprovar(aprovadoValor: boolean) {
    await fetch(`/api/sst/nao-conformidades/${id}/aprovacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprovado: aprovadoValor }),
    })
    load()
  }
  async function salvarGut() {
    setGutSaving(true)
    await fetch(`/api/sst/nao-conformidades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gut),
    })
    setGutSaving(false)
    load()
  }

  async function salvarEstudoCausa(e: FormEvent) {
    e.preventDefault()
    await fetch(`/api/sst/nao-conformidades/${id}/estudo-causa`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ causaRaiz, items: porques }),
    })
    load()
  }

  async function salvarVerificacao(e: FormEvent) {
    e.preventDefault()
    await fetch(`/api/sst/nao-conformidades/${id}/verificacao-eficacia`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analiseQualidade }),
    })
    load()
  }
  function abrirNovaAcaoModal() {
    resetActionForm()
    setActionModalOpen(true)
  }
   function editAction(action: ActionItem) {
    setEditingActionId(action.id)
    setActionDraft({
      descricao: action.descricao || '',
      responsavelNome: action.responsavelNome || '',
      prazo: action.prazo ? action.prazo.slice(0, 10) : '',
      status: action.status,
      evidencias: action.evidencias || '',
    })
    setActionModalOpen(true)
  }

  function resetActionForm() {
    setEditingActionId(null)
    setActionDraft({ descricao: '', responsavelNome: '', prazo: '', status: NonConformityActionStatus.PENDENTE, evidencias: '' })
    setActionError(null)
  }

  function fecharActionModal() {
    if (actionSaving) return
    setActionModalOpen(false)
    resetActionForm()
  }


  async function salvarActionItem(e: FormEvent) {
    e.preventDefault()
    if (bloqueado) return
    if (!actionDraft.descricao.trim()) {
      setActionError('Descrição da ação é obrigatória.')
      return
    }

    setActionSaving(true)
    setActionError(null)

    const body = {
      id: editingActionId,
      descricao: actionDraft.descricao,
      responsavelNome: actionDraft.responsavelNome,
      prazo: actionDraft.prazo || null,
      status: actionDraft.status,
      evidencias: actionDraft.evidencias,
    }

    const method = editingActionId ? 'PATCH' : 'POST'
    const res = await fetch(`/api/sst/nao-conformidades/${id}/plano-de-acao`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setActionError(data?.error || 'Erro ao salvar ação.')
      setActionSaving(false)
      return
    }

    resetActionForm()
    setActionModalOpen(false)
    setActionSaving(false)
    load()
  }

  async function removerActionItem(actionId: string) {
    if (bloqueado) return
    if (!confirm('Deseja excluir esta ação do plano de ação?')) return
    await fetch(`/api/sst/nao-conformidades/${id}/plano-de-acao`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: actionId }),
    })
    if (editingActionId === actionId) resetActionForm()
    load()
  }

  function changeSection(section: SectionKey) {
    if (bloqueado && section !== 'evidencias') return
    setActiveSection(section)
  }

  const podeAprovar = useMemo(() => item?.status === 'AGUARDANDO_APROVACAO_QUALIDADE', [item])

  if (loading && !item) return <p className="text-sm text-slate-600">Carregando...</p>
  if (error && !item) return <p className="text-sm text-rose-700">{error}</p>
  if (!item) return null

  const tabs = [
    { key: 'naoConformidade', label: 'Não conformidade' },
    { key: 'evidencias', label: 'Evidências' },
    { key: 'estudoCausa', label: 'Estudo de causa' },
    { key: 'planoDeAcao', label: 'Ações da Não Conformidade' },
    { key: 'verificacao', label: 'Verificação de eficácia' },
    { key: 'comentarios', label: 'Comentários' },
    { key: 'timeline', label: 'Histórico' },
  ] as const



  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm uppercase text-slate-500">Não conformidades</p>
          <h1 className="text-2xl font-bold text-slate-900">{item.numeroRnc}</h1>
        </div>
        <Link href="/dashboard/sst/nao-conformidades" className="ml-auto text-sm font-medium text-orange-600 hover:text-orange-700">Voltar</Link>
      </div>

      {bloqueado ? <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">Aguardando aprovação da qualidade. Somente a aba de evidências está liberada.</div> : null}
      {podeAprovar ? <div className="flex gap-2"><button onClick={() => aprovar(true)} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">Aprovar</button><button onClick={() => aprovar(false)} className="rounded bg-rose-600 px-3 py-2 text-sm text-white">Reprovar</button></div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const disabled = bloqueado && tab.key !== 'evidencias'
            return (
              <button
                key={tab.key}
                type="button"
                disabled={disabled}
                onClick={() => changeSection(tab.key as SectionKey)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${activeSection === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {activeSection === 'naoConformidade' ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Card title="Não conformidade">
            <Info label="Descrição" value={item.descricao} />
            <Info label="Evidência objetiva" value={item.evidenciaObjetiva} />
            <Info label="Empresa" value={item.empresa} />
            <Info label="Centro que detectou" value={item.centroQueDetectou?.description || '-'} />
            <Info label="Centro que originou" value={item.centroQueOriginou?.description || '-'} />
            <Info label="Prazo atendimento" value={new Date(item.prazoAtendimento).toLocaleDateString('pt-BR')} />
            <Info label="Referência SIG" value={item.referenciaSig || '-'} />
             <Info label="Tipo NC" value={nonConformityTypeLabel[item.tipoNc] || item.tipoNc} />
            <Info label="Ações imediatas" value={item.acoesImediatas || '-'} />
          </Card>

          <div className="space-y-4">
            <Card title="Matriz GUT">
              <FieldSelectNumeric label="Gravidade" value={gut.gravidade} options={GUT_OPTIONS.gravidade} onChange={(value) => setGut((prev) => ({ ...prev, gravidade: value }))} disabled={bloqueado} />
              <FieldSelectNumeric label="Urgência" value={gut.urgencia} options={GUT_OPTIONS.urgencia} onChange={(value) => setGut((prev) => ({ ...prev, urgencia: value }))} disabled={bloqueado} />
              <FieldSelectNumeric label="Tendência" value={gut.tendencia} options={GUT_OPTIONS.tendencia} onChange={(value) => setGut((prev) => ({ ...prev, tendencia: value }))} disabled={bloqueado} />
              <button disabled={bloqueado || gutSaving} onClick={salvarGut} className="w-full rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{gutSaving ? 'Salvando...' : 'Salvar GUT'}</button>
            </Card>
            <GutRadarCard gravidade={gut.gravidade} urgencia={gut.urgencia} tendencia={gut.tendencia} />
          </div>
        </section>
      ) : null}

      {activeSection === 'evidencias' ? (
        <Card title="Evidências">
          <div
            className="rounded-lg border-2 border-dashed border-slate-300 p-4 text-center"
            onDragOver={(e: DragEvent<HTMLDivElement>) => e.preventDefault()}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault()
              uploadFiles(e.dataTransfer.files)
            }}
          >
            <p className="text-sm text-slate-700">Arraste arquivos aqui</p>
            <label className="mt-2 inline-block cursor-pointer rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">
              Adicionar evidência
              <input type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
            </label>
            {uploading ? <p className="mt-2 text-xs text-slate-500">Enviando...</p> : null}
          </div>
          {item.anexos?.length ? (
            <ul className="space-y-2 text-sm">
              {item.anexos.map((a: any) => (
                <li key={a.id} className="rounded-md border border-slate-200 p-2">
                  {String(a.mimeType || '').startsWith('image/') ? (
                    <img src={a.url} alt={a.filename} className="mb-2 h-20 w-20 rounded object-cover" />
                  ) : null}
                  <a href={`/api/sst/nao-conformidades/${id}/anexos/${a.id}`} target="_blank" className="text-orange-700 hover:underline">{a.filename}</a>
                  <p className="text-xs text-slate-500">{Math.round((a.sizeBytes || 0) / 1024)} KB · {new Date(a.createdAt).toLocaleString('pt-BR')} · {a.createdBy?.fullName || 'Sistema'}</p>
                  <button onClick={() => removeAttachment(a.id)} className="mt-1 text-xs text-rose-600 hover:underline">Excluir</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Nenhum anexo.</p>}
        </Card>
      ) : null}

      {activeSection === 'estudoCausa' ? (
        <Card title="Estudo de causa">
          <form onSubmit={salvarEstudoCausa} className="space-y-2">
            {porques.map((p, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-2">
                <input value={p.pergunta} onChange={(e)=>setPorques((prev)=>prev.map((x,i)=>i===idx?{...x, pergunta:e.target.value}:x))} disabled={bloqueado} className="rounded border px-2 py-1 text-sm" />
                <input value={p.resposta} onChange={(e)=>setPorques((prev)=>prev.map((x,i)=>i===idx?{...x, resposta:e.target.value}:x))} disabled={bloqueado} placeholder="Resposta" className="rounded border px-2 py-1 text-sm" />
              </div>
            ))}
            <button type="button" disabled={bloqueado} onClick={()=>setPorques((p)=>[...p, { pergunta: `Por quê ${p.length + 1}?`, resposta: '' }])} className="rounded border px-2 py-1 text-sm">Adicionar porquê</button>
            <textarea value={causaRaiz} onChange={(e)=>setCausaRaiz(e.target.value)} disabled={bloqueado} className="w-full rounded border px-2 py-1 text-sm" placeholder="Causa raiz" />
            <button disabled={bloqueado} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Salvar estudo de causa</button>
          </form>
        </Card>
      ) : null}
        {activeSection === 'planoDeAcao' ? (
        <Card title="Ações da Não Conformidade">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Gerencie o plano de ação para tratar a não conformidade.</p>
            <button
              type="button"
              onClick={abrirNovaAcaoModal}
              disabled={bloqueado}
              className="rounded bg-orange-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Nova ação
            </button>
          </div>

          {item.planoDeAcao?.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Prazo</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Evidências</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {item.planoDeAcao.map((action) => (
                    <tr key={action.id} className="align-top">
                      <td className="px-3 py-2 font-medium text-slate-800">{action.descricao}</td>
                      <td className="px-3 py-2 text-slate-700">{action.responsavelNome || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{action.prazo ? new Date(action.prazo).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{actionStatusLabel[action.status]}</td>
                      <td className="px-3 py-2 text-slate-700">{action.evidencias || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-3">
                          <button type="button" disabled={bloqueado} onClick={() => editAction(action)} className="text-xs font-medium text-orange-700 hover:underline disabled:opacity-50">Editar</button>
                          <button type="button" disabled={bloqueado} onClick={() => removerActionItem(action.id)} className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-50">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma ação cadastrada.</p>
          )}
        </Card>
      ) : null}


      {activeSection === 'verificacao' ? (
        <Card title="Verificação de eficácia">
          <form onSubmit={salvarVerificacao} className="space-y-2">
            <textarea value={analiseQualidade} onChange={(e)=>setAnaliseQualidade(e.target.value)} disabled={bloqueado} className="w-full rounded border px-2 py-1 text-sm" rows={4} placeholder="Análise da qualidade" />
            <button disabled={bloqueado} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Salvar verificação</button>
          </form>
        </Card>
      ) : null}

      {activeSection === 'comentarios' ? (
        <Card title="Comentários">
          <form onSubmit={sendComment} className="mb-3 space-y-2">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Adicionar comentário" />
            <div className="text-right"><button className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Enviar comentário</button></div>
          </form>
        </Card>
      ) : null}

        {activeSection === 'timeline' ? (
        <Card title="Histórico">
          {item.timeline?.length ? <ul className="space-y-2">{item.timeline.map((t: any)=><li key={t.id} className="rounded-md border border-slate-200 p-2 text-sm"><p className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR')} · {t.actor?.fullName || 'Sistema'}</p><p className="text-slate-700">{t.message || t.tipo}</p></li>)}</ul> : <p className="text-sm text-slate-500">Sem eventos.</p>}
        </Card>
      ) : null}

      {actionModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{editingActionId ? 'Editar ação' : 'Nova ação'}</h3>
              <button type="button" onClick={fecharActionModal} className="text-sm text-slate-500 hover:text-slate-700">Fechar</button>
            </div>
            <form onSubmit={salvarActionItem} className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={actionDraft.descricao}
                  onChange={(e) => setActionDraft((prev) => ({ ...prev, descricao: e.target.value }))}
                  disabled={bloqueado || actionSaving}
                  placeholder="Descrição da ação"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  value={actionDraft.responsavelNome}
                  onChange={(e) => setActionDraft((prev) => ({ ...prev, responsavelNome: e.target.value }))}
                  disabled={bloqueado || actionSaving}
                  placeholder="Responsável"
                  className="rounded border px-2 py-1 text-sm"
                />
                <input
                  type="date"
                  value={actionDraft.prazo}
                  onChange={(e) => setActionDraft((prev) => ({ ...prev, prazo: e.target.value }))}
                  disabled={bloqueado || actionSaving}
                  className="rounded border px-2 py-1 text-sm"
                />
                <select
                  value={actionDraft.status}
                  onChange={(e) => setActionDraft((prev) => ({ ...prev, status: e.target.value as NonConformityActionStatus }))}
                  disabled={bloqueado || actionSaving}
                  className="rounded border px-2 py-1 text-sm"
                >
                  {ACTION_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{actionStatusLabel[status]}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={actionDraft.evidencias}
                onChange={(e) => setActionDraft((prev) => ({ ...prev, evidencias: e.target.value }))}
                disabled={bloqueado || actionSaving}
                className="w-full rounded border px-2 py-1 text-sm"
                rows={3}
                placeholder="Evidências da ação"
              />
              {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={fecharActionModal} className="rounded border border-slate-300 px-3 py-2 text-sm" disabled={actionSaving}>Cancelar</button>
                <button disabled={bloqueado || actionSaving} className="rounded bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-60">{editingActionId ? 'Atualizar ação' : 'Adicionar ação'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"><h2 className="text-lg font-semibold text-slate-900">{title}</h2>{children}</section>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="whitespace-pre-wrap text-sm text-slate-800">{value}</p></div>
}

function FieldSelectNumeric({ label, value, options, onChange, disabled }: { label: string; value: number; options: ReadonlyArray<{ value: number; label: string }>; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="block space-y-1 text-sm font-medium text-slate-700">
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
