import Link from 'next/link'

export default function ConfiguracoesPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold text-[var(--foreground)]">Configurações</h1>
      <p className="text-sm text-[var(--muted-foreground)] mt-1">
        Ajuste preferências do sistema e permissões dos módulos.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-[var(--border-subtle)] p-4">
          <h2 className="font-medium text-[var(--foreground)]">Departamentos x Centros de custo</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Vincule centros de custo para controle de visibilidade por departamento.
          </p>
          <Link
            href="/dashboard/configuracoes/departamentos-centros-de-custo"
            className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Abrir configuração
          </Link>
        </section>

        <section className="rounded-lg border border-[var(--border-subtle)] p-4">
          <h2 className="font-medium text-[var(--foreground)]">Preferências</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Tema, linguagem, histórico, notificações…
          </p>
        </section>

        <section className="rounded-lg border border-[var(--border-subtle)] p-4">
          <h2 className="font-medium text-[var(--foreground)]">Acessos</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Perfis de usuário, papéis e permissões (em breve).
          </p>
        </section>
      </div>
    </div>
  )
}
