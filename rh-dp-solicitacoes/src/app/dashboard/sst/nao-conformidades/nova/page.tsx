import { redirect } from 'next/navigation'

export default function LegacyNovaNaoConformidadePage() {
  redirect('/dashboard/sgi/qualidade/nao-conformidades/nova')
}