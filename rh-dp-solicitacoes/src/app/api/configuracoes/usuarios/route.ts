export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const fullName = (body.fullName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const login = (body.login ?? '').trim().toLowerCase()
    const phone = (body.phone ?? '').trim() || null
    const costCenterId = (body.costCenterId ?? '').trim() || null
    const rawPassword = (body.password ?? '').trim()
    const firstAccess = !!body.firstAccess

    if (!fullName || !email || !login) {
      return NextResponse.json(
        { error: 'Nome, e-mail e login são obrigatórios.' },
        { status: 400 },
      )
    }

    // 0) Supabase Admin
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // senha efetiva
    const effectivePassword =
      firstAccess && !rawPassword ? `${login}@123` : (rawPassword || crypto.randomUUID())

    // 0.1) AUTH: se já existir usuário com esse email, reaproveita
    let authId: string | null = null

    const { data: got, error: getErr } = await sb.auth.admin.getUserByEmail(email)
    if (getErr) {
      return NextResponse.json(
        { error: 'Falha ao consultar Auth: ' + getErr.message },
        { status: 500 },
      )
    }

    if (got?.user?.id) {
      authId = got.user.id

      // opcional: atualizar senha/metadados
      const { error: upErr } = await sb.auth.admin.updateUserById(authId, {
        password: effectivePassword,
        user_metadata: {
          fullName,
          login,
          phone,
          costCenterId,
          mustChangePassword: firstAccess,
        },
      })
      if (upErr) {
        return NextResponse.json(
          { error: 'Falha ao atualizar usuário no Auth: ' + upErr.message },
          { status: 500 },
        )
      }
    } else {
      // cria do zero
      const { data: createdAuth, error: createErr } = await sb.auth.admin.createUser({
        email,
        password: effectivePassword,
        email_confirm: true,
        user_metadata: {
          fullName,
          login,
          phone,
          costCenterId,
          mustChangePassword: firstAccess,
        },
      })

      if (createErr) {
        return NextResponse.json(
          { error: 'Falha ao criar no Auth: ' + createErr.message },
          { status: 500 },
        )
      }

      authId = createdAuth?.user?.id ?? null
    }

    // 1) Prisma (cria ou atualiza se já existir)
    // Se seu banco tiver UNIQUE em email/login, isso evita quebrar no massivo
    const created = await prisma.user.upsert({
      where: { email }, // <-- precisa email ser UNIQUE no Prisma
      create: { fullName, email, login, phone, costCenterId, authId: authId ?? undefined },
      update: { fullName, login, phone, costCenterId, authId: authId ?? undefined },
      select: { id: true, fullName: true, email: true, login: true },
    })

    // 1.1) vínculo centro de custo (evita duplicar)
    if (costCenterId) {
      await prisma.userCostCenter.upsert({
        where: {
          userId_costCenterId: { userId: created.id, costCenterId }, // precisa @@unique([userId,costCenterId])
        },
        create: { userId: created.id, costCenterId },
        update: {},
      })
    }

    // 1.2) nível no módulo solicitacoes (evita duplicar)
    const modules = await prisma.module.findMany({
      where: { key: 'solicitacoes' },
      select: { id: true },
    })

    if (modules.length > 0) {
      await prisma.userModuleAccess.createMany({
        data: modules.map((m) => ({
          userId: created.id,
          moduleId: m.id,
          level: 'NIVEL_1' as any,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'E-mail ou login já cadastrado.' }, { status: 409 })
    }
    console.error('POST /api/configuracoes/usuarios error', e)
    return NextResponse.json({ error: e?.message || 'Erro ao criar usuário.' }, { status: 500 })
  }
}
