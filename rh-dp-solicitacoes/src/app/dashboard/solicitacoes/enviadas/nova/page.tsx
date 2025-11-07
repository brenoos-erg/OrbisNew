'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Save, Send, PencilLine, Lock } from 'lucide-react'

type Setor = 'RH' | 'DP' | 'TI' | 'FINANCEIRO' | 'LOGISTICA' | 'QUALIDADE'

const LABEL_CLS = 'block text-xs font-semibold text-black uppercase tracking-wide'
const INPUT_CLS  = 'mt-1 w-full rounded-md border border-blue-500/70 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 text-[15px] py-2.5 bg-white shadow-sm transition-all duration-150'

export default function NovaSolicitacaoPage() {
  const router = useRouter()

  // ------- estados de solicitante (auto-preenchidos) -------
  const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')
  const [autorEditavel, setAutorEditavel] = useState(false)
  const [autorId, setAutorId] = useState('')
  const [autorNome, setAutorNome] = useState('')
  const [autorEmail, setAutorEmail] = useState('')
  const [autorLogin, setAutorLogin] = useState('')
  const [autorPhone, setAutorPhone] = useState('')
  const [autorCC, setAutorCC] = useState('') // centro de custo
  const disabledLook = !autorEditavel && 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200'

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/me')
        if (!r.ok) throw new Error('Falha ao obter usuário atual')
        const me = await r.json()
        setAutorId(me.id)
        setAutorNome(me.fullName || '')
        setAutorEmail(me.email || '')
        setAutorLogin(me.login || '')
        setAutorPhone(me.phone || '')
        setAutorCC(me.costCenter || '')
      } catch (e) {
        // sem usuário -> mantém editável para testar
        setAutorEditavel(true)
      }
    })()
  }, [])

  // ------- opções fixas (mesmas que você já tinha) -------
  const centros: { id: Setor; nome: string }[] = [
    { id: 'RH', nome: 'Recursos Humanos' },
    { id: 'DP', nome: 'Departamento Pessoal' },
    { id: 'TI', nome: 'Tecnologia da Informação' },
    { id: 'FINANCEIRO', nome: 'Financeiro' },
    { id: 'QUALIDADE', nome: 'Qualidade' },
    { id: 'LOGISTICA', nome: 'Logística' },
  ]

  const categorias = [
    { id: 'servicos_rh', nome: 'Serviços de RH' },
    { id: 'service_desk_ti', nome: 'Service Desk TI' },
    { id: 'servicos_logistica', nome: 'Serviços de Logística' },
    { id: 'servicos_dp', nome: 'Serviços de DP' },
    { id: 'servicos_qualidade', nome: 'Serviços da Qualidade' },
  ]

  const tipos = [
    { id: 'RQ001', nome: 'Elaboração/Alteração/Exclusão de Documentos', categoria: 'servicos_qualidade', setor: 'QUALIDADE' },
    { id: 'RQ043', nome: 'Requisição de EPI’s/Uniformes', categoria: 'servicos_logistica', setor: 'LOGISTICA' },
    { id: 'RQ063', nome: 'Solicitação de Pessoal (Recrutamento)', categoria: 'servicos_rh', setor: 'RH' },
    { id: 'RQ090', nome: 'Solicitação de Treinamento', categoria: 'servicos_rh', setor: 'RH' },
    { id: 'RQ106', nome: 'Abertura de Chamados TI', categoria: 'service_desk_ti', setor: 'TI' },
  ] as const

  // ----------------------- estado do formulário ----------------------------
  const [centro, setCentro] = useState<Setor | ''>('')
  const [categoria, setCategoria] = useState<string>('')
  const [tipoId, setTipoId] = useState<string>('')
  const [titulo, setTitulo] = useState<string>('')
  const [descricao, setDescricao] = useState<string>('')

  const tiposFiltrados = useMemo(() => {
    return tipos.filter(
      (t) => (!centro || t.setor === centro) && (!categoria || t.categoria === categoria)
    )
  }, [centro, categoria])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!centro || !tipoId) {
      alert('Escolha o Centro Responsável e a Descrição da Solicitação.')
      return
    }
    if (!autorId) {
      alert('Sem usuário. Preencha temporariamente o ID (ou corrija /api/me).')
      return
    }

    const res = await fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: titulo || tipos.find(t => t.id === tipoId)?.nome || 'Solicitação',
        descricao,
        setorDestino: centro,
        tipoId,
        autorId,
        payload: {
          autorNome, autorEmail, autorLogin, autorPhone, autorCC,
        },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Falha ao criar a solicitação')
      return
    }
    router.push('/dashboard/solicitacoes/enviadas')
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-slate-500">Sistema de Solicitações</div>
        <button onClick={() => history.back()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>
      </div>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Nova Solicitação</h1>
      <p className="text-sm text-slate-500 mb-6">Preencha os dados abaixo para registrar uma nova solicitação.</p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <label className={LABEL_CLS}>Centro Responsável</label>
            <select className={cx(INPUT_CLS, disabledLook)} value={centro} onChange={(e) => setCentro(e.target.value as Setor)} required>
              <option value="">Selecione uma opção</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>Categoria</label>
            <select className={cx(INPUT_CLS, disabledLook)} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Selecione uma opção</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>Descrição da Solicitação</label>
            <select className={cx(INPUT_CLS, disabledLook)} value={tipoId} onChange={(e) => setTipoId(e.target.value)} required>
              <option value="">Selecione uma opção</option>
              {tiposFiltrados.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.nome}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">Esta opção corresponde ao “tipo de solicitação”.</p>
          </div>

          <div>
            <label className={LABEL_CLS}>Título (opcional)</label>
            <input className={cx(INPUT_CLS, disabledLook)} placeholder="Um título curto para identificar a solicitação" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div>
            <label className={LABEL_CLS}>Descrição (opcional)</label>
            <textarea className={cx(INPUT_CLS, disabledLook)} rows={6} placeholder="Detalhe o que você precisa…" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>

        {/* COLUNA DIREITA – Dados do Solicitante (auto-preenchido + editar) */}
        <div className="lg:col-span-5 space-y-5">
  <div className="rounded-lg border border-slate-200 bg-white/60 p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm font-semibold text-slate-700">Dados do Solicitante</div>
      <button
        type="button"
        onClick={() => setAutorEditavel(v => !v)}
        className={cx(
          'inline-flex items-center gap-1 text-xs rounded-md px-2 py-1 border border-slate-300',
          autorEditavel ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'hover:bg-slate-50'
        )}
        title={autorEditavel ? 'Bloquear edição' : 'Editar dados'}
      >
        {autorEditavel ? <Lock size={14} /> : <PencilLine size={14} />}
        {autorEditavel ? 'Bloquear' : 'Editar'}
      </button>
    </div>

    <input type="hidden" value={autorId} />

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className={LABEL_CLS}>Nome</label>
        <input
          className={cx(INPUT_CLS, disabledLook)}
          value={autorNome}
          onChange={(e) => setAutorNome(e.target.value)}
          disabled={!autorEditavel}
        />
      </div>

      <div>
        <label className={LABEL_CLS}>E-mail</label>
        <input
          className={cx(INPUT_CLS, disabledLook)}
          value={autorEmail}
          onChange={(e) => setAutorEmail(e.target.value)}
          disabled={!autorEditavel}
        />
      </div>

      <div>
        <label className={LABEL_CLS}>Login</label>
        <input
          className={cx(INPUT_CLS, disabledLook)}
          value={autorLogin}
          onChange={(e) => setAutorLogin(e.target.value)}
          disabled={!autorEditavel}
        />
      </div>

      <div>
        <label className={LABEL_CLS}>Telefone</label>
        <input
          className={cx(INPUT_CLS, disabledLook)}
          value={autorPhone}
          onChange={(e) => setAutorPhone(e.target.value)}
          disabled={!autorEditavel}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL_CLS}>Centro de Custo</label>
        <input
          className={cx(INPUT_CLS, disabledLook)}
          value={autorCC}
          onChange={(e) => setAutorCC(e.target.value)}
          disabled={!autorEditavel}
        />
      </div>
    </div>

    <p className="mt-2 text-[11px] text-slate-500">
      Os dados vêm do seu cadastro. Clique em <b>Editar</b> para ajustar, depois <b>Bloquear</b> se quiser travar novamente.
    </p>
  </div>

  {/* botões já existentes */}
</div>
      </form>
    </div>
  )
}
