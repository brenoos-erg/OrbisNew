'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Combobox } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/24/solid'

/* ------------------------------------------------------------
   TIPOS
------------------------------------------------------------ */

type CentroCusto = { id: string; nome: string }
type Departamento = { id: string; nome: string }

type TipoCampo = 'text' | 'textarea' | 'select' | 'number' | 'date' | 'file'

type CampoEspecifico = {
  name: string
  label: string
  type: TipoCampo
  required?: boolean
  options?: string[]
}

type TipoSolicitacao = {
  id: string
  nome: string
  descricao?: string
  camposEspecificos?: CampoEspecifico[]
  schemaJson?: { campos?: CampoEspecifico[] } | null
}

type Position = {
  id: string
  name: string
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
  experience?: string | null
  workPoint?: string | null
  site?: string | null
}

type MeMini = {
  id?: string
  fullName?: string
  email?: string
  login?: string
  phone?: string | null
  costCenter?: {
    id: string
    code: string | null
    description: string
  } | null
}

type SolicitanteForm = {
  fullName: string
  email: string
  login: string
  phone: string
  costCenterText: string
}

/* ------------------------------------------------------------
   ESTILOS
------------------------------------------------------------ */

const LABEL =
  'block text-xs font-semibold text-black uppercase tracking-wide'
const INPUT =
  'mt-1 w-full rounded-md border border-blue-500/70 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150'

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

/* ------------------------------------------------------------
   COMPONENTE PRINCIPAL
------------------------------------------------------------ */

export default function NovaSolicitacaoPage() {
  const router = useRouter()

  /* ------------------ ESTADOS PRINCIPAIS ------------------ */

  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [tipos, setTipos] = useState<TipoSolicitacao[]>([])
  const [positions, setPositions] = useState<Position[]>([])

  const [cargoId, setCargoId] = useState('')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [queryCC, setQueryCC] = useState('')

  const [extras, setExtras] = useState<Record<string, any>>({})
  const [filesByField, setFilesByField] = useState<Record<string, FileList | null>>({})

  const [me, setMe] = useState<MeMini | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)

  const [solicitante, setSolicitante] = useState<SolicitanteForm>({
    fullName: '',
    email: '',
    login: '',
    phone: '',
    costCenterText: '',
  })

  /* ------------------------------------------------------------
     MEMO
  ------------------------------------------------------------ */

  const tipoSelecionado = useMemo(
    () => tipos.find((t) => t.id === tipoId),
    [tipos, tipoId],
  )

  const camposEspecificos: CampoEspecifico[] = useMemo(() => {
    if (!tipoSelecionado) return []
    if (tipoSelecionado.camposEspecificos?.length)
      return tipoSelecionado.camposEspecificos
    if (tipoSelecionado.schemaJson?.campos?.length)
      return tipoSelecionado.schemaJson.campos
    return []
  }, [tipoSelecionado])

  const centrosFiltrados = useMemo(
    () =>
      queryCC.trim() === ''
        ? centros
        : centros.filter((c) =>
            c.nome.toLowerCase().includes(queryCC.toLowerCase()),
          ),
    [queryCC, centros],
  )

  /* ------------------------------------------------------------
     CARREGAR CENTROS + DEPTOS
  ------------------------------------------------------------ */

  useEffect(() => {
    async function loadBase() {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/cost-centers/select', { cache: 'no-store' }),
          fetch('/api/departments/select', { cache: 'no-store' }),
        ])

        const centrosRaw = await cRes.json()
        const depsRaw = await dRes.json()

        setCentros(
          centrosRaw.map((c: any) => ({
            id: c.id,
            nome: c.code ? `${c.code} - ${c.description}` : c.description,
          })),
        )

        setDepartamentos(
          depsRaw.map((d: any) => ({
            id: d.id,
            nome: d.label,
          })),
        )
      } catch (e) {
        console.error('Erro ao carregar centros/departamentos', e)
      }
    }

    loadBase()
  }, [])

  /* ------------------------------------------------------------
     CARREGAR TIPOS
  ------------------------------------------------------------ */

  useEffect(() => {
    setTipoId('')
    setExtras({})
    setFilesByField({})
    setCargoId('')

    if (!centroCustoId || !departamentoId) {
      setTipos([])
      return
    }

    async function loadTipos() {
      try {
        const url = `/api/tipos-solicitacao?centroCustoId=${centroCustoId}&departamentoId=${departamentoId}`
        const res = await fetch(url)
        const json = await res.json()
        setTipos(json)
      } catch (e) {
        console.error('Erro ao carregar tipos', e)
      }
    }

    loadTipos()
  }, [centroCustoId, departamentoId])

  /* ------------------------------------------------------------
     CARREGAR CARGOS
  ------------------------------------------------------------ */

  useEffect(() => {
    async function loadPositions() {
      try {
        const res = await fetch('/api/positions')
        if (!res.ok) return
        const data = await res.json()
        setPositions(data)
      } catch (e) {
        console.error('Erro ao carregar cargos', e)
      }
    }

    if (tipoSelecionado?.nome === 'RQ_063 - Solicitação de Pessoal') {
      loadPositions()
    } else {
      setPositions([])
      setCargoId('')
    }
  }, [tipoSelecionado])

  /* ------------------------------------------------------------
     CARREGAR ME
  ------------------------------------------------------------ */

  useEffect(() => {
    async function loadMe() {
      try {
        setLoadingMe(true)
        const r = await fetch('/api/me', { cache: 'no-store' })

        if (r.ok) {
          const data = await r.json()
          setMe(data)

          setSolicitante({
            fullName: data.fullName || '',
            email: data.email || '',
            login: data.login || '',
            phone: data.phone || '',
            costCenterText: data.costCenter
              ? data.costCenter.code
                ? `${data.costCenter.code} - ${data.costCenter.description}`
                : data.costCenter.description
              : '',
          })
        } else setMe(null)
      } catch (e) {
        console.error('Erro ao carregar /api/me', e)
      } finally {
        setLoadingMe(false)
      }
    }

    loadMe()
  }, [])

  /* ------------------------------------------------------------
     AUTOPREENCHER CAMPOS DO CARGO
  ------------------------------------------------------------ */

  function handleCargoChange(id: string) {
    setCargoId(id)
    const pos = positions.find(p => p.id === id)
    if (!pos) return

    setExtras(prev => ({
      ...prev,
      cargo: pos.name,

      setorOuProjeto: pos.sectorProject ?? prev.setorOuProjeto,
      localTrabalho: pos.workplace ?? prev.localTrabalho,
      horarioTrabalho: pos.workSchedule ?? prev.horarioTrabalho,

      principaisAtividades: pos.mainActivities ?? prev.principaisAtividades,
      atividadesComplementares: pos.complementaryActivities ?? prev.atividadesComplementares,

      escolaridade: pos.schooling ?? prev.escolaridade,
      curso: pos.course ?? prev.curso,
      escolaridadeCompleta: pos.schoolingCompleted ?? prev.escolaridadeCompleta,
      cursoEmAndamento: pos.courseInProgress ?? prev.cursoEmAndamento,

      periodoModulo: pos.periodModule ?? prev.periodoModulo,
      requisitosConhecimentos: pos.requiredKnowledge ?? prev.requisitosConhecimentos,
      competenciasComportamentais: pos.behavioralCompetencies ?? prev.competenciasComportamentais,

      experiencia: pos.experience ?? prev.experiencia,
      pontoTrabalho: pos.workPoint ?? prev.pontoTrabalho,
      projetosLocal: pos.site ?? prev.projetosLocal,
    }))
  }

  /* ------------------------------------------------------------
     SUBMIT
  ------------------------------------------------------------ */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!centroCustoId || !departamentoId || !tipoId) {
      alert('Preencha centro de custo, departamento e tipo.')
      return
    }

    if (!me?.id) {
      alert('Falha ao identificar o solicitante.')
      return
    }

    try {
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoId,
          costCenterId: centroCustoId,
          departmentId: departamentoId,
          solicitanteId: me.id,
          payload: { campos: extras, solicitante },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao registrar solicitação.')
      }

      const created = await res.json()

      // Upload de anexos
      const formData = new FormData()
      for (const [_, list] of Object.entries(filesByField)) {
        if (!list) continue
        for (const f of Array.from(list)) formData.append('files', f)
      }

      if ([...formData.keys()].length > 0) {
        await fetch(`/api/solicitacoes/${created.id}/anexos`, {
          method: 'POST',
          body: formData,
        })
      }

      router.push('/dashboard/solicitacoes/enviadas')
    } catch (e: any) {
      alert(e.message)
    }
  }

  /* ------------------------------------------------------------
     RENDER
  ------------------------------------------------------------ */

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Nova Solicitação
      </h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LADO ESQUERDO */}
        <div className="lg:col-span-7 space-y-5">

          {/* CENTRO DE CUSTO */}
          <div>
            <label className={LABEL}>Centro de Custo</label>

            <Combobox
              value={centroCustoId}
              onChange={(value: any) => setCentroCustoId(value)}
            >
              <div className="relative mt-1">
                <Combobox.Input
                  className={`${INPUT} pr-10`}
                  displayValue={(id: string) => centros.find(c => c.id === id)?.nome || ''}
                  onChange={(e) => setQueryCC(e.target.value)}
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronUpDownIcon className="h-5 w-5 text-slate-400" />
                </Combobox.Button>

                <Combobox.Options className="absolute z-50 mt-1 max-h-60 w-full bg-white border shadow-lg">
                  {centrosFiltrados.map((c) => (
                    <Combobox.Option
                      key={c.id}
                      value={c.id}
                      className="px-4 py-2 cursor-pointer hover:bg-blue-600 hover:text-white"
                    >
                      {c.nome}
                    </Combobox.Option>
                  ))}
                </Combobox.Options>
              </div>
            </Combobox>
          </div>

          {/* DEPARTAMENTO */}
          <div>
            <label className={LABEL}>Departamento</label>
            <select
              className={INPUT}
              value={departamentoId}
              onChange={(e) => setDepartamentoId(e.target.value)}
              disabled={!centroCustoId}
            >
              <option value="">Selecione...</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>

          {/* TIPOS */}
          <div>
            <label className={LABEL}>Tipo de Solicitação</label>

            <select
              className={INPUT}
              value={tipoId}
              onChange={(e) => {
                setTipoId(e.target.value)
                setExtras({})
                setCargoId('')
              }}
              disabled={!departamentoId}
            >
              <option value="">Selecione...</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LADO DIREITO */}
        <div className="lg:col-span-5">

          {/* CARD DO SOLICITANTE */}
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-2">Dados do Solicitante</h3>

            {loadingMe ? (
              <p>Carregando...</p>
            ) : (
              <div className="space-y-3">
                <input className={INPUT} value={solicitante.fullName} />
                <input className={INPUT} value={solicitante.email} />
                <input className={INPUT} value={solicitante.login} />
                <input className={INPUT} value={solicitante.phone} />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => router.push('/dashboard/solicitacoes/enviadas')}
              className="px-4 py-2 border rounded"
            >
              Cancelar
            </button>
            <button className="px-4 py-2 bg-orange-600 text-white rounded">
              Enviar Solicitação
            </button>
          </div>
        </div>

        {/* CAMPOS ESPECÍFICOS */}
        {tipoSelecionado && camposEspecificos.length > 0 && (
          <div className="lg:col-span-12 border bg-slate-50 p-4 rounded">
            <h4 className="text-xs uppercase font-semibold text-slate-500">
              Formulário do tipo de solicitação
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              {camposEspecificos.map((campo) => (
                <div key={campo.name}>
                  <label className={LABEL}>
                    {campo.label}
                    {campo.required && <span className="text-red-500">*</span>}
                  </label>

                  {/* Campo de CARGO */}
                  {campo.name === 'cargo' ? (
                    <select
                      className={INPUT}
                      value={cargoId}
                      onChange={(e) => handleCargoChange(e.target.value)}
                    >
                      <option value="">Selecione o cargo...</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : campo.type === 'textarea' ? (
                    <textarea
                      className={cx(INPUT, 'min-h-[80px]')}
                      onChange={(e) =>
                        setExtras(prev => ({ ...prev, [campo.name]: e.target.value }))
                      }
                    />
                  ) : campo.type === 'select' && campo.options ? (
                    <select
                      className={INPUT}
                      onChange={(e) =>
                        setExtras(prev => ({ ...prev, [campo.name]: e.target.value }))
                      }
                    >
                      <option value="">Selecione...</option>
                      {campo.options.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : campo.type === 'file' ? (
                    <input
                      type="file"
                      className={INPUT}
                      multiple
                      onChange={(e) =>
                        setFilesByField(prev => ({ ...prev, [campo.name]: e.target.files }))
                      }
                    />
                  ) : (
                    <input
                      className={INPUT}
                      type={campo.type === 'date' ? 'date' : 'text'}
                      onChange={(e) =>
                        setExtras(prev => ({ ...prev, [campo.name]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </form>
    </div>
  )
}
