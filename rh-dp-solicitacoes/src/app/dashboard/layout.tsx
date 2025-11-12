import Link from 'next/link'
import { ClipboardList, ChevronLeft, Send, Inbox, FolderCog, Settings, Users, Shield } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import UserMenu from '@/components/layout/userMenu'

// Server Component
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { appUser } = await getCurrentAppUser()

  let showSolic = false
  let showConfig = false

  if (appUser?.costCenterId) {
    // lê os módulos habilitados para o CC do usuário
    const ccModules = await prisma.costCenterModule.findMany({
      where: { costCenterId: appUser.costCenterId },
      include: { module: { select: { key: true } } },
    })
    const enabled = new Set(ccModules.map((r) => r.module.key))

    // só aparece se o CC tiver o módulo
    showSolic = enabled.has('solicitacoes')
    showConfig = enabled.has('configuracoes')
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex">
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#0f172a] text-slate-200 shadow-xl flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-4 border-b border-white/10">
            <div className="font-semibold">Sistema de Solicitações</div>
          </div>

          <nav className="px-3 space-y-2 mt-2">
            {showSolic && (
              <div>
                <div className="w-full flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-md bg-orange-500 text-white shadow-sm">
                  <ClipboardList className="h-5 w-5 shrink-0" />
                  <span>Solicitações</span>
                  <span className="ml-auto"><ChevronLeft size={16} className="rotate-90" /></span>
                </div>

                <div className="mt-1 ml-9 flex flex-col gap-1">
                  <Link href="/dashboard/solicitacoes/enviadas"  className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><Send size={16}/> <span>Solicitações Enviadas</span></Link>
                  <Link href="/dashboard/solicitacoes/recebidas" className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><Inbox size={16}/> <span>Solicitações Recebidas</span></Link>
                  <Link href="/dashboard/solicitacoes/cadastros" className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><FolderCog size={16}/> <span>Cadastros</span></Link>
                </div>
              </div>
            )}

            {showConfig && (
              <div>
                <div className="w-full flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-md bg-orange-500 text-white shadow-sm">
                  <Settings className="h-5 w-5 shrink-0" />
                  <span>Configurações</span>
                  <span className="ml-auto"><ChevronLeft size={16} className="rotate-90" /></span>
                </div>

                <div className="mt-1 ml-9 flex flex-col gap-1">
                  <Link href="/dashboard/configuracoes"                      className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><Settings size={16}/> <span>Painel</span></Link>
                  <Link href="/dashboard/configuracoes/usuarios"              className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><Users size={16}/>    <span>Usuários</span></Link>
                  <Link href="/dashboard/configuracoes/permissoes"            className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><Shield size={16}/>   <span>Permissões</span></Link>
                  <Link href="/dashboard/configuracoes/centros-de-custo"      className="group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3 text-slate-200 hover:bg-orange-500/90 hover:text-white"><FolderCog size={16}/> <span>Centros de Custo</span></Link>
                </div>
              </div>
            )}
          </nav>
        </div>

        <div className="px-3 py-3 border-t border-white/10">
          <UserMenu collapsed={false} />
        </div>
      </aside>

      <main className="flex-1 bg-white ml-72">
        <div className="h-16 border-b border-slate-200 flex items-center px-6 text-sm text-slate-600">
          Sistema de Solicitações
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
