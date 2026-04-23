import crypto from 'node:crypto'

export const EXTERNAL_ADMISSION_TYPE_ID = 'RQ_RH_ADMISSAO_EXTERNA'
export const EXTERNAL_ADMISSION_TYPE_CODE = 'RQ.RH.ADMISSAO.EXTERNA'
export const EXTERNAL_ADMISSION_TYPE_NAME = 'Documentação de admissão (externa RH)'

export const EXTERNAL_ADMISSION_STATUS = {
  WAITING: 'AGUARDANDO_ENVIO',
  SUBMITTED: 'ENVIADO_PELO_CANDIDATO',
  IN_REVIEW: 'EM_CONFERENCIA',
  PENDING: 'PENDENTE',
  DONE: 'CONCLUIDO',
} as const

export type ExternalAdmissionChecklistItem = {
  key: string
  label: string
  required: boolean
  group: 'geral' | 'casado' | 'filhos'
  maxFiles?: number
}

export const EXTERNAL_ADMISSION_CHECKLIST: ExternalAdmissionChecklistItem[] = [
  { key: 'foto_3x4', label: '1 foto 3x4 (atual)', required: true, group: 'geral' },
  { key: 'rg', label: 'Carteira de identidade', required: true, group: 'geral' },
  { key: 'cpf', label: 'CPF', required: true, group: 'geral' },
  { key: 'titulo_eleitor', label: 'Título de eleitor', required: true, group: 'geral' },
  { key: 'cnh', label: 'CNH', required: false, group: 'geral' },
  { key: 'reservista', label: 'Certificado de reservista', required: false, group: 'geral' },
  { key: 'ctps_digital', label: 'Carteira de trabalho digital', required: true, group: 'geral' },
  { key: 'curriculo', label: 'Currículo atualizado', required: true, group: 'geral' },
  { key: 'dados_bancarios', label: 'Dados bancários (conta, agência e pix)', required: true, group: 'geral' },
  { key: 'comprovante_endereco', label: '3 últimos comprovantes de endereço', required: true, group: 'geral', maxFiles: 3 },
  { key: 'pis_pasep', label: 'Documento de PIS/PASEP', required: true, group: 'geral' },
  { key: 'escolaridade', label: 'Comprovante de escolaridade', required: true, group: 'geral' },
  { key: 'vacinacao', label: 'Carteira de vacinação própria', required: true, group: 'geral' },
  { key: 'registro_profissional', label: 'Carteira de registro profissional', required: false, group: 'geral' },
  { key: 'laudo_pcd', label: 'Laudo médico (se PCD)', required: false, group: 'geral' },
  { key: 'antecedentes', label: 'Atestado de bons antecedentes', required: true, group: 'geral' },
  { key: 'ficha_candidato', label: 'Ficha do candidato digitalizada', required: true, group: 'geral' },
  { key: 'certidao_casamento', label: 'Certidão de casamento / união estável', required: false, group: 'casado' },
  { key: 'rg_cpf_conjuge', label: 'RG e CPF do cônjuge', required: false, group: 'casado' },
  { key: 'averbacao_divorcio', label: 'Averbação de casamento (divorciado)', required: false, group: 'casado' },
  { key: 'certidao_filhos', label: 'Certidão de nascimento / RG dos filhos', required: false, group: 'filhos' },
  { key: 'cpf_filhos', label: 'CPF dos filhos', required: false, group: 'filhos' },
  { key: 'vacina_filhos', label: 'Carteira de vacinação dos filhos < 5 anos', required: false, group: 'filhos' },
  { key: 'declaracao_escolar_filhos', label: 'Declaração escolar dos filhos < 14 anos', required: false, group: 'filhos' },
]

export function toTokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function normalizeCandidateName(value: string) {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
  return cleaned || 'CANDIDATO'
}

export function humanFileNameForChecklistItem(itemLabel: string, candidateName: string, index = 0) {
  const safeItem = itemLabel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
  const suffix = index > 0 ? ` (${index + 1})` : ''
  return `${safeItem} - ${normalizeCandidateName(candidateName)}${suffix}.pdf`
}

export function resolveChecklistItem(key: string) {
  return EXTERNAL_ADMISSION_CHECKLIST.find((item) => item.key === key) ?? null
}

export function isAllRequiredChecklistDone(checklistStatus: Record<string, boolean>) {
  return EXTERNAL_ADMISSION_CHECKLIST.filter((item) => item.required).every((item) => checklistStatus[item.key] === true)
}

type TipoLike = { codigo?: string | null; nome?: string | null }

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function isExternalAdmissionCandidateType(tipo: TipoLike | null | undefined) {
  const codigo = normalizeText(tipo?.codigo)
  const nome = normalizeText(tipo?.nome)
  return codigo.includes('admiss') || nome.includes('admissao') || nome.includes('pre-admiss')
}

export function patchExternalAdmissionPayloadSeed(payload: Record<string, unknown>) {
  const current = payload.externalAdmission
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    return payload
  }

  return {
    ...payload,
    externalAdmission: {
      candidateAccess: {
        mode: 'TOKEN_LINK',
        status: 'PENDING_LINK',
        tokenId: null,
        linkSentAt: null,
        submittedAt: null,
      },
      checklist: {
        status: 'PENDING',
        requiredDocuments: [],
        reviewedAt: null,
        reviewedById: null,
      },
      triage: {
        status: 'PENDING_RH',
        notes: '',
      },
    },
  }
}
