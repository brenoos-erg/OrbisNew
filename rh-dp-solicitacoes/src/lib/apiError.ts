export function getErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string') {
      return maybeMessage
    }
  }

  return 'Erro sem detalhe disponível.'
}

export function devErrorDetail(error: unknown) {
  if (process.env.NODE_ENV === 'production') return undefined
  return getErrorDetail(error)
}