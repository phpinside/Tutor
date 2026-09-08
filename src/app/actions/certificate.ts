'use server'

import { revalidatePath } from 'next/cache'
import {
  issueCertificateDraft,
  rejectCertificateDraft,
} from '@/lib/certificate-service'
import { isSuperAdmin } from '@/lib/admin-auth'
import type { StampPosition } from '@/lib/pdf-stamp'

/**
 * 管理员开具正式证明（实习证明 / 劳务完成确认单）：在基础 PDF 上按指定位置覆盖公章并上传。
 */
export async function issueCertificate(
  draftId: string,
  stampPosition: StampPosition
) {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可开具证明' }
  }

  if (
    typeof stampPosition?.x !== 'number' ||
    typeof stampPosition?.y !== 'number' ||
    typeof stampPosition?.width !== 'number' ||
    stampPosition.width <= 0
  ) {
    return { success: false, error: '公章位置参数无效' }
  }

  const result = await issueCertificateDraft(draftId, stampPosition)
  if (result.success) {
    revalidatePath('/admin/certificates')
  }
  return result
}

/**
 * 管理员打回证明申请，填写问题说明。被打回后用户可修改后重新提交。
 */
export async function rejectCertificate(draftId: string, reason: string) {
  if (!(await isSuperAdmin())) {
    return { success: false, error: '仅超级管理员可打回申请' }
  }

  const result = await rejectCertificateDraft(draftId, reason)
  if (result.success) {
    revalidatePath('/admin/certificates')
  }
  return result
}
