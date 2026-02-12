import { redirect } from 'next/navigation'

interface HomeProps {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: HomeProps) {
  const sp = await Promise.resolve(searchParams)

  const code = typeof sp?.code === 'string' ? sp.code : undefined
  const errorDescription = typeof sp?.error_description === 'string'
    ? sp.error_description
    : undefined

  if (code) {
    redirect(`/primeiro-acesso?code=${encodeURIComponent(code)}`)
  }

  if (errorDescription) {
    redirect(`/primeiro-acesso?error_description=${encodeURIComponent(errorDescription)}`)
  }

  redirect('/login')
}