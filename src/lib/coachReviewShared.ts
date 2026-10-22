// 永久拒绝入驻提示（登录 / 注册 / 会话踢出共用）
export const PERMANENTLY_REJECTED_MESSAGE = '经评估，您暂不符合入驻要求。感谢关注！'

export type CoachReviewSnapshot = {
  id: string
  teacherId: string
  firstReviewOperatorId: string | null
  finalReviewOperatorId: string | null
  firstReviewVerdict: string
  firstReviewedBy: string | null
  firstReviewedAt: Date | null
  firstReviewNote: string | null
  finalReviewVerdict: string
  finalReviewedBy: string | null
  finalReviewedAt: Date | null
  finalReviewNote: string | null
  stage: string
  attemptCount: number
  resolvedManagerPhone: string | null
  resolveSource: string | null
  firstReviewOperatorName: string | null
  finalReviewOperatorName: string | null
}

export type ReviewBadgeInfo = {
  text: string
  variant: 'first' | 'final' | 'merged' | 'rejected'
}

export function getReviewBadgeForViewer(
  review: CoachReviewSnapshot | undefined,
  viewer: { operatorId: string | null; isSuperAdmin: boolean; canFinalReview?: boolean }
): ReviewBadgeInfo | null {
  if (!review) return null

  // 已永久拒绝：所有查看者可见
  if (review.stage === 'PERMANENTLY_REJECTED') {
    return { text: '已永久拒绝', variant: 'rejected' }
  }

  // 待初审：两级流程，FIRST_REVIEW 阶段
  if (
    review.stage === 'FIRST_REVIEW' &&
    review.firstReviewVerdict === 'PENDING' &&
    review.finalReviewVerdict === 'PENDING' &&
    review.firstReviewOperatorId
  ) {
    // 学管只看到分配给自己的
    if (viewer.operatorId && review.firstReviewOperatorId === viewer.operatorId) {
      const name = review.firstReviewOperatorName || '未知'
      return { text: `待初审·${name}`, variant: 'first' }
    }
    // 超管看到所有待初审，附审核人姓名
    if (viewer.isSuperAdmin) {
      const name = review.firstReviewOperatorName || '未知'
      return { text: `待初审·${name}`, variant: 'first' }
    }
  }

  // 待审核（合并审核，无初审人）：仅超管可见
  if (
    viewer.isSuperAdmin &&
    review.finalReviewVerdict === 'PENDING' &&
    !review.firstReviewOperatorId
  ) {
    return { text: '待审核·管理员', variant: 'merged' }
  }

  // 待复审（两级流程）：超管 / 被指派复审人 / 初审人 / 有复审权限的运营可见，附复审负责人
  if (
    review.stage === 'FINAL_REVIEW' &&
    review.finalReviewVerdict === 'PENDING' &&
    review.firstReviewOperatorId
  ) {
    const isAssignedFinalReviewer =
      viewer.operatorId !== null && review.finalReviewOperatorId === viewer.operatorId
    const isFirstReviewer =
      viewer.operatorId !== null && review.firstReviewOperatorId === viewer.operatorId
    if (viewer.isSuperAdmin || isAssignedFinalReviewer || isFirstReviewer || viewer.canFinalReview) {
      const name = review.finalReviewOperatorName || '超管'
      return { text: `待复审·${name}`, variant: 'final' }
    }
  }

  return null
}
