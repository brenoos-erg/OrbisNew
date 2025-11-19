'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Combobox } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/24/solid'

/** ------------------ Tipos auxiliares ------------------ */

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
  camposEspecificos: CampoEspecifico[]
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

/** ------------------ estilos reutilizáveis ------------------ */

const LABEL =
  'block text-xs font-semibold text-black uppercase tracking-wide'
const INPUT =
  'mt-1 w-full rounded-md border border-blue-500/70 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150'

const cx = (...c: (string | false | undefined)[]) =>
  c.filter(Boolean).join(' ')

/** ------------------ Componente principal ------------------ */

export default function NovaSolicitacaoPage() {
  const router = useRouter()

  // ESQUERDA – combos principais
  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [tipos, setTipos] = useState<TipoSolicitacao[]>([])

  const [centroCustoId, setCentroCustoId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [tipoId, setTipoId] = useState('')

  // Busca digitada no combobox de centro de custo
  const [queryCC, setQueryCC] = useState('')

  // campos específicos (valores) + arquivos
  const [extras, setExtras] = useState<Record<string, any>>({})
  const [filesByField, setFilesByField] = useState<
    Record<string, FileList | null>
  >({})

  // DIREITA – dados do solicitante
  const [me, setMe] = useState<MeMini | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)
  const [solicitante, setSolicitante] = useState<SolicitanteForm>({
    fullName: '',
    email: '',
    login: '',
    phone: '',
    costCenterText: '',
  })

  const tipoSelecionado = useMemo(
    () => tipos.find((t) => t.id === tipoId),
    [tipos, tipoId],
  )

  const centrosFiltrados = useMemo(
    () =>
      queryCC.trim() === ''
        ? centros
        : centros.filter((c) =>
            c.nome.toLowerCase().includes(queryCC.toLowerCase()),
          ),
    [queryCC, centros],
  )

  /** ------------------ carregar centros + departamentos ------------------ */

  useEffect(() => {
    async function loadBase() {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/cost-centers/select', { cache: 'no-store' }),
          fetch('/api/departments/select', { cache: 'no-store' }),
        ])

        const centrosRaw: {
          id: string
          description: string
          code: string | null
          externalCode: string | null
        }[] = await cRes.json()

        const depsRaw: {
          id: string
          label: string
          description: string | null
        }[] = await dRes.json()

        const centrosMap: CentroCusto[] = centrosRaw.map((c) => ({
          id: c.id,
          nome: c.code ? `${c.code} - ${c.description}` : c.description,
        }))

        const depsMap: Departamento[] = depsRaw.map((d) => ({
          id: d.id,
          nome: d.label,
        }))

        setCentros(centrosMap)
        setDepartamentos(depsMap)
      } catch (e) {
        console.error('Erro ao carregar centros / departamentos', e)
      }
    }

    loadBase()
  }, [])

  /** ------------------ carregar tipos conforme centro + depto ------------------ */

  useEffect(() => {
    setTipoId('')
    setExtras({})
    setFilesByField({})

    if (!centroCustoId || !departamentoId) {
      setTipos([])
      return
    }

    async function loadTipos() {
      try {
        const url = `/api/tipos-solicitacao?centroCustoId=${encodeURIComponent(
          centroCustoId,
        )}&departamentoId=${encodeURIComponent(departamentoId)}`
        const res = await fetch(url)
        const json: TipoSolicitacao[] = await res.json()
        setTipos(json)
      } catch (e) {
        console.error('Erro ao carregar tipos de solicitação', e)
      }
    }

    loadTipos()
  }, [centroCustoId, departamentoId])

  /** ------------------ carregar dados do solicitante ------------------ */

  useEffect(() => {
    async function loadMe() {
      try {
        setLoadingMe(true)
        const r = await fetch('/api/me', { cache: 'no-store' })

        if (r.ok) {
          const data: MeMini = await r.json()
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
        } else {
          setMe(null)
        }
      } catch (e) {
        console.error('Erro ao carregar /api/me', e)
        setMe(null)
      } finally {
        setLoadingMe(false)
      }
    }

    loadMe()
  }, [])

  /** ------------------ helpers de campos específicos ------------------ */

  function handleExtraChange(name: string, value: any) {
    setExtras((prev) => ({ ...prev, [name]: value }))
  }

  function handleFileChange(name: string, files: FileList | null) {
    setFilesByField((prev) => ({ ...prev, [name]: files }))

    if (files && files.length > 0) {
      const nomes = Array.from(files)
        .map((f) => f.name)
        .join(', ')
      setExtras((prev) => ({ ...prev, [name]: nomes }))
    } else {
      setExtras((prev) => {
        const clone = { ...prev }
        delete clone[name]
        return clone
      })
    }
  }

  /** ------------------ submissão ------------------ */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!centroCustoId || !departamentoId || !tipoId) {
      alert('Preencha centro de custo, departamento e tipo de solicitação.')
      return
    }

    if (!me?.id) {
      alert('Não foi possível identificar o solicitante. Faça login novamente.')
      return
    }

    try {
      // 1) Cria a solicitação
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoId: tipoId,
          costCenterId: centroCustoId,
          departmentId: departamentoId,
          solicitanteId: me.id,
          payload: {
            campos: extras,
            solicitante,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao registrar a solicitação.')
      }

      const created = (await res.json()) as { id: string }

      // 2) Envia anexos (se houver)
      const formData = new FormData()
      Object.entries(filesByField).forEach(([_, fileList]) => {
        if (!fileList) return
        Array.from(fileList).forEach((file) => {
          formData.append('files', file)
        })
      })

      if ([...formData.keys()].length > 0) {
        const uploadRes = await fetch(
          `/api/solicitacoes/${created.id}/anexos`,
          {
            method: 'POST',
            body: formData,
          },
        )

        if (!uploadRes.ok) {
          console.error('Falha ao enviar anexos')
        }
      }

      // 3) Redireciona para a lista
      router.push('/dashboard/solicitacoes/enviadas')
    } catch (e: any) {
      alert(e.message || 'Erro ao registrar a solicitação.')
    }
  }

  /** ------------------ UI ------------------ */

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-sm text-slate-500 mb-1">Sistema de Solicitações</div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Nova Solicitação
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* ESQUERDA – centro de custo, depto, tipo */}
        <div className="lg:col-span-7 space-y-5">
          {/* Centro de Custo (Combobox) */}
          <div>
            <label className={LABEL}>Centro de Custo</label>

            <Combobox
              value={centroCustoId}
              onChange={(value: any) => setCentroCustoId(value as string)}
            >
              <div className="relative mt-1">
                <Combobox.Input
                  className={`${INPUT} pr-10`}
                  placeholder="Digite ou selecione o centro de custo"
                  displayValue={(id: any) => {
                    const item = centros.find((c) => c.id === id)
                    return item ? item.nome : ''
                  }}
                  onChange={(e) => setQueryCC(e.target.value)}
                />

                {/* 🔽 setinha do dropdown */}
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-slate-400"
                    aria-hidden="true"
                  />
                </Combobox.Button>

                <Combobox.Options
                  className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-lg border border-slate-200"
                >
                  {centrosFiltrados.length === 0 ? (
                    <div className="cursor-default select-none px-4 py-2 text-slate-500">
                      Nenhum centro de custo encontrado.
                    </div>
                  ) : (
                    centrosFiltrados.map((c) => (
                      <Combobox.Option
                        key={c.id}
                        value={c.id}
                        className={({ active }: { active: boolean }) =>
                          `cursor-pointer select-none px-4 py-2 ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-900'
                          }`
                        }
                      >
                        {c.nome}
                      </Combobox.Option>
                    ))
                  )}
                </Combobox.Options>
              </div>
            </Combobox>
          </div>

          {/* Departamento */}
          <div>
            <label className={LABEL}>Departamento</label>
            <select
              className={INPUT}
              value={departamentoId}
              onChange={(e) => setDepartamentoId(e.target.value)}
              required
              disabled={!centroCustoId}
            >
              <option value="">
                {!centroCustoId
                  ? 'Escolha antes o centro de custo'
                  : 'Selecione o departamento'}
              </option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de solicitação */}
          <div>
            <label className={LABEL}>Tipo de Solicitação</label>
            <select
              className={INPUT}
              value={tipoId}
              onChange={(e) => {
                setTipoId(e.target.value)
                setExtras({})
                setFilesByField({})
              }}
              required
              disabled={!centroCustoId || !departamentoId}
            >
              <option value="">
                {!centroCustoId || !departamentoId
                  ? 'Informe centro de custo e departamento primeiro'
                  : tipos.length === 0
                  ? 'Nenhum tipo disponível para essa combinação'
                  : 'Selecione o tipo de solicitação'}
              </option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            {tipoSelecionado?.descricao && (
              <p className="mt-1 text-[11px] text-slate-500">
                {tipoSelecionado.descricao}
              </p>
            )}
          </div>
        </div>

        {/* DIREITA – card do solicitante + botões */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white/70 p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold">Dados do Solicitante</div>
              <p className="text-[11px] text-slate-500">
                Essas informações serão usadas para contato sobre a solicitação.
                Você pode ajustá-las se o chamado for para outra pessoa.
              </p>
            </div>

            {loadingMe && (
              <p className="text-xs text-slate-500">Carregando dados...</p>
            )}

            {!loadingMe && !me && (
              <p className="text-xs text-red-600">
                Não foi possível carregar seus dados. Verifique se está logado.
              </p>
            )}

            {!loadingMe && (
              <div className="space-y-3 text-sm">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nome completo
                  </label>
                  <input
                    className={INPUT}
                    value={solicitante.fullName}
                    onChange={(e) =>
                      setSolicitante((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Email & Login */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      E-mail
                    </label>
                    <input
                      className={INPUT}
                      type="email"
                      value={solicitante.email}
                      onChange={(e) =>
                        setSolicitante((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Login
                    </label>
                    <input
                      className={INPUT}
                      value={solicitante.login}
                      onChange={(e) =>
                        setSolicitante((prev) => ({
                          ...prev,
                          login: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Telefone & Centro de Custo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Telefone
                    </label>
                    <input
                      className={INPUT}
                      value={solicitante.phone}
                      onChange={(e) =>
                        setSolicitante((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Centro de Custo
                    </label>
                    <input
                      className={INPUT}
                      value={solicitante.costCenterText}
                      onChange={(e) =>
                        setSolicitante((prev) => ({
                          ...prev,
                          costCenterText: e.target.value,
                        }))
                      }
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Texto apenas informativo. O vínculo real é o centro de
                      custo selecionado à esquerda.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard/solicitacoes/enviadas')}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
            >
              Enviar Solicitação
            </button>
          </div>
        </div>

        {/* LINHA DE BAIXO – campos específicos */}
        {tipoSelecionado && tipoSelecionado.camposEspecificos.length > 0 && (
          <div className="lg:col-span-12 col-span-1 rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Formulário do tipo de solicitação
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tipoSelecionado.camposEspecificos.map((campo) => (
                <div key={campo.name} className="space-y-1">
                  <label
                    htmlFor={campo.name}
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {campo.label}
                    {campo.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>

                  {campo.type === 'textarea' ? (
                    <textarea
                      id={campo.name}
                      className={cx(INPUT, 'min-h-[90px] resize-y')}
                      onChange={(e) =>
                        handleExtraChange(campo.name, e.target.value)
                      }
                    />
                  ) : campo.type === 'select' && campo.options ? (
                    <select
                      id={campo.name}
                      className={INPUT}
                      onChange={(e) =>
                        handleExtraChange(campo.name, e.target.value)
                      }
                    >
                      <option value="">Selecione...</option>
                      {campo.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : campo.type === 'file' ? (
                    <input
                      id={campo.name}
                      type="file"
                      className={INPUT}
                      multiple
                      onChange={(e) =>
                        handleFileChange(campo.name, e.target.files)
                      }
                    />
                  ) : (
                    <input
                      id={campo.name}
                      type={
                        campo.type === 'number'
                          ? 'number'
                          : campo.type === 'date'
                          ? 'date'
                          : 'text'
                      }
                      className={INPUT}
                      onChange={(e) =>
                        handleExtraChange(campo.name, e.target.value)
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
