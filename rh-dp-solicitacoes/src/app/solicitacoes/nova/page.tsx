'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type TipoCampo = {
    name: string
    label: string
    type?: string
    required?: boolean
}

type TipoSolicitacao = {
    id: string
    codigo: string
    nome: string
    descricao?: string
    camposEspecificos?: TipoCampo[]
}
export default function NovaSolicitacaoPage() {
    const router = useRouter()
    // tipos de solicitação
    const [tipos, setTipos] = useState<TipoSolicitacao[]>([])

    // formulário principal
    const [form, setForm] = useState({
        titulo: '',
        descricao: '',
        setorDestino: 'RH',
        tipoId: '',
        autorId: 'meu-user-id-temp', // depois você troca pelo usuário logado
    })


    // campos dinâmicos (payload)
    const [extras, setExtras] = useState<Record<string, any>>({})
    const [submitting, setSubmitting] = useState(false)
    const idempotencyKeyRef = useRef(globalThis.crypto.randomUUID())
    // carregar tipos de solicitação
    useEffect(() => {
        async function loadTipos() {
            try {
                const res = await fetch('/api/tipos-solicitacao')
                if (!res.ok) {
                    console.error('Erro ao carregar tipos')
                    return
                }
                const data = await res.json()
                setTipos(data)
            } catch (err) {
                console.error('Erro ao carregar tipos', err)
            }
        }

        loadTipos()
    }, [])


    // campos fixos
    const onChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }


    // enviar formulário
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (submitting) return

        setSubmitting(true)
        try {
            await fetch('/api/solicitacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...form,
                payload: extras, // aqui vão os campos da RQ_063
                idempotencyKey: idempotencyKeyRef.current,
            }),
        })

            idempotencyKeyRef.current = globalThis.crypto.randomUUID()
            router.push('/solicitacoes')
        } finally {
            setSubmitting(false)
        }
    }

    const tipoSelecionado = tipos.find((t) => t.id === form.tipoId)
    const camposEspecificos = tipoSelecionado?.camposEspecificos ?? []

    return (
        <div className="max-w-2xl">
            <h1 className="mb-4 text-xl font-semibold">Nova Solicitação</h1>

            <form onSubmit={onSubmit} className="space-y-3">
                <input
                    name="titulo"
                    className="w-full rounded border p-2"
                    placeholder="Título"
                    value={form.titulo}
                    onChange={onChange}
                />

                <textarea
                    name="descricao"
                    className="w-full rounded border p-2"
                    placeholder="Descreva a necessidade"
                    value={form.descricao}
                    onChange={onChange}
                />

                <select
                    name="setorDestino"
                    className="w-full rounded border p-2"
                    value={form.setorDestino}
                    onChange={onChange}
                >
                    <option value="RH">RH</option>
                    <option value="DP">DP</option>
                </select>

                <select
                    name="tipoId"
                    className="w-full rounded border p-2"
                    value={form.tipoId}
                    onChange={onChange}
                >
                    <option value="">Selecione o tipo</option>
                    {tipos.map((t) => (
                        <option key={t.id} value={t.id}>
                            {`${t.codigo} - ${t.nome}`}
                        </option>
                    ))}
                </select>

                {/* CAMPOS DINÂMICOS */}
                {camposEspecificos.length ? (
                    <div className="rounded border p-3">
                        <p className="mb-2 font-medium">Campos específicos</p>

                        {camposEspecificos.map((c) => {
                            // demais campos continuam genéricos
                            return (
                                <div key={c.name} className="mb-2">
                                    <label className="mb-1 block text-sm">{c.label}</label>
                                    <input
                                        className="w-full rounded border p-2"
                                        onChange={(e) =>
                                            setExtras({ ...extras, [c.name]: e.target.value })
                                        }
                                    />
                                </div>
                            )
                        })}
                    </div>
                ) : null}

                 <button type="submit" disabled={submitting} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
                    {submitting ? 'Criando...' : 'Criar'}
                </button>
            </form>
        </div>
    )
}

