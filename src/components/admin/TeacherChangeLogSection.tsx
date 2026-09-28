import { formatDateTime } from '@/lib/utils'
import type { Prisma } from '@prisma/client'

type ChangeLogEntry = {
  id: string
  actorType: string
  actorId: string
  actorName: string | null
  action: string
  detail: Prisma.JsonValue | null
  createdAt: Date
}

const ACTION_LABELS: Record<string, string> = {
  UPDATE_TEACHER_INFO: '修改基础信息',
  RESET_TEACHER_PASSWORD: '重置登录密码',
  CLAIM_TEACHER: '认领老师',
  REMOVE_FROM_TEAM: '移出团队',
  UPDATE_TEACHER_FOLLOWER: '更换跟进人',
  UPDATE_FIRST_REVIEWER: '更换初审负责人',
  FINAL_REVIEW: '入驻复审',
}

const FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  phone: '手机号',
  gender: '性别',
  age: '年龄',
  school: '学校',
  graduationYear: '毕业年份',
  identity: '身份',
  gaokaoProvince: '高考省份',
  subjects: '可教学科',
  primarySubject: '最擅长学科',
  mathScore: '高考数学分',
  physicsScore: '高考物理分',
  chemistryScore: '高考化学分',
  mathCompetition: '数学竞赛',
  scienceCompetition: '竞赛经历',
  teachingExperience: '教学经验',
  gradePreference: '可辅导学段',
  teachingStrengths: '擅长方向',
  teachingStyle: '教学风格',
  studentTypes: '擅长学生类型',
  weekdayTime: '工作日时间',
  weekendTime: '周末时间',
  holidayTime: '假期时间',
}

const ACTOR_LABELS: Record<string, string> = {
  TEACHER: '老师本人',
  OPERATOR: '学管/运营',
  ADMIN: '管理员',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '空'
  if (Array.isArray(value)) return value.join('、')
  return String(value)
}

function formatDetail(action: string, detail: Prisma.JsonValue | null): string {
  if (!detail || typeof detail !== 'object') return ''
  const record = detail as Record<string, unknown>
  const changes = record.changes
  if (action === 'UPDATE_TEACHER_INFO' && changes && typeof changes === 'object') {
    const parts: string[] = []
    for (const [field, change] of Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>)) {
      const label = FIELD_LABELS[field] ?? field
      parts.push(`${label}：${formatValue(change.from)} → ${formatValue(change.to)}`)
    }
    return parts.join('；')
  }
  const json = JSON.stringify(detail)
  return json.length > 120 ? `${json.slice(0, 120)}…` : json
}

export default function TeacherChangeLogSection({
  logs,
}: {
  logs: ChangeLogEntry[]
}) {
  return (
    <div className="card mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">修改日志</h2>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">暂无修改记录</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const summary = formatDetail(log.action, log.detail)
            return (
              <div key={log.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {ACTOR_LABELS[log.actorType] ?? log.actorType} · {log.actorName || log.actorId}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                {summary && (
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed break-all">{summary}</p>
                )}
              </div>
            )
          })}
          <p className="text-xs text-gray-400">仅展示最近 30 条记录；完整记录见「审计日志」。</p>
        </div>
      )}
    </div>
  )
}
