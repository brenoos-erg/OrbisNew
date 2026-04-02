import {
  buildControlledPdf,
  type BuildControlledPdfResult,
  type ControlledPdfError,
  type ControlledPdfTermChallenge,
} from '@/lib/documents/controlledPdfPipeline'

export type FinalPdfError = ControlledPdfError
export type FinalPdfTermChallenge = ControlledPdfTermChallenge
export type ResolveDocumentFinalPdfResult = BuildControlledPdfResult

export const resolveDocumentFinalPdf = buildControlledPdf