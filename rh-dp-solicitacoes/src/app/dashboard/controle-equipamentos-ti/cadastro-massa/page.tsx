'use client'

import { useState } from 'react'
import { TI_EQUIPMENT_CATEGORIES, TI_EQUIPMENT_STATUSES } from '@/lib/tiEquipment'

type Row = { lineNumber:number; patrimonio?:string; serialNumber?:string; brand?:string; model?:string; hostname?:string; responsibleEmail?:string; status?:string; local?:string; observations?:string }

export default function CadastroMassaPage() {
  const [step, setStep] = useState(1)
  const [rows, setRows] = useState<Row[]>([{ lineNumber: 1 }])
  const [common, setCommon] = useState<any>({ costCenterId:'', category:'NOTEBOOK', status:'IN_STOCK', source:'MANUAL' })
  const [preview, setPreview] = useState<any>(null)
  const [result, setResult] = useState<any>(null)

  async function runPreview() {
    const r = await fetch('/api/controle-equipamentos-ti/cadastro-massa/preview',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ common, rows }) })
    setPreview(await r.json()); setStep(3)
  }
  async function runCommit() {
    const r = await fetch('/api/controle-equipamentos-ti/cadastro-massa',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ common, rows, importValidOnly:true }) })
    setResult(await r.json()); setStep(4)
  }
  function pasteExcel(text:string){
    const parsed = text.split(/\r?\n/).map((l)=>l.trim()).filter(Boolean).map((line,i)=>{ const c=line.split('\t'); return { lineNumber: rows.length+i+1, patrimonio:c[0], serialNumber:c[1], brand:c[2], model:c[3], responsibleEmail:c[4], local:c[5], observations:c[6] } })
    setRows((prev)=>[...prev,...parsed])
  }

  return <div className='app-page space-y-4'>
    <div className='app-card p-4'><h1 className='text-xl font-semibold'>Cadastro em Massa de Equipamentos TI</h1><p>Use esta tela para cadastrar vários equipamentos de uma vez. Os dados comuns serão aplicados a todas as linhas. Revise a prévia antes de confirmar.</p></div>
    {step===1 && <div className='app-card p-4 grid md:grid-cols-3 gap-3'>
      <input className='app-input' placeholder='Centro de custo (ID)' value={common.costCenterId} onChange={e=>setCommon({...common,costCenterId:e.target.value})}/>
      <select className='app-select' value={common.category} onChange={e=>setCommon({...common,category:e.target.value})}>{TI_EQUIPMENT_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
      <select className='app-select' value={common.status} onChange={e=>setCommon({...common,status:e.target.value})}>{TI_EQUIPMENT_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
      <button className='app-button-primary px-3 py-2' onClick={()=>setStep(2)}>Próximo</button>
    </div>}
    {step===2 && <div className='app-card p-4 space-y-2 overflow-auto'>
      <textarea className='app-input w-full' placeholder='Cole do Excel aqui' onBlur={(e)=>e.target.value && pasteExcel(e.target.value)} />
      <table className='min-w-full text-sm'><thead><tr><th>#</th><th>Patrimônio</th><th>Serial</th><th>Marca</th><th>Modelo</th><th>Hostname</th><th>Responsável</th><th>Status</th><th>Local</th><th>Obs</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.lineNumber}</td><td><input className='app-input' value={r.patrimonio||''} onChange={e=>{const n=[...rows];n[i].patrimonio=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.serialNumber||''} onChange={e=>{const n=[...rows];n[i].serialNumber=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.brand||''} onChange={e=>{const n=[...rows];n[i].brand=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.model||''} onChange={e=>{const n=[...rows];n[i].model=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.hostname||''} onChange={e=>{const n=[...rows];n[i].hostname=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.responsibleEmail||''} onChange={e=>{const n=[...rows];n[i].responsibleEmail=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.status||''} onChange={e=>{const n=[...rows];n[i].status=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.local||''} onChange={e=>{const n=[...rows];n[i].local=e.target.value;setRows(n)}}/></td><td><input className='app-input' value={r.observations||''} onChange={e=>{const n=[...rows];n[i].observations=e.target.value;setRows(n)}}/></td></tr>)}</tbody></table>
      <div className='flex gap-2'><button className='app-button-secondary px-3 py-2' onClick={()=>setRows([...rows,{lineNumber:rows.length+1}])}>Adicionar linha</button><button className='app-button-primary px-3 py-2' onClick={runPreview}>Validar / Prévia</button></div>
    </div>}
    {step===3 && <div className='app-card p-4'><pre className='text-xs overflow-auto'>{JSON.stringify(preview,null,2)}</pre><button className='app-button-primary px-3 py-2' onClick={runCommit}>Confirmar cadastro em massa</button></div>}
    {step===4 && <div className='app-card p-4'><h2 className='font-semibold'>Resultado</h2><pre className='text-xs overflow-auto'>{JSON.stringify(result,null,2)}</pre></div>}
  </div>
}
