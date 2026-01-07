import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function MonitoresPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="MONITOR"
      lockCategory
      title="Monitores"
      subtitle="Gestão de monitores e telas externas da TI."
    />
  )
}