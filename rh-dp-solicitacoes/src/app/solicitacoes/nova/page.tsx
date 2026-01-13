'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type TipoCampo = {
    name: string
    label: string
    type?: string
    required?: boolean
}

type TipoSolicitacao = {
    id: string
    nome: string
    descricao?: string
    camposEspecificos?: TipoCampo[]
}

type Position = {
    id: string
    name: string
    sectorProject?: string | null
    workplace?: string | null
    workSchedule?: string | null
    mainActivities?: string | null
    complementaryActivities?: string | null
    schooling?: string | null
    course?: string | null
    schoolingCompleted?: string | null
    courseInProgress?: string | null
    periodModule?: string | null
    requiredKnowledge?: string | null
    behavioralCompetencies?: string | null
    enxoval?: string | null
    uniform?: string | null
    others?: string | null
    workPoint?: string | null
    site?: string | null
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

    // cargos (Position)
    const [positions, setPositions] = useState<Position[]>([])

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


    // carregar cargos
    useEffect(() => {
        async function loadPositions() {
            try {
                const res = await fetch('/api/positions')
                if (!res.ok) {
                    console.error('Erro ao carregar cargos')
                    return
                }
                const data = await res.json()
                setPositions(data)
            } catch (err) {
                console.error('Erro ao carregar cargos', err)
            }
        }

        loadPositions()
    }, [])

    // campos fixos
    const onChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    // quando escolher um cargo
    function handleCargoChange(positionId: string) {
        const pos = positions.find((p) => p.id === positionId)

        if (!pos) {
            setExtras((prev) => ({ ...prev, cargoId: positionId, cargo: '' }))
            return
        }

        setExtras((prev) => ({
            ...prev,

            cargoId: positionId,
            cargo: pos.name,

            // mapeamento: Position -> campos do schemaJson da RQ_063
            setorOuProjeto: pos.sectorProject ?? '',
            localTrabalho: pos.workplace ?? '',
            horarioTrabalho: pos.workSchedule ?? '',
            principaisAtividades: pos.mainActivities ?? '',
            atividadesComplementares: pos.complementaryActivities ?? '',
            escolaridade: pos.schooling ?? '',
            curso: pos.course ?? '',
            escolaridadeCompleta: pos.schoolingCompleted ?? '',
            cursoEmAndamento: pos.courseInProgress ?? '',
            periodoModulo: pos.periodModule ?? '',
            requisitosConhecimentos: pos.requiredKnowledge ?? '',
            competenciasComportamentais: pos.behavioralCompetencies ?? '',
            enxoval: pos.enxoval ?? '',
            uniforme: pos.uniform ?? '',
            outros: pos.others ?? '',
            pontoTrabalho: pos.workPoint ?? '',
            localMatrizFilial: pos.site ?? '',
        }))
    }

    // enviar formulário
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        await fetch('/api/solicitacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...form,
                payload: extras, // aqui vão os campos da RQ_063
            }),
        })

        router.push('/solicitacoes')
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
                            {t.nome}
                        </option>
                    ))}
                </select>

                {/* CAMPOS DINÂMICOS */}
                {camposEspecificos.length ? (
                    <div className="rounded border p-3">
                        <p className="mb-2 font-medium">Campos específicos</p>

                        {camposEspecificos.map((c) => {
                            // campo de cargo vira SELECT ligado na tabela Position
                            if (c.name === 'cargo') {
                                return (
                                    <div key={c.name} className="mb-2">
                                        <label className="mb-1 block text-sm">{c.label}</label>
                                        <select
                                            className="w-full rounded border p-2"
                                            value={extras.cargoId || ''}
                                            onChange={(e) => handleCargoChange(e.target.value)}
                                        >
                                            <option value="">Selecione...</option>
                                            {positions.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )
                            }

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

                <button className="rounded bg-black px-4 py-2 text-white">
                    Criar
                </button>
            </form>
        </div>
    )
}
