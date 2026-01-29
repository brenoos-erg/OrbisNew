type TipoSolicitacaoLike = {
  id?: string | null
  nome?: string | null
}

export function isSolicitacaoDesligamento(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_247') return true
  const nome = tipo.nome?.trim().toUpperCase() ?? ''
  return nome.includes('DESLIGAMENTO')
}