// src/app/dashboard/solicitacoes/enviadas/nova/page.tsx
'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  complementaryActivities: string | null;
  schooling: string | null;
  course: string | null;
  schoolingCompleted: string | null;
  courseInProgress: string | null;
  periodModule: string | null;
  requiredKnowledge: string | null;
  behavioralCompetencies: string | null;
  workPoint: string | null;
  site: string | null;
  experience: string | null;
};

type Extras = Record<string, string>;

/* ================================================================
   COMPONENTE PRINCIPAL
================================================================ */

export default function NovaSolicitacaoPage() {
  const router = useRouter();

  // controle de envio
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
   2) /api/cost-centers e /api/departments
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
    [tipos, tipoId],
  );

  const isRQ063 =
    selectedTipo &&
    (selectedTipo.id.toUpperCase() === 'RQ_063' ||
      selectedTipo.nome.toUpperCase().includes('RQ_063'));

  /* ============================================================
   4) /api/positions
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

  const handleCheckboxChange = (name: string, checked: boolean) => {
    handleExtraChange(name, checked ? 'true' : 'false');
  };

  const handleCargoChange = (id: string) => {
    setCargoId(id);
    const position = positions.find((p) => p.id === id);
    if (!position) return;

    setExtras((prev) => ({
      ...prev,
      cargoNome: position.name ?? '',
      setorProjeto: position.sectorProject ?? '',
      localTrabalho: position.workplace ?? '',
      horarioTrabalho: position.workSchedule ?? '',
      principaisAtividades: position.mainActivities ?? '',
      atividadesComplementares: position.complementaryActivities ?? '',
      escolaridade: position.schooling ?? '',
      curso: position.course ?? '',
      escolaridadeCompleta: position.schoolingCompleted ?? '',
      cursoEmAndamento: position.courseInProgress ?? '',
      periodoModulo: position.periodModule ?? '',
      requisitosConhecimentos: position.requiredKnowledge ?? '',
      competenciasComportamentais: position.behavioralCompetencies ?? '',
      pontoTrabalho: position.workPoint ?? '',
      local: position.site ?? '',
      experienciaMinima: position.experience ?? '',
    }));
  };

  /* ============================================================
   6) SUBMIT
  ============================================================ */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!me?.id) {
      setSubmitError('Não foi possível identificar o solicitante (usuário logado).');
      return;
    }

    // validação básica extra
    if (!centroId || !departamentoId || !tipoId) {
      setSubmitError(
        'Preencha Centro de Custo, Departamento e Tipo de Solicitação.'
      );
      return;
    }

    if (isRQ063 && !cargoId) {
      setSubmitError('Selecione o cargo para continuar.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      // --------- MONTA payload.solicitante ---------
      const payloadSolicitante = {
        fullName: me.fullName,
        email: me.email,
        login: me.login,
        phone: me.phone ?? '',
        costCenterText: me.costCenterName ?? '',
      };

      // --------- MONTA payload.campos (RQ_063) ---------
      const payloadCampos: Record<string, any> = {
        ...extras,

        // garante campos que o backend usa pra aprovação
        vagaPrevistaContrato: extras.vagaPrevista ?? '',
        vagaPrevista: extras.vagaPrevista ?? '',

        // infos auxiliares
        cargo: extras.cargoNome ?? '',
        centroCustoId: centroId,
        departmentId: departamentoId,
        positionId: cargoId || null,
      };

      const body = {
        // quem abriu
        solicitanteId: me.id,

        // destino
        costCenterId: centroId,
        departmentId: departamentoId,

        // tipo
        tipoId,

        // tudo que é “conteúdo” da solicitação
        payload: {
          solicitante: payloadSolicitante,
          campos: payloadCampos,
        },
      };

      const res = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = 'Falha ao registrar a solicitação.';
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          // ignore parse error
        }
        throw new Error(msg);
      }

      const data = await res.json();
      console.log('Solicitação criada:', data);

      router.push('/dashboard/solicitacoes/enviadas');
    } catch (err: any) {
      console.error('Erro ao enviar solicitação', err);
      setSubmitError(err?.message ?? 'Erro ao enviar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
   RENDER
  ============================================================ */
  return (
    <main className="p-8">
      <form
        id="form-solicitacao"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">Nova Solicitação</h1>

          <button
            type="submit"
            className="bg-orange-500 text-white rounded px-4 py-2 text-sm shadow-md disabled:opacity-60"
            disabled={submitting || !tipoId}
          >
            {submitting ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>

        {submitError && (
          <p className="text-sm text-red-600 mb-2">{submitError}</p>
        )}

        {/* TOPO: CABEÇALHO + SOLICITANTE */}
        <div className="grid grid-cols-[2fr_minmax(320px,1fr)] gap-8 items-start mb-4">
          {/* ESQUERDA – Centro / Depto / Tipo */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                CENTRO DE CUSTO <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={centroId}
                onChange={(e) => setCentroId(e.target.value)}
                required
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

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                DEPARTAMENTO <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={departamentoId}
                onChange={(e) => setDepartamentoId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                TIPO DE SOLICITAÇÃO <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={tipoId}
                onChange={(e) => setTipoId(e.target.value)}
                disabled={!centroId || !departamentoId}
                required
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

          {/* DIREITA – Dados do Solicitante */}
          <aside className="border rounded-lg p-4 bg-white shadow-sm">
            <h2 className="text-sm font-semibold mb-3">
              Dados do Solicitante
            </h2>

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
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
          {!selectedTipo && (
            <p className="text-xs text-gray-500">
              Selecione um tipo de solicitação para exibir os campos
              específicos.
            </p>
          )}

          {selectedTipo && isRQ063 && (
            <>
              <h2 className="text-sm font-semibold mb-4">
                {selectedTipo.nome}
              </h2>

              {/* =================== INFORMAÇÕES BÁSICAS =================== */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Informações básicas
                </h3>

                {/* Cargo */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Cargo <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={cargoId}
                    onChange={(e) => handleCargoChange(e.target.value)}
                    required
                  >
                    <option value="">Selecione o cargo...</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Setor/Projeto */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Setor e/ou Projeto{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.setorProjeto ?? ''}
                      onChange={(e) =>
                        handleExtraChange('setorProjeto', e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Vaga prevista em contrato */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Vaga prevista em contrato?{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-4 text-xs mt-1">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="vagaPrevista"
                          checked={extras.vagaPrevista === 'SIM'}
                          onChange={() =>
                            handleExtraChange('vagaPrevista', 'SIM')
                          }
                          required
                        />
                        <span>Sim</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="vagaPrevista"
                          checked={extras.vagaPrevista === 'NAO'}
                          onChange={() =>
                            handleExtraChange('vagaPrevista', 'NAO')
                          }
                        />
                        <span>Não</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Local de trabalho */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Local de Trabalho{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.localTrabalho ?? ''}
                      onChange={(e) =>
                        handleExtraChange('localTrabalho', e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Centro de Custo (texto livre – pode repetir o do topo) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Centro de Custo{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={
                        extras.centroCustoForm ?? me?.costCenterName ?? ''
                      }
                      onChange={(e) =>
                        handleExtraChange('centroCustoForm', e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Horário de trabalho */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Horário de Trabalho{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.horarioTrabalho ?? ''}
                      onChange={(e) =>
                        handleExtraChange('horarioTrabalho', e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* Chefia imediata */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Chefia Imediata{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.chefiaImediata ?? ''}
                      onChange={(e) =>
                        handleExtraChange('chefiaImediata', e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {/* Coordenador do Contrato */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Coordenador do Contrato{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={extras.coordenadorContrato ?? ''}
                    onChange={(e) =>
                      handleExtraChange(
                        'coordenadorContrato',
                        e.target.value,
                      )
                    }
                    required
                  />
                </div>
              </section>

              {/* =================== MOTIVO DA VAGA =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Motivo da Vaga
                </h3>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.motivoSubstituicao === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'motivoSubstituicao',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Substituição</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.motivoAumentoQuadro === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'motivoAumentoQuadro',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Aumento de quadro</span>
                  </label>
                </div>
              </section>

              {/* =================== CONTRATAÇÃO =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Contratação
                </h3>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.contratacaoTemporaria === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'contratacaoTemporaria',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Temporária</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.contratacaoPermanente === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'contratacaoPermanente',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Permanente</span>
                  </label>
                </div>

                {/* Justificativa */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Justificativa da Vaga{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={extras.justificativaVaga ?? ''}
                    onChange={(e) =>
                      handleExtraChange('justificativaVaga', e.target.value)
                    }
                    required
                  />
                </div>
              </section>

              {/* =================== ATIVIDADES =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Atividades
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Principais atividades{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                    value={extras.principaisAtividades ?? ''}
                    onChange={(e) =>
                      handleExtraChange(
                        'principaisAtividades',
                        e.target.value,
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Atividades complementares
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={extras.atividadesComplementares ?? ''}
                    onChange={(e) =>
                      handleExtraChange(
                        'atividadesComplementares',
                        e.target.value,
                      )
                    }
                  />
                </div>
              </section>

              {/* =================== REQUISITOS ACADÊMICOS =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Requisitos acadêmicos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Escolaridade <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.escolaridade ?? ''}
                      onChange={(e) =>
                        handleExtraChange('escolaridade', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Curso
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.curso ?? ''}
                      onChange={(e) =>
                        handleExtraChange('curso', e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.escolaridadeCompleta === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'escolaridadeCompleta',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Completo</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.cursoEmAndamento === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'cursoEmAndamento',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Em andamento</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Período/Módulo - mínimo ou máximo
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={extras.periodoModulo ?? ''}
                    onChange={(e) =>
                      handleExtraChange('periodoModulo', e.target.value)
                    }
                  />
                </div>
              </section>

              {/* =================== REQUISITOS / COMPETÊNCIAS =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Requisitos e conhecimentos
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Requisitos e conhecimentos necessários{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={extras.requisitosConhecimentos ?? ''}
                    onChange={(e) =>
                      handleExtraChange(
                        'requisitosConhecimentos',
                        e.target.value,
                      )
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Competências comportamentais exigidas{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={extras.competenciasComportamentais ?? ''}
                    onChange={(e) =>
                      handleExtraChange(
                        'competenciasComportamentais',
                        e.target.value,
                      )
                    }
                    required
                  />
                </div>
              </section>

              {/* =================== SOLICITAÇÕES PARA O NOVO FUNCIONÁRIO =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Solicitações para o novo funcionário
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={extras.solicitacaoCracha === 'true'}
                        onChange={(e) =>
                          handleCheckboxChange(
                            'solicitacaoCracha',
                            e.target.checked,
                          )
                        }
                      />
                      <span>Crachá</span>
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={extras.solicitacaoRepublica === 'true'}
                        onChange={(e) =>
                          handleCheckboxChange(
                            'solicitacaoRepublica',
                            e.target.checked,
                          )
                        }
                      />
                      <span>República</span>
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={extras.solicitacaoUniforme === 'true'}
                        onChange={(e) =>
                          handleCheckboxChange(
                            'solicitacaoUniforme',
                            e.target.checked,
                          )
                        }
                      />
                      <span>Uniforme</span>
                    </label>

                    <div>
                      <span className="block text-[11px] font-semibold text-gray-600">
                        Outros
                      </span>
                      <input
                        className="mt-1 w-full border rounded px-3 py-2 text-sm"
                        value={extras.solicitacaoOutros ?? ''}
                        onChange={(e) =>
                          handleExtraChange(
                            'solicitacaoOutros',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={extras.solicitacaoTesteDirecao === 'true'}
                        onChange={(e) =>
                          handleCheckboxChange(
                            'solicitacaoTesteDirecao',
                            e.target.checked,
                          )
                        }
                      />
                      <span>Teste direção</span>
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={extras.solicitacaoEpis === 'true'}
                        onChange={(e) =>
                          handleCheckboxChange(
                            'solicitacaoEpis',
                            e.target.checked,
                          )
                        }
                      />
                      <span>EPIs</span>
                    </label>

                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={extras.solicitacaoPostoTrabalho === 'true'}
                        onChange={(e) =>
                          handleCheckboxChange(
                            'solicitacaoPostoTrabalho',
                            e.target.checked,
                          )
                        }
                      />
                      <span>Ponto / Posto de trabalho</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* =================== ESCRITÓRIO DE PROJETOS =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Preenchimento do setor Escritório de Projetos
                </h3>

                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.escritorioMatriz === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'escritorioMatriz',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Matriz</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={extras.escritorioFilial === 'true'}
                      onChange={(e) =>
                        handleCheckboxChange(
                          'escritorioFilial',
                          e.target.checked,
                        )
                      }
                    />
                    <span>Filial</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Previsto em contrato (Salários, Benefícios, Carga Horária e
                    outros)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={extras.previstoContrato ?? ''}
                    onChange={(e) =>
                      handleExtraChange('previstoContrato', e.target.value)
                    }
                  />
                </div>
              </section>

              {/* =================== RH =================== */}
              <section className="space-y-2 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Preenchimento do setor Recursos Humanos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Nome do Profissional
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.nomeProfissional ?? ''}
                      onChange={(e) =>
                        handleExtraChange(
                          'nomeProfissional',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Data de Admissão
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={extras.dataAdmissao ?? ''}
                      onChange={(e) =>
                        handleExtraChange('dataAdmissao', e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Observações
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={extras.observacoesRh ?? ''}
                    onChange={(e) =>
                      handleExtraChange('observacoesRh', e.target.value)
                    }
                  />
                </div>
              </section>
            </>
          )}

          {selectedTipo && !isRQ063 && (
            <p className="text-xs text-gray-500">
              Tipo selecionado ainda não tem formulário específico
              implementado ({selectedTipo.nome}).
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
