export type CoachReviewSnapshot = {
  id: string
  teacherId: string
  firstReviewOperatorId: string | null
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
}

export type ReviewBadgeInfo = {
  text: string
  variant: 'first' | 'final' | 'merged'
}

export function getReviewBadgeForViewer(
  review: CoachReviewSnapshot | undefined,
  viewer: { operatorId: string | null; isSuperAdmin: boolean }
): ReviewBadgeInfo | null {
  if (!review) return null

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

  // 待复审 / 待审核：仅超管可见
  if (viewer.isSuperAdmin && review.finalReviewVerdict === 'PENDING') {
    if (!review.firstReviewOperatorId) {
      return { text: '待审核·管理员', variant: 'merged' }
    }
    if (review.stage === 'FINAL_REVIEW') {
      return { text: '待复审·管理员', variant: 'final' }
    }
  }

  return null
}
