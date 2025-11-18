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

export type SolicitationDetail = {
  id: string
  protocolo: string
  titulo: string
  descricao: string | null
  status: string
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
}

// ===== Timeline =====

type TimelineStepKey =
  | 'ABERTA'
  | 'AGUARDANDO_APROVACAO'
  | 'EM_ATENDIMENTO'
  | 'CONCLUIDA'

const TIMELINE_STEPS: { key: TimelineStepKey; label: string }[] = [
  { key: 'ABERTA', label: 'ABERTA' },
  { key: 'AGUARDANDO_APROVACAO', label: 'AGUARD. APROVAÇÃO' },
  { key: 'EM_ATENDIMENTO', label: 'EM ATENDIMENTO' },
  { key: 'CONCLUIDA', label: 'CONCLUÍDA' },
]

function mapStatusToStep(status: string): TimelineStepKey {
  switch (status) {
    case 'ABERTA':
      return 'ABERTA'
    case 'AGUARDANDO_APROVACAO':
      return 'AGUARDANDO_APROVACAO'
    case 'EM_ATENDIMENTO':
      return 'EM_ATENDIMENTO'
    case 'CONCLUIDA':
    case 'CANCELADA': // cancelada entra como última etapa da linha
      return 'CONCLUIDA'
    default:
      return 'ABERTA'
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm')
  } catch {
    return '-'
  }
}

// ===== PROPS DO MODAL =====

type Props = {
  isOpen: boolean
  onClose: () => void
  row: Row | null
  detail: SolicitationDetail | null
  loading: boolean
  error: string | null
}

export function SolicitationDetailModal({
  isOpen,
  onClose,
  row,
  detail,
  loading,
  error,
}: Props) {
  if (!isOpen || !row) return null

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

  const effectiveStatus = detail?.status ?? row.status
  const currentStepKey = mapStatusToStep(effectiveStatus)
  const currentIndex = TIMELINE_STEPS.findIndex(
    (s) => s.key === currentStepKey,
  )

  const payload = (detail?.payload ?? {}) as Payload
  const payloadSolic = payload.solicitante ?? {}
  const payloadCampos = payload.campos ?? {}

  const schema = (detail?.tipo?.schemaJson ?? {}) as SchemaJson
  const camposSchema = schema.camposEspecificos ?? []

  // Só RQ_063 segue esse fluxo
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
              {TIMELINE_STEPS.map((step, index) => {
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
                    value={effectiveStatus}
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
              {camposSchema.length > 0 && (
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
              )}

              {/* DADOS DO CONTRATADO (formulário extra) */}
              {showContratadoForm && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Dados do contratado
                  </p>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
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
