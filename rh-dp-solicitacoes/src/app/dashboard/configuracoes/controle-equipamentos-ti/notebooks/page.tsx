import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function NotebooksPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="NOTEBOOK"
      lockCategory
      title="Notebooks"
      subtitle="Inventário de notebooks e status de uso por colaborador."
    />
  )
}