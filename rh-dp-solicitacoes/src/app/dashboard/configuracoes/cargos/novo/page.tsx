'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import type { CargoForm, Department } from '../types';

export type CargoForm = {
  id: string;
  label: string;
  description: string;
};

export default function NovoCargoPage() {
  const router = useRouter();

  const [form, setForm] = useState<CargoForm>({
    name: '',
    description: '',
    sectorProject: '',
    workplace: '',
    workSchedule: '',
    mainActivities: '',
    schooling: '',
    experience: '',
    requiredKnowledge: '',
    behavioralCompetencies: '',
    site: '',
    workPoint: '',
    departmentId: null,
  });

  const [departamentos, setDepartamentos] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // carrega departamentos
  useEffect(() => {
    async function loadDepts() {
      try {
        setLoading(true);
        const res = await fetch('/api/departments');
        const data = (await res.json()) as Department[];
        setDepartamentos(data);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar departamentos');
      } finally {
        setLoading(false);
      }
    }

    loadDepts();
  }, []);

  function handleChange<K extends keyof CargoForm>(
    field: K,
    value: CargoForm[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: form.name,
        description: form.description || null,
        sectorProject: form.sectorProject || null,
        workplace: form.workplace || null,
        workSchedule: form.workSchedule || null,
        mainActivities: form.mainActivities || null,
        schooling: form.schooling || null,
        experience: form.experience || null,
        requiredKnowledge: form.requiredKnowledge || null,
        behavioralCompetencies: form.behavioralCompetencies || null,
        site: form.site || null,
        workPoint: form.workPoint || null,
        departmentId: form.departmentId || null,
      };

      const res = await fetch('/api/configuracoes/cargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('Erro ao criar cargo:', txt);
        setError('Erro ao criar cargo');
        return;
      }

      router.push('/dashboard/configuracoes/cargos');
    } catch (err) {
      console.error(err);
      setError('Erro ao criar cargo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Novo cargo</h1>
          <p className="text-xs text-gray-500">
            Preencha os dados do novo cargo. Essas informações serão usadas para
            auto-preencher a RQ_063.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push('/dashboard/configuracoes/cargos')
          }
          className="px-3 py-2 border rounded text-sm"
        >
          Voltar
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border rounded-lg bg-white shadow-sm p-4 space-y-4"
        >
          {error && (
            <p className="text-xs text-red-500 mb-2">{error}</p>
          )}

          {/* Nome + Departamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Nome do cargo
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) =>
                  handleChange('name', e.target.value)
                }
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Departamento
              </label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.departmentId ?? ''}
                onChange={(e) =>
                  handleChange(
                    'departmentId',
                    e.target.value || null,
                  )
                }
              >
                <option value="">Sem departamento</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} ({d.description})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Descrição do cargo
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
              value={form.description}
              onChange={(e) =>
                handleChange('description', e.target.value)
              }
            />
          </div>

          {/* Setor / Local / Horário */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Setor / Projeto
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.sectorProject}
                onChange={(e) =>
                  handleChange('sectorProject', e.target.value)
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Local de trabalho
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.workplace}
                onChange={(e) =>
                  handleChange('workplace', e.target.value)
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Horário de trabalho
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.workSchedule}
                onChange={(e) =>
                  handleChange('workSchedule', e.target.value)
                }
              />
            </div>
          </div>

          {/* Escolaridade / Experiência */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Escolaridade
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.schooling}
                onChange={(e) =>
                  handleChange('schooling', e.target.value)
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Experiência mínima
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.experience}
                onChange={(e) =>
                  handleChange('experience', e.target.value)
                }
              />
            </div>
          </div>

          {/* Atividades, conhecimentos, competências */}
          <div>
            <label className="block text-xs font-semibold mb-1">
              Principais atividades
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
              value={form.mainActivities}
              onChange={(e) =>
                handleChange('mainActivities', e.target.value)
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Conhecimentos / requisitos
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
              value={form.requiredKnowledge}
              onChange={(e) =>
                handleChange(
                  'requiredKnowledge',
                  e.target.value,
                )
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Competências comportamentais
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
              value={form.behavioralCompetencies}
              onChange={(e) =>
                handleChange(
                  'behavioralCompetencies',
                  e.target.value,
                )
              }
            />
          </div>

          {/* Site / Ponto de trabalho */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Site
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.site}
                onChange={(e) =>
                  handleChange('site', e.target.value)
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Ponto de trabalho
              </label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.workPoint}
                onChange={(e) =>
                  handleChange('workPoint', e.target.value)
                }
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                router.push('/dashboard/configuracoes/cargos')
              }
              className="px-3 py-2 border rounded text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-orange-500 text-white text-sm"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
