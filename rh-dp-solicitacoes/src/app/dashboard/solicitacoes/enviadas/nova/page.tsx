// src/app/dashboard/solicitacoes/enviadas/nova/page.tsx
'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
} from 'react';
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

type InputChange = ChangeEvent<HTMLInputElement>;
type SelectChange = ChangeEvent<HTMLSelectElement>;
type TextAreaChange = ChangeEvent<HTMLTextAreaElement>;

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
  const [abonoCampos, setAbonoCampos] = useState<Extras>({});

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
        if (!res.ok) throw new Error('Erro ao buscar tipos de solicitação');

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
    !!selectedTipo &&
    (selectedTipo.id.toUpperCase() === 'RQ_063' ||
      selectedTipo.nome.toUpperCase().includes('RQ_063'));

  const isAbonoEducacional =
    selectedTipo?.nome === 'Solicitação de Abono Educacional';

  useEffect(() => {
    if (!isAbonoEducacional) {
      setAbonoCampos({});
    }
  }, [isAbonoEducacional]);

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
   5) EXTRAS / RQ_063 / ABONO
  ============================================================ */
  const handleExtraChange = (name: string, value: string) => {
    setExtras((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAbonoChange = (name: string, value: string) => {
    setAbonoCampos((prev) => ({
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

    if (isRQ063 && !cargoId) {
      setSubmitError('Selecione o cargo para continuar.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      let campos: Record<string, string> = {};

      if (isRQ063) {
        const cargoSelecionado =
          positions.find((p) => p.id === cargoId)?.name ?? '';

        const motivoParts: string[] = [];
        if (extras.motivoSubstituicao === 'true')
          motivoParts.push('Substituição');
        if (extras.motivoAumentoQuadro === 'true')
          motivoParts.push('Aumento de quadro');

        const tipoContrParts: string[] = [];
        if (extras.contratacaoTemporaria === 'true')
          tipoContrParts.push('Temporária');
        if (extras.contratacaoPermanente === 'true')
          tipoContrParts.push('Permanente');

        const enxovalParts: string[] = [];
        if (extras.solicitacaoCracha === 'true') enxovalParts.push('Crachá');
        if (extras.solicitacaoRepublica === 'true')
          enxovalParts.push('República');
        if (extras.solicitacaoUniforme === 'true')
          enxovalParts.push('Uniforme');
        if (extras.solicitacaoTesteDirecao === 'true')
          enxovalParts.push('Teste direção');
        if (extras.solicitacaoEpis === 'true') enxovalParts.push('EPIs');
        if (extras.solicitacaoPostoTrabalho === 'true')
          enxovalParts.push('Ponto / Posto de trabalho');

        campos = {
          ...extras,
          cargo: cargoSelecionado,
          setorProjeto: extras.setorProjeto ?? '',
          localTrabalho: extras.localTrabalho ?? '',
          horarioTrabalho: extras.horarioTrabalho ?? '',
          vagaPrevistaContrato: extras.vagaPrevista ?? '',
          motivoVaga: motivoParts.join(' / '),
          tipoContratacao: tipoContrParts.join(' / '),
          principaisAtividades: extras.principaisAtividades ?? '',
          atividadesComplementares: extras.atividadesComplementares ?? '',
          escolaridade: extras.escolaridade ?? '',
          curso: extras.curso ?? '',
          periodoModulo: extras.periodoModulo ?? '',
          requisitosConhecimentos: extras.requisitosConhecimentos ?? '',
          competenciasComportamentais: extras.competenciasComportamentais ?? '',
          enxoval: enxovalParts.join(' / '),
          outros: extras.solicitacaoOutros ?? '',
          observacoes: extras.observacoesRh ?? '',
        };
      } else if (isAbonoEducacional) {
        const obrigatorios = [
          'nomeColaborador',
          'matricula',
          'cargo',
          'centroCusto',
          'email',
        ];

        const faltantes = obrigatorios.filter((k) => !abonoCampos[k]);
        if (faltantes.length > 0) {
          setSubmitError('Preencha os campos obrigatórios do formulário.');
          setSubmitting(false);
          return;
        }

        campos = { ...abonoCampos };
      } else {
        setSubmitError(
          'Este tipo de solicitação ainda não possui formulário configurado.',
        );
        setSubmitting(false);
        return;
      }

      const body = {
        solicitanteId: me?.id ?? null,
        costCenterId: centroId,
        departmentId: departamentoId,
        tipoId,
        campos,
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
          // ignore
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
                onChange={(e: SelectChange) => setCentroId(e.target.value)}
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
                onChange={(e: SelectChange) =>
                  setDepartamentoId(e.target.value)
                }
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
                onChange={(e: SelectChange) => setTipoId(e.target.value)}
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

          {/* =================== FORM RQ_063 =================== */}
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
                    onChange={(e: SelectChange) =>
                      handleCargoChange(e.target.value)
                    }
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                    onChange={(e: InputChange) =>
                      handleExtraChange('coordenadorContrato', e.target.value)
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                    onChange={(e: TextAreaChange) =>
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
                    onChange={(e: TextAreaChange) =>
                      handleExtraChange('principaisAtividades', e.target.value)
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
                    onChange={(e: TextAreaChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                    onChange={(e: InputChange) =>
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
                    onChange={(e: TextAreaChange) =>
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
                    onChange={(e: TextAreaChange) =>
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
                        onChange={(e: InputChange) =>
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
                        onChange={(e: InputChange) =>
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
                        onChange={(e: InputChange) =>
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
                        onChange={(e: InputChange) =>
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
                        onChange={(e: InputChange) =>
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
                        onChange={(e: InputChange) =>
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
                        onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                      onChange={(e: InputChange) =>
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
                    onChange={(e: TextAreaChange) =>
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
                      onChange={(e: InputChange) =>
                        handleExtraChange('nomeProfissional', e.target.value)
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
                      onChange={(e: InputChange) =>
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
                    onChange={(e: TextAreaChange) =>
                      handleExtraChange('observacoesRh', e.target.value)
                    }
                  />
                </div>
              </section>
            </>
          )}

          {/* =================== FORM ABONO EDUCACIONAL =================== */}
          {selectedTipo && isAbonoEducacional && (
            <>
              <h2 className="text-sm font-semibold mb-4">
                {selectedTipo.nome}
              </h2>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Dados do colaborador
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Nome do colaborador{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.nomeColaborador ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange(
                          'nomeColaborador',
                          e.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Matrícula <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.matricula ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('matricula', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Cargo <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.cargo ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('cargo', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Contato do setor
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.contatoSetor ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('contatoSetor', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Centro de custo{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.centroCusto ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('centroCusto', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      E-mail <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.email ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('email', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Empresa
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.empresa ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('empresa', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Local de trabalho
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.localTrabalho ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('localTrabalho', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Telefone
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.telefone ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('telefone', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      CBO
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.cbo ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('cbo', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Escolaridade
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.escolaridade ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('escolaridade', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Tipo de contratação
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.tipoContratacao ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('tipoContratacao', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Benefício
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.beneficio ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('beneficio', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Valor do benefício
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.valorBeneficio ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('valorBeneficio', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Nível
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.nivel ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('nivel', e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Observações do solicitante
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={abonoCampos.observacaoSolicitante ?? ''}
                    onChange={(e: TextAreaChange) =>
                      handleAbonoChange(
                        'observacaoSolicitante',
                        e.target.value,
                      )
                    }
                  />
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t">
                <h3 className="text-xs font-semibold text-gray-700 uppercase">
                  Requisitos de RH
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={abonoCampos.contratadaUmAno === 'true'}
                      onChange={(e: InputChange) =>
                        handleAbonoChange(
                          'contratadaUmAno',
                          e.target.checked ? 'true' : 'false',
                        )
                      }
                    />
                    <span>Contratada há, no mínimo, 01 ano</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={abonoCampos.ausenciaAdvertencias === 'true'}
                      onChange={(e: InputChange) =>
                        handleAbonoChange(
                          'ausenciaAdvertencias',
                          e.target.checked ? 'true' : 'false',
                        )
                      }
                    />
                    <span>Ausência de faltas, advertências disciplinares.</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={abonoCampos.cursosConcluidos === 'true'}
                      onChange={(e: InputChange) =>
                        handleAbonoChange(
                          'cursosConcluidos',
                          e.target.checked ? 'true' : 'false',
                        )
                      }
                    />
                    <span>
                      Cursos concluídos com notas/exercícios/provas
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Status
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.statusRh ?? ''}
                      onChange={(e: SelectChange) =>
                        handleAbonoChange('statusRh', e.target.value)
                      }
                    >
                      <option value="">Selecione...</option>
                      <option value="Deferido">Deferido</option>
                      <option value="Indeferido">Indeferido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Assistente Recursos Humanos
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      value={abonoCampos.assistenteRh ?? ''}
                      onChange={(e: InputChange) =>
                        handleAbonoChange('assistenteRh', e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Cálculo do abono (se mensal ou será pago)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={abonoCampos.calculoAbono ?? ''}
                    onChange={(e: TextAreaChange) =>
                      handleAbonoChange('calculoAbono', e.target.value)
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Observações
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
                    value={abonoCampos.observacoesRh ?? ''}
                    onChange={(e: TextAreaChange) =>
                      handleAbonoChange('observacoesRh', e.target.value)
                    }
                  />
                </div>
              </section>
            </>
          )}

          {/* =================== DEFAULT =================== */}
          {selectedTipo && !isRQ063 && !isAbonoEducacional && (
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
