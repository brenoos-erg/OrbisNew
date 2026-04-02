const assert = require('node:assert/strict')

const { buildControlledPdfWithDeps } = require('../src/lib/documents/controlledPdfPipeline')

const PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'latin1')
const DOC_BUFFER = Buffer.from('DOC-DATA')
const DOCX_BUFFER = Buffer.from('DOCX-DATA')

function makeDeps(options) {
  const steps = []
  const deps = {
    resolveAccess: async (versionId, userId, intent) => {
      steps.push(`resolve:${intent}`)
      return {
        versionId,
        documentId: 'doc-1',
        fileUrl: `/uploads/documents/${options.fileName}`,
        revisionNumber: 2,
        documentCode: 'DOC-001',
        documentTitle: 'Documento',
      }
    },
    readSourceFile: async () => {
      steps.push('read-source')
      return options.sourceBuffer
    },
    convertToPdf: async ({ fileUrl }) => {
      steps.push(`convert:${fileUrl}`)
      return {
        pdfBuffer: Buffer.from(PDF_BUFFER),
        outputFileName: `${options.baseName}.pdf`,
      }
    },
    detectFileType: () => {
      steps.push('detect-file-type')
      return {
        extension: options.extension,
        mimeType: options.mimeType,
        isPdf: options.isPdfByExtension,
        isConvertibleToPdf: options.isConvertible,
      }
    },
    detectPdfBuffer: (buffer) => {
      steps.push('detect-pdf-buffer')
      return buffer === options.sourceBuffer ? options.looksLikePdf : true
    },
    validatePdf: (buffer) => {
      steps.push(`validate:${buffer === PDF_BUFFER ? 'canonical' : 'runtime'}`)
      return { valid: true }
    },
    hasWatermark: () => {
      steps.push('has-watermark')
      return false
    },
    applyWatermark: (buffer) => {
      steps.push('apply-watermark')
      return Buffer.from(buffer)
    },
  }

  return { deps, steps }
}

async function assertFlowForSource({ sourceName, extension, sourceBuffer, looksLikePdf, isPdfByExtension, isConvertible }) {
  for (const intent of ['view', 'download', 'print']) {
    const { deps, steps } = makeDeps({
      extension,
      sourceBuffer,
      looksLikePdf,
      isPdfByExtension,
      isConvertible,
      mimeType: extension === '.pdf' ? 'application/pdf' : 'application/msword',
      fileName: `${sourceName}${extension}`,
      baseName: sourceName,
    })

    const result = await buildControlledPdfWithDeps('v-1', 'u-1', intent, deps)
    assert.equal('outputBuffer' in result, true, `${sourceName}/${intent} should resolve with output`) 

    const detectIdx = steps.indexOf('detect-pdf-buffer')
    const convertIdx = steps.findIndex((step) => step.startsWith('convert:'))
    const firstValidateIdx = steps.indexOf('validate:runtime')
    const watermarkIdx = steps.indexOf('apply-watermark')
    const secondValidateIdx = steps.lastIndexOf('validate:runtime')

    assert.ok(detectIdx >= 0, `${sourceName}/${intent}: should detect if buffer is PDF`)
    if (isConvertible && !looksLikePdf) {
      assert.ok(convertIdx > detectIdx, `${sourceName}/${intent}: convert must run after detect`) 
      assert.ok(firstValidateIdx > convertIdx, `${sourceName}/${intent}: validate converted PDF after convert`) 
    } else {
      assert.equal(convertIdx, -1, `${sourceName}/${intent}: should not convert native PDF`)
      assert.ok(firstValidateIdx > detectIdx, `${sourceName}/${intent}: validate source PDF after detect`) 
    }

    assert.ok(watermarkIdx > firstValidateIdx, `${sourceName}/${intent}: watermark only after PDF validation`) 
    assert.ok(secondValidateIdx > watermarkIdx, `${sourceName}/${intent}: final PDF must be validated after watermark`) 
  }
}

async function run() {
  await assertFlowForSource({
    sourceName: 'native',
    extension: '.pdf',
    sourceBuffer: PDF_BUFFER,
    looksLikePdf: true,
    isPdfByExtension: true,
    isConvertible: false,
  })

  await assertFlowForSource({
    sourceName: 'word-doc',
    extension: '.doc',
    sourceBuffer: DOC_BUFFER,
    looksLikePdf: false,
    isPdfByExtension: false,
    isConvertible: true,
  })

  await assertFlowForSource({
    sourceName: 'word-docx',
    extension: '.docx',
    sourceBuffer: DOCX_BUFFER,
    looksLikePdf: false,
    isPdfByExtension: false,
    isConvertible: true,
  })

  const blocked = await buildControlledPdfWithDeps('v-2', 'u-2', 'view', {
    resolveAccess: async () => ({
      termChallenge: { requiresTerm: true, term: { id: 't1', title: 'Termo', content: 'Conteúdo' } },
      status: 403,
    }),
    readSourceFile: async () => {
      throw new Error('should not read file when term is pending')
    },
    convertToPdf: async () => {
      throw new Error('should not convert when term is pending')
    },
    detectFileType: () => ({ extension: '.pdf', mimeType: 'application/pdf', isPdf: true, isConvertibleToPdf: false }),
    detectPdfBuffer: () => true,
    validatePdf: () => ({ valid: true }),
    hasWatermark: () => false,
    applyWatermark: (buffer) => buffer,
  })

  assert.equal('termChallenge' in blocked, true, 'must block flow when term is not accepted')

  console.log('document-controlled-pipeline-e2e-behavior ok')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})