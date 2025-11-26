'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import type { CargoForm, Department } from '../types';

export default function EditarCargoPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const cargoId = params.id;

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

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [cargoRes, deptRes] = await Promise.all([
          fetch(`/api/configuracoes/cargos/${cargoId}`),
          fetch('/api/departments'),
        ]);

        if (!cargoRes.ok) {
          const message = cargoRes.status === 404
            ? 'Cargo não encontrado'
            : 'Erro ao carregar cargo';
          setError(message);
          setLoading(false);
          return;
        }

        const cargo = await cargoRes.json();
        setForm({
          name: cargo.name ?? '',
          description: cargo.description ?? '',
          sectorProject: cargo.sectorProject ?? '',
          workplace: cargo.workplace ?? '',
          workSchedule: cargo.workSchedule ?? '',
          mainActivities: cargo.mainActivities ?? '',
          schooling: cargo.schooling ?? '',
          experience: cargo.experience ?? '',
          requiredKnowledge: cargo.requiredKnowledge ?? '',
          behavioralCompetencies: cargo.behavioralCompetencies ?? '',
          site: cargo.site ?? '',
          workPoint: cargo.workPoint ?? '',
          departmentId: cargo.departmentId ?? null,
        });

        if (deptRes.ok) {
          const data = (await deptRes.json()) as Department[];
          setDepartamentos(data);
        } else {
          setError('Erro ao carregar departamentos');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [cargoId]);

  function handleChange<K extends keyof CargoForm>(
    field: K,
    value: CargoForm[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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

      const res = await fetch(`/api/configuracoes/cargos/${cargoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('Erro ao atualizar cargo:', txt);
        setError('Erro ao atualizar cargo');
        return;
      }

      router.push('/dashboard/configuracoes/cargos');
    } catch (err) {
      console.error(err);
      setError('Erro ao atualizar cargo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-gray-500">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Editar cargo</h1>
          <p className="text-xs text-gray-500">
            Atualize as informações do cargo. Essas informações são usadas para auto-preencher a RQ_063.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard/configuracoes/cargos')}
          className="px-3 py-2 border rounded text-sm"
        >
          Voltar
        </button>
      </header>

      <form
        onSubmit={handleSubmit}
        className="border rounded-lg bg-white shadow-sm p-4 space-y-4"
      >
        {error && (
          <p className="text-xs text-red-500 mb-2">{error}</p>
        )}

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

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/configuracoes/cargos')}
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
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </main>
  );
}