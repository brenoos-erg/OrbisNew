import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function SmartphonesPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="SMARTPHONE"
      lockCategory
      title="Smartphones"
      subtitle="Controle de smartphones corporativos e aparelhos móveis."
    />
  )
}