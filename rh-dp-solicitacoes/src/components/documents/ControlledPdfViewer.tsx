'use client'

import { Download, Loader2, Printer, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type Props = {
  versionId: string
  initialIntent?: 'view' | 'print'
  canDownload?: boolean
  canPrint?: boolean
}

export default function ControlledPdfViewer({ versionId, initialIntent = 'view', canDownload = true, canPrint = true }: Props) {
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null)
  const [nativeMode, setNativeMode] = useState(false)
  const [nativeUrl, setNativeUrl] = useState<string | null>(null)
  const [nativeMimeType, setNativeMimeType] = useState<string>('')
  const [nativeFileName, setNativeFileName] = useState<string>('')
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const initialIntentRef = useRef<'view' | 'print'>(initialIntent)

  const endpointBase = useMemo(() => `/api/documents/versions/${encodeURIComponent(versionId)}/controlled`, [versionId])
  const acceptTermForIntent = async (term: { id: string; title: string; content: string }, intent: 'VIEW' | 'DOWNLOAD' | 'PRINT') => {
    const accepted = window.confirm(
      `Para continuar, é necessário aceitar o termo "${term.title}" para a ação ${intent}.\n\n${term.content}\n\nDeseja aceitar agora?`,
    )
    if (!accepted) return false

    const response = await fetch('/api/documents/term/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        termId: term.id,
        versionId,
        intent,
      }),
    })

    return response.ok
  }
  const fetchControlledAction = async (
    intent: 'download' | 'print',
    retryAfterTermAcceptance = true,
  ): Promise<Response> => {
    const response = await fetch(`${endpointBase}?action=${intent}`, {
      cache: 'no-store',
      credentials: 'include',
    })

    if (response.ok) return response

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; requiresTerm?: boolean; term?: { id: string; title: string; content: string } }
      | null

    if (retryAfterTermAcceptance && response.status === 403 && payload?.requiresTerm && payload.term?.id) {
      const accepted = await acceptTermForIntent(payload.term, intent.toUpperCase() as 'DOWNLOAD' | 'PRINT')
      if (accepted) return fetchControlledAction(intent, false)
      throw new Error(
        intent === 'download'
          ? 'O termo de responsabilidade para download não foi aceito.'
          : 'O termo de responsabilidade para impressão não foi aceito.',
      )
    }

    throw new Error(
      payload?.error
        ?? (intent === 'download'
          ? 'Não foi possível preparar o arquivo para download.'
          : 'Não foi possível preparar o PDF para impressão.'),
    )
  }

  const getSuggestedFileName = (response: Response) => {
    const disposition = response.headers.get('content-disposition') ?? ''
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
    const basicMatch = disposition.match(/filename="?([^"]+)"?/i)
    if (basicMatch?.[1]) return basicMatch[1]
    return `documento-${versionId}.pdf`
  }

  const revokeNativeUrl = () => {
    if (!nativeUrl) return
    URL.revokeObjectURL(nativeUrl)
    setNativeUrl(null)
  }

  const getNativeExtension = () => nativeFileName.split('.').pop()?.trim().toLowerCase() ?? ''
  const isImageNative = () => nativeMimeType.startsWith('image/')
  const isHtmlNative = () => nativeMimeType.includes('text/html') || getNativeExtension() === 'html' || getNativeExtension() === 'htm'
  const isPdfNative = () => nativeMimeType.includes('application/pdf') || getNativeExtension() === 'pdf'
  const isOfficeNative = () => ['doc', 'docx', 'xls', 'xlsx'].includes(getNativeExtension())
  const loadPdf = async () => {
    setLoading(true)
    setError(null)
    try {
      const intent = initialIntentRef.current
      initialIntentRef.current = 'view'

      const response = await fetch(`${endpointBase}?action=${intent}`, {
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? 'Não foi possível carregar o PDF para visualização.')
      }

      const buffer = await response.arrayBuffer()
      const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
      const nativeName = getSuggestedFileName(response)
      setNativeFileName(nativeName)
      setNativeMimeType(contentType)
      if (!contentType.includes('application/pdf')) {
        revokeNativeUrl()
        const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' })
        setNativeUrl(URL.createObjectURL(blob))
        setNativeMode(true)
        setPdf((current) => {
          current?.destroy().catch(() => null)
          return null
        })
        setPageCount(0)
        setSourceBytes(null)
        return
      }

      setNativeMode(false)
      revokeNativeUrl()
      const bytes = new Uint8Array(buffer)
      setSourceBytes(bytes)

      const loadedPdf = await getDocument({ data: bytes }).promise
      setPdf((current) => {
        current?.destroy().catch(() => null)
        return loadedPdf
      })
      setPageCount(loadedPdf.numPages)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao abrir o visualizador do documento.')
      setPdf((current) => {
        current?.destroy().catch(() => null)
        return null
      })
      setPageCount(0)
      setNativeMode(false)
      revokeNativeUrl()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPdf()

    return () => {
      setPdf((current) => {
        current?.destroy().catch(() => null)
        return null
      })
      revokeNativeUrl()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointBase])

  useEffect(() => {
    const renderPages = async () => {
      if (!pdf || pageCount < 1) return
      setRendering(true)

      try {
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1.35 })
          const canvas = canvasRefs.current[pageNumber - 1]
          if (!canvas) continue
          const context = canvas.getContext('2d')
          if (!context) continue

          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          canvas.style.width = `${Math.ceil(viewport.width)}px`
          canvas.style.height = `${Math.ceil(viewport.height)}px`

          await page.render({ canvasContext: context, viewport }).promise
        }
      } finally {
        setRendering(false)
      }
    }

    void renderPages()
  }, [pdf, pageCount])

  const downloadFile = async () => {
    try {
      const response = await fetchControlledAction('download')
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = getSuggestedFileName(response)
      anchor.rel = 'noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao baixar o documento.')
    }
  }

 const printFile = async () => {
    try {
      const response = await fetchControlledAction('print')

     const blob = await response.blob()
      if (!blob.type.toLowerCase().includes('pdf')) {
        const objectUrl = URL.createObjectURL(blob)
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      const frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.right = '0'
      frame.style.bottom = '0'
      frame.style.width = '0'
      frame.style.height = '0'
      frame.style.border = '0'
      frame.src = objectUrl

        frame.onload = () => {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
        setTimeout(() => {
          URL.revokeObjectURL(objectUrl)
          frame.remove()
        }, 30_000)
      }


      document.body.appendChild(frame)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao acionar impressão do documento.')
    }
  }
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-600">
        <Loader2 size={16} className="animate-spin" /> Carregando PDF controlado…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        <p className="font-medium">Não foi possível abrir o documento.</p>
        <p className="mt-1">{error}</p>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
          onClick={() => void loadPdf()}
        >
        <RefreshCcw size={14} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!sourceBytes || pageCount < 1) {
    if (nativeMode) {
      const openNativeFile = () => {
        if (!nativeUrl) return
        window.open(nativeUrl, '_blank', 'noopener,noreferrer')
      }

      return (
        <div className="space-y-3">
          {isOfficeNative() ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Este documento está em formato nativo.</p>
              <p className="mt-1">Baixe ou abra o arquivo original para imprimir.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
                  onClick={() => void downloadFile()}
                >
                  <Download size={14} /> Baixar documento
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  onClick={openNativeFile}
                >
                  Abrir arquivo original
                </button>
              </div>
            </div>
          ) : null}

          {isImageNative() && nativeUrl ? (
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              <img src={nativeUrl} alt="Visualização do documento" className="mx-auto h-auto max-w-full" />
            </div>
          ) : null}

          {isHtmlNative() && nativeUrl ? (
            <iframe className="h-[calc(100vh-180px)] w-full rounded-lg border border-slate-200 bg-white" src={nativeUrl} title="Visualização HTML do documento" />
          ) : null}

          {isPdfNative() && nativeUrl ? (
            <iframe className="h-[calc(100vh-180px)] w-full rounded-lg border border-slate-200 bg-white" src={`${nativeUrl}#toolbar=0&navpanes=0`} title="Visualização do PDF original" />
          ) : null}

          {!isOfficeNative() && !isImageNative() && !isHtmlNative() && !isPdfNative() ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Este documento não pode ser renderizado no navegador. Use o download para abrir o arquivo original.
            </div>
          ) : null}
        </div>
      )
    }
    return <div className="p-5 text-sm text-slate-700">PDF indisponível para esta versão.</div>
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="text-sm text-slate-700">
          Documento carregado com {pageCount} página{pageCount > 1 ? 's' : ''}.
          {rendering ? <span className="ml-2 text-xs text-slate-500">Renderizando…</span> : null}
        </div>

        <div className="flex items-center gap-2">
          {canDownload ? (
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
              onClick={() => void downloadFile()}
            >
              <Download size={14} /> Baixar
            </button>
          ) : null}
          {canPrint ? (
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => void printFile()}
            >
              <Printer size={14} /> Imprimir
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 pb-6">
        {Array.from({ length: pageCount }).map((_, idx) => (
          <div key={idx} className="overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <canvas ref={(element) => { canvasRefs.current[idx] = element }} className="mx-auto block max-w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
