import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function DesktopsPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="DESKTOP"
      lockCategory
      title="Desktops"
      subtitle="Controle de desktops, estações de trabalho e equipamentos fixos."
    />
  )
}