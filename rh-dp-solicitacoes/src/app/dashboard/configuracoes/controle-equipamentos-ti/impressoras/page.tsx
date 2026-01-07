import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function ImpressorasPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="IMPRESSORA"
      lockCategory
      title="Impressoras"
      subtitle="Controle de impressoras e multifuncionais em uso."
    />
  )
}