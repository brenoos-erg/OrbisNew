import fs from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import {
  QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE,
  requireQualityDocumentManager,
} from '@/lib/documents/documentManagementAccess'
import {
  buildContentDispositionHeader,
  buildDocumentDownloadFilename,
} from '@/lib/documents/documentDownloadFilename'
import { resolveDocumentFileType } from '@/lib/documents/fileType'