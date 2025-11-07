export default function ConfiguracoesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">
        Configurações do Sistema
      </h1>

      <p className="text-slate-600 mb-6">
        Gerencie as opções administrativas do sistema, como cadastro de usuários,
        permissões, e outras definições gerais.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <a
          href="/dashboard/configuracoes/usuarios"
          className="block rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Usuários</h2>
          <p className="text-sm text-slate-500">
            Cadastre e gerencie os usuários do sistema.
          </p>
        </a>

        <a
          href="/dashboard/configuracoes/permissoes"
          className="block rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Permissões</h2>
          <p className="text-sm text-slate-500">
            Defina papéis, cargos e níveis de acesso.
          </p>
        </a>

        <a
          href="#"
          className="block rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition"
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Preferências</h2>
          <p className="text-sm text-slate-500">
            Personalize notificações e preferências gerais.
          </p>
        </a>
      </div>
    </div>
  )
}
