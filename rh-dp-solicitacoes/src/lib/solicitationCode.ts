import { prisma } from '@/lib/prisma'

export async function gerarProximoCodigo(departmentId: string) {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { sigla: true },
  })

  if (!dept?.sigla) throw new Error('Departamento sem sigla configurada.')

  const prefix = `RQ.${dept.sigla.toUpperCase()}.`
  const ultimo = await prisma.tipoSolicitacao.findFirst({
    where: { codigo: { startsWith: prefix } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  })

  const ultimoNumero = ultimo ? Number.parseInt(ultimo.codigo.split('.')[2] ?? '0', 10) : 0
  const proximoNumero = String(ultimoNumero + 1).padStart(3, '0')

  return `${prefix}${proximoNumero}`
}