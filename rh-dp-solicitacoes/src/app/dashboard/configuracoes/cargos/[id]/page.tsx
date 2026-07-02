import { redirect } from 'next/navigation'

type Params = { params: Promise<{ id: string }> }

export default async function CargoRedirectPage({ params }: Params) {
  const { id } = await params
  redirect(`/dashboard/rh/cargos/${id}`)
}
