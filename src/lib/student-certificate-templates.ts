import type { StudentCertificateTemplate as TemplateRow } from '@prisma/client'
import { CERTIFICATE_SLOT_KEYS, defaultCertificateSlots, type CertificateOrientation, type CertificateSlots, type CertificateTemplate, type CertificateTextSlot } from './student-certificate-config'

export function parseCertificateSlots(raw: unknown, orientation: CertificateOrientation): CertificateSlots {
  const defaults = defaultCertificateSlots(orientation)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults
  const value = raw as Record<string, unknown>
  for (const key of CERTIFICATE_SLOT_KEYS) {
    const slot = value[key]
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue
    const data = slot as Partial<CertificateTextSlot>
    if (
      typeof data.x !== 'number' || typeof data.y !== 'number' || typeof data.width !== 'number' || typeof data.height !== 'number' ||
      ![data.x, data.y, data.width, data.height].every(Number.isFinite) ||
      data.x < 0 || data.y < 0 || data.width <= 0 || data.height <= 0 || data.x + data.width > 1.001 || data.y + data.height > 1.001 ||
      typeof data.fontSize !== 'number' || data.fontSize < 12 || data.fontSize > 120 ||
      typeof data.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(data.color) ||
      !['left', 'center', 'right'].includes(data.align ?? '') || ![400, 700].includes(data.weight ?? 0) || typeof data.visible !== 'boolean' ||
      (data.frame !== undefined && typeof data.frame !== 'boolean')
    ) continue
    defaults[key] = data as CertificateTextSlot
  }
  return defaults
}

export function serializeCertificateTemplate(row: TemplateRow): CertificateTemplate {
  const orientation = row.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE'
  return {
    id: row.id, name: row.name, description: row.description, title: row.title,
    orientation, backgroundUrl: row.backgroundPath && !row.backgroundPath.startsWith('/student-certificate-templates/upload-')
      ? row.backgroundPath : `/api/student-certificate-templates/${encodeURIComponent(row.id)}/background`,
    slots: parseCertificateSlots(row.slots, orientation), isActive: row.isActive,
    sortOrder: row.sortOrder, archivedAt: row.archivedAt?.toISOString() ?? null,
  }
}
