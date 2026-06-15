'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, XCircle } from 'lucide-react'

type Room = 'OURO' | 'SOLAR' | 'DIAMANTE'
type UserOption = {
  id: string
  fullName: string
  email: string
  login?: string | null
  phone?: string | null
  costCenterName?: string | null
}

type Booking = {
  id: string
  room: Room
  title: string
  meetingType: string
  description?: string | null
  startsAt: string
  endsAt: string
  requesterName?: string | null
  createdByName?: string | null
  status: 'AGENDADA' | 'CANCELADA' | 'CONCLUIDA'
  canceledAt?: string | null
  canceledById?: string | null
}

const rooms: { key: Room; label: string }[] = [
  { key: 'OURO', label: 'Ouro' },
  { key: 'SOLAR', label: 'Solar' },
  { key: 'DIAMANTE', label: 'Diamante' },
]
const meetingTypes = ['Interna', 'Cliente', 'Treinamento', 'Entrevista', 'Outro']
const todayInput = () => new Date().toISOString().slice(0, 10)
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('pt-BR')

export default function MeetingRoomSchedulingPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'view'>('form')
  const [date, setDate] = useState(todayInput())
  const [roomFilter, setRoomFilter] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [scheduleForAnotherUser, setScheduleForAnotherUser] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserOption | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [conflictBookings, setConflictBookings] = useState<Booking[]>([])
  const [conflictLoading, setConflictLoading] = useState(false)
  const [form, setForm] = useState({
    meetingType: 'Interna',
    title: '',
    room: 'OURO' as Room,
    date: todayInput(),
    startTime: '08:00',
    endTime: '09:00',
    requesterName: '',
    requesterEmail: '',
    description: '',
  })

  const loadCurrentUser = async () => {
    const response = await fetch('/api/agendamento-salas/me', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.user) {
      setMessage(data.error ?? 'Não foi possível carregar o usuário logado.')
      return
    }
    setCurrentUser(data.user)
    setForm((current) => ({ ...current, requesterName: data.user.fullName ?? '', requesterEmail: data.user.email ?? '' }))
  }

  const loadUsers = async (search = userSearch) => {
    setUsersLoading(true)
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    const response = await fetch(`/api/agendamento-salas/usuarios?${params.toString()}`, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    setUsersLoading(false)
    if (response.ok) setUsers(data.users ?? [])
    else setMessage(data.error ?? 'Não foi possível carregar usuários.')
  }

  const loadBookings = async () => {
    const params = new URLSearchParams({ date })
    if (roomFilter) params.set('room', roomFilter)
    const response = await fetch(`/api/agendamento-salas?${params.toString()}`, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (response.ok) setBookings(data.bookings ?? [])
    else setMessage(data.error ?? 'Não foi possível carregar a agenda.')
  }

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    loadBookings()
  }, [date, roomFilter])

  useEffect(() => {
    if (!scheduleForAnotherUser) return
    const timeout = window.setTimeout(() => {
      loadUsers(userSearch)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [scheduleForAnotherUser, userSearch])

  useEffect(() => {
    const loadFormDateBookings = async () => {
      setConflictLoading(true)
      const params = new URLSearchParams({ date: form.date, room: form.room, status: 'AGENDADA' })
      const response = await fetch(`/api/agendamento-salas?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      setConflictLoading(false)
      if (response.ok) setConflictBookings(data.bookings ?? [])
    }
    loadFormDateBookings()
  }, [form.date, form.room])

  const activeBookings = useMemo(() => bookings.filter((booking) => booking.status === 'AGENDADA'), [bookings])

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [users, selectedUserId])

  const scheduleConflict = useMemo(() => {
    const startsAt = new Date(`${form.date}T${form.startTime}:00`)
    const endsAt = new Date(`${form.date}T${form.endTime}:00`)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) return null
    return conflictBookings.find((booking) => new Date(booking.startsAt) < endsAt && new Date(booking.endsAt) > startsAt) ?? null
  }, [conflictBookings, form.date, form.startTime, form.endTime])

  const handleScheduleForAnotherUserChange = (checked: boolean) => {
    setScheduleForAnotherUser(checked)
    if (checked) {
      loadUsers(userSearch)
      return
    }
    setSelectedUserId('')
    if (currentUser) {
      setForm((current) => ({ ...current, requesterName: currentUser.fullName, requesterEmail: currentUser.email }))
    }
  }

  const handleUserSelection = (userId: string) => {
    setSelectedUserId(userId)
    const user = users.find((item) => item.id === userId)
    if (!user) return
    setForm((current) => ({ ...current, requesterName: user.fullName, requesterEmail: user.email }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (scheduleConflict) {
      setMessage('Sala já reservada nesse horário. Ajuste a sala ou o horário antes de agendar.')
      return
    }
    setLoading(true)
    setMessage('')
    const response = await fetch('/api/agendamento-salas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: form.room,
        title: form.title,
        meetingType: form.meetingType,
        description: form.description,
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        startsAt: `${form.date}T${form.startTime}:00`,
        endsAt: `${form.date}T${form.endTime}:00`,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    setMessage(data.message ?? data.error ?? (response.ok ? 'Agendamento criado com sucesso.' : 'Erro ao agendar reunião.'))
    if (response.ok) {
      setDate(form.date)
      setActiveTab('view')
      await loadBookings()
    }
  }

  const cancelBooking = async (id: string) => {
    const cancelReason = window.prompt('Motivo do cancelamento:') ?? ''
    const response = await fetch(`/api/agendamento-salas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelReason }),
    })
    const data = await response.json().catch(() => ({}))
    setMessage(data.message ?? data.error ?? 'Agendamento cancelado.')
    if (response.ok) await loadBookings()
  }

  const copySummary = async (booking: Booking) => {
    const room = rooms.find((item) => item.key === booking.room)?.label ?? booking.room
    const summary = `Reunião: ${booking.title}\nSala: ${room}\nData: ${dateFmt.format(new Date(booking.startsAt))}\nHorário: ${timeFmt.format(new Date(booking.startsAt))} - ${timeFmt.format(new Date(booking.endsAt))}\nResponsável: ${booking.requesterName || booking.createdByName || '-'}`
    await navigator.clipboard.writeText(summary)
    setMessage('Resumo da reunião copiado.')
  }

  const shiftDay = (days: number) => {
    const next = new Date(`${date}T00:00:00`)
    next.setDate(next.getDate() + days)
    setDate(next.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Recepção</p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Agendamento de Salas</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Controle das salas Ouro, Solar e Diamante com prevenção de conflitos.</p>
          </div>
          <CalendarDays className="h-10 w-10 text-orange-500" />
        </div>
      </div>

      <div className="flex gap-2">
        <button className={`app-button-${activeTab === 'form' ? 'primary' : 'secondary'}`} onClick={() => setActiveTab('form')}>Marcar reunião</button>
        <button className={`app-button-${activeTab === 'view' ? 'primary' : 'secondary'}`} onClick={() => setActiveTab('view')}>Visualização</button>
      </div>

      {message && <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{message}</div>}

      {activeTab === 'form' ? (
        <form onSubmit={submit} className="grid gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-6 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Tipo de reunião<select className="app-input" value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })}>{meetingTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="space-y-1 text-sm font-medium">Sala<select className="app-input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value as Room })}>{rooms.map((room) => <option key={room.key} value={room.key}>{room.label}</option>)}</select></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Título/Assunto<input className="app-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="space-y-1 text-sm font-medium">Data<input className="app-input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="space-y-1 text-sm font-medium">Hora início<input className="app-input" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
          <label className="space-y-1 text-sm font-medium">Hora fim<input className="app-input" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input type="checkbox" checked={scheduleForAnotherUser} onChange={(e) => handleScheduleForAnotherUserChange(e.target.checked)} /> Agendar para outra pessoa</label>
          {scheduleForAnotherUser && (
            <>
              <label className="space-y-1 text-sm font-medium">Pesquisar usuário<input className="app-input" placeholder="Digite nome, e-mail ou login" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></label>
              <label className="space-y-1 text-sm font-medium">Usuário<select className="app-input" value={selectedUserId} onChange={(e) => handleUserSelection(e.target.value)}><option value="">{usersLoading ? 'Carregando usuários...' : 'Selecione um usuário'}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.email}{user.login ? ` · ${user.login}` : ''}</option>)}</select></label>
              {selectedUser && <p className="text-sm text-[var(--muted-foreground)] md:col-span-2">{selectedUser.costCenterName ? `Centro de custo: ${selectedUser.costCenterName}` : ''}{selectedUser.costCenterName && selectedUser.phone ? ' · ' : ''}{selectedUser.phone ? `Telefone: ${selectedUser.phone}` : ''}</p>}
            </>
          )}
          <label className="space-y-1 text-sm font-medium">Solicitante/Responsável<input className="app-input" readOnly value={form.requesterName} /></label>
          <label className="space-y-1 text-sm font-medium">E-mail do solicitante<input className="app-input" type="email" readOnly value={form.requesterEmail} /></label>
          {scheduleConflict && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">Sala já reservada neste horário: {scheduleConflict.title} ({timeFmt.format(new Date(scheduleConflict.startsAt))} - {timeFmt.format(new Date(scheduleConflict.endsAt))}).</div>}
          <label className="space-y-1 text-sm font-medium md:col-span-2">Observações<textarea className="app-input min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="md:col-span-2"><button disabled={loading || conflictLoading || !!scheduleConflict} className="app-button-primary" type="submit">{loading ? 'Agendando...' : 'Agendar reunião'}</button></div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-4">
            <button className="app-button-secondary" onClick={() => shiftDay(-1)}><ChevronLeft size={16} /> Dia anterior</button>
            <label className="space-y-1 text-sm font-medium">Data<input className="app-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <button className="app-button-secondary" onClick={() => setDate(todayInput())}>Hoje</button>
            <button className="app-button-secondary" onClick={() => shiftDay(1)}>Próximo dia <ChevronRight size={16} /></button>
            <label className="space-y-1 text-sm font-medium">Filtro por sala<select className="app-input" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}><option value="">Todas</option>{rooms.map((room) => <option key={room.key} value={room.key}>{room.label}</option>)}</select></label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {rooms.map((room) => {
              const roomBookings = activeBookings.filter((booking) => booking.room === room.key)
              const now = new Date()
              const current = roomBookings.find((booking) => new Date(booking.startsAt) <= now && new Date(booking.endsAt) > now)
              const next = roomBookings.find((booking) => new Date(booking.startsAt) > now)
              const status = current ? `Em uso até ${timeFmt.format(new Date(current.endsAt))}` : next ? `Próxima reunião às ${timeFmt.format(new Date(next.startsAt))}` : 'Livre agora'
              return (
                <section key={room.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Sala {room.label}</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{status}</span></div>
                  <div className="space-y-3">
                    {roomBookings.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">Sala disponível no horário selecionado.</p>}
                    {roomBookings.map((booking) => (
                      <div key={booking.id} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                        <p className="font-semibold">{booking.title}</p>
                        <p>{timeFmt.format(new Date(booking.startsAt))} - {timeFmt.format(new Date(booking.endsAt))} · {booking.meetingType}</p>
                        <p className="text-[var(--muted-foreground)]">Agendado por: {booking.createdByName || '-'}</p>
                        <p className="text-[var(--muted-foreground)]">Responsável: {booking.requesterName || '-'}</p>
                        <div className="mt-2 flex gap-2"><button className="app-button-secondary" onClick={() => copySummary(booking)}><Copy size={14} /> Copiar resumo</button><button className="app-button-secondary" onClick={() => cancelBooking(booking.id)}><XCircle size={14} /> Cancelar</button></div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
