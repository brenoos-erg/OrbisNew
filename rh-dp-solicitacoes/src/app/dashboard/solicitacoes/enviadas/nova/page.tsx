'use client';

import { useEffect, useMemo, useState } from 'react';

/* ================================================================
   TYPES
================================================================ */

type UserMe = {
  id: string;
  email: string;
  fullName: string;
  login: string;
  phone: string | null;
  positionName: string | null;
  departmentName: string | null;
  leaderName: string | null;
  costCenterName: string | null;
};

type CostCenter = {
  id: string;
  code: string | null;
  description: string;
};

type Departamento = {
  id: string;
  label: string;
  description: string;
};

type TipoSolicitacao = {
  id: string;
  nome: string;
  descricao?: string;
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
  // ---------- DADOS DO SOLICITANTE ----------
  const [me, setMe] = useState<UserMe | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  // ---------- CAMPOS DO CABEÇALHO ----------
  const [centros, setCentros] = useState<CostCenter[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tipos, setTipos] = useState<TipoSolicitacao[]>([]);

  const [centroId, setCentroId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [tipoId, setTipoId] = useState('');

  // ---------- RQ_063 / CARGOS ----------
  const [positions, setPositions] = useState<Position[]>([]);
  const [cargoId, setCargoId] = useState('');
  const [extras, setExtras] = useState<Extras>({});

  /* ============================================================
   1) /api/me
  ============================================================ */
  useEffect(() => {
    async function loadMe() {
      try {
        setMeLoading(true);
        setMeError(null);

        const res = await fetch('/api/me');
        if (!res.ok) {
          const text = await res.text();
          console.error('Erro /api/me:', text);
          throw new Error('Erro ao buscar dados do usuário.');
        }

        const data = (await res.json()) as UserMe;
        setMe(data);
      } catch (err: any) {
        console.error(err);
        setMeError(err.message ?? 'Erro ao carregar dados do usuário');
      } finally {
        setMeLoading(false);
      }
    }

    loadMe();
  }, []);

  /* ============================================================
   2) /api/cost-centers (items/total) e /api/departments (array)
  ============================================================ */
  useEffect(() => {
    async function loadCostCenters() {
      try {
        const res = await fetch('/api/cost-centers?pageSize=200');
        if (!res.ok) throw new Error('Erro ao buscar centros de custo');

        const json = await res.json();
        const items = (json?.items ?? []) as CostCenter[];
        setCentros(items);
      } catch (err) {
        console.error(err);
        setCentros([]);
      }
    }

    async function loadDepartments() {
      try {
        const res = await fetch('/api/departments');
        if (!res.ok) throw new Error('Erro ao buscar departamentos');

        const data = (await res.json()) as Departamento[];
        setDepartamentos(data);
      } catch (err) {
        console.error(err);
        setDepartamentos([]);
      }
    }

    loadCostCenters();
    loadDepartments();
  }, []);

  /* ============================================================
   3) /api/tipos-solicitacao?centroCustoId=&departamentoId=
  ============================================================ */
  useEffect(() => {
    if (!centroId || !departamentoId) {
      setTipos([]);
      setTipoId('');
      return;
    }

    async function loadTipos() {
      try {
        const params = new URLSearchParams({
          centroCustoId: centroId,
          departamentoId,
        });

        const res = await fetch(`/api/tipos-solicitacao?${params}`);
        if (!res.ok)
          throw new Error('Erro ao buscar tipos de solicitação');

        const data = (await res.json()) as TipoSolicitacao[];
        setTipos(data);
        setTipoId('');
      } catch (err) {
        console.error(err);
        setTipos([]);
      }
    }

    loadTipos();
  }, [centroId, departamentoId]);

  const selectedTipo = useMemo(
    () => tipos.find((t) => t.id === tipoId) ?? null,
    [tipos, tipoId]
  );

  const isRQ063 =
    selectedTipo &&
    (selectedTipo.id.toUpperCase() === 'RQ_063' ||
      selectedTipo.nome.toUpperCase().includes('RQ_063'));

  /* ============================================================
   4) /api/positions  (AQUI É ONDE AJUSTEI)
  ============================================================ */
  useEffect(() => {
    async function loadPositions() {
      try {
        const res = await fetch('/api/positions?pageSize=200');
        if (!res.ok) {
          const text = await res.text();
          console.error('Erro /api/positions:', text);
          throw new Error('Erro ao buscar cargos');
        }

        const json = await res.json();

        // se a API devolver { items: [...] }, pegamos items
        // se devolver array puro, usamos direto
        const items: Position[] = Array.isArray(json)
          ? json
          : (json.items ?? []);

        setPositions(items || []);
      } catch (err) {
        console.error(err);
        setPositions([]);
      }
    }

    loadPositions();
  }, []);

  /* ============================================================
   5) EXTRAS / RQ_063
  ============================================================ */
  const handleExtraChange = (name: string, value: string) => {
    setExtras((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCargoChange = (id: string) => {
    setCargoId(id);
    const position = positions.find((p) => p.id === id);
    if (!position) return;

    setExtras((prev) => ({
      ...prev,
      setorProjeto: position.sectorProject ?? '',
      localTrabalho: position.workplace ?? '',
      horarioTrabalho: position.workSchedule ?? '',
      principaisAtividades: position.mainActivities ?? '',
    }));
  };

  /* ============================================================
   6) SUBMIT
  ============================================================ */
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

    console.log('Enviando solicitação:', body);
    // aqui você faz o POST real se quiser
  };

  /* ============================================================
   RENDER
  ============================================================ */
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Nova Solicitação</h1>

      {/* TOPO: CABEÇALHO + CARD DADOS DO SOLICITANTE */}
      <div className="grid grid-cols-[2fr_minmax(320px,1fr)] gap-8 items-start mb-8">
        {/* ESQUERDA – Centro / Depto / Tipo */}
        <div className="space-y-4">
          {/* Centro de Custo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
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
                  {c.code ? `${c.code} - ` : ''}
                  {c.description}
                </option>
              ))}
            </select>
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
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
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Solicitação */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              TIPO DE SOLICITAÇÃO
            </label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              disabled={!centroId || !departamentoId}
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

        {/* DIREITA – CARD DADOS DO SOLICITANTE */}
        <aside className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Dados do Solicitante</h2>

          {meLoading && (
            <p className="text-xs text-gray-500">
              Carregando dados do solicitante...
            </p>
          )}

          {meError && (
            <p className="text-xs text-red-500 mb-2">{meError}</p>
          )}

          {me && (
            <div className="space-y-2">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Nome"
                value={me.fullName}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="E-mail"
                value={me.email}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Login"
                value={me.login}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Cargo"
                value={me.positionName ?? ''}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Setor"
                value={me.departmentName ?? ''}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Líder"
                value={me.leaderName ?? ''}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Telefone"
                value={me.phone ?? ''}
                readOnly
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Centro de Custo"
                value={me.costCenterName ?? ''}
                readOnly
              />
            </div>
          )}
        </aside>
      </div>

      {/* PARTE DE BAIXO – FORMULÁRIO DO TIPO SELECIONADO */}
      <form
        id="form-solicitacao"
        className="border rounded-lg p-4 bg-white shadow-sm space-y-4"
        onSubmit={handleSubmit}
      >
        {!selectedTipo && (
          <p className="text-xs text-gray-500">
            Selecione um tipo de solicitação para exibir os campos específicos.
          </p>
        )}

        {selectedTipo && isRQ063 && (
          <>
            <h2 className="text-sm font-semibold mb-2">
              {selectedTipo.nome}
            </h2>

            {/* CARGO */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Cargo
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
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
            </div>

            {/* SETOR / PROJETO */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Setor / Projeto
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={extras.setorProjeto ?? ''}
                onChange={(e) =>
                  handleExtraChange('setorProjeto', e.target.value)
                }
              />
            </div>

            {/* LOCAL */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Local de Trabalho
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={extras.localTrabalho ?? ''}
                onChange={(e) =>
                  handleExtraChange('localTrabalho', e.target.value)
                }
              />
            </div>

            {/* HORÁRIO */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Horário de Trabalho
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={extras.horarioTrabalho ?? ''}
                onChange={(e) =>
                  handleExtraChange('horarioTrabalho', e.target.value)
                }
              />
            </div>

            {/* PRINCIPAIS ATIVIDADES */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Principais atividades
              </label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[80px] resize-y"
                value={extras.principaisAtividades ?? ''}
                onChange={(e) =>
                  handleExtraChange(
                    'principaisAtividades',
                    e.target.value
                  )
                }
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-orange-500 text-white rounded px-4 py-2 text-sm"
              >
                Enviar Solicitação
              </button>
            </div>
          </>
        )}

        {selectedTipo && !isRQ063 && (
          <p className="text-xs text-gray-500">
            Tipo selecionado ainda não tem formulário específico
            implementado ({selectedTipo.nome}).
          </p>
        )}
      </form>
    </main>
  );
}
