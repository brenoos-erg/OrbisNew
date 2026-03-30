import { redirect } from 'next/navigation'

export default function LegacyNcAlertsPage() {
  redirect('/dashboard/sgi/qualidade/nao-conformidades/alertas')
}
