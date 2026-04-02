declare module 'pdfjs-dist' {
  export type PDFDocumentProxy = {
    numPages: number
    getPage: (pageNumber: number) => Promise<{
      getViewport: (options: { scale: number }) => { width: number; height: number }
      render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }
    }>
    destroy: () => Promise<void>
  }

  export const GlobalWorkerOptions: {
    workerSrc: string
  }

  export function getDocument(params: { data: Uint8Array }): {
    promise: Promise<PDFDocumentProxy>
  }
}