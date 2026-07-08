"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Cargo = {
  id: string;
  name: string;
  sectorProject: string | null;
  indexador?: string | null;
  revision?: string | null;
  areaSector?: string | null;
  cbo?: string | null;
  active?: boolean;
  latestDocument?: { id: string; indexador?: string | null } | null;
};

function getCargoIndexador(cargo: Cargo) {
  return cargo.indexador || cargo.latestDocument?.indexador || '—';
}

function StatusBadge({ active }: { active?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}
    >
      {active === false ? "Inativo" : "Ativo"}
    </span>
  );
}

function DocumentBadge({ hasDocument }: { hasDocument: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${hasDocument ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}
    >
      {hasDocument ? "Anexado" : "Sem documento"}
    </span>
  );
}

export default function CargosPage() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  async function loadCargos() {
    setLoading(true);
    const url = search
      ? `/api/positions?q=${encodeURIComponent(search)}&includeInactive=true`
      : `/api/positions?includeInactive=true`;
    const res = await fetch(url);
    if (res.status === 403) {
      setAccessDenied(true);
      setCargos([]);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      console.error("Erro ao carregar cargos");
      setCargos([]);
      setLoading(false);
      return;
    }
    setAccessDenied(false);
    const json = await res.json();
    setCargos(Array.isArray(json) ? json : (json.items ?? []));
    setLoading(false);
  }

  useEffect(() => {
    loadCargos();
  }, [search]);

  const totalAtivos = useMemo(
    () => cargos.filter((cargo) => cargo.active !== false).length,
    [cargos],
  );
  const totalComDocumento = useMemo(
    () => cargos.filter((cargo) => cargo.latestDocument).length,
    [cargos],
  );

  async function handleDelete(cargo: Cargo) {
    if (!confirm(`Tem certeza que deseja excluir o cargo "${cargo.name}"?`))
      return;
    setDeletingId(cargo.id);
    try {
      const response = await fetch(`/api/positions/${cargo.id}`, {
        method: "DELETE",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(json?.error || "Falha ao excluir cargo.");
        return;
      }
      alert(
        json?.softDeleted
          ? "Cargo inativado porque possui vínculos."
          : "Cargo excluído com sucesso.",
      );
      await loadCargos();
    } finally {
      setDeletingId(null);
    }
  }

  if (accessDenied) {
    return (
      <main className="space-y-6 p-6">
        <section className="rounded-2xl border bg-[var(--card)] p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            RH • Cargos
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Controle de cargos
          </h1>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Esta tela é exclusiva do departamento de Recursos Humanos.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <section className="rounded-2xl border bg-[var(--card)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              RH • Cargos
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Controle de cargos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gerencie descrições oficiais, códigos/indexadores e documentos
              vigentes dos cargos.
            </p>
          </div>
          <Link
            href="/dashboard/rh/cargos/novo"
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            Novo cargo
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Total listado</p>
            <p className="text-xl font-semibold">{cargos.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Ativos</p>
            <p className="text-xl font-semibold">{totalAtivos}</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-xs text-slate-500">Com documento</p>
            <p className="text-xl font-semibold">{totalComDocumento}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-[var(--card)] shadow-sm">
        <div className="border-b p-4">
          <label
            className="text-xs font-semibold uppercase text-slate-600"
            htmlFor="cargo-search"
          >
            Buscar cargos
          </label>
          <input
            id="cargo-search"
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 md:w-[32rem]"
            placeholder="Busque por nome, código/indexador, área, setor ou CBO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Revisão</th>
                <th className="px-4 py-3 text-left">Área/Setor</th>
                <th className="px-4 py-3 text-left">CBO</th>
                <th className="px-4 py-3 text-left">Documento</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Carregando cargos...
                  </td>
                </tr>
              ) : cargos.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Nenhum cargo encontrado
                  </td>
                </tr>
              ) : (
                cargos.map((cargo) => (
                  <tr key={cargo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      {getCargoIndexador(cargo)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {cargo.name}
                    </td>
                    <td className="px-4 py-3">{cargo.revision ?? "—"}</td>
                    <td className="px-4 py-3">
                      {cargo.areaSector ?? cargo.sectorProject ?? "—"}
                    </td>
                    <td className="px-4 py-3">{cargo.cbo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DocumentBadge hasDocument={!!cargo.latestDocument} />
                      <span className="sr-only">
                        {cargo.latestDocument ? "Anexado" : "Não"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={cargo.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/dashboard/rh/cargos/${cargo.id}?mode=view`}
                          className="rounded-md border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Exibir
                        </Link>
                        <Link
                          href={`/dashboard/rh/cargos/${cargo.id}`}
                          className="rounded-md border px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(cargo)}
                          disabled={deletingId === cargo.id}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === cargo.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
