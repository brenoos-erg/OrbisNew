'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type CentroCusto = { id: string; nome: string }
type Departamento = { id: string; nome: string }

type TipoCampo =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'

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

const LABEL =
  'block text-xs font-semibold text-black uppercase tracking-wide'
const INPUT =
  'mt-1 w-full rounded-md border border-blue-500/70 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150'

const cx = (...c: (string | false | undefined)[]) =>
  c.filter(Boolean).join(' ')

export default function NovaSolicitacaoPage() {
  const router = useRouter()

  // ------------------ estados principais (esquerda) ------------------ //
  const [centros, setCentros] = useState<CentroCusto[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [tipos, setTipos] = useState<TipoSolicitacao[]>([])

  const [centroCustoId, setCentroCustoId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [tipoId, setTipoId] = useState('')

  // campos específicos do tipo
  const [extras, setExtras] = useState<Record<string, any>>({})

  const tipoSelecionado = useMemo(
    () => tipos.find((t) => t.id === tipoId),
    [tipos, tipoId],
  )

  // ------------------ carregar combos básicos ------------------ //
  useEffect(() => {
    async function loadBase() {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/centros-custo'),
          fetch('/api/departamentos'),
        ])

        const centrosJson: CentroCusto[] = await cRes.json()
        const depsJson: Departamento[] = await dRes.json()

        setCentros(centrosJson)
        setDepartamentos(depsJson)
      } catch (e) {
        console.error('Erro ao carregar centros / departamentos', e)
      }
    }

    loadBase()
  }, [])

  // ------------------ carregar tipos conforme centro + depto ------------------ //
  useEffect(() => {
    // sempre que mudar centro ou departamento:
    setTipoId('')
    setExtras({})

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

  // ------------------ submissão ------------------ //

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!centroCustoId || !departamentoId || !tipoId) {
      alert('Preencha centro de custo, departamento e tipo de solicitação.')
      return
    }

    // aqui você junta com os dados do solicitante (da direita)
    // e envia para sua API de criação de solicitação
    try {
      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centroCustoId,
          departamentoId,
          tipoSolicitacaoId: tipoId,
          campos: extras, // campos específicos preenchidos
          // TODO: adicionar dadosDoSolicitante aqui
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Erro ao criar solicitação')
      }

      router.push('/dashboard/solicitacoes/enviadas')
    } catch (e: any) {
      alert(e.message || 'Falha ao salvar solicitação')
    }
  }

  // alteração de um campo específico
  function handleExtraChange(name: string, value: any) {
    setExtras((prev) => ({ ...prev, [name]: value }))
  }

  // ------------------ UI ------------------ //

  return (
    <div className="max-w-6xl mx-auto">
      {/* título e breadcrumb simples */}
      <div className="text-sm text-slate-500 mb-1">Sistema de Solicitações</div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Nova Solicitação
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* ESQUERDA – só os 3 campos + específicos do tipo */}
        <div className="lg:col-span-7 space-y-5">
          {/* Centro de custo */}
          <div>
            <label className={LABEL}>Centro de Custo</label>
            <select
              className={INPUT}
              value={centroCustoId}
              onChange={(e) => setCentroCustoId(e.target.value)}
              required
            >
              <option value="">Selecione o centro de custo</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
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

          {/* Campos específicos do tipo escolhido */}
          {tipoSelecionado && tipoSelecionado.camposEspecificos.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Dados específicos para este tipo de solicitação
              </p>

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
                  ) : (
                    <input
                      id={campo.name}
                      type={
                        campo.type === 'number' ? 'number' :
                        campo.type === 'date'   ? 'date'   :
                        'text'
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
          )}
        </div>

        {/* DIREITA – MANTÉM SEU CARD DE DADOS DO SOLICITANTE */}
        <div className="lg:col-span-5 space-y-4">
          {/* Aqui você coloca exatamente o mesmo componente/card que já usa hoje */}
          {/* Exemplo genérico: */}
          <div className="rounded-lg border border-slate-200 bg-white/70 p-4">
            <div className="text-sm font-semibold mb-2">
              Dados do Solicitante
            </div>
            {/* TODO: substituir por seus inputs / dados já existentes */}
            <p className="text-xs text-slate-500">
              (Use aqui o mesmo card de &quot;Dados do Solicitante&quot; que
              você já tem.)
            </p>
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
      </form>
    </div>
  )
}
