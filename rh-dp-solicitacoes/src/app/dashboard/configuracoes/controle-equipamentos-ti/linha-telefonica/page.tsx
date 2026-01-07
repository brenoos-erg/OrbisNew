import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function LinhasTelefonicasPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="LINHA_TELEFONICA"
      lockCategory
      title="Linhas telefônicas"
      subtitle="Controle de linhas telefônicas e chips ativos."
    />
  )
}