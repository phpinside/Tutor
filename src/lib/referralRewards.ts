// 邀请奖励 - 授课达标规则
// 背景：自北京时间 2026-10-01 起，授课奖励门槛（直接/间接邀请相同）由 10 课时统一提高到 20 课时，
// 被邀老师正式开课并完成 20 课时后，邀请人方可获得授课奖励（一级 100元/人、二级 20元/人）。

// 北京时间 2026-10-01 00:00:00
export const NEW_TEACHING_RULE_EFFECTIVE_AT = new Date('2026-09-30T16:00:00.000Z')

// 规则更新公告展示截止：北京时间 2026-12-31 24:00
export const NEW_TEACHING_RULE_NOTICE_END_AT = new Date('2026-12-31T15:59:59.999Z')

export const TEACHING_HOURS_OLD = 10
export const TEACHING_HOURS_NEW = 20

/** 判定授课奖励达标时使用的课时门槛（按判定时间区分新旧规则，直接/间接邀请相同） */
export function getTeachingHoursRequirement(now: Date = new Date()): number {
  if (now.getTime() >= NEW_TEACHING_RULE_EFFECTIVE_AT.getTime()) {
    return TEACHING_HOURS_NEW
  }
  return TEACHING_HOURS_OLD
}

/** 新规则是否已生效（北京时间 2026-10-01 起） */
export function isNewTeachingRuleEffective(now: Date = new Date()): boolean {
  return now.getTime() >= NEW_TEACHING_RULE_EFFECTIVE_AT.getTime()
}

/** 是否展示"规则更新"公告（上线起至北京时间 2026-12-31 24:00） */
export function shouldShowRuleUpdateNotice(now: Date = new Date()): boolean {
  return now.getTime() <= NEW_TEACHING_RULE_NOTICE_END_AT.getTime()
}
