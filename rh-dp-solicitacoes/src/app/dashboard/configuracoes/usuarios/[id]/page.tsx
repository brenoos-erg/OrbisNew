// src/app/dashboard/configuracoes/usuarios/[id]/page.tsx
import Client from './UserProfilePageClient'

// Este componente é SERVER (sem "use client")
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Next 15: params é uma Promise
  const { id } = await params
  return <Client userId={id} />
}