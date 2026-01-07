import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function OutrosEquipamentosPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="OUTROS"
      lockCategory
      title="Outros equipamentos"
      subtitle="Controle de periféricos e demais equipamentos de TI."
    />
  )
}