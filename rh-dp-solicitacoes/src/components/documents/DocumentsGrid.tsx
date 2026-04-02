'use client'

import { Check, Download, Eye, Filter, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { endpoint: string; title: string; fixedStatus?: string; approvalStage?: 2 | 3; allowCreate?: boolean }

type GridRow = {
  versionId: string
  documentId: string
  dataPublicacao: string | null
  codigo: string
  nrRevisao: number
  titulo: string
  centroResponsavel: string
  elaborador: string
  vencimento: string | null
  status: string
}


type Option = { id: string; name?: string; description?: string; fullName?: string }
type CreateRouting = { status: string; targetTab: string; targetPath: string; message: string }
type CodeAvailabilityResponse = { available?: boolean; error?: string; message?: string; routing?: CreateRouting }
type CodeValidation = { status: 'idle' | 'checking' | 'available' | 'duplicate' | 'error'; message: string | null }

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const STATUS_STYLES: Record<string, string> = {
  PUBLICADO: 'bg-emerald-100 text-emerald-700',
  AG_APROVACAO: 'bg-amber-100 text-amber-700',
  EM_ANALISE_QUALIDADE: 'bg-indigo-100 text-indigo-700',
  EM_REVISAO: 'bg-sky-100 text-sky-700',
  EM_ELABORACAO: 'bg-slate-200 text-slate-700',
}
const PAGE_DESCRIPTIONS: Record<string, string> = {
  'Documentos Publicados': 'Acompanhe versões publicadas, consulte detalhes e exporte a listagem quando necessário.',
  'Documentos para Aprovação': 'Analise documentos pendentes de aprovação e registre decisões com mais clareza.',
  'Documentos em Revisão da Qualidade': 'Visualize itens em validação da qualidade e acompanhe o andamento da etapa.',
}

export default function DocumentsGrid({ endpoint, title, fixedStatus, approvalStage, allowCreate }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState('publishedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFiltersMobile, setShowFiltersMobile] = useState(false)
  const [canApprove, setCanApprove] = useState(false)
  const [canManageDocuments, setCanManageDocuments] = useState(false)
  const [actionInFlight, setActionInFlight] = useState<'cancel' | 'delete' | null>(null)
  const [targetRow, setTargetRow] = useState<GridRow | null>(null)


  const [term, setTerm] = useState<{ id: string; title: string; content: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<{ versionId: string; intent: 'view' | 'download' | 'print' } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<CreateRouting | null>(null)
  const [codeValidation, setCodeValidation] = useState<CodeValidation>({ status: 'idle', message: null })
  const [createForm, setCreateForm] = useState({ code: '', title: '', documentTypeId: '', ownerDepartmentId: '', authorUserId: '', revisionNumber: '', file: null as File | null })

  const [draftFilters, setDraftFilters] = useState({
    code: '',
    title: '',
    documentTypeId: '',
    ownerDepartmentId: '',
    authorUserId: '',
    status: fixedStatus ?? '',
  })
  const [appliedFilters, setAppliedFilters] = useState(draftFilters)

   const [meta, setMeta] = useState<{ documentTypes: Option[]; departments: Option[]; authors: Option[] }>({
    documentTypes: [],
    departments: [],
    authors: [],
  })
  const hasActiveFilters = useMemo(
    () => Boolean(appliedFilters.code || appliedFilters.title || appliedFilters.documentTypeId || appliedFilters.ownerDepartmentId || appliedFilters.authorUserId),
    [appliedFilters],
  )

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  const parseJsonSafely = async <T,>(res: Response): Promise<T | null> => {
    const body = await res.text()
    if (!body) return null

    try {
      return JSON.parse(body) as T
    } catch {
      return null
    }
  }
  const buildQuery = (format?: 'csv' | 'pdf') => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)
    if (format) params.set('format', format)

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })

    return params.toString()
  }

  const load = async () => {
    setLoading(true)
    const res = await fetch(`${endpoint}?${buildQuery()}`, { cache: 'no-store' })
    const data = await parseJsonSafely<{ items?: GridRow[]; total?: number }>(res)
    if (!res.ok || !data) {
      setItems([])
      setTotal(0)
      setLoading(false)
      return
    }

    setItems(data.items ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/documents/filters', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setMeta(data))
      .catch(() => null)
  }, [])

    useEffect(() => {
    if (!approvalStage) return
    fetch(`/api/documents/approval-access?stage=${approvalStage}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setCanApprove(Boolean(data.canApprove)))
      .catch(() => setCanApprove(false))
  }, [approvalStage])

  useEffect(() => {
    fetch('/api/documents/management-access', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setCanManageDocuments(Boolean(data.canManage)))
      .catch(() => setCanManageDocuments(false))
  }, [])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, sortBy, sortOrder, appliedFilters])

  const requestDocumentAccess = async (versionId: string, intent: 'view' | 'download' | 'print') => {
    if (!versionId) {
      alert('Não foi possível localizar a versão do documento para abrir.')
      return
    }

  try {
      const res = await fetch('/api/documents/term/active', { cache: 'no-store' })
      const data = await parseJsonSafely<{ id: string; title: string; content: string }>(res)
      if (!res.ok || !data?.id) {
        alert('Não foi possível carregar o termo de responsabilidade.')
        return
      }
      setTerm(data)
      setPendingAction({ versionId, intent })
    } catch {
      alert('Falha ao carregar o termo de responsabilidade. Tente novamente.')
    }
  }

  const executeDocumentAction = async (versionId: string, intent: 'view' | 'download' | 'print') => {
    if (intent === 'view' || intent === 'print') {
      const search = intent === 'print' ? '?intent=print' : ''
      router.push(`/documents/view/${encodeURIComponent(versionId)}${search}`)
      return
    }

    const endpoint = `/api/documents/versions/${encodeURIComponent(versionId)}/controlled?action=${intent}`

    if (intent === 'download') {
      const anchor = document.createElement('a')
      anchor.href = endpoint
      anchor.target = '_self'
      anchor.rel = 'noreferrer'
      anchor.click()
      return
    }
  }

  const decideApproval = async (versionId: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/documents/versions/${versionId}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action === 'reject' ? { comment: 'Reprovado na etapa.' } : {}),
    })
    if (res.ok) {
      await load()
      return
    }


    const data = await parseJsonSafely<{ error?: string }>(res)
    alert(data?.error ?? 'Não foi possível processar a aprovação.')
  }

  const cancelDocument = async (row: GridRow) => {
    setActionInFlight('cancel')
    const res = await fetch(`/api/documents/versions/${row.versionId}/cancel`, { method: 'PATCH' })
    setActionInFlight(null)

    if (!res.ok) {
      const data = await parseJsonSafely<{ error?: string }>(res)
      alert(data?.error ?? 'Não foi possível cancelar o documento.')
      return
    }

    setTargetRow(null)
    await load()
  }

  const deleteDocument = async (row: GridRow) => {
    setActionInFlight('delete')
    const res = await fetch(`/api/documents/${row.documentId}`, { method: 'DELETE' })
    setActionInFlight(null)

    if (!res.ok) {
      const data = await parseJsonSafely<{ error?: string }>(res)
      alert(data?.error ?? 'Não foi possível excluir o documento.')
      return
    }

    setTargetRow(null)
    await load()
  }
 const createDocument = async () => {
    const normalizedCode = createForm.code.trim()

    if (!normalizedCode || !createForm.title || !createForm.documentTypeId || !createForm.ownerDepartmentId) {
      setCreateError('Preencha os campos obrigatórios.')
      return
    }

    if (codeValidation.status === 'duplicate') {
      setCreateError(codeValidation.message ?? 'O código informado já está em uso. Informe outro código.')
      return
    }

     if (!createForm.file) {
      setCreateError('Anexe um arquivo PDF, DOC ou DOCX.')
      return
    }

     setCreateError(null)
    setCreating(true)
    const formData = new FormData()
    formData.set('code', normalizedCode)
    formData.set('title', createForm.title)
    formData.set('documentTypeId', createForm.documentTypeId)
    formData.set('ownerDepartmentId', createForm.ownerDepartmentId)
    formData.set('authorUserId', createForm.authorUserId)
    if (createForm.revisionNumber) formData.set('revisionNumber', createForm.revisionNumber)
    formData.set('file', createForm.file)

    const res = await fetch('/api/documents', { method: 'POST', body: formData })
    setCreating(false)

    if (!res.ok) {
      const data = await parseJsonSafely<{ error?: string }>(res)
      setCreateError(data?.error ?? 'Erro ao cadastrar documento.')
      return
    }

     const data = await parseJsonSafely<{ routing?: CreateRouting }>(res)
    setShowCreate(false)
    setCreateForm({ code: '', title: '', documentTypeId: '', ownerDepartmentId: '', authorUserId: '', revisionNumber: '', file: null })
    setCodeValidation({ status: 'idle', message: null })
    setCreateSuccess(data?.routing ?? { status: 'PUBLICADO', targetTab: 'publicados', targetPath: '/dashboard/controle-documentos/publicados', message: 'Documento cadastrado com sucesso.' })
    clearFilters()
    await load()
  }

  useEffect(() => {
    if (!showCreate) return

    const normalizedCode = createForm.code.trim()
    if (!normalizedCode) {
      setCodeValidation({ status: 'idle', message: null })
      return
    }

    const controller = new AbortController()
    setCodeValidation({ status: 'checking', message: 'Validando código...' })

     const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code: normalizedCode })
        const res = await fetch(`/api/documents/code-availability?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await parseJsonSafely<CodeAvailabilityResponse>(res)

        if (!res.ok) {
          setCodeValidation({ status: 'error', message: data?.error ?? 'Não foi possível validar o código agora.' })
          return
        }

        if (data?.available) {
          setCodeValidation({ status: 'available', message: data.message ?? 'Código disponível.' })
          return
        }

        setCodeValidation({ status: 'duplicate', message: data?.message ?? `Já existe um documento com o código ${normalizedCode}.` })
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setCodeValidation({ status: 'error', message: 'Não foi possível validar o código agora.' })
      }
    }, 350)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [createForm.code, showCreate])
  const acceptTerm = async () => {
    if (!term || !pendingAction) return
    const response = await fetch('/api/documents/term/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        termId: term.id,
        versionId: pendingAction.versionId,
        intent: pendingAction.intent.toUpperCase(),
      }),
    })
    if (!response.ok) {
      alert('Não foi possível registrar o aceite do termo de responsabilidade.')
      return
    }
    const action = pendingAction
    setTerm(null)
    setPendingAction(null)
    await executeDocumentAction(action.versionId, action.intent)
  }

  const onSearch = () => {
    setPage(1)
    setAppliedFilters({ ...draftFilters, status: fixedStatus ?? draftFilters.status })
  }

  const clearFilters = () => {
    const cleared = {
      code: '',
      title: '',
      documentTypeId: '',
      ownerDepartmentId: '',
      authorUserId: '',
      status: fixedStatus ?? '',
    }
    setDraftFilters(cleared)
    setAppliedFilters(cleared)
    setPage(1)
  }

  const changeSort = (nextSortBy: string) => {
    if (sortBy === nextSortBy) {
      setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortBy(nextSortBy)
    setSortOrder('asc')
  }

  const FiltersContent = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <input className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Código" value={draftFilters.code} onChange={(e) => setDraftFilters((v) => ({ ...v, code: e.target.value }))} />
      <input className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="Título" value={draftFilters.title} onChange={(e) => setDraftFilters((v) => ({ ...v, title: e.target.value }))} />
      <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={draftFilters.documentTypeId} onChange={(e) => setDraftFilters((v) => ({ ...v, documentTypeId: e.target.value }))}>
        <option value="">Tipo Documento</option>
        {meta.documentTypes.map((option) => <option key={option.id} value={option.id}>{option.description}</option>)}
      </select>
      <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={draftFilters.ownerDepartmentId} onChange={(e) => setDraftFilters((v) => ({ ...v, ownerDepartmentId: e.target.value }))}>
        <option value="">Centro Responsável</option>
        {meta.departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={draftFilters.authorUserId} onChange={(e) => setDraftFilters((v) => ({ ...v, authorUserId: e.target.value }))}>
        <option value="">Elaborador / Revisor</option>
        {meta.authors.map((option) => <option key={option.id} value={option.id}>{option.fullName}</option>)}
      </select>
      {!fixedStatus ? (
        <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={draftFilters.status} onChange={(e) => setDraftFilters((v) => ({ ...v, status: e.target.value }))}>
          <option value="">Status</option>
          <option value="PUBLICADO">PUBLICADO</option>
          <option value="AG_APROVACAO">AG_APROVACAO</option>
          <option value="EM_ANALISE_QUALIDADE">EM_ANALISE_QUALIDADE</option>
          <option value="EM_REVISAO">EM_REVISAO</option>
          <option value="EM_ELABORACAO">EM_ELABORACAO</option>
        </select>
      ) : <div />}

      <div className="col-span-full mt-1 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800" onClick={onSearch}><Search size={16} />Pesquisar</button>
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100" onClick={clearFilters}><X size={16} />Limpar filtros</button>
      </div>
    </div>
  )

 return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-orange-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Gestão de Documentos</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{PAGE_DESCRIPTIONS[title] ?? 'Consulte documentos, aplique filtros e acompanhe o fluxo da documentação.'}</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {allowCreate ? (
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600"
              onClick={() => {
                setCreateError(null)
                setCodeValidation({ status: 'idle', message: null })
                setShowCreate(true)
              }}
            ><Plus size={16} />Novo documento</button>
          ) : null}
          <a className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700" href={`/api/documents/export?${buildQuery('csv')}`}><Download size={15} />Exportar CSV</a>
          <a className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800" href={`/api/documents/export?${buildQuery('pdf')}`}><Download size={15} />Exportar PDF</a>
        </div>
        {loading ? <span className="text-sm text-slate-500">Atualizando listagem...</span> : null}
      </div>

      <div className="hidden rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:block">
        <p className="mb-3 text-sm font-medium text-slate-800">Filtros da listagem</p>
        {FiltersContent}
      </div>
      <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm md:hidden" onClick={() => setShowFiltersMobile(true)}><Filter size={16} />Filtros</button>
      {createSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>{createSuccess.message}</p>
          {endpoint.includes(createSuccess.targetTab) ? (
            <p className="mt-1 text-emerald-800">O item já está disponível nesta aba. Se não localizar, limpe os filtros.</p>
          ) : (
            <p className="mt-1 text-emerald-800">
              Localização: <a href={createSuccess.targetPath} className="underline">{createSuccess.targetPath}</a>.
            </p>
          )}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="cursor-pointer px-3 py-3 font-semibold" onClick={() => changeSort('publishedAt')}>Data Publicação</th>
              <th className="cursor-pointer px-3 py-3 font-semibold" onClick={() => changeSort('code')}>Código</th>
              <th className="cursor-pointer px-3 py-3 font-semibold" onClick={() => changeSort('revisionNumber')}>Nº Revisão</th>
              <th className="px-3 py-3 font-semibold">Título</th>
              <th className="px-3 py-3 font-semibold">Centro Responsável</th>
              <th className="px-3 py-3 font-semibold">Elaborador</th>
              <th className="cursor-pointer px-3 py-3 font-semibold" onClick={() => changeSort('expiresAt')}>Vencimento</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, idx) => <tr key={idx} className="border-t border-slate-100"><td colSpan={9} className="animate-pulse px-3 py-4 text-slate-400">Carregando...</td></tr>)
            ) : items.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td colSpan={9} className="px-3 py-10 text-center">
                  <p className="font-medium text-slate-700">Nenhum resultado encontrado</p>
                  <p className="mt-1 text-sm text-slate-500">{hasActiveFilters ? 'Revise os filtros aplicados ou clique em “Limpar filtros” para ampliar a busca.' : 'Quando houver documentos disponíveis, eles aparecerão nesta listagem.'}</p>
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.versionId} className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/70">
                  <td className="px-3 py-3">{row.dataPublicacao ? new Date(row.dataPublicacao).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-3 py-3 font-medium">{row.codigo}</td>
                  <td className="px-3 py-3">{row.nrRevisao}</td>
                  <td className="px-3 py-3">{row.titulo}</td>
                  <td className="px-3 py-3">{row.centroResponsavel}</td>
                  <td className="px-3 py-3">{row.elaborador}</td>
                  <td className="px-3 py-3">{row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status] ?? 'bg-slate-200 text-slate-700'}`}>{row.status}</span></td>
                    <td className="space-x-2 px-3 py-3">
                    <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100" onClick={() => requestDocumentAccess(row.versionId, 'view')}><Eye size={14} />Visualizar</button>
                    <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100" onClick={() => requestDocumentAccess(row.versionId, 'download')}><Download size={14} />Download</button>
                    <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100" onClick={() => requestDocumentAccess(row.versionId, 'print')}><Printer size={14} />Imprimir</button>
                    {approvalStage ? (
                      <>
                         <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100" onClick={() => decideApproval(row.versionId, 'approve')} disabled={!canApprove}><Check size={14} />Aprovar</button>
                        <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => decideApproval(row.versionId, 'reject')} disabled={!canApprove}><X size={14} />Reprovar</button>
                      </>
                    ) : null}
                    {canManageDocuments ? (
                      <>
                        <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100" onClick={() => setTargetRow(row)}><X size={14} />Cancelar</button>
                        <button className="mb-1 inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100" onClick={() => setTargetRow(row)}><Trash2 size={14} />Excluir</button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-400">Carregando...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="font-medium text-slate-700">Nenhum resultado encontrado</p>
            <p className="mt-1 text-sm text-slate-500">{hasActiveFilters ? 'Limpe os filtros para listar todos os itens disponíveis.' : 'Quando houver documentos cadastrados, eles aparecerão aqui.'}</p>
          </div>
        ) : null}        {items.map((row) => (
          <article key={row.versionId} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between"><strong>{row.codigo}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status] ?? 'bg-slate-100 text-slate-700'}`}>Rev {row.nrRevisao} · {row.status}</span></div>
            <p className="text-sm font-medium">{row.titulo}</p>
            <p className="text-xs text-slate-600">{row.centroResponsavel} · {row.elaborador}</p>
            <p className="text-xs text-slate-600">Pub: {row.dataPublicacao ? new Date(row.dataPublicacao).toLocaleDateString('pt-BR') : '-'} · Venc: {row.vencimento ? new Date(row.vencimento).toLocaleDateString('pt-BR') : '-'}</p>
            <div className="flex gap-2">
                <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700" onClick={() => requestDocumentAccess(row.versionId, 'view')}><Eye size={14} />Ver</button>
              <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white" onClick={() => requestDocumentAccess(row.versionId, 'download')}><Download size={14} />Baixar</button>
               <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700" onClick={() => requestDocumentAccess(row.versionId, 'print')}><Printer size={14} />Imprimir</button>
            </div>
            {canManageDocuments ? (
              <div className="grid grid-cols-2 gap-2">
                <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700" onClick={() => setTargetRow(row)}><X size={14} />Cancelar</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700" onClick={() => setTargetRow(row)}><Trash2 size={14} />Excluir</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Mostrar</span>
          <select className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)) }}>
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Anterior</button>
          <span className="text-sm text-slate-600">Página <span className="font-semibold text-slate-900">{page}</span> de <span className="font-semibold text-slate-900">{totalPages}</span></span>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>Próximo</button>
        </div>
      </div>

     {showFiltersMobile ? (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setShowFiltersMobile(false)}>
          <div className="ml-auto h-full w-[90%] max-w-sm overflow-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Filtros</h2><button className="rounded-lg border border-slate-300 px-2 py-1 text-sm" onClick={() => setShowFiltersMobile(false)}>Fechar</button></div>
            {FiltersContent}
          </div>
        </div>
      ) : null}

      {targetRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setTargetRow(null)}>
          <div className="w-full max-w-xl space-y-4 rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Gerenciar documento {targetRow.codigo}</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Cancelar documento</p>
              <p>O documento permanece no sistema, com status <strong>CANCELADO</strong>, preservando rastreabilidade e histórico.</p>
              <button
                className="mt-3 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => cancelDocument(targetRow)}
                disabled={actionInFlight !== null}
              >
                {actionInFlight === 'cancel' ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="font-medium">Excluir documento</p>
              <p>Exclusão definitiva do documento e de suas versões relacionadas. Use apenas quando realmente necessário.</p>
              <button
                className="mt-3 rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 font-medium text-rose-900 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => deleteDocument(targetRow)}
                disabled={actionInFlight !== null}
              >
                {actionInFlight === 'delete' ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
            <div className="flex justify-end">
              <button className="rounded border px-3 py-2" onClick={() => setTargetRow(null)} disabled={actionInFlight !== null}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
       {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl space-y-3 rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Cadastrar documento</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <input
                  className={`w-full rounded border px-3 py-2 ${codeValidation.status === 'duplicate' ? 'border-red-500' : 'border-slate-300'}`}
                  placeholder="Código"
                  value={createForm.code}
                  onChange={(e) => {
                    setCreateError(null)
                    setCreateForm((v) => ({ ...v, code: e.target.value }))
                  }}
                />
                {codeValidation.message ? (
                  <p className={`mt-1 text-xs ${codeValidation.status === 'duplicate' || codeValidation.status === 'error' ? 'text-red-600' : codeValidation.status === 'available' ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {codeValidation.message}
                  </p>
                ) : null}
              </div>
              <input className="rounded border px-3 py-2" placeholder="Título" value={createForm.title} onChange={(e) => setCreateForm((v) => ({ ...v, title: e.target.value }))} />
              <select className="rounded border px-3 py-2" value={createForm.documentTypeId} onChange={(e) => setCreateForm((v) => ({ ...v, documentTypeId: e.target.value }))}>
                <option value="">Tipo de documento</option>
                {meta.documentTypes.map((option) => <option key={option.id} value={option.id}>{option.description}</option>)}
              </select>
              <select className="rounded border px-3 py-2" value={createForm.ownerDepartmentId} onChange={(e) => setCreateForm((v) => ({ ...v, ownerDepartmentId: e.target.value }))}>
                <option value="">Centro responsável</option>
                {meta.departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <select className="rounded border px-3 py-2" value={createForm.authorUserId} onChange={(e) => setCreateForm((v) => ({ ...v, authorUserId: e.target.value }))}>
                <option value="">Elaborador/Revisor (auto)</option>
                {meta.authors.map((option) => <option key={option.id} value={option.id}>{option.fullName}</option>)}
              </select>
                <input className="rounded border px-3 py-2" placeholder="Revisão inicial (opcional)" value={createForm.revisionNumber} onChange={(e) => setCreateForm((v) => ({ ...v, revisionNumber: e.target.value.replace(/[^0-9]/g, '') }))} />
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="rounded border px-3 py-2" onChange={(e) => setCreateForm((v) => ({ ...v, file: e.target.files?.[0] ?? null }))} />
            </div>
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
            <div className="flex justify-end gap-2">
              <button className="rounded border px-3 py-2" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="rounded bg-orange-500 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={creating || codeValidation.status === 'duplicate' || codeValidation.status === 'checking'} onClick={createDocument}>{creating ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {term ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-xl space-y-3 rounded-lg bg-white p-6">
            <h2 className="text-lg font-semibold">{term.title}</h2>
            <p className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{term.content}</p>
            <p className="text-sm text-slate-600">Ao aceitar, você confirma ciência das responsabilidades para acesso ao documento.</p>
            <div className="flex justify-end gap-2">
              <button className="rounded border px-3 py-2" onClick={() => {
                setTerm(null)
                setPendingAction(null)
                alert('Sem aceitar o termo de responsabilidade não é possível executar ações no documento.')
              }}
              >
                Não aceito
              </button>
              <button className="rounded bg-emerald-700 px-3 py-2 text-white" onClick={acceptTerm}>Aceito</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}