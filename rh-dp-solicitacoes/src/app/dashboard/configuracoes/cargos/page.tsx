'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Cargo = {
  id: string;
  name: string;
  sectorProject: string | null;
};

export default function CargosPage() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const url = search
        ? `/api/configuracoes/cargos?q=${encodeURIComponent(search)}`
        : `/api/configuracoes/cargos`;

      const res = await fetch(url);

      if (!res.ok) {
        console.error('Erro ao carregar cargos');
        setCargos([]);
        setLoading(false);
        return;
      }

      const json = await res.json();
      setCargos(Array.isArray(json) ? json : []);
      setLoading(false);
    }

    load();
  }, [search]);

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Cargos</h1>

        <Link
          href="/dashboard/configuracoes/cargos/novo"
          className="px-3 py-2 bg-orange-500 text-white rounded text-sm"
        >
          Novo cargo
        </Link>
      </div>

      <div className="mb-4">
        <input
          className="border rounded px-3 py-2 text-sm w-full md:w-96"
          placeholder="Buscar por nome, descrição, setor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Setor/Projeto</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : cargos.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Nenhum cargo encontrado
                </td>
              </tr>
            ) : (
              cargos.map((cargo) => (
                <tr
                  key={cargo.id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-2">{cargo.name}</td>
                  <td className="px-3 py-2">
                    {cargo.sectorProject ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/dashboard/configuracoes/cargos/${cargo.id}`}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
