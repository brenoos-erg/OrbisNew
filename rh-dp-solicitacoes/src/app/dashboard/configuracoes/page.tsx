export default function ConfiguracoesPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-800">Configurações</h1>
      <p className="text-sm text-slate-500 mt-1">
        Ajuste preferências do sistema e permissões dos módulos.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-medium text-slate-700">Preferências</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tema, linguagem, histórico, notificações…
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-medium text-slate-700">Acessos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Perfis de usuário, papéis e permissões (em breve).
          </p>
        </section>
      </div>
    </div>
  )
}
