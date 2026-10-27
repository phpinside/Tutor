'use client'

/**
 * 信息真实性承诺声明（教练填写资料 / 提交修改申请时展示）。
 * 业界实践要点：
 * 1. 紧邻提交动作展示（承诺发生的时刻），而非仅在页面顶部；
 * 2. 明确责任范围（真实、准确、完整、有效）与禁止行为（伪造/变造/隐瞒/冒用）；
 * 3. 明确核验授权（平台可通过官方渠道复核）；
 * 4. 后果具体且分级（解除合作、取消收益、永久拒绝入驻含关联账号、保留法律追责）；
 * 5. 需显式勾选确认（电子意愿表示），未勾选不得提交。
 */

const DECLARATION_TITLE = '信息真实性承诺（请务必阅读）'

const DECLARATION_POINTS = [
  '您填写并提交的全部资料（包括但不限于姓名、高考省份、高考成绩及成绩查询截图等证明材料）必须真实、准确、完整、有效，不得伪造、变造、隐瞒或冒用他人信息。',
  '您应对所提交资料的真实性与完整性承担全部责任，并授权平台在入驻审核及后续任一环节对上述信息进行核验（包括通过官方渠道复核高考成绩）。',
  '如经查实存在虚假、伪造、变造或冒用等情形，平台有权立即解除合作（开除）并取消相关收益，永久拒绝您及关联账号的入驻申请；情节严重的，平台保留依法追究法律责任的权利。',
]

const DECLARATION_COMMITMENT =
  '我已阅读并理解以上全部内容，郑重承诺所提交的资料真实、准确、完整，如有不实，自愿承担上述全部后果。'

interface Props {
  /** 承诺勾选状态（受控） */
  checked?: boolean
  onChange?: (checked: boolean) => void
  /** 紧凑横幅模式：仅高亮提醒，不含承诺正文与勾选框 */
  variant?: 'full' | 'banner'
}

export default function AuthenticityDeclaration({ checked, onChange, variant = 'full' }: Props) {
  if (variant === 'banner') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">⚠️</span>
        <p className="leading-relaxed">
          <span className="font-semibold">诚实申报提醒：</span>
          所填写及提交的资料必须真实、准确、完整；如经查实存在虚假或伪造情形，将被解除合作（开除）并
          <span className="font-semibold">永久拒绝入驻（含关联账号）</span>
          。提交前请阅读并确认完整「{DECLARATION_TITLE}」。
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-amber-900 mb-2">{DECLARATION_TITLE}</h3>
          <ol className="space-y-2 text-sm text-amber-900/90 leading-relaxed list-decimal list-inside">
            {DECLARATION_POINTS.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ol>
          <label className="mt-3 flex items-start gap-2.5 rounded-lg bg-white/80 border border-amber-300 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked ?? false}
              onChange={(e) => onChange?.(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-900 leading-relaxed">
              {DECLARATION_COMMITMENT}
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
