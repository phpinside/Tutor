import { generatePrivateUrl } from '@/lib/qiniu'
import { toInfoChangeItemView } from '@/lib/teacherInfoChangeShared'
import type {
  InfoChangeReviewItemView,
  SensitiveFieldKey,
} from '@/lib/teacherInfoChangeShared'

const SENSITIVE_KEYS: SensitiveFieldKey[] = [
  'name',
  'gaokaoProvince',
  'mathScore',
  'physicsScore',
  'chemistryScore',
]

/**
 * 服务端专用：申请单 + 教练当前值 + 证明图签名 URL（2 小时有效）。
 * 仅供 Server Component 使用（含私有桶签名，不可进入客户端 bundle）。
 */
export function toInfoChangeReviewItemView(row: {
  id: string
  status: InfoChangeReviewItemView['status']
  changes: unknown
  proofImages: unknown
  reason: string | null
  createdAt: Date
  appliedAt: Date | null
  firstReviewerName: string | null
  firstReviewedAt: Date | null
  firstReviewNote: string | null
  finalReviewerName: string | null
  finalReviewedAt: Date | null
  finalReviewNote: string | null
  teacher: {
    id: string
    name: string
    phone: string
    gaokaoProvince: string | null
    mathScore: number | null
    physicsScore: number | null
    chemistryScore: number | null
  }
}): InfoChangeReviewItemView {
  const view = toInfoChangeItemView(row)
  const teacherRecord = row.teacher as unknown as Record<string, unknown>
  const proofDeadline = Math.floor(Date.now() / 1000) + 7200
  return {
    ...view,
    teacher: { id: row.teacher.id, name: row.teacher.name, phone: row.teacher.phone },
    teacherCurrent: Object.fromEntries(
      SENSITIVE_KEYS.map((key) => [
        key,
        teacherRecord[key] === null || teacherRecord[key] === undefined
          ? ''
          : String(teacherRecord[key]),
      ])
    ) as Record<SensitiveFieldKey, string>,
    proofUrls: Object.fromEntries(
      view.proofImages.map((key) => [key, generatePrivateUrl(key, proofDeadline)])
    ),
  }
}
