import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

type UploadGeneratedFileParams = {
  fileName: string
  buffer: Buffer
  contentType?: string
}

export async function uploadGeneratedFile({ fileName, buffer }: UploadGeneratedFileParams) {
  const driver = process.env.STORAGE_DRIVER?.toUpperCase() || 'LOCAL'

  if (driver !== 'LOCAL') {
    throw new Error(
      `Storage driver ${driver} ainda não implementado neste ambiente. Configure STORAGE_DRIVER=LOCAL ou implemente integração externa.`,
    )
  }

  const relPath = `/generated/${fileName}`
  const absPath = path.join(process.cwd(), 'public', relPath)
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, buffer)

  return {
    url: relPath,
    path: absPath,
  }
}