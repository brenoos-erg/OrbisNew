import { redirect } from 'next/navigation'

interface HomeProps {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function Home({ searchParams }: HomeProps) {
  const code = typeof searchParams?.code === 'string' ? searchParams.code : undefined
  const errorDescription = typeof searchParams?.error_description === 'string'
    ? searchParams.error_description
    : undefined

  if (code) {
    redirect(`/primeiro-acesso?code=${encodeURIComponent(code)}`)
  }

  if (errorDescription) {
    redirect(`/primeiro-acesso?error_description=${encodeURIComponent(errorDescription)}`)
  }

  redirect('/login')
}