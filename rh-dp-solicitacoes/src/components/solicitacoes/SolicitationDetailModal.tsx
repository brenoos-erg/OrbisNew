// src/components/solicitacoes/SolicitationDetailModal.tsx
'use client'

import { format } from 'date-fns'
import React, { useState } from 'react'

const LABEL_RO =
  'block text-xs font-semibold text-slate-700 uppercase tracking-wide'
const INPUT_RO =
  'mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700 focus:outline-none cursor-default'

// ===== Tipos que a página de lista já usa =====
export type Row = {
  id: string
  titulo: string
  status: string
  protocolo?: string
  createdAt: string
  tipo?: { nome: string } | null
  responsavel?: { fullName: string } | null
  responsavelId?: string | null
  autor?: { fullName: string } | null
  sla?: string | null
  setorDestino?: string | null
}

type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

type SchemaJson = {
  camposEspecificos?: CampoEspecifico[]
}

type PayloadSolicitante = {
  fullName?: string
  email?: string
  login?: string
  phone?: string
  costCenterText?: string
}

type Payload = {
  campos?: Record<string, any>
  solicitante?: PayloadSolicitante
  [key: string]: any
}

type Attachment = {
  id: string
  filename: string
  url: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

type Comment = {
  id: string
  texto: string
  createdAt: string
  autor?: {
    id: string
    fullName: string
    email: string
  } | null
}

type ChildSolicitation = {
  id: string
  protocolo: string
  titulo: string
  status: string
  dataAbertura: string
  tipo?: { nome: string } | null
  setorDestino?: string | null
}

// ===== Status / Aprovação =====

type ApprovalStatus = 'NAO_PRECISA' | 'PENDENTE' | 'APROVADO' | 'REPROVADO'
type SolicitationStatus =
  | 'ABERTA'
  | 'EM_ATENDIMENTO'
  | 'AGUARDANDO_APROVACAO'
  | 'CONCLUIDA'
  | 'CANCELADA'

export type SolicitationDetail = {
  id: string
  protocolo: string
  titulo: string
  descricao: string | null
  status: SolicitationStatus | string
  approvalStatus?: ApprovalStatus | null
  dataAbertura: string
  dataPrevista?: string | null
  dataFechamento?: string | null
  dataCancelamento?: string | null
  tipo?: {
    id: string
    nome: string
    descricao?: string | null
    schemaJson?: SchemaJson
  } | null
  costCenter?: {
    description: string
  } | null
  payload?: Payload
  anexos?: Attachment[]
  comentarios?: Comment[]
  children?: ChildSolicitation[]
}

// ===== Timeline =====

type TimelineStepKey =
  | 'ABERTA'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'REPROVADO'
  | 'AGUARDANDO_ATENDIMENTO'
  | 'EM_ATENDIMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'

type TimelineStep = {
  key: TimelineStepKey
  label: string
}

/**
 * Monta os passos e descobre qual é o passo atual da linha do tempo
 * baseado em status + approvalStatus.
 */
function buildTimeline(
  status: SolicitationStatus,
  approvalStatus: ApprovalStatus | undefined | null,
): { steps: TimelineStep[]; currentIndex: number } {
  const steps: TimelineStep[] = []

  // sempre começa em ABERTA
  steps.push({ key: 'ABERTA', label: 'Aberta' })

  if (!approvalStatus || approvalStatus === 'NAO_PRECISA') {
    // fluxo sem aprovação: Aberta → Em atendimento → Concluída/Cancelada
    steps.push({ key: 'EM_ATENDIMENTO', label: 'Em atendimento' })
    steps.push({ key: 'CONCLUIDA', label: 'Concluída' })
  } else {
    // fluxo com aprovação
    steps.push({
      key: 'AGUARDANDO_APROVACAO',
      label: 'Aguard. aprovação',
    })

    if (approvalStatus === 'PENDENTE') {
      // ainda parado em aguardando aprovação
    } else if (approvalStatus === 'APROVADO') {
      steps.push({ key: 'APROVADO', label: 'Aprovado' })
      steps.push({
        key: 'AGUARDANDO_ATENDIMENTO',
        label: 'Aguardando atendimento',
      })
      steps.push({ key: 'EM_ATENDIMENTO', label: 'Em atendimento' })
      steps.push({ key: 'CONCLUIDA', label: 'Concluída' })
    } else if (approvalStatus === 'REPROVADO') {
      steps.push({ key: 'REPROVADO', label: 'Reprovado' })
      steps.push({
        key: 'CANCELADA',
        label: 'Solicitação cancelada',
      })
    }
  }

  // ---- qual passo é o "atual"? ----
  let currentKey: TimelineStepKey = 'ABERTA'

  if (!approvalStatus || approvalStatus === 'NAO_PRECISA') {
    // sem aprovação
    if (status === 'EM_ATENDIMENTO') currentKey = 'EM_ATENDIMENTO'
    else if (status === 'CONCLUIDA') currentKey = 'CONCLUIDA'
    else if (status === 'CANCELADA') currentKey = 'CANCELADA'
    else currentKey = 'ABERTA'
  } else if (approvalStatus === 'PENDENTE') {
    currentKey = 'AGUARDANDO_APROVACAO'
  } else if (approvalStatus === 'REPROVADO') {
    currentKey = status === 'CANCELADA' ? 'CANCELADA' : 'REPROVADO'
  } else if (approvalStatus === 'APROVADO') {
    if (status === 'ABERTA') currentKey = 'AGUARDANDO_ATENDIMENTO'
    else if (status === 'AGUARDANDO_APROVACAO')
      currentKey = 'AGUARDANDO_APROVACAO'
    else if (status === 'EM_ATENDIMENTO') currentKey = 'EM_ATENDIMENTO'
    else if (status === 'CONCLUIDA') currentKey = 'CONCLUIDA'
    else if (status === 'CANCELADA') currentKey = 'CANCELADA'
    else currentKey = 'APROVADO'
  }

  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.key === currentKey),
  )

  return { steps, currentIndex }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm')
  } catch {
    return '-'
  }
}

// ===== Helpers de Status =====

function getStatusLabel(s: {
  status: string
  approvalStatus: ApprovalStatus | null
  assumidaPorId?: string | null
}) {
  // Aguardando atendimento: já aprovado, mas ninguém assumiu ainda
  if (
    s.status === 'ABERTA' &&
    s.approvalStatus === 'APROVADO' &&
    !s.assumidaPorId
  ) {
    return 'Aguardando atendimento'
  }

  // Mapeia os demais status normalmente
  const map: Record<string, string> = {
    ABERTA: 'Aberta',
    EM_ATENDIMENTO: 'Em atendimento',
    AGUARDANDO_APROVACAO: 'Aguardando aprovação',
    CONCLUIDA: 'Concluída',
    CANCELADA: 'Cancelada',
  }

  return map[s.status] ?? s.status
}

// ===== PROPS DO MODAL =====

type Props = {
  isOpen: boolean
  onClose: () => void
  row: Row | null
  detail: SolicitationDetail | null
  loading: boolean
  error: string | null
  mode?: 'default' | 'approval'
}

export function SolicitationDetailModal({
  isOpen,
  onClose,
  row,
  detail,
  loading,
  error,
  mode = 'default',
}: Props) {
  if (!isOpen || !row) return null

  const isApprovalMode = mode === 'approval'

  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null)

  const [assumindo, setAssumindo] = useState(false)
  const [assumirError, setAssumirError] = useState<string | null>(null)

  // formulário de dados do contratado
  const [showContratadoForm, setShowContratadoForm] = useState(false)
  const [candidatoNome, setCandidatoNome] = useState('')
  const [candidatoDocumento, setCandidatoDocumento] = useState('')
  const [dataAdmissaoPrevista, setDataAdmissaoPrevista] = useState('')
  const [salario, setSalario] = useState('')
  const [cargo, setCargo] = useState('')

  const effectiveStatus = (detail?.status ?? row.status) as SolicitationStatus
  const approvalStatus = (detail?.approvalStatus ??
    null) as ApprovalStatus | null

  const { steps: timelineSteps, currentIndex } = buildTimeline(
    effectiveStatus,
    approvalStatus,
  )

  const statusLabel = getStatusLabel({
    status: effectiveStatus,
    approvalStatus,
    assumidaPorId:
      (detail as any)?.assumidaPorId ??
      row.responsavelId ??
      null,
  })

  const payload = (detail?.payload ?? {}) as Payload
  const payloadSolic = payload.solicitante ?? {}
  const payloadCampos = payload.campos ?? {}

const camposSchema: CampoEspecifico[] =
    detail?.tipo?.schemaJson?.camposEspecificos ?? []
    
  // Só RQ_063 segue esse fluxo especial de RH → DP
  const isSolicitacaoPessoal =
    detail?.tipo?.nome === 'RQ_063 - Solicitação de Pessoal'

  const isFinalizadaOuCancelada =
    effectiveStatus === 'CONCLUIDA' || effectiveStatus === 'CANCELADA'

  // pode assumir se não estiver concluída/cancelada
  const canAssumir = !isFinalizadaOuCancelada

  // pode enviar para o DP se for RQ_063
  const canEnviarDp = isSolicitacaoPessoal && !isFinalizadaOuCancelada

  // ===== AÇÕES =====

  async function handleAssumirChamado() {
    setAssumindo(true)
    setAssumirError(null)

    try {
      const id = detail?.id ?? row?.id
      if (!id) return

      const res = await fetch(`/api/solicitacoes/${id}/assumir`, {
        method: 'POST',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao assumir chamado.')
      }

      setCloseSuccess('Chamado assumido por você.')
    } catch (err: any) {
      console.error('Erro ao assumir chamado', err)
      setAssumirError(err?.message ?? 'Erro ao assumir chamado.')
    } finally {
      setAssumindo(false)
    }
  }

  async function handleFinalizarRh() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return
    
    const comment = (window.prompt(
      'Informe o motivo da reprovação (obrigatório):',
    ) ?? '')
      .trim()

    if (comment.length === 0) {
      setCloseError('É necessário informar um comentário para reprovar.')
      return
    }

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const nomeFinal =
        candidatoNome ||
        (payloadCampos.nomeColaborador as string) ||
        (payloadCampos.nomeCandidato as string) ||
        'Novo colaborador'

      const documentoFinal =
        candidatoDocumento ||
        (payloadCampos.cpf as string) ||
        (payloadCampos.documento as string) ||
        undefined

      const res = await fetch(
        `/api/solicitacoes/${solicitationId}/finalizar-rh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            candidatoNome: nomeFinal,
            candidatoDocumento: documentoFinal,
            dataAdmissaoPrevista,
            salario,
            cargo,
            outrasInfos: {},
          }),
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Falha ao finalizar solicitação.')
      }

      setCloseSuccess(
        'Solicitação finalizada no RH e chamada de admissão criada no DP.',
      )
    } catch (err: any) {
      console.error('Erro ao finalizar RH → DP', err)
      setCloseError(err?.message ?? 'Erro ao finalizar solicitação.')
    } finally {
      setClosing(false)
    }
  }

  // Aprovação pelo gestor (modo approval)
  async function handleAprovarGestor() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return
   

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const res = await fetch(
        `/api/solicitacoes/${solicitationId}/aprovar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao aprovar a solicitação.')
      }

      setCloseSuccess('Solicitação aprovada com sucesso.')
    } catch (err: any) {
      console.error('Erro ao aprovar', err)
      setCloseError(err?.message ?? 'Erro ao aprovar a solicitação.')
    } finally {
      setClosing(false)
    }
  }

  async function handleReprovarGestor() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return
    

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const res = await fetch(
        `/api/solicitacoes/${solicitationId}/reprovar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao reprovar a solicitação.')
      }

      setCloseSuccess('Solicitação reprovada.')
    } catch (err: any) {
      console.error('Erro ao reprovar', err)
      setCloseError(err?.message ?? 'Erro ao reprovar a solicitação.')
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Detalhes da Solicitação
            </h2>
            <p className="text-xs text-slate-500">
              Protocolo {detail?.protocolo ?? row.protocolo ?? '-'}
            </p>
            {assumirError && (
              <p className="mt-1 text-[11px] text-red-600">{assumirError}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isApprovalMode ? (
              <>
                <button
                  onClick={handleAprovarGestor}
                  disabled={closing}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  Aprovar
                </button>

                <button
                  onClick={handleReprovarGestor}
                  disabled={closing}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  Reprovar
                </button>
              </>
            ) : (
              <>
                {canAssumir && (
                  <button
                    onClick={handleAssumirChamado}
                    disabled={assumindo}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                  >
                    {assumindo ? 'Assumindo...' : 'Assumir chamado'}
                  </button>
                )}

                {canEnviarDp && (
                  <button
                    onClick={() => setShowContratadoForm((v) => !v)}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {showContratadoForm
                      ? 'Ocultar dados do contratado'
                      : 'Dados do contratado'}
                  </button>
                )}

                {canEnviarDp && (
                  <button
                    onClick={handleFinalizarRh}
                    disabled={closing}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {closing ? 'Enviando...' : 'Enviar para o DP'}
                  </button>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="space-y-5 px-5 py-4 text-sm">
          {/* TIMELINE NO TOPO */}
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex gap-4">
              {timelineSteps.map((step, index) => {
                const isActive = index === currentIndex
                const isDone = index < currentIndex
                const barColor = isActive
                  ? 'bg-orange-500'
                  : isDone
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
                const textColor = isActive
                  ? 'text-orange-600 font-semibold'
                  : isDone
                    ? 'text-emerald-600'
                    : 'text-slate-500'

                return (
                  <div
                    key={step.key}
                    className="flex flex-1 flex-col items-center gap-1 text-[11px]"
                  >
                    <div className={`h-1 w-full rounded-full ${barColor}`} />
                    <span className={textColor}>{step.label}</span>
                  </div>
                )
              })}
            </div>

            {effectiveStatus === 'CANCELADA' && (
              <p className="text-center text-[11px] text-red-600">
                Solicitação cancelada.
              </p>
            )}
          </div>

          {loading && (
            <p className="text-xs text-slate-500">
              Carregando detalhes...
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600">
              {error}
            </p>
          )}

          {/* BLOCOS DE INFO – só mostra se já carregou o detalhe */}
          {detail && (
            <>
              {/* Informações principais */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={LABEL_RO}>Status</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={statusLabel}
                  />
                </div>
                <div>
                  <label className={LABEL_RO}>Protocolo</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={detail.protocolo ?? row.protocolo ?? ''}
                  />
                </div>
                <div>
                  <label className={LABEL_RO}>Solicitação</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={
                      detail.titulo ??
                      detail.tipo?.nome ??
                      row.titulo ??
                      ''
                    }
                  />
                </div>
                <div>
                  <label className={LABEL_RO}>Centro Responsável</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={
                      row.setorDestino ??
                      detail.costCenter?.description ??
                      ''
                    }
                  />
                </div>
                <div>
                  <label className={LABEL_RO}>Data Abertura</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={
                      formatDate(detail.dataAbertura) ||
                      (row.createdAt
                        ? formatDate(row.createdAt)
                        : '-')
                    }
                  />
                </div>
                <div>
                  <label className={LABEL_RO}>Prazo Solução</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={formatDate(detail.dataPrevista)}
                  />
                </div>
                <div>
                  <label className={LABEL_RO}>Data Fechamento</label>
                  <input
                    className={INPUT_RO}
                    readOnly
                    value={formatDate(detail.dataFechamento)}
                  />
                </div>
              </div>

              {/* Descrição */}
              {detail.descricao && (
                <div>
                  <label className={LABEL_RO}>
                    Descrição da Solicitação
                  </label>
                  <textarea
                    className={`${INPUT_RO} min-h-[80px]`}
                    readOnly
                    value={detail.descricao}
                  />
                </div>
              )}

              {/* Anexos */}
              {detail.anexos && detail.anexos.length > 0 && (
                <div>
                  <label className={LABEL_RO}>
                    Anexo(s) da Solicitação
                  </label>
                  <div className="mt-2 space-y-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    {detail.anexos.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between"
                      >
                        <span>{a.filename}</span>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dados do solicitante */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  Dados do Solicitante
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className={LABEL_RO}>Nome completo</label>
                    <input
                      className={INPUT_RO}
                      readOnly
                      value={payloadSolic.fullName ?? ''}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_RO}>E-mail</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={payloadSolic.email ?? ''}
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Login</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={payloadSolic.login ?? ''}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_RO}>Telefone</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={payloadSolic.phone ?? ''}
                      />
                    </div>
                    <div>
                      <label className={LABEL_RO}>Centro de Custo</label>
                      <input
                        className={INPUT_RO}
                        readOnly
                        value={payloadSolic.costCenterText ?? ''}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulário do tipo de solicitação */}
              {/* Formulário do tipo de solicitação / RQ_063 */}
{isSolicitacaoPessoal ? (
  <RQ063ResumoCampos payloadCampos={payloadCampos} />
) : (
  camposSchema.length > 0 && (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        Formulário do tipo de solicitação
      </p>

      <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
        {camposSchema.map((campo) => (
          <div key={campo.name}>
            <label className={LABEL_RO}>{campo.label}</label>
            <input
              className={INPUT_RO}
              readOnly
              value={
                payloadCampos[campo.name] !== undefined
                  ? String(payloadCampos[campo.name])
                  : ''
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
)}

              {/* DADOS DO CONTRATADO (formulário extra) */}
              {showContratadoForm && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Dados do contratado
                  </p>

                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                    <div>
                      <label className={LABEL_RO}>Nome completo</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={candidatoNome}
                        onChange={(e) => setCandidatoNome(e.target.value)}
                        placeholder="Nome do contratado"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Documento (CPF)</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={candidatoDocumento}
                        onChange={(e) =>
                          setCandidatoDocumento(e.target.value)
                        }
                        placeholder="Documento"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>
                        Data de admissão prevista
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={dataAdmissaoPrevista}
                        onChange={(e) =>
                          setDataAdmissaoPrevista(e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Cargo</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={cargo}
                        onChange={(e) => setCargo(e.target.value)}
                        placeholder="Cargo do contratado"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Salário</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={salario}
                        onChange={(e) => setSalario(e.target.value)}
                        placeholder="Ex: 3500,00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Chamados vinculados (filhos) */}
              {detail.children && detail.children.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    Chamados vinculados
                  </p>

                  <div className="space-y-2 text-[12px]">
                    {detail.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex flex-col rounded border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">
                            {child.protocolo} — {child.titulo}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-slate-500">
                            {child.tipo?.nome ?? '—'}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-600">
                          <span>
                            <span className="font-semibold">Status:</span>{' '}
                            {child.status}
                          </span>
                          <span>
                            <span className="font-semibold">Abertura:</span>{' '}
                            {formatDate(child.dataAbertura)}
                          </span>
                          {child.setorDestino && (
                            <span>
                              <span className="font-semibold">
                                Setor destino:
                              </span>{' '}
                              {child.setorDestino}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comentários / histórico simples */}
              {detail.comentarios && detail.comentarios.length > 0 && (
                <div>
                  <label className={LABEL_RO}>
                    Histórico de Atendimento
                  </label>
                  <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    {detail.comentarios.map((c) => (
                      <div key={c.id}>
                        <div className="text-[10px] text-slate-500">
                          {formatDate(c.createdAt)} -{' '}
                          {c.autor?.fullName ?? '—'}
                        </div>
                        <div>{c.texto}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div className="text-xs">
            {closeError && <p className="text-red-600">{closeError}</p>}
            {closeSuccess && (
              <p className="text-emerald-600">{closeSuccess}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Bloco específico para exibir os campos da RQ_063 - Solicitação de Pessoal
 * usando os valores salvos em payload.campos.
 */
function RQ063ResumoCampos({
  payloadCampos,
}: {
  payloadCampos: Record<string, any>
}) {
  const get = (key: string) =>
    payloadCampos[key] !== undefined ? String(payloadCampos[key]) : ''

  // helpers para checkboxes (salvos como 'true' / 'false')
  const bool = (key: string) => {
    const v = (payloadCampos[key] ?? '').toString().toLowerCase()
    if (!v) return ''
    return v === 'true' ? 'Sim' : 'Não'
  }

  const joinIfTrue = (entries: [string, string][]) =>
    entries
      .filter(([k]) => (payloadCampos[k] ?? '').toString().toLowerCase() === 'true')
      .map(([, label]) => label)
      .join(', ')

  const motivoVaga = joinIfTrue([
    ['motivoSubstituicao', 'Substituição'],
    ['motivoAumentoQuadro', 'Aumento de quadro'],
  ])

  const contratacao = joinIfTrue([
    ['contratacaoTemporaria', 'Temporária'],
    ['contratacaoPermanente', 'Permanente'],
  ])

  const solicitacoesNovoFunc = joinIfTrue([
    ['solicitacaoCracha', 'Crachá'],
    ['solicitacaoRepublica', 'República'],
    ['solicitacaoUniforme', 'Uniforme'],
    ['solicitacaoTesteDirecao', 'Teste direção'],
    ['solicitacaoEpis', 'EPIs'],
    ['solicitacaoPostoTrabalho', 'Ponto / Posto de trabalho'],
  ])

  const localMatrizFilial = joinIfTrue([
    ['escritorioMatriz', 'Matriz'],
    ['escritorioFilial', 'Filial'],
  ])

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        RQ_063 - Solicitação de Pessoal
      </p>

      {/* Informações básicas */}
      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Informações básicas
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Cargo</label>
            <input className={INPUT_RO} readOnly value={get('cargoNome')} />
          </div>
          <div>
            <label className={LABEL_RO}>Setor e/ou Projeto</label>
            <input className={INPUT_RO} readOnly value={get('setorProjeto')} />
          </div>
          <div>
            <label className={LABEL_RO}>Vaga prevista em contrato?</label>
            <input className={INPUT_RO} readOnly value={get('vagaPrevista')} />
          </div>
          <div>
            <label className={LABEL_RO}>Local de trabalho</label>
            <input className={INPUT_RO} readOnly value={get('localTrabalho')} />
          </div>
          <div>
            <label className={LABEL_RO}>Coordenador do contrato</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('coordenadorContrato')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Motivo da vaga</label>
            <input className={INPUT_RO} readOnly value={motivoVaga} />
          </div>
          <div>
            <label className={LABEL_RO}>Contratação</label>
            <input className={INPUT_RO} readOnly value={contratacao} />
          </div>
          <div>
            <label className={LABEL_RO}>Justificativa da vaga</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('justificativaVaga')}
            />
          </div>
        </div>
      </section>

      {/* Atividades */}
      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Atividades
        </p>
        <div className="space-y-3 text-xs">
          <div>
            <label className={LABEL_RO}>Principais atividades</label>
            <textarea
              className={`${INPUT_RO} min-h-[70px]`}
              readOnly
              value={get('principaisAtividades')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Atividades complementares</label>
            <textarea
              className={`${INPUT_RO} min-h-[70px]`}
              readOnly
              value={get('atividadesComplementares')}
            />
          </div>
        </div>
      </section>

      {/* Requisitos acadêmicos */}
      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Requisitos acadêmicos
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Escolaridade</label>
            <input className={INPUT_RO} readOnly value={get('escolaridade')} />
          </div>
          <div>
            <label className={LABEL_RO}>Curso</label>
            <input className={INPUT_RO} readOnly value={get('curso')} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 mt-3">
          <div>
            <label className={LABEL_RO}>Escolaridade completa?</label>
            <input
              className={INPUT_RO}
              readOnly
              value={bool('escolaridadeCompleta')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Curso em andamento?</label>
            <input
              className={INPUT_RO}
              readOnly
              value={bool('cursoEmAndamento')}
            />
          </div>
        </div>

        <div className="mt-3">
          <label className={LABEL_RO}>Período / módulo - mínimo ou máximo</label>
          <input
            className={INPUT_RO}
            readOnly
            value={get('periodoModulo')}
          />
        </div>
      </section>

      {/* Requisitos / competências */}
      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Requisitos e competências
        </p>
        <div className="space-y-3 text-xs">
          <div>
            <label className={LABEL_RO}>
              Requisitos e conhecimentos necessários
            </label>
            <textarea
              className={`${INPUT_RO} min-h-[70px]`}
              readOnly
              value={get('requisitosConhecimentos')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>
              Competências comportamentais exigidas
            </label>
            <textarea
              className={`${INPUT_RO} min-h-[70px]`}
              readOnly
              value={get('competenciasComportamentais')}
            />
          </div>
        </div>
      </section>

      {/* Solicitações para o novo funcionário */}
      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Solicitações para o novo funcionário
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Crachá / República / Uniforme / Outros</label>
            <input
              className={INPUT_RO}
              readOnly
              value={
                solicitacoesNovoFunc ||
                get('solicitacaoOutros')
              }
            />
          </div>
          <div>
            <label className={LABEL_RO}>Local (Matriz ou Filial)</label>
            <input
              className={INPUT_RO}
              readOnly
              value={localMatrizFilial}
            />
          </div>
        </div>
      </section>

      {/* RH */}
      <section>
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Preenchimento RH
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Nome do profissional</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('nomeProfissional')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Data de admissão</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('dataAdmissao')}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className={LABEL_RO}>Observações</label>
          <textarea
            className={`${INPUT_RO} min-h-[70px]`}
            readOnly
            value={get('observacoesRh')}
          />
        </div>
      </section>
    </div>
  )
}
