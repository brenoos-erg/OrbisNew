// src/components/solicitacoes/SolicitationDetailModal.tsx
'use client'

import { format } from 'date-fns'
import React, { useEffect, useState } from 'react'

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
  onActionCompleted?: (action: 'APROVAR' | 'REPROVAR') => void
}

export function SolicitationDetailModal({
  isOpen,
  onClose,
  row,
  detail: detailProp,
  loading,
  error,
  mode = 'default',
  onActionCompleted,
}: Props) {
  if (!isOpen || !row) return null

  const isApprovalMode = mode === 'approval'
  const [detail, setDetail] = useState<SolicitationDetail | null>(
    detailProp,
  )

  useEffect(() => {
    setDetail(detailProp)
  }, [detailProp])


  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null)
  const [approvalAction, setApprovalAction] =
    useState<'APROVAR' | 'REPROVAR' | null>(null)
  const [approvalComment, setApprovalComment] = useState('')

  const [assumindo, setAssumindo] = useState(false)
  const [assumirError, setAssumirError] = useState<string | null>(null)

  // formulário de dados do contratado
  const [showContratadoForm, setShowContratadoForm] = useState(false)
  const [candidatoNome, setCandidatoNome] = useState('')
  const [candidatoDocumento, setCandidatoDocumento] = useState('')
  const [dataAdmissaoPrevista, setDataAdmissaoPrevista] = useState('')
  const [salario, setSalario] = useState('')
  const [cargo, setCargo] = useState('')
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  // formulário específico para a RQ_091 (nome e valor de contribuição)
  const [showIncentivoForm, setShowIncentivoForm] = useState(false)
  const [incentivoNome, setIncentivoNome] = useState('')
  const [incentivoValor, setIncentivoValor] = useState('')

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
    // Fluxo especial de RH (RQ_063 e RQ_091)

  const isSolicitacaoPessoal =
    detail?.tipo?.nome === 'RQ_063 - Solicitação de Pessoal'
    const isSolicitacaoIncentivo =
    detail?.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
  const followsRhFinalizationFlow =
    isSolicitacaoPessoal || isSolicitacaoIncentivo

  const isFinalizadaOuCancelada =
    effectiveStatus === 'CONCLUIDA' || effectiveStatus === 'CANCELADA'

  // pode assumir se não estiver concluída/cancelada
  const canAssumir = !isFinalizadaOuCancelada

  // pode finalizar no RH (RQ_063 envia para DP, RQ_091 encerra no RH)
  const canFinalizarRh = followsRhFinalizationFlow && !isFinalizadaOuCancelada
  const nomeIncentivoAtual =
    incentivoNome.trim() || (payloadCampos.nomeColaborador as string) || ''
  const valorIncentivoAtual =
    incentivoValor.trim() || (payloadCampos.calculoValor as string) || ''

  const canEnviarParaDp =
    canFinalizarRh &&
    (!isSolicitacaoIncentivo ||
      (nomeIncentivoAtual.trim().length > 0 &&
        valorIncentivoAtual.trim().length > 0))

  useEffect(() => {
    if (isSolicitacaoIncentivo) {
      setIncentivoNome(
        (payloadCampos.nomeColaborador as string) ?? incentivoNome ?? '',
      )
      setIncentivoValor(
        (payloadCampos.calculoValor as string) ?? incentivoValor ?? '',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolicitacaoIncentivo, payloadCampos])
  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      refreshDetailFromServer()
    }, 5000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, row?.id, detail?.id])



  // ===== AÇÕES =====
  async function refreshDetailFromServer() {
    const id = detail?.id ?? row?.id
    if (!id) return

    try {
      const res = await fetch(`/api/solicitacoes/${id}`)
      if (!res.ok) return

      const json = (await res.json()) as SolicitationDetail
      setDetail(json)
    } catch (err) {
      console.error('Erro ao atualizar detalhes após upload', err)
    }
  }

  async function handleUploadAnexos() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return

    if (!filesToUpload || filesToUpload.length === 0) {
      setUploadError('Selecione ao menos um arquivo para enviar.')
      return
    }

    setUploadError(null)
    setUploadSuccess(null)
    setUploading(true)

    try {
      const formData = new FormData()
      Array.from(filesToUpload).forEach((file) =>
        formData.append('files', file),
      )

      const res = await fetch(`/api/solicitacoes/${solicitationId}/anexos`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao enviar arquivo(s).')
      }

      setUploadSuccess('Arquivo(s) enviados com sucesso.')
      setFilesToUpload(null)
      await refreshDetailFromServer()
    } catch (err: any) {
      console.error('Erro ao enviar anexos', err)
      setUploadError(err?.message ?? 'Erro ao enviar arquivo(s).')
    } finally {
      setUploading(false)
    }
  }

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
      await refreshDetailFromServer()
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

   if (isSolicitacaoIncentivo) {
      if (!nomeIncentivoAtual.trim()) {
        setCloseError('Preencha o nome do usuário antes de enviar ao DP.')
        return
      }

      if (!valorIncentivoAtual.trim()) {
        setCloseError('Informe o valor de contribuição antes de enviar ao DP.')
        return
      }
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
            outrasInfos: isSolicitacaoIncentivo
              ? {
                  nomeColaborador: nomeIncentivoAtual,
                  calculoValor: valorIncentivoAtual,
                }
              : {},
          }),
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Falha ao finalizar solicitação.')
      }
await refreshDetailFromServer()
      setCloseSuccess(
        isSolicitacaoPessoal
          ? 'Solicitação finalizada no RH e chamada de admissão criada no DP.'
          : 'Solicitação finalizada no RH e encaminhada ao DP para conclusão.',
      )
    } catch (err: any) {
      console.error('Erro ao finalizar RH', err)
      setCloseError(err?.message ?? 'Erro ao finalizar solicitação.')
    } finally {
      setClosing(false)
    }
  }

  // Aprovação pelo gestor (modo approval)
  async function handleAprovarGestor(comment?: string) {
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
          headers: comment
            ? {
              'Content-Type': 'application/json',
            }
            : undefined,
          body: comment ? JSON.stringify({ comment }) : undefined,
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao aprovar a solicitação.')
      }

      setCloseSuccess('Solicitação aprovada com sucesso.')
      onActionCompleted?.('APROVAR')
    } catch (err: any) {
      console.error('Erro ao aprovar', err)
      setCloseError(err?.message ?? 'Erro ao aprovar a solicitação.')
    } finally {
      setClosing(false)
    }
  }

  async function handleReprovarGestor(comment: string) {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return
    if (!comment || comment.trim().length === 0) {
      setCloseError('Informe um comentário para reprovar a solicitação.')
      return
    }

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
          body: JSON.stringify({ comment }),
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao reprovar a solicitação.')
      }
await refreshDetailFromServer()
      setCloseSuccess('Solicitação reprovada.')
      onActionCompleted?.('REPROVAR')
    } catch (err: any) {
      console.error('Erro ao reprovar', err)
      setCloseError(err?.message ?? 'Erro ao reprovar a solicitação.')
    } finally {
      setClosing(false)
    }
  }
  function handleStartApproval(action: 'APROVAR' | 'REPROVAR') {
    setCloseError(null)
    setCloseSuccess(null)
    setApprovalAction(action)

    if (!approvalComment.trim()) {
      setApprovalComment(
        action === 'APROVAR'
          ? 'Solicitação aprovada.'
          : 'Solicitação reprovada.',
      )
    }
  }

  async function handleConfirmApprovalAction() {
    if (!approvalAction) return

    const comment = approvalComment.trim()

    if (approvalAction === 'REPROVAR' && comment.length === 0) {
      setCloseError('Informe um comentário para reprovar a solicitação.')
      return
    }

    if (approvalAction === 'APROVAR') {
      await handleAprovarGestor(comment || undefined)
    } else {
      await handleReprovarGestor(comment)
    }

    setApprovalAction(null)
    setApprovalComment('')
  }

  function handleCancelApprovalAction() {
    setApprovalAction(null)
    setCloseError(null)
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
                  onClick={() => handleStartApproval('APROVAR')}
                  disabled={closing}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  Aprovar
                </button>

                <button
                  onClick={() => handleStartApproval('REPROVAR')}
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

                {canFinalizarRh && isSolicitacaoPessoal && (
                  <button
                    onClick={() => setShowContratadoForm((v) => !v)}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {showContratadoForm
                      ? 'Ocultar dados do contratado'
                      : 'Dados do contratado'}
                  </button>
                )}
                {canFinalizarRh && isSolicitacaoIncentivo && (
                  <button
                    onClick={() => setShowIncentivoForm((v) => !v)}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {showIncentivoForm ? 'Ocultar dados' : 'Incluir dados'}
                  </button>
                )}


                {canFinalizarRh && (
                  <button
                    onClick={() => handleStartApproval('REPROVAR')}
                    disabled={closing}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                  >
                    Reprovar chamado
                  </button>
                )}

                {canFinalizarRh && (
                  <button
                    onClick={handleFinalizarRh}
                    disabled={closing || !canEnviarParaDp}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {closing
                      ? 'Enviando...'
                      : isSolicitacaoPessoal || isSolicitacaoIncentivo
                        ? 'Enviar para o DP'
                        : 'Finalizar no RH'}
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
        {approvalAction && (isApprovalMode || approvalAction === 'REPROVAR') && (
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {approvalAction === 'APROVAR'
                      ? 'Confirme a aprovação'
                      : 'Confirme a reprovação'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Informe um comentário para registrar se a solicitação foi
                    aprovada ou reprovada.
                  </p>
                </div>

                <div>
                  <label className={LABEL_RO}>
                    Comentário {approvalAction === 'REPROVAR' && '(obrigatório)'}
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    rows={3}
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder={
                      approvalAction === 'APROVAR'
                        ? 'Ex.: Solicitação aprovada pelo gestor.'
                        : 'Descreva o motivo da reprovação.'
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-start">
                <button
                  onClick={handleConfirmApprovalAction}
                  disabled={closing}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {approvalAction === 'APROVAR'
                    ? 'Confirmar aprovação'
                    : 'Confirmar reprovação'}
                </button>

                <button
                  onClick={handleCancelApprovalAction}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}


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
                     <div className="space-y-1">
                      <label className={LABEL_RO}>Anexar documento(s)</label>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setFilesToUpload(e.target.files)}
                        className="mt-1 block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50"
                      />

                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={handleUploadAnexos}
                          disabled={uploading}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-500 disabled:opacity-60"
                        >
                          {uploading ? 'Enviando...' : 'Enviar arquivo(s)'}
                        </button>

                        {uploadSuccess && (
                          <span className="text-emerald-600">{uploadSuccess}</span>
                        )}
                        {uploadError && (
                          <span className="text-red-600">{uploadError}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {showIncentivoForm && isSolicitacaoIncentivo && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Dados para envio ao DP (RQ_091)
                  </p>

                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                    <div>
                      <label className={LABEL_RO}>Nome do usuário</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={incentivoNome}
                        onChange={(e) => setIncentivoNome(e.target.value)}
                        placeholder="Nome do colaborador"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Valor de contribuição</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={incentivoValor}
                        onChange={(e) => setIncentivoValor(e.target.value)}
                        placeholder="Ex.: 750,00"
                      />
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] text-emerald-800">
                    Preencha o nome do usuário e o valor de contribuição para habilitar o envio ao DP.
                  </p>
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
