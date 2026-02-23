import { prisma } from '@/lib/prisma'
import {
  NADA_CONSTA_SETORES,
  resolveNadaConstaSetoresByDepartment,
  type NadaConstaSetorKey,
} from '@/lib/solicitationTypes'

type TipoMeta = {
  centros?: string[]
  departamentos?: string[]
  fluxo?: {
    multiSetor?: boolean
    rhApproval?: boolean
    rhToDp?: boolean
    dpDepartmentCode?: string
  }
}

type SchemaJson = { meta?: TipoMeta }

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string')
}

const MULTI_SETOR_DEPARTMENT_CODES = ['08', '20', '11', '19', '10', '06']

export async function resolveResponsibleDepartmentsByTipo(tipoId: string) {
  const tipo = await prisma.tipoSolicitacao.findUnique({
    where: { id: tipoId },
    select: { schemaJson: true, nome: true },
  })

  const schema = (tipo?.schemaJson ?? null) as SchemaJson | null
  const departamentosMeta = asStringArray(schema?.meta?.departamentos)
  const multiSetor = Boolean(schema?.meta?.fluxo?.multiSetor)

  const mainDepartmentId = departamentosMeta[0] ?? null

  if (multiSetor) {
    const departments = await prisma.department.findMany({
      where: { code: { in: MULTI_SETOR_DEPARTMENT_CODES } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })

    const targetDepartmentIds = departments.map((d) => d.id)
    const targetSetores = new Set<NadaConstaSetorKey>()
    for (const dept of departments) {
      const setores = resolveNadaConstaSetoresByDepartment(dept)
      for (const setor of setores) targetSetores.add(setor)
    }

    const knownSetorKeys = new Set(NADA_CONSTA_SETORES.map((setor) => setor.key))
    const targetSetorKeys = Array.from(targetSetores).filter((key) =>
      knownSetorKeys.has(key),
    )

    return {
      mainDepartmentId: mainDepartmentId ?? targetDepartmentIds[0] ?? null,
      targetDepartmentIds,
      targetSetorKeys,
      multiSetor: true,
    }
  }

  return {
    mainDepartmentId,
    targetDepartmentIds: mainDepartmentId ? [mainDepartmentId] : [],
    targetSetorKeys: [] as NadaConstaSetorKey[],
    multiSetor: false,
  }
}