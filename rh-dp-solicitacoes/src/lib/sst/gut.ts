export const GUT_OPTIONS = {
  gravidade: [
    { value: 1, label: '1 Sem gravidade' },
    { value: 2, label: '2 Pouco grave' },
    { value: 3, label: '3 Grave' },
    { value: 4, label: '4 Muito grave' },
    { value: 5, label: '5 Extremamente grave' },
  ],
  urgencia: [
    { value: 1, label: '1 Pode esperar' },
    { value: 2, label: '2 Pouco urgente' },
    { value: 3, label: '3 O mais rápido possível' },
    { value: 4, label: '4 É urgente' },
    { value: 5, label: '5 Precisa de ação imediata' },
  ],
  tendencia: [
    { value: 1, label: '1 Não irá mudar' },
    { value: 2, label: '2 Irá piorar em longo prazo' },
    { value: 3, label: '3 Irá piorar' },
    { value: 4, label: '4 Irá piorar em pouco tempo' },
    { value: 5, label: '5 Irá piorar rapidamente' },
  ],
} as const

export function gutClassificacao(score: number) {
  if (score <= 20) return 'BAIXA'
  if (score <= 60) return 'MÉDIA'
  return 'ALTA'
}