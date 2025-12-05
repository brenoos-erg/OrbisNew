export default function FleetDashboardPage() {
  const fleetHighlights = [
    {
      title: 'Veículos ativos',
      value: '28',
      description: 'Carros liberados para uso diário',
    },
    {
      title: 'Manutenções abertas',
      value: '3',
      description: 'Veículos aguardando passagem pela oficina',
    },
    {
      title: 'Check-ins de hoje',
      value: '19/28',
      description: 'Registros concluídos pelos motoristas no turno',
    },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
          <h1 className="text-3xl font-bold text-slate-900">Painel geral</h1>
        </div>
        <p className="text-slate-600 max-w-3xl">
          Acompanhe rapidamente o estado da frota, veja veículos liberados e mantenha os check-ins diários sob
          controle. Use o menu para abrir a listagem de veículos ou revisar os formulários preenchidos pelos
          colaboradores.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {fleetHighlights.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-sm text-slate-600">{card.description}</p>
          </div>
        ))}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Controle da frota</h2>
          <p className="text-sm text-slate-600">
            Cadastre novos veículos, consulte status e registre manutenções. A listagem de veículos traz ações rápidas
            para editar, desativar ou remover itens da frota.
          </p>
          <div className="flex gap-3 flex-wrap">
            <a
              href="/dashboard/gestao-de-frotas/veiculos"
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
            >
              Abrir veículos
            </a>
            <a
              href="/dashboard/gestao-de-frotas/checkins"
              className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-slate-800 hover:bg-slate-200"
            >
              Ver check-ins
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Check-ins em campo</h2>
          <p className="text-sm text-slate-600">
            Os colaboradores preenchem um formulário curto toda vez que pegam o veículo. Nele é registrado o estado
            dos pneus, nível de combustível, quilometragem atual e qualquer avaria. Assim que enviar os campos, podemos
            incluir aqui e gerar notificações automáticas.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
            <li>Registro diário obrigatório por veículo.</li>
            <li>Alertas rápidos para itens críticos (ex.: pneus ou bateria).</li>
            <li>Histórico disponível para auditoria e manutenção.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}