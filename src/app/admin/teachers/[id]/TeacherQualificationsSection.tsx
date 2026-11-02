import { prisma } from '@/lib/prisma'
import { generatePrivateUrl } from '@/lib/qiniu'
import {
  QUALIFICATION_TYPE_LABELS,
  QUALIFICATION_SOURCE_LABELS,
  TEACHER_CERT_STAGE_LABELS,
  TEACHER_CERT_SUBJECT_LABELS,
  parseQualificationFiles,
  parseQualificationMeta,
} from '@/lib/teacherQualificationShared'
import type { QualificationType } from '@/lib/teacherQualificationShared'
import { formatDateTime } from '@/lib/utils'

const TYPE_ORDER: QualificationType[] = ['GAOKAO_SCORE', 'DEGREE_CERT', 'TEACHER_CERT', 'MANDARIN_CERT']

function renderMeta(meta: ReturnType<typeof parseQualificationMeta>, type: QualificationType): string[] {
  const parts: string[] = []
  if (type === 'DEGREE_CERT') {
    if (meta.degreeLevel) parts.push(`学历层次：${meta.degreeLevel}`)
    if (meta.verifyCode) parts.push(`学信网在线验证码：${meta.verifyCode}`)
  }
  if (type === 'TEACHER_CERT') {
    if (meta.certStage) parts.push(`学段：${TEACHER_CERT_STAGE_LABELS[meta.certStage] ?? meta.certStage}`)
    if (meta.certSubject) parts.push(`学科：${TEACHER_CERT_SUBJECT_LABELS[meta.certSubject] ?? meta.certSubject}`)
  }
  if (type === 'MANDARIN_CERT' && meta.mandarinLevel) {
    parts.push(`等级：${meta.mandarinLevel}`)
  }
  return parts
}

/** 教练详情页：资质证明区块（入驻申报 + 质疑取证补交，文件为签名临时链接） */
export default async function TeacherQualificationsSection({
  teacherId,
}: {
  teacherId: string
}) {
  const rows = await prisma.teacherQualification.findMany({
    where: { teacherId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  const deadline = Math.floor(Date.now() / 1000) + 7200
  const items = rows.map((row) => ({
    id: row.id,
    type: row.type as QualificationType,
    source: row.source as 'ONBOARDING' | 'CHALLENGE',
    files: parseQualificationFiles(row.files),
    meta: parseQualificationMeta(row.meta),
    challengeRound: row.challengeRound,
    createdAt: formatDateTime(row.createdAt),
    signedUrls: parseQualificationFiles(row.files).map((key) => ({
      key,
      url: generatePrivateUrl(key, deadline),
    })),
  }))

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: items.filter((i) => i.type === type),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="card mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">资质证明</h2>
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-400">暂无资质证明</p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.type} className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                {QUALIFICATION_TYPE_LABELS[group.type]}
                <span className="ml-2 text-xs text-gray-400">（共 {group.items.length} 份）</span>
              </p>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 ${
                      item.source === 'CHALLENGE'
                        ? 'border-orange-200 bg-orange-50/60'
                        : 'border-gray-100 bg-gray-50/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          item.source === 'CHALLENGE'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {QUALIFICATION_SOURCE_LABELS[item.source]}
                        {item.source === 'CHALLENGE' && item.challengeRound
                          ? ` · 第 ${item.challengeRound} 轮`
                          : ''}
                      </span>
                      <span>提交于 {item.createdAt}</span>
                      {renderMeta(item.meta, item.type).map((part) => (
                        <span key={part} className="text-gray-700">
                          {part}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.signedUrls.map((file, idx) => (
                        <a
                          key={file.key}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline underline-offset-2"
                        >
                          {file.key.endsWith('.pdf') ? `查看 PDF ${idx + 1}` : `查看图片 ${idx + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">
            文件为私有存储的临时访问链接（2 小时内有效），过期后刷新页面即可。
          </p>
        </div>
      )}
    </div>
  )
}
