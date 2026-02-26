// src/components/solicitacoes/SolicitationDetailModal.tsx
'use client'

import { format } from 'date-fns'
import React, { useEffect, useMemo, useState } from 'react'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  isSolicitacaoDesligamento,
  isSolicitacaoNadaConsta,
  isSolicitacaoEquipamento,
  isSolicitacaoEpiUniforme,
  isSolicitacaoExamesSst,
  isSolicitacaoPessoal,
  NADA_CONSTA_SETORES,
  getNadaConstaDefaultFieldsForSetor,
  type NadaConstaSetorKey,
  resolveNadaConstaSetoresByDepartment,
} from '@/lib/solicitationTypes'


const LABEL_RO =
   'block text-xs font-bold text-slate-800 uppercase tracking-wide'
const INPUT_RO =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base font-medium text-slate-800 shadow-sm ring-1 ring-amber-100/80 focus:outline-none cursor-default lg:text-sm'


// ===== Tipos que a página de lista já usa =====
export type Row = {
  id: string
  titulo: string
  status: string
  protocolo?: string
  createdAt?: string | null
  tipo?: { codigo?: string; nome: string } | null
  responsavel?: { fullName: string } | null
  responsavelId?: string | null
  autor?: { fullName: string } | null
  sla?: string | null
  setorDestino?: string | null
  requiresApproval?: boolean
  approvalStatus?: string | null
  costCenterId?: string | null
  departmentId?: string | null
}
type TiInventoryItem = {
  id: string
  patrimonio: string
  name: string
  status: string
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
  tipo?: { codigo?: string; nome: string } | null
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
  departmentId?: string | null
  departments?: { id?: string | null; code?: string | null; name?: string | null }[]
  moduleLevels?: Record<string, string>
}
const getUserSectors = (user: CurrentUser | null): NadaConstaSetorKey[] => {
  if (!user) return []

  const sectors = new Set<NadaConstaSetorKey>()
  const departments = [
    { code: user.departmentCode ?? null, name: user.departmentName ?? null },
    ...(user.departments ?? []),
  ]

  for (const dept of departments) {
   const resolved = resolveNadaConstaSetoresByDepartment({
      code: dept.code ?? null,
      name: dept.name ?? null,
    })
    for (const setor of resolved) {
      sectors.add(setor)
    }
  }

  return Array.from(sectors)
}

const getUserIsAdmin = (user: CurrentUser | null) => {
  if (!user) return false
  return user.role === 'ADMIN'

}


// ===== Status / Aprovação =====

type ApprovalStatus = 'NAO_PRECISA' | 'PENDENTE' | 'APROVADO' | 'REPROVADO'
type SolicitationStatus =
  | 'ABERTA'
  | 'EM_ATENDIMENTO'
  | 'AGUARDANDO_APROVACAO'
  | 'AGUARDANDO_TERMO'
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
  timelines?: { id: string; status: string; message?: string | null; createdAt: string }[]
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
    AGUARDANDO_TERMO: 'Aguardando termo',
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
  useEffect(() => {
    const isEquipamentoTipo = detail?.tipo?.nome === 'SOLICITAÇÃO DE EQUIPAMENTO'
     if (!isOpen || !detail?.id || !isEquipamentoTipo || isApprovalMode || !canManage) return
    const solicitationId = detail.id
    let alive = true

    async function loadTiInventory() {
      setLoadingTiInventory(true)
      try {
        const pageSize = 50
        let page = 1
        let total = 0
        const inventory: TiInventoryItem[] = []

        do {
          const res = await fetch(`/api/solicitacoes/${solicitationId}/equipamento?pageSize=${pageSize}&page=${page}`, {
            cache: 'no-store',
          })
          if (!res.ok) return

          const json = (await res.json()) as {
            items?: TiInventoryItem[]
            total?: number
          }

          const pageItems = (json.items ?? []).filter((item) => item.status === 'IN_STOCK')
          inventory.push(...pageItems)

          total = Number.isFinite(json.total) ? Number(json.total) : inventory.length
          page += 1
        } while (inventory.length < total)
        if (alive) {
          setTiInventory(inventory)
        }
      } catch (err) {
        console.error('Erro ao carregar inventário de TI', err)
      } finally {
        if (alive) setLoadingTiInventory(false)
      }
    }

    loadTiInventory()

    return () => {
      alive = false
    }
  }, [isOpen, detail?.id, detail?.tipo?.nome, isApprovalMode, canManage])


  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null)
  const [approvalAction, setApprovalAction] =
    useState<'APROVAR' | 'REPROVAR' | null>(null)
  const [approvalComment, setApprovalComment] = useState('')
  const [tiInventory, setTiInventory] = useState<TiInventoryItem[]>([])
  const [loadingTiInventory, setLoadingTiInventory] = useState(false)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [generatedDocumentUrl, setGeneratedDocumentUrl] = useState<string | null>(null)
  const [generatedSigningUrl, setGeneratedSigningUrl] = useState<string | null>(null)

  const [assumindo, setAssumindo] = useState(false)
  const [assumirError, setAssumirError] = useState<string | null>(null)
  const [encaminhandoAprovacao, setEncaminhandoAprovacao] = useState(false)
  const [autoEncaminhadoId, setAutoEncaminhadoId] = useState<string | null>(null)

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
  const [tipoRespostaSst, setTipoRespostaSst] = useState('')
  const [descricaoSolucaoSst, setDescricaoSolucaoSst] = useState('')
  const [observacaoSst1, setObservacaoSst1] = useState('')
  const [observacaoSst2, setObservacaoSst2] = useState('')

  const effectiveStatus = (detail?.status ?? row?.status ?? 'ABERTA') as SolicitationStatus
  const approvalStatus = (detail?.approvalStatus ?? null) as ApprovalStatus | null

  

  const statusLabel = getStatusLabel({
    status: effectiveStatus,
    approvalStatus,
    assumidaPorId:
      (detail as any)?.assumidaPorId ??
      row?.responsavelId ??
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
    const payloadSstResposta = (payload as any)?.sstResposta ?? {}
    setTipoRespostaSst((payloadSstResposta.tipoResposta as string) || '')
    setDescricaoSolucaoSst((payloadSstResposta.descricaoSolucao as string) || '')
    setObservacaoSst1((payloadSstResposta.observacao1 as string) || '')
    setObservacaoSst2((payloadSstResposta.observacao2 as string) || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id])

  const camposSchema: CampoEspecifico[] =
    detail?.tipo?.schemaJson?.camposEspecificos ?? []

    // Fluxos especiais
 const isSolicitacaoPessoalTipo = isSolicitacaoPessoal(detail?.tipo)
  const isSolicitacaoIncentivo =
    detail?.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
  const isDesligamento = isSolicitacaoDesligamento(detail?.tipo)
  const isNadaConsta = isSolicitacaoNadaConsta(detail?.tipo)
  const isSolicitacaoEquipamentoTi = isSolicitacaoEquipamento(detail?.tipo)
  const isSolicitacaoExames = isSolicitacaoExamesSst(detail?.tipo)
  const isSolicitacaoEpiUniformeTipo = isSolicitacaoEpiUniforme(detail?.tipo)
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
    isSolicitacaoPessoalTipo ||
    isSolicitacaoIncentivo ||
    isDesligamento ||
    isSolicitacaoExames ||
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
  const userIsAdmin = useMemo(
    () => getUserIsAdmin(currentUser),
    [currentUser],
  )

  const canEditNadaConstaSetor =
    Boolean(activeSector) &&
    (userIsAdmin ||
      userSectorKeys.has(activeSector as NadaConstaSetorKey)) &&
    !isFinalizadaOuCancelada &&
    !isSetorConcluido

  // pode assumir se não estiver concluída/cancelada
  const canAssumir = !isFinalizadaOuCancelada

  // pode finalizar no RH (RQ_063 envia para DP, RQ_091 encerra no RH ou DP)
  const canFinalizarRh = followsRhFinalizationFlow && !isFinalizadaOuCancelada
  const finalizarLabel = isDpDestino
    ? 'Finalizar chamado'
    : isSolicitacaoPessoalTipo || isDesligamento
      ? 'Enviar para o DP'
      : isSolicitacaoExames
        ? 'Finalizar'
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
 const visibleSetoresNadaConsta = useMemo(
    () => setoresNadaConsta,
    [setoresNadaConsta],
  )


  const selectedSetorLabel = useMemo(() => {
    if (!activeSector) return null
    const setor = setoresNadaConsta.find((item) => item.key === activeSector)
    return setor?.label ?? activeSector
  }, [activeSector, setoresNadaConsta])
  const defaultActiveSector = useMemo(() => {
    if (!isNadaConsta) return null
   
    const setorDoUsuario = visibleSetoresNadaConsta.find((setor) =>
      userSectorKeys.has(setor.key),
    )

    if (setorDoUsuario) return setorDoUsuario.key

    return visibleSetoresNadaConsta[0]?.key ?? userSectors[0] ?? null
  }, [
    isNadaConsta,
    userSectorKeys,
    userSectors,
    visibleSetoresNadaConsta,
  ])


  useEffect(() => {
    if (!isNadaConsta) return
    if (!defaultActiveSector) return

    if (!activeSector) {
      setActiveSector(defaultActiveSector)
      return
    }

    const exists = visibleSetoresNadaConsta.some(
      (setor) => setor.key === activeSector,
    )
    if (!exists) {
      setActiveSector(defaultActiveSector)
    }
  }, [
    activeSector,
    defaultActiveSector,
    isNadaConsta,
    visibleSetoresNadaConsta,
  ])


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
  const userIsSstOrAdmin =
    currentUser?.role === 'ADMIN' ||
   currentUser?.departmentCode === '19' ||
    (currentUser?.departments ?? []).some((dept) => dept.code === '19')
  const canEditSstResposta = showManagementActions && userIsSstOrAdmin && !isFinalizadaOuCancelada
  const canApproveEpiUniforme =
    currentUser?.moduleLevels?.solicitacoes === 'NIVEL_3' && userIsSstOrAdmin

  const currentUserDepartmentIds = useMemo(() => {
    const ids = new Set<string>()
    if (currentUser?.departmentId) ids.add(currentUser.departmentId)
    for (const dept of currentUser?.departments ?? []) {
      if (dept?.id) ids.add(dept.id)
    }
    return ids
  }, [currentUser])

  const canApproveByDepartment =
    currentUser?.moduleLevels?.solicitacoes === 'NIVEL_3' &&
    !!detail?.department?.id &&
    currentUserDepartmentIds.has(detail.department.id)
  const camposFormSolicitante = isSolicitacaoEpiUniformeTipo
    ? camposSchema.filter((campo) => !campo.stage || campo.stage === 'solicitante')
    : camposSchema
    const hasAttachments = (detail?.anexos?.length ?? 0) > 0
  const canEncaminharAprovacaoEpi =
    showManagementActions &&
    isSolicitacaoEpiUniformeTipo &&
    hasAttachments &&
    !isFinalizadaOuCancelada &&
    approvalStatus === 'NAO_PRECISA'
  
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
      'w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-base lg:text-sm'
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
  async function handleTiSemEstoque() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const res = await fetch(`/api/solicitacoes/${solicitationId}/equipamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SEM_ESTOQUE' }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Não foi possível encaminhar para aprovação.')
      }

      setCloseSuccess('Sem estoque: solicitação encaminhada para aprovação nível 3.')
      await refreshDetailFromServer()
    } catch (err: any) {
      console.error('Erro ao encaminhar solicitação sem estoque', err)
      setCloseError(err?.message ?? 'Erro ao encaminhar solicitação para aprovação.')
    } finally {
      setClosing(false)
    }
  }
async function handleEncaminharAprovacaoComAnexo() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return

    setEncaminhandoAprovacao(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const res = await fetch(`/api/solicitacoes/${solicitationId}/anexos`, {
        method: 'PATCH',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(
          json?.error ?? 'Não foi possível encaminhar a solicitação para aprovação.',
        )
      }

      setCloseSuccess('Solicitação encaminhada para aprovação nível 3.')
      setAutoEncaminhadoId(solicitationId)
      await refreshDetailFromServer()
    } catch (err: any) {
      console.error('Erro ao encaminhar solicitação para aprovação', err)
      setCloseError(
        err?.message ?? 'Erro ao encaminhar solicitação para aprovação.',
      )
    } finally {
      setEncaminhandoAprovacao(false)
    }
  }

  useEffect(() => {
    if (!canEncaminharAprovacaoEpi || !detail?.id) return
    if (autoEncaminhadoId === detail.id) return
    void handleEncaminharAprovacaoComAnexo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEncaminharAprovacaoEpi, detail?.id, autoEncaminhadoId])
  async function handleTiAlocarEquipamento() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return

     if (!selectedEquipmentId) {
      setCloseError('Selecione um equipamento para continuar.')
      return
    }

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const res = await fetch(`/api/solicitacoes/${solicitationId}/equipamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ALOCAR_E_GERAR_TERMO',
          equipmentId: selectedEquipmentId,
          signingProvider: 'DOCUSIGN',
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const apiMessage = [json?.error, json?.detail].filter(Boolean).join(' - ')
        throw new Error(apiMessage || 'Não foi possível alocar o equipamento.')
      }

       const json = await res.json().catch(() => ({}))
      setGeneratedDocumentUrl(json?.documentUrl ?? null)
      setGeneratedSigningUrl(json?.signingUrl ?? null)
      setCloseSuccess('Equipamento alocado, termo gerado e assinatura DocuSign iniciada.')
      await refreshDetailFromServer()
    } catch (err: any) {
      console.error('Erro ao alocar equipamento', err)
      setCloseError(err?.message ?? 'Erro ao alocar equipamento.')
    } finally {
      setClosing(false)
    }
  }


  async function handleSalvarOuFinalizarSst(finalizar: boolean) {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
       const salvarRes = await fetch(`/api/solicitacoes/${solicitationId}/sst-solucao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoResposta: tipoRespostaSst,
          descricaoSolucao: descricaoSolucaoSst,
          observacao1: observacaoSst1,
          observacao2: observacaoSst2,
          finalizar: false,
        }),
      })

      if (!salvarRes.ok) {
        const json = await salvarRes.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Falha ao salvar tratativa do SST.')
      }
      if (finalizar) {
        const encerrarRes = await fetch(`/api/solicitacoes/${solicitationId}/encerrar`, {
          method: 'PATCH',
        })

        if (!encerrarRes.ok) {
          const json = await encerrarRes.json().catch(() => ({}))
          throw new Error(json?.error ?? 'Falha ao encerrar chamado do SST.')
        }
      }


      await refreshDetailFromServer()
      setCloseSuccess(finalizar ? 'Chamado finalizado pelo SST.' : 'Tratativa SST salva com sucesso.')
      if (finalizar) onFinalized?.()
    } catch (err: any) {
      console.error('Erro na tratativa SST', err)
      setCloseError(err?.message ?? 'Erro ao salvar tratativa SST.')
    } finally {
      setClosing(false)
    }
  }


  async function handleFinalizarRh() {
    const solicitationId = detail?.id ?? row?.id
    if (!solicitationId) return

    setClosing(true)
    setCloseError(null)
    setCloseSuccess(null)

    try {
      const isBlank = (value: string | null | undefined) =>
        !value || value.trim().length === 0

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

      if (isSolicitacaoPessoalTipo) {
        const faltantes: string[] = []

        if (isBlank(nomeFinal)) faltantes.push('nome do contratado')
        if (isBlank(documentoFinal)) faltantes.push('documento (CPF)')
        if (isBlank(dataAdmissaoPrevista)) faltantes.push('data de admissão prevista')
        if (isBlank(cargo)) faltantes.push('cargo')
        if (isBlank(salario)) faltantes.push('salário')

        if (faltantes.length > 0) {
          throw new Error(
            `Preencha os dados pendentes do contratado antes de enviar para o DP: ${faltantes.join(', ')}.`,
          )
        }
      }
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
        isSolicitacaoPessoalTipo
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
  if (!isOpen || !row) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 lg:items-center">
      <div className="flex w-full h-full flex-col overflow-hidden rounded-none bg-white shadow-xl lg:h-auto lg:max-h-[90vh] lg:max-w-6xl lg:rounded-xl">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            {/* Modo de aprovação (tela do gestor) */}
               {isApprovalMode && canApproveByDepartment && (!isSolicitacaoEpiUniformeTipo || canApproveEpiUniforme) && (
              <>
                <button
                  onClick={() => handleStartApproval('APROVAR')}
                  disabled={closing}
                  className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 lg:w-auto lg:text-sm"
                >
                  Aprovar
                </button>

                <button
                  onClick={() => handleStartApproval('REPROVAR')}
                  disabled={closing}
                    className="w-full rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-500 disabled:opacity-60 lg:w-auto lg:text-sm"
                >
                  Reprovar
                </button>
              </>
            )}

             {isApprovalMode && (!canApproveByDepartment || (isSolicitacaoEpiUniformeTipo && !canApproveEpiUniforme)) && (
              <span className="text-[11px] font-semibold text-amber-700">
                Aprovação disponível apenas para nível 3 de solicitações no SST.
              </span>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-md border border-slate-300 px-4 py-3 text-base text-slate-700 hover:bg-slate-50 lg:w-auto lg:text-sm"
            >
              Fechar
            </button>
          </div>
        </div>

         {isApprovalMode && canApproveByDepartment && (!isSolicitacaoEpiUniformeTipo || canApproveEpiUniforme) && approvalAction && (
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
                     className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 lg:text-sm"
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

              <div className="flex w-full flex-col items-stretch gap-2 self-end sm:self-start lg:w-auto">
                <button
                  onClick={handleConfirmApprovalAction}
                  disabled={closing}
                  className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 lg:w-auto lg:text-sm"
                >
                  {approvalAction === 'APROVAR'
                    ? 'Confirmar aprovação'
                    : 'Confirmar reprovação'}
                </button>

                <button
                  onClick={handleCancelApprovalAction}
                  className="w-full rounded-md border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 lg:w-auto lg:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-5 lg:col-span-2">
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
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  Dados gerais do chamado
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-sky-50/40 p-4 shadow-sm">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                        {visibleSetoresNadaConsta.length > 0 ? (
                        <div className="space-y-2 text-xs">
                          {visibleSetoresNadaConsta.map((setor) => {
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
                                    ? 'cursor-default opacity-90 ring-2 ring-sky-400 ring-offset-1'
                                    : 'hover:bg-white'
                                }`}
                                aria-pressed={isCurrent}
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

                  {!showManagementActions && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs text-slate-500">
                        Tratativas do Nada Consta disponíveis apenas no painel de atendimento.
                      </p>

                    </div>
                  )}
                </div>
              ) : isSolicitacaoPessoalTipo ? (
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
                  rhEditable={false}
                  dpEditable={false}
                />
              ) : (
                camposSchema.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      Formulário do tipo de solicitação
                    </p>

                      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {camposFormSolicitante.map((campo) => (
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

                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className={LABEL_RO}>Nome completo</label>
                      <input
                       className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                        value={candidatoNome}
                        onChange={(e) => setCandidatoNome(e.target.value)}
                        placeholder="Nome do contratado"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Documento (CPF)</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                        value={dataAdmissaoPrevista}
                        onChange={(e) =>
                          setDataAdmissaoPrevista(e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Cargo</label>
                      <input
                         className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                        value={cargo}
                        onChange={(e) => setCargo(e.target.value)}
                        placeholder="Cargo do contratado"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Salário</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
                          className="w-full rounded-md bg-blue-600 px-4 py-3 text-base text-white hover:bg-blue-500 disabled:opacity-60 lg:w-auto lg:text-sm"
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
              {isSolicitacaoIncentivo && !showManagementActions && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                    Informações para incentivo à educação
                  </p>

                    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className={LABEL_RO}>
                        Nome do colaborador/aluno
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                        value={duracaoCursoMeses}
                        onChange={(e) => setDuracaoCursoMeses(e.target.value)}
                        placeholder="Ex.: 12"
                      />
                    </div>

                    <div>
                      <label className={LABEL_RO}>Valor mensal (R$)</label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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

            {showManagementActions && detail && (
              <aside className="w-full lg:col-span-1">
                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-6 lg:max-h-[72vh] lg:overflow-y-auto">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    Painel de Tratativas
                  </p>
                  {!isFinalizadaOuCancelada && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                        Anexar documento para tratativa/aprovação
                      </p>

                      <div className="space-y-2">
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
                            className="w-full rounded-md bg-blue-600 px-4 py-3 text-base text-white hover:bg-blue-500 disabled:opacity-60 lg:w-auto lg:text-sm"
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
                    </div>                  )}

                   {!isDpDestino && canFinalizarRh && isSolicitacaoPessoalTipo && (
                    <button
                      onClick={() => setShowContratadoForm((v) => !v)}
                      className="w-full rounded-md bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-200 lg:w-auto lg:text-sm"
                    >
                       {showContratadoForm
                        ? 'Ocultar dados do contratado'
                        : 'Dados do contratado'}
                    </button>
                  )}

                   {isSolicitacaoExames && canFinalizarRh && canEditSstResposta && (
                    <button
                      onClick={() => handleSalvarOuFinalizarSst(false)}
                      disabled={closing || isFinalizadaOuCancelada}
                      className="w-full rounded-md bg-slate-700 px-4 py-3 text-base font-semibold text-white hover:bg-slate-600 disabled:opacity-60 lg:w-auto lg:text-sm"
                    >
                      {closing ? 'Salvando...' : 'Salvar resposta/solução'}
                    </button>
                  )}

                  {canFinalizarRh && (!isSolicitacaoExames || canEditSstResposta) && (
                    <button
                      onClick={() => (isSolicitacaoExames ? handleSalvarOuFinalizarSst(true) : handleFinalizarRh())}
                      disabled={closing || isFinalizadaOuCancelada}
                      className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 lg:w-auto lg:text-sm"
                    >
                      {closing ? 'Enviando...' : finalizarLabel}
                    </button>
                  )}
                   {isSolicitacaoExames && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        Preenchimento SST (Visível pelo solicitante)
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className={LABEL_RO}>Tipo Resposta</label>
                          {canEditSstResposta ? (
                            <select
                               className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                              value={tipoRespostaSst}
                              onChange={(e) => setTipoRespostaSst(e.target.value)}
                            >
                              <option value="">Selecione...</option>
                              <option value="SOLUÇÃO COM ORIENTAÇÃO!">SOLUÇÃO COM ORIENTAÇÃO!</option>
                              <option value="SOLUÇÃO COM AÇÃO EXECUTADA!">SOLUÇÃO COM AÇÃO EXECUTADA!</option>
                              <option value="SOLUÇÃO SEM AÇÃO">SOLUÇÃO SEM AÇÃO</option>
                            </select>
                          ) : (
                            <input className={INPUT_RO} readOnly value={tipoRespostaSst} />
                          )}
                        </div>

                        <div>
                          <label className={LABEL_RO}>Descrição da Solução</label>
                          {canEditSstResposta ? (
                            <textarea
                              className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                              value={descricaoSolucaoSst}
                              onChange={(e) => setDescricaoSolucaoSst(e.target.value)}
                            />
                          ) : (
                            <textarea className={`${INPUT_RO} min-h-[90px]`} readOnly value={descricaoSolucaoSst} />
                          )}
                        </div>

                        <div>
                          <label className={LABEL_RO}>Adicionar Observação</label>
                          {canEditSstResposta ? (
                            <textarea
                              className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                              value={observacaoSst1}
                              onChange={(e) => setObservacaoSst1(e.target.value)}
                            />
                          ) : (
                            <textarea className={`${INPUT_RO} min-h-[90px]`} readOnly value={observacaoSst1} />
                          )}
                        </div>

                        <div>
                          <label className={LABEL_RO}>Adicionar Observação</label>
                          {canEditSstResposta ? (
                            <textarea
                             className="mt-1 min-h-[90px] w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                              value={observacaoSst2}
                              onChange={(e) => setObservacaoSst2(e.target.value)}
                            />
                          ) : (
                            <textarea className={`${INPUT_RO} min-h-[90px]`} readOnly value={observacaoSst2} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
 {isSolicitacaoEquipamentoTi && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                        Inventário TI e decisão de atendimento
                      </p>

                      <div className="space-y-3">
                        <label className="space-y-1 text-xs text-slate-700">
                          <span className="font-semibold">
                            Equipamento disponível (IN_STOCK)
                          </span>
                          <select
                            className="w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
                            value={selectedEquipmentId}
                            onChange={(e) => setSelectedEquipmentId(e.target.value)}
                            disabled={loadingTiInventory || closing || isFinalizadaOuCancelada}
                          >
                            <option value="">Selecione...</option>
                            {tiInventory.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.patrimonio} - {item.name}
                              </option>
                            ))}
                          </select>
                        </label>

                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleTiAlocarEquipamento}
                          disabled={closing || isFinalizadaOuCancelada}
                         className="w-full rounded-md bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-500 disabled:opacity-60 lg:w-auto lg:text-sm"
                        >
                          {closing ? 'Processando...' : 'Alocar equipamento e gerar termo'}
                        </button>
                        <button
                          onClick={handleTiSemEstoque}
                          disabled={closing || isFinalizadaOuCancelada}
                          className="w-full rounded-md bg-amber-500 px-4 py-3 text-base font-semibold text-white hover:bg-amber-400 disabled:opacity-60 lg:w-auto lg:text-sm"
                        >
                          Sem estoque → encaminhar para aprovação
                        </button>
                      </div>
                       {(generatedDocumentUrl || generatedSigningUrl) && (
                        <div className="mt-3 space-y-2 text-xs">
                          {generatedDocumentUrl && (
                            <a
                              href={generatedDocumentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-blue-700 underline"
                            >
                              Ver termo gerado
                            </a>
                          )}
                          {generatedSigningUrl && (
                            <a
                              href={generatedSigningUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-emerald-700 underline"
                            >
                              Assinar agora (DocuSign)
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isNadaConsta && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Tratativa do setor
                      </p>

                      {nadaConstaError && (
                        <p className="mb-2 text-xs text-red-600">{nadaConstaError}</p>
                      )}

                      {camposNadaConstaSetor.length > 0 ? (
                        <div className="space-y-3 text-xs text-slate-700">
                          {camposNadaConstaSetor.map(renderNadaConstaCampo)}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Selecione um setor para preencher os dados.
                        </p>
                      )}

                      {camposNadaConstaSetor.length > 0 && canEditNadaConstaSetor && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSalvarNadaConsta(false)}
                            disabled={savingNadaConsta}
                          className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 lg:w-auto lg:text-sm"
                          >
                            {savingNadaConsta ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSalvarNadaConsta(true)}
                            disabled={savingNadaConsta}
                            className="w-full rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 lg:w-auto lg:text-sm"
                          >
                            Finalizar setor
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Rodapé */}
         <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs">
            {closeError && <p className="text-red-600">{closeError}</p>}
            {closeSuccess && (
              <p className="text-emerald-600">{closeSuccess}</p>
            )}
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:flex-row lg:items-center">
             {showManagementActions && canAssumir && (
              <button
                onClick={handleAssumirChamado}
                disabled={assumindo || isFinalizadaOuCancelada}
                className="w-full rounded-md bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 lg:w-auto lg:text-sm"
              >
                {assumindo ? 'Assumindo...' : 'Assumir chamado'}
              </button>
            )}

            {canEncaminharAprovacaoEpi && (
              <button
                onClick={handleEncaminharAprovacaoComAnexo}
                disabled={encaminhandoAprovacao}
                className="w-full rounded-md bg-amber-500 px-4 py-3 text-base font-semibold text-white hover:bg-amber-400 disabled:opacity-60 lg:w-auto lg:text-sm"
              >
                {encaminhandoAprovacao
                  ? 'Encaminhando...'
                  : 'Encaminhar para aprovação'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-md border border-slate-300 px-4 py-3 text-base text-slate-700 hover:bg-slate-50 lg:w-auto lg:text-sm"
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
  const [activeTab, setActiveTab] = useState<
    'basicas' | 'contratacao' | 'academicos' | 'solicitacoes' | 'projetos' | 'admissao'
  >('basicas')

  const get = (key: string) =>
    payloadCampos[key] !== undefined ? String(payloadCampos[key]) : ''

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
    ['motivoAumentoQuadro', 'Aumento no quadro'],
  ])

  const tipoContratacao = joinIfTrue([
    ['contratacaoTemporaria', 'Temporária'],
    ['contratacaoPermanente', 'Permanente'],
  ])

  const solicitacoesNovoFunc = joinIfTrue([
    ['solicitacaoCracha', 'Crachá'],
    ['solicitacaoTesteDirecao', 'Teste de direção'],
    ['solicitacaoRepublica', 'República'],
    ['solicitacaoEpis', 'EPIs'],
    ['solicitacaoUniforme', 'Uniforme'],
    ['solicitacaoPostoTrabalho', 'Posto de trabalho'],
  ])

  const localMatrizFilial = joinIfTrue([
    ['escritorioMatriz', 'Matriz'],
    ['escritorioFilial', 'Filial'],
  ])

  const completoOuAndamento =
    bool('escolaridadeCompleta') === 'Sim'
      ? 'Completo'
      : bool('cursoEmAndamento') === 'Sim'
        ? 'Em andamento'
        : ''

  const tabClass = (tab: string) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition ${
      activeTab === tab
        ? 'border-orange-300 bg-orange-50 text-orange-700'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`
   return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        RQ_063 - Solicitação de Pessoal / Admissão
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tabClass('basicas')} onClick={() => setActiveTab('basicas')}>
          Aba 1 — Informações básicas
        </button>
        <button type="button" className={tabClass('contratacao')} onClick={() => setActiveTab('contratacao')}>
          Aba 2 — Contratação
        </button>
        <button type="button" className={tabClass('academicos')} onClick={() => setActiveTab('academicos')}>
          Aba 3 — Requisitos acadêmicos
        </button>
        <button type="button" className={tabClass('solicitacoes')} onClick={() => setActiveTab('solicitacoes')}>
          Aba 4 — Solicitações
        </button>
        <button type="button" className={tabClass('projetos')} onClick={() => setActiveTab('projetos')}>
          Aba 5 — Escritório de Projetos
        </button>
        <button type="button" className={tabClass('admissao')} onClick={() => setActiveTab('admissao')}>
          Aba 6 — Dados do contratado
        </button>
      </div>

      {activeTab === 'basicas' && (
        <section>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={LABEL_RO}>Cargo</label><input className={INPUT_RO} readOnly value={get('cargoNome') || get('cargo')} /></div>
            <div><label className={LABEL_RO}>Setor e/ou Projeto</label><input className={INPUT_RO} readOnly value={get('setorProjeto')} /></div>
            <div><label className={LABEL_RO}>Vaga prevista em contrato</label><input className={INPUT_RO} readOnly value={get('vagaPrevista') || get('vagaPrevistaContrato')} /></div>
            <div><label className={LABEL_RO}>Local de trabalho</label><input className={INPUT_RO} readOnly value={get('localTrabalho')} /></div>
            <div><label className={LABEL_RO}>Centro de custo</label><input className={INPUT_RO} readOnly value={get('centroCustoForm') || get('centroCustoId')} /></div>
            <div><label className={LABEL_RO}>Horário de trabalho</label><input className={INPUT_RO} readOnly value={get('horarioTrabalho')} /></div>
            <div><label className={LABEL_RO}>Chefia imediata</label><input className={INPUT_RO} readOnly value={get('chefiaImediata')} /></div>
            <div><label className={LABEL_RO}>Coordenador do contrato</label><input className={INPUT_RO} readOnly value={get('coordenadorContrato')} /></div>
            <div><label className={LABEL_RO}>Motivo da vaga</label><input className={INPUT_RO} readOnly value={motivoVaga || get('motivoVaga')} /></div>
          </div>
        </section>
      )}

      {activeTab === 'contratacao' && (
        <section className="space-y-3 text-xs">
          <div>
             <label className={LABEL_RO}>Tipo de contratação</label>
            <input className={INPUT_RO} readOnly value={tipoContratacao || get('tipoContratacao')} />
          </div>
          <div>
            <label className={LABEL_RO}>Justificativa da vaga</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('justificativaVaga')} />
          </div>
          <div>
            <label className={LABEL_RO}>Principais atividades</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('principaisAtividades')} />
          </div>
          <div>
            <label className={LABEL_RO}>Atividades complementares</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('atividadesComplementares')} />
          </div>
        </section>
      )}

      {activeTab === 'academicos' && (
        <section className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={LABEL_RO}>Escolaridade</label><input className={INPUT_RO} readOnly value={get('escolaridade')} /></div>
            <div><label className={LABEL_RO}>Curso</label><input className={INPUT_RO} readOnly value={get('curso')} /></div>
            <div><label className={LABEL_RO}>Completo / Em andamento</label><input className={INPUT_RO} readOnly value={completoOuAndamento} /></div>

           </div>
          <div>
            <label className={LABEL_RO}>Período/Módulo (mínimo/máximo)</label>
            <input className={INPUT_RO} readOnly value={get('periodoModulo')} />
          </div>
          <div>
            <label className={LABEL_RO}>Requisitos e conhecimentos necessários</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('requisitosConhecimentos')} />
          </div>
          <div>
            <label className={LABEL_RO}>Competências comportamentais exigidas</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('competenciasComportamentais')} />
          </div>
         </section>
      )}

      {activeTab === 'solicitacoes' && (
        <section className="space-y-3 text-xs">
          <div>
            <label className={LABEL_RO}>Solicitações</label>
            <input className={INPUT_RO} readOnly value={solicitacoesNovoFunc || get('solicitacaoOutros')} />
          </div>
        </section>
      )}

      {activeTab === 'projetos' && (
        <section className="space-y-3 text-xs">
          <div>
            <label className={LABEL_RO}>Matriz ou Filial</label>
            <input className={INPUT_RO} readOnly value={localMatrizFilial} />
          </div>
          <div>
            <label className={LABEL_RO}>Previsto em contrato (Salários, Benefícios, Carga Horária e Outros)</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('previstoContrato')} />
          </div>
        </section>
      )}

      {activeTab === 'admissao' && (
        <section className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={LABEL_RO}>Nome do profissional</label><input className={INPUT_RO} readOnly value={get('nomeProfissional')} /></div>
            <div><label className={LABEL_RO}>Salário</label><input className={INPUT_RO} readOnly value={get('salario')} /></div>
            <div><label className={LABEL_RO}>Data de admissão</label><input className={INPUT_RO} readOnly value={get('dataAdmissao')} /></div>
            <div><label className={LABEL_RO}>CBO</label><input className={INPUT_RO} readOnly value={get('cbo')} /></div>
          </div>
          <div>
            <label className={LABEL_RO}>Benefícios</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('beneficios')} />
          </div>
          <div>
            <label className={LABEL_RO}>Observação</label>
            <textarea className={`${INPUT_RO} min-h-[80px]`} readOnly value={get('observacoesRh') || get('observacao')} />
          </div>
        </section>
      )}

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
         Gestor solicitante
        </p>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          {get('gestorSolicitanteInfo') || 'Identificação do gestor vinculada automaticamente ao solicitante autenticado.'}
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-1 text-[11px] font-semibold text-slate-600">
          Motivo do desligamento
        </p>
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
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
              value={get('funcionarioCostCenterId') || get('funcionarioCentroCusto')}
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
         <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={LABEL_RO}>Data exame demissional</label>
            {rhEditable ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
               className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm min-h-[70px]"
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
        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={LABEL_RO}>Data demissão</label>
            {dpEditable ? (
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
                 className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm"
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
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base lg:text-sm min-h-[70px]"
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
