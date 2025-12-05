const vehicles = [
  {
    plate: 'ABC-1D23',
    model: 'Fiat Uno Attractive',
    status: 'Disponível',
    km: '32.540 km',
    driver: 'Marcos Silva',
    fuel: '3/4 tanque',
  },
  {
    plate: 'XYZ-4F56',
    model: 'Chevrolet S10 LTZ',
    status: 'Em manutenção',
    km: '68.210 km',
    driver: '—',
    fuel: '1/2 tanque',
  },
  {
    plate: 'JKL-7M89',
    model: 'Renault Kangoo Express',
    status: 'Em uso',
    km: '15.980 km',
    driver: 'Patrícia Gomes',
    fuel: 'Cheio',
  },
  {
    plate: 'QWE-0R12',
    model: 'Volkswagen Saveiro',
    status: 'Disponível',
    km: '23.410 km',
    driver: '—',
    fuel: '5/8 tanque',
  },
]

function getStatusColor(status: string) {
  switch (status) {
    case 'Disponível':
      return 'bg-green-100 text-green-800'
    case 'Em manutenção':
      return 'bg-amber-100 text-amber-800'
    case 'Em uso':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

export default function VehiclesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Veículos</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Cadastre, edite, desative ou exclua veículos da frota. Esta listagem exibe o status, o motorista atual e a
          última leitura de quilometragem para facilitar decisões rápidas.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600">
          Cadastrar veículo
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-slate-800 hover:bg-slate-200">
          Exportar planilha
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Placa</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Modelo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Motorista</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">KM</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Combustível</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.plate} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{vehicle.plate}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{vehicle.model}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{vehicle.driver}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{vehicle.km}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{vehicle.fuel}</td>
                <td className="px-6 py-4 text-right text-sm text-slate-700">
                  <div className="inline-flex gap-2">
                    <button className="rounded-md border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-100">
                      Editar
                    </button>
                    <button className="rounded-md border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-100">
                      Status
                    </button>
                    <button className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100">
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}