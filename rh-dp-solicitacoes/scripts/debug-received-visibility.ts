import { prisma } from '@/lib/prisma'
import { getUserReceivedVisibilityScope, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { extractNadaConstaSectorKeys, isNadaConstaSolicitation, userCanSeeNadaConstaBySector } from '@/lib/solicitationVisibility'

const arg=(f:string)=>{const a=process.argv.slice(2);const i=a.indexOf(f);return i>=0?a[i+1]??null:null}

async function main(){
  const userArg=arg('--user'); const protocolArg=arg('--protocol');
  if(!userArg) throw new Error('Uso: npm run debug:received-visibility -- --user <login> [--protocol RQ...]')
  const user=await prisma.user.findFirst({where:{login:userArg},include:{department:true}})
  if(!user) throw new Error(`Usuário não encontrado: ${userArg}`)
  const scope=await getUserReceivedVisibilityScope(user.id)
  const access=await resolveUserAccessContext({userId:user.id,userLogin:user.login,userEmail:user.email,userFullName:user.fullName,role:user.role,primaryDepartmentId:user.departmentId,primaryDepartment:user.department})
  const where:any={ tipo:{ nome:{ contains:'nada consta', mode:'insensitive' } } }
  if(protocolArg) where.protocolo=protocolArg
  const solicitacoes=await prisma.solicitation.findMany({where,orderBy:{dataAbertura:'desc'},take:protocolArg?1:100,include:{tipo:true,solicitacaoSetores:true,department:true,costCenter:true}})

  console.log(JSON.stringify({
    usuario:{id:user.id,nome:user.fullName,login:user.login,email:user.email},
    departamentosVinculados:scope?.linkedDepartments??[],
    centrosCustoVinculados:scope?.linkedCostCenters??[],
    sectorKeysNormalizadas:scope?.sectorKeys??[],
    protocolosNadaConstaEncontrados:solicitacoes.map(s=>s.protocolo),
    diagnostico:solicitacoes.map((s)=>{const setorKeys=extractNadaConstaSectorKeys(s as any);const matched=userCanSeeNadaConstaBySector(access,s as any);return{protocolo:s.protocolo,isNadaConsta:isNadaConstaSolicitation(s),setoresExtraidos:setorKeys,shouldAppear:matched,motivo:matched?'match em setor/departamento/centro':'sem interseção com escopo do usuário'}})
  },null,2))
}

main().finally(()=>prisma.$disconnect())
