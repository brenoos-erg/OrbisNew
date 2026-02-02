// src/components/solicitacoes/SolicitationDetailModal.tsx
'use client'

import { format } from 'date-fns'
import React, { useEffect, useMemo, useState } from 'react'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  isSolicitacaoDesligamento,
  isSolicitacaoNadaConsta,
  NADA_CONSTA_SETORES,
  getNadaConstaDefaultFieldsForSetor,
  type NadaConstaSetorKey,
  resolveNadaConstaSetorByDepartment,
} from '@/lib/solicitationTypes'

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
  createdAt?: string | null
  tipo?: { nome: string } | null
  responsavel?: { fullName: string } | null
  responsavelId?: string | null
  autor?: { fullName: string } | null
  sla?: string | null
  setorDestino?: string | null
  requiresApproval?: boolean
  approvalStatus?: string | null
  costCenterId?: string | null
}


type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  defaultValue?: string
  section?: string
  stage?: string
}

type SchemaJson = {
  camposEspecificos?: CampoEspecifico[]
}

type ConstaFlag = 'CONSTA' | 'NADA_CONSTA'

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
type SolicitacaoSetor = {
  id: string
  setor: string
  status: string
  constaFlag?: string | null
  campos?: Record<string, any> | null
  finalizadoEm?: string | null
  finalizadoPor?: string | null
}

type CurrentUser = {
  id: string
  role?: string | null
  departmentCode?: string | null
  departmentName?: string | null
  departments?: { code?: string | null; name?: string | null }[]
}
const getUserSectors = (user: CurrentUser | null): NadaConstaSetorKey[] => {
  if (!user) return []

  const sectors = new Set<NadaConstaSetorKey>()
  const departments = [
    { code: user.departmentCode ?? null, name: user.departmentName ?? null },
    ...(user.departments ?? []),
  ]

  for (const dept of departments) {
    const resolved = resolveNadaConstaSetorByDepartment({
      code: dept.code ?? null,
      name: dept.name ?? null,
    })
    if (resolved) {
      sectors.add(resolved)
    }
  }

  return Array.from(sectors)
}

const getUserIsDpOrAdmin = (user: CurrentUser | null) => {
  if (!user) return false
  return (
    user.role === 'ADMIN' ||
    user.role === 'DP' ||
    user.departmentCode === '08' ||
    (user.departments ?? []).some((dept) => dept.code === '08')
  )
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
    code?: string | null
    externalCode?: string | null
  } | null
   department?: {
    id: string
    name: string
    code?: string | null
  } | null
  payload?: Payload
  anexos?: Attachment[]
  comentarios?: Comment[]
  children?: ChildSolicitation[]
  solicitacaoSetores?: SolicitacaoSetor[]
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
function normalizeConstaValue(value: unknown): ConstaFlag | '' {
  if (typeof value !== 'string') return ''
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  if (normalized === 'CONSTA') return 'CONSTA'
  if (normalized === 'NADA CONSTA' || normalized === 'NADA_CONSTA')
    return 'NADA_CONSTA'
  return ''
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
  onFinalized?: () => void
  /**
   * Se false, esconde ações de assumir/finalizar (modo consulta).
   * Na tela de "Solicitações Enviadas" usar canManage={false}.
   */
  canManage?: boolean
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
  onFinalized,
  canManage = true,
}: Props) {
  if (!isOpen || !row) return null

  const isApprovalMode = mode === 'approval'
  const [detail, setDetail] = useState<SolicitationDetail | null>(detailProp)
  const [nadaConstaCampos, setNadaConstaCampos] = useState<
    Record<string, string>
  >({})
  const [nadaConstaError, setNadaConstaError] = useState<string | null>(null)
  const [savingNadaConsta, setSavingNadaConsta] = useState(false)
  const [activeSector, setActiveSector] =
    useState<NadaConstaSetorKey | null>(null)
  const [isNadaConstaSetorOpen, setIsNadaConstaSetorOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    setDetail(detailProp)
    setActiveSector(null)
  }, [detailProp?.id])


  useEffect(() => {
    if (!isOpen) return
    let alive = true

    async function loadCurrentUser() {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as CurrentUser
        if (alive) {
          setCurrentUser(json)
        }
      } catch (err) {
        console.error('Erro ao carregar usuário atual', err)
      }
    }

    loadCurrentUser()

    return () => {
      alive = false
    }
  }, [isOpen])

  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null)
  const [approvalAction, setApprovalAction] =
    useState<'APROVAR' | 'REPROVAR' | null>(null)
  const [approvalComment, setApprovalComment] = useState('')

  const [assumindo, setAssumindo] = useState(false)
  const [assumirError, setAssumirError] = useState<string | null>(null)

  // formulário de dados do contratado / incentivo
  const [showContratadoForm, setShowContratadoForm] = useState(false)
  const [candidatoNome, setCandidatoNome] = useState('')
  const [candidatoDocumento, setCandidatoDocumento] = useState('')
  const [dataAdmissaoPrevista, setDataAdmissaoPrevista] = useState('')
  const [salario, setSalario] = useState('')
  const [cargo, setCargo] = useState('')
  const [duracaoCursoMeses, setDuracaoCursoMeses] = useState('')
  const [valorMensalCurso, setValorMensalCurso] = useState('')
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [rhDataExameDemissional, setRhDataExameDemissional] = useState('')
  const [rhDataLiberacaoPpp, setRhDataLiberacaoPpp] = useState('')
  const [rhConsideracoes, setRhConsideracoes] = useState('')
  const [dpDataDemissao, setDpDataDemissao] = useState('')
  const [dpDataPrevistaAcerto, setDpDataPrevistaAcerto] = useState('')
  const [dpConsideracoes, setDpConsideracoes] = useState('')

  const effectiveStatus = (detail?.status ?? row.status) as SolicitationStatus
  const approvalStatus = (detail?.approvalStatus ?? null) as ApprovalStatus | null

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

  // Preenche campos extras a partir do payload quando abre o detalhe
  useEffect(() => {
    setCandidatoNome(
      (payloadCampos.nomeColaborador as string) ||
        (payloadCampos.nomeCandidato as string) ||
        (payloadCampos.candidatoNome as string) ||
        '',
    )
    setCandidatoDocumento(
      (payloadCampos.candidatoDocumento as string) ||
        (payloadCampos.documento as string) ||
        '',
    )
    setDataAdmissaoPrevista(
      (payloadCampos.dataAdmissaoPrevista as string) || '',
    )
    setSalario(
      payloadCampos.salario !== undefined
        ? String(payloadCampos.salario)
        : '',
    )
    setCargo(
      (payloadCampos.cargoFinal as string) ||
        (payloadCampos.cargo as string) ||
        '',
    )
    setDuracaoCursoMeses(
      payloadCampos.duracaoMeses !== undefined
        ? String(payloadCampos.duracaoMeses)
        : '',
    )
    setValorMensalCurso(
      payloadCampos.valorMensal !== undefined
        ? String(payloadCampos.valorMensal)
        : '',
    )
    setRhDataExameDemissional(
      (payloadCampos.rhDataExameDemissional as string) || '',
    )
    setRhDataLiberacaoPpp((payloadCampos.rhDataLiberacaoPpp as string) || '')
    setRhConsideracoes((payloadCampos.rhConsideracoes as string) || '')
    setDpDataDemissao((payloadCampos.dpDataDemissao as string) || '')
    setDpDataPrevistaAcerto((payloadCampos.dpDataPrevistaAcerto as string) || '')
    setDpConsideracoes((payloadCampos.dpConsideracoes as string) || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id])

  const camposSchema: CampoEspecifico[] =
    detail?.tipo?.schemaJson?.camposEspecificos ?? []

  // Fluxos especiais
  const isSolicitacaoPessoal =
    detail?.tipo?.nome === 'RQ_063 - Solicitação de Pessoal'
  const isSolicitacaoIncentivo =
    detail?.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
  const isDesligamento = isSolicitacaoDesligamento(detail?.tipo)
  const isNadaConsta = isSolicitacaoNadaConsta(detail?.tipo)
  const isDpChildFromRh = Boolean((payload as any)?.origem?.rhSolicitationId)


  const isDpDestino = !!(
    detail?.costCenter?.externalCode === '590' ||
    detail?.costCenter?.description?.toLowerCase().includes('pessoal') ||
    detail?.department?.code === '08'
  )
  const isRhDestino = !!(
    detail?.department?.code === '17' ||
    detail?.costCenter?.description
      ?.toLowerCase()
      .includes('recursos humanos') ||
    detail?.costCenter?.code?.toLowerCase().includes('rh')
  )

  const duracaoNumber = Number.parseFloat(
    duracaoCursoMeses.replace(',', '.').trim() || 'NaN',
  )
  const valorMensalNumber = Number.parseFloat(
    valorMensalCurso.replace(',', '.').trim() || 'NaN',
  )
  const valorTotalCurso =
    Number.isFinite(duracaoNumber) && Number.isFinite(valorMensalNumber)
      ? duracaoNumber * valorMensalNumber
      : null

  const followsRhFinalizationFlow =
    isSolicitacaoPessoal ||
    isSolicitacaoIncentivo ||
    isDesligamento ||
    isDpChildFromRh

  const isFinalizadaOuCancelada =
    effectiveStatus === 'CONCLUIDA' || effectiveStatus === 'CANCELADA'
      const camposNadaConstaSolicitante = camposSchema.filter(
    (campo) => campo.stage === 'solicitante',
  )
   const setorMeta = activeSector
    ? NADA_CONSTA_SETORES.find((setor) => setor.key === activeSector)
    : null
  const camposNadaConstaSetor = useMemo(() => {
    if (!setorMeta) return []
    const schemaCampos = camposSchema.filter(
      (campo) => campo.stage === setorMeta.stage,
    )
    const defaultCampos = getNadaConstaDefaultFieldsForSetor(setorMeta.key)
    if (defaultCampos.length === 0) {
      return schemaCampos
    }

    const defaultsByName = new Map(
      defaultCampos.map((campo) => [campo.name, campo]),
    )
    const merged = schemaCampos.map((campo) => {
      const fallback = defaultsByName.get(campo.name)
      if (!fallback) return campo
      return {
        ...campo,
        type: fallback.type ?? campo.type,
        options: fallback.options ?? campo.options,
        label: campo.label ?? fallback.label,
      }
    })
    const existingNames = new Set(schemaCampos.map((campo) => campo.name))
    const missingDefaults = defaultCampos.filter(
      (campo) => !existingNames.has(campo.name),
    )
    return [...merged, ...missingDefaults]
  }, [camposSchema, setorMeta])
  const selectedSetorRegistro = activeSector
    ? detail?.solicitacaoSetores?.find(
        (setor) => setor.setor === activeSector,
      )
    : null
  const isSetorConcluido = selectedSetorRegistro?.status === 'CONCLUIDO'
  const constaFieldName = setorMeta?.constaField ?? null

  const userSectors = useMemo(
    () => getUserSectors(currentUser),
    [currentUser],
  )
  const userSectorKeys = useMemo(
    () => new Set(userSectors),
    [userSectors],
  )
  const userIsDpOrAdmin = useMemo(
    () => getUserIsDpOrAdmin(currentUser),
    [currentUser],
  )

  const canEditNadaConstaSetor =
    Boolean(activeSector) &&
    (userIsDpOrAdmin ||
      userSectorKeys.has(activeSector as NadaConstaSetorKey)) &&
    !isFinalizadaOuCancelada &&
    !isSetorConcluido

  // pode assumir se não estiver concluída/cancelada
  const canAssumir = !isFinalizadaOuCancelada

  // pode finalizar no RH (RQ_063 envia para DP, RQ_091 encerra no RH ou DP)
  const canFinalizarRh = followsRhFinalizationFlow && !isFinalizadaOuCancelada
  const finalizarLabel = isDpDestino
    ? 'Finalizar chamado'
    : isSolicitacaoPessoal || isDesligamento
      ? 'Enviar para o DP'
      : 'Finalizar no RH'
  const canEditRhSection =
    isDesligamento && isRhDestino && !isFinalizadaOuCancelada
  const canEditDpSection =
    isDesligamento && isDpDestino && !isFinalizadaOuCancelada
    
  const setoresNadaConsta = (() => {
    if (!isNadaConsta || !detail) return []
    const setoresMap = new Map(
      (detail.solicitacaoSetores ?? []).map((setor) => [setor.setor, setor]),
    )

    return NADA_CONSTA_SETORES.map((setor) => {
      const registro = setoresMap.get(setor.key)
      return {
        key: setor.key,
        label: setor.label,
        status: registro?.status ?? 'PENDENTE',
      }
    })
  })()

  const selectedSetorLabel = useMemo(() => {
    if (!activeSector) return null
    const setor = setoresNadaConsta.find((item) => item.key === activeSector)
    return setor?.label ?? activeSector
  }, [activeSector, setoresNadaConsta])
  const defaultActiveSector = useMemo(() => {
    if (!isNadaConsta) return null
    return setoresNadaConsta[0]?.key ?? userSectors[0] ?? null
  }, [isNadaConsta, setoresNadaConsta, userSectors])


  useEffect(() => {
    if (!isNadaConsta) return
    if (!defaultActiveSector) return

    if (!activeSector) {
      setActiveSector(defaultActiveSector)
      return
    }

    const exists = setoresNadaConsta.some((setor) => setor.key === activeSector)
    if (!exists) {
      setActiveSector(defaultActiveSector)
    }
  }, [activeSector, defaultActiveSector, isNadaConsta, setoresNadaConsta])


  useEffect(() => {
    if (!isNadaConsta || !activeSector) return
    const registro = detail?.solicitacaoSetores?.find(
      (setor) => setor.setor === activeSector,
    )
    const storedCampos = (registro?.campos ?? {}) as Record<string, any>
    const nextCampos = camposNadaConstaSetor.reduce<Record<string, string>>(
      (acc, campo) => {
          const rawValue = storedCampos[campo.name]
        const normalizedValue =
          campo.name === constaFieldName
            ? normalizeConstaValue(rawValue)
            : rawValue
        acc[campo.name] =
          normalizedValue === undefined || normalizedValue === null
            ? ''
            : String(normalizedValue)
        return acc
      },
      {},
    )
    setNadaConstaCampos(nextCampos)
  }, [
    camposNadaConstaSetor,
    constaFieldName,
    detail?.id,
    isNadaConsta,
    activeSector,
  ])
  useEffect(() => {
    if (!isNadaConsta || camposNadaConstaSetor.length === 0) {
      setIsNadaConstaSetorOpen(false)
    }
  }, [camposNadaConstaSetor.length, isNadaConsta])


  // Se for tela de aprovação não mostramos ações de gestão;
  // se canManage=false (Solicitações Enviadas) também não.
  const showManagementActions = !isApprovalMode && canManage

  // ===== AÇÕES =====
  const handleNadaConstaChange = (name: string, value: string) => {
    setNadaConstaCampos((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function refreshDetailFromServer() {
    const id = detail?.id ?? row?.id
    if (!id) return

    try {
      const res = await fetch(`/api/solicitacoes/${id}`)
      if (!res.ok) return

      const json = (await res.json()) as SolicitationDetail
      setDetail(json)
    } catch (err) {
      console.error('Erro ao atualizar detalhes após ação', err)
    }
  }

  async function handleSalvarNadaConsta(finalizar: boolean) {
    if (!detail?.id) return
    if (camposNadaConstaSetor.length === 0) return
    if (!activeSector) return
    if (!canEditNadaConstaSetor) return

    setSavingNadaConsta(true)
    setNadaConstaError(null)

    const camposPayload = camposNadaConstaSetor.reduce<Record<string, string>>(
      (acc, campo) => {
        acc[campo.name] = nadaConstaCampos[campo.name] ?? ''
        return acc
      },
      {},
    )

    try {
      const res = await fetch(
        `/api/solicitacoes/${detail.id}/atualizar-campos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setor: activeSector,
            campos: camposPayload,
            action: finalizar ? 'FINALIZAR' : 'SALVAR',
          }),
        },
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao salvar campos.')
      }

      await refreshDetailFromServer()
      if (finalizar) {
        setCloseSuccess('Seção finalizada com sucesso.')
      }
    } catch (err: any) {
      setNadaConstaError(err?.message ?? 'Erro ao salvar campos.')
    } finally {
      setSavingNadaConsta(false)
    }
  }

  const renderNadaConstaCampo = (campo: CampoEspecifico) => {
    const value = nadaConstaCampos[campo.name] ?? ''
    const baseClass =
      'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm'
      const isDisabled = !canEditNadaConstaSetor
    const isConstaField = campo.name === constaFieldName

    if (isConstaField) {
      const normalizedValue = normalizeConstaValue(value) as ConstaFlag | ''
      return (
        <div key={campo.name} className="space-y-2 text-xs text-slate-700">
          <span className="font-semibold">{campo.label}</span>
          <div className="flex flex-wrap gap-4">
            {(['CONSTA', 'NADA_CONSTA'] as ConstaFlag[]).map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={campo.name}
                  value={option}
                  checked={normalizedValue === option}
                  onChange={() => handleNadaConstaChange(campo.name, option)}
                  disabled={isDisabled}
                />
                <span>
                  {option === 'CONSTA' ? 'Consta' : 'Nada Consta'}
                </span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (campo.type === 'checkbox') {
      return (
        <label
          key={campo.name}
          className="flex items-start gap-2 text-xs text-slate-700"
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={value === 'true'}
            onChange={(e) =>
              handleNadaConstaChange(
                campo.name,
                e.target.checked ? 'true' : 'false',
              )
            }
           disabled={isDisabled}
          />
          <span>{campo.label}</span>
        </label>
      )
    }

    if (campo.type === 'textarea') {
      return (
        <label key={campo.name} className="space-y-1 text-xs text-slate-700">
          <span className="font-semibold">{campo.label}</span>
          <textarea
            className={`${baseClass} min-h-[90px]`}
            value={value}
            onChange={(e) => handleNadaConstaChange(campo.name, e.target.value)}
            disabled={isDisabled}
          />
        </label>
      )
    }

    if (campo.type === 'select') {
      return (
        <label key={campo.name} className="space-y-1 text-xs text-slate-700">
          <span className="font-semibold">{campo.label}</span>
          <select
            className={baseClass}
            value={value}
            onChange={(e) => handleNadaConstaChange(campo.name, e.target.value)}
            disabled={isDisabled}
          >
            <option value="">Selecione...</option>
            {(campo.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      )
    }

    return (
      <label key={campo.name} className="space-y-1 text-xs text-slate-700">
        <span className="font-semibold">{campo.label}</span>
        <input
          className={baseClass}
          value={value}
          onChange={(e) => handleNadaConstaChange(campo.name, e.target.value)}
          disabled={isDisabled}
        />
      </label>
    )
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
        const buildOptionalValue = (value: string) =>
        value && value.trim().length > 0 ? value : undefined

      const desligamentoInfos = isDesligamento
        ? {
            ...(buildOptionalValue(rhDataExameDemissional)
              ? { rhDataExameDemissional }
              : {}),
            ...(buildOptionalValue(rhDataLiberacaoPpp)
              ? { rhDataLiberacaoPpp }
              : {}),
            ...(buildOptionalValue(rhConsideracoes)
              ? { rhConsideracoes }
              : {}),
            ...(buildOptionalValue(dpDataDemissao)
              ? { dpDataDemissao }
              : {}),
            ...(buildOptionalValue(dpDataPrevistaAcerto)
              ? { dpDataPrevistaAcerto }
              : {}),
            ...(buildOptionalValue(dpConsideracoes)
              ? { dpConsideracoes }
              : {}),
          }
        : {}

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
            duracaoMeses: duracaoCursoMeses,
            valorMensal: valorMensalCurso,
            outrasInfos: {
              ...(valorTotalCurso !== null
                ? { valorTotalCalculado: valorTotalCurso }
                : {}),
                ...desligamentoInfos,
            },
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
          : isDesligamento && isDpDestino
            ? 'Solicitação finalizada pelo DP.'
            : 'Solicitação finalizada no RH e encaminhada ao DP para conclusão.',
      )
      onFinalized?.()
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
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
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
            {/* Modo de aprovação (tela do gestor) */}
            {isApprovalMode && (
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
            )}

            {/* Ações de assumir/finalizar – só quando pode gerenciar */}
            {showManagementActions && (
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

                {!isDpDestino && canFinalizarRh && isSolicitacaoPessoal && (
                  <button
                    onClick={() => setShowContratadoForm((v) => !v)}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {showContratadoForm
                      ? 'Ocultar dados do contratado'
                      : 'Dados do contratado'}
                  </button>
                )}

                {canFinalizarRh && (
                  <button
                    onClick={handleFinalizarRh}
                    disabled={closing}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {closing ? 'Enviando...' : finalizarLabel}
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

        {isApprovalMode && approvalAction && (
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
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          <div className="space-y-5">
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
                       formatCostCenterLabel(detail.costCenter, '')

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
               {isNadaConsta ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    Nada Consta
                  </p>

                  {nadaConstaError && (
                    <p className="mb-3 text-xs text-red-600">
                      {nadaConstaError}
                    </p>
                  )}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Dados do colaborador
                      </p>
                      {camposNadaConstaSolicitante.length > 0 ? (
                        <div className="space-y-2 text-xs text-slate-700">
                          {camposNadaConstaSolicitante.map((campo) => (
                            <div key={campo.name}>
                              <label className={LABEL_RO}>
                                {campo.label}
                              </label>
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
                      ) : (
                        <p className="text-xs text-slate-500">
                          Nenhum dado informado pelo solicitante.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Setores responsáveis
                      </p>
                       {userIsDpOrAdmin ? (
                        <div className="space-y-2 text-xs">
                          {setoresNadaConsta.map((setor) => {
                            const isConcluida = setor.status === 'CONCLUIDO'
                            const isCurrent = activeSector === setor.key
                            const badgeClass = isConcluida
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-yellow-200 bg-yellow-50 text-yellow-700'

                            return (
                              <button
                                key={setor.key}
                                type="button"
                                onClick={() => setActiveSector(setor.key)}
                                disabled={isCurrent}
                                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold ${badgeClass} ${
                                  isCurrent
                                    ? 'cursor-default opacity-80'
                                    : 'hover:bg-white'
                                }`}
                              >
                                <span className="truncate">{setor.label}</span>
                                <span className="text-[10px] uppercase tracking-wide">
                                  {isConcluida ? 'Concluído' : 'Pendente'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-700">
                          {selectedSetorLabel ? (
                            <p className="font-semibold">
                              {selectedSetorLabel}
                            </p>
                          ) : (
                            <p className="text-slate-500">
                              Nenhum setor vinculado encontrado.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                      </div>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          Dados do setor
                        </p>
                        <p className="text-xs text-slate-500">
                          Os campos do setor ficam em uma janela separada para
                          facilitar o preenchimento.
                        </p>
                        {selectedSetorLabel && (
                          <p className="mt-2 text-xs font-semibold text-slate-700">
                            Setor selecionado: {selectedSetorLabel}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                         onClick={() => {
                          if (!activeSector && defaultActiveSector) {
                            setActiveSector(defaultActiveSector)
                          }
                          setIsNadaConstaSetorOpen(true)
                        }}
                        disabled={
                          camposNadaConstaSetor.length === 0 ||
                          (!activeSector && !defaultActiveSector)
                        }
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Abrir janela do setor
                      </button>
                    </div>
                    {camposNadaConstaSetor.length === 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        Selecione um setor para liberar os campos.
                      </p>
                    )}
                  </div>

                  {isNadaConstaSetorOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
                      <div
                        className="absolute inset-0 bg-slate-900/40"
                        onClick={() => setIsNadaConstaSetorOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="relative z-10 flex w-full max-w-5xl max-h-[90vh] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              Dados do setor
                            </p>
                            {selectedSetorLabel && (
                              <p className="text-sm font-semibold text-slate-700">
                                {selectedSetorLabel}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsNadaConstaSetorOpen(false)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Fechar
                          </button>
                        </div>

                         <div className="mt-4 flex-1 overflow-y-auto pr-1">
                          {camposNadaConstaSetor.length > 0 ? (
                            <div className="space-y-3 text-xs text-slate-700">
                              {camposNadaConstaSetor.map(renderNadaConstaCampo)}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Selecione um setor para preencher os dados.
                            </p>
                          )}

                          {camposNadaConstaSetor.length > 0 &&
                            canEditNadaConstaSetor && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSalvarNadaConsta(false)}
                                  disabled={savingNadaConsta}
                                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  {savingNadaConsta
                                    ? 'Salvando...'
                                    : 'Salvar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSalvarNadaConsta(true)}
                                  disabled={savingNadaConsta}
                                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                                >
                                  Finalizar setor
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : isSolicitacaoPessoal ? (
                <RQ063ResumoCampos payloadCampos={payloadCampos} />
                  ) : isDesligamento ? (
                <RQ247ResumoCampos
                  payloadCampos={payloadCampos}
                  rhDataExameDemissional={rhDataExameDemissional}
                  rhDataLiberacaoPpp={rhDataLiberacaoPpp}
                  rhConsideracoes={rhConsideracoes}
                  dpDataDemissao={dpDataDemissao}
                  dpDataPrevistaAcerto={dpDataPrevistaAcerto}
                  dpConsideracoes={dpConsideracoes}
                  onRhDataExameDemissionalChange={setRhDataExameDemissional}
                  onRhDataLiberacaoPppChange={setRhDataLiberacaoPpp}
                  onRhConsideracoesChange={setRhConsideracoes}
                  onDpDataDemissaoChange={setDpDataDemissao}
                  onDpDataPrevistaAcertoChange={setDpDataPrevistaAcerto}
                  onDpConsideracoesChange={setDpConsideracoes}
                  rhEditable={canEditRhSection}
                  dpEditable={canEditDpSection}
                />
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
                          <span className="text-emerald-600">
                            {uploadSuccess}
                          </span>
                        )}
                        {uploadError && (
                          <span className="text-red-600">{uploadError}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloco de incentivo / educação */}
              {isSolicitacaoIncentivo && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                    Informações para incentivo à educação
                  </p>

                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                    <div>
                      <label className={LABEL_RO}>
                        Nome do colaborador/aluno
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={candidatoNome}
                        onChange={(e) => setCandidatoNome(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>
                        Duração do curso (meses)
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={duracaoCursoMeses}
                        onChange={(e) => setDuracaoCursoMeses(e.target.value)}
                        placeholder="Ex.: 12"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Valor mensal (R$)</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={valorMensalCurso}
                        onChange={(e) => setValorMensalCurso(e.target.value)}
                        placeholder="Ex.: 500,00"
                      />
                    </div>

                    <div className="flex flex-col justify-end text-[12px] text-slate-700">
                      <span className="font-semibold">Valor total estimado</span>
                      <span className="text-sm text-emerald-700">
                        {valorTotalCurso !== null
                          ? valorTotalCurso.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })
                          : '—'}
                      </span>
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
      .filter(
        ([k]) =>
          (payloadCampos[k] ?? '').toString().toLowerCase() === 'true',
      )
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
            <label className={LABEL_RO}>
              Crachá / República / Uniforme / Outros
            </label>
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
function RQ247ResumoCampos({
  payloadCampos,
  rhDataExameDemissional,
  rhDataLiberacaoPpp,
  rhConsideracoes,
  dpDataDemissao,
  dpDataPrevistaAcerto,
  dpConsideracoes,
  onRhDataExameDemissionalChange,
  onRhDataLiberacaoPppChange,
  onRhConsideracoesChange,
  onDpDataDemissaoChange,
  onDpDataPrevistaAcertoChange,
  onDpConsideracoesChange,
  rhEditable,
  dpEditable,
}: {
  payloadCampos: Record<string, any>
  rhDataExameDemissional: string
  rhDataLiberacaoPpp: string
  rhConsideracoes: string
  dpDataDemissao: string
  dpDataPrevistaAcerto: string
  dpConsideracoes: string
  onRhDataExameDemissionalChange: (value: string) => void
  onRhDataLiberacaoPppChange: (value: string) => void
  onRhConsideracoesChange: (value: string) => void
  onDpDataDemissaoChange: (value: string) => void
  onDpDataPrevistaAcertoChange: (value: string) => void
  onDpConsideracoesChange: (value: string) => void
  rhEditable: boolean
  dpEditable: boolean
}) {
  const get = (key: string) =>
    payloadCampos[key] !== undefined ? String(payloadCampos[key]) : ''

  const joinIfTrue = (entries: [string, string][]) =>
    entries
      .filter(
        ([k]) =>
          (payloadCampos[k] ?? '').toString().toLowerCase() === 'true',
      )
      .map(([, label]) => label)
      .join(', ')

  const motivos = joinIfTrue([
    ['motivoPedidoDemissao', 'Pedido de demissão'],
    ['motivoSemJustaCausa', 'Sem justa causa'],
    ['motivoJustaCausa', 'Justa causa'],
    ['motivoTerminoExperiencia', 'Término de experiência'],
  ])

  const rhDataExameValue = rhEditable
    ? rhDataExameDemissional
    : get('rhDataExameDemissional')
  const rhDataLiberacaoValue = rhEditable
    ? rhDataLiberacaoPpp
    : get('rhDataLiberacaoPpp')
  const rhConsideracoesValue = rhEditable
    ? rhConsideracoes
    : get('rhConsideracoes')

  const dpDataDemissaoValue = dpEditable
    ? dpDataDemissao
    : get('dpDataDemissao')
  const dpDataPrevistaValue = dpEditable
    ? dpDataPrevistaAcerto
    : get('dpDataPrevistaAcerto')
  const dpConsideracoesValue = dpEditable
    ? dpConsideracoes
    : get('dpConsideracoes')

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        RQ.247 Solicitação de Desligamento de Pessoal
      </p>

      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Dados do gestor solicitante
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Nome</label>
            <input className={INPUT_RO} readOnly value={get('gestorNome')} />
          </div>
          <div>
            <label className={LABEL_RO}>Cargo</label>
            <input className={INPUT_RO} readOnly value={get('gestorCargo')} />
          </div>
          <div>
            <label className={LABEL_RO}>Data</label>
            <input className={INPUT_RO} readOnly value={get('gestorData')} />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Motivo do desligamento
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Motivos selecionados</label>
            <input className={INPUT_RO} readOnly value={motivos || '-'} />
          </div>
          <div>
            <label className={LABEL_RO}>
              Data fim experiência (se aplicável)
            </label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('dataFimExperiencia')}
            />
          </div>
          <div className="md:col-span-2">
            <label className={LABEL_RO}>
              Justificativa do gestor (para sem/justa causa)
            </label>
            <textarea
              className={`${INPUT_RO} min-h-[70px]`}
              readOnly
              value={get('justificativaGestor')}
            />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Dados do funcionário
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Nome</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('funcionarioNome')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Cargo</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('funcionarioCargo')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Setor</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('funcionarioSetor')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Centro de custo</label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('funcionarioCentroCusto')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>
              Data sugerida do último dia
            </label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('dataSugeridaUltimoDia')}
            />
          </div>
          <div>
            <label className={LABEL_RO}>Funcionário cumprirá aviso?</label>
            <input className={INPUT_RO} readOnly value={get('cumpriraAviso')} />
          </div>
          <div>
            <label className={LABEL_RO}>
              Posição vaga será substituída?
            </label>
            <input
              className={INPUT_RO}
              readOnly
              value={get('posicaoSubstituida')}
            />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Informações gerais RH (preenchimento RH)
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Data exame demissional</label>
            {rhEditable ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={rhDataExameValue}
                onChange={(e) =>
                  onRhDataExameDemissionalChange(e.target.value)
                }
              />
            ) : (
              <input className={INPUT_RO} readOnly value={rhDataExameValue} />
            )}
          </div>
          <div>
            <label className={LABEL_RO}>Data liberação PPP</label>
            {rhEditable ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={rhDataLiberacaoValue}
                onChange={(e) => onRhDataLiberacaoPppChange(e.target.value)}
              />
            ) : (
              <input
                className={INPUT_RO}
                readOnly
                value={rhDataLiberacaoValue}
              />
            )}
          </div>
          <div className="md:col-span-2">
            <label className={LABEL_RO}>Considerações</label>
            {rhEditable ? (
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
                value={rhConsideracoesValue}
                onChange={(e) => onRhConsideracoesChange(e.target.value)}
              />
            ) : (
              <textarea
                className={`${INPUT_RO} min-h-[70px]`}
                readOnly
                value={rhConsideracoesValue}
              />
            )}
          </div>
        </div>
      </section>

      <section>
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Informações gerais DP (preenchimento DP)
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div>
            <label className={LABEL_RO}>Data demissão</label>
            {dpEditable ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={dpDataDemissaoValue}
                onChange={(e) => onDpDataDemissaoChange(e.target.value)}
              />
            ) : (
              <input className={INPUT_RO} readOnly value={dpDataDemissaoValue} />
            )}
          </div>
          <div>
            <label className={LABEL_RO}>Data prevista acerto</label>
            {dpEditable ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={dpDataPrevistaValue}
                onChange={(e) => onDpDataPrevistaAcertoChange(e.target.value)}
              />
            ) : (
              <input
                className={INPUT_RO}
                readOnly
                value={dpDataPrevistaValue}
              />
            )}
          </div>
          <div className="md:col-span-2">
            <label className={LABEL_RO}>Considerações</label>
            {dpEditable ? (
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[70px]"
                value={dpConsideracoesValue}
                onChange={(e) => onDpConsideracoesChange(e.target.value)}
              />
            ) : (
              <textarea
                className={`${INPUT_RO} min-h-[70px]`}
                readOnly
                value={dpConsideracoesValue}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
