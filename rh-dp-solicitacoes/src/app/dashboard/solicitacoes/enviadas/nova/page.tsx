'use client';

import { useEffect, useMemo, useState } from 'react';

/* ================================================================
   TYPES
================================================================ */

type UserMe = {
  id: string;
  fullName: string;
  email: string;
  login: string;
  phone: string | null;

  positionId: string | null;
  positionName: string | null;

  departmentId: string | null;
  departmentName: string | null;

  costCenterId: string | null;
  costCenterName: string | null;

  leaderId: string | null;
  leaderName: string | null;
};

type CostCenter = {
  id: string;
  code: string | null;
  description: string;
};

type Department = {
  id: string;
  name: string;
};

type TipoSolicitacao = {
  id: string;
  nome: string;
  descricao: string | null;
};

type Position = {
  id: string;
  name: string;
  sectorProject: string | null;
  workplace: string | null;
  workSchedule: string | null;
  mainActivities: string | null;
};

type Extras = Record<string, string>;

/* ================================================================
   COMPONENTE PRINCIPAL
================================================================ */

export default function NovaSolicitacaoPage() {
  /* -----------------------------------------
     DADOS DO SOLICITANTE
  ------------------------------------------ */
  const [me, setMe] = useState<UserMe | null>(null);

  /* -----------------------------------------
     CABEÇALHO
  ------------------------------------------ */
  const [centros, setCentros] = useState<CostCenter[]>([]);
  const [departamentos, setDepartamentos] = useState<Department[]>([]);
  const [tipos, setTipos] = useState<TipoSolicitacao[]>([]);

  const [centroId, setCentroId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [tipoId, setTipoId] = useState('');

  /* -----------------------------------------
     RQ063 – CARGOS
  ------------------------------------------ */
  const [positions, setPositions] = useState<Position[]>([]);
  const [cargoId, setCargoId] = useState('');
  const [extras, setExtras] = useState<Extras>({});

  /* ================================================================
     1. BUSCAR ME /api/me
  ================================================================= */
  useEffect(() => {
    async function loadMe() {
      const res = await fetch('/api/me');
      const data = await res.json();
      setMe(data);
    }

    loadMe();
  }, []);

  /* ================================================================
     2. CARREGAR CENTRO E DEPARTAMENTO
  ================================================================= */
  useEffect(() => {
    async function loadCC() {
      const res = await fetch('/api/cost-centers');
      setCentros(await res.json());
    }

    async function loadDept() {
      const res = await fetch('/api/departments');
      setDepartamentos(await res.json());
    }

    loadCC();
    loadDept();
  }, []);

  /* ================================================================
     3. BUSCAR TIPOS DE SOLICITAÇÃO FILTRADOS (CC + DEPTO)
  ================================================================= */
  useEffect(() => {
    if (!centroId || !departamentoId) {
      setTipos([]);
      return;
    }

    async function loadTypes() {
      const qs = new URLSearchParams({
        costCenterId: centroId,
        departmentId: departamentoId,
      });

      const res = await fetch(`/api/solicitation-types?${qs}`);
      setTipos(await res.json());
    }

    loadTypes();
  }, [centroId, departamentoId]);

  const selectedTipo = useMemo(
    () => tipos.find((t) => t.id === tipoId) ?? null,
    [tipos, tipoId]
  );

  /* ================================================================
     4. BUSCAR CARGOS
  ================================================================= */
  useEffect(() => {
    async function loadPositions() {
      const res = await fetch('/api/positions');
      setPositions(await res.json());
    }

    loadPositions();
  }, []);

  /* ================================================================
     5. AO MUDAR CARGO → AUTOPREENCHER CAMPOS
  ================================================================= */
  const handleCargoChange = (id: string) => {
    setCargoId(id);
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    setExtras({
      setorProjeto: pos.sectorProject ?? '',
      localTrabalho: pos.workplace ?? '',
      horarioTrabalho: pos.workSchedule ?? '',
      principaisAtividades: pos.mainActivities ?? '',
    });
  };

  /* ================================================================
     6. ENVIAR SOLICITAÇÃO
  ================================================================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      solicitanteId: me?.id,
      costCenterId: centroId,
      departmentId: departamentoId,
      tipoId,
      positionId: cargoId,
      extras,
    };

    console.log('Salvar solicitação', body);
  };

  /* ================================================================
     RENDER
  ================================================================= */
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Nova Solicitação</h1>

      {/* TOPO */}
      <div className="grid grid-cols-[2fr_minmax(320px,1fr)] gap-8 mb-8">

        {/* ESQUERDA */}
        <div className="space-y-4">

          {/* CENTRO DE CUSTO */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              CENTRO DE CUSTO
            </label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={centroId}
              onChange={(e) => setCentroId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} - ` : ''}{c.description}
                </option>
              ))}
            </select>
          </div>

          {/* DEPARTAMENTO */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              DEPARTAMENTO
            </label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={departamentoId}
              onChange={(e) => setDepartamentoId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* TIPO DE SOLICITAÇÃO */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              TIPO DE SOLICITAÇÃO
            </label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
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

        {/* DIREITA – CARD SOLICITANTE */}
        <aside className="border rounded-lg p-4 bg-white shadow-sm space-y-2">
          <h2 className="text-sm font-semibold">Dados do Solicitante</h2>

          {me && (
            <>
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.fullName} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.email} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.login} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.positionName ?? ''} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.departmentName ?? ''} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.leaderName ?? ''} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.phone ?? ''} readOnly />
              <input className="w-full border rounded px-3 py-2 text-sm" value={me.costCenterName ?? ''} readOnly />
            </>
          )}
        </aside>
      </div>

      {/* FORMULÁRIO ESPECÍFICO */}
      <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-white shadow-sm space-y-4">

        {!selectedTipo && (
          <p className="text-xs text-gray-500">
            Selecione um tipo de solicitação para exibir os campos.
          </p>
        )}

        {selectedTipo?.nome === 'RQ_063 - Solicitação de Pessoal' && (
          <>
            <h2 className="text-sm font-semibold">RQ_063 – Solicitação de Pessoal</h2>

            {/* CARGO */}
            <div>
              <label className="text-xs font-semibold">Cargo</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={cargoId}
                onChange={(e) => handleCargoChange(e.target.value)}
              >
                <option value="">Selecione...</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* SETOR / PROJETO */}
            <div>
              <label className="text-xs font-semibold">Setor / Projeto</label>
              <input className="w-full border rounded px-3 py-2 text-sm"
                     value={extras.setorProjeto ?? ''}
                     readOnly />
            </div>

            {/* LOCAL */}
            <div>
              <label className="text-xs font-semibold">Local de Trabalho</label>
              <input className="w-full border rounded px-3 py-2 text-sm"
                     value={extras.localTrabalho ?? ''}
                     readOnly />
            </div>

            {/* HORÁRIO */}
            <div>
              <label className="text-xs font-semibold">Horário de Trabalho</label>
              <input className="w-full border rounded px-3 py-2 text-sm"
                     value={extras.horarioTrabalho ?? ''}
                     readOnly />
            </div>

            {/* ATIVIDADES */}
            <div>
              <label className="text-xs font-semibold">Principais Atividades</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[100px]"
                value={extras.principaisAtividades ?? ''}
                readOnly
              />
            </div>

            <button className="bg-orange-500 text-white px-4 py-2 rounded">
              Enviar Solicitação
            </button>
          </>
        )}
      </form>
    </main>
  );
}
