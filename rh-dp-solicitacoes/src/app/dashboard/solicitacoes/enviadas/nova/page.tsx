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
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { fetchMe } from '@/lib/me-cache';
import { isSolicitacaoEpiUniforme, isSolicitacaoEquipamento } from '@/lib/solicitationTypes';
import {
  SolicitacoesToastViewport,
  useSolicitacoesToast,
} from '@/components/solicitacoes/SolicitacoesToast';
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


type Departamento = {
  id: string;
  label: string;
  description: string;
};

type CampoEspecifico = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  section?: string;
  stage?: string;
  disabled?: boolean;
};

type TipoSolicitacao = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  meta?: {
    templateDownload?: string;
    requiresAttachment?: boolean;
    destinos?: Array<{ value: string; label: string }>;
  };
  camposEspecificos?: CampoEspecifico[];
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
   ESTILOS COMPARTILHADOS
================================================================ */

const labelClass =
  'block text-xs font-semibold text-slate-600 mb-1 tracking-wide';
const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 transition';
const textareaClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 transition';
const selectClass = inputClass;
const ACRONYM_TOKENS = ['DP', 'RH', 'TI', 'SST', 'LOG'];

function toSentenceCaseWithAcronyms(value: string) {
  const lowered = value.toLowerCase();
  const sentence = lowered.charAt(0).toUpperCase() + lowered.slice(1);

  return sentence.replace(/\b[a-z]{2,3}\b/g, (word) => {
    const upper = word.toUpperCase();
    return ACRONYM_TOKENS.includes(upper) ? upper : word;
  });
}

function getTipoDisplayName(nome: string) {
  const trimmed = nome.trim();
  if (!trimmed) return '';
  return trimmed === trimmed.toUpperCase()
    ? toSentenceCaseWithAcronyms(trimmed)
    : trimmed.replace(/^RQ[_.]?\d+\s*-\s*/i, '');
}

const TI_EQUIPMENT_CONFIGS: Record<string, string[]> = {
  'Linhas telefônicas': [
    'Ramais internos',
    'Linha direta (fixa)',
    'Linha com DDD/DID externo',
  ],
  Smartphones: [
    'Básico (apps corporativos e comunicação)',
    'Intermediário (apps de campo e câmera avançada)',
    'Avançado (alto desempenho + pacote de dados)',
  ],
  Notebooks: [
    'Administrativo (uso office e web)',
    'Engenharia/Projetos (maior memória e processamento)',
    'Executivo (mobilidade + bateria estendida)',
  ],
  Desktops: [
    'Padrão escritório',
    'Desempenho elevado',
    'Estação fixa com múltiplos monitores',
  ],
  Monitores: ['21" Full HD', '24" Full HD', '27" QHD/4K', 'Ultrawide'],
  Impressoras: ['Jato de tinta', 'Laser mono', 'Laser colorida', 'Multifuncional'],
  'TP-Link': ['Roteador', 'Access Point', 'Switch gerenciável', 'Switch não gerenciável'],
  'Outros equipamentos': ['Webcam', 'Headset', 'Dock station', 'Teclado e mouse', 'Outro'],
};


/* ================================================================
   COMPONENTE PRINCIPAL
================================================================ */

export default function NovaSolicitacaoPage() {
  const router = useRouter();
  const { toasts, pushToast, removeToast } = useSolicitacoesToast();

  // controle de envio
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------- DADOS DO SOLICITANTE ----------
  const [me, setMe] = useState<UserMe | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

// ---------- CAMPOS DO CABEÇALHO ----------
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [tipos, setTipos] = useState<TipoSolicitacao[]>([]);

  const [departamentoId, setDepartamentoId] = useState('');
  const [tipoId, setTipoId] = useState('');

  // ---------- RQ_063 / CARGOS ----------
  const [positions, setPositions] = useState<Position[]>([]);
  const [cargoId, setCargoId] = useState('');
  const [extras, setExtras] = useState<Extras>({});
  const [extraFiles, setExtraFiles] = useState<Record<string, File[]>>({});
  const [abonoCampos, setAbonoCampos] = useState<Extras>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [step2ReadyAt, setStep2ReadyAt] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    type: string;
  } | null>(null);

  const canGoNext = Boolean(departamentoId && tipoId);


  /* ============================================================
   1) /api/me
  ============================================================ */
  useEffect(() => {
    async function loadMe() {
      try {
        setMeLoading(true);
        setMeError(null);

        const data = (await fetchMe()) as UserMe;
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
   2) /api/departments
  ============================================================ */
  useEffect(() => {
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

     loadDepartments();
  }, []);

  /* ============================================================
   3) /api/tipos-solicitacao?departamentoId=
  ============================================================ */
  useEffect(() => {
    if (!departamentoId) {
      setTipos([]);
      setTipoId('');
      return;
    }

    async function loadTipos() {
      try {
        const params = new URLSearchParams({ departamentoId });

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
  }, [departamentoId]);

  const selectedDepartamento =
    departamentos.find((d) => d.id === departamentoId)?.label ?? '';
  const getTipoOptionLabel = (tipo: TipoSolicitacao) => {
    const parts = [
      selectedDepartamento,
      tipo.codigo,
      getTipoDisplayName(tipo.nome),
    ].filter(Boolean);

    return parts.join(' - ');
  };

  const selectedTipo = useMemo(
    () => tipos.find((t) => t.id === tipoId) ?? null,
    [tipos, tipoId],
  );
  const selectedTipoLabel = selectedTipo
    ? getTipoOptionLabel(selectedTipo)
    : '';

  const isRQ063 =
    !!selectedTipo &&
    (selectedTipo.id.toUpperCase() === 'RQ_063' ||
      selectedTipo.nome.toUpperCase().includes('RQ_063'));

  const isAbonoEducacional =
    selectedTipo?.nome === 'Solicitação de Incentivo à Educação' ||
    selectedTipo?.nome === 'Solicitação de Abono Educacional';
  const isSolicitacaoEquipamentoTi = isSolicitacaoEquipamento(selectedTipo);

  const isSolicitacaoEpi = isSolicitacaoEpiUniforme(selectedTipo);
  const tipoMeta = selectedTipo?.meta;
  const requiresAttachment = Boolean(tipoMeta?.requiresAttachment);
  const templateDownload = tipoMeta?.templateDownload;
  const destinoOptions = useMemo(
    () => (tipoMeta?.destinos ?? []).map((item) => item.label),
    [tipoMeta?.destinos],
  );

  const camposEspecificos = selectedTipo?.camposEspecificos ?? [];
  const camposSolicitante = camposEspecificos.filter((campo) => {
    if (campo.stage && campo.stage !== 'solicitante') return false;
    if (isSolicitacaoEpi && ['emailSolicitante', 'local', 'data'].includes(campo.name)) {
      return false;
    }
    return true;
  });
  const camposSolicitanteComTi = useMemo(() => {
    const baseCampos = camposSolicitante.map((campo) => {
      if (campo.name !== 'destinadoPara') return campo;

      return {
        ...campo,
        options: destinoOptions,
      };
    });

    if (!isSolicitacaoEquipamentoTi) return baseCampos;

    const equipmentTypeOptions = Object.keys(TI_EQUIPMENT_CONFIGS);
    const selectedEquipmentType = extras.tipoEquipamentoTi ?? '';
    const requiredConfigs = TI_EQUIPMENT_CONFIGS[selectedEquipmentType] ?? [];

    const camposTi: CampoEspecifico[] = [
      {
        name: 'tipoEquipamentoTi',
        label: 'Tipo de equipamento TI',
        type: 'select',
        required: true,
        options: equipmentTypeOptions,
        section: 'Equipamento TI',
      },
      {
        name: 'configuracaoEquipamentoTi',
        label: 'Configuração exigida',
        type: 'select',
        required: true,
        options: requiredConfigs,
        disabled: !selectedEquipmentType,
        section: 'Equipamento TI',
      },
    ];

     const existingNames = new Set(baseCampos.map((campo) => campo.name));
    return [...baseCampos, ...camposTi.filter((campo) => !existingNames.has(campo.name))];
  }, [camposSolicitante, destinoOptions, extras.tipoEquipamentoTi, isSolicitacaoEquipamentoTi]);


  useEffect(() => {
    if (!isAbonoEducacional) {
      setAbonoCampos({});
    }
  }, [isAbonoEducacional]);

  useEffect(() => {
    if (!selectedTipo) {
      setExtras({});
      setExtraFiles({});
      setCargoId('');
      return;
    }

    const defaults = (selectedTipo.camposEspecificos ?? []).reduce(
      (acc, campo) => {
        if (campo.defaultValue !== undefined) {
          acc[campo.name] = campo.defaultValue;
        }

        return acc;
      },
      {} as Record<string, string>,
    );

    setExtras(defaults);
    setExtraFiles({});
    setCargoId('');
  }, [selectedTipo]);

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
    if (name === 'tipoEquipamentoTi') {
      setExtras((prev) => ({
        ...prev,
        tipoEquipamentoTi: value,
        configuracaoEquipamentoTi: '',
      }));
      return;
    }
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
  const handleFileChange = (name: string, files: FileList | null) => {
    setExtraFiles((prev) => ({
      ...prev,
      [name]: files ? Array.from(files) : [],
    }));
    handleExtraChange(
      name,
      files && files.length > 0
        ? Array.from(files).map((file) => file.name).join(', ')
        : '',
    );
  };
  const handlePreviewFile = (file: File) => {
    const nextUrl = URL.createObjectURL(file);

    setPreviewFile((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return {
        name: file.name,
        type: file.type,
        url: nextUrl,
      };
    });
  };

  const closePreview = () => {
    setPreviewFile((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
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

    if (step !== 2) return;
    if (step2ReadyAt && Date.now() < step2ReadyAt) {
      setSubmitError('Revise os dados antes de enviar a solicitação.');
      return;
    }


    if (isRQ063 && !cargoId) {
      setSubmitError('Selecione o cargo para continuar.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      let campos: Record<string, string> = {};

      const uploadExtrasFiles = async (solicitacaoId: string) => {
        const entries = Object.entries(extraFiles).filter(([, files]) => files.length > 0);
        for (const [fieldName, files] of entries) {
          const formData = new FormData();
          files.forEach((file) => formData.append('files', file));
          formData.append('fieldName', fieldName);

          const uploadRes = await fetch(`/api/solicitacoes/${solicitacaoId}/anexos`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            let msg = `Falha ao enviar anexo (${fieldName}).`;
            try {
              const json = await uploadRes.json();
              if (json?.error) msg = json.error;
            } catch {}
            throw new Error(msg);
          }
        }
      };

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
        const obrigatorios = camposSolicitanteComTi
          .filter((c) => c.required)
          .map((c) => c.name);

        const faltantes = obrigatorios.filter((name) => !extras[name]);
        if (faltantes.length > 0) {
          setSubmitError('Preencha os campos obrigatórios do formulário.');
          setSubmitting(false);
          return;
        }
         const placaValue = (extras.placaVeiculo ?? '').trim().toUpperCase();
        if (extras.placaVeiculo !== undefined && !/^[A-Z0-9]{7,}$/.test(placaValue)) {
          setSubmitError('Placa do veículo inválida. Use formato alfanumérico com ao menos 7 caracteres.');
          setSubmitting(false);
          return;
        }

        if (requiresAttachment) {
          const hasAttachment = Object.values(extraFiles).some((files) => files.length > 0);
          if (!hasAttachment) {
            setSubmitError('Anexe o documento referente à multa para prosseguirmos.');
            setSubmitting(false);
            return;
          }
        }

        campos = camposSolicitanteComTi.reduce<Record<string, string>>(
         (acc, campo) => {
            const nextValue = extras[campo.name] ?? '';
            acc[campo.name] = campo.name === 'placaVeiculo' ? nextValue.trim().toUpperCase() : nextValue;
            return acc;
          },
          {},
        );
      }

      const body = {
        solicitanteId: me?.id ?? null,
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
      if (data?.id) {
        await uploadExtrasFiles(data.id);
      }

      const query = new URLSearchParams();
      if (departamentoId) {
        query.set('departmentId', departamentoId);
      }
      const nextUrl = query.toString()
        ? `/dashboard/solicitacoes/enviadas?${query.toString()}`
        : '/dashboard/solicitacoes/enviadas';
      pushToast('Solicitação criada com sucesso', 'success');
      window.setTimeout(() => {
        router.push(nextUrl);
      }, 450);
    } catch (err: any) {
      console.error('Erro ao enviar solicitação', err);
      setSubmitError(err?.message ?? 'Erro ao enviar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };
  const handleNextStep = () => {
    setSubmitError(null);
    setStep(2);
    setStep2ReadyAt(Date.now() + 700);
  };
useEffect(() => {
    return () => {
      if (previewFile?.url) {
        URL.revokeObjectURL(previewFile.url);
      }
    };
  }, [previewFile]);


  /* ============================================================
   RENDER
  ============================================================ */
  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <SolicitacoesToastViewport toasts={toasts} onClose={removeToast} />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 lg:px-0">
        <form
          id="form-solicitacao"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return

            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag !== 'textarea') {
              e.preventDefault()
            }
          }}
          className="space-y-6"
        >
           {previewFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    Pré-visualização: {previewFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>

                <div className="h-[340px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {previewFile.type.startsWith('image/') ? (
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={previewFile.url}
                      title={`Pré-visualização de ${previewFile.name}`}
                      className="h-full w-full"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
          {/* HEADER */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Nova Solicitação
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Preencha os dados abaixo para registrar uma nova solicitação.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${step === 1 ? 'bg-orange-500' : 'bg-slate-300'}`} />
                <span className="text-xs font-semibold text-slate-700">Passo 1: Dados da solicitação</span>
                <span className="text-slate-300">•</span>
                <span className={`h-2.5 w-2.5 rounded-full ${step === 2 ? 'bg-orange-500' : 'bg-slate-300'}`} />
                <span className="text-xs font-semibold text-slate-700">Passo 2: Campos específicos</span>
              </div>
            </div>

            {submitError && (
              <p className="mt-3 text-xs text-red-600">{submitError}</p>
            )}
          </div>

          {step === 1 && (
          <>

          {/* TOPO: CABEÇALHO + SOLICITANTE */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
             {/* ESQUERDA – Depto / Tipo */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">
                Dados da solicitação
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    DEPARTAMENTO <span className="text-red-500">*</span>
                  </label>
                  <Select.Root
                    value={departamentoId}
                    onValueChange={(value: string) => {
                      setDepartamentoId(value);
                      setTipoId('');
                    }}
                    required
                  >
                    <Select.Trigger
                      className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-lg transition focus:outline-none focus:ring-2 focus:ring-orange-500/70 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <Select.Value asChild>
                        <span className="min-w-0 flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-slate-900">
                          {selectedDepartamento || 'Selecione...'}
                        </span>
                      </Select.Value>
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                      </Select.Icon>
                    </Select.Trigger>

                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="z-20 min-w-[320px] max-w-[700px] rounded-md border border-slate-200 bg-white shadow-xl"
                      >
                        <Select.Viewport className="max-h-64 overflow-y-auto p-1 text-sm">
                          {departamentos.map((d) => (
                            <Select.Item
                              key={d.id}
                              value={d.id}
                              className="relative flex cursor-pointer select-none items-center whitespace-nowrap rounded-sm py-2 pl-9 pr-8 text-slate-900 outline-none data-[highlighted]:bg-orange-100 data-[highlighted]:text-orange-900"
                            >
                              <Select.ItemText>
                                <span className="block whitespace-nowrap overflow-hidden text-ellipsis">
                                  {d.label}
                                </span>
                              </Select.ItemText>
                              <Select.ItemIndicator className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-700">
                                <Check className="h-4 w-4" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  <input
                    type="text"
                    tabIndex={-1}
                    value={departamentoId}
                    onChange={() => undefined}
                    required
                    className="sr-only"
                    aria-hidden
                  />
                                   </div>

                <div>
                  <label className={labelClass}>
                    TIPO DE SOLICITAÇÃO{' '}
                    <span className="text-red-500">*</span>
                  </label>
                    <Select.Root value={tipoId} onValueChange={setTipoId} disabled={!departamentoId}>
                    <Select.Trigger
                      title={selectedTipoLabel}
                      className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-lg transition focus:outline-none focus:ring-2 focus:ring-orange-500/70 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <Select.Value asChild>
                        <span className="min-w-0 flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                          {selectedTipoLabel || 'Selecione...'}
                        </span>
                      </Select.Value>
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                      </Select.Icon>
                    </Select.Trigger>

                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                      className="z-20 min-w-[420px] max-w-[700px] overflow-x-auto rounded-md border border-slate-200 bg-white shadow-xl"
                      >
                        <Select.Viewport className="max-h-64 overflow-y-auto p-1 text-sm">
                          {tipos.map((t) => (
                            <Select.Item
                              key={t.id}
                              value={t.id}
                              className="relative flex cursor-pointer select-none items-center whitespace-nowrap rounded-sm py-2 pl-9 pr-8 text-slate-900 outline-none data-[highlighted]:bg-orange-50 data-[highlighted]:text-orange-900"
                            >
                              <Select.ItemText>
                                {`${t.codigo} - ${getTipoDisplayName(t.nome)}`}
                              </Select.ItemText>
                              <Select.ItemIndicator className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600">
                                <Check className="h-4 w-4" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  <input
                    type="text"
                    tabIndex={-1}
                    value={tipoId}
                   onChange={() => undefined}
                    required
                    disabled={!departamentoId}
                    className="sr-only"
                    aria-hidden
                  />
                </div>
              </div>
            </div>

            {/* DIREITA – Dados do Solicitante */}
            <aside className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <h2 className="text-sm font-semibold text-slate-800">
                Dados do Solicitante
              </h2>

              {meLoading && (
                <p className="mt-2 text-xs text-slate-500">
                  Carregando dados do solicitante...
                </p>
              )}

              {meError && (
                <p className="mt-2 text-xs text-red-500">{meError}</p>
              )}

              {me && (
                 <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    placeholder="Nome"
                    value={me.fullName}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="E-mail"
                    value={me.email}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="Login"
                    value={me.login}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="Cargo"
                    value={me.positionName ?? ''}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="Setor"
                    value={me.departmentName ?? ''}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="Líder"
                    value={me.leaderName ?? ''}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="Telefone"
                    value={me.phone ?? ''}
                    readOnly
                  />
                  <input
                    className={inputClass}
                    placeholder="Centro de Custo"
                    value={me.costCenterName ?? ''}
                    readOnly
                  />
                </div>
              )}
            </aside>
          </div>

           </>
          )}

          {step === 2 && (
          <>
          

          {/* PARTE DE BAIXO – FORMULÁRIO DO TIPO SELECIONADO */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur space-y-5">
            {!selectedTipo && (
              <p className="text-xs text-slate-500">
                Selecione um tipo de solicitação para exibir os campos
                específicos.
              </p>
            )}

            {/* =================== FORM RQ_063 =================== */}
            {selectedTipo && isRQ063 && (
              <>
                <h2 className="text-sm font-semibold text-slate-900">
                  {selectedTipo.nome}
                </h2>

                {/* =================== INFORMAÇÕES BÁSICAS =================== */}
                <section className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Informações básicas
                  </h3>

                  {/* Cargo */}
                  <div>
                    <label className={labelClass}>
                      Cargo <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={selectClass}
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Setor/Projeto */}
                    <div>
                      <label className={labelClass}>
                        Setor e/ou Projeto{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={extras.setorProjeto ?? ''}
                        onChange={(e: InputChange) =>
                          handleExtraChange('setorProjeto', e.target.value)
                        }
                        required
                      />
                    </div>

                    {/* Vaga prevista em contrato */}
                    <div>
                      <label className={labelClass}>
                        Vaga prevista em contrato?{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1 flex items-center gap-4 text-xs">
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Local de trabalho */}
                    <div>
                      <label className={labelClass}>
                        Local de Trabalho{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={extras.localTrabalho ?? ''}
                        onChange={(e: InputChange) =>
                          handleExtraChange('localTrabalho', e.target.value)
                        }
                        required
                      />
                    </div>

                    {/* Centro de Custo (texto livre – pode repetir o do topo) */}
                    <div>
                      <label className={labelClass}>
                        Centro de Custo{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Horário de trabalho */}
                    <div>
                      <label className={labelClass}>
                        Horário de Trabalho{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={extras.horarioTrabalho ?? ''}
                        onChange={(e: InputChange) =>
                          handleExtraChange('horarioTrabalho', e.target.value)
                        }
                        required
                      />
                    </div>

                    {/* Chefia imediata */}
                    <div>
                      <label className={labelClass}>
                        Chefia Imediata{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
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
                    <label className={labelClass}>
                      Coordenador do Contrato{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={inputClass}
                      value={extras.coordenadorContrato ?? ''}
                      onChange={(e: InputChange) =>
                        handleExtraChange('coordenadorContrato', e.target.value)
                      }
                      required
                    />
                  </div>
                </section>

                {/* =================== MOTIVO DA VAGA =================== */}
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                    <label className={labelClass}>
                      Justificativa da Vaga{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className={textareaClass}
                      value={extras.justificativaVaga ?? ''}
                      onChange={(e: TextAreaChange) =>
                        handleExtraChange('justificativaVaga', e.target.value)
                      }
                      required
                    />
                  </div>
                </section>

                {/* =================== ATIVIDADES =================== */}
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Atividades
                  </h3>

                  <div>
                    <label className={labelClass}>
                      Principais atividades{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className={`${textareaClass} min-h-[80px]`}
                      value={extras.principaisAtividades ?? ''}
                      onChange={(e: TextAreaChange) =>
                        handleExtraChange(
                          'principaisAtividades',
                          e.target.value,
                        )
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Atividades complementares
                    </label>
                    <textarea
                      className={`${textareaClass} min-h-[60px]`}
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
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Requisitos acadêmicos
                  </h3>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Escolaridade{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={extras.escolaridade ?? ''}
                        onChange={(e: InputChange) =>
                          handleExtraChange('escolaridade', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Curso</label>
                      <input
                        className={inputClass}
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
                    <label className={labelClass}>
                      Período/Módulo - mínimo ou máximo
                    </label>
                    <input
                      className={inputClass}
                      value={extras.periodoModulo ?? ''}
                      onChange={(e: InputChange) =>
                        handleExtraChange('periodoModulo', e.target.value)
                      }
                    />
                  </div>
                </section>

                {/* =================== REQUISITOS / COMPETÊNCIAS =================== */}
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Requisitos e conhecimentos
                  </h3>

                  <div>
                    <label className={labelClass}>
                      Requisitos e conhecimentos necessários{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className={textareaClass}
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
                    <label className={labelClass}>
                      Competências comportamentais exigidas{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className={textareaClass}
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
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Solicitações para o novo funcionário
                  </h3>

                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
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
                        <span className="block text-[11px] font-semibold text-slate-600">
                          Outros
                        </span>
                        <input
                          className={inputClass}
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
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                    <label className={labelClass}>
                      Previsto em contrato (Salários, Benefícios, Carga
                      Horária e outros)
                    </label>
                    <textarea
                      className={textareaClass}
                      value={extras.previstoContrato ?? ''}
                      onChange={(e: TextAreaChange) =>
                        handleExtraChange('previstoContrato', e.target.value)
                      }
                    />
                  </div>
                </section>

                {/* =================== RH =================== */}
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Preenchimento do setor Recursos Humanos
                  </h3>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>Nome do Profissional</label>
                      <input
                        className={inputClass}
                        value={extras.nomeProfissional ?? ''}
                        onChange={(e: InputChange) =>
                          handleExtraChange(
                            'nomeProfissional',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Data de Admissão</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={extras.dataAdmissao ?? ''}
                        onChange={(e: InputChange) =>
                          handleExtraChange('dataAdmissao', e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Observações</label>
                    <textarea
                      className={textareaClass}
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
                <h2 className="text-sm font-semibold text-slate-900">
                  {selectedTipo.nome}
                </h2>

                <section className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Dados do colaborador
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className={labelClass}>
                        Nome do colaborador{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
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
                      <label className={labelClass}>
                        Matrícula <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={abonoCampos.matricula ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('matricula', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Cargo <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={abonoCampos.cargo ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('cargo', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contato do setor</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.contatoSetor ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('contatoSetor', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Centro de custo{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={inputClass}
                        value={abonoCampos.centroCusto ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('centroCusto', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        E-mail <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        className={inputClass}
                        value={abonoCampos.email ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('email', e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Empresa</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.empresa ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('empresa', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Local de trabalho</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.localTrabalho ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('localTrabalho', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Telefone</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.telefone ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('telefone', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>CBO</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.cbo ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('cbo', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Escolaridade</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.escolaridade ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('escolaridade', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Tipo de contratação
                      </label>
                      <input
                        className={inputClass}
                        value={abonoCampos.tipoContratacao ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange(
                            'tipoContratacao',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Benefício</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.beneficio ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('beneficio', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Valor do benefício
                      </label>
                      <input
                        className={inputClass}
                        value={abonoCampos.valorBeneficio ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange(
                            'valorBeneficio',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Nível</label>
                      <input
                        className={inputClass}
                        value={abonoCampos.nivel ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('nivel', e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Observações do solicitante
                    </label>
                    <textarea
                      className={textareaClass}
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

                <section className="space-y-4 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Requisitos de RH
                  </h3>
                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
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
                      <span>
                        Ausência de faltas, advertências disciplinares.
                      </span>
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>Status</label>
                      <select
                        className={selectClass}
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
                      <label className={labelClass}>
                        Assistente Recursos Humanos
                      </label>
                      <input
                        className={inputClass}
                        value={abonoCampos.assistenteRh ?? ''}
                        onChange={(e: InputChange) =>
                          handleAbonoChange('assistenteRh', e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Cálculo do abono (se mensal ou será pago)
                    </label>
                    <textarea
                      className={textareaClass}
                      value={abonoCampos.calculoAbono ?? ''}
                      onChange={(e: TextAreaChange) =>
                        handleAbonoChange('calculoAbono', e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Observações</label>
                    <textarea
                      className={textareaClass}
                      value={abonoCampos.observacoesRh ?? ''}
                      onChange={(e: TextAreaChange) =>
                        handleAbonoChange('observacoesRh', e.target.value)
                      }
                    />
                  </div>
                </section>
              </>
            )}

            {/* =================== FORM GENÉRICO (camposEspecíficos) =================== */}
           {selectedTipo && !isRQ063 && !isAbonoEducacional && (
              <>
                <h2 className="text-sm font-semibold mb-4">
                  {selectedTipo.nome}
                </h2>

                {camposSolicitanteComTi.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Este tipo de solicitação não possui campos configurados.
                  </p>
                )}

                {camposSolicitanteComTi.length > 0 && (() => {
                  const hasSections = camposSolicitanteComTi.some(
                    (campo) => campo.section,
                  );

                  const renderCampo = (campo: CampoEspecifico) => {
                    const value = extras[campo.name] ?? '';
                    const shouldShowEnderecoEnvio =
                      campo.name !== 'enderecoEnvio' ||
                      extras.comoSeraEntrega === 'Será enviado';

                    if (!shouldShowEnderecoEnvio) {
                      return null;
                    }

                    if (campo.type === 'checkbox') {
                      return (
                        <div key={campo.name} className="md:col-span-2">
                          <label className="flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={value === 'true'}
                              onChange={(e: InputChange) =>
                                handleExtraChange(
                                  campo.name,
                                  e.target.checked ? 'true' : 'false',
                                )
                              }
                            />
                            <span className="text-gray-700 leading-snug">
                              {campo.label}
                              {campo.required && (
                                <span className="ml-1 text-red-500">*</span>
                              )}
                            </span>
                          </label>
                        </div>
                      );
                    }

                      const commonProps = {
                      id: campo.name,
                      name: campo.name,
                      required: campo.required,
                      value,
                      onChange: (
                        e:
                          | InputChange
                          | TextAreaChange
                          | SelectChange,
                      ) => handleExtraChange(campo.name, e.target.value),
                      className:
                        'w-full border rounded px-3 py-2 text-sm bg-white',
                    };

                    return (
                      <div key={campo.name}>
                        <label className="space-y-1 text-sm block">
                          <span className="block text-xs font-semibold text-gray-700">
                            {campo.label}{' '}
                            {campo.required && (
                              <span className="text-red-500">*</span>
                            )}
                          </span>

                          {campo.type === 'textarea' && (
                            <textarea
                              {...commonProps}
                              className={`${commonProps.className} min-h-[80px]`}
                            />
                          )}

                          {campo.type === 'select' && campo.options && (
                             <select {...(commonProps as any)} disabled={campo.disabled}>
                              <option value="">Selecione...</option>
                              {campo.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}

                          {campo.type === 'file' && (
                            <div className="rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/40 p-3">
                               <input
                                id={campo.name}
                                name={campo.name}
                                type="file"
                                multiple
                                onChange={(e: InputChange) => handleFileChange(campo.name, e.target.files)}
                                className="w-full rounded-md border border-orange-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-orange-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-orange-600"
                              />
                              <p className="mt-2 text-xs font-medium text-orange-700">
                                Arraste arquivos ou clique em “Escolher arquivos” para anexar.
                              </p>
                              {(extraFiles[campo.name]?.length ?? 0) > 0 && (
                                <div className="mt-2 space-y-1">
                                  {extraFiles[campo.name].map((file) => (
                                    <div
                                      key={`${campo.name}-${file.name}-${file.lastModified}`}
                                      className="flex items-center justify-between gap-2 rounded-md bg-white/80 px-2 py-1"
                                    >
                                      <span className="truncate text-xs text-slate-700">{file.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => handlePreviewFile(file)}
                                        className="text-xs font-semibold text-orange-700 hover:text-orange-800"
                                      >
                                        Pré-visualizar
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                           {!campo.type && <input type="text" {...commonProps} />}

                          {campo.type &&
                            campo.type !== 'textarea' &&
                            campo.type !== 'select' &&
                            campo.type !== 'file' && (
                              <input type={campo.type} {...commonProps} />
                            )}
                        </label>
                      </div>
                    );
                  };

                  if (!hasSections) {
                    return (
                      <div className="grid gap-4 md:grid-cols-2">
                        {camposSolicitanteComTi.map(renderCampo)}
                      </div>
                    );
                  }

                  const grouped = camposSolicitanteComTi.reduce<
                    Record<string, CampoEspecifico[]>
                  >((acc, campo) => {
                    const key = campo.section ?? 'Outros';
                    acc[key] = acc[key] ? [...acc[key], campo] : [campo];
                    return acc;
                  }, {});

                  return (
                    <div className="space-y-6">
                       {templateDownload && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                          <a
                            href={templateDownload}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline"
                          >
                            Baixar formulário (RQ.DP.049.xls)
                          </a>
                        </div>
                      )}
                      {requiresAttachment && (
                        <p className="text-xs text-orange-700">
                          Anexe o documento referente à multa para prosseguirmos.
                        </p>
                      )}
                      {Object.entries(grouped).map(([section, campos]) => (
                        <section key={section} className="space-y-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {section}
                          </h3>
                          <div className="grid gap-4 md:grid-cols-2">
                            {campos.map(renderCampo)}
                          </div>
                        </section>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={step === 1 || submitting}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 enabled:hover:bg-slate-50 disabled:opacity-50"
            >
              Voltar
            </button>

            {step === 1 ? (
              <button
                type="button"
                   onClick={handleNextStep}
                disabled={!canGoNext || submitting}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Avançar
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || !tipoId}
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}