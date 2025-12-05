const sampleCheckins = [
  {
    driver: 'Paulo Almeida',
    vehicle: 'ABC-1D23 · Fiat Uno',
    date: 'Hoje • 07:45',
    summary: 'Sem avarias. Pneus ok, combustível 3/4, partida normal.',
  },
  {
    driver: 'Camila Prado',
    vehicle: 'JKL-7M89 · Renault Kangoo',
    date: 'Hoje • 08:10',
    summary: 'Observação: ruído ao frear. Abri chamado de manutenção preventiva.',
  },
  {
    driver: 'Marcos Silva',
    vehicle: 'XYZ-4F56 · Chevrolet S10',
    date: 'Ontem • 17:32',
    summary: 'Veículo ficou na oficina para troca de pastilhas e alinhamento.',
  },
]

export default function FleetCheckinsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Check-ins diários</h1>
        <p className="text-slate-600 mt-2 max-w-4xl">
          Aqui os registros enviados pelos colaboradores aparecerão automaticamente. Cada check-in deve capturar os
          campos essenciais (placa, quilometragem, nível de combustível, fotos e observações). Assim que você enviar os
          campos do formulário definitivo, conectamos estes cartões à coleta real.
        </p>
      </header>

      <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
        Estamos prontos para receber os campos do seu formulário. Envie os itens obrigatórios (como pneus, freios,
        iluminação, estado interno e fotos) e incluiremos na tela de check-ins para uso diário.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sampleCheckins.map((checkin) => (
          <article key={`${checkin.vehicle}-${checkin.date}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{checkin.vehicle}</p>
                <p className="text-lg font-semibold text-slate-900">{checkin.driver}</p>
              </div>
              <span className="text-xs font-medium text-slate-500">{checkin.date}</span>
            </div>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">{checkin.summary}</p>
            <div className="mt-4 flex gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">Condições gerais</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Combustível</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Fotos</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}