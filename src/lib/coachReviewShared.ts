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

  if (
    viewer.operatorId &&
    review.firstReviewOperatorId === viewer.operatorId &&
    review.stage === 'FIRST_REVIEW' &&
    review.firstReviewVerdict === 'PENDING' &&
    review.finalReviewVerdict === 'PENDING'
  ) {
    return { text: '待初审', variant: 'first' }
  }

  if (viewer.isSuperAdmin && review.finalReviewVerdict === 'PENDING') {
    if (!review.firstReviewOperatorId) {
      return { text: '待审核', variant: 'merged' }
    }
    if (review.stage === 'FINAL_REVIEW') {
      return { text: '待复审', variant: 'final' }
    }
  }

  return null
}
