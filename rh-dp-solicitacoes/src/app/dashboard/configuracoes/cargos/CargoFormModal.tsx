'use client'

import * as React from 'react'


const INPUT =
  'mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

export type Position = {
  id?: string
  name: string
  description?: string | null
  departmentId?: string | null

  sectorProject?: string | null
  workplace?: string | null
  workSchedule?: string | null
  mainActivities?: string | null
  complementaryActivities?: string | null
  schooling?: string | null
  course?: string | null
  schoolingCompleted?: string | null
  courseInProgress?: string | null
  periodModule?: string | null
  requiredKnowledge?: string | null
  behavioralCompetencies?: string | null
  enxoval?: string | null
  uniform?: string | null
  others?: string | null
  workPoint?: string | null
  site?: string | null
  experience?: string | null
  indexador?: string | null
  revision?: string | null
  documentDate?: string | null
  managerPosition?: string | null
  framing?: string | null
  areaSector?: string | null
  cbo?: string | null
  summary?: string | null
  detailedDescription?: string | null
  necessaryKnowledge?: string | null
  desiredKnowledge?: string | null
  humanCompetencies?: string | null
  functionalCompetencies?: string | null
  otherCompetencies?: string | null
  complexity?: string | null
  managementScope?: string | null
  confidentialDataAccess?: string | null
  responsibilities?: string | null
  active?: boolean
  latestDocument?: { id: string; originalFilename: string; fileUrl: string } | null
}
export type PositionRow = Position & { id: string }

/**
 * Modal de criação/edição do cargo
 */
export function CargoFormModal({
  row,
  onClose,
  onSaved,
}: {
  row?: PositionRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!row?.id
  const [name, setName] = React.useState(row?.name ?? '')
  const [description, setDescription] = React.useState(row?.description ?? '')
  const [sectorProject, setSectorProject] = React.useState(row?.sectorProject ?? '',)
  const [workplace, setWorkplace] = React.useState(row?.workplace ?? '')
  const [workSchedule, setWorkSchedule] = React.useState(row?.workSchedule ?? '',)
  const [experience, setExperience] = React.useState(row?.experience ?? '')
  const [mainActivities, setMainActivities] = React.useState(row?.mainActivities ?? '',)
  const [complementaryActivities, setComplementaryActivities] = React.useState(row?.complementaryActivities ?? '',)
  const [schooling, setSchooling] = React.useState(row?.schooling ?? '')
  const [course, setCourse] = React.useState(row?.course ?? '')
  const [schoolingCompleted, setSchoolingCompleted] = React.useState(row?.schoolingCompleted ?? '',)
  const [courseInProgress, setCourseInProgress] = React.useState(row?.courseInProgress ?? '',)
  const [periodModule, setPeriodModule] = React.useState(row?.periodModule ?? '',)
  const [requiredKnowledge, setRequiredKnowledge] = React.useState(row?.requiredKnowledge ?? '',)
  const [behavioralCompetencies, setBehavioralCompetencies] = React.useState(row?.behavioralCompetencies ?? '',)
  const [workPoint, setWorkPoint] = React.useState(row?.workPoint ?? '')
  const [site, setSite] = React.useState(row?.site ?? '')
  const [indexador, setIndexador] = React.useState(row?.indexador ?? '')
  const [revision, setRevision] = React.useState(row?.revision ?? '')
  const [documentDate, setDocumentDate] = React.useState(row?.documentDate ? String(row.documentDate).slice(0, 10) : '')
  const [managerPosition, setManagerPosition] = React.useState(row?.managerPosition ?? '')
  const [framing, setFraming] = React.useState(row?.framing ?? '')
  const [areaSector, setAreaSector] = React.useState(row?.areaSector ?? '')
  const [cbo, setCbo] = React.useState(row?.cbo ?? '')
  const [summary, setSummary] = React.useState(row?.summary ?? '')
  const [detailedDescription, setDetailedDescription] = React.useState(row?.detailedDescription ?? '')
  const [necessaryKnowledge, setNecessaryKnowledge] = React.useState(row?.necessaryKnowledge ?? '')
  const [desiredKnowledge, setDesiredKnowledge] = React.useState(row?.desiredKnowledge ?? '')
  const [humanCompetencies, setHumanCompetencies] = React.useState(row?.humanCompetencies ?? '')
  const [functionalCompetencies, setFunctionalCompetencies] = React.useState(row?.functionalCompetencies ?? '')
  const [otherCompetencies, setOtherCompetencies] = React.useState(row?.otherCompetencies ?? '')
  const [complexity, setComplexity] = React.useState(row?.complexity ?? '')
  const [managementScope, setManagementScope] = React.useState(row?.managementScope ?? '')
  const [confidentialDataAccess, setConfidentialDataAccess] = React.useState(row?.confidentialDataAccess ?? '')
  const [responsibilities, setResponsibilities] = React.useState(row?.responsibilities ?? '')
  const [currentDocument, setCurrentDocument] = React.useState(row?.latestDocument ?? null)
  const [pendingDocument, setPendingDocument] = React.useState<{ tempFileToken: string; originalFilename: string; mimeType?: string | null; sizeBytes?: number | null; parsedText?: string | null; extracted?: Record<string, unknown> } | null>(null)
  const [uploadingDocument, setUploadingDocument] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  


  function applyExtracted(extracted: Partial<Position>) {
    if (extracted.name) setName(extracted.name)
    if (extracted.description) setDescription(extracted.description)
    if (extracted.sectorProject) setSectorProject(extracted.sectorProject)
    if (extracted.mainActivities) setMainActivities(extracted.mainActivities)
    if (extracted.schooling) setSchooling(extracted.schooling)
    if (extracted.experience) setExperience(extracted.experience)
    if (extracted.requiredKnowledge) setRequiredKnowledge(extracted.requiredKnowledge)
    if (extracted.behavioralCompetencies) setBehavioralCompetencies(extracted.behavioralCompetencies)
    if (extracted.indexador) setIndexador(extracted.indexador)
    if (extracted.revision) setRevision(extracted.revision)
    if (extracted.documentDate) setDocumentDate(String(extracted.documentDate).slice(0, 10))
    if (extracted.managerPosition) setManagerPosition(extracted.managerPosition)
    if (extracted.framing) setFraming(extracted.framing)
    if (extracted.areaSector) setAreaSector(extracted.areaSector)
    if (extracted.cbo) setCbo(extracted.cbo)
    if (extracted.summary) setSummary(extracted.summary)
    if (extracted.detailedDescription) setDetailedDescription(extracted.detailedDescription)
    if (extracted.necessaryKnowledge) setNecessaryKnowledge(extracted.necessaryKnowledge)
    if (extracted.desiredKnowledge) setDesiredKnowledge(extracted.desiredKnowledge)
    if (extracted.humanCompetencies) setHumanCompetencies(extracted.humanCompetencies)
    if (extracted.functionalCompetencies) setFunctionalCompetencies(extracted.functionalCompetencies)
    if (extracted.otherCompetencies) setOtherCompetencies(extracted.otherCompetencies)
    if (extracted.complexity) setComplexity(extracted.complexity)
    if (extracted.managementScope) setManagementScope(extracted.managementScope)
    if (extracted.confidentialDataAccess) setConfidentialDataAccess(extracted.confidentialDataAccess)
    if (extracted.responsibilities) setResponsibilities(extracted.responsibilities)
  }

  async function handleDocumentUpload(file: File | null) {
    if (!file) return
    setUploadingDocument(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch('/api/positions/document-preview', { method: 'POST', body: form })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { alert(json?.error || 'Falha ao importar documento.'); return }
      setPendingDocument({
        tempFileToken: json.tempFileToken,
        originalFilename: json.originalFilename,
        mimeType: json.mimeType,
        sizeBytes: json.sizeBytes,
        parsedText: json.parsedText,
        extracted: json.extracted ?? {},
      })
      applyExtracted(json.extracted ?? {})
    } finally {
      setUploadingDocument(false)
    }
  }


  async function handleSave() {
    if (!name.trim()) {
      alert('Nome do cargo é obrigatório.')
      return
    }
    setSaving(true)
    try {
      const payload: Position = {
        name,
        description,
        sectorProject,
        workplace,
        workSchedule,
        mainActivities,
        complementaryActivities,
        schooling,
        course,
        schoolingCompleted,
        courseInProgress,
        periodModule,
        requiredKnowledge,
        behavioralCompetencies,
        experience,
        workPoint,
        site,
        indexador,
        revision,
        documentDate,
        managerPosition,
        framing,
        areaSector,
        cbo,
        summary,
        detailedDescription,
        necessaryKnowledge,
        desiredKnowledge,
        humanCompetencies,
        functionalCompetencies,
        otherCompetencies,
        complexity,
        managementScope,
        confidentialDataAccess,
        responsibilities,
        tempFileToken: pendingDocument?.tempFileToken,
        documentOriginalFilename: pendingDocument?.originalFilename,
        documentMimeType: pendingDocument?.mimeType,
        documentSizeBytes: pendingDocument?.sizeBytes,
        parsedText: pendingDocument?.parsedText,
        extractedDocument: pendingDocument?.extracted,
      } as Position & Record<string, unknown>

      const url = row?.id ? `/api/positions/${row.id}` : '/api/positions'
      const method = row?.id ? 'PATCH' : 'POST'

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err?.error || 'Falha ao salvar cargo.')
        return
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-5xl rounded-2xl bg-[var(--card)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar cargo' : 'Novo cargo'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[var(--table-row-hover)]"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50/60 p-4 text-sm text-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Documento oficial do cargo</p>
              <p className="text-xs">{pendingDocument?.originalFilename ? `${pendingDocument.originalFilename} (prévia pendente de salvar)` : currentDocument?.originalFilename ?? 'Nenhum documento anexado.'}</p>
              {(indexador || revision || documentDate) && <p className="mt-1 text-xs">Indexador: {indexador || '—'} • Revisão: {revision || '—'} • Data: {documentDate || '—'}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {currentDocument?.id && row?.id && <a className="rounded-md border px-3 py-2 text-xs font-semibold" href={`/api/positions/${row.id}/documents/${currentDocument.id}/download`} target="_blank">Baixar documento</a>}
              <label className="cursor-pointer rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white">
                {uploadingDocument ? 'Importando...' : currentDocument ? 'Substituir documento' : 'Importar documento do cargo'}
                <input type="file" accept=".docx,.pdf,.doc" className="hidden" disabled={uploadingDocument} onChange={(event) => handleDocumentUpload(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Nome */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Nome do cargo *
            </label>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Descrição / resumo
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>


          <div><label className="block text-xs font-semibold uppercase">Indexador</label><input className={INPUT} value={indexador} onChange={(e) => setIndexador(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Revisão</label><input className={INPUT} value={revision} onChange={(e) => setRevision(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Data do documento</label><input type="date" className={INPUT} value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">CBO</label><input className={INPUT} value={cbo} onChange={(e) => setCbo(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Cargo do gestor imediato</label><input className={INPUT} value={managerPosition} onChange={(e) => setManagerPosition(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Enquadramento</label><input className={INPUT} value={framing} onChange={(e) => setFraming(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Área/Setor</label><input className={INPUT} value={areaSector} onChange={(e) => setAreaSector(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Complexidade</label><input className={INPUT} value={complexity} onChange={(e) => setComplexity(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Descrição sumária</label><textarea className={INPUT} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Descrição detalhada</label><textarea className={INPUT} rows={4} value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} /></div>

          {/* Linha 1 */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Setor / Projeto
            </label>
            <input
              className={INPUT}
              value={sectorProject || ''}
              onChange={(e) => setSectorProject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Local de trabalho
            </label>
            <input
              className={INPUT}
              value={workplace || ''}
              onChange={(e) => setWorkplace(e.target.value)}
            />
          </div>

          {/* Linha 2 */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Horário de trabalho
            </label>
            <input
              className={INPUT}
              value={workSchedule || ''}
              onChange={(e) => setWorkSchedule(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Experiência mínima
            </label>
            <input
              className={INPUT}
              value={experience || ''}
              onChange={(e) => setExperience(e.target.value)}
            />
          </div>

          {/* Principais atividades */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Principais atividades
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={mainActivities || ''}
              onChange={(e) => setMainActivities(e.target.value)}
            />
          </div>

          {/* Atividades complementares */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Atividades complementares
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={complementaryActivities || ''}
              onChange={(e) => setComplementaryActivities(e.target.value)}
            />
          </div>

          {/* Escolaridade / Curso */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Escolaridade
            </label>
            <input
              className={INPUT}
              value={schooling || ''}
              onChange={(e) => setSchooling(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Curso
            </label>
            <input
              className={INPUT}
              value={course || ''}
              onChange={(e) => setCourse(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Escolaridade completa?
            </label>
            <input
              className={INPUT}
              value={schoolingCompleted || ''}
              onChange={(e) => setSchoolingCompleted(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Curso em andamento?
            </label>
            <input
              className={INPUT}
              value={courseInProgress || ''}
              onChange={(e) => setCourseInProgress(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Período / Módulo - mínimo ou máximo
            </label>
            <input
              className={INPUT}
              value={periodModule || ''}
              onChange={(e) => setPeriodModule(e.target.value)}
            />
          </div>

          {/* Requisitos e competências */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Requisitos e conhecimentos necessários
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={requiredKnowledge || ''}
              onChange={(e) => setRequiredKnowledge(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Competências comportamentais exigidas
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={behavioralCompetencies || ''}
              onChange={(e) => setBehavioralCompetencies(e.target.value)}
            />
          </div>


          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Conhecimentos necessários</label><textarea className={INPUT} rows={3} value={necessaryKnowledge} onChange={(e) => setNecessaryKnowledge(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Conhecimentos desejáveis</label><textarea className={INPUT} rows={3} value={desiredKnowledge} onChange={(e) => setDesiredKnowledge(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Competências humanas</label><textarea className={INPUT} rows={3} value={humanCompetencies} onChange={(e) => setHumanCompetencies(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Competências funcionais</label><textarea className={INPUT} rows={3} value={functionalCompetencies} onChange={(e) => setFunctionalCompetencies(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Outros</label><textarea className={INPUT} rows={2} value={otherCompetencies} onChange={(e) => setOtherCompetencies(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Gestão</label><textarea className={INPUT} rows={3} value={managementScope} onChange={(e) => setManagementScope(e.target.value)} /></div>
          <div><label className="block text-xs font-semibold uppercase">Acesso a dados confidenciais</label><input className={INPUT} value={confidentialDataAccess} onChange={(e) => setConfidentialDataAccess(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold uppercase">Responsabilidades</label><textarea className={INPUT} rows={3} value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} /></div>

          {/* Local / ponto de trabalho */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Ponto de trabalho
            </label>
            <input
              className={INPUT}
              value={workPoint || ''}
              onChange={(e) => setWorkPoint(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Local (Matriz / Filial / etc.)
            </label>
            <input
              className={INPUT}
              value={site || ''}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>

          {/* Botões */}
          <div className="sm:col-span-2 mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Botão + modal (usado na listagem)
 */
export function CargoFormTrigger({ row }: { row?: PositionRow }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          row
            ? 'text-xs rounded-md border px-2 py-1 hover:bg-[var(--card-muted)]'
            : 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-950'
        }
      >
        {row ? 'Editar' : 'Novo cargo'}
      </button>
      {open && (
        <CargoFormModal
          row={row ?? null}
          onClose={() => setOpen(false)}
          onSaved={() => window.location.reload()}
        />
      )}
    </>
  )
}

/**
 * Botão de excluir (client)
 */
export function CargoDeleteButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este cargo?')) return
    await fetch(`/api/positions/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
    >
      Excluir
    </button>
  )
}
