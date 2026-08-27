'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import {
  issueInternshipCertificateDraft,
  rejectInternshipCertificateDraft,
} from '@/lib/internship-certificate-service'
import type { StampPosition } from '@/lib/pdf-stamp'

async function requireSuperAdmin(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) return null
  try {
    const data = JSON.parse(session.value)
    if (data.role === 'super_admin') return 'ok'
    return null
  } catch {
    return null
  }
}

/**
 * 管理员开具正式实习证明：在基础 PDF 上按指定位置覆盖公章并上传。
 */
export async function issueInternshipCertificate(
  draftId: string,
  stampPosition: StampPosition
) {
  if (!(await requireSuperAdmin())) {
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

  const result = await issueInternshipCertificateDraft(draftId, stampPosition)
  if (result.success) {
    revalidatePath('/admin/internship-certificates')
  }
  return result
}

/**
 * 管理员打回实习证明申请，填写问题说明。被打回后用户可修改后重新提交。
 */
export async function rejectInternshipCertificate(draftId: string, reason: string) {
  if (!(await requireSuperAdmin())) {
    return { success: false, error: '仅超级管理员可打回申请' }
  }

  const result = await rejectInternshipCertificateDraft(draftId, reason)
  if (result.success) {
    revalidatePath('/admin/internship-certificates')
  }
  return result
}
