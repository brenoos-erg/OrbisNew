import { redirect } from 'next/navigation'

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>

interface HomeProps {
  searchParams: HomeSearchParams
}

export default async function Home({ searchParams }: HomeProps) {
  const sp = await searchParams

  const code = typeof sp?.code === 'string' ? sp.code : undefined
  const errorDescription =
    typeof sp?.error_description === 'string' ? sp.error_description : undefined

  if (code) {
    redirect(`/primeiro-acesso?code=${encodeURIComponent(code)}`)
  }

  if (errorDescription) {
    redirect(
      `/primeiro-acesso?error_description=${encodeURIComponent(errorDescription)}`,
    )
  }

  redirect('/login')
}