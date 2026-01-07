import TiEquipmentsPanel from '@/components/ti/TiEquipmentsPanel'

export default function AtalhoTiPage() {
  return (
    <TiEquipmentsPanel
      initialCategory="ALL"
      lockCategory
      enableScanShortcut
      title="Atalho de controle TI"
      subtitle="Atalho rápido para buscar equipamentos pelo patrimônio e atualizar os dados com o leitor de código de barras."
    />
  )
}